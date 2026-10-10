"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { MvpCameraTelemetry } from "@/types";

interface ThreeSceneProps {
  phase: number; // 0: Idle, 1: Sensors, 2: Perception, 3: Tracking, 4: Appearance, 5: Temporal, 6: Type, 7: Candidate, 8: Guard, 9: Uncertainty, 10: Trajectory, 11: Final
  activeCameraId: string | null;
  onSelectCamera: (camId: string) => void;
  isPaused: boolean;
}

export function CommandCenter3DScene({
  phase,
  activeCameraId,
  onSelectCamera,
  isPaused,
}: ThreeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reqIdRef = useRef<number | null>(null);

  // Mesh refs for dynamic animation
  const vehicleMeshRef = useRef<THREE.Group | null>(null);
  const conesRef = useRef<{ [key: string]: THREE.Mesh }>({});
  const cameraGroupsRef = useRef<{ [key: string]: THREE.Group }>({});
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const candidateArcRef = useRef<THREE.Line | null>(null);

  // Camera coordinates in schematic 3D space
  // CAM_S01_C001 (x: -16, z: -10)
  // CAM_S01_C002 (x: 18, z: -2)  [Guarded]
  // CAM_S01_C003 (x: -4, z: 18)
  const camPositions: Record<string, [number, number, number]> = {
    CAM_S01_C001: [-16, 0, -10],
    CAM_S01_C002: [18, 0, -2],
    CAM_S01_C003: [-4, 0, 18],
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. SCENE CREATION
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x06080c);
    scene.fog = new THREE.FogExp2(0x06080c, 0.015);

    // 2. CAMERA SETUP
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 1, 1000);
    camera.position.set(0, 36, 48);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. RENDERER SETUP
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. LIGHTING
    const ambientLight = new THREE.AmbientLight(0x2d3748, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xe2e8f0, 1.0);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    // 5. SCHEMATIC GROUND & ROAD NETWORK
    // Ground Grid
    const gridHelper = new THREE.GridHelper(120, 60, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    // Dark schematic road planes (Dual carriageways)
    const roadMat = new THREE.MeshBasicMaterial({ color: 0x0b1120 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x334155 });

    // Road 1: West-East
    const road1 = new THREE.Mesh(new THREE.PlaneGeometry(100, 10), roadMat);
    road1.rotation.x = -Math.PI / 2;
    road1.position.set(0, 0, -10);
    scene.add(road1);

    // Road 2: North-South Diagonal
    const road2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 80), roadMat);
    road2.rotation.x = -Math.PI / 2;
    road2.position.set(-4, 0, 10);
    scene.add(road2);

    // Road 3: East Connector
    const road3 = new THREE.Mesh(new THREE.PlaneGeometry(60, 8), roadMat);
    road3.rotation.x = -Math.PI / 2;
    road3.rotation.z = Math.PI / 4;
    road3.position.set(8, 0, 4);
    scene.add(road3);

    // Center divider dash lines
    const dividerMat = new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 1.5, gapSize: 1 });
    const dividerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-50, 0.05, -10),
      new THREE.Vector3(50, 0.05, -10),
    ]);
    const dividerLine = new THREE.Line(dividerGeo, dividerMat);
    dividerLine.computeLineDistances();
    scene.add(dividerLine);

    // 6. BUILDINGS / URBAN BLOCKS (Stylized dark wireframe blocks)
    const buildingMat = new THREE.MeshLambertMaterial({ color: 0x0f172a, transparent: true, opacity: 0.85 });
    const buildingEdgesMat = new THREE.LineBasicMaterial({ color: 0x1e293b });

    const createBlock = (w: number, h: number, d: number, x: number, z: number) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, buildingMat);
      mesh.position.set(x, h / 2, z);
      scene.add(mesh);

      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edges, buildingEdgesMat);
      line.position.copy(mesh.position);
      scene.add(line);
    };

    createBlock(16, 12, 16, -30, -25);
    createBlock(18, 16, 14, 28, -22);
    createBlock(14, 10, 16, -26, 22);
    createBlock(16, 14, 18, 25, 25);

    // 7. REALISTIC CCTV CAMERA TOWERS
    Object.entries(camPositions).forEach(([camId, pos]) => {
      const camGroup = new THREE.Group();
      camGroup.position.set(pos[0], pos[1], pos[2]);

      // Pole
      const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 6.5, 12);
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 3.25;
      camGroup.add(pole);

      // Arm
      const armGeo = new THREE.BoxGeometry(1.6, 0.15, 0.15);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(0.6, 6.2, 0);
      camGroup.add(arm);

      // Camera Housing
      const housingGeo = new THREE.BoxGeometry(0.8, 0.35, 0.45);
      const isGuarded = camId === "CAM_S01_C002";
      const housingMat = new THREE.MeshLambertMaterial({
        color: isGuarded ? 0x9333ea : 0x0284c7, // Violet for guarded C002, Cyan for C001/C003
      });
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(1.4, 6.0, 0);
      housing.rotation.z = -0.25;
      camGroup.add(housing);

      // Lens
      const lensGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.3, 12);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.rotation.z = Math.PI / 2;
      lens.position.set(1.8, 5.9, 0);
      camGroup.add(lens);

      // Status LED indicator
      const ledGeo = new THREE.SphereGeometry(0.1, 8, 8);
      const ledMat = new THREE.MeshBasicMaterial({
        color: isGuarded ? 0xeab308 : 0x10b981, // Yellow status for guarded C002, Green for active C001/C003
      });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(1.4, 6.3, 0.25);
      camGroup.add(led);

      // Detection Cone (Volumetric frustum)
      const coneGeo = new THREE.ConeGeometry(7, 12, 16, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: isGuarded ? 0xa855f7 : 0x06b6d4,
        transparent: true,
        opacity: 0.15,
        wireframe: true,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(5.5, 1.5, 0);
      cone.rotation.z = -Math.PI / 3;
      cone.rotation.y = camId === "CAM_S01_C003" ? -Math.PI / 4 : 0;
      cone.visible = false;
      camGroup.add(cone);
      conesRef.current[camId] = cone;

      scene.add(camGroup);
      cameraGroupsRef.current[camId] = camGroup;
    });

    // 8. 3D VEHICLE MODEL (Low-poly modern sedan)
    const vehicleGroup = new THREE.Group();
    // Body
    const carBodyMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
    const carCabinMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.8), carBodyMat);
    carBody.position.y = 0.6;
    vehicleGroup.add(carBody);

    const carCabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 1.5), carCabinMat);
    carCabin.position.set(-0.2, 1.3, 0);
    vehicleGroup.add(carCabin);

    // Wheels
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    [
      [-1.1, 0.35, 0.95],
      [1.1, 0.35, 0.95],
      [-1.1, 0.35, -0.95],
      [1.1, 0.35, -0.95],
    ].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      vehicleGroup.add(wheel);
    });

    // Bounding Box / Detection HUD Wireframe around vehicle
    const bboxGeo = new THREE.BoxGeometry(4.2, 1.9, 2.2);
    const bboxMat = new THREE.LineBasicMaterial({ color: 0xf59e0b }); // Amber detection box
    const bboxLines = new THREE.LineSegments(new THREE.EdgesGeometry(bboxGeo), bboxMat);
    bboxLines.position.y = 0.95;
    bboxLines.name = "bboxLines";
    bboxLines.visible = false;
    vehicleGroup.add(bboxLines);

    vehicleGroup.position.set(-35, 0, -10);
    scene.add(vehicleGroup);
    vehicleMeshRef.current = vehicleGroup;

    // 9. RECONSTRUCTED TOPOLOGICAL TRAJECTORY LINE
    const trajCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-16, 0.2, -10), // CAM_S01_C001
      new THREE.Vector3(-8, 0.2, -6),
      new THREE.Vector3(-4, 0.2, 6),
      new THREE.Vector3(-4, 0.2, 18),  // CAM_S01_C003
    ]);
    const trajGeo = new THREE.BufferGeometry().setFromPoints(trajCurve.getPoints(40));
    const trajMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2 }); // Confirmed green trajectory
    const trajLine = new THREE.Line(trajGeo, trajMat);
    trajLine.visible = false;
    scene.add(trajLine);
    trajectoryLineRef.current = trajLine;

    // 10. CANDIDATE ASSOCIATION ARC (Between CAM_S01_C001 & C002 - Guarded)
    const arcCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-16, 6.2, -10),
      new THREE.Vector3(0, 16, -6),
      new THREE.Vector3(18, 6.2, -2)
    );
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcCurve.getPoints(30));
    const arcMat = new THREE.LineDashedMaterial({ color: 0xec4899, dashSize: 1, gapSize: 0.8 }); // Pink guarded arc
    const arcLine = new THREE.Line(arcGeo, arcMat);
    arcLine.computeLineDistances();
    arcLine.visible = false;
    scene.add(arcLine);
    candidateArcRef.current = arcLine;

    // 11. CLICK INTERACTION / RAYCASTING
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let parent = hit.object.parent;
        while (parent) {
          for (const camId of Object.keys(camPositions)) {
            if (cameraGroupsRef.current[camId] === parent) {
              onSelectCamera(camId);
              return;
            }
          }
          parent = parent.parent;
        }
      }
    };
    container.addEventListener("pointerdown", handlePointerDown);

    // 12. ANIMATION LOOP
    let clock = new THREE.Clock();

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);

      if (!isPaused) {
        const elapsedTime = clock.getElapsedTime();

        // Slow cinematic camera panning if in final overview phase
        if (phase >= 11) {
          camera.position.x = 42 * Math.sin(elapsedTime * 0.08);
          camera.position.z = 42 * Math.cos(elapsedTime * 0.08);
          camera.lookAt(0, 2, 0);
        } else if (phase === 0) {
          camera.position.set(0, 36, 48);
          camera.lookAt(0, 0, 0);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
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

  // Update 3D scene elements when phase changes
  useEffect(() => {
    const cones = conesRef.current;
    const vehicle = vehicleMeshRef.current;
    const trajLine = trajectoryLineRef.current;
    const arcLine = candidateArcRef.current;
    const camera = cameraRef.current;

    if (!vehicle || !camera) return;

    const bboxLines = vehicle.getObjectByName("bboxLines");

    // Phase 0: Reset / Idle
    if (phase === 0) {
      Object.values(cones).forEach((c) => (c.visible = false));
      if (bboxLines) bboxLines.visible = false;
      if (trajLine) trajLine.visible = false;
      if (arcLine) arcLine.visible = false;
      vehicle.position.set(-35, 0, -10);
      camera.position.set(0, 36, 48);
      camera.lookAt(0, 0, 0);
    }
    // Phase 1: Sensors activation
    else if (phase === 1) {
      Object.values(cones).forEach((c) => (c.visible = true));
      if (bboxLines) bboxLines.visible = false;
    }
    // Phase 2: Perception
    else if (phase === 2) {
      if (cones["CAM_S01_C001"]) cones["CAM_S01_C001"].visible = true;
      vehicle.position.set(-20, 0, -10);
      if (bboxLines) bboxLines.visible = true;
    }
    // Phase 3: Tracking
    else if (phase === 3) {
      vehicle.position.set(-16, 0, -10);
      if (bboxLines) bboxLines.visible = true;
    }
    // Phase 4 - 7: Appearance / Temporal / Type / Decision Engine
    else if (phase >= 4 && phase <= 7) {
      vehicle.position.set(-14, 0, -10);
      if (cones["CAM_S01_C001"]) cones["CAM_S01_C001"].visible = true;
    }
    // Phase 8: Camera 2 Guard
    else if (phase === 8) {
      if (cones["CAM_S01_C002"]) cones["CAM_S01_C002"].visible = true;
      if (arcLine) arcLine.visible = true;
      // Focus camera towards C002
      camera.position.set(10, 24, 25);
      camera.lookAt(18, 5, -2);
    }
    // Phase 9: Uncertainty Engine
    else if (phase === 9) {
      if (arcLine) arcLine.visible = true;
      camera.position.set(0, 32, 42);
      camera.lookAt(0, 0, 0);
    }
    // Phase 10: Trajectory Engine
    else if (phase === 10) {
      if (trajLine) trajLine.visible = true;
      if (cones["CAM_S01_C003"]) cones["CAM_S01_C003"].visible = true;
      vehicle.position.set(-4, 0, 18);
    }
    // Phase 11: Final Intelligence
    else if (phase >= 11) {
      Object.values(cones).forEach((c) => (c.visible = true));
      if (trajLine) trajLine.visible = true;
      if (arcLine) arcLine.visible = true;
    }
  }, [phase]);

  return (
    <div className="relative w-full h-[620px] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      
      {/* Schematic Notice Label */}
      <div className="absolute top-3 left-4 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-[11px] font-mono tracking-wider text-zinc-300 font-bold uppercase">
            3D SCHEMATIC CITYFLOW NETWORK
          </span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[9px] font-mono text-zinc-400">
            SCHEMATIC / NOT TO SCALE
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
          World space projection: cityflow_world (meters). 0 fabricated GPS coordinates.
        </p>
      </div>

      {/* Camera Selection Pill Indicator */}
      <div className="absolute top-3 right-4 flex gap-2">
        {Object.keys(camPositions).map((cId) => (
          <button
            key={cId}
            onClick={() => onSelectCamera(cId)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all ${
              activeCameraId === cId
                ? "bg-zinc-800 text-cyan-300 border-cyan-500/80 shadow"
                : "bg-zinc-950/80 text-zinc-400 border-zinc-800 hover:text-zinc-200"
            }`}
          >
            {cId === "CAM_S01_C002" ? `🛡️ ${cId}` : cId}
          </button>
        ))}
      </div>
    </div>
  );
}
