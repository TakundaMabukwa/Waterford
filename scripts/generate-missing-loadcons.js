#!/usr/bin/env node

/**
 * Generate loadcon PDFs for trips that don't have one.
 * Usage: node scripts/generate-missing-loadcons.js
 */

const { createClient } = require('@supabase/supabase-js')
const { jsPDF } = require('jspdf')
require('jspdf-autotable')
const fs = require('fs')
const path = require('path')

// Load .env.local manually
const envPath = path.resolve(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) return
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  envVars[key] = val
})

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function parseJson(val) {
  if (!val) return null
  if (typeof val === 'string') { try { return JSON.parse(val) } catch { return null } }
  return val
}

function buildLoadconData(trip) {
  const clientDetails = parseJson(trip.clientdetails || trip.client_details)
  const pickupLocations = parseJson(trip.pickuplocations || trip.pickup_locations) || []
  const dropoffLocations = parseJson(trip.dropofflocations || trip.dropoff_locations) || []
  const vehicleAssignments = parseJson(trip.vehicleassignments || trip.vehicle_assignments) || []

  const firstAssignment = vehicleAssignments[0] || {}
  const driverName = firstAssignment.drivers?.[0]
    ? `${firstAssignment.drivers[0].first_name || ''} ${firstAssignment.drivers[0].surname || ''}`.trim()
    : ''
  const vehicleReg = firstAssignment.vehicle?.name || ''
  const collectedByStr = vehicleReg && driverName ? `${vehicleReg} - ${driverName}` : driverName || vehicleReg || ''

  const collectionAddress = pickupLocations[0]?.address || trip.origin || ''
  const deliveryAddress = dropoffLocations[0]?.address || trip.destination || ''

  const createdByName = trip.created_by || ''
  const createdAtStr = trip.created_at
    ? new Date(trip.created_at).toLocaleString('en-ZA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : ''

  return {
    orderNumber: trip.ordernumber || '',
    loadType: trip.load_type || 'Cross Border',
    loadDate: trip.startdate || new Date().toISOString().split('T')[0],
    customerName: clientDetails?.name || trip.selectedclient || trip.selected_client || '',
    customerReference: trip.reference_number || '',
    collectionAddress,
    delivery: deliveryAddress,
    collectedBy: collectedByStr,
    deliveredBy: collectedByStr,
    zone: '',
    emptyTN: '',
    notes: trip.notes || trip.statusnotes || '',
    completedBy: trip.updated_by || '',
    createdBy: createdByName && createdAtStr ? `${createdByName} - ${createdAtStr}` : createdByName,
    createdTimestamp: createdAtStr,
    rate: trip.rate || '',
    bookingRef: '',
  }
}

function generateLoadconPdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const labelW = 45
  const valueW = contentWidth - labelW

  const drawRow = (label, value) => {
    doc.setFillColor(229, 231, 235)
    doc.rect(margin, y, labelW, 8, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin, y, labelW, 8, 'S')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(label, margin + 3, y + 5.5)

    doc.setFillColor(255, 255, 255)
    doc.rect(margin + labelW, y, valueW, 8, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin + labelW, y, valueW, 8, 'S')
    doc.setFont('helvetica', 'normal')
    doc.text(value || '', margin + labelW + 3, y + 5.5)
    y += 8
  }

  const drawNotesRow = (label, value) => {
    doc.setFillColor(229, 231, 235)
    doc.rect(margin, y, labelW, 8, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin, y, labelW, 8, 'S')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(label, margin + 3, y + 5.5)

    doc.setFillColor(255, 255, 255)
    doc.rect(margin + labelW, y, valueW, 20, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin + labelW, y, valueW, 20, 'S')
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(value || '', valueW - 6)
    doc.text(lines, margin + labelW + 3, y + 5.5)
    y += 20
  }

  // Header
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('WATERFORD', margin, y + 8)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('carriers', margin + 2, y + 13)

  // Barcode placeholder
  const orderNum = data.orderNumber || 'WC000000'
  doc.setFontSize(22)
  doc.setFont('courier', 'bold')
  doc.text(orderNum, pageWidth - margin, y + 10, { align: 'right' })

  const barcodeX = pageWidth - margin - 60
  for (let i = 0; i < orderNum.length; i++) {
    const char = orderNum[i]
    const w = char.charCodeAt(0) % 2 === 0 ? 3 : 2
    doc.setFillColor(0, 0, 0)
    doc.rect(barcodeX + i * 5, y, w, 8, 'F')
  }

  y += 18

  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CUSTOMER LOADCON', pageWidth / 2, y + 4, { align: 'center' })
  y += 10

  // Red border table
  const tableStartY = y
  doc.setDrawColor(220, 38, 38)
  doc.setLineWidth(0.5)

  drawRow('Customer Name:', data.customerName)
  drawRow('Booking Ref:', data.bookingRef, true)
  drawRow('Customer Reference:', data.customerReference)
  drawRow('Collection Address:', data.collectionAddress)
  drawRow('Delivery:', data.delivery)
  drawRow('Load Type:', data.loadType)
  drawRow('Load Date:', data.loadDate)
  drawRow('Vessel:', data.vessel || '')
  drawRow('Weight:', data.weight || '')
  drawRow('Container Number:', data.containerNumber || '')
  drawRow('Container Size:', data.containerSize || '')
  drawRow('Collected By:', data.collectedBy)
  drawRow('Delivered By:', data.deliveredBy || 'Waterford')
  drawRow('Zone:', data.zone || '')
  drawRow('Empty T/N:', data.emptyTN || '')
  drawNotesRow('Notes:', data.notes)
  drawRow('Completed By:', data.completedBy)
  drawRow('Created By:', data.createdBy)

  doc.setDrawColor(220, 38, 38)
  doc.rect(margin - 1, tableStartY - 1, contentWidth + 2, y - tableStartY + 2, 'S')
  y += 5

  // Finance Details
  const financeStartY = y
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Finance Details', margin + 2, y + 5)
  y += 8

  const halfW = contentWidth / 2
  const smallLabelW = 30
  const smallValueW = halfW - smallLabelW

  const drawFinanceRow = (l1, v1, l2, v2) => {
    doc.setFillColor(229, 231, 235)
    doc.rect(margin, y, smallLabelW, 8, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin, y, smallLabelW, 8, 'S')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(l1, margin + 2, y + 5.5)

    doc.setFillColor(255, 255, 255)
    doc.rect(margin + smallLabelW, y, smallValueW, 8, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin + smallLabelW, y, smallValueW, 8, 'S')
    doc.setFont('helvetica', 'normal')
    doc.text(v1 || '', margin + smallLabelW + 2, y + 5.5)

    doc.setFillColor(229, 231, 235)
    doc.rect(margin + halfW, y, smallLabelW, 8, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin + halfW, y, smallLabelW, 8, 'S')
    doc.setFont('helvetica', 'bold')
    doc.text(l2, margin + halfW + 2, y + 5.5)

    doc.setFillColor(255, 255, 255)
    doc.rect(margin + halfW + smallLabelW, y, smallValueW, 8, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin + halfW + smallLabelW, y, smallValueW, 8, 'S')
    doc.setFont('helvetica', 'normal')
    doc.text(v2 || '', margin + halfW + smallLabelW + 2, y + 5.5)

    y += 8
  }

  drawFinanceRow('Invoice No:', data.invoiceNo || '', 'Rate:', data.rate || '0')
  drawFinanceRow('Date:', data.financeDate || '', 'Invoiced By:', data.capturedBy || '')

  y += 3
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Crossborder', margin + 2, y + 5)
  y += 8

  drawFinanceRow('Cartage Fees:', data.cartageFees || '', 'Offloading Fees:', data.offloadingFees || '')
  drawFinanceRow('Standing Time:', data.standingTime || '', 'Border Fees:', data.borderFees || '')
  drawFinanceRow('Re-Loading:', data.reloading || '', 'Other:', data.other || '')

  doc.setDrawColor(22, 163, 74)
  doc.setLineWidth(0.5)
  doc.rect(margin - 1, financeStartY - 1, contentWidth + 2, y - financeStartY + 2, 'S')

  return Buffer.from(doc.output('arraybuffer'))
}

