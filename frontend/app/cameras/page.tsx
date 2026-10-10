"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Camera as CameraIcon,
  Activity,
  Wifi,
  Video,
  Eye,
  RefreshCw,
  TrendingUp,
  MapPin,
  Car,
  GitFork,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { fetchCameras, fetchCameraNetwork, fetchVehicles } from "@/lib/api";
import { Camera, CameraNetwork, GlobalVehicle } from "@/types";
import { TopologicalNetworkGraph } from "@/components/TopologicalNetworkGraph";
import { RegistrationPlateBadge } from "@/components/RegistrationPlateBadge";

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [network, setNetwork] = useState<CameraNetwork | null>(null);
  const [vehicles, setVehicles] = useState<GlobalVehicle[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"id" | "vehicles" | "observations" | "name" | "fps">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [coordFilter, setCoordFilter] = useState<"ALL" | "WGS84" | "NO_COORDS">("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cData, netData, vData] = await Promise.all([
        fetchCameras(),
        fetchCameraNetwork().catch(() => null),
        fetchVehicles().catch(() => []),
      ]);
      setCameras(cData);
      setNetwork(netData);
      setVehicles(vData);
      if (cData.length > 0 && !selectedCameraId) {
        setSelectedCameraId(cData[0].camera_id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load camera network";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedCamera = useMemo(() => {
    return cameras.find((c) => c.camera_id === selectedCameraId) || null;
  }, [cameras, selectedCameraId]);

  // Vehicles observed by selected camera
  const connectedVehicles = useMemo(() => {
    if (!selectedCameraId) return [];
    return vehicles.filter((v) => v.cameras_visited.includes(selectedCameraId));
  }, [vehicles, selectedCameraId]);

  // Outgoing and incoming flow edges for selected camera
  const cameraEdges = useMemo(() => {
    if (!network || !selectedCameraId) return { incoming: [], outgoing: [] };
    const incoming = network.edges.filter((e) => e.target === selectedCameraId);
    const outgoing = network.edges.filter((e) => e.source === selectedCameraId);
    return { incoming, outgoing };
  }, [network, selectedCameraId]);

  const filteredCameras = useMemo(() => {
    let list = cameras.filter((c) => {
      const s = search.toLowerCase().trim();
      const matchSearch =
        !s ||
        c.camera_id.toLowerCase().includes(s) ||
        (c.name && c.name.toLowerCase().includes(s)) ||
        (c.location_description && c.location_description.toLowerCase().includes(s));

      const hasCoords =
        typeof c.latitude === "number" &&
        typeof c.longitude === "number" &&
        !(c.latitude === 0 && c.longitude === 0);

      const matchCoord =
        coordFilter === "ALL" ||
        (coordFilter === "WGS84" && hasCoords) ||
        (coordFilter === "NO_COORDS" && !hasCoords);

      const matchStatus =
        statusFilter === "ALL" ||
        (c.status && c.status.toLowerCase() === statusFilter.toLowerCase());

      return matchSearch && matchCoord && matchStatus;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "vehicles") {
        cmp = (a.vehicles_observed || 0) - (b.vehicles_observed || 0);
      } else if (sortBy === "observations") {
        cmp = (a.total_observations || 0) - (b.total_observations || 0);
      } else if (sortBy === "name") {
        cmp = (a.name || a.camera_id).localeCompare(b.name || b.camera_id);
      } else if (sortBy === "fps") {
        cmp = (a.fps || 0) - (b.fps || 0);
      } else {
        // Natural sort by ID (handles SYN_CAM_001, SYN_CAM_010 etc.)
        cmp = a.camera_id.localeCompare(b.camera_id, undefined, { numeric: true });
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return list;
  }, [cameras, search, sortBy, sortOrder, coordFilter, statusFilter]);

  return (
    <DashboardShell>
      <div className="space-y-4 font-mono select-none">
        {/* Header Banner */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CameraIcon className="w-4 h-4 text-[#55D6E8]" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">
                CAMERA SENSOR NETWORK &amp; TOPOLOGY
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#080D14] text-[#55D6E8] border border-[#29384B]">
                {cameras.length} NODES
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Surveillance camera inventory, flow transitions, and verified spatial co-registration.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded bg-[#172437] border border-[#29384B] hover:border-[#55D6E8] text-[#55D6E8] flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>REFRESH</span>
            </button>
          </div>
        </div>

        {/* Coordinated Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column (7 cols): Camera Inventory Grid & Topological Graph */}
          <div className="lg:col-span-7 space-y-4">
            {/* Filter & Sort Toolbar */}
            <div className="bg-[#0D1420] border border-[#29384B] p-2.5 rounded-xl space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94A3B8]" />
                  <input
                    type="text"
                    placeholder="Search camera ID or location..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#111C2B] border border-[#29384B] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:border-[#55D6E8] outline-none"
                  />
                </div>

                {/* Sort By Dropdown */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-[#111C2B] border border-[#29384B] rounded-lg px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:border-[#55D6E8] outline-none"
                  >
                    <option value="id">Sort by ID</option>
                    <option value="vehicles">Sort by Vehicles Obs</option>
                    <option value="observations">Sort by Total Obs</option>
                    <option value="name">Sort by Name</option>
                    <option value="fps">Sort by FPS</option>
                  </select>

                  {/* Sort Direction Toggle */}
                  <button
                    onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                    title={sortOrder === "asc" ? "Ascending order (Click to switch to Descending)" : "Descending order (Click to switch to Ascending)"}
                    className="px-2 py-1.5 bg-[#111C2B] border border-[#29384B] hover:border-[#55D6E8] rounded-lg text-[#55D6E8] flex items-center gap-1 transition-colors"
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

              {/* Sub-filters row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#29384B]/40 text-[11px]">
                <div className="flex items-center gap-3 text-[#94A3B8]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase">Coords:</span>
                    <select
                      value={coordFilter}
                      onChange={(e) => setCoordFilter(e.target.value as any)}
                      className="bg-[#111C2B] border border-[#29384B] rounded px-1.5 py-0.5 text-[11px] text-[#F1F5F9] outline-none"
                    >
                      <option value="ALL">All Nodes</option>
                      <option value="WGS84">WGS84 Only</option>
                      <option value="NO_COORDS">No Coords</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-[#111C2B] border border-[#29384B] rounded px-1.5 py-0.5 text-[11px] text-[#F1F5F9] outline-none"
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>

                <span className="text-[10px] text-[#94A3B8]">
                  Showing <b className="text-[#55D6E8]">{filteredCameras.length}</b> of {cameras.length} Nodes
                </span>
              </div>
            </div>

            {/* Cameras Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredCameras.map((cam) => {
                const isSelected = cam.camera_id === selectedCameraId;
                const hasCoords =
                  typeof cam.latitude === "number" && typeof cam.longitude === "number";

                return (
                  <div
                    key={cam.camera_id}
                    onClick={() => setSelectedCameraId(cam.camera_id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#172437] border-[#55D6E8] shadow-[0_0_12px_rgba(85,214,232,0.15)]"
                        : "bg-[#111C2B] border-[#29384B] hover:border-[#55D6E8]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#29384B]/40">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#F1F5F9]">
                          {cam.camera_id}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            cam.status === "ACTIVE"
                              ? "bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/30"
                              : "bg-[#94A3B8]/10 text-[#94A3B8] border border-[#29384B]"
                          }`}
                        >
                          {cam.status || "UNKNOWN"}
                        </span>
                      </div>

                      <span className="text-[10px] text-[#55D6E8] font-bold">
                        {cam.vehicles_observed} VEH
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-[11px] text-[#94A3B8]">
                      <div className="text-[#F1F5F9] truncate font-medium">
                        {cam.name || cam.camera_id}
                      </div>
                      <div className="text-[10px] truncate text-[#94A3B8]/70">
                        {cam.location_description || "No location description"}
                      </div>
                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span>Obs Count: <b className="text-[#34D399]">{cam.total_observations}</b></span>
                        <span className={hasCoords ? "text-[#34D399]" : "text-[#FBBF24]"}>
                          {hasCoords ? "WGS84 Registered" : "No Coordinates"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Topological Graph Preview Box */}
            <div className="bg-[#111C2B] border border-[#29384B] rounded-xl overflow-hidden p-3 space-y-2">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-[#29384B]">
                <div className="flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-[#55D6E8]" />
                  <span className="font-bold text-[#F1F5F9]">
                    NETWORK TOPOLOGY &amp; FLOW EDGES
                  </span>
                </div>
                <span className="text-[10px] text-[#94A3B8]">
                  Derived from recorded trajectories
                </span>
              </div>

              <div className="h-[280px] rounded-lg overflow-hidden border border-[#29384B]">
                <TopologicalNetworkGraph
                  cameras={cameras}
                  network={network}
                  selectedVehicle={null}
                  selectedCameraId={selectedCameraId}
                  onSelectCamera={(id) => setSelectedCameraId(id)}
                  height={280}
                />
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Selected Camera Deep Dive */}
          <div className="lg:col-span-5 space-y-4">
            {selectedCamera ? (
              <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 space-y-4 shadow-xl">
                {/* Camera Dossier Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#29384B]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#172437] border border-[#55D6E8]/40 flex items-center justify-center text-[#55D6E8]">
                      <CameraIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#F1F5F9]">
                        {selectedCamera.camera_id}
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        {selectedCamera.name || selectedCamera.camera_id}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedCamera.status === "ACTIVE"
                        ? "bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/30"
                        : "bg-[#94A3B8]/10 text-[#94A3B8] border border-[#29384B]"
                    }`}
                  >
                    {selectedCamera.status}
                  </span>
                </div>

                {/* Metadata List */}
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B] space-y-1">
                    <span className="text-[10px] text-[#94A3B8] uppercase block">
                      Location Description
                    </span>
                    <span className="text-[#F1F5F9] font-medium block">
                      {selectedCamera.location_description || "Not available"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B]">
                      <span className="text-[9px] text-[#94A3B8] uppercase block">FPS</span>
                      <span className="font-bold text-xs text-[#F1F5F9] mt-0.5 block">
                        {selectedCamera.fps ? `${selectedCamera.fps} FPS` : "Not provided"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B]">
                      <span className="text-[9px] text-[#94A3B8] uppercase block">Spatial Coordinates</span>
                      <span className="font-bold text-[11px] text-[#55D6E8] mt-0.5 block truncate">
                        {selectedCamera.latitude && selectedCamera.longitude
                          ? `${selectedCamera.latitude.toFixed(4)}, ${selectedCamera.longitude.toFixed(4)}`
                          : "No Coordinates"}
                      </span>
                    </div>
                  </div>

                  {/* Flow Edges */}
                  <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B] space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                      TRANSITION FLOW RELATIONSHIPS
                    </span>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[#94A3B8] block text-[9px]">INCOMING FLOWS</span>
                        {cameraEdges.incoming.length > 0 ? (
                          cameraEdges.incoming.map((e, i) => (
                            <div key={i} className="text-[#34D399]">
                              {e.source} → {e.vehicle_flow_count} veh
                            </div>
                          ))
                        ) : (
                          <span className="text-[#94A3B8]/60 italic">None recorded</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[#94A3B8] block text-[9px]">OUTGOING FLOWS</span>
                        {cameraEdges.outgoing.length > 0 ? (
                          cameraEdges.outgoing.map((e, i) => (
                            <div key={i} className="text-[#55D6E8]">
                              → {e.target}: {e.vehicle_flow_count} veh
                            </div>
                          ))
                        ) : (
                          <span className="text-[#94A3B8]/60 italic">None recorded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Observed Vehicles */}
                  <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        OBSERVED VEHICLES ({connectedVehicles.length})
                      </span>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {connectedVehicles.map((v) => (
                        <Link
                          key={v.global_vehicle_id}
                          href={`/vehicles/${v.global_vehicle_id}`}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-[#172437] text-[11px] text-[#F1F5F9] transition-colors gap-2"
                        >
                          <span className="font-bold text-[#55D6E8] shrink-0">
                            {v.global_vehicle_id}
                          </span>
                          <span className="text-[#94A3B8] text-[10px] truncate">{v.vehicle_type}</span>
                          <RegistrationPlateBadge
                            plate={v.primary_plate}
                            confidence={v.plate_confidence}
                            size="sm"
                          />
                        </Link>
                      ))}

                      {connectedVehicles.length === 0 && (
                        <div className="text-[10px] text-[#94A3B8]/60 italic py-2">
                          No vehicles linked to this camera in loaded data.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-6 text-center text-xs text-[#94A3B8]">
                Select a camera node to inspect sensor details.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
