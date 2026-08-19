/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

const VAT_RATES: Record<string, number> = {
  zero: 0,
  standard: 0.15,
  exempt: 0,
  zero_export: 0,
}

const SALES_CODES = [
  { code: '200', label: 'Sales' },
  { code: '201', label: 'Sales - Subcontractors' },
  { code: '202', label: 'Sales - Other' },
  { code: '203', label: 'Sales - Repo, Handling & Document Fees' },
  { code: '206', label: 'Sales - Warehousing & Rental' },
  { code: '260', label: 'Other Revenue' },
]

const formatCurrency = (value: number, currencyCode: string = 'ZAR') =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

type Props = {
  open: boolean
  onClose: () => void
}

export default function SundryInvoiceModal({ open, onClose }: Props) {
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().split('T')[0]
  })
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
      quantity: '1',
      unitPrice: '',
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

  const saveDraft = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerAddress,
          customerVat,
          invoiceDate,
          dueDate,
          referenceNumber,
          salesCode,
          lineItems: lineItems.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            vatType: item.vatType,
          })),
          subtotal,
          vatAmount: totalVat,
          totalAmount: totalZar,
          amountDue,
          currency,
          invoiceData: {
            invoiceDate,
            dueDate,
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
            currency,
          },
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to save draft')

      const invoiceId = result.data?.id

      // Upload pending documents linked to this invoice
      if (invoiceId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const filePath = `invoice-docs/sundry/${invoiceId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

            const { error: uploadError } = await supabase.storage
              .from('invoice-documents')
              .upload(filePath, file, { contentType: file.type, upsert: false })

            if (uploadError) {
              console.error('Storage upload error:', uploadError)
              continue
            }

            const { data: urlData } = supabase.storage.from('invoice-documents').getPublicUrl(filePath)
            const publicUrl = urlData?.publicUrl || ''

            await fetch('/api/invoice-documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audit_id: invoiceId,
                invoice_number: '',
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
          } catch (e) {
            console.error('Document upload error:', e)
          }
        }
      }

      toast.success('Sundry invoice saved as draft')
      onClose()
    } catch (err: any) {
      console.error('Error saving sundry draft:', err)
      toast.error(err.message || 'Failed to save draft')
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
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Number</label>
              <Input value={invoiceNumber} disabled placeholder="Generated on finalize" />
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
                className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] resize-y"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer VAT Number</label>
              <Input value={customerVat} onChange={(e) => setCustomerVat(e.target.value)} />
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
                        <textarea
                          value={item.description}
                          onChange={(e) => updateLine(item.id, 'description', e.target.value)}
                          placeholder="What is being invoiced"
                          rows={2}
                          className="flex w-full rounded-md border border-slate-300 bg-transparent px-2 py-1 text-sm shadow-sm placeholder:text-slate-400 focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] resize-y min-h-[40px]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => updateLine(item.id, 'quantity', e.target.value)}
                          className="h-9 w-20 rounded-md border border-slate-300 bg-transparent px-2 py-1 text-right text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(e) => updateLine(item.id, 'unitPrice', e.target.value)}
                          className="h-9 w-32 rounded-md border border-slate-300 bg-transparent px-2 py-1 text-right text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={item.vatType}
                          onValueChange={(val: 'zero' | 'standard' | 'exempt' | 'zero_export') => updateLine(item.id, 'vatType', val)}
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
                        {formatCurrency((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), currency)}
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
                  const maxSize = 50 * 1024 * 1024 // 50MB
                  const validFiles = Array.from(e.target.files!).filter((file) => {
                    if (file.size > maxSize) {
                      setUploadError(`"${file.name}" exceeds 50MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
                      return false
                    }
                    return true
                  })
                  if (validFiles.length > 0) {
                    setUploadError('')
                    setPendingFiles((prev) => [...prev, ...validFiles])
                  }
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
          <Button onClick={saveDraft} className="bg-[#001e42] text-white hover:bg-[#0b2955]" disabled={generating}>
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              'Save as Draft'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
