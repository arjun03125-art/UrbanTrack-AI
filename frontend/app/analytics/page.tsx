"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  GitFork,
  RefreshCw,
  PieChart as PieIcon,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { fetchAnalytics, fetchMvpTelemetry } from "@/lib/api";
import { api } from "@/lib/useData";
import { AnalyticsData, MvpTelemetry } from "@/types";
import { MobilityAnalyticsPanel } from "@/components/MobilityAnalyticsPanel";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [telemetry, setTelemetry] = useState<MvpTelemetry | null>(null);
  const [statusDistribution, setStatusDistribution] = useState<Array<{ status: string; count: number }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, telem, summary] = await Promise.all([
        fetchAnalytics(),
        fetchMvpTelemetry().catch(() => null),
        api<any>("/observations/summary").catch(() => null),
      ]);
      setData(res);
      setTelemetry(telem);
      if (summary && summary.status_distribution) {
        setStatusDistribution(summary.status_distribution);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load analytics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <DashboardShell dataMode={data?.data_mode || "LIVE_PIPELINE"} onRefresh={loadData} isRefreshing={loading}>
      <div className="space-y-4 font-mono select-none">
        {/* Header */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#55D6E8]" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">
                CITY MOBILITY &amp; NETWORK ANALYTICS
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#080D14] text-[#34D399] border border-[#29384B]">
                COMPUTED DIRECTLY FROM LOADED RECORDS
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Empirical statistics calculated strictly from observed vehicle detections, camera transitions, and Re-ID decisions.
            </p>
          </div>

          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded bg-[#172437] border border-[#29384B] hover:border-[#55D6E8] text-[#55D6E8] flex items-center gap-1.5 text-xs transition-colors self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>RECALCULATE</span>
          </button>
        </div>

        {loading ? (
          <div className="py-24 text-center bg-[#111C2B] border border-[#29384B] rounded-xl">
            <RefreshCw className="w-8 h-8 text-[#55D6E8] animate-spin mx-auto mb-2" />
            <p className="text-[#94A3B8] text-xs">Computing pipeline mobility analytics...</p>
          </div>
        ) : error || !data ? (
          <div className="p-8 text-center text-[#F87171] text-xs bg-[#F87171]/10 border border-[#F87171]/30 rounded-xl">
            {error || "Analytics not available."}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Primary Analytics Panels */}
            <MobilityAnalyticsPanel
              vehicleDistribution={data.vehicle_type_distribution}
              cameraActivity={data.camera_activity}
              cameraFlows={data.camera_flows}
              statusDistribution={statusDistribution}
              isLoading={loading}
            />

            {/* Trajectory Hop Length Distribution Card */}
            <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#29384B] mb-4 text-xs">
                <div>
                  <h2 className="font-bold text-[#F1F5F9] uppercase tracking-wider">
                    TRAJECTORY MULTI-HOP LENGTH DISTRIBUTION
                  </h2>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    Count of distinct camera field-of-view visits per vehicle cluster
                  </p>
                </div>
                <span className="text-[10px] text-[#55D6E8]">Cross-Camera Metric</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {data.trajectory_lengths.map((t) => (
                  <div key={t.hops} className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
                    <span className="text-[10px] text-[#94A3B8] block">{t.hops} Camera Hops</span>
                    <span className="text-lg font-bold text-[#55D6E8] mt-1 block">
                      {t.count} <span className="text-[10px] text-[#94A3B8] font-normal">vehicles</span>
                    </span>
                  </div>
                ))}
                {data.trajectory_lengths.length === 0 && (
                  <div className="col-span-full py-4 text-center text-[#94A3B8] text-xs">
                    No trajectory hops recorded in current dataset.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
