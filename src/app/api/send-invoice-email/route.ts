import { NextRequest, NextResponse } from 'next/server'

const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL

export async function POST(request: NextRequest) {
  if (!EMAIL_SERVICE_URL) {
    return NextResponse.json({ error: 'EMAIL_SERVICE_URL not configured' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { recipients, subject, html, attachments } = body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'recipients array is required' }, { status: 400 })
    }
    if (!subject) {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 })
    }
    if (!html) {
      return NextResponse.json({ error: 'html body is required' }, { status: 400 })
    }

    const payload: any = { to: recipients, subject, html }
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      payload.attachments = attachments
    }

    const res = await fetch(`${EMAIL_SERVICE_URL}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
