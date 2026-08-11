import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { searchParams } = new URL(request.url)
  const auditId = searchParams.get('audit_id')
  const tripId = searchParams.get('trip_id')
  const sundryInvoiceId = searchParams.get('sundry_invoice_id')

  if (!auditId && !tripId && !sundryInvoiceId) {
    return NextResponse.json({ error: 'audit_id, trip_id, or sundry_invoice_id is required' }, { status: 400 })
  }

  let query = supabase.from('invoice_documents').select('*')
  if (auditId) query = query.eq('audit_id', Number(auditId))
  if (tripId) query = query.eq('trip_id', tripId)
  if (sundryInvoiceId) query = query.eq('sundry_invoice_id', Number(sundryInvoiceId))

  const { data, error } = await query.single()
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || null })
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await request.json()
    const { audit_id, trip_id, sundry_invoice_id, ordernumber, invoice_number, uploaded_by, document: docInfo } = body

    if (!docInfo) {
      return NextResponse.json({ error: 'document info is required' }, { status: 400 })
    }
    if (!audit_id && !sundry_invoice_id) {
      return NextResponse.json({ error: 'audit_id or sundry_invoice_id is required' }, { status: 400 })
    }

    // Build document entry
    const docEntry = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file_name: docInfo.fileName || '',
      file_path: docInfo.filePath || '',
      file_url: docInfo.fileUrl || '',
      file_type: docInfo.fileType || '',
      file_size: docInfo.fileSize || 0,
      uploaded_at: new Date().toISOString(),
      uploaded_by: uploaded_by || '',
    }

    // Upsert into invoice_documents — append to documents jsonb array
    let existing = null
    if (audit_id) {
      const { data } = await supabase
        .from('invoice_documents')
        .select('id, documents')
        .eq('audit_id', Number(audit_id))
        .single()
      existing = data
    } else if (sundry_invoice_id) {
      const { data } = await supabase
        .from('invoice_documents')
        .select('id, documents')
        .eq('sundry_invoice_id', Number(sundry_invoice_id))
        .single()
      existing = data
    }

    if (existing) {
      const updatedDocs = [...(existing.documents || []), docEntry]
      const { error: updateError } = await supabase
        .from('invoice_documents')
        .update({ documents: updatedDocs, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (updateError) {
        console.error('Update error:', updateError)
        return NextResponse.json({ error: `Failed to save document: ${updateError.message}` }, { status: 500 })
      }
    } else {
      const insertRow: any = {
        ordernumber: ordernumber || '',
        invoice_number: invoice_number || '',
        documents: [docEntry],
        uploaded_by: uploaded_by || '',
      }
      if (audit_id) {
        insertRow.audit_id = Number(audit_id)
        insertRow.trip_id = trip_id || ''
      }
      if (sundry_invoice_id) {
        insertRow.sundry_invoice_id = Number(sundry_invoice_id)
      }
      const { error: insertError } = await supabase
        .from('invoice_documents')
        .insert([insertRow])
      if (insertError) {
        console.error('Insert error:', insertError)
        return NextResponse.json({ error: `Failed to save document: ${insertError.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, document: docEntry })
  } catch (err: any) {
    console.error('Invoice document upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { searchParams } = new URL(request.url)
    const auditId = searchParams.get('audit_id')
    const docId = searchParams.get('doc_id')

    if (!auditId || !docId) {
      return NextResponse.json({ error: 'audit_id and doc_id are required' }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('invoice_documents')
      .select('id, documents')
      .eq('audit_id', Number(auditId))
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    const doc = (existing.documents || []).find((d: any) => d.id === docId)
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Remove from storage
    if (doc.file_path) {
      await supabase.storage.from('invoice-documents').remove([doc.file_path])
    }

    const updatedDocs = (existing.documents || []).filter((d: any) => d.id !== docId)
    const { error: updateError } = await supabase
      .from('invoice_documents')
      .update({ documents: updatedDocs, updated_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
