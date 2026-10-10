"use client";

import React from "react";
import { Shield, AlertCircle, CheckCircle2 } from "lucide-react";

interface RegistrationPlateBadgeProps {
  plateText?: string | null;
  plate?: string | null;
  plateConfidence?: number | null;
  confidence?: number | null;
  size?: "sm" | "md" | "lg";
  showConfidence?: boolean;
  className?: string;
  isSynthetic?: boolean;
}

export function RegistrationPlateBadge({
  plateText,
  plate,
  plateConfidence,
  confidence,
  size = "md",
  showConfidence = true,
  className = "",
  isSynthetic = true,
}: RegistrationPlateBadgeProps) {
  const effectivePlate = plate ?? plateText;
  const effectiveConfidence = confidence ?? plateConfidence;

  // Normalize plate status
  const hasPlate = Boolean(effectivePlate && effectivePlate.trim().length > 0);
  const isExplicitlyNotDetected = effectivePlate === "Not detected" || effectivePlate === "NOT_DETECTED";

  let statusText = "Not available";
  if (isExplicitlyNotDetected) {
    statusText = "Not detected";
  } else if (hasPlate) {
    statusText = effectivePlate!.toUpperCase();
  }

  const confidencePct =
    typeof effectiveConfidence === "number" && !isNaN(effectiveConfidence)
      ? (effectiveConfidence > 1 ? effectiveConfidence : effectiveConfidence * 100).toFixed(1)
      : null;

  // Size configurations
  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3.5 py-1.5 tracking-wider font-extrabold",
  };

  if (!hasPlate || isExplicitlyNotDetected) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <span
          className={`font-mono font-semibold rounded border ${sizeClasses[size]} bg-[#111519] border-[#30383E] text-[#929DA5] select-all`}
          title="No registration plate verified for this vehicle record"
        >
          {statusText}
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col gap-0.5 ${className}`}>
      <div className="inline-flex items-center gap-1.5">
        <span
          className={`font-mono font-bold rounded border ${sizeClasses[size]} bg-[#0E1317] border-[#30383E] border-l-[3px] border-l-[#65D9E8] text-[#E7EAEC] shadow-sm select-all tracking-wider`}
        >
          {statusText}
        </span>

        {showConfidence && confidencePct && (
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#191F24] border border-[#30383E] text-[#65D9E8]"
            title={`Plate Detection Confidence: ${confidencePct}% ${isSynthetic ? "(Synthetic Demo Data)" : ""}`}
          >
            {confidencePct}%
          </span>
        )}
      </div>

      {showConfidence && isSynthetic && size === "lg" && (
        <span className="text-[9px] text-[#929DA5]/70 font-mono">
          * Synthetic demo plate localization score
        </span>
      )}
    </div>
  );
}
