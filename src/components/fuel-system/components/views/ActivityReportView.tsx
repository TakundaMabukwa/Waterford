'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

import { RefreshCw, Calendar, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/components/fuel-system/contexts/AppContext';
import { useUser } from '@/components/fuel-system/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { getReportsApiUrl } from '@/lib/utils/api-url';

interface ActivityReportViewProps {
  onBack?: () => void;
  initialDate?: string;
}

interface SiteReport {
  generator: string;
  cost_code: string;
  company: string;
  branch: string;
  start_time?: string | null;
  end_time?: string | null;
  morning_to_afternoon_usage: number;
  afternoon_to_evening_usage: number;
  morning_to_evening_usage: number;
  peak_time_slot: string;
  peak_fuel_usage: number;
  total_fuel_usage: number;
  total_sessions: number;
  session_count: number;
  total_operating_hours: number;
  total_fuel_filled?: number;
  peak_usage_session?: string;
  fuel_cost_per_liter?: number;
  estimated_fuel_cost?: number;
  period_breakdown: {
    morning_to_afternoon: number;
    afternoon_to_evening: number;
    full_day_total: number;
  };
}

interface ActivityReportData {
  period: {
    start_date: string;
    end_date: string;
  };
  total_sites: number;
  overall_peak_time_slot: string;
  overall_peak_usage: number;
  time_slot_totals: {
    morning_to_afternoon: number;
    afternoon_to_evening: number;
    morning_to_evening: number;
  };
  site_reports: SiteReport[];
  summary: {
    total_morning_to_afternoon_usage: number;
    total_afternoon_to_evening_usage: number;
    total_full_day_usage: number;
    period_comparison: {
      morning_period: number;
      afternoon_period: number;
      peak_period: string;
      peak_usage: number;
    };
    total_sessions: number;
    total_operating_hours: number;
    total_fuel_usage?: number;
    total_fuel_filled?: number;
    total_sites?: number;
  };
}

const toDateInputValue = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getDefaultDateRange = (initialDate?: string) => {
  const now = new Date();
  const baseDate = initialDate
    ? new Date(`${initialDate}T00:00`)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);

  return {
    start: toDateInputValue(baseDate),
    end: toDateInputValue(baseDate),
  };
};

