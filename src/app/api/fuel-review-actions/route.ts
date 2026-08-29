import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const actionType = searchParams.get('action_type')

    let query = supabase
      .from('fuel_review_actions')
      .select('*')
      .order('created_at', { ascending: false })

    if (date) {
      query = query.eq('review_date', date)
    }
    if (actionType) {
      query = query.eq('action_type', actionType)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vehicle_reg, review_date, action_type, confirmed, investigated, reviewed_by, notes } = body

    if (!vehicle_reg || !review_date || !action_type) {
      return NextResponse.json({ error: 'vehicle_reg, review_date, and action_type are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('fuel_review_actions')
      .upsert(
        {
          vehicle_reg,
          review_date,
          action_type,
          confirmed: confirmed ?? false,
          investigated: investigated ?? false,
          reviewed_by: reviewed_by || null,
          reviewed_at: (confirmed || investigated) ? new Date().toISOString() : null,
          notes: notes || null,
        },
        { onConflict: 'vehicle_reg,review_date,action_type' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, confirmed, investigated, reviewed_by, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const update: Record<string, any> = {}
    if (confirmed !== undefined) update.confirmed = confirmed
    if (investigated !== undefined) update.investigated = investigated
    if (reviewed_by !== undefined) update.reviewed_by = reviewed_by
    if (notes !== undefined) update.notes = notes
    if (confirmed || investigated) {
      update.reviewed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('fuel_review_actions')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
