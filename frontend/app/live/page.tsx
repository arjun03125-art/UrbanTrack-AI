"use client";

import React, { useState, useEffect } from "react";
import {
  Video,
  Play,
  Pause,
  AlertCircle,
  Camera as CameraIcon,
  Layers,
  Info,
  Radio,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { fetchCameras } from "@/lib/api";
import { Camera } from "@/types";

export default function LiveViewPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCam, setSelectedCam] = useState<string>("CAM_A");

  useEffect(() => {
    fetchCameras()
      .then((cams) => {
        setCameras(cams);
        if (cams.length > 0) setSelectedCam(cams[0].camera_id);
      })
      .catch(() => {});
  }, []);

  const activeCamera = cameras.find((c) => c.camera_id === selectedCam);

  return (
    <DashboardShell>
      <div className="space-y-4 font-mono select-none">
        {/* Header */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-[#55D6E8]" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">
                ANNOTATED SURVEILLANCE SENSOR FEEDS
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#080D14] text-[#34D399] border border-[#29384B]">
                INSPECTION STREAM
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Direct perception pipeline inspection with frame overlay tracking and sensor diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#94A3B8]">ACTIVE NODE:</span>
            <span className="font-bold text-[#55D6E8]">{selectedCam}</span>
          </div>
        </div>

        {/* Camera Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cameras.map((cam) => {
            const isSelected = selectedCam === cam.camera_id;
            return (
              <button
                key={cam.camera_id}
                onClick={() => setSelectedCam(cam.camera_id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors shrink-0 ${
                  isSelected
                    ? "bg-[#172437] border-[#55D6E8] text-[#55D6E8]"
                    : "bg-[#0D1420] border-[#29384B] text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                <CameraIcon className="w-3.5 h-3.5" />
                <span>{cam.camera_id}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? "bg-[#55D6E8]" : "bg-[#34D399]"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Video Player & Diagnostics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: Video Player Container (8 cols) */}
          <div className="lg:col-span-8 bg-[#111C2B] border border-[#29384B] rounded-xl overflow-hidden flex flex-col shadow-xl">
            <div className="p-3 bg-[#0D1420] border-b border-[#29384B] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#F87171] animate-pulse" />
                <span className="font-bold text-[#F1F5F9]">
                  FEED: {selectedCam} — {activeCamera?.name || "CCTV NODE"}
                </span>
              </div>
              <span className="text-[10px] text-[#94A3B8]">
                1080p @ {activeCamera?.fps || 30} FPS
              </span>
            </div>

            {/* Video Canvas / Storage Check */}
            <div className="relative aspect-video bg-[#080D14] flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#111C2B] border border-[#29384B] flex items-center justify-center text-[#94A3B8] mb-3">
                <Video className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-[#F1F5F9]">
                Annotated Perception Video Not Exported to Local Storage
              </h4>
              <p className="text-xs text-[#94A3B8] mt-1.5 max-w-md leading-relaxed">
                Upstream video inference has not yet generated a persistent MP4 file (<code className="text-[#55D6E8] bg-[#111C2B] px-1 py-0.5 rounded">data/videos/{selectedCam}.mp4</code>) for sensor node <strong className="text-[#F1F5F9]">{selectedCam}</strong>.
              </p>
              <div className="mt-4 px-3 py-1.5 rounded bg-[#111C2B] border border-[#29384B] text-[11px] text-[#FBBF24] flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Observations and telemetry active in memory</span>
              </div>
            </div>

            <div className="p-3 bg-[#0D1420] border-t border-[#29384B] flex items-center justify-between text-xs text-[#94A3B8]">
              <div className="flex items-center gap-2">
                <span>Perception Status:</span>
                <span className="text-[#34D399] font-bold">ONLINE &amp; ACTIVE</span>
              </div>
              <div className="text-[11px]">
                Inference: YOLOv8 + ByteTrack Single-Camera
              </div>
            </div>
          </div>

          {/* Right: Sensor Node Diagnostics (4 cols) */}
          <div className="lg:col-span-4 bg-[#111C2B] border border-[#29384B] rounded-xl p-4 space-y-3 shadow-xl text-xs">
            <h3 className="font-bold text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#29384B]">
              <Info className="w-4 h-4 text-[#55D6E8]" />
              <span>SENSOR NODE TELEMETRY</span>
            </h3>

            <div className="space-y-2">
              <div className="p-2.5 bg-[#0D1420] border border-[#29384B] rounded-lg">
                <span className="text-[10px] text-[#94A3B8] uppercase block">Node ID</span>
                <span className="font-bold text-sm text-[#55D6E8] mt-0.5 block">{selectedCam}</span>
              </div>

              <div className="p-2.5 bg-[#0D1420] border border-[#29384B] rounded-lg">
                <span className="text-[10px] text-[#94A3B8] uppercase block">Description</span>
                <span className="text-[#F1F5F9] mt-0.5 block">
                  {activeCamera?.location_description || "Traffic Monitoring Field of View"}
                </span>
              </div>

              <div className="p-2.5 bg-[#0D1420] border border-[#29384B] rounded-lg">
                <span className="text-[10px] text-[#94A3B8] uppercase block">Cumulative Observations</span>
                <span className="font-bold text-sm text-[#34D399] mt-0.5 block">
                  {activeCamera?.total_observations || 0}
                </span>
              </div>

              <div className="p-2.5 bg-[#0D1420] border border-[#29384B] rounded-lg">
                <span className="text-[10px] text-[#94A3B8] uppercase block">Unique Vehicles Tracked</span>
                <span className="font-bold text-sm text-[#8295FF] mt-0.5 block">
                  {activeCamera?.vehicles_observed || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
