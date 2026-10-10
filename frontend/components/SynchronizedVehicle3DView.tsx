"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GlobalVehicle, Observation } from "@/types";
import {
  createSedanMesh,
  createSuvMesh,
  createTruckMesh,
  createCargoTruckMesh,
  createAutoRickshawMesh,
  createMotorcycleMesh,
  orientVehicle,
} from "@/lib/vehicleModels";
import {
  RotateCcw,
  Crosshair,
  Play,
  Pause,
  Box,
  Layers,
  Camera as CameraIcon,
  Info,
} from "lucide-react";

interface Synchronized3DProps {
  vehicle: GlobalVehicle | null;
  activeStepIndex: number;
  activeCameraId: string | null;
  observations?: Observation[];
  onSelectCamera?: (cameraId: string) => void;
  onStepChange?: (index: number) => void;
}

export function SynchronizedVehicle3DView({
  vehicle,
  activeStepIndex = 0,
  activeCameraId,
  observations = [],
  onSelectCamera,
  onStepChange,
}: Synchronized3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vehicleMeshRef = useRef<THREE.Group | null>(null);
  const haloRingRef = useRef<THREE.Mesh | null>(null);
  const cameraConesRef = useRef<Record<string, THREE.Mesh>>({});
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const reqIdRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Schematic 3D vantage coordinates for the camera nodes
  const nodePositions: Record<string, [number, number, number]> = {
    CAM_A: [-20, 0, -12],
    CAM_B: [20, 0, -12],
    CAM_C: [-12, 0, 16],
    CAM_D: [18, 0, 16],
  };

  // Real pipelines use camera IDs like CAM_S01_C001, so any ID without a fixed slot gets a
  // deterministic schematic slot instead of silently disappearing from the 3D scene.
  const extraSlots: [number, number, number][] = [
    [0, 0, -22], [0, 0, 22], [-26, 0, 2], [26, 0, 2], [-30, 0, -20], [30, 0, 20],
  ];
  const posOf = (id: string): [number, number, number] => {
    if (nodePositions[id]) return nodePositions[id];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return extraSlots[h % extraSlots.length];
  };

  // Playback timer for auto-step progression
  useEffect(() => {
    if (!isPlaying || !vehicle || vehicle.trajectory.length <= 1) return;
    const interval = setInterval(() => {
      if (onStepChange) {
        onStepChange((activeStepIndex + 1) % vehicle.trajectory.length);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isPlaying, activeStepIndex, vehicle, onStepChange]);

  // 1. INITIALIZE THREE.JS SCENE WITH BRIGHT ARCHITECTURAL LIGHTING & ORBIT CONTROLS
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xf8fafc); // Crisp light grey background
    scene.fog = new THREE.FogExp2(0xf8fafc, 0.01);

    // 2. CAMERA
    const initialW = container.clientWidth > 40 ? container.clientWidth : 640;
    const initialH = container.clientHeight > 40 ? container.clientHeight : 420;
    const aspect = initialW / initialH;
    const camera = new THREE.PerspectiveCamera(45, aspect, 1, 1000);
    camera.position.set(0, 36, 48);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(initialW, initialH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. ORBIT CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't flip below ground
    controls.minDistance = 15;
    controls.maxDistance = 120;
    controlsRef.current = controls;

    // 5. BRIGHT PROJECTOR-READY LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(30, 50, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.8);
    fillLight.position.set(-30, 25, -20);
    scene.add(fillLight);

    // 6. GROUND PLANE & CLEAN GRID
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(120, 60, 0x94a3b8, 0xe2e8f0);
    grid.position.y = 0.01;
    scene.add(grid);

    // 7. ASPHALT ROADS WITH DASHED LANE STRIPING
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x334155 }); // Dark Slate Road
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // East-West Road
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(120, 14), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.02, -12);
    roadEW.receiveShadow = true;
    scene.add(roadEW);

    // East-West Center Stripe
    for (let x = -55; x <= 55; x += 6) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.4), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.03, -12);
      scene.add(stripe);
    }

    // North-South Road
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(14, 100), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(0, 0.02, 10);
    roadNS.receiveShadow = true;
    scene.add(roadNS);

    // North-South Center Stripe
    for (let z = -35; z <= 55; z += 6) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3.5), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.03, z);
      scene.add(stripe);
    }

    // 8. CCTV SENSOR POLES WITH VISIBLE CONES & LABELS
    const coneGeom = new THREE.ConeGeometry(6, 14, 16, 1, true);
    coneGeom.translate(0, -7, 0);

    Object.entries(nodePositions).forEach(([camId, pos]) => {
      const poleGroup = new THREE.Group();
      poleGroup.position.set(pos[0], 0, pos[2]);

      // Pole
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 8), poleMat);
      pole.position.y = 4.5;
      pole.castShadow = true;
      poleGroup.add(pole);

      // Camera Housing Box
      const headMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 1.4), headMat);
      head.position.set(0, 9, 0);
      head.castShadow = true;
      poleGroup.add(head);

      // Frustum Cone
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const cone = new THREE.Mesh(coneGeom, coneMat);
      cone.position.set(0, 9, 0);
      cone.rotation.x = Math.PI / 5;
      poleGroup.add(cone);
      cameraConesRef.current[camId] = cone;

      // Base Platform
      const baseMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.4, 12), baseMat);
      base.position.y = 0.2;
      poleGroup.add(base);

      scene.add(poleGroup);
    });

    // 9. ANIMATION LOOP
    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 40 || h < 40) return; // Prevent zero-size corruption during layout transition
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      if (rendererRef.current) {
        if (container && container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }
    };
  }, []);

  // 2. SYNCHRONIZE ACTIVE CAMERA CONE HIGHLIGHTS
  useEffect(() => {
    Object.entries(cameraConesRef.current).forEach(([camId, cone]) => {
      const isActive =
        camId === activeCameraId ||
        (vehicle && vehicle.trajectory[activeStepIndex]?.camera_id === camId);

      const mat = cone.material as THREE.MeshBasicMaterial;
      if (isActive) {
        mat.color.setHex(0x0ea5e9);
        mat.opacity = 0.45;
      } else {
        mat.color.setHex(0x64748b);
        mat.opacity = 0.12;
      }
    });
  }, [activeCameraId, activeStepIndex, vehicle]);

  // 3. SYNCHRONIZE VEHICLE MODEL, POSITION, AND TRAJECTORY TRAIL
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old vehicle mesh & halo
    if (vehicleMeshRef.current) {
      scene.remove(vehicleMeshRef.current);
      vehicleMeshRef.current = null;
    }
    if (haloRingRef.current) {
      scene.remove(haloRingRef.current);
      haloRingRef.current = null;
    }
    if (trajectoryLineRef.current) {
      scene.remove(trajectoryLineRef.current);
      trajectoryLineRef.current = null;
    }

    if (!vehicle) return;

    // A. Build Vehicle Mesh based on vehicle_type
    const vType = (vehicle.vehicle_type || "").toLowerCase();
    let mesh: THREE.Group;
    if (vType.includes("auto")) {
      mesh = createAutoRickshawMesh();
    } else if (vType.includes("motorcycle") || vType.includes("bike")) {
      mesh = createMotorcycleMesh(0xdc2626);
    } else if (vType.includes("truck")) {
      mesh = createTruckMesh(0x0284c7);
    } else if (vType.includes("bus")) {
      mesh = createCargoTruckMesh(0x0284c7);
    } else if (vType.includes("suv")) {
      mesh = createSuvMesh(0x0284c7);
    } else {
      mesh = createSedanMesh(0x0284c7); // Default Sedan
    }

    vehicleMeshRef.current = mesh;
    scene.add(mesh);

    // B. Glowing Selection Ring on Road
    const ringGeom = new THREE.RingGeometry(2.4, 2.9, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const halo = new THREE.Mesh(ringGeom, ringMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.08;
    haloRingRef.current = halo;
    scene.add(halo);

    // C. Reconstruct 3D Trajectory Ribbon across node positions
    const trajPts: THREE.Vector3[] = [];
    vehicle.trajectory.forEach((step) => {
      const pos = posOf(step.camera_id);
      if (pos) {
        trajPts.push(new THREE.Vector3(pos[0], 0.25, pos[2]));
      }
    });

    if (trajPts.length > 1) {
      const lineGeom = new THREE.BufferGeometry().setFromPoints(trajPts);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x0284c7,
        linewidth: 4,
        scale: 1,
        dashSize: 2,
        gapSize: 1,
      });
      const trajLine = new THREE.Line(lineGeom, lineMat);
      trajLine.computeLineDistances();
      trajectoryLineRef.current = trajLine;
      scene.add(trajLine);
    }

    // D. Position Vehicle at activeStepIndex location
    const activeStep = vehicle.trajectory[activeStepIndex] || vehicle.trajectory[0];
    if (activeStep && posOf(activeStep.camera_id)) {
      const currentPos = posOf(activeStep.camera_id);
      mesh.position.set(currentPos[0], 0, currentPos[2]);
      halo.position.set(currentPos[0], 0.08, currentPos[2]);

      // Orient towards next hop if exists
      const nextStep = vehicle.trajectory[activeStepIndex + 1];
      if (nextStep && posOf(nextStep.camera_id)) {
        const nextPos = posOf(nextStep.camera_id);
        const dir = new THREE.Vector3(
          nextPos[0] - currentPos[0],
          0,
          nextPos[2] - currentPos[2]
        ).normalize();
        orientVehicle(mesh, dir, 1.0);
      }
    }
  }, [vehicle, activeStepIndex]);

  // Camera Reset
  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 36, 48);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  // Focus Vehicle
  const handleFocusVehicle = () => {
    if (!cameraRef.current || !controlsRef.current || !vehicle) return;
    const activeStep = vehicle.trajectory[activeStepIndex] || vehicle.trajectory[0];
    if (activeStep && posOf(activeStep.camera_id)) {
      const pos = posOf(activeStep.camera_id);
      controlsRef.current.target.set(pos[0], 0, pos[2]);
      cameraRef.current.position.set(pos[0], 18, pos[2] + 24);
      controlsRef.current.update();
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-100 select-none overflow-hidden min-h-[460px]">
      {/* 3D Top Header & Controls Strip */}
      <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 z-20 flex-shrink-0 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></div>
          <span className="font-bold text-slate-900 tracking-wide">
            3D DIGITAL TWIN VISUALIZATION
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
            Schematic • Orbit Controls Active
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Play/Pause Sequence Animation */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] border border-slate-300 transition-colors shadow-xs"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-600 fill-current" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-blue-600 fill-current" />
                Play Trajectory
              </>
            )}
          </button>

          {/* Focus Vehicle */}
          <button
            onClick={handleFocusVehicle}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] border border-slate-300 transition-colors shadow-xs"
          >
            <Crosshair className="w-3.5 h-3.5 text-blue-600" />
            Focus Vehicle
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] border border-slate-300 transition-colors shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            Reset Camera
          </button>
        </div>
      </div>

      {/* Primary 3D WebGL Canvas */}
      <div className="relative flex-1 w-full min-h-[380px]">
        <div ref={containerRef} className="w-full h-full" />

        {/* Floating Vehicle Status Overlay */}
        {vehicle && (
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md border border-slate-300 p-3.5 rounded-xl shadow-xl text-xs font-mono space-y-2 pointer-events-auto max-w-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Box className="w-4 h-4 text-blue-600" />
                {vehicle.global_vehicle_id}
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                  vehicle.tracking_type === "single_camera"
                    ? "bg-slate-100 text-slate-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {vehicle.tracking_type === "single_camera" ? "Single Cam" : "Cross-camera (unconfirmed)"}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Class:</span>
                <strong>{vehicle.vehicle_type}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plate:</span>
                <strong className="font-mono">{vehicle.primary_plate || "NO PLATE"}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Node:</span>
                <strong className="text-blue-700">
                  {vehicle.trajectory[activeStepIndex]?.camera_id || "CAM_A"}
                </strong>
              </div>
            </div>

            {/* Trajectory Step Selector */}
            {vehicle.trajectory.length > 1 && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] text-slate-500 block mb-1">
                  Trajectory Sequence ({vehicle.trajectory.length} steps):
                </span>
                <div className="flex gap-1 flex-wrap">
                  {vehicle.trajectory.map((step, idx) => (
                    <button
                      key={idx}
                      onClick={() => onStepChange && onStepChange(idx)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        activeStepIndex === idx
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      #{step.step} {step.camera_id}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schematic Environment Notice */}
        <div className="absolute bottom-4 right-4 z-10 bg-white/90 backdrop-blur-md border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <span>Schematic 3D Digital Twin • Drag to orbit, scroll to zoom</span>
        </div>
      </div>
    </div>
  );
}
