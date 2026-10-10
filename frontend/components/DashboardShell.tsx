"use client";

import React, { useState, useEffect, Suspense } from "react";
import { API_BASE } from "@/lib/config";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface DashboardShellProps {
  children: React.ReactNode;
  dataMode?: string;
  fullWidth?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function DashboardShellInner({
  children,
  dataMode: propMode,
  fullWidth = false,
  onRefresh,
  isRefreshing,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [apiMode, setApiMode] = useState<string>("UNKNOWN");
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const checkStatus = () => {
      fetch(`${API_BASE}/status`, { cache: "no-store", credentials: "include" })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (alive) {
            setApiMode(data.data_mode);
            setApiOnline(true);
            setLastRefreshed(new Date().toLocaleTimeString());
          }
        })
        .catch(() => {
          if (alive) setApiOnline(false);
        });
    };

    checkStatus();
    const interval = setInterval(checkStatus, 20000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const effectiveMode =
    apiOnline === false
      ? "OFFLINE"
      : propMode && propMode !== "LIVE_PIPELINE"
      ? propMode
      : apiMode;

  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh();
      return;
    }
    try {
      await fetch(`${API_BASE}/refresh`, { method: "POST", credentials: "include" });
      setLastRefreshed(new Date().toLocaleTimeString());
      window.location.reload();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#080D14] text-[#F1F5F9] flex flex-col font-sans selection:bg-[#55D6E8]/30 selection:text-[#F1F5F9]">
      {/* Sidebar Navigation */}
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main Workstation Wrapper */}
      <div
        className={`flex-1 flex flex-col transition-all duration-200 ${
          collapsed ? "lg:pl-16" : "lg:pl-64"
        }`}
      >
        <AppHeader
          onMobileOpen={() => setMobileOpen(true)}
          dataMode={effectiveMode}
          apiOnline={apiOnline}
          lastRefreshed={lastRefreshed}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <main
          className={`flex-1 w-full ${
            fullWidth
              ? "p-0 overflow-hidden"
              : "max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6 py-5"
          }`}
        >
          {children}
        </main>

        {!fullWidth && (
          <footer className="border-t border-[#29384B] px-6 py-3 bg-[#0D1420] text-center text-xs font-mono text-[#94A3B8] flex flex-col sm:flex-row justify-between items-center gap-2">
            <span className="font-semibold text-[#F1F5F9]/80">
              URBANTRACK AI · Multi-Camera Vehicle Movement Intelligence
            </span>
            <span className="text-[10px] text-[#94A3B8]/60">
              Spatio-Temporal Cross-Observation Matching &amp; Trajectory Fusion
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080D14] text-[#55D6E8] flex items-center justify-center font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#55D6E8] animate-ping" />
            INITIALIZING WORKSTATION...
          </div>
        </div>
      }
    >
      <DashboardShellInner {...props} />
    </Suspense>
  );
}