export function ActivityReportView({ onBack, initialDate }: ActivityReportViewProps) {
  const { selectedRoute } = useApp();
  const { userCostCode, userSiteId, isAdmin } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDateTime, setStartDateTime] = useState(() => getDefaultDateRange(initialDate).start);
  const [endDateTime, setEndDateTime] = useState(() => getDefaultDateRange(initialDate).end);
  const [appliedStartDateTime, setAppliedStartDateTime] = useState(() => getDefaultDateRange(initialDate).start);
  const [appliedEndDateTime, setAppliedEndDateTime] = useState(() => getDefaultDateRange(initialDate).end);
  const [reportData, setReportData] = useState<ActivityReportData | null>(null);
  const [selectedCostCode, setSelectedCostCode] = useState('');
  const [generatingExcel, setGeneratingExcel] = useState(false);

  const getCostCenterName = () => {
    return 'Activity Reports';
  };

  const getBreadcrumbPath = () => {
    const start = new Date(`${appliedStartDateTime}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const end = new Date(`${appliedEndDateTime}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `Energyrite => Activity Reports - ${start} to ${end}`;
  };

  // Convert decimal hours to readable format (e.g., 0.92 -> "55m", 2.22 -> "2h 13m")
  const formatHours = (decimalHours: number): string => {
    if (!decimalHours || decimalHours === 0) return "0m";
    
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  };

  // Format timestamp to readable period (e.g., "2025-11-07T12:30:42.621+00:00" -> "Afternoon")
  const formatPeakTime = (timestamp: string): string => {
    if (!timestamp) return "-";
    try {
      // Read hour directly from backend timestamp (no timezone conversion on frontend).
      const match = timestamp.match(/T(\d{2}):(\d{2})/);
      if (!match) return "-";
      const hour = parseInt(match[1], 10);
      
      if (hour >= 0 && hour < 8) {
        return "Morning";
      } else if (hour >= 8 && hour < 16) {
        return "Afternoon";
      } else {
        return "Evening";
      }
    } catch (error) {
      return "-";
    }
  };

  const formatSiteTime = (timestamp?: string | null): string => {
    if (!timestamp) return '-';
    const [datePart, timePart] = timestamp.split('T');
    if (!datePart || !timePart) return '-';

    const [year, month, day] = datePart.split('-');
    const timeMatch = timePart.match(/^(\d{2}):(\d{2})/);
    if (!year || !month || !day || !timeMatch) return '-';

    return `${year}/${month}/${day} ${timeMatch[1]}:${timeMatch[2]}`;
  };

  // Fetch activity reports data
  const fetchActivityData = useCallback(async () => {
    let loadSucceeded = false;
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Fetching activity reports data...');
      
      // Priority: site_id > selectedRoute.costCode > userCostCode
      const costCodeFilter = selectedRoute?.costCode || userCostCode || '';
      const siteIdFilter = userSiteId || null;
      const startDate = appliedStartDateTime;
      const endDate = appliedEndDateTime;
      
      // Fetch from activity reports endpoint
      const baseUrl = getReportsApiUrl('');
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);
      if (siteIdFilter) {
        params.append('site_id', siteIdFilter);
        if (costCodeFilter) {
          params.append('cost_code', costCodeFilter);
        }
      } else if (costCodeFilter) {
        params.append('cost_code', costCodeFilter);
      }
      
      console.log('🔍 API call params:', params.toString(), 'costCodeFilter:', costCodeFilter);
      
      const reportsRes = await fetch(`${baseUrl}/api/energy-rite/reports/activity?${params.toString()}`);
      
      if (!reportsRes.ok) {
        throw new Error('Failed to fetch activity reports data');
      }
      
      const reportsData = await reportsRes.json();
      
      console.log('✅ Activity reports data received:', reportsData);
      console.log('🔍 API Data structure:', reportsData.data);
      console.log('🔍 Fuel analysis:', reportsData.data?.fuel_analysis);
      console.log('🔍 Sites data:', reportsData.data?.sites);
      
      if (reportsData.success && reportsData.data) {
        // Transform the API response to match expected structure
        const apiData = reportsData.data;
        
        // Check if sessions data exists (new structure)
        if (apiData.sessions && Array.isArray(apiData.sessions)) {
          console.log('🆕 Using sessions-based API structure');
          
          const allSessions = apiData.sessions as any[];
          const operatingSessions = allSessions.filter((session: any) =>
            session?.status === 'COMPLETED' || session?.status === 'ONGOING'
          );

          // Group operating sessions by branch to create site reports
          const sessionsByBranch = operatingSessions.reduce((acc: Record<string, any[]>, session: any) => {
            const branch = session.branch || 'Unknown';
            if (!acc[branch]) {
              acc[branch] = [];
            }
            acc[branch].push(session);
            return acc;
          }, {});

          // Group all sessions for site fill totals
          const allSessionsByBranch = allSessions.reduce((acc: Record<string, any[]>, session: any) => {
            const branch = session.branch || 'Unknown';
            if (!acc[branch]) {
              acc[branch] = [];
            }
            acc[branch].push(session);
            return acc;
          }, {});
          
          // Transform sessions into site reports
          const siteReports = Object.entries(sessionsByBranch).map(([branch, sessions]: [string, any[]]) => {
            const totalOperatingHours = sessions.reduce((sum, s) => sum + (s.duration_hours || 0), 0);
            const totalFuelUsage = sessions.reduce((sum, s) => sum + (s.fuel_usage || 0), 0);
            const branchSessionsAll = allSessionsByBranch[branch] || [];
            const totalFuelFilled = branchSessionsAll.reduce((sum, s) => sum + (s.fuel_filled || 0), 0);
            const totalSessions = sessions.length;
            const validStartTimes = sessions
              .map(s => s.start_time)
              .filter(Boolean)
              .map((t: string) => new Date(t).getTime())
              .filter((t: number) => !Number.isNaN(t));
            const validEndTimes = sessions
              .map(s => s.end_time)
              .filter(Boolean)
              .map((t: string) => new Date(t).getTime())
              .filter((t: number) => !Number.isNaN(t));
            
            // Find peak usage session
            const peakSession = sessions.reduce((max, s) => 
              (s.fuel_usage || 0) > (max.fuel_usage || 0) ? s : max
            , sessions[0]);
            
            return {
              branch,
              generator: branch,
              company: sessions[0]?.company || 'Unknown',
              cost_code: sessions[0]?.cost_code || '',
              start_time: validStartTimes.length > 0 ? new Date(Math.min(...validStartTimes)).toISOString() : null,
              end_time: validEndTimes.length > 0 ? new Date(Math.max(...validEndTimes)).toISOString() : null,
              total_operating_hours: totalOperatingHours,
              total_fuel_usage: totalFuelUsage,
              total_fuel_filled: totalFuelFilled,
              total_sessions: totalSessions,
              peak_usage_session: peakSession?.start_time || '',
              peak_fuel_usage: peakSession?.fuel_usage || 0,
              peak_time_slot: 'morning_to_afternoon',
              morning_to_afternoon_usage: totalFuelUsage,
              afternoon_to_evening_usage: 0
            };
          });
          
          const transformedData = {
            summary: {
              total_sites: siteReports.length,
              total_sessions: apiData.summary?.total_sessions || operatingSessions.length,
              total_operating_hours: apiData.summary?.total_operating_hours || 0,
              total_fuel_usage: apiData.summary?.total_fuel_usage || 0,
              total_fuel_filled: parseFloat(
                apiData?.fuel_analysis?.fuel_fills?.total_fuel_filled ||
                apiData?.summary?.total_fuel_filled_amount ||
                apiData?.summary?.total_fuel_filled ||
                0
              )
            },
            site_reports: siteReports,
            time_slot_totals: {
              morning_to_afternoon: parseFloat(apiData.fuel_analysis?.period_breakdown?.morning?.fuel_usage || 0),
              afternoon_to_evening: parseFloat(apiData.fuel_analysis?.period_breakdown?.afternoon?.fuel_usage || 0),
              morning_to_evening: parseFloat(apiData.summary?.total_fuel_usage || 0)
            }
          };
          setReportData(transformedData);
                } else if (apiData.fuel_analysis && apiData.sites) {
          console.log('Using sites-based API structure');
          const morningUsage = parseFloat(
            apiData?.fuel_analysis?.period_breakdown?.morning?.fuel_usage ??
            apiData?.fuel_analysis?.period_breakdown?.morning ??
            0
          );
          const afternoonUsage = parseFloat(
            apiData?.fuel_analysis?.period_breakdown?.afternoon?.fuel_usage ??
            apiData?.fuel_analysis?.period_breakdown?.afternoon ??
            0
          );
          const fullDayUsage = parseFloat(
            apiData?.fuel_analysis?.daily_total_consumption ??
            apiData?.summary?.total_fuel_usage ??
            0
          );

          const transformedData = {
            summary: apiData.summary,
            fuel_analysis: apiData.fuel_analysis,
            site_reports: (apiData.sites || []).map(site => ({
              ...site,
              generator: site.branch,
              morning_to_afternoon_usage: morningUsage,
              afternoon_to_evening_usage: afternoonUsage,
              peak_time_slot: apiData.fuel_analysis?.peak_usage_period?.period === 'morning' ? 'morning_to_afternoon' : 'afternoon_to_evening',
              peak_fuel_usage: site.peak_usage_amount || 0,
              total_fuel_usage: site.total_fuel_usage || 0,
              total_operating_hours: site.total_operating_hours || 0
            })),
            time_slot_totals: {
              morning_to_afternoon: morningUsage,
              afternoon_to_evening: afternoonUsage,
              morning_to_evening: fullDayUsage
            }
          };
          setReportData(transformedData);
        } else if (apiData.site_reports && Array.isArray(apiData.site_reports)) {
          console.log('Using site_reports API structure');
          setReportData(apiData);
        } else {
          console.log('⚠️ Using fallback/old API structure');
          // Fallback to old structure
          const transformedData = {
            ...apiData,
            site_reports: apiData.sites || [],
            time_slot_totals: {
              morning_to_afternoon: 0,
              afternoon_to_evening: 0, 
              morning_to_evening: 0
            }
          };
          setReportData(transformedData);
        }
      } else {
        // If site_id was used and no data found, show specific error
        if (siteIdFilter) {
          throw new Error(`No data found for site: ${siteIdFilter}`);
        }
        setReportData(null);
      }
      loadSucceeded = true;
      
    } catch (err) {
      console.error('❌ Error fetching activity data:', err);
      
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      toast({
        title: 'Failed to load activity data',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      });
      
      setReportData(null);
    } finally {
      setLoading(false);
      if (loadSucceeded) {
        toast({
          title: 'Activity data loaded',
          description: 'Latest reports fetched successfully.'
        });
      }
    }
  }, [toast, isAdmin, selectedRoute, userCostCode, userSiteId, appliedStartDateTime, appliedEndDateTime]);

  useEffect(() => {
    fetchActivityData();
  }, [fetchActivityData]);

  const handleApplyDateRange = () => {
    setAppliedStartDateTime(startDateTime);
    setAppliedEndDateTime(endDateTime);
  };

  // Generate Activity Excel Report
  const generateActivityExcelReport = async () => {
    try {
      setGeneratingExcel(true);
      
      const costCode = selectedRoute?.costCode || userCostCode || null;
      const siteId = userSiteId || null;
      
      const requestBody = {
        report_type: 'daily',
        start_date: appliedStartDateTime,
        end_date: appliedEndDateTime,
        ...(siteId && { site_id: siteId }),
        ...(costCode && !siteId && { cost_code: costCode })
      };
      
      const apiUrl = getReportsApiUrl('/api/energy-rite/excel-reports/generate');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.data?.download_url) {
        throw new Error(data.message || 'Failed to generate Excel report');
      }
      
      window.open(data.data.download_url, '_blank');
      
      toast({
        title: 'Daily Excel Report Ready',
        description: `File: ${data.data.file_name} - Click to download`
      });
    } catch (error) {
      console.error('❌ Error generating Excel report:', error);
      toast({
        title: 'Failed to generate Excel report',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setGeneratingExcel(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-start items-start bg-white min-h-screen p-6">
        <div className="text-left">
          <div className="mb-4 border-b-2 border-blue-600 rounded-full w-12 h-12 animate-spin"></div>
          <p className="text-gray-600">Loading activity reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-start items-start bg-white min-h-screen p-6">
        <div className="text-left">
          <div className="mb-4 text-gray-400 text-6xl">📊</div>
          <p className="mb-4 font-medium text-gray-600 text-lg">No Data Available</p>
          <p className="mb-4 text-gray-500 text-sm">Unable to load activity data at this time</p>
          <Button onClick={fetchActivityData} variant="outline">
            <RefreshCw className="mr-2 w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Use API summary data when available, fallback to calculated totals
  const totalFuelUsage = reportData?.summary?.total_fuel_usage ?? 
    (reportData?.site_reports?.reduce((sum, s) => sum + (s.total_fuel_usage || 0), 0) ?? 0);
  const totalOperatingHours = reportData?.summary?.total_operating_hours ?? 
    (reportData?.site_reports?.reduce((sum, s) => sum + (s.total_operating_hours || 0), 0) ?? 0);
  const totalFuelFilled = reportData?.summary?.total_fuel_filled ?? 
    (reportData?.site_reports?.reduce((sum, s) => sum + (s.total_fuel_filled || 0), 0) ?? 0);
  const totalSites = reportData?.summary?.total_sites ?? 
    (reportData?.site_reports?.length ?? 0);
  const filteredSiteReports = (reportData?.site_reports || [])
    .filter(site => !selectedCostCode || site.cost_code === selectedCostCode)
    .filter(site => site.total_operating_hours > 0)
    .sort((a, b) => (a.branch || a.generator || '').localeCompare(b.branch || b.generator || ''));

  return (
    <div className="min-h-full bg-slate-50">

      {/* Main Content */}
      <div className="space-y-4 px-3 pb-6 pt-3 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
          <div className="max-w-7xl mx-auto">
            <div>
              <h1 className="mb-1 text-xl font-semibold text-gray-900 sm:text-2xl">{getCostCenterName()}</h1>
              <p className="break-words text-xs text-gray-500 sm:text-sm">{getBreadcrumbPath()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:px-4 sm:py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-end">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Start</label>
                <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <input
                    type="date"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-700 outline-none lg:w-[220px]"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500">End</label>
                <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <input
                    type="date"
                    value={endDateTime}
                    onChange={(e) => setEndDateTime(e.target.value)}
                    className="w-full bg-transparent text-sm text-gray-700 outline-none lg:w-[220px]"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-0.5 lg:pt-0">
                <Button onClick={handleApplyDateRange} size="sm" className="min-w-[100px]">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Update
                </Button>
                <Button
                  onClick={generateActivityExcelReport}
                  size="sm"
                  variant="outline"
                  disabled={generatingExcel}
                  className="min-w-[120px]"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {generatingExcel ? 'Generating...' : 'Excel Report'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards: Operating Hours, Fuel Usage, Fuel Fills */}
        {reportData && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
            {/* Total Operating Hours */}
            <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
              <div className="h-1 bg-sky-600" />
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col items-start">
                  <div className="text-xl sm:text-3xl font-extrabold text-sky-700">{formatHours(totalOperatingHours || 0)}</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Operating Hours</div>
                </div>
              </CardContent>
            </Card>

            {/* Total Fuel Usage */}
            <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
              <div className="h-1 bg-blue-500" />
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col items-start">
                  <div className="text-xl sm:text-3xl font-extrabold text-blue-700">{(totalFuelUsage || 0).toFixed(1)}L</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Fuel Usage</div>
                </div>
              </CardContent>
            </Card>

            {/* Total Fuel Fills */}
            <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
              <div className="h-1 bg-green-500" />
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col items-start">
                  <div className="text-xl sm:text-3xl font-extrabold text-green-700">{(totalFuelFilled || 0).toFixed(1)}L</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Fuel Fills</div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
              <div className="h-1 bg-indigo-500" />
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col items-start">
                  <div className="text-xl sm:text-3xl font-extrabold text-indigo-700">{totalSites}</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Active Vehicles</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        

        {/* Site Reports Table */}
        <div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">ALL SITES ({reportData?.site_reports?.length || 0})</h2>
            <p className="text-xs text-gray-500 sm:text-sm">
              Showing sites for {appliedStartDateTime} to {appliedEndDateTime}
            </p>
          </div>

          <div className="sm:hidden space-y-3">
            {filteredSiteReports.length > 0 ? (
              filteredSiteReports.map((site, index) => (
                <Card key={`${site.branch || site.generator}-${index}`} className="border border-gray-200 shadow-sm">
                  <CardContent className="p-3 space-y-2">
                    <div className="font-semibold text-gray-900">{site.branch || site.generator}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-gray-500">Start</div>
                      <div className="font-medium text-gray-800">{formatSiteTime(site.start_time)}</div>
                      <div className="text-gray-500">End</div>
                      <div className="font-medium text-gray-800">{site.end_time ? formatSiteTime(site.end_time) : 'Ongoing'}</div>
                      <div className="text-gray-500">Op Hours</div>
                      <div className="font-medium text-sky-700">{formatHours(site.total_operating_hours || 0)}</div>
                      <div className="text-gray-500">Fuel Usage</div>
                      <div className="font-medium text-blue-600">{(site.total_fuel_usage || 0).toFixed(1)}L</div>
                      <div className="text-gray-500">Fuel Fills</div>
                      <div className="font-medium text-green-600">{(site.total_fuel_filled || 0).toFixed(1)}L</div>
                      <div className="text-gray-500">Peak Time</div>
                      <div className="font-medium text-orange-600">{formatPeakTime(site.peak_usage_session || '')}</div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border border-gray-200">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No activity data available for the selected date range
                </CardContent>
              </Card>
            )}
          </div>

          <div className="hidden sm:block rounded-md border overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
            <TableHead className="font-medium">Site</TableHead>
            <TableHead className="font-medium">Start Date/Time</TableHead>
            <TableHead className="font-medium">End Date/Time</TableHead>
            <TableHead className="font-medium">Operating Hours</TableHead>
            <TableHead className="font-medium">Fuel Usage</TableHead>
            <TableHead className="font-medium">Fuel Fills</TableHead>
            <TableHead className="font-medium">Peak Usage Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSiteReports.length > 0 ? (
                  filteredSiteReports.map((site, index) => (
                        <TableRow key={index} className="h-12">
                          <TableCell className="font-medium py-2">
                            <div>
                              <div className="font-medium">{site.branch || site.generator}</div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className="font-medium text-gray-700">{formatSiteTime(site.start_time)}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className="font-medium text-gray-700">{site.end_time ? formatSiteTime(site.end_time) : 'Ongoing'}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className="font-medium text-sky-700">{formatHours(site.total_operating_hours || 0)}</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className="font-medium text-blue-600">{(site.total_fuel_usage || 0).toFixed(1)}L</span>
                          </TableCell>
                          <TableCell className="font-medium py-2">
                            <span className="text-green-600">{(site.total_fuel_filled || 0).toFixed(1)}L</span>
                          </TableCell>
                          <TableCell className="py-2">
                            <span className="font-medium text-orange-600">{formatPeakTime(site.peak_usage_session)}</span>
                          </TableCell>
                        </TableRow>
                    ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No activity data available for the selected date range
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
