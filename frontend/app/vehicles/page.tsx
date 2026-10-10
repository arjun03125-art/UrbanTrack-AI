"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Car,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Camera,
  Layers,
  Clock,
  GitFork,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { fetchVehicles, fetchCameras, fetchVehicleObservations } from "@/lib/api";
import { GlobalVehicle, Camera as CameraType, Observation } from "@/types";
import { StatusBadge, normalizeStatus } from "@/components/StatusBadge";
import { EvidenceInspector } from "@/components/EvidenceInspector";
import { EvidenceModal } from "@/components/EvidenceModal";
import { RegistrationPlateBadge } from "@/components/RegistrationPlateBadge";

type TabType = "overview" | "trajectory" | "observations" | "associations";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<GlobalVehicle[]>([]);
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected vehicle & observations
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleObs, setSelectedVehicleObs] = useState<Observation[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Selected observation for Evidence Inspector / Modal
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  const [modalObs, setModalObs] = useState<Observation | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedCamera, setSelectedCamera] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [plateFilter, setPlateFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"id" | "observations" | "cameras" | "confidence" | "plate">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [vData, cData] = await Promise.all([fetchVehicles(), fetchCameras()]);
      setVehicles(vData);
      setCameras(cData);
      if (vData.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vData[0].global_vehicle_id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load vehicles";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch observations whenever selectedVehicleId changes
  useEffect(() => {
    if (!selectedVehicleId) {
      setSelectedVehicleObs([]);
      setSelectedObs(null);
      return;
    }
    let alive = true;
    fetchVehicleObservations(selectedVehicleId)
      .then((obs) => {
        if (alive) {
          setSelectedVehicleObs(obs);
          if (obs.length > 0) setSelectedObs(obs[0]);
          else setSelectedObs(null);
        }
      })
      .catch(() => {
        if (alive) {
          setSelectedVehicleObs([]);
          setSelectedObs(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [selectedVehicleId]);

  // Distinct vehicle types
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    vehicles.forEach((v) => {
      if (v.vehicle_type) types.add(v.vehicle_type);
    });
    return Array.from(types).sort();
  }, [vehicles]);

  // Filtered & sorted vehicle records
  const filteredVehicles = useMemo(() => {
    let list = vehicles.filter((v) => {
      const s = search.toLowerCase().trim();
      const matchSearch =
        !s ||
        v.global_vehicle_id.toLowerCase().includes(s) ||
        (v.primary_plate && v.primary_plate.toLowerCase().includes(s));

      const matchType =
        selectedType === "ALL" ||
        v.vehicle_type.toLowerCase() === selectedType.toLowerCase();

      const matchCam =
        selectedCamera === "ALL" || v.cameras_visited.includes(selectedCamera);

      const st = normalizeStatus(v.identity_status, v.tracking_type);
      const matchStatus = statusFilter === "ALL" || st === statusFilter;

      const matchPlate =
        plateFilter === "ALL" ||
        (plateFilter === "WITH_PLATE" && Boolean(v.primary_plate)) ||
        (plateFilter === "NO_PLATE" && !v.primary_plate);

      return matchSearch && matchType && matchCam && matchStatus && matchPlate;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "observations") {
        cmp = (a.total_observations || 0) - (b.total_observations || 0);
      } else if (sortBy === "cameras") {
        cmp = (a.cameras_visited.length || 0) - (b.cameras_visited.length || 0);
      } else if (sortBy === "confidence") {
        cmp = (a.association_confidence ?? 0) - (b.association_confidence ?? 0);
      } else if (sortBy === "plate") {
        cmp = (a.primary_plate || "").localeCompare(b.primary_plate || "");
      } else {
        cmp = a.global_vehicle_id.localeCompare(b.global_vehicle_id, undefined, { numeric: true });
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return list;
  }, [vehicles, search, selectedType, selectedCamera, statusFilter, plateFilter, sortBy, sortOrder]);

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.global_vehicle_id === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  return (
    <DashboardShell>
      <div className="space-y-4 font-mono select-none">
        {/* Top Header & Metrics Banner */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-[#55D6E8]" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">
                VEHICLE RECORDS EXPLORER
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#080D14] text-[#55D6E8] border border-[#29384B]">
                FORENSIC DOSSIERS
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Cross-camera identity clusters, localized license-plate regions, and single-camera observation lineage.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded bg-[#0D1420] border border-[#29384B] text-[#94A3B8]">
              MATCHING: <span className="font-bold text-[#F1F5F9]">{filteredVehicles.length}</span> / {vehicles.length}
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded bg-[#172437] border border-[#29384B] hover:border-[#55D6E8] text-[#55D6E8] flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>RELOAD</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-[#0D1420] border border-[#29384B] rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 text-xs">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search ID (e.g. V023) or Plate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#111C2B] border border-[#29384B] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:border-[#55D6E8] outline-none"
            />
          </div>

          {/* Vehicle Type */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-[#111C2B] border border-[#29384B] rounded-lg px-2 py-1.5 text-xs text-[#F1F5F9] focus:border-[#55D6E8] outline-none"
            >
              <option value="ALL">All Classes</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Camera Visited */}
          <div>
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="w-full bg-[#111C2B] border border-[#29384B] rounded-lg px-2 py-1.5 text-xs text-[#F1F5F9] focus:border-[#55D6E8] outline-none"
            >
              <option value="ALL">All Cameras</option>
              {cameras.map((c) => (
                <option key={c.camera_id} value={c.camera_id}>{c.camera_id}</option>
              ))}
            </select>
          </div>

          {/* Association Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#111C2B] border border-[#29384B] rounded-lg px-2 py-1.5 text-xs text-[#F1F5F9] focus:border-[#55D6E8] outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="candidate">Candidate</option>
              <option value="ambiguous">Ambiguous</option>
              <option value="single_camera">Single-Cam</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-[#111C2B] border border-[#29384B] rounded-lg px-2 py-1.5 text-xs text-[#F1F5F9] focus:border-[#55D6E8] outline-none"
            >
              <option value="id">Sort by ID</option>
              <option value="observations">Sort by Obs Count</option>
              <option value="cameras">Sort by Camera Count</option>
              <option value="confidence">Sort by Re-ID Conf</option>
              <option value="plate">Sort by Plate</option>
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              title={sortOrder === "asc" ? "Ascending order (Click to switch to Descending)" : "Descending order (Click to switch to Ascending)"}
              className="px-2 py-1.5 bg-[#111C2B] border border-[#29384B] hover:border-[#55D6E8] rounded-lg text-[#55D6E8] flex items-center gap-1 transition-colors shrink-0"
            >
              {sortOrder === "asc" ? (
                <>
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">ASC</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">DESC</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Three Coordinated Regions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Region: Compact Vehicle Records List (4 cols) */}
          <div className="lg:col-span-4 bg-[#111C2B] border border-[#29384B] rounded-xl overflow-hidden flex flex-col h-[640px]">
            <div className="px-3 py-2.5 bg-[#0D1420] border-b border-[#29384B] flex items-center justify-between text-xs">
              <span className="font-bold text-[#F1F5F9]">RECORDS ({filteredVehicles.length})</span>
              <span className="text-[10px] text-[#94A3B8]">Select row to inspect</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#29384B]/40">
              {filteredVehicles.map((v) => {
                const isSelected = v.global_vehicle_id === selectedVehicleId;
                const status = normalizeStatus(v.identity_status, v.tracking_type);

                return (
                  <div
                    key={v.global_vehicle_id}
                    onClick={() => setSelectedVehicleId(v.global_vehicle_id)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#172437] border-l-4 border-l-[#55D6E8]"
                        : "hover:bg-[#111C2B]/80 hover:bg-[#0D1420]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#F1F5F9]">
                          {v.global_vehicle_id}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">{v.vehicle_type}</span>
                      </div>
                      <StatusBadge status={status} size="sm" />
                    </div>

                    <div className="flex items-center justify-between text-[11px] mt-2 text-[#94A3B8]">
                      <div className="flex items-center gap-1">
                        <RegistrationPlateBadge
                          plateText={v.primary_plate}
                          plateConfidence={v.plate_confidence}
                          size="sm"
                          showConfidence={false}
                        />
                      </div>
                      <div>
                        Cams:{" "}
                        <span className="text-[#55D6E8] font-bold">
                          {v.cameras_visited.length}
                        </span>
                      </div>
                      <div>
                        Obs:{" "}
                        <span className="text-[#34D399] font-bold">
                          {v.total_observations}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredVehicles.length === 0 && (
                <div className="p-8 text-center text-xs text-[#94A3B8]">
                  No vehicle records match active filters.
                </div>
              )}
            </div>
          </div>

          {/* Center Region: Vehicle Investigation View (5 cols) */}
          <div className="lg:col-span-5 bg-[#111C2B] border border-[#29384B] rounded-xl overflow-hidden flex flex-col h-[640px]">
            {selectedVehicle ? (
              <>
                {/* Header & Tabs */}
                <div className="bg-[#0D1420] border-b border-[#29384B] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#F1F5F9]">
                          {selectedVehicle.global_vehicle_id}
                        </span>
                        <StatusBadge
                          status={selectedVehicle.identity_status || "candidate"}
                          trackingType={selectedVehicle.tracking_type}
                          size="sm"
                        />
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        {selectedVehicle.vehicle_type} · {selectedVehicle.cameras_visited.join(" → ")}
                      </div>
                    </div>

                    <Link
                      href={`/vehicles/${selectedVehicle.global_vehicle_id}`}
                      className="px-2.5 py-1 rounded bg-[#172437] hover:bg-[#55D6E8] hover:text-[#080D14] text-[#55D6E8] border border-[#55D6E8]/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <span>FULL DOSSIER</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-1 bg-[#111C2B] p-1 rounded-lg border border-[#29384B] text-[11px]">
                    <button
                      onClick={() => setActiveTab("overview")}
                      className={`flex-1 py-1 rounded text-center transition-colors ${
                        activeTab === "overview"
                          ? "bg-[#55D6E8] text-[#080D14] font-bold"
                          : "text-[#94A3B8] hover:text-[#F1F5F9]"
                      }`}
                    >
                      OVERVIEW
                    </button>
                    <button
                      onClick={() => setActiveTab("trajectory")}
                      className={`flex-1 py-1 rounded text-center transition-colors ${
                        activeTab === "trajectory"
                          ? "bg-[#55D6E8] text-[#080D14] font-bold"
                          : "text-[#94A3B8] hover:text-[#F1F5F9]"
                      }`}
                    >
                      TRAJECTORY ({selectedVehicle.trajectory.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("observations")}
                      className={`flex-1 py-1 rounded text-center transition-colors ${
                        activeTab === "observations"
                          ? "bg-[#55D6E8] text-[#080D14] font-bold"
                          : "text-[#94A3B8] hover:text-[#F1F5F9]"
                      }`}
                    >
                      OBSERVATIONS ({selectedVehicleObs.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("associations")}
                      className={`flex-1 py-1 rounded text-center transition-colors ${
                        activeTab === "associations"
                          ? "bg-[#55D6E8] text-[#080D14] font-bold"
                          : "text-[#94A3B8] hover:text-[#F1F5F9]"
                      }`}
                    >
                      ASSOCIATIONS
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4 text-xs space-y-4">
                  {/* OVERVIEW TAB */}
                  {activeTab === "overview" && (
                    <div className="space-y-4">
                      {/* Metric distinctions */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B]">
                          <span className="text-[10px] text-[#94A3B8] uppercase block">
                            Reported Observation Count
                          </span>
                          <span className="font-bold text-sm text-[#F1F5F9]">
                            {selectedVehicle.total_observations}
                          </span>
                          <span className="text-[9px] text-[#94A3B8]/70 block mt-0.5">
                            Pipeline summary claim
                          </span>
                        </div>

                        <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B]">
                          <span className="text-[10px] text-[#94A3B8] uppercase block">
                            Available Evidence Records
                          </span>
                          <span className="font-bold text-sm text-[#34D399]">
                            {selectedVehicleObs.length}
                          </span>
                          <span className="text-[9px] text-[#94A3B8]/70 block mt-0.5">
                            Loaded in observations.json
                          </span>
                        </div>

                        <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B]">
                          <span className="text-[10px] text-[#94A3B8] uppercase block">
                            Associated Cameras
                          </span>
                          <span className="font-bold text-sm text-[#55D6E8]">
                            {selectedVehicle.cameras_visited.length}
                          </span>
                          <span className="text-[9px] text-[#94A3B8]/70 block mt-0.5">
                            Distinct sensor nodes
                          </span>
                        </div>

                        <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B]">
                          <span className="text-[10px] text-[#94A3B8] uppercase block">
                            Association Confidence
                          </span>
                          <span className="font-bold text-sm text-[#FBBF24]">
                            {selectedVehicle.association_confidence != null
                              ? `${(selectedVehicle.association_confidence * 100).toFixed(1)}%`
                              : "Not provided"}
                          </span>
                          <span className="text-[9px] text-[#94A3B8]/70 block mt-0.5">
                            Re-ID match probability
                          </span>
                        </div>
                      </div>

                      {/* Lineage & Plate Info */}
                      <div className="p-3 rounded bg-[#080D14] border border-[#29384B] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[#94A3B8]">License Plate:</span>
                          <RegistrationPlateBadge
                            plateText={selectedVehicle.primary_plate}
                            plateConfidence={selectedVehicle.plate_confidence}
                            size="md"
                            showConfidence={true}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#94A3B8]">First Seen:</span>
                          <span className="text-[#F1F5F9]">
                            {selectedVehicle.first_seen ? selectedVehicle.first_seen.replace("T", " ").replace("Z", " UTC") : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#94A3B8]">Last Seen:</span>
                          <span className="text-[#F1F5F9]">
                            {selectedVehicle.last_seen ? selectedVehicle.last_seen.replace("T", " ").replace("Z", " UTC") : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TRAJECTORY TAB */}
                  {activeTab === "trajectory" && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-[#94A3B8] uppercase">
                        CHRONOLOGICAL CAMERA SEQUENCE
                      </div>
                      {selectedVehicle.trajectory.map((step) => (
                        <div
                          key={`step-${step.step}`}
                          className="p-2.5 rounded bg-[#080D14] border border-[#29384B] flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#55D6E8]">
                                STEP #{step.step}: {step.camera_id}
                              </span>
                              <span className="text-[10px] text-[#94A3B8]">
                                Track #{step.track_id}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#94A3B8] mt-0.5">
                              {step.timestamp ? step.timestamp.replace("T", " ").replace("Z", " UTC") : "No timestamp"}
                            </div>
                          </div>
                          {step.observation_id && (
                            <button
                              onClick={() => {
                                const found = selectedVehicleObs.find(
                                  (o) => o.observation_id === step.observation_id
                                );
                                if (found) setSelectedObs(found);
                              }}
                              className="px-2 py-1 rounded bg-[#172437] text-[#55D6E8] text-[10px] hover:bg-[#55D6E8] hover:text-[#080D14]"
                            >
                              INSPECT OBS
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* OBSERVATIONS TAB */}
                  {activeTab === "observations" && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-[#94A3B8] uppercase">
                        SUPPORTING EVIDENCE OBSERVATIONS ({selectedVehicleObs.length})
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#29384B] text-[10px] text-[#94A3B8] uppercase">
                              <th className="py-2 pr-2">Obs ID</th>
                              <th className="py-2 pr-2">Cam</th>
                              <th className="py-2 pr-2">Track</th>
                              <th className="py-2 pr-2">Conf</th>
                              <th className="py-2 pr-2">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#29384B]/40">
                            {selectedVehicleObs.map((obs) => (
                              <tr
                                key={obs.observation_id}
                                className={`hover:bg-[#080D14] ${
                                  selectedObs?.observation_id === obs.observation_id
                                    ? "bg-[#172437]/60"
                                    : ""
                                }`}
                              >
                                <td className="py-2 pr-2 font-bold text-[#F1F5F9]">
                                  {obs.observation_id}
                                </td>
                                <td className="py-2 pr-2 text-[#55D6E8]">{obs.camera_id}</td>
                                <td className="py-2 pr-2 text-[#94A3B8]">#{obs.track_id}</td>
                                <td className="py-2 pr-2 text-[#34D399]">
                                  {obs.detection_confidence != null
                                    ? `${(obs.detection_confidence * 100).toFixed(0)}%`
                                    : "—"}
                                </td>
                                <td className="py-2 pr-2">
                                  <button
                                    onClick={() => setSelectedObs(obs)}
                                    className="px-1.5 py-0.5 rounded bg-[#172437] text-[10px] text-[#55D6E8] hover:bg-[#55D6E8] hover:text-[#080D14]"
                                  >
                                    Inspect
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ASSOCIATIONS TAB */}
                  {activeTab === "associations" && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold text-[#94A3B8] uppercase">
                        LOCAL TRACKLET ASSOCIATIONS
                      </div>
                      {selectedVehicle.camera_local_associations.map((assoc, i) => (
                        <div
                          key={`assoc-${i}`}
                          className="p-2.5 rounded bg-[#080D14] border border-[#29384B] flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-[#55D6E8]">
                              {assoc.camera_id}
                            </span>{" "}
                            · Local Track #{assoc.track_id}
                          </div>
                          <div>
                            {assoc.confidence != null ? (
                              <span className="text-[#34D399] font-bold">
                                {(assoc.confidence * 100).toFixed(1)}% Conf
                              </span>
                            ) : (
                              <span className="text-[#94A3B8] italic">Unspecified</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-xs text-[#94A3B8]">
                Select a vehicle to open investigation view.
              </div>
            )}
          </div>

          {/* Right Region: Evidence Inspector (3 cols) */}
          <div className="lg:col-span-3">
            <EvidenceInspector
              observation={selectedObs}
              vehicle={selectedVehicle}
              onOpenMediaModal={(obs) => setModalObs(obs)}
            />
          </div>
        </div>
      </div>

      {/* Modal */}
      <EvidenceModal observation={modalObs} onClose={() => setModalObs(null)} />
    </DashboardShell>
  );
}
