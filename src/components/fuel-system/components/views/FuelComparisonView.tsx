'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Calendar, CheckCircle, AlertTriangle, X, Image as ImageIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

interface FuelComparisonViewProps {
  onBack?: () => void;
  initialDate?: string;
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
  notes: string | null;
}

interface SlipMatch {
  slip_id: number;
  fuel_amount: number | null;
  fuel_type: string | null;
  image_url: string | null;
  slip_created_at: string;
}

const toDateInputValue = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export function FuelComparisonView({ onBack, initialDate }: FuelComparisonViewProps) {
  const { toast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => initialDate || toDateInputValue(new Date()));
  const [appliedDate, setAppliedDate] = useState(selectedDate);

  const [activeTab, setActiveTab] = useState<'fills' | 'thefts'>('fills');
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [matches, setMatches] = useState<Record<string, SlipMatch>>({});
  const [unmatchedSlips, setUnmatchedSlips] = useState<SlipMatch[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [editingDriverValue, setEditingDriverValue] = useState<string | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closingNote, setClosingNote] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);

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

      const res = await fetch(`/api/fuel-slip-matches?date=${appliedDate}`);

      if (!res.ok) throw new Error('Failed to fetch fuel comparison data');

      const result = await res.json();
      setRecords(result.data || []);
      setMatches(result.matches || {});
      setUnmatchedSlips(result.unmatched_slips || []);

      toast({
        title: 'Data loaded',
        description: `Found ${(result.data || []).length} records for ${appliedDate}`,
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
  }, [appliedDate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fills = records.filter((r) => r.action_type === 'fill');
  const thefts = records.filter((r) => r.action_type === 'theft');

  const handleApplyDate = () => {
    setAppliedDate(selectedDate);
  };

  const patchRecord = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch('/api/fuel-review-actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    if (!res.ok) throw new Error('Failed to save');
    const result = await res.json();
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...result.data } : r)));
    return result.data;
  };

  const handleSaveDriverValue = async (record: FuelRecord) => {
    const newValue = editingDriverValue ?? record.driver_value;

    if (newValue === record.driver_value) {
      setEditingDriverId(null);
      return;
    }

    try {
      await patchRecord(record.id, { driver_value: newValue || null });
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

  const handleSaveNote = async (record: FuelRecord) => {
    const newValue = editingNoteValue ?? record.notes;

    if ((newValue || '') === (record.notes || '')) {
      setEditingNoteId(null);
      return;
    }

    try {
      await patchRecord(record.id, { notes: newValue || null });
      setEditingNoteId(null);
      toast({ title: 'Note saved', description: record.vehicle_reg });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save note',
        variant: 'destructive',
      });
    }
  };

  const renderNotes = (record: FuelRecord) => {
    if (editingNoteId === record.id) {
      return (
        <input
          autoFocus
          type="text"
          value={editingNoteValue ?? ''}
          onChange={(e) => setEditingNoteValue(e.target.value)}
          onBlur={() => handleSaveNote(record)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveNote(record);
            if (e.key === 'Escape') setEditingNoteId(null);
          }}
          placeholder="Type note..."
          className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
        />
      );
    }

    if (record.confirmed) {
      return (
        <span className="px-1 py-0.5 text-sm text-gray-700">
          {record.notes || '-'}
        </span>
      );
    }

    return (
      <span
        onClick={() => {
          setEditingNoteId(record.id);
          setEditingNoteValue(record.notes || '');
        }}
        className="cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-gray-100"
      >
        {record.notes || <span className="text-gray-400">Add note</span>}
      </span>
    );
  };

  const handleCloseInvestigation = async (record: FuelRecord) => {
    const note = closingNote.trim();
    if (!note) {
      toast({
        title: 'Note required',
        description: 'Please enter a note to close the investigation',
        variant: 'destructive',
      });
      return;
    }

    try {
      await patchRecord(record.id, {
        investigated: false,
        notes: note,
        reviewed_by: userEmail,
      });
      setClosingId(null);
      setClosingNote('');
      toast({
        title: 'Investigation closed',
        description: record.vehicle_reg,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to close investigation',
        variant: 'destructive',
      });
    }
  };

  const handleAcceptSlip = async (record: FuelRecord) => {
    const match = matches[record.id];
    if (!match || match.fuel_amount === null) return;

    try {
      await patchRecord(record.id, { driver_value: String(match.fuel_amount) });
      toast({
        title: 'Slip value applied',
        description: `${record.vehicle_reg} driver value set to ${match.fuel_amount}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to apply slip value',
        variant: 'destructive',
      });
    }
  };

  const renderSlip = (record: FuelRecord) => {
    const match = matches[record.id];
    if (!match) {
      return <span className="text-xs text-gray-400">No slip</span>;
    }

    return (
      <div className="flex items-center gap-2">
        {match.image_url ? (
          <img
            src={match.image_url}
            alt={`Fuel slip ${match.slip_id}`}
            onClick={() => setViewingImage(match.image_url)}
            className="h-10 w-10 cursor-pointer rounded border object-cover hover:opacity-80"
          />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded border bg-gray-50">
            <ImageIcon className="h-4 w-4 text-gray-400" />
          </span>
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium">{match.fuel_amount ?? '-'}</span>
          {!record.confirmed && match.fuel_amount !== null && (
            <button
              onClick={() => handleAcceptSlip(record)}
              className="text-left text-[11px] font-medium text-blue-600 hover:underline"
            >
              Use this value
            </button>
          )}
        </div>
      </div>
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

    try {
      await patchRecord(record.id, {
        vehicle_reg: record.vehicle_reg,
        review_date: record.review_date,
        action_type: record.action_type,
        confirmed: newConfirmed,
        investigated: newInvestigated,
        reviewed_by: userEmail,
      });

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

    // Investigated: allow closing with a note
    if (closingId === record.id) {
      return (
        <div className="flex items-center justify-center gap-1">
          <input
            autoFocus
            type="text"
            value={closingNote}
            onChange={(e) => setClosingNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCloseInvestigation(record);
              if (e.key === 'Escape') {
                setClosingId(null);
                setClosingNote('');
              }
            }}
            placeholder="Closing note (required)..."
            className="w-40 rounded border border-red-400 bg-white px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-red-400"
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleCloseInvestigation(record)}
          >
            Close
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1 text-xs"
            onClick={() => {
              setClosingId(null);
              setClosingNote('');
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-2">
        <span className="inline-flex items-center text-red-600 text-xs font-medium">
          <AlertTriangle className="mr-1 h-4 w-4" /> Investigated
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setClosingId(record.id);
            setClosingNote(record.notes || '');
          }}
        >
          Close investigation
        </Button>
      </div>
    );
  };

  const getRowColor = (record: FuelRecord): string => {
    if (record.investigated) return 'bg-red-50';
    if (record.confirmed) return 'bg-green-50';
    return '';
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

  const fillsHeaders = (
    <TableHeader>
      <TableRow className="bg-slate-50">
        <TableHead className="font-medium text-xs">Reg</TableHead>
        <TableHead className="font-medium text-xs">Fuel Probe Value</TableHead>
        <TableHead className="font-medium text-xs">Driver Value</TableHead>
        <TableHead className="font-medium text-xs">Slip</TableHead>
        <TableHead className="font-medium text-xs">Notes</TableHead>
        <TableHead className="font-medium text-xs">Reviewed By</TableHead>
        <TableHead className="font-medium text-xs text-center">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );

  const theftsHeaders = (
    <TableHeader>
      <TableRow className="bg-slate-50">
        <TableHead className="font-medium text-xs">Reg</TableHead>
        <TableHead className="font-medium text-xs">Fuel Probe Value</TableHead>
        <TableHead className="font-medium text-xs">Driver Value</TableHead>
        <TableHead className="font-medium text-xs">Notes</TableHead>
        <TableHead className="font-medium text-xs">Reviewed By</TableHead>
        <TableHead className="font-medium text-xs text-center">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );

  const renderFillRows = () => {
    if (fills.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
            No fuel fills found for {appliedDate}
          </TableCell>
        </TableRow>
      );
    }

    return fills.map((record) => (
      <TableRow key={record.id} className={`h-12 ${getRowColor(record)}`}>
        <TableCell className="font-medium">{record.vehicle_reg}</TableCell>
        <TableCell>{record.probe_value || '-'}</TableCell>
        <TableCell>{renderDriverValue(record)}</TableCell>
        <TableCell>{renderSlip(record)}</TableCell>
        <TableCell>{renderNotes(record)}</TableCell>
        <TableCell className="text-xs text-gray-500">{record.reviewed_by || '-'}</TableCell>
        <TableCell className="text-center">{renderActions(record)}</TableCell>
      </TableRow>
    ));
  };

  const renderTheftRows = () => {
    if (thefts.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
            No fuel thefts found for {appliedDate}
          </TableCell>
        </TableRow>
      );
    }

    return thefts.map((record) => (
      <TableRow key={record.id} className={`h-12 ${getRowColor(record)}`}>
        <TableCell className="font-medium">{record.vehicle_reg}</TableCell>
        <TableCell>{record.probe_value || '-'}</TableCell>
        <TableCell>{renderDriverValue(record)}</TableCell>
        <TableCell>{renderNotes(record)}</TableCell>
        <TableCell className="text-xs text-gray-500">{record.reviewed_by || '-'}</TableCell>
        <TableCell className="text-center">{renderActions(record)}</TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="space-y-4">
      {/* Day Selector */}
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Day</label>
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
        <Table className="min-w-[900px]">
          {activeTab === 'fills' ? fillsHeaders : theftsHeaders}
          <TableBody>
            {activeTab === 'fills' ? renderFillRows() : renderTheftRows()}
          </TableBody>
        </Table>
      </div>

      {/* Unmatched slips (same day) */}
      {unmatchedSlips.length > 0 && (
        <details className="rounded-md border bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Unmatched slips for {appliedDate} ({unmatchedSlips.length})
          </summary>
          <div className="mt-3 flex flex-wrap gap-3">
            {unmatchedSlips.map((slip) => (
              <div key={slip.slip_id} className="flex items-center gap-2 rounded-md border px-2 py-1">
                {slip.image_url && (
                  <img
                    src={slip.image_url}
                    alt={`Fuel slip ${slip.slip_id}`}
                    onClick={() => setViewingImage(slip.image_url)}
                    className="h-10 w-10 cursor-pointer rounded border object-cover hover:opacity-80"
                  />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{slip.fuel_amount ?? '-'}</span>
                  <span className="text-[11px] text-gray-500">{slip.fuel_type || ''}</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

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

      {/* Slip image lightbox */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-h-full max-w-3xl">
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-2 -right-2 rounded-full bg-white p-1 shadow"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={viewingImage}
              alt="Fuel slip"
              className="max-h-[85vh] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
