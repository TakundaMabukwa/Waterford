/* eslint-disable @typescript-eslint/no-explicit-any */
export type AuditSplitType = 'percentage' | 'flat_fee' | 'mileage_bonus'
export type AuditCurrencyCode =
  | 'DZD'
  | 'AOA'
  | 'BWP'
  | 'BIF'
  | 'XOF'
  | 'CVE'
  | 'XAF'
  | 'CDF'
  | 'DJF'
  | 'EGP'
  | 'ERN'
  | 'SZL'
  | 'ETB'
  | 'GMD'
  | 'GHS'
  | 'GNF'
  | 'KES'
  | 'LSL'
  | 'LRD'
  | 'LYD'
  | 'MGA'
  | 'MWK'
  | 'MRU'
  | 'MUR'
  | 'MAD'
  | 'MZN'
  | 'NAD'
  | 'NGN'
  | 'RWF'
  | 'STN'
  | 'SCR'
  | 'SLE'
  | 'SOS'
  | 'ZAR'
  | 'SSP'
  | 'SDG'
  | 'TZS'
  | 'TND'
  | 'UGX'
  | 'ZMW'
  | 'ZWL'
  | 'USD'
  | 'EUR'
  | 'GBP'

export const AFRICAN_CURRENCY_OPTIONS: Array<{ code: AuditCurrencyCode; label: string }> = [
  { code: 'DZD', label: 'DZD - Algerian Dinar' },
  { code: 'AOA', label: 'AOA - Angolan Kwanza' },
  { code: 'BWP', label: 'BWP - Botswana Pula' },
  { code: 'BIF', label: 'BIF - Burundian Franc' },
  { code: 'XOF', label: 'XOF - West African CFA Franc' },
  { code: 'CVE', label: 'CVE - Cape Verdean Escudo' },
  { code: 'XAF', label: 'XAF - Central African CFA Franc' },
  { code: 'CDF', label: 'CDF - Congolese Franc' },
  { code: 'DJF', label: 'DJF - Djiboutian Franc' },
  { code: 'EGP', label: 'EGP - Egyptian Pound' },
  { code: 'ERN', label: 'ERN - Eritrean Nakfa' },
  { code: 'SZL', label: 'SZL - Eswatini Lilangeni' },
  { code: 'ETB', label: 'ETB - Ethiopian Birr' },
  { code: 'GMD', label: 'GMD - Gambian Dalasi' },
  { code: 'GHS', label: 'GHS - Ghanaian Cedi' },
  { code: 'GNF', label: 'GNF - Guinean Franc' },
  { code: 'KES', label: 'KES - Kenyan Shilling' },
  { code: 'LSL', label: 'LSL - Lesotho Loti' },
  { code: 'LRD', label: 'LRD - Liberian Dollar' },
  { code: 'LYD', label: 'LYD - Libyan Dinar' },
  { code: 'MGA', label: 'MGA - Malagasy Ariary' },
  { code: 'MWK', label: 'MWK - Malawian Kwacha' },
  { code: 'MRU', label: 'MRU - Mauritanian Ouguiya' },
  { code: 'MUR', label: 'MUR - Mauritian Rupee' },
  { code: 'MAD', label: 'MAD - Moroccan Dirham' },
  { code: 'MZN', label: 'MZN - Mozambican Metical' },
  { code: 'NAD', label: 'NAD - Namibian Dollar' },
  { code: 'NGN', label: 'NGN - Nigerian Naira' },
  { code: 'RWF', label: 'RWF - Rwandan Franc' },
  { code: 'STN', label: 'STN - Sao Tome and Principe Dobra' },
  { code: 'SCR', label: 'SCR - Seychellois Rupee' },
  { code: 'SLE', label: 'SLE - Sierra Leone Leone' },
  { code: 'SOS', label: 'SOS - Somali Shilling' },
  { code: 'ZAR', label: 'ZAR - South African Rand' },
  { code: 'SSP', label: 'SSP - South Sudanese Pound' },
  { code: 'SDG', label: 'SDG - Sudanese Pound' },
  { code: 'TZS', label: 'TZS - Tanzanian Shilling' },
  { code: 'TND', label: 'TND - Tunisian Dinar' },
  { code: 'UGX', label: 'UGX - Ugandan Shilling' },
  { code: 'ZMW', label: 'ZMW - Zambian Kwacha' },
  { code: 'ZWL', label: 'ZWL - Zimbabwean Dollar' },
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - British Pound' },
]

