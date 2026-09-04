import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SLIP_BUCKET = 'trip-documents'
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000 // SAST is UTC+2, no DST

const normalizeReg = (value: unknown): string =>
  String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

const sastDateString = (d: Date): string =>
  new Date(d.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10)

const extractTripRegs = (trip: any): string[] => {
  const assignments = trip?.vehicle_assignments || trip?.vehicleassignments || []
  const list = Array.isArray(assignments) ? assignments : [assignments]
  const regs = new Set<string>()
  for (const a of list) {
    const v = a?.vehicle || {}
    for (const raw of [v.name, v.registration_number, v.plate, v.registration]) {
      const n = normalizeReg(raw)
      if (n) regs.add(n)
    }
  }
  return [...regs]
}

interface SlipCandidate {
  slip_id: number
  fuel_amount: number | null
  fuel_type: string | null
  image_url: string | null
  slip_created_at: string
  trip_regs: string[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 })
    }

    // 1. Review rows for the day (fills + thefts)
    const { data: reviews, error: reviewError } = await supabase
      .from('fuel_review_actions')
      .select('*')
      .eq('review_date', date)
      .order('created_at', { ascending: false })

    if (reviewError) throw reviewError

    // 2. Slips in a padded window (day-1 .. day+1) to allow late-upload fallback.
    //    Display stays day-scoped; padding only feeds matching.
    const dayStart = new Date(`${date}T00:00:00+02:00`)
    const windowStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const windowEnd = new Date(dayStart.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()

    const { data: slips, error: slipError } = await supabase
      .from('trip_fuel_slips')
      .select('id, trip_id, file_path, fuel_amount, fuel_type, created_at, trips!inner(id, vehicle_assignments, vehicleassignments)')
      .gte('created_at', windowStart)
      .lt('created_at', windowEnd)
      .order('created_at', { ascending: true })

    if (slipError) throw slipError

    const candidates: SlipCandidate[] = (slips || []).map((s: any) => {
      const { data: urlData } = supabase.storage.from(SLIP_BUCKET).getPublicUrl(s.file_path)
      return {
        slip_id: s.id,
        fuel_amount: s.fuel_amount ?? null,
        fuel_type: s.fuel_type ?? null,
        image_url: urlData?.publicUrl || null,
        slip_created_at: s.created_at,
        trip_regs: extractTripRegs(s.trips),
      }
    })

    // 3. Match: reg MUST match (hard gate). Same SAST day preferred, ±1 day fallback.
    //    Closest |slip.created_at - review.created_at| wins. One-to-one greedy.
    const fills = (reviews || []).filter((r: any) => r.action_type === 'fill')
    const dayMs = 24 * 60 * 60 * 1000

    interface Pair { review: any; slip: SlipCandidate; gap: number; dayDiff: number }
    const pairs: Pair[] = []

    for (const review of fills) {
      const reviewReg = normalizeReg(review.vehicle_reg)
      if (!reviewReg) continue
      const reviewDay = new Date(`${review.review_date}T00:00:00+02:00`).getTime()
      const reviewCreated = review.created_at ? new Date(review.created_at).getTime() : null

      for (const slip of candidates) {
        if (!slip.trip_regs.includes(reviewReg)) continue // hard gate: reg must match
        const slipDay = new Date(`${sastDateString(new Date(slip.slip_created_at))}T00:00:00+02:00`).getTime()
        const dayDiff = Math.abs(slipDay - reviewDay) / dayMs
        if (dayDiff > 1) continue
        const gap = reviewCreated !== null
          ? Math.abs(new Date(slip.slip_created_at).getTime() - reviewCreated)
          : dayDiff * dayMs
        pairs.push({ review, slip, gap, dayDiff })
      }
    }

    pairs.sort((a, b) => a.gap - b.gap)

    const usedSlips = new Set<number>()
    const usedReviews = new Set<string>()
    const matches: Record<string, Omit<SlipCandidate, 'trip_regs'>> = {}

    for (const p of pairs) {
      if (usedReviews.has(p.review.id) || usedSlips.has(p.slip.slip_id)) continue
      usedReviews.add(p.review.id)
      usedSlips.add(p.slip.slip_id)
      const { trip_regs, ...rest } = p.slip
      matches[p.review.id] = rest
    }

    // Same-day unmatched slips (adjacent-day leftovers stay hidden — display is day-scoped)
    const unmatched_slips = candidates
      .filter((s) => !usedSlips.has(s.slip_id) && sastDateString(new Date(s.slip_created_at)) === date)
      .map(({ trip_regs, ...rest }) => rest)

    return NextResponse.json({ data: reviews || [], matches, unmatched_slips })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
