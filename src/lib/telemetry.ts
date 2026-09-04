// Parser for the telemetry websocket feed (ws://209.38.217.58:8093).
//
// Wire format: records delimited by `^`, fields delimited by `|`:
//   ^plate|speed|lat|lon|locTime|mileage|ip|status|...extra fields...^
// Example:
//   ^KY69YNGP|12|-26.23248|28.137959|2026-09-04 05:38:57|209431|57.163.1.223|Engine On||KY69YNGP - SKYCAM CAMS||Driver 14142^

export type TelemetryAlertKind =
  | 'engine_on'
  | 'ignition_on'
  | 'engine_off'
  | 'ignition_off'
  | 'fuel_fill'
  | 'fuel_theft'

export interface TelemetryRecord {
  plate: string
  plateKey: string
  speed: string
  lat: string
  lon: string
  locTime: string
  mileage: string
  ip: string
  status: string
  raw: string
}

export interface TelemetryAlert extends TelemetryRecord {
  id: string
  kind: TelemetryAlertKind
  label: string
  receivedAt: string
}

export const normalizeTelemetryPlate = (value: string | undefined | null): string =>
  String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

// Order matters: most specific first.
const KIND_PATTERNS: Array<{ kind: TelemetryAlertKind; label: string; test: RegExp }> = [
  { kind: 'fuel_theft', label: 'Possible Fuel Theft', test: /possible\s+fuel\s+theft/i },
  { kind: 'fuel_fill', label: 'Possible Fuel Fill', test: /possible\s+fuel\s+fill/i },
  { kind: 'ignition_on', label: 'Ignition On', test: /ignition\s+on/i },
  { kind: 'ignition_off', label: 'Ignition Off', test: /ignition\s+off/i },
  { kind: 'engine_on', label: 'Engine On', test: /engine\s+on/i },
  { kind: 'engine_off', label: 'Engine Off', test: /engine\s+off/i },
]

export function classifyTelemetryStatus(status: string, rawRecord?: string): { kind: TelemetryAlertKind; label: string } | null {
  const haystacks = [status || '', rawRecord || '']
  for (const { kind, label, test } of KIND_PATTERNS) {
    if (haystacks.some((h) => test.test(h))) return { kind, label }
  }
  return null
}

export function parseTelemetryRecord(segment: string): TelemetryRecord | null {
  const fields = segment.split('|')
  if (fields.length < 8) return null
  const plate = (fields[0] || '').trim()
  if (!plate) return null
  return {
    plate,
    plateKey: normalizeTelemetryPlate(plate),
    speed: (fields[1] || '').trim(),
    lat: (fields[2] || '').trim(),
    lon: (fields[3] || '').trim(),
    locTime: (fields[4] || '').trim(),
    mileage: (fields[5] || '').trim(),
    ip: (fields[6] || '').trim(),
    status: (fields[7] || '').trim(),
    raw: segment,
  }
}

// Stateful parser: chunks may split records across frames and one frame may
// hold several records. Complete `^...^` segments are emitted, the tail kept.
export function createTelemetryParser() {
  let buffer = ''

  function push(chunk: string): TelemetryRecord[] {
    buffer += chunk
    const records: TelemetryRecord[] = []
    let start = buffer.indexOf('^')
    while (start !== -1) {
      const end = buffer.indexOf('^', start + 1)
      if (end === -1) {
        buffer = buffer.slice(start)
        break
      }
      const segment = buffer.slice(start + 1, end)
      buffer = buffer.slice(end + 1)
      const record = parseTelemetryRecord(segment)
      if (record) records.push(record)
      start = buffer.indexOf('^')
    }
    // Guard against an unbounded junk buffer with no delimiters
    if (buffer.length > 65536) buffer = buffer.slice(-4096)
    return records
  }

  return { push }
}