async function main() {
  console.log('Fetching trips without loadcon...')

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*')
    .or('loadcon_url.is.null,loadcon_url.eq.')

  if (error) {
    console.error('Error fetching trips:', error.message)
    process.exit(1)
  }

  if (!trips || trips.length === 0) {
    console.log('All trips have loadcons. Nothing to do.')
    return
  }

  console.log(`Found ${trips.length} trips without loadcon. Generating...`)

  let success = 0
  let failed = 0

  for (const trip of trips) {
    try {
      const loadconData = buildLoadconData(trip)
      const pdfBuffer = generateLoadconPdf(loadconData)

      const tripId = trip.trip_id || String(trip.id)
      const filePath = `${tripId}/loadcon.pdf`

      const { error: uploadError } = await supabase.storage
        .from('trip-loadcons')
        .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

      if (uploadError) {
        console.error(`Upload failed for ${trip.ordernumber}:`, uploadError.message)
        failed++
        continue
      }

      const { data: urlData } = supabase.storage.from('trip-loadcons').getPublicUrl(filePath)
      const loadconUrl = urlData?.publicUrl || ''

      const { error: updateError } = await supabase
        .from('trips')
        .update({ loadcon_url: loadconUrl })
        .eq('id', trip.id)

      if (updateError) {
        console.error(`Update failed for ${trip.ordernumber}:`, updateError.message)
        failed++
        continue
      }

      console.log(`✓ ${trip.ordernumber || tripId} — ${loadconUrl}`)
      success++
    } catch (err) {
      console.error(`Error for ${trip.ordernumber}:`, err.message)
      failed++
    }
  }

  console.log(`\nDone. ${success} generated, ${failed} failed.`)
}

main()
