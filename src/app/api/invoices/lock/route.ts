import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Resolve user for audit trail
    let lockedBy = 'unknown'
    try {
      const serverClient = await createServerClient()
      if (serverClient) {
        const { data: { user } } = await serverClient.auth.getUser()
        if (user) lockedBy = user.email || user.id || 'unknown'
      }
    } catch {}

    const body = await request.json()
    const { from, to } = body

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to dates are required (format: YYYY-MM-DD)' }, { status: 400 })
    }

    // Find finalized invoices in the date range that are not yet locked
    const { data: candidates, error: fetchError } = await supabase
      .from('invoices')
      .select('id')
      .eq('is_draft', false)
      .gte('invoice_date', from)
      .lte('invoice_date', to)
      .eq('is_locked', false)

    if (fetchError) throw fetchError
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ lockedCount: 0, message: 'All invoices in this range are already locked' })
    }

    // Lock each invoice — skip any that became locked between the read and write
    let lockedCount = 0
    const now = new Date().toISOString()
    for (const inv of candidates) {
      const { error: lockError } = await supabase
        .from('invoices')
        .update({ is_locked: true, locked_at: now, updated_at: now })
        .eq('id', inv.id)
        .eq('is_locked', false)
      if (!lockError) {
        lockedCount++
        // Log lock in audit trail
        await supabase.from('invoice_audit_log').insert({
          invoice_id: inv.id,
          action: 'locked',
          field_changed: null,
          old_value: 'Unlocked',
          new_value: `Locked (range: ${from} to ${to})`,
          changed_by: lockedBy,
        })
      }
    }

    return NextResponse.json({ lockedCount })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
