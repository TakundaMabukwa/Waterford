/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { toast } from 'sonner'

import AuditTripWorkspace from '@/components/audit/AuditTripWorkspace'
import { Toaster } from '@/components/ui/sonner'
import {
  AuditCurrencyCode,
  buildActualCostSummary,
  buildAssignmentSplitData,
  buildFinanceEntries,
  normalizeCurrency,
  toNumber,
} from '@/lib/audit-utils'

const mergeAuditWithTrip = (auditRecord: any, tripData: any) => {
  if (!tripData) return auditRecord

  let pickupLocs = []
  let dropoffLocs = []

  try {
    pickupLocs = typeof tripData.pickuplocations === 'string' ? JSON.parse(tripData.pickuplocations) : tripData.pickuplocations || []
    dropoffLocs = typeof tripData.dropofflocations === 'string' ? JSON.parse(tripData.dropofflocations) : tripData.dropofflocations || []
  } catch {
    pickupLocs = []
    dropoffLocs = []
  }

  const plannedStartTime = pickupLocs[0]?.scheduled_time || null
  const plannedFinishTime = dropoffLocs[0]?.scheduled_time || null
  const plannedDurationMinutes =
    plannedStartTime && plannedFinishTime
      ? Math.round((new Date(plannedFinishTime).getTime() - new Date(plannedStartTime).getTime()) / (1000 * 60))
      : null

  const actualFuelCost = toNumber(auditRecord.actual_fuel_cost ?? tripData.fuel_cost_total ?? 0)
  const actualVehicleCost = toNumber(auditRecord.actual_vehicle_cost)
  const actualDriverCost = toNumber(auditRecord.actual_driver_cost)

  return {
    ...auditRecord,
    rate: auditRecord.rate || tripData.rate || 0,
    planned_rate: tripData.rate || auditRecord.rate || 0,
    actual_rate: auditRecord.actual_rate ?? 0,
    invoice_rate: auditRecord.invoice_rate ?? auditRecord.rate ?? tripData.rate ?? 0,
    invoice_amount: auditRecord.invoice_amount ?? null,
    actual_currency: normalizeCurrency(auditRecord.actual_currency ?? 'ZAR'),
    invoice_currency: normalizeCurrency(auditRecord.invoice_currency ?? auditRecord.actual_currency ?? 'ZAR'),
    origin: auditRecord.origin || tripData.origin,
    destination: auditRecord.destination || tripData.destination,
    cargo: auditRecord.cargo || tripData.cargo,
    selectedclient: auditRecord.selectedclient || tripData.selectedclient,
    clientdetails: auditRecord.clientdetails || tripData.clientdetails,
    planned_fuel_cost: tripData.approximate_fuel_cost,
    planned_vehicle_cost: tripData.approximated_vehicle_cost,
    planned_driver_cost: tripData.approximated_driver_cost,
    planned_total_cost: tripData.total_vehicle_cost,
    planned_distance: tripData.estimated_distance,
    planned_start_time: plannedStartTime,
    planned_finish_time: plannedFinishTime,
    planned_duration_minutes: plannedDurationMinutes,
    planned_fuel_price: tripData.fuel_price_per_liter,
    actual_fuel_cost: actualFuelCost,
    actual_vehicle_cost: actualVehicleCost,
    actual_driver_cost: actualDriverCost,
    actual_total_cost: Math.round((actualFuelCost + actualVehicleCost + actualDriverCost) * 100) / 100,
    fuel_used_liters: tripData.fuel_used_liters ?? auditRecord.fuel_used_liters ?? 0,
    fuel_filled_liters: tripData.fuel_filled_liters ?? auditRecord.fuel_filled_liters ?? 0,
    fuel_operating_hours: tripData.fuel_operating_hours ?? auditRecord.fuel_operating_hours ?? 0,
    fuel_liters_per_hour: tripData.fuel_liters_per_hour ?? auditRecord.fuel_liters_per_hour ?? 0,
    fuel_liters_per_km: tripData.fuel_liters_per_km ?? auditRecord.fuel_liters_per_km ?? 0,
    fuel_cost_total: tripData.fuel_cost_total ?? auditRecord.fuel_cost_total ?? actualFuelCost,
    fuel_window_start_at: tripData.fuel_window_start_at ?? auditRecord.fuel_window_start_at ?? null,
    fuel_window_end_at: tripData.fuel_window_end_at ?? auditRecord.fuel_window_end_at ?? null,
    fuel_source: tripData.fuel_source ?? auditRecord.fuel_source ?? null,
    fuel_breakdown: tripData.fuel_breakdown ?? auditRecord.fuel_breakdown ?? [],
    actual_start_time: tripData.actual_start_time || auditRecord.actual_start_time,
    actual_finish_time: tripData.actual_end_time || auditRecord.actual_finish_time,
    accepted_at: tripData.accepted_at || auditRecord.accepted_at,
    vehicleassignments: auditRecord.vehicleassignments || tripData.vehicleassignments || [],
    handed_vehicleassignments: auditRecord.handed_vehicleassignments || tripData.handed_vehicleassignments || [],
    pickuplocations: tripData.pickuplocations || auditRecord.pickuplocations || null,
    dropofflocations: tripData.dropofflocations || auditRecord.dropofflocations || null,
    trip_row_id: tripData.id,
  }
}

