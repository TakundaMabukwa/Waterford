"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SecureButton } from '@/components/SecureButton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, CheckCircle, AlertTriangle, Clock, TrendingUp, Plus, Route, MapPin, Building2, GripVertical, Printer, Search } from 'lucide-react'
import { LoadconPrint, type LoadconPrintData } from '@/components/ui/loadcon-print'
import { generateLoadconPdf, uploadLoadconPdf, updateTripLoadconUrl, triggerPdfDownload, buildLoadconHTML, generateAndStoreLoadcon } from '@/lib/generate-loadcon-pdf'

import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { LocationAutocomplete } from '@/components/ui/location-autocomplete'
import { ProgressWithWaypoints } from '@/components/ui/progress-with-waypoints'
import { RouteOptimizer } from '@/components/ui/route-optimizer'
import { RouteTracker } from '@/components/ui/route-tracker'
import { RoutePreviewMap } from '@/components/ui/route-preview-map'
import { CreateStopPointModal } from '@/components/ui/create-stop-point-modal'
import { FuelStationModal } from '@/components/ui/fuel-station-modal-wrapper'
import { ClientFormDialog } from '@/components/ui/client-form-dialog'
import { QuickGeozoneDialog } from '@/components/ui/quick-geozone-dialog'
import { RouteConfirmationModal } from '@/components/ui/route-confirmation-modal'
import { RouteEditModal } from '@/components/ui/route-edit-modal'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { CommodityDropdown } from '@/components/ui/commodity-dropdown'
import { ClientDropdown } from '@/components/ui/client-dropdown'
import { ClientNameDisplay } from '@/components/ui/client-name-display'
import { ClientAddressPopup } from '@/components/ui/client-address-popup'
import { Toast } from '@/components/ui/toast'
import { DriverDropdown } from '@/components/ui/driver-dropdown'
import { VehicleDropdown } from '@/components/ui/vehicle-dropdown'
import { VehicleTypeDropdown } from '@/components/ui/vehicle-type-dropdown'
import { TrailerDropdown } from '@/components/ui/trailer-dropdown'
import { StopPointDropdown } from '@/components/ui/stop-point-dropdown'


