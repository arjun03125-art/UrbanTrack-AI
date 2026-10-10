"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  createSedanMesh,
  createSuvMesh,
  createTruckMesh,
  createCargoTruckMesh,
  orientVehicle,
} from "@/lib/vehicleModels";

interface DigitalTwinProps {
  stage: number; // 0: Idle, 1: Detection, 2: Tracking, 3: Appearance, 4: Association, 5: Guard, 6: Decision, 7: Trajectory
  onSelectCamera: (camId: string) => void;
  activeCameraId: string | null;
  onVehicleScreenPosUpdate?: (pos: { x: number; y: number } | null) => void;
  onTargetVehicleScreenPosUpdate?: (pos: { x: number; y: number } | null) => void;
}

// =========================================================================
// UNIFIED ROAD NETWORK COORDINATE SYSTEM
// =========================================================================
// East-West Arterial: Centerline at z = -10.0 (Road bounds: z in [-18, -2], width = 16)
// North-South Boulevard: Centerline at x = -8.0 (Road bounds: x in [-16, 0], width = 16)
// Intersection Center: (x = -8.0, z = -10.0)
//
// LANE CENTERLINES:
// Eastbound Lane (moving East, +X): z = -6.0
// Westbound Lane (moving West, -X): z = -14.0
// Southbound Lane (moving South, +Z): x = -12.0
// Northbound Lane (moving North, -Z): x = -4.0
// =========================================================================

