'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { SecureButton } from '@/components/SecureButton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  Users,
  Activity,
  BarChart3,
  Settings,
  Star,
  AlertTriangle,
  Edit,
  Trash,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import DriverDashboardClean from '@/components/driver-dashboard-clean'
import { DashboardProvider } from '@/context/dashboard-context'
import DriverPerformanceDashboard from '@/components/dashboard/DriverPerformanceDashboard'
import ExecutiveDashboardEPS from '@/components/dashboard/ExecutiveDashboardEPS'
import { MaterialCharts } from '@/components/material-charts'
import { epsApi, BiWeeklyCategory, DailyStats } from '@/lib/eps-api'

import ViolationsChart from '@/components/charts/ViolationsChart'
import SpeedingViolationsChart from '@/components/charts/SpeedingViolationsChart'
import ExecutiveDashboardTab from '@/components/ExecutiveDashboardTab'

// NOTE: This file is self-contained for convenience. It uploads files to
// the Supabase storage *bucket* named `files` and places them under:
// - images/drivers/  (for front/rear license images)
// - files/driver/    (for work permit docs)
// Make sure your Supabase project has a bucket called `files` and the
// appropriate RLS/policies or public access for getPublicUrl to work.

type Driver = {
  id?: number
  first_name: string
  surname: string
  id_or_passport_number: string
  id_or_passport_document?: string | null
  passport_date?: string | null
  passport_expiry?: string | null
  passport_status?: string | null
  email_address?: string | null
  cell_number?: string | null
  apointment_date?: string | null
  appointment_date?: string | null
  sa_issued?: boolean
  work_permit_upload?: string | null
  license_number?: string | null
  license_expiry_date?: string | null
  license_code?: string | null
  driver_restriction_code?: string | null
  vehicle_restriction_code?: string | null
  front_of_driver_pic?: string | null
  rear_of_driver_pic?: string | null
  professional_driving_permit?: boolean
  pdp_expiry_date?: string | null
  hazCamDate?: string | null
  medic_exam_date?: string | null
  pop?: string | null
  salary?: number | null
  hourly_rate?: number | null
  driver_code?: string | null
  available?: boolean | null
  testing?: boolean | null
  status?: string | null
  created_at?: string | null
  created_by?: string | null
  user_id?: string | null
}

const getDriverFullName = (driver?: Partial<Driver> | null) =>
  [driver?.first_name, driver?.surname].filter(Boolean).join(' ').trim() || 'Unnamed Driver'

const DRIVER_SELECT_COLUMNS = [
  'id', 'first_name', 'surname', 'id_or_passport_number', 'id_or_passport_document',
  'email_address', 'cell_number', 'sa_issued', 'work_permit_upload', 'license_number',
  'license_expiry_date', 'license_code', 'driver_restriction_code', 'vehicle_restriction_code',
  'front_of_driver_pic', 'rear_of_driver_pic', 'professional_driving_permit', 'pdp_expiry_date',
  'created_at', 'created_by', 'user_id', 'status', 'apointment_date', 'passport_expiry',
  'appointment_date', '"hazCamDate"', 'medic_exam_date', 'pop', 'passport_status',
  'available', 'salary', 'hourly_rate', 'driver_code', 'testing',
].join(', ')

const withTimeout = async <T,>(promise: Promise<T>, label: string, timeoutMs = 30000): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}

const buildDriverPayload = (driver: Driver, userId: string | null): Record<string, unknown> => ({
  first_name: driver.first_name?.trim() || '',
  surname: driver.surname?.trim() || '',
  id_or_passport_number: driver.id_or_passport_number?.trim() || '',
  id_or_passport_document: driver.id_or_passport_document || null,
  email_address: driver.email_address || null,
  cell_number: driver.cell_number || null,
  sa_issued: !!driver.sa_issued,
  work_permit_upload: driver.work_permit_upload || null,
  license_number: driver.license_number || null,
  license_expiry_date: driver.license_expiry_date || null,
  license_code: driver.license_code || null,
  driver_restriction_code: driver.driver_restriction_code || null,
  vehicle_restriction_code: driver.vehicle_restriction_code || null,
  front_of_driver_pic: driver.front_of_driver_pic || null,
  rear_of_driver_pic: driver.rear_of_driver_pic || null,
  professional_driving_permit: !!driver.professional_driving_permit,
  pdp_expiry_date: driver.pdp_expiry_date || null,
  created_by: driver.created_by ?? userId,
})

const isExpiringSoon = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const in30 = new Date()
  in30.setDate(now.getDate() + 30)
  return d <= in30 && d >= now
}

const isExpired = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function RollingCount({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const from = 0
    const to = value
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [value, duration])

  return <>{display}</>
}

