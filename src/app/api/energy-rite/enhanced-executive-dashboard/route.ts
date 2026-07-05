import { NextRequest, NextResponse } from 'next/server'
import { fuelSupabase } from '@/lib/supabase/fuel'

function combineFuelFills(fillSessions: any[], timeWindowHours = 1) {
  if (!fillSessions || fillSessions.length === 0) return []
  const sorted = [...fillSessions].sort((a: any, b: any) =>
    new Date(a.session_start_time).getTime() - new Date(b.session_start_time).getTime()
  )
  const combined: any[] = []
  let currentGroup = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const lastInGroup = currentGroup[currentGroup.length - 1]
    const timeDiff = (new Date(current.session_start_time).getTime() - new Date(lastInGroup.session_start_time).getTime()) / (1000 * 60 * 60)
    if (timeDiff <= timeWindowHours) {
      currentGroup.push(current)
    } else {
      combined.push(combineGroup(currentGroup))
      currentGroup = [current]
    }
  }
  if (currentGroup.length > 0) combined.push(combineGroup(currentGroup))
  return combined
}

function combineGroup(group: any[]) {
  if (group.length === 1) return { ...group[0], is_combined: false, fill_count: 1 }
  const earliest = group[0]
  const latest = group[group.length - 1]
  const startFuel = parseFloat(earliest.opening_fuel || 0)
  const endFuel = parseFloat(latest.closing_fuel || 0)
  const totalFilled = Math.max(0, endFuel - startFuel)
  const startTime = new Date(earliest.session_start_time)
  const endTime = new Date(latest.session_end_time || latest.session_start_time)
  const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
  return {
    branch: earliest.branch,
    cost_code: earliest.cost_code,
    company: earliest.company,
    session_start_time: earliest.session_start_time,
    session_end_time: latest.session_end_time || latest.session_start_time,
    opening_fuel: startFuel,
    closing_fuel: endFuel,
    total_fill: totalFilled,
    operating_hours: durationHours,
    is_combined: true,
    fill_count: group.length,
    session_status: 'FUEL_FILL_COMPLETED',
  }
}

async function getAccessibleCostCenters(userCostCode: string) {
  if (!userCostCode) return []
  const { data } = await fuelSupabase
    .from('energyrite_vehicle_lookup')
    .select('cost_code')
    .order('cost_code')
  if (!data) return [userCostCode]
  const uniqueCodes = [...new Set(data.map((cc: any) => cc.cost_code))]
  const accessible: string[] = []
  if (uniqueCodes.includes(userCostCode)) accessible.push(userCostCode)
  uniqueCodes.forEach(code => {
    if (code !== userCostCode && code.startsWith(userCostCode + '-')) accessible.push(code)
  })
  return accessible
}

