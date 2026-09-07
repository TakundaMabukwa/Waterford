import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type PerInvoiceRecipient = {
  id: number
  recipients: string[]
}

async function resolveTripDocUrl(supabase: any, filePath: string): Promise<string | null> {
  if (/^https?:\/\//i.test(filePath)) return filePath

  const parts = filePath.split('/').filter(Boolean)
  const candidates: Array<{ bucket: string; path: string }> = []
  if (parts.length > 1) {
    candidates.push({ bucket: parts[0], path: parts.slice(1).join('/') })
  }
  candidates.push(
    { bucket: 'trip-documents', path: filePath },
    { bucket: 'documents', path: filePath },
    { bucket: 'uploads', path: filePath }
  )

  for (const c of candidates) {
    const { data } = await supabase.storage.from(c.bucket).createSignedUrl(c.path, 0)
    if (data?.signedUrl) return data.signedUrl
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await request.json()
    const { ids, perInvoiceRecipients } = body

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

    // Pre-fetch all unique client names to get pod_required flags
    const uniqueClientNames = [...new Set(
      (invoices || [])
        .map((inv: any) => inv.customer_name)
        .filter(Boolean)
    )]

    let podRequiredMap: Record<string, boolean> = {}
    if (uniqueClientNames.length > 0) {
      const { data: clients } = await supabase
        .from('eps_client_list')
        .select('name, pod_required')
        .in('name', uniqueClientNames)
      for (const c of clients || []) {
        podRequiredMap[c.name] = Boolean(c.pod_required)
      }
    }

    // Pre-fetch all unique trip string IDs to get numeric row IDs
    const uniqueTripIds = [...new Set(
      (invoices || [])
        .map((inv: any) => inv.trip_id)
        .filter(Boolean)
    )]

    let tripRowIdMap: Record<string, number> = {}
    if (uniqueTripIds.length > 0) {
      const { data: trips } = await supabase
        .from('trips')
        .select('trip_id, id')
        .in('trip_id', uniqueTripIds)
      for (const t of trips || []) {
        tripRowIdMap[t.trip_id] = t.id
      }
    }

    const results: { id: number; success: boolean; recipients?: number; documents?: number; error?: string }[] = []
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

        // Build attachments — always include invoice PDF
        const attachments: { filename: string; path: string }[] = [
          {
            filename: `${invoice.invoice_number || 'invoice'}.pdf`,
            path: invoice.invoice_url,
          },
        ]

        // Check pod_required for this client
        const podRequired = podRequiredMap[invoice.customer_name] || false

        if (podRequired && invoice.trip_id) {
          // Trip invoice with pod_required — fetch documents from both sources

          // Source 1: trip_documents (POD, Delivery Notes, etc.)
          const numericTripId = tripRowIdMap[invoice.trip_id]
          if (numericTripId) {
            const { data: tripDocs } = await supabase
              .from('trip_documents')
              .select('id, doc_type, file_path, created_at')
              .eq('trip_id', numericTripId)
              .order('created_at', { ascending: false })

            for (const doc of tripDocs || []) {
              const filePath = String(doc?.file_path || '').trim()
              if (!filePath) continue
              const url = await resolveTripDocUrl(supabase, filePath)
              if (url) {
                const ext = filePath.split('.').pop()?.toLowerCase() || ''
                const docName = doc.doc_type || filePath.split('/').pop() || `document-${doc.id}`
                const filename = ext && !docName.toLowerCase().endsWith(`.${ext}`)
                  ? `${docName}.${ext}`
                  : docName
                attachments.push({ filename, path: url })
              }
            }
          }

          // Source 2: invoice_documents (uploaded via invoice modal)
          const { data: invDocsData } = await supabase
            .from('invoice_documents')
            .select('documents')
            .eq('trip_id', invoice.trip_id)
            .single()
          const invDocs = invDocsData?.documents || []
          for (const doc of invDocs) {
            if (doc.file_url && doc.file_name) {
              attachments.push({ filename: doc.file_name, path: doc.file_url })
            }
          }
        } else if (podRequired && !invoice.trip_id) {
          // Sundry invoice with pod_required — only invoice_documents
          const { data: invDocsData } = await supabase
            .from('invoice_documents')
            .select('documents')
            .eq('sundry_invoice_id', invoice.id)
            .single()
          const invDocs = invDocsData?.documents || []
          for (const doc of invDocs) {
            if (doc.file_url && doc.file_name) {
              attachments.push({ filename: doc.file_name, path: doc.file_url })
            }
          }
        }
        // If pod_required is false, only invoice PDF is attached (already added above)

        const emailRes = await fetch(`${emailServiceUrl}/api/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipients,
            subject: `Invoice ${invoice.invoice_number || ''} - ${invoice.customer_name || 'Waterford Carriers'}`,
            html: buildEmailHtml(invoice),
            attachments,
          }),
          signal: AbortSignal.timeout(15000),
        })

        if (!emailRes.ok) {
          const errText = await emailRes.text()
          throw new Error(`Email service error: ${errText}`)
        }

        results.push({
          id: invoice.id,
          success: true,
          recipients: recipients.length,
          documents: attachments.length - 1, // exclude the invoice PDF itself
        })
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
        <img src="https://waterfordcarriers.online/waterford%20logo.png" alt="Waterford Carriers" style="height: 40px; margin-bottom: 8px;" />
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
