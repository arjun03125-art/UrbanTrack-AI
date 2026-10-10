"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Camera as CameraIcon,
  Compass,
  Layers,
  Eye,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  Radio,
  Sliders,
} from "lucide-react";
import { Camera, CameraNetwork, GlobalVehicle, Observation } from "@/types";
import { SafeText } from "./DataModeBadge";
import { createResilientTileLayer } from "@/lib/mapTiles";

interface GeographicMapProps {
  cameras: Camera[];
  network: CameraNetwork | null;
  selectedVehicle: GlobalVehicle | null;
  observations?: Observation[];
  onSelectCamera?: (cameraId: string) => void;
  activeStepIndex?: number;
  onStepChange?: (index: number) => void;
}

export function GeographicNetworkMap({
  cameras,
  network,
  selectedVehicle,
  observations = [],
  onSelectCamera,
  activeStepIndex = 0,
  onStepChange,
}: GeographicMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups for toggle management
  const camerasLayerRef = useRef<L.LayerGroup | null>(null);
  const observedTrajectoryLayerRef = useRef<L.LayerGroup | null>(null);
  const possibleRoutesLayerRef = useRef<L.LayerGroup | null>(null);
  const associationLayerRef = useRef<L.LayerGroup | null>(null);

  // Toggles
  const [showCameras, setShowCameras] = useState(true);
  const [showObservedRoute, setShowObservedRoute] = useState(true);
  const [showPossibleRoutes, setShowPossibleRoutes] = useState(true);
  const [showAssociations, setShowAssociations] = useState(true);
  const [tileMode, setTileMode] = useState<"osm" | "esri-satellite" | "esri-streets">("osm");
  const [inspectedStep, setInspectedStep] = useState<number>(activeStepIndex);

  // Identify located vs unlocated cameras strictly
  const locatedCameras = cameras.filter(
    (c) =>
      typeof c.latitude === "number" &&
      typeof c.longitude === "number" &&
      !isNaN(c.latitude) &&
      !isNaN(c.longitude)
  );

  const unlocatedCameras = cameras.filter(
    (c) =>
      typeof c.latitude !== "number" ||
      typeof c.longitude !== "number" ||
      isNaN(c.latitude as number) ||
      isNaN(c.longitude as number)
  );

  // Coordinate lookup by camera ID
  const camCoords: Record<string, [number, number]> = {};
  locatedCameras.forEach((c) => {
    camCoords[c.camera_id] = [c.latitude as number, c.longitude as number];
  });

  const isSingleCamera = selectedVehicle
    ? selectedVehicle.tracking_type === "single_camera" ||
      new Set(selectedVehicle.cameras_visited).size <= 1
    : false;

  // 1. INITIALIZE LEAFLET MAP
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    // Default center around located cameras or South Bangalore corridor
    const defaultCenter: [number, number] =
      locatedCameras.length > 0
        ? [locatedCameras[0].latitude as number, locatedCameras[0].longitude as number]
        : [12.898, 77.641];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    mapInstanceRef.current = map;

    // Resilient Keyless Tile Layer
    const initialTile = createResilientTileLayer(tileMode);
    initialTile.addTo(map);

    // Initialize LayerGroups
    camerasLayerRef.current = L.layerGroup().addTo(map);
    observedTrajectoryLayerRef.current = L.layerGroup().addTo(map);
    possibleRoutesLayerRef.current = L.layerGroup().addTo(map);
    associationLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. TOGGLE TILE LAYER
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const newTile = createResilientTileLayer(tileMode);
    newTile.addTo(map);

    // Ensure layers are above tiles
    const bringGroupToFront = (g: L.LayerGroup | null) => {
      if (g) g.eachLayer((l: any) => l.bringToFront?.());
    };
    bringGroupToFront(camerasLayerRef.current);
    bringGroupToFront(observedTrajectoryLayerRef.current);
    bringGroupToFront(possibleRoutesLayerRef.current);
    bringGroupToFront(associationLayerRef.current);
  }, [tileMode]);

  // 3. RENDER OVERLAYS (Cameras, Observed Trajectory, Possible Routes, Associations)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous layers
    camerasLayerRef.current?.clearLayers();
    observedTrajectoryLayerRef.current?.clearLayers();
    possibleRoutesLayerRef.current?.clearLayers();
    associationLayerRef.current?.clearLayers();

    // Set of camera IDs visited by the selected vehicle
    const visitedSet = new Set(selectedVehicle?.cameras_visited || []);
    const lastCameraId =
      selectedVehicle && selectedVehicle.trajectory.length > 0
        ? selectedVehicle.trajectory[selectedVehicle.trajectory.length - 1].camera_id
        : null;

    // --- A. CAMERA LOCATION MARKERS ---
    if (showCameras && camerasLayerRef.current) {
      locatedCameras.forEach((cam) => {
        const isVisited = visitedSet.has(cam.camera_id);
        const isActiveCam =
          selectedVehicle &&
          selectedVehicle.trajectory[inspectedStep]?.camera_id === cam.camera_id;

        // Custom HTML Marker Icon
        const iconHtml = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px;">
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: ${isActiveCam ? "#0369a1" : isVisited ? "#0e7490" : "#18181b"};
              border: 2px solid ${isActiveCam ? "#38bdf8" : isVisited ? "#06b6d4" : "#52525b"};
              box-shadow: 0 4px 12px rgba(0,0,0,0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: monospace;
              font-size: 10px;
              font-weight: bold;
              color: #ffffff;
            ">
              ${cam.camera_id}
            </div>
            ${
              isActiveCam
                ? `<div style="
                    position: absolute;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: 2px solid #38bdf8;
                    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                  "></div>`
                : ""
            }
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "custom-camera-marker",
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const marker = L.marker([cam.latitude as number, cam.longitude as number], {
          icon: customIcon,
        });

        // Popup content with real diagnostics
        const popupContent = `
          <div style="font-family: sans-serif; font-size: 12px; color: #1e293b; padding: 4px; min-width: 180px;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
              <strong style="font-family: monospace; font-size: 13px; color: #0f172a;">${cam.camera_id}</strong>
              <span style="font-size: 9px; font-family: monospace; background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #a7f3d0;">
                ${cam.status}
              </span>
            </div>
            <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
              ${cam.name || "CCTV Sensor Node"}
            </div>
            <div style="font-size: 10px; color: #64748b; margin-bottom: 6px;">
              ${cam.location_description || "Traffic corridor monitoring"}
            </div>
            <div style="font-family: monospace; font-size: 10px; background: #f8fafc; padding: 6px; border-radius: 4px; border: 1px solid #e2e8f0; line-height: 1.5;">
              <div>WGS84: ${cam.latitude?.toFixed(5)}, ${cam.longitude?.toFixed(5)}</div>
              <div>Observed Vehicles: <strong>${cam.vehicles_observed}</strong></div>
              <div>Total Detections: <strong>${cam.total_observations}</strong></div>
              <div>Frame Rate: <strong>${cam.fps || 30} FPS</strong></div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on("click", () => {
          if (onSelectCamera) onSelectCamera(cam.camera_id);
        });

        camerasLayerRef.current?.addLayer(marker);
      });
    }

    // --- B. OBSERVED TRAJECTORY (SOLID BLUE) ---
    if (
      showObservedRoute &&
      observedTrajectoryLayerRef.current &&
      selectedVehicle &&
      !isSingleCamera &&
      selectedVehicle.trajectory.length > 1
    ) {
      const trajCoords: [number, number][] = [];
      selectedVehicle.trajectory.forEach((step) => {
        if (camCoords[step.camera_id]) {
          trajCoords.push(camCoords[step.camera_id]);
        }
      });

      if (trajCoords.length > 1) {
        // Solid Blue Observed Trajectory Polyline
        const observedPolyline = L.polyline(trajCoords, {
          color: "#38bdf8", // Sky / Blue
          weight: 4,
          opacity: 0.95,
          lineJoin: "round",
          lineCap: "round",
        });

        observedPolyline.bindPopup(`
          <div style="font-family: monospace; font-size: 11px; padding: 4px;">
            <div style="font-weight: bold; color: #0284c7; margin-bottom: 4px;">
              Observed Multi-Camera Trajectory
            </div>
            <div>Vehicle: <strong>${selectedVehicle.global_vehicle_id}</strong></div>
            <div>Route: ${selectedVehicle.cameras_visited.join(" → ")}</div>
            <div>Hops: ${selectedVehicle.trajectory.length - 1} transitions</div>
          </div>
        `);

        observedTrajectoryLayerRef.current.addLayer(observedPolyline);

        // Add Direction Arrows & Sequence Step Badges along the path
        selectedVehicle.trajectory.forEach((step, idx) => {
          const pt = camCoords[step.camera_id];
          if (!pt) return;

          const stepBadgeHtml = `
            <div style="
              background: #0284c7;
              color: #ffffff;
              border: 1px solid #38bdf8;
              border-radius: 10px;
              padding: 1px 6px;
              font-family: monospace;
              font-size: 9px;
              font-weight: bold;
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0,0,0,0.5);
              transform: translate(-50%, -24px);
            ">
              #${step.step} ${step.timestamp ? step.timestamp.split("T")[1]?.replace("Z", "") : ""}
            </div>
          `;

          const stepIcon = L.divIcon({
            html: stepBadgeHtml,
            className: "trajectory-step-badge",
            iconSize: [60, 20],
            iconAnchor: [30, 24],
          });

          const stepMarker = L.marker(pt, { icon: stepIcon });
          observedTrajectoryLayerRef.current?.addLayer(stepMarker);
        });
      }
    }

    // --- C. POSSIBLE ONWARD ROUTES (DASHED YELLOW) ---
    if (showPossibleRoutes && possibleRoutesLayerRef.current && lastCameraId && network) {
      // Find network edges departing from the last observed camera
      const downstreamEdges = network.edges.filter((e) => e.source === lastCameraId);

      downstreamEdges.forEach((edge) => {
        const srcPt = camCoords[edge.source];
        const tgtPt = camCoords[edge.target];

        if (srcPt && tgtPt) {
          const possiblePolyline = L.polyline([srcPt, tgtPt], {
            color: "#facc15", // Yellow
            weight: 3,
            opacity: 0.9,
            dashArray: "8, 8",
            lineCap: "round",
          });

          possiblePolyline.bindPopup(`
            <div style="font-family: monospace; font-size: 11px; padding: 4px;">
              <div style="font-weight: bold; color: #ca8a04; margin-bottom: 4px;">
                Possible Onward Route (Downstream Network Edge)
              </div>
              <div>From: <strong>${edge.source}</strong> → To: <strong>${edge.target}</strong></div>
              <div>Historical Vehicle Flow: <strong>${edge.vehicle_flow_count} vehicles</strong></div>
              <div style="color: #64748b; font-size: 10px; margin-top: 4px;">
                Topology-supported candidate corridor.
              </div>
            </div>
          `);

          possibleRoutesLayerRef.current?.addLayer(possiblePolyline);
        }
      });
    }

    // --- D. ASSOCIATION STATUS OVERLAYS (GREEN / YELLOW / RED) ---
    if (
      showAssociations &&
      associationLayerRef.current &&
      selectedVehicle &&
      !isSingleCamera &&
      selectedVehicle.trajectory.length > 1
    ) {
      // Color association based on confidence value
      const conf = selectedVehicle.association_confidence;
      let assocColor = "#10b981"; // Green (confirmed)
      let assocLabel = "Confirmed Multi-Camera Association";

      if (conf === null || conf < 0.7) {
        assocColor = "#ef4444"; // Red (rejected/unmatched)
        assocLabel = "Rejected / Unconfirmed Association";
      } else if (conf < 0.85) {
        assocColor = "#eab308"; // Yellow (candidate)
        assocLabel = "Candidate Association Cluster";
      }

      for (let i = 0; i < selectedVehicle.trajectory.length - 1; i++) {
        const src = selectedVehicle.trajectory[i].camera_id;
        const tgt = selectedVehicle.trajectory[i + 1].camera_id;

        const srcPt = camCoords[src];
        const tgtPt = camCoords[tgt];

        if (srcPt && tgtPt) {
          const assocLine = L.polyline([srcPt, tgtPt], {
            color: assocColor,
            weight: 2,
            opacity: 0.75,
            dashArray: "4, 6",
          });

          assocLine.bindTooltip(
            `${assocLabel}: ${conf !== null ? (conf * 100).toFixed(0) + "%" : "N/A"}`,
            { sticky: true }
          );

          associationLayerRef.current.addLayer(assocLine);
        }
      }
    }

    // --- FIT BOUNDS TO ACTIVE DATA ---
    const allActiveCoords: [number, number][] = [];
    if (selectedVehicle) {
      selectedVehicle.cameras_visited.forEach((cId) => {
        if (camCoords[cId]) allActiveCoords.push(camCoords[cId]);
      });
    } else {
      locatedCameras.forEach((c) => {
        allActiveCoords.push([c.latitude as number, c.longitude as number]);
      });
    }

    if (allActiveCoords.length > 0 && map.getSize().x > 50 && map.getSize().y > 50) {
      map.fitBounds(L.latLngBounds(allActiveCoords), {
        padding: [45, 45],
        maxZoom: 15,
      });
    }
  }, [
    cameras,
    network,
    selectedVehicle,
    inspectedStep,
    showCameras,
    showObservedRoute,
    showPossibleRoutes,
    showAssociations,
  ]);

  // Synchronize map pan when inspectedStep changes
  const handleStepSelect = (idx: number) => {
    setInspectedStep(idx);
    if (onStepChange) onStepChange(idx);

    if (selectedVehicle && selectedVehicle.trajectory[idx]) {
      const cId = selectedVehicle.trajectory[idx].camera_id;
      if (camCoords[cId] && mapInstanceRef.current) {
        mapInstanceRef.current.panTo(camCoords[cId], { animate: true });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Top Map Toolbar: Layer Controls & Toggles */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          <span className="font-mono font-bold text-slate-900 tracking-wide">
            2D GEOGRAPHIC CAMERA NETWORK
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-300 font-semibold">
            WGS84 Coordinates
          </span>
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-slate-700 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 shadow-xs">
            <input
              type="checkbox"
              checked={showCameras}
              onChange={(e) => setShowCameras(e.target.checked)}
              className="rounded accent-blue-600 w-3.5 h-3.5"
            />
            <span>Cameras</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-blue-700 px-2 py-1 rounded bg-blue-50 border border-blue-200 hover:bg-blue-100/80 shadow-xs">
            <input
              type="checkbox"
              checked={showObservedRoute}
              onChange={(e) => setShowObservedRoute(e.target.checked)}
              className="rounded accent-blue-600 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-blue-500"></span>
              Observed (Blue)
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-amber-800 px-2 py-1 rounded bg-amber-50 border border-amber-200 hover:bg-amber-100/80 shadow-xs">
            <input
              type="checkbox"
              checked={showPossibleRoutes}
              onChange={(e) => setShowPossibleRoutes(e.target.checked)}
              className="rounded accent-amber-500 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 border-t border-dashed border-amber-500"></span>
              Possible (Dashed)
            </span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[11px] text-emerald-800 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/80 shadow-xs">
            <input
              type="checkbox"
              checked={showAssociations}
              onChange={(e) => setShowAssociations(e.target.checked)}
              className="rounded accent-emerald-600 w-3.5 h-3.5"
            />
            <span>Re-ID Status</span>
          </label>

          {/* Tile Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300">
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
                onClick={() => setTileMode(b.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all ${
                  tileMode === b.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Unlocated Cameras Alert Notice (Strict Geographic Integrity Guarantee) */}
      {unlocatedCameras.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Geographic Data Integrity:</strong> {unlocatedCameras.length} camera sensor node(s) (
            {unlocatedCameras.map((c) => c.camera_id).join(", ")}) lack verified WGS84 coordinates from upstream pipeline. They are marked as <em>unlocated</em> rather than placed arbitrarily on the map.
          </span>
        </div>
      )}

      {/* Leaflet Map Canvas Container */}
      <div className="relative flex-1 w-full min-h-[420px]">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Route Semantics Legend */}
        <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md border border-slate-300 p-3.5 rounded-xl shadow-lg text-[11px] font-mono space-y-2 pointer-events-auto max-w-xs">
          <div className="font-bold text-slate-900 uppercase text-[10px] pb-1.5 border-b border-slate-200 flex items-center justify-between">
            <span>Route Semantics Legend</span>
            <Compass className="w-3.5 h-3.5 text-blue-600" />
          </div>

          <div className="space-y-1.5 text-slate-700 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 bg-sky-500 rounded-full"></span>
              <span>Solid Blue: Observed Trajectory</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-0 border-t-2 border-dashed border-amber-500"></span>
              <span>Dashed Yellow: Possible Onward Route</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Green: Confirmed Re-ID (≥85%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Yellow: Candidate Re-ID (70-84%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Red: Rejected / Guarded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Time-Based Observation Stepper / Inspection Bar */}
      {selectedVehicle && selectedVehicle.trajectory.length > 0 && (
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-mono text-slate-600 text-[11px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Observation Time Scrub:
            </span>

            <div className="flex gap-1.5">
              {selectedVehicle.trajectory.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => handleStepSelect(idx)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all shadow-xs ${
                    inspectedStep === idx
                      ? "bg-blue-600 text-white shadow-sm scale-105"
                      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  #{step.step} {step.camera_id}
                </button>
              ))}
            </div>
          </div>

          {/* Active Observation Quick Telemetry */}
          {selectedVehicle.trajectory[inspectedStep] && (
            <div className="font-mono text-[11px] text-slate-700 flex items-center gap-3">
              <span>
                Sensor: <strong className="text-blue-700">{selectedVehicle.trajectory[inspectedStep].camera_id}</strong>
              </span>
              <span>
                Track: <strong className="text-slate-900">#{selectedVehicle.trajectory[inspectedStep].track_id}</strong>
              </span>
              <span>
                Time:{" "}
                <strong className="text-slate-800">
                  {selectedVehicle.trajectory[inspectedStep].timestamp
                    ? selectedVehicle.trajectory[inspectedStep].timestamp?.replace("T", " ").replace("Z", "")
                    : "N/A"}
                </strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
