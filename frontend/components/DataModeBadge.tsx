import React from "react";

interface DataBadgeProps {
  mode?: "LIVE_PIPELINE" | "DEMO" | "NO_DATA" | string;
}

export function DataModeBadge({ mode = "UNKNOWN" }: DataBadgeProps) {
  if (mode === "LIVE_PIPELINE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        LIVE PIPELINE DATA
      </span>
    );
  }
  if (mode === "DEMO") {
    return (
      <span
        title="These records come from data/demo fixtures, not from Member 1 / Member 2 pipeline output."
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        DEMO DATA — NOT PIPELINE OUTPUT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-300">
      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
      {mode === "NO_DATA" ? "NO DATA LOADED" : mode === "OFFLINE" ? "BACKEND UNREACHABLE" : "CHECKING DATA SOURCE…"}
    </span>
  );
}

export function SafeText({
  value,
  fallback = "Not currently available",
  className = "",
}: {
  value: string | number | null | undefined;
  fallback?: string;
  className?: string;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className={`text-slate-400 italic ${className}`}>{fallback}</span>;
  }
  return <span className={className}>{value}</span>;
}
