import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

const WATERFORD_ADDRESS = {
  line1: 'PO BOX 86033',
  line2: '',
  line3: '',
  line4: '',
  city: 'JHB',
  region: '',
  postalCode: '2049',
  country: '',
}

const VAT_TYPE_MAP: Record<string, string> = {
  zero: 'Zero Rate (Excluding Goods Exported)',
  standard: '15% VAT',
  exempt: 'Exempt',
  zero_export: 'Zero Rate (Excluding Goods Exported)',
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function parseAddress(address: string): { line1: string; line2: string; line3: string; line4: string; city: string; region: string; postalCode: string; country: string } {
  if (!address) return { line1: '', line2: '', line3: '', line4: '', city: '', region: '', postalCode: '', country: '' }
  const parts = address.split(',').map((p) => p.trim())
  const lines: string[] = []
  let city = ''
  let postalCode = ''
  let country = ''

  for (const part of parts) {
    if (/^\d{4,5}$/.test(part)) {
      postalCode = part
    } else if (!city && lines.length > 0) {
      city = part
    } else if (city && !country) {
      const remaining = parts.slice(parts.indexOf(part)).join(', ')
      if (remaining.length <= 3) {
        country = remaining
      }
    }
    if (lines.length < 4 && !/^\d{4,5}$/.test(part)) {
      lines.push(part)
    }
  }

  return {
    line1: lines[0] || '',
    line2: lines[1] || '',
    line3: lines[2] || '',
    line4: lines[3] || '',
    city,
    region: '',
    postalCode,
    country,
  }
}

function getTrackingFromTrip(trip: any): { vehicle: string; driver: string } {
  let vehicle = ''
  let driver = ''

  if (trip.vehicleassignments) {
    try {
      const assignments = typeof trip.vehicleassignments === 'string'
        ? JSON.parse(trip.vehicleassignments)
        : trip.vehicleassignments
      if (Array.isArray(assignments) && assignments.length > 0) {
        const first = assignments[0]
        if (first.vehicle?.name) vehicle = first.vehicle.name
        if (first.drivers?.length > 0) driver = first.drivers[0].name || ''
      }
    } catch {}
  }

  if (!vehicle && trip.vehicle) vehicle = trip.vehicle
  if (!driver && trip.driver) driver = trip.driver

  return { vehicle, driver }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceIds, month } = body

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase
      .from('invoices')
      .select('*')
      .order('invoice_date', { ascending: false })

    if (invoiceIds && invoiceIds.length > 0) {
      query = query.in('id', invoiceIds)
    } else if (month) {
      query = query.eq('lock_month', month)
    }

    const { data: invoices, error: invError } = await query
    if (invError) throw invError
    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ error: 'No invoices found' }, { status: 404 })
    }

    const tripIds = invoices.filter((inv) => inv.trip_id).map((inv) => inv.trip_id)
    let tripMap: Record<string, any> = {}
    if (tripIds.length > 0) {
      const { data: trips } = await supabase
        .from('trips')
        .select('trip_id, ordernumber, vehicleassignments, vehicle, driver, origin, destination')
        .in('trip_id', tripIds)
      ;(trips || []).forEach((t) => { tripMap[t.trip_id] = t })
    }

    const customerNames = [...new Set(invoices.filter((inv) => inv.customer_name).map((inv) => inv.customer_name))]
    let clientEmailMap: Record<string, string> = {}
    if (customerNames.length > 0) {
      const { data: clients } = await supabase
        .from('eps_client_list')
        .select('name, client_id, email, contact_email')
      const normalize = (s: string) => (s || '').replace(/^\(\$\)\s*/, '').replace(/^\$\s*/, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
      for (const name of customerNames) {
        const targetNorm = normalize(name)
        const matched = (clients || []).find((c: any) => normalize(c.name) === targetNorm || normalize(c.client_id) === targetNorm)
        if (matched) {
          clientEmailMap[name] = matched.email || matched.contact_email || ''
        }
      }
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Invoices')

    sheet.columns = [
      { header: 'ContactName', key: 'ContactName', width: 40 },
      { header: 'EmailAddress', key: 'EmailAddress', width: 30 },
      { header: 'POAddressLine1', key: 'POAddressLine1', width: 20 },
      { header: 'POAddressLine2', key: 'POAddressLine2', width: 15 },
      { header: 'POAddressLine3', key: 'POAddressLine3', width: 15 },
      { header: 'POAddressLine4', key: 'POAddressLine4', width: 15 },
      { header: 'POCity', key: 'POCity', width: 12 },
      { header: 'PORegion', key: 'PORegion', width: 12 },
      { header: 'POPostalCode', key: 'POPostalCode', width: 12 },
      { header: 'POCountry', key: 'POCountry', width: 12 },
      { header: 'SAAddressLine1', key: 'SAAddressLine1', width: 20 },
      { header: 'SAAddressLine2', key: 'SAAddressLine2', width: 15 },
      { header: 'SAAddressLine3', key: 'SAAddressLine3', width: 15 },
      { header: 'SAAddressLine4', key: 'SAAddressLine4', width: 15 },
      { header: 'SACity', key: 'SACity', width: 12 },
      { header: 'SARegion', key: 'SARegion', width: 12 },
      { header: 'SAPostalCode', key: 'SAPostalCode', width: 12 },
      { header: 'SACountry', key: 'SACountry', width: 12 },
      { header: 'InvoiceNumber', key: 'InvoiceNumber', width: 18 },
      { header: 'Reference', key: 'Reference', width: 40 },
      { header: 'InvoiceDate', key: 'InvoiceDate', width: 14 },
      { header: 'DueDate', key: 'DueDate', width: 14 },
      { header: 'PlannedDate', key: 'PlannedDate', width: 14 },
      { header: 'Total', key: 'Total', width: 14 },
      { header: 'TaxTotal', key: 'TaxTotal', width: 14 },
      { header: 'InvoiceAmountPaid', key: 'InvoiceAmountPaid', width: 18 },
      { header: 'InvoiceAmountDue', key: 'InvoiceAmountDue', width: 18 },
      { header: 'InventoryItemCode', key: 'InventoryItemCode', width: 18 },
      { header: 'Description', key: 'Description', width: 50 },
      { header: 'Quantity', key: 'Quantity', width: 12 },
      { header: 'UnitAmount', key: 'UnitAmount', width: 14 },
      { header: 'Discount', key: 'Discount', width: 12 },
      { header: 'LineAmount', key: 'LineAmount', width: 14 },
      { header: 'AccountCode', key: 'AccountCode', width: 14 },
      { header: 'TaxType', key: 'TaxType', width: 30 },
      { header: 'TaxAmount', key: 'TaxAmount', width: 14 },
      { header: 'TrackingName1', key: 'TrackingName1', width: 16 },
      { header: 'TrackingOption1', key: 'TrackingOption1', width: 20 },
      { header: 'TrackingName2', key: 'TrackingName2', width: 16 },
      { header: 'TrackingOption2', key: 'TrackingOption2', width: 25 },
      { header: 'Currency', key: 'Currency', width: 10 },
      { header: 'Type', key: 'Type', width: 16 },
      { header: 'Sent', key: 'Sent', width: 10 },
      { header: 'Status', key: 'Status', width: 20 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } }

    for (const inv of invoices) {
      const trip = inv.trip_id ? tripMap[inv.trip_id] : null
      const tracking = trip ? getTrackingFromTrip(trip) : { vehicle: '', driver: '' }
      const clientEmail = clientEmailMap[inv.customer_name] || ''
      const poAddress = parseAddress(inv.customer_address || '')
      const lineItems = Array.isArray(inv.line_items) ? inv.line_items : []
      const orderNum = trip?.ordernumber || ''
      const refParts = [orderNum, inv.reference_number].filter(Boolean)
      const reference = refParts.join(' - ') || orderNum || inv.trip_id || ''

      if (lineItems.length === 0) {
        sheet.addRow({
          ContactName: inv.customer_name || '',
          EmailAddress: clientEmail,
          POAddressLine1: poAddress.line1,
          POAddressLine2: poAddress.line2,
          POAddressLine3: poAddress.line3,
          POAddressLine4: poAddress.line4,
          POCity: poAddress.city,
          PORegion: poAddress.region,
          POPostalCode: poAddress.postalCode,
          POCountry: poAddress.country,
          SAAddressLine1: WATERFORD_ADDRESS.line1,
          SAAddressLine2: WATERFORD_ADDRESS.line2,
          SAAddressLine3: WATERFORD_ADDRESS.line3,
          SAAddressLine4: WATERFORD_ADDRESS.line4,
          SACity: WATERFORD_ADDRESS.city,
          SARegion: WATERFORD_ADDRESS.region,
          SAPostalCode: WATERFORD_ADDRESS.postalCode,
          SACountry: WATERFORD_ADDRESS.country,
          InvoiceNumber: inv.invoice_number || '',
          Reference: reference,
          InvoiceDate: formatDate(inv.invoice_date || ''),
          DueDate: formatDate(inv.due_date || ''),
          PlannedDate: '',
          Total: Number(inv.total_amount || 0).toFixed(4),
          TaxTotal: Number(inv.vat_amount || 0).toFixed(4),
          InvoiceAmountPaid: '0.0000',
          InvoiceAmountDue: Number(inv.amount_due || 0).toFixed(4),
          InventoryItemCode: '',
          Description: '',
          Quantity: '',
          UnitAmount: '',
          Discount: '',
          LineAmount: '',
          AccountCode: inv.sales_code || '200',
          TaxType: '',
          TaxAmount: '0.0000',
          TrackingName1: 'Vehicles',
          TrackingOption1: tracking.vehicle,
          TrackingName2: 'Driver',
          TrackingOption2: tracking.driver,
          Currency: inv.currency || 'ZAR',
          Type: 'Sales invoice',
          Sent: '',
          Status: 'Awaiting Payment',
        })
      } else {
        for (const item of lineItems) {
          const qty = Number(item.quantity) || 0
          const unitPrice = Number(item.unitPrice || item.unit_price) || 0
          const lineAmount = qty * unitPrice
          const vatRate = item.vatType === 'standard' ? 0.15 : 0
          const taxAmount = lineAmount * vatRate

          sheet.addRow({
            ContactName: inv.customer_name || '',
            EmailAddress: clientEmail,
            POAddressLine1: poAddress.line1,
            POAddressLine2: poAddress.line2,
            POAddressLine3: poAddress.line3,
            POAddressLine4: poAddress.line4,
            POCity: poAddress.city,
            PORegion: poAddress.region,
            POPostalCode: poAddress.postalCode,
            POCountry: poAddress.country,
            SAAddressLine1: WATERFORD_ADDRESS.line1,
            SAAddressLine2: WATERFORD_ADDRESS.line2,
            SAAddressLine3: WATERFORD_ADDRESS.line3,
            SAAddressLine4: WATERFORD_ADDRESS.line4,
            SACity: WATERFORD_ADDRESS.city,
            SARegion: WATERFORD_ADDRESS.region,
            SAPostalCode: WATERFORD_ADDRESS.postalCode,
            SACountry: WATERFORD_ADDRESS.country,
            InvoiceNumber: inv.invoice_number || '',
            Reference: reference,
            InvoiceDate: formatDate(inv.invoice_date || ''),
            DueDate: formatDate(inv.due_date || ''),
            PlannedDate: '',
            Total: Number(inv.total_amount || 0).toFixed(4),
            TaxTotal: Number(inv.vat_amount || 0).toFixed(4),
            InvoiceAmountPaid: '0.0000',
            InvoiceAmountDue: Number(inv.amount_due || 0).toFixed(4),
            InventoryItemCode: '',
            Description: item.description || '',
            Quantity: qty.toFixed(4),
            UnitAmount: unitPrice.toFixed(4),
            Discount: '',
            LineAmount: lineAmount.toFixed(4),
            AccountCode: inv.sales_code || '200',
            TaxType: VAT_TYPE_MAP[item.vatType] || 'Zero Rate (Excluding Goods Exported)',
            TaxAmount: taxAmount.toFixed(4),
            TrackingName1: 'Vehicles',
            TrackingOption1: tracking.vehicle,
            TrackingName2: 'Driver',
            TrackingOption2: tracking.driver,
            Currency: inv.currency || 'ZAR',
            Type: 'Sales invoice',
            Sent: '',
            Status: 'Awaiting Payment',
          })
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `invoices-export-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err: any) {
    console.error('Export error:', err)
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 })
  }
}
