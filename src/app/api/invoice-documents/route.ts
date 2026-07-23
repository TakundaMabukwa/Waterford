import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const auditId = searchParams.get('audit_id')
  const tripId = searchParams.get('trip_id')

  if (!auditId && !tripId) {
    return NextResponse.json({ error: 'audit_id or trip_id is required' }, { status: 400 })
  }

  let query = supabase.from('invoice_documents').select('*')
  if (auditId) query = query.eq('audit_id', Number(auditId))
  if (tripId) query = query.eq('trip_id', tripId)

  const { data, error } = await query.single()
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || null })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const auditId = formData.get('audit_id') as string
    const tripId = formData.get('trip_id') as string
    const ordernumber = formData.get('ordernumber') as string
    const invoiceNumber = formData.get('invoice_number') as string
    const referenceNumber = formData.get('reference_number') as string
    const uploadedBy = formData.get('uploaded_by') as string

    if (!file || !auditId || !tripId) {
      return NextResponse.json({ error: 'file, audit_id, and trip_id are required' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `File type "${file.type}" is not allowed` }, { status: 400 })
    }

    // Max 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 20MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'bin'
    const filePath = `invoice-docs/${tripId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    // Upload to storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from('invoice-documents')
      .upload(filePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('invoice-documents').getPublicUrl(filePath)
    const publicUrl = urlData?.publicUrl || ''

    // Build document entry
    const docEntry = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file_name: file.name,
      file_path: filePath,
      file_url: publicUrl,
      file_type: file.type,
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
      uploaded_by: uploadedBy || '',
    }

    // Upsert into invoice_documents — append to documents jsonb array
    const { data: existing } = await supabase
      .from('invoice_documents')
      .select('id, documents')
      .eq('audit_id', Number(auditId))
      .single()

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
      const { error: insertError } = await supabase
        .from('invoice_documents')
        .insert([{
          audit_id: Number(auditId),
          trip_id: tripId,
          ordernumber: ordernumber || '',
          invoice_number: invoiceNumber || '',
          reference_number: referenceNumber || '',
          documents: [docEntry],
          uploaded_by: uploadedBy || '',
        }])
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
