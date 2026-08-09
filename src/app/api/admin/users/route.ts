import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: usersData, error } = await supabase
      .from('users')
      .select('*')

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: usersData || [] })
  } catch (err: any) {
    console.error('Users API error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