export default function LoadPlanPage() {
  const supabase = createClient()
  const router = useRouter()
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error', isVisible: false })
  const [isEditMode, setIsEditMode] = useState(false)
  const [editTripId, setEditTripId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tripSearch, setTripSearch] = useState('')
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type, isVisible: true })
  }
  const hideToast = () => setToast(prev => ({ ...prev, isVisible: false }))
  const [loads, setLoads] = useState([
    {
      id: 'test-1',
      trip_id: 'TEST-123',
      client: 'Test Client',
      commodity: 'Test Cargo',
      rate: '1000',
      startdate: '2025-01-15',
      enddate: '2025-01-16',
      status: 'pending',
      vehicleassignments: []
    }
  ])
  const [clients, setClients] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [costCenters, setCostCenters] = useState([])
  const [availableDrivers, setAvailableDrivers] = useState([])
  const [vehicleTrackingData, setVehicleTrackingData] = useState([])

  // Create Load form state
  const [client, setClient] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [manualClientName, setManualClientName] = useState('')
  const [showAddressPopup, setShowAddressPopup] = useState(false)
  const [commodity, setCommodity] = useState('')
  const [costCenter, setCostCenter] = useState('')
  const [rate, setRate] = useState('0')
  const [orderNumber, setOrderNumber] = useState('')
  const [comment, setComment] = useState('')
  // Address & ETA section
  const [etaPickup, setEtaPickup] = useState('')
  const [loadingLocation, setLoadingLocation] = useState('')
  const [loadingLocationSelection, setLoadingLocationSelection] = useState<any | null>(null)
  const [etaDropoff, setEtaDropoff] = useState('')
  const [dropOffPoint, setDropOffPoint] = useState('')
  const [dropOffSelection, setDropOffSelection] = useState<any | null>(null)
  const [showSecondSection, setShowSecondSection] = useState(false)
  // Loading & Offloading Point details
  const [loadingPointCompany, setLoadingPointCompany] = useState('')
  const [loadingPointCity, setLoadingPointCity] = useState('')
  const [offloadingPointCompany, setOffloadingPointCompany] = useState('')
  const [offloadingPointCity, setOffloadingPointCity] = useState('')
  const secondRef = useRef<HTMLDivElement | null>(null)
  const locationLookupCacheRef = useRef(new Map<string, { lat: number; lng: number; address: string; name: string } | null>())
  const reverseLookupCacheRef = useRef(new Map<string, string | null>())
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null)
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)

  // Driver assignments state
  const [driverAssignments, setDriverAssignments] = useState([{ id: '', name: '', first_name: '', surname: '' }])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [selectedTrailerId, setSelectedTrailerId] = useState('')
  const [selectedTrailer2Id, setSelectedTrailer2Id] = useState('')
  const [selectedVehicleType, setSelectedVehicleType] = useState('')
  const [handoverAssignments, setHandoverAssignments] = useState([])
  const [selectedDriverLocation, setSelectedDriverLocation] = useState(null)
  
  // Cost calculation state
  const [selectedVehicle, setSelectedVehicle] = useState('')
  const [estimatedDistance, setEstimatedDistance] = useState(0)
  const [totalVehicleCost, setTotalVehicleCost] = useState(0)
  const [costBreakdown, setCostBreakdown] = useState<{ driverCost: number; fixedAssetCost: number; fuelCost: number; rmCost: number; crossBorderCost: number; totalCost: number } | null>(null)
  const [tripCostLoading, setTripCostLoading] = useState(false)
  const [tripType, setTripType] = useState('local')
  const [stopPoints, setStopPoints] = useState([])
  const [availableStopPoints, setAvailableStopPoints] = useState([])
  const [isLoadingStopPoints, setIsLoadingStopPoints] = useState(false)
  const [customStopPoints, setCustomStopPoints] = useState([])
  const [customStopSelections, setCustomStopSelections] = useState<Record<number, any | null>>({})
  const [showCreateStopModal, setShowCreateStopModal] = useState(false)
  const [showFuelStationModal, setShowFuelStationModal] = useState(false)
  const [showClientForm, setShowClientForm] = useState(false)
  const [editClientRecord, setEditClientRecord] = useState<any | null>(null)
  const [showQuickGeozone, setShowQuickGeozone] = useState(false)
  const [reuseOrderNumber, setReuseOrderNumber] = useState(false)
  const [showReuseOrderModal, setShowReuseOrderModal] = useState(false)
  const [reuseOrderTrips, setReuseOrderTrips] = useState<any[]>([])
  const [reuseOrderPage, setReuseOrderPage] = useState(0)
  const [reuseOrderHasMore, setReuseOrderHasMore] = useState(true)
  const [reuseOrderLoading, setReuseOrderLoading] = useState(false)
  const [reuseOrderSearch, setReuseOrderSearch] = useState('')
  const [tripDays, setTripDays] = useState(1)
  const [isManuallyOrdered, setIsManuallyOrdered] = useState(false)
  const [estimatedTravelHours, setEstimatedTravelHours] = useState(0)
  const lastAutoEtaDropoffRef = useRef('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = Number(active.id)
    const newIndex = Number(over.id)
    const reordered = arrayMove(stopPoints, oldIndex, newIndex)
    setStopPoints(reordered)
    const reorderedCustom = arrayMove(customStopPoints, oldIndex, newIndex)
    setCustomStopPoints(reorderedCustom)
    const reorderedSelections: Record<number, any | null> = {}
    const entries = Object.entries(customStopSelections)
    const reindexed = arrayMove(entries, oldIndex, newIndex)
    reindexed.forEach(([_, v], i) => { reorderedSelections[i] = v })
    setCustomStopSelections(reorderedSelections)
    setIsManuallyOrdered(true)
    setOptimizedRoute(null)
  }
  const STOP_DWELL_HOURS = 0.25

  const parseStoredCoordinates = useCallback((value, fallbackLocation = null) => {
    if (Array.isArray(value)) {
      return value
        .map((coord) => {
          if (!Array.isArray(coord) || coord.length < 2) return null
          const lng = Number(coord[0])
          const lat = Number(coord[1])
          return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
        })
        .filter(Boolean)
    }

    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim()

      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed)
          if (Array.isArray(parsed)) {
            return parsed
              .map((coord) => {
                if (!Array.isArray(coord) || coord.length < 2) return null
                const lng = Number(coord[0])
                const lat = Number(coord[1])
                return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
              })
              .filter(Boolean)
          }
        } catch {
          // keep falling through
        }
      }

      return trimmed
        .split(' ')
        .filter((coord) => coord.trim())
        .map((coord) => {
          const [lng, lat] = coord.split(',')
          const parsedLng = Number.parseFloat(lng)
          const parsedLat = Number.parseFloat(lat)
          return Number.isFinite(parsedLng) && Number.isFinite(parsedLat) ? [parsedLng, parsedLat] : null
        })
        .filter(Boolean)
    }

    if (fallbackLocation && typeof fallbackLocation === 'object') {
      const lng = Number(fallbackLocation.lng)
      const lat = Number(fallbackLocation.lat)
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return [[lng, lat]]
      }
    }

    return []
  }, [])

  const fetchStopPointOptions = useCallback(async () => {
    const [{ data: stopPointsData, error: stopPointsError }, { data: fuelStopsData, error: fuelStopsError }] = await Promise.all([
      supabase
        .from('stop_points')
        .select('id, name, name2, coordinates')
        .order('name'),
      supabase
        .from('fuel_stops')
        .select('id, name, name2, coordinates, geozone_coordinates, location_coordinates')
        .order('name'),
    ])

    if (stopPointsError) {
      console.error('Stop points error:', stopPointsError)
    }

    if (fuelStopsError) {
      console.error('Fuel stops error:', fuelStopsError)
    }

    const normalizedStopPoints = (stopPointsData || []).map((point) => ({
      ...point,
      id: `stop:${point.id}`,
      sourceType: 'stop_point',
      coordinatesParsed: parseStoredCoordinates(point.coordinates),
    }))

    const normalizedFuelStops = (fuelStopsData || []).map((point) => ({
      ...point,
      id: `fuel:${point.id}`,
      sourceType: 'fuel_stop',
      name: point.name || point.name2 || 'Fuel Stop',
      name2: point.name2 || 'Fuel Stop',
      coordinatesParsed: parseStoredCoordinates(point.geozone_coordinates || point.coordinates, point.location_coordinates),
    }))

    return [...normalizedStopPoints, ...normalizedFuelStops]
      .filter((point) => Array.isArray(point.coordinatesParsed) && point.coordinatesParsed.length > 0)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  }, [supabase, parseStoredCoordinates])

  const FUEL_BURN_RATE_BY_TYPE = {
    'TAUTLINER': 32,
    'TAUT X-BRDER - BOTSWANA': 34,
    'TAUT X-BRDER - NAMIBIA': 34,
    'CITRUS LOAD (+1 DAY STANDING FPT)': 32,
    '14M/15M COMBO (NEW)': 28,
    '14M/15M REEFER': 30,
    '9 METER (NEW)': 20,
    '8T JHB (NEW - EPS)': 15,
    '8T JHB (NEW) - X-BRDER - MOZ': 16,
    '8T JHB (OLD)': 15,
    '14 TON CURTAIN': 24,
    '1TON BAKKIE': 9,
  }
  const DEFAULT_BURN_RATE_LPH = 18
  const DEFAULT_BURN_RATE_LPKM = 0.38

  const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return null
    const cleaned = String(value).trim().replace(',', '.')
    const parsed = Number.parseFloat(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }

  const normalizePlate = (value) =>
    String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')

  const extractPlateCandidates = (value) => {
    const raw = String(value || '').trim()
    if (!raw) return []

    return raw
      .split('&')
      .map((part) => normalizePlate(part))
      .filter(Boolean)
  }

  const normalizeCategory = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()

  const hasValidRegistration = (value) => {
    const plate = normalizePlate(value)
    return plate.length > 0
  }

  const normalizeTrackingVehicle = (vehicle) => ({
    ...vehicle,
    registration_number: vehicle?.registration_number || vehicle?.Plate || vehicle?.plate || '',
    driver_name: vehicle?.driver_name || vehicle?.DriverName || '',
    latitude: vehicle?.latitude || vehicle?.Latitude || '',
    longitude: vehicle?.longitude || vehicle?.Longitude || '',
    fuel_probe_1_level: vehicle?.fuel_probe_1_level ?? null,
    fuel_probe_1_volume_in_tank: vehicle?.fuel_probe_1_volume_in_tank ?? null,
    fuel_probe_1_temperature: vehicle?.fuel_probe_1_temperature ?? null,
    fuel_probe_1_level_percentage: vehicle?.fuel_probe_1_level_percentage ?? null,
  })

  const extractTrackingVehicles = (trackingPayload) => {
    const rawVehicles = Array.isArray(trackingPayload)
      ? trackingPayload
      : (trackingPayload?.result?.data || trackingPayload?.data || trackingPayload?.vehicles || [])

    return Array.isArray(rawVehicles)
      ? rawVehicles.map(normalizeTrackingVehicle)
      : []
  }

  const fetchTrackingVehicles = async () => {
    const trackingResponse = await fetch('/api/eps-vehicles')
    const trackingData = await trackingResponse.json()
    return extractTrackingVehicles(trackingData)
  }

  // Fetch loads and reference data
  // Fetch stop points with pagination and caching
  const fetchStopPoints = async () => {
    if (availableStopPoints.length > 0) return // Already loaded
    
    setIsLoadingStopPoints(true)
    try {
      const stopPointOptions = await fetchStopPointOptions()
      setAvailableStopPoints(stopPointOptions)
    } catch (err) {
      console.error('Error fetching stop points:', err)
    }
    setIsLoadingStopPoints(false)
  }

  const fetchData = async () => {
    console.log('Starting fetchData...')
    try {
      console.log('Fetching from Supabase...')
      
      // Recursive fetch for vehicles to get all records
      const fetchAllVehicles = async () => {
        let allVehicles = []
        let from = 0
        const batchSize = 1000
        let hasMore = true
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('vehiclesc')
            .select('id, registration_number, engine_number, vin_number, make, model, sub_model, manufactured_year, vehicle_type, veh_dormant_flag, trailer_no, trailer_no2, trailer_name, trailer_name2, tank_capacity, vehicle_category, vehicle_type_descrip, type, linked_trailer_reg_no')
            .range(from, from + batchSize - 1)
          
          if (error) throw error
          if (!data || data.length === 0) break
          
          allVehicles = [...allVehicles, ...data]
          hasMore = data.length === batchSize
          from += batchSize
        }
        
        return allVehicles
      }
      
      const [
        { data: loadsData, error: loadsError },
        { data: clientsData, error: clientsError },
        vehiclesData,
        { data: driversData, error: driversError },
        { data: costCentersData, error: costCentersError },
        trackingVehicles
      ] = await Promise.all([
        supabase.from('trips').select('*').order('created_at', { ascending: false }).not('status', 'in', '("delivered","completed")'),
        fetch('/api/eps-client-list').then(res => res.json()).then(data => ({ data: (data.data || []).filter((c: any) => !c.blocked), error: null })).catch(error => ({ data: null, error })),
        fetchAllVehicles(),
        supabase.from('drivers').select('*'),
        supabase.from('cost_centers').select('*'),
        fetchTrackingVehicles()
      ])
      
      console.log('Supabase errors:', { loadsError, clientsError, driversError, costCentersError })
      console.log('Total vehicles fetched:', vehiclesData?.length || 0)
      console.log('Sample vehicles:', vehiclesData?.slice(0, 5).map(v => ({ reg: v.registration_number, type: v.vehicle_type })))
      
      // Format drivers from drivers table
      const formattedDrivers = (driversData || []).map(driver => ({
        id: driver.id,
        name: `${driver.first_name} ${driver.surname}`.trim(),
        first_name: driver.first_name || '',
        surname: driver.surname || '',
        available: driver.available
      }))
      
      // Filter available drivers
      const availableDriversList = formattedDrivers.filter(d => d.available === true)
      
      // Helper function to parse JSON fields
      const parseJsonField = (field) => {
        if (!field) return null
        if (typeof field === 'object') return field
        try {
          return JSON.parse(field)
        } catch {
          return null
        }
      }
      
      // Convert trip data to load format for display
      const loadData = (loadsData || []).map(trip => {
        const clientDetails = parseJsonField(trip.clientdetails)
        const pickupLocations = parseJsonField(trip.pickuplocations)
        const dropoffLocations = parseJsonField(trip.dropofflocations)
        
        return {
          ...trip,
          client: clientDetails?.name || '',
          commodity: trip.cargo || '',
          etaPickup: pickupLocations?.[0]?.scheduled_time || trip.startdate || '',
          etaDropoff: dropoffLocations?.[0]?.scheduled_time || trip.enddate || '',
          loadingLocation: trip.origin || '',
          dropOffPoint: trip.destination || '',
          loadingPointCompany: trip.loading_point_company || '',
          loadingPointCity: trip.loading_point_city || '',
          offloadingPointCompany: trip.offloading_point_company || '',
          offloadingPointCity: trip.offloading_point_city || '',
        }
      })
      
      console.log('Raw loads data:', loadsData)
      console.log('Raw loads count:', loadsData?.length || 0)
      console.log('Processed load data:', loadData)
      console.log('Processed loads count:', loadData?.length || 0)
      
      setLoads(loadData)
      setClients(clientsData || [])
      setVehicles(vehiclesData || [])
      setDrivers(formattedDrivers)
      setAvailableDrivers(availableDriversList)
      setVehicleTrackingData(trackingVehicles)
      setCostCenters(costCentersData || [])
      setAvailableStopPoints([])
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Vehicle type options
  const vehicleTypeOptions = [
    'TAUTLINER',
    'FLATDECKS',
    'REFRIGERATED',
    '12M FLATDECKS',
    '6M SKELETALS'
  ]

  // Filter vehicles based on selected type
  const filteredVehicles = useMemo(() => {
    const nonTrailers = vehicles.filter(v =>
      (v.vehicle_type || '').toLowerCase() !== 'trailer' &&
      hasValidRegistration(v.registration_number)
    )
    const sorted = [...nonTrailers].sort((a, b) => {
      const aHasLink = Boolean(a.trailer_no || a.trailer_no2 || a.trailer_name || a.trailer_name2)
      const bHasLink = Boolean(b.trailer_no || b.trailer_no2 || b.trailer_name || b.trailer_name2)
      if (aHasLink !== bHasLink) return aHasLink ? -1 : 1
      const aReg = String(a.registration_number || '')
      const bReg = String(b.registration_number || '')
      return aReg.localeCompare(bReg)
    })
    console.log('Non-trailer vehicles:', sorted.length)
    console.log('Sample non-trailers:', sorted.slice(0, 5).map(v => ({ reg: v.registration_number, type: v.vehicle_type })))
    return sorted
  }, [vehicles])

  // Filter trailers - exclude only 'vehicle' type
  const filteredTrailers = useMemo(() => {
    const trailers = vehicles.filter(v =>
      !['vehicle', 'truck'].includes((v.vehicle_type || '').toLowerCase()) &&
      hasValidRegistration(v.registration_number)
    )
    if (!selectedVehicleType) {
      console.log('Filtered trailers:', trailers.length)
      console.log('Sample trailers:', trailers.slice(0, 5).map(v => ({ reg: v.registration_number, type: v.vehicle_type })))
      return trailers
    }

    const typeKeywords = {
      'TAUTLINER': ['tautliner'],
      'FLATDECKS': ['flat deck', 'flatdeck'],
      'REFRIGERATED': ['refrigerated', 'refridgerated', 'reefer'],
      '12M FLATDECKS': ['12m flat', '12 m flat', '12m flat deck', '12m flatdeck'],
      '6M SKELETALS': ['6m skeletal', '6 m skeletal', 'skeletal']
    }
    const keywords = typeKeywords[selectedVehicleType] || []
    const filtered = trailers.filter(v => {
      const categoryRaw = v.vehicle_category || v.vehicle_type_descrip || ''
      const category = normalizeCategory(categoryRaw)
      return keywords.some(keyword => category.includes(normalizeCategory(keyword)))
    })
    const trfltVehicles = vehicles.filter(v => v.vehicle_type === 'TRFLT')
    console.log('Filtered trailers:', filtered.length)
    console.log('Sample trailers:', filtered.slice(0, 5).map(v => ({ reg: v.registration_number, type: v.vehicle_type })))
    console.log('TRFLT vehicles found:', trfltVehicles.length)
    console.log('TRFLT samples:', trfltVehicles.slice(0, 3).map(v => ({ reg: v.registration_number, type: v.vehicle_type })))
    return filtered
  }, [vehicles, selectedVehicleType])

  const allTrailers = useMemo(() => {
    return vehicles.filter(v =>
      !['vehicle', 'truck'].includes((v.vehicle_type || '').toLowerCase()) &&
      hasValidRegistration(v.registration_number)
    )
  }, [vehicles])

  const trailerIdByPlate = useMemo(() => {
    return new Map(
      allTrailers
        .map((trailer) => [normalizePlate(trailer.registration_number), String(trailer.id)])
        .filter(([plate, id]) => plate && id)
    )
  }, [allTrailers])

  const getLinkedTrailerId = useCallback((trailerId) => {
    if (!trailerId) return ''

    const selectedTrailer = allTrailers.find((trailer) => String(trailer.id) === String(trailerId))
    if (!selectedTrailer) return ''

    const linkedPlate = normalizePlate(selectedTrailer.linked_trailer_reg_no)
    if (!linkedPlate) return ''

    const linkedId = trailerIdByPlate.get(linkedPlate) || ''
    if (String(linkedId) === String(trailerId)) return ''
    return linkedId
  }, [allTrailers, trailerIdByPlate])

  const selectedTrailerRecord = useMemo(() => {
    if (!selectedTrailerId) return null
    return allTrailers.find(t => String(t.id) === String(selectedTrailerId)) || null
  }, [selectedTrailerId, allTrailers])

  const trailersForDropdown = useMemo(() => {
    if (!selectedTrailerRecord) return filteredTrailers
    const exists = filteredTrailers.some(t => String(t.id) === String(selectedTrailerRecord.id))
    if (exists) return filteredTrailers
    return [selectedTrailerRecord, ...filteredTrailers]
  }, [filteredTrailers, selectedTrailerRecord])

  useEffect(() => {
    if (!selectedVehicleId) {
      setSelectedTrailerId('')
      setSelectedTrailer2Id('')
      return
    }

    const selectedVehicleRecord = vehicles.find(v => String(v.id) === String(selectedVehicleId))
    if (!selectedVehicleRecord) return

    const trailerCandidates = [
      selectedVehicleRecord.trailer_no,
      selectedVehicleRecord.trailer_no2,
      selectedVehicleRecord.trailer_name,
      selectedVehicleRecord.trailer_name2
    ].filter(Boolean)

    if (trailerCandidates.length === 0) return

    const candidatePlates = trailerCandidates.flatMap(extractPlateCandidates)
    if (candidatePlates.length === 0) return

    const matchedTrailerIds = candidatePlates
      .map((candidatePlate) =>
        allTrailers.find((trailer) => normalizePlate(trailer.registration_number) === candidatePlate)
      )
      .filter(Boolean)
      .map((trailer) => String(trailer.id))

    if (matchedTrailerIds.length > 0) {
      setSelectedTrailerId(matchedTrailerIds[0] || '')
      setSelectedTrailer2Id(matchedTrailerIds[1] || getLinkedTrailerId(matchedTrailerIds[0]) || '')
    }
  }, [selectedVehicleId, vehicles, allTrailers, getLinkedTrailerId])

  useEffect(() => {
    if (!selectedTrailerId) {
      setSelectedTrailer2Id('')
      return
    }

    const linkedTrailerId = getLinkedTrailerId(selectedTrailerId)
    setSelectedTrailer2Id(linkedTrailerId || '')
  }, [selectedTrailerId, getLinkedTrailerId])

  // Memoized vehicle and driver lookups
  const vehicleMap = useMemo(() => 
    new Map(vehicles.map(v => [v.id, v.registration_number])), [vehicles]
  )
  
  const driverMap = useMemo(() => 
    new Map(drivers.map(d => [d.id, `${d.first_name} ${d.surname}`])), [drivers]
  )

  const getNormalizedDriverAssignment = useCallback((driverId, fallbackDriver = {}) => {
    const normalizedId =
      driverId !== null && driverId !== undefined ? String(driverId).trim() : ''
    const selectedDriver = drivers.find((d) => String(d.id) === normalizedId)
    const firstName = String(selectedDriver?.first_name || fallbackDriver?.first_name || '').trim()
    const surname = String(selectedDriver?.surname || fallbackDriver?.surname || '').trim()
    const fullName = `${firstName} ${surname}`.replace(/\s+/g, ' ').trim()
    const fallbackName = String(selectedDriver?.name || fallbackDriver?.name || '').trim()

    return {
      id: normalizedId,
      name: fullName || fallbackName,
      first_name: firstName,
      surname
    }
  }, [drivers])

  const selectedVehicleTelemetry = useMemo(() => {
    if (!selectedVehicleId) return null

    const selectedVehicleRecord = vehicles.find(v => String(v.id) === String(selectedVehicleId))
    const selectedPlate = normalizePlate(selectedVehicleRecord?.registration_number)
    if (!selectedPlate) return null

    const trackingList = Array.isArray(vehicleTrackingData) ? vehicleTrackingData : []
    return trackingList.find((vehicle) => {
      const plate = normalizePlate(vehicle?.registration_number || vehicle?.Plate || vehicle?.plate)
      return plate === selectedPlate
    }) || null
  }, [selectedVehicleId, vehicles, vehicleTrackingData])

  useEffect(() => {
    if (!selectedVehicleTelemetry) return

    const lat = toNumber(selectedVehicleTelemetry.latitude)
    const lng = toNumber(selectedVehicleTelemetry.longitude)
    if (lat === null || lng === null) return

    const selectedVehicleRecord = vehicles.find(v => String(v.id) === String(selectedVehicleId))
    const vehiclePlate = selectedVehicleRecord?.registration_number || selectedVehicleTelemetry.registration_number || ''
    const fallbackName = selectedVehicleTelemetry.driver_name || vehiclePlate || 'Selected vehicle'

    setSelectedDriverLocation({
      driver: null,
      vehicle: selectedVehicleTelemetry,
      latitude: lat,
      longitude: lng,
      name: fallbackName
    })

    if (!loadingLocation) {
      const vehicleAddress =
        (typeof selectedVehicleTelemetry.address === 'string' && selectedVehicleTelemetry.address.trim()) ||
        (typeof selectedVehicleTelemetry.geozone === 'string' && selectedVehicleTelemetry.geozone.trim())
      if (vehicleAddress) {
        setLoadingLocation(vehicleAddress)
      }
    }
  }, [selectedVehicleTelemetry, selectedVehicleId, vehicles, loadingLocation])

  const estimatedRouteHours = useMemo(() => {
    const durationSeconds = optimizedRoute?.route?.duration || optimizedRoute?.duration || 0
    if (durationSeconds > 0) return durationSeconds / 3600
    if (estimatedDistance > 0) return estimatedDistance / 55
    return 0
  }, [optimizedRoute, estimatedDistance])

  const stopCountForEstimate = useMemo(() => {
    const selectedCount = stopPoints.filter(Boolean).length
    const customCount = customStopPoints.filter((point) => String(point || '').trim().length > 0).length
    return Math.max(selectedCount, customCount)
  }, [stopPoints, customStopPoints])

  const estimatedStopBufferHours = useMemo(
    () => stopCountForEstimate * STOP_DWELL_HOURS,
    [stopCountForEstimate]
  )

  const estimatedTotalTripHours = useMemo(
    () => estimatedRouteHours + estimatedStopBufferHours,
    [estimatedRouteHours, estimatedStopBufferHours]
  )

  const handleEtaPickupChange = useCallback((value: string) => {
    setEtaPickup(value)
  }, [])

  const handleEtaDropoffChange = useCallback((value: string) => {
    lastAutoEtaDropoffRef.current = ''
    setEtaDropoff(value)
  }, [])

  // Calculate distance between two coordinates
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }, [])

  const lookupLocation = useCallback(async (query) => {
    if (!query) return null

    try {
      const cacheKey = String(query).trim().toLowerCase()
      if (locationLookupCacheRef.current.has(cacheKey)) {
        return locationLookupCacheRef.current.get(cacheKey) || null
      }

      const response = await fetch(`/api/location-lookup?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      const firstResult = Array.isArray(data?.results) ? data.results[0] : null

      if (!response.ok) {
        throw new Error(data?.error || 'Location lookup failed')
      }

      if (!firstResult?.coordinates || firstResult.coordinates.length < 2) {
        return null
      }

      const [lng, lat] = firstResult.coordinates
      const result = {
        lat,
        lng,
        address: firstResult.address || firstResult.name || query,
        name: firstResult.name || firstResult.address || query,
      }
      locationLookupCacheRef.current.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('Error looking up location:', error)
      return null
    }
  }, [])

  const reverseLookupLocation = useCallback(async (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

    try {
      const cacheKey = `${lat},${lng}`
      if (reverseLookupCacheRef.current.has(cacheKey)) {
        return reverseLookupCacheRef.current.get(cacheKey) || null
      }

      const response = await fetch(`/api/location-lookup?lat=${lat}&lng=${lng}`)
      const data = await response.json()
      const firstResult = Array.isArray(data?.results) ? data.results[0] : null

      if (!response.ok) {
        throw new Error(data?.error || 'Reverse lookup failed')
      }

      const result = firstResult?.address || firstResult?.name || `${lat},${lng}`
      reverseLookupCacheRef.current.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('Error reverse-looking up location:', error)
      return `${lat},${lng}`
    }
  }, [])

  const normalizeSelectedLookup = useCallback((selection) => {
    if (!selection?.coordinates || selection.coordinates.length < 2) return null

    const [lng, lat] = selection.coordinates
    return {
      lat,
      lng,
      address: selection.address || selection.name || '',
      name: selection.name || selection.address || '',
    }
  }, [])

  // Get pickup location coordinates using Google lookup
  const getPickupCoordinates = useCallback(async (location) => {
    if (!location) return null
    if (
      loadingLocationSelection &&
      (loadingLocationSelection.address === location || loadingLocationSelection.name === location)
    ) {
      return { lat: loadingLocationSelection.lat, lon: loadingLocationSelection.lng }
    }
    const result = await lookupLocation(location)
    return result ? { lat: result.lat, lon: result.lng } : null
  }, [lookupLocation, loadingLocationSelection])

  // Get sorted drivers by distance from pickup location
  const getSortedDriversByDistance = useCallback(async (pickupLocation, trackingDataOverride = null) => {
    if (!pickupLocation) return drivers
    
    const pickupCoords = await getPickupCoordinates(pickupLocation)
    if (!pickupCoords) return drivers
    
    const trackingData = Array.isArray(trackingDataOverride)
      ? trackingDataOverride
      : Array.isArray(vehicleTrackingData)
        ? vehicleTrackingData
        : []
    if (trackingData.length === 0) return drivers
    
    const driversWithDistance = drivers.map(driver => {
      const surname = driver.surname?.trim().toLowerCase()
      const firstName = driver.first_name?.trim().toLowerCase()
      const fullName = `${firstName} ${surname}`.trim()
      
      const matchingVehicle = trackingData.find(vehicle => {
        if (!vehicle.driver_name) return false
        const vehicleDriverName = vehicle.driver_name.trim().toLowerCase()
        return vehicleDriverName === surname || vehicleDriverName === fullName || vehicleDriverName.includes(surname)
      })
      
      if (matchingVehicle?.latitude && matchingVehicle?.longitude) {
        const distance = calculateDistance(
          pickupCoords.lat, pickupCoords.lon,
          parseFloat(matchingVehicle.latitude), parseFloat(matchingVehicle.longitude)
        )
        return { ...driver, distance: Math.round(distance * 10) / 10 }
      }
      
      return { ...driver, distance: null }
    })
    
    // Sort by distance (closest first, then drivers without coordinates)
    return driversWithDistance.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0
      if (a.distance === null) return 1
      if (b.distance === null) return -1
      return a.distance - b.distance
    })
  }, [drivers, calculateDistance, getPickupCoordinates])

  // State for sorted drivers
  const [sortedDrivers, setSortedDrivers] = useState(drivers)
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false)



  // Preview route when locations change - get Mapbox timing data
  useEffect(() => {
    const previewRoute = async () => {
      console.log('Route preview triggered:', { loadingLocation, dropOffPoint, stopPoints, customStopPoints })
      if (!loadingLocation || !dropOffPoint) {
        setOptimizedRoute(null)
        return
      }
      
      setIsOptimizing(true)
      try {
        // Check if we have driver location for complete route
        const firstDriver = driverAssignments[0]
        let driverLocation = null
        
        if (firstDriver?.id) {
          const driver = drivers.find(d => d.id === firstDriver.id)
          if (driver) {
            const driverFullName = `${driver.first_name} ${driver.surname}`.trim().toLowerCase()
            const trackingData = Array.isArray(vehicleTrackingData) ? vehicleTrackingData : []
            const matchingVehicle = trackingData.find(vehicle => 
              vehicle.driver_name && 
              vehicle.driver_name.toLowerCase() === driverFullName
            )
            
            if (matchingVehicle?.latitude && matchingVehicle?.longitude) {
              driverLocation = {
                lat: parseFloat(matchingVehicle.latitude),
                lng: parseFloat(matchingVehicle.longitude)
              }
            }
          }
        }
        
        // Get stop points data if available
        let stopPointsData = []
        if (stopPoints.length > 0 || customStopPoints.some(p => p)) {
          try {
            stopPointsData = await getSelectedStopPointsData()
            console.log('Stop points data for route:', stopPointsData)
            // Filter out invalid stop points
            stopPointsData = stopPointsData.filter(point => 
              point && point.coordinates && point.coordinates.length > 0
            )
          } catch (error) {
            console.error('Error getting stop points data:', error)
            stopPointsData = []
          }
        }
        
        const [loadingLookup, dropOffLookup] = await Promise.all([
          loadingLocationSelection &&
          (loadingLocationSelection.address === loadingLocation || loadingLocationSelection.name === loadingLocation)
            ? loadingLocationSelection
            : lookupLocation(loadingLocation),
          dropOffSelection &&
          (dropOffSelection.address === dropOffPoint || dropOffSelection.name === dropOffPoint)
            ? dropOffSelection
            : lookupLocation(dropOffPoint)
        ])

        if (loadingLookup && dropOffLookup) {
          const getCentroid = (item: any): { lat: number; lng: number } | null => {
            if (item.coordinates && item.coordinates.length > 0) {
              const c = item.coordinates
              const lng = c.reduce((s: number, x: number[]) => s + x[0], 0) / c.length
              const lat = c.reduce((s: number, x: number[]) => s + x[1], 0) / c.length
              if (isNaN(lat) || isNaN(lng)) return null
              return { lat, lng }
            }
            if (item.lat != null && item.lng != null) return { lat: item.lat, lng: item.lng }
            return null
          }

          const intermediates = stopPointsData
            .map((p: any) => getCentroid(p))
            .filter((c: { lat: number; lng: number } | null): c is { lat: number; lng: number } => c !== null)
            .map((c: { lat: number; lng: number }) => ({
              lat: c.lat,
              lng: c.lng,
            }))

          const routesBody = {
            origin: { lat: loadingLookup.lat, lng: loadingLookup.lng },
            destination: { lat: dropOffLookup.lat, lng: dropOffLookup.lng },
            intermediates,
          }

          try {
            const routesRes = await fetch('/api/osrm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(routesBody),
            })

            if (!routesRes.ok) {
              const errData = await routesRes.json().catch(() => ({}))
              console.error('[routes API] HTTP error:', routesRes.status, errData)
              setOptimizedRoute(null)
              setEstimatedDistance(0)
            } else {
              const data = await routesRes.json()
              const route = data.routes?.[0]

              if (route) {
                const totalDistance = route.distance || 0
                const totalDuration = route.duration || 0
                const routeDistanceKm = Math.round(totalDistance / 1000)

                const routeInfo = {
                  route: { distance: totalDistance, duration: totalDuration },
                  distance: totalDistance,
                  duration: totalDuration,
                  hasDriverLocation: !!driverLocation,
                  stopPoints: stopPointsData,
                  geometry: route.geometry || { type: 'LineString', coordinates: [] },
                }
                console.log('[routes API] Success:', routeInfo)
                setOptimizedRoute(routeInfo)
                setEstimatedDistance(routeDistanceKm)
              } else {
                console.error('[routes API] No routes returned:', data)
                setOptimizedRoute(null)
                setEstimatedDistance(0)
              }
            }
          } catch (e) {
            console.error('[routes API] Fetch error:', e)
            setOptimizedRoute(null)
            setEstimatedDistance(0)
          }
        }
      } catch (error) {
        console.error('Route preview failed:', error)
        setOptimizedRoute(null)
        setEstimatedDistance(0)
      }
      setIsOptimizing(false)
    }
    
    // Add a small delay to prevent too frequent updates
    const timeoutId = setTimeout(previewRoute, 500)
    return () => clearTimeout(timeoutId)
  }, [loadingLocation, dropOffPoint, stopPoints, customStopPoints, driverAssignments, isManuallyOrdered, lookupLocation, loadingLocationSelection, dropOffSelection])



  // Update sorted drivers when pickup location changes
  useEffect(() => {
    if (!loadingLocation) {
      setSortedDrivers(drivers)
      return
    }

    let isMounted = true
    
    // Refresh vehicle tracking data when location changes
    fetchTrackingVehicles()
      .then((vehicleData) => {
        if (!isMounted) return null
        setVehicleTrackingData(vehicleData)
        return getSortedDriversByDistance(loadingLocation, vehicleData)
      })
      .then((sorted) => {
        if (!isMounted || !sorted) return
        setSortedDrivers(sorted)
      })
      .catch(error => {
        console.error('Error updating driver distances:', error)
      })

    return () => {
      isMounted = false
    }
  }, [loadingLocation, drivers, getSortedDriversByDistance])

  // Keep drop-off ETA aligned with the selected pickup time and the current routed duration.
  useEffect(() => {
    if (!etaPickup || !optimizedRoute) return

    const pickupDate = new Date(etaPickup)
    const routeDurationSeconds = (estimatedTotalTripHours || 0) * 3600
    if (Number.isNaN(pickupDate.getTime()) || routeDurationSeconds <= 0) return

    const autoDropoffDate = new Date(pickupDate.getTime() + routeDurationSeconds * 1000)
    const autoDropoffValue = autoDropoffDate.toISOString()
    const shouldSyncDropoff =
      !etaDropoff ||
      etaDropoff === lastAutoEtaDropoffRef.current

    if (shouldSyncDropoff && etaDropoff !== autoDropoffValue) {
      lastAutoEtaDropoffRef.current = autoDropoffValue
      setEtaDropoff(autoDropoffValue)
    }
  }, [etaPickup, etaDropoff, estimatedTotalTripHours, optimizedRoute])

  // Auto-calculate trip days from route distance
  useEffect(() => {
    if (estimatedDistance <= 0) return

    const AVG_SPEED_KMH = 55
    const tripHours = estimatedDistance / AVG_SPEED_KMH
    const tripLengthDays = Math.max(0.5, parseFloat((tripHours / 24).toFixed(2)))
    setTripDays(tripLengthDays)
  }, [estimatedDistance, optimizedRoute])

  // Per-vehicle cost calculation via API
  useEffect(() => {
    if (!selectedVehicleId || estimatedDistance <= 0) {
      setCostBreakdown(null)
      setTotalVehicleCost(0)
      return
    }

    let cancelled = false

    const fetchCost = async () => {
      setTripCostLoading(true)
      try {
        console.log('[CostCalc] Fetching cost:', { vehicleId: selectedVehicleId, distanceKm: estimatedDistance, tripDays, fuelPrice: 21 })
        const res = await fetch('/api/calculate-cost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicleId: selectedVehicleId,
            distanceKm: estimatedDistance,
            tripDays: tripDays || 1,
            fuelPrice: 21,
          }),
        })
        if (!res.ok) {
          console.error('[CostCalc] API error:', res.status)
          return
        }
        const data = await res.json()
        console.log('[CostCalc] Result:', data)
        if (cancelled) return
        setCostBreakdown(data)
        setTotalVehicleCost(data.totalCost || 0)
      } catch (err) {
        console.error('Cost calculation error:', err)
      } finally {
        if (!cancelled) setTripCostLoading(false)
      }
    }

    fetchCost()
    return () => { cancelled = true }
  }, [selectedVehicleId, estimatedDistance, tripDays])

  // Fetch order numbers when reuse modal opens
  useEffect(() => {
    if (!showReuseOrderModal || reuseOrderPage !== 0) return
    let cancelled = false
    const fetchOrders = async () => {
      setReuseOrderLoading(true)
      try {
        const res = await fetch(`/api/trips/reuse-order?page=0&limit=100`)
        const data = await res.json()
        if (!cancelled && data.data) {
          setReuseOrderTrips(data.data)
          setReuseOrderHasMore(data.data.length === 100)
        }
      } catch (err) {
        console.error('Error loading order numbers:', err)
      } finally {
        if (!cancelled) setReuseOrderLoading(false)
      }
    }
    fetchOrders()
    return () => { cancelled = true }
  }, [showReuseOrderModal, reuseOrderPage])



  // Calculate distance from point to route line
  const distanceToRoute = useCallback((pointLat, pointLng, routeCoords) => {
    if (!routeCoords || routeCoords.length < 2) return Infinity
    
    let minDistance = Infinity
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const [lng1, lat1] = routeCoords[i]
      const [lng2, lat2] = routeCoords[i + 1]
      
      // Distance from point to line segment
      const A = pointLat - lat1
      const B = pointLng - lng1
      const C = lat2 - lat1
      const D = lng2 - lng1
      
      const dot = A * C + B * D
      const lenSq = C * C + D * D
      let param = -1
      if (lenSq !== 0) param = dot / lenSq
      
      let xx, yy
      if (param < 0) {
        xx = lat1
        yy = lng1
      } else if (param > 1) {
        xx = lat2
        yy = lng2
      } else {
        xx = lat1 + param * C
        yy = lng1 + param * D
      }
      
      const distance = calculateDistance(pointLat, pointLng, xx, yy)
      minDistance = Math.min(minDistance, distance)
    }
    return minDistance
  }, [calculateDistance])

  // Filter stop points within 25km of route and between origin/destination
  const filteredStopPoints = useMemo(() => {
    if (!loadingLocation || !dropOffPoint || !optimizedRoute?.route?.geometry?.coordinates) {
      return availableStopPoints
    }
    
    const routeCoords = optimizedRoute.route.geometry.coordinates
    const [originLng, originLat] = routeCoords[0]
    const [destLng, destLat] = routeCoords[routeCoords.length - 1]
    
    return availableStopPoints.filter(point => {
      const coordPairs = parseStoredCoordinates(point.coordinatesParsed || point.coordinates)
      if (coordPairs.length === 0) return false
      
      try {
        // Use centroid of stop point polygon
        const avgLng = coordPairs.reduce((sum, coord) => sum + coord[0], 0) / coordPairs.length
        const avgLat = coordPairs.reduce((sum, coord) => sum + coord[1], 0) / coordPairs.length
        
        // Check if within 25km of route
        const distance = distanceToRoute(avgLat, avgLng, routeCoords)
        if (distance > 25) return false
        
        // Check if between origin and destination
        const distToOrigin = calculateDistance(avgLat, avgLng, originLat, originLng)
        const distToDest = calculateDistance(avgLat, avgLng, destLat, destLng)
        const originToDestDist = calculateDistance(originLat, originLng, destLat, destLng)
        
        // Point is between origin and destination if sum of distances is roughly equal to direct distance
        return (distToOrigin + distToDest) <= (originToDestDist * 1.2) // 20% tolerance
      } catch (error) {
        return false
      }
    })
  }, [availableStopPoints, loadingLocation, dropOffPoint, optimizedRoute, distanceToRoute, calculateDistance, parseStoredCoordinates])

  // Get selected stop points with coordinates including custom locations
  const getSelectedStopPointsData = useCallback(async () => {
    console.log('getSelectedStopPointsData called with:', { stopPoints, customStopPoints, availableStopPoints: availableStopPoints.length })
    
    // Ensure stop points are loaded if not already available
    if (availableStopPoints.length === 0 && (stopPoints.length > 0 || customStopPoints.some(p => p))) {
      console.log('Loading stop points from database...')
      try {
        const stopPointOptions = await fetchStopPointOptions()
        setAvailableStopPoints(stopPointOptions)
        console.log('Loaded stop points:', stopPointOptions?.length || 0)
      } catch (err) {
        console.error('Error fetching stop points:', err)
      }
    }
    
    const results = []
    
    for (let i = 0; i < stopPoints.length; i++) {
      const pointId = stopPoints[i]
      const customLocation = customStopPoints[i]
      console.log(`Processing stop point ${i}:`, { pointId, customLocation })
      
      if (customLocation) {
        // Geocode custom location
        try {
          const selectedLookup = customStopSelections[i]
          const lookup =
            selectedLookup &&
            (selectedLookup.address === customLocation || selectedLookup.name === customLocation)
              ? selectedLookup
              : await lookupLocation(customLocation)
          if (lookup) {
            results.push({
              id: `custom_${i}`,
              name: customLocation,
              coordinates: [[lookup.lng, lookup.lat]]
            })
          }
        } catch (error) {
          console.error('Error geocoding custom location:', error)
        }
      } else if (pointId) {
        // Use existing stop point - use current availableStopPoints or fetch directly
        let point = availableStopPoints.find(p => String(p.id) === String(pointId))
        
        // If not found in current array, fetch directly from database
        if (!point) {
          console.log('Stop point not found in cache, fetching from database...')
          try {
            const stopPointOptions = await fetchStopPointOptions()
            point = stopPointOptions.find((option) => String(option.id) === String(pointId))
            if (point) {
              console.log('Fetched stop point from database:', point)
            }
          } catch (err) {
            console.error('Error fetching individual stop point:', err)
          }
        }
        
        console.log('Found stop point for ID', pointId, ':', point)
        const coordPairs = parseStoredCoordinates(point?.coordinatesParsed || point?.coordinates)
        if (coordPairs.length > 0) {
          try {
            console.log('Parsed coordinates:', coordPairs)
            results.push({
              id: point.id,
              name: point.name,
              coordinates: coordPairs,
              sourceType: point.sourceType || 'stop_point',
            })
          } catch (error) {
            console.error('Error parsing coordinates:', error)
          }
        } else {
          console.log('No coordinates found for point:', pointId)
          console.log('Point found but no coordinates:', point)
        }
      }
    }
    
    console.log('getSelectedStopPointsData returning:', results)
    return results
  }, [stopPoints, customStopPoints, availableStopPoints, lookupLocation, customStopSelections, fetchStopPointOptions, parseStoredCoordinates])

  // Optimized handlers with useCallback
  const handleDriverChange = useCallback((driverIndex, driverId) => {
    const normalizedId = driverId !== null && driverId !== undefined ? String(driverId).trim() : ''
    const selectedDriver = drivers.find(d => String(d.id) === normalizedId)
    setDriverAssignments(prev => {
      const updated = [...prev]
      updated[driverIndex] = getNormalizedDriverAssignment(normalizedId, updated[driverIndex] || {})
      return updated
    })
    
    // Show driver location on map
    if (selectedDriver) {
      const driverFullName = `${selectedDriver.first_name} ${selectedDriver.surname}`.trim().toLowerCase()
      const trackingData = Array.isArray(vehicleTrackingData) ? vehicleTrackingData : []
      const matchingVehicle = trackingData.find(vehicle => 
        vehicle.driver_name && 
        vehicle.driver_name.toLowerCase() === driverFullName
      )
      
      if (matchingVehicle?.latitude && matchingVehicle?.longitude) {
        setSelectedDriverLocation({
          driver: selectedDriver,
          vehicle: matchingVehicle,
          latitude: parseFloat(matchingVehicle.latitude),
          longitude: parseFloat(matchingVehicle.longitude),
          name: `${selectedDriver.first_name} ${selectedDriver.surname}`.trim()
        })
        // Force route recalculation when driver changes
        setOptimizedRoute(null)
      } else {
        setSelectedDriverLocation(null)
      }
    } else {
      setSelectedDriverLocation(null)
    }
  }, [drivers, vehicleTrackingData, getNormalizedDriverAssignment])

  const addDriver = useCallback(() => {
    setDriverAssignments(prev => [...prev, { id: '', name: '', first_name: '', surname: '' }])
  }, [])

  // Auto-select closest driver when dropdown is opened
  const handleDriverDropdownOpen = useCallback(async (driverIndex) => {
    console.log('Driver dropdown opened, loading location:', loadingLocation)
    if (!loadingLocation) return
    
    setIsCalculatingDistance(true)
    try {
      console.log('Fetching vehicle tracking data from API...')
      const vehicleData = await fetchTrackingVehicles()
      console.log('Vehicle data extracted:', vehicleData.length, 'vehicles')
      if (vehicleData.length > 0) {
        console.log('First 3 drivers:', vehicleData.slice(0, 3).map(v => v.driver_name))
      }
      setVehicleTrackingData(vehicleData)
      
      const sorted = await getSortedDriversByDistance(loadingLocation, vehicleData)
      console.log('Sorted drivers:', sorted.filter(d => d.distance !== null).length, 'with distances')
      setSortedDrivers(sorted)
      
      const closestDriver = sorted.find(d => d.distance !== null)
      if (closestDriver) {
        console.log('Auto-selecting closest driver:', closestDriver.first_name, closestDriver.surname, closestDriver.distance, 'km')
        handleDriverChange(driverIndex, closestDriver.id)
      }
    } catch (error) {
      console.error('Error calculating driver distances:', error)
    }
    setIsCalculatingDistance(false)
  }, [loadingLocation, getSortedDriversByDistance, handleDriverChange])

  // Helper to get assigned vehicles/drivers display
  const getAssignmentsDisplay = (load) => {
    const assignments = load.vehicleAssignments || load.vehicle_assignments || []
    if (!assignments.length) return 'Unassigned'
    
    return assignments.map(assignment => {
      const vehicleName = assignment.vehicle?.name || 'Unknown Vehicle'
      const driverNames = assignment.drivers?.map(d => d.name).filter(Boolean).join(', ') || 'No Driver'
      return `${vehicleName} (${driverNames})`
    }).join('; ')
  }

  // Parse JSON fields safely
  const parseJsonField = (field) => {
    if (!field) return []
    if (Array.isArray(field)) return field
    try {
      return JSON.parse(field)
    } catch {
      return []
    }
  }

  const getVehicleNameById = (id) => {
    if (!id) return ''
    const vehicle = vehicles.find(v => v.id.toString() === id.toString())
    return hasValidRegistration(vehicle?.registration_number) ? vehicle.registration_number : ''
  }

  const buildCurrentAssignment = () => ({
    drivers: (driverAssignments || []).map((driver) =>
      getNormalizedDriverAssignment(driver?.id, driver)
    ),
    vehicle: {
      id: selectedVehicleId,
      name: getVehicleNameById(selectedVehicleId)
    },
    trailer: {
      id: selectedTrailerId,
      name: getVehicleNameById(selectedTrailerId)
    },
    trailers: [
      {
        id: selectedTrailerId,
        name: getVehicleNameById(selectedTrailerId)
      },
      {
        id: selectedTrailer2Id,
        name: getVehicleNameById(selectedTrailer2Id)
      }
    ].filter((trailer) => trailer.id || trailer.name)
  })

  const addHandoverAssignmentSet = () => {
    setHandoverAssignments(prev => [
      ...prev,
      {
        vehicleId: '',
        trailerId: '',
        trailer2Id: '',
        drivers: [{ id: '', name: '', first_name: '', surname: '' }]
      }
    ])
  }

  const removeHandoverAssignmentSet = (setIndex) => {
    setHandoverAssignments(prev => prev.filter((_, idx) => idx !== setIndex))
  }

  const handleHandoverVehicleChange = (setIndex, field, value) => {
    setHandoverAssignments(prev => prev.map((set, idx) => {
      if (idx !== setIndex) return set

      if (field === 'trailerId') {
        const linkedTrailerId = getLinkedTrailerId(value)
        return {
          ...set,
          [field]: value,
          trailer2Id: linkedTrailerId || ''
        }
      }

      return { ...set, [field]: value }
    }))
  }

  const addHandoverDriver = (setIndex) => {
    setHandoverAssignments(prev => prev.map((set, idx) =>
      idx === setIndex
        ? { ...set, drivers: [...(set.drivers || []), { id: '', name: '', first_name: '', surname: '' }] }
        : set
    ))
  }

  const removeHandoverDriver = (setIndex, driverIndex) => {
    setHandoverAssignments(prev => prev.map((set, idx) => {
      if (idx !== setIndex) return set
      const nextDrivers = (set.drivers || []).filter((_, dIdx) => dIdx !== driverIndex)
      return {
        ...set,
        drivers: nextDrivers.length > 0 ? nextDrivers : [{ id: '', name: '', first_name: '', surname: '' }]
      }
    }))
  }

  const handleHandoverDriverChange = (setIndex, driverIndex, driverId) => {
    setHandoverAssignments(prev => prev.map((set, idx) => {
      if (idx !== setIndex) return set
      const nextDrivers = [...(set.drivers || [])]
      nextDrivers[driverIndex] = getNormalizedDriverAssignment(driverId, nextDrivers[driverIndex] || {})
      return { ...set, drivers: nextDrivers }
    }))
  }

  const buildHandoverAssignments = () => {
    return handoverAssignments
      .map((set) => ({
        drivers: (set.drivers || [])
          .map((driver) => getNormalizedDriverAssignment(driver?.id, driver))
          .filter((driver) => driver?.id),
        vehicle: {
          id: set.vehicleId || '',
          name: getVehicleNameById(set.vehicleId)
        },
        trailer: {
          id: set.trailerId || '',
          name: getVehicleNameById(set.trailerId)
        },
        trailers: [
          {
            id: set.trailerId || '',
            name: getVehicleNameById(set.trailerId)
          },
          {
            id: set.trailer2Id || '',
            name: getVehicleNameById(set.trailer2Id)
          }
        ].filter((trailer) => trailer.id || trailer.name)
      }))
      .filter((set) => set.vehicle.id || set.trailer.id || set.drivers.length > 0)
  }

  const [summaryOpen, setSummaryOpen] = useState(false)
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null)
  // Routing assigned items
  const [assignedItems, setAssignedItems] = useState<any[]>([])
  // Left items available to assign
  const [leftItems, setLeftItems] = useState<any[]>([
    { id: 'a', title: 'VINCEMUS INVESTMENTS (P...)', addr: 'Johannesburg, South Africa', addr2: 'Estcourt, 3310, South Africa' },
    { id: 'b', title: 'TRADELANDER 5 CC', addr: 'Randfontein, South Africa' }
  ])

  const doesClientHaveGeozone = (clientData) => {
    if (!clientData?.coordinates) return false
    try {
      const parsed = JSON.parse(clientData.coordinates)
      return Array.isArray(parsed) && parsed.length >= 3
    } catch {
      return false
    }
  }

  const handleCreateClick = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent duplicate submissions
    if (isSubmitting) {
      return
    }
    
    // Validate required fields
    if (!client || !commodity || !loadingLocation || !dropOffPoint) {
      showToast('Please fill out all required fields', 'error')
      return
    }
    
    handleCreateOrUpdate()
  }

  const handleClientSelect = async (clientData) => {
    if (typeof clientData === 'object' && (clientData.address || clientData.client_id)) {
      const clientRecord = {
        ...clientData,
        name: clientData.name || clientData.client_id || '',
      }
      setSelectedClient(clientRecord)
      setClient(clientRecord.name)
      setManualClientName('')

      if (clientData.address) {
        try {
          const lookup = await lookupLocation(clientData.address)
          if (lookup) {
            const geocodedClient = {
              ...clientRecord,
              geocoded_coordinates: `${lookup.lng},${lookup.lat}`,
              geocoded_address: lookup.address
            }
            setSelectedClient(geocodedClient)
            console.log(`Geocoded client address: ${clientData.address} -> ${lookup.lng},${lookup.lat}`)
          }
        } catch (error) {
          console.error('Error geocoding client address:', error)
        }
      }

      if (doesClientHaveGeozone(clientRecord)) {
        setShowAddressPopup(true)
      } else {
        setShowQuickGeozone(true)
      }
    } else if (typeof clientData === 'object' && clientData.coordinates) {
      const clientRecord = {
        ...clientData,
        name: clientData.name || clientData.client_id || '',
      }
      setSelectedClient(clientRecord)
      setClient(clientRecord.name)
      setManualClientName('')

      if (doesClientHaveGeozone(clientRecord)) {
        setShowAddressPopup(true)
      } else {
        setShowQuickGeozone(true)
      }
    } else {
      setClient(typeof clientData === 'string' ? clientData : clientData?.name || '')
      setSelectedClient(clientData)
      setManualClientName('')
    }
  }

  const handleUseAsPickup = async () => {
    // Use geozone center coords first, fallback to geocoded address
    if (selectedClient?.coords) {
      const [lat, lng] = selectedClient.coords.split(',').map(Number)
      if (!isNaN(lat) && !isNaN(lng)) {
        const address = await reverseLookupLocation(lat, lng)
        setLoadingLocation(address || `${lat},${lng}`)
      }
    } else if (selectedClient?.geocoded_address) {
      setLoadingLocation(selectedClient.geocoded_address)
    }
    setShowAddressPopup(false)
  }

  const handleUseAsDropoff = async () => {
    // Use geozone center coords first, fallback to geocoded address
    if (selectedClient?.coords) {
      const [lat, lng] = selectedClient.coords.split(',').map(Number)
      if (!isNaN(lat) && !isNaN(lng)) {
        const address = await reverseLookupLocation(lat, lng)
        setDropOffPoint(address || `${lat},${lng}`)
      }
    } else if (selectedClient?.geocoded_address) {
      setDropOffPoint(selectedClient.geocoded_address)
    }
    setShowAddressPopup(false)
  }

  const handleSkipAddress = () => {
    setShowAddressPopup(false)
  }

  const handleGeozoneSaved = async () => {
    setShowQuickGeozone(false)
    try {
      const res = await fetch("/api/eps-client-list")
      const data = await res.json()
      if (data.data) {
        setClients(data.data.filter((c: any) => !c.blocked))
        const updated = data.data.find((c: any) => String(c.id) === String(selectedClient?.id))
        if (updated) {
          setSelectedClient((prev: any) => ({ ...prev, ...updated }))
        }
      }
    } catch (err) {
      console.error("Error refreshing clients:", err)
    }
    setShowAddressPopup(true)
  }

  const handleGeozoneSkip = () => {
    setShowQuickGeozone(false)
    setShowAddressPopup(true)
  }



  const handleCreateOrUpdate = async () => {
    if (isEditMode) {
      return handleUpdate()
    }
    return handleCreate()
  }
  
  const handleUpdate = async () => {
    setIsSubmitting(true)
    try {
      const currentAssignment = buildCurrentAssignment()
      const existingTrip = loads.find(trip => trip.id?.toString() === editTripId?.toString())
      const existingHandedAssignments = parseJsonField(existingTrip?.handed_vehicleassignments)
      const nextHandedAssignments = buildHandoverAssignments()
      const handedVehicleAssignments = nextHandedAssignments.length > 0 ? nextHandedAssignments : existingHandedAssignments

      const tripData = {
        ordernumber: orderNumber,
        rate: rate,
        cargo: commodity,
        origin: loadingLocation,
        destination: dropOffPoint,
        notes: comment,
        
        clientdetails: selectedClient ? {
          name: selectedClient.name,
          email: selectedClient.email || '',
          phone: selectedClient.phone || '',
          address: selectedClient.address || '',
          contactPerson: selectedClient.contact_person || '',
          client_id: selectedClient.client_id || '',
          vat_number: selectedClient.vat_number || ''
        } : {
          name: client,
          email: '',
          phone: '',
          address: '',
          contactPerson: ''
        },
        
        pickuplocations: [{
          location: loadingLocation || '',
          address: loadingLocation || '',
          scheduled_time: etaPickup || ''
        }],
        
        dropofflocations: [{
          location: dropOffPoint || '',
          address: dropOffPoint || '',
          scheduled_time: etaDropoff || ''
        }],
        
        vehicleassignments: [currentAssignment],
        vehicle_assignments: [currentAssignment],
        handed_vehicleassignments: handedVehicleAssignments,
        
        trip_type: tripType,
        selected_stop_points: stopPoints,
        selected_vehicle_type: selectedVehicleType,
        updated_at: new Date().toISOString(),
        loading_point_company: loadingPointCompany,
        loading_point_city: loadingPointCity,
        offloading_point_company: offloadingPointCompany,
        offloading_point_city: offloadingPointCity,
      }
      
      const { error } = await supabase
        .from('trips')
        .update(tripData)
        .eq('id', editTripId)
      
      if (error) throw error

      // Regenerate and store loadcon PDF
      try {
        const getVehicleReg = () => {
          const currentAssignment = buildCurrentAssignment()
          const vId = currentAssignment?.id || currentAssignment?.vehicle_id
          if (!vId) return ''
          const v = vehicles.find((vv) => String(vv.id) === String(vId))
          return v?.registration_number || ''
        }
        const getDriverName = () => {
          const currentAssignment = buildCurrentAssignment()
          const dId = currentAssignment?.id || currentAssignment?.driver_id
          if (!dId) return ''
          const drv = drivers.find((dd) => String(dd.id) === String(dId))
          return drv ? `${drv.first_name} ${drv.surname}`.trim() : ''
        }
        const deliveredByStr = [getVehicleReg(), getDriverName()].filter(Boolean).join(' - ')
        const getCompletedBy = async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser()
            return user?.email || user?.user_metadata?.first_name || ''
          } catch { return '' }
        }
        const completedByName = await getCompletedBy()
        const getClientName = () => {
          if (selectedClient?.name) return selectedClient.name
          if (manualClientName) return manualClientName
          return client
        }

        const loadconData = {
          orderNumber: orderNumber || '',
          loadType: 'Cross Border',
          loadDate: new Date().toLocaleDateString('en-ZA'),
          customerName: getClientName(),
          collectionAddress: loadingLocation || '',
          delivery: dropOffPoint || '',
          collectedBy: deliveredByStr,
          deliveredBy: deliveredByStr,
          notes: comment || '',
          completedBy: completedByName,
          rate: rate || '',
          bookingRef: orderNumber ? `${orderNumber} - ${getClientName()}` : '',
        }

        const { blob, url } = await generateAndStoreLoadcon(editTripId, loadconData)
        if (url) {
          triggerPdfDownload(blob, `loadcon-${orderNumber}.pdf`)
        }
      } catch (pdfError) {
        console.error('Error regenerating loadcon PDF:', pdfError)
      }

      showToast('Trip updated successfully!', 'success')
      
      // Clear sessionStorage and redirect
      sessionStorage.removeItem('editTripData')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
      
    } catch (err) {
      console.error('Error updating trip:', err)
      showToast('Failed to update trip', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleCreate = async () => {
    setIsSubmitting(true)
    try {
      const currentAssignment = buildCurrentAssignment()
      const handedVehicleAssignments = buildHandoverAssignments()

      const tripData = {
        trip_id: `LOAD-${Date.now()}`,
        ordernumber: reuseOrderNumber ? orderNumber : null,
        rate: rate,
        cargo: commodity,
        origin: loadingLocation,
        destination: dropOffPoint,
        notes: comment,
        status: 'pending',
        startdate: etaPickup ? etaPickup.split('T')[0] : null,
        enddate: etaDropoff ? etaDropoff.split('T')[0] : null,

        clientdetails: selectedClient ? {
          name: selectedClient.name,
          email: '',
          phone: selectedClient.phone || '',
          address: selectedClient.address || '',
          contactPerson: selectedClient.contact_person || '',
          client_id: selectedClient.client_id || '',
          vat_number: selectedClient.vat_number || ''
        } : {
          name: client,
          email: '',
          phone: '',
          address: '',
          contactPerson: ''
        },
        pickuplocations: [{
          location: loadingLocation || '',
          address: loadingLocation || '',
          scheduled_time: etaPickup || ''
        }],
        dropofflocations: [{
          location: dropOffPoint || '',
          address: dropOffPoint || '',
          scheduled_time: etaDropoff || ''
        }],
        vehicleassignments: [currentAssignment],
        vehicle_assignments: [currentAssignment],
        handed_vehicleassignments: handedVehicleAssignments,
        trip_type: tripType,
        selected_stop_points: stopPoints.map((pointId, index) => {
          if (customStopPoints[index]) {
            return { type: 'custom', name: customStopPoints[index], id: `custom_${index}` }
          } else if (pointId) {
            const point = availableStopPoints.find(p => p.id.toString() === pointId)
            return point ? { type: 'existing', source_type: point.sourceType || 'stop_point', ...point } : null
          }
          return null
        }).filter(Boolean),
        selected_vehicle_type: selectedVehicleType,
        approximate_fuel_cost: costBreakdown?.fuelCost || 0,
        approximated_vehicle_cost: costBreakdown?.fixedAssetCost || 0,
        approximated_driver_cost: costBreakdown?.driverCost || 0,
        total_vehicle_cost: totalVehicleCost,
        estimated_distance: estimatedDistance,
        loading_point_company: loadingPointCompany,
        loading_point_city: loadingPointCity,
        offloading_point_company: offloadingPointCompany,
        offloading_point_city: offloadingPointCity,
      }
      
      console.log('Inserting trip data:', tripData)
      const { data: tripResult, error } = await supabase.from('trips').insert([tripData]).select()
      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw new Error(`Database error: ${error.message || 'Unknown error'}`)
      }
      console.log('Trip created successfully:', tripResult)
      const createdTrip = tripResult?.[0]
      const newTripId = createdTrip?.id

      // Get sequential order number only if not reusing
      let orderNumberStr = orderNumber
      if (!reuseOrderNumber || !orderNumber) {
        const orderRes = await fetch('/api/next-order-number', { method: 'POST' })
        if (!orderRes.ok) throw new Error('Failed to get next order number')
        const { orderNumber: nextNumber } = await orderRes.json()
        orderNumberStr = `WC${nextNumber}`
        setOrderNumber(orderNumberStr)

        // Update trip with the order number
        const { error: updateError } = await supabase
          .from('trips')
          .update({ ordernumber: orderNumberStr })
          .eq('id', newTripId)
        if (updateError) {
          console.error('Error updating trip order number:', updateError)
        }
      }

      // Generate and store loadcon PDF
      try {
        const getVehicleReg = () => {
          const v = vehicles.find((vv) => String(vv.id) === String(selectedVehicleId))
          return v?.registration_number || ''
        }
        const getDriverName = () => {
          const d = driverAssignments[0]
          if (!d?.id) return ''
          const drv = drivers.find((dd) => String(dd.id) === String(d.id))
          return drv ? `${drv.first_name} ${drv.surname}`.trim() : ''
        }
        const deliveredByStr = [getVehicleReg(), getDriverName()].filter(Boolean).join(' - ')
        const getCompletedBy = async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser()
            return user?.email || user?.user_metadata?.first_name || ''
          } catch { return '' }
        }
        const completedByName = await getCompletedBy()
        const getClientName = () => {
          if (selectedClient?.name) return selectedClient.name
          if (manualClientName) return manualClientName
          return client
        }

        const createdAt = new Date().toLocaleDateString('en-ZA')

        const loadconData = {
          orderNumber: orderNumberStr,
          loadType: 'Cross Border',
          loadDate: createdAt,
          customerName: getClientName(),
          collectionAddress: loadingLocation || '',
          delivery: dropOffPoint || '',
          collectedBy: deliveredByStr,
          deliveredBy: deliveredByStr,
          notes: comment || '',
          completedBy: completedByName,
          rate: rate || '',
          bookingRef: orderNumberStr ? `${orderNumberStr} - ${getClientName()}` : '',
        }

        const pdfBlob = generateLoadconPdf(loadconData)
        const pdfUrl = await uploadLoadconPdf(newTripId, pdfBlob)
        if (pdfUrl) {
          await updateTripLoadconUrl(newTripId, pdfUrl)
        }
        triggerPdfDownload(pdfBlob, `loadcon-${orderNumberStr}.pdf`)
      } catch (pdfError) {
        console.error('Error generating loadcon PDF:', pdfError)
      }

      // Save route after trip is created
      if (loadingLocation && dropOffPoint) {
        try {
          const selectedStopPoints = await getSelectedStopPointsData()
          const waypoints = selectedStopPoints.map(point => {
            const coords = point.coordinates
            const avgLng = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length
            const avgLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length
            return `${avgLng},${avgLat}`
          })
          
          const routeResponse = await fetch('/api/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: loadingLocation,
              destination: dropOffPoint,
              orderId: orderNumberStr,
              pickupTime: etaPickup,
              waypoints: waypoints
            })
          })
          
          if (routeResponse.ok) {
            const routeData = await routeResponse.json()
            const routeId = routeData.route?.id
            if (routeId) {
              await supabase
                .from('trips')
                .update({ route: String(routeId) })
                .eq('id', newTripId)
            }
          }
        } catch (routeError) {
          console.error('Error saving route:', routeError)
        }
      }
      
      // Reset form
      setClient(''); setSelectedClient(null); setManualClientName(''); setCommodity(''); setRate('0'); setOrderNumber(''); setComment('')
      setEtaPickup(''); setLoadingLocation(''); setEtaDropoff(''); setDropOffPoint('')
      setLoadingPointCompany(''); setLoadingPointCity(''); setOffloadingPointCompany(''); setOffloadingPointCity('')
      setDriverAssignments([{ id: '', name: '', first_name: '', surname: '' }])
      setSelectedVehicleId('')
      setSelectedTrailerId('')
      setSelectedTrailer2Id('') // Reset second trailer
      setHandoverAssignments([])
      setTripType('local')
      setStopPoints([]) // Reset stop points for both trip types
      setCustomStopPoints([])
      setFuelPricePerLiter('')
      setGoodsInTransitPremium('0')
      setSelectedVehicleType('')
      setShowSecondSection(false)
      setOptimizedRoute(null)
      setReuseOrderNumber(false)
      setShowReuseOrderModal(false)
      setReuseOrderTrips([])
      setReuseOrderPage(0)
      setReuseOrderHasMore(true)
      
      // Refresh data
      fetchData()
      
      showToast(`Load ${orderNumberStr} created successfully!`, 'success')
    } catch (err: any) {
      console.error('Error creating load:', err)
      const msg = err?.message || String(err)
      showToast(`Something went wrong: ${msg}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-6 w-full">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Load Plan</h1>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => { setEditClientRecord(null); setShowClientForm(true) }}>
            <Building2 className="mr-2 h-4 w-4" />
            Add Client
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowFuelStationModal(true)}>
            <MapPin className="mr-2 h-4 w-4" />
            Fuel Stations
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="loads" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="loads">Trips</TabsTrigger>
          <TabsTrigger value="create">Create Trip</TabsTrigger>
        </TabsList>

        <TabsContent value="loads" className="space-y-6">
          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center space-x-4">
              <div><Route className="h-8 w-8 text-blue-500" /></div>
              <div>
                <p className="text-sm text-gray-500">Total Loads</p>
                <p className="text-xl font-semibold">{loads.length}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center space-x-4">
              <div><CheckCircle className="h-8 w-8 text-green-500" /></div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-xl font-semibold">{loads.filter(l => l.status === 'completed').length}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center space-x-4">
              <div><Clock className="h-8 w-8 text-yellow-500" /></div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-xl font-semibold">{loads.filter(l => l.status === 'pending').length}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl border bg-white shadow-sm flex items-center space-x-4">
              <div><TrendingUp className="h-8 w-8 text-blue-500" /></div>
              <div>
                <p className="text-sm text-gray-500">In Transit</p>
                <p className="text-xl font-semibold">{loads.filter(l => l.status === 'in-transit').length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm">
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by order number or driver name..."
                  value={tripSearch}
                  onChange={(e) => setTripSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {tripSearch && (
                  <button onClick={() => setTripSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {(() => {
                const q = tripSearch.toLowerCase().trim()
                const filtered = q ? loads.filter(row => {
                  if (row.ordernumber?.toLowerCase().includes(q)) return true
                  if (row.trip_id?.toLowerCase().includes(q)) return true
                  const assignments = parseJsonField(row.vehicleassignments) || []
                  return assignments.some(a => (a.drivers || []).some(d => (d.first_name || d.name || '').toLowerCase().includes(q)))
                }) : loads

              return (
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-100">
                    <TableHead>Order Number</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                        {tripSearch ? 'No trips match your search' : 'No trips available'}
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{row.ordernumber || row.trip_id || row.id}</TableCell>
                      <TableCell>
                        {(() => {
                          const assignments = parseJsonField(row.vehicleassignments) || []
                          if (!assignments.length) return '-'
                          const driverNames = assignments.flatMap(a => (a.drivers || []).map(d => d.first_name || d.name).filter(Boolean))
                          return driverNames.length ? driverNames.join(', ') : '-'
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const assignments = parseJsonField(row.vehicleassignments) || []
                          if (!assignments.length) return '-'
                          return assignments.map(a => a.vehicle?.name).filter(Boolean).join(', ') || '-'
                        })()}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          row.status === "completed" ? "bg-green-100 text-green-800" :
                          row.status === "in-transit" ? "bg-blue-100 text-blue-800" :
                          row.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        )}>
                          {row.status || 'pending'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )})()}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <div className="space-y-6">
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Create New Load</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const getVehicleReg = () => {
                      if (!selectedVehicleId) return ''
                      const v = vehicles.find((vv) => String(vv.id) === String(selectedVehicleId))
                      return v?.registration_number || ''
                    }
                    const getDriverName = () => {
                      const d = driverAssignments[0]
                      if (!d?.id) return ''
                      const drv = drivers.find((dd) => String(dd.id) === String(d.id))
                      return drv ? `${drv.first_name} ${drv.surname}`.trim() : ''
                    }
                    const deliveredByStr = [getVehicleReg(), getDriverName()].filter(Boolean).join(' - ')
                    const getClientName = () => {
                      if (selectedClient?.name) return selectedClient.name
                      if (manualClientName) return manualClientName
                      if (client) return client
                      return ''
                    }
                    const getCompletedBy = async () => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser()
                        return user?.email || user?.user_metadata?.first_name || ''
                      } catch { return '' }
                    }
                    getCompletedBy().then((completedBy) => {
                      const now = new Date()
                      const data: LoadconPrintData = {
                        orderNumber: orderNumber || '',
                        loadType: 'Cross Border',
                        loadDate: now.toLocaleDateString('en-ZA'),
                        customerName: getClientName(),
                        collectionAddress: loadingLocation || '',
                        delivery: dropOffPoint || '',
                        loadingPointCompany: loadingPointCompany || '',
                        loadingPointCity: loadingPointCity || '',
                        offloadingPointCompany: offloadingPointCompany || '',
                        offloadingPointCity: offloadingPointCity || '',
                        weight: '',
                        collectedBy: deliveredByStr,
                        deliveredBy: deliveredByStr,
                        notes: comment || '',
                        completedBy,
                        createdBy: completedBy,
                        createdTimestamp: now.toLocaleString('en-ZA'),
                        rate: rate || '',
                        bookingRef: orderNumber ? `${orderNumber} - ${getClientName()}` : '',
                      }
                      const html = buildLoadconHTML(data)
                      const printWindow = window.open('', '_blank', 'width=800,height=1000')
                      if (!printWindow) return
                      printWindow.document.write(html)
                      printWindow.document.close()
                      setTimeout(() => printWindow.print(), 500)
                    })
                  }}
                >
                  <Printer className="h-4 w-4 mr-1" /> Print Loadcon
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-6">
                {/* Basic Load Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="clientCode">Client Code</Label>
                      <ClientDropdown 
                        value={selectedClient ? client : ''} 
                        onChange={handleClientSelect} 
                        clients={clients}
                        placeholder="Select client code" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="commodity">Commodity</Label>
                      <CommodityDropdown value={commodity} onChange={setCommodity} placeholder="Select commodity" />
                    </div>
                    <div>
                      <Label htmlFor="orderNumber">Order Number</Label>
                      <div className="flex gap-2">
                        <Input value={orderNumber} readOnly placeholder={reuseOrderNumber ? "Reusing selected" : "Auto-assigned on create"} className={!reuseOrderNumber ? "" : "bg-blue-50"} />
                        <Button
                          type="button"
                          variant={reuseOrderNumber ? "default" : "outline"}
                          size="sm"
                          className={`shrink-0 px-3 ${reuseOrderNumber ? "bg-blue-600 text-white" : ""}`}
                          onClick={() => {
                            if (reuseOrderNumber) {
                              setReuseOrderNumber(false)
                              setOrderNumber('')
                            } else {
                              setShowReuseOrderModal(true)
                              setReuseOrderPage(0)
                              setReuseOrderTrips([])
                              setReuseOrderHasMore(true)
                            }
                          }}
                        >
                          {reuseOrderNumber ? "Selected" : "Reuse"}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="client">Client</Label>
                    <div className="space-y-2">
                      <ClientNameDisplay 
                        selectedClient={selectedClient}
                        placeholder="Client name will appear here"
                      />
                      <div className="text-center text-xs text-gray-500">OR</div>
                      <Input 
                        value={manualClientName}
                        onChange={(e) => {
                          setManualClientName(e.target.value)
                          setClient(e.target.value)
                          setSelectedClient(null)
                        }}
                        placeholder="Type new client name"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="comment">Comment</Label>
                    <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" />
                  </div>
                </div>

                {/* Location & Timing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="etaPickup">ETA Pick Up</Label>
                    <DateTimePicker
                      value={etaPickup}
                      onChange={handleEtaPickupChange}
                      placeholder="Select pickup date and time"
                    />
                  </div>
                  <div>
                    <LocationAutocomplete
                      label="Loading Location"
                      value={loadingLocation}
                      onChange={(value) => {
                        console.log('Loading location changed to:', value)
                        setLoadingLocation(value)
                        const stillMatches = loadingLocationSelection &&
                          (loadingLocationSelection.address === value || loadingLocationSelection.name === value)
                        if (!stillMatches) {
                          setLoadingLocationSelection(null)
                        }
                        setOptimizedRoute(null)
                      }}
                      onSelect={(suggestion) => {
                        const selected = normalizeSelectedLookup(suggestion)
                        if (!selected) return
                        const displayValue =
                          suggestion?.type === 'place' && suggestion?.name
                            ? suggestion.name
                            : (suggestion.address || suggestion.name || '')
                        setLoadingLocation(displayValue)
                        setLoadingLocationSelection(selected)
                        setOptimizedRoute(null)
                      }}
                      placeholder="Search for loading location"
                      clientLocations={useMemo(() => {
                        const selectedClient = clients.find(c => c.name === client)
                        if (!selectedClient) return []
                        try {
                          return typeof selectedClient.pickupLocations === 'string' ? 
                            JSON.parse(selectedClient.pickupLocations) : 
                            (selectedClient.pickupLocations || selectedClient.pickup_locations || [])
                        } catch { return [] }
                      }, [clients, client])
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="etaDropoff">ETA Drop Off</Label>
                    <DateTimePicker
                      value={etaDropoff}
                      onChange={handleEtaDropoffChange}
                      placeholder="Select drop-off date and time"
                      required={true}
                    />
                  </div>
                  <div>
                    <LocationAutocomplete
                      label="Drop Off Point"
                      value={dropOffPoint}
                      required={true}
                      onChange={(value) => {
                        console.log('Drop off location changed to:', value)
                        setDropOffPoint(value)
                        const stillMatches = dropOffSelection &&
                          (dropOffSelection.address === value || dropOffSelection.name === value)
                        if (!stillMatches) {
                          setDropOffSelection(null)
                        }
                        setOptimizedRoute(null)
                      }}
                      onSelect={(suggestion) => {
                        const selected = normalizeSelectedLookup(suggestion)
                        if (!selected) return
                        const displayValue =
                          suggestion?.type === 'place' && suggestion?.name
                            ? suggestion.name
                            : (suggestion.address || suggestion.name || '')
                        setDropOffPoint(displayValue)
                        setDropOffSelection(selected)
                        setOptimizedRoute(null)
                      }}
                      placeholder="Search for drop off location"
                      clientLocations={useMemo(() => {
                        const selectedClient = clients.find(c => c.name === client)
                        if (!selectedClient) return []
                        try {
                          return typeof selectedClient.dropoffLocations === 'string' ? 
                            JSON.parse(selectedClient.dropoffLocations) : 
                            (selectedClient.dropoffLocations || selectedClient.dropoff_locations || [])
                        } catch { return [] }
                      }, [clients, client])
                      }
                    />
                  </div>
                </div>

                {/* Loading & Offloading Point Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <Label className="text-sm font-semibold text-slate-700">Loading Point</Label>
                    <div>
                      <Label htmlFor="loadingPointCompany" className="text-xs">Company Name</Label>
                      <Input
                        id="loadingPointCompany"
                        value={loadingPointCompany}
                        onChange={(e) => setLoadingPointCompany(e.target.value)}
                        placeholder="Enter loading company name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="loadingPointCity" className="text-xs">City</Label>
                      <Input
                        id="loadingPointCity"
                        value={loadingPointCity}
                        onChange={(e) => setLoadingPointCity(e.target.value)}
                        placeholder="Enter loading city"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <Label className="text-sm font-semibold text-slate-700">Offloading Point</Label>
                    <div>
                      <Label htmlFor="offloadingPointCompany" className="text-xs">Company Name</Label>
                      <Input
                        id="offloadingPointCompany"
                        value={offloadingPointCompany}
                        onChange={(e) => setOffloadingPointCompany(e.target.value)}
                        placeholder="Enter offloading company name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="offloadingPointCity" className="text-xs">City</Label>
                      <Input
                        id="offloadingPointCity"
                        value={offloadingPointCity}
                        onChange={(e) => setOffloadingPointCity(e.target.value)}
                        placeholder="Enter offloading city"
                      />
                    </div>
                  </div>
                </div>

                {/* Trip Type Selection */}
                <div className="space-y-4">
                  <Label className="text-lg font-medium">Trip Type</Label>
                  <div className="flex space-x-6">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="local" 
                        name="tripType" 
                        value="local" 
                        checked={tripType === 'local'}
                        onChange={(e) => setTripType(e.target.value)}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="local">Local Trip</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="national" 
                        name="tripType" 
                        value="national" 
                        checked={tripType === 'national'}
                        onChange={(e) => {
                          setTripType(e.target.value)
                          fetchStopPoints() // Load stop points for both trip types
                        }}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="national">Long Distance</Label>
                    </div>
                  </div>
                </div>

                {/* Stop Points - Available for both Local and Long Distance */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-lg font-medium">Stop Points</Label>
                      <p className="text-sm text-gray-500 mt-1">
                        Add stops from existing points or search for custom locations
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        onClick={async (e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          await fetchStopPoints()
                          setStopPoints([...stopPoints, ''])
                        }} 
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Stop Point
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setShowCreateStopModal(true)
                        }} 
                        size="sm"
                      >
                        <MapPin className="h-4 w-4 mr-1" /> Create Stop Point
                      </Button>
                    </div>
                  </div>
                  
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event: DragEndEvent) => handleDragEnd(event)}
                  >
                    <SortableContext items={stopPoints.map((_, i) => String(i))} strategy={verticalListSortingStrategy}>
                      {stopPoints.map((stopPoint, index) => (
                        <SortableStopPointItem
                          key={index}
                          id={String(index)}
                          index={index}
                          stopPoint={stopPoint}
                          filteredStopPoints={filteredStopPoints}
                          availableStopPoints={availableStopPoints}
                          isLoadingStopPoints={isLoadingStopPoints}
                          customStopPoint={customStopPoints[index] || ''}
                          customStopSelection={customStopSelections[index]}
                          onStopPointChange={(value) => {
                            const updated = [...stopPoints]
                            updated[index] = value
                            setStopPoints(updated)
                            const updatedCustom = [...customStopPoints]
                            updatedCustom[index] = ''
                            setCustomStopPoints(updatedCustom)
                            setCustomStopSelections(prev => ({ ...prev, [index]: null }))
                            setOptimizedRoute(null)
                          }}
                          onRemove={() => {
                            const updated = stopPoints.filter((_, i) => i !== index)
                            setStopPoints(updated)
                            const updatedCustom = customStopPoints.filter((_, i) => i !== index)
                            setCustomStopPoints(updatedCustom)
                            setCustomStopSelections(prev => {
                              const next = { ...prev }
                              delete next[index]
                              return next
                            })
                            setIsManuallyOrdered(false)
                          }}
                          onCustomChange={(value) => {
                            const updatedCustom = [...customStopPoints]
                            while (updatedCustom.length <= index) {
                              updatedCustom.push('')
                            }
                            updatedCustom[index] = value
                            setCustomStopPoints(updatedCustom)
                            const prev = customStopSelections[index]
                            const stillMatches = prev &&
                              (prev.address === value || prev.name === value)
                            if (!stillMatches) {
                              setCustomStopSelections(prev => ({ ...prev, [index]: null }))
                            }
                            if (value) {
                              const updated = [...stopPoints]
                              updated[index] = ''
                              setStopPoints(updated)
                            }
                            setOptimizedRoute(null)
                          }}
                          onCustomSelect={(suggestion) => {
                            const updatedCustom = [...customStopPoints]
                            while (updatedCustom.length <= index) {
                              updatedCustom.push('')
                            }
                            updatedCustom[index] =
                              suggestion?.type === 'place' && suggestion?.name
                                ? suggestion.name
                                : (suggestion.address || suggestion.name || '')
                            setCustomStopPoints(updatedCustom)
                            setCustomStopSelections(prev => ({
                              ...prev,
                              [index]: normalizeSelectedLookup(suggestion),
                            }))
                            const updated = [...stopPoints]
                            updated[index] = ''
                            setStopPoints(updated)
                            setOptimizedRoute(null)
                          }}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>

                {/* Route Preview */}
                {(loadingLocation && dropOffPoint) || selectedClient?.coordinates ? (
                  <div className="col-span-full">
                    <div className="space-y-4">
                      {isOptimizing && tripType === 'national' && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          Optimizing route...
                        </div>
                      )}
                      <div className="space-y-4">
                        <RoutePreviewMap
                          origin={loadingLocation}
                          destination={dropOffPoint}
                          originCoordinates={loadingLocationSelection ? {
                            lat: loadingLocationSelection.lat,
                            lng: loadingLocationSelection.lng,
                          } : undefined}
                          destinationCoordinates={dropOffSelection ? {
                            lat: dropOffSelection.lat,
                            lng: dropOffSelection.lng,
                          } : undefined}
                           stopPoints={stopPoints.length > 0 || customStopPoints.some(p => p) ? 'async' : []}
                          getStopPointsData={getSelectedStopPointsData}
                          preserveOrder={isManuallyOrdered}
                          driverLocation={selectedDriverLocation ? {
                            lat: selectedDriverLocation.latitude,
                            lng: selectedDriverLocation.longitude,
                            name: selectedDriverLocation.name ||
                              `${selectedDriverLocation.driver?.first_name || ''} ${selectedDriverLocation.driver?.surname || ''}`.trim() ||
                              selectedDriverLocation.vehicle?.registration_number ||
                              'Vehicle'
                          } : undefined}
                          clientLocation={selectedClient?.coordinates ? (() => {
                            try {
                              const coords = selectedClient.coordinates.split(' ')[0].split(',')
                              if (coords.length >= 2) {
                                const lng = parseFloat(coords[0])
                                const lat = parseFloat(coords[1])
                                if (!isNaN(lng) && !isNaN(lat)) {
                                  return { lat, lng, name: selectedClient.name }
                                }
                              }
                            } catch (error) {
                              console.error('Error parsing client coordinates:', error)
                            }
                            return undefined
                          })() : undefined}
                          selectedClient={selectedClient}
                        />
                        
                        {/* Route Summary */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium">
                              {tripType === 'local' ? 'Local Route' : 'Long Distance Route'} (Optimized)
                            </h4>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowRouteModal(true)}
                            >
                              Edit Route
                            </Button>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Loading:</span> {loadingLocation}
                            </div>
                            {stopPoints.length > 0 && (
                              <div>
                                <span className="font-medium">Stop Points:</span> {stopPoints.length} stop(s) added
                              </div>
                            )}
                            {dropOffPoint && (
                              <div>
                                <span className="font-medium">Drop-off:</span> {dropOffPoint}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Trip Type:</span> {tripType === 'local' ? 'Local Trip' : 'Long Distance'}
                            </div>
                            <div>
                              <span className="font-medium">Driver:</span> {
                                (() => {
                                  const firstDriver = driverAssignments[0]
                                  if (firstDriver?.id) {
                                    const driver = drivers.find(d => d.id === firstDriver.id)
                                    return driver ? `${driver.first_name} ${driver.surname}` : 'Selected Driver'
                                  }
                                  return 'No driver selected'
                                })()
                              }
                            </div>
                            {optimizedRoute && (
                              <div className="border-t pt-2 mt-2">
                                <div className="font-medium text-blue-600 mb-1">
                                  Route Information {optimizedRoute.hasDriverLocation ? '(Driver → Loading → Drop-off)' : '(Loading → Drop-off)'}:
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="font-medium">Total Distance:</span> {
                                      Math.round((optimizedRoute.route?.distance || optimizedRoute.distance) / 1000 * 10) / 10
                                    } km
                                  </div>
                                  <div>
                                    <span className="font-medium">Estimated Time:</span> {
                                      (() => {
                                        const duration = optimizedRoute.route?.duration || optimizedRoute.duration
                                        return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
                                      })()
                                    }
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Driver Assignments */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-medium">Driver Assignments</Label>
                    <Button 
                      type="button" 
                      onClick={addDriver} 
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Driver
                    </Button>
                  </div>
                  
                  {driverAssignments.map((driver, driverIndex) => (
                    <div key={driverIndex} className="mb-2">
                      <DriverDropdown
                        value={driver.id}
                        onChange={(value) => handleDriverChange(driverIndex, value)}
                        onOpen={() => handleDriverDropdownOpen(driverIndex)}
                        drivers={availableDrivers}
                        placeholder="Select available driver"
                        showDistance={!!loadingLocation}
                      />
                    </div>
                  ))}
                </div>

                {/* Vehicle Selection */}
                <div className="space-y-4">
                  <Label className="text-lg font-medium">Vehicle Assignment</Label>
                  
                  {/* Vehicle Type Dropdown */}
                  <div className="space-y-2">
                    <Label htmlFor="vehicleType" className="text-sm font-medium text-slate-700">Vehicle Type (Optional)</Label>
                    <VehicleTypeDropdown
                      value={selectedVehicleType}
                      onChange={(value) => {
                        setSelectedVehicleType(value)
                        setSelectedVehicleId('') // Reset vehicle selection when type changes
                      }}
                      placeholder="Select vehicle type to filter"
                    />
                  </div>

                  {/* Horse Dropdown - Filtered by selected type */}
                  <div className="space-y-2">
                    <Label htmlFor="horse" className="text-sm font-medium text-slate-700">Select Horse</Label>
                    <VehicleDropdown
                      value={selectedVehicleId}
                      onChange={setSelectedVehicleId}
                      vehicles={filteredVehicles}
                      placeholder="Select horse (vehicle/truck)"
                    />
                  </div>

                  {/* Trailer 1 Dropdown - Only trailers */}
                  <div className="space-y-2">
                    <Label htmlFor="trailer" className="text-sm font-medium text-slate-700">Select Trailer 1</Label>
                    <TrailerDropdown
                      value={selectedTrailerId}
                      onChange={setSelectedTrailerId}
                      trailers={trailersForDropdown}
                      placeholder="Select first trailer"
                    />
                  </div>

                  {/* Trailer 2 Dropdown - Only trailers */}
                  <div className="space-y-2">
                    <Label htmlFor="trailer2" className="text-sm font-medium text-slate-700">Select Trailer 2 (Optional)</Label>
                    <TrailerDropdown
                      value={selectedTrailer2Id}
                      onChange={setSelectedTrailer2Id}
                      trailers={filteredTrailers}
                      placeholder="Select second trailer (optional)"
                    />
                    {selectedTrailer2Id && (
                      <p className="text-xs text-emerald-600">
                        <span>⚠️</span>
                        <span>Linked trailer will be saved with the trip assignment.</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Future Handover Assignments */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-medium">Future Handovers</Label>
                    <Button type="button" size="sm" onClick={addHandoverAssignmentSet}>
                      <Plus className="h-4 w-4 mr-1" /> Add Handover Set
                    </Button>
                  </div>
                  <p className="text-xs text-slate-600">
                    Stored in <span className="font-semibold">handed_vehicleassignments</span> as ordered sets of
                    <span className="font-semibold"> drivers + vehicle + trailers</span>.
                  </p>

                  {handoverAssignments.length === 0 && (
                    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                      No handover sets added yet.
                    </div>
                  )}

                  {handoverAssignments.map((set, setIndex) => (
                    <div key={`handover-${setIndex}`} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Handover #{setIndex + 1}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeHandoverAssignmentSet(setIndex)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700">Horse (Vehicle/Truck)</Label>
                          <VehicleDropdown
                            value={set.vehicleId}
                            onChange={(value) => handleHandoverVehicleChange(setIndex, 'vehicleId', value)}
                            vehicles={filteredVehicles}
                            placeholder="Select handover horse"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700">Trailer</Label>
                          <TrailerDropdown
                            value={set.trailerId}
                            onChange={(value) => handleHandoverVehicleChange(setIndex, 'trailerId', value)}
                            trailers={filteredTrailers}
                            placeholder="Select handover trailer"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700">Trailer 2</Label>
                          <TrailerDropdown
                            value={set.trailer2Id || ''}
                            onChange={(value) => handleHandoverVehicleChange(setIndex, 'trailer2Id', value)}
                            trailers={filteredTrailers}
                            placeholder="Select handover trailer 2"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-slate-700">Drivers</Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => addHandoverDriver(setIndex)}
                          >
                            <Plus className="h-4 w-4 mr-1" /> Add Driver
                          </Button>
                        </div>
                        {(set.drivers || []).map((driver, driverIndex) => (
                          <div key={`handover-${setIndex}-driver-${driverIndex}`} className="flex gap-2 items-center">
                            <div className="flex-1">
                              <DriverDropdown
                                value={driver.id}
                                onChange={(value) => handleHandoverDriverChange(setIndex, driverIndex, value)}
                                drivers={availableDrivers}
                                placeholder={`Select driver #${driverIndex + 1}`}
                                showDistance={false}
                              />
                            </div>
                            {(set.drivers || []).length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => removeHandoverDriver(setIndex, driverIndex)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>



                {/* Cost Calculation Section */}
                <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-600 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Trip Cost Estimate</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="space-y-2">
                      <Label htmlFor="rate" className="text-sm font-medium text-slate-700">Rate (R) *</Label>
                      <Input 
                        value={rate} 
                        onChange={(e) => setRate(e.target.value)} 
                        placeholder="e.g. 4000" 
                        type="number"
                        step="0.01"
                        className="border-slate-300 focus:border-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tripDays" className="text-sm font-medium text-slate-700">Trip Days</Label>
                      <Input 
                        value={tripDays} 
                        onChange={(e) => setTripDays(parseFloat(e.target.value) || 1)} 
                        placeholder="0.5 days" 
                        type="number"
                        step="0.5"
                        min="0.5"
                        className="border-slate-300 focus:border-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Distance</Label>
                      <div className="h-10 flex items-center rounded-md border border-slate-200 bg-slate-50 px-3">
                        <span className="text-sm font-semibold text-slate-800">{estimatedDistance} km</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3">
                      <h4 className="text-sm font-bold text-slate-800">COST B/D</h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-slate-700">DRIVER</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {costBreakdown ? `R${costBreakdown.driverCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${tripDays} DAYS)` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-slate-700">FIXED - ASSET</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {costBreakdown ? `R${costBreakdown.fixedAssetCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${tripDays} DAYS)` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-slate-700">FUEL</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {costBreakdown ? `R${costBreakdown.fuelCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-slate-700">R&M</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {costBreakdown ? `R${costBreakdown.rmCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-slate-700">CROSS BORDER</span>
                        <span className="text-sm font-semibold text-slate-900">
                          {costBreakdown ? `R${costBreakdown.crossBorderCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-slate-300 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">TOTAL COST</span>
                        <span className="text-sm font-bold text-slate-900">
                          {costBreakdown ? `R${costBreakdown.totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">REVENUE</span>
                        <span className="text-sm font-bold text-slate-900">
                          {rate && parseFloat(rate) > 0 ? `R${parseFloat(rate).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">PROFIT</span>
                        <span className={`text-sm font-bold ${costBreakdown && rate && parseFloat(rate) > 0 && (parseFloat(rate) - costBreakdown.totalCost) >= 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {costBreakdown && rate && parseFloat(rate) > 0
                            ? `R${(parseFloat(rate) - costBreakdown.totalCost).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                    {tripCostLoading && (
                      <div className="px-4 py-2 text-xs text-slate-500">Calculating...</div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {isEditMode && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        sessionStorage.removeItem('editTripData')
                        router.push('/dashboard')
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      const getVehicleReg = () => {
                        if (!selectedVehicleId) return ''
                        const v = vehicles.find((vv) => String(vv.id) === String(selectedVehicleId))
                        return v?.registration_number || ''
                      }
                      const getDriverName = () => {
                        const d = driverAssignments[0]
                        if (!d?.id) return ''
                        const drv = drivers.find((dd) => String(dd.id) === String(d.id))
                        return drv ? `${drv.first_name} ${drv.surname}`.trim() : ''
                      }
                      const deliveredByStr = [getVehicleReg(), getDriverName()].filter(Boolean).join(' - ')
                      const getClientName = () => {
                        if (selectedClient?.name) return selectedClient.name
                        if (manualClientName) return manualClientName
                        return client
                      }
                      const now = new Date()
                      const data: LoadconPrintData = {
                        orderNumber: orderNumber || 'WC000000',
          loadType: 'Cross Border',
          loadDate: now.toLocaleDateString('en-ZA'),
          customerName: getClientName(),
          collectionAddress: loadingLocation || '',
          delivery: dropOffPoint || '',
          loadingPointCompany: loadingPointCompany || '',
          loadingPointCity: loadingPointCity || '',
          offloadingPointCompany: offloadingPointCompany || '',
          offloadingPointCity: offloadingPointCity || '',
          collectedBy: deliveredByStr,
          deliveredBy: deliveredByStr,
                        notes: comment || '',
                        createdBy: '',
                        createdTimestamp: now.toLocaleString('en-ZA'),
                        rate: rate || '',
                        bookingRef: orderNumber && orderNumber !== 'WC000000' ? `${orderNumber} - ${getClientName()}` : '',
                      }
                      const html = buildLoadconHTML(data)
                      const printWindow = window.open('', '_blank', 'width=800,height=1000')
                      if (!printWindow) return
                      printWindow.document.write(html)
                      printWindow.document.close()
                      setTimeout(() => printWindow.print(), 500)
                    }}
                    disabled={isSubmitting}
                  >
                    <Printer className="h-4 w-4 mr-1" /> Preview
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleCreateClick} 
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Processing...' : (isEditMode ? 'Update Trip' : 'Create and Preview')}
                  </Button>
                </div>
              </form>
            </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <div className="space-y-6">
            {/* Route Optimization for All Loads */}
            <Card>
              <CardHeader>
                <CardTitle>Route Optimization Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  View and track optimized truck routes for all loads. Routes are automatically optimized considering truck restrictions, traffic conditions, and delivery schedules.
                </p>
              </CardContent>
            </Card>

            {/* Trip Routes Display */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {loads.filter(trip => trip.status?.toLowerCase() !== 'delivered').map((trip) => {
                const assignments = parseJsonField(trip.vehicleassignments) || []
                const pickupLocations = parseJsonField(trip.pickuplocations) || []
                const dropoffLocations = parseJsonField(trip.dropofflocations) || []
                
                return (
                  <div key={trip.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <Route className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{trip.trip_id}</h3>
                            <p className="text-sm text-slate-500">{trip.ordernumber}</p>
                          </div>
                        </div>
                        <span className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wide",
                          trip.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                          trip.status === "in-transit" ? "bg-blue-100 text-blue-700" :
                          trip.status === "pending" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {trip.status || 'pending'}
                        </span>
                      </div>
                      
                      {/* Client & Commodity */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Client</p>
                          <p className="text-sm font-medium text-slate-900">{trip.clientdetails?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Commodity</p>
                          <p className="text-sm font-medium text-slate-900">{trip.cargo || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="p-6 border-b border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Progress Timeline</h4>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          {[
                            { label: 'Created', completed: true },
                            { label: 'Assigned', completed: assignments.length > 0 },
                            { label: 'In Transit', completed: trip.status === 'in-transit' || trip.status === 'completed' },
                            { label: 'Completed', completed: trip.status === 'completed' }
                          ].map((step, index, array) => (
                            <div key={step.label} className="flex flex-col items-center relative">
                              <div className={cn(
                                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-colors",
                                step.completed 
                                  ? "bg-slate-600 border-slate-600 text-white" 
                                  : "bg-white border-slate-300 text-slate-400"
                              )}>
                                {index + 1}
                              </div>
                              <span className={cn(
                                "text-xs mt-2 font-medium",
                                step.completed ? "text-slate-900" : "text-slate-400"
                              )}>
                                {step.label}
                              </span>
                              {index < array.length - 1 && (
                                <div className={cn(
                                  "absolute top-4 left-8 w-full h-0.5 -z-10",
                                  step.completed && array[index + 1].completed 
                                    ? "bg-slate-600" 
                                    : "bg-slate-200"
                                )} style={{ width: 'calc(100% + 2rem)' }} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Locations */}
                    <div className="p-6 border-b border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Route Details</h4>
                      <div className="space-y-3">
                        {pickupLocations.map((pickup, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                            <div className="p-1.5 bg-emerald-100 rounded-full">
                              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">PICKUP</span>
                              </div>
                              <p className="text-sm font-medium text-slate-900 truncate">{pickup.location || pickup.address}</p>
                              <p className="text-xs text-slate-500">{pickup.scheduled_time ? new Date(pickup.scheduled_time).toLocaleString() : 'Time TBD'}</p>
                            </div>
                          </div>
                        ))}
                        {dropoffLocations.map((dropoff, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="p-1.5 bg-red-100 rounded-full">
                              <MapPin className="h-3.5 w-3.5 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">DROP-OFF</span>
                              </div>
                              <p className="text-sm font-medium text-slate-900 truncate">{dropoff.location || dropoff.address}</p>
                              <p className="text-xs text-slate-500">{dropoff.scheduled_time ? new Date(dropoff.scheduled_time).toLocaleString() : 'Time TBD'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Assignments */}
                    <div className="p-6">
                      <h4 className="text-sm font-semibold text-slate-900 mb-4">Assignments</h4>
                      {assignments.length > 0 ? (
                        <div className="space-y-3">
                          {assignments.map((assignment, index) => (
                            <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Vehicle</p>
                                  <p className="text-sm font-medium text-slate-900">{assignment.vehicle?.name || assignment.vehicle?.registration_number || 'Unassigned'}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Driver(s)</p>
                                  <div className="space-y-1">
                                    {assignment.drivers?.filter(d => d.name).map((driver, dIndex) => (
                                      <p key={dIndex} className="text-sm font-medium text-slate-900">{driver.name}</p>
                                    )) || <p className="text-sm text-slate-500">Unassigned</p>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                          <p className="text-sm text-slate-500">No assignments yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <ClientAddressPopup
        isOpen={showAddressPopup}
        onClose={() => setShowAddressPopup(false)}
        client={selectedClient}
        onUseAsPickup={handleUseAsPickup}
        onUseAsDropoff={handleUseAsDropoff}
        onSkip={handleSkipAddress}
      />
      
      <CreateStopPointModal
        open={showCreateStopModal}
        onOpenChange={setShowCreateStopModal}
        onCreated={async () => {
          await fetchStopPoints()
        }}
      />

      <ClientFormDialog
        open={showClientForm}
        onOpenChange={(open) => { if (!open) { setShowClientForm(false); setEditClientRecord(null) } else setShowClientForm(true) }}
        onSaved={async () => {}}
        initialRecord={editClientRecord}
      />

      <QuickGeozoneDialog
        open={showQuickGeozone}
        onOpenChange={(open) => { if (!open) handleGeozoneSkip() }}
        client={selectedClient}
        onSaved={handleGeozoneSaved}
      />

      <FuelStationModal
        open={showFuelStationModal}
        onOpenChange={setShowFuelStationModal}
        onSaved={async () => {
          await fetchStopPoints()
        }}
      />
      
      <RouteEditModal
        isOpen={showRouteModal}
        onClose={() => setShowRouteModal(false)}
        stopPoints={stopPoints}
        customStopPoints={customStopPoints}
        availableStopPoints={availableStopPoints}
        onReorder={(newOrder) => {
          console.log('Reordering stop points:', newOrder)
          setStopPoints(newOrder.stopPoints)
          setCustomStopPoints(newOrder.customStopPoints)
          setIsManuallyOrdered(true)
          setShowRouteModal(false)
          // Don't clear optimized route immediately - let the effect handle it
        }}
        onForceRecalculate={() => {
          console.log('Force recalculating route')
          setIsManuallyOrdered(false)
          setShowRouteModal(false)
          // Don't clear optimized route immediately - let the effect handle it
        }}
      />

      {showReuseOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="text-lg font-semibold">Reuse Order Number</h3>
                <p className="text-sm text-gray-600">Select an existing order number from past trips</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setShowReuseOrderModal(false); setReuseOrderNumber(false); setOrderNumber(''); setReuseOrderSearch(''); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 pb-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={reuseOrderSearch}
                  onChange={(e) => setReuseOrderSearch(e.target.value)}
                  placeholder="Search by order number or client name..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto p-4">
              {reuseOrderLoading && reuseOrderTrips.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">Loading...</p>
              ) : reuseOrderTrips.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">No order numbers found</p>
              ) : (
                <div className="space-y-1">
                  {reuseOrderTrips
                    .filter((trip) => {
                      if (!reuseOrderSearch.trim()) return true
                      const q = reuseOrderSearch.toLowerCase()
                      const orderNum = (trip.ordernumber || '').toLowerCase()
                      const clientName = (trip.clientdetails?.name || '').toLowerCase()
                      return orderNum.includes(q) || clientName.includes(q)
                    })
                    .map((trip) => (
                      <button
                        key={trip.id}
                        type="button"
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                        onClick={() => {
                          setOrderNumber(trip.ordernumber || '')
                          setReuseOrderNumber(true)
                          setShowReuseOrderModal(false)
                          setReuseOrderSearch('')
                        }}
                      >
                        <div className="text-sm font-medium text-slate-900">{trip.ordernumber}</div>
                        <div className="text-xs text-slate-500">{trip.clientdetails?.name || 'Unknown client'}</div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="flex justify-between border-t p-4">
              <Button variant="outline" onClick={() => { setShowReuseOrderModal(false); setReuseOrderNumber(false); setOrderNumber(''); setReuseOrderSearch(''); }}>
                Cancel
              </Button>
              {reuseOrderHasMore && (
                <Button
                  variant="outline"
                  disabled={reuseOrderLoading}
                  onClick={async () => {
                    setReuseOrderLoading(true)
                    try {
                      const nextPage = reuseOrderPage + 1
                      const res = await fetch(`/api/trips/reuse-order?page=${nextPage}&limit=100`)
                      const data = await res.json()
                      if (data.data) {
                        setReuseOrderTrips((prev) => [...prev, ...data.data])
                        setReuseOrderPage(nextPage)
                        setReuseOrderHasMore(data.data.length === 100)
                      }
                    } catch (err) {
                      console.error('Error loading order numbers:', err)
                    } finally {
                      setReuseOrderLoading(false)
                    }
                  }}
                >
                  {reuseOrderLoading ? 'Loading...' : 'Load More'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast
        open={toast.isVisible}
        onOpenChange={(open) => !open && hideToast()}
        variant={toast.type}
      >
        {toast.message}
      </Toast>
    </div>
  )
}

function SortableStopPointItem({
  id,
  index,
  stopPoint,
  filteredStopPoints,
  availableStopPoints,
  isLoadingStopPoints,
  customStopPoint,
  customStopSelection,
  onStopPointChange,
  onRemove,
  onCustomChange,
  onCustomSelect,
}: {
  id: string
  index: number
  stopPoint: string
  filteredStopPoints: any[]
  availableStopPoints: any[]
  isLoadingStopPoints: boolean
  customStopPoint: string
  customStopSelection: any
  onStopPointChange: (value: string) => void
  onRemove: () => void
  onCustomChange: (value: string) => void
  onCustomSelect: (suggestion: any) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="space-y-2 rounded border border-slate-200 bg-white p-3">
      <div className="flex gap-2 items-center">
        <button type="button" className="cursor-grab active:cursor-grabbing touch-none text-slate-400 hover:text-slate-600" {...attributes} {...listeners}>
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="text-xs text-slate-400 font-mono w-5 text-right shrink-0">{index + 1}.</div>
        <div className="flex-1">
          <StopPointDropdown
            value={stopPoint}
            onChange={onStopPointChange}
            stopPoints={availableStopPoints}
            placeholder="Select from existing stop points"
            isLoading={isLoadingStopPoints}
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove() }}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-center text-xs text-gray-500">OR</div>
      <LocationAutocomplete
        label=""
        value={customStopPoint}
        onChange={onCustomChange}
        onSelect={onCustomSelect}
        placeholder="Search for custom stop location"
      />
    </div>
  )
}