export default function AuditTripDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [routeLoading, setRouteLoading] = useState(false)
  const [record, setRecord] = useState<any>(null)
  const [routeData, setRouteData] = useState<any>(null)

  const supabase = useMemo(
    () =>
      createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  )

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)

        // Try audit table first
        const { data: auditRecord, error: auditError } = await supabase
          .from('audit')
          .select('*')
          .eq('trip_id', params.id)
          .single()

        let tripData = null
        const { data: trip } = await supabase
          .from('trips')
          .select('id, trip_id, ordernumber, rate, status, origin, destination, cargo, selectedclient, clientdetails, vehicleassignments, approximate_fuel_cost, approximated_vehicle_cost, approximated_driver_cost, total_vehicle_cost, estimated_distance, pickuplocations, dropofflocations, fuel_price_per_liter, actual_start_time, actual_end_time, accepted_at, handed_vehicleassignments, fuel_used_liters, fuel_filled_liters, fuel_operating_hours, fuel_liters_per_hour, fuel_liters_per_km, fuel_cost_total, fuel_window_start_at, fuel_window_end_at, fuel_source, fuel_breakdown, loadcon_url, notes, statusnotes, loading_point_company, loading_point_city, offloading_point_company, offloading_point_city, clients_notes, fc_notes, notification_group, note_images, is_invoiced, invoice_url, invoice_rate, invoice_currency, invoice_number, invoice_data, reference_number')
          .eq('trip_id', params.id)
          .maybeSingle()

        tripData = trip

        // If no audit record exists (incomplete trip), build a virtual one from trip data
        if (auditError || !auditRecord) {
          if (!tripData) {
            throw new Error('Trip not found')
          }

          const virtualAudit = {
            id: null,
            trip_id: tripData.trip_id,
            ordernumber: tripData.ordernumber,
            rate: tripData.rate,
            status: tripData.status,
            origin: tripData.origin,
            destination: tripData.destination,
            cargo: tripData.cargo,
            selectedclient: tripData.selectedclient,
            clientdetails: tripData.clientdetails,
            vehicleassignments: tripData.vehicleassignments,
            is_invoiced: tripData.is_invoiced || false,
            invoice_url: tripData.invoice_url || null,
            invoice_rate: tripData.invoice_rate || null,
            invoice_currency: tripData.invoice_currency || null,
            invoice_data: tripData.invoice_data || null,
            reference_number: tripData.reference_number || null,
            actual_fuel_cost: null,
            actual_vehicle_cost: null,
            actual_driver_cost: null,
            actual_total_cost: null,
            created_at: tripData.created_at,
            updated_at: tripData.updated_at,
            loading_point_company: tripData.loading_point_company,
            loading_point_city: tripData.loading_point_city,
            offloading_point_company: tripData.offloading_point_company,
            offloading_point_city: tripData.offloading_point_city,
            client_notes: tripData.clients_notes,
            fc_notes: tripData.fc_notes,
            notification_group: tripData.notification_group,
            note_images: tripData.note_images,
          }

          const merged = mergeAuditWithTrip(virtualAudit, tripData)
          setRecord(merged)
        } else {
          const merged = mergeAuditWithTrip(auditRecord, tripData)
          setRecord(merged)
        }

        if (tripData?.id) {
          setRouteLoading(true)
          const response = await fetch(`/api/trip-route?tripId=${tripData.id}`)
          if (response.ok) {
            const routePayload = await response.json()
            setRouteData(routePayload)
          }
          setRouteLoading(false)
        }
      } catch (error) {
        console.error('Error loading audit record:', error)
        toast.error('Failed to load trip audit')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.id, supabase])

  const saveAudit = async (payload: {
    amountToSplit: number
    actualRate: number
    actualCurrency: AuditCurrencyCode
    invoiceRate: number
    invoiceCurrency: AuditCurrencyCode
    splitRows: any[]
    handoverLogs: any[]
    financeEntries: any[]
  }) => {
    if (record.is_invoiced) {
      throw new Error('This trip has already been invoiced. Invoice fields cannot be modified.')
    }

    const financeSummary = buildActualCostSummary(payload.financeEntries)

    const auditPayload = {
      trip_id: record.trip_id,
      ordernumber: record.ordernumber,
      rate: record.rate,
      status: record.status,
      origin: record.origin,
      destination: record.destination,
      cargo: record.cargo,
      selectedclient: record.selectedclient,
      clientdetails: record.clientdetails,
      vehicleassignments: record.vehicleassignments,
      amount_to_split: payload.amountToSplit,
      actual_rate: payload.actualRate,
      actual_currency: payload.actualCurrency,
      invoice_rate: payload.invoiceRate,
      invoice_currency: payload.invoiceCurrency,
      split_allocations: payload.splitRows.map((row) => ({
        ...row,
        amount: row.splitType === 'percentage' ? (row.baseRate * row.allocationValue) / 100 : row.splitType === 'flat_fee' ? row.allocationValue : row.baseRate + row.allocationValue,
      })),
      split_handover_logs: payload.handoverLogs,
      finance_entries: payload.financeEntries,
      actual_fuel_cost: financeSummary.actualFuelCost,
      actual_vehicle_cost: financeSummary.actualVehicleCost,
      actual_driver_cost: financeSummary.actualDriverCost,
      actual_total_cost: financeSummary.total,
      split_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (record.id) {
      // Update existing audit record
      const { error } = await supabase.from('audit').update(auditPayload).eq('id', record.id)
      if (error) throw error
    } else {
      // Insert new audit record (incomplete trip being invoiced for first time)
      const { data, error } = await supabase.from('audit').insert(auditPayload).select('id').single()
      if (error) throw error
      // Update record.id so future saves work
      auditPayload.id = data.id
    }

    const nextRecord = {
      ...record,
      ...auditPayload,
      finance_entries: payload.financeEntries,
      actual_total_cost: financeSummary.total,
    }
    setRecord(nextRecord)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-lg">Loading trip audit...</div>
  }

  if (!record) {
    return <div className="flex min-h-screen items-center justify-center text-lg">Audit record not found.</div>
  }

  const splitData = buildAssignmentSplitData(record)
  const financeEntries = buildFinanceEntries(record)
  const tabParam = searchParams.get('tab')
  const initialTab =
    tabParam === 'route' || tabParam === 'finance' || tabParam === 'handover' || tabParam === 'split'
      ? (tabParam as 'route' | 'finance' | 'handover' | 'split')
      : 'summary'

  return (
    <>
      <Toaster position="top-right" richColors />
      <AuditTripWorkspace
        record={record}
        initialSplits={splitData.splitRows}
        handoverLogs={splitData.handoverLogs}
        initialFinanceEntries={financeEntries}
        routeData={routeData}
        routeLoading={routeLoading}
        initialTab={initialTab}
        onBack={() => router.push('/audit')}
        onSaveAudit={saveAudit}
        onExport={() => toast.info('Export flow can be wired next.')}
        onFinalAudit={() => toast.info('Final audit action can be wired next.')}
        onRecordUpdate={(updates) => setRecord({ ...record, ...updates })}
      />
    </>
  )
}
