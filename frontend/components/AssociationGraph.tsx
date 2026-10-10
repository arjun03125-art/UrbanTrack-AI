"use client";

import React, { useState, useMemo } from "react";
import {
  GitFork,
  Camera,
  Car,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Filter,
  Info,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { GlobalVehicle, Camera as CameraType } from "@/types";
import { StatusBadge, normalizeStatus } from "./StatusBadge";

interface AssociationGraphProps {
  vehicles: GlobalVehicle[];
  cameras: CameraType[];
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
  selectedCameraId?: string | null;
  onSelectCamera?: (cameraId: string) => void;
  height?: number;
}

export function AssociationGraph({
  vehicles,
  cameras,
  selectedVehicleId,
  onSelectVehicle,
  selectedCameraId,
  onSelectCamera,
  height = 520,
}: AssociationGraphProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<{
    cameraId: string;
    trackId: number;
    vehicleId: string;
    confidence: number | null;
    status: string;
  } | null>(null);

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const st = normalizeStatus(v.identity_status, v.tracking_type);
      if (statusFilter !== "ALL" && st !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchesId = v.global_vehicle_id.toLowerCase().includes(s);
        const matchesPlate = v.primary_plate?.toLowerCase().includes(s);
        const matchesCam = v.cameras_visited.some((c) => c.toLowerCase().includes(s));
        if (!matchesId && !matchesPlate && !matchesCam) return false;
      }
      return true;
    });
  }, [vehicles, statusFilter, search]);

  // Compute graph layout
  // Column 1: Cameras (left)
  // Column 2: Local Tracks (mid-left)
  // Column 3: Global Vehicles (right)
  const layout = useMemo(() => {
    const W = 960;
    const H = Math.max(height, Math.max(cameras.length, filteredVehicles.length) * 44 + 80);

    const camX = 140;
    const trackX = 420;
    const vehX = 760;

    // Camera positions
    const camYStep = (H - 80) / Math.max(cameras.length, 1);
    const cameraNodes = cameras.map((c, i) => ({
      id: c.camera_id,
      label: c.name || c.camera_id,
      x: camX,
      y: 50 + i * camYStep,
      camera: c,
    }));

    // Global Vehicle nodes
    const vehYStep = (H - 80) / Math.max(filteredVehicles.length, 1);
    const vehicleNodes = filteredVehicles.map((v, i) => ({
      id: v.global_vehicle_id,
      label: v.global_vehicle_id,
      plate: v.primary_plate,
      vehicleType: v.vehicle_type,
      status: normalizeStatus(v.identity_status, v.tracking_type),
      x: vehX,
      y: 50 + i * vehYStep,
      vehicle: v,
    }));

    // Local Track nodes & association edges
    const trackNodes: Array<{
      id: string;
      cameraId: string;
      trackId: number;
      vehicleId: string;
      confidence: number | null;
      status: string;
      x: number;
      y: number;
    }> = [];

    const edges: Array<{
      id: string;
      fromCam: string;
      trackNodeId: string;
      toVehicle: string;
      status: string;
      confidence: number | null;
    }> = [];

    let trackCounter = 0;
    filteredVehicles.forEach((v) => {
      const vStatus = normalizeStatus(v.identity_status, v.tracking_type);
      const vNode = vehicleNodes.find((vn) => vn.id === v.global_vehicle_id);
      if (!vNode) return;

      const assocs =
        v.camera_local_associations.length > 0
          ? v.camera_local_associations
          : v.trajectory.map((t) => ({
              camera_id: t.camera_id,
              track_id: t.track_id,
              confidence: v.association_confidence,
            }));

      assocs.forEach((a) => {
        const trackIdStr = `${a.camera_id}#${a.track_id}`;
        // Calculate Y position interpolated between camera Y and vehicle Y
        const cNode = cameraNodes.find((cn) => cn.id === a.camera_id);
        const cy = cNode ? cNode.y : vNode.y;
        const ty = (cy + vNode.y) / 2 + (trackCounter % 3 - 1) * 8;
        trackCounter++;

        const tNode = {
          id: `${v.global_vehicle_id}-${trackIdStr}`,
          cameraId: a.camera_id,
          trackId: a.track_id,
          vehicleId: v.global_vehicle_id,
          confidence: a.confidence,
          status: vStatus,
          x: trackX,
          y: ty,
        };
        trackNodes.push(tNode);

        edges.push({
          id: `edge-${tNode.id}`,
          fromCam: a.camera_id,
          trackNodeId: tNode.id,
          toVehicle: v.global_vehicle_id,
          status: vStatus,
          confidence: a.confidence,
        });
      });
    });

    return { W, H, cameraNodes, trackNodes, vehicleNodes, edges };
  }, [cameras, filteredVehicles, height]);

  // Active / selected elements
  const activeVehicle = vehicles.find((v) => v.global_vehicle_id === selectedVehicleId);
  const activeCamera = cameras.find((c) => c.camera_id === selectedCameraId);

  return (
    <div className="flex flex-col bg-[#111C2B] border border-[#29384B] rounded-xl overflow-hidden font-mono">
      {/* Top Header & Graph Controls */}
      <div className="px-4 py-3 bg-[#0D1420] border-b border-[#29384B] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-[#55D6E8]" />
          <h2 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
            Cross-Camera Association Graph
          </h2>
          <span className="text-[10px] text-[#94A3B8] px-2 py-0.5 rounded bg-[#080D14] border border-[#29384B]">
            {filteredVehicles.length} Vehicles · {layout.trackNodes.length} Local Tracks
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter ID, plate, camera..."
            className="px-2.5 py-1 rounded bg-[#080D14] border border-[#29384B] text-[#F1F5F9] placeholder-[#94A3B8]/60 text-xs focus:border-[#55D6E8] outline-none"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 rounded bg-[#080D14] border border-[#29384B] text-[#F1F5F9] text-xs focus:border-[#55D6E8] outline-none"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="confirmed">CONFIRMED ONLY</option>
            <option value="candidate">CANDIDATE ONLY</option>
            <option value="ambiguous">AMBIGUOUS ONLY</option>
            <option value="single_camera">SINGLE CAMERA ONLY</option>
          </select>
        </div>
      </div>

      {/* Main SVG Visualization Canvas */}
      <div className="relative overflow-x-auto overflow-y-auto bg-[#080D14] p-2 min-h-[360px]" style={{ maxHeight: height }}>
        <svg
          viewBox={`0 0 ${layout.W} ${layout.H}`}
          className="w-full min-w-[840px]"
          style={{ height: layout.H }}
        >
          {/* Background Grid Pattern */}
          <defs>
            <pattern id="graph-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#29384B" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#graph-grid)" />

          {/* Column Header Titles */}
          <text x="140" y="24" fill="#94A3B8" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.08em">
            OBSERVING CAMERAS
          </text>
          <text x="420" y="24" fill="#94A3B8" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.08em">
            LOCAL TRACKS (TRACKLETS)
          </text>
          <text x="760" y="24" fill="#94A3B8" fontSize="11" fontWeight="bold" textAnchor="middle" letterSpacing="0.08em">
            GLOBAL VEHICLE IDENTITIES
          </text>

          {/* Edges: Camera -> Tracklet -> Global Vehicle */}
          {layout.edges.map((edge) => {
            const camNode = layout.cameraNodes.find((c) => c.id === edge.fromCam);
            const trackNode = layout.trackNodes.find((t) => t.id === edge.trackNodeId);
            const vehNode = layout.vehicleNodes.find((v) => v.id === edge.toVehicle);
            if (!camNode || !trackNode || !vehNode) return null;

            const isSelected =
              edge.toVehicle === selectedVehicleId || edge.fromCam === selectedCameraId;
            const isMuted =
              (selectedVehicleId && edge.toVehicle !== selectedVehicleId) ||
              (selectedCameraId && edge.fromCam !== selectedCameraId);

            // Edge styling based strictly on association status
            let strokeColor = "#94A3B8";
            let strokeDash = "none";
            if (edge.status === "confirmed") {
              strokeColor = "#34D399";
              strokeDash = "none";
            } else if (edge.status === "candidate") {
              strokeColor = "#FBBF24";
              strokeDash = "4 4";
            } else if (edge.status === "ambiguous") {
              strokeColor = "#FB923C";
              strokeDash = "2 4";
            } else if (edge.status === "single_camera") {
              strokeColor = "#55D6E8";
              strokeDash = "none";
            }

            const opacity = isSelected ? 1 : isMuted ? 0.15 : 0.65;
            const strokeW = isSelected ? 2.5 : 1.2;

            // Bezier curves
            const path1 = `M ${camNode.x + 60} ${camNode.y} C ${(camNode.x + trackNode.x) / 2} ${camNode.y}, ${(camNode.x + trackNode.x) / 2} ${trackNode.y}, ${trackNode.x - 45} ${trackNode.y}`;
            const path2 = `M ${trackNode.x + 45} ${trackNode.y} C ${(trackNode.x + vehNode.x) / 2} ${trackNode.y}, ${(trackNode.x + vehNode.x) / 2} ${vehNode.y}, ${vehNode.x - 70} ${vehNode.y}`;

            return (
              <g key={edge.id} opacity={opacity}>
                <path
                  d={path1}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeDasharray={strokeDash}
                />
                <path
                  d={path2}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeDasharray={strokeDash}
                />
              </g>
            );
          })}

          {/* Camera Nodes (Column 1) */}
          {layout.cameraNodes.map((node) => {
            const isSelected = selectedCameraId === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onSelectCamera && onSelectCamera(node.id)}
                className="cursor-pointer"
              >
                <rect
                  x="-65"
                  y="-16"
                  width="130"
                  height="32"
                  rx="6"
                  fill={isSelected ? "#172437" : "#111C2B"}
                  stroke={isSelected ? "#55D6E8" : "#29384B"}
                  strokeWidth={isSelected ? "2" : "1"}
                />
                <circle cx="-50" cy="0" r="4" fill={isSelected ? "#55D6E8" : "#94A3B8"} />
                <text x="-40" y="4" fill="#F1F5F9" fontSize="10" fontWeight="bold">
                  {node.id}
                </text>
                <text x="35" y="4" fill="#94A3B8" fontSize="8" textAnchor="end">
                  {node.camera.vehicles_observed} veh
                </text>
              </g>
            );
          })}

          {/* Local Track Nodes (Column 2) */}
          {layout.trackNodes.map((node) => {
            const isSelected =
              selectedTrack?.cameraId === node.cameraId &&
              selectedTrack?.trackId === node.trackId;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedTrack(node)}
                className="cursor-pointer"
              >
                <rect
                  x="-45"
                  y="-12"
                  width="90"
                  height="24"
                  rx="4"
                  fill={isSelected ? "#172437" : "#0D1420"}
                  stroke={isSelected ? "#55D6E8" : "#29384B"}
                  strokeWidth="1"
                />
                <text x="0" y="3" fill="#94A3B8" fontSize="9" textAnchor="middle">
                  {node.cameraId} <tspan fill="#F1F5F9" fontWeight="bold">#{node.trackId}</tspan>
                </text>
              </g>
            );
          })}

          {/* Global Vehicle Nodes (Column 3) */}
          {layout.vehicleNodes.map((node) => {
            const isSelected = selectedVehicleId === node.id;
            let statusBadgeColor = "#FBBF24";
            if (node.status === "confirmed") statusBadgeColor = "#34D399";
            if (node.status === "single_camera") statusBadgeColor = "#55D6E8";
            if (node.status === "ambiguous") statusBadgeColor = "#FB923C";

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onSelectVehicle && onSelectVehicle(node.id)}
                className="cursor-pointer"
              >
                <rect
                  x="-75"
                  y="-18"
                  width="150"
                  height="36"
                  rx="6"
                  fill={isSelected ? "#172437" : "#111C2B"}
                  stroke={isSelected ? "#55D6E8" : "#29384B"}
                  strokeWidth={isSelected ? "2" : "1"}
                />
                <circle cx="-62" cy="0" r="4" fill={statusBadgeColor} />
                <text x="-52" y="-2" fill="#F1F5F9" fontSize="11" fontWeight="bold">
                  {node.id}
                </text>
                <text x="-52" y="11" fill="#94A3B8" fontSize="9">
                  {node.plate || "NO PLATE"} · {node.vehicleType}
                </text>
                <text x="65" y="4" fill={statusBadgeColor} fontSize="8" fontWeight="bold" textAnchor="end">
                  {node.status.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend & Selected Node Metadata Bar */}
      <div className="px-4 py-3 bg-[#0D1420] border-t border-[#29384B] flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Association Type Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#94A3B8]">
          <span className="font-bold uppercase tracking-wider text-[#F1F5F9]">EDGE LEGEND:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#34D399]" />
            <span className="text-[#34D399] font-bold">SOLID:</span> Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t border-dashed border-[#FBBF24]" />
            <span className="text-[#FBBF24] font-bold">DASHED:</span> Candidate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t border-dotted border-[#FB923C]" />
            <span className="text-[#FB923C] font-bold">DOTTED:</span> Ambiguous
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-[#55D6E8]" />
            <span className="text-[#55D6E8] font-bold">CYAN:</span> Single-Camera
          </span>
        </div>

        {/* Selected Context Summary */}
        {activeVehicle && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[#94A3B8]">SELECTED VEHICLE:</span>
            <span className="text-[#55D6E8] font-bold">{activeVehicle.global_vehicle_id}</span>
            <StatusBadge
              status={activeVehicle.identity_status || "candidate"}
              trackingType={activeVehicle.tracking_type}
              size="sm"
            />
            {activeVehicle.association_confidence != null && (
              <span className="text-[#94A3B8]">
                Confidence:{" "}
                <b className="text-[#F1F5F9]">
                  {(activeVehicle.association_confidence * 100).toFixed(1)}%
                </b>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
