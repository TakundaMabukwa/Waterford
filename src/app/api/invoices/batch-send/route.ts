import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type PerInvoiceRecipient = {
  id: number
  recipients: string[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await request.json()
    const { ids, perInvoiceRecipients, includePods = true } = body

    // Resolve the list of invoices to process. Two shapes are accepted:
    //   1. { ids: number[] }                  — legacy: send each invoice to ALL of its group emails
    //   2. { perInvoiceRecipients: [{id, recipients}] } — per-invoice, per-recipient control
    let perInvoice: PerInvoiceRecipient[]
    if (Array.isArray(perInvoiceRecipients) && perInvoiceRecipients.length > 0) {
      perInvoice = perInvoiceRecipients
        .filter((p: any) => p && Number.isFinite(Number(p.id)))
        .map((p: any) => ({
          id: Number(p.id),
          recipients: Array.isArray(p.recipients)
            ? p.recipients.map((e: any) => String(e).trim()).filter(Boolean)
            : [],
        }))
        .filter((p: PerInvoiceRecipient) => p.recipients.length > 0)
    } else if (Array.isArray(ids) && ids.length > 0) {
      perInvoice = ids.map((id: any) => ({ id: Number(id), recipients: [] })) // resolved below
    } else {
      return NextResponse.json({ error: 'No invoice IDs provided' }, { status: 400 })
    }

    if (perInvoice.length === 0) {
      return NextResponse.json({ error: 'No valid invoices to send' }, { status: 400 })
    }

    const invoiceIds = perInvoice.map((p) => p.id)

    // Fetch all invoices
    const { data: invoices, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .in('id', invoiceIds)

    if (fetchError) throw fetchError

    const results: { id: number; success: boolean; recipients?: number; error?: string }[] = []
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://102.209.118.44:9000'

    for (const map of perInvoice) {
      const invoice = (invoices || []).find((inv: any) => inv.id === map.id)
      if (!invoice) {
        results.push({ id: map.id, success: false, error: 'Invoice not found' })
        continue
      }

      try {
        if (!invoice.invoice_url) {
          results.push({ id: invoice.id, success: false, error: 'No PDF available' })
          continue
        }

        // Resolve recipient list:
        //   - If the caller supplied explicit recipients, use those.
        //   - Otherwise fall back to all emails across all configured groups.
        let recipients: string[] = map.recipients
        if (recipients.length === 0) {
          const emailGroups = invoice.invoice_email_groups || []
          for (const group of emailGroups) {
            if (group.emails) {
              recipients.push(...group.emails.filter((e: string) => e.trim()))
            }
          }
        }

        if (recipients.length === 0) {
          results.push({ id: invoice.id, success: false, error: 'No recipients selected' })
          continue
        }

        // Build attachments list — invoice PDF + PODs if requested
        const attachments: { filename: string; path: string }[] = [
          {
            filename: `${invoice.invoice_number || 'invoice'}.pdf`,
            path: invoice.invoice_url,
          },
        ]

        if (includePods && invoice.trip_id) {
          const { data: docsData } = await supabase
            .from('invoice_documents')
            .select('documents')
            .eq('trip_id', invoice.trip_id)
            .single()
          const docs = docsData?.documents || []
          for (const doc of docs) {
            if (doc.file_url && doc.file_name) {
              attachments.push({ filename: doc.file_name, path: doc.file_url })
            }
          }
        }

        if (includePods && !invoice.trip_id) {
          const { data: docsData } = await supabase
            .from('invoice_documents')
            .select('documents')
            .eq('sundry_invoice_id', invoice.id)
            .single()
          const docs = docsData?.documents || []
          for (const doc of docs) {
            if (doc.file_url && doc.file_name) {
              attachments.push({ filename: doc.file_name, path: doc.file_url })
            }
          }
        }

        const emailRes = await fetch(`${emailServiceUrl}/api/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipients,
            subject: `Invoice ${invoice.invoice_number || ''} - ${invoice.customer_name || 'Waterford Carriers'}`,
            html: buildEmailHtml(invoice),
            attachments,
          }),
        })

        if (!emailRes.ok) {
          const errText = await emailRes.text()
          throw new Error(`Email service error: ${errText}`)
        }

        results.push({ id: invoice.id, success: true, recipients: recipients.length })
      } catch (err: any) {
        results.push({ id: invoice.id, success: false, error: err.message })
      }
    }

    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function buildEmailHtml(invoice: any): string {
  const currency = invoice.currency || 'ZAR'
  const symbol = currency === 'USD' ? '$' : 'R'
  const total = Number(invoice.total_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #001e42; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">WATERFORD carriers</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb;">
        <h2 style="color: #001e42;">Invoice ${invoice.invoice_number || ''}</h2>
        <p>Dear ${invoice.customer_name || 'Valued Customer'},</p>
        <p>Please find attached your invoice for ${symbol}${total}.</p>
        <p><strong>Invoice Number:</strong> ${invoice.invoice_number || 'N/A'}</p>
        <p><strong>Invoice Date:</strong> ${invoice.invoice_date || 'N/A'}</p>
        <p><strong>Due Date:</strong> ${invoice.due_date || 'N/A'}</p>
        <p><strong>Amount Due:</strong> ${symbol}${total}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #666;">
          Waterford Carriers (Pty) Ltd | 96 Cavaleros Drive, Industries West, Germiston, 1401, South Africa | Tel: +27 (10) 300 8398
        </p>
      </div>
    </div>
  `
}
