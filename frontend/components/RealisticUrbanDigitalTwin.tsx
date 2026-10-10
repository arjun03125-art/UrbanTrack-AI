"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface SceneProps {
  progress: number; // 0 to 1 float along sequence
  stageIndex: number; // 0 to 8
  activeCameraId: string | null;
  onSelectCamera: (camId: string) => void;
  isScanning: boolean;
}

export function RealisticUrbanDigitalTwin({
  progress,
  stageIndex,
  activeCameraId,
  onSelectCamera,
  isScanning,
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reqIdRef = useRef<number | null>(null);

  // Dynamic mesh references
  const heroVehicleRef = useRef<THREE.Group | null>(null);
  const trafficVehiclesRef = useRef<THREE.Group[]>([]);
  const conesRef = useRef<{ [key: string]: THREE.Mesh }>({});
  const cameraTowersRef = useRef<{ [key: string]: THREE.Group }>({});
  const trackTrailRef = useRef<THREE.Line | null>(null);
  const scanRingRef = useRef<THREE.Mesh | null>(null);
  const bboxWireframeRef = useRef<THREE.LineSegments | null>(null);
  const associationBeamRef = useRef<THREE.Line | null>(null);
  const embeddingParticlesRef = useRef<THREE.Points | null>(null);

  // 3 Camera schematic positions at urban intersection
  const camPositions: Record<string, [number, number, number]> = {
    CAM_S01_C001: [-22, 0, -14], // West junction
    CAM_S01_C002: [24, 0, -8],   // East expressway (Guarded)
    CAM_S01_C003: [-6, 0, 24],   // South flyover
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. SCENE CREATION
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x07090e); // Realistic deep dusk urban navy
    scene.fog = new THREE.FogExp2(0x07090e, 0.012);

    // 2. CAMERA SETUP
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(42, aspect, 1, 1000);
    camera.position.set(0, 32, 54);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;

    // 3. RENDERER SETUP WITH SHADOWS
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. REALISTIC URBAN LIGHTING
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.4);
    scene.add(ambientLight);

    // Moonlight / Distant High-Mast City Illumination
    const moonLight = new THREE.DirectionalLight(0x94a3b8, 1.6);
    moonLight.position.set(30, 55, 30);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.bias = -0.0005;
    scene.add(moonLight);

    // Warm roadside sodium streetlights
    const streetLight1 = new THREE.PointLight(0xfef08a, 1.2, 35, 1.8);
    streetLight1.position.set(-15, 8, -6);
    scene.add(streetLight1);

    const streetLight2 = new THREE.PointLight(0xfef08a, 1.2, 35, 1.8);
    streetLight2.position.set(15, 8, -6);
    scene.add(streetLight2);

    const streetLight3 = new THREE.PointLight(0xfef08a, 1.2, 35, 1.8);
    streetLight3.position.set(-4, 8, 15);
    scene.add(streetLight3);

    // 5. ROAD NETWORK WITH INTERSECTION & MARKINGS
    const groundGeo = new THREE.PlaneGeometry(240, 240);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x090d16 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Asphalt Roads
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x111622 });

    // Main 4-lane Arterial (East-West)
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(180, 16), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.02, -10);
    roadEW.receiveShadow = true;
    scene.add(roadEW);

    // Intersecting Avenue (North-South)
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(16, 180), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(-6, 0.02, 0);
    roadNS.receiveShadow = true;
    scene.add(roadNS);

    // Connecting Diagonal Ramp
    const roadDiag = new THREE.Mesh(new THREE.PlaneGeometry(80, 10), roadMat);
    roadDiag.rotation.x = -Math.PI / 2;
    roadDiag.rotation.z = Math.PI / 4;
    roadDiag.position.set(10, 0.02, 6);
    roadDiag.receiveShadow = true;
    scene.add(roadDiag);

    // Curbs & Sidewalks (Elevated concrete borders)
    const curbMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const createCurb = (w: number, d: number, x: number, z: number) => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), curbMat);
      curb.position.set(x, 0.12, z);
      curb.receiveShadow = true;
      scene.add(curb);
    };

    createCurb(180, 2, 0, -19);
    createCurb(180, 2, 0, -1);
    createCurb(2, 180, -15, 0);
    createCurb(2, 180, 3, 0);

    // Road Markings (White dashed line divider & stop bars)
    const dashMat = new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 2, gapSize: 1.5 });
    const dashGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-90, 0.06, -10),
      new THREE.Vector3(90, 0.06, -10),
    ]);
    const dashLine = new THREE.Line(dashGeo, dashMat);
    dashLine.computeLineDistances();
    scene.add(dashLine);

    const dashGeoNS = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-6, 0.06, -90),
      new THREE.Vector3(-6, 0.06, 90),
    ]);
    const dashLineNS = new THREE.Line(dashGeoNS, dashMat);
    dashLineNS.computeLineDistances();
    scene.add(dashLineNS);

    // 6. URBAN CITY BLOCKS (Realistic low-poly buildings with glowing windows)
    const bldgMat = new THREE.MeshLambertMaterial({ color: 0x0c111d });
    const bldgEdgeMat = new THREE.LineBasicMaterial({ color: 0x1e293b });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.25 });

    const createBuilding = (w: number, h: number, d: number, x: number, z: number) => {
      const bldgGroup = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldgMat);
      mesh.position.y = h / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      bldgGroup.add(mesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), bldgEdgeMat);
      edges.position.y = h / 2;
      bldgGroup.add(edges);

      // Window grid rows
      for (let floor = 2; floor < h - 2; floor += 3) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, 1), windowMat);
        win.position.set(0, floor, d / 2 + 0.05);
        bldgGroup.add(win);
      }

      bldgGroup.position.set(x, 0, z);
      scene.add(bldgGroup);
    };

    createBuilding(24, 22, 24, -36, -34);
    createBuilding(26, 32, 20, 34, -32);
    createBuilding(22, 18, 26, -34, 30);
    createBuilding(28, 26, 24, 32, 32);

    // 7. STREET LIGHT LAMPOSTS
    const lampPostMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const lampBulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const createStreetLamp = (x: number, z: number) => {
      const lamp = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 8, 8), lampPostMat);
      post.position.y = 4;
      lamp.add(post);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.1), lampPostMat);
      arm.position.set(0.8, 7.8, 0);
      lamp.add(arm);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), lampBulbMat);
      bulb.position.set(1.6, 7.6, 0);
      lamp.add(bulb);

      lamp.position.set(x, 0, z);
      scene.add(lamp);
    };

    createStreetLamp(-15, -3);
    createStreetLamp(15, -3);
    createStreetLamp(-4, 15);

    // 8. PHYSICAL CCTV CAMERA TOWERS
    Object.entries(camPositions).forEach(([camId, pos]) => {
      const camGroup = new THREE.Group();
      camGroup.position.set(pos[0], pos[1], pos[2]);

      // Steel Mounting Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 8, 12), lampPostMat);
      pole.position.y = 4;
      pole.castShadow = true;
      camGroup.add(pole);

      // Top Arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.18), lampPostMat);
      arm.position.set(0.9, 7.8, 0);
      camGroup.add(arm);

      // Professional CCTV Enclosure Housing
      const isGuarded = camId === "CAM_S01_C002";
      const housingMat = new THREE.MeshLambertMaterial({
        color: isGuarded ? 0x9333ea : 0x0284c7, // Purple for guarded C002, Cyan for C001/C003
      });
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.6), housingMat);
      housing.position.set(1.8, 7.5, 0);
      housing.rotation.z = -0.3;
      camGroup.add(housing);

      // Lens Ring
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.4, 12), new THREE.MeshBasicMaterial({ color: 0x10b981 }));
      lens.rotation.z = Math.PI / 2;
      lens.position.set(2.4, 7.35, 0);
      camGroup.add(lens);

      // Blinking Status LED
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: isGuarded ? 0xeab308 : 0x10b981 })
      );
      led.position.set(1.8, 7.9, 0.35);
      camGroup.add(led);

      // Volumetric CCTV Detection Cone (Frustum)
      const coneMat = new THREE.MeshBasicMaterial({
        color: isGuarded ? 0xa855f7 : 0x06b6d4,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
      });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(9, 16, 16, 1, true), coneMat);
      cone.position.set(7.5, 2.0, 0);
      cone.rotation.z = -Math.PI / 2.8;
      cone.rotation.y = camId === "CAM_S01_C003" ? -Math.PI / 4 : 0;
      cone.visible = false;
      camGroup.add(cone);
      conesRef.current[camId] = cone;

      scene.add(camGroup);
      cameraTowersRef.current[camId] = camGroup;
    });

    // 9. HERO VEHICLE: DETECTED & TRACKED CAR (CAM_S01_C001_trk_002)
    const heroCar = new THREE.Group();
    // Chassis
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 2.0), bodyMat);
    carBody.position.y = 0.7;
    carBody.castShadow = true;
    heroCar.add(carBody);

    // Cabin
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.7), cabinMat);
    cabin.position.set(-0.2, 1.5, 0);
    cabin.castShadow = true;
    heroCar.add(cabin);

    // Headlights (Warm forward beams)
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const hlR = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), hlMat);
    hlR.position.set(2.1, 0.7, 0.7);
    heroCar.add(hlR);
    const hlL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), hlMat);
    hlL.position.set(2.1, 0.7, -0.7);
    heroCar.add(hlL);

    // Wheels
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
    [
      [-1.3, 0.42, 1.05],
      [1.3, 0.42, 1.05],
      [-1.3, 0.42, -1.05],
      [1.3, 0.42, -1.05],
    ].forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      heroCar.add(wheel);
    });

    // AI Bounding Box HUD (Orange wireframe edges)
    const bboxGeo = new THREE.BoxGeometry(4.8, 2.4, 2.4);
    const bboxMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 });
    const bboxWireframe = new THREE.LineSegments(new THREE.EdgesGeometry(bboxGeo), bboxMat);
    bboxWireframe.position.y = 1.2;
    bboxWireframe.visible = false;
    heroCar.add(bboxWireframe);
    bboxWireframeRef.current = bboxWireframe;

    // AI Circular Radar Scan Ring
    const scanRingGeo = new THREE.RingGeometry(2.8, 3.2, 32);
    const scanRingMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const scanRing = new THREE.Mesh(scanRingGeo, scanRingMat);
    scanRing.rotation.x = -Math.PI / 2;
    scanRing.position.y = 0.08;
    scanRing.visible = false;
    heroCar.add(scanRing);
    scanRingRef.current = scanRing;

    heroCar.position.set(-45, 0, -10);
    scene.add(heroCar);
    heroVehicleRef.current = heroCar;

    // 10. BACKGROUND TRAFFIC VEHICLES (Truck and Motorcycle in background)
    // Background Truck
    const truck = new THREE.Group();
    const truckBody = new THREE.Mesh(new THREE.BoxGeometry(7.0, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: 0x475569 }));
    truckBody.position.y = 1.4;
    truckBody.castShadow = true;
    truck.add(truckBody);
    truck.position.set(-6, 0, -35);
    truck.rotation.y = Math.PI;
    scene.add(truck);
    trafficVehiclesRef.current.push(truck);

    // Background Motorcycle
    const bike = new THREE.Group();
    const bikeBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 0.6), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
    bikeBody.position.y = 0.6;
    bike.add(bikeBody);
    bike.position.set(-6, 0, 15);
    bike.rotation.y = Math.PI / 2;
    scene.add(bike);
    trafficVehiclesRef.current.push(bike);

    // 11. PERSISTENT TRACK TRAIL (ByteTrack Trajectory Curve)
    const trackCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-45, 0.15, -10),
      new THREE.Vector3(-22, 0.15, -10),
      new THREE.Vector3(-12, 0.15, -8),
      new THREE.Vector3(-6, 0.15, 4),
      new THREE.Vector3(-6, 0.15, 24),
    ]);
    const trackGeo = new THREE.BufferGeometry().setFromPoints(trackCurve.getPoints(50));
    const trackMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 3 });
    const trackLine = new THREE.Line(trackGeo, trackMat);
    trackLine.visible = false;
    scene.add(trackLine);
    trackTrailRef.current = trackLine;

    // 12. 512-D EMBEDDING PARTICLE CLOUD (Visual compact vector abstraction)
    const partCount = 72;
    const partGeo = new THREE.BufferGeometry();
    const partPos = new Float32Array(partCount * 3);
    for (let i = 0; i < partCount * 3; i += 3) {
      partPos[i] = (Math.random() - 0.5) * 3.5;
      partPos[i + 1] = Math.random() * 2.8 + 0.8;
      partPos[i + 2] = (Math.random() - 0.5) * 3.5;
    }
    partGeo.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
    const partMat = new THREE.PointsMaterial({ color: 0xa855f7, size: 0.28, transparent: true, opacity: 0.9 });
    const particles = new THREE.Points(partGeo, partMat);
    particles.visible = false;
    heroCar.add(particles);
    embeddingParticlesRef.current = particles;

    // 13. CROSS-CAMERA ASSOCIATION BEAM (C001 to C002 - Guarded)
    const beamCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-22, 7.8, -14),
      new THREE.Vector3(0, 18, -10),
      new THREE.Vector3(24, 7.8, -8)
    );
    const beamGeo = new THREE.BufferGeometry().setFromPoints(beamCurve.getPoints(36));
    const beamMat = new THREE.LineDashedMaterial({ color: 0xf43f5e, dashSize: 1.2, gapSize: 0.8 });
    const beamLine = new THREE.Line(beamGeo, beamMat);
    beamLine.computeLineDistances();
    beamLine.visible = false;
    scene.add(beamLine);
    associationBeamRef.current = beamLine;

    // 14. RAYCASTING INTERACTION FOR CAMERAS
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
          for (const cId of Object.keys(camPositions)) {
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

    // 15. SMOOTH ANIMATION LOOP
    const clock = new THREE.Clock();

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Subtle traffic idle animations
      trafficVehiclesRef.current.forEach((veh, idx) => {
        veh.position.z += Math.sin(elapsed + idx) * 0.02;
      });

      // Pulse scan ring when scanning
      if (scanRingRef.current && scanRingRef.current.visible) {
        const scale = 1 + Math.sin(elapsed * 8) * 0.15;
        scanRingRef.current.scale.set(scale, scale, 1);
      }

      // Rotate 512-D embedding particle cloud
      if (embeddingParticlesRef.current && embeddingParticlesRef.current.visible) {
        embeddingParticlesRef.current.rotation.y = elapsed * 1.5;
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

  // UPDATE SCENE BASED ON CINEMATIC VEHICLE PROGRESS & PIPELINE STAGE
  useEffect(() => {
    const heroCar = heroVehicleRef.current;
    const cones = conesRef.current;
    const bbox = bboxWireframeRef.current;
    const scan = scanRingRef.current;
    const trail = trackTrailRef.current;
    const beam = associationBeamRef.current;
    const parts = embeddingParticlesRef.current;
    const cam = cameraRef.current;

    if (!heroCar || !cam) return;

    // Movement path along road network:
    // Stage 0 (Idle): Start at -45
    // Stage 1-2 (Sensor/Detection): Enters C001 FOV at -22
    // Stage 3-5 (Track/Appearance): Moves to -12, turns into avenue
    // Stage 6-8 (Decision/Trajectory/Final): Moves south towards C003 (-6, 24)
    if (stageIndex === 0) {
      heroCar.position.set(-45, 0, -10);
      heroCar.rotation.y = 0;
      Object.values(cones).forEach((c) => (c.visible = false));
      if (bbox) bbox.visible = false;
      if (scan) scan.visible = false;
      if (trail) trail.visible = false;
      if (beam) beam.visible = false;
      if (parts) parts.visible = false;
      cam.position.set(0, 32, 54);
      cam.lookAt(0, 2, 0);
    } else if (stageIndex === 1) {
      // Vehicle entering C001 coverage
      heroCar.position.set(-28, 0, -10);
      heroCar.rotation.y = 0;
      if (cones["CAM_S01_C001"]) cones["CAM_S01_C001"].visible = true;
      if (bbox) bbox.visible = false;
      if (scan) scan.visible = false;
      if (trail) trail.visible = false;
      cam.position.set(-18, 16, 12);
      cam.lookAt(-22, 2, -10);
    } else if (stageIndex === 2) {
      // Bounding box detection + scanning
      heroCar.position.set(-22, 0, -10);
      heroCar.rotation.y = 0;
      if (cones["CAM_S01_C001"]) cones["CAM_S01_C001"].visible = true;
      if (bbox) bbox.visible = true;
      if (scan) scan.visible = true;
      if (trail) trail.visible = true;
      if (parts) parts.visible = false;
    } else if (stageIndex === 3) {
      // Tracklet acquired + 512-D Appearance Embedding
      heroCar.position.set(-16, 0, -10);
      if (bbox) bbox.visible = true;
      if (scan) scan.visible = false;
      if (trail) trail.visible = true;
      if (parts) parts.visible = true;
    } else if (stageIndex === 4) {
      // Candidate comparison with C002 (Guarded model check)
      heroCar.position.set(-10, 0, -9);
      if (cones["CAM_S01_C002"]) cones["CAM_S01_C002"].visible = true;
      if (beam) beam.visible = true;
      if (parts) parts.visible = false;
      cam.position.set(2, 24, 28);
      cam.lookAt(0, 4, -8);
    } else if (stageIndex === 5) {
      // Identity Decision (Candidate evaluation)
      heroCar.position.set(-6, 0, -4);
      heroCar.rotation.y = -Math.PI / 2; // Turning south
      if (beam) beam.visible = true;
    } else if (stageIndex === 6) {
      // Trajectory reconstruction towards C003
      heroCar.position.set(-6, 0, 14);
      heroCar.rotation.y = -Math.PI / 2;
      if (cones["CAM_S01_C003"]) cones["CAM_S01_C003"].visible = true;
      if (beam) beam.visible = false;
      if (trail) trail.visible = true;
      cam.position.set(-6, 18, 38);
      cam.lookAt(-6, 2, 24);
    } else if (stageIndex >= 7) {
      // Final Intelligence Overview: Zoom out
      heroCar.position.set(-6, 0, 24);
      Object.values(cones).forEach((c) => (c.visible = true));
      if (trail) trail.visible = true;
      if (bbox) bbox.visible = true;
      cam.position.set(0, 36, 56);
      cam.lookAt(0, 2, 0);
    }
  }, [stageIndex]);

  return (
    <div className="relative w-full h-full min-h-[580px] lg:min-h-[700px] bg-zinc-950 overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Subtitle / Schematic Watermark (Top Left) */}
      <div className="absolute top-4 left-6 pointer-events-none select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-xs font-mono font-bold tracking-widest text-zinc-200 uppercase">
            3D SCHEMATIC CITYFLOW NETWORK
          </span>
          <span className="px-2 py-0.5 rounded bg-zinc-900/90 border border-zinc-700/80 text-[10px] font-mono text-zinc-400">
            SCHEMATIC / NOT TO SCALE
          </span>
        </div>
        <p className="text-[11px] font-mono text-zinc-500 mt-1">
          Coordinate System: <strong className="text-zinc-400">cityflow_world</strong> (meters). No fabricated GPS.
        </p>
      </div>

      {/* Interactive Camera Quick-Select Buttons (Top Right) */}
      <div className="absolute top-4 right-6 flex items-center gap-2">
        {Object.keys(camPositions).map((cId) => (
          <button
            key={cId}
            onClick={() => onSelectCamera(cId)}
            className={`px-3 py-1.5 rounded-md text-xs font-mono border backdrop-blur transition-all ${
              activeCameraId === cId
                ? "bg-zinc-800/90 text-cyan-300 border-cyan-500 shadow-md font-bold"
                : "bg-zinc-950/80 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
            }`}
          >
            {cId === "CAM_S01_C002" ? `🛡️ ${cId.replace("CAM_S01_", "")}` : cId.replace("CAM_S01_", "")}
          </button>
        ))}
      </div>
    </div>
  );
}
