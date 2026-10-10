"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  RefreshCw,
  LogOut,
  Radio,
  Clock,
  Server,
  Layers,
} from "lucide-react";
import { API_BASE } from "@/lib/config";
import { DatasetModeIndicator } from "./DatasetModeIndicator";

interface AppHeaderProps {
  onMobileOpen: () => void;
  dataMode?: string;
  apiOnline?: boolean | null;
  lastRefreshed?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function AppHeader({
  onMobileOpen,
  dataMode = "DEMO",
  apiOnline = true,
  lastRefreshed,
  onRefresh,
  isRefreshing = false,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const getPageMeta = (path: string): { title: string; subtitle: string } => {
    if (path === "/") {
      return {
        title: "MOVEMENT INTELLIGENCE WORKSPACE",
        subtitle: "Multi-Camera Cross-Observation Topology & Trajectory Reconstruction",
      };
    }
    if (path.startsWith("/cameras")) {
      return {
        title: "CAMERA SENSOR NETWORK",
        subtitle: "Distributed CCTV Nodes, Ingestion Telemetry & Topology",
      };
    }
    if (path.startsWith("/vehicles/")) {
      return {
        title: "VEHICLE DOSSIER & EVIDENCE",
        subtitle: "Observation Lineage, Plate Region Localization & Cross-Camera Identity",
      };
    }
    if (path.startsWith("/vehicles")) {
      return {
        title: "VEHICLE RECORDS EXPLORER",
        subtitle: "Identified Global Vehicle Clusters & Tracking Evidence",
      };
    }
    if (path.startsWith("/trajectories")) {
      return {
        title: "TRAJECTORY ANALYSIS WORKSPACE",
        subtitle: "Synchronized Spatio-Temporal Progression Across Observed Cameras",
      };
    }
    if (path.startsWith("/investigation")) {
      return {
        title: "FORENSIC INVESTIGATION & EVIDENCE",
        subtitle: "Observation-Level Verification, Bounding Boxes & Perception Integrity",
      };
    }
    if (path.startsWith("/analytics")) {
      return {
        title: "MOBILITY INTELLIGENCE & FLOW ANALYTICS",
        subtitle: "Aggregated Camera Transitions, Vehicle Class Distributions & Decisions",
      };
    }
    if (path.startsWith("/data")) {
      return {
        title: "DATA IMPORT & SCHEMA VALIDATION",
        subtitle: "Pipeline JSON Package Ingestion, Schema Diagnostics & Mode Verification",
      };
    }
    if (path.startsWith("/live")) {
      return {
        title: "LIVE SENSOR FEEDS & PERCEPTION",
        subtitle: "Annotated Camera Feeds & Real-Time Tracking Inspection",
      };
    }
    return {
      title: "URBANTRACK WORKSTATION",
      subtitle: "Multi-Camera Vehicle Intelligence Platform",
    };
  };

  const meta = getPageMeta(pathname);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
    }
  };

  return (
    <header className="h-16 bg-[#0D1420] border-b border-[#29384B] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMobileOpen}
          className="lg:hidden p-2 rounded-lg border border-[#29384B] bg-[#111C2B] text-[#94A3B8] hover:text-[#F1F5F9]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-sm sm:text-base font-bold text-[#F1F5F9] truncate tracking-wide">
              {meta.title}
            </h1>
          </div>
          <p className="hidden md:block text-[11px] font-mono text-[#94A3B8] truncate">
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Telemetry & Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Dataset Mode Indicator */}
        <DatasetModeIndicator mode={apiOnline === false ? "OFFLINE" : dataMode} />

        {/* Backend Online status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#29384B] bg-[#111C2B] text-[11px] font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              apiOnline === false
                ? "bg-[#F87171]"
                : apiOnline
                ? "bg-[#34D399]"
                : "bg-[#FBBF24] animate-pulse"
            }`}
          />
          <span className="text-[#94A3B8] text-[10px]">API</span>
          <span
            className={`font-bold ${
              apiOnline === false
                ? "text-[#F87171]"
                : apiOnline
                ? "text-[#34D399]"
                : "text-[#FBBF24]"
            }`}
          >
            {apiOnline === false
              ? "OFFLINE"
              : apiOnline
              ? "ONLINE"
              : "CONNECTING"}
          </span>
        </div>

        {/* Refresh Action Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#29384B] bg-[#111C2B] hover:border-[#55D6E8] text-[#94A3B8] hover:text-[#55D6E8] font-mono text-xs transition-colors"
            title="Re-sync data from pipeline storage"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isRefreshing ? "animate-spin text-[#55D6E8]" : ""
              }`}
            />
            {lastRefreshed && (
              <span className="hidden xl:inline text-[10px] text-[#94A3B8]">
                {lastRefreshed}
              </span>
            )}
          </button>
        )}

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#29384B] bg-[#111C2B] hover:border-[#F87171]/50 hover:bg-[#F87171]/10 text-[#94A3B8] hover:text-[#F87171] font-mono text-xs transition-colors"
          title="Sign out of UrbanTrack workstation"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">EXIT</span>
        </button>
      </div>
    </header>
  );
}
