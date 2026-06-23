'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#d946ef']

async function fetchDashboard(path: string) {
  try {
    const res = await fetch(`/api/dashboard/${path}`, { cache: 'no-store' })
    if (!res.ok) return { ok: false, data: [] }
    return await res.json()
  } catch {
    return { ok: false, data: [] }
  }
}

function RiskGauge({ score }: { score: number }) {
  const angle = (score / 100) * 180
  const radius = 90
  const cx = 100
  const cy = 100

  const polarToCartesian = (a: number) => {
    const rad = ((180 - a) * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) }
  }

  const arcPath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(startAngle)
    const end = polarToCartesian(endAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
  }

  const needleEnd = polarToCartesian(angle)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" width="240" height="140">
        <path d={arcPath(0, 60)} stroke="#22c55e" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d={arcPath(60, 120)} stroke="#eab308" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d={arcPath(120, 180)} stroke="#ef4444" strokeWidth="16" fill="none" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill="#1e293b" />
      </svg>
      <div className="text-center -mt-4">
        <div className="text-4xl font-bold text-slate-900">{score}</div>
        <div className="text-sm text-slate-500">Overall Risk Score</div>
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      No data available for {label}
    </div>
  )
}

export default function ExecutiveDashboardTab() {
  const [monthlyKm, setMonthlyKm] = useState<any[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [riskDistribution, setRiskDistribution] = useState<any[]>([])
  const [speedingDrivers, setSpeedingDrivers] = useState<any[]>([])
  const [tripStatuses, setTripStatuses] = useState<any[]>([])
  const [unitsNotUpdating, setUnitsNotUpdating] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [kmRes, riskDistRes, speedingRes, tripRes, unitsRes, riskScoresRes] = await Promise.all([
      fetchDashboard('km/monthly'),
      fetchDashboard('risk/distribution'),
      fetchDashboard('speeding/top'),
      fetchDashboard('trips/status'),
      fetchDashboard('units/not-updating'),
      fetchDashboard('risk/scores'),
    ])

    if (kmRes.ok && kmRes.data?.length) {
      const monthOrder = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
      const mapped = monthOrder.map(m => {
        const found = kmRes.data.find((d: any) => (d.month || '').toUpperCase().startsWith(m))
        return { month: m, km: found ? Number(found.kilometres || found.km || found.value || 0) : 0 }
      })
      setMonthlyKm(mapped)
    }

    if (riskDistRes.ok && riskDistRes.data?.length) {
      setRiskDistribution(riskDistRes.data)
      const avg = riskScoresRes.ok && riskScoresRes.data?.length
        ? Math.round(riskScoresRes.data.reduce((s: number, d: any) => s + (d.score || d.risk_score || 0), 0) / riskScoresRes.data.length)
        : riskDistRes.data[0]?.score || riskDistRes.data[0]?.risk_score || 0
      setRiskScore(avg)
    } else if (riskScoresRes.ok && riskScoresRes.data?.length) {
      const scores = riskScoresRes.data
      const avg = Math.round(scores.reduce((s: number, d: any) => s + (d.score || d.risk_score || 0), 0) / scores.length)
      setRiskScore(avg)
    }

    if (speedingRes.ok && speedingRes.data?.length) {
      const total = speedingRes.data.reduce((s: number, d: any) => s + Number(d.violations || d.count || 1), 0)
      const mapped = speedingRes.data.slice(0, 10).map((d: any, i: number) => ({
        name: d.driver_name || d.plate || d.name || `Driver ${i + 1}`,
        value: total > 0 ? ((Number(d.violations || d.count || 1) / total) * 100).toFixed(1) : 0,
        color: COLORS[i % COLORS.length],
      }))
      setSpeedingDrivers(mapped)
    }

    if (tripRes.ok && tripRes.data?.length) {
      const totalTrips = tripRes.data.reduce((s: number, d: any) => s + Number(d.count || 0), 0)
      const monthOrder = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
      const currentMonth = new Date().getMonth()
      const mapped = monthOrder.map((m, i) => ({
        month: m,
        trips: i === currentMonth ? totalTrips : 0,
      }))
      setTripStatuses(mapped)
    }

    if (unitsRes.ok) {
      setUnitsNotUpdating(unitsRes.data)
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const totalKm = monthlyKm.reduce((s, d) => s + d.km, 0)

  return (
    <div className="space-y-4">
      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Monthly Kilometres */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-purple-700">Monthly Kilometres</CardTitle>
            <p className="text-lg font-bold text-slate-900">{totalKm > 0 ? totalKm.toLocaleString() : '-'}</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" /></div>
            ) : monthlyKm.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyKm}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="km" fill="#d4a017" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState label="Monthly Kilometres" />}
          </CardContent>
        </Card>

        {/* Risk Score Gauge */}
        <Card className="border-border/60 flex items-center justify-center">
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" /></div>
            ) : (
              <RiskGauge score={riskScore} />
            )}
          </CardContent>
        </Card>

        {/* Top 10 Worst Speeding Drivers */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-purple-700">Top 10 Worst Speeding Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" /></div>
            ) : speedingDrivers.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={speedingDrivers} cx="50%" cy="50%" innerRadius={25} outerRadius={50} dataKey="value" strokeWidth={0}>
                      {speedingDrivers.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {speedingDrivers.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-700 truncate">{d.name}</span>
                      <span className="text-slate-500 ml-auto">{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyState label="Speeding Drivers" />}
          </CardContent>
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Number of Trips */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-purple-700">Number Of Trips</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" /></div>
            ) : tripStatuses.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tripStatuses}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => v.toLocaleString()} />
                  <Bar dataKey="trips" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState label="Trip Status" />}
          </CardContent>
        </Card>

        {/* Units Not Updating */}
        <Card className="border-border/60 flex items-center justify-center">
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" /></div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="12" />
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#7c3aed" strokeWidth="12"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - (unitsNotUpdating?.count || unitsNotUpdating?.length || 0) / 100)}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-slate-700">
                      {unitsNotUpdating?.count ?? unitsNotUpdating?.length ?? '-'}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold text-purple-700">Units Not Updating</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overall Risk Score Monthly */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-purple-700">Overall Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" /></div>
            ) : riskDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#5eead4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState label="Risk Distribution" />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
