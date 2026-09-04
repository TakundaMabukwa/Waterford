// Same-origin SSE proxy for the telemetry websocket.
//
// Browsers on https cannot open ws:// directly (mixed content), so the server
// holds one upstream connection to TELEMETRY_WS_URL and fans parsed alert
// records out to EventSource subscribers. Nginx only needs to proxy Next.js.
import WebSocket from 'ws'
import {
  createTelemetryParser,
  classifyTelemetryStatus,
  type TelemetryAlert,
} from '@/lib/telemetry'

export const dynamic = 'force-dynamic'

type Subscriber = (payload: string) => void
const subscribers = new Set<Subscriber>()

let ws: WebSocket | null = null
let reconnectTimer: NodeJS.Timeout | null = null
let alertSeq = 0

const parser = createTelemetryParser()

function broadcast(alert: TelemetryAlert) {
  const payload = `data: ${JSON.stringify(alert)}\n\n`
  for (const send of [...subscribers]) {
    try {
      send(payload)
    } catch {
      subscribers.delete(send)
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectUpstream()
  }, 5000)
}

function connectUpstream() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  const url = process.env.TELEMETRY_WS_URL
  if (!url) {
    console.error('Telemetry WS: TELEMETRY_WS_URL is not set — upstream connection disabled')
    return
  }
  try {
    ws = new WebSocket(url)
  } catch (err) {
    console.error('Telemetry WS connect failed:', err)
    scheduleReconnect()
    return
  }

  const localParser = parser

  ws.on('message', (data) => {
    try {
      const records = localParser.push(data.toString())
      for (const record of records) {
        const match = classifyTelemetryStatus(record.status, record.raw)
        if (!match) continue
        alertSeq += 1
        broadcast({
          ...record,
          id: `${Date.now()}-${alertSeq}`,
          kind: match.kind,
          label: match.label,
          receivedAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('Telemetry WS parse error:', err)
    }
  })

  ws.on('error', (err) => {
    console.error('Telemetry WS error:', err?.message || err)
  })

  ws.on('close', () => {
    ws = null
    scheduleReconnect()
  })
}

connectUpstream()

export async function GET() {
  connectUpstream()

  const encoder = new TextEncoder()
  let heartbeat: NodeJS.Timeout | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send: Subscriber = (payload: string) => {
        controller.enqueue(encoder.encode(payload))
      }
      subscribers.add(send)
      // Comment heartbeat keeps intermediaries from closing idle streams
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          if (heartbeat) clearInterval(heartbeat)
        }
      }, 25000)
      ;(controller as any)._telemetrySend = send
    },
    cancel(controller) {
      const send = (controller as any)._telemetrySend as Subscriber | undefined
      if (send) subscribers.delete(send)
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
