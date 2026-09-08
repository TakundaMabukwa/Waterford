/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Download, FileText, Paperclip, Route, Truck, Plus, AlertTriangle, Loader2, Mail, Search } from 'lucide-react'
// @ts-ignore
import ExcelJS from 'exceljs'
import SundryInvoiceModal from '@/components/audit/SundryInvoiceModal'
import { TripReportsSection } from '@/components/trip-reports-section'
import GenerateInvoiceModal from '@/components/audit/GenerateInvoiceModal'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SecureButton } from '@/components/SecureButton'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// Pretty-format a value for the audit log. Complex values (arrays, objects)
// are rendered as readable text rather than raw JSON code.
function formatAuditValue(raw: string | null | undefined, field?: string): string {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''

  // Try parsing JSON for arrays/objects
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (field === 'line_items' && Array.isArray(parsed)) {
        return parsed.map((item: any, i: number) => {
          const desc = item.description || '(no description)'
          const qty = item.quantity ?? ''
          const price = item.unitPrice ?? item.unit_price ?? ''
          const vat = item.vatType || item.vat_type || ''
          return `Line ${i + 1}: ${desc} — qty ${qty} × ${price} (${vat})`
        }).join('\n')
      }
      if (Array.isArray(parsed)) {
        return parsed.map((v, i) => `${i + 1}. ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n')
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed)
          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join('\n')
      }
      return String(parsed)
    } catch {
      // Fall through to plain string
    }
  }
  return trimmed
}

const currency = (value: number) =>
  `R${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const FIELD_LABELS: Record<string, string> = {
  customer_name: 'Customer Name',
  customer_address: 'Customer Address',
  customer_vat: 'Customer VAT',
  invoice_date: 'Invoice Date',
  due_date: 'Due Date',
  line_items: 'Line Items',
  subtotal: 'Subtotal',
  vat_amount: 'VAT Amount',
  total_amount: 'Total Amount',
  amount_due: 'Amount Due',
  currency: 'Currency',
  invoice_url: 'Invoice PDF',
  reference_number: 'Reference Number',
  sales_code: 'Sales Code',
  invoice_number: 'Invoice Number',
}

const getClientName = (record: any) => {
  if (record.selectedclient || record.selected_client) return record.selectedclient || record.selected_client
  if (record.clientdetails || record.client_details) {
    try {
      const clientData = typeof record.clientdetails === 'string' ? JSON.parse(record.clientdetails) : record.clientdetails || record.client_details
      return clientData?.name || 'N/A'
    } catch {
      return 'N/A'
    }
  }
  return 'N/A'
}

export default function AuditPage() {
  const router = useRouter()
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  )

  const [records, setRecords] = useState<any[]>([])
  const [filteredRecords, setFilteredRecords] = useState<any[]>([])
  const [incompleteRecords, setIncompleteRecords] = useState<any[]>([])
  const [incompleteLoading, setIncompleteLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [invoicedFilter, setInvoicedFilter] = useState<'all' | 'invoiced' | 'not_invoiced'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [selectedDocumentRecord, setSelectedDocumentRecord] = useState<any>(null)
  const [tripDocuments, setTripDocuments] = useState<any[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'trips' | 'incomplete' | 'drafts' | 'invoices' | 'reports'>('trips')
  const [showSundryModal, setShowSundryModal] = useState(false)
  const [draftInvoices, setDraftInvoices] = useState<any[]>([])
  const [draftLoading, setDraftLoading] = useState(false)
  const [finalizedInvoices, setFinalizedInvoices] = useState<any[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [lockMonth, setLockMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [editDraftId, setEditDraftId] = useState<number | null>(null)
  const [editDraftData, setEditDraftData] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editModalMode, setEditModalMode] = useState<'edit' | 'finalize'>('edit')
  const [finalizePreview, setFinalizePreview] = useState<any>(null)
  const [showFinalizePreview, setShowFinalizePreview] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [draftSearch, setDraftSearch] = useState('')
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [finalizeDocs, setFinalizeDocs] = useState<any[]>([])
  const [finalizeDocsLoading, setFinalizeDocsLoading] = useState(false)
  const [finalizedInvoiceUrl, setFinalizedInvoiceUrl] = useState<string | null>(null)
  const [sendEmailGroups, setSendEmailGroups] = useState<any[]>([])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(new Set())
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set())
  const [batchFinalizing, setBatchFinalizing] = useState(false)
  const [batchSending, setBatchSending] = useState(false)
  // Send modal state — confirms which recipients get which invoices before sending
  const [sendModalOpen, setSendModalOpen] = useState(false)
  // Map<invoiceId, Set<emailAddress>> — selected recipient per invoice
  const [sendRecipients, setSendRecipients] = useState<Record<number, Set<string>>>({})
  // Map<invoiceId, Set<groupName>> — selected email groups per invoice
  const [sendSelectedGroups, setSendSelectedGroups] = useState<Record<number, Set<string>>>({})
  const [auditLogOpen, setAuditLogOpen] = useState(false)
  const [auditLogInvoiceId, setAuditLogInvoiceId] = useState<number | null>(null)
  const [auditLogData, setAuditLogData] = useState<any[]>([])
  const [auditLogLoading, setAuditLogLoading] = useState(false)
  const [exportRangeOpen, setExportRangeOpen] = useState(false)
  const [exportFromInvoice, setExportFromInvoice] = useState('')
  const [exportToInvoice, setExportToInvoice] = useState('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1, 1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date()
    d.setDate(0)
    return d.toISOString().split('T')[0]
  })
  const [appliedDateFrom, setAppliedDateFrom] = useState(dateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState(dateTo)

  const handleBatchFinalize = async () => {
    if (selectedDraftIds.size === 0) return
    if (!confirm(`Finalize ${selectedDraftIds.size} invoice(s)?`)) return
    setBatchFinalizing(true)
    try {
      const res = await fetch('/api/invoices/batch-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedDraftIds) }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Batch finalize failed')

      const succeeded = result.results?.filter((r: any) => r.success) || []
      const failed = result.results?.filter((r: any) => !r.success) || []

      if (succeeded.length > 0) {
        // Generate PDFs for each succeeded invoice
        const { generateAndUploadInvoicePdf } = await import('@/lib/generate-invoice-pdf')
        for (const inv of succeeded) {
          try {
            const invoiceData = draftInvoices.find((d: any) => d.id === inv.id)
            if (!invoiceData) continue
            const { pdfUrl } = await generateAndUploadInvoicePdf({
              invoiceNumber: inv.invoice_number,
              customerName: invoiceData.customer_name || '',
              customerAddress: invoiceData.customer_address || '',
              customerVat: invoiceData.customer_vat || '',
              invoiceDate: invoiceData.invoice_date || '',
              dueDate: invoiceData.due_date || '',
              referenceNumber: invoiceData.reference_number || '',
              salesCode: invoiceData.sales_code || '200',
              currency: invoiceData.currency || 'ZAR',
              lineItems: (invoiceData.line_items || []).map((item: any) => ({
                description: item.description || '',
                quantity: Number(item.quantity) || 0,
                unitPrice: Number(item.unitPrice) || 0,
                vatType: item.vatType || 'zero',
                vehicle: item.vehicle || '',
                driver: item.driver || '',
              })),
              subtotal: Number(invoiceData.subtotal) || 0,
              vatAmount: Number(invoiceData.vat_amount) || 0,
              totalAmount: Number(invoiceData.total_amount) || 0,
              amountDue: Number(invoiceData.amount_due) || 0,
            })
            if (pdfUrl) {
              await fetch(`/api/invoices/${inv.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoice_url: pdfUrl }),
              })
            }
          } catch (pdfErr) {
            console.error(`PDF generation failed for invoice ${inv.id}:`, pdfErr)
          }
        }
      }

      setSelectedDraftIds(new Set())
      // Refresh lists and wait for completion before continuing
      const [draftRes, finalizedRes] = await Promise.all([
        fetch('/api/invoices?draft=true').then(r => r.json()),
        fetch('/api/invoices?finalized=true').then(r => r.json()),
      ])
      setDraftInvoices(draftRes.data || [])
      setFinalizedInvoices(finalizedRes.data || [])

      const msg = succeeded.length > 0 ? `Finalized ${succeeded.length} invoice(s)` : ''
      const errMsg = failed.length > 0 ? `\nFailed: ${failed.map((f: any) => `${f.id}: ${f.error}`).join(', ')}` : ''
      alert(msg + errMsg || 'No invoices were finalized')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBatchFinalizing(false)
    }
  }

  const openSendModal = () => {
    if (selectedInvoiceIds.size === 0) return
    // Pre-populate the per-invoice selection with all available recipients
    const selected = finalizedInvoices.filter((inv: any) => selectedInvoiceIds.has(inv.id))
    const recipientMap: Record<number, Set<string>> = {}
    const groupMap: Record<number, Set<string>> = {}
    for (const inv of selected) {
      const groups = inv.invoice_email_groups || []
      const allEmails = new Set<string>()
      const groupNames = new Set<string>()
      for (const g of groups) {
        if (g.emails?.length) {
          for (const e of g.emails.filter((e: string) => e.trim())) {
            allEmails.add(e.trim())
          }
          groupNames.add(g.name || '')
        }
      }
      recipientMap[inv.id] = allEmails
      groupMap[inv.id] = groupNames
    }
    setSendRecipients(recipientMap)
    setSendSelectedGroups(groupMap)
    setSendModalOpen(true)
  }

  const closeSendModal = () => {
    setSendModalOpen(false)
    setSendRecipients({})
    setSendSelectedGroups({})
  }

  const toggleSendGroup = (invoiceId: number, group: any) => {
    const groupName = group.name || ''
    const emails = (group.emails || []).filter((e: string) => e.trim()).map((e: string) => e.trim())
    setSendSelectedGroups((prev) => {
      const next: Record<number, Set<string>> = { ...prev }
      const cur = new Set(next[invoiceId] || [])
      if (cur.has(groupName)) {
        cur.delete(groupName)
      } else {
        cur.add(groupName)
      }
      next[invoiceId] = cur
      return next
    })
    setSendRecipients((prev) => {
      const next: Record<number, Set<string>> = { ...prev }
      const cur = new Set(next[invoiceId] || [])
      if (cur.size === 0 && emails.length) {
        // Selecting group: add all its emails
        for (const e of emails) cur.add(e)
      } else {
        // Check intersection
        const stillSelected = emails.every((e: string) => cur.has(e))
        if (stillSelected) {
          for (const e of emails) cur.delete(e)
        } else {
          for (const e of emails) cur.add(e)
        }
      }
      next[invoiceId] = cur
      return next
    })
  }

  const toggleSendEmail = (invoiceId: number, email: string) => {
    setSendRecipients((prev) => {
      const next: Record<number, Set<string>> = { ...prev }
      const cur = new Set(next[invoiceId] || [])
      const trimmed = email.trim()
      if (cur.has(trimmed)) cur.delete(trimmed)
      else cur.add(trimmed)
      next[invoiceId] = cur
      return next
    })
  }

  const toggleAllForInvoice = (invoiceId: number, groups: any[]) => {
    const allEmails = new Set<string>()
    for (const g of groups) {
      for (const e of (g.emails || []).filter((e: string) => e.trim())) {
        allEmails.add(e.trim())
      }
    }
    setSendRecipients((prev) => {
      const next: Record<number, Set<string>> = { ...prev }
      const cur = new Set(next[invoiceId] || [])
      const allSelected = allEmails.size > 0 && Array.from(allEmails).every((e) => cur.has(e))
      if (allSelected) {
        next[invoiceId] = new Set()
      } else {
        next[invoiceId] = new Set(allEmails)
      }
      return next
    })
  }

  const handleBatchSend = async () => {
    if (selectedInvoiceIds.size === 0) return

    // Build per-invoice recipient payloads
    const selected = finalizedInvoices.filter((inv: any) => selectedInvoiceIds.has(inv.id))
    const payload = selected.map((inv: any) => ({
      id: inv.id,
      recipients: Array.from(sendRecipients[inv.id] || []),
    }))
    const totalRecipients = payload.reduce((sum: number, p: any) => sum + p.recipients.length, 0)
    if (totalRecipients === 0) {
      alert('No recipients selected. Pick at least one email to send to.')
      return
    }
    if (!confirm(`Send ${selected.length} invoice(s) to ${totalRecipients} email address(es)?`)) return

    setBatchSending(true)
    try {
      const res = await fetch('/api/invoices/batch-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perInvoiceRecipients: payload }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Batch send failed')

      const succeeded = result.results?.filter((r: any) => r.success) || []
      const failed = result.results?.filter((r: any) => !r.success) || []

      setSelectedInvoiceIds(new Set())
      closeSendModal()

      const msg = succeeded.length > 0 ? `Sent ${succeeded.length} invoice(s)` : ''
      const errMsg = failed.length > 0 ? `\nFailed: ${failed.map((f: any) => `${f.id}: ${f.error}`).join(', ')}` : ''
      alert(msg + errMsg || 'No invoices were sent')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBatchSending(false)
    }
  }

  const loadAuditLog = async (invoiceId: number) => {
    setAuditLogInvoiceId(invoiceId)
    setAuditLogOpen(true)
    setAuditLogLoading(true)
    try {
      const res = await fetch(`/api/invoice-audit-log?invoice_id=${invoiceId}`)
      const result = await res.json()
      setAuditLogData(result.data || [])
    } catch {
      setAuditLogData([])
    } finally {
      setAuditLogLoading(false)
    }
  }

  const handleSearch = () => {
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
  }

  useEffect(() => {
    const loadRecords = async () => {
      try {
        setLoading(true)

        const params = new URLSearchParams()
        params.set('from', appliedDateFrom)
        params.set('to', appliedDateTo)

        const response = await fetch(`/api/audit/trips?${params.toString()}`)
        const result = await response.json()

        if (!response.ok || result.error) throw new Error(result.error || 'Failed to fetch')

        setRecords(result.data || [])
      } catch (error) {
        console.error('Error fetching audit records:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRecords()
  }, [supabase, appliedDateFrom, appliedDateTo])

  // For invoiced tab, also fetch ALL invoiced trips (no date filter)
  useEffect(() => {
    if (activeTab !== 'invoiced') return
    const fetchAllInvoiced = async () => {
      try {
        const res = await fetch('/api/audit/trips')
        const result = await res.json()
        if (result.data) {
          setRecords(prev => {
            const existingIds = new Set(prev.map((r: any) => r.id))
            const newRecords = result.data.filter((r: any) => !existingIds.has(r.id))
            return [...prev, ...newRecords]
          })
        }
      } catch {}
    }
    fetchAllInvoiced()
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'incomplete') return
    const fetchIncomplete = async () => {
      setIncompleteLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('from', appliedDateFrom)
        params.set('to', appliedDateTo)
        const res = await fetch(`/api/audit/trips?${params.toString()}`)
        const result = await res.json()
        const allTrips = result.data || []
        const incomplete = allTrips.filter((r: any) =>
          r.status !== 'delivered' && r.status !== 'completed' && r.status !== 'breakdown'
        )
        setIncompleteRecords(incomplete)
      } catch (err) {
        console.error('Error fetching incomplete trips:', err)
      } finally {
        setIncompleteLoading(false)
      }
    }
    fetchIncomplete()
  }, [activeTab, appliedDateFrom, appliedDateTo])

  useEffect(() => {
    if (activeTab !== 'drafts') return
    const fetchDrafts = async () => {
      setDraftLoading(true)
      try {
        const res = await fetch('/api/invoices?draft=true')
        const result = await res.json()
        setDraftInvoices(result.data || [])
      } catch (err) {
        console.error('Error fetching drafts:', err)
      } finally {
        setDraftLoading(false)
      }
    }
    fetchDrafts()
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'invoices' && activeTab !== 'invoiced') return
    const fetchInvoices = async () => {
      setInvoicesLoading(true)
      try {
        const res = await fetch('/api/invoices?finalized=true')
        const result = await res.json()
        setFinalizedInvoices(result.data || [])
      } catch (err) {
        console.error('Error fetching invoices:', err)
      } finally {
        setInvoicesLoading(false)
      }
    }
    fetchInvoices()
  }, [activeTab])

  useEffect(() => {
    let next = records

    if (activeTab === 'trips') {
      // Trip Invoices: show ALL trips in range (not just delivered/completed)
      if (statusFilter !== 'all') {
        next = next.filter((record) => record.status === statusFilter)
      }
      next = next.filter((record) => !record.is_invoiced && !record.has_invoice_draft)
    } else {
      if (statusFilter !== 'all') {
        next = next.filter((record) => record.status === statusFilter)
      } else {
        next = next.filter((record) => record.status === 'delivered' || record.status === 'completed')
      }
    }

    if (searchTerm) {
      const query = searchTerm.toLowerCase()
      next = next.filter(
        (record) =>
          record.ordernumber?.toLowerCase().includes(query) ||
          record.origin?.toLowerCase().includes(query) ||
          record.destination?.toLowerCase().includes(query)
      )
    }

    setFilteredRecords(next)
  }, [records, statusFilter, invoicedFilter, searchTerm, activeTab])

  const filteredIncompleteRecords = useMemo(() => {
    if (!searchTerm) return incompleteRecords
    const query = searchTerm.toLowerCase()
    return incompleteRecords.filter(
      (record) =>
        record.ordernumber?.toLowerCase().includes(query) ||
        record.origin?.toLowerCase().includes(query) ||
        record.destination?.toLowerCase().includes(query)
    )
  }, [incompleteRecords, searchTerm])

  const summary = useMemo(() => {
    const totalTrips = filteredRecords.length
    const totalActualCost = filteredRecords.reduce((sum, record) => sum + toNumber(record.actual_total_cost), 0)
    const totalPlannedCost = filteredRecords.reduce((sum, record) => sum + toNumber(record.planned_total_cost), 0)
    const totalDistance = filteredRecords.reduce((sum, record) => sum + toNumber(record.planned_distance), 0)

    return {
      totalTrips,
      totalActualCost,
      totalPlannedCost,
      totalDistance,
    }
  }, [filteredRecords])

  const openDocuments = async (record: any) => {
    try {
      setSelectedDocumentRecord(record)
      setDocumentsOpen(true)
      setTripDocuments([])
      setDocumentsLoading(true)

      if (!record?.trip_row_id) return

      const { data, error } = await supabase
        .from('trip_documents')
        .select('id, trip_id, doc_type, file_path, created_at')
        .eq('trip_id', record.trip_row_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTripDocuments(data || [])
    } catch (error) {
      console.error('Error fetching trip documents:', error)
      setTripDocuments([])
    } finally {
      setDocumentsLoading(false)
    }
  }

  const downloadDocument = async (doc: any) => {
    const filePath = String(doc?.file_path || '').trim()
    if (!filePath) return
    setDownloadingId(doc.id)

    try {
      if (/^https?:\/\//i.test(filePath)) {
        window.open(filePath, '_blank')
        return
      }

      const parts = filePath.split('/').filter(Boolean)
      const candidates: Array<{ bucket: string; path: string }> = []
      if (parts.length > 1) {
        candidates.push({ bucket: parts[0], path: parts.slice(1).join('/') })
      }
      candidates.push(
        { bucket: 'trip-documents', path: filePath },
        { bucket: 'documents', path: filePath },
        { bucket: 'uploads', path: filePath }
      )

      for (const candidate of candidates) {
        const { data } = await supabase.storage.from(candidate.bucket).createSignedUrl(candidate.path, 60)
        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank')
          return
        }
      }

      window.open(filePath, '_blank')
    } catch (error) {
      console.error('Error downloading document:', error)
    } finally {
      setDownloadingId(null)
    }
  }

  const getDriverName = (record: any) => {
    try {
      const assignments = typeof record.vehicleassignments === 'string'
        ? JSON.parse(record.vehicleassignments)
        : record.vehicleassignments || []
      if (assignments.length > 0 && assignments[0].drivers?.length > 0) {
        const d = assignments[0].drivers[0]
        return [d.first_name, d.surname].filter(Boolean).join(' ') || d.name || '-'
      }
    } catch {}
    return record.driver || '-'
  }

  const getVehicleReg = (record: any) => {
    try {
      const assignments = typeof record.vehicleassignments === 'string'
        ? JSON.parse(record.vehicleassignments)
        : record.vehicleassignments || []
      if (assignments.length > 0 && assignments[0].vehicle?.name) {
        return assignments[0].vehicle.name
      }
    } catch {}
    return record.vehicle || '-'
  }

  const handleEditDraft = (draft: any) => {
    setEditDraftId(draft.id)
    setEditDraftData(draft)
    setEditModalMode('edit')
    setShowEditModal(true)
  }

  // Download invoice PDF. If the URL is missing (e.g. older draft whose PDF
  // was never uploaded), regenerate on-demand using the latest invoice data.
  const handleDownloadInvoice = async (inv: any) => {
    if (inv?.invoice_url) {
      window.open(inv.invoice_url, '_blank')
      return
    }
    if (!inv?.invoice_number) {
      alert('This invoice has no PDF yet — it is still a draft. Finalize first.')
      return
    }
    try {
      const { generateAndUploadInvoicePdf } = await import('@/lib/generate-invoice-pdf')
      const { pdfUrl } = await generateAndUploadInvoicePdf({
        invoiceNumber: inv.invoice_number,
        customerName: inv.customer_name || '',
        customerAddress: inv.customer_address || '',
        customerVat: inv.customer_vat || '',
        invoiceDate: inv.invoice_date || '',
        dueDate: inv.due_date || '',
        referenceNumber: inv.reference_number || '',
        salesCode: inv.sales_code || '200',
        currency: inv.currency || 'ZAR',
        lineItems: (inv.line_items || []).map((item: any) => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          vatType: item.vatType || 'zero',
          vehicle: item.vehicle || '',
          driver: item.driver || '',
        })),
        subtotal: Number(inv.subtotal) || 0,
        vatAmount: Number(inv.vat_amount) || 0,
        totalAmount: Number(inv.total_amount) || 0,
        amountDue: Number(inv.amount_due) || 0,
      })
      if (pdfUrl) {
        // Patch the row locally so subsequent downloads are instant
        const updateRow = (arr: any[]) =>
          arr.map((r: any) => (r.id === inv.id ? { ...r, invoice_url: pdfUrl } : r))
        setDraftInvoices((prev) => updateRow(prev))
        setFinalizedInvoices((prev) => updateRow(prev))
        // Persist to DB so it sticks across reloads
        await fetch(`/api/invoices/${inv.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_url: pdfUrl }),
        }).catch(() => {})
        window.open(pdfUrl, '_blank')
      } else {
        alert('Could not regenerate the PDF. Please try again.')
      }
    } catch (err: any) {
      alert(`Failed to regenerate PDF: ${err.message}`)
    }
  }

  // Send a single invoice to its configured email group (no per-recipient modal).
  // For multi-invoice sending with recipient pickers, use the Send Selected button.
  const handleSingleSend = async (invoice: any) => {
    if (!invoice?.invoice_number) {
      alert('This invoice is still a draft. Finalize it before sending.')
      return
    }
    const groups = invoice.invoice_email_groups || []
    const recipients: string[] = []
    for (const g of groups) {
      if (g.emails) recipients.push(...g.emails.filter((e: string) => e.trim()))
    }
    if (recipients.length === 0) {
      alert('No email groups configured for this client. Add groups in the Clients page.')
      return
    }
    if (!confirm(`Send invoice ${invoice.invoice_number} to ${recipients.length} recipient(s)?`)) return
    setSendingEmail(true)
    try {
      const res = await fetch('/api/invoices/batch-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perInvoiceRecipients: [{ id: invoice.id, recipients }],
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Send failed')
      const succeeded = (result.results || []).filter((r: any) => r.success).length
      alert(`Sent invoice ${invoice.invoice_number} to ${recipients.length} recipient(s).`)
    } catch (err: any) {
      alert(`Failed to send: ${err.message}`)
    } finally {
      setSendingEmail(false)
    }
  }

  const handleFinalizeDraft = async (draft: any) => {
    if (draft.is_locked) {
      alert('This invoice is locked and cannot be finalized.')
      return
    }
    setFinalizePreview(draft)
    setFinalizedInvoiceUrl(null)
    setShowFinalizePreview(true)

    // Fetch attached documents for this trip
    if (draft.trip_id) {
      setFinalizeDocsLoading(true)
      try {
        const res = await fetch(`/api/invoice-documents?trip_id=${draft.trip_id}`)
        const result = await res.json()
        setFinalizeDocs(result.data?.documents || [])
      } catch {
        setFinalizeDocs([])
      } finally {
        setFinalizeDocsLoading(false)
      }
    } else {
      setFinalizeDocs([])
    }

    // Fetch client's invoice email groups
    try {
      const clientName = draft.customer_name || ''
      if (clientName) {
        const res = await fetch('/api/eps-client-list')
        const result = await res.json()
        const clients = result.data || []
        // Normalize names: strip $, ($, ), whitespace, lowercase for comparison
        const normalize = (s: string) => (s || '').replace(/^\(\$\)\s*/, '').replace(/^\$\s*/, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
        const targetNorm = normalize(clientName)
        const matchedClient = clients.find((c: any) => {
          const cNameNorm = normalize(c.name)
          const cClientIdNorm = normalize(c.client_id)
          return cNameNorm === targetNorm || cClientIdNorm === targetNorm
        })
        if (matchedClient?.invoice_email_groups?.length) {
          setFinalizePreview((prev: any) => ({ ...prev, invoice_email_groups: matchedClient.invoice_email_groups }))
          setSendEmailGroups([...matchedClient.invoice_email_groups])
        } else {
          console.warn('No client matched for invoice email groups. customer_name:', clientName, 'normalized:', targetNorm)
        }
      }
    } catch (err) {
      console.error('Failed to fetch client invoice email groups:', err)
    }
  }

  const confirmFinalize = async () => {
    if (!finalizePreview) return
    setFinalizing(true)
    try {
      const res = await fetch(`/api/invoices/${finalizePreview.id}/finalize`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to finalize')
      }
      const result = await res.json()
      const invoiceNumber = result.invoiceNumber

      const { generateAndUploadInvoicePdf } = await import('@/lib/generate-invoice-pdf')
      const { pdfUrl } = await generateAndUploadInvoicePdf({
        invoiceNumber,
        customerName: finalizePreview.customer_name || '',
        customerAddress: finalizePreview.customer_address || '',
        customerVat: finalizePreview.customer_vat || '',
        invoiceDate: finalizePreview.invoice_date || '',
        dueDate: finalizePreview.due_date || '',
        referenceNumber: finalizePreview.reference_number || '',
        salesCode: finalizePreview.sales_code || '200',
        currency: finalizePreview.currency || 'ZAR',
        lineItems: (finalizePreview.line_items || []).map((item: any) => ({
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          vatType: item.vatType || 'zero',
          vehicle: item.vehicle || '',
          driver: item.driver || '',
        })),
        subtotal: Number(finalizePreview.subtotal) || 0,
        vatAmount: Number(finalizePreview.vat_amount) || 0,
        totalAmount: Number(finalizePreview.total_amount) || 0,
        amountDue: Number(finalizePreview.amount_due) || 0,
      })

      if (pdfUrl) {
        await fetch(`/api/invoices/${finalizePreview.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_url: pdfUrl }),
        })
      }

      const updatedInvoice = {
        ...finalizePreview,
        invoice_number: invoiceNumber,
        invoice_url: pdfUrl,
        is_draft: false,
      }
      setFinalizePreview(updatedInvoice)
      setFinalizedInvoiceUrl(pdfUrl)

      fetch('/api/invoices?draft=true').then(r => r.json()).then(result => setDraftInvoices(result.data || []))
      fetch('/api/invoices?finalized=true').then(r => r.json()).then(result => setFinalizedInvoices(result.data || []))

      if (sendEmailGroups.length > 0 && pdfUrl) {
        await sendInvoiceEmail(updatedInvoice, sendEmailGroups)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setFinalizing(false)
    }
  }

  const sendInvoiceEmail = async (invoice: any, selectedGroups: any[]) => {
    if (!selectedGroups.length || !invoice.invoice_url) {
      alert('No email groups selected or no invoice PDF available.')
      return
    }
    setSendingEmail(true)
    try {
      const recipients = []
      for (const group of selectedGroups) {
        if (group.emails) {
          recipients.push(...group.emails.filter((e: string) => e.trim()))
        }
      }
      if (recipients.length === 0) {
        alert('No valid email addresses in selected groups.')
        return
      }

      let origin = ''
      let destination = ''
      if (invoice.trip_id) {
        try {
          const tripRes = await fetch(`/api/trips/${invoice.trip_id}`)
          const tripResult = await tripRes.json()
          if (tripResult.data) {
            origin = tripResult.data.origin || ''
            destination = tripResult.data.destination || ''
          }
        } catch { /* fallback to empty */ }
      }

      const { buildInvoiceEmailHtml } = await import('@/lib/invoice-email-template')
      const html = buildInvoiceEmailHtml({
        orderNumber: invoice.ordernumber || invoice.trip_id || '',
        origin,
        destination,
        customerName: invoice.customer_name || '',
        customerAddress: invoice.customer_address || '',
        amount: toNumber(invoice.total_amount || invoice.amount_due).toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
        currency: invoice.currency || 'ZAR',
        invoiceDate: invoice.invoice_date || '',
        invoicePdfUrl: invoice.invoice_url || '',
      })

      const subject = `Invoice ${invoice.invoice_number || ''} - Waterford Carriers`

      // Build attachments list - include invoice PDF and PODs (Proof of Delivery)
      const attachments: { filename: string; path: string }[] = [
        {
          filename: `${invoice.invoice_number || 'invoice'}.pdf`,
          path: invoice.invoice_url || '',
        },
      ]

      // Fetch PODs from invoice_documents
      try {
        const docQueryParam = invoice.trip_id
          ? `trip_id=${invoice.trip_id}`
          : `sundry_invoice_id=${invoice.id}`
        const docsRes = await fetch(`/api/invoice-documents?${docQueryParam}`)
        const docsResult = await docsRes.json()
        const docs = docsResult.data?.documents || []
        for (const doc of docs) {
          if (doc.file_url && doc.file_name) {
            attachments.push({
              filename: doc.file_name,
              path: doc.file_url,
            })
          }
        }
      } catch {
        // PODs are optional; proceed without them if fetch fails
      }

      const res = await fetch('/api/send-invoice-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, subject, html, attachments }),
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to send email')
      }

      alert(`Invoice email sent to ${recipients.length} recipient(s)!`)
    } catch (err: any) {
      console.error('Send invoice email error:', err)
      alert(`Failed to send email: ${err.message}`)
    } finally {
      setSendingEmail(false)
    }
  }

  const exportTrips = async () => {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Waterford Carriers'
    wb.created = new Date()

    const ws = wb.addWorksheet('Trips Export', {
      views: [{ state: 'frozen', ySplit: 2 }],
    })

    ws.columns = [
      { header: 'Order Number', key: 'ordernumber', width: 16 },
      { header: 'Client', key: 'client', width: 32 },
      { header: 'Vehicle', key: 'vehicle', width: 16 },
      { header: 'Driver', key: 'driver', width: 22 },
      { header: 'Loadcon', key: 'loadcon', width: 20 },
      { header: 'Origin', key: 'origin', width: 26 },
      { header: 'Destination', key: 'destination', width: 26 },
      { header: 'Cargo', key: 'cargo', width: 16 },
      { header: 'Rate', key: 'rate', width: 14 },
    ]

    const titleRow = ws.insertRow(1, [`Trips Export — ${dateFrom} to ${dateTo}`])
    ws.mergeCells('A1:I1')
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF001E42' } }
    titleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    titleRow.height = 30

    const headerRow = ws.getRow(2)
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF001E42' } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF001E42' } },
      }
    })
    headerRow.height = 24

    const colLengths: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0]

    filteredRecords.forEach((r, idx) => {
      const orderNum = r.ordernumber || ''
      const clientName = getClientName(r)
      const vehicleReg = getVehicleReg(r)
      const driverName = getDriverName(r)
      const origin = r.origin || ''
      const destination = r.destination || ''
      const cargo = r.cargo || ''
      const rate = r.rate || ''

      const rowData = [orderNum, clientName, vehicleReg, driverName, '', origin, destination, cargo, rate]
      const row = ws.addRow(rowData)

      if (r.loadcon_url) {
        const loadconCell = row.getCell(5)
        loadconCell.value = { text: `${orderNum}-Loadcon`, hyperlink: r.loadcon_url }
        loadconCell.font = { size: 10, color: { argb: 'FF2563EB' }, underline: true }
      }

      const isEven = idx % 2 === 0
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' },
        }
        if (colNumber !== 5 || !r.loadcon_url) {
          cell.font = { size: 10, color: { argb: 'FF334155' } }
        }
        cell.alignment = { vertical: 'middle', wrapText: true }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }

        const val = String(cell.value || '')
        if (val.length > (colLengths[colNumber - 1] || 0)) {
          colLengths[colNumber - 1] = val.length
        }
      })
      row.height = 22
    })

    const colWidths = colLengths.map((len) => Math.max(len + 4, 12))
    ws.columns.forEach((col, i) => { col.width = colWidths[i] || 14 })

    const totalRow = ws.addRow(['', '', '', '', '', '', '', 'TOTAL', `${filteredRecords.length} trips`])
    totalRow.getCell(8).font = { bold: true, size: 10, color: { argb: 'FF001E42' } }
    totalRow.getCell(9).font = { bold: true, size: 10, color: { argb: 'FF001E42' } }
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: 'medium', color: { argb: 'FF001E42' } } }
    })

    ws.autoFilter = { from: 'A2', to: 'I2' }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trips-export-${dateFrom}-to-${dateTo}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-lg">Loading audit records...</div>
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Audit Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTrips}</div>
            <p className="text-xs text-muted-foreground">Delivered and completed trips in audit scope.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planned Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currency(summary.totalPlannedCost)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currency(summary.totalActualCost)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDistance.toLocaleString('en-ZA')} km</div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-fit">
        <button
          onClick={() => setActiveTab('trips')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'trips' ? 'bg-[#001e42] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Trip Invoices
        </button>
        <button
          onClick={() => setActiveTab('incomplete')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'incomplete' ? 'bg-[#001e42] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Incomplete Trips
        </button>
        <button
          onClick={() => setActiveTab('drafts')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'drafts' ? 'bg-[#001e42] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Drafts
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'invoices' ? 'bg-[#001e42] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'reports' ? 'bg-[#001e42] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Trip Reports
        </button>
      </div>

      {activeTab === 'trips' && (
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#001e42]">Trip Invoices</h3>
            <Button onClick={() => setShowSundryModal(true)} className="bg-[#001e42] text-white hover:bg-[#0b2955]">
              <Plus className="mr-2 h-4 w-4" /> New Sundry Invoice
            </Button>
          </div>
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center">
            <Input
              placeholder="Search by trip, order, origin, or destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:max-w-sm"
            />
            <div className="ml-auto flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
              <span className="text-sm text-slate-500">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
              <Button onClick={handleSearch} className="bg-[#001e42] text-white hover:bg-[#0b2955]">
                Search
              </Button>
              <Button onClick={exportTrips} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Trip</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Client</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Cargo</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Route</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Vehicle</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Driver</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Created</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{record.ordernumber || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{getClientName(record)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{record.cargo || 'N/A'}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      <div className="max-w-xs">
                        <div className="truncate">{record.origin || 'N/A'}</div>
                        <div className="truncate text-xs text-slate-500">→ {record.destination || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{getVehicleReg(record)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{getDriverName(record)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{record.created_at ? new Date(record.created_at).toLocaleDateString('en-ZA') : '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {record.is_invoiced ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] px-2 py-0.5">Invoiced</Badge>
                          {record.invoice_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              onClick={() => window.open(record.invoice_url, '_blank')}
                              title="Download Invoice"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-slate-400">Pending</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => router.push(`/audit/${record.trip_id}`)}>
                          View
                        </Button>
                        <SecureButton
                          page="financials"
                          action="view"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => router.push(`/audit/${record.trip_id}?tab=route`)}
                        >
                          <Route className="h-3 w-3" />
                        </SecureButton>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => openDocuments(record)}>
                          <Paperclip className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No audit records found matching your filters.</div>
          ) : null}
        </CardContent>
      </Card>
      )}

      {activeTab === 'incomplete' && (
      <Card>
        <CardContent className="pt-6">
          {incompleteLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading incomplete trips...</div>
          ) : (
          <>
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center">
            <Input
              placeholder="Search by trip, order, origin, or destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:max-w-sm"
            />
            <div className="ml-auto flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
              <span className="text-sm text-slate-500">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
              <Button onClick={handleSearch} className="bg-[#001e42] text-white hover:bg-[#0b2955]">
                Search
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Trip</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Client</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Route</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncompleteRecords.map((record) => (
                  <tr key={record.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{record.ordernumber || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{getClientName(record)}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-2 py-0.5">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {record.status || 'incomplete'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      <div className="max-w-xs">
                        <div className="truncate">{record.origin || 'N/A'}</div>
                        <div className="truncate text-xs text-slate-500">→ {record.destination || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {record.is_invoiced ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] px-2 py-0.5">Invoiced</Badge>
                          {record.invoice_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              onClick={() => window.open(record.invoice_url, '_blank')}
                              title="Download Invoice"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-slate-400">Pending</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        disabled={record.is_invoiced}
                        onClick={() => router.push(`/audit/${record.trip_id}`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredIncompleteRecords.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">No incomplete trips found.</div>
          )}
          </>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === 'invoiced' && (
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#001e42]">All Invoiced</h3>
          </div>

          {/* Invoiced Trip Invoices */}
          <div className="mb-6">
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Trip Invoices</h4>
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading...</div>
            ) : (
              (() => {
                const invoicedTrips = records.filter((r: any) => r.is_invoiced && (r.status === 'delivered' || r.status === 'completed'))
                const searched = searchTerm
                  ? invoicedTrips.filter((r: any) => {
                      const q = searchTerm.toLowerCase()
                      return r.ordernumber?.toLowerCase().includes(q) || r.origin?.toLowerCase().includes(q) || r.destination?.toLowerCase().includes(q)
                    })
                  : invoicedTrips
                if (searched.length === 0) return <div className="py-4 text-center text-sm text-slate-500">No invoiced trips found.</div>
                return (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full border-collapse text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Trip</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Client</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Cargo</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Route</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Planned</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actual</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice #</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searched.map((record) => (
                          <tr key={record.id} className="border-t hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{record.ordernumber || '—'}</div>
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-700">{getClientName(record)}</td>
                            <td className="px-3 py-2 text-sm text-slate-700">{record.cargo || '—'}</td>
                            <td className="px-3 py-2 text-sm text-slate-700">
                              <div className="max-w-xs">
                                <div className="truncate">{record.origin || 'N/A'}</div>
                                <div className="truncate text-xs text-slate-500">→ {record.destination || 'N/A'}</div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-slate-700">{currency(toNumber(record.planned_total_cost))}</td>
                            <td className="px-3 py-2 text-right text-sm text-slate-700">{currency(toNumber(record.actual_total_cost))}</td>
                            <td className="px-3 py-2 text-sm text-slate-700 font-medium">{record.invoice_number || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] px-2 py-0.5">Invoiced</Badge>
                                {record.invoice_url && (
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50" onClick={() => window.open(record.invoice_url, '_blank')} title="Download Invoice">
                                    <FileText className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => router.push(`/audit/${record.trip_id}`)}>
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {activeTab === 'drafts' && (
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#001e42]">Invoice Drafts</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  placeholder="Search invoices..."
                  className="pl-9 w-60"
                />
              </div>
              {selectedDraftIds.size > 0 && (
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={handleBatchFinalize}
                  disabled={batchFinalizing}
                >
                  {batchFinalizing ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Finalizing...</>
                  ) : (
                    `Finalize Selected (${selectedDraftIds.size})`
                  )}
                </Button>
              )}
            </div>
          </div>

          {draftLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading drafts...</div>
          ) : draftInvoices.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No drafts found.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 w-10">
                      <input
                        type="checkbox"
                        checked={selectedDraftIds.size === draftInvoices.length && draftInvoices.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDraftIds(new Set(draftInvoices.map((inv: any) => inv.id)))
                          } else {
                            setSelectedDraftIds(new Set())
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice #</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Order</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Reference</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Currency</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {draftInvoices.filter((inv: any) => {
                    if (!draftSearch.trim()) return true
                    const needle = draftSearch.trim().toLowerCase()
                    return [inv.invoice_number?.toString(), inv.ordernumber, inv.trip_id?.toString(), inv.customer_name, inv.reference_number]
                      .filter(Boolean).join(' ').toLowerCase().includes(needle)
                  }).map((inv: any) => (
                    <tr key={inv.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedDraftIds.has(inv.id)}
                          onChange={(e) => {
                            const next = new Set(selectedDraftIds)
                            if (e.target.checked) next.add(inv.id)
                            else next.delete(inv.id)
                            setSelectedDraftIds(next)
                          }}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{inv.invoice_number || '—'}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-sm text-slate-700">{inv.ordernumber || inv.trip_id || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{inv.customer_name || '-'}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{inv.reference_number || '-'}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{inv.invoice_date || '-'}</td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">
                        {inv.currency === 'USD' ? '$' : 'R'}{toNumber(inv.total_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5">{inv.currency}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleDownloadInvoice(inv)}>
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleEditDraft(inv)}>
                            Edit
                          </Button>
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#001e42] text-white hover:bg-[#0b2955]" onClick={() => handleFinalizeDraft(inv)}>
                            Finalize
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === 'invoices' && (
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#001e42]">Finalized Invoices</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Search invoices..."
                  className="pl-9 w-60"
                />
              </div>
              {selectedInvoiceIds.size > 0 && (
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={openSendModal}
                  disabled={batchSending}
                >
                  {batchSending ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Sending...</>
                  ) : (
                    <><Mail className="mr-1 h-3 w-3" /> Send Selected ({selectedInvoiceIds.size})</>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportRangeOpen(true)}
              >
                <Download className="mr-1 h-3 w-3" /> Export to Excel
              </Button>
              <Input
                type="month"
                value={lockMonth}
                onChange={(e) => setLockMonth(e.target.value)}
                className="w-40"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!lockMonth) return
                  if (!confirm(`Lock all invoices for ${lockMonth}? This cannot be undone.`)) return
                  try {
                    const res = await fetch('/api/invoices/lock', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ month: lockMonth }),
                    })
                    if (!res.ok) {
                      const err = await res.json()
                      throw new Error(err.error || 'Failed to lock')
                    }
                    const result = await res.json()
                    alert(`Locked ${result.lockedCount} invoices for ${lockMonth}`)
                    const invRes = await fetch('/api/invoices?finalized=true')
                    const invResult = await invRes.json()
                    setFinalizedInvoices(invResult.data || [])
                  } catch (err: any) {
                    alert(err.message)
                  }
                }}
              >
                Lock Month
              </Button>
            </div>
          </div>

          {invoicesLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading invoices...</div>
          ) : finalizedInvoices.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No invoices found.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 w-10">
                      <input
                        type="checkbox"
                        checked={finalizedInvoices.length > 0 && finalizedInvoices.every((inv: any) => selectedInvoiceIds.has(inv.id))}
                        onChange={(e) => {
                          const next = new Set(selectedInvoiceIds)
                          if (e.target.checked) finalizedInvoices.forEach((inv: any) => next.add(inv.id))
                          else finalizedInvoices.forEach((inv: any) => next.delete(inv.id))
                          setSelectedInvoiceIds(next)
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice #</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Order</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Reference</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Currency</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {finalizedInvoices
                    .filter((inv: any) => {
                      if (!invoiceSearch.trim()) return true
                      const needle = invoiceSearch.trim().toLowerCase()
                      return [inv.invoice_number?.toString(), inv.ordernumber, inv.trip_id?.toString(), inv.customer_name, inv.reference_number]
                        .filter(Boolean).join(' ').toLowerCase().includes(needle)
                    })
                    .slice()
                    .sort((a: any, b: any) => (a.invoice_number || 0) - (b.invoice_number || 0))
                    .reduce((groups: any[], inv: any) => {
                      const customer = inv.customer_name || 'Unknown'
                      const lastGroup = groups[groups.length - 1]
                      if (lastGroup && lastGroup.customer === customer) {
                        lastGroup.invoices.push(inv)
                      } else {
                        groups.push({ customer, invoices: [inv] })
                      }
                      return groups
                    }, [])
                    .flatMap((group: any) => [
                      <tr key={`group-${group.customer}`} className="bg-slate-100 border-t">
                        <td colSpan={10} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                          {group.customer}
                        </td>
                      </tr>,
                      ...group.invoices.map((inv: any) => (
                        <tr key={inv.id} className="border-t hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedInvoiceIds.has(inv.id)}
                              onChange={(e) => {
                                const next = new Set(selectedInvoiceIds)
                                if (e.target.checked) next.add(inv.id)
                                else next.delete(inv.id)
                                setSelectedInvoiceIds(next)
                              }}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-900">{inv.invoice_number || '—'}</div>
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-700">{inv.ordernumber || inv.trip_id || '—'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">{inv.customer_name || '-'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">{inv.reference_number || '-'}</td>
                          <td className="px-3 py-2 text-sm text-slate-700">{inv.invoice_date || '-'}</td>
                          <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">
                            {inv.currency === 'USD' ? '$' : 'R'}{toNumber(inv.total_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">{inv.currency}</Badge>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {inv.is_locked ? (
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] px-2 py-0.5">Locked</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] px-2 py-0.5">Finalized</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              {inv.invoice_url && (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => window.open(inv.invoice_url, '_blank')}>
                                    <FileText className="mr-1 h-3 w-3" /> View
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => window.open(inv.invoice_url, '_blank')}>
                                    <Download className="mr-1 h-3 w-3" /> Download
                                  </Button>
                                </>
                              )}
                              {!inv.is_locked && (
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleEditDraft(inv)}>
                                  Edit
                                </Button>
                              )}
                              {inv.invoice_email_groups?.length > 0 && (
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                                  disabled={sendingEmail}
                                  onClick={() => handleSingleSend(inv)}
                                  title="Send this invoice to the client's email group"
                                >
                                  <Mail className="mr-1 h-3 w-3" /> Send
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => loadAuditLog(inv.id)}>
                                History
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ])}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {activeTab === 'reports' && (
        <Card>
          <CardContent className="pt-6">
            <TripReportsSection cancelledOnly />
          </CardContent>
        </Card>
      )}

      <SundryInvoiceModal open={showSundryModal} onClose={() => {
        setShowSundryModal(false)
        fetch('/api/invoices?draft=true').then(r => r.json()).then(result => setDraftInvoices(result.data || []))
        fetch('/api/invoices?finalized=true').then(r => r.json()).then(result => setFinalizedInvoices(result.data || []))
      }} />

      {/* Edit Draft Modal */}
      {showEditModal && editDraftData && (
        <GenerateInvoiceModal
          open={showEditModal}
          onClose={async (finalizedInvoiceUrl?: string) => {
            const wasFinalize = editModalMode === 'finalize'
            const finalizedInvoice = wasFinalize && editDraftId ? { ...editDraftData, id: editDraftId, invoice_url: finalizedInvoiceUrl || editDraftData.invoice_url } : null
            setShowEditModal(false)
            setEditDraftId(null)
            setEditDraftData(null)
            setEditModalMode('edit')
            fetch('/api/invoices?draft=true').then(r => r.json()).then(result => setDraftInvoices(result.data || []))
            fetch('/api/invoices?finalized=true').then(r => r.json()).then(result => setFinalizedInvoices(result.data || []))
            if (wasFinalize && finalizedInvoice && sendEmailGroups.length > 0) {
              await sendInvoiceEmail(finalizedInvoice, sendEmailGroups)
            }
          }}
          record={editDraftData}
          invoiceRate={toNumber(editDraftData.invoice_rate || editDraftData.total_amount)}
          invoiceCurrency={editDraftData.currency || 'ZAR'}
          splitRows={[]}
          calcSplitTotal={() => 0}
          mode={editModalMode}
          draftId={editDraftId || undefined}
          draftData={editDraftData}
        />
      )}

      {/* Finalize Preview Modal */}
      <Dialog open={showFinalizePreview} onOpenChange={setShowFinalizePreview}>
        <DialogContent className="!max-w-[90vw] !h-[90vh] flex flex-col p-0">
          <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
            <DialogHeader>
              <DialogTitle>Finalize Invoice</DialogTitle>
              <DialogDescription>
                {finalizedInvoiceUrl 
                  ? 'Invoice finalized and email sent. You can download the invoice below.'
                  : 'Review the invoice details before finalizing. An invoice number will be generated and cannot be changed.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          {finalizePreview && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Base Info */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Date</label>
                  <p className="text-sm text-slate-900">{finalizePreview.invoice_date || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Due Date</label>
                  <p className="text-sm text-slate-900">{finalizePreview.due_date || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Number</label>
                  <p className="text-sm text-slate-900">{finalizePreview.invoice_number || 'To be generated'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer Name</label>
                  <p className="text-sm text-slate-900">{finalizePreview.customer_name || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer Address</label>
                  <p className="text-sm text-slate-900">{finalizePreview.customer_address || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer VAT</label>
                  <p className="text-sm text-slate-900">{finalizePreview.customer_vat || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reference Number</label>
                  <p className="text-sm text-slate-900">{finalizePreview.reference_number || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sales Code</label>
                  <p className="text-sm text-slate-900">{finalizePreview.sales_code || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Currency</label>
                  <p className="text-sm text-slate-900">{finalizePreview.currency || 'ZAR'}</p>
                </div>
              </div>

              {/* Line Items */}
              {finalizePreview.line_items?.length > 0 && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Line Items</label>
                  <div className="mt-1 overflow-x-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold">Description</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold">Qty</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold">Unit Price</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold">VAT Type</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finalizePreview.line_items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">{item.unitPrice}</td>
                            <td className="px-3 py-2 text-right">{item.vatType || 'zero'}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              {finalizePreview.currency === 'USD' ? '$' : 'R'}{((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="flex justify-end">
                <div className="w-80 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-medium">
                      {finalizePreview.currency === 'USD' ? '$' : 'R'}{toNumber(finalizePreview.subtotal).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">TOTAL VAT</span>
                    <span className="font-medium">
                      {finalizePreview.currency === 'USD' ? '$' : 'R'}{toNumber(finalizePreview.vat_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">TOTAL {finalizePreview.currency || 'ZAR'}</span>
                      <span className="text-lg font-bold">
                        {finalizePreview.currency === 'USD' ? '$' : 'R'}{toNumber(finalizePreview.total_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-[#001e42]">AMOUNT DUE {finalizePreview.currency || 'ZAR'}</span>
                      <span className="text-lg font-bold text-[#001e42]">
                        {finalizePreview.currency === 'USD' ? '$' : 'R'}{toNumber(finalizePreview.amount_due).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attached Documents */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Attached Documents</label>
                {finalizeDocsLoading ? (
                  <p className="mt-1 text-sm text-slate-500">Loading documents...</p>
                ) : finalizeDocs.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">No documents attached to this trip.</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {finalizeDocs.map((doc: any, idx: number) => {
                      const docUrl = doc.file_url || (doc.file_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoice-documents/${doc.file_path}` : null)
                      return (
                        <div key={idx} className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span className="flex-1 truncate text-sm text-slate-700">{doc.file_name || doc.fileName || 'Document'}</span>
                          {docUrl && (
                            <a
                              href={docUrl}
                              download={doc.file_name || doc.fileName || 'document'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-slate-200"
                            >
                              <Download className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Email Recipients */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Email Recipients</label>
                {finalizedInvoiceUrl && (
                  <p className="text-[10px] text-emerald-600 mb-2">Email has been sent to the selected recipients.</p>
                )}
                {!finalizedInvoiceUrl && (
                  <p className="text-[10px] text-slate-400 mb-2">
                    {finalizePreview.invoice_email_groups?.length > 0
                      ? 'Select groups and edit recipients before sending.'
                      : 'No email groups configured for this client. You can add groups in the Clients page.'}
                  </p>
                )}
                  {finalizePreview.invoice_email_groups?.length > 0 && (
                    <div className="space-y-3">
                      {finalizePreview.invoice_email_groups.map((group: any, gIdx: number) => (
                        <div key={gIdx} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSendEmailGroups((prev) => [...prev, group])
                                } else {
                                  setSendEmailGroups((prev) => prev.filter((g) => g.name !== group.name))
                                }
                              }}
                            />
                            <span className="text-sm font-medium text-slate-900">{group.name}</span>
                            <span className="text-[10px] text-slate-500">({group.emails?.length || 0} email{group.emails?.length !== 1 ? 's' : ''})</span>
                          </div>
                          <div className="space-y-1.5 pl-6">
                            {(group.emails || []).map((email: string, eIdx: number) => (
                              <div key={eIdx} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  defaultChecked
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  onChange={(e) => {
                                    const fullEmail = email.trim()
                                    if (e.target.checked) {
                                      setSendEmailGroups((prev) => {
                                        const existing = prev.find((g) => g.name === group.name)
                                        if (existing) {
                                          if (!existing.emails.includes(fullEmail)) {
                                            return prev.map((g) => g.name === group.name ? { ...g, emails: [...g.emails, fullEmail] } : g)
                                          }
                                          return prev
                                        }
                                        return [...prev, { ...group, emails: [fullEmail] }]
                                      })
                                    } else {
                                      setSendEmailGroups((prev) => {
                                        return prev.map((g) => g.name === group.name ? { ...g, emails: g.emails.filter((em: string) => em !== fullEmail) } : g).filter((g) => g.emails.length > 0)
                                      })
                                    }
                                  }}
                                />
                                <input
                                  type="email"
                                  defaultValue={email}
                                  className="flex-1 h-7 text-xs px-2 rounded border border-slate-300 bg-white"
                                  onChange={(e) => {
                                    const oldEmail = email.trim()
                                    const newEmail = e.target.value.trim()
                                    if (oldEmail === newEmail) return
                                    // Update the group's emails in finalizePreview
                                    setFinalizePreview((prev: any) => ({
                                      ...prev,
                                      invoice_email_groups: prev.invoice_email_groups.map((g: any) =>
                                        g.name === group.name
                                          ? { ...g, emails: g.emails.map((em: string) => em === oldEmail ? newEmail : em) }
                                          : g
                                      ),
                                    }))
                                    // Also update sendEmailGroups if this email is selected
                                    setSendEmailGroups((prev) =>
                                      prev.map((g) => g.name === group.name
                                        ? { ...g, emails: g.emails.map((em: string) => em === oldEmail ? newEmail : em) }
                                        : g
                                      )
                                    )
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-2">
                {finalizedInvoiceUrl ? (
                  <>
                    <Button variant="outline" onClick={() => {
                      setShowFinalizePreview(false)
                      setFinalizePreview(null)
                      setFinalizedInvoiceUrl(null)
                    }}>
                      Close
                    </Button>
                    {sendEmailGroups.length > 0 && (
                      <Button
                        className="bg-emerald-700 text-white hover:bg-emerald-800"
                        disabled={sendingEmail}
                        onClick={() => sendInvoiceEmail(finalizePreview, sendEmailGroups)}
                      >
                        {sendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                        {sendingEmail ? 'Sending...' : 'Send Again'}
                      </Button>
                    )}
                    <Button
                      className="bg-[#001e42] text-white hover:bg-[#0b2955]"
                      onClick={() => window.open(finalizedInvoiceUrl, '_blank')}
                    >
                      <Download className="mr-2 h-4 w-4" /> Download Invoice
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setShowFinalizePreview(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#001e42] text-white hover:bg-[#0b2955]"
                      onClick={confirmFinalize}
                      disabled={finalizing}
                    >
                      {finalizing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing...</>
                      ) : (
                        'Confirm & Generate Invoice'
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={documentsOpen} onOpenChange={setDocumentsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Trip Documents</DialogTitle>
            <DialogDescription>
              {selectedDocumentRecord?.ordernumber
                ? `Files attached to ${selectedDocumentRecord.ordernumber}`
                : 'Files attached to this record'}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border">
            <div className="grid grid-cols-12 gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-semibold">
              <div className="col-span-3">Type</div>
              <div className="col-span-5">File Path</div>
              <div className="col-span-2">Created</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            <ScrollArea className="h-[380px]">
              {documentsLoading ? (
                <div className="p-4 text-sm text-slate-600">Loading documents...</div>
              ) : tripDocuments.length === 0 ? (
                <div className="p-4 text-sm text-slate-600">No documents attached to this trip.</div>
              ) : (
                <div className="divide-y">
                  {tripDocuments.map((doc) => (
                    <div key={doc.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-sm">
                      <div className="col-span-3">
                        <Badge variant="secondary">{doc.doc_type || 'document'}</Badge>
                      </div>
                      <div className="col-span-5 truncate" title={doc.file_path}>{doc.file_path}</div>
                      <div className="col-span-2 text-xs text-slate-500">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-ZA') : 'N/A'}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          disabled={downloadingId === doc.id}
                          onClick={() => downloadDocument(doc)}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          {downloadingId === doc.id ? '...' : 'Download'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Dialog — uses Radix Dialog primitives directly so we can size
          the panel independently of the global DialogContent constraints (95vw). */}
      <DialogPrimitive.Root open={auditLogOpen} onOpenChange={setAuditLogOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              'fixed left-[50%] top-[50%] z-50 flex max-h-[95vh] w-[95vw] translate-x-[-50%] translate-y-[-50%] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-8 py-5">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-2xl font-bold text-[#001e42]">
                  Invoice Change History
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-base text-slate-500">
                  Audit trail for invoice {auditLogInvoiceId ? `#${auditLogInvoiceId}` : ''}
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>

            <div className="flex-1 overflow-hidden p-6">
              <div className="h-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                {auditLogLoading ? (
                  <div className="p-6 text-base text-slate-600">Loading history...</div>
                ) : auditLogData.length === 0 ? (
                  <div className="p-6 text-base text-slate-600">No changes recorded for this invoice.</div>
                ) : (
                  <div className="h-full divide-y overflow-y-auto">
                    {auditLogData.map((entry: any) => {
                      const fieldLabel = entry.field_changed ? (FIELD_LABELS[entry.field_changed] || entry.field_changed) : ''
                      const oldFormatted = formatAuditValue(entry.old_value, entry.field_changed)
                      const newFormatted = formatAuditValue(entry.new_value, entry.field_changed)
                      return (
                        <div key={entry.id} className="space-y-4 px-7 py-6">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wide">
                                {entry.action}
                              </Badge>
                              {fieldLabel && (
                                <span className="text-xl font-semibold text-slate-800">{fieldLabel}</span>
                              )}
                            </div>
                            <span className="shrink-0 text-sm text-slate-500">
                              {entry.changed_at ? new Date(entry.changed_at).toLocaleString('en-ZA') : ''}
                            </span>
                          </div>
                          {fieldLabel && (
                            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
                              {oldFormatted && (
                                <div className="flex items-start gap-4">
                                  <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wider text-red-600">
                                    From
                                  </span>
                                  <span className="min-w-0 flex-1 break-words whitespace-pre-wrap rounded bg-white px-3 py-2 text-sm text-red-700 line-through">
                                    {oldFormatted}
                                  </span>
                                </div>
                              )}
                              {newFormatted && (
                                <div className="flex items-start gap-4">
                                  <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wider text-emerald-600">
                                    To
                                  </span>
                                  <span className="min-w-0 flex-1 break-words whitespace-pre-wrap rounded bg-white px-3 py-2 text-sm text-emerald-700">
                                    {newFormatted}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="text-sm text-slate-500">
                            Changed by <span className="font-semibold text-slate-700">{entry.changed_by}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-8 py-4">
              <DialogPrimitive.Close asChild>
                <Button variant="outline">Close</Button>
              </DialogPrimitive.Close>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Per-client Send Modal — confirms which email recipients each invoice goes to. */}
      <DialogPrimitive.Root open={sendModalOpen} onOpenChange={(open) => { if (!open) closeSendModal() }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className={cn(
              'fixed left-[50%] top-[50%] z-50 flex max-h-[95vh] w-[95vw] translate-x-[-50%] translate-y-[-50%] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-8 py-5">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-2xl font-bold text-[#001e42]">
                  Send Invoices to Clients
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-base text-slate-500">
                  Review the email groups for each invoice and pick which recipients should receive it.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>

            <div className="flex-1 overflow-hidden p-6">
              <div className="h-full space-y-4 overflow-y-auto pr-1">
                {finalizedInvoices
                  .filter((inv: any) => selectedInvoiceIds.has(inv.id))
                  .map((inv: any) => {
                    const groups = inv.invoice_email_groups || []
                    const allEmails = new Set<string>()
                    for (const g of groups) {
                      for (const e of (g.emails || []).filter((e: string) => e.trim())) {
                        allEmails.add(e.trim())
                      }
                    }
                    const selectedForInv = sendRecipients[inv.id] || new Set<string>()
                    const totalForInv = allEmails.size
                    const totalSelected = selectedForInv.size
                    const allSelected = totalForInv > 0 && totalSelected === totalForInv
                    const noGroups = groups.length === 0
                    return (
                      <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-5">
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                {inv.invoice_number || `INV#${inv.id}`}
                              </Badge>
                              <span className="text-base font-semibold text-slate-900 truncate">
                                {inv.customer_name || '(no customer)'}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {inv.ordernumber || inv.trip_id || 'Sundry'} ·{' '}
                              {inv.currency === 'USD' ? '$' : 'R'}
                              {toNumber(inv.total_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                              {' '}· {totalSelected}/{totalForInv} recipient(s) selected
                            </div>
                          </div>
                          {!noGroups && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAllForInvoice(inv.id, groups)}
                            >
                              {allSelected ? 'Deselect all' : 'Select all'}
                            </Button>
                          )}
                        </div>

                        {noGroups ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            No invoice email groups configured for this client. Add groups in the Clients page.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {groups.map((group: any, gIdx: number) => {
                              const groupName = group.name || `Group ${gIdx + 1}`
                              const emails = (group.emails || []).filter((e: string) => e.trim())
                              const groupSelected = sendSelectedGroups[inv.id]?.has(groupName) ?? false
                              return (
                                <div key={gIdx} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                                  <div className="mb-2 flex items-center justify-between">
                                    <label className="flex cursor-pointer items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={groupSelected}
                                        onChange={() => toggleSendGroup(inv.id, group)}
                                        className="h-4 w-4 rounded border-slate-300"
                                      />
                                      <span className="text-sm font-semibold text-slate-800">{groupName}</span>
                                    </label>
                                    <span className="text-xs text-slate-500">
                                      {(group.emails || []).filter((e: string) => e.trim()).length} email(s)
                                    </span>
                                  </div>
                                  <div className="space-y-1 pl-6">
                                    {emails.length === 0 && (
                                      <div className="text-xs italic text-slate-400">No emails in this group</div>
                                    )}
                                    {emails.map((email: string) => (
                                      <label key={email} className="flex cursor-pointer items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          checked={selectedForInv.has(email)}
                                          onChange={() => toggleSendEmail(inv.id, email)}
                                          className="h-4 w-4 rounded border-slate-300"
                                        />
                                        <span className="break-all text-slate-700">{email}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-8 py-4">
              <div className="text-sm text-slate-600">
                {(() => {
                  const total = Object.values(sendRecipients).reduce((sum, set) => sum + set.size, 0)
                  const invCount = Object.keys(sendRecipients).length
                  return `${total} recipient(s) selected across ${invCount} invoice(s)`
                })()}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeSendModal} disabled={batchSending}>
                  Cancel
                </Button>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={handleBatchSend}
                  disabled={batchSending}
                >
                  {batchSending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Mail className="mr-2 h-4 w-4" /> Confirm & Send</>
                  )}
                </Button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Export Range Dialog */}
      <Dialog open={exportRangeOpen} onOpenChange={(open) => {
        setExportRangeOpen(open)
        if (!open) {
          setExportFromInvoice('')
          setExportToInvoice('')
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#001e42]">Export Invoices to Excel</DialogTitle>
            <DialogDescription>
              Enter the invoice number range to export.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">From Invoice #</label>
              <Input
                placeholder="e.g. INV20001"
                value={exportFromInvoice}
                onChange={(e) => setExportFromInvoice(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">To Invoice #</label>
              <Input
                placeholder="e.g. INV20051"
                value={exportToInvoice}
                onChange={(e) => setExportToInvoice(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => {
                setExportRangeOpen(false)
                setExportFromInvoice('')
                setExportToInvoice('')
              }}>
                Cancel
              </Button>
              <Button
                className="bg-[#001e42] text-white hover:bg-[#002a5a]"
                disabled={!exportFromInvoice || !exportToInvoice}
                onClick={async () => {
                  if (!exportFromInvoice || !exportToInvoice) return
                  try {
                    const res = await fetch('/api/invoices/export', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fromInvoiceNumber: exportFromInvoice, toInvoiceNumber: exportToInvoice }),
                    })
                    if (!res.ok) {
                      const err = await res.json()
                      throw new Error(err.error || 'Export failed')
                    }
                    const blob = await res.blob()
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `invoices-export-${exportFromInvoice}-to-${exportToInvoice}.xlsx`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    window.URL.revokeObjectURL(url)
                    setExportRangeOpen(false)
                    setExportFromInvoice('')
                    setExportToInvoice('')
                  } catch (err: any) {
                    alert(err.message)
                  }
                }}
              >
                <Download className="mr-1 h-3 w-3" /> Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
