import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { createClient } from '@/lib/supabase/client'

export interface LoadconPdfData {
  orderNumber?: string
  loadType?: string
  customerReference?: string
  bookingRef?: string
  loadDate?: string
  customerName?: string
  collectionAddress?: string
  delivery?: string
  vessel?: string
  weight?: string
  containerNumber?: string
  containerSize?: string
  collectedBy?: string
  deliveredBy?: string
  zone?: string
  emptyTN?: string
  notes?: string
  completedBy?: string
  invoiceNo?: string
  rate?: string
  financeDate?: string
  capturedBy?: string
  cartageFees?: string
  offloadingFees?: string
  standingTime?: string
  borderFees?: string
  reloading?: string
  other?: string
}

export function buildLoadconHTML(data: LoadconPdfData): string {
  const row = (label: string, value: string, highlight = false, tdStyle = '') =>
    `<tr>
      <td style="padding:6px 10px;background:#e5e7eb;font-weight:bold;border:1px solid #d1d5db;white-space:nowrap;width:150px;${tdStyle}">${label}</td>
      <td style="padding:6px 10px;background:${highlight ? '#fef9c3' : '#fff'};border:1px solid #d1d5db">${value || ''}</td>
    </tr>`

  const row2 = (l1: string, v1: string, l2: string, v2: string) =>
    `<tr>
      <td style="padding:6px 10px;background:#e5e7eb;font-weight:bold;border:1px solid #d1d5db;white-space:nowrap;width:120px">${l1}</td>
      <td style="padding:6px 10px;background:#fff;border:1px solid #d1d5db;width:30%">${v1 || ''}</td>
      <td style="padding:6px 10px;background:#e5e7eb;font-weight:bold;border:1px solid #d1d5db;white-space:nowrap;width:120px">${l2}</td>
      <td style="padding:6px 10px;background:#fff;border:1px solid #d1d5db">${v2 || ''}</td>
    </tr>`

  const barcode = (value: string) => {
    const bars = value.split('').map(c =>
      `<div style="width:${c.charCodeAt(0) % 2 === 0 ? 3 : 2}px;background:#000;height:40px"></div>`
    ).join('')
    return `<div style="text-align:right">
      <div style="display:flex;gap:1px;justify-content:flex-end">${bars}</div>
      <div style="text-align:right;font-size:10px;font-family:monospace;margin-top:2px">${value}</div>
    </div>`
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Loadcon ${data.orderNumber || ''}</title>
<style>
  @page { margin: 10mm; }
  @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body style="font-family:Arial,sans-serif;font-size:12px;color:#000;max-width:800px;margin:0 auto;padding:20px">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
    <div>
      <div style="font-size:28px;font-weight:bold;color:#333;letter-spacing:2px">WATERFORD</div>
      <div style="font-size:14px;color:#666;letter-spacing:1px;margin-top:-4px">carriers</div>
    </div>
    <div style="text-align:right">${barcode(data.orderNumber || 'WC000000')}</div>
  </div>

  <div style="text-align:center;margin-bottom:20px">
    <h2 style="font-size:18px;font-weight:bold;margin:0;letter-spacing:1px">CUSTOMER LOADCON</h2>
  </div>

  <div style="border:2px solid #dc2626;padding:2px;margin-bottom:20px">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <tbody>
        ${row('Load Type:', data.loadType)}
        ${row('Customer Reference:', data.customerReference)}
        ${row('Booking Ref:', data.bookingRef, true)}
        ${row('Load Date:', data.loadDate)}
        ${row('Customer Name:', data.customerName)}
        ${row('Collection Address:', data.collectionAddress)}
        ${row('Delivery:', data.delivery)}
        ${row('Vessel:', data.vessel)}
        ${row('Weight:', data.weight)}
        ${row('Container Number:', data.containerNumber)}
        ${row('Container Size:', data.containerSize)}
        ${row('Collected By:', data.collectedBy)}
        ${row('Delivered By:', data.deliveredBy || 'Waterford')}
        ${row('Zone:', data.zone)}
        ${row('Empty T/N:', data.emptyTN)}
        ${row('Notes:', data.notes, false, 'vertical-align:top')}
        ${row('Completed By:', data.completedBy)}
      </tbody>
    </table>
  </div>

  <div style="border:2px solid #16a34a;padding:2px;margin-bottom:20px">
    <h3 style="font-size:14px;font-weight:bold;margin:0 0 10px 5px">Finance Details</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <tbody>
        ${row2('Invoice No:', data.invoiceNo, 'Rate:', data.rate)}
        ${row2('Date:', data.financeDate, 'Captured By:', data.capturedBy)}
      </tbody>
    </table>
    <h3 style="font-size:14px;font-weight:bold;margin:15px 0 10px 5px">Crossborder</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <tbody>
        ${row2('Cartage Fees:', data.cartageFees, 'Offloading Fees:', data.offloadingFees)}
        ${row2('Standing Time:', data.standingTime, 'Border Fees:', data.borderFees)}
        ${row2('Re-Loading:', data.reloading, 'Other:', data.other)}
      </tbody>
    </table>
  </div>

</body></html>`
}

export function generateLoadconPdf(data: LoadconPdfData): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const labelW = 45
  const valueW = contentWidth - labelW

  const drawLabel = (label: string) => {
    doc.setFillColor(229, 231, 235)
    doc.rect(margin, y, labelW, 8, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin, y, labelW, 8, 'S')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(label, margin + 3, y + 5.5)
  }

  const drawValue = (value: string, highlight = false) => {
    if (highlight) {
      doc.setFillColor(254, 249, 195)
    } else {
      doc.setFillColor(255, 255, 255)
    }
    doc.rect(margin + labelW, y, valueW, 8, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin + labelW, y, valueW, 8, 'S')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(value || '', margin + labelW + 3, y + 5.5)
  }

  const drawRow = (label: string, value: string, highlight = false) => {
    drawLabel(label)
    drawValue(value, highlight)
    y += 8
  }

  const drawNotesRow = (label: string, value: string) => {
    drawLabel(label)
    doc.setFillColor(255, 255, 255)
    doc.rect(margin + labelW, y, valueW, 20, 'F')
    doc.setDrawColor(209, 213, 219)
    doc.rect(margin + labelW, y, valueW, 20, 'S')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(value || '', valueW - 6)
    doc.text(lines, margin + labelW + 3, y + 5.5)
    y += 20
  }

  // Header - WATERFORD
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('WATERFORD', margin, y + 8)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('carriers', margin + 2, y + 13)

  // Barcode placeholder (order number)
  doc.setFontSize(10)
  doc.setFont('courier', 'bold')
  doc.text(data.orderNumber || 'WC000000', pageWidth - margin, y + 8, { align: 'right' })

  // Barcode lines
  const barcodeX = pageWidth - margin - 60
  for (let i = 0; i < (data.orderNumber || 'WC000000').length; i++) {
    const char = (data.orderNumber || 'WC000000')[i]
    const w = char.charCodeAt(0) % 2 === 0 ? 3 : 2
    doc.setFillColor(0, 0, 0)
    doc.rect(barcodeX + i * 5, y, w, 6, 'F')
  }

  y += 18

  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('CUSTOMER LOADCON', pageWidth / 2, y + 4, { align: 'center' })
  y += 10

  // Red border - Main table
  const tableStartY = y
  doc.setDrawColor(220, 38, 38)
  doc.setLineWidth(0.5)

  drawRow('Load Type:', data.loadType)
  drawRow('Customer Reference:', data.customerReference)
  drawRow('Booking Ref:', data.bookingRef, true)
  drawRow('Load Date:', data.loadDate)
  drawRow('Customer Name:', data.customerName)
  drawRow('Collection Address:', data.collectionAddress)
  drawRow('Delivery:', data.delivery)
  drawRow('Vessel:', data.vessel)
  drawRow('Weight:', data.weight)
  drawRow('Container Number:', data.containerNumber)
  drawRow('Container Size:', data.containerSize)
  drawRow('Collected By:', data.collectedBy)
  drawRow('Delivered By:', data.deliveredBy || 'Waterford')
  drawRow('Zone:', data.zone)
  drawRow('Empty T/N:', data.emptyTN)
  drawNotesRow('Notes:', data.notes)
  drawRow('Completed By:', data.completedBy)

  doc.setDrawColor(220, 38, 38)
  doc.rect(margin - 1, tableStartY - 1, contentWidth + 2, y - tableStartY + 2, 'S')
  y += 5

  // Finance Details - Green border
  const financeStartY = y
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Finance Details', margin + 2, y + 5)
  y += 8

  const halfW = contentWidth / 2
  const smallLabelW = 30
  const smallValueW = halfW - smallLabelW

  const drawFinanceRow = (l1: string, v1: string, l2: string, v2: string) => {
    // Left side
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

    // Right side
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

  drawFinanceRow('Invoice No:', data.invoiceNo, 'Rate:', data.rate)
  drawFinanceRow('Date:', data.financeDate, 'Captured By:', data.capturedBy)

  y += 3
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Crossborder', margin + 2, y + 5)
  y += 8

  drawFinanceRow('Cartage Fees:', data.cartageFees, 'Offloading Fees:', data.offloadingFees)
  drawFinanceRow('Standing Time:', data.standingTime, 'Border Fees:', data.borderFees)
  drawFinanceRow('Re-Loading:', data.reloading, 'Other:', data.other)

  doc.setDrawColor(22, 163, 74)
  doc.setLineWidth(0.5)
  doc.rect(margin - 1, financeStartY - 1, contentWidth + 2, y - financeStartY + 2, 'S')

  return doc.output('blob')
}

export function buildLoadconPopupHTML(data: LoadconPdfData): string {
  return buildLoadconHTML(data)
}

export async function uploadLoadconPdf(tripId: string, pdfBlob: Blob): Promise<string | null> {
  const supabase = createClient()
  const filePath = `${tripId}/loadcon.pdf`

  const { error: uploadError } = await supabase.storage
    .from('trip-loadcons')
    .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    console.error('[loadcon] Upload error:', uploadError)
    return null
  }

  const { data: urlData } = supabase.storage.from('trip-loadcons').getPublicUrl(filePath)
  return urlData?.publicUrl || null
}

export async function updateTripLoadconUrl(tripId: string, loadconUrl: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('trips')
    .update({ loadcon_url: loadconUrl })
    .eq('id', tripId)

  if (error) {
    console.error('[loadcon] Trip update error:', error)
    return false
  }
  return true
}

export function triggerPdfDownload(pdfBlob: Blob, filename: string) {
  const url = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function generateAndStoreLoadcon(
  tripId: string,
  data: LoadconPdfData
): Promise<{ blob: Blob; url: string | null }> {
  const blob = generateLoadconPdf(data)
  const url = await uploadLoadconPdf(tripId, blob)
  if (url) {
    await updateTripLoadconUrl(tripId, url)
  }
  return { blob, url }
}
