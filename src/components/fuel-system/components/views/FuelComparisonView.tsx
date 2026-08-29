'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Calendar, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/components/fuel-system/contexts/AppContext';
import { useUser } from '@/components/fuel-system/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { getReportsApiUrl } from '@/lib/utils/api-url';

interface FuelComparisonViewProps {
  onBack?: () => void;
  initialDate?: string;
}

interface FuelFillRecord {
  id: string;
  vehicleReg: string;
  date: string;
  totalFuelFilled: number;
  probeValueMorning: number;
  probeValueEvening: number;
  prescribedValue: number;
  tripId: string;
  imageLinks: string[];
  fills: FuelFillEntry[];
}

interface FuelFillEntry {
  time: string;
  amount: number;
  previousLevel: number;
  newLevel: number;
  engineStatus: string;
}

interface FuelTheftRecord {
  id: string;
  vehicleReg: string;
  date: string;
  fuelDropAmount: number;
  probeValueBefore: number;
  probeValueAfter: number;
  prescribedValue: number;
  tripId: string;
  imageLinks: string[];
  dropTime: string;
  engineStatus: string;
}

interface ReviewAction {
  id?: string;
  vehicle_reg: string;
  review_date: string;
  action_type: 'fill' | 'theft';
  confirmed: boolean;
  investigated: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
}

const toDateInputValue = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatTime = (timestamp: string): string => {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return timestamp;
  }
};

const formatLiters = (value: number): string => {
  return `${value.toFixed(1)}L`;
};

