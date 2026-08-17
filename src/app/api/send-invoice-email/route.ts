import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL

export async function POST(request: NextRequest) {
  if (!EMAIL_SERVICE_URL) {
    return NextResponse.json({ error: 'EMAIL_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { recipients, subject, html } = body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'recipients array is required' }, { status: 400 })
    }
    if (!subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 })
    }
    if (!html) {
      return NextResponse.json({ error: 'html body is required' }, { status: 400 })
    }

    const res = await fetch(`${EMAIL_SERVICE_URL}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: recipients, subject, html }),
    })

    const result = await res.json()

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (err: any) {
    console.error('Send invoice email error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 })
  }
}