export function UrbanDigitalTwinEngine({
  stage,
  onSelectCamera,
  activeCameraId,
  onVehicleScreenPosUpdate,
  onTargetVehicleScreenPosUpdate,
}: DigitalTwinProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reqIdRef = useRef<number | null>(null);

  // Dynamic mesh references
  const heroSedanRef = useRef<THREE.Group | null>(null);
  const candidateVehicleBRef = useRef<THREE.Group | null>(null);
  const heroBboxRef = useRef<THREE.LineSegments | null>(null);
  const heroTrailRef = useRef<THREE.Line | null>(null);
  const cameraConesRef = useRef<{ [key: string]: THREE.Mesh }>({});
  const cameraTowersRef = useRef<{ [key: string]: THREE.Group }>({});
  const appearanceScanRingRef = useRef<THREE.Group | null>(null);
  const associationLineRef = useRef<THREE.Line | null>(null);
  const fullNetworkTrajectoryRef = useRef<THREE.Line | null>(null);

  // Hero vehicle path definition
  const heroCurveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const currentHeroTRef = useRef<number>(0.05);
  const targetHeroTRef = useRef<number>(0.05);

  // Camera 3D positions in schematic urban intersection
  const CAM_CONFIG: Record<
    string,
    {
      polePos: [number, number, number];
      lensPos: [number, number, number];
      targetLanePos: [number, number, number];
      armDir: [number, number, number];
    }
  > = {
    // CAM 1: West approach, monitors Eastbound lane at z = -6.0
    CAM_S01_C001: {
      polePos: [-24, 0, -1.0],
      lensPos: [-24, 7.8, -4.5],
      targetLanePos: [-24, 0.1, -6.0],
      armDir: [0, 0, -1],
    },
    // CAM 2: East Avenue, monitors Eastbound lane at z = -6.0 (Model Guarded)
    CAM_S01_C002: {
      polePos: [22, 0, -1.0],
      lensPos: [22, 7.8, -4.5],
      targetLanePos: [22, 0.1, -6.0],
      armDir: [0, 0, -1],
    },
    // CAM 3: South Boulevard, monitors Southbound lane at x = -12.0
    CAM_S01_C003: {
      polePos: [-17.5, 0, 26.0],
      lensPos: [-14.5, 7.8, 26.0],
      targetLanePos: [-12.0, 0.1, 26.0],
      armDir: [1, 0, 0],
    },
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. SCENE SETUP - BRIGHT ENGINEERING DAYLIGHT DIGITAL TWIN
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xe2e8f0); // Bright clean engineering daylight (Slate-200)
    scene.fog = new THREE.Fog(0xe2e8f0, 80, 240);

    // 2. CAMERA SETUP
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(38, aspect, 1, 1000);
    camera.position.set(0, 44, 62);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // 3. RENDERER SETUP WITH CRISP REALISTIC SHADOWS
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. DAYLIGHT SOLAR ILLUMINATION & AMBIENT
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.4); // Warm clear sunlight
    sunLight.position.set(45, 75, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 250;
    const d = 65;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.45);
    scene.add(hemiLight);

    // 5. GROUND, TERRAIN & REALISTIC ROADS
    const terrainGeo = new THREE.PlaneGeometry(320, 320);
    const terrainMat = new THREE.MeshLambertMaterial({ color: 0xdde3ea });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    scene.add(terrain);

    // Dark realistic asphalt roads
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x242b35 });

    // East-West 4-lane Arterial Road (Width = 16, centered at z = -10.0, spans z: [-18, -2])
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(240, 16), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.02, -10);
    roadEW.receiveShadow = true;
    scene.add(roadEW);

    // North-South Boulevard (Width = 16, centered at x = -8.0, spans x: [-16, 0])
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(16, 240), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(-8, 0.02, 0);
    roadNS.receiveShadow = true;
    scene.add(roadNS);

    // Sidewalks (Elevated concrete borders with realistic bevel)
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xc8d1dc });
    const createSidewalk = (w: number, d: number, x: number, z: number) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, d), sidewalkMat);
      sw.position.set(x, 0.14, z);
      sw.receiveShadow = true;
      scene.add(sw);
    };

    // Sidewalk blocks outside the intersection
    createSidewalk(240, 3, 0, -19.5); // North sidewalk of EW road
    createSidewalk(240, 3, 0, -0.5);  // South sidewalk of EW road
    createSidewalk(3, 240, -17.5, 0); // West sidewalk of NS road
    createSidewalk(3, 240, 1.5, 0);   // East sidewalk of NS road

    // Crisp white road markings: Centerlines
    const markingMat = new THREE.LineDashedMaterial({ color: 0xf8fafc, dashSize: 2.2, gapSize: 1.8 });

    // East-West Centerline (z = -10.0)
    const markingGeoEW = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-120, 0.06, -10),
      new THREE.Vector3(120, 0.06, -10),
    ]);
    const markingLineEW = new THREE.Line(markingGeoEW, markingMat);
    markingLineEW.computeLineDistances();
    scene.add(markingLineEW);

    // North-South Centerline (x = -8.0)
    const markingGeoNS = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-8, 0.06, -120),
      new THREE.Vector3(-8, 0.06, 120),
    ]);
    const markingLineNS = new THREE.Line(markingGeoNS, markingMat);
    markingLineNS.computeLineDistances();
    scene.add(markingLineNS);

    // Stop Lines at Intersection Approaches
    const stopLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const createStopLine = (w: number, d: number, x: number, z: number) => {
      const sl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), stopLineMat);
      sl.rotation.x = -Math.PI / 2;
      sl.position.set(x, 0.07, z);
      scene.add(sl);
    };
    // EW Eastbound approach stop line (at x = -16.0, across z: [-10, -2])
    createStopLine(0.6, 7.5, -16.0, -6.0);
    // EW Westbound approach stop line (at x = 0.0, across z: [-18, -10])
    createStopLine(0.6, 7.5, 0.0, -14.0);
    // NS Southbound approach stop line (at z = -18.0, across x: [-16, -8])
    createStopLine(7.5, 0.6, -12.0, -18.0);
    // NS Northbound approach stop line (at z = -2.0, across x: [-8, 0])
    createStopLine(7.5, 0.6, -4.0, -2.0);

    // 6. URBAN ARCHITECTURE & SURROUNDINGS
    const bldgMat = new THREE.MeshLambertMaterial({ color: 0xa0aec0 });
    const bldgTrimMat = new THREE.MeshLambertMaterial({ color: 0x718096 });

    const createArchitecture = (w: number, h: number, d: number, x: number, z: number) => {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldgMat);
      mesh.position.y = h / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const roofTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), bldgTrimMat);
      roofTrim.position.y = h + 0.4;
      roofTrim.castShadow = true;
      group.add(roofTrim);

      group.position.set(x, 0, z);
      scene.add(group);
    };

    // Surrounding buildings placed safely outside roads and sidewalks
    createArchitecture(28, 22, 28, -42, -40);
    createArchitecture(32, 34, 24, 40, -38);
    createArchitecture(24, 18, 30, -38, 40);
    createArchitecture(30, 26, 28, 38, 42);

    // Low-poly green trees along sidewalks
    const foliageMat = new THREE.MeshLambertMaterial({ color: 0x2f855a });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x744210 });

    const createTree = (x: number, z: number) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6), trunkMat);
      trunk.position.y = 1.25;
      trunk.castShadow = true;
      tree.add(trunk);

      const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.8, 6), foliageMat);
      leaves.position.y = 4.0;
      leaves.castShadow = true;
      tree.add(leaves);

      tree.position.set(x, 0, z);
      scene.add(tree);
    };

    [-36, -24, 18, 32].forEach((x) => createTree(x, -23));
    [-36, -24, 18, 32].forEach((x) => createTree(x, 3));

    // 7. REALISTIC CCTV CAMERA UNITS ALIGNED WITH MONITORED LANES
    Object.entries(CAM_CONFIG).forEach(([camId, cfg]) => {
      const camGroup = new THREE.Group();
      camGroup.position.set(cfg.polePos[0], cfg.polePos[1], cfg.polePos[2]);

      // Steel Pole mounted on the sidewalk
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.26, 8.5, 12),
        new THREE.MeshLambertMaterial({ color: 0x4a5568 })
      );
      pole.position.y = 4.25;
      pole.castShadow = true;
      camGroup.add(pole);

      // Horizontal Bracket Arm extending over the road lane
      const armLength = Math.hypot(cfg.lensPos[0] - cfg.polePos[0], cfg.lensPos[2] - cfg.polePos[2]);
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, armLength + 0.4),
        new THREE.MeshLambertMaterial({ color: 0x4a5568 })
      );
      // Position arm midway between pole and lens
      const armMidX = (cfg.lensPos[0] - cfg.polePos[0]) * 0.5;
      const armMidZ = (cfg.lensPos[2] - cfg.polePos[2]) * 0.5;
      arm.position.set(armMidX, 8.0, armMidZ);
      arm.lookAt(cfg.lensPos[0] - cfg.polePos[0], 8.0, cfg.lensPos[2] - cfg.polePos[2]);
      camGroup.add(arm);

      // CCTV Housing mounted at lensPos
      const isGuarded = camId === "CAM_S01_C002";
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.6, 1.4),
        new THREE.MeshLambertMaterial({ color: isGuarded ? 0xd97706 : 0x2b6cb0 })
      );
      const relLensX = cfg.lensPos[0] - cfg.polePos[0];
      const relLensZ = cfg.lensPos[2] - cfg.polePos[2];
      housing.position.set(relLensX, 7.8, relLensZ);
      housing.lookAt(
        cfg.targetLanePos[0] - cfg.polePos[0],
        cfg.targetLanePos[1],
        cfg.targetLanePos[2] - cfg.polePos[2]
      );
      housing.castShadow = true;
      camGroup.add(housing);

      // Status Indicator LED
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshBasicMaterial({ color: isGuarded ? 0xf59e0b : 0x10b981 })
      );
      led.position.set(relLensX, 8.25, relLensZ);
      camGroup.add(led);

      // Volumetric Detection Cone:
      // Cone tip is positioned at lensPos, base projects directly onto monitored lane!
      const coneHeight = 10.0;
      const coneRadius = 6.0;
      const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 16, 1, true);
      // Translate so cone tip is at origin (0, 0, 0) and points along -Z
      coneGeo.translate(0, -coneHeight / 2, 0);
      coneGeo.rotateX(-Math.PI / 2);

      const coneMat = new THREE.MeshLambertMaterial({
        color: isGuarded ? 0xf59e0b : 0x3b82f6,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(cfg.lensPos[0], cfg.lensPos[1], cfg.lensPos[2]);
      cone.lookAt(cfg.targetLanePos[0], cfg.targetLanePos[1], cfg.targetLanePos[2]);
      cone.visible = false;
      scene.add(cone);
      cameraConesRef.current[camId] = cone;

      scene.add(camGroup);
      cameraTowersRef.current[camId] = camGroup;
    });

    // =========================================================================
    // 8. HERO VEHICLE & PRECISE LANE PATH DEFINITION
    // =========================================================================
    // The Hero Vehicle (Royal Blue Sedan) travels Eastbound in lane z = -6.0,
    // approaches the intersection, smoothly curves right into the Southbound lane (x = -12.0),
    // and continues South down to CAM_S01_C003.
    // =========================================================================
    const heroWaypoints = [
      new THREE.Vector3(-70.0, 0, -6.0),   // Start queued Eastbound
      new THREE.Vector3(-36.0, 0, -6.0),   // Approach
      new THREE.Vector3(-24.0, 0, -6.0),   // CAM_S01_C001 detection zone
      new THREE.Vector3(-18.0, 0, -6.0),   // ByteTrack tracking zone
      new THREE.Vector3(-14.5, 0, -6.0),   // Intersection entry
      new THREE.Vector3(-13.6, 0, -5.2),   // Smooth right turn initiation
      new THREE.Vector3(-12.8, 0, -3.8),   // Smooth turn apex
      new THREE.Vector3(-12.0, 0, -1.8),   // Aligning with Southbound lane
      new THREE.Vector3(-12.0, 0, 6.0),    // South Boulevard advance (Decision)
      new THREE.Vector3(-12.0, 0, 26.0),   // CAM_S01_C003 detection zone
      new THREE.Vector3(-12.0, 0, 70.0),   // Boulevard exit
    ];

    const heroCurve = new THREE.CatmullRomCurve3(heroWaypoints, false, "centripetal", 0.5);
    heroCurveRef.current = heroCurve;

    // Spawn Hero Sedan
    const heroCar = createSedanMesh(0x2563eb);
    // Initial position & heading at t = 0.05
    const initPt = heroCurve.getPointAt(0.05);
    const nextPt = heroCurve.getPointAt(0.06);
    const initDir = nextPt.clone().sub(initPt).setY(0).normalize();
    heroCar.position.copy(initPt);
    orientVehicle(heroCar, initDir, 1.0);
    scene.add(heroCar);
    heroSedanRef.current = heroCar;

    // Tight 3D Bounding Box around Sedan (Length along Z, Width along X)
    const bboxGeo = new THREE.BoxGeometry(2.3, 1.9, 4.7);
    const bboxMat = new THREE.LineBasicMaterial({ color: 0xf97316, linewidth: 2 });
    const bboxLines = new THREE.LineSegments(new THREE.EdgesGeometry(bboxGeo), bboxMat);
    bboxLines.position.y = 1.0;
    bboxLines.visible = false;
    heroCar.add(bboxLines);
    heroBboxRef.current = bboxLines;

    // 9. CANDIDATE TARGET VEHICLE B (Silver SUV on East Avenue at C002, z = -6.0)
    const targetSuv = createSuvMesh(0x94a3b8);
    targetSuv.position.set(22.0, 0, -6.0); // Exactly on Eastbound lane at C002
    orientVehicle(targetSuv, new THREE.Vector3(1, 0, 0), 1.0); // Facing East (+X)
    targetSuv.visible = false;
    scene.add(targetSuv);
    candidateVehicleBRef.current = targetSuv;

    // =========================================================================
    // 10. AMBIENT TRAFFIC: FULLY SYNCHRONIZED WITH ROAD & LANE PATHS
    // =========================================================================
    interface AmbientVehicleDef {
      mesh: THREE.Group;
      type: "straight" | "turn";
      laneCurve?: THREE.CatmullRomCurve3;
      p1?: THREE.Vector3;
      p2?: THREE.Vector3;
      speed: number;
      t: number;
    }

    const trafficVehicles: AmbientVehicleDef[] = [];

    // Ambient 1: White Delivery Box Truck (Westbound on East-West road: z = -14.0)
    // Moving West (-X). Cabin points West, cargo box follows behind!
    const truck1 = createTruckMesh(0xf8fafc);
    scene.add(truck1);
    trafficVehicles.push({
      mesh: truck1,
      type: "straight",
      p1: new THREE.Vector3(80, 0, -14.0),
      p2: new THREE.Vector3(-80, 0, -14.0),
      speed: 0.0007,
      t: 0.15,
    });

    // Ambient 2: Heavy Blue Cargo Truck (Southbound on North-South road: x = -12.0)
    // Moving South (+Z). Cabin points South, container follows behind!
    const cargoTruck = createCargoTruckMesh(0x1e3a8a);
    scene.add(cargoTruck);
    trafficVehicles.push({
      mesh: cargoTruck,
      type: "straight",
      p1: new THREE.Vector3(-12.0, 0, -75),
      p2: new THREE.Vector3(-12.0, 0, 75),
      speed: 0.0006,
      t: 0.6,
    });

    // Ambient 3: White Sedan (Northbound on North-South road: x = -4.0)
    // Moving North (-Z). Front points North, trunk follows! (Opposite lane to Southbound truck!)
    const whiteSedan = createSedanMesh(0xf1f5f9);
    scene.add(whiteSedan);
    trafficVehicles.push({
      mesh: whiteSedan,
      type: "straight",
      p1: new THREE.Vector3(-4.0, 0, 75),
      p2: new THREE.Vector3(-4.0, 0, -75),
      speed: 0.00065,
      t: 0.35,
    });

    // Ambient 4: Red Compact SUV (Eastbound on East-West road: z = -6.0)
    // Moving East (+X). Front points East! (Opposite lane to Westbound delivery truck!)
    const redSuv = createSuvMesh(0xdc2626);
    scene.add(redSuv);
    trafficVehicles.push({
      mesh: redSuv,
      type: "straight",
      p1: new THREE.Vector3(-95, 0, -6.0),
      p2: new THREE.Vector3(95, 0, -6.0),
      speed: 0.00072,
      t: 0.75,
    });

    // Ambient 5: Silver Sedan Turning Right at Intersection (NB to EB)
    // Enters from Northbound lane (x = -4.0), curves smoothly right into Eastbound lane (z = -6.0)
    const turningSedan = createSedanMesh(0xcbd5e1);
    const turnCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-4.0, 0, 60),
        new THREE.Vector3(-4.0, 0, 0),
        new THREE.Vector3(-3.5, 0, -3.5),
        new THREE.Vector3(-1.5, 0, -5.5),
        new THREE.Vector3(2.0, 0, -6.0),
        new THREE.Vector3(75.0, 0, -6.0),
      ],
      false,
      "centripetal",
      0.5
    );
    scene.add(turningSedan);
    trafficVehicles.push({
      mesh: turningSedan,
      type: "turn",
      laneCurve: turnCurve,
      speed: 0.00055,
      t: 0.1,
    });

    // Initialize all ambient vehicles at their starting positions and tangents
    trafficVehicles.forEach((veh) => {
      let cur: THREE.Vector3;
      let nxt: THREE.Vector3;
      if (veh.type === "straight" && veh.p1 && veh.p2) {
        cur = veh.p1.clone().lerp(veh.p2, veh.t);
        nxt = veh.p1.clone().lerp(veh.p2, Math.min(1.0, veh.t + 0.01));
      } else if (veh.laneCurve) {
        cur = veh.laneCurve.getPointAt(veh.t);
        nxt = veh.laneCurve.getPointAt(Math.min(1.0, veh.t + 0.01));
      } else {
        return;
      }
      veh.mesh.position.copy(cur);
      const dir = nxt.clone().sub(cur).setY(0).normalize();
      orientVehicle(veh.mesh, dir, 1.0);
    });

    // 11. PERSISTENT BLUE TRACKING TRAIL (Drawn strictly along heroLaneCurve)
    const trailMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3 });
    const trailGeo = new THREE.BufferGeometry();
    const trailLine = new THREE.Line(trailGeo, trailMat);
    trailLine.visible = false;
    scene.add(trailLine);
    heroTrailRef.current = trailLine;

    // 12. 512-D APPEARANCE EMBEDDING VISUALIZATION SCAN RING
    const embedGroup = new THREE.Group();
    [1.8, 2.6].forEach((r) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.05, 32),
        new THREE.MeshBasicMaterial({ color: 0x8b5cf6, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
      );
      ring.rotation.x = -Math.PI / 2;
      embedGroup.add(ring);
    });
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const h = 0.35 + Math.sin(i * 3) * 0.25;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, 0.08), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
      bar.position.set(Math.cos(angle) * 2.6, h / 2, Math.sin(angle) * 2.6);
      embedGroup.add(bar);
    }
    embedGroup.visible = false;
    scene.add(embedGroup);
    appearanceScanRingRef.current = embedGroup;

    // 13. CANDIDATE CAMERA ASSOCIATION ARC (Connecting Hero Sedan A to Candidate SUV B)
    const arcCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-12, 1.8, -6),
      new THREE.Vector3(5, 14, -6),
      new THREE.Vector3(22, 1.8, -6)
    );
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcCurve.getPoints(36));
    const arcMat = new THREE.LineDashedMaterial({ color: 0xeab308, dashSize: 1.2, gapSize: 0.8 });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    arcLine.computeLineDistances();
    arcLine.visible = false;
    scene.add(arcLine);
    associationLineRef.current = arcLine;

    // 14. FULL TOPOLOGICAL CAMERA NETWORK TRAJECTORY LINE
    // Strictly generated from heroCurve: From C001 (-24, -6) through intersection to C003 (-12, 26)
    const fullTrajPoints = heroCurve.getPoints(120).filter((pt) => pt.x >= -24.5 && pt.z <= 26.5);
    const fullTrajGeo = new THREE.BufferGeometry().setFromPoints(
      fullTrajPoints.map((p) => new THREE.Vector3(p.x, 0.18, p.z))
    );
    const fullTrajMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 4 });
    const fullTrajLine = new THREE.Line(fullTrajGeo, fullTrajMat);
    fullTrajLine.visible = false;
    scene.add(fullTrajLine);
    fullNetworkTrajectoryRef.current = fullTrajLine;

    // 15. INTERACTIVE RAYCASTING FOR CAMERAS
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let p = hit.object.parent;
        while (p) {
          for (const cId of Object.keys(CAM_CONFIG)) {
            if (cameraTowersRef.current[cId] === p) {
              onSelectCamera(cId);
              return;
            }
          }
          p = p.parent;
        }
      }
    };
    container.addEventListener("pointerdown", handlePointerDown);

    // =========================================================================
    // 16. ANIMATION & VEHICLE SYNCHRONIZATION LOOP
    // =========================================================================
    const clock = new THREE.Clock();

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // A. Smooth Hero Vehicle progress along its road curve
      if (heroCurveRef.current && heroSedanRef.current) {
        const diff = targetHeroTRef.current - currentHeroTRef.current;
        if (Math.abs(diff) > 0.0005) {
          currentHeroTRef.current += diff * 0.08;
        } else {
          currentHeroTRef.current = targetHeroTRef.current;
        }

        const t = Math.max(0.001, Math.min(0.99, currentHeroTRef.current));
        const curPos = heroCurveRef.current.getPointAt(t);
        const nextPos = heroCurveRef.current.getPointAt(Math.min(1.0, t + 0.01));
        const travelDir = nextPos.clone().sub(curPos).setY(0).normalize();

        heroSedanRef.current.position.copy(curPos);
        // Vehicle rotation is 100% synchronized with the curve tangent
        orientVehicle(heroSedanRef.current, travelDir, 0.25);

        // Position appearance scan ring directly beneath hero car
        if (appearanceScanRingRef.current && appearanceScanRingRef.current.visible) {
          appearanceScanRingRef.current.position.set(curPos.x, 0.1, curPos.z);
          appearanceScanRingRef.current.rotation.y = elapsed * 0.8;
        }
      }

      // B. Ambient Traffic: continuous lane-following
      trafficVehicles.forEach((veh) => {
        veh.t += veh.speed;
        if (veh.t >= 1.0) {
          veh.t = 0.0;
        }

        let cur: THREE.Vector3;
        let nxt: THREE.Vector3;

        if (veh.type === "straight" && veh.p1 && veh.p2) {
          cur = veh.p1.clone().lerp(veh.p2, veh.t);
          nxt = veh.p1.clone().lerp(veh.p2, Math.min(1.0, veh.t + 0.01));
        } else if (veh.laneCurve) {
          cur = veh.laneCurve.getPointAt(veh.t);
          nxt = veh.laneCurve.getPointAt(Math.min(1.0, veh.t + 0.01));
        } else {
          return;
        }

        veh.mesh.position.copy(cur);
        const travelDir = nxt.clone().sub(cur).setY(0).normalize();
        orientVehicle(veh.mesh, travelDir, 0.2);
      });

      // C. Project 3D Hero Vehicle position to Screen Space for AR Label
      if (heroSedanRef.current && onVehicleScreenPosUpdate) {
        const heroPos = new THREE.Vector3();
        heroSedanRef.current.getWorldPosition(heroPos);
        heroPos.y += 2.2;

        heroPos.project(camera);
        const halfWidth = container.clientWidth / 2;
        const halfHeight = container.clientHeight / 2;
        const screenX = heroPos.x * halfWidth + halfWidth;
        const screenY = -(heroPos.y * halfHeight) + halfHeight;

        if (heroPos.z < 1) {
          onVehicleScreenPosUpdate({ x: screenX, y: screenY });
        } else {
          onVehicleScreenPosUpdate(null);
        }
      }

      // D. Project Target Vehicle B position to Screen Space (Stage 4)
      if (candidateVehicleBRef.current && candidateVehicleBRef.current.visible && onTargetVehicleScreenPosUpdate) {
        const bPos = new THREE.Vector3();
        candidateVehicleBRef.current.getWorldPosition(bPos);
        bPos.y += 2.2;

        bPos.project(camera);
        const halfWidth = container.clientWidth / 2;
        const halfHeight = container.clientHeight / 2;
        const screenX = bPos.x * halfWidth + halfWidth;
        const screenY = -(bPos.y * halfHeight) + halfHeight;

        if (bPos.z < 1) {
          onTargetVehicleScreenPosUpdate({ x: screenX, y: screenY });
        } else {
          onTargetVehicleScreenPosUpdate(null);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("pointerdown", handlePointerDown);
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // =========================================================================
  // STEP-BY-STEP GUIDED VEHICLE PIPELINE STAGES
  // =========================================================================
  useEffect(() => {
    const heroCurve = heroCurveRef.current;
    const targetB = candidateVehicleBRef.current;
    const bbox = heroBboxRef.current;
    const trail = heroTrailRef.current;
    const cones = cameraConesRef.current;
    const embed = appearanceScanRingRef.current;
    const arc = associationLineRef.current;
    const fullTraj = fullNetworkTrajectoryRef.current;
    const cam = cameraRef.current;

    if (!heroCurve || !cam) return;

    // STAGE 0: STANDBY
    if (stage === 0) {
      targetHeroTRef.current = 0.05;
      if (targetB) targetB.visible = false;
      Object.values(cones).forEach((c) => (c.visible = false));
      if (bbox) bbox.visible = false;
      if (trail) trail.visible = false;
      if (embed) embed.visible = false;
      if (arc) arc.visible = false;
      if (fullTraj) fullTraj.visible = false;
      cam.position.set(0, 44, 62);
      cam.lookAt(0, 1, 0);
    }
    // STAGE 1: DETECTION (C001 scans vehicle at x = -24, z = -6)
    else if (stage === 1) {
      targetHeroTRef.current = 0.22; // Point at CAM_S01_C001
      if (targetB) targetB.visible = false;
      Object.values(cones).forEach((c) => (c.visible = false));
      if (cones["CAM_S01_C001"]) cones["CAM_S01_C001"].visible = true;
      if (bbox) {
        bbox.visible = true;
        (bbox.material as THREE.LineBasicMaterial).color.setHex(0xf97316); // Orange detection
      }
      if (trail) trail.visible = false;
      if (embed) embed.visible = false;
      if (arc) arc.visible = false;
      if (fullTraj) fullTraj.visible = false;
      cam.position.set(-20, 16, 16);
      cam.lookAt(-24, 1.8, -6);
    }
    // STAGE 2: TRACKING (ByteTrack initializes blue trail along lane)
    else if (stage === 2) {
      targetHeroTRef.current = 0.32; // Tracking zone at x = -16, z = -6
      if (targetB) targetB.visible = false;
      Object.values(cones).forEach((c) => (c.visible = false));
      if (cones["CAM_S01_C001"]) cones["CAM_S01_C001"].visible = true;
      if (bbox) {
        bbox.visible = true;
        (bbox.material as THREE.LineBasicMaterial).color.setHex(0x0284c7); // Blue tracking
      }
      if (trail) {
        trail.visible = true;
        const trailPts = [new THREE.Vector3(-24, 0.15, -6), new THREE.Vector3(-16, 0.15, -6)];
        trail.geometry.setFromPoints(trailPts);
      }
      if (embed) embed.visible = false;
      if (arc) arc.visible = false;
      if (fullTraj) fullTraj.visible = false;
      cam.position.set(-12, 16, 16);
      cam.lookAt(-16, 1.8, -6);
    }
    // STAGE 3: APPEARANCE ANALYSIS (512-D OSNet Embedding)
    else if (stage === 3) {
      targetHeroTRef.current = 0.32;
      if (targetB) targetB.visible = false;
      if (embed) embed.visible = true;
      if (bbox) bbox.visible = true;
      if (trail) trail.visible = true;
      if (arc) arc.visible = false;
      if (fullTraj) fullTraj.visible = false;
      cam.position.set(-14, 12, 10);
      cam.lookAt(-16, 1.5, -6);
    }
    // STAGE 4: CAMERA ASSOCIATION (Comparing Vehicle A with Vehicle B on East Avenue)
    else if (stage === 4) {
      targetHeroTRef.current = 0.40; // Approaching intersection at x = -12, z = -6
      if (targetB) targetB.visible = true; // Silver SUV visible on East Avenue
      if (embed) embed.visible = false;
      Object.values(cones).forEach((c) => (c.visible = false));
      if (cones["CAM_S01_C002"]) cones["CAM_S01_C002"].visible = true;
      if (arc) {
        arc.visible = true;
        (arc.material as THREE.LineDashedMaterial).color.setHex(0xeab308); // Yellow Candidate
      }
      if (fullTraj) fullTraj.visible = false;
      cam.position.set(5, 24, 28);
      cam.lookAt(5, 2, -6);
    }
    // STAGE 5: MODEL COMPATIBILITY GUARD (C002 Guarded warning)
    else if (stage === 5) {
      targetHeroTRef.current = 0.40;
      if (targetB) targetB.visible = true;
      if (embed) embed.visible = false;
      if (cones["CAM_S01_C002"]) cones["CAM_S01_C002"].visible = true;
      if (arc) {
        arc.visible = true;
        (arc.material as THREE.LineDashedMaterial).color.setHex(0xf59e0b); // Guarded amber
      }
      if (fullTraj) fullTraj.visible = false;
      cam.position.set(8, 22, 24);
      cam.lookAt(22, 6, -6);
    }
    // STAGE 6: IDENTITY DECISION (Completes right turn into Southbound lane)
    else if (stage === 6) {
      targetHeroTRef.current = 0.65; // On South Boulevard at x = -12, z = 6
      if (targetB) targetB.visible = false;
      if (arc) arc.visible = false;
      if (embed) embed.visible = false;
      if (trail) {
        trail.visible = true;
        // Trail follows the curve from C001 to South Boulevard
        const pts = heroCurve.getPoints(80).filter((p) => p.x >= -24.5 && p.z <= 6.5);
        trail.geometry.setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0.15, p.z)));
      }
      if (fullTraj) fullTraj.visible = false;
      cam.position.set(-12, 18, 30);
      cam.lookAt(-12, 1.8, 6);
    }
    // STAGE 7: TRAJECTORY INTELLIGENCE & FULL NETWORK VIEW
    else if (stage >= 7) {
      targetHeroTRef.current = 0.82; // At CAM_S01_C003 at x = -12, z = 26
      if (targetB) targetB.visible = false;
      if (arc) arc.visible = false;
      if (embed) embed.visible = false;
      if (trail) trail.visible = false;
      Object.values(cones).forEach((c) => (c.visible = true)); // All 3 cameras active
      if (fullTraj) fullTraj.visible = true;
      if (bbox) bbox.visible = true;
      // Bird's-eye perspective revealing the complete 3-camera digital twin network
      cam.position.set(0, 52, 65);
      cam.lookAt(0, 2, 4);
    }
  }, [stage]);

  return (
    <div className="relative w-full h-full bg-slate-200 select-none overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Interactive Camera Quick-Select Nodes */}
      <div className="absolute top-16 right-6 flex items-center gap-2 z-20">
        {Object.keys(CAM_CONFIG).map((cId) => (
          <button
            key={cId}
            onClick={() => onSelectCamera(cId)}
            className={`px-3 py-1.5 rounded-md text-xs font-mono border backdrop-blur transition-all shadow-sm ${
              activeCameraId === cId
                ? "bg-white text-blue-700 border-blue-600 font-bold ring-2 ring-blue-500/30"
                : "bg-white/90 text-slate-700 border-slate-300 hover:bg-white hover:text-slate-900"
            }`}
          >
            {cId === "CAM_S01_C002" ? `⚠ ${cId.replace("CAM_S01_", "")} (GUARDED)` : cId.replace("CAM_S01_", "")}
          </button>
        ))}
      </div>
    </div>
  );
}
