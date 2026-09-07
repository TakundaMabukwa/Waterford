/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Download, Loader2, Upload, FileText, Image, FileSpreadsheet } from 'lucide-react'
import JSZip from 'jszip'
import { generateInvoicePdf, uploadInvoicePdf, calculateDueDate } from '@/lib/generate-invoice-pdf'
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
  vehicle: string
  driver: string
  salesCode: string
  vatType: 'zero' | 'standard' | 'exempt' | 'zero_export'
}

const parseJson = (val: any): any => {
  if (!val) return null
  if (typeof val === 'string') { try { return JSON.parse(val) } catch { return null } }
  return val
}

const normalizeClientName = (s: string) =>
  (s || '')
    .replace(/^\(\$\)\s*/, '')
    .replace(/^\$\s*/, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// Derive vehicle reg + driver name from the trip's vehicleassignments JSON column
const deriveVehicleDriver = (record: any) => {
  const va = parseJson(record?.vehicleassignments)
  if (!Array.isArray(va) || va.length === 0) return { vehicle: '', driver: '' }
  const first = va[0] || {}
  const vehicle = first?.vehicle?.name || ''
  const driverObj = first?.drivers?.[0]
  const driver = driverObj
    ? `${driverObj.first_name || ''} ${driverObj.surname || ''}`.trim()
    : ''
  return { vehicle, driver }
}

const SALES_CODES = [
  { code: '200', label: 'Sales' },
  { code: '201', label: 'Sales - Subcontractors' },
  { code: '202', label: 'Sales - Other' },
  { code: '203', label: 'Sales - Repo, Handling & Document Fees' },
  { code: '206', label: 'Sales - Warehousing & Rental' },
  { code: '260', label: 'Other Revenue' },
]

// Textarea that grows downward as content is added so text is never hidden behind a scrollbar.
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

// Searchable client combobox: renders an input that filters the supplied list of clients
// and surfaces a dropdown of matches. Selecting a client fires onSelect.
function SearchableClientSelect({
  clients,
  value,
  onSelect,
  disabled,
  placeholder = 'Search client…',
}: {
  clients: any[]
  value: string
  onSelect: (clientId: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Keep the input label in sync with the currently selected client
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
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          // Clear selection when user types something different
          if (selectedClient && e.target.value !== selectedClient.name) {
            onSelect('')
          }
        }}
        onFocus={() => setOpen(true)}
        className={`flex h-9 w-full rounded-md border border-slate-300 px-3 py-1 text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
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

const VAT_RATES: Record<string, number> = {
  zero: 0,
  standard: 0.15,
  exempt: 0,
  zero_export: 0,
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

type ModalCloseResult = {
  finalizedInvoiceUrl?: string
  // 'success' = the user clicked Generate and the invoice was finalized.
  // 'cancel' = the user closed the modal without finalizing.
  // 'edit' = the user saved an edit.
  // 'draft' = the user saved a draft.
  status?: 'success' | 'cancel' | 'edit' | 'draft'
}

type Props = {
  open: boolean
  onClose: (result?: string | ModalCloseResult) => void
  record: any
  invoiceRate: number
  invoiceCurrency: AuditCurrencyCode
  splitRows: any[]
  calcSplitTotal: (row: any) => number
  onInvoiced?: (rate: number, currency: string) => void
  mode?: InvoiceMode
  draftId?: number
  draftData?: any
  // When true, the parent will navigate away from the audit-load page after a successful
  // generation. Used by the trip workspace so users land back on /audit once invoiced.
  closeParentOnSuccess?: boolean
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
  closeParentOnSuccess = false,
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
  const [dueDate, setDueDate] = useState(() => calculateDueDate(new Date().toISOString().split('T')[0]))
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [customerName, setCustomerName] = useState(cleanClientName)
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerVat, setCustomerVat] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)

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

  // Auto-match the client once clients are loaded. Runs in all modes so the
  // Client dropdown pre-populates when editing a draft or finalized invoice.
  // In edit/finalize modes we look up the name from draftData; in draft mode
  // we look up from the trip record.
  useEffect(() => {
    if (!open) return
    if (clients.length === 0) return
    if (selectedClientId) return

    // Determine the source name to match against
    let sourceName = ''
    if (mode === 'draft') {
      sourceName = cleanClientName
    } else if (draftData) {
      sourceName = draftData.customer_name || draftData.customerName || ''
    }

    const targetName = normalizeClientName(sourceName)
    if (!targetName) return

    const matched = clients.find((c) => normalizeClientName(c.name || '') === targetName)
    if (matched) {
      handleClientSelect(String(matched.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, open, mode])

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId)
    if (!clientId) return
    const client = clients.find((c) => String(c.id) === clientId)
    if (!client) return
    setCustomerName(client.name || '')
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
    const { vehicle, driver } = deriveVehicleDriver(record)

    if (splitRows.length) {
      return splitRows.map((row, i) => ({
        id: `line-${i}`,
        description: routeDesc,
        quantity: '1',
        unitPrice: i === 0 ? String(invoiceRate || '') : String(calcSplitTotal(row) || ''),
        vehicle,
        driver,
        salesCode: '200',
        vatType: 'zero' as const,
      }))
    }
    return [
      {
        id: 'line-1',
        description: routeDesc,
        quantity: '1',
        unitPrice: String(invoiceRate || ''),
        vehicle,
        driver,
        salesCode: '200',
        vatType: 'zero' as const,
      },
    ]
  })

  const [salesCode, setSalesCode] = useState('200')

  const updateLine = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const addLine = () => {
    const { vehicle, driver } = deriveVehicleDriver(record)
    setLineItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        description: '',
        quantity: '1',
        unitPrice: '',
        vehicle,
        driver,
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

   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !record?.id) return
    await processFiles(files)
    e.target.value = ''
  }

  const processFiles = async (files: FileList | File[]) => {
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
    let finalInvoiceUrl: string | undefined = undefined
    try {

    // In draft mode, save to invoices table then generate preview PDF
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

      const createResJson = await res.json()
      const createdInvoice = createResJson.data
      if (!createdInvoice?.id || !createdInvoice?.invoice_number) {
        throw new Error('Draft created but missing invoice data')
      }

      // Generate and upload PDF with real invoice number
      const { blob: pdfBlob, fileName } = await generateInvoicePdf({
        invoiceNumber: createdInvoice.invoice_number,
        customerName: cleanName,
        customerAddress,
        customerVat,
        invoiceDate,
        dueDate,
        referenceNumber,
        salesCode,
        currency: detectedCurrency,
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          vatType: item.vatType,
          vehicle: item.vehicle || '',
          driver: item.driver || '',
        })),
        subtotal,
        vatAmount: totalVat,
        totalAmount: totalZar,
        amountDue,
      })
      const pdfUrl = await uploadInvoicePdf(createdInvoice.invoice_number, pdfBlob)
      if (pdfUrl) {
        await fetch(`/api/invoices/${createdInvoice.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_url: pdfUrl }),
        }).catch(() => {})
      }

      // Show preview in overlay
      const previewUrl = URL.createObjectURL(pdfBlob)
      setPreviewPdfUrl(previewUrl)
      toast.success(`Draft ${createdInvoice.invoice_number} created — preview below`)
      onInvoiced?.(invoiceRate, detectedCurrency)
      return
    }

    // In edit mode, update the existing invoice
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
          changedBy: 'user',
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
        throw new Error(err.error || 'Failed to update invoice')
      }

      // If invoice is finalized (has invoice_number), regenerate PDF
      if (invoiceNumber) {
        try {
          const { blob: pdfBlob } = await generateInvoicePdf({
            invoiceNumber,
            customerName: cleanName,
            customerAddress,
            customerVat,
            invoiceDate,
            dueDate,
            referenceNumber,
            salesCode,
            currency: detectedCurrency,
            lineItems: lineItems.map(item => ({
              description: item.description,
              quantity: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
              vatType: item.vatType,
              vehicle: item.vehicle || '',
              driver: item.driver || '',
            })),
            subtotal,
            vatAmount: totalVat,
            totalAmount: totalZar,
            amountDue,
          })
          const pdfUrl = await uploadInvoicePdf(invoiceNumber, pdfBlob)
          if (pdfUrl) {
            await fetch(`/api/invoices/${draftId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoice_url: pdfUrl }),
            })
          }
        } catch (pdfErr) {
          console.error('PDF regeneration failed:', pdfErr)
        }
      }

      toast.success(invoiceNumber ? 'Invoice updated and PDF regenerated' : 'Draft updated')
      onClose({ status: invoiceNumber ? 'edit' : 'draft' })
      return
    }

    // In finalize mode, use pre-assigned invoice number and generate PDF
    const invNumber = invoiceNumber
    if (!invNumber) throw new Error('Invoice number not assigned')

    const { blob: pdfBlob, fileName } = await generateInvoicePdf({
      invoiceNumber: invNumber,
      customerName: cleanName,
      customerAddress,
      customerVat,
      invoiceDate,
      dueDate,
      referenceNumber,
      salesCode,
      currency: detectedCurrency,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        vatType: item.vatType,
        vehicle: item.vehicle || '',
        driver: item.driver || '',
      })),
      subtotal,
      vatAmount: totalVat,
      totalAmount: totalZar,
      amountDue,
    })

    let invoiceUrl = null
    try {
      invoiceUrl = await uploadInvoicePdf(invNumber, pdfBlob)
      if (invoiceUrl) {
        finalInvoiceUrl = invoiceUrl
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

    // Show preview of the invoice PDF
    const previewUrl = URL.createObjectURL(pdfBlob)
    setPreviewPdfUrl(previewUrl)
    toast.success('Invoice generated — preview below')
  } catch (err) {
    console.error('Invoice generation error:', err)
    toast.error('Failed to generate invoice')
  } finally {
    setGenerating(false)
    onInvoiced?.(invoiceRate, detectedCurrency)
    if (finalInvoiceUrl) {
      onClose({ finalizedInvoiceUrl: finalInvoiceUrl, status: 'success' })
    } else if (closeParentOnSuccess) {
      // Even without a PDF URL, if the parent requested close-on-success we still
      // signal success so the user is taken back to /audit.
      onClose({ status: 'success' })
    } else {
      onClose()
    }
  }
}

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onClose({ status: 'cancel' })} />
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
          <button onClick={() => onClose({ status: 'cancel' })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
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
                disabled={!!record?.is_invoiced}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] disabled:bg-slate-100 disabled:text-slate-500"
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
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Auto-generated on generate" disabled={!!record?.is_invoiced} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Client</label>
              <SearchableClientSelect
                clients={clients}
                value={selectedClientId}
                onSelect={handleClientSelect}
                disabled={!!record?.is_invoiced}
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
                disabled={!!record?.is_invoiced}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Customer VAT Number</label>
              <Input value={customerVat} onChange={(e) => setCustomerVat(e.target.value)} disabled={!!record?.is_invoiced} />
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
            <div className="mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">Line Items</h3>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-16">Qty</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-28">Unit Price</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 w-32">Sales Code</th>
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
                          placeholder="Description"
                          disabled={!!record?.is_invoiced}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => updateLine(item.id, 'quantity', e.target.value)}
                          className="h-9 w-16 rounded-md border border-slate-300 bg-transparent px-2 py-1 text-right text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] disabled:bg-slate-50 disabled:text-slate-500"
                          disabled={!!record?.is_invoiced}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(e) => updateLine(item.id, 'unitPrice', e.target.value)}
                          className="h-9 w-28 rounded-md border border-slate-300 bg-transparent px-2 py-1 text-right text-sm shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] disabled:bg-slate-50 disabled:text-slate-500"
                          disabled={!!record?.is_invoiced}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={item.salesCode || salesCode}
                          onChange={(e) => updateLine(item.id, 'salesCode' as any, e.target.value)}
                          disabled={!!record?.is_invoiced}
                          className="h-9 w-32 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-[#001e42] focus:outline-none focus:ring-1 focus:ring-[#001e42] disabled:bg-slate-50 disabled:text-slate-500"
                        >
                          {SALES_CODES.map((sc) => (
                            <option key={sc.code} value={sc.code}>
                              {sc.code} - {sc.label}
                            </option>
                          ))}
                        </select>
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
            {!record?.is_invoiced && (
              <Button variant="outline" size="sm" onClick={addLine} className="mt-3">
                <Plus className="mr-1 h-3 w-3" /> Add Line
              </Button>
            )}
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
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); processFiles(e.dataTransfer.files); }}
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
          <Button variant="outline" onClick={() => onClose({ status: 'cancel' })} disabled={generating}>Cancel</Button>
          <Button onClick={generatePdf} className="bg-[#001e42] text-white hover:bg-[#0b2955]" disabled={generating}>
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {mode === 'draft' ? 'Creating...' : mode === 'edit' ? 'Saving...' : 'Generating...'}</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> {mode === 'draft' ? 'Create Draft' : mode === 'edit' ? 'Save Changes' : 'Generate Invoice & Download'}</>
            )}
          </Button>
        </div>
      </div>

      {/* Invoice Preview Overlay */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={() => {
          URL.revokeObjectURL(previewPdfUrl)
          setPreviewPdfUrl(null)
          onClose({ status: 'finalize' })
        }}>
          <div className="relative flex h-[90vh] w-[90vw] max-w-5xl flex-col rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">Invoice Preview</h3>
              <Button variant="outline" size="sm" onClick={() => {
                URL.revokeObjectURL(previewPdfUrl)
                setPreviewPdfUrl(null)
                onClose({ status: 'finalize' })
              }}>
                Close
              </Button>
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
