"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Play,
  Pause,
  RotateCcw,
  Video,
  Eye,
  Building2,
  Compass,
  Radio,
  Car,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import type { Camera, CameraNetwork, GlobalVehicle } from "@/types";
import {
  createSedanMesh,
  createSuvMesh,
  createTruckMesh,
  createCargoTruckMesh,
  createMotorcycleMesh,
  getVehicleHeading,
} from "@/lib/vehicleModels";

export interface Scene3DProps {
  cameras: Camera[];
  network: CameraNetwork | null;
  vehicle: GlobalVehicle | null;
  step: number;
  onStep: (i: number) => void;
  selectedCameraId?: string | null;
  onSelectCamera?: (cameraId: string) => void;
}

type CameraViewMode = "orbit" | "chase" | "topdown" | "cctv";

// Color mappings for vehicle classes
const TYPE_COLORS: Record<string, number> = {
  sedan: 0x00e5ff,
  suv: 0x38bdf8,
  truck: 0xf59e0b,
  bus: 0xa855f7,
  motorcycle: 0xec4899,
  van: 0x10b981,
};

function getVehicleColor(type?: string): number {
  if (!type) return 0x00e5ff;
  const t = type.toLowerCase();
  for (const [key, col] of Object.entries(TYPE_COLORS)) {
    if (t.includes(key)) return col;
  }
  return 0x00e5ff;
}

function createVehicleModel(type?: string, colorHex: number = 0x00e5ff): THREE.Group {
  const t = (type || "").toLowerCase();
  if (t.includes("suv")) return createSuvMesh(colorHex);
  if (t.includes("cargo")) return createCargoTruckMesh(colorHex);
  if (t.includes("truck") || t.includes("bus")) return createTruckMesh(colorHex);
  if (t.includes("motor") || t.includes("bike")) return createMotorcycleMesh(colorHex);
  return createSedanMesh(colorHex);
}

// Crisp billboard label for camera towers
function createCameraLabel(text: string, subtext?: string, isHighlighted: boolean = false): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 380;
  canvas.height = 110;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Sprite();

  ctx.fillStyle = isHighlighted ? "rgba(0, 229, 255, 0.92)" : "rgba(10, 16, 28, 0.88)";
  ctx.strokeStyle = isHighlighted ? "#55d6e8" : "rgba(41, 56, 75, 0.9)";
  ctx.lineWidth = 4;

  // Rounded bubble
  ctx.beginPath();
  ctx.roundRect(6, 6, 368, 98, 16);
  ctx.fill();
  ctx.stroke();

  // Primary text
  ctx.fillStyle = isHighlighted ? "#080d14" : "#f1f5f9";
  ctx.font = "bold 32px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 190, subtext ? 42 : 55);

  // Subtext
  if (subtext) {
    ctx.fillStyle = isHighlighted ? "#0f172a" : "#94a3b8";
    ctx.font = "600 20px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(subtext.length > 22 ? subtext.slice(0, 21) + "…" : subtext, 190, 78);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(6.8, 2.0, 1);
  return sprite;
}

