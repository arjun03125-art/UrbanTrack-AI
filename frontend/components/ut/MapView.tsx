"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scan,
  Layers,
  AlertTriangle,
  Car,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Camera, CameraNetwork, GlobalVehicle } from "@/types";
import { validCoord } from "./ui";
import { createResilientTileLayer } from "@/lib/mapTiles";

export interface MapViewProps {
  cameras: Camera[];
  network: CameraNetwork | null;
  vehicle: GlobalVehicle | null;
  step: number;
  onStep: (i: number) => void;
  selectedCamera: string | null;
  onSelectCamera: (id: string) => void;
  showAllCameras?: boolean;
  onToggleShowAllCameras?: (show: boolean) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  fitTrigger?: number;
}

export default function MapView({
  cameras,
  network,
  vehicle,
  step,
  onStep,
  selectedCamera,
  onSelectCamera,
  showAllCameras = false,
  onToggleShowAllCameras,
  isFullScreen = false,
  onToggleFullScreen,
  fitTrigger = 0,
}: MapViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const anim = useRef<number>(0);
  const fittedVehicleRef = useRef<string>("");
  const [basemap, setBasemap] = useState<"osm" | "esri-satellite" | "esri-streets">("osm");

  const locatedCameras = useMemo(() => cameras.filter(validCoord), [cameras]);
  const missingCoordsCameras = useMemo(() => cameras.filter((c) => !validCoord(c)), [cameras]);

  // Identify cameras visited by selected vehicle
  const visitedCamSet = useMemo(() => {
    if (!vehicle) return new Set<string>();
    return new Set<string>(vehicle.trajectory.map((t) => t.camera_id));
  }, [vehicle]);

  // Visited cameras that lack coordinates
  const unmappedRouteCameras = useMemo(() => {
    if (!vehicle) return [];
    return vehicle.trajectory
      .map((t) => t.camera_id)
      .filter((cid) => missingCoordsCameras.some((c) => c.camera_id === cid));
  }, [vehicle, missingCoordsCameras]);

  // 1. Initialize Map
  useEffect(() => {
    if (!host.current || map.current) return;
    const m = L.map(host.current, {
      zoomControl: false, // We provide custom HUD zoom controls
      attributionControl: true,
      preferCanvas: false,
    }).setView([37.7749, -122.4194], 12);

    const initialTile = createResilientTileLayer(basemap);
    initialTile.addTo(m);
    tileLayerRef.current = initialTile;

    layer.current = L.layerGroup().addTo(m);
    map.current = m;

    const ro = new ResizeObserver(() => {
      m.invalidateSize();
    });
    ro.observe(host.current);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(anim.current);
      m.remove();
      map.current = null;
    };
  }, []);

  // 2. Handle Resize when Full-screen Toggles
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const timer1 = setTimeout(() => m.invalidateSize(), 60);
    const timer2 = setTimeout(() => m.invalidateSize(), 250);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isFullScreen]);

  // 3. Basemap Switcher
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (tileLayerRef.current) {
      m.removeLayer(tileLayerRef.current);
    }
    const newTile = createResilientTileLayer(basemap);
    newTile.addTo(m);
    tileLayerRef.current = newTile;
    if (layer.current) {
      layer.current.eachLayer((l: any) => l.bringToFront?.());
    }
  }, [basemap]);

  // 4. Fit Route Callback
  const fitRoute = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const pos = new Map<string, [number, number]>();
    locatedCameras.forEach((c) => pos.set(c.camera_id, [c.latitude as number, c.longitude as number]));

    if (vehicle && vehicle.trajectory.length > 0) {
      const pts = vehicle.trajectory
        .map((t) => pos.get(t.camera_id))
        .filter(Boolean) as [number, number][];
      if (pts.length === 1) {
        m.setView(pts[0], 15);
      } else if (pts.length > 1) {
        m.fitBounds(L.latLngBounds(pts), { padding: [70, 70], maxZoom: 16 });
      }
    } else if (locatedCameras.length > 0) {
      const allPts = Array.from(pos.values());
      m.fitBounds(L.latLngBounds(allPts), { padding: [50, 50], maxZoom: 15 });
    }
  }, [vehicle, locatedCameras]);

  // Trigger fit on external fitTrigger change
  useEffect(() => {
    if (fitTrigger > 0) {
      fitRoute();
    }
  }, [fitTrigger, fitRoute]);

  // 5. Render Layers: Trajectory, Cameras, Network Topology
  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;

    cancelAnimationFrame(anim.current);
    g.clearLayers();

    const pos = new Map<string, [number, number]>();
    locatedCameras.forEach((c) => pos.set(c.camera_id, [c.latitude as number, c.longitude as number]));
    const stepCam = vehicle?.trajectory[step]?.camera_id;

    // A. OPTIONAL CAMERA OVERVIEW: Background Topological Edges
    // Only rendered when showAllCameras is true!
    // Semantics: Dashed line indicating inferred topological possibility (NOT observed path)
    if (showAllCameras && network?.edges) {
      network.edges.forEach((e) => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return;

        L.polyline([a, b], {
          color: "#334155",
          weight: 1.5,
          dashArray: "5 7",
          opacity: 0.5,
        })
          .bindTooltip(
            `Topological Link: ${e.source} ↔ ${e.target} · Inferred transition possibility (Unobserved)`,
            { sticky: true }
          )
          .addTo(g);
      });
    }

    // B. RECONSTRUCTED TRAJECTORY ROUTE FOR SELECTED VEHICLE
    // Semantics: Solid, glowing, high-contrast cyan line for confirmed reconstructed hops
    if (vehicle && vehicle.trajectory.length > 0) {
      const pts = vehicle.trajectory
        .map((t) => pos.get(t.camera_id))
        .filter(Boolean) as [number, number][];

      if (pts.length > 1) {
        // Outer cyan glow aura
        L.polyline(pts, {
          color: "#00E5FF",
          weight: 9,
          opacity: 0.2,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(g);

        // Core solid high-contrast route line
        const routeLine = L.polyline(pts, {
          color: "#00E5FF",
          weight: 3.5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        })
          .bindTooltip(
            `Reconstructed Journey: ${vehicle.global_vehicle_id} (${pts.length} observed hops) · ${(vehicle.identity_status || "confirmed").toUpperCase()}`,
            { sticky: true }
          )
          .addTo(g);

        // Subtle travelling vehicle dot along the confirmed route
        const dot = L.marker(pts[0], {
          icon: L.divIcon({
            className: "",
            html: '<div class="ut-car-pulse"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
          interactive: false,
          zIndexOffset: 1200,
        }).addTo(g);

        const t0 = performance.now();
        const durationPerHop = 2400;
        const totalDuration = Math.max(3000, (pts.length - 1) * durationPerHop);

        const tick = () => {
          const elapsed = Math.max(0, performance.now() - t0);
          const fraction = ((elapsed % totalDuration) / totalDuration) * (pts.length - 1);
          const idx = Math.max(0, Math.min(pts.length - 2, Math.floor(fraction)));
          const k = Math.min(1, Math.max(0, fraction - idx));

          const curLat = pts[idx][0] + (pts[idx + 1][0] - pts[idx][0]) * k;
          const curLng = pts[idx][1] + (pts[idx + 1][1] - pts[idx][1]) * k;
          dot.setLatLng([curLat, curLng]);

          anim.current = requestAnimationFrame(tick);
        };
        anim.current = requestAnimationFrame(tick);
      }
    }

    // C. CAMERA MARKERS
    // When showAllCameras = false: ONLY render cameras visited by the selected vehicle!
    // When showAllCameras = true: render all cameras, keeping visited prominent and unvisited subdued.
    const camerasToRender = showAllCameras
      ? locatedCameras
      : locatedCameras.filter((c) => visitedCamSet.has(c.camera_id));

    camerasToRender.forEach((c) => {
      const isVisited = visitedCamSet.has(c.camera_id);
      const isActiveStep = c.camera_id === stepCam || c.camera_id === selectedCamera;

      // Determine step number(s) on the vehicle's journey
      let stepNum: number | null = null;
      let isOrigin = false;
      let isDestination = false;

      if (vehicle) {
        const hopIndices = vehicle.trajectory
          .map((t, idx) => (t.camera_id === c.camera_id ? idx + 1 : null))
          .filter(Boolean) as number[];
        if (hopIndices.length > 0) {
          stepNum = hopIndices[0];
          isOrigin = stepNum === 1;
          isDestination = stepNum === vehicle.trajectory.length;
        }
      }

      let badgeClass = "ut-hop-badge";
      if (!isVisited) {
        badgeClass += " unrelated";
      } else if (isActiveStep) {
        badgeClass += " active-hop";
      } else if (isOrigin) {
        badgeClass += " origin";
      } else if (isDestination) {
        badgeClass += " destination";
      } else {
        badgeClass += " intermediate";
      }

      const labelContent = isVisited ? `${stepNum ?? ""}` : "•";

      const mk = L.marker([c.latitude as number, c.longitude as number], {
        icon: L.divIcon({
          className: "",
          html: `<div class="${badgeClass}">${labelContent}</div>`,
          iconSize: isVisited ? [26, 26] : [18, 18],
          iconAnchor: isVisited ? [13, 13] : [9, 9],
        }),
        zIndexOffset: isActiveStep ? 1100 : isVisited ? 900 : 200,
      }).addTo(g);

      // Tooltip: camera label
      mk.bindTooltip(
        `${c.camera_id}${isVisited && stepNum ? ` (Hop #${stepNum})` : ""}: ${c.name || c.camera_id}`,
        {
          permanent: isVisited,
          direction: "top",
          className: "ut-label-tag",
          offset: [0, -14],
        }
      );

      // Popup with forensic sensor details
      const hopInfo = vehicle?.trajectory.find((t) => t.camera_id === c.camera_id);
      mk.bindPopup(
        `<div style="font-family: monospace; font-size: 11px; color: #F1F5F9; background: #111C2B; padding: 4px;">
          <div style="font-weight: bold; color: #55D6E8; margin-bottom: 4px;">
            ${c.camera_id} — ${c.name || "Camera"}
          </div>
          ${isVisited ? `<div style="color: #34D399; font-weight: bold;">Hop #${stepNum} of ${vehicle?.trajectory.length}</div>` : ""}
          ${hopInfo?.timestamp ? `<div>Observed: ${hopInfo.timestamp.replace("T", " ")}</div>` : ""}
          <div style="color: #94A3B8; margin-top: 4px;">${c.location_description || "No location description"}</div>
          <div style="color: #94A3B8; font-size: 10px; margin-top: 2px;">
            Lat: ${(c.latitude as number).toFixed(5)}, Lon: ${(c.longitude as number).toFixed(5)}
          </div>
        </div>`
      );

      mk.on("click", () => {
        onSelectCamera(c.camera_id);
        if (vehicle) {
          const hopIdx = vehicle.trajectory.findIndex((t) => t.camera_id === c.camera_id);
          if (hopIdx >= 0) onStep(hopIdx);
        }
      });
    });

    // Automatically fit route when vehicle changes or initially loads
    const currentVehId = vehicle?.global_vehicle_id ?? "NONE";
    if (fittedVehicleRef.current !== currentVehId) {
      fittedVehicleRef.current = currentVehId;
      fitRoute();
    }

    return () => cancelAnimationFrame(anim.current);
  }, [
    cameras,
    locatedCameras,
    network,
    vehicle,
    step,
    selectedCamera,
    showAllCameras,
    visitedCamSet,
    onSelectCamera,
    onStep,
    fitRoute,
  ]);

  return (
    <div className="relative w-full h-full min-h-[400px] select-none font-mono">
      {/* Leaflet Mount Container */}
      <div ref={host} className="absolute inset-0 z-0 bg-[#080D14]" />

      {/* Floating Map HUD Controls (Top-Right) */}
      <div className="absolute top-3 right-3 z-[500] flex flex-wrap items-center gap-1.5">
        {/* Basemap Switcher */}
        <div className="flex items-center gap-1 rounded-md border border-[#30383E] bg-[#111519]/90 backdrop-blur-md p-1 shadow-lg text-[10px]">
          {(
            [
              { id: "osm", label: "OSM" },
              { id: "esri-satellite", label: "Satellite" },
              { id: "esri-streets", label: "Streets" },
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBasemap(b.id)}
              className={`px-2 py-0.5 rounded transition-colors ${
                basemap === b.id
                  ? "bg-[#65D9E8] text-[#0A0D10] font-bold"
                  : "text-[#929DA5] hover:text-[#E7EAEC]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Zoom & Fit Route Action Buttons */}
        <div className="flex items-center gap-1 rounded-md border border-[#30383E] bg-[#111519]/90 backdrop-blur-md p-1 shadow-lg text-xs">
          <button
            onClick={() => map.current?.zoomIn()}
            className="p-1 rounded text-[#929DA5] hover:text-[#65D9E8] hover:bg-[#191F24] transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => map.current?.zoomOut()}
            className="p-1 rounded text-[#929DA5] hover:text-[#65D9E8] hover:bg-[#191F24] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-4 bg-[#30383E]" />
          <button
            onClick={fitRoute}
            className="px-2 py-1 rounded text-[10px] font-bold text-[#65D9E8] hover:bg-[#191F24] flex items-center gap-1 transition-colors"
            title="Fit Selected Route to Viewport"
          >
            <Scan className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">FIT ROUTE</span>
          </button>
        </div>

        {/* Route Filter Mode Toggle: [Selected Route Only] [Show All Cameras] */}
        {onToggleShowAllCameras && (
          <div className="flex items-center gap-1 rounded-md border border-[#30383E] bg-[#111519]/90 backdrop-blur-md p-1 shadow-lg text-[10px]">
            <button
              onClick={() => onToggleShowAllCameras(false)}
              className={`px-2 py-0.5 rounded transition-colors ${
                !showAllCameras
                  ? "bg-[#65D9E8] text-[#0A0D10] font-bold shadow-xs"
                  : "text-[#929DA5] hover:text-[#E7EAEC]"
              }`}
              title="Show only cameras and route for selected vehicle"
            >
              Selected Route Only
            </button>
            <button
              onClick={() => onToggleShowAllCameras(true)}
              className={`px-2 py-0.5 rounded transition-colors ${
                showAllCameras
                  ? "bg-[#65D9E8] text-[#0A0D10] font-bold shadow-xs"
                  : "text-[#929DA5] hover:text-[#E7EAEC]"
              }`}
              title="Display complete camera network in the background"
            >
              Show All Cameras
            </button>
          </div>
        )}

        {/* Full-Screen Toggle Button */}
        {onToggleFullScreen && (
          <button
            onClick={onToggleFullScreen}
            className="p-1.5 rounded-md border border-[#30383E] bg-[#111519]/90 hover:border-[#65D9E8] hover:text-[#65D9E8] text-[#929DA5] shadow-lg transition-colors"
            title={isFullScreen ? "Exit Full-Screen Map" : "Expand Full-Screen Map"}
          >
            {isFullScreen ? (
              <Minimize2 className="w-4 h-4 text-[#65D9E8]" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Tactical Route Legend */}
      <div className="absolute bottom-3 right-3 z-[500] hidden sm:flex items-center gap-3 rounded-md border border-[#30383E] bg-[#111519]/90 px-2.5 py-1 text-[10px] text-[#929DA5] backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#00E5FF] rounded" />
          <span>Reconstructed Route</span>
        </div>
        {showAllCameras && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b border-dashed border-[#64748B]" />
            <span>Topological Link</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#E74B42] animate-pulse" />
          <span>Target Vehicle</span>
        </div>
      </div>

      {/* Warning Banner: Visited Cameras Lacking WGS84 Coordinates */}
      {unmappedRouteCameras.length > 0 && (
        <div className="absolute top-16 left-3 z-[500] max-w-sm rounded-xl border border-[#F59E0B]/50 bg-[#080D14]/95 p-2.5 shadow-2xl backdrop-blur-md text-[11px]">
          <div className="flex items-center gap-1.5 text-[#FBBF24] font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>UNMAPPED SENSOR COORDINATES</span>
          </div>
          <p className="text-[#94A3B8] mt-1 text-[10px]">
            {unmappedRouteCameras.join(", ")} on this journey lack WGS84 spatial coordinates. Use Topological Mode to view full graph transitions without geographic omission.
          </p>
        </div>
      )}

      {/* Prompt When No Vehicle Is Selected */}
      {!vehicle && !showAllCameras && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-[#080D14]/85 backdrop-blur-sm p-6 text-center">
          <div className="max-w-md p-6 rounded-2xl border border-[#29384B] bg-[#111C2B] shadow-2xl space-y-3">
            <Car className="w-10 h-10 text-[#55D6E8] mx-auto animate-pulse" />
            <h3 className="font-bold text-sm text-[#F1F5F9] uppercase tracking-wide">
              No Vehicle Selected
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Select a vehicle subject from the toolbar above to display its isolated reconstructed trajectory route.
            </p>
            {onToggleShowAllCameras && (
              <button
                onClick={() => onToggleShowAllCameras(true)}
                className="px-3 py-1.5 rounded-lg bg-[#172437] border border-[#29384B] hover:border-[#55D6E8] text-[#55D6E8] text-xs font-bold transition-colors inline-block"
              >
                Or View All Cameras Overview
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
