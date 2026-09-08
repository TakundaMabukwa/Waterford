/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Loader2, Upload, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { generateInvoicePdf, uploadInvoicePdf, calculateDueDate } from '@/lib/generate-invoice-pdf'
import { AuditCurrencyCode } from '@/lib/audit-utils'

const supabase = createClient()

type InvoiceLineItem = {
  id: string
  description: string
  quantity: string
  unitPrice: string
  salesCode: string
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

const normalizeClientName = (s: string) =>
  (s || '')
    .replace(/^\(\$\)\s*/, '')
    .replace(/^\$\s*/, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// Auto-expanding textarea that grows downward as content is added.
function AutoExpandTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  minRows = 2,
  maxRows = 20,
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minRows?: number
  maxRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = 20
    const next = Math.min(el.scrollHeight, lineHeight * maxRows)
    el.style.height = `${Math.max(next, lineHeight * minRows)}px`
  }, [value, minRows, maxRows])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={minRows}
      className={
        className ||
        'flex w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm leading-5 shadow-sm placeholder:text-slate-400 focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] resize-none disabled:bg-slate-50 disabled:text-slate-500'
      }
    />
  )
}

// Searchable client combobox.
function SearchableClientSelect({
  clients,
  value,
  onSelect,
  placeholder = 'Search client…',
}: {
  clients: any[]
  value: string
  onSelect: (clientId: string) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const selectedClient = clients.find((c) => String(c.id) === value)
  useEffect(() => {
    if (selectedClient) setQuery(selectedClient.name || '')
  }, [selectedClient?.id])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const q = normalizeClientName(query)
  const filtered = q
    ? clients.filter((c) => normalizeClientName(c.name || '').includes(q)).slice(0, 25)
    : clients.slice(0, 25)
  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (selectedClient && e.target.value !== selectedClient.name) {
            onSelect('')
          }
        }}
        onFocus={() => setOpen(true)}
        className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42]"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(String(c.id))
                setQuery(c.name || '')
                setOpen(false)
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-100"
            >
              <span className="truncate">{c.name || '(no name)'}</span>
              {c.client_id && <span className="ml-2 shrink-0 text-xs text-slate-400">{c.client_id}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const [dueDate, setDueDate] = useState(() => calculateDueDate(new Date().toISOString().split('T')[0]))
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerVat, setCustomerVat] = useState('')
  const [currency, setCurrency] = useState('ZAR')
  const [generating, setGenerating] = useState(false)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewInvoiceNumber, setPreviewInvoiceNumber] = useState('')

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
    if (!clientId) return
    const client = clients.find((c) => String(c.id) === clientId)
    if (!client) return
    const clientName = client.name || ''
    setCustomerName(clientName)

    // Auto-switch currency to USD if client name has ($) or $ prefix
    if (clientName.startsWith('($)') || clientName.startsWith('$')) {
      setCurrency('USD')
    }

    const addrParts = [client.address, client.city, client.country].filter(Boolean)
    setCustomerAddress(addrParts.join(', '))
    setCustomerVat(client.vat_number || client.tax_number || '')

    // Apply client defaults: vat type across all lines + per-line sales code
    const clientVatType = client.vat_type
    if (clientVatType && ['zero', 'standard', 'exempt', 'zero_export'].includes(clientVatType)) {
      setLineItems((prev) => prev.map((l) => ({ ...l, vatType: clientVatType as any })))
    }
    if (client.industry_code) {
      setLineItems((prev) => prev.map((l) => ({ ...l, salesCode: client.industry_code })))
    }
  }

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    {
      id: 'line-1',
      description: '',
      quantity: '1',
      unitPrice: '',
      salesCode: '200',
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
        salesCode: '200',
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
            id: item.id,
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
      const generatedInvoiceNumber = result.data?.invoice_number || ''
      if (generatedInvoiceNumber) {
        setInvoiceNumber(generatedInvoiceNumber)
      }

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
                sundry_invoice_id: invoiceId,
                invoice_number: generatedInvoiceNumber || '',
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

      // Generate + upload PDF, then show preview overlay (Download + Close)
      try {
        const cleanName = customerName.replace(/^\(\$\)\s*/, '').replace(/^\$\s*/, '').trim() || customerName
        const pdfCurrency = (currency === 'USD' ? 'USD' : 'ZAR') as AuditCurrencyCode
        const { blob: pdfBlob } = await generateInvoicePdf({
          invoiceNumber: generatedInvoiceNumber,
          customerName: cleanName,
          customerAddress,
          customerVat,
          invoiceDate,
          dueDate,
          referenceNumber: referenceNumber || invoiceNumber || '',
          salesCode,
          currency: pdfCurrency,
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
        })
        const pdfUrl = await uploadInvoicePdf(generatedInvoiceNumber, pdfBlob)
        if (pdfUrl) {
          await fetch(`/api/invoices/${invoiceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoice_url: pdfUrl }),
          }).catch(() => {})
        }

        const previewUrl = URL.createObjectURL(pdfBlob)
        setPreviewInvoiceNumber(generatedInvoiceNumber)
        setPreviewPdfUrl(previewUrl)
        setGenerating(false)
      } catch (pdfErr) {
        console.error('Error generating sundry PDF preview:', pdfErr)
        setGenerating(false)
        onClose()
      }
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
                onChange={(e) => {
                  setInvoiceDate(e.target.value)
                  setDueDate(calculateDueDate(e.target.value))
                }}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Due Date (Auto-calculated)</label>
              <input
                type="date"
                value={dueDate}
                readOnly
                className="flex h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-500 cursor-not-allowed"
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
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Client</label>
              <SearchableClientSelect
                clients={clients}
                value={selectedClientId}
                onSelect={handleClientSelect}
                placeholder="Search and select client…"
              />
              {selectedClientId && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Selected: <span className="font-medium text-slate-700">{customerName || '—'}</span>
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer Address</label>
              <AutoExpandTextarea
                value={customerAddress}
                onChange={setCustomerAddress}
                placeholder="PO Box, City, Country"
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
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-16">Qty</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-32">Sales Code</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-28">Unit Price</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-32">VAT</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-32">Amount</th>
                    <th className="px-4 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="min-w-[280px] px-4 py-2 align-top">
                        <AutoExpandTextarea
                          value={item.description}
                          onChange={(val) => updateLine(item.id, 'description', val)}
                          placeholder="What is being invoiced"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => updateLine(item.id, 'quantity', e.target.value)}
                          className="h-9 w-16 rounded-md border border-slate-300 bg-transparent px-2 py-1 text-right text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={item.salesCode || salesCode}
                          onChange={(e) => updateLine(item.id, 'salesCode' as any, e.target.value)}
                          className="h-9 w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42]"
                        >
                          {SALES_CODES.map((sc) => (
                            <option key={sc.code} value={sc.code}>
                              {sc.code} - {sc.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(e) => updateLine(item.id, 'unitPrice', e.target.value)}
                          className="h-9 w-28 rounded-md border border-slate-300 bg-transparent px-2 py-1 text-right text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42]"
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
              <div className="border-t border-[#001e42] pt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-[#001e42]">AMOUNT DUE</span>
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
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (e.dataTransfer.files) {
                  const maxSize = 50 * 1024 * 1024
                  const validFiles = Array.from(e.dataTransfer.files).filter((file) => {
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
              }}
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

      {/* Invoice Preview Overlay */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={() => {
          URL.revokeObjectURL(previewPdfUrl)
          setPreviewPdfUrl(null)
          onClose()
        }}>
          <div className="relative flex h-[90vh] w-[90vw] max-w-5xl flex-col rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">Invoice Preview</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl}
                  download={`${previewInvoiceNumber || 'invoice'}.pdf`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <Button variant="outline" size="sm" onClick={() => {
                  URL.revokeObjectURL(previewPdfUrl)
                  setPreviewPdfUrl(null)
                  onClose()
                }}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={previewPdfUrl} className="h-full w-full border-0" title="Invoice Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
