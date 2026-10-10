"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Compass,
  GitFork,
  Map as MapIcon,
  Box,
  Layers,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Car,
  Camera as CameraIcon,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  FileSearch,
  Radio,
  Clock,
  Maximize2,
  Minimize2,
  Scan,
  Shield,
  Activity,
  ChevronUp,
  ChevronDown,
  X,
  ExternalLink,
  ChevronRightSquare,
  Sparkles,
} from "lucide-react";
import { useData } from "@/lib/useData";
import { GlobalVehicle, Camera, Observation } from "@/types";
import { StatusBadge, normalizeStatus } from "@/components/StatusBadge";
import { RegistrationPlateBadge } from "@/components/RegistrationPlateBadge";
import { AssociationGraph } from "@/components/AssociationGraph";
import { TopologicalNetworkGraph } from "@/components/TopologicalNetworkGraph";
import { EvidenceInspector } from "@/components/EvidenceInspector";
import { EvidenceModal } from "@/components/EvidenceModal";
import { api } from "@/lib/useData";

// Dynamically import Leaflet MapView with SSR disabled
const MapView = dynamic(() => import("@/components/ut/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full min-h-[440px] flex items-center justify-center bg-[#0A0D10] text-[#929DA5] font-mono text-xs">
      <span className="w-4 h-4 mr-2 border-2 border-[#65D9E8] border-t-transparent rounded-full animate-spin" />
      INITIALIZING TACTICAL SURVEILLANCE SENSORS...
    </div>
  ),
});

// Dynamically import Three.js Scene3D with SSR disabled
const Scene3D = dynamic(() => import("@/components/ut/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full min-h-[440px] flex items-center justify-center bg-[#0A0D10] text-[#929DA5] font-mono text-xs">
      <span className="w-4 h-4 mr-2 border-2 border-[#65D9E8] border-t-transparent rounded-full animate-spin" />
      INITIALIZING 3D SPATIAL DIGITAL TWIN...
    </div>
  ),
});

type CanvasMode = "map" | "topological" | "association" | "3d";
type EntityFilterTab = "all" | "with_plate" | "multi_cam";

