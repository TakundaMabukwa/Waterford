'use client';

import React, { useEffect, useState } from 'react';
import { Fuel, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FuelGauge } from '@/components/fuel-system/components/ui/fuel-gauge';
import { ColorPicker } from '@/components/fuel-system/components/ui/color-picker';
import { useApp } from '@/components/fuel-system/contexts/AppContext';
import { useUser } from '@/components/fuel-system/contexts/UserContext';
import { getLastFuelFill, FuelFill } from '@/lib/fuel-fill-detector';
import { formatForDisplay } from '@/lib/utils/date-formatter';

interface FuelGaugesViewProps {
  onBack: () => void;
}

interface FuelConsumptionData {
  id?: string | number;
  plate: string;
  branch: string;
  company: string;
  fuel_probe_1_level_percentage: number;
  fuel_probe_1_volume_in_tank: number;
  fuel_probe_2_level_percentage: number;
  fuel_probe_2_volume_in_tank: number;
  current_status: string;
  last_message_date: string;
  updated_at?: string;
  fuel_anomaly?: string;
  fuel_anomaly_note?: string;
  notes?: string | null;
  client_notes?: string | null;
  volume?: number;
  fuel_probe_1_temperature?: number;
  lastFuelFill?: FuelFill;
}

export function FuelGaugesView({ onBack }: FuelGaugesViewProps) {
  const { selectedRoute, vehicles, loading: contextLoading } = useApp();
  const { userSiteId, isAdmin } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fuelConsumptionData, setFuelConsumptionData] = useState<FuelConsumptionData[]>([]);
  const [fuelGaugeColors, setFuelGaugeColors] = useState({
    high: '#00FF00',
    medium: '#FFFF00',
    low: '#FF0000',
  });

  const handleNoteUpdate = (vehicleId: string | number, note: string) => {
    setFuelConsumptionData((prev) =>
      prev.map((vehicle) =>
        vehicle.id === vehicleId ? { ...vehicle, client_notes: note } : vehicle
      )
    );
  };

  const fetchColorCodes = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) return;

      const { data, error } = await supabase
        .from('fuel_gauge_settings')
        .select('color_high, color_medium, color_low')
        .eq('user_id', authUser.id)
        .single();

      if (!error && data) {
        setFuelGaugeColors({
          high: data.color_high,
          medium: data.color_medium,
          low: data.color_low,
        });
      }
    } catch (fetchError) {
      console.warn('Could not fetch color codes from Supabase:', fetchError);
    }
  };

  const buildBaseFuelData = (): FuelConsumptionData[] => {
    const costCode = (selectedRoute as any)?.costCode;
    const source = Array.isArray(vehicles) ? vehicles : [];

    let filtered = costCode
      ? source.filter(
          (vehicle: any) =>
            vehicle.cost_code === costCode || vehicle.cost_code?.startsWith(`${costCode}-`)
        )
      : source;

    if (userSiteId && !isAdmin) {
      filtered = filtered.filter((vehicle: any) => vehicle.branch === userSiteId);
    }

    return filtered.map((vehicle: any) => ({
      id: vehicle.id,
      plate: vehicle.plate,
      branch: vehicle.branch,
      company: vehicle.company,
      fuel_probe_1_level_percentage: parseFloat(vehicle.fuel_probe_1_level_percentage) || 0,
      fuel_probe_1_volume_in_tank: parseFloat(vehicle.fuel_probe_1_volume_in_tank) || 0,
      fuel_probe_2_level_percentage: parseFloat(vehicle.fuel_probe_2_level_percentage) || 0,
      fuel_probe_2_volume_in_tank: parseFloat(vehicle.fuel_probe_2_volume_in_tank) || 0,
      current_status: vehicle.drivername || 'Unknown',
      last_message_date: vehicle.last_message_date,
      updated_at: vehicle.updated_at,
      fuel_anomaly: vehicle.fuel_anomaly,
      fuel_anomaly_note: vehicle.fuel_anomaly_note,
      notes: vehicle.notes,
      client_notes: vehicle.client_notes,
      volume: 0,
      fuel_probe_1_temperature: parseFloat(vehicle.fuel_probe_1_temperature) || 0,
      lastFuelFill: undefined,
    }));
  };

  const enrichFuelData = async (baseRows: FuelConsumptionData[]) => {
    if (baseRows.length === 0) return;

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const vehicleIds = baseRows.map((row) => row.id?.toString()).filter(Boolean);
      const costCode = (selectedRoute as any)?.costCode;

      const [tankResult, activityResult, notesResult] = await Promise.allSettled([
        supabase
          .from('vehicle_settings')
          .select('vehicle_id, tank_size')
          .in('vehicle_id', vehicleIds),
        costCode
          ? (async () => {
              const today = new Date().toISOString().split('T')[0];
              const activityUrl = userSiteId
                ? `/api/energy-rite/reports/activity?date=${today}&site_id=${userSiteId}`
                : `/api/energy-rite/reports/activity?date=${today}&cost_code=${costCode}`;
              const response = await fetch(activityUrl);
              if (!response.ok) return null;
              return response.json();
            })()
          : Promise.resolve(null),
        supabase
          .from('note_logs')
          .select('vehicle_id, new_note, note_type')
          .in('vehicle_id', vehicleIds)
          .order('created_at', { ascending: false }),
      ]);

      const enrichedRows = baseRows.map((row) => ({ ...row }));

      if (tankResult.status === 'fulfilled' && tankResult.value.data) {
        const tankSizes = new Map<string, number>();
        tankResult.value.data.forEach((tank: any) => {
          const size = parseFloat(tank.tank_size);
          if (!isNaN(size)) {
            tankSizes.set(tank.vehicle_id, size);
          }
        });

        enrichedRows.forEach((row) => {
          const vehicleId = row.id?.toString();
          if (!vehicleId) return;
          const tankSize = tankSizes.get(vehicleId);
          if (tankSize !== undefined) {
            row.volume = tankSize;
          }
        });
      } else if (tankResult.status === 'rejected') {
        console.warn('Could not fetch tank sizes from Supabase:', tankResult.reason);
      }

      if (
        activityResult.status === 'fulfilled' &&
        activityResult.value?.success &&
        activityResult.value?.data?.sites
      ) {
        const sitesWithFills = activityResult.value.data.sites.map((site: any) => {
          const lastFill = getLastFuelFill(
            site.snapshots || [],
            site.site_id || site.id,
            site.branch || site.name
          );
          return { siteId: site.site_id || site.id, lastFill };
        });

        enrichedRows.forEach((row) => {
          const siteData = sitesWithFills.find((site: any) => site.siteId === row.id);
          if (siteData?.lastFill) {
            row.lastFuelFill = siteData.lastFill;
          }
        });
      } else if (activityResult.status === 'rejected') {
        console.warn('Could not fetch activity report for fuel fills:', activityResult.reason);
      }

      if (notesResult.status === 'fulfilled' && notesResult.value.data) {
        const internalNotes = new Map<string, string | null>();
        const externalNotes = new Map<string, string | null>();

        notesResult.value.data.forEach((note: any) => {
          if (note.note_type === 'internal' && !internalNotes.has(note.vehicle_id)) {
            internalNotes.set(note.vehicle_id, note.new_note);
          } else if (note.note_type === 'external' && !externalNotes.has(note.vehicle_id)) {
            externalNotes.set(note.vehicle_id, note.new_note);
          }
        });

        enrichedRows.forEach((row) => {
          const vehicleId = row.id?.toString();
          if (!vehicleId) return;
          row.notes = internalNotes.get(vehicleId) || row.notes;
          row.client_notes = externalNotes.get(vehicleId) || row.client_notes;
        });
      } else if (notesResult.status === 'rejected') {
        console.warn('Could not fetch notes from Supabase:', notesResult.reason);
      }

      setFuelConsumptionData(enrichedRows);
    } catch (enrichError) {
      console.warn('Could not enrich fuel gauge data:', enrichError);
    }
  };

  const fetchFuelData = async () => {
    try {
      setError(null);

      const baseRows = buildBaseFuelData();
      setLoading(baseRows.length === 0 && fuelConsumptionData.length === 0);
      setFuelConsumptionData(baseRows);
      setLoading(false);

      await enrichFuelData(baseRows);
    } catch (fetchError) {
      console.error('Error fetching vehicle data:', fetchError);
      setError('Failed to load vehicle data. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColorCodes();
  }, []);

  useEffect(() => {
    if (contextLoading && (!vehicles || vehicles.length === 0)) return;
    fetchFuelData();
  }, [selectedRoute, vehicles, contextLoading, userSiteId, isAdmin]);

  const fuelGaugeData = fuelConsumptionData
    .map((vehicle) => ({
      id: vehicle.id,
      location: vehicle.branch,
      fuelLevel: vehicle.fuel_probe_1_level_percentage,
      temperature: vehicle.fuel_probe_1_temperature,
      volume: vehicle.volume,
      currentVolume: vehicle.fuel_probe_1_volume_in_tank,
      remaining: `${vehicle.fuel_probe_1_volume_in_tank}L`,
      status: vehicle.current_status,
      lastUpdated: formatForDisplay(vehicle.last_message_date),
      updated_at: vehicle.updated_at,
      anomaly: vehicle.fuel_anomaly,
      anomalyNote: vehicle.notes,
      clientNote: vehicle.client_notes,
      lastFuelFill: vehicle.lastFuelFill,
      vehicleData: vehicle,
    }))
    .sort((a, b) => a.location.localeCompare(b.location));

  const activeSitesCount = fuelGaugeData.length;

  if ((loading && fuelConsumptionData.length === 0) || (contextLoading && fuelConsumptionData.length === 0 && (!vehicles || vehicles.length === 0))) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading fuel data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 text-6xl text-red-500">⚠️</div>
          <p className="mb-4 text-red-600">Error loading fuel data</p>
          <p className="mb-4 text-gray-600">{error}</p>
          <Button onClick={fetchFuelData} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="flex flex-col justify-between gap-3 px-3 pb-2 pt-4 sm:flex-row sm:items-center sm:px-4">
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Fuel Gauges</h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            {activeSitesCount} Active Sites
          </span>
          <ColorPicker onColorChange={setFuelGaugeColors} />
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {activeSitesCount > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
            {fuelGaugeData.map((data, index) => (
              <FuelGauge
                key={data.id ?? `${data.location}-${index}`}
                id={data.id}
                location={data.location}
                fuelLevel={data.fuelLevel}
                temperature={data.temperature}
                volume={data.volume}
                currentVolume={data.currentVolume}
                remaining={data.remaining}
                status={data.status}
                lastUpdated={data.lastUpdated}
                updated_at={data.updated_at}
                anomalyNote={data.anomalyNote}
                clientNote={data.clientNote}
                anomaly={data.anomaly}
                lastFuelFill={data.lastFuelFill}
                vehicleData={data.vehicleData}
                onNoteUpdate={handleNoteUpdate}
                colorCodes={fuelGaugeColors}
                className="transform transition-transform duration-200 sm:hover:scale-105"
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Fuel className="mx-auto mb-4 h-16 w-16 text-gray-400" />
              <p className="text-lg text-gray-500">No fuel data available</p>
              <p className="text-sm text-gray-400">Check your connection to the Energy Rite server</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
