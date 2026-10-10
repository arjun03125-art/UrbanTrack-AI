"use client";

import React, { useState, useEffect } from "react";
import {
  FileSearch,
  Camera,
  Layers,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Film,
  Image as ImageIcon,
  HelpCircle,
  Hash,
  Activity,
  X,
} from "lucide-react";
import { Observation, GlobalVehicle, EvidenceInfo } from "@/types";
import { fetchObservationEvidence } from "@/lib/api";
import { StatusBadge, normalizeStatus } from "./StatusBadge";
import { RegistrationPlateBadge } from "./RegistrationPlateBadge";

interface EvidenceInspectorProps {
  observation: Observation | null;
  vehicle?: GlobalVehicle | null;
  onClose?: () => void;
  onOpenMediaModal?: (obs: Observation) => void;
}

export function EvidenceInspector({
  observation,
  vehicle,
  onClose,
  onOpenMediaModal,
}: EvidenceInspectorProps) {
  const [evidence, setEvidence] = useState<EvidenceInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!observation) {
      setEvidence(null);
      return;
    }
    setLoading(true);
    fetchObservationEvidence(observation.observation_id)
      .then((data) => setEvidence(data))
      .catch(() => {
        setEvidence({
          observation_id: observation.observation_id,
          camera_id: observation.camera_id,
          frame_idx: observation.frame_idx,
          track_id: observation.track_id,
          bbox: observation.bbox,
          detection_confidence: observation.detection_confidence,
          plate_text: observation.plate_text,
          plate_confidence: observation.plate_confidence,
          frame_available: false,
          frame_url: null,
          video_available: false,
          video_url: null,
          message:
            "Perception media asset is not present in local storage. Upstream pipeline has not exported video frames.",
        });
      })
      .finally(() => setLoading(false));
  }, [observation]);

  if (!observation) {
    return (
      <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-6 font-mono text-center flex flex-col items-center justify-center min-h-[320px]">
        <FileSearch className="w-8 h-8 text-[#94A3B8]/40 mb-3" />
        <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
          EVIDENCE INSPECTOR
        </h3>
        <p className="text-[11px] text-[#94A3B8] mt-1 max-w-xs leading-relaxed">
          Select an observation row, timeline hop, or vehicle association to inspect underlying perception evidence.
        </p>
      </div>
    );
  }

  const vStatus = vehicle ? normalizeStatus(vehicle.identity_status, vehicle.tracking_type) : "candidate";

  return (
    <div className="bg-[#111C2B] border border-[#29384B] rounded-xl overflow-hidden font-mono flex flex-col shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 bg-[#0D1420] border-b border-[#29384B] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-[#55D6E8]" />
          <div>
            <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
              EVIDENCE DOSSIER
            </h3>
            <div className="text-[10px] text-[#55D6E8]">{observation.observation_id}</div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#172437]"
            title="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[580px] text-xs">
        {/* Status & Camera Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#29384B]">
          <div className="flex items-center gap-2">
            <span className="text-[#94A3B8] text-[10px] uppercase">STATUS:</span>
            <StatusBadge status={vStatus} size="sm" />
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[#94A3B8]">CAMERA:</span>{" "}
            <span className="text-[#55D6E8] font-bold">{observation.camera_id}</span>
          </div>
        </div>

        {/* Observation Provenance Details */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            OBSERVATION PROVENANCE
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
              <div className="text-[9px] text-[#94A3B8] uppercase">Observation ID</div>
              <div className="text-[11px] font-bold text-[#F1F5F9] truncate mt-0.5">
                {observation.observation_id}
              </div>
            </div>

            <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
              <div className="text-[9px] text-[#94A3B8] uppercase">Camera Local Track ID</div>
              <div className="text-[11px] font-bold text-[#55D6E8] mt-0.5">
                #{observation.track_id}
              </div>
            </div>

            <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
              <div className="text-[9px] text-[#94A3B8] uppercase">Frame Index</div>
              <div className="text-[11px] font-bold text-[#F1F5F9] mt-0.5">
                {observation.frame_idx != null ? `Frame ${observation.frame_idx}` : (
                  <span className="text-[#94A3B8]/60 italic font-normal">Not recorded</span>
                )}
              </div>
            </div>

            <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
              <div className="text-[9px] text-[#94A3B8] uppercase">Vehicle Class</div>
              <div className="text-[11px] font-bold text-[#F1F5F9] mt-0.5">
                {observation.vehicle_type || "Unknown"}
              </div>
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <div className="p-2 rounded bg-[#080D14] border border-[#29384B]">
          <div className="text-[9px] text-[#94A3B8] uppercase flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#55D6E8]" /> Timestamp
          </div>
          <div className="text-[11px] font-bold text-[#F1F5F9] mt-0.5">
            {observation.timestamp ? (
              observation.timestamp.replace("T", " ").replace("Z", " UTC")
            ) : (
              <span className="text-[#94A3B8]/60 italic font-normal">
                No timestamp recorded in upstream file
              </span>
            )}
          </div>
        </div>

        {/* Detection & BBox Coordinates */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            DETECTION BOUNDING BOX
          </div>
          <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">YOLO Confidence:</span>
              <span className="font-bold text-[#34D399]">
                {observation.detection_confidence != null
                  ? `${(observation.detection_confidence * 100).toFixed(1)}%`
                  : <span className="text-[#94A3B8] italic font-normal">Not provided</span>}
              </span>
            </div>

            {observation.bbox ? (
              <div>
                <div className="text-[9px] text-[#94A3B8] mb-1">Normalized / Pixel BBox [x1, y1, x2, y2]:</div>
                <div className="px-2 py-1 rounded bg-[#111C2B] text-[10px] text-[#55D6E8] font-bold">
                  [{observation.bbox.join(", ")}]
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-[#94A3B8]/70 italic">
                No bounding box vector in observation record.
              </div>
            )}
          </div>
        </div>

        {/* License Plate Region Distinction */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] flex items-center justify-between">
            <span>REGISTRATION PLATE EVIDENCE</span>
            <span className="text-[9px] text-[#94A3B8]/80 font-normal">
              (Localization vs OCR)
            </span>
          </div>

          <div className="p-2.5 rounded bg-[#080D14] border border-[#29384B] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#94A3B8]">Observed Plate:</span>
              <RegistrationPlateBadge
                plate={observation.plate_text}
                confidence={observation.plate_confidence}
                size="sm"
              />
            </div>
            <p className="text-[9px] text-[#94A3B8]/70 leading-relaxed">
              Synthetically localized plate region. Plate text is mapped from camera sensor tracklet annotations.
            </p>
          </div>
        </div>

        {/* Media Frame Verification Status */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
            STORAGE ASSET AUDIT
          </div>

          <div
            className={`p-2.5 rounded border text-[11px] ${
              evidence?.frame_available
                ? "bg-[#34D399]/10 border-[#34D399]/40 text-[#34D399]"
                : "bg-[#080D14] border-[#29384B] text-[#94A3B8]"
            }`}
          >
            <div className="flex items-center gap-2">
              {evidence?.frame_available ? (
                <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#FBBF24] shrink-0" />
              )}
              <span className="leading-tight">
                {evidence?.frame_available
                  ? "Crop frame verified in local perception storage."
                  : "Perception frame asset is not present in local storage. Upstream pipeline has not exported video frames."}
              </span>
            </div>
          </div>
        </div>

        {/* Open Modal Action */}
        {onOpenMediaModal && (
          <button
            onClick={() => onOpenMediaModal(observation)}
            className="w-full mt-2 py-2 px-3 rounded-lg bg-[#172437] hover:bg-[#55D6E8] hover:text-[#080D14] text-[#55D6E8] border border-[#55D6E8]/30 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Film className="w-3.5 h-3.5" />
            <span>OPEN MEDIA INSPECTION MODAL</span>
          </button>
        )}
      </div>
    </div>
  );
}
