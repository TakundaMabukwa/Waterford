import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    let allData = []
    let from = 0
    const batchSize = 1000
    
    while (true) {
      const { data, error } = await supabase
        .from('eps_client_list')
        .select('id, name, address, city, state, country, client_id, contact_person, contact_phone, contact_email, email, phone, status, industry, credit_limit, dormant_flag, postal_code, fax_number, registration_number, registration_name, ck_number, tax_number, vat_number, operating_hours, capacity, notes, created_at, updated_at')
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
      facilities: Array.isArray(payload.facilities) ? payload.facilities.filter(Boolean) : [],
      pickup_locations: Array.isArray(payload.pickup_locations) ? payload.pickup_locations : [],
      dropoff_locations: Array.isArray(payload.dropoff_locations) ? payload.dropoff_locations : [],
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

    const updatePayload = {
      name: cleanText(payload.name),
      client_id: cleanText(payload.client_id),
      address: cleanText(payload.address),
      city: cleanText(payload.city),
      state: cleanText(payload.state),
      country: cleanText(payload.country),
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
      facilities: Array.isArray(payload.facilities) ? payload.facilities.filter(Boolean) : [],
      pickup_locations: Array.isArray(payload.pickup_locations) ? payload.pickup_locations : [],
      dropoff_locations: Array.isArray(payload.dropoff_locations) ? payload.dropoff_locations : [],
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

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
