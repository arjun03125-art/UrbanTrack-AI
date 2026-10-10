"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  GitFork,
  Car,
  Camera as CameraIcon,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Compass,
  AlertCircle,
  Info,
  CheckCircle2,
  Map as MapIcon,
  Box,
  Columns,
  Sliders,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Layers,
  Maximize2,
  Minimize2,
  Scan,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Clock,
  Radio,
  FileSearch,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import {
  fetchVehicles,
  fetchCameras,
  fetchCameraNetwork,
  fetchVehicleObservations,
} from "@/lib/api";
import { GlobalVehicle, Camera, CameraNetwork, Observation } from "@/types";
import { StatusBadge, normalizeStatus } from "@/components/StatusBadge";
import { RegistrationPlateBadge } from "@/components/RegistrationPlateBadge";
import { TopologicalNetworkGraph } from "@/components/TopologicalNetworkGraph";
import { EvidenceInspector } from "@/components/EvidenceInspector";
import { EvidenceModal } from "@/components/EvidenceModal";

// Dynamically import Leaflet MapView with SSR disabled
const MapView = dynamic(() => import("@/components/ut/MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full min-h-[440px] flex items-center justify-center bg-[#080D14] text-[#94A3B8] font-mono text-xs">
      <RefreshCw className="w-5 h-5 animate-spin text-[#55D6E8] mr-2" />
      LOADING GEOGRAPHIC RECONSTRUCTION MAP...
    </div>
  ),
});

// Dynamically import Three.js Scene3D with SSR disabled
const Scene3D = dynamic(() => import("@/components/ut/Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full min-h-[440px] flex items-center justify-center bg-[#080D14] text-[#94A3B8] font-mono text-xs">
      <RefreshCw className="w-5 h-5 animate-spin text-[#55D6E8] mr-2" />
      INITIALIZING 3D SPATIAL DIGITAL TWIN...
    </div>
  ),
});

function formatTimestamp(ts?: string | null): string {
  if (!ts) return "Not available";
  try {
    return ts.replace("T", " ").replace("Z", " UTC");
  } catch {
    return ts;
  }
}

