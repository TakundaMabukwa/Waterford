import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoice_id')

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoice_id required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('invoice_audit_log')
      .select('*')
      .eq('invoice_id', Number(invoiceId))
      .order('changed_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the authenticated user from the session (server-side, not from body)
    let changedBy = 'unknown'
    try {
      const serverClient = await createServerClient()
      if (serverClient) {
        const { data: { user } } = await serverClient.auth.getUser()
        if (user) {
          changedBy = user.email || user.id || 'unknown'
        }
      }
    } catch {
      // Fall back to 'unknown' if session can't be resolved
    }

    const body = await request.json()

    const { data, error } = await supabase
      .from('invoice_audit_log')
      .insert([{
        invoice_id: body.invoiceId,
        action: body.action,
        field_changed: body.fieldChanged || null,
        old_value: body.oldValue || null,
        new_value: body.newValue || null,
        changed_by: changedBy,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