export function FuelComparisonView({ onBack, initialDate }: FuelComparisonViewProps) {
  const { selectedRoute } = useApp();
  const { userCostCode, userSiteId } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => initialDate || toDateInputValue(new Date()));
  const [appliedDate, setAppliedDate] = useState(selectedDate);

  const [activeTab, setActiveTab] = useState<'fills' | 'thefts'>('fills');
  const [fuelFills, setFuelFills] = useState<FuelFillRecord[]>([]);
  const [fuelThefts, setFuelThefts] = useState<FuelTheftRecord[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [reviewActions, setReviewActions] = useState<Map<string, ReviewAction>>(new Map());

  const fetchActivityData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const costCode = selectedRoute?.costCode || userCostCode || '';
      const params = new URLSearchParams();
      params.append('start_date', appliedDate);
      params.append('end_date', appliedDate);
      if (userSiteId) {
        params.append('site_id', userSiteId);
      } else if (costCode) {
        params.append('cost_code', costCode);
      }

      const baseUrl = getReportsApiUrl('');
      const response = await fetch(`${baseUrl}/api/energy-rite/reports/activity?${params.toString()}`);

      if (!response.ok) throw new Error('Failed to fetch activity data');

      const result = await response.json();
      if (!result.success || !result.data) throw new Error('Invalid response');

      const data = result.data;
      const sessions = data.sessions || [];
      const sites = data.sites || [];

      // Process fuel fills from sessions
      const fillsByVehicle = new Map<string, FuelFillRecord>();

      if (sessions.length > 0) {
        sessions.forEach((session: any) => {
          const branch = session.branch || 'Unknown';
          const fuelFilled = parseFloat(session.fuel_filled) || 0;

          if (fuelFilled > 0) {
            if (!fillsByVehicle.has(branch)) {
              fillsByVehicle.set(branch, {
                id: `fill-${branch}-${appliedDate}`,
                vehicleReg: branch,
                date: appliedDate,
                totalFuelFilled: 0,
                probeValueMorning: 0,
                probeValueEvening: 0,
                prescribedValue: 0,
                tripId: session.trip_id || '',
                imageLinks: [],
                fills: [],
              });
            }

            const record = fillsByVehicle.get(branch)!;
            record.totalFuelFilled += fuelFilled;
            record.fills.push({
              time: session.start_time || '',
              amount: fuelFilled,
              previousLevel: parseFloat(session.opening_percentage) || 0,
              newLevel: parseFloat(session.closing_percentage) || 0,
              engineStatus: session.status || 'COMPLETED',
            });
          }
        });
      }

      // Process fuel fills from sites snapshots
      if (sites.length > 0) {
        sites.forEach((site: any) => {
          const branch = site.branch || site.name || 'Unknown';
          const snapshots = site.snapshots || [];

          if (snapshots.length >= 2) {
            const sortedSnapshots = [...snapshots].sort(
              (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()
            );

            let morningLevel = 0;
            let eveningLevel = 0;

            sortedSnapshots.forEach((snap: any) => {
              const level = parseFloat(snap.fuel_level) || 0;
              if (snap.snapshot_type === 'MORNING' || snap.snapshot_type === 'morning') {
                morningLevel = level;
              } else if (snap.snapshot_type === 'EVENING' || snap.snapshot_type === 'evening') {
                eveningLevel = level;
              }
            });

            // Detect fills from snapshot increases
            for (let i = 1; i < sortedSnapshots.length; i++) {
              const current = sortedSnapshots[i];
              const previous = sortedSnapshots[i - 1];
              const fuelIncrease = (parseFloat(current.fuel_level) || 0) - (parseFloat(previous.fuel_level) || 0);
              const timeDiff = new Date(current.time).getTime() - new Date(previous.time).getTime();
              const hoursDiff = timeDiff / (1000 * 60 * 60);

              if (fuelIncrease > 10 && hoursDiff < 6) {
                const estimatedFill = fuelIncrease * 2.6;

                if (!fillsByVehicle.has(branch)) {
                  fillsByVehicle.set(branch, {
                    id: `fill-${branch}-${appliedDate}`,
                    vehicleReg: branch,
                    date: appliedDate,
                    totalFuelFilled: 0,
                    probeValueMorning: morningLevel,
                    probeValueEvening: eveningLevel,
                    prescribedValue: 0,
                    tripId: '',
                    imageLinks: [],
                    fills: [],
                  });
                }

                const record = fillsByVehicle.get(branch)!;
                record.totalFuelFilled += estimatedFill;
                record.probeValueMorning = morningLevel || record.probeValueMorning;
                record.probeValueEvening = eveningLevel || record.probeValueEvening;
                record.fills.push({
                  time: current.time,
                  amount: estimatedFill,
                  previousLevel: parseFloat(previous.fuel_level) || 0,
                  newLevel: parseFloat(current.fuel_level) || 0,
                  engineStatus: current.engine_status || '',
                });
              }
            }
          }
        });
      }

      setFuelFills(Array.from(fillsByVehicle.values()));

      // Process fuel thefts - detect significant drops
      const thefts: FuelTheftRecord[] = [];

      sites.forEach((site: any) => {
        const branch = site.branch || site.name || 'Unknown';
        const snapshots = site.snapshots || [];

        if (snapshots.length >= 2) {
          const sortedSnapshots = [...snapshots].sort(
            (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()
          );

          for (let i = 1; i < sortedSnapshots.length; i++) {
            const current = sortedSnapshots[i];
            const previous = sortedSnapshots[i - 1];
            const fuelDrop = (parseFloat(previous.fuel_level) || 0) - (parseFloat(current.fuel_level) || 0);
            const timeDiff = new Date(current.time).getTime() - new Date(previous.time).getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);

            // Detect theft: significant drop (>10%) in short time window
            if (fuelDrop > 10 && hoursDiff < 6) {
              const estimatedDrop = fuelDrop * 2.6;
              thefts.push({
                id: `theft-${branch}-${i}-${appliedDate}`,
                vehicleReg: branch,
                date: appliedDate,
                fuelDropAmount: estimatedDrop,
                probeValueBefore: parseFloat(previous.fuel_level) || 0,
                probeValueAfter: parseFloat(current.fuel_level) || 0,
                prescribedValue: 0,
                tripId: '',
                imageLinks: [],
                dropTime: current.time,
                engineStatus: current.engine_status || '',
              });
            }
          }
        }
      });

      setFuelThefts(thefts);

      // Fetch existing review actions
      const reviewRes = await fetch(`/api/fuel-review-actions?date=${appliedDate}`);
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        const actionsMap = new Map<string, ReviewAction>();
        (reviewData.data || []).forEach((action: ReviewAction) => {
          const key = `${action.vehicle_reg}-${action.action_type}`;
          actionsMap.set(key, action);
        });
        setReviewActions(actionsMap);
      }

      toast({
        title: 'Data loaded',
        description: `Found ${fillsByVehicle.size} vehicles with fills, ${thefts.length} potential thefts`,
      });
    } catch (err) {
      console.error('Error fetching activity data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      toast({
        title: 'Failed to load data',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [appliedDate, selectedRoute, userCostCode, userSiteId, toast]);

  useEffect(() => {
    fetchActivityData();
  }, [fetchActivityData]);

  const handleApplyDate = () => {
    setAppliedDate(selectedDate);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleReviewAction = async (
    vehicleReg: string,
    actionType: 'fill' | 'theft',
    action: 'confirm' | 'investigate'
  ) => {
    const key = `${vehicleReg}-${actionType}`;
    const existing = reviewActions.get(key);

    const newConfirmed = action === 'confirm';
    const newInvestigated = action === 'investigate';

    // If clicking the same action that's already active, toggle it off
    const isSameAction =
      (action === 'confirm' && existing?.confirmed) ||
      (action === 'investigate' && existing?.investigated);

    const updateData = {
      id: existing?.id,
      vehicle_reg: vehicleReg,
      review_date: appliedDate,
      action_type: actionType,
      confirmed: isSameAction ? false : newConfirmed,
      investigated: isSameAction ? false : newInvestigated,
    };

    try {
      const res = await fetch('/api/fuel-review-actions', {
        method: existing?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) throw new Error('Failed to save');

      const result = await res.json();
      const newAction = result.data;

      setReviewActions((prev) => {
        const next = new Map(prev);
        if (newAction.confirmed || newAction.investigated) {
          next.set(key, newAction);
        } else {
          next.delete(key);
        }
        return next;
      });

      toast({
        title: isSameAction ? `${action} removed` : `${action} applied`,
        description: `${vehicleReg} ${isSameAction ? 'unset' : `marked as ${action}`}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save action',
        variant: 'destructive',
      });
    }
  };

  const getReviewStatus = (vehicleReg: string, actionType: 'fill' | 'theft'): ReviewAction | undefined => {
    return reviewActions.get(`${vehicleReg}-${actionType}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="text-sm text-gray-500">Loading fuel data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-amber-500 mx-auto" />
          <p className="mb-4 font-medium text-gray-700">{error}</p>
          <Button onClick={fetchActivityData} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Selector */}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Date</label>
          <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm text-gray-700 outline-none"
            />
          </div>
        </div>
        <Button onClick={handleApplyDate} size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Update
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('fills')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'fills'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Fuel Fills ({fuelFills.length})
        </button>
        <button
          onClick={() => setActiveTab('thefts')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'thefts'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Fuel Thefts ({fuelThefts.length})
        </button>
      </div>

      {/* Fuel Fills Tab */}
      {activeTab === 'fills' && (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="font-medium">Reg</TableHead>
                <TableHead className="font-medium">Date</TableHead>
                <TableHead className="font-medium">Probe AM</TableHead>
                <TableHead className="font-medium">Probe PM</TableHead>
                <TableHead className="font-medium">Prescribed</TableHead>
                <TableHead className="font-medium">Total Filled</TableHead>
                <TableHead className="font-medium">Trip ID</TableHead>
                <TableHead className="font-medium text-center">Images</TableHead>
                <TableHead className="font-medium text-center">Confirm</TableHead>
                <TableHead className="font-medium text-center">Investigate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fuelFills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    No fuel fills detected for {appliedDate}
                  </TableCell>
                </TableRow>
              ) : (
                fuelFills.map((record) => {
                  const isExpanded = expandedRows.has(record.id);
                  const review = getReviewStatus(record.vehicleReg, 'fill');
                  const hasAction = review?.confirmed || review?.investigated;

                  return (
                    <React.Fragment key={record.id}>
                      <TableRow className="h-12">
                        <TableCell>
                          <button
                            onClick={() => toggleRow(record.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{record.vehicleReg}</TableCell>
                        <TableCell>{record.date}</TableCell>
                        <TableCell>{formatLiters(record.probeValueMorning)}</TableCell>
                        <TableCell>{formatLiters(record.probeValueEvening)}</TableCell>
                        <TableCell>{formatLiters(record.prescribedValue)}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatLiters(record.totalFuelFilled)}
                        </TableCell>
                        <TableCell>{record.tripId || '-'}</TableCell>
                        <TableCell className="text-center">
                          {record.imageLinks.length > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(record.imageLinks[0], '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {!hasAction ? (
                            <Button
                              variant={review?.confirmed ? 'default' : 'outline'}
                              size="sm"
                              className={review?.confirmed ? 'bg-green-600 hover:bg-green-700' : ''}
                              onClick={() => handleReviewAction(record.vehicleReg, 'fill', 'confirm')}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" /> Confirm
                            </Button>
                          ) : review?.confirmed ? (
                            <span className="inline-flex items-center text-green-600 text-sm font-medium">
                              <CheckCircle className="mr-1 h-4 w-4" /> Confirmed
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-center">
                          {!hasAction ? (
                            <Button
                              variant={review?.investigated ? 'default' : 'outline'}
                              size="sm"
                              className={review?.investigated ? 'bg-amber-600 hover:bg-amber-700' : ''}
                              onClick={() => handleReviewAction(record.vehicleReg, 'fill', 'investigate')}
                            >
                              <AlertTriangle className="mr-1 h-3 w-3" /> Investigate
                            </Button>
                          ) : review?.investigated ? (
                            <span className="inline-flex items-center text-amber-600 text-sm font-medium">
                              <AlertTriangle className="mr-1 h-4 w-4" /> Investigated
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                      {isExpanded && record.fills.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="bg-gray-50 p-0">
                            <div className="px-8 py-3">
                              <p className="mb-2 text-xs font-medium text-gray-500 uppercase">Fill Breakdown ({record.fills.length} fills)</p>
                              <div className="space-y-1">
                                {record.fills.map((fill, idx) => (
                                  <div key={idx} className="flex items-center gap-4 text-sm">
                                    <span className="text-gray-500">{formatTime(fill.time)}</span>
                                    <span className="font-medium text-green-600">{formatLiters(fill.amount)}</span>
                                    <span className="text-gray-400">
                                      {fill.previousLevel.toFixed(1)}% → {fill.newLevel.toFixed(1)}%
                                    </span>
                                    <span className="text-gray-400">{fill.engineStatus}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Fuel Thefts Tab */}
      {activeTab === 'thefts' && (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="font-medium">Reg</TableHead>
                <TableHead className="font-medium">Date</TableHead>
                <TableHead className="font-medium">Drop Time</TableHead>
                <TableHead className="font-medium">Probe Before</TableHead>
                <TableHead className="font-medium">Probe After</TableHead>
                <TableHead className="font-medium">Prescribed</TableHead>
                <TableHead className="font-medium">Drop Amount</TableHead>
                <TableHead className="font-medium">Trip ID</TableHead>
                <TableHead className="font-medium text-center">Images</TableHead>
                <TableHead className="font-medium text-center">Confirm</TableHead>
                <TableHead className="font-medium text-center">Investigate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fuelThefts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    No fuel thefts detected for {appliedDate}
                  </TableCell>
                </TableRow>
              ) : (
                fuelThefts.map((record) => {
                  const review = getReviewStatus(record.vehicleReg, 'theft');
                  const hasAction = review?.confirmed || review?.investigated;

                  return (
                    <TableRow key={record.id} className="h-12">
                      <TableCell />
                      <TableCell className="font-medium">{record.vehicleReg}</TableCell>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>{formatTime(record.dropTime)}</TableCell>
                      <TableCell>{formatLiters(record.probeValueBefore)}</TableCell>
                      <TableCell>{formatLiters(record.probeValueAfter)}</TableCell>
                      <TableCell>{formatLiters(record.prescribedValue)}</TableCell>
                      <TableCell className="font-semibold text-red-600">
                        {formatLiters(record.fuelDropAmount)}
                      </TableCell>
                      <TableCell>{record.tripId || '-'}</TableCell>
                      <TableCell className="text-center">
                        {record.imageLinks.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(record.imageLinks[0], '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {!hasAction ? (
                          <Button
                            variant={review?.confirmed ? 'default' : 'outline'}
                            size="sm"
                            className={review?.confirmed ? 'bg-green-600 hover:bg-green-700' : ''}
                            onClick={() => handleReviewAction(record.vehicleReg, 'theft', 'confirm')}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" /> Confirm
                          </Button>
                        ) : review?.confirmed ? (
                          <span className="inline-flex items-center text-green-600 text-sm font-medium">
                            <CheckCircle className="mr-1 h-4 w-4" /> Confirmed
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-center">
                        {!hasAction ? (
                          <Button
                            variant={review?.investigated ? 'default' : 'outline'}
                            size="sm"
                            className={review?.investigated ? 'bg-amber-600 hover:bg-amber-700' : ''}
                            onClick={() => handleReviewAction(record.vehicleReg, 'theft', 'investigate')}
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" /> Investigate
                          </Button>
                        ) : review?.investigated ? (
                          <span className="inline-flex items-center text-amber-600 text-sm font-medium">
                            <AlertTriangle className="mr-1 h-4 w-4" /> Investigated
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
          <div className="h-1 bg-green-500" />
          <CardContent className="p-3">
            <div className="text-xl font-extrabold text-green-700">{fuelFills.length}</div>
            <div className="text-xs text-gray-500">Vehicles with Fills</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
          <div className="h-1 bg-green-600" />
          <CardContent className="p-3">
            <div className="text-xl font-extrabold text-green-700">
              {formatLiters(fuelFills.reduce((sum, r) => sum + r.totalFuelFilled, 0))}
            </div>
            <div className="text-xs text-gray-500">Total Fuel Filled</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
          <div className="h-1 bg-red-500" />
          <CardContent className="p-3">
            <div className="text-xl font-extrabold text-red-700">{fuelThefts.length}</div>
            <div className="text-xs text-gray-500">Potential Thefts</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
          <div className="h-1 bg-amber-500" />
          <CardContent className="p-3">
            <div className="text-xl font-extrabold text-amber-700">
              {Array.from(reviewActions.values()).filter((a) => a.investigated).length}
            </div>
            <div className="text-xs text-gray-500">Under Investigation</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
