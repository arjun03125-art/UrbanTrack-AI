"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, HelpCircle, XCircle, Camera, ShieldCheck } from "lucide-react";

export type AssociationStatusType =
  | "confirmed"
  | "candidate"
  | "ambiguous"
  | "rejected"
  | "guarded"
  | "single_camera"
  | string;

interface StatusBadgeProps {
  status: AssociationStatusType;
  trackingType?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function normalizeStatus(status?: string, trackingType?: string): string {
  if (trackingType === "single_camera") return "single_camera";
  const s = (status || "").toLowerCase().trim();
  if (s === "confirmed") return "confirmed";
  if (s === "candidate") return "candidate";
  if (s === "ambiguous") return "ambiguous";
  if (s === "rejected") return "rejected";
  if (s === "guarded") return "guarded";
  if (s === "single_camera") return "single_camera";
  return s || "candidate";
}

export function StatusBadge({
  status,
  trackingType,
  size = "md",
  showIcon = true,
}: StatusBadgeProps) {
  const norm = normalizeStatus(status, trackingType);

  const configs: Record<
    string,
    { label: string; textClass: string; bgClass: string; borderClass: string; icon: React.ReactNode; desc: string }
  > = {
    confirmed: {
      label: "CONFIRMED",
      textClass: "text-[#34D399]",
      bgClass: "bg-[#34D399]/10",
      borderClass: "border-[#34D399]/40",
      icon: <CheckCircle2 className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />,
      desc: "Identity verified across cameras according to pipeline criteria",
    },
    candidate: {
      label: "CANDIDATE",
      textClass: "text-[#FBBF24]",
      bgClass: "bg-[#FBBF24]/10",
      borderClass: "border-[#FBBF24]/40 border-dashed",
      icon: <AlertTriangle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />,
      desc: "Cross-camera candidate association: NOT verified identity",
    },
    ambiguous: {
      label: "AMBIGUOUS",
      textClass: "text-[#FB923C]",
      bgClass: "bg-[#FB923C]/10",
      borderClass: "border-[#FB923C]/50",
      icon: <HelpCircle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />,
      desc: "Multiple candidate matches detected across cameras with high entropy",
    },
    rejected: {
      label: "REJECTED",
      textClass: "text-[#F87171]",
      bgClass: "bg-[#F87171]/10",
      borderClass: "border-[#F87171]/40",
      icon: <XCircle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />,
      desc: "Association evaluated and rejected by the cross-camera pipeline",
    },
    guarded: {
      label: "GUARDED",
      textClass: "text-[#94A3B8]",
      bgClass: "bg-[#94A3B8]/10",
      borderClass: "border-[#94A3B8]/40",
      icon: <ShieldCheck className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />,
      desc: "Association evaluated under restricted compatibility constraints",
    },
    single_camera: {
      label: "SINGLE-CAM",
      textClass: "text-[#55D6E8]",
      bgClass: "bg-[#55D6E8]/10",
      borderClass: "border-[#55D6E8]/40",
      icon: <Camera className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />,
      desc: "Local tracklet observed within one camera only: not a cross-camera track",
    },
  };

  const cfg = configs[norm] || {
    label: norm.toUpperCase(),
    textClass: "text-[#94A3B8]",
    bgClass: "bg-[#94A3B8]/10",
    borderClass: "border-[#29384B]",
    icon: <HelpCircle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />,
    desc: "Status record",
  };

  const pad = size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-0.5 text-[10px]";

  return (
    <span
      title={cfg.desc}
      className={`inline-flex items-center gap-1.5 font-mono font-bold tracking-wider rounded border ${pad} ${cfg.textClass} ${cfg.bgClass} ${cfg.borderClass}`}
    >
      {showIcon && cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
}
