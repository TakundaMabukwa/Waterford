/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Download, FileText, Paperclip, Route, Truck } from 'lucide-react'
// @ts-ignore
import ExcelJS from 'exceljs'

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
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [invoicedFilter, setInvoicedFilter] = useState<'all' | 'invoiced' | 'not_invoiced'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [selectedDocumentRecord, setSelectedDocumentRecord] = useState<any>(null)
  const [tripDocuments, setTripDocuments] = useState<any[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
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

  useEffect(() => {
    let next = records
    if (statusFilter !== 'all') {
      next = next.filter((record) => record.status === statusFilter)
    } else {
      next = next.filter((record) => record.status === 'delivered' || record.status === 'completed')
    }

    if (invoicedFilter === 'invoiced') {
      next = next.filter((record) => record.is_invoiced)
    } else if (invoicedFilter === 'not_invoiced') {
      next = next.filter((record) => !record.is_invoiced)
    }

    if (searchTerm) {
      const query = searchTerm.toLowerCase()
      next = next.filter(
        (record) =>
          record.trip_id?.toLowerCase().includes(query) ||
          record.ordernumber?.toLowerCase().includes(query) ||
          record.origin?.toLowerCase().includes(query) ||
          record.destination?.toLowerCase().includes(query)
      )
    }

    setFilteredRecords(next)
  }, [records, statusFilter, invoicedFilter, searchTerm])

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
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setInvoicedFilter('all')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  invoicedFilter === 'all' ? 'bg-[#001e42] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setInvoicedFilter('not_invoiced')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  invoicedFilter === 'not_invoiced' ? 'bg-[#001e42] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Not Invoiced
              </button>
              <button
                onClick={() => setInvoicedFilter('invoiced')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  invoicedFilter === 'invoiced' ? 'bg-[#001e42] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Invoiced
              </button>
            </div>
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
                      <div className="font-medium text-slate-900">{record.trip_id}</div>
                      <div className="text-xs text-slate-500">{record.ordernumber || 'No order number'}</div>
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
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => router.push(`/audit/${record.id}`)}>
                          View
                        </Button>
                        <SecureButton
                          page="financials"
                          action="view"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => router.push(`/audit/${record.id}?tab=route`)}
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

      <Dialog open={documentsOpen} onOpenChange={setDocumentsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Trip Documents</DialogTitle>
            <DialogDescription>
              {selectedDocumentRecord?.trip_id ? `Files attached to ${selectedDocumentRecord.trip_id}` : 'Files attached to this trip'}
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
