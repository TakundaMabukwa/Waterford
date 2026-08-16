/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Download, Loader2, Upload, FileText, Image, FileSpreadsheet } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JSZip from 'jszip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AuditCurrencyCode } from '@/lib/audit-utils'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type InvoiceLineItem = {
  id: string
  description: string
  quantity: string
  unitPrice: string
  vatType: 'zero' | 'standard' | 'exempt' | 'zero_export'
}

const parseJson = (val: any): any => {
  if (!val) return null
  if (typeof val === 'string') { try { return JSON.parse(val) } catch { return null } }
  return val
}

const SALES_CODES = [
  { code: '200', label: 'Sales' },
  { code: '201', label: 'Sales - Subcontractors' },
  { code: '202', label: 'Sales - Other' },
  { code: '203', label: 'Sales - Repo, Handling & Document Fees' },
  { code: '206', label: 'Sales - Warehousing & Rental' },
  { code: '260', label: 'Other Revenue' },
]

const VAT_RATES: Record<string, number> = {
  zero: 0,
  standard: 0.15,
  exempt: 0,
  zero_export: 0,
}

const VAT_LABELS: Record<string, string> = {
  zero: 'Zero Rate\n(Excluding\nGoods Exported)',
  standard: '15% VAT',
  exempt: 'Exempt',
  zero_export: 'Zero Rate\n(Excluding\nGoods Exported)',
}

