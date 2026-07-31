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
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
)

type InvoiceLineItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatType: 'zero' | 'standard' | 'exempt'
}

const VAT_RATES: Record<string, number> = {
  zero: 0,
  standard: 0.15,
  exempt: 0,
}

const VAT_LABELS: Record<string, string> = {
  zero: 'Zero Rate\n(Excluding\nGoods Exported)',
  standard: '15% VAT',
  exempt: 'Exempt',
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

type Props = {
  open: boolean
  onClose: () => void
  record: any
  invoiceRate: number
  invoiceCurrency: AuditCurrencyCode
  splitRows: any[]
  calcSplitTotal: (row: any) => number
}

export default function GenerateInvoiceModal({
  open,
  onClose,
  record,
  invoiceRate,
  invoiceCurrency,
  splitRows,
  calcSplitTotal,
}: Props) {
  const getClientName = () => {
    if (record?.selectedclient || record?.selected_client) return record.selectedclient || record.selected_client
    const source = record?.clientdetails || record?.client_details
    if (!source) return ''
    try {
      const parsed = typeof source === 'string' ? JSON.parse(source) : source
      return parsed?.name || ''
    } catch {
      return ''
    }
  }

  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
  const orderNum = record?.ordernumber || record?.trip_id || ''

  const [invoiceDate, setInvoiceDate] = useState(today)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [customerName, setCustomerName] = useState(getClientName())
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerVat, setCustomerVat] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [referenceNumber, setReferenceNumber] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([])
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  }, [open, record?.id])

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(() => {
    if (splitRows.length) {
      return splitRows.map((row, i) => ({
        id: `line-${i}`,
        description: `${row.driverName || 'Line Item'} - ${row.categoryLabel || row.categoryKey || ''}`.trim(),
        quantity: 1,
        unitPrice: calcSplitTotal(row),
        vatType: 'zero' as const,
      }))
    }
    return [
      {
        id: 'line-1',
        description: record?.cargo || 'Transport Services',
        quantity: 1,
        unitPrice: invoiceRate,
        vatType: 'zero' as const,
      },
    ]
  })

  const updateLine = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const addLine = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        vatType: 'zero' as const,
      },
    ])
  }

  const removeLine = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const totalVat = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice * VAT_RATES[item.vatType], 0)
  const totalZar = subtotal + totalVat
  const amountDue = totalZar

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !record?.id) return

    setUploadError('')
    for (const file of Array.from(files)) {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('audit_id', String(record.id))
        formData.append('trip_id', record.trip_id || record.trip_id || '')
        formData.append('ordernumber', record.ordernumber || '')
        formData.append('invoice_number', invoiceNumber || '')
        formData.append('uploaded_by', '')

        const res = await fetch('/api/invoice-documents', { method: 'POST', body: formData })
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
    if (!record?.id) return
    try {
      await fetch(`/api/audit/${record.id}/mark-invoiced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceUrl: invoiceUrl || null,
          invoiceRate: invoiceRate,
          invoiceAmount: totalZar,
          invoiceCurrency: invoiceCurrency,
          referenceNumber: referenceNumber || null,
          invoiceNumber: invoiceNumber || '',
          tripId: record.trip_id || '',
          ordernumber: record.ordernumber || '',
        }),
      })
    } catch (err) {
      console.error('Failed to mark audit invoiced:', err)
    }
  }

  const generatePdf = async () => {
    setGenerating(true)

    // Fetch invoice number now (only on actual generation)
    let invNumber = invoiceNumber
    if (!invNumber) {
      try {
        const numRes = await fetch('/api/next-invoice-number', { method: 'POST' })
        const numData = await numRes.json()
        invNumber = numData.invoiceNumber || `INV${orderNum || '00000'}`
      } catch {
        invNumber = `INV${orderNum || '00000'}`
      }
      setInvoiceNumber(invNumber)
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pw = doc.internal.pageSize.getWidth()
    const ml = 15
    const mr = 15
    let y = 15

    // ── WATERFORD LOGO (top right) ─────────────────────────────────
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 30, 66)
    doc.text('WATERFORD', pw - mr, y + 8, { align: 'right' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(232, 153, 63)
    doc.text('carriers', pw - mr, y + 14, { align: 'right' })

    y += 22

    // ── TAX INVOICE (left) ─────────────────────────────────────────
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('TAX INVOICE', ml, y)
    y += 12

    // ── LEFT: Customer details ─────────────────────────────────────
    const custY = y + 2
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    const nameLines = doc.splitTextToSize(customerName || 'Customer', 80)
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

    // ── RIGHT: Invoice details + Company info ──────────────────────
    const invLabelX = 100
    const invValueX = 132
    const coInfoX = 165
    const refMaxW = coInfoX - invValueX - 2
    let ry = custY - 5

    // Row 1: Invoice Date + Company line 1
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Invoice Date', invLabelX, ry)
    doc.setFont('helvetica', 'normal')
    doc.text(invoiceDate, invValueX, ry)
    doc.text('Waterford Carriers (Pty)', coInfoX, ry)
    ry += 5

    // Row 2: Invoice Number + Company line 2
    doc.setFont('helvetica', 'bold')
    doc.text('Invoice Number', invLabelX, ry)
    doc.setFont('helvetica', 'normal')
    doc.text(invNumber, invValueX, ry)
    doc.text('Ltd', coInfoX, ry)
    ry += 5

    // Row 3: Reference (may wrap) + Company line 3
    doc.setFont('helvetica', 'bold')
    doc.text('Reference', invLabelX, ry)
    doc.setFont('helvetica', 'normal')
    const refFullText = referenceNumber || 'N/A'
    const refWrapped = doc.splitTextToSize(refFullText, refMaxW)
    doc.text(refWrapped[0], invValueX, ry)
    doc.text('96 Cavaleros Drive', coInfoX, ry)
    ry += 5

    if (refWrapped.length > 1) {
      doc.text(refWrapped[1], invValueX, ry)
    }
    doc.text('Industries West', coInfoX, ry)
    ry += 5

    // Row 4: Order Number (bigger) + Company line 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Order Number', invLabelX, ry)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(14)
    doc.text(orderNum || 'N/A', invValueX, ry)
    doc.setFontSize(9)
    doc.text('Germiston, 1401', coInfoX, ry)
    ry += 5

    doc.setFontSize(9)
    doc.text('SOUTH AFRICA', coInfoX, ry)
    ry += 5

    doc.text('Tel: +27 (10) 300 8398', coInfoX, ry)
    ry += 5

    doc.text('Co Reg: 2020/601042/07', coInfoX, ry)
    ry += 7

    // VAT Number row
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('VAT Number', invLabelX, ry)
    doc.setFont('helvetica', 'normal')
    doc.text('4090291693', invValueX, ry)

    y = Math.max(custY + 5 + addrLines.length * 4.5 + (customerVat ? 8 : 0), ry) + 8

    // ── LINE ITEMS TABLE ───────────────────────────────────────────
    const tableData = lineItems.map((item) => {
      const lineTotal = item.quantity * item.unitPrice
      return [
        item.description,
        String(item.quantity ? formatNum(item.quantity) : ''),
        formatNum(item.unitPrice),
        VAT_LABELS[item.vatType] || '',
        formatNum(lineTotal),
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Quantity', 'Unit Price', 'VAT', 'Amount ZAR']],
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
        0: { cellWidth: 58, halign: 'left' },
        1: { cellWidth: 22, halign: 'right' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 38, halign: 'left', overflow: 'linebreak' },
        4: { cellWidth: 30, halign: 'right' },
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
    doc.text(`Due Date: ${dueDate || 'On Receipt'}`, ml, footerStartY)

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

    // Upload PDF to Supabase storage
    const pdfBlob = doc.output('blob')
    const filePath = `invoices/${fileName}`
    const { error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })

    let invoiceUrl = null
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(filePath)
      invoiceUrl = urlData?.publicUrl || null
    } else {
      console.error('Upload error:', uploadError)
    }

    await markAuditInvoiced(invoiceUrl || undefined)

    // Bundle invoice PDF + all attached documents
    try {
      const zip = new JSZip()
      zip.file(fileName, pdfBlob)

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
    } catch {
      // Fallback: just download the PDF
      doc.save(fileName)
    }

    toast.success('Invoice generated and stored')
    setGenerating(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 mx-4 max-h-[95vh] w-full max-w-[95vw] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#001e42]">Generate Invoice</h2>
            <p className="text-xs text-slate-500">Fill in the details and generate a tax invoice PDF</p>
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
              <Input value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Number</label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Auto-generated on generate" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer Name</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer Address</label>
              <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="PO Box, City, Country" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer VAT Number</label>
              <Input value={customerVat} onChange={(e) => setCustomerVat(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Due Date</label>
              <Input value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="On Receipt" />
            </div>
          </div>

          {/* Reference Number */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Reference Number</label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. WC17060, PO Number, or custom reference"
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Line Items</h3>
              <Button variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" /> Add Line
              </Button>
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
                        <Input
                          value={item.description}
                          onChange={(e) => updateLine(item.id, 'description', e.target.value)}
                          placeholder="Description"
                          className="h-9 border-0 bg-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLine(item.id, 'quantity', Number(e.target.value) || 0)}
                          className="h-9 w-20 text-right"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={item.unitPrice || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.-]/g, '')
                            updateLine(item.id, 'unitPrice', Number(val) || 0)
                          }}
                          className="h-9 w-32 text-right"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={item.vatType}
                          onValueChange={(val: 'zero' | 'standard' | 'exempt') => updateLine(item.id, 'vatType', val)}
                        >
                          <SelectTrigger className="h-9 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zero">Zero Rate</SelectItem>
                            <SelectItem value="standard">15% VAT</SelectItem>
                            <SelectItem value="exempt">Exempt</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatCurrency(item.quantity * item.unitPrice, invoiceCurrency)}
                      </td>
                      <td className="px-4 py-2">
                        {lineItems.length > 1 && (
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
                <span className="font-medium">{formatCurrency(subtotal, invoiceCurrency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">TOTAL VAT</span>
                <span className="font-medium">{formatCurrency(totalVat, invoiceCurrency)}</span>
              </div>
              <div className="border-t border-slate-300 pt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-bold">TOTAL ZAR</span>
                  <span className="text-lg font-bold">{formatCurrency(totalZar, invoiceCurrency)}</span>
                </div>
              </div>
              <div className="border-t border-[#001e42] pt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-[#001e42]">AMOUNT DUE ZAR</span>
                  <span className="text-lg font-bold text-[#001e42]">{formatCurrency(amountDue, invoiceCurrency)}</span>
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
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Generate Invoice & Download</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
