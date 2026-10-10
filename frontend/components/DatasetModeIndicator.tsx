"use client";

import React from "react";
import { Database, AlertTriangle, Radio } from "lucide-react";

interface DatasetModeIndicatorProps {
  mode?: string;
  issuesCount?: number;
}

export function DatasetModeIndicator({ mode = "UNKNOWN", issuesCount = 0 }: DatasetModeIndicatorProps) {
  const m = mode.toUpperCase();

  if (m === "DEMO") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24] font-mono text-xs">
        <AlertTriangle className="w-3.5 h-3.5 text-[#FBBF24]" />
        <span className="font-bold tracking-wider">DEMO DATASET</span>
        <span className="hidden lg:inline text-[10px] text-[#94A3B8] font-normal pl-1 border-l border-[#29384B]">
          Illustrative fixture records
        </span>
      </div>
    );
  }

  if (m === "LIVE_PIPELINE") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399] font-mono text-xs">
        <Radio className="w-3.5 h-3.5 text-[#34D399] animate-pulse" />
        <span className="font-bold tracking-wider">ACTIVE PIPELINE</span>
        <span className="hidden lg:inline text-[10px] text-[#94A3B8] font-normal pl-1 border-l border-[#29384B]">
          Inference feed
        </span>
      </div>
    );
  }

  if (m === "OFFLINE") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#F87171]/40 bg-[#F87171]/10 text-[#F87171] font-mono text-xs">
        <span className="w-2 h-2 rounded-full bg-[#F87171]" />
        <span className="font-bold tracking-wider">BACKEND OFFLINE</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#29384B] bg-[#111C2B] text-[#94A3B8] font-mono text-xs">
      <Database className="w-3.5 h-3.5 text-[#55D6E8]" />
      <span className="font-bold tracking-wider">{m}</span>
      {issuesCount > 0 && (
        <span className="text-[10px] text-[#FBBF24]">({issuesCount} notices)</span>
      )}
    </div>
  );
}