export default function TrajectoriesPage() {
  const [vehicles, setVehicles] = useState<GlobalVehicle[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [network, setNetwork] = useState<CameraNetwork | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"map" | "topological" | "3d">("map");

  // Full-Screen Trajectory Workspace State (Objective 1)
  const [isFullScreen, setIsFullScreen] = useState<boolean>(true);

  // Route-focused mode: Selected Route Only vs Show All Cameras (Objective 5)
  const [showAllCameras, setShowAllCameras] = useState<boolean>(false);

  // Trajectory Info Panel collapse state (Objective 6)
  const [showJourneyDetails, setShowJourneyDetails] = useState<boolean>(true);

  // Trigger to force map fit route
  const [fitTrigger, setFitTrigger] = useState<number>(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedObsForModal, setSelectedObsForModal] = useState<Observation | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [vData, cData, nData] = await Promise.all([
        fetchVehicles(),
        fetchCameras(),
        fetchCameraNetwork().catch(() => null),
      ]);
      setVehicles(vData);
      setCameras(cData);
      setNetwork(nData);

      // Select first vehicle with multiple hops by default
      const candidate = vData.find((v) => v.trajectory && v.trajectory.length > 1) || vData[0];
      if (candidate) {
        setSelectedVehicleId(candidate.global_vehicle_id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load trajectory data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.global_vehicle_id === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  // Load observations when selected vehicle changes
  useEffect(() => {
    if (!selectedVehicleId) {
      setObservations([]);
      return;
    }
    fetchVehicleObservations(selectedVehicleId)
      .then((obs) => setObservations(obs))
      .catch(() => setObservations([]));
    setActiveStepIndex(0);
    setFitTrigger((prev) => prev + 1);
  }, [selectedVehicleId]);

  // Trajectory playback timer
  useEffect(() => {
    if (!isPlaying || !selectedVehicle || selectedVehicle.trajectory.length <= 1) return;
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % selectedVehicle.trajectory.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [isPlaying, selectedVehicle]);

  // Active step observation
  const currentStepObs = useMemo(() => {
    if (!selectedVehicle || !selectedVehicle.trajectory[activeStepIndex]) return null;
    const step = selectedVehicle.trajectory[activeStepIndex];
    return (
      observations.find(
        (o) =>
          (step.observation_id && o.observation_id === step.observation_id) ||
          (o.camera_id === step.camera_id && o.track_id === step.track_id)
      ) || (observations.length > 0 ? observations[0] : null)
    );
  }, [selectedVehicle, activeStepIndex, observations]);

  // Sorted vehicles for clean selector
  const sortedVehicles = useMemo(() => {
    return [...vehicles].sort((a, b) =>
      a.global_vehicle_id.localeCompare(b.global_vehicle_id, undefined, { numeric: true })
    );
  }, [vehicles]);

  const multiHopVehicles = useMemo(() => {
    return vehicles.filter((v) => v.trajectory && v.trajectory.length > 1);
  }, [vehicles]);

  const handleVehicleSelect = useCallback((vehId: string) => {
    setSelectedVehicleId(vehId);
    setActiveStepIndex(0);
    setFitTrigger((prev) => prev + 1);
  }, []);

  const handleFitRoute = useCallback(() => {
    setFitTrigger((prev) => prev + 1);
  }, []);

  // -------------------------------------------------------------
  // OBJECTIVE 1 & FULL-SCREEN WORKSPACE RENDER
  // -------------------------------------------------------------
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#080D14] flex flex-col font-mono text-[#F1F5F9] select-none overflow-hidden">
        {/* Minimal Top Header Bar (Objective 1, Item 3) */}
        <header className="h-13 bg-[#0D1420] border-b border-[#29384B] px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-20">
          {/* Left: Back Button + Title */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="px-2.5 py-1.5 rounded-lg bg-[#111C2B] hover:bg-[#172437] text-[#55D6E8] border border-[#29384B] hover:border-[#55D6E8] flex items-center gap-1.5 text-xs font-bold transition-colors"
              title="Return to Main Workspace"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">DASHBOARD</span>
            </Link>

            <div className="h-4 w-[1px] bg-[#29384B] hidden sm:block" />

            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-[#55D6E8]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9] hidden md:inline">
                TRAJECTORY RECONSTRUCTION MAP
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111C2B] border border-[#29384B] text-[#34D399] font-bold">
                FULL-SCREEN
              </span>
            </div>
          </div>

          {/* Center: Compact Vehicle Selector (Objective 4) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#111C2B] border border-[#29384B] px-2.5 py-1 rounded-lg">
              <Car className="w-3.5 h-3.5 text-[#55D6E8]" />
              <span className="text-[10px] text-[#94A3B8] uppercase">VEHICLE:</span>
              <select
                value={selectedVehicleId || ""}
                onChange={(e) => handleVehicleSelect(e.target.value)}
                className="bg-transparent text-[#F1F5F9] font-bold text-xs focus:outline-none cursor-pointer"
              >
                {sortedVehicles.map((v) => (
                  <option key={v.global_vehicle_id} value={v.global_vehicle_id} className="bg-[#111C2B]">
                    {v.global_vehicle_id} · {v.vehicle_type} {v.primary_plate ? `· [${v.primary_plate}]` : ""} ({v.trajectory.length} hops)
                  </option>
                ))}
              </select>
            </div>

            {selectedVehicle && (
              <StatusBadge
                status={selectedVehicle.identity_status || "candidate"}
                trackingType={selectedVehicle.tracking_type}
                size="sm"
              />
            )}
          </div>

          {/* Right: Controls & Toggles (Objectives 5, 7) */}
          <div className="flex items-center gap-1.5 text-xs">
            {/* View Mode Toggle: Map vs Topological */}
            <div className="hidden lg:flex items-center gap-1 bg-[#111C2B] p-0.5 rounded-lg border border-[#29384B] text-[10px]">
              <button
                onClick={() => setViewMode("map")}
                className={`px-2 py-1 rounded transition-colors ${
                  viewMode === "map"
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
                title="Geographic Map View"
              >
                MAP
              </button>
              <button
                onClick={() => setViewMode("topological")}
                className={`px-2 py-1 rounded transition-colors ${
                  viewMode === "topological"
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
                title="Topological Graph View"
              >
                TOPOLOGY
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`px-2 py-1 rounded transition-colors ${
                  viewMode === "3d"
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
                title="3D Urban Digital Twin Simulation"
              >
                3D TWIN
              </button>
            </div>

            {/* Route Mode Toggle: [Selected Route Only] [Show All Cameras] (Objective 5) */}
            <div className="flex items-center gap-1 bg-[#111C2B] p-0.5 rounded-lg border border-[#29384B] text-[10px]">
              <button
                onClick={() => setShowAllCameras(false)}
                className={`px-2 py-1 rounded transition-colors ${
                  !showAllCameras
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
                title="Show only the selected vehicle route"
              >
                Route Only
              </button>
              <button
                onClick={() => setShowAllCameras(true)}
                className={`px-2 py-1 rounded transition-colors ${
                  showAllCameras
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
                title="Show all cameras in overview mode"
              >
                All Cameras
              </button>
            </div>

            {/* Fit Route Button */}
            <button
              onClick={handleFitRoute}
              className="px-2 py-1.5 rounded-lg bg-[#111C2B] border border-[#29384B] hover:border-[#55D6E8] text-[#55D6E8] text-[10px] font-bold flex items-center gap-1 transition-colors"
              title="Fit selected trajectory to screen"
            >
              <Scan className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">FIT ROUTE</span>
            </button>

            {/* Show/Hide Details Button */}
            <button
              onClick={() => setShowJourneyDetails(!showJourneyDetails)}
              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-colors ${
                showJourneyDetails
                  ? "bg-[#172437] border-[#55D6E8] text-[#55D6E8]"
                  : "bg-[#111C2B] border-[#29384B] text-[#94A3B8] hover:text-[#F1F5F9]"
              }`}
              title={showJourneyDetails ? "Hide Journey Details" : "Show Journey Details"}
            >
              {showJourneyDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline">DETAILS</span>
            </button>

            {/* Exit Full-Screen Control */}
            <button
              onClick={() => setIsFullScreen(false)}
              className="px-2.5 py-1.5 rounded-lg bg-[#172437] hover:bg-[#55D6E8] hover:text-[#080D14] text-[#55D6E8] border border-[#55D6E8]/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Exit Full-Screen Workspace"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">EXIT FULL-SCREEN</span>
            </button>
          </div>
        </header>

        {/* Full-Screen Workspace Map Canvas */}
        <div className="flex-1 w-full relative overflow-hidden">
          {viewMode === "map" ? (
            <MapView
              cameras={cameras}
              network={network}
              vehicle={selectedVehicle}
              step={activeStepIndex}
              onStep={(s) => setActiveStepIndex(s)}
              selectedCamera={selectedVehicle?.trajectory[activeStepIndex]?.camera_id || null}
              onSelectCamera={() => {}}
              showAllCameras={showAllCameras}
              onToggleShowAllCameras={setShowAllCameras}
              isFullScreen={true}
              onToggleFullScreen={() => setIsFullScreen(false)}
              fitTrigger={fitTrigger}
            />
          ) : viewMode === "topological" ? (
            <div className="w-full h-full p-4 overflow-auto bg-[#080D14]">
              <TopologicalNetworkGraph
                cameras={cameras}
                network={network}
                selectedVehicle={selectedVehicle}
                activeStepIndex={activeStepIndex}
                height={720}
              />
            </div>
          ) : (
            <div className="w-full h-full relative overflow-hidden bg-[#070b14]">
              <Scene3D
                cameras={cameras}
                network={network}
                vehicle={selectedVehicle}
                step={activeStepIndex}
                onStep={(s) => setActiveStepIndex(s)}
                selectedCameraId={selectedVehicle?.trajectory[activeStepIndex]?.camera_id || null}
              />
            </div>
          )}

          {/* Floating Collapsible Trajectory Information Panel (Objective 6) */}
          {selectedVehicle && (
            <aside
              className={`absolute top-3 left-3 z-[450] max-w-sm w-[92vw] sm:w-[380px] bg-[#111C2B]/95 border border-[#29384B] rounded-xl shadow-2xl backdrop-blur-md transition-all duration-200 overflow-hidden ${
                showJourneyDetails ? "max-h-[85vh] opacity-100" : "max-h-11 opacity-90"
              }`}
            >
              {/* Panel Header */}
              <div
                onClick={() => setShowJourneyDetails(!showJourneyDetails)}
                className="p-3 bg-[#0D1420] border-b border-[#29384B] flex items-center justify-between cursor-pointer hover:bg-[#172437]/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#F1F5F9]">
                    {selectedVehicle.global_vehicle_id}
                  </span>
                  <span className="text-[10px] text-[#55D6E8]">
                    · {selectedVehicle.vehicle_type || "Vehicle"}
                  </span>
                  <StatusBadge
                    status={selectedVehicle.identity_status || "candidate"}
                    trackingType={selectedVehicle.tracking_type}
                    size="sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#94A3B8]">
                    {selectedVehicle.trajectory.length} Hops
                  </span>
                  {showJourneyDetails ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
                  )}
                </div>
              </div>

              {/* Panel Content (Actual Values from Data, No Fabrication) */}
              {showJourneyDetails && (
                <div className="p-3.5 space-y-3 overflow-y-auto max-h-[calc(85vh-50px)] text-xs">
                  {/* Facts Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-[#080D14] border border-[#29384B] flex flex-col justify-between">
                      <span className="text-[9px] text-[#94A3B8] uppercase block mb-1">Registration Plate</span>
                      <RegistrationPlateBadge
                        plate={selectedVehicle.primary_plate}
                        confidence={selectedVehicle.plate_confidence}
                        size="sm"
                      />
                    </div>

                    <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
                      <span className="text-[9px] text-[#94A3B8] uppercase block">Journey Status</span>
                      <span className="font-bold text-[#34D399] mt-0.5 block capitalize truncate">
                        {selectedVehicle.identity_status || "Not available"}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
                      <span className="text-[9px] text-[#94A3B8] uppercase block">First Observed</span>
                      <span className="font-medium text-[#F1F5F9] mt-0.5 block truncate">
                        {formatTimestamp(selectedVehicle.first_seen)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
                      <span className="text-[9px] text-[#94A3B8] uppercase block">Last Observed</span>
                      <span className="font-medium text-[#F1F5F9] mt-0.5 block truncate">
                        {formatTimestamp(selectedVehicle.last_seen)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
                      <span className="text-[9px] text-[#94A3B8] uppercase block">Cameras Visited</span>
                      <span className="font-bold text-[#55D6E8] mt-0.5 block">
                        {selectedVehicle.cameras_visited.length} Sensor Nodes
                      </span>
                    </div>

                    <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
                      <span className="text-[9px] text-[#94A3B8] uppercase block">Evidence Records</span>
                      <span className="font-bold text-[#34D399] mt-0.5 block">
                        {observations.length > 0 ? `${observations.length} Frames` : `${selectedVehicle.total_observations} Obs`}
                      </span>
                    </div>
                  </div>

                  {/* Reconstructed Camera Sequence (Objective 2) */}
                  <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
                      <span className="font-bold uppercase tracking-wider">RECONSTRUCTED SEQUENCE</span>
                      <span>Click hop to inspect</span>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin">
                      {selectedVehicle.trajectory.map((hop, idx) => {
                        const isCur = idx === activeStepIndex;
                        return (
                          <React.Fragment key={`seq-hop-${idx}`}>
                            <button
                              onClick={() => setActiveStepIndex(idx)}
                              className={`px-2 py-1 rounded text-[11px] font-bold shrink-0 transition-colors ${
                                isCur
                                  ? "bg-[#55D6E8] text-[#080D14] shadow-[0_0_8px_#55D6E8]"
                                  : "bg-[#111C2B] border border-[#29384B] text-[#94A3B8] hover:text-[#F1F5F9]"
                              }`}
                              title={`Hop #${hop.step}: ${hop.camera_id} (${hop.timestamp || "No time"})`}
                            >
                              {hop.camera_id}
                            </button>
                            {idx < selectedVehicle.trajectory.length - 1 && (
                              <span className="text-[#55D6E8] text-xs font-bold shrink-0">→</span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Step Observation Link */}
                  {currentStepObs && (
                    <div className="p-2.5 rounded bg-[#172437]/70 border border-[#55D6E8]/30 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-[#55D6E8] font-bold">
                          Hop #{activeStepIndex + 1}: {selectedVehicle.trajectory[activeStepIndex]?.camera_id}
                        </span>
                        <span className="text-[#94A3B8] block text-[10px]">
                          Obs #{currentStepObs.observation_id} · Track #{currentStepObs.track_id}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedObsForModal(currentStepObs)}
                        className="px-2 py-1 rounded bg-[#55D6E8] text-[#080D14] text-[10px] font-bold hover:bg-white transition-colors"
                      >
                        VIEW FRAME
                      </button>
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}

          {/* Floating Timeline Scrubber & Playback Controller (Docked Bottom-Center) */}
          {selectedVehicle && selectedVehicle.trajectory.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[450] max-w-xl w-[92vw] sm:w-[540px] bg-[#0D1420]/95 border border-[#29384B] rounded-xl p-2.5 shadow-2xl backdrop-blur-md space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-1.5 rounded-lg bg-[#172437] hover:bg-[#55D6E8] hover:text-[#080D14] text-[#55D6E8] transition-colors"
                    title={isPlaying ? "Pause timeline playback" : "Play timeline playback"}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() =>
                      setActiveStepIndex((prev) =>
                        prev > 0 ? prev - 1 : selectedVehicle.trajectory.length - 1
                      )
                    }
                    className="p-1 rounded bg-[#111C2B] text-[#94A3B8] hover:text-[#F1F5F9]"
                    title="Previous Hop"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() =>
                      setActiveStepIndex((prev) => (prev + 1) % selectedVehicle.trajectory.length)
                    }
                    className="p-1 rounded bg-[#111C2B] text-[#94A3B8] hover:text-[#F1F5F9]"
                    title="Next Hop"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-bold text-[#F1F5F9] text-xs">
                    HOP {activeStepIndex + 1} OF {selectedVehicle.trajectory.length}
                  </span>
                </div>

                <span className="text-[10px] text-[#55D6E8] font-bold">
                  {selectedVehicle.trajectory[activeStepIndex]?.timestamp
                    ? selectedVehicle.trajectory[activeStepIndex]?.timestamp?.slice(11, 19)
                    : "No timestamp"}
                </span>
              </div>

              {/* Hop Step Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                {selectedVehicle.trajectory.map((hop, idx) => {
                  const isCur = idx === activeStepIndex;
                  return (
                    <button
                      key={`scrub-${idx}`}
                      onClick={() => setActiveStepIndex(idx)}
                      className={`px-2 py-1 rounded text-left shrink-0 transition-all ${
                        isCur
                          ? "bg-[#172437] border border-[#55D6E8] text-[#55D6E8] shadow-[0_0_10px_rgba(85,214,232,0.3)]"
                          : "bg-[#111C2B] border border-[#29384B] text-[#94A3B8] hover:border-[#55D6E8]/40"
                      }`}
                    >
                      <div className="text-[9px] font-bold">#{hop.step}</div>
                      <div className="text-[10px] truncate max-w-[70px] text-[#F1F5F9] font-medium">
                        {hop.camera_id}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal for Observation Evidence */}
        <EvidenceModal
          observation={selectedObsForModal}
          onClose={() => setSelectedObsForModal(null)}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // STANDARD VIEW MODE (Dashboard Layout when Exit Full-Screen)
  // -------------------------------------------------------------
  return (
    <DashboardShell>
      <div className="space-y-4 font-mono select-none">
        {/* Header Banner */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-[#55D6E8]" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">
                TRAJECTORY RECONSTRUCTION WORKSPACE
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#080D14] text-[#55D6E8] border border-[#29384B]">
                TEMPORAL CO-REGISTRATION
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Tracking observed transitions between camera fields-of-view without inventing synthetic coordinates.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded bg-[#0D1420] border border-[#29384B] text-[#94A3B8]">
              RECONSTRUCTED PATHS:{" "}
              <span className="font-bold text-[#34D399]">{multiHopVehicles.length}</span> / {vehicles.length}
            </div>

            {/* Expand Full-Screen Button */}
            <button
              onClick={() => setIsFullScreen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#172437] hover:bg-[#55D6E8] hover:text-[#080D14] text-[#55D6E8] border border-[#55D6E8]/40 font-bold flex items-center gap-1.5 transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>EXPAND FULL-SCREEN</span>
            </button>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="bg-[#0D1420] border border-[#29384B] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Vehicle Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#111C2B] border border-[#29384B] px-3 py-1.5 rounded-lg">
              <Car className="w-3.5 h-3.5 text-[#55D6E8]" />
              <span className="text-[11px] text-[#94A3B8]">SUBJECT:</span>
              <select
                value={selectedVehicleId || ""}
                onChange={(e) => handleVehicleSelect(e.target.value)}
                className="bg-transparent text-[#F1F5F9] font-bold text-xs focus:outline-none cursor-pointer"
              >
                {sortedVehicles.map((v) => (
                  <option key={v.global_vehicle_id} value={v.global_vehicle_id} className="bg-[#111C2B]">
                    {v.global_vehicle_id} · {v.vehicle_type} ({v.trajectory.length} hops)
                  </option>
                ))}
              </select>
            </div>

            {selectedVehicle && (
              <StatusBadge
                status={selectedVehicle.identity_status || "candidate"}
                trackingType={selectedVehicle.tracking_type}
                size="sm"
              />
            )}
          </div>

          {/* Mode Switchers */}
          <div className="flex items-center gap-2">
            {/* Route Mode Toggle */}
            <div className="flex items-center gap-1 bg-[#111C2B] p-1 rounded-lg border border-[#29384B] text-[11px]">
              <button
                onClick={() => setShowAllCameras(false)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  !showAllCameras
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                Route Only
              </button>
              <button
                onClick={() => setShowAllCameras(true)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  showAllCameras
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                All Cameras
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-[#111C2B] p-1 rounded-lg border border-[#29384B] text-xs">
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                  viewMode === "map"
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>MAP</span>
              </button>

              <button
                onClick={() => setViewMode("topological")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                  viewMode === "topological"
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>TOPOLOGY</span>
              </button>

              <button
                onClick={() => setViewMode("3d")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                  viewMode === "3d"
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D TWIN</span>
              </button>
            </div>
          </div>
        </div>

        {/* Central Layout: Visualization + Timeline Scrubber (Left 8 cols) & Evidence Inspector (Right 4 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <div className="xl:col-span-8 space-y-3">
            {/* Main Trajectory Canvas Box */}
            <div className="bg-[#111C2B] border border-[#29384B] rounded-xl overflow-hidden relative min-h-[460px] h-[520px]">
              {viewMode === "map" ? (
                <MapView
                  cameras={cameras}
                  network={network}
                  vehicle={selectedVehicle}
                  step={activeStepIndex}
                  onStep={(s) => setActiveStepIndex(s)}
                  selectedCamera={selectedVehicle?.trajectory[activeStepIndex]?.camera_id || null}
                  onSelectCamera={() => {}}
                  showAllCameras={showAllCameras}
                  onToggleShowAllCameras={setShowAllCameras}
                  isFullScreen={false}
                  onToggleFullScreen={() => setIsFullScreen(true)}
                  fitTrigger={fitTrigger}
                />
              ) : viewMode === "topological" ? (
                <TopologicalNetworkGraph
                  cameras={cameras}
                  network={network}
                  selectedVehicle={selectedVehicle}
                  activeStepIndex={activeStepIndex}
                  height={520}
                />
              ) : (
                <Scene3D
                  cameras={cameras}
                  network={network}
                  vehicle={selectedVehicle}
                  step={activeStepIndex}
                  onStep={(s) => setActiveStepIndex(s)}
                  selectedCameraId={selectedVehicle?.trajectory[activeStepIndex]?.camera_id || null}
                />
              )}
            </div>

            {/* Trajectory Scrubber & Observation Timeline */}
            {selectedVehicle && selectedVehicle.trajectory.length > 0 ? (
              <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-1.5 rounded bg-[#172437] hover:bg-[#55D6E8] hover:text-[#080D14] text-[#55D6E8] transition-colors"
                      title={isPlaying ? "Pause timeline" : "Play timeline"}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() =>
                        setActiveStepIndex((prev) =>
                          prev > 0 ? prev - 1 : selectedVehicle.trajectory.length - 1
                        )
                      }
                      className="p-1 rounded bg-[#0D1420] text-[#94A3B8] hover:text-[#F1F5F9]"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() =>
                        setActiveStepIndex(
                          (prev) => (prev + 1) % selectedVehicle.trajectory.length
                        )
                      }
                      className="p-1 rounded bg-[#0D1420] text-[#94A3B8] hover:text-[#F1F5F9]"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <span className="font-bold text-[#F1F5F9]">
                      TIMELINE SCRUBBER
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">
                      (Hop {activeStepIndex + 1} of {selectedVehicle.trajectory.length})
                    </span>
                  </div>

                  <span className="text-[10px] text-[#94A3B8]">
                    {selectedVehicle.trajectory[activeStepIndex]?.timestamp || "No timestamp"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                  {selectedVehicle.trajectory.map((hop, idx) => {
                    const isSelected = idx === activeStepIndex;
                    return (
                      <button
                        key={`std-hop-${idx}`}
                        onClick={() => setActiveStepIndex(idx)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "bg-[#172437] border-[#55D6E8] text-[#F1F5F9] shadow-[0_0_10px_rgba(85,214,232,0.2)]"
                            : "bg-[#0D1420] border-[#29384B] text-[#94A3B8] hover:border-[#55D6E8]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-[#55D6E8]">HOP #{hop.step}</span>
                          <span className="text-[9px] text-[#94A3B8]">#{hop.track_id}</span>
                        </div>
                        <div className="font-bold text-xs mt-0.5 truncate text-[#F1F5F9]">
                          {hop.camera_id}
                        </div>
                        <div className="text-[9px] text-[#94A3B8]/70 truncate mt-0.5">
                          {hop.timestamp ? hop.timestamp.slice(11, 19) : "—"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-6 text-center text-xs text-[#94A3B8]">
                No trajectory records exist for this vehicle.
              </div>
            )}
          </div>

          {/* Right Column: Evidence Inspector */}
          <div className="xl:col-span-4">
            <EvidenceInspector
              observation={currentStepObs}
              vehicle={selectedVehicle}
              onOpenMediaModal={(obs) => setSelectedObsForModal(obs)}
            />
          </div>
        </div>
      </div>

      <EvidenceModal
        observation={selectedObsForModal}
        onClose={() => setSelectedObsForModal(null)}
      />
    </DashboardShell>
  );
}
