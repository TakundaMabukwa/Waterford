"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Grid3x3,
  List,
  MonitorPlay,
  PictureInPicture2,
  RadioTower,
  RefreshCw,
  Search,
  Shield,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import HLSPlayer from "@/components/video/HLSPlayer";

type VehicleChannel = {
  logicalChannel?: number;
  channel?: number;
};

interface ConnectedVehicle {
  id: string;
  name: string;
  phone?: string;
  channels: VehicleChannel[];
  registration?: string;
  fleetNumber?: string;
  displayLabel?: string;
  connected?: boolean;
  activeStreams?: number[];
}

type PinnedFeed = {
  vehicleId: string;
  fallbackVehicleIds: string[];
  channel: number;
  vehicleName: string;
};

type StreamEntry = {
  id: string;
  vehicleId: string;
  fallbackVehicleIds: string[];
  channel: number;
  vehicleName: string;
};

function getChannelNumber(channel: VehicleChannel): number {
  return channel.logicalChannel ?? channel.channel ?? 1;
}

function getLiveChannels(channels: VehicleChannel[] | undefined): number[] {
  const discovered = Array.isArray(channels)
    ? channels
        .map(getChannelNumber)
        .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index)
    : [];

  return Array.from(new Set([1, 2, ...discovered]));
}

