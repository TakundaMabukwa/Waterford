import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { createClient } from '@/lib/supabase/client'
import { AuditCurrencyCode } from '@/lib/audit-utils'

type InvoiceLineItemInput = {
  description: string
  quantity: number
  unitPrice: number
  vatType: string
  vehicle?: string
  driver?: string
}

export type InvoicePdfParams = {
  invoiceNumber: string
  customerName: string
  customerAddress: string
  customerVat: string
  invoiceDate: string
  dueDate: string
  referenceNumber: string
  salesCode: string
  currency: AuditCurrencyCode
  lineItems: InvoiceLineItemInput[]
  subtotal: number
  vatAmount: number
  totalAmount: number
  amountDue: number
}

const SALES_CODES = [
  { code: '200', label: 'Sales' },
  { code: '201', label: 'Sales - Subcontractors' },
  { code: '202', label: 'Sales - Other' },
  { code: '203', label: 'Sales - Repo, Handling & Document Fees' },
  { code: '206', label: 'Sales - Warehousing & Rental' },
  { code: '260', label: 'Other Revenue' },
]

const VAT_LABELS: Record<string, string> = {
  zero: 'Zero Rate\n(Excluding\nGoods Exported)',
  standard: '15% VAT',
  exempt: 'Exempt',
  zero_export: 'Zero Rate\n(Excluding\nGoods Exported)',
}

const formatNum = (value: number) =>
  new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

