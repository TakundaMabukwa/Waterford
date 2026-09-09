import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildInvoiceEmailHtml } from '@/lib/invoice-email-template'

type PerInvoiceRecipient = {
  id: number
  recipients: string[]
}

// Resolve any stored reference into a full, downloadable URL.
// - http(s) URLs are returned as-is.
// - Otherwise treat as a storage path and try a public URL (or signed URL).
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

  const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL!

  for (const c of candidates) {
    // 1. Public URL (stable) if the bucket is public
    const { data: pub } = supabase.storage.from(c.bucket).getPublicUrl(c.path)
    if (pub?.publicUrl && /https?:\/\//i.test(pub.publicUrl)) return pub.publicUrl

    // 2. Signed URL fallback (works for private buckets)
    const { data: sig } = await supabase.storage.from(c.bucket).createSignedUrl(c.path, 3600)
    if (sig?.signedUrl) return sig.signedUrl
  }

  // Last resort: if nothing resolved, return the storage-relative path prefixed with the base URL
  if (storageBase) return `${storageBase}/storage/v1/object/public/trip-documents/${filePath}`
  return null
}

// Derive a clean display name from the end of a path/URL (never show the raw storage URL).
function displayNameFromUrl(url: string, fallback: string): string {
  const decoded = decodeURIComponent(url)
  const last = decoded.split('#')[0].split('?')[0].split('/').filter(Boolean).pop()
  return last || fallback
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

    // Build pod_required map — exact name match ($/($) prefix IS part of the client identity)
    const { data: allClients } = await supabase.from('eps_client_list').select('name, pod_required')
    const podRequiredByName: Record<string, boolean> = {}
    for (const c of allClients || []) {
      const key = (c.name || '').trim()
      podRequiredByName[key] = Boolean(c.pod_required)
    }

    // Pre-fetch all unique trip string IDs to get numeric row IDs
    const uniqueTripIds = [...new Set(
      (invoices || [])
        .map((inv: any) => inv.trip_id)
        .filter(Boolean)
    )]

    let tripRowIdMap: Record<string, number> = {}
    let tripDetailsMap: Record<string, any> = {}
    if (uniqueTripIds.length > 0) {
      const { data: trips } = await supabase
        .from('trips')
        .select('trip_id, id, origin, destination, ordernumber')
        .in('trip_id', uniqueTripIds)
      for (const t of trips || []) {
        tripRowIdMap[t.trip_id] = t.id
        tripDetailsMap[t.trip_id] = t
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

        // Check pod_required — exact name match (client name on invoice = name in eps_client_list)
        const podRequired = podRequiredByName[(invoice.customer_name || '').trim()] || false

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
            .maybeSingle()
          const invDocs = invDocsData?.documents || []
          for (const doc of invDocs) {
            const rawUrl = String(doc.file_url || doc.file_path || '').trim()
            if (!rawUrl) continue
            const url = await resolveTripDocUrl(supabase, rawUrl)
            if (url) {
              attachments.push({ filename: displayNameFromUrl(url, doc.file_name || `document-${Date.now()}`), path: url })
            }
          }
        } else if (podRequired && !invoice.trip_id) {
          // Sundry invoice with pod_required — docs stored under sundry_invoice_id
          const { data: invDocsData } = await supabase
            .from('invoice_documents')
            .select('documents')
            .eq('sundry_invoice_id', invoice.id)
            .maybeSingle()
          const invDocs = invDocsData?.documents || []
          for (const doc of invDocs) {
            const rawUrl = String(doc.file_url || doc.file_path || '').trim()
            if (!rawUrl) continue
            const url = await resolveTripDocUrl(supabase, rawUrl)
            if (url) {
              attachments.push({ filename: displayNameFromUrl(url, doc.file_name || `document-${Date.now()}`), path: url })
            }
          }
        }
        // If pod_required is false, only invoice PDF is attached (already added above)

        // Use the finalize email template (uniform HTML for all sends)
        const tripDetail = invoice.trip_id ? tripDetailsMap[invoice.trip_id] : null
        const orderNumber = invoice.reference_number || invoice.ordernumber || invoice.trip_id || invoice.invoice_number || ''
        const emailHtml = buildInvoiceEmailHtml({
          orderNumber,
          customerName: invoice.customer_name || '',
          amount: `${invoice.is_credit_note ? '-' : ''}${Number(invoice.total_amount || invoice.amount_due || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
          currency: invoice.currency || 'ZAR',
          invoiceDate: invoice.invoice_date || '',
          invoicePdfUrl: invoice.invoice_url || '',
          isCreditNote: invoice.is_credit_note,
          attachments: attachments.slice(1).map(a => ({ name: a.filename, url: a.path })), // skip invoice PDF
        })

        const emailRes = await fetch(`${emailServiceUrl}/api/send-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipients,
            subject: `Invoice ${invoice.invoice_number || ''} - ${invoice.customer_name || 'Waterford Carriers'}`,
            html: emailHtml,
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
