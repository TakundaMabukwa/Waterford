/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  FileDown,
  Plus,
  Route,
  Trash2,
  Truck,
  User,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import TripRouteMap from '@/components/audit/TripRouteMap'
import {
  AFRICAN_CURRENCY_OPTIONS,
  AuditFinanceEntry,
  AuditHandoverLog,
  AuditCurrencyCode,
  AuditSplitRow,
  AuditSplitType,
  applySplitRowsToFinanceEntries,
  buildActualCostSummary,
  calcSplitTotal,
  normalizeCurrency,
  toNumber,
} from '@/lib/audit-utils'

const currency = (value: number | null | undefined, currencyCode: AuditCurrencyCode = 'ZAR') =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const numberFmt = (value: number | null | undefined, suffix = '') =>
  `${Number(value || 0).toLocaleString('en-ZA', {
    maximumFractionDigits: 2,
  })}${suffix}`

const formatEditableNumber = (value: number | null | undefined) => {
  const numericValue = Number(value || 0)
  return numericValue === 0 ? '' : String(value)
}

const parseEditableNumber = (value: string) => {
  const sanitized = value.replace(/[^0-9.-]/g, '')
  if (!sanitized.trim()) return 0
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : 0
}

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
  const v = Number(variance)
  if (type === 'distance') return `${Math.abs(v).toFixed(1)} km ${v >= 0 ? 'longer' : 'shorter'}`

  const abs = Math.abs(v)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const formatted = h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`
  return `${formatted} ${v >= 0 ? 'late' : 'early'}`
}

const getClientName = (record: any) => {
  if (record?.selectedclient || record?.selected_client) return record.selectedclient || record.selected_client
  const source = record?.clientdetails || record?.client_details
  if (!source) return 'N/A'
  try {
    const parsed = typeof source === 'string' ? JSON.parse(source) : source
    return parsed?.name || 'N/A'
  } catch {
    return 'N/A'
  }
}

const buildFallbackHandoverLogs = (splits: AuditSplitRow[]): AuditHandoverLog[] =>
  splits
    .filter((row) => row.role === 'Handover')
    .reduce((logs, row) => {
      const existing = logs.find((item) => item.segmentId === `${row.assignmentGroup}-${row.assignmentIndex}`)
      const total = calcSplitTotal(row)
      if (existing) {
        existing.finalAllocation += total
        existing.lineHaulFee += row.baseRate
        existing.weightPercent += row.baseRate > 0 ? (total / row.baseRate) * 100 : 0
        return logs
      }

      logs.push({
        id: row.id,
        segmentId: `${row.assignmentGroup}-${row.assignmentIndex}`,
        company: row.vehicleLabel,
        weightPercent: row.baseRate > 0 ? (total / row.baseRate) * 100 : 0,
        lineHaulFee: row.baseRate,
        tolls: Math.max(0, total - row.baseRate),
        finalAllocation: total,
        status: 'Complete',
      })
      return logs
    }, [] as AuditHandoverLog[])

const mergeHandoverLogs = (splits: AuditSplitRow[], savedLogs?: AuditHandoverLog[]) => {
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
          lineHaulFee: saved.lineHaulFee ?? log.lineHaulFee,
          finalAllocation: saved.finalAllocation ?? log.finalAllocation,
        }
      : log
  })
}

function WorkspaceTabButton({
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
        active ? 'bg-white text-[#001e42] shadow-sm' : 'text-slate-500 hover:bg-slate-100',
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

type Props = {
  record: any
  initialSplits: AuditSplitRow[]
  handoverLogs: AuditHandoverLog[]
  initialFinanceEntries: AuditFinanceEntry[]
  routeData?: any
  routeLoading?: boolean
  initialTab?: 'summary' | 'split' | 'finance' | 'route' | 'handover'
  onBack?: () => void
  onExport?: () => void
  onFinalAudit?: () => void
  onSaveAudit?: (payload: {
    amountToSplit: number
    actualRate: number
    actualCurrency: AuditCurrencyCode
    invoiceRate: number
    invoiceCurrency: AuditCurrencyCode
    splitRows: AuditSplitRow[]
    handoverLogs: AuditHandoverLog[]
    financeEntries: AuditFinanceEntry[]
  }) => Promise<void> | void
}

export default function AuditTripWorkspace({
  record,
  initialSplits,
  handoverLogs,
  initialFinanceEntries,
  routeData,
  routeLoading,
  initialTab = 'summary',
  onBack,
  onExport,
  onFinalAudit,
  onSaveAudit,
}: Props) {
  const [activeTab, setActiveTab] = useState<'summary' | 'split' | 'finance' | 'route' | 'handover'>(initialTab)
  const [splitRows, setSplitRows] = useState<AuditSplitRow[]>(initialSplits)
  const [financeEntries, setFinanceEntries] = useState<AuditFinanceEntry[]>(initialFinanceEntries)
  const [amountToSplit, setAmountToSplit] = useState(toNumber(record?.actual_rate ?? 0))
  const [actualRate, setActualRate] = useState(toNumber(record?.actual_rate ?? 0))
  const [actualCurrency, setActualCurrency] = useState<AuditCurrencyCode>(normalizeCurrency(record?.actual_currency ?? 'ZAR'))
  const [invoiceRate, setInvoiceRate] = useState(toNumber(record?.invoice_rate ?? record?.rate ?? 0))
  const [invoiceCurrency, setInvoiceCurrency] = useState<AuditCurrencyCode>(normalizeCurrency(record?.invoice_currency ?? record?.actual_currency ?? 'ZAR'))
  const [fxRate, setFxRate] = useState<number | null>(null)
  const [fxDate, setFxDate] = useState<string | null>(null)
  const [fxLoading, setFxLoading] = useState(false)
  const [fxError, setFxError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingSplitCategory, setPendingSplitCategory] = useState<string>('driver_cost')

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    setSplitRows(initialSplits)
  }, [initialSplits])

  useEffect(() => {
    setFinanceEntries(initialFinanceEntries)
  }, [initialFinanceEntries])

  useEffect(() => {
    const nextActualRate = toNumber(record?.actual_rate ?? 0)
    setActualRate(nextActualRate)
    setAmountToSplit(nextActualRate)
    setActualCurrency(normalizeCurrency(record?.actual_currency ?? 'ZAR'))
    setInvoiceRate(toNumber(record?.invoice_rate ?? record?.rate ?? 0))
    setInvoiceCurrency(normalizeCurrency(record?.invoice_currency ?? record?.actual_currency ?? 'ZAR'))
  }, [record])

  useEffect(() => {
    let cancelled = false

    const loadRate = async () => {
      if (actualCurrency === invoiceCurrency) {
        setFxRate(1)
        setFxDate(null)
        setFxError(null)
        return
      }

      try {
        setFxLoading(true)
        setFxError(null)
        const response = await fetch(`/api/exchange-rates?base=${actualCurrency}&target=${invoiceCurrency}`, {
          cache: 'no-store',
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load exchange rate')
        }

        if (!cancelled) {
          setFxRate(toNumber(data?.rate))
          setFxDate(data?.date || null)
        }
      } catch (error) {
        if (!cancelled) {
          setFxRate(null)
          setFxDate(null)
          setFxError(error instanceof Error ? error.message : 'Failed to load exchange rate')
        }
      } finally {
        if (!cancelled) {
          setFxLoading(false)
        }
      }
    }

    loadRate()

    return () => {
      cancelled = true
    }
  }, [actualCurrency, invoiceCurrency])

  const handovers = useMemo(() => mergeHandoverLogs(splitRows, handoverLogs), [handoverLogs, splitRows])
  const splitCategoryOptions = useMemo(
    () =>
      financeEntries.map((entry) => ({
        value: entry.categoryKey,
        label: entry.label,
      })),
    [financeEntries]
  )
  const splitCategoriesInUse = useMemo(
    () =>
      Array.from(
        new Map(
          splitRows
            .filter((row) => row.categoryKey && row.categoryKey !== 'unallocated_funds')
            .map((row) => [row.categoryKey, row.categoryLabel || row.categoryKey || 'Uncategorised'])
        ).entries()
      ).map(([key, label]) => ({ key, label })),
    [splitRows]
  )

  useEffect(() => {
    if (!splitCategoryOptions.length) return
    if (splitCategoryOptions.some((option) => option.value === pendingSplitCategory)) return
    setPendingSplitCategory(splitCategoryOptions[0].value)
  }, [pendingSplitCategory, splitCategoryOptions])
  const plannedRate = toNumber(record?.planned_rate ?? record?.rate)
  const plannedFuelCost = toNumber(record?.planned_fuel_cost)
  const plannedVehicleCost = toNumber(record?.planned_vehicle_cost)
  const plannedDriverCost = toNumber(record?.planned_driver_cost)
  const plannedTotalCost = toNumber(record?.planned_total_cost)
  const fuelUsedLiters = toNumber(record?.fuel_used_liters)
  const fuelFilledLiters = toNumber(record?.fuel_filled_liters)
  const fuelOperatingHours = toNumber(record?.fuel_operating_hours)
  const fuelLitersPerHour = toNumber(record?.fuel_liters_per_hour)
  const fuelLitersPerKm = toNumber(record?.fuel_liters_per_km)
  const fuelCostTotal = toNumber(record?.fuel_cost_total)
  const convertedActualToInvoice = fxRate != null ? actualRate * fxRate : null
  const myRate = invoiceCurrency === actualCurrency
    ? invoiceRate - actualRate
    : convertedActualToInvoice != null
      ? invoiceRate - convertedActualToInvoice
      : null
  const fuelBreakdown = Array.isArray(record?.fuel_breakdown) ? record.fuel_breakdown : []
  const effectiveFinanceEntries = useMemo(
    () => applySplitRowsToFinanceEntries(financeEntries, splitRows),
    [financeEntries, splitRows]
  )
  const actualCostSummary = useMemo(() => buildActualCostSummary(effectiveFinanceEntries), [effectiveFinanceEntries])
  const actualTotalCost = actualCostSummary.total
  const fundsBreakdown = useMemo(() => {
    const rows = effectiveFinanceEntries
      .map((entry) => ({
        key: entry.categoryKey,
        label: entry.label,
        amount: toNumber(entry.actualAmount),
      }))
      .filter((entry) => Math.abs(entry.amount) > 0.001)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

    const maxAmount = rows.length ? Math.max(...rows.map((entry) => Math.abs(entry.amount))) : 0

    return rows.map((entry) => ({
      ...entry,
      widthPercent: maxAmount > 0 ? Math.max((Math.abs(entry.amount) / maxAmount) * 100, 8) : 0,
      tone:
        entry.key === 'fuel_cost'
          ? 'bg-rose-500'
          : entry.key === 'vehicle_cost'
            ? 'bg-sky-500'
            : entry.key === 'driver_cost'
              ? 'bg-emerald-500'
              : entry.key === 'unallocated_funds'
                ? 'bg-amber-500'
                : 'bg-slate-500',
    }))
  }, [effectiveFinanceEntries])
  const net = invoiceRate - actualTotalCost
  const operatingRatio = invoiceRate > 0 ? actualTotalCost / invoiceRate : 0
  const visibleSplitRows = useMemo(
    () => splitRows.filter((row) => row.categoryKey !== 'unallocated_funds'),
    [splitRows]
  )
  const allocatedTotal = visibleSplitRows.reduce((sum, row) => sum + calcSplitTotal(row), 0)
  const unallocated = amountToSplit - allocatedTotal
  const canSaveSplit = splitRows.length > 0
  const routePoints = Array.isArray(routeData?.route_points) ? routeData.route_points : []

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
  }

  const handleAddFinanceCategory = () => {
    const categoryKey = `custom-${Date.now()}`
    const categoryLabel = `Custom Category ${financeEntries.filter((entry) => entry.source === 'custom').length + 1}`

    setFinanceEntries((prev) => [
      ...prev,
      {
        id: categoryKey,
        categoryKey,
        label: categoryLabel,
        group: 'other',
        plannedAmount: 0,
        actualAmount: 0,
        source: 'custom',
        notes: '',
      },
    ])
  }

  const handleAddCategoryToRow = (rowIndex: number) => {
    const categoryKey = `custom-${Date.now()}-${rowIndex}`
    const categoryLabel = `Custom Category ${financeEntries.filter((entry) => entry.source === 'custom').length + 1}`

    setFinanceEntries((prev) => [
      ...prev,
      {
        id: categoryKey,
        categoryKey,
        label: categoryLabel,
        group: 'other',
        plannedAmount: 0,
        actualAmount: 0,
        source: 'custom',
        notes: '',
      },
    ])

    setSplitRows((prev) =>
      prev.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              categoryKey,
              categoryLabel,
            }
          : row
      )
    )
  }

  const handleAddSplitItemRow = () => {
    const customCount = splitRows.filter((row) => row.rowType === 'custom').length + 1
    const selectedCategory = splitCategoryOptions.find((option) => option.value === pendingSplitCategory)
    setSplitRows((prev) => [
      ...prev,
      {
        id: `custom-row-${Date.now()}`,
        rowType: 'custom',
        driverId: null,
        driverName: selectedCategory?.label || `Custom Item ${customCount}`,
        vehicleLabel: 'Standalone Item',
        vehiclePlate: '',
        categoryKey: selectedCategory?.value || 'other',
        categoryLabel: selectedCategory?.label || 'Other',
        role: 'Custom',
        baseRate: 0,
        splitType: 'flat_fee',
        allocationValue: 0,
        fuelUsedLiters: 0,
        currentFuelLiters: 0,
        fuelLevelPercentage: 0,
      },
    ])
  }

  const handleSaveAudit = async () => {
    if (!onSaveAudit) return

    try {
      setIsSaving(true)
      const rowsWithoutUnallocated = splitRows.filter((row) => row.categoryKey !== 'unallocated_funds')
      const rowsToSave =
        Math.abs(unallocated) < 0.01
          ? rowsWithoutUnallocated
          : [
              ...rowsWithoutUnallocated,
              {
                id: 'unallocated-funds',
                rowType: 'custom' as const,
                driverId: null,
                driverName: 'Unallocated Funds',
                vehicleLabel: 'System Balance',
                vehiclePlate: '',
                categoryKey: 'unallocated_funds',
                categoryLabel: 'Unallocated Funds',
                role: 'Custom' as const,
                baseRate: 0,
                splitType: 'flat_fee' as const,
                allocationValue: unallocated,
                fuelUsedLiters: 0,
                currentFuelLiters: 0,
                fuelLevelPercentage: 0,
              },
            ]
      await onSaveAudit({
        amountToSplit,
        actualRate,
        actualCurrency,
        invoiceRate,
        invoiceCurrency,
        splitRows: rowsToSave,
        handoverLogs: handovers,
        financeEntries: applySplitRowsToFinanceEntries(financeEntries, rowsToSave),
      })
      toast.success('Audit saved successfully.', {
        description: 'Saved values will auto-fill when you return to this trip.',
      })
    } catch (error) {
      console.error('Failed to save audit:', error)
      toast.error('Could not save the audit right now.', {
        description: 'Please try again in a moment.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {onBack ? (
              <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 h-8 w-8 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Financial Reporting
              </div>
              <div className="truncate text-lg font-extrabold text-[#001e42]">
                {record?.trip_id || 'Trip Audit'}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>{record?.ordernumber || 'No order number'}</span>
                <span>{getClientName(record)}</span>
                <span>{record?.origin || 'N/A'} to {record?.destination || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={onExport}>
              <FileDown className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" className="bg-[#001e42] text-white hover:bg-[#0b2955]" onClick={onFinalAudit}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Final Audit
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Planned Rate</div>
            <div className="mt-1 text-lg font-extrabold text-[#001e42]">{currency(plannedRate)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Actual Rate</div>
            <div className="mt-1 text-lg font-extrabold text-amber-700">{currency(actualRate, actualCurrency)}</div>
            <div className="text-xs text-slate-500">{actualCurrency}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Invoice Rate</div>
            <div className="mt-1 text-lg font-extrabold text-slate-900">{currency(invoiceRate, invoiceCurrency)}</div>
            <div className="text-xs text-slate-500">{invoiceCurrency}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">My Rate</div>
            {myRate == null ? (
              <div className="mt-1 text-sm font-bold text-slate-500">Currency mismatch</div>
            ) : (
              <div className={`mt-1 text-lg font-extrabold ${myRate >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {currency(myRate, actualCurrency)}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Actual Fuel</div>
            <div className="mt-1 text-lg font-extrabold text-rose-700">{currency(fuelCostTotal)}</div>
            <div className="text-xs text-slate-500">{numberFmt(fuelUsedLiters, ' L')} used</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Actual</div>
            <div className="mt-1 text-lg font-extrabold text-[#001e42]">{currency(actualTotalCost)}</div>
            <div className={`text-xs ${unallocated === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              Remaining {currency(unallocated)}
            </div>
          </div>
        </section>

        <nav className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1.5">
          <WorkspaceTabButton active={activeTab === 'summary'} index="01" label="SUMMARY" onClick={() => setActiveTab('summary')} />
          <WorkspaceTabButton active={activeTab === 'split'} index="02" label="SPLIT" onClick={() => setActiveTab('split')} />
          <WorkspaceTabButton active={activeTab === 'finance'} index="03" label="FINANCES" onClick={() => setActiveTab('finance')} />
          <WorkspaceTabButton active={activeTab === 'route'} index="04" label="ROUTE" onClick={() => setActiveTab('route')} />
          <WorkspaceTabButton active={activeTab === 'handover'} index="05" label="HANDOVER" onClick={() => setActiveTab('handover')} />
        </nav>

        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-8">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Profitability Index</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-black tracking-tighter text-[#001e42]">{currency(net)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {net >= 0 ? 'Positive Margin' : 'Negative Margin'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Operating Ratio</p>
                    <p className="text-xl font-bold text-slate-900">{operatingRatio.toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 md:grid-cols-4">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Planned Rate</p>
                    <p className="text-lg font-bold text-slate-900">{currency(plannedRate)}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Invoice Rate</p>
                    <p className="text-lg font-bold text-slate-900">{currency(invoiceRate, invoiceCurrency)}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Actual Rate</p>
                    <p className="text-lg font-bold text-amber-700">{currency(actualRate, actualCurrency)}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">My Rate</p>
                    <p className={`text-lg font-bold ${myRate != null && myRate >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {myRate == null ? 'Currency mismatch' : currency(myRate, actualCurrency)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="col-span-12 flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-5 lg:col-span-4">
                <div>
                  <h3 className="mb-3 text-lg font-extrabold tracking-tight text-[#001e42]">Order Snapshot</h3>
                  <ul className="space-y-3">
                    <li className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm">
                      <span className="text-slate-500">Origin</span>
                      <span className="font-bold text-slate-900">{record?.origin || 'N/A'}</span>
                    </li>
                    <li className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm">
                      <span className="text-slate-500">Destination</span>
                      <span className="font-bold text-slate-900">{record?.destination || 'N/A'}</span>
                    </li>
                    <li className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm">
                      <span className="text-slate-500">Distance</span>
                      <span className="font-bold text-slate-900">{numberFmt(record?.actual_distance || record?.planned_distance, ' km')}</span>
                    </li>
                    <li className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm">
                      <span className="text-slate-500">Cargo</span>
                      <span className="font-bold text-slate-900">{record?.cargo || 'N/A'}</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <User className="h-5 w-5 text-[#001e42]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Primary Dispatcher</p>
                      <p className="text-sm font-bold text-[#001e42]">{record?.dispatcher_name || 'Not Assigned'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black tracking-tight text-[#001e42]">Cost And Fuel Breakdown</h3>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Planned vs Actual</div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                  <div className="text-xl font-black text-sky-700">{currency(actualCostSummary.actualVehicleCost)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Driver Cost</div>
                  <div className="mt-3 text-sm text-slate-500">Planned</div>
                  <div className="text-xl font-black text-slate-900">{currency(plannedDriverCost)}</div>
                  <div className="mt-3 text-sm text-slate-500">Actual</div>
                  <div className="text-xl font-black text-emerald-700">{currency(actualCostSummary.actualDriverCost)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trip Total</div>
                  <div className="mt-3 text-sm text-slate-500">Planned</div>
                  <div className="text-xl font-black text-slate-900">{currency(plannedTotalCost)}</div>
                  <div className="mt-3 text-sm text-slate-500">Actual</div>
                  <div className="text-xl font-black text-[#001e42]">{currency(actualTotalCost)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-[#001e42]">Funds Overview</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Saved split and finance values roll up here automatically when you return.
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {fundsBreakdown.length} categories
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {fundsBreakdown.length ? (
                      fundsBreakdown.map((item) => (
                        <div key={item.key} className="space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#001e42]">{item.label}</div>
                              <div className="text-xs text-slate-500">
                                {actualTotalCost > 0 ? `${((Math.abs(item.amount) / actualTotalCost) * 100).toFixed(1)}% of actual cost` : 'Saved allocation'}
                              </div>
                            </div>
                            <div className="text-sm font-black tabular-nums text-slate-900">
                              {currency(item.amount)}
                            </div>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${item.tone}`}
                              style={{ width: `${item.widthPercent}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        Save the split or finance lines and the funds chart will auto-fill here.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                  <h3 className="text-lg font-black tracking-tight text-[#001e42]">Saved Snapshot</h3>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Allocated Split</div>
                      <div className="mt-2 text-2xl font-black text-[#001e42]">{currency(allocatedTotal, actualCurrency)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Unallocated Funds</div>
                      <div className={`mt-2 text-2xl font-black ${unallocated >= 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {currency(Math.abs(unallocated), actualCurrency)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Finance Categories</div>
                      <div className="mt-2 text-2xl font-black text-[#001e42]">{effectiveFinanceEntries.length}</div>
                    </div>
                  </div>
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
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-lg font-black text-[#001e42]">Per Vehicle Fuel Breakdown</h4>
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
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">{getVarianceLabel(record?.start_time_variance_minutes, 'time')}</Badge>
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-6 py-4 font-medium">Finish Time</td>
                      <td className="px-6 py-4">{fmtDateTime(record?.planned_finish_time)}</td>
                      <td className="px-6 py-4">{fmtDateTime(record?.actual_finish_time)}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">{getVarianceLabel(record?.finish_time_variance_minutes, 'time')}</Badge>
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-6 py-4 font-medium">Distance</td>
                      <td className="px-6 py-4">{numberFmt(record?.planned_distance, ' km')}</td>
                      <td className="px-6 py-4">{numberFmt(record?.actual_distance || record?.distance, ' km')}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">{getVarianceLabel(record?.distance_variance, 'distance')}</Badge>
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-6 py-4 font-medium">Duration</td>
                      <td className="px-6 py-4">{minutesToText(record?.planned_duration_minutes)}</td>
                      <td className="px-6 py-4">{minutesToText(record?.actual_duration_minutes)}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">{getVarianceLabel(record?.duration_variance_minutes, 'time')}</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'split' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 xl:grid-cols-12">
              <div className="rounded-lg bg-slate-50 p-4 sm:p-5 xl:col-span-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Planned Rate</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{currency(plannedRate)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 sm:p-5 xl:col-span-3">
                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Actual Rate</div>
                <div className="space-y-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={formatEditableNumber(actualRate)}
                    onChange={(e) => {
                      const next = parseEditableNumber(e.target.value)
                      setActualRate(next)
                      setAmountToSplit(next)
                    }}
                    className="h-11 text-base font-bold sm:text-lg"
                  />
                  <Select value={actualCurrency} onValueChange={(value: AuditCurrencyCode) => setActualCurrency(value)}>
                    <SelectTrigger className="h-11 font-semibold">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {AFRICAN_CURRENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-slate-500">
                    Split currency: <span className="font-semibold text-slate-700">{actualCurrency}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4 sm:p-5 xl:col-span-3">
                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Invoice Rate</div>
                <div className="space-y-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={formatEditableNumber(invoiceRate)}
                    onChange={(e) => setInvoiceRate(parseEditableNumber(e.target.value))}
                    className="h-11 text-base font-bold sm:text-lg"
                  />
                  <Select value={invoiceCurrency} onValueChange={(value: AuditCurrencyCode) => setInvoiceCurrency(value)}>
                    <SelectTrigger className="h-11 font-semibold">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {AFRICAN_CURRENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-slate-500">
                    Invoice currency: <span className="font-semibold text-slate-700">{invoiceCurrency}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 sm:p-5 xl:col-span-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">My Rate</div>
                <div className={`mt-2 text-2xl font-black ${myRate != null && myRate >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {fxLoading ? 'Loading...' : myRate == null ? 'Currency mismatch' : currency(myRate, invoiceCurrency)}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {actualCurrency === invoiceCurrency
                    ? 'Same currency selected'
                    : fxError
                      ? fxError
                      : fxDate
                        ? `Reference rate date ${fxDate}`
                        : 'Latest reference rate'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount To Split</div>
                <div className="mt-2 text-2xl font-black text-[#001e42]">{currency(amountToSplit, actualCurrency)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Allocated</div>
                <div className="mt-2 text-2xl font-black text-[#001e42]">{currency(allocatedTotal, actualCurrency)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Remaining</div>
                <div className={`mt-2 text-2xl font-black ${unallocated >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{currency(unallocated, actualCurrency)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actual In Invoice Currency</div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                  {convertedActualToInvoice != null ? currency(convertedActualToInvoice, invoiceCurrency) : 'Unavailable'}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Split rows are built per driver across the primary and handover vehicle sets. Enter the actual
              rate, then allocate it until the remaining value reaches exactly <span className="font-bold text-slate-900">{currency(0, actualCurrency)}</span>.
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live FX Rate</div>
                <div className="mt-2 text-lg font-black text-[#001e42] sm:text-2xl">
                  {fxLoading ? 'Loading...' : fxRate != null ? `1 ${actualCurrency} = ${fxRate.toFixed(4)} ${invoiceCurrency}` : 'Unavailable'}
                </div>
                <div className="mt-1 text-xs text-slate-500">{fxDate ? `Latest reference date ${fxDate}` : 'Updates when currency changes'}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actual In Invoice Currency</div>
                <div className="mt-2 text-lg font-black text-slate-900 sm:text-2xl">
                  {convertedActualToInvoice != null ? currency(convertedActualToInvoice, invoiceCurrency) : 'Unavailable'}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Conversion Status</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {fxError ? fxError : actualCurrency === invoiceCurrency ? 'Same currency selected' : 'Latest reference rate applied'}
                </div>
              </div>
            </div>

            {visibleSplitRows.length ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={handleDistributeEvenly}>Distribute Evenly</Button>
                  <div className="flex items-center gap-2">
                    <Select value={pendingSplitCategory} onValueChange={setPendingSplitCategory}>
                      <SelectTrigger className="h-10 min-w-[240px] border-slate-200 bg-white text-sm font-medium text-slate-700">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                  {splitCategoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleAddSplitItemRow}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Row
                    </Button>
                  </div>
                  {splitCategoriesInUse.length ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {splitCategoriesInUse.map((category) => (
                        <Badge key={category.key} variant="secondary" className="bg-slate-100 text-slate-700">
                          {category.label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-[1140px] w-full border-collapse text-left">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Driver</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Vehicle Set</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Category</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Role</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Base Rate</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Split Type</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Allocation</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Total</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleSplitRows.map((row, index) => (
                        <tr key={row.id} className={`hover:bg-slate-50 ${row.rowType === 'custom' ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${row.rowType === 'custom' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                                <User className={`h-4 w-4 ${row.rowType === 'custom' ? 'text-amber-700' : 'text-[#001e42]'}`} />
                              </div>
                              <div>
                                {row.rowType === 'custom' ? (
                                  <Input
                                    value={row.driverName}
                                    onChange={(e) => {
                                      const next = e.target.value
                                      setSplitRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, driverName: next } : item)))
                                    }}
                                    className="h-9 min-w-[180px] border-slate-200 bg-white text-sm font-bold text-[#001e42]"
                                  />
                                ) : (
                                  <>
                                    <div className="text-sm font-bold text-[#001e42]">{row.driverName}</div>
                                    <div className="text-xs text-slate-500">
                                      Fuel used: {numberFmt(row.fuelUsedLiters, ' L')} | Current fuel: {numberFmt(row.currentFuelLiters, ' L')}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {row.rowType === 'custom' ? (
                              <Input
                                value={row.vehicleLabel}
                                onChange={(e) => {
                                  const next = e.target.value
                                  setSplitRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, vehicleLabel: next } : item)))
                                }}
                                className="h-9 min-w-[180px] border-slate-200 bg-white text-sm font-medium text-slate-800"
                              />
                            ) : (
                              <>
                                <div className="font-medium text-slate-800">{row.vehicleLabel}</div>
                                <div className="text-xs text-slate-500">
                                  {row.vehiclePlate || 'No plate'}{row.fuelLevelPercentage ? ` | ${numberFmt(row.fuelLevelPercentage, '%')}` : ''}
                                </div>
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Select
                                value={row.categoryKey || 'driver_cost'}
                                onValueChange={(value) => {
                                  const selectedCategory = splitCategoryOptions.find((item) => item.value === value)
                                  setSplitRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? {
                                            ...item,
                                            categoryKey: value,
                                            categoryLabel: selectedCategory?.label || value,
                                          }
                                        : item
                                    )
                                  )
                                }}
                              >
                                <SelectTrigger className="h-10 min-w-[220px] border-slate-200 bg-white text-sm font-medium text-slate-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {splitCategoryOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() => handleAddCategoryToRow(index)}
                                title="Add category to this row"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              row.role === 'Primary'
                                ? 'bg-emerald-100 text-emerald-700'
                                : row.role === 'Handover'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                            }`}>
                              {row.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatEditableNumber(row.baseRate)}
                              onChange={(e) => {
                                const next = parseEditableNumber(e.target.value)
                                setSplitRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, baseRate: next } : item)))
                              }}
                              className="ml-auto h-10 w-28 border border-slate-200 bg-white text-right text-sm font-bold tabular-nums shadow-sm focus-visible:ring-1 focus-visible:ring-[#001e42]"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <Select
                              value={row.splitType}
                              onValueChange={(value: AuditSplitType) => {
                                setSplitRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, splitType: value } : item)))
                              }}
                            >
                              <SelectTrigger className="border-0 bg-transparent text-xs font-bold text-[#001e42] shadow-none focus:ring-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="flat_fee">Flat Fee ({actualCurrency})</SelectItem>
                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                                <SelectItem value="mileage_bonus">Mileage Bonus</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatEditableNumber(row.allocationValue)}
                              onChange={(e) => {
                                const next = parseEditableNumber(e.target.value)
                                setSplitRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, allocationValue: next } : item)))
                              }}
                              className="ml-auto h-10 w-28 border border-slate-200 bg-white text-right text-sm font-bold tabular-nums shadow-sm focus-visible:ring-1 focus-visible:ring-[#001e42]"
                            />
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-bold tabular-nums text-[#001e42]">{currency(calcSplitTotal(row), actualCurrency)}</td>
                          <td className="px-6 py-4 text-right">
                            {row.rowType === 'custom' ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSplitRows((prev) => prev.filter((item) => item.id !== row.id))
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-slate-500" />
                              </Button>
                            ) : (
                              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Assignment</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Truck className="h-5 w-5 text-slate-500" />
                </div>
                <div className="text-base font-semibold text-[#001e42]">No trip assignments available</div>
                <p className="mt-2 text-sm text-slate-600">Add the trip&apos;s primary and handover assignments first, then the split can be allocated here.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#001e42]">
                  <BarChart3 className="h-4 w-4" />
                  Excel-Aligned Categories
                </div>
                <h2 className="text-xl font-black tracking-tight text-[#001e42]">Financial Categories</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Update actual finance lines here. Default rows include the Excel-style vehicle cost
                  categories, and you can add your own custom lines as needed.
                </p>
              </div>
              <Button variant="outline" onClick={handleAddFinanceCategory}>
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Group</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Planned</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actual</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Notes</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {effectiveFinanceEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <Input
                          value={entry.label}
                          onChange={(e) => {
                            const next = e.target.value
                            setFinanceEntries((prev) =>
                              prev.map((item) => (item.categoryKey === entry.categoryKey ? { ...item, label: next } : item))
                            )
                          }}
                          className="border-0 bg-transparent px-0 font-semibold text-[#001e42] shadow-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <Select
                          value={entry.group}
                          onValueChange={(value: AuditFinanceEntry['group']) => {
                            setFinanceEntries((prev) =>
                              prev.map((item) => (item.categoryKey === entry.categoryKey ? { ...item, group: value } : item))
                            )
                          }}
                        >
                          <SelectTrigger className="h-9 border-0 bg-transparent px-0 text-sm capitalize text-slate-600 shadow-none focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fuel">Fuel</SelectItem>
                            <SelectItem value="vehicle">Vehicle</SelectItem>
                            <SelectItem value="driver">Driver</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-slate-700">{currency(entry.plannedAmount)}</td>
                      <td className="px-6 py-4 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={entry.actualAmount}
                          onChange={(e) => {
                            const next = Number(e.target.value || 0)
                            setFinanceEntries((prev) =>
                              prev.map((item) => (item.categoryKey === entry.categoryKey ? { ...item, actualAmount: next } : item))
                            )
                          }}
                          className="ml-auto w-32 border-0 bg-transparent text-right font-bold shadow-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <Input
                          value={entry.notes || ''}
                          onChange={(e) => {
                            const next = e.target.value
                            setFinanceEntries((prev) =>
                              prev.map((item) => (item.categoryKey === entry.categoryKey ? { ...item, notes: next } : item))
                            )
                          }}
                          placeholder="Optional note"
                          className="border-0 bg-transparent px-0 text-sm shadow-none"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {entry.source === 'custom' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setFinanceEntries((prev) => prev.filter((item) => item.categoryKey !== entry.categoryKey))
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-slate-500" />
                          </Button>
                        ) : (
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            {entry.source}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fuel Cost</div>
                <div className="mt-3 text-2xl font-black text-rose-700">{currency(actualCostSummary.actualFuelCost)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vehicle Cost</div>
                <div className="mt-3 text-2xl font-black text-sky-700">{currency(actualCostSummary.actualVehicleCost)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Driver Cost</div>
                <div className="mt-3 text-2xl font-black text-emerald-700">{currency(actualCostSummary.actualDriverCost)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Actual Cost</div>
                <div className="mt-3 text-2xl font-black text-[#001e42]">{currency(actualTotalCost)}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'route' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#001e42]">
                  <Route className="h-4 w-4" />
                  Accepted To Delivered Window
                </div>
                <h2 className="text-xl font-black tracking-tight text-[#001e42]">Tracked Route</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Route points are pulled from the tracking server and filtered to this trip&apos;s audit
                  window so the map reflects only the accepted-to-completed journey.
                </p>
              </div>
              <div className="text-right text-xs font-bold uppercase tracking-widest text-slate-500">
                {routeLoading ? 'Loading route...' : `${routePoints.length} tracked points`}
              </div>
            </div>

            <TripRouteMap routePoints={routePoints} />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trip Window Start</div>
                <div className="mt-3 text-sm font-bold text-slate-900">{fmtDateTime(routeData?.trip_window?.start_at || record?.accepted_at)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trip Window End</div>
                <div className="mt-3 text-sm font-bold text-slate-900">{fmtDateTime(routeData?.trip_window?.end_at || record?.actual_finish_time)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Actual Distance</div>
                <div className="mt-3 text-2xl font-black text-[#001e42]">{numberFmt(record?.actual_distance || record?.planned_distance, ' km')}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Duration</div>
                <div className="mt-3 text-2xl font-black text-[#001e42]">{minutesToText(record?.actual_duration_minutes)}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'handover' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Settlement Review</div>
              <h3 className="text-xl font-black tracking-tight text-[#001e42]">Handover Logs</h3>
              <p className="max-w-2xl text-sm text-slate-600">Detailed review of external handover allocations and segment settlements.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {handovers.length ? (
                handovers.map((log) => (
                  <div key={log.id} className="relative overflow-hidden rounded-xl border-l-4 border-blue-300 bg-slate-100 p-5 shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                      <span className="rounded bg-blue-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700">Segment: {log.segmentId}</span>
                      <span className="text-xs font-bold text-slate-500">{log.weightPercent.toFixed(1)}% Weight</span>
                    </div>
                    <h4 className="mb-4 text-xl font-extrabold text-[#001e42]">{log.company}</h4>
                    <div className="space-y-4">
                      <div className="flex items-end justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs text-slate-500">Line Haul Fee</span>
                        <span className="font-bold tabular-nums">{currency(log.lineHaulFee)}</span>
                      </div>
                      <div className="flex items-end justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs text-slate-500">Tolls & Surcharges</span>
                        <span className="font-bold tabular-nums text-rose-700">+{currency(log.tolls)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-[#001e42]">Final Allocation</span>
                        <span className="text-2xl font-black tabular-nums text-[#001e42]">{currency(log.finalAllocation)}</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{log.status || 'Complete'}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  No handover records available for this trip yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Amount To Split</div>
              <div className="text-lg font-black text-[#001e42]">{currency(amountToSplit, actualCurrency)}</div>
            </div>
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Total Actual Cost</div>
              <div className="text-lg font-black text-[#001e42]">{currency(actualTotalCost)}</div>
            </div>
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-slate-500">Unallocated Funds</div>
              <div className={`text-lg font-black ${unallocated >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{currency(Math.abs(unallocated), actualCurrency)}</div>
          </div>
          </div>

          <div className="flex items-center gap-3">
            {Math.abs(unallocated) >= 0.01 ? (
              <div className="text-sm font-medium text-amber-700">
                Remaining {currency(unallocated, actualCurrency)} will be saved under Unallocated Funds.
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setActiveTab('summary')}>Summary</Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('route')}>Route</Button>
            <Button size="sm" className="bg-[#001e42] text-white hover:bg-[#0b2955]" onClick={handleSaveAudit} disabled={isSaving || !onSaveAudit || !canSaveSplit}>
              {isSaving ? 'Saving...' : 'Save Audit'}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