export default function Scene3D({
  cameras,
  network,
  vehicle,
  step,
  onStep,
  selectedCameraId,
  onSelectCamera,
}: Scene3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // UI state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [viewMode, setViewMode] = useState<CameraViewMode>("orbit");
  const [showBuildings, setShowBuildings] = useState<boolean>(true);
  const [showCones, setShowCones] = useState<boolean>(true);
  const [showAllSensors, setShowAllSensors] = useState<boolean>(false);

  // Engine references
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);

  // Groups
  const cityGroupRef = useRef<THREE.Group>(new THREE.Group());
  const cameraTowersGroupRef = useRef<THREE.Group>(new THREE.Group());
  const trajectoryGroupRef = useRef<THREE.Group>(new THREE.Group());
  const vehicleGroupRef = useRef<THREE.Group>(new THREE.Group());
  const conesListRef = useRef<THREE.Mesh[]>([]);
  const radarRingsRef = useRef<{ mesh: THREE.Mesh; camId: string }[]>([]);

  // Driving trajectory state
  const trajectoryCurveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const progressRef = useRef<number>(0);
  const lastStepRef = useRef<number>(-1);
  const cameraPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());

  // 1. Geographic to 3D Plane Mapping
  // Maps actual San Francisco coordinates to 3D world [-100, 100] coordinates
  const cameraPositions = useMemo(() => {
    const posMap = new Map<string, THREE.Vector3>();
    const valid = cameras.filter(
      (c): c is Camera & { latitude: number; longitude: number } =>
        typeof c.latitude === "number" &&
        typeof c.longitude === "number" &&
        !isNaN(c.latitude) &&
        !isNaN(c.longitude)
    );

    if (valid.length > 0) {
      let minLat = Infinity, maxLat = -Infinity;
      let minLon = Infinity, maxLon = -Infinity;
      valid.forEach((c) => {
        if (c.latitude < minLat) minLat = c.latitude;
        if (c.latitude > maxLat) maxLat = c.latitude;
        if (c.longitude < minLon) minLon = c.longitude;
        if (c.longitude > maxLon) maxLon = c.longitude;
      });

      const latSpan = Math.max(0.005, maxLat - minLat);
      const lonSpan = Math.max(0.005, maxLon - minLon);
      const WORLD_EXTENT = 160; // 3D units across the city

      valid.forEach((c) => {
        // Lon -> X (East/West), Lat -> -Z (North/South in 3D)
        const nx = ((c.longitude - minLon) / lonSpan - 0.5) * WORLD_EXTENT;
        const nz = -((c.latitude - minLat) / latSpan - 0.5) * WORLD_EXTENT;
        posMap.set(c.camera_id, new THREE.Vector3(nx, 0, nz));
      });
    }

    // Fallback for cameras without coordinates
    cameras.forEach((c, idx) => {
      if (!posMap.has(c.camera_id)) {
        const angle = (idx / Math.max(1, cameras.length)) * Math.PI * 2;
        const radius = 60 + (idx % 3) * 15;
        posMap.set(
          c.camera_id,
          new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
        );
      }
    });

    cameraPositionsRef.current = posMap;
    return posMap;
  }, [cameras]);

  // Visited cameras along vehicle's actual trajectory
  const visitedCamSet = useMemo(() => {
    if (!vehicle || !vehicle.trajectory) return new Set<string>();
    return new Set(vehicle.trajectory.map((t) => t.camera_id));
  }, [vehicle]);

  // 2. Initialize Three.js Scene, Renderer & Lights
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x070b14);
    // Subtle distance atmospheric fog
    scene.fog = new THREE.FogExp2(0x070b14, 0.0032);

    // CAMERA
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 2500);
    camera.position.set(65, 55, 75);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ORBIT CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.47; // Prevent looking underground
    controls.minDistance = 6;
    controls.maxDistance = 500;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // LIGHTS
    // 1. Sky Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x080d1a, 0.85);
    scene.add(hemiLight);

    // 2. Main Key Sunlight / Moonlight
    const dirLight = new THREE.DirectionalLight(0xe0f2fe, 1.4);
    dirLight.position.set(90, 140, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 400;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    dirLight.shadow.camera.top = 120;
    dirLight.shadow.camera.bottom = -120;
    scene.add(dirLight);

    // 3. Cyberpunk Cyan Accent Rim Light
    const rimLight = new THREE.DirectionalLight(0x00e5ff, 0.6);
    rimLight.position.set(-80, 50, -80);
    scene.add(rimLight);

    // ROOT HIERARCHY GROUPS
    scene.add(cityGroupRef.current);
    scene.add(cameraTowersGroupRef.current);
    scene.add(trajectoryGroupRef.current);
    scene.add(vehicleGroupRef.current);

    // RESIZE OBSERVER
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 10 || h < 10) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // ANIMATION RENDER LOOP
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // Animate Camera Radar Scanning Rings
      radarRingsRef.current.forEach(({ mesh, camId }) => {
        const isHovered = camId === selectedCameraId;
        const phase = (elapsedTime * (isHovered ? 2.2 : 1.2)) % 1;
        mesh.scale.setScalar(1 + phase * 2.8);
        (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.7;
      });

      // Animate Vehicle Along Catmull-Rom Trajectory
      const curve = trajectoryCurveRef.current;
      const veh = vehicleGroupRef.current;
      if (curve && veh.children.length > 0) {
        if (isPlaying) {
          const hopsCount = Math.max(1, (vehicle?.trajectory.length || 1) - 1);
          // Scale speed by number of hops so journey plays smoothly
          const stepSpeed = (0.16 * speed) / Math.max(3, hopsCount * 2.5);
          progressRef.current = (progressRef.current + delta * stepSpeed) % 1;
        }

        const t = progressRef.current;
        const pos = curve.getPointAt(t);
        const tangent = curve.getTangentAt(Math.min(0.999, t));

        veh.position.copy(pos);
        veh.position.y = 0.05;

        // Smooth heading orientation along tangent
        if (tangent.lengthSq() > 0.001) {
          const angle = Math.atan2(tangent.x, tangent.z);
          veh.rotation.y = angle;
        }

        // Synchronize step index with vehicle position along the curve
        if (vehicle && vehicle.trajectory.length > 1) {
          const currentHop = Math.min(
            vehicle.trajectory.length - 1,
            Math.floor(t * vehicle.trajectory.length)
          );
          if (currentHop !== lastStepRef.current) {
            lastStepRef.current = currentHop;
            onStep(currentHop);
          }
        }

        // Camera Follow Mode Handling
        if (viewMode === "chase" && cameraRef.current && controlsRef.current) {
          const chaseOffset = new THREE.Vector3(-tangent.x * 18, 9, -tangent.z * 18);
          cameraRef.current.position.lerp(pos.clone().add(chaseOffset), 0.08);
          controlsRef.current.target.lerp(pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 0.12);
        } else if (viewMode === "topdown" && cameraRef.current && controlsRef.current) {
          controlsRef.current.target.lerp(pos, 0.08);
        }
      }

      controlsRef.current?.update();
      rendererRef.current?.render(scene, cameraRef.current!);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // 3. Build Realistic 3D City Environment (Ground, Roads, Buildings, Trees)
  useEffect(() => {
    const city = cityGroupRef.current;
    city.clear();

    const WORLD_SIZE = 340;

    // Ground Plane with Dark Asphalt
    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x080d18,
      roughness: 0.95,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    city.add(ground);

    // Subtle Metropolitan Grid Lines
    const grid = new THREE.GridHelper(WORLD_SIZE, 68, 0x1e293b, 0x0f172a);
    grid.position.y = 0.01;
    city.add(grid);

    // City Blocks: Procedural Buildings & Skyscrapers
    if (showBuildings) {
      const bldgMat = new THREE.MeshStandardMaterial({
        color: 0x0e1726,
        roughness: 0.7,
        metalness: 0.3,
      });
      const bldgEdgeMat = new THREE.LineBasicMaterial({
        color: 0x1e3a5f,
        transparent: true,
        opacity: 0.8,
      });
      const windowMat = new THREE.MeshBasicMaterial({
        color: 0x55d6e8,
        transparent: true,
        opacity: 0.35,
      });

      // Seeded procedural city clusters away from camera centers
      const clusterPositions: [number, number][] = [
        [-85, -85], [-85, 0], [-85, 85],
        [85, -85], [85, 0], [85, 85],
        [0, -85], [0, 85],
        [-110, -40], [-110, 40], [110, -40], [110, 40],
        [-40, -110], [40, -110], [-40, 110], [40, 110],
      ];

      clusterPositions.forEach(([cx, cz], clusterIdx) => {
        // Create 3-4 buildings per cluster block
        for (let b = 0; b < 3; b++) {
          const bx = cx + (b % 2) * 16 - 8;
          const bz = cz + Math.floor(b / 2) * 16 - 8;
          const height = 18 + ((clusterIdx * 7 + b * 13) % 46);
          const width = 10 + ((b * 5) % 6);
          const depth = 10 + ((clusterIdx * 3) % 6);

          const bldgGroup = new THREE.Group();
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            bldgMat
          );
          mesh.position.y = height / 2;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          bldgGroup.add(mesh);

          // Glowing structural wireframe edges
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)),
            bldgEdgeMat
          );
          edges.position.y = height / 2;
          bldgGroup.add(edges);

          // Emissive window stripes
          for (let floor = 3; floor < height - 3; floor += 4) {
            const win = new THREE.Mesh(
              new THREE.PlaneGeometry(width - 1.5, 0.8),
              windowMat
            );
            win.position.set(0, floor, depth / 2 + 0.05);
            bldgGroup.add(win);
          }

          // Rooftop communications antenna
          if (height > 35) {
            const mast = new THREE.Mesh(
              new THREE.CylinderGeometry(0.12, 0.18, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0x55d6e8 })
            );
            mast.position.set(0, height + 4, 0);
            bldgGroup.add(mast);

            // Blinking red beacon light
            const beacon = new THREE.Mesh(
              new THREE.SphereGeometry(0.4, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xef4444 })
            );
            beacon.position.set(0, height + 8, 0);
            bldgGroup.add(beacon);
          }

          bldgGroup.position.set(bx, 0, bz);
          city.add(bldgGroup);
        }
      });
    }

    // Asphalt Highways connecting network edges
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x111c2e,
      roughness: 0.85,
    });
    const edgeList = network?.edges || [];
    edgeList.forEach((edge) => {
      const p1 = cameraPositions.get(edge.source);
      const p2 = cameraPositions.get(edge.target);
      if (!p1 || !p2) return;

      const dist = p1.distanceTo(p2);
      if (dist < 0.1 || dist > 200) return;

      const road = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, dist), roadMat);
      road.position.copy(p1.clone().add(p2).multiplyScalar(0.5));
      road.position.y = 0.03;
      road.lookAt(p2);
      road.receiveShadow = true;
      city.add(road);

      // Road lane center divider line
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.1, dist),
        new THREE.MeshBasicMaterial({ color: 0x22354e })
      );
      line.position.copy(road.position);
      line.position.y = 0.05;
      line.lookAt(p2);
      city.add(line);
    });
  }, [showBuildings, network, cameraPositions]);

  // 4. Build 3D Surveillance Camera Towers & Sensors
  useEffect(() => {
    const towers = cameraTowersGroupRef.current;
    towers.clear();
    conesListRef.current = [];
    radarRingsRef.current = [];

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.5,
      roughness: 0.4,
    });

    cameras.forEach((cam) => {
      const pos = cameraPositions.get(cam.camera_id);
      if (!pos) return;

      const isVisited = visitedCamSet.has(cam.camera_id);
      const isSelected = cam.camera_id === selectedCameraId;

      // Filter: If showAllSensors is false, display visited cameras + selected camera
      if (!showAllSensors && !isVisited && !isSelected) {
        return;
      }

      const towerGroup = new THREE.Group();
      towerGroup.position.copy(pos);

      // Metallic Surveillance Gantry Pole (Height: 8 units)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 8, 12), poleMat);
      pole.position.y = 4;
      pole.castShadow = true;
      towerGroup.add(pole);

      // Crossbar Cantilever Arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 0.25), poleMat);
      arm.position.set(1.0, 7.8, 0);
      towerGroup.add(arm);

      // CCTV Camera Head Unit
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.6), headMat);
      head.position.set(2.0, 7.6, 0);
      towerGroup.add(head);

      // Camera Lens with Cyan / Amber Emissive Glow
      const lensColor = isVisited ? 0x00e5ff : isSelected ? 0xf59e0b : 0x38bdf8;
      const lens = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 12, 12),
        new THREE.MeshBasicMaterial({ color: lensColor })
      );
      lens.position.set(2.6, 7.55, 0);
      towerGroup.add(lens);

      // Translucent Volumetric FOV Sensor Cone
      if (showCones) {
        const coneGeo = new THREE.ConeGeometry(4.5, 7.6, 24, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: lensColor,
          transparent: true,
          opacity: isVisited || isSelected ? 0.18 : 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(2.0, 3.8, 0);
        cone.rotation.z = Math.PI; // Point downwards onto road
        towerGroup.add(cone);
        conesListRef.current.push(cone);
      }

      // Ground Radar Pulse Ring
      const ringGeo = new THREE.RingGeometry(1.5, 1.9, 36).rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: lensColor,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.06;
      towerGroup.add(ring);
      radarRingsRef.current.push({ mesh: ring, camId: cam.camera_id });

      // Crisp Billboard Label
      const label = createCameraLabel(
        cam.camera_id,
        cam.location_description || cam.name || undefined,
        isVisited || isSelected
      );
      label.position.set(0, 10.8, 0);
      towerGroup.add(label);

      towers.add(towerGroup);
    });
  }, [cameras, cameraPositions, visitedCamSet, selectedCameraId, showCones, showAllSensors]);

  // 5. Reconstruct 3D Hero Vehicle and Glowing Trajectory
  useEffect(() => {
    const trajGroup = trajectoryGroupRef.current;
    const vehGroup = vehicleGroupRef.current;
    trajGroup.clear();
    vehGroup.clear();
    trajectoryCurveRef.current = null;
    progressRef.current = 0;
    lastStepRef.current = -1;

    if (!vehicle || !vehicle.trajectory || vehicle.trajectory.length === 0) return;

    // Collect 3D waypoints for the vehicle's sequence
    const waypoints: THREE.Vector3[] = [];
    vehicle.trajectory.forEach((t) => {
      const p = cameraPositions.get(t.camera_id);
      if (p) {
        // Prevent duplicate consecutive points
        if (waypoints.length === 0 || waypoints[waypoints.length - 1].distanceTo(p) > 0.5) {
          waypoints.push(p.clone());
        }
      }
    });

    if (waypoints.length === 0) return;

    const colorHex = getVehicleColor(vehicle.vehicle_type);

    // Build 3D Hero Vehicle Mesh from vehicleModels
    const carModel = createVehicleModel(vehicle.vehicle_type, colorHex);
    vehGroup.add(carModel);

    // Dual Forward Projecting Headlight Beams
    const headlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const headlightCone = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 8, 16, 1, true).rotateX(-Math.PI / 2),
      headlightMat
    );
    headlightCone.position.set(0, 0.6, 4.5);
    vehGroup.add(headlightCone);

    // Glowing Holographic Target Reticle Under Vehicle
    const reticleGeo = new THREE.RingGeometry(2.4, 2.8, 36).rotateX(-Math.PI / 2);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.position.y = 0.08;
    vehGroup.add(reticle);

    // Target Point Light
    const carLight = new THREE.PointLight(colorHex, 35, 12);
    carLight.position.set(0, 2.2, 0);
    vehGroup.add(carLight);

    if (waypoints.length >= 2) {
      // Smooth Catmull-Rom Trajectory Spline
      const curve = new THREE.CatmullRomCurve3(waypoints, false, "catmullrom", 0.15);
      trajectoryCurveRef.current = curve;

      // Glowing Neon Trajectory Tube (Lifted slightly above asphalt)
      const tubeGeo = new THREE.TubeGeometry(curve, 160, 0.22, 10, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.95,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.y = 0.25;
      trajGroup.add(tube);

      // Trajectory Waypoint Markers (Pulsing emerald / amber diamonds)
      waypoints.forEach((wp, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === waypoints.length - 1;
        const wpCol = isStart ? 0x10b981 : isEnd ? 0xf59e0b : 0x00e5ff;

        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.7),
          new THREE.MeshBasicMaterial({ color: wpCol })
        );
        diamond.position.copy(wp);
        diamond.position.y = 0.6;
        trajGroup.add(diamond);
      });

      // Position vehicle at start of curve
      vehGroup.position.copy(waypoints[0]);
    } else {
      // Single camera observation
      vehGroup.position.copy(waypoints[0]).add(new THREE.Vector3(2, 0, 2));
    }

    // Auto-fit Camera Orbit target to the vehicle trajectory
    if (controlsRef.current && cameraRef.current) {
      const center = new THREE.Vector3();
      waypoints.forEach((w) => center.add(w));
      center.divideScalar(waypoints.length);

      controlsRef.current.target.copy(center);
      cameraRef.current.position.set(center.x + 45, center.y + 40, center.z + 55);
    }
  }, [vehicle, cameraPositions]);

  // Jump to specific step when clicked from outside timeline
  useEffect(() => {
    if (!trajectoryCurveRef.current || !vehicle || vehicle.trajectory.length <= 1) return;
    const count = vehicle.trajectory.length;
    const targetProgress = Math.min(1, Math.max(0, step / (count - 1)));
    progressRef.current = targetProgress;
  }, [step, vehicle]);

  // Camera Mode Handler
  const handleViewModeChange = (mode: CameraViewMode) => {
    setViewMode(mode);
    if (!cameraRef.current || !controlsRef.current) return;

    if (mode === "topdown") {
      cameraRef.current.position.set(0, 160, 0.001);
      controlsRef.current.target.set(0, 0, 0);
    } else if (mode === "orbit") {
      cameraRef.current.position.set(65, 55, 75);
      controlsRef.current.target.set(0, 0, 0);
    } else if (mode === "cctv") {
      const currentCamId = vehicle?.trajectory[step]?.camera_id;
      if (currentCamId && cameraPositions.has(currentCamId)) {
        const camPos = cameraPositions.get(currentCamId)!;
        cameraRef.current.position.set(camPos.x + 2, 8.5, camPos.z);
        controlsRef.current.target.set(camPos.x, 0, camPos.z + 10);
      }
    }
  };

  const handleResetCamera = () => {
    handleViewModeChange("orbit");
    progressRef.current = 0;
    setIsPlaying(true);
  };

  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#070b14] select-none font-mono overflow-hidden">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Top Floating HUD: Controls & Modes */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[#29384B] bg-[#0D1420]/90 backdrop-blur-md px-2 py-1.5 shadow-xl pointer-events-auto text-xs">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-bold transition-colors ${
              isPlaying
                ? "bg-[#55D6E8] text-[#080D14]"
                : "bg-[#1E293B] text-[#F1F5F9] hover:bg-[#334155]"
            }`}
            title={isPlaying ? "Pause 3D Driving Simulation" : "Play Simulation"}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? "PAUSE" : "PLAY"}</span>
          </button>

          <button
            onClick={() => {
              const hops = vehicle?.trajectory.length || 1;
              const prev = Math.max(0, step - 1);
              onStep(prev);
              progressRef.current = prev / Math.max(1, hops - 1);
            }}
            className="p-1.5 rounded text-[#94A3B8] hover:text-[#55D6E8] hover:bg-[#172437] transition-colors"
            title="Previous Camera Hop"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              const hops = vehicle?.trajectory.length || 1;
              const next = Math.min(hops - 1, step + 1);
              onStep(next);
              progressRef.current = next / Math.max(1, hops - 1);
            }}
            className="p-1.5 rounded text-[#94A3B8] hover:text-[#55D6E8] hover:bg-[#172437] transition-colors"
            title="Next Camera Hop"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-[#29384B] mx-1" />

          {/* Speed Selector */}
          <button
            onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))}
            className="px-2 py-1 rounded bg-[#172437] hover:bg-[#20314A] text-[11px] font-bold text-[#55D6E8] transition-colors"
            title="Simulation Playback Speed"
          >
            {speed}x
          </button>

          <button
            onClick={handleResetCamera}
            className="p-1.5 rounded text-[#94A3B8] hover:text-[#55D6E8] hover:bg-[#172437] transition-colors"
            title="Reset 3D Scene"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Camera Perspective Mode Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-[#29384B] bg-[#0D1420]/90 backdrop-blur-md p-1 shadow-xl pointer-events-auto text-[11px]">
          <button
            onClick={() => handleViewModeChange("orbit")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              viewMode === "orbit"
                ? "bg-[#55D6E8] text-[#080D14] font-bold"
                : "text-[#94A3B8] hover:text-[#F1F5F9]"
            }`}
            title="Free Orbit Camera (Rotate, Pan, Zoom)"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>ORBIT</span>
          </button>

          <button
            onClick={() => handleViewModeChange("chase")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              viewMode === "chase"
                ? "bg-[#55D6E8] text-[#080D14] font-bold"
                : "text-[#94A3B8] hover:text-[#F1F5F9]"
            }`}
            title="Third-Person Chase Camera Behind Vehicle"
          >
            <Car className="w-3.5 h-3.5" />
            <span>FOLLOW CAR</span>
          </button>

          <button
            onClick={() => handleViewModeChange("topdown")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              viewMode === "topdown"
                ? "bg-[#55D6E8] text-[#080D14] font-bold"
                : "text-[#94A3B8] hover:text-[#F1F5F9]"
            }`}
            title="Satellite Tactical Top-Down Perspective"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>TACTICAL</span>
          </button>

          <button
            onClick={() => handleViewModeChange("cctv")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
              viewMode === "cctv"
                ? "bg-[#55D6E8] text-[#080D14] font-bold"
                : "text-[#94A3B8] hover:text-[#F1F5F9]"
            }`}
            title="Active Surveillance Camera Lens POV"
          >
            <Video className="w-3.5 h-3.5" />
            <span>CCTV POV</span>
          </button>
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center gap-1 rounded-xl border border-[#29384B] bg-[#0D1420]/90 backdrop-blur-md p-1 shadow-xl pointer-events-auto text-[11px]">
          <button
            onClick={() => setShowBuildings((b) => !b)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
              showBuildings
                ? "bg-[#172437] text-[#55D6E8] font-bold"
                : "text-[#64748B] hover:text-[#94A3B8]"
            }`}
            title="Toggle 3D Urban City Buildings"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>CITY</span>
          </button>

          <button
            onClick={() => setShowCones((c) => !c)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
              showCones
                ? "bg-[#172437] text-[#55D6E8] font-bold"
                : "text-[#64748B] hover:text-[#94A3B8]"
            }`}
            title="Toggle Surveillance Sensor FOV Cones"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>CONES</span>
          </button>

          <button
            onClick={() => setShowAllSensors((s) => !s)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
              showAllSensors
                ? "bg-[#172437] text-[#55D6E8] font-bold"
                : "text-[#64748B] hover:text-[#94A3B8]"
            }`}
            title="Toggle All 46 Sensor Towers vs Selected Route Towers"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>ALL CAMS</span>
          </button>
        </div>
      </div>

      {/* Bottom Floating Telemetry & Vehicle Intelligence HUD */}
      {vehicle && (
        <div className="absolute bottom-3 left-3 z-10 rounded-xl border border-[#29384B] bg-[#0D1420]/95 backdrop-blur-md p-3 shadow-2xl pointer-events-auto max-w-sm">
          <div className="flex items-center justify-between gap-3 mb-2 pb-1.5 border-b border-[#1E293B]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="text-xs font-bold text-[#F1F5F9]">
                {vehicle.global_vehicle_id}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#172437] text-[#55D6E8] font-mono">
                {vehicle.vehicle_type?.toUpperCase()}
              </span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
              {(vehicle.identity_status || "CONFIRMED").toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div>
              <span className="text-[#64748B]">License Plate: </span>
              <span className="text-[#F1F5F9] font-bold">
                {vehicle.primary_plate || "Not available"}
              </span>
            </div>
            <div>
              <span className="text-[#64748B]">Active Hop: </span>
              <span className="text-[#55D6E8] font-bold">
                {vehicle.trajectory[step]?.camera_id || "In Transit"}
              </span>
            </div>
            <div>
              <span className="text-[#64748B]">Visited Cams: </span>
              <span className="text-[#F1F5F9]">
                {step + 1} / {vehicle.trajectory.length} nodes
              </span>
            </div>
            <div>
              <span className="text-[#64748B]">Simulation: </span>
              <span className="text-emerald-400">
                {isPlaying ? "Driving 3D Route" : "Paused"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Instruction Badge */}
      <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-[#1E293B] bg-[#080D14]/80 px-2.5 py-1 text-[10px] text-[#64748B] backdrop-blur-xs pointer-events-none">
        Orbit: Left Click Drag · Pan: Right Click Drag · Zoom: Scroll
      </div>
    </div>
  );
}