async function detectContinuousOperations(startDateStr: string, endDate: string, costCode?: string, costCodes?: string) {
  let query = fuelSupabase
    .from('energy_rite_operating_sessions')
    .select('branch, cost_code, session_date, operating_hours, total_usage')
    .gte('session_date', startDateStr)
    .lte('session_date', endDate)
    .eq('session_status', 'COMPLETED')
    .gt('operating_hours', 12)

  if (costCode || costCodes) {
    let accessibleCostCodes: string[] = []
    if (costCodes) {
      const codeArray = costCodes.split(',').map((c: string) => c.trim())
      for (const code of codeArray) {
        const accessible = await getAccessibleCostCenters(code)
        accessibleCostCodes.push(...accessible)
      }
    } else if (costCode) {
      accessibleCostCodes = await getAccessibleCostCenters(costCode)
    }
    query = query.in('cost_code', accessibleCostCodes)
  }

  const { data: sessions } = await query
  return (sessions || []).map((s: any) => ({
    site: s.branch,
    cost_code: s.cost_code,
    session_date: s.session_date,
    total_hours: Math.round(parseFloat(s.operating_hours) * 100) / 100,
    fuel_usage: Math.round(parseFloat(s.total_usage || 0) * 100) / 100,
    max_continuous_streak: Math.round(parseFloat(s.operating_hours) * 100) / 100,
    sessions_today: 1,
    pattern: 'Long continuous run',
  })).sort((a: any, b: any) => b.total_hours - a.total_hours)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const costCode = searchParams.get('cost_code') || searchParams.get('costCode') || undefined
    const costCodes = searchParams.get('cost_codes') || searchParams.get('costCodes') || undefined

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const targetDate = yesterday.toISOString().split('T')[0]

    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    const startDateStr = startDate.toISOString().split('T')[0]

    const period = Math.ceil((yesterday.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))

    console.log(`🎯 Executive Dashboard: ${startDateStr} to ${targetDate} (${period} days)`)

    // Get vehicles
    const vehicleResponse = await fetch('https://209.38.217.58:8000/api/waterford-sites')
    const vehicleJson = await vehicleResponse.json()
    let vehicles = vehicleJson.data || vehicleJson.vehicles || []

    // Apply cost code filtering
    let accessibleCostCodes: string[] = []
    let vehiclePlatesForCostCode: string[] = []

    if (costCode || costCodes) {
      if (costCodes) {
        const codeArray = costCodes.split(',').map((c: string) => c.trim())
        for (const code of codeArray) {
          const accessible = await getAccessibleCostCenters(code)
          accessibleCostCodes.push(...accessible)
        }
      } else if (costCode) {
        accessibleCostCodes = await getAccessibleCostCenters(costCode)
      }

      const { data: vehicleLookup } = await fuelSupabase
        .from('energyrite_vehicle_lookup')
        .select('plate, cost_code')
        .in('cost_code', accessibleCostCodes)

      const costCodeMap: Record<string, string> = {}
      vehicleLookup?.forEach((v: any) => { costCodeMap[v.plate] = v.cost_code })
      vehiclePlatesForCostCode = vehicleLookup?.map((v: any) => v.plate) || []

      vehicles = vehicles.filter((v: any) => {
        const vCostCode = costCodeMap[v.branch] || v.cost_code
        return accessibleCostCodes.includes(vCostCode)
      })
    }

    // Get sessions
    const { data: allSessions } = await fuelSupabase
      .from('energy_rite_operating_sessions')
      .select('*')
      .gte('session_date', startDateStr)
      .lte('session_date', targetDate)
      .eq('session_status', 'COMPLETED')

    let sessions = allSessions || []
    if (costCode || costCodes) {
      sessions = sessions.filter((s: any) =>
        accessibleCostCodes.includes(s.cost_code) || vehiclePlatesForCostCode.includes(s.branch)
      )
    }

    // Get fuel fill sessions
    const { data: allFuelFillSessions } = await fuelSupabase
      .from('energy_rite_operating_sessions')
      .select('*')
      .gte('session_date', startDateStr)
      .lte('session_date', targetDate)
      .eq('session_status', 'FUEL_FILL_COMPLETED')
      .order('branch')
      .order('session_start_time')

    let fuelFillSessions = allFuelFillSessions || []
    if (costCode || costCodes) {
      fuelFillSessions = fuelFillSessions.filter((s: any) =>
        accessibleCostCodes.includes(s.cost_code) || vehiclePlatesForCostCode.includes(s.branch)
      )
    }

    // Combine fills by vehicle
    const sessionsByVehicle: Record<string, any[]> = {}
    fuelFillSessions.forEach((session: any) => {
      if (!sessionsByVehicle[session.branch]) sessionsByVehicle[session.branch] = []
      sessionsByVehicle[session.branch].push(session)
    })
    const combinedFills: any[] = []
    Object.keys(sessionsByVehicle).forEach(vehicle => {
      combinedFills.push(...combineFuelFills(sessionsByVehicle[vehicle], 2))
    })

    // Calculate metrics
    const totalLitresUsed = sessions.reduce((sum: number, s: any) => sum + (parseFloat(s.total_usage) || 0), 0)
    const totalLitresFilled = combinedFills.reduce((sum: number, f: any) => sum + (parseFloat(f.total_fill) || 0), 0)
    const totalOperationalHours = sessions.reduce((sum: number, s: any) => sum + (parseFloat(s.operating_hours) || 0), 0)
    const totalOperationalCost = sessions.reduce((sum: number, s: any) => sum + (parseFloat(s.cost_for_usage) || 0), 0)

    // Get all sites
    let allSitesForCostCode: string[]
    if (costCode || costCodes) {
      const { data: allVehiclesForCostCode } = await fuelSupabase
        .from('energyrite_vehicle_lookup')
        .select('plate')
        .in('cost_code', accessibleCostCodes)
      allSitesForCostCode = allVehiclesForCostCode?.map((v: any) => v.plate) || []
    } else {
      const { data: allVehicles } = await fuelSupabase
        .from('energyrite_vehicle_lookup')
        .select('plate')
      allSitesForCostCode = allVehicles?.map((v: any) => v.plate) || []
    }

    const totalSites = allSitesForCostCode.length
    const sitesOperatedTotal = [...new Set(sessions.map((s: any) => s.branch))]
    const sitesWithFills = [...new Set(combinedFills.map((f: any) => f.branch))]
    const continuousOperationsSites = await detectContinuousOperations(startDateStr, targetDate, costCode, costCodes)

    // Site breakdown
    const siteMetrics: Record<string, any> = {}
    sessions.forEach((session: any) => {
      const site = session.branch
      if (!siteMetrics[site]) {
        siteMetrics[site] = {
          site_name: site, cost_code: session.cost_code, total_sessions: 0,
          operating_hours: 0, fuel_usage_liters: 0, operational_cost: 0,
          fuel_fills_count: 0, fuel_filled_liters: 0,
          is_continuous: continuousOperationsSites.some((cs: any) => cs.site === site),
        }
      }
      siteMetrics[site].total_sessions++
      siteMetrics[site].operating_hours += parseFloat(session.operating_hours || 0)
      siteMetrics[site].fuel_usage_liters += parseFloat(session.total_usage || 0)
      siteMetrics[site].operational_cost += parseFloat(session.cost_for_usage || 0)
    })

    combinedFills.forEach((fill: any) => {
      const site = fill.branch
      const fillAmount = parseFloat(fill.total_fill || 0)
      if (siteMetrics[site]) {
        siteMetrics[site].fuel_fills_count++
        siteMetrics[site].fuel_filled_liters += fillAmount
      } else {
        siteMetrics[site] = {
          site_name: site, cost_code: fill.cost_code, total_sessions: 0,
          operating_hours: 0, fuel_usage_liters: 0, operational_cost: 0,
          fuel_fills_count: 1, fuel_filled_liters: fillAmount, is_continuous: false,
        }
      }
    })

    const siteBreakdown = Object.values(siteMetrics)
      .map((site: any) => ({
        ...site,
        efficiency_liters_per_hour: site.operating_hours > 0 ? Math.round((site.fuel_usage_liters / site.operating_hours) * 100) / 100 : 0,
        cost_per_hour: site.operating_hours > 0 ? Math.round((site.operational_cost / site.operating_hours) * 100) / 100 : 0,
        fuel_net_usage: site.fuel_usage_liters - site.fuel_filled_liters,
      }))
      .sort((a: any, b: any) => b.operating_hours - a.operating_hours)

    // Cost center summary
    const costCenterMetrics: Record<string, any> = {}
    sessions.forEach((session: any) => {
      const cc = session.cost_code || 'UNKNOWN'
      if (!costCenterMetrics[cc]) {
        costCenterMetrics[cc] = {
          cost_code: cc, sites: new Set<string>(), operating_hours: 0,
          fuel_usage_liters: 0, operational_cost: 0, sessions: 0,
          fuel_fills_count: 0, fuel_filled_liters: 0,
        }
      }
      costCenterMetrics[cc].sites.add(session.branch)
      costCenterMetrics[cc].operating_hours += parseFloat(session.operating_hours || 0)
      costCenterMetrics[cc].fuel_usage_liters += parseFloat(session.total_usage || 0)
      costCenterMetrics[cc].operational_cost += parseFloat(session.cost_for_usage || 0)
      costCenterMetrics[cc].sessions++
    })

    combinedFills.forEach((fill: any) => {
      const cc = fill.cost_code || 'UNKNOWN'
      if (!costCenterMetrics[cc]) {
        costCenterMetrics[cc] = {
          cost_code: cc, sites: new Set<string>(), operating_hours: 0,
          fuel_usage_liters: 0, operational_cost: 0, sessions: 0,
          fuel_fills_count: 0, fuel_filled_liters: 0,
        }
      }
      costCenterMetrics[cc].sites.add(fill.branch)
      costCenterMetrics[cc].fuel_fills_count++
      costCenterMetrics[cc].fuel_filled_liters += parseFloat(fill.total_fill || 0)
    })

    const costCenterSummary = Object.values(costCenterMetrics)
      .map((cc: any) => ({
        cost_code: cc.cost_code, sites_count: cc.sites.size, sites: Array.from(cc.sites),
        operating_hours: Math.round(cc.operating_hours * 100) / 100,
        fuel_usage_liters: Math.round(cc.fuel_usage_liters * 100) / 100,
        fuel_filled_liters: Math.round(cc.fuel_filled_liters * 100) / 100,
        operational_cost: Math.round(cc.operational_cost * 100) / 100,
        sessions: cc.sessions, fuel_fills_count: cc.fuel_fills_count,
        avg_fuel_per_hour: cc.operating_hours > 0 ? Math.round((cc.fuel_usage_liters / cc.operating_hours) * 100) / 100 : 0,
        fuel_net_usage: Math.round((cc.fuel_usage_liters - cc.fuel_filled_liters) * 100) / 100,
      }))
      .sort((a: any, b: any) => b.operating_hours - a.operating_hours)

    const currentlyActive = vehicles.filter((v: any) => v.drivername !== 'PTO OFF / ENGINE OFF').length
    const totalFleetSize = vehicles.length
    const fleetUtilization = totalFleetSize > 0 ? (currentlyActive / totalFleetSize) * 100 : 0

    const dashboard = {
      period: { start_date: startDateStr, end_date: targetDate, days: parseInt(String(period)), is_cumulative: true },
      filters: { cost_code: costCode || null, cost_codes: costCodes || null },
      key_metrics: {
        total_sites_operated: totalSites, sites_list: allSitesForCostCode,
        total_litres_used: Math.round(totalLitresUsed * 100) / 100,
        total_litres_filled: Math.round(totalLitresFilled * 100) / 100,
        net_fuel_consumption: Math.round((totalLitresUsed - totalLitresFilled) * 100) / 100,
        total_operational_hours: Math.round(totalOperationalHours * 100) / 100,
        continuous_operations_count: continuousOperationsSites.length,
        total_operational_cost: Math.round(totalOperationalCost * 100) / 100,
        sites_with_fuel_fills: sitesWithFills.length,
        total_fuel_fill_events: combinedFills.length,
      },
      fleet_status: {
        total_fleet_size: totalFleetSize, currently_active: currentlyActive,
        fleet_utilization_percentage: Math.round(fleetUtilization * 100) / 100,
        inactive_vehicles: totalFleetSize - currentlyActive,
      },
      continuous_operations: {
        sites_over_24_hours: continuousOperationsSites, count: continuousOperationsSites.length,
        total_hours: continuousOperationsSites.reduce((sum: number, co: any) => sum + co.total_hours, 0),
        total_fuel: continuousOperationsSites.reduce((sum: number, co: any) => sum + co.fuel_usage, 0),
      },
      fuel_tracking: {
        fuel_fills_summary: {
          total_fill_events: combinedFills.length,
          total_litres_filled: Math.round(totalLitresFilled * 100) / 100,
          sites_with_fills: sitesWithFills.length,
          average_fill_amount: combinedFills.length > 0 ? Math.round((totalLitresFilled / combinedFills.length) * 100) / 100 : 0,
        },
        fuel_efficiency: {
          total_used: Math.round(totalLitresUsed * 100) / 100,
          total_filled: Math.round(totalLitresFilled * 100) / 100,
          net_consumption: Math.round((totalLitresUsed - totalLitresFilled) * 100) / 100,
          usage_to_fill_ratio: totalLitresFilled > 0 ? Math.round((totalLitresUsed / totalLitresFilled) * 100) / 100 : 0,
          fill_frequency: totalSites > 0 ? Math.round((combinedFills.length / totalSites) * 100) / 100 : 0,
        },
      },
      site_performance: siteBreakdown,
      top_performing_sites: siteBreakdown
        .filter((site: any) => site.fuel_usage_liters > 0)
        .sort((a: any, b: any) => b.fuel_usage_liters - a.fuel_usage_liters)
        .slice(0, 10)
        .map((site: any) => ({
          site: site.site_name, cost_code: site.cost_code, sessions: site.total_sessions,
          operating_hours: site.operating_hours, fuel_usage: site.fuel_usage_liters,
          fuel_filled: site.fuel_filled_liters, net_fuel_usage: site.fuel_net_usage,
          total_cost: site.operational_cost, efficiency: site.efficiency_liters_per_hour,
          cost_per_hour: site.cost_per_hour,
        })),
      cost_center_analysis: costCenterSummary,
      efficiency_metrics: {
        average_fuel_per_hour: totalOperationalHours > 0 ? Math.round((totalLitresUsed / totalOperationalHours) * 100) / 100 : 0,
        average_cost_per_hour: totalOperationalHours > 0 ? Math.round((totalOperationalCost / totalOperationalHours) * 100) / 100 : 0,
        average_hours_per_site: totalSites > 0 ? Math.round((totalOperationalHours / totalSites) * 100) / 100 : 0,
        average_fuel_per_site: totalSites > 0 ? Math.round((totalLitresUsed / totalSites) * 100) / 100 : 0,
      },
      executive_insights: [
        `${totalSites} sites operated over ${period} days with ${Math.round(totalOperationalHours)} total hours`,
        `${Math.round(totalLitresUsed)}L fuel consumed (cumulative over ${period} days)`,
        `${Math.round(totalLitresFilled)}L fuel filled across ${combinedFills.length} fill events`,
        `Net consumption: ${Math.round(totalLitresUsed - totalLitresFilled)}L (used minus filled)`,
        `${continuousOperationsSites.length} sites running continuous operations (24+ hours)`,
        `Fleet utilization: ${Math.round(fleetUtilization)}% (${currentlyActive}/${totalFleetSize} active)`,
      ],
    }

    return NextResponse.json({ success: true, data: dashboard })
  } catch (error: any) {
    console.error('❌ Enhanced executive dashboard error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
