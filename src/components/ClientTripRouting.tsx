"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Truck, MapPin, CheckCircle, Clock, Package } from "lucide-react"

const WORKFLOW_STATUSES = [
  { label: "Pending", value: "pending" },
  { label: "Accept", value: "accepted" },
  { label: "Arrived", value: "arrived-at-loading" },
  { label: "Loading", value: "loading" },
  { label: "OnTrip", value: "on-trip" },
  { label: "Arrive", value: "arrive" },
  { label: "Offloading", value: "offloading" },
  { label: "Delivered", value: "delivered" },
]

function LiveElapsed({ timestamp }: { timestamp: string }) {
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000
  if (diff < 0) return null
  if (diff < 60) return <>{`${Math.round(diff)}s`}</>
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return <>{h > 0 ? `${h}h ${m}m` : `${m}m`}</>
}

function formatElapsed(seconds: number | undefined | null): string {
  if (seconds == null || seconds < 0) return ""
  if (seconds < 60) return `${Math.round(seconds)}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function getWaypoints(trip: any) {
  const currentStatusIndex = WORKFLOW_STATUSES.findIndex((s) => s.value === trip.status?.toLowerCase())
  const stopsData = trip.stops_data

  const elapsedByStatus: Record<string, number> = {}
  const timestampByStatus: Record<string, string> = {}
  if (Array.isArray(stopsData)) {
    stopsData.forEach((entry: any) => {
      if (entry.status) {
        if (typeof entry.elapsed_seconds === "number") elapsedByStatus[entry.status] = entry.elapsed_seconds
        if (entry.timestamp) timestampByStatus[entry.status] = entry.timestamp
      }
    })
  }

  const baseWaypoints = WORKFLOW_STATUSES.map((status, index) => {
    const isCompleted = currentStatusIndex > index
    const isCurrent = currentStatusIndex === index
    const elapsed = elapsedByStatus[status.value]

    let currentTimestamp: string | null = null
    if (isCurrent) {
      if (status.value === "pending") {
        currentTimestamp = trip.created_at || null
      } else if (currentStatusIndex > 0) {
        const prevStatus = WORKFLOW_STATUSES[currentStatusIndex - 1]
        currentTimestamp = timestampByStatus[prevStatus.value] || trip.created_at || null
      }
    }

    let warningLevel: "normal" | "warning" | "danger" = "normal"
    if (isCompleted && elapsed != null) {
      const minutes = elapsed / 60
      if (minutes > 30) warningLevel = "danger"
      else if (minutes >= 15) warningLevel = "warning"
    } else if (isCurrent && currentTimestamp) {
      const liveMinutes = (Date.now() - new Date(currentTimestamp).getTime()) / 60000
      if (liveMinutes > 30) warningLevel = "danger"
      else if (liveMinutes >= 15) warningLevel = "warning"
    }

    return {
      position: (index / (WORKFLOW_STATUSES.length - 1)) * 100,
      label: status.label,
      completed: isCompleted,
      current: isCurrent,
      isStop: false,
      warningLevel,
      elapsedSeconds: isCurrent ? null : (elapsed ?? null),
      elapsedFormatted: isCurrent ? "" : formatElapsed(elapsed),
      currentTimestamp,
    }
  })

  const stops = trip.selected_stop_points || trip.selectedstoppoints || []
  if (stops.length > 0) {
    const loadingPos = baseWaypoints[4].position
    const onTripPos = baseWaypoints[5].position
    const stopSpacing = (onTripPos - loadingPos) / (stops.length + 1)

    const stopWaypoints = stops.map((stop: any, index: number) => ({
      position: loadingPos + stopSpacing * (index + 1),
      label: `Stop ${index + 1}`,
      completed: currentStatusIndex > 4,
      current: false,
      isStop: true,
      stopId: stop,
      warningLevel: "normal" as const,
      elapsedSeconds: null,
      elapsedFormatted: "",
      currentTimestamp: null,
    }))

    const adjustedWaypoints = [...baseWaypoints]
    for (let i = 5; i < adjustedWaypoints.length; i++) {
      adjustedWaypoints[i].position = onTripPos + ((i - 5) / (WORKFLOW_STATUSES.length - 6)) * (100 - onTripPos)
    }

    return [...adjustedWaypoints.slice(0, 5), ...stopWaypoints, ...adjustedWaypoints.slice(5)]
  }

  return baseWaypoints
}

function getProgress(status: string) {
  const statusIndex = WORKFLOW_STATUSES.findIndex((s) => s.value === status?.toLowerCase())
  if (statusIndex === -1) return 0
  return ((statusIndex + 1) / WORKFLOW_STATUSES.length) * 100
}

function getStatusColor(status: string) {
  const s = (status || "").toLowerCase()
  if (s === "breakdown") return "bg-red-500 text-white"
  if (s === "delivered") return "bg-emerald-100 text-emerald-800"
  if (s === "on-trip") return "bg-sky-100 text-sky-800"
  if (["pending", "accepted"].includes(s)) return "bg-amber-100 text-amber-800"
  if (["rejected", "cancelled", "stopped"].includes(s)) return "bg-rose-100 text-rose-800"
  if (["completed", "depo", "handover"].includes(s)) return "bg-lime-100 text-lime-800"
  return "bg-slate-100 text-slate-800"
}

function formatDateTime(ts: string | null) {
  if (!ts) return null
  try {
    return new Date(ts).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
  } catch {
    return ts
  }
}

export default function ClientTripRouting({ trips }: { trips: any[] }) {
  const sortedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      const aActive = !["delivered", "completed"].includes((a.status || "").toLowerCase())
      const bActive = !["delivered", "completed"].includes((b.status || "").toLowerCase())
      if (aActive !== bActive) return aActive ? -1 : 1
      return (b.id || 0) - (a.id || 0)
    })
  }, [trips])

  if (sortedTrips.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-600">
        <MapPin className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        No trips found for this client yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sortedTrips.map((trip) => {
        const waypoints = getWaypoints(trip)
        const progress = getProgress(trip.status)
        const clientDetails = (() => {
          try {
            const raw = trip.clientdetails || trip.client_details
            return typeof raw === "string" ? JSON.parse(raw) : raw
          } catch {
            return null
          }
        })()
        const clientName = clientDetails?.name || trip.selected_client || ""
        const pickupTime = trip.pickup_locations?.[0]?.scheduled_time || trip.pickuplocations?.[0]?.scheduled_time
        const dropoffTime = trip.dropoff_locations?.[0]?.scheduled_time || trip.dropofflocations?.[0]?.scheduled_time

        return (
          <div key={trip.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Top accent */}
            <div className={cn("h-1 w-full", trip.status?.toLowerCase() === "breakdown" ? "bg-gradient-to-r from-red-500 via-red-400 to-red-500" : "bg-gradient-to-r from-blue-500 via-blue-400 to-blue-400")} />

            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center border border-indigo-200">
                    <Truck className="w-4 h-4 text-indigo-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{clientName}</h3>
                    <p className="text-xs text-slate-500">Trip #{trip.ordernumber || trip.trip_id || trip.id}</p>
                  </div>
                </div>
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide", getStatusColor(trip.status))}>
                  {trip.status || "Unknown"}
                </span>
              </div>

              {/* Route */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] font-medium text-slate-600 uppercase">Loading</span>
                  </div>
                  <p className="text-xs font-medium text-slate-900 truncate">{trip.origin || "Not specified"}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <div className="flex items-center gap-1 mb-0.5">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <span className="text-[10px] font-medium text-slate-600 uppercase">Off-Loading</span>
                  </div>
                  <p className="text-xs font-medium text-slate-900 truncate">{trip.destination || "Not specified"}</p>
                </div>
              </div>

              {/* Progress Timeline */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-800">Trip Progress</h4>
                  <span className="text-xs text-slate-500">{Math.round(progress)}% Complete</span>
                </div>
                <div className="relative">
                  <div className="flex justify-between items-center">
                    {waypoints.map((waypoint, index) => (
                      <div key={index} className="flex flex-col items-center relative z-10">
                        {waypoint.completed && waypoint.elapsedFormatted ? (
                          <span className={cn("text-[9px] font-bold mb-0.5 leading-none", waypoint.warningLevel === "danger" ? "text-red-500" : waypoint.warningLevel === "warning" ? "text-orange-500" : "text-emerald-600")}>
                            {waypoint.elapsedFormatted}
                          </span>
                        ) : waypoint.current && waypoint.currentTimestamp ? (
                          <span className={cn("text-[9px] font-bold mb-0.5 leading-none", waypoint.warningLevel === "danger" ? "text-red-500" : waypoint.warningLevel === "warning" ? "text-orange-500" : "text-sky-600")}>
                            <LiveElapsed timestamp={waypoint.currentTimestamp} />
                          </span>
                        ) : (
                          <span className="text-[9px] mb-0.5 leading-none">&nbsp;</span>
                        )}
                        <div className={cn(
                          "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300",
                          waypoint.isStop ? "bg-orange-500 border-orange-600 text-white" :
                          waypoint.current && waypoint.warningLevel === "danger" ? "bg-red-500 border-red-600 text-white" :
                          waypoint.current && waypoint.warningLevel === "warning" ? "bg-orange-500 border-orange-600 text-white" :
                          waypoint.current ? "bg-blue-500 border-blue-700 text-white" :
                          waypoint.completed && waypoint.warningLevel === "danger" ? "bg-red-500 border-red-600 text-white" :
                          waypoint.completed && waypoint.warningLevel === "warning" ? "bg-orange-500 border-orange-600 text-white" :
                          waypoint.completed ? "bg-emerald-600 border-emerald-700 text-white" :
                          "bg-slate-100 border-slate-200 text-slate-500"
                        )}>
                          {waypoint.isStop ? (
                            <MapPin className="w-3 h-3" />
                          ) : waypoint.completed ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : waypoint.current ? (
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span className={cn(
                          "text-[10px] mt-1 text-center max-w-12 leading-tight",
                          waypoint.isStop ? "text-orange-600 font-medium" :
                          waypoint.current ? "text-sky-700 font-semibold" :
                          waypoint.completed ? "text-emerald-700 font-medium" :
                          "text-slate-500"
                        )}>
                          {waypoint.label.split(" ")[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-[25px] left-3 right-3 h-1 bg-slate-100 -z-0 rounded">
                    <div
                      className={cn(
                        "h-full rounded transition-all duration-500 ease-out",
                        trip.status?.toLowerCase() === "breakdown"
                          ? "bg-gradient-to-r from-red-500 via-red-400 to-red-500"
                          : waypoints.some((w) => w.completed && w.warningLevel === "danger")
                            ? "bg-gradient-to-r from-emerald-500 via-orange-400 to-red-500"
                            : waypoints.some((w) => w.completed && w.warningLevel === "warning")
                              ? "bg-gradient-to-r from-emerald-500 via-orange-400 to-orange-500"
                              : "bg-gradient-to-r from-blue-500 via-sky-500 to-blue-400"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Cargo */}
              {trip.cargo && (
                <div className="bg-slate-50 rounded-lg p-2 mb-3 border border-slate-100">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Package className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-medium text-slate-600 uppercase">Cargo</span>
                  </div>
                  <p className="text-xs font-medium text-slate-900">{trip.cargo}{trip.cargo_weight ? ` (${trip.cargo_weight})` : ""}</p>
                </div>
              )}

              {/* Schedule */}
              {(pickupTime || dropoffTime) && (
                <div className="flex gap-2">
                  {pickupTime && (
                    <div className="flex-1 bg-white rounded-lg p-2 border border-slate-100">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-medium text-slate-600">Loading</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900">{formatDateTime(pickupTime)}</p>
                    </div>
                  )}
                  {dropoffTime && (
                    <div className="flex-1 bg-white rounded-lg p-2 border border-slate-100">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Clock className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] font-medium text-slate-600">Off-Loading</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900">{formatDateTime(dropoffTime)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
