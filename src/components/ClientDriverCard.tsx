'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'

interface VehicleData {
  plate: string
  driver_name: string
  fuel_probe_1_level_percentage: number
  fuel_probe_1_volume_in_tank: number
  fuel_probe_2_level_percentage: number
  fuel_probe_2_volume_in_tank: number
  speed: number
  geozone: string
  status: string
  latitude: number
  longitude: number
}

interface ClientDriverCardProps {
  driverName: string | null
  vehiclePlate: string | null
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

function getStatusColor(status: string) {
  const s = (status || '').toLowerCase()
  if (s.includes('available') || s.includes('idle')) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (s.includes('transit') || s.includes('moving') || s.includes('drive')) return 'bg-blue-100 text-blue-800 border-blue-200'
  if (s.includes('stop') || s.includes('stationary')) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export default function ClientDriverCard({ driverName, vehiclePlate }: ClientDriverCardProps) {
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!vehiclePlate) {
      setLoading(false)
      return
    }

    const fetchVehicle = async () => {
      try {
        const res = await fetch(`/api/vehicles/${encodeURIComponent(vehiclePlate)}`)
        if (res.ok) {
          const data = await res.json()
          setVehicleData(data.vehicle || null)
        }
      } catch (err) {
        console.error('Failed to fetch vehicle data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchVehicle()
    const interval = setInterval(fetchVehicle, 30000)
    return () => clearInterval(interval)
  }, [vehiclePlate])

  const displayName = driverName || 'Unassigned'
  const initials = getInitials(displayName)
  const tank1Vol = vehicleData?.fuel_probe_1_volume_in_tank || 0
  const tank2Vol = vehicleData?.fuel_probe_2_volume_in_tank || 0
  const totalFuel = tank1Vol + tank2Vol
  const fuelPct = vehicleData
    ? vehicleData.fuel_probe_2_level_percentage > 0
      ? Math.round((vehicleData.fuel_probe_1_level_percentage + vehicleData.fuel_probe_2_level_percentage) / 2)
      : vehicleData.fuel_probe_1_level_percentage
    : 0
  const speed = vehicleData?.speed || 0
  const status = vehicleData?.status || 'N/A'

  const circumference = 2 * Math.PI * 18
  const dashOffset = circumference - (fuelPct / 100) * circumference

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#001e42] text-sm font-bold text-white">
            {initials}
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">{displayName}</div>
            {vehiclePlate && (
              <div className="text-xs text-slate-500">{vehiclePlate}</div>
            )}
          </div>
        </div>
        <Badge className={`text-[10px] px-2 py-0.5 font-medium border ${getStatusColor(status)}`}>
          {loading ? '...' : status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rate</span>
          </div>
          <div className="text-sm font-bold text-emerald-700">R0</div>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fuel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle
                  cx="20" cy="20" r="18" fill="none"
                  stroke={fuelPct > 50 ? '#22c55e' : fuelPct > 25 ? '#eab308' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-700">
                {fuelPct}%
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">{totalFuel.toFixed(0)}L</div>
              <div className="text-[10px] text-slate-500">T1: {tank1Vol.toFixed(0)}L / T2: {tank2Vol.toFixed(0)}L</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2 mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Note</span>
        </div>
        <div className="text-xs text-slate-600">No notes added</div>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Vehicle</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900">{vehiclePlate || 'N/A'}</div>
          <div className="text-xs text-slate-500">{speed} km/h</div>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">{vehicleData?.geozone || 'CROSS BORDER'}</div>
      </div>
    </div>
  )
}
