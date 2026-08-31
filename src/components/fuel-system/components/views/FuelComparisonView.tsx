'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

interface FuelComparisonViewProps {
  onBack?: () => void;
  initialMonth?: string;
}

interface FuelRecord {
  id: string;
  vehicle_reg: string;
  review_date: string;
  action_type: 'fill' | 'theft';
  confirmed: boolean;
  investigated: boolean;
  reviewed_by: string | null;
  probe_value: string | null;
  driver_value: string | null;
}

const toMonthInputValue = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

const getMonthRange = (monthStr: string) => {
  const [year, month] = monthStr.split('-').map(Number);
  const startDate = `${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
};

export function FuelComparisonView({ onBack, initialMonth }: FuelComparisonViewProps) {
  const { toast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => initialMonth || toMonthInputValue(new Date()));
  const [appliedMonth, setAppliedMonth] = useState(selectedMonth);

  const [activeTab, setActiveTab] = useState<'fills' | 'thefts'>('fills');
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [editingDriverValue, setEditingDriverValue] = useState<string | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    getUser();
  }, [supabase]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getMonthRange(appliedMonth);
      const res = await fetch(`/api/fuel-review-actions?start_date=${startDate}&end_date=${endDate}`);

      if (!res.ok) throw new Error('Failed to fetch fuel review actions');

      const result = await res.json();
      setRecords(result.data || []);

      toast({
        title: 'Data loaded',
        description: `Found ${(result.data || []).length} records for ${appliedMonth}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      toast({
        title: 'Failed to load data',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [appliedMonth, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fills = records.filter((r) => r.action_type === 'fill');
  const thefts = records.filter((r) => r.action_type === 'theft');

  const handleApplyMonth = () => {
    setAppliedMonth(selectedMonth);
  };

  const handleSaveDriverValue = async (record: FuelRecord) => {
    const newValue = editingDriverValue ?? record.driver_value;

    if (newValue === record.driver_value) {
      setEditingDriverId(null);
      return;
    }

    try {
      const res = await fetch('/api/fuel-review-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          driver_value: newValue || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      const result = await res.json();
      setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, ...result.data } : r)));
      setEditingDriverId(null);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save driver value',
        variant: 'destructive',
      });
    }
  };

  const renderDriverValue = (record: FuelRecord) => {
    if (editingDriverId === record.id) {
      return (
        <input
          autoFocus
          type="text"
          value={editingDriverValue ?? ''}
          onChange={(e) => setEditingDriverValue(e.target.value)}
          onBlur={() => handleSaveDriverValue(record)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveDriverValue(record);
            if (e.key === 'Escape') setEditingDriverId(null);
          }}
          className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
        />
      );
    }

    if (record.confirmed) {
      return (
        <span className="px-1 py-0.5 text-sm">
          {record.driver_value || '-'}
        </span>
      );
    }

    return (
      <span
        onClick={() => {
          setEditingDriverId(record.id);
          setEditingDriverValue(record.driver_value || '');
        }}
        className="cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100"
      >
        {record.driver_value || <span className="text-gray-400">Click to edit</span>}
      </span>
    );
  };

  const handleReviewAction = async (
    record: FuelRecord,
    action: 'confirm' | 'investigate'
  ) => {
    const isSameAction =
      (action === 'confirm' && record.confirmed) ||
      (action === 'investigate' && record.investigated);

    const newConfirmed = isSameAction ? false : action === 'confirm';
    const newInvestigated = isSameAction ? false : action === 'investigate';

    const updateData = {
      id: record.id,
      vehicle_reg: record.vehicle_reg,
      review_date: record.review_date,
      action_type: record.action_type,
      confirmed: newConfirmed,
      investigated: newInvestigated,
      reviewed_by: userEmail,
    };

    try {
      const res = await fetch('/api/fuel-review-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) throw new Error('Failed to save');

      const result = await res.json();
      const updated = result.data;

      setRecords((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );

      toast({
        title: isSameAction ? `${action} removed` : `${action} applied`,
        description: `${record.vehicle_reg} ${isSameAction ? 'unset' : `marked as ${action}`}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save action',
        variant: 'destructive',
      });
    }
  };

  const getRowColor = (record: FuelRecord): string => {
    if (record.investigated) return 'bg-red-50';
    if (record.confirmed) return 'bg-green-50';
    return '';
  };

  const renderActions = (record: FuelRecord) => {
    const hasAction = record.confirmed || record.investigated;

    if (!hasAction) {
      return (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleReviewAction(record, 'confirm')}
          >
            <CheckCircle className="mr-1 h-3 w-3" /> Confirm
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleReviewAction(record, 'investigate')}
          >
            <AlertTriangle className="mr-1 h-3 w-3" /> Investigate
          </Button>
        </div>
      );
    }

    if (record.confirmed) {
      return (
        <span className="inline-flex items-center text-green-600 text-xs font-medium">
          <CheckCircle className="mr-1 h-4 w-4" /> Confirmed
        </span>
      );
    }

    return (
      <span className="inline-flex items-center text-red-600 text-xs font-medium">
        <AlertTriangle className="mr-1 h-4 w-4" /> Investigated
      </span>
    );
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
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const tableHeaders = (
    <TableHeader>
      <TableRow className="bg-slate-50">
        <TableHead className="font-medium text-xs">Reg</TableHead>
        <TableHead className="font-medium text-xs">Fuel Probe Value</TableHead>
        <TableHead className="font-medium text-xs">Driver Value</TableHead>
        <TableHead className="font-medium text-xs">Reviewed By</TableHead>
        <TableHead className="font-medium text-xs text-center">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );

  const renderRows = (data: FuelRecord[]) => {
    if (data.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
            No records found for {appliedMonth}
          </TableCell>
        </TableRow>
      );
    }

    return data.map((record) => (
      <TableRow key={record.id} className={`h-12 ${getRowColor(record)}`}>
        <TableCell className="font-medium">{record.vehicle_reg}</TableCell>
        <TableCell>{record.probe_value || '-'}</TableCell>
        <TableCell>{renderDriverValue(record)}</TableCell>
        <TableCell className="text-xs text-gray-500">{record.reviewed_by || '-'}</TableCell>
        <TableCell className="text-center">{renderActions(record)}</TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="space-y-4">
      {/* Month Selector */}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Month</label>
          <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm text-gray-700 outline-none"
            />
          </div>
        </div>
        <Button onClick={handleApplyMonth} size="sm">
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
          Fuel Fills ({fills.length})
        </button>
        <button
          onClick={() => setActiveTab('thefts')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'thefts'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Fuel Thefts ({thefts.length})
        </button>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-[800px]">
          {tableHeaders}
          <TableBody>
            {activeTab === 'fills' ? renderRows(fills) : renderRows(thefts)}
          </TableBody>
        </Table>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
          <div className="h-1 bg-green-500" />
          <CardContent className="p-3">
            <div className="text-xl font-extrabold text-green-700">{fills.length}</div>
            <div className="text-xs text-gray-500">Fuel Fills</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
          <div className="h-1 bg-red-500" />
          <CardContent className="p-3">
            <div className="text-xl font-extrabold text-red-700">{thefts.length}</div>
            <div className="text-xs text-gray-500">Fuel Thefts</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
          <div className="h-1 bg-green-600" />
          <CardContent className="p-3">
            <div className="text-xl font-extrabold text-green-700">
              {records.filter((a) => a.confirmed).length}
            </div>
            <div className="text-xs text-gray-500">Confirmed</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg shadow-sm border-0 overflow-hidden">
          <div className="h-1 bg-amber-500" />
          <CardContent className="p-3">
            <div className="text-xl font-extrabold text-amber-700">
              {records.filter((a) => a.investigated).length}
            </div>
            <div className="text-xs text-gray-500">Under Investigation</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
