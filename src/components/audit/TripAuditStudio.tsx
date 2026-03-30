'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileDown,
  MapPin,
  Route,
  Truck,
  User,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type SplitType = 'percentage' | 'flat_fee' | 'mileage_bonus'

type SplitRow = {
  id: string
  driverName: string
  vehicleLabel: string
  role: 'Primary' | 'Handover'
  baseRate: number
  splitType: SplitType
  allocationValue: number
  assignmentGroup?: 'vehicleassignments' | 'handed_vehicleassignments'
  assignmentIndex?: number
  distance?: number
  cap?: number
}

type HandoverLog = {
  id: string
  segmentId: string
  company: string
  weightPercent: number
  lineHaulFee: number
  tolls: number
  finalAllocation: number
  status?: string
}

type TripAuditStudioProps = {
  open: boolean
  onClose: () => void
  record: any
  initialSplits?: SplitRow[]
  handoverLogs?: HandoverLog[]
  initialAmountToSplit?: number
  onExport?: () => void
  onFinalAudit?: () => void
  onSaveAllocation?: (payload: {
    amountToSplit: number
    actualRate: number
    invoiceRate: number
    splitRows: SplitRow[]
    handoverLogs: HandoverLog[]
  }) => Promise<void> | void
}

const currency = (value: number | null | undefined) =>
  `R${Number(value || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const numberFmt = (value: number | null | undefined, suffix = '') =>
  `${Number(value || 0).toLocaleString('en-ZA', {
    maximumFractionDigits: 1,
  })}${suffix}`

const fmtDateTime = (val: any) => {
  if (!val) return 'N/A'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  return d.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const minutesToText = (minutes?: number | null) => {
  if (minutes == null || Number.isNaN(Number(minutes))) return 'N/A'
  const abs = Math.abs(Number(minutes))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const getVarianceLabel = (variance?: number | null, type: 'time' | 'distance' = 'time') => {
  if (variance == null || Number.isNaN(Number(variance))) return 'N/A'

  if (type === 'distance') {
    const v = Number(variance)
    return `${Math.abs(v).toFixed(1)} km ${v >= 0 ? 'longer' : 'shorter'}`
  }

  const v = Number(variance)
  return `${minutesToText(v)} ${v >= 0 ? 'late' : 'early'}`
}

const calcSplitTotal = (row: SplitRow) => {
  if (row.splitType === 'percentage') return (row.baseRate * row.allocationValue) / 100
  if (row.splitType === 'flat_fee') return row.allocationValue
  return row.baseRate + row.allocationValue
}

const getClientName = (record: any) => {
  if (record?.selectedclient || record?.selected_client) {
    return record.selectedclient || record.selected_client
  }

  const source = record?.clientdetails || record?.client_details
  if (!source) return 'N/A'

  try {
    const parsed = typeof source === 'string' ? JSON.parse(source) : source
    return parsed?.name || 'N/A'
  } catch {
    return 'N/A'
  }
}

const buildFallbackHandoverLogs = (splits: SplitRow[]): HandoverLog[] => {
  return splits
    .filter((row) => row.role === 'Handover')
    .map((row) => {
      const total = calcSplitTotal(row)
      return {
        id: row.id,
        segmentId: row.id.toUpperCase(),
        company: row.driverName,
        weightPercent: row.baseRate > 0 ? (total / row.baseRate) * 100 : 0,
        lineHaulFee: row.baseRate,
        tolls: Math.max(0, total - row.baseRate),
        finalAllocation: total,
        status: 'Complete',
      }
    })
}

const mergeHandoverLogs = (splits: SplitRow[], savedLogs?: HandoverLog[]) => {
  const derivedLogs = buildFallbackHandoverLogs(splits)
  if (!savedLogs?.length) return derivedLogs

  return derivedLogs.map((log) => {
    const saved = savedLogs.find(
      (item) => item.id === log.id || item.segmentId === log.segmentId || item.company === log.company
    )

    return saved
      ? {
          ...log,
          tolls: saved.tolls ?? log.tolls,
          status: saved.status ?? log.status,
        }
      : log
  })
}

function StudioTabButton({
  active,
  index,
  label,
  onClick,
}: {
  active: boolean
  index: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 rounded-xl px-4 py-3 text-xs font-semibold transition-all',
        'flex items-center justify-center gap-2',
        active
          ? 'bg-white text-[#001e42] shadow-sm'
          : 'text-slate-500 hover:bg-slate-100',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
          active ? 'bg-[#001e42] text-white' : 'border border-slate-300 text-slate-500',
        ].join(' ')}
      >
        {index}
      </span>
      {label}
    </button>
  )
}

export default function TripAuditStudio({
  open,
  onClose,
  record,
  initialSplits,
  handoverLogs,
  initialAmountToSplit,
  onExport,
  onFinalAudit,
  onSaveAllocation,
}: TripAuditStudioProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'primary' | 'handover'>('summary')
  const [splitRows, setSplitRows] = useState<SplitRow[]>([])
  const [amountToSplit, setAmountToSplit] = useState(0)
  const [actualRate, setActualRate] = useState(0)
  const [invoiceRate, setInvoiceRate] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [initialRows, setInitialRows] = useState<SplitRow[]>([])

  useEffect(() => {
    if (!record) return
    const nextRows = initialSplits?.length ? initialSplits : []
    setInitialRows(nextRows)
    setSplitRows(nextRows)
    const nextActualRate = Number(record?.actual_rate ?? record?.amount_to_split ?? 0)
    const nextInvoiceRate = Number(record?.invoice_rate ?? record?.rate ?? record?.planned_total_cost ?? 0)
    setActualRate(nextActualRate)
    setInvoiceRate(nextInvoiceRate)
    setAmountToSplit(nextActualRate)
    setSaveError(null)
  }, [record, initialSplits, initialAmountToSplit])

  const handovers = useMemo(() => mergeHandoverLogs(splitRows, handoverLogs), [handoverLogs, splitRows])

  const revenue = Number(record?.actual_total_cost || record?.planned_total_cost || 0)
  const plannedRate = Number(record?.planned_rate ?? record?.rate ?? record?.planned_total_cost ?? 0)
  const plannedFuelCost = Number(record?.planned_fuel_cost || 0)
  const fuelExpense = Number(record?.actual_fuel_cost || record?.planned_fuel_cost || 0)
  const plannedVehicleCost = Number(record?.planned_vehicle_cost || 0)
  const plannedDriverCost = Number(record?.planned_driver_cost || 0)
  const overhead =
    Number(record?.actual_driver_cost || record?.planned_driver_cost || 0) +
    Number(record?.actual_vehicle_cost || record?.planned_vehicle_cost || 0)
  const actualVehicleCost = Number(record?.actual_vehicle_cost || 0)
  const actualDriverCost = Number(record?.actual_driver_cost || 0)
  const fuelUsedLiters = Number(record?.fuel_used_liters || 0)
  const fuelFilledLiters = Number(record?.fuel_filled_liters || 0)
  const fuelOperatingHours = Number(record?.fuel_operating_hours || 0)
  const fuelLitersPerHour = Number(record?.fuel_liters_per_hour || 0)
  const fuelLitersPerKm = Number(record?.fuel_liters_per_km || 0)
  const fuelCostTotal = Number(record?.fuel_cost_total || fuelExpense || 0)
  const fuelBreakdown = Array.isArray(record?.fuel_breakdown) ? record.fuel_breakdown : []

  const net = revenue - fuelExpense - overhead
  const myRate = invoiceRate - actualRate
  const operatingRatio = revenue > 0 ? (fuelExpense + overhead) / revenue : 0
  const allocatedTotal = splitRows.reduce((sum, row) => sum + calcSplitTotal(row), 0)
  const unallocated = amountToSplit - allocatedTotal
  const canSave = splitRows.length > 0 && Math.abs(unallocated) < 0.01
  const hasAssignments = splitRows.length > 0

  const handleDistributeEvenly = () => {
    if (!splitRows.length) return
    const evenShare = amountToSplit / splitRows.length
    setSplitRows((prev) =>
      prev.map((row) => ({
        ...row,
        splitType: 'flat_fee',
        baseRate: evenShare,
        allocationValue: evenShare,
      }))
    )
    setSaveError(null)
  }

  const handleResetAllocation = () => {
    setSplitRows(initialRows)
    setSaveError(null)
  }

  const handleSaveAllocation = async () => {
    if (!onSaveAllocation) return
    if (!canSave) {
      setSaveError('Split must balance exactly before saving.')
      return
    }

    try {
      setIsSaving(true)
      setSaveError(null)
      await onSaveAllocation({
        amountToSplit,
        actualRate,
        invoiceRate,
        splitRows,
        handoverLogs: handovers,
      })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save allocation')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open || !record) return null

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="h-[92vh] max-w-[96vw] overflow-hidden border-slate-200 bg-slate-50 p-0 shadow-2xl sm:max-w-[96vw]"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{record?.trip_id || 'Trip Audit'}</DialogTitle>
          <DialogDescription>Trip audit summary and split allocation.</DialogDescription>
        </DialogHeader>
        <div className="h-full overflow-y-auto">
            <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/95 px-6 backdrop-blur">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Financial Reporting
                  </div>
                  <div className="font-headline text-xl font-extrabold text-[#001e42]">
                    {record?.trip_id || 'Trip Audit'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={onExport}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button className="bg-[#001e42] text-white hover:bg-[#0b2955]" onClick={onFinalAudit}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Final Audit
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </header>

            <div className="mx-auto max-w-7xl px-6 py-8 pb-32">
              <section className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    <span>Order {record?.ordernumber || record?.trip_id || 'N/A'}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{getClientName(record)}</span>
                  </div>
                  <h2 className="font-headline text-4xl font-black tracking-tight text-[#001e42]">
                    Trip Cost Analysis
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Planned vs actual trip performance, split allocation, and handover settlement
                    in one screen.
                  </p>
                </div>
              </section>

              <nav className="mb-8 flex max-w-3xl items-center gap-0 rounded-xl border border-slate-200 bg-slate-100 p-1.5">
                <StudioTabButton
                  active={activeTab === 'summary'}
                  index="01"
                  label="TRIP SUMMARY"
                  onClick={() => setActiveTab('summary')}
                />
                <StudioTabButton
                  active={activeTab === 'primary'}
                  index="02"
                  label="PRIMARY SPLIT"
                  onClick={() => setActiveTab('primary')}
                />
                <StudioTabButton
                  active={activeTab === 'handover'}
                  index="03"
                  label="HANDOVER LOGS"
                  onClick={() => setActiveTab('handover')}
                />
              </nav>

              {activeTab === 'summary' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 space-y-8 border border-slate-200/80 bg-white p-8 shadow-sm lg:col-span-8">
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                            Profitability Index
                          </p>
                          <div className="flex items-baseline gap-3">
                            <span className="font-headline text-5xl font-black tracking-tighter text-[#001e42]">
                              {currency(net)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-sm font-bold ${
                                net >= 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {net >= 0 ? 'Positive Margin' : 'Negative Margin'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                            Operating Ratio
                          </p>
                          <p className="font-headline text-2xl font-bold text-slate-900">
                            {operatingRatio.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6 border-t border-slate-100 pt-6 md:grid-cols-4">
                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Planned Rate
                          </p>
                          <p className="text-lg font-bold text-slate-900">{currency(plannedRate)}</p>
                          <div className="mt-2 h-1 w-full overflow-hidden bg-slate-100">
                            <div className="h-full w-full bg-slate-400" />
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Invoice Rate
                          </p>
                          <p className="text-lg font-bold">{currency(invoiceRate || revenue)}</p>
                          <div className="mt-2 h-1 w-full overflow-hidden bg-slate-100">
                            <div className="h-full w-full bg-[#001e42]" />
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Actual Rate
                          </p>
                          <p className="text-lg font-bold text-amber-700">{currency(actualRate)}</p>
                          <div className="mt-2 h-1 w-full overflow-hidden bg-slate-100">
                            <div
                              className="h-full bg-amber-500"
                              style={{
                                width: `${Math.min(100, invoiceRate > 0 ? (actualRate / invoiceRate) * 100 : 0)}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            My Rate
                          </p>
                          <p className={`text-lg font-bold ${myRate >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {currency(myRate)}
                          </p>
                          <div className="mt-2 h-1 w-full overflow-hidden bg-slate-100">
                            <div
                              className="h-full bg-emerald-500"
                              style={{
                                width: `${Math.min(100, invoiceRate > 0 ? (Math.max(myRate, 0) / invoiceRate) * 100 : 0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-12 flex flex-col justify-between border border-slate-200/80 bg-slate-50 p-6 lg:col-span-4">
                      <div>
                        <h3 className="font-headline mb-4 text-xl font-extrabold tracking-tight text-[#001e42]">
                          Order Snapshot
                        </h3>

                        <ul className="space-y-4">
                          <li className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm">
                            <span className="text-slate-500">Origin</span>
                            <span className="font-bold text-slate-900">{record?.origin || 'N/A'}</span>
                          </li>
                          <li className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm">
                            <span className="text-slate-500">Destination</span>
                            <span className="font-bold text-slate-900">
                              {record?.destination || 'N/A'}
                            </span>
                          </li>
                          <li className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm">
                            <span className="text-slate-500">Total Distance</span>
                            <span className="font-bold text-slate-900">
                              {numberFmt(record?.actual_distance || record?.planned_distance, ' km')}
                            </span>
                          </li>
                          <li className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm">
                            <span className="text-slate-500">Cargo Type</span>
                            <span className="font-bold text-slate-900">{record?.cargo || 'N/A'}</span>
                          </li>
                        </ul>
                      </div>

                      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                            <User className="h-5 w-5 text-[#001e42]" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              Primary Dispatcher
                            </p>
                            <p className="text-sm font-bold text-[#001e42]">
                              {record?.dispatcher_name || 'Not Assigned'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-headline text-xl font-black tracking-tight text-[#001e42]">
                        Cost And Fuel Breakdown
                      </h3>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        Planned vs Actual
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fuel Cost</div>
                        <div className="mt-3 text-sm text-slate-500">Planned</div>
                        <div className="text-xl font-black text-slate-900">{currency(plannedFuelCost)}</div>
                        <div className="mt-3 text-sm text-slate-500">Actual</div>
                        <div className="text-xl font-black text-rose-700">{currency(fuelCostTotal)}</div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vehicle Cost</div>
                        <div className="mt-3 text-sm text-slate-500">Planned</div>
                        <div className="text-xl font-black text-slate-900">{currency(plannedVehicleCost)}</div>
                        <div className="mt-3 text-sm text-slate-500">Actual</div>
                        <div className="text-xl font-black text-sky-700">{currency(actualVehicleCost)}</div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Driver Cost</div>
                        <div className="mt-3 text-sm text-slate-500">Planned</div>
                        <div className="text-xl font-black text-slate-900">{currency(plannedDriverCost)}</div>
                        <div className="mt-3 text-sm text-slate-500">Actual</div>
                        <div className="text-xl font-black text-emerald-700">{currency(actualDriverCost)}</div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trip Total</div>
                        <div className="mt-3 text-sm text-slate-500">Planned</div>
                        <div className="text-xl font-black text-slate-900">{currency(Number(record?.planned_total_cost || 0))}</div>
                        <div className="mt-3 text-sm text-slate-500">Actual</div>
                        <div className="text-xl font-black text-[#001e42]">{currency(Number(record?.actual_total_cost || 0))}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Planned Fuel</div>
                        <div className="mt-3 text-2xl font-black text-slate-900">{currency(plannedFuelCost)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actual Fuel Used</div>
                        <div className="mt-3 text-2xl font-black text-rose-700">{numberFmt(fuelUsedLiters, ' L')}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fuel Filled</div>
                        <div className="mt-3 text-2xl font-black text-emerald-700">{numberFmt(fuelFilledLiters, ' L')}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Burn Rate</div>
                        <div className="mt-3 text-2xl font-black text-[#001e42]">{numberFmt(fuelLitersPerHour, ' L/h')}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fuel Per KM</div>
                        <div className="mt-3 text-2xl font-black text-[#001e42]">{numberFmt(fuelLitersPerKm, ' L/km')}</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 bg-white shadow-sm">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                            <th className="px-6 py-4">Fuel Metric</th>
                            <th className="px-6 py-4">Planned</th>
                            <th className="px-6 py-4">Actual</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Fuel Cost</td>
                            <td className="px-6 py-4">{currency(plannedFuelCost)}</td>
                            <td className="px-6 py-4">{currency(fuelCostTotal)}</td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Fuel Used</td>
                            <td className="px-6 py-4">N/A</td>
                            <td className="px-6 py-4">{numberFmt(fuelUsedLiters, ' L')}</td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Fuel Filled</td>
                            <td className="px-6 py-4">N/A</td>
                            <td className="px-6 py-4">{numberFmt(fuelFilledLiters, ' L')}</td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Operating Hours</td>
                            <td className="px-6 py-4">{minutesToText(record?.planned_duration_minutes)}</td>
                            <td className="px-6 py-4">{numberFmt(fuelOperatingHours, ' h')}</td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Fuel Burn Rate</td>
                            <td className="px-6 py-4">N/A</td>
                            <td className="px-6 py-4">{numberFmt(fuelLitersPerHour, ' L/h')}</td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Fuel Per KM</td>
                            <td className="px-6 py-4">N/A</td>
                            <td className="px-6 py-4">{numberFmt(fuelLitersPerKm, ' L/km')}</td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Fuel Source</td>
                            <td className="px-6 py-4">Load Plan</td>
                            <td className="px-6 py-4">{record?.fuel_source || 'N/A'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="font-headline text-lg font-black text-[#001e42]">Per Vehicle Fuel Breakdown</h4>
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                          {record?.fuel_window_start_at ? `${fmtDateTime(record.fuel_window_start_at)} to ${fmtDateTime(record.fuel_window_end_at)}` : 'No trip fuel window yet'}
                        </div>
                      </div>

                      {fuelBreakdown.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                                <th className="px-4 py-3">Vehicle</th>
                                <th className="px-4 py-3 text-right">Used</th>
                                <th className="px-4 py-3 text-right">Filled</th>
                                <th className="px-4 py-3 text-right">Hours</th>
                                <th className="px-4 py-3 text-right">L/H</th>
                                <th className="px-4 py-3 text-right">L/KM</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                              {fuelBreakdown.map((entry: any, index: number) => (
                                <tr key={`${entry?.plate || 'vehicle'}-${index}`}>
                                  <td className="px-4 py-3 font-medium text-slate-900">{entry?.plate || 'N/A'}</td>
                                  <td className="px-4 py-3 text-right">{numberFmt(entry?.fuel_used_liters, ' L')}</td>
                                  <td className="px-4 py-3 text-right">{numberFmt(entry?.fuel_filled_liters, ' L')}</td>
                                  <td className="px-4 py-3 text-right">{numberFmt(entry?.operating_hours, ' h')}</td>
                                  <td className="px-4 py-3 text-right">{numberFmt(entry?.liters_per_hour, ' L/h')}</td>
                                  <td className="px-4 py-3 text-right">{numberFmt(entry?.liters_per_km, ' L/km')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                          No actual trip fuel sessions have been linked into this trip window yet.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-headline text-xl font-black tracking-tight text-[#001e42]">
                        Trip Metrics
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <span className="h-3 w-3 rounded-full bg-blue-200" /> Planned
                        <span className="ml-4 h-3 w-3 rounded-full bg-emerald-200" /> Actual
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 bg-white shadow-sm">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                            <th className="px-6 py-4">Metric</th>
                            <th className="px-6 py-4">Planned</th>
                            <th className="px-6 py-4">Actual</th>
                            <th className="px-6 py-4">Variance</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Start Time</td>
                            <td className="px-6 py-4">{fmtDateTime(record?.planned_start_time)}</td>
                            <td className="px-6 py-4">{fmtDateTime(record?.actual_start_time)}</td>
                            <td className="px-6 py-4">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                {getVarianceLabel(record?.start_time_variance_minutes, 'time')}
                              </Badge>
                            </td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Finish Time</td>
                            <td className="px-6 py-4">{fmtDateTime(record?.planned_finish_time)}</td>
                            <td className="px-6 py-4">{fmtDateTime(record?.actual_finish_time)}</td>
                            <td className="px-6 py-4">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                {getVarianceLabel(record?.finish_time_variance_minutes, 'time')}
                              </Badge>
                            </td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Distance</td>
                            <td className="px-6 py-4">
                              {numberFmt(record?.planned_distance, ' km')}
                            </td>
                            <td className="px-6 py-4">
                              {numberFmt(record?.actual_distance || record?.distance, ' km')}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                {getVarianceLabel(record?.distance_variance, 'distance')}
                              </Badge>
                            </td>
                          </tr>
                          <tr className="border-t border-slate-100">
                            <td className="px-6 py-4 font-medium">Duration</td>
                            <td className="px-6 py-4">
                              {minutesToText(record?.planned_duration_minutes)}
                            </td>
                            <td className="px-6 py-4">
                              {minutesToText(record?.actual_duration_minutes)}
                            </td>
                            <td className="px-6 py-4">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                {getVarianceLabel(record?.duration_variance_minutes, 'time')}
                              </Badge>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'primary' && (
                <div className="space-y-10">
                  <div className="mb-10">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#001e42]">
                      <BarChart3 className="h-4 w-4" />
                      Lumen Analytics View
                    </div>
                    <h1 className="font-headline text-4xl font-extrabold text-[#001e42]">
                      Primary Split Allocation
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                      Detailed distribution of logistics operating funds for this route. Review
                      base rates and adjust allocation values live.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 rounded-sm border border-slate-200 bg-white p-6 md:grid-cols-4">
                    <div className="rounded-sm bg-slate-50 p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Planned Rate
                      </div>
                      <div className="mt-2 font-headline text-2xl font-black text-slate-900">
                        {currency(plannedRate)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Actual Rate
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={actualRate}
                        onChange={(e) => {
                          const next = Number(e.target.value || 0)
                          setActualRate(next)
                          setAmountToSplit(next)
                        }}
                        className="h-12 text-lg font-bold"
                      />
                    </div>
                    <div>
                      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Invoice Rate
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceRate}
                        onChange={(e) => setInvoiceRate(Number(e.target.value || 0))}
                        className="h-12 text-lg font-bold"
                      />
                    </div>
                    <div className="rounded-sm bg-slate-50 p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        My Rate
                      </div>
                      <div className={`mt-2 font-headline text-2xl font-black ${myRate >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {currency(myRate)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 rounded-sm border border-slate-200 bg-white p-6 md:grid-cols-2">
                    <div className="rounded-sm bg-slate-50 p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Allocated
                      </div>
                      <div className="mt-2 font-headline text-2xl font-black text-[#001e42]">
                        {currency(allocatedTotal)}
                      </div>
                    </div>
                    <div className="rounded-sm bg-slate-50 p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Remaining
                      </div>
                      <div
                        className={`mt-2 font-headline text-2xl font-black ${
                          unallocated >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {currency(unallocated)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-sm border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600">
                    Planned and actual values are shown together here. The split rows are built from the trip&apos;s primary and handover assignment sets, and the
                    actual split must balance to exactly <span className="font-bold text-slate-900">{currency(amountToSplit)}</span>{' '}
                    before it can be saved.
                  </div>

                  {hasAssignments ? (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button variant="outline" onClick={handleDistributeEvenly}>
                          Distribute Evenly
                        </Button>
                        <Button variant="outline" onClick={handleResetAllocation}>
                          Reset Saved Values
                        </Button>
                      </div>

                      <div className="overflow-x-auto rounded-sm border border-slate-200 bg-white">
                        <table className="w-full border-collapse text-left">
                          <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Driver / Vehicle Set
                              </th>
                              <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Role
                              </th>
                              <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Base Rate
                              </th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Split Type
                              </th>
                              <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Allocation Value
                              </th>
                              <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Calculated Total
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {splitRows.map((row, index) => {
                              const total = calcSplitTotal(row)
                              const overCap = row.cap != null && total > row.cap

                              return (
                                <tr
                                  key={row.id}
                                  className={overCap ? 'bg-rose-50/70' : 'hover:bg-slate-50'}
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-blue-100">
                                        <User className="h-4 w-4 text-[#001e42]" />
                                      </div>
                                      <div>
                                        <div className="text-sm font-bold text-[#001e42]">
                                          {row.driverName}
                                        </div>
                                        <div className="text-[10px] tabular-nums text-slate-400">
                                          {row.vehicleLabel}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-6 py-4 text-center">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                        row.role === 'Primary'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-blue-100 text-blue-700'
                                      }`}
                                    >
                                      {row.role}
                                    </span>
                                  </td>

                                  <td className="px-6 py-4 text-right text-sm font-medium tabular-nums">
                                    {currency(row.baseRate)}
                                  </td>

                                  <td className="px-6 py-4">
                                    <Select
                                      value={row.splitType}
                                      onValueChange={(value: SplitType) => {
                                        setSplitRows((prev) =>
                                          prev.map((item, i) =>
                                            i === index ? { ...item, splitType: value } : item
                                          )
                                        )
                                      }}
                                    >
                                      <SelectTrigger className="border-0 bg-transparent text-xs font-bold text-[#001e42] shadow-none focus:ring-0">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="flat_fee">Flat Fee (R)</SelectItem>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="mileage_bonus">Mileage Bonus</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>

                                  <td className="px-6 py-4 text-right">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={row.allocationValue}
                                      onChange={(e) => {
                                        const next = Number(e.target.value || 0)
                                        setSplitRows((prev) =>
                                          prev.map((item, i) =>
                                            i === index ? { ...item, allocationValue: next } : item
                                          )
                                        )
                                      }}
                                      className="ml-auto w-28 border-0 bg-transparent text-right font-headline text-sm font-bold shadow-none focus-visible:ring-1 focus-visible:ring-[#001e42]"
                                    />
                                  </td>

                                  <td
                                    className={`px-6 py-4 text-right text-sm font-bold tabular-nums ${
                                      overCap ? 'text-rose-700' : 'text-[#001e42]'
                                    }`}
                                  >
                                    {overCap ? 'Exceeds Cap' : currency(total)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-sm border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <Truck className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="text-base font-semibold text-[#001e42]">
                        No trip assignment sets available
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Add the primary and handover vehicle assignments on the trip first, then the
                        money split can be allocated here.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 rounded-sm bg-slate-100 p-6 md:col-span-4">
                      <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500">
                        Allocation Health
                      </h3>
                      <div className="mb-1 text-3xl font-extrabold text-[#001e42]">
                        {amountToSplit > 0
                          ? `${Math.max(0, Math.min(100, (allocatedTotal / amountToSplit) * 100)).toFixed(1)}%`
                          : '0.0%'}
                      </div>
                      <p className="text-xs font-medium text-slate-600">
                        Funds allocated against the entered split value.
                      </p>
                    </div>

                    <div className="col-span-12 flex items-center justify-between rounded-sm bg-[#001e42] p-6 text-white md:col-span-8">
                      <div>
                        <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-white/60">
                          Route Summary
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-8">
                          <div>
                            <div className="font-headline text-2xl font-bold">{currency(amountToSplit)}</div>
                            <div className="text-[10px] font-bold uppercase text-white/50">
                              Amount To Split
                            </div>
                          </div>
                          <div>
                            <div className="font-headline text-2xl font-bold">
                              {currency(allocatedTotal)}
                            </div>
                            <div className="text-[10px] font-bold uppercase text-white/50">
                              Allocated Expenses
                            </div>
                          </div>
                          <div>
                            <div
                              className={`font-headline text-2xl font-bold ${
                                unallocated >= 0 ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {currency(unallocated)}
                            </div>
                            <div className="text-[10px] font-bold uppercase text-white/50">
                              Unallocated Funds
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="hidden rounded-full bg-white/10 p-4 md:block">
                        <CircleDollarSign className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'handover' && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Settlement Review
                    </div>
                    <h3 className="font-headline text-3xl font-black tracking-tight text-[#001e42]">
                      Handover Logs
                    </h3>
                    <p className="max-w-2xl text-sm text-slate-600">
                      Detailed review of external handover allocations and segment settlements.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    {handovers.length ? (
                      handovers.map((log) => (
                        <div
                          key={log.id}
                          className="relative overflow-hidden border-l-4 border-blue-300 bg-slate-100 p-6 shadow-sm"
                        >
                          <div className="mb-6 flex items-center justify-between">
                            <span className="rounded bg-blue-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">
                              Segment: {log.segmentId}
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                              {log.weightPercent.toFixed(1)}% Weight
                            </span>
                          </div>

                          <h4 className="font-headline mb-4 text-xl font-extrabold text-[#001e42]">
                            {log.company}
                          </h4>

                          <div className="space-y-4">
                            <div className="flex items-end justify-between border-b border-slate-200 pb-2">
                              <span className="text-xs text-slate-500">Line Haul Fee</span>
                              <span className="font-bold tabular-nums">{currency(log.lineHaulFee)}</span>
                            </div>
                            <div className="flex items-end justify-between border-b border-slate-200 pb-2">
                              <span className="text-xs text-slate-500">Tolls & Surcharges</span>
                              <span className="font-bold tabular-nums text-rose-700">
                                +{currency(log.tolls)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-[#001e42]">
                                Final Allocation
                              </span>
                              <span className="font-headline text-2xl font-black tabular-nums text-[#001e42]">
                                {currency(log.finalAllocation)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-6">
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              {log.status || 'Complete'}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                        No handover records available for this trip yet.
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#001e42]">
                      <MapPin className="h-4 w-4" />
                      Route and settlement context
                    </div>
                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-widest text-slate-500">Origin</div>
                        <div className="mt-1 font-bold text-slate-900">{record?.origin || 'N/A'}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-widest text-slate-500">
                          Destination
                        </div>
                        <div className="mt-1 font-bold text-slate-900">
                          {record?.destination || 'N/A'}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-widest text-slate-500">
                          Actual Duration
                        </div>
                        <div className="mt-1 font-bold text-slate-900">
                          {minutesToText(record?.actual_duration_minutes)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-8">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Grand Total
                    </div>
                    <div className="font-headline text-2xl font-black text-[#001e42]">
                      {currency(allocatedTotal)}
                    </div>
                  </div>

                  <div className="h-10 w-px bg-slate-200" />

                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Unallocated Funds
                    </div>
                    <div
                      className={`font-headline text-2xl font-black ${
                        unallocated >= 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {currency(Math.abs(unallocated))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  {saveError ? (
                    <div className="self-center text-sm font-medium text-rose-700">{saveError}</div>
                  ) : !hasAssignments ? (
                    <div className="self-center text-sm font-medium text-amber-700">
                      This trip needs a saved primary or handover assignment before the split can be saved.
                    </div>
                  ) : !canSave ? (
                    <div className="self-center text-sm font-medium text-amber-700">
                      Remaining must be {currency(0)} before saving.
                    </div>
                  ) : null}
                  <Button variant="outline" onClick={() => setActiveTab('summary')}>
                    Trip Summary
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('primary')}>
                    Primary Split
                  </Button>
                  <Button
                    className="bg-[#001e42] text-white hover:bg-[#0b2955]"
                    onClick={handleSaveAllocation}
                    disabled={isSaving || !onSaveAllocation || !canSave}
                  >
                    {isSaving ? 'Saving...' : 'Save Allocation'}
                  </Button>
                </div>
              </div>
            </footer>
          </div>
      </DialogContent>
    </Dialog>
  )
}
