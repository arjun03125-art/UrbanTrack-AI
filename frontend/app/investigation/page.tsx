"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ShieldAlert,
  Car,
  Camera,
  ArrowRight,
  GitFork,
  Radio,
  Clock,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Eye,
  Info,
  FileSearch,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { EvidenceModal } from "@/components/EvidenceModal";
import { EvidenceInspector } from "@/components/EvidenceInspector";
import { StatusBadge, normalizeStatus } from "@/components/StatusBadge";
import { RegistrationPlateBadge } from "@/components/RegistrationPlateBadge";
import { fetchVehicles, fetchVehicleObservations } from "@/lib/api";
import { GlobalVehicle, Observation } from "@/types";

export default function InvestigationPage() {
  const [vehicles, setVehicles] = useState<GlobalVehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicleSortBy, setVehicleSortBy] = useState<"id" | "observations" | "cameras" | "confidence">("id");
  const [vehicleSortOrder, setVehicleSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedVehicle, setSelectedVehicle] = useState<GlobalVehicle | null>(null);

  const [observations, setObservations] = useState<Observation[]>([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsSortBy, setObsSortBy] = useState<"id" | "camera" | "track" | "confidence">("id");
  const [obsSortOrder, setObsSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  const [selectedObsForModal, setSelectedObsForModal] = useState<Observation | null>(null);

  useEffect(() => {
    fetchVehicles().then((data) => {
      setVehicles(data);
      if (data.length > 0) setSelectedVehicle(data[0]);
    });
  }, []);

  useEffect(() => {
    if (!selectedVehicle) {
      setObservations([]);
      setSelectedObs(null);
      return;
    }
    setObsLoading(true);
    fetchVehicleObservations(selectedVehicle.global_vehicle_id)
      .then((obs) => {
        setObservations(obs);
        if (obs.length > 0) setSelectedObs(obs[0]);
        else setSelectedObs(null);
      })
      .catch(() => {
        setObservations([]);
        setSelectedObs(null);
      })
      .finally(() => setObsLoading(false));
  }, [selectedVehicle?.global_vehicle_id]);

  const filtered = useMemo(() => {
    const list = vehicles.filter(
      (v) =>
        v.global_vehicle_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.primary_plate && v.primary_plate.toLowerCase().includes(searchTerm.toLowerCase())) ||
        v.cameras_visited.some((c) => c.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    list.sort((a, b) => {
      let cmp = 0;
      if (vehicleSortBy === "observations") {
        cmp = (a.total_observations || 0) - (b.total_observations || 0);
      } else if (vehicleSortBy === "cameras") {
        cmp = (a.cameras_visited.length || 0) - (b.cameras_visited.length || 0);
      } else if (vehicleSortBy === "confidence") {
        cmp = (a.association_confidence ?? 0) - (b.association_confidence ?? 0);
      } else {
        cmp = a.global_vehicle_id.localeCompare(b.global_vehicle_id, undefined, { numeric: true });
      }
      return vehicleSortOrder === "asc" ? cmp : -cmp;
    });

    return list;
  }, [vehicles, searchTerm, vehicleSortBy, vehicleSortOrder]);

  const sortedObservations = useMemo(() => {
    const list = [...observations];
    list.sort((a, b) => {
      let cmp = 0;
      if (obsSortBy === "camera") {
        cmp = a.camera_id.localeCompare(b.camera_id, undefined, { numeric: true });
      } else if (obsSortBy === "track") {
        cmp = a.track_id - b.track_id;
      } else if (obsSortBy === "confidence") {
        cmp = (a.detection_confidence ?? 0) - (b.detection_confidence ?? 0);
      } else {
        cmp = a.observation_id.localeCompare(b.observation_id, undefined, { numeric: true });
      }
      return obsSortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  }, [observations, obsSortBy, obsSortOrder]);

  const handleObsSort = (column: "id" | "camera" | "track" | "confidence") => {
    if (obsSortBy === column) {
      setObsSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setObsSortBy(column);
      setObsSortOrder("asc");
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-4 font-mono select-none">
        {/* Header Banner */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-[#55D6E8]" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">
                VEHICLE FORENSICS &amp; EVIDENCE INVESTIGATION
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#080D14] text-[#34D399] border border-[#29384B]">
                INTEGRITY GUARANTEED
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Cross-camera evidence verification, observation bounding boxes, and sensor provenance.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#94A3B8]">INVESTIGATING:</span>
            <span className="font-bold text-[#55D6E8]">
              {selectedVehicle ? selectedVehicle.global_vehicle_id : "None"}
            </span>
          </div>
        </div>

        {/* 4-Step Forensic Workflow Guidance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
            <span className="text-[#55D6E8] font-bold block">1. RECORD QUERY</span>
            <span className="text-[11px] text-[#94A3B8] mt-0.5 block">Search ID, Plate or Visited Camera</span>
          </div>
          <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
            <span className="text-[#34D399] font-bold block">2. IDENTITY AUDIT</span>
            <span className="text-[11px] text-[#94A3B8] mt-0.5 block">Review Confirmed vs Candidate status</span>
          </div>
          <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
            <span className="text-[#FBBF24] font-bold block">3. LINEAGE CORRELATION</span>
            <span className="text-[11px] text-[#94A3B8] mt-0.5 block">Examine camera transitions &amp; hops</span>
          </div>
          <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
            <span className="text-[#8295FF] font-bold block">4. EVIDENCE VERIFICATION</span>
            <span className="text-[11px] text-[#94A3B8] mt-0.5 block">Audit bbox coordinates &amp; frame storage</span>
          </div>
        </div>

        {/* Coordinated Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column (8 cols): Search, Vehicle Details, Trajectory & Observation List */}
          <div className="lg:col-span-8 space-y-4">
            {/* Search & Sort Controls Bar */}
            <div className="bg-[#0D1420] border border-[#29384B] p-2.5 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Filter investigation vehicle (e.g. V023, KA01, CAM_A)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#111C2B] border border-[#29384B] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:border-[#55D6E8] outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={vehicleSortBy}
                  onChange={(e) => setVehicleSortBy(e.target.value as any)}
                  className="bg-[#111C2B] border border-[#29384B] rounded-lg px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:border-[#55D6E8] outline-none"
                >
                  <option value="id">Sort by ID</option>
                  <option value="observations">Sort by Obs Count</option>
                  <option value="cameras">Sort by Visited Cams</option>
                  <option value="confidence">Sort by Re-ID Conf</option>
                </select>

                <button
                  onClick={() => setVehicleSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  title={vehicleSortOrder === "asc" ? "Ascending order" : "Descending order"}
                  className="px-2 py-1.5 bg-[#111C2B] border border-[#29384B] hover:border-[#55D6E8] rounded-lg text-[#55D6E8] flex items-center gap-1 transition-colors"
                >
                  {vehicleSortOrder === "asc" ? (
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

            {/* Quick Vehicle Select Row */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filtered.map((v) => {
                const isSelected = selectedVehicle?.global_vehicle_id === v.global_vehicle_id;
                return (
                  <button
                    key={v.global_vehicle_id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold shrink-0 transition-colors flex items-center gap-2 ${
                      isSelected
                        ? "bg-[#172437] border-[#55D6E8] text-[#55D6E8]"
                        : "bg-[#0D1420] border-[#29384B] text-[#94A3B8] hover:text-[#F1F5F9]"
                    }`}
                  >
                    <span>{v.global_vehicle_id} · {v.vehicle_type}</span>
                    {v.primary_plate && (
                      <span className="px-1.5 py-0.2 rounded bg-[#0A0D10] text-[#65D9E8] font-mono text-[10px] border border-[#30383E]">
                        {v.primary_plate}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Vehicle Dossier Box */}
            {selectedVehicle && (
              <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#29384B]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#172437] border border-[#55D6E8]/40 flex items-center justify-center text-[#55D6E8]">
                      <Car className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#F1F5F9]">
                          {selectedVehicle.global_vehicle_id}
                        </span>
                        <StatusBadge
                          status={selectedVehicle.identity_status || "candidate"}
                          trackingType={selectedVehicle.tracking_type}
                          size="sm"
                        />
                      </div>
                      <span className="text-[10px] text-[#94A3B8]">
                        Visited: {selectedVehicle.cameras_visited.join(", ")}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/vehicles/${selectedVehicle.global_vehicle_id}`}
                    className="px-2.5 py-1 rounded bg-[#172437] text-[10px] text-[#55D6E8] hover:bg-[#55D6E8] hover:text-[#080D14] border border-[#55D6E8]/30 font-bold"
                  >
                    FULL RECORD DOSSIER →
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B] flex flex-col justify-between">
                    <span className="text-[9px] text-[#94A3B8] uppercase block mb-1">Registration Plate</span>
                    <RegistrationPlateBadge
                      plate={selectedVehicle.primary_plate}
                      confidence={selectedVehicle.plate_confidence}
                      size="sm"
                    />
                  </div>
                  <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B]">
                    <span className="text-[9px] text-[#94A3B8] uppercase block">Assoc Confidence</span>
                    <span className="font-bold text-xs text-[#34D399]">
                      {selectedVehicle.association_confidence != null
                        ? `${(selectedVehicle.association_confidence * 100).toFixed(1)}%`
                        : "Not provided"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B]">
                    <span className="text-[9px] text-[#94A3B8] uppercase block">Reported Obs</span>
                    <span className="font-bold text-xs text-[#55D6E8]">
                      {selectedVehicle.total_observations}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B]">
                    <span className="text-[9px] text-[#94A3B8] uppercase block">Loaded Obs Records</span>
                    <span className="font-bold text-xs text-[#34D399]">
                      {observations.length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Observations Table */}
            <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#29384B] text-xs">
                <span className="font-bold uppercase tracking-wider text-[#F1F5F9]">
                  SUPPORTING OBSERVATION EVIDENCE ({observations.length})
                </span>
                <span className="text-[10px] text-[#94A3B8]">
                  Click row to inspect in right dossier
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#29384B] text-[10px] text-[#94A3B8] uppercase">
                      <th
                        onClick={() => handleObsSort("id")}
                        className="py-2 pr-2 cursor-pointer hover:text-[#55D6E8] select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Obs ID</span>
                          {obsSortBy === "id" ? (
                            obsSortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-[#55D6E8]" /> : <ArrowDown className="w-3 h-3 text-[#55D6E8]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleObsSort("camera")}
                        className="py-2 pr-2 cursor-pointer hover:text-[#55D6E8] select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Camera</span>
                          {obsSortBy === "camera" ? (
                            obsSortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-[#55D6E8]" /> : <ArrowDown className="w-3 h-3 text-[#55D6E8]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleObsSort("track")}
                        className="py-2 pr-2 cursor-pointer hover:text-[#55D6E8] select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Local Track</span>
                          {obsSortBy === "track" ? (
                            obsSortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-[#55D6E8]" /> : <ArrowDown className="w-3 h-3 text-[#55D6E8]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleObsSort("confidence")}
                        className="py-2 pr-2 cursor-pointer hover:text-[#55D6E8] select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Confidence</span>
                          {obsSortBy === "confidence" ? (
                            obsSortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-[#55D6E8]" /> : <ArrowDown className="w-3 h-3 text-[#55D6E8]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </div>
                      </th>
                      <th className="py-2 pr-2">BBox Vector</th>
                      <th className="py-2 pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#29384B]/40">
                    {sortedObservations.map((obs) => {
                      const isSel = selectedObs?.observation_id === obs.observation_id;
                      return (
                        <tr
                          key={obs.observation_id}
                          onClick={() => setSelectedObs(obs)}
                          className={`cursor-pointer hover:bg-[#0D1420] transition-colors ${
                            isSel ? "bg-[#172437]" : ""
                          }`}
                        >
                          <td className="py-2.5 pr-2 font-bold text-[#F1F5F9]">
                            {obs.observation_id}
                          </td>
                          <td className="py-2.5 pr-2 text-[#55D6E8]">{obs.camera_id}</td>
                          <td className="py-2.5 pr-2 text-[#94A3B8]">#{obs.track_id}</td>
                          <td className="py-2.5 pr-2 text-[#34D399]">
                            {obs.detection_confidence != null
                              ? `${(obs.detection_confidence * 100).toFixed(0)}%`
                              : "—"}
                          </td>
                          <td className="py-2.5 pr-2 text-[11px] text-[#94A3B8]">
                            {obs.bbox ? `[${obs.bbox.join(", ")}]` : "—"}
                          </td>
                          <td className="py-2.5 pr-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedObsForModal(obs);
                              }}
                              className="px-2 py-0.5 rounded bg-[#172437] hover:bg-[#55D6E8] hover:text-[#080D14] text-[#55D6E8] text-[10px] font-bold"
                            >
                              Frame
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {observations.length === 0 && !obsLoading && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[#94A3B8]">
                          No observation records linked to this vehicle in observations.json.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Evidence Inspector */}
          <div className="lg:col-span-4">
            <EvidenceInspector
              observation={selectedObs}
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