const formatDisplayDate = (isoDate: string) => {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function calculateDueDate(invoiceDate: string): string {
  if (!invoiceDate) return ''
  const [y, m] = invoiceDate.split('-').map(Number)
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y
  const lastDay = new Date(nextYear, nextMonth, 0).getDate()
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

const wrapAddressByComma = (address: string): string[] => {
  if (!address) return []
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  const lines: string[] = []
  for (const part of parts) {
    const wrapped = part.split(/\s+/)
    let current = ''
    for (const word of wrapped) {
      if (current && (current + ' ' + word).length > 35) {
        lines.push(current)
        current = word
      } else {
        current = current ? current + ' ' + word : word
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

export async function generateInvoicePdf(
  params: InvoicePdfParams
): Promise<{ blob: Blob; fileName: string }> {
  const {
    invoiceNumber,
    customerName,
    customerAddress,
    customerVat,
    invoiceDate,
    dueDate,
    referenceNumber,
    salesCode,
    lineItems,
    subtotal,
    vatAmount,
    totalAmount,
    amountDue,
  } = params

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pw = doc.internal.pageSize.getWidth()
  const ml = 15
  const mr = 15
  let y = 15

  // ── WATERFORD LOGO (top right) ─────────────────────────────────
  try {
    const img = await fetch('/waterford logo.png')
    const imgBlob = await img.blob()
    const imgDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(imgBlob)
    })
    doc.addImage(imgDataUrl, 'PNG', pw - mr - 45, y, 45, 18)
  } catch {
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 30, 66)
    doc.text('WATERFORD', pw - mr, y + 8, { align: 'right' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(232, 153, 63)
    doc.text('carriers', pw - mr, y + 14, { align: 'right' })
  }

  // ── TAX INVOICE (left) ─────────────────────────────────────────
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('TAX INVOICE', ml, y + 10)
  y += 25

  // ── LEFT: Customer details ─────────────────────────────────────
  const custY = y
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  const nameLines = doc.splitTextToSize(customerName || 'Customer', 80)
  doc.text(nameLines, ml, custY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const addrLines = wrapAddressByComma(customerAddress)
  if (addrLines.length) {
    doc.text(addrLines, ml, custY + nameLines.length * 4.5 + 2)
  }
  if (customerVat) {
    doc.text(`VAT Number: ${customerVat}`, ml, custY + nameLines.length * 4.5 + 2 + addrLines.length * 4.5 + 2)
  }

  // ── RIGHT: Invoice details (label on top, value underneath) ────
  const detailX = 105
  const detailValueX = 105
  const detailMaxW = 55
  const detailLabelGap = 4
  let ry = custY

  const drawDetail = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(label, detailX, ry)
    ry += detailLabelGap
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const valLines = doc.splitTextToSize(value || 'N/A', detailMaxW)
    doc.text(valLines, detailValueX, ry)
    ry += valLines.length * 4 + 3
  }

  drawDetail('Invoice Date', formatDisplayDate(invoiceDate))
  drawDetail('Invoice Number', invoiceNumber || '')
  drawDetail('Reference', referenceNumber || 'N/A')

  // ── Company info (right column, separate from details) ─────────
  const coX = 160
  let cy = custY
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Waterford Carriers (Pty)', coX, cy); cy += 4
  doc.text('Ltd', coX, cy); cy += 4
  doc.text('96 Cavaleros Drive', coX, cy); cy += 4
  doc.text('Industries West', coX, cy); cy += 4
  doc.text('Germiston, 1401', coX, cy); cy += 4
  doc.text('SOUTH AFRICA', coX, cy); cy += 4
  doc.text('Tel: +27 (10) 300 8398', coX, cy); cy += 4
  cy += 2
  doc.text('Co Reg: 2020/601042/07', coX, cy)

  y = Math.max(custY + 5 + addrLines.length * 4.5 + (customerVat ? 8 : 0), ry) + 8

  // ── LINE ITEMS TABLE ────────────────────────────────────────────
  const tableData = lineItems.map((item) => {
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0)
    return [
      item.description || '',
      String(item.quantity ? formatNum(item.quantity) : ''),
      formatNum(item.unitPrice || 0),
      VAT_LABELS[item.vatType] || '',
      formatNum(lineTotal),
    ]
  })

  const amountHeader = 'Amount'

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'VAT', amountHeader]],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 2, right: 2 },
      lineWidth: 0,
      lineColor: [255, 255, 255],
      overflow: 'linebreak',
      borderColor: [255, 255, 255],
    },
    headStyles: {
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 4, bottom: 6, left: 2, right: 2 },
      lineWidth: 0,
      lineColor: [255, 255, 255],
      borderColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 55, halign: 'left' },
      1: { cellWidth: 14, halign: 'right' },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 22, halign: 'right', overflow: 'linebreak' },
      4: { cellWidth: 22, halign: 'right' },
    },
    didDrawCell: (data) => {
      const { doc: d } = data
      if (data.section === 'head' && data.column.index === 0) {
        const lineY = data.cell.y + data.cell.height + 1
        d.setDrawColor(0, 0, 0)
        d.setLineWidth(0.5)
        d.line(ml, lineY, pw - mr, lineY)
      }
    },
  })

  y = (doc as any).lastAutoTable.finalY + 10

  // ── SUMMARY (right-aligned) ────────────────────────────────────
  const sL = pw - mr - 80
  const sV = pw - mr

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)

  doc.text('Subtotal', sL, y)
  doc.text(formatNum(subtotal), sV, y, { align: 'right' })
  y += 6

  doc.text('TOTAL VAT', sL, y)
  doc.text(formatNum(vatAmount), sV, y, { align: 'right' })
  y += 5

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(sL, y, sV, y)
  y += 5

  const amountDueLabel = 'AMOUNT DUE'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(amountDueLabel, sL, y)
  doc.text(formatNum(amountDue), sV, y, { align: 'right' })

  // ── BANK DETAILS — anchored to bottom of last page ──────────────
  const pageH = doc.internal.pageSize.getHeight()
  const bankBlockH = 82 // total height of bank details block
  const afterSummaryY = y + 10

  // Check if summary + bank block fits on current page
  if (afterSummaryY + bankBlockH > pageH - 12) {
    doc.addPage()
  }

  const bankY = pageH - bankBlockH - 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text(`Invoice Due Date: ${formatDisplayDate(dueDate)}`, ml, bankY)

  doc.setFontSize(9)
  doc.text('Bank accounts:', ml, bankY + 8)

  doc.setFont('helvetica', 'bold')
  doc.text('South African Rand (ZAR)', ml, bankY + 15)
  doc.setFont('helvetica', 'normal')
  doc.text('Bank: First National Bank (FNB)', ml, bankY + 20)
  doc.text('Branch: 210554', ml, bankY + 24)
  doc.text('Account number: 62878278946', ml, bankY + 28)

  doc.setFont('helvetica', 'bold')
  doc.text('Global account (USD)', ml, bankY + 35)
  doc.setFont('helvetica', 'normal')
  doc.text('Bank: Capitec Bank', ml, bankY + 40)
  doc.text('Swift: CABLZAJJ', ml, bankY + 44)
  doc.text('Branch: 450105', ml, bankY + 48)
  doc.text('Account number: 5000040384', ml, bankY + 52)
  doc.text('Acc type CFC Call Account', ml, bankY + 56)
  doc.text('142 West Street, Sandton, Johannesburg, 2196', ml, bankY + 60)

  // ── FOOTER ─────────────────────────────────────────────────────
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(128, 128, 128)
  doc.text(
    'Company Registration No: 2020/601042/07.  Registered Office: 96 CAVALEROS DRIVE, INDUSTRIES WEST, GERMISTON, GERMISTON, GAUTENG, 1401, SOUTH AFRICA',
    ml,
    bankY + 72
  )

  const fileName = `${invoiceNumber || 'invoice'}.pdf`
  const blob = doc.output('blob')

  return { blob, fileName }
}

export async function uploadInvoicePdf(
  invoiceNumber: string,
  blob: Blob
): Promise<string | null> {
  const supabase = createClient()
  const fileName = `${invoiceNumber || 'invoice'}.pdf`
  const filePath = `invoices/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(filePath, blob, { contentType: 'application/pdf', upsert: true })

  if (uploadError) {
    console.error('PDF upload error:', uploadError)
    return null
  }

  const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(filePath)
  return urlData?.publicUrl || null
}

export async function generateAndUploadInvoicePdf(
  params: InvoicePdfParams
): Promise<{ pdfUrl: string | null; fileName: string }> {
  const { blob, fileName } = await generateInvoicePdf(params)
  const pdfUrl = await uploadInvoicePdf(params.invoiceNumber, blob)
  return { pdfUrl, fileName }
}