export default function LiveStreamTab() {
  const [vehicles, setVehicles] = useState<ConnectedVehicle[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [gridColumns, setGridColumns] = useState(4);
  const [loading, setLoading] = useState(true);
  const [pinnedFeed, setPinnedFeed] = useState<PinnedFeed | null>(null);
  const [pipPosition, setPipPosition] = useState({ x: 24, y: 96 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const pipDragOffsetRef = useRef({ x: 0, y: 0 });
  const supabase = createClient();

  const fetchConnectedVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/video-server/vehicles/connected", { cache: "no-store" });
      if (!response.ok) {
        setVehicles([]);
        return;
      }

      const data = await response.json();
      const connectedVehicles = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.vehicles)
            ? data.vehicles
            : [];

      if (connectedVehicles.length === 0) {
        setVehicles([]);
        return;
      }

      const cameraIds = Array.from(
        new Set(
          connectedVehicles
            .map((vehicle: ConnectedVehicle) => String(vehicle.phone || vehicle.id || "").trim())
            .filter(Boolean)
        )
      );

      const registrationLookup = new Map<string, string>();
      const fleetLookup = new Map<string, string>();

      if (cameraIds.length > 0) {
        const { data: vehicleRows } = await supabase
          .from("vehiclesc")
          .select("registration_number, fleet_number, camera_sim_id, camera_serial")
          .or(`camera_sim_id.in.(${cameraIds.join(",")}),camera_serial.in.(${cameraIds.join(",")})`);

        for (const row of vehicleRows || []) {
          const registration = String(row?.registration_number || "").trim();
          const fleetNumber = String(row?.fleet_number || "").trim();
          const keys = [row?.camera_sim_id, row?.camera_serial]
            .map((value) => String(value || "").trim())
            .filter(Boolean);
          for (const key of keys) {
            if (registration && !registrationLookup.has(key)) {
              registrationLookup.set(key, registration);
            }
            if (fleetNumber && !fleetLookup.has(key)) {
              fleetLookup.set(key, fleetNumber);
            }
          }
        }
      }

      const vehiclesWithLabels = connectedVehicles.map((vehicle: ConnectedVehicle) => {
        const key = String(vehicle.phone || vehicle.id || "").trim();
        const registration = registrationLookup.get(key) || "";
        const fleetNumber = fleetLookup.get(key) || "";
        const fallbackName = String(vehicle.name || vehicle.id || vehicle.phone || "").trim();
        const displayLabel =
          registration && fleetNumber
            ? `${fleetNumber} - ${registration}`
            : registration || fleetNumber || fallbackName;

        return {
          ...vehicle,
          registration,
          fleetNumber,
          displayLabel,
        };
      });

      setVehicles(vehiclesWithLabels);
    } catch (error) {
      console.error("Failed to fetch connected vehicles", error);
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchConnectedVehicles();
  }, [fetchConnectedVehicles]);

  useEffect(() => {
    if (!isDraggingPip) return;

    const onMouseMove = (event: MouseEvent) => {
      const nextX = event.clientX - pipDragOffsetRef.current.x;
      const nextY = event.clientY - pipDragOffsetRef.current.y;
      const maxX = Math.max(0, window.innerWidth - 430);
      const maxY = Math.max(0, window.innerHeight - 120);

      setPipPosition({
        x: Math.min(Math.max(0, nextX), maxX),
        y: Math.min(Math.max(0, nextY), maxY),
      });
    };

    const onMouseUp = () => setIsDraggingPip(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingPip]);

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
        if (pinnedFeed?.vehicleId === vehicleId) {
          setPinnedFeed(null);
        }
      } else {
        next.add(vehicleId);
      }
      return next;
    });
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    if (vehicle.connected === false) return false;
    const term = searchTerm.toLowerCase();
    return (
      vehicle.id?.toLowerCase().includes(term) ||
      vehicle.displayLabel?.toLowerCase().includes(term) ||
      vehicle.registration?.toLowerCase().includes(term) ||
      vehicle.fleetNumber?.toLowerCase().includes(term)
    );
  });

  const liveChannelCount = filteredVehicles.reduce(
    (acc, vehicle) => acc + getLiveChannels(vehicle.channels).length,
    0
  );

  const streamEntries: StreamEntry[] = Array.from(selectedVehicles).flatMap((vehicleId) => {
    const vehicle = vehicles.find((entry) => entry.id === vehicleId);
    if (!vehicle) return [];

    const channels = getLiveChannels(vehicle.channels);
    return channels.map((channelNumber, idx) => ({
      id: `${vehicleId}-${channelNumber}-${idx}`,
      vehicleId,
      fallbackVehicleIds: Array.from(
        new Set([vehicle.id, vehicle.phone].map((value) => String(value || "").trim()).filter(Boolean))
      ),
      channel: channelNumber,
      vehicleName: `${vehicle.displayLabel} - Ch ${channelNumber}`,
    }));
  });

  const gridClassName = (() => {
    switch (gridColumns) {
      case 1:
        return "grid grid-cols-1 gap-4";
      case 2:
        return "grid grid-cols-1 gap-4 md:grid-cols-2";
      case 3:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
      case 4:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4";
      case 5:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5";
      case 6:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6";
      case 7:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7";
      case 8:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-8";
      default:
        return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4";
    }
  })();

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-slate-100 shadow-xl">
        <div className="p-6 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                <Shield className="h-3.5 w-3.5" />
                Vehicle Security Monitoring
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Live Stream Control Room</h2>
              <p className="mt-1 text-sm text-slate-300">Real-time visibility of connected vehicle channels.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Connected</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{filteredVehicles.length}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Channels</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">{liveChannelCount}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 md:col-span-1">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Streaming</p>
                <p className="mt-1 text-2xl font-bold text-amber-300">{selectedVehicles.size}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by registration, name, or SIM ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-10 border-slate-300 bg-white pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {viewMode === "grid" && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white p-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((cols) => (
                  <Button
                    key={cols}
                    variant={gridColumns === cols ? "default" : "outline"}
                    size="sm"
                    className={gridColumns === cols ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}
                    onClick={() => setGridColumns(cols)}
                  >
                    {cols}x{cols}
                  </Button>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={fetchConnectedVehicles}
              title="Refresh vehicles"
              className="border-slate-300"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <div className="rounded-lg border border-slate-300 bg-white p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-slate-900 hover:bg-slate-800" : ""}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-slate-900 hover:bg-slate-800" : ""}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {selectedVehicles.size > 0 && (
        <Card className="border-slate-200 bg-slate-950 p-4 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-100">
              <MonitorPlay className="h-5 w-5 text-emerald-400" />
              <h3 className="text-lg font-semibold">Active Stream Wall</h3>
            </div>
            <div className="flex items-center gap-2">
              {pinnedFeed && <Badge className="bg-cyan-600 text-white hover:bg-cyan-600">Split View Active</Badge>}
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{selectedVehicles.size} vehicle(s) live</Badge>
            </div>
          </div>

          <div className={gridClassName}>
            {streamEntries.map((entry) => (
              <div key={entry.id} className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                <div className="absolute right-2 top-2 z-20">
                  <Button
                    size="sm"
                    className="h-7 border border-cyan-400/40 bg-slate-950/80 px-2 text-[11px] text-cyan-300 hover:bg-slate-800"
                    variant="outline"
                    onClick={() => {
                      setPinnedFeed({
                        vehicleId: entry.vehicleId,
                        fallbackVehicleIds: entry.fallbackVehicleIds,
                        channel: entry.channel,
                        vehicleName: entry.vehicleName,
                      });
                      setPipPosition({
                        x: Math.max(16, window.innerWidth - 440),
                        y: Math.max(16, window.innerHeight - 390),
                      });
                    }}
                    title="Open split view"
                  >
                    <PictureInPicture2 className="mr-1 h-3.5 w-3.5" />
                    Split View
                  </Button>
                </div>
                <HLSPlayer
                  vehicleId={entry.vehicleId}
                  fallbackVehicleIds={entry.fallbackVehicleIds}
                  channel={entry.channel}
                  vehicleName={entry.vehicleName}
                  onStop={() => toggleVehicle(entry.vehicleId)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {pinnedFeed && (
        <div
          className="fixed z-[70] max-h-[90vh] max-w-[95vw] min-h-[280px] min-w-[320px] resize overflow-auto rounded-lg border border-cyan-400/40 bg-slate-900 shadow-2xl"
          style={{ left: pipPosition.x, top: pipPosition.y }}
        >
          <div
            className="flex cursor-move items-center justify-between border-b border-slate-700 bg-slate-950 px-3 py-2"
            onMouseDown={(event) => {
              setIsDraggingPip(true);
              pipDragOffsetRef.current = {
                x: event.clientX - pipPosition.x,
                y: event.clientY - pipPosition.y,
              };
            }}
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide text-cyan-300">Split View</p>
              <p className="text-xs font-semibold text-slate-100">{pinnedFeed.vehicleName}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => setPinnedFeed(null)}
              title="Close split view"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <HLSPlayer
            vehicleId={pinnedFeed.vehicleId}
            fallbackVehicleIds={pinnedFeed.fallbackVehicleIds}
            channel={pinnedFeed.channel}
            vehicleName={`${pinnedFeed.vehicleName} (Pinned)`}
            onStop={() => {
              toggleVehicle(pinnedFeed.vehicleId);
              setPinnedFeed(null);
            }}
          />
        </div>
      )}

      <div>
        <div className="mb-4 flex items-center gap-2">
          <RadioTower className="h-5 w-5 text-slate-700" />
          <h3 className="text-lg font-semibold text-slate-900">Connected Vehicles ({filteredVehicles.length})</h3>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-slate-600">Loading vehicles...</Card>
        ) : filteredVehicles.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">No connected vehicles found</Card>
        ) : viewMode === "grid" ? (
          <div className={gridClassName}>
            {filteredVehicles.map((vehicle) => (
              <Card
                key={vehicle.id}
                className={`min-w-0 cursor-pointer p-4 transition-all ${
                  selectedVehicles.has(vehicle.id)
                    ? "border-emerald-400 bg-emerald-50 shadow-md"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
                onClick={() => toggleVehicle(vehicle.id)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="shrink-0 rounded-lg bg-slate-900 p-2 text-white">
                      <Video className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900" title={vehicle.displayLabel}>
                        {vehicle.displayLabel}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500" title={`SIM: ${vehicle.phone || vehicle.id}`}>
                        SIM: {vehicle.phone || vehicle.id}
                      </p>
                    </div>
                  </div>
                  {vehicle.connected !== false ? (
                    <Badge className="w-fit shrink-0 self-start bg-emerald-600 text-white hover:bg-emerald-600">
                      <Wifi className="mr-1 h-3 w-3" />
                      {Array.isArray(vehicle.activeStreams) && vehicle.activeStreams.length > 0 ? "Live" : "Connected"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="w-fit shrink-0 self-start">
                      <WifiOff className="mr-1 h-3 w-3" />
                      Offline
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                    <Activity className="h-3.5 w-3.5" />
                    {getLiveChannels(vehicle.channels).length} channel(s)
                  </div>
                  <Button
                    size="sm"
                    variant={selectedVehicles.has(vehicle.id) ? "destructive" : "default"}
                    className={`w-full sm:w-auto ${selectedVehicles.has(vehicle.id) ? "" : "bg-slate-900 hover:bg-slate-800"}`}
                  >
                    {selectedVehicles.has(vehicle.id) ? "Stop" : "Stream"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Registration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">SIM ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Channels</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      {vehicle.connected !== false ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Connected</Badge>
                      ) : (
                        <Badge variant="outline">Offline</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{vehicle.displayLabel}</td>
                    <td className="px-4 py-3 text-slate-600">{vehicle.phone || vehicle.id}</td>
                    <td className="px-4 py-3 text-slate-600">{getLiveChannels(vehicle.channels).join(", ")}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant={selectedVehicles.has(vehicle.id) ? "destructive" : "default"}
                        className={selectedVehicles.has(vehicle.id) ? "" : "bg-slate-900 hover:bg-slate-800"}
                        onClick={() => toggleVehicle(vehicle.id)}
                      >
                        {selectedVehicles.has(vehicle.id) ? "Stop" : "Stream"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