const formatCurrency = (value: number, currencyCode: AuditCurrencyCode = 'ZAR') =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const formatNum = (value: number) =>
  new Intl.NumberFormat('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

const formatDisplayDate = (isoDate: string) => {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
}

type InvoiceMode = 'draft' | 'edit' | 'finalize'

type Props = {
  open: boolean
  onClose: () => void
  record: any
  invoiceRate: number
  invoiceCurrency: AuditCurrencyCode
  splitRows: any[]
  calcSplitTotal: (row: any) => number
  onInvoiced?: (rate: number, currency: string) => void
  mode?: InvoiceMode
  draftId?: number
  draftData?: any
}

export default function GenerateInvoiceModal({
  open,
  onClose,
  record,
  invoiceRate,
  invoiceCurrency,
  splitRows,
  calcSplitTotal,
  onInvoiced,
  mode = 'draft',
  draftId,
  draftData,
}: Props) {
  const getClientName = () => {
    let name = ''
    if (record?.selectedclient || record?.selected_client) {
      name = record.selectedclient || record.selected_client
    } else {
      const source = record?.clientdetails || record.client_details
      if (!source) return ''
      try {
        const parsed = typeof source === 'string' ? JSON.parse(source) : source
        name = parsed?.name || ''
      } catch {
        return ''
      }
    }
    return name
  }

  const rawClientName = getClientName()
  const isDollarClient = rawClientName.startsWith('($)') || rawClientName.startsWith('$')
  const cleanClientName = isDollarClient ? rawClientName.replace(/^\(\$?\)\s*/, '').replace(/^\$\s*/, '').trim() : rawClientName

  const orderNum = record?.ordernumber || record?.trip_id || ''

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [customerName, setCustomerName] = useState(cleanClientName)
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerVat, setCustomerVat] = useState('')
  const [generating, setGenerating] = useState(false)

  const nameIsDollar = customerName.startsWith('$') || customerName.startsWith('($)')
  const detectedCurrency: AuditCurrencyCode = nameIsDollar ? 'USD' : invoiceCurrency
  const cleanName = nameIsDollar ? customerName.replace(/^\(\$?\)\s*/, '').replace(/^\$\s*/, '').trim() : customerName
  const [referenceNumber, setReferenceNumber] = useState(orderNum)
  const [uploading, setUploading] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([])
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch('/api/eps-client-list', { cache: 'no-store' })
        const result = await res.json()
        if (result.data) setClients(result.data)
      } catch {}
    }
    fetchClients()
  }, [])

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId)
    const client = clients.find((c) => String(c.id) === clientId)
    if (client) {
      setCustomerName(client.name || '')
      const addrParts = [client.address, client.city, client.country].filter(Boolean)
      setCustomerAddress(addrParts.join(', '))
      setCustomerVat(client.vat_number || client.tax_number || '')
    }
  }

  useEffect(() => {
    if (!open || !record?.id) return
    const fetchDocs = async () => {
      try {
        const res = await fetch(`/api/invoice-documents?audit_id=${record.id}`)
        const result = await res.json()
        if (result.data?.documents) {
          setUploadedDocs(result.data.documents)
        } else {
          setUploadedDocs([])
        }
      } catch {
        setUploadedDocs([])
      }
    }
    fetchDocs()

    // Load existing invoice_data if already invoiced
    if (record.invoice_data && record.is_invoiced) {
      const d = record.invoice_data
      if (d.invoiceDate) setInvoiceDate(d.invoiceDate)
      if (d.dueDate) setDueDate(d.dueDate)
      if (d.invoiceNumber) setInvoiceNumber(d.invoiceNumber)
      if (d.customerName) setCustomerName(d.customerName)
      if (d.customerAddress) setCustomerAddress(d.customerAddress)
      if (d.customerVat) setCustomerVat(d.customerVat)
      if (d.referenceNumber) setReferenceNumber(d.referenceNumber)
      if (d.salesCode) setSalesCode(d.salesCode)
      if (d.lineItems?.length) setLineItems(d.lineItems.map((item: any) => ({
        ...item,
        quantity: String(item.quantity ?? ''),
        unitPrice: String(item.unitPrice ?? ''),
      })))
    }
  }, [open, record?.id])

  // Load draft data when in edit or finalize mode
  useEffect(() => {
    if (!open || (mode !== 'edit' && mode !== 'finalize') || !draftData) return

    const d = draftData
    if (d.invoice_date) setInvoiceDate(d.invoice_date)
    if (d.due_date) setDueDate(d.due_date)
    if (d.invoice_number) setInvoiceNumber(d.invoice_number)
    if (d.customer_name) setCustomerName(d.customer_name)
    if (d.customer_address) setCustomerAddress(d.customer_address)
    if (d.customer_vat) setCustomerVat(d.customer_vat)
    if (d.reference_number) setReferenceNumber(d.reference_number)
    if (d.sales_code) setSalesCode(d.sales_code)
    if (d.line_items?.length) {
      setLineItems(d.line_items.map((item: any) => ({
        ...item,
        quantity: String(item.quantity ?? ''),
        unitPrice: String(item.unitPrice ?? ''),
      })))
    }
  }, [open, mode, draftData])

  // Fetch trip data when in finalize mode (record is invoice draft, not trip)
  const [tripData, setTripData] = useState<any>(null)
  useEffect(() => {
    if (!open || mode !== 'finalize' || !draftData?.trip_id) return
    const fetchTrip = async () => {
      try {
        const res = await fetch(`/api/trips/${draftData.trip_id}`)
        const result = await res.json()
        if (result.data) setTripData(result.data)
      } catch (err) {
        console.error('Failed to fetch trip data:', err)
      }
    }
    fetchTrip()
  }, [open, mode, draftData?.trip_id])

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(() => {
    const pickups = parseJson(record?.pickuplocations) || []
    const dropoffs = parseJson(record?.dropofflocations) || []
    const pickupName = pickups[0]?.address || pickups[0]?.location || 'Pickup'
    const dropoffName = dropoffs[0]?.address || dropoffs[0]?.location || 'Dropoff'
    const routeDesc = `${pickupName} to ${dropoffName}`

    if (splitRows.length) {
      return splitRows.map((row, i) => ({
        id: `line-${i}`,
        description: routeDesc,
        quantity: '1',
        unitPrice: i === 0 ? String(invoiceRate || '') : String(calcSplitTotal(row) || ''),
        vatType: 'zero' as const,
      }))
    }
    return [
      {
        id: 'line-1',
        description: routeDesc,
        quantity: '1',
        unitPrice: String(invoiceRate || ''),
        vatType: 'zero' as const,
      },
    ]
  })

  const [salesCode, setSalesCode] = useState('200')

  const updateLine = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const addLine = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        description: '',
        quantity: '1',
        unitPrice: '',
        vatType: 'zero' as const,
      },
    ])
  }

  const removeLine = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }

  const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
  const totalVat = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) * VAT_RATES[item.vatType], 0)
  const totalZar = subtotal + totalVat
  const amountDue = totalZar

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !record?.id) return

    setUploadError('')
    const maxSize = 50 * 1024 * 1024 // 50MB
    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        setUploadError(`"${file.name}" exceeds 50MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
        continue
      }
      setUploading(true)
      try {
        const folderId = record.trip_id || 'unknown'
        const filePath = `invoice-docs/${folderId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

        // Upload directly to Supabase storage via browser client
        const { error: uploadError } = await supabase.storage
          .from('invoice-documents')
          .upload(filePath, file, { contentType: file.type, upsert: false })

        if (uploadError) {
          setUploadError(`Upload failed: ${uploadError.message}`)
          continue
        }

        const { data: urlData } = supabase.storage.from('invoice-documents').getPublicUrl(filePath)
        const publicUrl = urlData?.publicUrl || ''

        // Save metadata only to API
        const res = await fetch('/api/invoice-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audit_id: record.id,
            trip_id: record.trip_id || '',
            ordernumber: record.ordernumber || '',
            invoice_number: invoiceNumber || '',
            uploaded_by: '',
            document: {
              fileName: file.name,
              filePath,
              fileUrl: publicUrl,
              fileType: file.type,
              fileSize: file.size,
            },
          }),
        })
        const result = await res.json()
        if (!res.ok) {
          setUploadError(result.error || 'Upload failed')
          continue
        }
        setUploadedDocs((prev) => [...prev, result.document])
      } catch (err) {
        setUploadError('Upload failed')
      } finally {
        setUploading(false)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!record?.id) return
    try {
      const res = await fetch(`/api/invoice-documents?audit_id=${record.id}&doc_id=${docId}`, { method: 'DELETE' })
      if (res.ok) {
        setUploadedDocs((prev) => prev.filter((d) => d.id !== docId))
      }
    } catch {}
  }

  const getFileIcon = (type: string) => {
    if (type?.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />
    if (type?.includes('spreadsheet') || type?.includes('excel')) return <FileSpreadsheet className="h-4 w-4 text-green-600" />
    return <FileText className="h-4 w-4 text-slate-500" />
  }

  const markAuditInvoiced = async (invoiceUrl?: string) => {
    const auditId = record?.id || 'null'
    try {
      await fetch(`/api/audit/${auditId}/mark-invoiced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceUrl: invoiceUrl || null,
          invoiceRate: invoiceRate,
          invoiceAmount: totalZar,
          invoiceCurrency: detectedCurrency,
          referenceNumber: referenceNumber || null,
          invoiceNumber: invoiceNumber || '',
          tripId: record.trip_id || '',
          ordernumber: record.ordernumber || '',
          invoiceData: {
            invoiceDate,
            dueDate,
            invoiceNumber: invoiceNumber || '',
            customerName: cleanName,
            customerAddress,
            customerVat,
            referenceNumber: referenceNumber || '',
            salesCode,
            lineItems: lineItems.map(item => ({
              ...item,
              quantity: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
            })),
            subtotal,
            totalVat,
            totalZar,
            amountDue,
          },
        }),
      })
    } catch (err) {
      console.error('Failed to mark audit invoiced:', err)
    }
  }

  const generatePdf = async () => {
    setGenerating(true)
    try {

    // In draft mode, save to invoices table without generating PDF
    if (mode === 'draft') {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: record?.trip_id || null,
          customerName: cleanName,
          customerAddress,
          customerVat,
          invoiceDate,
          dueDate,
          lineItems: lineItems.map(item => ({
            ...item,
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
          })),
          subtotal,
          vatAmount: totalVat,
          totalAmount: totalZar,
          amountDue,
          currency: detectedCurrency,
          referenceNumber: referenceNumber || null,
          salesCode,
          invoiceData: {
            invoiceDate,
            dueDate,
            invoiceNumber: '',
            customerName: cleanName,
            customerAddress,
            customerVat,
            referenceNumber: referenceNumber || '',
            salesCode,
            lineItems: lineItems.map(item => ({
              ...item,
              quantity: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
            })),
            subtotal,
            totalVat,
            totalZar,
            amountDue,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create draft')
      }

      toast.success('Invoice draft created')
      onInvoiced?.(invoiceRate, detectedCurrency)
      onClose()
      return
    }

    // In edit mode, update the existing draft
    if (mode === 'edit' && draftId) {
      const res = await fetch(`/api/invoices/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: cleanName,
          customerAddress,
          customerVat,
          invoiceDate,
          dueDate,
          lineItems: lineItems.map(item => ({
            ...item,
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
          })),
          subtotal,
          vatAmount: totalVat,
          totalAmount: totalZar,
          amountDue,
          currency: detectedCurrency,
          referenceNumber: referenceNumber || null,
          salesCode,
          invoiceData: {
            invoiceDate,
            dueDate,
            invoiceNumber: invoiceNumber || '',
            customerName: cleanName,
            customerAddress,
            customerVat,
            referenceNumber: referenceNumber || '',
            salesCode,
            lineItems: lineItems.map(item => ({
              ...item,
              quantity: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
            })),
            subtotal,
            totalVat,
            totalZar,
            amountDue,
          },
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update draft')
      }

      toast.success('Draft updated')
      onClose()
      return
    }

    // In finalize mode, generate invoice number and PDF
    let invNumber = invoiceNumber
    if (!invNumber) {
      const numRes = await fetch('/api/next-invoice-number', { method: 'POST' })
      const numData = await numRes.json()
      invNumber = numData.invoiceNumber
      if (!invNumber) throw new Error('Failed to get invoice number')
      setInvoiceNumber(invNumber)
    }

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
    const nameLines = doc.splitTextToSize(cleanName || 'Customer', 80)
    doc.text(nameLines, ml, custY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const addrLines = customerAddress ? doc.splitTextToSize(customerAddress, 80) : []
    if (addrLines.length) {
      doc.text(addrLines, ml, custY + nameLines.length * 4.5 + 2)
    }
    if (customerVat) {
      doc.text(`VAT Number: ${customerVat}`, ml, custY + nameLines.length * 4.5 + 2 + addrLines.length * 4.5 + 2)
    }

    // ── RIGHT: Invoice details ─────────────────────────────────────
    // Labels on left column, values on right column, stacked vertically
    const labelX = 105
    const valueX = 145
    const maxLabelW = 35
    const maxValueW = 45
    let ry = custY

    // Invoice Date
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Invoice Date', labelX, ry)
    doc.setFont('helvetica', 'normal')
    const invDateLines = doc.splitTextToSize(formatDisplayDate(invoiceDate), maxValueW)
    doc.text(invDateLines, valueX, ry)
    ry += Math.max(invDateLines.length * 4.5, 6)

    // Due Date
    doc.setFont('helvetica', 'bold')
    doc.text('Due Date', labelX, ry)
    doc.setFont('helvetica', 'normal')
    const dueDateLines = doc.splitTextToSize(formatDisplayDate(dueDate), maxValueW)
    doc.text(dueDateLines, valueX, ry)
    ry += Math.max(dueDateLines.length * 4.5, 6)

    // Invoice Number
    doc.setFont('helvetica', 'bold')
    doc.text('Invoice Number', labelX, ry)
    doc.setFont('helvetica', 'normal')
    const invNumLines = doc.splitTextToSize(invNumber || '', maxValueW)
    doc.text(invNumLines, valueX, ry)
    ry += Math.max(invNumLines.length * 4.5, 6)

    // Reference
    doc.setFont('helvetica', 'bold')
    doc.text('Reference', labelX, ry)
    doc.setFont('helvetica', 'normal')
    const refLines = doc.splitTextToSize(referenceNumber || 'N/A', maxValueW)
    doc.text(refLines, valueX, ry)
    ry += Math.max(refLines.length * 4.5, 6)

    // ── Company info (far right) ───────────────────────────────────
    const coX = 165
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

    // Move ry past the company info section
    ry = Math.max(ry, cy)

    doc.text('Co Reg: 2020/601042/07', coX, ry)
    ry += 7

    // VAT Number row
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('VAT Number', labelX, ry)
    doc.setFont('helvetica', 'normal')
    doc.text(customerVat || '', labelX + maxLabelW, ry)

    y = Math.max(custY + 5 + addrLines.length * 4.5 + (customerVat ? 8 : 0), ry) + 8

    // ── LINE ITEMS TABLE ───────────────────────────────────────────
    const salesCodeLabel = SALES_CODES.find(s => s.code === salesCode)?.label || 'Sales'
    const tableData = lineItems.map((item) => {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
      return [
        item.description,
        `${salesCode} - ${salesCodeLabel}`,
        String(item.quantity ? formatNum(Number(item.quantity)) : ''),
        formatNum(Number(item.unitPrice) || 0),
        VAT_LABELS[item.vatType] || '',
        formatNum(lineTotal),
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Sales Code', 'Quantity', 'Unit Price', 'VAT', 'Amount ZAR']],
      body: tableData,
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: { top: 5, bottom: 5, left: 2, right: 2 },
        lineWidth: 0,
        lineColor: [255, 255, 255],
        overflow: 'linebreak',
        borderColor: [255, 255, 255],
      },
      headStyles: {
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 4, bottom: 6, left: 2, right: 2 },
        lineWidth: 0,
        lineColor: [255, 255, 255],
        borderColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: 45, halign: 'left' },
        1: { cellWidth: 35, halign: 'left', overflow: 'linebreak' },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 30, halign: 'left', overflow: 'linebreak' },
        5: { cellWidth: 28, halign: 'right' },
      },
      didDrawCell: (data) => {
        const { doc: d } = data
        if (data.section === 'head' && data.column.index === 0) {
          const lineY = data.cell.y + data.cell.height + 1
          d.setDrawColor(0, 0, 0)
          d.setLineWidth(0.5)
          d.line(ml, lineY, pw - mr, lineY)
        }
        if (data.section === 'body' && data.column.index === 4) {
          const lineY = data.cell.y + data.cell.height + 3
          d.setDrawColor(220, 220, 220)
          d.setLineWidth(0.2)
          d.line(data.cell.x, lineY, data.cell.x + data.cell.width, lineY)
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
    doc.text(formatNum(totalVat), sV, y, { align: 'right' })
    y += 5

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.line(sL, y, sV, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('TOTAL ZAR', sL, y)
    doc.text(formatNum(totalZar), sV, y, { align: 'right' })
    y += 6

    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    doc.line(sL, y, sV, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('AMOUNT DUE ZAR', sL, y)
    doc.text(formatNum(amountDue), sV, y, { align: 'right' })

    // ── BANK DETAILS — pinned to bottom of page ─────────────────────
    const pageH = doc.internal.pageSize.getHeight()
    const footerStartY = pageH - 55

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('Bank accounts:', ml, footerStartY + 7)
    doc.text('South African Rand (ZAR)', ml, footerStartY + 12)
    doc.text('First National Bank (FNB), Branch 210554, Acc 62878278946', ml, footerStartY + 16)

    doc.text('Global account (USD)', ml, footerStartY + 23)
    doc.text('Capitec Bank, Swift CABLZAJJ, Branch 450105, Acc 5000040384', ml, footerStartY + 27)
    doc.text('Acc type CFC Call Account', ml, footerStartY + 31)
    doc.text('142 West Street, Sandton, Johannesburg, 2196', ml, footerStartY + 35)

    // ── FOOTER ─────────────────────────────────────────────────────
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128, 128, 128)
    doc.text(
      'Company Registration No: 2020/601042/07.  Registered Office: 96 CAVALEROS DRIVE, INDUSTRIES WEST, GERMISTON, GERMISTON, GAUTENG, 1401, SOUTH AFRICA',
      ml,
      footerStartY + 44
    )

    const fileName = `${invNumber || 'invoice'}.pdf`

    // Upload PDF directly to Supabase storage via browser client
    const pdfBlob = doc.output('blob')
    const filePath = `invoices/${fileName}`
    let invoiceUrl = null
    try {
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(filePath)
        invoiceUrl = urlData?.publicUrl || null
      } else {
        console.error('PDF upload error:', uploadError)
      }
    } catch (uploadErr) {
      console.error('Upload error:', uploadErr)
    }

    await markAuditInvoiced(invoiceUrl || undefined)

    // If in finalize mode, save invoice_url back to the invoices table
    if (mode === 'finalize' && draftId && invoiceUrl) {
      try {
        await fetch(`/api/invoices/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_url: invoiceUrl }),
        })
      } catch (err) {
        console.error('Failed to update invoice_url:', err)
      }
    }

    // Regenerate loadcon with finance details
    let loadconBlob: Blob | null = null
    try {
      const { generateLoadconPdf, uploadLoadconPdf, updateTripLoadconUrl } = await import('@/lib/generate-loadcon-pdf')
      const { data: { user } } = await supabase.auth.getUser()
      const userEmail = user?.email || user?.user_metadata?.first_name || ''
      
      // Use trip data if available (finalize mode), otherwise use record
      const source = tripData || record
      const clientDetails = parseJson(source.clientdetails || source.client_details)
      const pickupLocations = parseJson(source.pickuplocations || source.pickup_locations) || []
      const dropoffLocations = parseJson(source.dropofflocations || source.dropoff_locations) || []
      const vehicleAssignments = parseJson(source.vehicleassignments || source.vehicle_assignments) || []

      const firstAssignment = vehicleAssignments[0] || {}
      const driverName = firstAssignment.drivers?.[0] ? `${firstAssignment.drivers[0].first_name || ''} ${firstAssignment.drivers[0].surname || ''}`.trim() : ''
      const vehicleReg = firstAssignment.vehicle?.name || ''
      const collectedByStr = vehicleReg && driverName ? `${vehicleReg} - ${driverName}` : driverName || vehicleReg || ''

      const collectionAddress = pickupLocations[0]?.address || source.origin || ''
      const deliveryAddress = dropoffLocations[0]?.address || source.destination || ''

      const createdByName = source.created_by || ''
      const createdAtStr = source.created_at ? new Date(source.created_at).toLocaleString('en-ZA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

      const loadconData = {
        orderNumber: source.ordernumber || '',
        loadType: source.load_type || 'Cross Border',
        loadDate: source.startdate || new Date().toISOString().split('T')[0],
        customerName: clientDetails?.name || source.selectedclient || source.selected_client || '',
        customerReference: source.reference_number || '',
        collectionAddress: collectionAddress,
        delivery: deliveryAddress,
        collectedBy: collectedByStr,
        deliveredBy: collectedByStr,
        zone: '',
        emptyTN: '',
        notes: source.notes || source.statusnotes || '',
        completedBy: source.updated_by || '',
        createdBy: createdByName && createdAtStr ? `${createdByName} - ${createdAtStr}` : createdByName,
        createdTimestamp: createdAtStr,
        rate: detectedCurrency === 'ZAR' ? `ZAR ${formatNum(totalZar)}` : `USD ${formatNum(totalZar)}`,
        bookingRef: '',
        invoiceNo: invNumber || invoiceNumber,
        financeDate: formatDisplayDate(invoiceDate),
        capturedBy: userEmail,
      }
      
      loadconBlob = generateLoadconPdf(loadconData)
      const tripId = source.trip_id || record.trip_id
      const pdfUrl = await uploadLoadconPdf(tripId, loadconBlob)
      if (pdfUrl) {
        await updateTripLoadconUrl(tripId, pdfUrl)
      }
    } catch (loadconError) {
      console.error('Error regenerating loadcon:', loadconError)
    }

    // Bundle invoice PDF + loadcon PDF + all attached documents
    try {
      const zip = new JSZip()
      zip.file(fileName, pdfBlob)
      if (loadconBlob) {
        zip.file(`${record.ordernumber || 'trip'}-loadcon.pdf`, loadconBlob)
      }

      // Fetch existing documents for this audit
      if (record?.id) {
        const docRes = await fetch(`/api/invoice-documents?audit_id=${record.id}`)
        const docResult = await docRes.json()
        const docs = docResult.data?.documents || []

        for (const doc of docs) {
          if (doc.file_url) {
            try {
              const fileRes = await fetch(doc.file_url)
              if (fileRes.ok) {
                const fileBlob = await fileRes.blob()
                zip.file(doc.file_name || `document-${doc.id}`, fileBlob)
              }
            } catch {
              // Skip files that can't be fetched
            }
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipFileName = `${invNumber || 'invoice'}-documents.zip`
      const zipUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = zipUrl
      a.download = zipFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(zipUrl)
    } catch (zipErr) {
      console.error('ZIP bundling error:', zipErr)
    }

    toast.success('Invoice generated and stored')
  } catch (err) {
    console.error('Invoice generation error:', err)
    toast.error('Failed to generate invoice')
  } finally {
    setGenerating(false)
    onInvoiced?.(invoiceRate, detectedCurrency)
    onClose()
  }
}

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 mx-4 max-h-[95vh] w-full max-w-[95vw] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#001e42]">
              {mode === 'edit' ? 'Edit Draft Invoice' : 'Generate Invoice'}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'draft' ? 'Fill in the details and create an invoice draft' : 
               mode === 'edit' ? 'Update the draft invoice details' : 
               'Finalize the invoice and generate PDF'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Base Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                disabled={!!record?.is_invoiced}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!!record?.is_invoiced}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Number</label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Auto-generated on generate" disabled={!!record?.is_invoiced} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Client</label>
              <Select value={selectedClientId} onValueChange={handleClientSelect} disabled={!!record?.is_invoiced}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select client to auto-fill" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer Name</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={!!record?.is_invoiced} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer Address</label>
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="PO Box, City, Country"
                rows={2}
                disabled={!!record?.is_invoiced}
                className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] resize-y disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer VAT Number</label>
              <Input value={customerVat} onChange={(e) => setCustomerVat(e.target.value)} disabled={!!record?.is_invoiced} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Sales Code</label>
              <Select value={salesCode} onValueChange={setSalesCode} disabled={!!record?.is_invoiced}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_CODES.map((sc) => (
                    <SelectItem key={sc.code} value={sc.code}>
                      {sc.code} - {sc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reference Number */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Reference Number</label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. WC17060, PO Number, or custom reference"
              disabled={!!record?.is_invoiced}
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Line Items</h3>
              {!record?.is_invoiced && (
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-1 h-3 w-3" /> Add Line
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-20">Qty</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-32">Unit Price</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-32">VAT</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-32">Amount</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <textarea
                          value={item.description}
                          onChange={(e) => updateLine(item.id, 'description', e.target.value)}
                          placeholder="Description"
                          rows={2}
                          disabled={!!record?.is_invoiced}
                          className="flex w-full rounded-md border border-slate-300 bg-transparent px-2 py-1 text-sm shadow-sm placeholder:text-slate-400 focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] resize-y min-h-[40px] disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => updateLine(item.id, 'quantity', e.target.value)}
                          className="h-9 w-20 rounded-md border border-slate-300 bg-transparent px-2 py-1 text-right text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] disabled:bg-slate-50 disabled:text-slate-500"
                          disabled={!!record?.is_invoiced}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(e) => updateLine(item.id, 'unitPrice', e.target.value)}
                          className="h-9 w-32 rounded-md border border-slate-300 bg-transparent px-2 py-1 text-right text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] disabled:bg-slate-50 disabled:text-slate-500"
                          disabled={!!record?.is_invoiced}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={item.vatType}
                          onValueChange={(val: 'zero' | 'standard' | 'exempt' | 'zero_export') => updateLine(item.id, 'vatType', val)}
                          disabled={!!record?.is_invoiced}
                        >
                          <SelectTrigger className="h-9 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zero">Zero Rate</SelectItem>
                            <SelectItem value="zero_export">Zero Rate (Excl. Goods Exported) (0%)</SelectItem>
                            <SelectItem value="standard">15% VAT</SelectItem>
                            <SelectItem value="exempt">Exempt</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), detectedCurrency)}
                      </td>
                      <td className="px-4 py-2">
                        {!record?.is_invoiced && lineItems.length > 1 && (
                          <button onClick={() => removeLine(item.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, detectedCurrency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">TOTAL VAT</span>
                <span className="font-medium">{formatCurrency(totalVat, detectedCurrency)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">TOTAL {detectedCurrency}</span>
                  <span className="text-lg font-bold">{formatCurrency(totalZar, detectedCurrency)}</span>
                </div>
              </div>
              <div className="border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-[#001e42]">AMOUNT DUE {detectedCurrency}</span>
                  <span className="text-lg font-bold text-[#001e42]">{formatCurrency(amountDue, detectedCurrency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Supporting Documents {uploadedDocs.length > 0 && `(${uploadedDocs.length})`}
            </label>
            <div
              className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-[#001e42] hover:bg-slate-100 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              <p className="text-sm text-slate-600">
                {uploading ? 'Uploading...' : 'Click to upload or drag files here'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Images, PDF, Word, Excel, PowerPoint, TXT, CSV — Max 20MB each
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploadError && (
              <p className="mt-1 text-xs text-red-600">{uploadError}</p>
            )}

            {uploadedDocs.length > 0 && (
              <div className="mt-3 space-y-2">
                {uploadedDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(doc.file_type)}
                      <span className="truncate text-sm text-slate-700">{doc.file_name}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)}KB` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-600">
                            <Download className="h-3 w-3" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => handleDeleteDoc(doc.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button onClick={generatePdf} className="bg-[#001e42] text-white hover:bg-[#0b2955]" disabled={generating}>
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {mode === 'draft' ? 'Creating...' : mode === 'edit' ? 'Saving...' : 'Generating...'}</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> {mode === 'draft' ? 'Create Draft' : mode === 'edit' ? 'Save Changes' : 'Generate Invoice & Download'}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
