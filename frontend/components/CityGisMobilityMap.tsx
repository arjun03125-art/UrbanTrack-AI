"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Compass,
  Layers,
  MapPin,
  Clock,
  Radio,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Camera as CameraIcon,
  Car,
  Eye,
  Maximize2,
  ExternalLink,
  RefreshCw,
  Crosshair,
} from "lucide-react";
import { Camera, CameraNetwork, GlobalVehicle, Observation } from "@/types";
import { createResilientTileLayer } from "@/lib/mapTiles";

interface CityGisMobilityMapProps {
  cameras: Camera[];
  network: CameraNetwork | null;
  vehicles: GlobalVehicle[];
  selectedVehicle: GlobalVehicle | null;
  selectedCameraId: string | null;
  onSelectVehicle: (vehicle: GlobalVehicle | null) => void;
  onSelectCamera: (cameraId: string | null) => void;
  filterCameraId?: string;
  filterVehicleType?: string;
  filterStatus?: string;
  showObservedRoutes?: boolean;
  showPossibleRoutes?: boolean;
  showAssociationStatus?: boolean;
  showBaselineNetwork?: boolean;
  activeStepIndex?: number;
  onStepChange?: (index: number) => void;
}

export function CityGisMobilityMap({
  cameras,
  network,
  vehicles,
  selectedVehicle,
  selectedCameraId,
  onSelectVehicle,
  onSelectCamera,
  filterCameraId = "ALL",
  filterVehicleType = "ALL",
  filterStatus = "ALL",
  showObservedRoutes = true,
  showPossibleRoutes = true,
  showAssociationStatus = true,
  showBaselineNetwork = true,
  activeStepIndex = 0,
  onStepChange,
}: CityGisMobilityMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups
  const camerasLayerRef = useRef<L.LayerGroup | null>(null);
  const baselineNetworkLayerRef = useRef<L.LayerGroup | null>(null);
  const observedTrajLayerRef = useRef<L.LayerGroup | null>(null);
  const possibleRoutesLayerRef = useRef<L.LayerGroup | null>(null);
  const associationLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkerLayerRef = useRef<L.LayerGroup | null>(null);

  // User interaction tracking
  const hasUserInteractedRef = useRef<boolean>(false);
  const lastSelectionIdRef = useRef<string | null>(null);

  const [mapTheme, setMapTheme] = useState<"osm" | "satellite" | "streets">("osm");
  const [tilesLoading, setTilesLoading] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // Separate located vs unlocated cameras strictly (Geographic Integrity)
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

  const camCoords: Record<string, [number, number]> = {};
  locatedCameras.forEach((c) => {
    camCoords[c.camera_id] = [c.latitude as number, c.longitude as number];
  });

  const isSingleCamera = selectedVehicle
    ? selectedVehicle.tracking_type === "single_camera" ||
      new Set(selectedVehicle.cameras_visited).size <= 1
    : false;

  // 1. INITIALIZE MAP & TILE LAYER
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (mapInstanceRef.current) return;

    try {
      // Calculate mean centroid of available cameras if coordinates exist
      let initialCenter: [number, number] = [12.89803, 77.64155]; // Bangalore Corridor
      if (locatedCameras.length > 0) {
        const sumLat = locatedCameras.reduce((acc, c) => acc + (c.latitude as number), 0);
        const sumLng = locatedCameras.reduce((acc, c) => acc + (c.longitude as number), 0);
        initialCenter = [sumLat / locatedCameras.length, sumLng / locatedCameras.length];
      }

      const map = L.map(container, {
        center: initialCenter,
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
        fadeAnimation: true,
        zoomAnimation: true,
      });

      mapInstanceRef.current = map;

      // Listen for user interaction to preserve manual zoom/pan
      map.on("dragstart", () => {
        hasUserInteractedRef.current = true;
      });
      map.on("zoomstart", (e) => {
        if (e.target && !e.target._animatingZoom) {
          hasUserInteractedRef.current = true;
        }
      });

      const tileProviderId = mapTheme === "satellite" ? "esri-satellite" : mapTheme === "streets" ? "esri-streets" : "osm";
      const tileLayer = createResilientTileLayer(tileProviderId);

      tileLayer.on("loading", () => setTilesLoading(true));
      tileLayer.on("load", () => setTilesLoading(false));
      tileLayer.on("tileerror", (e) => {
        console.warn("Tile load error:", e);
      });

      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;

      // Layer groups
      baselineNetworkLayerRef.current = L.layerGroup().addTo(map);
      possibleRoutesLayerRef.current = L.layerGroup().addTo(map);
      associationLayerRef.current = L.layerGroup().addTo(map);
      observedTrajLayerRef.current = L.layerGroup().addTo(map);
      camerasLayerRef.current = L.layerGroup().addTo(map);
      vehicleMarkerLayerRef.current = L.layerGroup().addTo(map);

      // CRITICAL: Robust ResizeObserver to prevent blank 0x0 container
      const resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
        }
      });
      resizeObserver.observe(container);

      // Multiple staggered invalidateSize passes
      setTimeout(() => map.invalidateSize(), 50);
      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 600);

      return () => {
        resizeObserver.disconnect();
        map.remove();
        mapInstanceRef.current = null;
      };
    } catch (err: unknown) {
      console.error("Map initialization failed:", err);
      setMapError(err instanceof Error ? err.message : "Map initialization error");
    }
  }, []);

  // 2. THEME SWITCHER
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);

    const tileProviderId = mapTheme === "satellite" ? "esri-satellite" : mapTheme === "streets" ? "esri-streets" : "osm";
    const newLayer = createResilientTileLayer(tileProviderId);

    newLayer.on("loading", () => setTilesLoading(true));
    newLayer.on("load", () => setTilesLoading(false));
    newLayer.addTo(map);
    tileLayerRef.current = newLayer;

    // Bring vector layers to front
    const bringGroupToFront = (g: L.LayerGroup | null) => {
      if (g) g.eachLayer((l: any) => l.bringToFront?.());
    };
    bringGroupToFront(baselineNetworkLayerRef.current);
    bringGroupToFront(possibleRoutesLayerRef.current);
    bringGroupToFront(associationLayerRef.current);
    bringGroupToFront(observedTrajLayerRef.current);
    bringGroupToFront(camerasLayerRef.current);
    bringGroupToFront(vehicleMarkerLayerRef.current);

    setTimeout(() => map.invalidateSize(), 50);
  }, [mapTheme]);

  // 3. RENDER ALL GIS MOBILITY LAYERS & FIT BOUNDS
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.invalidateSize();

    // Clear previous layers safely
    camerasLayerRef.current?.clearLayers();
    baselineNetworkLayerRef.current?.clearLayers();
    observedTrajLayerRef.current?.clearLayers();
    possibleRoutesLayerRef.current?.clearLayers();
    associationLayerRef.current?.clearLayers();
    vehicleMarkerLayerRef.current?.clearLayers();

    // LAYER A: BASELINE CORRIDORS (GREY EDGES WITH FLOW BADGES)
    if (showBaselineNetwork && network && baselineNetworkLayerRef.current) {
      network.edges.forEach((edge) => {
        const src = camCoords[edge.source];
        const tgt = camCoords[edge.target];
        if (src && tgt) {
          const corridorLine = L.polyline([src, tgt], {
            color: "#64748b",
            weight: 2.5,
            opacity: 0.65,
            dashArray: "4, 6",
          });

          corridorLine.bindTooltip(
            `Corridor: ${edge.source} → ${edge.target} (${edge.vehicle_flow_count} flow count)`,
            { sticky: true }
          );

          baselineNetworkLayerRef.current?.addLayer(corridorLine);

          // Flow count midpoint badge with explicit iconSize & anchor
          const midLat = (src[0] + tgt[0]) / 2;
          const midLng = (src[1] + tgt[1]) / 2;
          const badgeHtml = `
            <div style="
              background: #ffffff;
              color: #334155;
              border: 1px solid #cbd5e1;
              padding: 1px 5px;
              border-radius: 4px;
              font-family: monospace;
              font-size: 9px;
              font-weight: 700;
              box-shadow: 0 1px 4px rgba(0,0,0,0.18);
              white-space: nowrap;
              text-align: center;
            ">
              ${edge.vehicle_flow_count} veh
            </div>
          `;
          const badgeIcon = L.divIcon({
            html: badgeHtml,
            className: "flow-badge-icon",
            iconSize: [56, 20],
            iconAnchor: [28, 10],
          });
          baselineNetworkLayerRef.current?.addLayer(L.marker([midLat, midLng], { icon: badgeIcon }));
        }
      });
    }

    // LAYER B: OBSERVED VEHICLE TRAJECTORY (SOLID BLUE)
    if (
      showObservedRoutes &&
      observedTrajLayerRef.current &&
      selectedVehicle &&
      !isSingleCamera &&
      selectedVehicle.trajectory.length > 1
    ) {
      const trajPoints: [number, number][] = [];
      selectedVehicle.trajectory.forEach((step) => {
        if (camCoords[step.camera_id]) {
          trajPoints.push(camCoords[step.camera_id]);
        }
      });

      if (trajPoints.length > 1) {
        const trajPolyline = L.polyline(trajPoints, {
          color: "#0284c7",
          weight: 5.5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        });

        trajPolyline.bindPopup(`
          <div style="font-family: monospace; font-size: 11px; padding: 4px;">
            <div style="font-weight: bold; color: #0284c7; font-size: 12px; margin-bottom: 4px;">
              Observed Multi-Camera Trajectory
            </div>
            <div>Vehicle: <strong>${selectedVehicle.global_vehicle_id}</strong> (${selectedVehicle.vehicle_type})</div>
            <div>Sequence: <strong>${selectedVehicle.cameras_visited.join(" → ")}</strong></div>
            <div>Hops: <strong>${selectedVehicle.trajectory.length - 1} cross-camera transitions</strong></div>
            <div style="margin-top: 4px; font-size: 10px; color: #64748b;">
              * Straight lines denote camera-to-camera association vectors between camera nodes.
            </div>
          </div>
        `);

        observedTrajLayerRef.current.addLayer(trajPolyline);

        // Direction Arrows & Timestamps with explicit iconSize & anchor
        selectedVehicle.trajectory.forEach((step) => {
          const pt = camCoords[step.camera_id];
          if (!pt) return;

          const stepHtml = `
            <div style="
              background: #0284c7;
              color: #ffffff;
              border: 1.5px solid #ffffff;
              border-radius: 12px;
              padding: 1px 7px;
              font-family: monospace;
              font-size: 9px;
              font-weight: bold;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              text-align: center;
            ">
              #${step.step} ${step.timestamp ? step.timestamp.split("T")[1]?.replace("Z", "") : ""}
            </div>
          `;
          const stepIcon = L.divIcon({
            html: stepHtml,
            className: "step-badge-icon",
            iconSize: [80, 22],
            iconAnchor: [40, 24],
          });
          observedTrajLayerRef.current?.addLayer(L.marker(pt, { icon: stepIcon }));
        });
      }
    }

    // LAYER C: POSSIBLE ONWARD TRANSITIONS (DASHED AMBER)
    const lastCameraId =
      selectedVehicle && selectedVehicle.trajectory.length > 0
        ? selectedVehicle.trajectory[selectedVehicle.trajectory.length - 1].camera_id
        : null;

    if (showPossibleRoutes && possibleRoutesLayerRef.current && lastCameraId && network) {
      const downstreamEdges = network.edges.filter((e) => e.source === lastCameraId);

      downstreamEdges.forEach((edge) => {
        const src = camCoords[edge.source];
        const tgt = camCoords[edge.target];
        if (src && tgt) {
          const possibleLine = L.polyline([src, tgt], {
            color: "#eab308",
            weight: 3.5,
            opacity: 0.9,
            dashArray: "8, 8",
            lineCap: "round",
          });

          possibleLine.bindPopup(`
            <div style="font-family: monospace; font-size: 11px; padding: 4px;">
              <div style="font-weight: bold; color: #a16207; font-size: 12px; margin-bottom: 4px;">
                Possible route (from camera network, not a road route)
              </div>
              <div>From: <strong>${edge.source}</strong> → To: <strong>${edge.target}</strong></div>
              <div>Network Flow Support: <strong>${edge.vehicle_flow_count} vehicles</strong></div>
              <div style="color: #64748b; font-size: 10px; margin-top: 4px;">
                * Upstream-supported topological transition prediction based on corridor traffic matrix.
              </div>
            </div>
          `);

          possibleRoutesLayerRef.current?.addLayer(possibleLine);
        }
      });
    }

    // LAYER D: ASSOCIATION STATUS EVIDENCE (GREEN / AMBER / RED)
    if (
      showAssociationStatus &&
      associationLayerRef.current &&
      selectedVehicle &&
      !isSingleCamera &&
      selectedVehicle.trajectory.length > 1
    ) {
      // Colour comes from the pipeline's stated decision status, never from a score threshold.
      const status = (selectedVehicle.identity_status || "candidate").toLowerCase();
      let assocColor = "#d97706"; // Amber: candidate / ambiguous
      let assocLabel = "Candidate association (unconfirmed)";
      if (status === "confirmed") {
        assocColor = "#16a34a";
        assocLabel = "Confirmed association";
      } else if (status === "rejected") {
        assocColor = "#dc2626";
        assocLabel = "Rejected association";
      } else if (status === "guarded") {
        assocColor = "#64748b";
        assocLabel = "Guarded association (model incompatible)";
      }

      for (let i = 0; i < selectedVehicle.trajectory.length - 1; i++) {
        const src = selectedVehicle.trajectory[i].camera_id;
        const tgt = selectedVehicle.trajectory[i + 1].camera_id;
        const srcPt = camCoords[src];
        const tgtPt = camCoords[tgt];

        if (srcPt && tgtPt) {
          const assocLine = L.polyline([srcPt, tgtPt], {
            color: assocColor,
            weight: 2.5,
            opacity: 0.85,
            dashArray: "4, 6",
          });

          assocLine.bindTooltip(
            `${assocLabel} — association probability ${selectedVehicle.association_confidence != null ? (selectedVehicle.association_confidence * 100).toFixed(0) + "%" : "not available"}`,
            { sticky: true }
          );

          associationLayerRef.current.addLayer(assocLine);
        }
      }
    }

    // LAYER E: CCTV CAMERA LOCATION NODES (WGS84)
    if (camerasLayerRef.current) {
      locatedCameras.forEach((cam) => {
        const isSelectedCam = selectedCameraId === cam.camera_id;
        const isVisitedByVehicle = selectedVehicle?.cameras_visited.includes(cam.camera_id);
        const isActiveInspectionStep =
          selectedVehicle &&
          selectedVehicle.trajectory[activeStepIndex]?.camera_id === cam.camera_id;

        let markerBg = "#ffffff";
        let markerBorder = "#0284c7";
        let textColor = "#0f172a";

        if (isActiveInspectionStep || isSelectedCam) {
          markerBg = "#0284c7";
          markerBorder = "#ffffff";
          textColor = "#ffffff";
        } else if (isVisitedByVehicle) {
          markerBg = "#e0f2fe";
          markerBorder = "#0284c7";
          textColor = "#0369a1";
        }

        const iconHtml = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
            <div style="
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background: ${markerBg};
              border: 2.5px solid ${markerBorder};
              box-shadow: 0 4px 14px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: monospace;
              font-size: 10px;
              font-weight: 800;
              color: ${textColor};
              cursor: pointer;
            ">
              ${cam.camera_id}
            </div>
          </div>
        `;

        const camIcon = L.divIcon({
          html: iconHtml,
          className: "gis-camera-marker",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const marker = L.marker([cam.latitude as number, cam.longitude as number], {
          icon: camIcon,
          zIndexOffset: isActiveInspectionStep || isSelectedCam ? 1000 : 100,
        });

        marker.on("click", () => {
          onSelectCamera(cam.camera_id);
        });

        const popupContent = `
          <div style="font-family: sans-serif; font-size: 12px; color: #0f172a; padding: 4px; min-width: 220px;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-family: monospace; font-size: 13px; font-weight: bold; color: #0284c7;">${cam.camera_id}</span>
                <span style="font-size: 9px; font-family: monospace; background: #ecfdf5; color: #047857; padding: 1.5px 5px; border-radius: 4px; font-weight: bold;">
                  ${cam.status}
                </span>
              </div>
            </div>
            <div style="font-weight: 600; font-size: 12px; color: #1e293b; margin-bottom: 2px;">
              ${cam.name || "CCTV Traffic Sensor Node"}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
              ${cam.location_description || "Traffic corridor"}
            </div>
            <div style="font-family: monospace; font-size: 10px; background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0; line-height: 1.6;">
              <div>WGS84 Coordinates: <strong>${cam.latitude?.toFixed(5)}°N, ${cam.longitude?.toFixed(5)}°E</strong></div>
              <div>Vehicles Identified: <strong>${cam.vehicles_observed}</strong></div>
              <div>Total Observations: <strong>${cam.total_observations}</strong></div>
              <div>Sensor FPS: <strong>${cam.fps || 30} FPS</strong></div>
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
        camerasLayerRef.current?.addLayer(marker);
      });
    }

    // LAYER F: SELECTED VEHICLE LIVE POSITION MARKER
    if (selectedVehicle && vehicleMarkerLayerRef.current) {
      const activeStep = selectedVehicle.trajectory[activeStepIndex] || selectedVehicle.trajectory[0];
      if (activeStep && camCoords[activeStep.camera_id]) {
        const pt = camCoords[activeStep.camera_id];
        const vIconHtml = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 8px;
              background: #0284c7;
              border: 2px solid #ffffff;
              box-shadow: 0 4px 12px rgba(2, 132, 199, 0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-family: monospace;
              font-size: 12px;
              font-weight: bold;
            ">
              🚗
            </div>
          </div>
        `;

        const vIcon = L.divIcon({
          html: vIconHtml,
          className: "active-vehicle-marker",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const vMarker = L.marker(pt, { icon: vIcon, zIndexOffset: 2000 });
        vMarker.bindTooltip(
          `Vehicle ${selectedVehicle.global_vehicle_id} (${selectedVehicle.vehicle_type}) at ${activeStep.camera_id}`,
          { permanent: false, sticky: true }
        );
        vehicleMarkerLayerRef.current.addLayer(vMarker);
      }
    }

    // AUTOMATIC BOUNDS FIT: Only adjust bounds when selection changes or on first load
    const currentSelectionId = selectedVehicle ? selectedVehicle.global_vehicle_id : selectedCameraId;
    const hasSelectionChanged = currentSelectionId !== lastSelectionIdRef.current;

    const mapSize = map.getSize();
    if (mapSize.x > 50 && mapSize.y > 50) {
      if (hasSelectionChanged || !hasUserInteractedRef.current) {
        lastSelectionIdRef.current = currentSelectionId;

        const targetPoints: [number, number][] = [];
        if (selectedVehicle) {
          selectedVehicle.cameras_visited.forEach((cid) => {
            if (camCoords[cid]) targetPoints.push(camCoords[cid]);
          });
        } else if (selectedCameraId && camCoords[selectedCameraId]) {
          targetPoints.push(camCoords[selectedCameraId]);
        } else {
          locatedCameras.forEach((c) => {
            targetPoints.push([c.latitude as number, c.longitude as number]);
          });
        }

        if (targetPoints.length === 1) {
          map.setView(targetPoints[0], 15, { animate: true });
        } else if (targetPoints.length > 1) {
          map.fitBounds(L.latLngBounds(targetPoints), {
            padding: [60, 60],
            maxZoom: 15,
          });
        }
      }
    }
  }, [
    cameras,
    network,
    selectedVehicle,
    selectedCameraId,
    activeStepIndex,
    showBaselineNetwork,
    showObservedRoutes,
    showPossibleRoutes,
    showAssociationStatus,
    mapTheme,
  ]);

  // Focus Selection Control
  const handleFocusSelection = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.invalidateSize();
    hasUserInteractedRef.current = false; // reset flag on explicit click

    if (selectedVehicle) {
      const pts = selectedVehicle.cameras_visited
        .map((cid) => camCoords[cid])
        .filter(Boolean) as [number, number][];

      if (pts.length === 1) {
        map.setView(pts[0], 15, { animate: true });
      } else if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15 });
      }
    } else if (selectedCameraId && camCoords[selectedCameraId]) {
      map.setView(camCoords[selectedCameraId], 15, { animate: true });
    } else if (locatedCameras.length > 0) {
      const pts = locatedCameras.map((c) => [c.latitude as number, c.longitude as number] as [number, number]);
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60] });
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-50 border border-slate-300 rounded-2xl overflow-hidden shadow-xl select-none min-h-[500px]">
      {/* Top Map Toolbar */}
      <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-mono font-bold text-slate-900 tracking-wide text-xs">
            2D GIS — Geographic Mobility Map
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
            OpenStreetMap • WGS84
          </span>
          {tilesLoading && (
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Loading tiles...
            </span>
          )}
        </div>

        {/* Map Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Focus Selection Button */}
          <button
            onClick={handleFocusSelection}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-mono font-bold border border-blue-200 transition-colors shadow-xs"
            title="Focus map camera on currently selected vehicle or camera"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Focus Selection
          </button>

          {/* Reset / Center Map Button */}
          <button
            onClick={() => {
              if (mapInstanceRef.current && locatedCameras.length > 0) {
                hasUserInteractedRef.current = false;
                mapInstanceRef.current.invalidateSize();
                const pts = locatedCameras.map(
                  (c) => [c.latitude as number, c.longitude as number] as [number, number]
                );
                mapInstanceRef.current.fitBounds(L.latLngBounds(pts), { padding: [60, 60] });
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-mono border border-slate-300 transition-colors shadow-xs"
            title="Recenter corridor over all Bangalore sensor nodes"
          >
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            Recenter Corridor
          </button>

          {/* Map Theme Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300">
            <button
              onClick={() => setMapTheme("osm")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition-all ${
                mapTheme === "osm"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setMapTheme("satellite")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition-all ${
                mapTheme === "satellite"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapTheme("streets")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition-all ${
                mapTheme === "streets"
                  ? "bg-blue-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Streets
            </button>
          </div>
        </div>
      </div>

      {/* Unlocated Cameras Alert Notice */}
      {unlocatedCameras.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-900 z-30 flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Geographic Data Integrity:</strong> {unlocatedCameras.length} sensor node(s) (
            {unlocatedCameras.map((c) => c.camera_id).join(", ")}) have no valid latitude/longitude in the loaded data and are marked as unlocated.
          </span>
        </div>
      )}

      {/* Actionable Empty State if 0 cameras located */}
      {locatedCameras.length === 0 && (
        <div className="p-8 text-center bg-white border border-slate-300 rounded-xl m-4 z-20">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">No Georeferenced Cameras Available</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            None of the cameras in the active dataset have valid latitude/longitude coordinates.
            To place camera nodes on the geographic map, provide valid coordinates in the dataset.
          </p>
        </div>
      )}

      {/* Map Error Notice */}
      {mapError && (
        <div className="px-4 py-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-center justify-between z-30">
          <span>Failed to initialize GIS engine: {mapError}</span>
          <button
            onClick={() => window.location.reload()}
            className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
          >
            Reload
          </button>
        </div>
      )}

      {/* Primary Leaflet Map Container */}
      <div className="relative flex-1 w-full min-h-[460px]">
        <div
          ref={mapContainerRef}
          style={{ width: "100%", height: "100%", minHeight: "460px", position: "relative" }}
          className="z-10"
        />

        {/* Time-Based Observation Stepper (When vehicle is selected) */}
        {selectedVehicle && selectedVehicle.trajectory.length > 0 && (
          <div className="absolute top-4 right-4 z-20 bg-white/95 backdrop-blur-md border border-slate-300 p-3 rounded-xl shadow-xl text-xs font-mono space-y-2 pointer-events-auto max-w-sm">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Observation Timeline
              </span>
              <span className="text-[10px] text-blue-700 font-bold">
                {selectedVehicle.global_vehicle_id}
              </span>
            </div>

            <div className="flex gap-1.5">
              {selectedVehicle.trajectory.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (onStepChange) onStepChange(idx);
                    const cId = step.camera_id;
                    if (camCoords[cId] && mapInstanceRef.current) {
                      mapInstanceRef.current.panTo(camCoords[cId], { animate: true });
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    activeStepIndex === idx
                      ? "bg-blue-600 text-white shadow-sm scale-105"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  #{step.step} {step.camera_id}
                </button>
              ))}
            </div>

            {selectedVehicle.trajectory[activeStepIndex] && (
              <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-100 flex justify-between">
                <span>
                  Track: <strong>#{selectedVehicle.trajectory[activeStepIndex].track_id}</strong>
                </span>
                <span>
                  Time:{" "}
                  <strong>
                    {selectedVehicle.trajectory[activeStepIndex].timestamp
                      ? selectedVehicle.trajectory[activeStepIndex].timestamp?.split("T")[1]?.replace("Z", "")
                      : "N/A"}
                  </strong>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Footer Note */}
      <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-500 font-mono gap-1 z-30 flex-shrink-0">
        <span>
          * Markers are plotted only for cameras that supply valid latitude/longitude. Lines join cameras that share an association; they are not road routes.
        </span>
        <span className="text-slate-700 font-semibold">
          AI City Mobility Intelligence Engine
        </span>
      </div>
    </div>
  );
}