export type AuditSplitRow = {
  id: string
  rowType?: 'assignment' | 'custom'
  driverId?: string | number | null
  driverName: string
  vehicleLabel: string
  vehiclePlate?: string
  categoryKey?: string
  categoryLabel?: string
  role: 'Primary' | 'Handover' | 'Custom'
  baseRate: number
  splitType: AuditSplitType
  allocationValue: number
  assignmentGroup?: 'vehicleassignments' | 'handed_vehicleassignments'
  assignmentIndex?: number
  driverIndex?: number
  distance?: number
  cap?: number
  fuelUsedLiters?: number
  currentFuelLiters?: number
  fuelLevelPercentage?: number
}

export type AuditHandoverLog = {
  id: string
  segmentId: string
  company: string
  weightPercent: number
  lineHaulFee: number
  tolls: number
  finalAllocation: number
  status?: string
}

export type AuditFinanceEntry = {
  id: string
  categoryKey: string
  label: string
  group: 'fuel' | 'vehicle' | 'driver' | 'finance' | 'other'
  plannedAmount: number
  actualAmount: number
  source: 'load_plan' | 'excel' | 'custom'
  notes?: string
}

export const parseJsonArray = (value: any) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export const parseJsonObject = (value: any) => {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

export const toNumber = (value: any) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const normalizeCurrency = (value: any): AuditCurrencyCode => {
  const next = String(value || 'ZAR').toUpperCase()
  if (AFRICAN_CURRENCY_OPTIONS.some((item) => item.code === next)) {
    return next as AuditCurrencyCode
  }
  return 'ZAR'
}

export const calcSplitTotal = (row: AuditSplitRow) => {
  if (row.splitType === 'percentage') return (row.baseRate * row.allocationValue) / 100
  if (row.splitType === 'flat_fee') return row.allocationValue
  return row.baseRate + row.allocationValue
}

export const getAssignmentTrailers = (assignment: any) => {
  const trailers = parseJsonArray(assignment?.trailers)
  if (trailers.length) return trailers
  return assignment?.trailer ? [assignment.trailer] : []
}

export const getAssignmentVehicleLabel = (assignment: any) => {
  const vehicleName = assignment?.vehicle?.name || assignment?.vehicle?.registration || 'Unassigned Vehicle'
  const trailerNames = getAssignmentTrailers(assignment)
    .map((trailer: any) => trailer?.name)
    .filter(Boolean)

  return trailerNames.length ? `${vehicleName} / ${trailerNames.join(' + ')}` : vehicleName
}

export const getAssignmentVehiclePlate = (assignment: any) =>
  String(
    assignment?.vehicle?.registration_number ||
      assignment?.vehicle?.plate ||
      assignment?.vehicle?.name ||
      ''
  )
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

export const getDriverDisplayName = (driver: any) =>
  driver?.name ||
  [driver?.first_name, driver?.surname].filter(Boolean).join(' ') ||
  [driver?.firstName, driver?.lastName].filter(Boolean).join(' ') ||
  'Unassigned Driver'

export const getAssignmentDriverLabel = (assignment: any) => {
  const drivers = parseJsonArray(assignment?.drivers)
  if (!drivers.length) return 'Unassigned Driver'
  return drivers.map(getDriverDisplayName).filter(Boolean).join(' / ')
}

export const inferAmountToSplit = (record: any) => {
  const savedRows = parseJsonArray(record?.split_allocations)
  if (savedRows.length) return toNumber(record?.amount_to_split ?? record?.actual_rate ?? 0)
  return toNumber(record?.actual_rate ?? 0)
}

export const defaultFinanceCategoryCatalog = [
  { categoryKey: 'fuel_cost', label: 'Fuel Cost', group: 'fuel', source: 'load_plan' },
  { categoryKey: 'vehicle_cost', label: 'Vehicle Cost', group: 'vehicle', source: 'load_plan' },
  { categoryKey: 'driver_cost', label: 'Driver Cost', group: 'driver', source: 'load_plan' },
  { categoryKey: 'depreciation', label: 'Depreciation', group: 'finance', source: 'excel' },
  { categoryKey: 'insurance_vehicles', label: 'Insurance - Vehicles', group: 'finance', source: 'excel' },
  { categoryKey: 'interest_instalment', label: 'Interest Expense - Instalment Sales', group: 'finance', source: 'excel' },
  { categoryKey: 'licensing_roadworthy', label: 'Licensing / Roadworthy', group: 'finance', source: 'excel' },
  { categoryKey: 'repairs_maintenance', label: 'Repairs & Maintenance', group: 'finance', source: 'excel' },
  { categoryKey: 'parking', label: 'Parking', group: 'finance', source: 'excel' },
  { categoryKey: 'tolls', label: 'Tolls', group: 'other', source: 'custom' },
  { categoryKey: 'unallocated_funds', label: 'Unallocated Funds', group: 'other', source: 'custom' },
  { categoryKey: 'other', label: 'Other', group: 'other', source: 'custom' },
] as const

export const buildFinanceEntries = (record: any): AuditFinanceEntry[] => {
  const savedEntries = parseJsonArray(record?.finance_entries)

  const defaults: AuditFinanceEntry[] = defaultFinanceCategoryCatalog.map((item) => {
    let plannedAmount = 0
    let actualAmount = 0

    if (item.categoryKey === 'fuel_cost') {
      plannedAmount = toNumber(record?.planned_fuel_cost)
      actualAmount = toNumber(record?.fuel_cost_total ?? record?.actual_fuel_cost)
    } else if (item.categoryKey === 'vehicle_cost') {
      plannedAmount = toNumber(record?.planned_vehicle_cost)
      actualAmount = toNumber(record?.actual_vehicle_cost)
    } else if (item.categoryKey === 'driver_cost') {
      plannedAmount = toNumber(record?.planned_driver_cost)
      actualAmount = toNumber(record?.actual_driver_cost)
    }

    return {
      id: item.categoryKey,
      categoryKey: item.categoryKey,
      label: item.label,
      group: item.group,
      plannedAmount,
      actualAmount,
      source: item.source,
      notes: '',
    }
  })

  if (!savedEntries.length) return defaults

  const savedByKey = new Map(savedEntries.map((entry: any) => [entry?.categoryKey || entry?.id, entry]))
  const mergedDefaults = defaults.map((entry) => {
    const saved = savedByKey.get(entry.categoryKey)
    if (!saved) return entry

    const useLiveFuelActual = entry.categoryKey === 'fuel_cost'
    return {
      ...entry,
      id: saved.id || entry.id,
      label: saved.label || entry.label,
      actualAmount: useLiveFuelActual ? entry.actualAmount : toNumber(saved.actualAmount),
      plannedAmount: saved.plannedAmount != null ? toNumber(saved.plannedAmount) : entry.plannedAmount,
      notes: saved.notes || '',
    }
  })

  const customEntries = savedEntries
    .filter((entry: any) => !defaultFinanceCategoryCatalog.some((item) => item.categoryKey === entry?.categoryKey))
    .map((entry: any, index: number) => ({
      id: entry?.id || `custom-${index}`,
      categoryKey: entry?.categoryKey || `custom-${index}`,
      label: entry?.label || 'Custom Category',
      group: entry?.group || 'other',
      plannedAmount: toNumber(entry?.plannedAmount),
      actualAmount: toNumber(entry?.actualAmount),
      source: entry?.source || 'custom',
      notes: entry?.notes || '',
    }))

  return [...mergedDefaults, ...customEntries]
}

export const buildAssignmentSplitData = (record: any) => {
  const primaryAssignments = parseJsonArray(record?.vehicleassignments)
  const handoverAssignments = parseJsonArray(record?.handed_vehicleassignments)
  const totalAmount = inferAmountToSplit(record)
  const savedRows = parseJsonArray(record?.split_allocations)
  const savedHandoverLogs = parseJsonArray(record?.split_handover_logs)
  const fuelBreakdown = parseJsonArray(record?.fuel_breakdown)
  const fuelByPlate = new Map(
    fuelBreakdown.map((entry: any) => [
      String(entry?.plate || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ''),
      entry,
    ])
  )

  const buildRows = (
    assignments: any[],
    role: 'Primary' | 'Handover',
    assignmentGroup: 'vehicleassignments' | 'handed_vehicleassignments'
  ) =>
    assignments.flatMap((assignment, assignmentIndex) => {
      const drivers = parseJsonArray(assignment?.drivers)
      const normalizedDrivers = drivers.length ? drivers : [{ id: null, name: 'Unassigned Driver' }]
      const vehicleLabel = getAssignmentVehicleLabel(assignment)
      const vehiclePlate = getAssignmentVehiclePlate(assignment)
      const fuelEntry = fuelByPlate.get(vehiclePlate)
      const defaultPerDriver = normalizedDrivers.length > 0 ? totalAmount / normalizedDrivers.length : totalAmount

      return normalizedDrivers.map((driver, driverIndex) => {
        const savedRow = savedRows.find(
          (item: any) =>
            item?.assignmentGroup === assignmentGroup &&
            Number(item?.assignmentIndex) === assignmentIndex &&
            Number(item?.driverIndex ?? 0) === driverIndex
        )

        const splitType = (savedRow?.splitType || 'flat_fee') as AuditSplitType
        const savedAmount = toNumber(savedRow?.amount)
        const baseRate =
          splitType === 'percentage'
            ? Math.max(totalAmount, savedAmount || defaultPerDriver)
            : savedRow?.baseRate != null
              ? toNumber(savedRow?.baseRate)
              : defaultPerDriver
        const allocationValue =
          splitType === 'percentage'
            ? toNumber(savedRow?.allocationValue || 100)
            : splitType === 'mileage_bonus'
              ? toNumber(savedRow?.allocationValue)
              : savedAmount || defaultPerDriver

        return {
          id: `${assignmentGroup}-${assignmentIndex}-${driverIndex}`,
          rowType: 'assignment',
          driverId: driver?.id ?? null,
          driverName: getDriverDisplayName(driver),
          vehicleLabel,
          vehiclePlate,
          categoryKey: savedRow?.categoryKey || 'driver_cost',
          categoryLabel: savedRow?.categoryLabel || 'Driver Cost',
          role,
          baseRate,
          splitType,
          allocationValue,
          assignmentGroup,
          assignmentIndex,
          driverIndex,
          fuelUsedLiters: toNumber(fuelEntry?.fuel_used_liters),
          currentFuelLiters: toNumber(fuelEntry?.current_fuel_liters),
          fuelLevelPercentage: toNumber(fuelEntry?.fuel_level_percentage),
        } satisfies AuditSplitRow
      })
    })

  const assignmentRows = [
    ...buildRows(primaryAssignments, 'Primary', 'vehicleassignments'),
    ...buildRows(handoverAssignments, 'Handover', 'handed_vehicleassignments'),
  ]

  const customRows = savedRows
    .filter((item: any) => !item?.assignmentGroup || item?.rowType === 'custom' || item?.role === 'Custom')
    .map((item: any, index: number) => ({
      id: item?.id || `custom-row-${index}`,
      rowType: 'custom',
      driverId: item?.driverId ?? null,
      driverName: item?.driverName || item?.label || 'Custom Item',
      vehicleLabel: item?.vehicleLabel || 'Standalone Item',
      vehiclePlate: item?.vehiclePlate || '',
      categoryKey: item?.categoryKey || 'other',
      categoryLabel: item?.categoryLabel || 'Other',
      role: 'Custom' as const,
      baseRate: item?.baseRate != null ? toNumber(item?.baseRate) : toNumber(item?.amount),
      splitType: (item?.splitType || 'flat_fee') as AuditSplitType,
      allocationValue:
        item?.allocationValue != null
          ? toNumber(item?.allocationValue)
          : toNumber(item?.amount),
      fuelUsedLiters: toNumber(item?.fuelUsedLiters),
      currentFuelLiters: toNumber(item?.currentFuelLiters),
      fuelLevelPercentage: toNumber(item?.fuelLevelPercentage),
    }))

  const splitRows = [...assignmentRows, ...customRows]

  const handoverLogs: AuditHandoverLog[] = savedHandoverLogs.length
    ? savedHandoverLogs
    : handoverAssignments.map((assignment, index) => {
        const matchingRows = splitRows.filter(
          (item) => item.assignmentGroup === 'handed_vehicleassignments' && item.assignmentIndex === index
        )
        const total = matchingRows.reduce((sum, row) => sum + calcSplitTotal(row), 0)

        return {
          id: `handover-log-${index}`,
          segmentId: `HANDOVER-${index + 1}`,
          company: getAssignmentDriverLabel(assignment),
          weightPercent: totalAmount > 0 ? (total / totalAmount) * 100 : 0,
          lineHaulFee: total,
          tolls: 0,
          finalAllocation: total,
          status: 'Allocated',
        }
      })

  return { splitRows, handoverLogs, totalAmount }
}

export const buildActualCostSummary = (financeEntries: AuditFinanceEntry[]) => {
  const totals = financeEntries.reduce(
    (acc, entry) => {
      acc.total += toNumber(entry.actualAmount)
      if (entry.categoryKey === 'fuel_cost') acc.actualFuelCost = toNumber(entry.actualAmount)
      if (entry.categoryKey === 'vehicle_cost') acc.actualVehicleCost = toNumber(entry.actualAmount)
      if (entry.categoryKey === 'driver_cost') acc.actualDriverCost = toNumber(entry.actualAmount)
      return acc
    },
    {
      total: 0,
      actualFuelCost: 0,
      actualVehicleCost: 0,
      actualDriverCost: 0,
    }
  )

  return totals
}

export const applySplitRowsToFinanceEntries = (
  financeEntries: AuditFinanceEntry[],
  splitRows: AuditSplitRow[]
) => {
  const totalsByCategory = splitRows.reduce((acc, row) => {
    const key = row.categoryKey || 'other'
    const label = row.categoryLabel || key
    const total = calcSplitTotal(row)

    if (!acc.has(key)) {
      acc.set(key, { total: 0, label })
    }

    const current = acc.get(key)!
    current.total += total
    if (!current.label && label) current.label = label
    return acc
  }, new Map<string, { total: number; label: string }>())

  const nextEntries = financeEntries.map((entry) => {
    const categoryTotal = totalsByCategory.get(entry.categoryKey)
    if (!categoryTotal) return entry

    return {
      ...entry,
      actualAmount: Math.round(categoryTotal.total * 100) / 100,
      label: categoryTotal.label || entry.label,
    }
  })

  const existingKeys = new Set(nextEntries.map((entry) => entry.categoryKey))
  const generatedEntries = Array.from(totalsByCategory.entries())
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value], index) => ({
      id: `generated-${key}-${index}`,
      categoryKey: key,
      label: value.label || key,
      group: 'other' as const,
      plannedAmount: 0,
      actualAmount: Math.round(value.total * 100) / 100,
      source: 'custom' as const,
      notes: '',
    }))

  return [...nextEntries, ...generatedEntries]
}
