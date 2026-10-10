"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Database,
  ArrowRight,
  ShieldCheck,
  Check,
  RefreshCw,
  FileText,
} from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useData, api } from "@/lib/useData";

interface StageStatus {
  step: number;
  label: string;
  status: "pending" | "running" | "success" | "error";
  message?: string;
}

export default function DataIngestionPage() {
  const { data, reload, loading } = useData();

  // Ingestion workflow stages
  const [stages, setStages] = useState<StageStatus[]>([
    { step: 1, label: "File Received", status: "pending" },
    { step: 2, label: "JSON Parsed", status: "pending" },
    { step: 3, label: "Schema Validated", status: "pending" },
    { step: 4, label: "Data Ingested", status: "pending" },
    { step: 5, label: "Dashboard Refreshed", status: "pending" },
  ]);

  const [activeKind, setActiveKind] = useState<"observations" | "intelligence">("observations");
  const [parsedPreview, setParsedPreview] = useState<any[] | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetStages = () => {
    setStages([
      { step: 1, label: "File Received", status: "pending" },
      { step: 2, label: "JSON Parsed", status: "pending" },
      { step: 3, label: "Schema Validated", status: "pending" },
      { step: 4, label: "Data Ingested", status: "pending" },
      { step: 5, label: "Dashboard Refreshed", status: "pending" },
    ]);
    setImportResult(null);
    setParsedPreview(null);
  };

  const handleFile = async (file: File) => {
    resetStages();
    setIsProcessing(true);

    // Stage 1: File Received
    setStages((s) => s.map((st, i) => (i === 0 ? { ...st, status: "success", message: file.name } : st)));

    // Stage 2: JSON Parsing
    setStages((s) => s.map((st, i) => (i === 1 ? { ...st, status: "running" } : st)));
    let parsed: any;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
      setStages((s) => s.map((st, i) => (i === 1 ? { ...st, status: "success", message: `${text.length} bytes parsed` } : st)));
    } catch (err: any) {
      setStages((s) => s.map((st, i) => (i === 1 ? { ...st, status: "error", message: "Invalid JSON syntax" } : st)));
      setIsProcessing(false);
      return;
    }

    // Stage 3: Schema Validation
    setStages((s) => s.map((st, i) => (i === 2 ? { ...st, status: "running" } : st)));
    let previewItems: any[] = [];
    if (activeKind === "observations") {
      const list = Array.isArray(parsed) ? parsed : parsed.observations;
      if (!Array.isArray(list)) {
        setStages((s) => s.map((st, i) => (i === 2 ? { ...st, status: "error", message: "Observations payload must be a JSON array of records" } : st)));
        setIsProcessing(false);
        return;
      }
      if (list.length > 0 && !list[0].camera_id) {
        setStages((s) => s.map((st, i) => (i === 2 ? { ...st, status: "error", message: "Records missing camera_id field" } : st)));
        setIsProcessing(false);
        return;
      }
      previewItems = list.slice(0, 5);
      setParsedPreview(previewItems);
      setStages((s) => s.map((st, i) => (i === 2 ? { ...st, status: "success", message: `${list.length} observations validated` } : st)));
    } else {
      if (typeof parsed !== "object" || (!parsed.cameras && !parsed.global_vehicles)) {
        setStages((s) => s.map((st, i) => (i === 2 ? { ...st, status: "error", message: "Intelligence file must contain cameras[] and/or global_vehicles[]" } : st)));
        setIsProcessing(false);
        return;
      }
      previewItems = (parsed.global_vehicles || []).slice(0, 5);
      setParsedPreview(previewItems);
      setStages((s) => s.map((st, i) => (i === 2 ? { ...st, status: "success", message: "Multicam intelligence schema confirmed" } : st)));
    }

    // Stage 4: Ingestion Upload
    setStages((s) => s.map((st, i) => (i === 3 ? { ...st, status: "running" } : st)));
    try {
      const res = await api(`/upload?kind=${activeKind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      setStages((s) => s.map((st, i) => (i === 3 ? { ...st, status: "success", message: `Written to data/pipeline/${activeKind}.json` } : st)));
      setImportResult(
        `Imported: ${res.observations.toLocaleString()} observations · ${res.vehicles} vehicle clusters · ${res.cameras} cameras`
      );
    } catch (err: any) {
      setStages((s) => s.map((st, i) => (i === 3 ? { ...st, status: "error", message: err.message || "Failed to persist file" } : st)));
      setIsProcessing(false);
      return;
    }

    // Stage 5: Dashboard Refresh
    setStages((s) => s.map((st, i) => (i === 4 ? { ...st, status: "running" } : st)));
    try {
      await reload(true);
      setStages((s) => s.map((st, i) => (i === 4 ? { ...st, status: "success", message: "Data synchronized across all views" } : st)));
    } catch (err: any) {
      setStages((s) => s.map((st, i) => (i === 4 ? { ...st, status: "error", message: "Sync error" } : st)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetToDemo = async () => {
    setIsProcessing(true);
    try {
      await api("/reset", { method: "POST" });
      await reload(true);
      resetStages();
      setImportResult("Pipeline successfully reset to built-in demonstration fixtures.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DashboardShell dataMode={data.mode}>
      <div className="space-y-4 font-mono select-none">
        {/* Header Banner */}
        <div className="bg-[#111C2B] border border-[#29384B] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#55D6E8]" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">
                DATA INGESTION &amp; SCHEMA VALIDATION WORKSPACE
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#080D14] text-[#34D399] border border-[#29384B]">
                MEMBER 1 &amp; MEMBER 2 CONTRACTS
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              Validate single-camera observation streams and cross-camera multi-camera intelligence packages.
            </p>
          </div>

          <button
            onClick={handleResetToDemo}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded bg-[#172437] border border-[#29384B] hover:border-[#FBBF24] text-[#FBBF24] flex items-center gap-1.5 text-xs transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET TO DEMO DATASET</span>
          </button>
        </div>

        {/* 5-Stage Ingestion Pipeline Progress Tracker */}
        <div className="bg-[#0D1420] border border-[#29384B] rounded-xl p-4 shadow-xl">
          <div className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>5-STAGE INGESTION &amp; VERIFICATION PIPELINE</span>
            <span className="text-[10px] text-[#94A3B8]">Strict Data Integrity Enforcement</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {stages.map((st) => {
              let badgeColor = "border-[#29384B] bg-[#111C2B] text-[#94A3B8]";
              let icon = <span className="w-3 h-3 rounded-full border border-[#94A3B8]" />;

              if (st.status === "running") {
                badgeColor = "border-[#55D6E8] bg-[#172437] text-[#55D6E8]";
                icon = <RefreshCw className="w-3 h-3 animate-spin text-[#55D6E8]" />;
              } else if (st.status === "success") {
                badgeColor = "border-[#34D399]/40 bg-[#34D399]/10 text-[#34D399]";
                icon = <Check className="w-3.5 h-3.5 text-[#34D399]" />;
              } else if (st.status === "error") {
                badgeColor = "border-[#F87171]/40 bg-[#F87171]/10 text-[#F87171]";
                icon = <XCircle className="w-3.5 h-3.5 text-[#F87171]" />;
              }

              return (
                <div key={st.step} className={`p-2.5 rounded-lg border text-xs ${badgeColor}`}>
                  <div className="flex items-center gap-1.5">
                    {icon}
                    <span className="font-bold text-[11px] truncate">{st.label}</span>
                  </div>
                  {st.message && (
                    <div className="text-[9px] mt-1 truncate opacity-80">{st.message}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* File Drag & Drop + Upload Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Upload Zone (7 cols) */}
          <div className="lg:col-span-7 bg-[#111C2B] border border-[#29384B] rounded-xl p-5 space-y-4 shadow-xl">
            {/* Kind Selector Tabs */}
            <div className="flex items-center gap-2 pb-3 border-b border-[#29384B] text-xs">
              <span className="text-[#94A3B8]">SELECT SCHEMA TARGET:</span>
              <button
                onClick={() => {
                  setActiveKind("observations");
                  resetStages();
                }}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  activeKind === "observations"
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "bg-[#0D1420] text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                MEMBER 1: observations.json
              </button>
              <button
                onClick={() => {
                  setActiveKind("intelligence");
                  resetStages();
                }}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  activeKind === "intelligence"
                    ? "bg-[#55D6E8] text-[#080D14] font-bold"
                    : "bg-[#0D1420] text-[#94A3B8] hover:text-[#F1F5F9]"
                }`}
              >
                MEMBER 2: multicam_intelligence.json
              </button>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-[#55D6E8] bg-[#172437]"
                  : "border-[#29384B] bg-[#080D14] hover:border-[#55D6E8]/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <UploadCloud className="w-10 h-10 text-[#55D6E8] mx-auto mb-3" />
              <h3 className="font-bold text-sm text-[#F1F5F9]">
                DRAG &amp; DROP {activeKind.toUpperCase()}.JSON FILE HERE
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1 max-w-sm mx-auto">
                Or click to browse from local file system. Validates against UrbanTrack schema contracts before committing to pipeline storage.
              </p>
            </div>

            {importResult && (
              <div className="p-3 rounded-lg bg-[#34D399]/10 border border-[#34D399]/40 text-[#34D399] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importResult}</span>
              </div>
            )}
          </div>

          {/* Right Column: Parsed Records Preview (5 cols) */}
          <div className="lg:col-span-5 bg-[#111C2B] border border-[#29384B] rounded-xl p-4 space-y-3 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#29384B]">
              <span className="font-bold text-[#F1F5F9] uppercase tracking-wider">
                PARSED RECORDS PREVIEW
              </span>
              <span className="text-[10px] text-[#94A3B8]">First 5 records</span>
            </div>

            {parsedPreview ? (
              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                {parsedPreview.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-[#080D14] border border-[#29384B] text-[11px] font-mono">
                    <pre className="text-[#94A3B8] whitespace-pre-wrap overflow-x-auto text-[10px]">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-[#94A3B8]">
                Upload a JSON file to inspect parsed records before import commit.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
