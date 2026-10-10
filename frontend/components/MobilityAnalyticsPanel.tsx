"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Activity,
  PieChart as PieIcon,
  GitFork,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Camera,
  Layers,
} from "lucide-react";

interface AnalyticsProps {
  vehicleDistribution: Array<{ type: string; count: number }>;
  cameraActivity: Array<{
    camera_id: string;
    name?: string;
    vehicles: number;
    observations: number;
  }>;
  cameraFlows: Array<{ route: string; count: number }>;
  statusDistribution?: Array<{ status: string; count: number }>;
  isLoading?: boolean;
}

const PALETTE = ["#55D6E8", "#8295FF", "#34D399", "#FBBF24", "#FB923C", "#F87171"];

export function MobilityAnalyticsPanel({
  vehicleDistribution = [],
  cameraActivity = [],
  cameraFlows = [],
  statusDistribution = [],
  isLoading = false,
}: AnalyticsProps) {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="w-full p-12 flex flex-col items-center justify-center bg-[#111C2B] border border-[#29384B] rounded-xl font-mono text-xs text-[#94A3B8]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#55D6E8] mb-2" />
        <span>COMPUTING MOBILITY ANALYTICS FROM OBSERVATION RECORDS...</span>
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "#111C2B",
    borderColor: "#29384B",
    color: "#F1F5F9",
    borderRadius: "8px",
    fontSize: "11px",
    fontFamily: "ui-monospace, monospace",
  };

  return (
    <div className="space-y-4 font-mono select-none">
      {/* 2x2 Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Vehicle Type Classification Breakdown */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#29384B] mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#55D6E8]" />
              <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
                VEHICLE CLASS DISTRIBUTION
              </h3>
            </div>
            <span className="text-[10px] text-[#94A3B8]">YOLOv8/v11 Inferences</span>
          </div>

          <div className="h-64 w-full">
            {vehicleDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: any) => [`${val} vehicles`, "Volume"]}
                  />
                  <Pie
                    data={vehicleDistribution}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {vehicleDistribution.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PALETTE[index % PALETTE.length]}
                        stroke="#111C2B"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Legend
                    wrapperStyle={{ fontSize: "11px", fontFamily: "ui-monospace, monospace" }}
                    formatter={(val) => <span style={{ color: "#F1F5F9" }}>{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                No vehicle classification records loaded.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Observation Volume by Camera */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#29384B] mb-4">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#8295FF]" />
              <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
                OBSERVATION VOLUME BY CAMERA
              </h3>
            </div>
            <span className="text-[10px] text-[#94A3B8]">Perception Sensor Ingestion</span>
          </div>

          <div className="h-64 w-full">
            {cameraActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cameraActivity}>
                  <CartesianGrid stroke="#29384B" strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="camera_id"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: any) => [`${val} observations`, "Volume"]}
                  />
                  <Bar dataKey="observations" fill="#55D6E8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                No camera activity records loaded.
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Camera-to-Camera Flow Matrix */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#29384B] mb-4">
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-[#34D399]" />
              <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
                OBSERVED INTER-CAMERA FLOWS
              </h3>
            </div>
            <span className="text-[10px] text-[#94A3B8]">Trajectory Transition Volume</span>
          </div>

          <div className="h-64 w-full">
            {cameraFlows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cameraFlows} layout="vertical">
                  <CartesianGrid stroke="#29384B" strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" stroke="#94A3B8" fontSize={10} />
                  <YAxis
                    type="category"
                    dataKey="route"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: any) => [`${val} transitions`, "Flow"]}
                  />
                  <Bar dataKey="count" fill="#8295FF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                No camera-to-camera transitions recorded in dataset.
              </div>
            )}
          </div>
        </div>

        {/* Chart 4: Association Decisions & Integrity */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#29384B] mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#FBBF24]" />
              <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
                ASSOCIATION STATUS BREAKDOWN
              </h3>
            </div>
            <span className="text-[10px] text-[#94A3B8]">Pipeline Decisions</span>
          </div>

          <div className="h-64 w-full">
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistribution}>
                  <CartesianGrid stroke="#29384B" strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="status"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(val: any) => [`${val} vehicles`, "Count"]}
                  />
                  <Bar dataKey="count" fill="#34D399" radius={[4, 4, 0, 0]}>
                    {statusDistribution.map((entry, index) => {
                      let col = "#FBBF24";
                      if (entry.status.toLowerCase().includes("confirmed")) col = "#34D399";
                      if (entry.status.toLowerCase().includes("single")) col = "#55D6E8";
                      if (entry.status.toLowerCase().includes("ambiguous")) col = "#FB923C";
                      return <Cell key={`status-cell-${index}`} fill={col} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                No association decisions recorded in dataset.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
