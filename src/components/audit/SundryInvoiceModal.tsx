/* eslint-disable @typescript-eslint/no-explicitany */
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Download, Loader2, Upload } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
}

const VAT_LABELS: Record<string, string> = {
  zero: 'Zero Rate',
  standard: '15% VAT',
  exempt: 'Exempt',
}

const formatCurrency = (value: number, currencyCode: string = 'ZAR') =>
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

type Props = {
  open: boolean
  onClose: () => void
}

export default function SundryInvoiceModal({ open, onClose }: Props) {
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerVat, setCustomerVat] = useState('')
  const [currency, setCurrency] = useState('ZAR')
  const [generating, setGenerating] = useState(false)

  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    {
      id: 'line-1',
      description: '',
      quantity: 1,
      unitPrice: 0,
      vatType: 'zero' as const,
    },
  ])

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

  const generatePdf = async () => {
    setGenerating(true)
    try {
      // Get invoice number from shared counter first
      const numRes = await fetch('/api/next-invoice-number', { method: 'POST' })
      const numData = await numRes.json()
      const invNumber = numData.invoiceNumber || 'INV10000'
      setInvoiceNumber(invNumber)

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const pw = doc.internal.pageSize.getWidth()
      const ml = 15
      const mr = 15
      let y = 15

      // WATERFORD LOGO (top right)
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 30, 66)
      doc.text('WATERFORD', pw - mr, y + 8, { align: 'right' })
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(232, 153, 63)
      doc.text('carriers', pw - mr, y + 14, { align: 'right' })

      y += 22

      // TAX INVOICE (left)
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('TAX INVOICE', ml, y)
      y += 12

      // LEFT: Customer details
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

      // RIGHT: Invoice details + Company info
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
      doc.text(formatDisplayDate(invoiceDate), invValueX, ry)
      doc.text('Waterford Carriers (Pty)', coInfoX, ry)
      ry += 5

      // Row 2: Invoice Number + Company line 2
      doc.setFont('helvetica', 'bold')
      doc.text('Invoice Number', invLabelX, ry)
      doc.setFont('helvetica', 'normal')
      doc.text(invNumber, invValueX, ry)
      doc.text('Ltd', coInfoX, ry)
      ry += 5

      // Row 3: Reference + Company line 3
      doc.setFont('helvetica', 'bold')
      doc.text('Reference', invLabelX, ry)
      doc.setFont('helvetica', 'normal')
      const refText = referenceNumber || 'SUNDRY INVOICE'
      doc.text(refText, invValueX, ry)
      doc.text('96 Cavaleros Drive', coInfoX, ry)
      ry += 5

      doc.text('Industries West', coInfoX, ry)
      ry += 5

      doc.text('Germiston, 1401', coInfoX, ry)
      ry += 5

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

      // LINE ITEMS TABLE
      const salesCodeLabel = SALES_CODES.find(s => s.code === salesCode)?.label || 'Sales'
      const tableData = lineItems.map((item) => {
        const lineTotal = item.quantity * item.unitPrice
        return [
          item.description,
          `${salesCode} - ${salesCodeLabel}`,
          String(item.quantity ? formatNum(item.quantity) : ''),
          formatNum(item.unitPrice),
          VAT_LABELS[item.vatType] || '',
          formatNum(lineTotal),
        ]
      })

      autoTable(doc, {
        startY: y,
        head: [['Description', 'Sales Code', 'Quantity', 'Unit Price', 'VAT', `Amount ${currency}`]],
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

      // SUMMARY
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
      doc.text(`TOTAL ${currency}`, sL, y)
      doc.text(formatNum(totalZar), sV, y, { align: 'right' })
      y += 5

      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.3)
      doc.line(sL, y, sV, y)
      y += 5

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(`AMOUNT DUE ${currency}`, sL, y)
      doc.text(formatNum(amountDue), sV, y, { align: 'right' })

      // BANK DETAILS — pinned to bottom of page
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

      // FOOTER
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(128, 128, 128)
      doc.text(
        'Company Registration No: 2020/601042/07.  Registered Office: 96 CAVALEROS DRIVE, INDUSTRIES WEST, GERMISTON, GERMISTON, GAUTENG, 1401, SOUTH AFRICA',
        ml,
        footerStartY + 44
      )

      // Save locally
      const fileName = `${invNumber}.pdf`
      doc.save(fileName)

      // Upload to Supabase storage
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

      // Save to sundry_invoices table
      const res = await fetch('/api/sundry-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: invNumber,
          customerName,
          customerAddress,
          customerVat,
          invoiceDate,
          dueDate,
          referenceNumber,
          lineItems: lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatType: item.vatType,
          })),
          subtotal,
          vatAmount: totalVat,
          totalAmount: totalZar,
          amountDue,
          invoiceUrl,
          currency,
          salesCode,
          invoiceData: {
            invoiceDate,
            invoiceNumber: invNumber,
            customerName,
            customerAddress,
            customerVat,
            referenceNumber,
            salesCode,
            lineItems,
            subtotal,
            totalVat,
            totalZar,
            amountDue,
          },
        }),
      })

      const result = await res.json()
      if (result.invoiceNumber) {
        setInvoiceNumber(result.invoiceNumber)
      }

      // Upload pending documents linked to this sundry invoice
      if (result.data?.id && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('sundry_invoice_id', String(result.data.id))
            formData.append('invoice_number', invNumber)
            formData.append('uploaded_by', '')
            await fetch('/api/invoice-documents', { method: 'POST', body: formData })
          } catch {}
        }
      }

      toast.success('Sundry invoice generated and stored')
      onClose()
    } catch (err) {
      console.error('Error generating sundry invoice:', err)
      toast.error('Failed to generate invoice')
    } finally {
      setGenerating(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 mx-4 max-h-[95vh] w-full max-w-[95vw] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#001e42]">Sundry Invoice</h2>
            <p className="text-xs text-slate-500">Create a sundry invoice with custom line items</p>
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
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Number</label>
              <Input value={invoiceNumber} disabled placeholder="Auto-generated on save" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Currency</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZAR">ZAR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Reference</label>
              <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="e.g. PO Number or custom reference" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Sales Code</label>
              <Select value={salesCode} onValueChange={setSalesCode}>
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
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Client (optional)</label>
              <Select value={selectedClientId} onValueChange={handleClientSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client to auto-fill" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer Name</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer or company name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer Address</label>
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="PO Box, City, Country"
                rows={2}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const next = (e.target as HTMLElement).closest('.grid')?.querySelector<HTMLElement>('textarea, input'); if (next) next.focus() } }}
                className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer VAT Number</label>
              <Input value={customerVat} onChange={(e) => setCustomerVat(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Sales Code</label>
              <Select value={salesCode} onValueChange={setSalesCode}>
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
                          placeholder="What is being invoiced"
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
                        {formatCurrency(item.quantity * item.unitPrice, currency)}
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
                <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">TOTAL VAT</span>
                <span className="font-medium">{formatCurrency(totalVat, currency)}</span>
              </div>
              <div className="border-t border-slate-300 pt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-bold">TOTAL {currency}</span>
                  <span className="text-lg font-bold">{formatCurrency(totalZar, currency)}</span>
                </div>
              </div>
              <div className="border-t border-[#001e42] pt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-[#001e42]">AMOUNT DUE {currency}</span>
                  <span className="text-lg font-bold text-[#001e42]">{formatCurrency(amountDue, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Supporting Documents {pendingFiles.length > 0 && `(${pendingFiles.length})`}
            </label>
            <div
              className="rounded-lg border-2 border-dashed border-slate-300 p-4 text-center cursor-pointer hover:border-[#001e42] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              <p className="text-sm text-slate-600">
                {uploading ? 'Uploading...' : 'Click to upload or drag files here'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Images, PDF, Word, Excel — Max 20MB per file
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              onChange={(e) => {
                if (e.target.files) {
                  setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)])
                }
                e.target.value = ''
              }}
              className="hidden"
            />
            {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
            {pendingFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                    <span className="truncate text-sm text-slate-700">{file.name}</span>
                    <button
                      onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-2 text-slate-400 hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
              <><Download className="mr-2 h-4 w-4" /> Generate Sundry Invoice</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
