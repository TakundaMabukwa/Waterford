'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Thermometer, Gauge, Clock, NotebookPen, Fuel } from 'lucide-react';
import { formatForDisplay } from '@/lib/utils/date-formatter';
import { AddNoteModal } from '@/components/fuel-system/components/ui/add-note-modal';
import { VehicleNotesHistoryModal } from '@/components/fuel-system/components/ui/vehicle-notes-history-modal';

interface FuelGaugeProps {
  location: string;
  fuelLevel: number;
  tank1Level?: number;
  tank2Level?: number;
  temperature: number;
  volume: number;
  currentVolume: number;
  remaining: string;
  status: string;
  lastUpdated: string;
  updated_at?: string;
  anomalyNote?: string;
  clientNote?: string;
  anomaly?: boolean;
  lastFuelFill?: {
    time: string;
    amount: number;
    previousLevel: number;
  };
  className?: string;
  colorCodes?: {
    high?: string;
    medium?: string;
    low?: string;
  };
  id?: string | number;
  vehicleData?: any;
  onNoteUpdate?: (vehicleId: string | number, note: string) => void;
}

export function FuelGauge({
  location,
  fuelLevel,
  tank1Level = 0,
  tank2Level = 0,
  temperature,
  volume,
  currentVolume,
  remaining,
  status,
  lastUpdated,
  updated_at,
  anomalyNote,
  clientNote,
  anomaly,
  lastFuelFill,
  className,
  colorCodes,
  id,
  vehicleData,
  onNoteUpdate
}: FuelGaugeProps) {
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isStatusTooltipOpen, setIsStatusTooltipOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState(anomalyNote || '');
  const [currentClientNote, setCurrentClientNote] = useState(clientNote || '');

  const getStatusColor = (nextStatus: string) => {
    if (!nextStatus) return 'bg-gray-100 text-gray-700 border-gray-200';
    const normalized = nextStatus.toUpperCase();
    if ((normalized.includes('PTO') || normalized.includes('ENGINE')) && normalized.includes('ON')) {
      return 'bg-white/70 text-green-700 border-green-200 shadow-sm';
    }
    if ((normalized.includes('PTO') || normalized.includes('ENGINE')) && normalized.includes('OFF')) {
      return 'bg-gray-100 text-gray-700 border-gray-200';
    }
    if (normalized.includes('POSSIBLE FUEL FILL')) {
      return 'bg-orange-100 text-orange-700 border-orange-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getDisplayStatus = (nextStatus: string) => nextStatus;

  const getFuelColor = (level: number) => {
    if (!colorCodes) {
      if (level <= 40) return '#ef4444';
      if (level <= 60) return '#eab308';
      return '#22c55e';
    }

    const colors = {
      low: colorCodes.low || '#FF0000',
      medium: colorCodes.medium || '#FFFF00',
      high: colorCodes.high || '#00FF00',
    };

    if (level <= 40) return colors.low;
    if (level <= 60) return colors.medium;
    return colors.high;
  };

  useEffect(() => {
    setCurrentNote(anomalyNote || '');
    setCurrentClientNote(clientNote || '');
  }, [anomalyNote, clientNote]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(hover: none), (pointer: coarse)');
    const updateTouchMode = () => {
      setIsTouchDevice(mediaQuery.matches || navigator.maxTouchPoints > 0);
    };

    updateTouchMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateTouchMode);
      return () => mediaQuery.removeEventListener('change', updateTouchMode);
    }

    mediaQuery.addListener(updateTouchMode);
    return () => mediaQuery.removeListener(updateTouchMode);
  }, []);

  const handleNoteAdded = (note: string) => {
    setCurrentClientNote(note);
    if (onNoteUpdate && id) {
      onNoteUpdate(id, note);
    }
  };

  const normalizedStatus = status?.toUpperCase() || '';
  const isEngineOn = normalizedStatus.includes('PTO ON') || normalizedStatus.includes('ENGINE ON');
  const auxTemperature = vehicleData?.fuel_probe_2_temperature;
  const auxCurrentVolume = vehicleData?.fuel_probe_2_volume_in_tank;

  return (
    <div
      className={cn(
        'shadow-sm hover:shadow-md p-2.5 sm:p-3 border rounded-lg transition-all duration-300 relative overflow-visible flex flex-col min-h-[360px] sm:min-h-[420px]',
        isEngineOn ? 'border-emerald-400 bg-[#b8f3c4]' : 'bg-white border-gray-300',
        className
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'absolute top-2 right-2 w-6 h-6 p-0',
          isEngineOn ? 'text-emerald-700 hover:bg-emerald-200/60' : 'hover:bg-gray-100'
        )}
        onClick={() => setIsHistoryModalOpen(true)}
        title="View Notes History"
      >
        <Clock className="w-3 h-3 text-gray-500" />
      </Button>

      <div className="mb-1 text-center">
        <h3 className="mb-1 font-semibold text-gray-900 text-base">{location}</h3>

        <div
          className={cn(
            'mb-1 p-1.5 rounded border',
            currentNote
              ? (anomaly ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200')
              : 'bg-transparent border-transparent'
          )}
        >
          <div
            className={cn(
              'flex items-start gap-1',
              currentNote ? (anomaly ? 'text-red-800' : 'text-blue-800') : 'text-transparent'
            )}
          >
            <NotebookPen className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
            <span
              className={cn(
                'text-xs text-left break-words line-clamp-1 leading-tight',
                currentNote ? (anomaly ? 'text-red-700' : 'text-blue-700') : 'text-transparent'
              )}
            >
              {currentNote || 'No note'}
            </span>
          </div>
        </div>

        {status && (
          <TooltipProvider>
            <Tooltip
              open={isTouchDevice ? isStatusTooltipOpen : undefined}
              onOpenChange={isTouchDevice ? setIsStatusTooltipOpen : undefined}
            >
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn('font-medium text-xs px-2 py-0.5 cursor-help', getStatusColor(status))}
                  onClick={() => {
                    if (!isTouchDevice) return;
                    setIsStatusTooltipOpen((open) => !open);
                  }}
                >
                  {getDisplayStatus(status)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent
                className="bg-white border border-gray-200 shadow-lg max-w-xs"
                side="bottom"
                align="center"
                sideOffset={5}
              >
                <div className="flex flex-col items-center py-1 px-2">
                  <p className="text-sm text-black font-medium">Status Update</p>
                  <p className="text-xs text-gray-700">{formatForDisplay(vehicleData?.loctime || lastUpdated)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex justify-center mb-3">
        <div className="flex flex-col items-center gap-2">
          {(() => {
            const tank1Percent = Math.round(tank1Level || 0);
            const tank2Percent = Math.round(tank2Level || 0);
            const totalPercent = Math.round(fuelLevel || 0);
            const tankRadius = 48;
            const tankStrokeWidth = 8;
            const tankNormalizedRadius = tankRadius - tankStrokeWidth * 2;
            const tankCircumference = tankNormalizedRadius * 2 * Math.PI;
            const tank1Offset = tankCircumference - (tank1Percent / 100) * tankCircumference;
            const tank2Offset = tankCircumference - (tank2Percent / 100) * tankCircumference;

            return (
              <>
                <div className="flex items-center justify-center gap-1">
                  <div className="relative h-[96px] w-[96px]">
                    <svg height={tankRadius * 2} width={tankRadius * 2} className="-rotate-90 transform">
                      <circle
                        stroke="#e5e7eb"
                        fill="transparent"
                        strokeWidth={tankStrokeWidth}
                        r={tankNormalizedRadius}
                        cx={tankRadius}
                        cy={tankRadius}
                      />
                      <circle
                        stroke={getFuelColor(tank1Percent)}
                        fill="transparent"
                        strokeWidth={tankStrokeWidth}
                        strokeDasharray={`${tankCircumference} ${tankCircumference}`}
                        style={{ strokeDashoffset: tank1Offset }}
                        r={tankNormalizedRadius}
                        cx={tankRadius}
                        cy={tankRadius}
                        className="transition-all duration-1000 ease-out"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Gauge className="mb-0.5 h-2.5 w-2.5 text-gray-400" />
                      <span className="text-[10px] font-medium leading-none text-gray-500">Tank 1</span>
                      <span className="text-[1.5rem] font-semibold leading-none text-gray-900">{tank1Percent}</span>
                      <span className="text-[10px] font-semibold leading-none text-gray-400">%</span>
                    </div>
                  </div>

                  <div className="relative h-[96px] w-[96px]">
                    <svg height={tankRadius * 2} width={tankRadius * 2} className="-rotate-90 transform">
                        <circle
                          stroke="#e5e7eb"
                          fill="transparent"
                          strokeWidth={tankStrokeWidth}
                          r={tankNormalizedRadius}
                          cx={tankRadius}
                          cy={tankRadius}
                        />
                        <circle
                          stroke={getFuelColor(tank2Percent)}
                          fill="transparent"
                          strokeWidth={tankStrokeWidth}
                          strokeDasharray={`${tankCircumference} ${tankCircumference}`}
                          style={{ strokeDashoffset: tank2Offset }}
                          r={tankNormalizedRadius}
                          cx={tankRadius}
                          cy={tankRadius}
                          className="transition-all duration-1000 ease-out"
                          strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Gauge className="mb-0.5 h-2.5 w-2.5 text-gray-400" />
                      <span className="text-[10px] font-medium leading-none text-gray-500">Tank 2</span>
                      <span className="text-[1.5rem] font-semibold leading-none text-gray-900">{tank2Percent}</span>
                      <span className="text-[10px] font-semibold leading-none text-gray-400">%</span>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-[52px] items-center justify-center rounded-md border border-emerald-500 bg-white px-2 py-0.5 shadow-sm">
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-sm font-bold text-emerald-600">{totalPercent}%</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      <div className="space-y-1">
        <div
          className={cn(
            'flex justify-start items-center px-1 py-0.5 rounded-lg',
            isEngineOn ? 'bg-emerald-300/70' : 'bg-gray-50'
          )}
        >
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-xs text-gray-900">Temp: {temperature}&deg;C</span>
          </div>
        </div>

        <div
          className={cn(
            'flex justify-start items-center px-1 py-0.5 rounded-lg',
            isEngineOn ? 'bg-emerald-300/70' : 'bg-gray-50'
          )}
        >
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-cyan-500" />
            <span className="font-medium text-xs text-gray-900">Temp 2: {auxTemperature ?? 'N/A'}&deg;C</span>
          </div>
        </div>

        <div
          className={cn(
            'flex justify-start items-center px-1 py-0.5 rounded-lg',
            isEngineOn ? 'bg-emerald-300/70' : 'bg-gray-50'
          )}
        >
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-xs text-gray-900 truncate whitespace-nowrap">
              Rem: {currentVolume ? currentVolume.toFixed(1) : 'N/A'}L from {volume ? volume.toFixed(1) : 'N/A'}L
            </span>
          </div>
        </div>

        <div
          className={cn(
            'flex justify-start items-center px-1 py-0.5 rounded-lg',
            isEngineOn ? 'bg-emerald-300/70' : 'bg-gray-50'
          )}
        >
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-amber-500" />
            <span className="font-medium text-xs text-gray-900 truncate whitespace-nowrap">
              Rem 2: {auxCurrentVolume != null ? Number(auxCurrentVolume).toFixed(1) : 'N/A'}L
            </span>
          </div>
        </div>

        <div
          className={cn(
            'flex items-center gap-2 px-1 py-0.5 rounded-lg',
            isEngineOn ? 'bg-emerald-300/70' : 'bg-gray-50'
          )}
        >
          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-900">Comm: {formatForDisplay(updated_at || lastUpdated)}</span>
        </div>

        <div
          className={cn(
            'px-2 py-1.5 border rounded-lg',
            currentClientNote ? 'bg-blue-50 border-blue-200' : 'bg-transparent border-transparent'
          )}
        >
          <div className="flex items-start gap-1">
            <NotebookPen
              className={cn('w-3 h-3 flex-shrink-0 mt-0.5', currentClientNote ? 'text-blue-600' : 'text-transparent')}
            />
            <span className={cn('text-xs leading-tight', currentClientNote ? 'text-blue-800' : 'text-transparent')}>
              {currentClientNote || 'No note'}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'w-full h-8 text-xs font-medium transition-colors',
              isEngineOn
                ? 'border-white bg-white text-gray-900 hover:bg-emerald-50 hover:border-emerald-200'
                : 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
            )}
            onClick={() => setIsNoteModalOpen(true)}
          >
            <NotebookPen className="w-3 h-3 mr-1" />
            Add Note
          </Button>
        </div>

        {lastFuelFill && (
          <div className="bg-green-50 p-2 rounded-lg">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-green-900 text-sm">Last Fill</span>
              <span className="font-bold text-green-900 text-sm">{lastFuelFill.amount.toFixed(1)}L</span>
            </div>
            <div className="text-green-700 text-xs">{formatForDisplay(lastFuelFill.time)}</div>
            <div className="text-green-600 text-xs">
              From {lastFuelFill.previousLevel.toFixed(1)}% to {fuelLevel.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      <AddNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        vehicleId={id || 'unknown'}
        vehicleLocation={location}
        currentNote={currentClientNote}
        vehicleData={vehicleData}
        onNoteAdded={handleNoteAdded}
      />

      <VehicleNotesHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        vehicleId={id || 'unknown'}
        vehicleLocation={location}
      />
    </div>
  );
}
