"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Car,
  Camera,
  GitFork,
  ArrowLeft,
  Calendar,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Radio,
  FileText,
  AlertTriangle,
  RefreshCw,
  Eye,
  Info,
  ExternalLink,
  Film,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { fetchVehicleById, fetchVehicleObservations } from "@/lib/api";
import { GlobalVehicle, Observation } from "@/types";
import { StatusBadge, normalizeStatus } from "@/components/StatusBadge";
import { EvidenceModal } from "@/components/EvidenceModal";
import { EvidenceInspector } from "@/components/EvidenceInspector";
import { RegistrationPlateBadge } from "@/components/RegistrationPlateBadge";

function VehicleDetailContent() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.id as string;

  const [vehicle, setVehicle] = useState<GlobalVehicle | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Evidence modal and inspector state
  const [selectedObsForEvidence, setSelectedObsForEvidence] = useState<Observation | null>(null);

  useEffect(() => {
    if (!vehicleId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [vData, obsData] = await Promise.all([
          fetchVehicleById(vehicleId),
          fetchVehicleObservations(vehicleId),
        ]);
        setVehicle(vData);
        setObservations(obsData);
        if (obsData.length > 0) setSelectedObsForEvidence(obsData[0]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Vehicle not found";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [vehicleId]);

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-24 space-y-3 font-mono">
          <RefreshCw className="w-8 h-8 text-[#55D6E8] animate-spin" />
          <p className="text-[#94A3B8] text-xs">LOADING VEHICLE INTELLIGENCE DOSSIER...</p>
        </div>
      </DashboardShell>
    );
  }

  if (error || !vehicle) {
    return (
      <DashboardShell>
        <div className="p-8 text-center bg-[#111C2B] border border-[#29384B] rounded-xl max-w-lg mx-auto font-mono">
          <AlertTriangle className="w-10 h-10 text-[#F87171] mx-auto mb-3" />
          <h2 className="text-base font-bold text-[#F1F5F9] mb-1">Vehicle Record Not Found</h2>
          <p className="text-xs text-[#94A3B8] mb-6">
            {error || "No data exists in the active pipeline for this vehicle ID."}
          </p>
          <Link
            href="/vehicles"
            className="px-4 py-2 bg-[#172437] hover:bg-[#55D6E8] hover:text-[#080D14] text-[#55D6E8] border border-[#55D6E8]/30 rounded-lg text-xs font-semibold"
          >
            ← Return to Vehicle Records
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const status = normalizeStatus(vehicle.identity_status, vehicle.tracking_type);
  const totalSummaryObservations = vehicle.total_observations;
  const availableCount = observations.length;

  return (
    <DashboardShell>
      <div className="space-y-5 font-mono select-none">
        {/* Top Breadcrumb & Actions */}
        <div className="flex items-center justify-between text-xs">
          <Link
            href="/vehicles"
            className="flex items-center gap-1.5 text-[#94A3B8] hover:text-[#55D6E8] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO VEHICLE EXPLORER</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-1.5 rounded bg-[#111C2B] border border-[#29384B] hover:border-[#55D6E8] text-[#55D6E8] transition-colors"
            >
              VIEW IN WORKSPACE CANVAS
            </Link>
          </div>
        </div>

        {/* Dossier Header Card */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#29384B]">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#172437] border border-[#55D6E8]/40 flex items-center justify-center text-[#55D6E8]">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-[#F1F5F9]">
                      DOSSIER: {vehicle.global_vehicle_id}
                    </h1>
                    <StatusBadge status={status} />
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Class: <strong className="text-[#F1F5F9]">{vehicle.vehicle_type}</strong> · Observed across {vehicle.cameras_visited.length} camera nodes
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="px-3 py-2 rounded bg-[#080D14] border border-[#29384B] text-right">
                <span className="text-[10px] text-[#94A3B8] uppercase block">Association Probability</span>
                <span className="font-bold text-[#34D399] text-sm">
                  {vehicle.association_confidence != null
                    ? `${(vehicle.association_confidence * 100).toFixed(1)}%`
                    : "Not calculated"}
                </span>
              </div>
            </div>
          </div>

          {/* Core Metric Distinctions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block mb-1">License Plate</span>
              <RegistrationPlateBadge
                plateText={vehicle.primary_plate}
                plateConfidence={vehicle.plate_confidence}
                size="md"
                showConfidence={true}
              />
            </div>

            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block">Observations (Loaded / Reported)</span>
              <span className="font-bold text-xs text-[#55D6E8] mt-0.5 block">
                {availableCount} <span className="text-[#94A3B8] font-normal">/ {totalSummaryObservations}</span>
              </span>
            </div>

            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block">First Observed</span>
              <span className="font-bold text-xs text-[#F1F5F9] mt-0.5 block truncate">
                {vehicle.first_seen ? vehicle.first_seen.replace("T", " ").replace("Z", " UTC") : "—"}
              </span>
            </div>

            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block">Last Observed</span>
              <span className="font-bold text-xs text-[#F1F5F9] mt-0.5 block truncate">
                {vehicle.last_seen ? vehicle.last_seen.replace("T", " ").replace("Z", " UTC") : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Coordinated Two-Column Layout: Left (Trajectory & Obs Table) + Right (Evidence Inspector) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (8 cols): Trajectory sequence + Observations Table */}
          <div className="lg:col-span-8 space-y-4">
            {/* Trajectory Hops Sequence */}
            <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#29384B] text-xs">
                <span className="font-bold uppercase tracking-wider text-[#F1F5F9]">
                  RECONSTRUCTED CAMERA SEQUENCE ({vehicle.trajectory.length} HOPS)
                </span>
                <span className="text-[10px] text-[#94A3B8]">Ordered by observation timestamp</span>
              </div>

              <div className="space-y-2">
                {vehicle.trajectory.map((step) => (
                  <div
                    key={`step-${step.step}`}
                    className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#172437] text-[#55D6E8] flex items-center justify-center font-bold text-[10px]">
                          {step.step}
                        </span>
                        <span className="font-bold text-[#F1F5F9]">{step.camera_id}</span>
                        <span className="text-[10px] text-[#94A3B8]">Track #{step.track_id}</span>
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-1">
                        {step.timestamp ? step.timestamp.replace("T", " ").replace("Z", " UTC") : "No timestamp recorded"}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const target = observations.find(
                          (o) =>
                            (step.observation_id && o.observation_id === step.observation_id) ||
                            (o.camera_id === step.camera_id && o.track_id === step.track_id)
                        );
                        if (target) setSelectedObsForEvidence(target);
                      }}
                      className="px-2.5 py-1 rounded bg-[#172437] hover:bg-[#55D6E8] hover:text-[#080D14] text-[#55D6E8] text-[10px] font-bold transition-colors"
                    >
                      INSPECT EVIDENCE
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Observations Table */}
            <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#29384B] text-xs">
                <span className="font-bold uppercase tracking-wider text-[#F1F5F9]">
                  ALL SUPPORTING OBSERVATION RECORDS ({observations.length})
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#29384B] text-[10px] text-[#94A3B8] uppercase">
                      <th className="py-2 pr-2">Obs ID</th>
                      <th className="py-2 pr-2">Camera</th>
                      <th className="py-2 pr-2">Track</th>
                      <th className="py-2 pr-2">Timestamp</th>
                      <th className="py-2 pr-2">Confidence</th>
                      <th className="py-2 pr-2">Plate OCR</th>
                      <th className="py-2 pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#29384B]/40">
                    {observations.map((obs) => (
                      <tr
                        key={obs.observation_id}
                        className={`hover:bg-[#0D1420] ${
                          selectedObsForEvidence?.observation_id === obs.observation_id
                            ? "bg-[#172437]/60"
                            : ""
                        }`}
                      >
                        <td className="py-2.5 pr-2 font-bold text-[#F1F5F9]">{obs.observation_id}</td>
                        <td className="py-2.5 pr-2 text-[#55D6E8]">{obs.camera_id}</td>
                        <td className="py-2.5 pr-2 text-[#94A3B8]">#{obs.track_id}</td>
                        <td className="py-2.5 pr-2 text-[#94A3B8]">
                          {obs.timestamp ? obs.timestamp.slice(11, 19) : "—"}
                        </td>
                        <td className="py-2.5 pr-2 text-[#34D399]">
                          {obs.detection_confidence != null
                            ? `${(obs.detection_confidence * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="py-2.5 pr-2 text-[#F1F5F9]">{obs.plate_text || "—"}</td>
                        <td className="py-2.5 pr-2">
                          <button
                            onClick={() => setSelectedObsForEvidence(obs)}
                            className="px-2 py-0.5 rounded bg-[#172437] text-[10px] text-[#55D6E8] hover:bg-[#55D6E8] hover:text-[#080D14]"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Evidence Inspector */}
          <div className="lg:col-span-4">
            <EvidenceInspector
              observation={selectedObsForEvidence}
              vehicle={vehicle}
            />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function VehicleDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080D14] flex items-center justify-center text-[#55D6E8] font-mono text-xs">
          LOADING DOSSIER...
        </div>
      }
    >
      <VehicleDetailContent />
    </Suspense>
  );
}
