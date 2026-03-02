"use client";

import { cn } from "@/lib/utils";

interface WaterfordBrandProps {
  compact?: boolean;
  className?: string;
  showTagline?: boolean;
}

export function WaterfordBrand({
  compact = false,
  className,
  showTagline = false,
}: WaterfordBrandProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#0C1E3D] shadow-sm ring-1 ring-[#E9A15B]/35",
          className
        )}
      >
        <span className="text-sm font-black tracking-wide text-[#E79B54]">WF</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-[#E9A15B]/35">
        <div className="leading-none">
          <div className="text-[23px] font-black uppercase tracking-[0.06em] text-[#0C1E3D]">
            Waterford
          </div>
          <div className="inline-block rounded-full bg-[#E79B54] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
            carriers
          </div>
        </div>
      </div>

      {showTagline && (
        <div className="space-y-0.5 pl-0.5 text-[10px] font-extrabold uppercase leading-tight tracking-[0.06em]">
          <div className="text-[#E79B54]">High-Level</div>
          <div className="text-[#0C1E3D]">Professional Transportation</div>
          <div className="text-[#E79B54]">Services</div>
        </div>
      )}
    </div>
  );
}
