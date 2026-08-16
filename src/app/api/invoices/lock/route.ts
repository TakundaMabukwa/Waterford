import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const body = await request.json()
    const { month } = body

    if (!month) {
      return NextResponse.json({ error: 'month is required (format: YYYY-MM)' }, { status: 400 })
    }

    // Check if already locked
    const { data: existingLock } = await supabase
      .from('invoice_locks')
      .select('*')
      .eq('lock_month', month)
      .single()

    if (existingLock) {
      return NextResponse.json({ error: 'This month is already locked' }, { status: 400 })
    }

    // Lock all invoices for this month
    const { data: lockedInvoices, error: lockError } = await supabase
      .from('invoices')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        lock_month: month,
        updated_at: new Date().toISOString(),
      })
      .eq('lock_month', month)
      .select()

    if (lockError) throw lockError

    // Create lock record
    const { data: lockRecord, error: lockRecordError } = await supabase
      .from('invoice_locks')
      .insert([{ lock_month: month }])
      .select()
      .single()

    if (lockRecordError) throw lockRecordError

    return NextResponse.json({
      lock: lockRecord,
      lockedCount: lockedInvoices?.length || 0,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
