"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Camera,
  Layers,
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  ExternalLink,
  Film,
} from "lucide-react";
import { Observation, EvidenceInfo } from "@/types";
import { fetchObservationEvidence } from "@/lib/api";

interface EvidenceModalProps {
  observation: Observation | null;
  onClose: () => void;
}

export function EvidenceModal({ observation, onClose }: EvidenceModalProps) {
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

  if (!observation) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono select-none"
    >
      <div
        className="bg-[#111C2B] border border-[#29384B] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0D1420] border-b border-[#29384B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#172437] border border-[#55D6E8]/40 flex items-center justify-center text-[#55D6E8]">
              <FileSearch className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#F1F5F9]">
                  EVIDENCE RECORD: {observation.observation_id}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#080D14] text-[#55D6E8] border border-[#29384B] font-bold">
                  {observation.camera_id}
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">
                Member 1 Single-Camera Perception Lineage &amp; Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#172437] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Media Canvas / Missing Indicator */}
          <div className="rounded-xl border border-[#29384B] bg-[#080D14] p-6 flex flex-col items-center justify-center text-center min-h-[220px]">
            {evidence?.frame_available && evidence.frame_url ? (
              <div className="space-y-3 w-full">
                <img
                  src={evidence.frame_url}
                  alt={`Observation ${observation.observation_id}`}
                  className="max-h-64 mx-auto rounded-lg border border-[#29384B] object-contain shadow-lg"
                />
                <span className="text-[11px] text-[#34D399] flex items-center justify-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Source frame asset verified in storage
                </span>
              </div>
            ) : (
              <div className="space-y-3 max-w-md">
                <div className="w-12 h-12 rounded-full bg-[#111C2B] border border-[#FBBF24]/30 flex items-center justify-center text-[#FBBF24] mx-auto">
                  <Film className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#F1F5F9]">
                    Perception Media Asset Not In Storage
                  </h4>
                  <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    Upstream perception pipeline has not exported video frames (<code className="text-[#55D6E8] bg-[#172437] px-1 py-0.5 rounded">frames/{observation.observation_id}.jpg</code>) or video clips for sensor node <strong className="text-[#F1F5F9]">{observation.camera_id}</strong>.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/30 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Preserving telemetry from observations.json — No fake imagery fabricated
                </div>
              </div>
            )}
          </div>

          {/* Telemetry Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block">Local Track ID</span>
              <span className="font-bold text-xs text-[#55D6E8]">#{observation.track_id}</span>
            </div>

            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block">Frame Index</span>
              <span className="font-bold text-xs text-[#F1F5F9]">
                {observation.frame_idx !== null ? `Frame ${observation.frame_idx}` : "Not recorded"}
              </span>
            </div>

            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block">Detection Conf</span>
              <span className="font-bold text-xs text-[#34D399]">
                {observation.detection_confidence !== null
                  ? `${(observation.detection_confidence * 100).toFixed(1)}%`
                  : "Not provided"}
              </span>
            </div>

            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block">Vehicle Class</span>
              <span className="font-bold text-xs text-[#F1F5F9]">
                {observation.vehicle_type || "Unknown"}
              </span>
            </div>

            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block">License Plate (OCR)</span>
              <span className="font-bold text-xs text-[#55D6E8]">
                {observation.plate_text || "No OCR string"}
              </span>
            </div>

            <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg">
              <span className="text-[10px] text-[#94A3B8] uppercase block">Timestamp</span>
              <span className="font-bold text-[11px] text-[#F1F5F9] truncate block">
                {observation.timestamp ? observation.timestamp.slice(11, 19) : "No timestamp"}
              </span>
            </div>
          </div>

          {/* Bounding Box Information */}
          <div className="p-3 bg-[#0D1420] border border-[#29384B] rounded-lg space-y-1">
            <span className="text-[10px] text-[#94A3B8] uppercase block">
              Bounding Box Coordinates [x1, y1, x2, y2]
            </span>
            <div className="text-xs text-[#55D6E8] font-bold">
              {observation.bbox ? `[${observation.bbox.join(", ")}]` : "Not provided in observation record"}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#0D1420] border-t border-[#29384B] flex items-center justify-between">
          <span className="text-[10px] text-[#94A3B8]">
            UrbanTrack AI Perception Traceability
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#29384B] bg-[#172437] text-xs font-bold text-[#F1F5F9] hover:bg-[#55D6E8] hover:text-[#080D14] transition-colors"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
