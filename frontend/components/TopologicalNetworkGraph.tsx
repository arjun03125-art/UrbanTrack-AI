"use client";

import React, { useMemo } from "react";
import { Camera, CameraNetwork, GlobalVehicle } from "@/types";

interface TopologicalNetworkGraphProps {
  cameras: Camera[];
  network: CameraNetwork | null;
  selectedVehicle: GlobalVehicle | null;
  activeStepIndex?: number;
  selectedCameraId?: string | null;
  onSelectCamera?: (cameraId: string) => void;
  height?: number;
}

export function TopologicalNetworkGraph({
  cameras,
  network,
  selectedVehicle,
  activeStepIndex = 0,
  selectedCameraId,
  onSelectCamera,
  height = 480,
}: TopologicalNetworkGraphProps) {
  // Compute circular or force-like layout for cameras
  const layout = useMemo(() => {
    const W = 800;
    const H = Math.max(height, 420);
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(cx, cy) - 80;

    const nodes = cameras.map((c, i) => {
      // If node has custom x,y from network, use or scale them, otherwise layout in a circle
      const netNode = network?.nodes.find((n) => n.id === c.camera_id);
      let x = cx + radius * Math.cos((2 * Math.PI * i) / Math.max(cameras.length, 1) - Math.PI / 2);
      let y = cy + radius * Math.sin((2 * Math.PI * i) / Math.max(cameras.length, 1) - Math.PI / 2);

      if (netNode && typeof netNode.x === "number" && typeof netNode.y === "number") {
        // Normalized into bounds
        x = 100 + (netNode.x / 480) * (W - 200);
        y = 60 + (netNode.y / 340) * (H - 120);
      }

      return {
        id: c.camera_id,
        name: c.name || c.camera_id,
        x,
        y,
        camera: c,
      };
    });

    const edges = (network?.edges || []).map((e, i) => {
      const src = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
      return {
        id: `topo-edge-${i}`,
        source: e.source,
        target: e.target,
        srcNode: src,
        tgtNode: tgt,
        flow: e.vehicle_flow_count,
      };
    });

    return { W, H, nodes, edges };
  }, [cameras, network, height]);

  // Vehicle journey edges
  const vehicleEdges = useMemo(() => {
    if (!selectedVehicle || selectedVehicle.trajectory.length < 2) return [];
    const pairs: Array<{ from: string; to: string; step: number }> = [];
    for (let i = 0; i < selectedVehicle.trajectory.length - 1; i++) {
      pairs.push({
        from: selectedVehicle.trajectory[i].camera_id,
        to: selectedVehicle.trajectory[i + 1].camera_id,
        step: i,
      });
    }
    return pairs;
  }, [selectedVehicle]);

  const activeStepCam = selectedVehicle?.trajectory[activeStepIndex]?.camera_id;

  return (
    <div className="relative w-full h-full min-h-[400px] bg-[#080D14] flex items-center justify-center overflow-hidden font-mono select-none">
      <svg
        viewBox={`0 0 ${layout.W} ${layout.H}`}
        className="w-full h-full max-h-[600px]"
      >
        <defs>
          <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#55D6E8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#55D6E8" stopOpacity="0" />
          </radialGradient>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="24"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#55D6E8" />
          </marker>
        </defs>

        {/* Ambient coordinate grid */}
        <pattern id="topo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#29384B" opacity="0.4" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#topo-grid)" />

        {/* Base Network Flow Edges */}
        {layout.edges.map((e) => {
          if (!e.srcNode || !e.tgtNode) return null;
          const strokeW = Math.max(1.5, Math.min(e.flow / 5, 6));
          const mx = (e.srcNode.x + e.tgtNode.x) / 2;
          const my = (e.srcNode.y + e.tgtNode.y) / 2;

          return (
            <g key={e.id}>
              <line
                x1={e.srcNode.x}
                y1={e.srcNode.y}
                x2={e.tgtNode.x}
                y2={e.tgtNode.y}
                stroke="#29384B"
                strokeWidth={strokeW}
                strokeDasharray="4 4"
              />
              <rect
                x={mx - 14}
                y={my - 8}
                width="28"
                height="16"
                rx="4"
                fill="#111C2B"
                stroke="#29384B"
                strokeWidth="1"
              />
              <text
                x={mx}
                y={my + 3}
                fill="#94A3B8"
                fontSize="8"
                textAnchor="middle"
                fontWeight="bold"
              >
                {e.flow}
              </text>
            </g>
          );
        })}

        {/* Active Vehicle Trajectory Paths */}
        {vehicleEdges.map((ve, idx) => {
          const s = layout.nodes.find((n) => n.id === ve.from);
          const t = layout.nodes.find((n) => n.id === ve.to);
          if (!s || !t) return null;
          const isActive = idx === activeStepIndex || idx === activeStepIndex - 1;

          return (
            <g key={`veh-flow-${idx}`}>
              <line
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={isActive ? "#55D6E8" : "#8295FF"}
                strokeWidth={isActive ? 4 : 2.5}
                strokeDasharray={isActive ? "none" : "8 4"}
                markerEnd="url(#arrowhead)"
                opacity={isActive ? 1 : 0.75}
              />
            </g>
          );
        })}

        {/* Camera Nodes */}
        {layout.nodes.map((node) => {
          const isSelected =
            node.id === selectedCameraId || node.id === activeStepCam;
          const isVisited = selectedVehicle?.cameras_visited.includes(node.id);

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onClick={() => onSelectCamera && onSelectCamera(node.id)}
              className="cursor-pointer group"
            >
              {/* Outer halo */}
              {isSelected && (
                <circle cx="0" cy="0" r="32" fill="url(#node-glow)" />
              )}

              {/* Node Circle */}
              <circle
                cx="0"
                cy="0"
                r={isSelected ? 18 : 14}
                fill={isSelected ? "#172437" : isVisited ? "#111C2B" : "#0D1420"}
                stroke={isSelected ? "#55D6E8" : isVisited ? "#8295FF" : "#29384B"}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />

              {/* Center Dot */}
              <circle
                cx="0"
                cy="0"
                r="4"
                fill={isSelected ? "#55D6E8" : isVisited ? "#8295FF" : "#94A3B8"}
              />

              {/* Camera ID Label */}
              <rect
                x="-40"
                y="20"
                width="80"
                height="18"
                rx="4"
                fill="#0D1420"
                stroke={isSelected ? "#55D6E8" : "#29384B"}
                strokeWidth="1"
              />
              <text
                x="0"
                y="32"
                fill={isSelected ? "#55D6E8" : "#F1F5F9"}
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
              >
                {node.id}
              </text>

              {/* Subtitle / observation count */}
              <text
                x="0"
                y="-20"
                fill="#94A3B8"
                fontSize="8"
                textAnchor="middle"
              >
                {node.camera.total_observations} obs
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Notice */}
      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded bg-[#0D1420]/90 border border-[#29384B] text-[10px] text-[#94A3B8] font-mono">
        Topological Camera Graph · Flows derived strictly from observed records
      </div>
    </div>
  );
}
