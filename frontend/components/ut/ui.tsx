"use client";
import React from "react";

export const STATUS_META: Record<string, { label: string; color: string; hint: string }> = {
  confirmed: { label: "Confirmed", color: "#34d399", hint: "Pipeline marked this cross-camera identity as confirmed." },
  candidate: { label: "Candidate", color: "#fbbf24", hint: "Possible same vehicle across cameras, NOT confirmed." },
  ambiguous: { label: "Ambiguous", color: "#fb923c", hint: "Several vehicles could match; the pipeline kept it uncertain." },
  guarded: { label: "Guarded", color: "#94a3b8", hint: "Blocked because the camera ReID models are incompatible." },
  rejected: { label: "Rejected", color: "#f87171", hint: "Pipeline decided these are different vehicles." },
  single_camera: { label: "Single camera", color: "#22d3ee", hint: "Seen by one camera only: a local track, not a city journey." },
};
export const statusOf = (v: { tracking_type?: string; identity_status?: string }) =>
  v.tracking_type === "single_camera" ? "single_camera" : v.identity_status || "candidate";

export function Badge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: "#94a3b8", hint: "" };
  return (
    <span
      title={m.hint}
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: m.color, background: m.color + "1f", border: `1px solid ${m.color}55` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function Panel({
  title, sub, right, children, className = "", pad = true,
}: { title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded-2xl border border-[var(--line)] bg-[var(--panel)] ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
          <div>
            {title && <h3 className="text-sm font-bold text-[var(--text)]">{title}</h3>}
            {sub && <p className="text-[11px] text-[var(--muted)] mt-0.5">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      <div className={pad ? "px-4 pb-4" : ""}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, accent = "var(--cyan)" }: { label: string; value: React.ReactNode; hint?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 relative overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-1" style={{ background: accent }} />
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="text-2xl font-bold font-mono mt-0.5 text-[var(--text)]">
        {value === null || value === undefined ? <span className="text-sm font-normal text-[var(--muted)]">not in data</span> : value}
      </div>
      {hint && <div className="text-[11px] text-[var(--muted)] mt-0.5">{hint}</div>}
    </div>
  );
}

export const NA = <span className="italic text-[var(--muted)]">Not currently available</span>;
export const clock = (t?: string | null) => (t ? t.slice(11, 19) : "—");
export const fullTime = (t?: string | null) => (t ? t.replace("T", " ").replace("Z", " UTC").slice(0, 23) : null);
export const validCoord = (c: { latitude?: number | null; longitude?: number | null }) =>
  typeof c.latitude === "number" && typeof c.longitude === "number" &&
  Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180 && !(c.latitude === 0 && c.longitude === 0);