export default function Drivers() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<string>('drivers-management')

  const [drivers, setDrivers] = useState<Driver[]>([])

  type Equipment = {
    id: number
    plate: string
    unitIpAddress: string
    tankSize: number | string
    costCentre: string
  }
  const [equipment, setEquipment] = useState<Equipment[]>([
    {
      id: 1,
      plate: 'HW67VCGP M',
      unitIpAddress: '57.163.1.216',
      tankSize: 1100,
      costCentre: 'EPS => Fuel Probes - (COST CODE: 001)',
    },
    {
      id: 2,
      plate: 'JR30TPGP',
      unitIpAddress: '57.163.1.253',
      tankSize: 840,
      costCentre: 'EPS => Fuel Probes - (COST CODE: 001)',
    },
    {
      id: 3,
      plate: 'HY87GKGP',
      unitIpAddress: '59.98.1.136',
      tankSize: 1100,
      costCentre: 'EPS => Fuel Probes - (COST CODE: 001)',
    },
    {
      id: 4,
      plate: 'HW67VGG P M',
      unitIpAddress: '57.164.1.188',
      tankSize: 1100,
      costCentre: 'EPS => Open network - (COST CODE: 001)',
    },
    {
      id: 5,
      plate: 'HS30XYGP',
      unitIpAddress: '58.207.1.148',
      tankSize: 840,
      costCentre: 'EPS => Fuel Probes - (COST CODE: 001)',
    },
  ])
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [licenseFilter, setLicenseFilter] = useState<'all' | 'sa' | 'foreign'>(
    'all',
  )
  const [cardFilter, setCardFilter] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingDriverId, setEditingDriverId] = useState<number | null>(null)

  // Chart data for Executive Dashboard
  const [biWeeklyData, setBiWeeklyData] = useState<BiWeeklyCategory[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  
  // Driver performance data from EPS API
  const [driverPerformanceData, setDriverPerformanceData] = useState<any[]>([])
  const [topSpeedingDrivers, setTopSpeedingDrivers] = useState<any[]>([])
  const [performanceLoading, setPerformanceLoading] = useState(false)

  const emptyForm: Driver = {
    first_name: '',
    surname: '',
    id_or_passport_number: '',
    id_or_passport_document: null,
    email_address: null,
    cell_number: null,
    sa_issued: false,
    work_permit_upload: null,
    license_number: null,
    license_expiry_date: null,
    license_code: null,
    driver_restriction_code: null,
    vehicle_restriction_code: null,
    front_of_driver_pic: null,
    rear_of_driver_pic: null,
    professional_driving_permit: false,
    pdp_expiry_date: null,
    salary: null,
    hourly_rate: null,
    created_by: null,
  }

  const [formData, setFormData] = useState<Driver>(emptyForm)

  useEffect(() => {
    fetchDrivers()
    if (activeTab === 'drivers-performance' || activeTab === 'executive-dashboard') {
      fetchDriverPerformanceData()
    }
  }, [activeTab])

  useEffect(() => {
    // Fetch EPS charts data for executive dashboard
    let mounted = true
    const fetchCharts = async () => {
      try {
        const b = await epsApi.getBiWeeklyCategories()
        const d = await epsApi.getDailyStats()
        if (!mounted) return
        setBiWeeklyData(Array.isArray(b) ? (b as BiWeeklyCategory[]) : [])
        setDailyStats(Array.isArray(d) ? (d as DailyStats[]) : [])
      } catch (err) {
        console.error('Failed to fetch executive dashboard charts data', err)
      }
    }

    fetchCharts()
    return () => {
      mounted = false
    }
  }, [])

  const fetchDriverPerformanceData = async () => {
    setPerformanceLoading(true)
    try {
      const currentDate = new Date()
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1

      // Fetch all driver performance scorecards
      const perfResponse = await fetch(
        `/api/eps-rewards?endpoint=driver-performance/all?year=${year}&month=${month}`
      )
      const perfData = await perfResponse.json()
      setDriverPerformanceData(perfData.scorecards || [])

      // Fetch top speeding drivers
      const speedResponse = await fetch(
        `/api/eps-rewards?endpoint=top-speeding-drivers?limit=10`
      )
      const speedData = await speedResponse.json()
      setTopSpeedingDrivers(speedData.top_speeding_drivers || [])
    } catch (err) {
      console.error('Failed to fetch driver performance data', err)
      toast.error('Failed to load driver performance data')
    } finally {
      setPerformanceLoading(false)
    }
  }

  const fetchDrivers = async () => {
    setIsLoading(true)
    try {
      const response = await withTimeout(
        supabase
          .from('drivers')
          .select(DRIVER_SELECT_COLUMNS)
          .order('created_at', { ascending: false }),
        'Loading drivers',
      )

      const { data, error } = response

      if (error) throw error
      setDrivers((data ?? []) as Driver[])
    } catch (err) {
      console.error('fetchDrivers error', err)
      toast.error('Failed to fetch drivers')
      setDrivers([])
    } finally {
      setIsLoading(false)
    }
  }

  // Small utility: uploads a File to the `license_info` bucket and returns the public URL
  const uploadToStorage = async (
    file: File,
    folder: string,
  ): Promise<string | null> => {
    try {
      setIsUploading(true)
      setUploadingField(folder)

      const bucket = 'license_info'

      // Check if bucket exists, create if not
      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some((b) => b.name === bucket)

      if (!bucketExists) {
        const { error: createError } = await supabase.storage.createBucket(
          bucket,
          {
            public: true,
            allowedMimeTypes: [
              'image/*',
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ],
          },
        )
        if (createError) {
          console.error('Failed to create bucket:', createError)
          toast.error('Failed to create storage bucket')
          return null
        }
      }

      const ext = file.name.split('.').pop() ?? 'bin'
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const filePath = `${folder}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        console.error('upload error:', uploadError.message || uploadError)
        toast.error(`Upload failed: ${uploadError.message || 'Unknown error'}`)
        return null
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)
      const publicUrl = publicUrlData?.publicUrl ?? null
      if (!publicUrl) {
        toast.error('Failed to get public url')
        return null
      }
      toast.success('File uploaded successfully')
      return publicUrl
    } catch (err: any) {
      console.error('Unexpected upload error:', err)
      toast.error(`Upload error: ${err.message || 'Unknown error'}`)
      return null
    } finally {
      setIsUploading(false)
      setUploadingField(null)
    }
  }

  const handleInputChange = (field: keyof Driver, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // file change helper: uploads immediately and stores public url in form
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof Driver,
    folder: string,
  ) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return

    // Basic validation
    const maxSizeMB = 10
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File is too large (max ${maxSizeMB}MB)`)
      return
    }

    const url = await uploadToStorage(file, folder)
    if (url) handleInputChange(field, url)
  }

  const handleDeleteDriver = async (driverId: number) => {
    if (!confirm('Delete driver? This cannot be undone.')) return
    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId)
      if (error) throw error
      toast.success('Driver deleted')
      fetchDrivers()
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete driver')
    }
  }

  const handleDeleteEquipment = (id: number) => {
    if (!confirm('Delete equipment?')) return
    setEquipment((prev) => prev.filter((e) => e.id !== id))
    toast.success('Equipment deleted')
  }

  const startEditDriver = (driver: Driver) => {
    setIsEditing(true)
    setEditingDriverId(driver.id ?? null)
    // Ensure date strings are in yyyy-mm-dd to play nice with <input type="date" />
    const normalizeDate = (d?: string | null) => (d ? d.split('T')[0] : null)
    setFormData({
      ...driver,
      license_expiry_date: normalizeDate(driver.license_expiry_date),
      pdp_expiry_date: normalizeDate(driver.pdp_expiry_date),
    })
    setIsAddDialogOpen(true)
  }

  const handleViewDriver = (driver: Driver) => {
    setSelectedDriver(driver)
    setIsSheetOpen(true)
  }

  const resetForm = () => {
    setFormData(emptyForm)
    setIsEditing(false)
    setEditingDriverId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isUploading) {
      toast.error('Please wait for file uploads to finish')
      return
    }
    setIsSubmitting(true)

    try {
      // attach current user as created_by if available
      const { data: authUser } = await withTimeout(supabase.auth.getUser(), 'Loading current user')
      const userId = authUser.user?.id ?? null

      const payload = buildDriverPayload(formData, userId)

      if (isEditing && editingDriverId) {
        const { error } = await withTimeout(
          supabase
            .from('drivers')
            .update(payload)
            .eq('id', editingDriverId),
          'Updating driver',
        )

        if (error) throw error
        toast.success('Driver updated')
      } else {
        const { error } = await withTimeout(
          supabase.from('drivers').insert(payload as any),
          'Adding driver',
        )

        if (error) throw error
        toast.success('Driver added')
      }

      setIsAddDialogOpen(false)
      resetForm()
      fetchDrivers()
    } catch (err: any) {
      console.error('submit error:', err)
      toast.error(`Failed to save driver: ${err.message || 'Unknown error'}`)
      if (err.message?.includes('row-level security')) {
        toast.error('Permission denied. Please check your access rights.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch (err) {
      return dateString
    }
  }

  const getStatusBadge = (saIssued?: boolean) => {
    return saIssued ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        SA Issued
      </Badge>
    ) : (
      <Badge variant="secondary">Foreign</Badge>
    )
  }

  const getPDPStatusBadge = (hasPDP?: boolean) => {
    return hasPDP ? (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
        Has PDP
      </Badge>
    ) : (
      <Badge variant="secondary">No PDP</Badge>
    )
  }

  const filteredDrivers = drivers.filter((driver) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      (driver.first_name ?? '').toLowerCase().includes(term) ||
      (driver.surname ?? '').toLowerCase().includes(term) ||
      (driver.id_or_passport_number ?? '').toLowerCase().includes(term) ||
      (driver.email_address ?? '').toLowerCase().includes(term) ||
      (driver.cell_number ?? '').toLowerCase().includes(term)

    const matchesFilter =
      licenseFilter === 'all' ||
      (licenseFilter === 'sa' && driver.sa_issued) ||
      (licenseFilter === 'foreign' && !driver.sa_issued)

    let matchesCard = true
    if (cardFilter === 'license-expiring') {
      matchesCard = isExpired(driver.license_expiry_date) || isExpiringSoon(driver.license_expiry_date)
    } else if (cardFilter === 'pdp-expiring') {
      matchesCard = isExpired(driver.pdp_expiry_date) || isExpiringSoon(driver.pdp_expiry_date)
    } else if (cardFilter === 'hazcam-expiring') {
      matchesCard = isExpired(driver.hazCamDate) || isExpiringSoon(driver.hazCamDate)
    } else if (cardFilter === 'medic-expiring') {
      matchesCard = isExpired(driver.medic_exam_date) || isExpiringSoon(driver.medic_exam_date)
    }

    return matchesSearch && matchesFilter && matchesCard
  })

  const licenseExpiringCount = drivers.filter(d => isExpired(d.license_expiry_date) || isExpiringSoon(d.license_expiry_date)).length
  const pdpExpiringCount = drivers.filter(d => isExpired(d.pdp_expiry_date) || isExpiringSoon(d.pdp_expiry_date)).length
  const hazcamExpiringCount = drivers.filter(d => isExpired(d.hazCamDate) || isExpiringSoon(d.hazCamDate)).length
  const medicExpiringCount = drivers.filter(d => isExpired(d.medic_exam_date) || isExpiringSoon(d.medic_exam_date)).length

  return (
    <div className="min-h-screen bg-background">
      {/* Tab Navigation */}
      <div className="sticky top-[52px] z-40 border-b border-border bg-white shadow-sm">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex gap-1 px-4 py-2">
            <button
              onClick={() => setActiveTab('drivers-management')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'drivers-management'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Driver Management</span>
              <span className="sm:hidden">Drivers</span>
            </button>

            <button
              onClick={() => setActiveTab('executive-dashboard')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'executive-dashboard'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Executive Dashboard</span>
              <span className="sm:hidden">Executive</span>
            </button>
            <button
              onClick={() => setActiveTab('drivers-performance')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'drivers-performance'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Driver Performance</span>
              <span className="sm:hidden">Performance</span>
            </button>
            <button
              onClick={() => setActiveTab('driver-monitoring-config')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'driver-monitoring-config'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Monitoring Config</span>
              <span className="sm:hidden">Config</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-screen-2xl mx-auto px-4 py-3 sm:px-6 space-y-6">
          {activeTab === 'drivers-management' && (
            <div className="space-y-6">
              {/* Add Driver Button */}
              <div className="flex justify-end">
                <Dialog.Root
                  open={isAddDialogOpen}
                  onOpenChange={(open) => {
                    setIsAddDialogOpen(open)
                    if (!open) resetForm()
                  }}
                >
                  <Dialog.Trigger asChild>
                    <SecureButton
                      page="drivers"
                      action="create"
                      onClick={resetForm}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Driver
                    </SecureButton>
                  </Dialog.Trigger>

                  <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl border border-gray-300 z-50 overflow-hidden">
                      <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="flex justify-center items-center bg-slate-700 rounded-lg w-8 h-8">
                            <Users className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <Dialog.Title className="text-lg font-semibold text-slate-900">
                              {isEditing ? 'Edit Driver' : 'Add New Driver'}
                            </Dialog.Title>
                            <p className="text-slate-600 text-xs">
                              Complete the form below
                            </p>
                          </div>
                        </div>
                        <Dialog.Close asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-slate-100"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </Dialog.Close>
                      </div>
                      <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4">
                        <form onSubmit={handleSubmit} className="space-y-4">
                          {/* Personal Information */}
                          <div className="bg-slate-50 rounded-md p-4 border border-slate-200">
                            <div className="flex items-center space-x-2 mb-3">
                              <div className="flex justify-center items-center bg-slate-600 rounded w-6 h-6">
                                <Users className="w-3 h-3 text-white" />
                              </div>
                              <h3 className="text-sm font-semibold text-slate-800">
                                Personal Information
                              </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <Label htmlFor="first_name">First Name *</Label>
                                <Input
                                  id="first_name"
                                  value={formData.first_name}
                                  onChange={(e) =>
                                    handleInputChange(
                                      'first_name',
                                      e.target.value,
                                    )
                                  }
                                  required
                                />
                              </div>

                              <div>
                                <Label htmlFor="surname">Surname *</Label>
                                <Input
                                  id="surname"
                                  value={formData.surname || ''}
                                  onChange={(e) =>
                                    handleInputChange('surname', e.target.value)
                                  }
                                  required
                                />
                              </div>

                              <div>
                                <Label htmlFor="id_or_passport_number">
                                  ID/Passport Number *
                                </Label>
                                <Input
                                  id="id_or_passport_number"
                                  value={formData.id_or_passport_number || ''}
                                  onChange={(e) =>
                                    handleInputChange(
                                      'id_or_passport_number',
                                      e.target.value,
                                    )
                                  }
                                  required
                                />
                              </div>

                              <div>
                                <Label htmlFor="id_or_passport_document">
                                  ID/Passport Document
                                </Label>
                                <Input
                                  id="id_or_passport_document"
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                  onChange={(e) =>
                                    handleFileChange(
                                      e,
                                      'id_or_passport_document',
                                      'documents',
                                    )
                                  }
                                />
                                {formData.id_or_passport_document && (
                                  <div className="mt-1">
                                    <a
                                      href={formData.id_or_passport_document}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 hover:underline text-xs"
                                    >
                                      📄 View document
                                    </a>
                                  </div>
                                )}
                              </div>

                              <div>
                                <Label htmlFor="email_address">
                                  Email Address
                                </Label>
                                <Input
                                  id="email_address"
                                  type="email"
                                  value={formData.email_address || ''}
                                  onChange={(e) =>
                                    handleInputChange(
                                      'email_address',
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <Label htmlFor="cell_number">Cell Number</Label>
                                <Input
                                  id="cell_number"
                                  value={formData.cell_number || ''}
                                  onChange={(e) =>
                                    handleInputChange(
                                      'cell_number',
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <Label htmlFor="salary">
                                  Monthly Salary/Cost (R)
                                </Label>
                                <Input
                                  id="salary"
                                  type="text"
                                  inputMode="decimal"
                                  value={formData.salary?.toString() || ''}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(
                                      /[^0-9.]/g,
                                      '',
                                    )
                                    const salary =
                                      value && !isNaN(Number(value))
                                        ? Number(value)
                                        : null
                                    handleInputChange('salary', salary)
                                    handleInputChange(
                                      'hourly_rate',
                                      salary && salary > 0
                                        ? Number((salary / 160).toFixed(2))
                                        : null,
                                    )
                                  }}
                                  placeholder="0.00"
                                />
                              </div>

                              <div>
                                <Label htmlFor="hourly_rate">
                                  Hourly Rate (R)
                                </Label>
                                <Input
                                  id="hourly_rate"
                                  type="text"
                                  value={formData.hourly_rate?.toFixed(2) || ''}
                                  readOnly
                                  className="bg-gray-50"
                                  placeholder="Auto-calculated"
                                />
                              </div>
                            </div>
                          </div>

                          {/* License Information */}
                          <div className="bg-slate-50 rounded-md p-4 border border-slate-200">
                            <div className="flex items-center space-x-2 mb-3">
                              <div className="flex justify-center items-center bg-slate-600 rounded w-6 h-6">
                                <Edit className="w-3 h-3 text-white" />
                              </div>
                              <h3 className="text-sm font-semibold text-slate-800">
                                License Information
                              </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="sa_issued"
                                  checked={!!formData.sa_issued}
                                  onCheckedChange={(checked) =>
                                    handleInputChange('sa_issued', checked)
                                  }
                                />
                                <Label htmlFor="sa_issued">
                                  SA Issued License
                                </Label>
                              </div>

                              <div>
                                <Label htmlFor="work_permit_upload">
                                  Work Permit (PDF / DOC / Image)
                                </Label>
                                <Input
                                  id="work_permit_upload"
                                  type="file"
                                  accept=".pdf,.doc,.docx,image/*"
                                  onChange={(e) =>
                                    handleFileChange(
                                      e,
                                      'work_permit_upload',
                                      'documents',
                                    )
                                  }
                                />
                                {formData.work_permit_upload ? (
                                  <div className="mt-2">
                                    <a
                                      href={formData.work_permit_upload}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      📄 View uploaded work permit
                                    </a>
                                  </div>
                                ) : null}
                              </div>

                              <div>
                                <Label htmlFor="license_number">
                                  License Number
                                </Label>
                                <Input
                                  id="license_number"
                                  value={formData.license_number || ''}
                                  onChange={(e) =>
                                    handleInputChange(
                                      'license_number',
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <Label htmlFor="license_expiry_date">
                                  License Expiry Date
                                </Label>
                                <Input
                                  id="license_expiry_date"
                                  type="date"
                                  value={formData.license_expiry_date || ''}
                                  onChange={(e) =>
                                    handleInputChange(
                                      'license_expiry_date',
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <Label htmlFor="license_code">
                                  License Code
                                </Label>
                                <Select
                                  onValueChange={(v) =>
                                    handleInputChange('license_code', v)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue
                                      placeholder={
                                        formData.license_code ??
                                        'Select license code'
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="A1">
                                      A1 - Motorcycle
                                    </SelectItem>
                                    <SelectItem value="A">
                                      A - Motorcycle
                                    </SelectItem>
                                    <SelectItem value="B">
                                      B - Light Motor Vehicle
                                    </SelectItem>
                                    <SelectItem value="C1">
                                      C1 - Light Commercial Vehicle
                                    </SelectItem>
                                    <SelectItem value="C">
                                      C - Heavy Commercial Vehicle
                                    </SelectItem>
                                    <SelectItem value="EB">
                                      EB - Heavy Commercial Vehicle with Trailer
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="driver_restriction_code">
                                  Driver Restriction Code
                                </Label>
                                <Input
                                  id="driver_restriction_code"
                                  value={formData.driver_restriction_code || ''}
                                  onChange={(e) =>
                                    handleInputChange(
                                      'driver_restriction_code',
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <Label htmlFor="vehicle_restriction_code">
                                  Vehicle Restriction Code
                                </Label>
                                <Input
                                  id="vehicle_restriction_code"
                                  value={
                                    formData.vehicle_restriction_code || ''
                                  }
                                  onChange={(e) =>
                                    handleInputChange(
                                      'vehicle_restriction_code',
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>

                              <div>
                                <Label htmlFor="front_of_driver_pic">
                                  Front of Driver License (image)
                                </Label>
                                <Input
                                  id="front_of_driver_pic"
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handleFileChange(
                                      e,
                                      'front_of_driver_pic',
                                      'license_images',
                                    )
                                  }
                                />
                                {formData.front_of_driver_pic ? (
                                  <img
                                    src={formData.front_of_driver_pic}
                                    alt="front"
                                    className="mt-2 w-40 rounded-lg border"
                                  />
                                ) : null}
                              </div>

                              <div>
                                <Label htmlFor="rear_of_driver_pic">
                                  Rear of Driver License (image)
                                </Label>
                                <Input
                                  id="rear_of_driver_pic"
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handleFileChange(
                                      e,
                                      'rear_of_driver_pic',
                                      'license_images',
                                    )
                                  }
                                />
                                {formData.rear_of_driver_pic ? (
                                  <img
                                    src={formData.rear_of_driver_pic}
                                    alt="rear"
                                    className="mt-2 w-40 rounded-lg border"
                                  />
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/* Professional Driving Permit */}
                          <div className="bg-slate-50 rounded-md p-4 border border-slate-200">
                            <div className="flex items-center space-x-2 mb-3">
                              <div className="flex justify-center items-center bg-slate-600 rounded w-6 h-6">
                                <Star className="w-3 h-3 text-white" />
                              </div>
                              <h3 className="text-sm font-semibold text-slate-800">
                                Professional Driving Permit
                              </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="professional_driving_permit"
                                  checked={
                                    !!formData.professional_driving_permit
                                  }
                                  onCheckedChange={(checked) =>
                                    handleInputChange(
                                      'professional_driving_permit',
                                      checked,
                                    )
                                  }
                                />
                                <Label htmlFor="professional_driving_permit">
                                  Has Professional Driving Permit
                                </Label>
                              </div>

                              <div>
                                <Label htmlFor="pdp_expiry_date">
                                  PDP Expiry Date
                                </Label>
                                <Input
                                  id="pdp_expiry_date"
                                  type="date"
                                  value={formData.pdp_expiry_date || ''}
                                  onChange={(e) =>
                                    handleInputChange(
                                      'pdp_expiry_date',
                                      e.target.value,
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsAddDialogOpen(false)
                                resetForm()
                              }}
                              disabled={isSubmitting}
                              className="text-slate-600 border-slate-300"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={isSubmitting || isUploading}
                              className="bg-slate-700 hover:bg-slate-800 text-white"
                            >
                              {isSubmitting
                                ? 'Saving...'
                                : isEditing
                                  ? 'Update Driver'
                                  : 'Add Driver'}
                            </Button>
                          </div>
                        </form>
                      </div>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {([
                  { key: null, label: 'Total Drivers', count: drivers.length, icon: Users, bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', sub: '' },
                  { key: 'license-expiring', label: 'License Expiring', count: licenseExpiringCount, icon: AlertTriangle, bg: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)', sub: 'expired or within 30 days' },
                  { key: 'pdp-expiring', label: 'PDP Expiring', count: pdpExpiringCount, icon: AlertTriangle, bg: 'linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)', sub: 'expired or within 30 days' },
                  { key: 'hazcam-expiring', label: 'HazCam Expiring', count: hazcamExpiringCount, icon: AlertTriangle, bg: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', sub: 'expired or within 30 days' },
                  { key: 'medic-expiring', label: 'Medic Exam Expiring', count: medicExpiringCount, icon: AlertTriangle, bg: 'linear-gradient(135deg, #f472b6 0%, #e11d48 100%)', sub: 'expired or within 30 days' },
                ] as const).map((card) => (
                  <button
                    key={card.label}
                    onClick={() => setCardFilter(cardFilter === card.key ? null : card.key)}
                    className={`relative overflow-hidden rounded-xl p-4 text-left text-white transition-all duration-200 hover:scale-[1.03] hover:shadow-lg shadow-md ${cardFilter === card.key ? 'ring-2 ring-white ring-offset-2' : ''}`}
                    style={{ background: card.bg }}
                  >
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                    <div className="absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-white/10" />
                    <card.icon className="mb-2 h-5 w-5 text-white/80" />
                    <p className="text-xs font-medium text-white/90">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold"><RollingCount value={card.count} /></p>
                    {card.sub && <p className="mt-0.5 text-[10px] text-white/70">{card.sub}</p>}
                  </button>
                ))}
              </div>

              {/* Search and Filters */}
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search drivers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-border rounded-md bg-background text-sm focus:ring-2 focus:ring-ring focus:border-transparent"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLicenseFilter('all')}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          licenseFilter === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setLicenseFilter('sa')}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          licenseFilter === 'sa'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        SA Issued
                      </button>
                      <button
                        onClick={() => setLicenseFilter('foreign')}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          licenseFilter === 'foreign'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        Foreign
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Drivers Table */}
              <Card className="border-border/60">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#0C1E3D] text-white text-xs uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-semibold">Code</th>
                          <th className="px-4 py-3 text-left font-semibold">Name</th>
                          <th className="px-4 py-3 text-left font-semibold">ID/Passport</th>
                          <th className="px-4 py-3 text-left font-semibold">Cell</th>
                          <th className="px-4 py-3 text-left font-semibold">License Expiry</th>
                          <th className="px-4 py-3 text-left font-semibold">PDP Expiry</th>
                          <th className="px-4 py-3 text-left font-semibold">HazCam</th>
                          <th className="px-4 py-3 text-left font-semibold">Medic Exam</th>
                          <th className="px-4 py-3 text-left font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {isLoading ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center">
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                <span className="ml-2 text-muted-foreground">Loading drivers...</span>
                              </div>
                            </td>
                          </tr>
                        ) : drivers.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                              No drivers found
                            </td>
                          </tr>
                        ) : filteredDrivers.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                              No drivers match your filters
                            </td>
                          </tr>
                        ) : (
                          filteredDrivers.map((driver, i) => {
                            const licenseExpiring = isExpired(driver.license_expiry_date) || isExpiringSoon(driver.license_expiry_date)
                            const pdpExpiring = isExpired(driver.pdp_expiry_date) || isExpiringSoon(driver.pdp_expiry_date)
                            const hazcamExpiring = isExpired(driver.hazCamDate) || isExpiringSoon(driver.hazCamDate)
                            const medicExpiring = isExpired(driver.medic_exam_date) || isExpiringSoon(driver.medic_exam_date)
                            return (
                              <tr key={driver.id} className={`transition-colors hover:bg-muted/30 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                <td className="px-4 py-3 text-xs">{driver.driver_code || driver.driver_restriction_code || '-'}</td>
                                <td className="px-4 py-3 font-medium">
                                  <div>{driver.first_name} {driver.surname}</div>
                                </td>
                                <td className="px-4 py-3">{driver.id_or_passport_number || '-'}</td>
                                <td className="px-4 py-3">{driver.cell_number || '-'}</td>
                                <td className={`px-4 py-3 text-xs font-medium ${licenseExpiring ? 'text-red-600' : ''}`}>
                                  {formatDate(driver.license_expiry_date)}
                                </td>
                                <td className={`px-4 py-3 text-xs font-medium ${pdpExpiring ? 'text-red-600' : ''}`}>
                                  {formatDate(driver.pdp_expiry_date)}
                                </td>
                                <td className={`px-4 py-3 text-xs font-medium ${hazcamExpiring ? 'text-red-600' : ''}`}>
                                  {formatDate(driver.hazCamDate)}
                                </td>
                                <td className={`px-4 py-3 text-xs font-medium ${medicExpiring ? 'text-red-600' : ''}`}>
                                  {formatDate(driver.medic_exam_date)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="outline" onClick={() => handleViewDriver(driver)}>
                                      View
                                    </Button>
                                    <SecureButton page="drivers" action="edit" size="sm" variant="outline" onClick={() => startEditDriver(driver)}>
                                      Edit
                                    </SecureButton>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Driver Details Sheet */}
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="p-4 w-11/12 md:w-2/4 h-screen overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Driver Details</SheetTitle>
                  </SheetHeader>

                  {selectedDriver && (
                    <div className="space-y-4 mt-6 pb-20">
                      {/* Personal Information */}
                      <div className="space-y-2">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Driver Full Name
                          </p>
                          <p className="mt-1 text-lg font-bold text-gray-900">
                            {getDriverFullName(selectedDriver)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Personal Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              First Name
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.first_name}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Surname
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.surname}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              ID Number
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.id_or_passport_number}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Email
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.email_address || 'Not provided'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Cell Number
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.cell_number || 'Not provided'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* License Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          License Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              License Number
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.license_number || 'Not provided'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              License Code
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.license_code || 'Not set'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              License Expiry
                            </p>
                            <p className="text-gray-900">
                              {formatDate(selectedDriver.license_expiry_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              SA Issued
                            </p>
                            <div className="mt-1">
                              {getStatusBadge(selectedDriver.sa_issued)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Professional Driving Permit */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Professional Driving Permit
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Has PDP
                            </p>
                            <div className="mt-1">
                              {getPDPStatusBadge(
                                selectedDriver.professional_driving_permit,
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              PDP Expiry
                            </p>
                            <p className="text-gray-900">
                              {formatDate(selectedDriver.pdp_expiry_date)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Additional Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Driver Restriction Code
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.driver_restriction_code ||
                                'Not set'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Passport Status
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.passport_status || 'Not set'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Passport Date
                            </p>
                            <p className="text-gray-900">
                              {formatDate(selectedDriver.passport_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Passport Expiry
                            </p>
                            <p className="text-gray-900">
                              {formatDate(selectedDriver.passport_expiry)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Appointment Date
                            </p>
                            <p className="text-gray-900">
                              {formatDate(selectedDriver.apointment_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              HazCam Date
                            </p>
                            <p className="text-gray-900">
                              {formatDate(selectedDriver.hazCamDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Medical Exam Date
                            </p>
                            <p className="text-gray-900">
                              {formatDate(selectedDriver.medic_exam_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              POP
                            </p>
                            <p className="text-gray-900">
                              {selectedDriver.pop || 'Not set'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Documents */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Documents
                        </h3>
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Work Permit
                            </p>
                            {selectedDriver.work_permit_upload ? (
                              <a
                                href={selectedDriver.work_permit_upload}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                📄 View Work Permit
                              </a>
                            ) : (
                              <p className="text-gray-500">Not uploaded</p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Front of License
                            </p>
                            {selectedDriver.front_of_driver_pic ? (
                              <img
                                src={selectedDriver.front_of_driver_pic}
                                alt="Front of License"
                                className="w-40 rounded-lg border shadow-sm"
                              />
                            ) : (
                              <p className="text-gray-500">Not uploaded</p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">
                              Rear of License
                            </p>
                            {selectedDriver.rear_of_driver_pic ? (
                              <img
                                src={selectedDriver.rear_of_driver_pic}
                                alt="Rear of License"
                                className="w-40 rounded-lg border shadow-sm"
                              />
                            ) : (
                              <p className="text-gray-500">Not uploaded</p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => {
                              startEditDriver(selectedDriver)
                              setIsSheetOpen(false)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              selectedDriver.id &&
                              handleDeleteDriver(selectedDriver.id)
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          )}

          {activeTab === 'executive-dashboard' && (
            <ExecutiveDashboardTab />
          )}

          {activeTab === 'drivers-performance' && (
            <div className="space-y-6">
              {performanceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2">Loading performance data...</span>
                </div>
              ) : (
                <>
                  {/* Performance Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
                            <Users className="h-5 w-5 text-chart-1" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Drivers</p>
                            <p className="text-xl font-bold text-foreground">{driverPerformanceData.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                            <Star className="h-5 w-5 text-amber-800" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Gold Level</p>
                            <p className="text-xl font-bold text-foreground">
                              {driverPerformanceData.filter(d => d.points?.reward_level === 'Gold').length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Violations</p>
                            <p className="text-xl font-bold text-foreground">
                              {driverPerformanceData.reduce((sum, d) => sum + (d.violations?.total || 0), 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                            <BarChart3 className="h-5 w-5 text-chart-2" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Avg Points</p>
                            <p className="text-xl font-bold text-foreground">
                              {driverPerformanceData.length > 0
                                ? Math.round(
                                    driverPerformanceData.reduce((sum, d) => sum + (d.points?.current_points || 0), 0) /
                                      driverPerformanceData.length
                                  )
                                : 0}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Driver Performance Table */}
                  <Card className="border-border/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Driver Performance Scorecards</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                              <th className="px-4 py-3 text-left font-medium">Driver Name</th>
                              <th className="px-4 py-3 text-left font-medium">Plate</th>
                              <th className="px-4 py-3 text-right font-medium">Current Points</th>
                              <th className="px-4 py-3 text-right font-medium">Points Deducted</th>
                              <th className="px-4 py-3 text-left font-medium">Reward Level</th>
                              <th className="px-4 py-3 text-center font-medium">Total Violations</th>
                              <th className="px-4 py-3 text-center font-medium">Speed</th>
                              <th className="px-4 py-3 text-center font-medium">Harsh Braking</th>
                              <th className="px-4 py-3 text-center font-medium">Night Driving</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {driverPerformanceData.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                  No performance data available
                                </td>
                              </tr>
                            ) : (
                              driverPerformanceData.map((driver, idx) => (
                                <tr key={idx} className={`transition-colors hover:bg-muted/30 ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                  <td className="px-4 py-3 font-medium">{driver.driver_name}</td>
                                  <td className="px-4 py-3 font-mono text-xs">{driver.plate}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-chart-2">
                                    {driver.points?.current_points || 0}
                                  </td>
                                  <td className="px-4 py-3 text-right text-destructive">
                                    {driver.points?.points_deducted || 0}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      className={
                                        driver.points?.reward_level === 'Gold'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : driver.points?.reward_level === 'Silver'
                                            ? 'bg-slate-50 text-slate-700 border-slate-200'
                                            : 'bg-orange-50 text-orange-800 border-orange-200'
                                      }
                                      variant="outline"
                                    >
                                      {driver.points?.reward_level || 'N/A'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Badge variant={driver.violations?.total > 5 ? 'destructive' : 'secondary'}>
                                      {driver.violations?.total || 0}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-center font-mono text-xs">{driver.violations?.speed || 0}</td>
                                  <td className="px-4 py-3 text-center font-mono text-xs">{driver.violations?.harsh_braking || 0}</td>
                                  <td className="px-4 py-3 text-center font-mono text-xs">{driver.violations?.night_driving || 0}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Speeding Drivers */}
                  {topSpeedingDrivers.length > 0 && (
                    <Card className="border-border/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          Top Speeding Drivers
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-destructive/5 text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="px-4 py-3 text-left font-medium">Rank</th>
                                <th className="px-4 py-3 text-left font-medium">Driver Name</th>
                                <th className="px-4 py-3 text-left font-medium">Plate</th>
                                <th className="px-4 py-3 text-center font-medium">Speeding Violations</th>
                                <th className="px-4 py-3 text-right font-medium">Points Deducted</th>
                                <th className="px-4 py-3 text-right font-medium">Current Points</th>
                                <th className="px-4 py-3 text-left font-medium">Level</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {topSpeedingDrivers.map((driver, i) => (
                                <tr key={driver.rank} className={`transition-colors hover:bg-destructive/5 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                                  <td className="px-4 py-3 font-bold">{driver.rank}</td>
                                  <td className="px-4 py-3 font-medium">{driver.driver_name}</td>
                                  <td className="px-4 py-3 font-mono text-xs">{driver.plate}</td>
                                  <td className="px-4 py-3 text-center">
                                    <Badge variant="destructive">{driver.speeding_violations}</Badge>
                                  </td>
                                  <td className="px-4 py-3 text-right text-destructive font-mono">{driver.points_deducted}</td>
                                  <td className="px-4 py-3 text-right font-semibold font-mono">{driver.current_points}</td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      className={
                                        driver.current_level === 'Gold'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : 'bg-slate-50 text-slate-700 border-slate-200'
                                      }
                                      variant="outline"
                                    >
                                      {driver.current_level}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'driver-monitoring-config' && (
            <div className="bg-white shadow-sm border border-gray-200 rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-cyan-50 to-blue-50">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-cyan-700 text-xs text-left uppercase tracking-wider">
                        Criterion
                      </th>
                      <th className="px-6 py-4 font-semibold text-cyan-700 text-xs text-left uppercase tracking-wider">
                        Selected Weighting
                      </th>
                      <th className="px-6 py-4 font-semibold text-cyan-700 text-xs text-left uppercase tracking-wider">
                        Actual Weighting
                      </th>
                      <th className="px-6 py-4 font-semibold text-cyan-700 text-xs text-left uppercase tracking-wider">
                        Risk Tiers
                      </th>
                      <th className="px-6 py-4 font-semibold text-cyan-700 text-xs text-left uppercase tracking-wider">
                        No. Incidents
                      </th>
                      <th className="px-6 py-4 font-semibold text-cyan-700 text-xs text-left uppercase tracking-wider">
                        Statuses
                      </th>
                      <th className="px-6 py-4 font-semibold text-cyan-700 text-xs text-left uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr className="bg-white hover:bg-cyan-50 transition-colors duration-150">
                      <td className="px-6 py-4 font-medium text-gray-900 text-sm whitespace-nowrap">
                        Speeding
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        50.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        50.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        4
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        <span className="inline-flex items-center bg-red-100 px-2.5 py-0.5 rounded-full font-medium text-red-800 text-xs">
                          4
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm">
                        <div className="space-y-1">
                          <div className="bg-blue-100 px-2 py-1 rounded-md text-blue-800 text-xs">
                            Speed Exception 1
                          </div>
                          <div className="bg-blue-100 px-2 py-1 rounded-md text-blue-800 text-xs">
                            Speed Exception 2
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-sm whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 shadow-md hover:shadow-lg p-0 rounded-full w-8 h-8 text-white transition-all duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-slate-50 hover:bg-cyan-50 transition-colors duration-150">
                      <td className="px-6 py-4 font-medium text-gray-900 text-sm whitespace-nowrap">
                        Harsh Accelerating
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        10.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        10.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        4
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        <span className="inline-flex items-center bg-red-100 px-2.5 py-0.5 rounded-full font-medium text-red-800 text-xs">
                          8
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm">
                        <div className="space-y-1">
                          <div className="bg-blue-100 px-2 py-1 rounded-md text-blue-800 text-xs">
                            Safety - Acceleration - Aggressive
                          </div>
                          <div className="bg-blue-100 px-2 py-1 rounded-md text-blue-800 text-xs">
                            Safety - Acceleration - Dangerous
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-sm whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 shadow-md hover:shadow-lg p-0 rounded-full w-8 h-8 text-white transition-all duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-white hover:bg-cyan-50 transition-colors duration-150">
                      <td className="px-6 py-4 font-medium text-gray-900 text-sm whitespace-nowrap">
                        Night Time Driving
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        10.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        10.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        4
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        <span className="inline-flex items-center bg-red-100 px-2.5 py-0.5 rounded-full font-medium text-red-800 text-xs">
                          4
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm">
                        <span className="text-gray-400">-</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-sm whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 shadow-md hover:shadow-lg p-0 rounded-full w-8 h-8 text-white transition-all duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-slate-50 hover:bg-cyan-50 transition-colors duration-150">
                      <td className="px-6 py-4 font-medium text-gray-900 text-sm whitespace-nowrap">
                        Excessive day
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        10.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        10.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        4
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        <span className="inline-flex items-center bg-red-100 px-2.5 py-0.5 rounded-full font-medium text-red-800 text-xs">
                          15
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm">
                        <span className="text-gray-400">-</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-sm whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 shadow-md hover:shadow-lg p-0 rounded-full w-8 h-8 text-white transition-all duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-white hover:bg-cyan-50 transition-colors duration-150">
                      <td className="px-6 py-4 font-medium text-gray-900 text-sm whitespace-nowrap">
                        Harsh Braking
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        10.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        10.0
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        4
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm whitespace-nowrap">
                        <span className="inline-flex items-center bg-red-100 px-2.5 py-0.5 rounded-full font-medium text-red-800 text-xs">
                          20
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900 text-sm">
                        <div className="space-y-1">
                          <div className="bg-blue-100 px-2 py-1 rounded-md text-blue-800 text-xs">
                            Safety - Braking - Dangerous
                          </div>
                          <div className="bg-blue-100 px-2 py-1 rounded-md text-blue-800 text-xs">
                            Safety - Braking - Aggressive
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-sm whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 shadow-md hover:shadow-lg p-0 rounded-full w-8 h-8 text-white transition-all duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-cyan-500 hover:bg-cyan-600 shadow-md hover:shadow-lg p-0 rounded-full w-8 h-8 text-white transition-all duration-200"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </main>
    </div>
  )
}