export default function TacticalSurveillanceWorkspace() {
  const { data, loading, error, stamp, reload } = useData();

  // Selection states
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Canvas Mode
  const [mode, setMode] = useState<CanvasMode>("map");

  // Overlays and Panel Collapse States (Phases 3, 4, 8, 9)
  const [showEntitiesPanel, setShowEntitiesPanel] = useState<boolean>(true);
  const [showEventsPanel, setShowEventsPanel] = useState<boolean>(true);
  const [showDetailsPanel, setShowDetailsPanel] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [showAllCameras, setShowAllCameras] = useState<boolean>(false);

  // Search and Filtering (Phase 4, 6)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<EntityFilterTab>("all");
  const [fitTrigger, setFitTrigger] = useState<number>(1);

  // Evidence & Observations
  const [vehicleObservations, setVehicleObservations] = useState<Observation[]>([]);
  const [selectedObsForModal, setSelectedObsForModal] = useState<Observation | null>(null);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState<boolean>(false);

  // UTC Clock
  const [utcTime, setUtcTime] = useState<string>("");
  useEffect(() => {
    const updateTime = () => setUtcTime(new Date().toUTCString().slice(17, 25) + " UTC");
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Restore or default vehicle
  useEffect(() => {
    if (!data.vehicles.length) {
      setSelectedVehicleId(null);
      return;
    }
    setSelectedVehicleId((cur) => {
      if (cur && data.vehicles.some((v) => v.global_vehicle_id === cur)) return cur;
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("ut.selected_vehicle");
      } catch {}
      if (saved && data.vehicles.some((v) => v.global_vehicle_id === saved)) return saved;
      // Default to vehicle with multiple cameras or first vehicle
      const multi = data.vehicles.find((v) => new Set(v.cameras_visited).size > 1);
      return (multi || data.vehicles[0]).global_vehicle_id;
    });
  }, [data.vehicles]);

  const selectedVehicle = useMemo(() => {
    return data.vehicles.find((v) => v.global_vehicle_id === selectedVehicleId) || null;
  }, [data.vehicles, selectedVehicleId]);

  // Load observations when vehicle changes
  useEffect(() => {
    if (!selectedVehicleId) {
      setVehicleObservations([]);
      return;
    }
    let alive = true;
    api(`/vehicles/${encodeURIComponent(selectedVehicleId)}/observations`)
      .then((obs: Observation[]) => {
        if (alive) setVehicleObservations(obs);
      })
      .catch(() => {
        if (alive) setVehicleObservations([]);
      });
    return () => {
      alive = false;
    };
  }, [selectedVehicleId]);

  const handleSelectVehicle = useCallback((id: string) => {
    setSelectedVehicleId(id);
    setActiveStep(0);
    setSelectedCameraId(null);
    setFitTrigger((n) => n + 1);
    try {
      localStorage.setItem("ut.selected_vehicle", id);
    } catch {}
  }, []);

  // Filtered tracked vehicles list
  const filteredVehicles = useMemo(() => {
    let list = data.vehicles;

    if (entityFilter === "with_plate") {
      list = list.filter((v) => Boolean(v.primary_plate && v.primary_plate.trim().length > 0));
    } else if (entityFilter === "multi_cam") {
      list = list.filter((v) => v.cameras_visited.length > 1);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim().replace(" ", "");
      list = list.filter((v) => {
        const idMatch = v.global_vehicle_id.toLowerCase().includes(q);
        const plateMatch = v.primary_plate ? v.primary_plate.toLowerCase().replace(" ", "").includes(q) : false;
        const typeMatch = (v.vehicle_type || "").toLowerCase().includes(q);
        const camMatch = v.cameras_visited.some((c) => c.toLowerCase().includes(q));
        return idMatch || plateMatch || typeMatch || camMatch;
      });
    }

    return list;
  }, [data.vehicles, entityFilter, searchQuery]);

  // Derived Real Activity Events Feed (Phase 9)
  const systemEvents = useMemo(() => {
    const events: { id: string; time: string; type: string; message: string; tag: string }[] = [];

    // 1. Reconstructed Journey events
    data.vehicles.slice(0, 15).forEach((v, idx) => {
      if (v.cameras_visited.length > 1) {
        const time = v.first_seen ? v.first_seen.slice(11, 19) : "10:12:00";
        events.push({
          id: `ev_recon_${v.global_vehicle_id}`,
          time,
          type: "RECON",
          message: `JOURNEY_RECON // ${v.global_vehicle_id} · ${v.cameras_visited.length} hops · ${v.primary_plate || "No plate"}`,
          tag: (v.identity_status || "CONFIRMED").toUpperCase(),
        });
      }
    });

    // 2. Active Sensor Telemetry events
    data.cameras.slice(0, 8).forEach((c, idx) => {
      events.push({
        id: `ev_cam_${c.camera_id}`,
        time: c.last_observation ? c.last_observation.slice(11, 19) : "10:00:00",
        type: "SENSOR",
        message: `SENSOR_ONLINE // ${c.camera_id} · ${c.location_description || c.name || "Station"}`,
        tag: "STREAMING",
      });
    });

    // 3. System Data Quality warning
    events.push({
      id: "ev_sys_mode",
      time: "SYSTEM",
      type: "AUDIT",
      message: "DATASET_INTEGRITY // 46 cameras · 150 synthetic identities · DEMO ENCLAVE",
      tag: "SYNTHETIC",
    });

    return events;
  }, [data.vehicles, data.cameras]);

  // Timeline scrubber automation
  useEffect(() => {
    if (!isPlaying || !selectedVehicle || selectedVehicle.trajectory.length <= 1) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % selectedVehicle.trajectory.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isPlaying, selectedVehicle]);

  return (
    <div
      className={`min-h-screen bg-[#0A0D10] text-[#E7EAEC] font-sans flex flex-col selection:bg-[#65D9E8]/30 selection:text-[#E7EAEC] ${
        isFullScreen ? "fixed inset-0 z-50 overflow-hidden" : ""
      }`}
    >
      {/* 1. SLIM PERSISTENT TOP STATUS BAR (Phases 2, 3) */}
      <header className="h-11 border-b border-[#30383E] bg-[#111519]/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between text-xs font-mono shrink-0 select-none z-30">
        {/* Left: Branding & Synthetic Data Indicator */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-[#E7EAEC] hover:text-[#65D9E8] transition-colors">
            <Radio className="w-4 h-4 text-[#E74B42] animate-pulse" />
            <span className="font-bold tracking-wider text-xs">URBANTRACK AI</span>
            <span className="text-[10px] text-[#929DA5] hidden md:inline">// TACTICAL SURVEILLANCE</span>
          </Link>

          {/* Persistent Synthetic Demo Indicator (Phase 9) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#E6B85C]/40 bg-[#E6B85C]/10 text-[#E6B85C] text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E6B85C] animate-ping" />
            <span>SYNTHETIC DEMO DATA</span>
          </div>

          {/* Sensor & Entity Counters */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] text-[#929DA5] pl-2 border-l border-[#30383E]">
            <span>
              SENSORS: <strong className="text-[#52C99A]">46 ONLINE</strong>
            </span>
            <span>
              ENTITIES: <strong className="text-[#65D9E8]">{data.vehicles.length || 150}</strong>
            </span>
            <span>
              OBSERVATIONS: <strong className="text-[#E7EAEC]">{data.totalObservations || 5426}</strong>
            </span>
          </div>
        </div>

        {/* Center: Quick Global Search Input (Phase 6) */}
        <div className="flex items-center max-w-xs sm:max-w-sm w-full mx-2">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-[#929DA5] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Vehicle ID, Plate, Camera..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0E1317] border border-[#30383E] rounded px-8 py-1 text-[11px] text-[#E7EAEC] placeholder-[#929DA5]/60 focus:outline-hidden focus:border-[#65D9E8] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#929DA5] hover:text-[#E7EAEC]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right: View Mode Tabs & Navigation Controls */}
        <div className="flex items-center gap-2">
          {/* Canvas Mode Switcher */}
          <div className="flex items-center bg-[#0E1317] border border-[#30383E] rounded p-0.5 text-[10px]">
            <button
              onClick={() => setMode("map")}
              className={`px-2 py-0.5 rounded transition-colors ${
                mode === "map" ? "bg-[#65D9E8] text-[#0A0D10] font-bold" : "text-[#929DA5] hover:text-[#E7EAEC]"
              }`}
              title="Tactical Geospatial Map"
            >
              MAP
            </button>
            <button
              onClick={() => setMode("3d")}
              className={`px-2 py-0.5 rounded transition-colors ${
                mode === "3d" ? "bg-[#65D9E8] text-[#0A0D10] font-bold" : "text-[#929DA5] hover:text-[#E7EAEC]"
              }`}
              title="3D Urban Digital Twin"
            >
              3D TWIN
            </button>
            <button
              onClick={() => setMode("topological")}
              className={`px-2 py-0.5 rounded transition-colors ${
                mode === "topological" ? "bg-[#65D9E8] text-[#0A0D10] font-bold" : "text-[#929DA5] hover:text-[#E7EAEC]"
              }`}
              title="Camera Graph Topology"
            >
              TOPOLOGY
            </button>
            <button
              onClick={() => setMode("association")}
              className={`px-2 py-0.5 rounded transition-colors ${
                mode === "association" ? "bg-[#65D9E8] text-[#0A0D10] font-bold" : "text-[#929DA5] hover:text-[#E7EAEC]"
              }`}
              title="Re-ID Association Matrix"
            >
              RE-ID
            </button>
          </div>

          {/* Module Nav Links */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-[#929DA5] border-l border-[#30383E] pl-2">
            <Link href="/trajectories" className="hover:text-[#65D9E8] transition-colors">
              TRAJECTORIES
            </Link>
            <span className="text-[#30383E]">·</span>
            <Link href="/vehicles" className="hover:text-[#65D9E8] transition-colors">
              VEHICLES
            </Link>
            <span className="text-[#30383E]">·</span>
            <Link href="/cameras" className="hover:text-[#65D9E8] transition-colors">
              CAMERAS
            </Link>
          </div>

          {/* UTC Clock */}
          <span className="hidden sm:inline text-[10px] text-[#929DA5] font-mono bg-[#0E1317] border border-[#30383E] px-2 py-0.5 rounded">
            {utcTime || "UTC"}
          </span>

          {/* Full-Screen Expand / Exit Toggle */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1 rounded border border-[#30383E] bg-[#0E1317] hover:border-[#65D9E8] text-[#929DA5] hover:text-[#65D9E8] transition-colors"
            title={isFullScreen ? "Exit Full-Screen Workspace" : "Enter Full-Screen Tactical Workspace"}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5 text-[#65D9E8]" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* 2. FULL-SCREEN TACTICAL MAP WORKSPACE & FLOATING OVERLAYS (Phases 3, 4, 7, 8, 9) */}
      <div className="relative flex-1 w-full h-[calc(100vh-44px)] overflow-hidden bg-[#0A0D10]">
        {/* Central Map Canvas Layer */}
        <div className="absolute inset-0 z-0">
          {mode === "map" && (
            <MapView
              cameras={data.cameras}
              network={data.network}
              vehicle={selectedVehicle}
              step={activeStep}
              onStep={(s) => setActiveStep(s)}
              selectedCamera={selectedCameraId}
              onSelectCamera={(cid) => setSelectedCameraId(cid)}
              showAllCameras={showAllCameras}
              onToggleShowAllCameras={setShowAllCameras}
              isFullScreen={isFullScreen}
              onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
              fitTrigger={fitTrigger}
            />
          )}

          {mode === "3d" && (
            <Scene3D
              cameras={data.cameras}
              network={data.network}
              vehicle={selectedVehicle}
              step={activeStep}
              onStep={(s) => setActiveStep(s)}
              selectedCameraId={selectedCameraId}
            />
          )}

          {mode === "topological" && (
            <div className="w-full h-full p-4 overflow-auto bg-[#0A0D10]">
              <TopologicalNetworkGraph
                cameras={data.cameras}
                network={data.network}
                selectedVehicle={selectedVehicle}
                activeStepIndex={activeStep}
                selectedCameraId={selectedCameraId}
                onSelectCamera={(cid) => setSelectedCameraId(cid)}
                height={780}
              />
            </div>
          )}

          {mode === "association" && (
            <div className="w-full h-full p-4 overflow-auto bg-[#0A0D10]">
              <AssociationGraph
                vehicles={data.vehicles}
                cameras={data.cameras}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicle={handleSelectVehicle}
                selectedCameraId={selectedCameraId}
                onSelectCamera={(cid) => setSelectedCameraId(cid)}
                height={780}
              />
            </div>
          )}
        </div>

        {/* 3. FLOATING TRACKED ENTITIES PANEL (Upper-Left, Phase 4) */}
        {showEntitiesPanel ? (
          <aside className="absolute top-3 left-3 z-20 w-84 max-w-[calc(100vw-24px)] max-h-[calc(100vh-140px)] flex flex-col rounded-lg border border-[#30383E] bg-[#111519]/95 backdrop-blur-md shadow-2xl font-mono overflow-hidden transition-all">
            {/* Panel Header */}
            <div className="p-2.5 border-b border-[#30383E] flex items-center justify-between bg-[#191F24]/70">
              <div className="flex items-center gap-2">
                <Car className="w-3.5 h-3.5 text-[#E74B42]" />
                <span className="font-bold text-xs tracking-wider text-[#E7EAEC]">TRACKED VEHICLES</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0E1317] border border-[#30383E] text-[#65D9E8]">
                  {filteredVehicles.length}
                </span>
              </div>
              <button
                onClick={() => setShowEntitiesPanel(false)}
                className="text-[#929DA5] hover:text-[#E7EAEC] p-1"
                title="Minimize Tracked Vehicles Panel"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Filter Tabs: [ALL] [WITH PLATE] [MULTI-CAM] */}
            <div className="p-1.5 border-b border-[#30383E] flex items-center gap-1 text-[10px]">
              <button
                onClick={() => setEntityFilter("all")}
                className={`flex-1 py-1 rounded text-center transition-colors ${
                  entityFilter === "all"
                    ? "bg-[#191F24] text-[#65D9E8] font-bold border border-[#30383E]"
                    : "text-[#929DA5] hover:text-[#E7EAEC]"
                }`}
              >
                ALL ({data.vehicles.length})
              </button>
              <button
                onClick={() => setEntityFilter("with_plate")}
                className={`flex-1 py-1 rounded text-center transition-colors ${
                  entityFilter === "with_plate"
                    ? "bg-[#191F24] text-[#65D9E8] font-bold border border-[#30383E]"
                    : "text-[#929DA5] hover:text-[#E7EAEC]"
                }`}
              >
                PLATES
              </button>
              <button
                onClick={() => setEntityFilter("multi_cam")}
                className={`flex-1 py-1 rounded text-center transition-colors ${
                  entityFilter === "multi_cam"
                    ? "bg-[#191F24] text-[#65D9E8] font-bold border border-[#30383E]"
                    : "text-[#929DA5] hover:text-[#E7EAEC]"
                }`}
              >
                MULTI-CAM
              </button>
            </div>

            {/* Tracked Vehicle Entity Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#30383E]/50 text-xs">
              {filteredVehicles.length === 0 ? (
                <div className="p-4 text-center text-[#929DA5] text-[11px]">
                  No vehicle records match query.
                </div>
              ) : (
                filteredVehicles.map((v) => {
                  const isSelected = v.global_vehicle_id === selectedVehicleId;
                  const hops = v.cameras_visited.length;

                  return (
                    <div
                      key={v.global_vehicle_id}
                      onClick={() => handleSelectVehicle(v.global_vehicle_id)}
                      className={`p-2.5 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#191F24] border-l-[3px] border-l-[#65D9E8] text-[#E7EAEC]"
                          : "hover:bg-[#191F24]/60 text-[#E7EAEC]"
                      }`}
                    >
                      {/* Top Row: Vehicle ID & Journey Status */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-[#E7EAEC] tracking-wider">
                          {v.global_vehicle_id}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            v.identity_status === "confirmed" || hops > 1
                              ? "bg-[#52C99A]/15 text-[#52C99A] border border-[#52C99A]/30"
                              : "bg-[#E6B85C]/15 text-[#E6B85C] border border-[#E6B85C]/30"
                          }`}
                        >
                          {hops > 1 ? "RECONSTRUCTED" : (v.identity_status || "CANDIDATE").toUpperCase()}
                        </span>
                      </div>

                      {/* Middle Row: Type & Registration Plate Badge (Phase 5) */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] text-[#929DA5] uppercase">
                          {v.vehicle_type}
                        </span>
                        <RegistrationPlateBadge
                          plateText={v.primary_plate}
                          plateConfidence={v.plate_confidence}
                          size="sm"
                          showConfidence={false}
                        />
                      </div>

                      {/* Bottom Row: Cameras Visited & Observations */}
                      <div className="flex items-center justify-between text-[10px] text-[#929DA5]">
                        <span className="flex items-center gap-1 text-[#65D9E8]">
                          <CameraIcon className="w-3 h-3" />
                          {hops} CAMS VISITED
                        </span>
                        <span>{v.total_observations} OBS</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        ) : (
          /* Minimized Entities Tab */
          <button
            onClick={() => setShowEntitiesPanel(true)}
            className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-md border border-[#30383E] bg-[#111519]/90 px-2.5 py-1.5 text-xs font-mono text-[#E7EAEC] hover:border-[#65D9E8] transition-colors shadow-lg backdrop-blur-md"
          >
            <Car className="w-3.5 h-3.5 text-[#E74B42]" />
            <span>TRACKED VEHICLES ({data.vehicles.length})</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#929DA5]" />
          </button>
        )}

        {/* 4. FLOATING SYSTEM EVENT FEED (Lower-Left, Phase 9) */}
        {showEventsPanel ? (
          <aside className="absolute bottom-3 left-3 z-20 w-84 max-w-[calc(100vw-24px)] max-h-48 flex flex-col rounded-lg border border-[#30383E] bg-[#111519]/95 backdrop-blur-md shadow-2xl font-mono text-xs overflow-hidden">
            <div className="p-2 border-b border-[#30383E] flex items-center justify-between bg-[#191F24]/70">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#52C99A]" />
                <span className="font-bold text-[11px] tracking-wider text-[#E7EAEC]">SYSTEM EVENT FEED</span>
              </div>
              <button
                onClick={() => setShowEventsPanel(false)}
                className="text-[#929DA5] hover:text-[#E7EAEC] p-0.5"
                title="Minimize Event Feed"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-[10px] divide-y divide-[#30383E]/30">
              {systemEvents.map((ev) => (
                <div key={ev.id} className="pt-1 first:pt-0 flex items-start justify-between gap-1">
                  <div className="leading-tight">
                    <span className="text-[#929DA5] font-bold mr-1.5">[{ev.time}]</span>
                    <span className="text-[#E7EAEC]">{ev.message}</span>
                  </div>
                  <span
                    className={`shrink-0 text-[8px] font-bold px-1 py-0.2 rounded uppercase ${
                      ev.tag === "CONFIRMED" || ev.tag === "STREAMING"
                        ? "bg-[#52C99A]/15 text-[#52C99A]"
                        : ev.tag === "SYNTHETIC"
                        ? "bg-[#E6B85C]/15 text-[#E6B85C]"
                        : "bg-[#65D9E8]/15 text-[#65D9E8]"
                    }`}
                  >
                    {ev.tag}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        ) : (
          <button
            onClick={() => setShowEventsPanel(true)}
            className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-md border border-[#30383E] bg-[#111519]/90 px-2.5 py-1 text-[10px] font-mono text-[#929DA5] hover:border-[#52C99A] hover:text-[#E7EAEC] transition-colors shadow-lg backdrop-blur-md"
          >
            <Activity className="w-3 h-3 text-[#52C99A]" />
            <span>EVENT FEED</span>
            <ChevronUp className="w-3 h-3 text-[#929DA5]" />
          </button>
        )}

        {/* 5. FLOATING SELECTED-VEHICLE DETAILS PANEL (Right-Side, Phases 5, 8) */}
        {selectedVehicle && (
          <>
            {showDetailsPanel ? (
              <aside className="absolute top-3 right-3 z-20 w-96 max-w-[calc(100vw-24px)] max-h-[calc(100vh-140px)] flex flex-col rounded-lg border border-[#30383E] bg-[#111519]/95 backdrop-blur-md shadow-2xl font-mono text-xs overflow-hidden">
                {/* Header */}
                <div className="p-3 border-b border-[#30383E] flex items-center justify-between bg-[#191F24]/70">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#65D9E8]" />
                    <span className="font-bold text-xs tracking-wider text-[#E7EAEC]">
                      ENTITY DETAILS // {selectedVehicle.global_vehicle_id}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowDetailsPanel(false)}
                    className="text-[#929DA5] hover:text-[#E7EAEC] p-1"
                    title="Collapse Details Panel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
                  {/* Registration Plate Section (Phase 5) */}
                  <div className="p-2.5 rounded bg-[#0E1317] border border-[#30383E] space-y-2">
                    <div className="text-[10px] text-[#929DA5] uppercase font-bold flex items-center justify-between">
                      <span>VERIFIED REGISTRATION PLATE</span>
                      <span className="text-[9px] text-[#65D9E8]">DEMO LOCALIZATION</span>
                    </div>

                    <RegistrationPlateBadge
                      plateText={selectedVehicle.primary_plate}
                      plateConfidence={selectedVehicle.plate_confidence}
                      size="lg"
                      showConfidence={true}
                    />

                    <p className="text-[9px] text-[#929DA5]/70 leading-normal pt-1 border-t border-[#30383E]/50">
                      * Plate text derived from synthetic demo registry. Live perception model localizes plate bounding box region without running full OCR inference.
                    </p>
                  </div>

                  {/* Core Telemetry Key-Value Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-[#191F24] border border-[#30383E]">
                      <span className="text-[9px] text-[#929DA5] uppercase block">Vehicle Class</span>
                      <span className="font-bold text-[#E7EAEC] uppercase mt-0.5 block">
                        {selectedVehicle.vehicle_type || "Unknown"}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#191F24] border border-[#30383E]">
                      <span className="text-[9px] text-[#929DA5] uppercase block">Vehicle Color</span>
                      <span className="font-bold text-[#E7EAEC] uppercase mt-0.5 block">
                        {selectedVehicle.color_label || "Not recorded"}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#191F24] border border-[#30383E]">
                      <span className="text-[9px] text-[#929DA5] uppercase block">Journey Status</span>
                      <span className="font-bold text-[#52C99A] uppercase mt-0.5 block">
                        {selectedVehicle.cameras_visited.length > 1 ? "RECONSTRUCTED" : (selectedVehicle.identity_status || "CONFIRMED").toUpperCase()}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#191F24] border border-[#30383E]">
                      <span className="text-[9px] text-[#929DA5] uppercase block">Re-ID Confidence</span>
                      <span className="font-bold text-[#65D9E8] mt-0.5 block">
                        {selectedVehicle.association_confidence != null
                          ? `${(selectedVehicle.association_confidence * 100).toFixed(1)}%`
                          : "Not available"}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#191F24] border border-[#30383E]">
                      <span className="text-[9px] text-[#929DA5] uppercase block">First Observed</span>
                      <span className="text-[#E7EAEC] text-[10px] mt-0.5 block truncate">
                        {selectedVehicle.first_seen ? selectedVehicle.first_seen.replace("T", " ") : "Not recorded"}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#191F24] border border-[#30383E]">
                      <span className="text-[9px] text-[#929DA5] uppercase block">Last Observed</span>
                      <span className="text-[#E7EAEC] text-[10px] mt-0.5 block truncate">
                        {selectedVehicle.last_seen ? selectedVehicle.last_seen.replace("T", " ") : "Not recorded"}
                      </span>
                    </div>
                  </div>

                  {/* Reconstructed Camera Sequence (Clickable Hops) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#929DA5] font-bold uppercase">
                        CAMERA SEQUENCE ({selectedVehicle.cameras_visited.length} VISITED)
                      </span>
                      <span className="text-[#65D9E8]">{selectedVehicle.trajectory.length} HOPS</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {selectedVehicle.trajectory.map((hop, idx) => {
                        const isCurrent = idx === activeStep;
                        return (
                          <button
                            key={`cam-step-${idx}`}
                            onClick={() => {
                              setActiveStep(idx);
                              setSelectedCameraId(hop.camera_id);
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                              isCurrent
                                ? "bg-[#65D9E8] text-[#0A0D10] shadow-[0_0_8px_rgba(101,217,232,0.4)]"
                                : "bg-[#191F24] text-[#E7EAEC] border border-[#30383E] hover:border-[#65D9E8]"
                            }`}
                            title={`Jump to Hop #${hop.step} at ${hop.camera_id}`}
                          >
                            {hop.step}. {hop.camera_id}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Observation Evidence Section (Phase 8) */}
                  <div className="space-y-2 pt-2 border-t border-[#30383E]">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#929DA5] font-bold uppercase">
                        PERCEPTION EVIDENCE ({vehicleObservations.length} OBS)
                      </span>
                      <button
                        onClick={() => setEvidenceDrawerOpen(!evidenceDrawerOpen)}
                        className="text-[#65D9E8] hover:underline"
                      >
                        {evidenceDrawerOpen ? "HIDE OBS" : "VIEW OBS"}
                      </button>
                    </div>

                    {evidenceDrawerOpen && (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-[#30383E]/40 text-[10px]">
                        {vehicleObservations.map((obs) => (
                          <div
                            key={obs.observation_id}
                            onClick={() => setSelectedObsForModal(obs)}
                            className="pt-1.5 cursor-pointer hover:bg-[#191F24] p-1.5 rounded transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#E7EAEC]">{obs.observation_id}</span>
                              <span className="text-[#65D9E8]">{obs.camera_id}</span>
                            </div>
                            <div className="flex items-center justify-between text-[#929DA5] mt-0.5">
                              <span>Track #{obs.track_id}</span>
                              <span>{obs.timestamp ? obs.timestamp.slice(11, 19) : "No timestamp"}</span>
                            </div>
                            {obs.plate_text && (
                              <div className="mt-1 flex items-center gap-1.5 text-[9px] text-[#52C99A]">
                                <span>Plate: {obs.plate_text}</span>
                                {obs.plate_confidence && <span>({(obs.plate_confidence * 100).toFixed(0)}%)</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            ) : (
              <button
                onClick={() => setShowDetailsPanel(true)}
                className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-md border border-[#30383E] bg-[#111519]/90 px-2.5 py-1.5 text-xs font-mono text-[#E7EAEC] hover:border-[#65D9E8] transition-colors shadow-lg backdrop-blur-md"
              >
                <Shield className="w-3.5 h-3.5 text-[#65D9E8]" />
                <span>ENTITY DETAILS</span>
                <ChevronLeft className="w-3.5 h-3.5 text-[#929DA5]" />
              </button>
            )}
          </>
        )}

        {/* 6. BOTTOM DOCKED TIMELINE SCRUBBER (When vehicle selected) */}
        {selectedVehicle && selectedVehicle.trajectory.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 hidden md:flex items-center gap-2 rounded-lg border border-[#30383E] bg-[#111519]/95 backdrop-blur-md px-3 py-1.5 shadow-2xl font-mono text-xs">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1 rounded bg-[#191F24] hover:bg-[#65D9E8] hover:text-[#0A0D10] text-[#65D9E8] transition-colors"
              title={isPlaying ? "Pause Timeline Progression" : "Play Timeline Progression"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : selectedVehicle.trajectory.length - 1))}
              className="p-1 rounded bg-[#0E1317] text-[#929DA5] hover:text-[#E7EAEC]"
              title="Previous Hop"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setActiveStep((prev) => (prev + 1) % selectedVehicle.trajectory.length)}
              className="p-1 rounded bg-[#0E1317] text-[#929DA5] hover:text-[#E7EAEC]"
              title="Next Hop"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-[#30383E] mx-1" />

            <span className="text-[11px] font-bold text-[#E7EAEC]">
              HOP {activeStep + 1} / {selectedVehicle.trajectory.length}
            </span>
            <span className="text-[10px] text-[#65D9E8]">
              ({selectedVehicle.trajectory[activeStep]?.camera_id})
            </span>
          </div>
        )}
      </div>

      {/* Observation Evidence Modal Popup */}
      <EvidenceModal
        observation={selectedObsForModal}
        onClose={() => setSelectedObsForModal(null)}
      />
    </div>
  );
}
