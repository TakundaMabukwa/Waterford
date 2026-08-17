/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Download, FileText, Paperclip, Route, Truck, Plus, AlertTriangle, Loader2 } from 'lucide-react'
// @ts-ignore
import ExcelJS from 'exceljs'
import SundryInvoiceModal from '@/components/audit/SundryInvoiceModal'
import GenerateInvoiceModal from '@/components/audit/GenerateInvoiceModal'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SecureButton } from '@/components/SecureButton'

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const currency = (value: number) =>
  `R${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
  const [activeTab, setActiveTab] = useState<'trips' | 'sundry' | 'incomplete' | 'drafts' | 'invoices'>('trips')
  const [sundryInvoices, setSundryInvoices] = useState<any[]>([])
  const [sundryLoading, setSundryLoading] = useState(false)
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
  const [finalizeDocs, setFinalizeDocs] = useState<any[]>([])
  const [finalizeDocsLoading, setFinalizeDocsLoading] = useState(false)
  const [finalizedInvoiceUrl, setFinalizedInvoiceUrl] = useState<string | null>(null)
  const [sendEmailGroups, setSendEmailGroups] = useState<any[]>([])
  const [sendingEmail, setSendingEmail] = useState(false)
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
    if (activeTab !== 'sundry' && activeTab !== 'invoiced') return
    const fetchSundry = async () => {
      setSundryLoading(true)
      try {
        const res = await fetch('/api/sundry-invoices')
        const result = await res.json()
        setSundryInvoices(result.data || [])
      } catch (err) {
        console.error('Error fetching sundry invoices:', err)
      } finally {
        setSundryLoading(false)
      }
    }
    fetchSundry()
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
    if (activeTab !== 'invoices') return
    const fetchInvoices = async () => {
      setInvoicesLoading(true)
      try {
        const [invRes, sundryRes] = await Promise.all([
          fetch('/api/invoices?finalized=true'),
          fetch('/api/sundry-invoices'),
        ])
        const invResult = await invRes.json()
        const sundryResult = await sundryRes.json()
        setFinalizedInvoices(invResult.data || [])
        setSundryInvoices(sundryResult.data || [])
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
    
    if (statusFilter !== 'all') {
      next = next.filter((record) => record.status === statusFilter)
    } else {
      next = next.filter((record) => record.status === 'delivered' || record.status === 'completed')
    }

    // Trips tab: only show NOT invoiced and no invoice draft
    if (activeTab === 'trips') {
      next = next.filter((record) => !record.is_invoiced && !record.has_invoice_draft)
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
    setShowEditModal(true)
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
      
      // Update the finalize preview with the invoice number
      const updatedDraft = { ...finalizePreview, invoice_number: result.invoiceNumber, is_draft: false }
      setFinalizePreview(updatedDraft)
      setFinalizedInvoiceUrl(null)
      
      // Initialize send email groups with all groups checked
      if (finalizePreview.invoice_email_groups?.length > 0) {
        setSendEmailGroups([...finalizePreview.invoice_email_groups])
      }
      
      // Close the finalize dialog and open GenerateInvoiceModal in finalize mode to generate PDF
      setShowFinalizePreview(false)
      setEditDraftId(finalizePreview.id)
      setEditDraftData(updatedDraft)
      setEditModalMode('finalize')
      setShowEditModal(true)
      
      // Refresh drafts
      const draftRes = await fetch('/api/invoices?draft=true')
      const draftResult = await draftRes.json()
      setDraftInvoices(draftResult.data || [])
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
      // Collect all selected recipients
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

      const tripData = invoice.trip_data || {}
      const { buildInvoiceEmailHtml } = await import('@/lib/invoice-email-template')
      const html = buildInvoiceEmailHtml({
        orderNumber: invoice.ordernumber || invoice.trip_id || '',
        origin: tripData.origin || '',
        destination: tripData.destination || '',
        customerName: invoice.customer_name || '',
        customerAddress: invoice.customer_address || '',
        amount: toNumber(invoice.total_amount || invoice.amount_due).toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
        currency: invoice.currency || 'ZAR',
        invoiceDate: invoice.invoice_date || '',
        invoicePdfUrl: invoice.invoice_url || '',
      })

      const subject = `Invoice ${invoice.invoice_number || ''} - Waterford Carriers`

      const res = await fetch('/api/send-invoice-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, subject, html }),
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
          onClick={() => setActiveTab('sundry')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sundry' ? 'bg-[#001e42] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sundry Invoices
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
      </div>

      {activeTab === 'trips' && (
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center">
            <Input
              placeholder="Search by trip, order, origin, or destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Delivered + Completed</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
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
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Planned</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Actual</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Fuel</th>
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
                    <td className="px-3 py-2 text-sm text-slate-700">{currency(toNumber(record.planned_total_cost))}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{currency(toNumber(record.actual_total_cost))}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      <div>{toNumber(record.fuel_used_liters).toFixed(1)} L</div>
                      <div className="text-xs text-slate-500">{toNumber(record.fuel_liters_per_km).toFixed(3)} L/km</div>
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

      {activeTab === 'sundry' && (
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#001e42]">Sundry Invoices</h3>
            <Button onClick={() => setShowSundryModal(true)} className="bg-[#001e42] text-white hover:bg-[#0b2955]">
              <Plus className="mr-2 h-4 w-4" /> New Sundry Invoice
            </Button>
          </div>

          {sundryLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading sundry invoices...</div>
          ) : sundryInvoices.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No sundry invoices found.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice #</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Due Date</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Amount Due</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sundryInvoices.map((inv: any) => (
                    <tr key={inv.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{inv.invoice_number}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{inv.customer_name || '-'}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{inv.invoice_date || '-'}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{inv.due_date || 'On Receipt'}</td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">
                        {currency(toNumber(inv.amount_due))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {inv.invoice_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => window.open(inv.invoice_url, '_blank')}
                          >
                            <FileText className="mr-1 h-3 w-3" /> Download
                          </Button>
                        )}
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

          {/* Invoiced Sundry Invoices */}
          <div>
            <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Sundry Invoices</h4>
            {sundryLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading sundry invoices...</div>
            ) : sundryInvoices.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-500">No sundry invoices found.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice #</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Amount Due</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sundryInvoices.map((inv: any) => (
                      <tr key={inv.id} className="border-t hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{inv.invoice_number}</div>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{inv.customer_name || '-'}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{inv.invoice_date || '-'}</td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">
                          {currency(toNumber(inv.amount_due))}
                        </td>
                            <td className="px-3 py-2 text-right">
                              {inv.invoice_url && (
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => window.open(inv.invoice_url, '_blank')}>
                                    <FileText className="mr-1 h-3 w-3" /> View
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => {
                                    const a = document.createElement('a')
                                    a.href = inv.invoice_url
                                    a.download = `${inv.invoice_number || 'invoice'}.pdf`
                                    document.body.appendChild(a)
                                    a.click()
                                    document.body.removeChild(a)
                                  }}>
                                    <Download className="mr-1 h-3 w-3" /> Download
                                  </Button>
                                </div>
                              )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Order</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Currency</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {draftInvoices.map((inv: any) => (
                    <tr key={inv.id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{inv.ordernumber || inv.trip_id || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{inv.customer_name || '-'}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{inv.invoice_date || '-'}</td>
                      <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">
                        {inv.currency === 'USD' ? '$' : 'R'}{toNumber(inv.total_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5">{inv.currency}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-[10px] px-2 py-0.5">Draft</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {inv.invoice_url && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => window.open(inv.invoice_url, '_blank')}>
                              <Download className="h-3 w-3" />
                            </Button>
                          )}
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
                    // Refresh invoices
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
          ) : finalizedInvoices.length === 0 && sundryInvoices.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No invoices found.</div>
          ) : (
            <div className="space-y-6">
              {/* Trip Invoices */}
              {finalizedInvoices.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Trip Invoices</h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full border-collapse text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice #</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Order</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Currency</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finalizedInvoices.map((inv: any) => (
                          <tr key={inv.id} className="border-t hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{inv.invoice_number || '—'}</div>
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-700">{inv.ordernumber || inv.trip_id || '-'}</td>
                            <td className="px-3 py-2 text-sm text-slate-700">{inv.customer_name || '-'}</td>
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
                                    {inv.invoice_email_groups?.length > 0 && (
                                      <Button
                                        size="sm"
                                        className="h-7 px-2 text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                                        disabled={sendingEmail}
                                        onClick={() => sendInvoiceEmail(inv, inv.invoice_email_groups)}
                                      >
                                        <FileText className="mr-1 h-3 w-3" /> Send Invoice
                                      </Button>
                                    )}
                                    {(!inv.invoice_email_groups || inv.invoice_email_groups.length === 0) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs"
                                        disabled={sendingEmail}
                                        onClick={() => alert('No email groups configured for this client. Add groups in the Clients page.')}
                                      >
                                        <Mail className="mr-1 h-3 w-3" /> No Groups
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sundry Invoices */}
              {sundryInvoices.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Sundry Invoices</h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full border-collapse text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Invoice #</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                          <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Date</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sundryInvoices.map((inv: any) => (
                          <tr key={inv.id} className="border-t hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{inv.invoice_number}</div>
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-700">{inv.customer_name || '-'}</td>
                            <td className="px-3 py-2 text-sm text-slate-700">{inv.invoice_date || '-'}</td>
                            <td className="px-3 py-2 text-right text-sm font-medium text-slate-900">
                              {inv.currency === 'USD' ? '$' : 'R'}{toNumber(inv.amount_due).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {inv.invoice_url && (
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => window.open(inv.invoice_url, '_blank')}>
                                  <FileText className="mr-1 h-3 w-3" /> View
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <SundryInvoiceModal open={showSundryModal} onClose={() => {
        setShowSundryModal(false)
        if (activeTab === 'sundry') {
          fetch('/api/sundry-invoices').then(r => r.json()).then(result => setSundryInvoices(result.data || []))
        }
      }} />

      {/* Edit Draft Modal */}
      {showEditModal && editDraftData && (
        <GenerateInvoiceModal
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditDraftId(null)
            setEditDraftData(null)
            // Refresh both drafts and invoices lists
            fetch('/api/invoices?draft=true').then(r => r.json()).then(result => setDraftInvoices(result.data || []))
            fetch('/api/invoices?finalized=true').then(r => r.json()).then(result => setFinalizedInvoices(result.data || []))
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
                  ? 'Invoice has been finalized successfully. You can now download the invoice.'
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
              {!finalizedInvoiceUrl && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice Email Recipients</label>
                  <p className="text-[10px] text-slate-400 mb-2">
                    {finalizePreview.invoice_email_groups?.length > 0
                      ? 'Select groups and edit recipients before sending.'
                      : 'No email groups configured for this client. You can add groups in the Clients page.'}
                  </p>
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
              )}

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
                    <Button
                      className="bg-emerald-700 text-white hover:bg-emerald-800"
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
    </div>
  )
}
