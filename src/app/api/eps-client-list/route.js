import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EPS_BASE_URL = process.env.EPS_DASHBOARD_BASE_URL || 'http://167.71.48.108:8800'

async function syncToEpsDashboard(payload) {
  try {
    const body = {}
    if (payload.client_id) body.client_id = payload.client_id
    if (payload.contact_person != null) body.contact_person = payload.contact_person
    if (payload.contact_email != null) body.contact_email = payload.contact_email
    if (payload.email != null) body.email = payload.email
    if (payload.dormant_flag != null) body.dormant_flag = payload.dormant_flag
    if (payload.notification_period != null) body.notification_period = payload.notification_period

    if (Object.keys(body).length === 0) return

    const res = await fetch(`${EPS_BASE_URL}/api/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('EPS Dashboard sync failed:', res.status, await res.text())
    }
  } catch (err) {
    console.error('EPS Dashboard sync error:', err)
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    let allData = []
    let from = 0
    const batchSize = 1000
    
    while (true) {
      const { data, error } = await supabase
        .from('eps_client_list')
        .select('id, name, address, city, state, country, client_id, contact_person, contact_phone, contact_email, email, phone, status, industry, credit_limit, dormant_flag, postal_code, fax_number, registration_number, registration_name, ck_number, tax_number, vat_number, operating_hours, capacity, notes, coordinates, coords, blocked, notification_period, notification_groups, invoice_email_groups, created_at, updated_at')
        .order('name')
        .range(from, from + batchSize - 1)
      
      if (error) {
        console.error('Supabase error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      if (!data || data.length === 0) break
      
      const validRows = data.filter((row) => {
        const hasName = typeof row.name === 'string' && row.name.trim() !== ''
        const hasClientId = typeof row.client_id === 'string' && row.client_id.trim() !== ''
        return hasName || hasClientId
      })

      allData = [...allData, ...validRows]
      
      if (data.length < batchSize) break
      
      from += batchSize
    }
    
    return NextResponse.json({ data: allData })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient()
    const payload = await request.json()

    const cleanText = (value, fallback = null) => {
      if (typeof value !== 'string') return fallback
      const trimmed = value.trim()
      return trimmed === '' ? fallback : trimmed
    }

    const cleanNumber = (value, fallback = 0) => {
      if (value == null || value === '') return fallback
      const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
      return Number.isFinite(parsed) ? parsed : fallback
    }

    const insertPayload = {
      name: cleanText(payload.name),
      client_id: cleanText(payload.client_id),
      address: cleanText(payload.address),
      city: cleanText(payload.city),
      state: cleanText(payload.state),
      country: cleanText(payload.country),
      coords: payload.coords != null ? String(payload.coords) : null,
      coordinates: payload.coordinates != null ? String(payload.coordinates) : null,
      contact_person: cleanText(payload.contact_person),
      contact_phone: cleanText(payload.contact_phone),
      contact_email: cleanText(payload.contact_email),
      email: cleanText(payload.email, '') ?? '',
      phone: cleanText(payload.phone, '') ?? '',
      industry: cleanText(payload.industry, '') ?? '',
      ck_number: cleanText(payload.ck_number, '') ?? '',
      tax_number: cleanText(payload.tax_number, '') ?? '',
      vat_number: cleanText(payload.vat_number, '') ?? '',
      status: cleanText(payload.status, 'Active') ?? 'Active',
      postal_code: cleanText(payload.postal_code, '') ?? '',
      fax_number: cleanText(payload.fax_number, '') ?? '',
      registration_number: cleanText(payload.registration_number, '') ?? '',
      registration_name: cleanText(payload.registration_name, '') ?? '',
      type: cleanText(payload.type, 'warehouse') ?? 'warehouse',
      operating_hours: cleanText(payload.operating_hours),
      capacity: cleanText(payload.capacity),
      notes: cleanText(payload.notes),
      credit_limit: cleanNumber(payload.credit_limit, 0),
      vat_registered: Boolean(payload.vat_registered),
      dormant_flag: Boolean(payload.dormant_flag),
      blocked: Boolean(payload.blocked),
      notification_period: cleanNumber(payload.notification_period, 0),
      facilities: Array.isArray(payload.facilities) ? payload.facilities.filter(Boolean) : [],
      pickup_locations: Array.isArray(payload.pickup_locations) ? payload.pickup_locations : [],
      dropoff_locations: Array.isArray(payload.dropoff_locations) ? payload.dropoff_locations : [],
      notification_groups: Array.isArray(payload.notification_groups) ? payload.notification_groups : [],
      invoice_email_groups: Array.isArray(payload.invoice_email_groups) ? payload.invoice_email_groups : [],
      updated_at: new Date().toISOString(),
    }

    if (!insertPayload.name && !insertPayload.client_id) {
      return NextResponse.json(
        { error: 'Client name or client ID is required.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('eps_client_list')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    syncToEpsDashboard({
      client_id: insertPayload.client_id,
      contact_person: insertPayload.contact_person,
      contact_email: insertPayload.contact_email,
      email: insertPayload.email,
      dormant_flag: insertPayload.dormant_flag,
      notification_period: insertPayload.notification_period,
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const supabase = await createClient()
    const payload = await request.json()

    const cleanText = (value, fallback = null) => {
      if (typeof value !== 'string') return fallback
      const trimmed = value.trim()
      return trimmed === '' ? fallback : trimmed
    }

    const cleanNumber = (value, fallback = 0) => {
      if (value == null || value === '') return fallback
      const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
      return Number.isFinite(parsed) ? parsed : fallback
    }

    if (!payload.id) {
      return NextResponse.json({ error: 'Client ID is required for update.' }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('eps_client_list')
      .select('*')
      .eq('id', payload.id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const updatePayload = {
      name: payload.name !== undefined ? cleanText(payload.name) : existing.name,
      client_id: payload.client_id !== undefined ? cleanText(payload.client_id) : existing.client_id,
      address: payload.address !== undefined ? cleanText(payload.address) : existing.address,
      city: payload.city !== undefined ? cleanText(payload.city) : existing.city,
      state: payload.state !== undefined ? cleanText(payload.state) : existing.state,
      country: payload.country !== undefined ? cleanText(payload.country) : existing.country,
      coords: payload.coords !== undefined ? (payload.coords != null ? String(payload.coords) : null) : existing.coords,
      coordinates: payload.coordinates !== undefined ? (payload.coordinates != null ? String(payload.coordinates) : null) : existing.coordinates,
      contact_person: payload.contact_person !== undefined ? cleanText(payload.contact_person) : existing.contact_person,
      contact_phone: payload.contact_phone !== undefined ? cleanText(payload.contact_phone) : existing.contact_phone,
      contact_email: payload.contact_email !== undefined ? cleanText(payload.contact_email) : existing.contact_email,
      email: payload.email !== undefined ? (cleanText(payload.email, '') ?? '') : existing.email,
      phone: payload.phone !== undefined ? (cleanText(payload.phone, '') ?? '') : existing.phone,
      industry: payload.industry !== undefined ? (cleanText(payload.industry, '') ?? '') : existing.industry,
      ck_number: payload.ck_number !== undefined ? (cleanText(payload.ck_number, '') ?? '') : existing.ck_number,
      tax_number: payload.tax_number !== undefined ? (cleanText(payload.tax_number, '') ?? '') : existing.tax_number,
      vat_number: payload.vat_number !== undefined ? (cleanText(payload.vat_number, '') ?? '') : existing.vat_number,
      status: payload.status !== undefined ? (cleanText(payload.status, 'Active') ?? 'Active') : existing.status,
      postal_code: payload.postal_code !== undefined ? (cleanText(payload.postal_code, '') ?? '') : existing.postal_code,
      fax_number: payload.fax_number !== undefined ? (cleanText(payload.fax_number, '') ?? '') : existing.fax_number,
      registration_number: payload.registration_number !== undefined ? (cleanText(payload.registration_number, '') ?? '') : existing.registration_number,
      registration_name: payload.registration_name !== undefined ? (cleanText(payload.registration_name, '') ?? '') : existing.registration_name,
      type: payload.type !== undefined ? (cleanText(payload.type, 'warehouse') ?? 'warehouse') : existing.type,
      operating_hours: payload.operating_hours !== undefined ? cleanText(payload.operating_hours) : existing.operating_hours,
      capacity: payload.capacity !== undefined ? cleanText(payload.capacity) : existing.capacity,
      notes: payload.notes !== undefined ? cleanText(payload.notes) : existing.notes,
      credit_limit: payload.credit_limit !== undefined ? cleanNumber(payload.credit_limit, 0) : existing.credit_limit,
      vat_registered: payload.vat_registered !== undefined ? Boolean(payload.vat_registered) : existing.vat_registered,
      dormant_flag: payload.dormant_flag !== undefined ? Boolean(payload.dormant_flag) : existing.dormant_flag,
      blocked: payload.blocked !== undefined ? Boolean(payload.blocked) : existing.blocked,
      notification_period: payload.notification_period !== undefined ? cleanNumber(payload.notification_period, 0) : existing.notification_period,
      facilities: payload.facilities !== undefined ? (Array.isArray(payload.facilities) ? payload.facilities.filter(Boolean) : []) : existing.facilities,
      pickup_locations: payload.pickup_locations !== undefined ? (Array.isArray(payload.pickup_locations) ? payload.pickup_locations : []) : existing.pickup_locations,
      dropoff_locations: payload.dropoff_locations !== undefined ? (Array.isArray(payload.dropoff_locations) ? payload.dropoff_locations : []) : existing.dropoff_locations,
      notification_groups: payload.notification_groups !== undefined ? (Array.isArray(payload.notification_groups) ? payload.notification_groups : []) : existing.notification_groups,
      invoice_email_groups: payload.invoice_email_groups !== undefined ? (Array.isArray(payload.invoice_email_groups) ? payload.invoice_email_groups : []) : existing.invoice_email_groups,
      updated_at: new Date().toISOString(),
    }

    if (!updatePayload.name && !updatePayload.client_id) {
      return NextResponse.json(
        { error: 'Client name or client ID is required.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('eps_client_list')
      .update(updatePayload)
      .eq('id', payload.id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    syncToEpsDashboard({
      client_id: updatePayload.client_id,
      contact_person: updatePayload.contact_person,
      contact_email: updatePayload.contact_email,
      email: updatePayload.email,
      dormant_flag: updatePayload.dormant_flag,
      notification_period: updatePayload.notification_period,
    })

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
