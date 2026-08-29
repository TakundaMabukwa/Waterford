'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Truck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function TripReportsSection() {
  const [trips, setTrips] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    async function fetchTrips() {
      setLoading(true)
      try {
        const supabase = createClient()
        const [year, month] = selectedMonth.split('-').map(Number)
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .or('status.eq.completed,status.eq.delivered,statusnotes.like.%TRIP COMPLETED EARLY%,status_notes.like.%TRIP COMPLETED EARLY%')
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`)
          .order('created_at', { ascending: false })

        if (error) throw error
        setTrips(data || [])
      } catch (err) {
        console.error('Error fetching trip reports:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTrips()
  }, [selectedMonth])

  const getDisplayStatus = (trip: any) => {
    const sn = (trip.statusnotes || trip.status_notes || '').toLowerCase()
    if (sn.includes('trip completed early') || sn.includes('trip cancelled')) return 'trip cancelled'
    if (trip.status === 'delivered') return 'delivered'
    if (trip.status === 'completed') return 'completed'
    return trip.status
  }

  const cleanStatusNotes = (trip: any) => {
    const raw = trip.statusnotes || trip.status_notes || ''
    return raw.replace(/Completed by:.*\n?/g, '').trim()
  }

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'trip cancelled': return 'bg-red-100 text-red-800'
      case 'on-trip': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading trip reports...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold tracking-tight">Trip Reports</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-auto max-h-[calc(100vh-220px)]">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="py-2 px-3 font-semibold text-slate-700">Order #</TableHead>
              <TableHead className="py-2 px-3 font-semibold text-slate-700">Client</TableHead>
              <TableHead className="py-2 px-3 font-semibold text-slate-700">Route</TableHead>
              <TableHead className="py-2 px-3 font-semibold text-slate-700">End Date</TableHead>
              <TableHead className="py-2 px-3 font-semibold text-slate-700">Status</TableHead>
              <TableHead className="py-2 px-3 font-semibold text-slate-700">Notes</TableHead>
              <TableHead className="py-2 px-3 font-semibold text-slate-700">Status Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map((trip) => {
              const clientDetails = typeof trip.clientdetails === 'string' ? JSON.parse(trip.clientdetails) : trip.clientdetails
              const displayStatus = getDisplayStatus(trip)
              return (
                <TableRow key={trip.id} className="hover:bg-slate-50">
                  <TableCell className="py-1.5 px-3 font-medium text-slate-900">{trip.ordernumber || '-'}</TableCell>
                  <TableCell className="py-1.5 px-3 text-slate-600 max-w-[150px] truncate">{clientDetails?.name || trip.selectedclient || '-'}</TableCell>
                  <TableCell className="py-1.5 px-3 text-slate-600 max-w-[180px] truncate">{trip.origin} → {trip.destination}</TableCell>
                  <TableCell className="py-1.5 px-3 text-slate-600 whitespace-nowrap">{trip.enddate || trip.end_date || '-'}</TableCell>
                  <TableCell className="py-1.5 px-3">
                    <Badge className={`px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeColor(displayStatus)}`}>
                      {displayStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-slate-600 whitespace-normal break-words">{trip.notes || '-'}</TableCell>
                  <TableCell className="py-1.5 px-3 text-slate-600 whitespace-normal break-words">{cleanStatusNotes(trip) || '-'}</TableCell>
                </TableRow>
              )
            })}
            {trips.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No trips found</p>
                  <p className="text-sm">No completed, delivered or cancelled trips for this month</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
