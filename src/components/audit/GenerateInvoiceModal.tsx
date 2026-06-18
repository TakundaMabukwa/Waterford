/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AuditCurrencyCode } from '@/lib/audit-utils'

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
  zero: 'Zero Rate',
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
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${orderNum}`)
  const [customerName, setCustomerName] = useState(getClientName())
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerVat, setCustomerVat] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

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

  const generatePdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    let y = margin

    // Header - WATERFORD
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('WATERFORD', margin, y + 10)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('carriers', margin + 2, y + 16)

    y += 25

    // TAX INVOICE title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('TAX INVOICE', margin, y)
    y += 15

    // Left side - Customer info
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(customerName || 'Customer', margin, y)
    doc.setFont('helvetica', 'normal')
    if (customerAddress) {
      const addrLines = doc.splitTextToSize(customerAddress, 80)
      doc.text(addrLines, margin, y + 6)
      y += 6 + addrLines.length * 5
    }
    if (customerVat) {
      doc.text(`VAT Number: ${customerVat}`, margin, y + 6)
      y += 6
    }

    // Right side - Invoice details
    const rightX = pageWidth - margin
    let ry = margin + 5

    doc.setFont('helvetica', 'bold')
    doc.text('Invoice Date', rightX - 60, ry)
    doc.setFont('helvetica', 'normal')
    doc.text(invoiceDate, rightX, ry, { align: 'right' })
    ry += 6

    doc.setFont('helvetica', 'bold')
    doc.text('Invoice Number', rightX - 60, ry)
    doc.setFont('helvetica', 'normal')
    doc.text(invoiceNumber, rightX, ry, { align: 'right' })
    ry += 6

    doc.setFont('helvetica', 'bold')
    doc.text('Reference', rightX - 60, ry)
    doc.setFont('helvetica', 'normal')
    doc.text(orderNum, rightX, ry, { align: 'right' })
    ry += 6

    doc.setFont('helvetica', 'bold')
    doc.text('Due Date', rightX - 60, ry)
    doc.setFont('helvetica', 'normal')
    doc.text(dueDate || 'On Receipt', rightX, ry, { align: 'right' })

    y += 20

    // Line items table
    const tableData = lineItems.map((item) => {
      const lineTotal = item.quantity * item.unitPrice
      const vatAmount = lineTotal * VAT_RATES[item.vatType]
      return [
        item.description,
        String(item.quantity),
        formatCurrency(item.unitPrice, invoiceCurrency),
        VAT_LABELS[item.vatType],
        formatCurrency(lineTotal, invoiceCurrency),
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Quantity', 'Unit Price', 'VAT', 'Amount']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: {
        fillColor: [0, 30, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'right', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'center', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 35 },
      },
    })

    y = (doc as any).lastAutoTable.finalY + 10

    // Summary
    const summaryX = pageWidth - margin - 70

    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal', summaryX, y)
    doc.text(formatCurrency(subtotal, invoiceCurrency), pageWidth - margin, y, { align: 'right' })
    y += 6

    doc.text('Total VAT', summaryX, y)
    doc.text(formatCurrency(totalVat, invoiceCurrency), pageWidth - margin, y, { align: 'right' })
    y += 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('TOTAL', summaryX, y)
    doc.text(formatCurrency(totalZar, invoiceCurrency), pageWidth - margin, y, { align: 'right' })
    y += 10

    doc.setFontSize(14)
    doc.text('AMOUNT DUE', summaryX, y)
    doc.text(formatCurrency(totalZar, invoiceCurrency), pageWidth - margin, y, { align: 'right' })

    y += 20

    // Bank details section
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Bank Details', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('South African Rand (ZAR)', margin, y)
    y += 5
    doc.text('First National Bank (FNB), Branch 210554, Acc: 62878378945', margin, y)
    y += 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Global Account (USD)', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('COHEN MABUKWA, ZAZAJ, Branch 450105, Acc 5000040384', margin, y)
    y += 5
    doc.text('Acc type CFC Call Account', margin, y)
    y += 5
    doc.text('142 West Street, Sandton, Johannesburg, 2196', margin, y)

    y += 15

    // Footer
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128, 128, 128)
    doc.text(
      'Company Registration No: 2020/801042/07. Registered Office: 96 CAVALEROS DRIVE, INDUSTRIES WEST, GEORGINA, GERMINSTON, GAUTENG, 1401, SOUTH AFRICA',
      pageWidth / 2,
      y,
      { align: 'center' }
    )

    doc.save(`${invoiceNumber || 'invoice'}.pdf`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
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
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
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
            <div className="w-72 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, invoiceCurrency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total VAT</span>
                <span className="font-medium">{formatCurrency(totalVat, invoiceCurrency)}</span>
              </div>
              <div className="border-t border-slate-300 pt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-bold">TOTAL</span>
                  <span className="text-lg font-bold">{formatCurrency(totalZar, invoiceCurrency)}</span>
                </div>
              </div>
              <div className="border-t border-slate-300 pt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-[#001e42]">AMOUNT DUE</span>
                  <span className="text-lg font-bold text-[#001e42]">{formatCurrency(totalZar, invoiceCurrency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#001e42] focus:outline-none"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={generatePdf} className="bg-[#001e42] text-white hover:bg-[#0b2955]">
            <Download className="mr-2 h-4 w-4" />
            Generate Invoice PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
