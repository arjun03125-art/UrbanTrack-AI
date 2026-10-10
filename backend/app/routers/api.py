"""
UrbanTrack AI — REST API Endpoints
Endpoints for Member 3 Dashboard consuming normalized data with strict integrity.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from fastapi import Body
from app.services.data_adapter import (
    adapter,
    PROJECT_ROOT,
    UrbanTrackDataPackage,
    GlobalVehicleModel,
    CameraModel,
    ObservationModel,
    CameraNetworkModel,
    AlertModel,
    JourneyModel,
    DashboardSummaryModel
)

router = APIRouter(prefix="/api")


@router.get("/status")
def get_system_status():
    pkg = adapter.get_normalized_package()
    return {
        "status": "ONLINE",
        "data_mode": pkg.metadata.data_mode,
        "metadata": pkg.metadata,
        "data_issues": pkg.data_issues,
    }


@router.get("/telemetry")
def get_mvp_telemetry():
    pkg = adapter.get_normalized_package()
    return pkg.mvp_telemetry


@router.get("/overview")
def get_overview_metrics():
    pkg = adapter.get_normalized_package()
    
    total_observed_records = len(pkg.observations)
    unique_vehicles_count = len(pkg.vehicles)
    active_cameras_count = len([c for c in pkg.cameras if c.status == "ACTIVE"])
    vehicles_with_plate = len([v for v in pkg.vehicles if v.primary_plate is not None])
    reconstructed_trajectories = len([v for v in pkg.vehicles if len(v.trajectory) > 1])

    # Dynamic vehicle type breakdown calculated strictly from available data
    type_counts: Dict[str, int] = {}
    for v in pkg.vehicles:
        v_type = v.vehicle_type or "Unknown"
        type_counts[v_type] = type_counts.get(v_type, 0) + 1

    return {
        "data_mode": pkg.metadata.data_mode,
        "metadata": pkg.metadata,
        "metrics": {
            "total_observations": total_observed_records,
            "unique_global_vehicles": unique_vehicles_count,
            "active_cameras": active_cameras_count,
            "vehicles_with_plate": vehicles_with_plate,
            "reconstructed_trajectories": reconstructed_trajectories
        },
        "dashboard_summary": pkg.dashboard_summary,
        "vehicle_type_distribution": type_counts,
        "camera_summary": [
            {
                "camera_id": c.camera_id,
                "name": c.name,
                "vehicles_observed": c.vehicles_observed,
                "total_observations": c.total_observations,
                "status": c.status
            }
            for c in pkg.cameras
        ]
    }


@router.get("/search")
def search_everything(q: str = Query(..., min_length=1), limit: int = Query(25, ge=1, le=100)):
    """Search vehicles by vehicle ID, plate, vehicle type, camera ID, local track ID or observation ID.
    Each hit says which field matched, so the UI never has to guess."""
    from collections import defaultdict
    pkg = adapter.get_normalized_package()
    s = q.lower().strip()
    hits: List[Dict[str, Any]] = []

    obs_by_vehicle = defaultdict(list)
    obs_by_pair = defaultdict(list)
    for o in pkg.observations:
        if o.global_vehicle_id:
            obs_by_vehicle[o.global_vehicle_id.lower()].append(o)
        obs_by_pair[(o.camera_id, str(o.track_id))].append(o)

    for v in pkg.vehicles:
        matched: List[str] = []
        if s in v.global_vehicle_id.lower():
            matched.append("vehicle_id")
        if v.primary_plate and s in v.primary_plate.lower().replace(" ", ""):
            matched.append("plate")
        elif v.primary_plate and s in v.primary_plate.lower():
            matched.append("plate")
        if s in (v.vehicle_type or "").lower():
            matched.append("vehicle_type")
        if any(s in c.lower() for c in v.cameras_visited):
            matched.append("camera_id")

        tracks = list(v.trajectory)
        v_obs = list(obs_by_vehicle[v.global_vehicle_id.lower()])
        if not v_obs:
            pairs = {(a.camera_id, str(a.track_id)) for a in v.camera_local_associations} | {
                (t.camera_id, str(t.track_id)) for t in tracks
            }
            for p in pairs:
                v_obs.extend(obs_by_pair[p])

        if any(s == str(t.track_id).lower() or s.lstrip("#") == str(t.track_id).lower() for t in tracks) or any(
            s == str(o.track_id).lower() or s.lstrip("#") == str(o.track_id).lower() for o in v_obs
        ):
            matched.append("track_id")
        if any((t.observation_id or "").lower().find(s) >= 0 for t in tracks) or any(
            s in o.observation_id.lower() for o in v_obs
        ):
            matched.append("observation_id")
        if matched:
            hits.append({"vehicle": v, "matched_on": matched})
    hits.sort(key=lambda h: (0 if "vehicle_id" in h["matched_on"] else 1, h["vehicle"].global_vehicle_id))
    return {"query": q, "count": len(hits), "results": hits[:limit]}


@router.get("/vehicles", response_model=List[GlobalVehicleModel])
def list_vehicles(
    vehicle_type: Optional[str] = Query(None, description="Filter by vehicle type"),
    camera_id: Optional[str] = Query(None, description="Filter by camera visited"),
    has_plate: Optional[bool] = Query(None, description="Filter by plate existence"),
    search: Optional[str] = Query(None, description="Search by ID or plate")
):
    pkg = adapter.get_normalized_package()
    results = pkg.vehicles

    if vehicle_type:
        results = [v for v in results if v.vehicle_type.lower() == vehicle_type.lower()]
    
    if camera_id:
        results = [v for v in results if camera_id in v.cameras_visited]

    if has_plate is not None:
        if has_plate:
            results = [v for v in results if v.primary_plate is not None and len(v.primary_plate) > 0]
        else:
            results = [v for v in results if v.primary_plate is None]

    if search:
        s = search.lower().strip()
        results = [
            v for v in results
            if s in v.global_vehicle_id.lower() or (v.primary_plate and s in v.primary_plate.lower())
        ]

    return results


@router.get("/vehicles/{vehicle_id}", response_model=GlobalVehicleModel)
def get_vehicle_details(vehicle_id: str):
    pkg = adapter.get_normalized_package()
    for v in pkg.vehicles:
        if v.global_vehicle_id.lower() == vehicle_id.lower():
            return v
    raise HTTPException(status_code=404, detail=f"Vehicle '{vehicle_id}' not found.")


@router.get("/vehicles/{vehicle_id}/observations", response_model=List[ObservationModel])
def get_vehicle_observations(vehicle_id: str):
    pkg = adapter.get_normalized_package()
    # Match by global vehicle ID or camera track associations
    matched_v = next((v for v in pkg.vehicles if v.global_vehicle_id.lower() == vehicle_id.lower()), None)
    if not matched_v:
        raise HTTPException(status_code=404, detail=f"Vehicle '{vehicle_id}' not found.")

    matched_obs = []
    # Key pairs (camera_id, track_id)
    assoc_pairs = {(a.camera_id, a.track_id) for a in matched_v.camera_local_associations}

    for o in pkg.observations:
        # Strict separation: do not mix observations from different vehicles
        if o.global_vehicle_id:
            if o.global_vehicle_id.lower() == vehicle_id.lower():
                matched_obs.append(o)
        elif (o.camera_id, o.track_id) in assoc_pairs:
            matched_obs.append(o)

    matched_obs.sort(key=lambda x: (x.timestamp or "", x.frame_idx or 0))
    return matched_obs


@router.get("/evidence/{observation_id}")
def get_observation_evidence(observation_id: str):
    pkg = adapter.get_normalized_package()
    obs = next(
        (o for o in pkg.observations if o.observation_id.lower() == observation_id.lower() or str(o.track_id).lower() == observation_id.lower()),
        None
    )
    if not obs:
        raise HTTPException(status_code=404, detail=f"Observation '{observation_id}' not found.")

    frame_path = PROJECT_ROOT / "data" / "frames" / f"{observation_id}.jpg"
    video_path = PROJECT_ROOT / "data" / "videos" / f"{obs.camera_id}.mp4"

    return {
        "observation_id": obs.observation_id,
        "camera_id": obs.camera_id,
        "frame_idx": obs.frame_idx,
        "track_id": obs.track_id,
        "bbox": obs.bbox,
        "detection_confidence": obs.detection_confidence,
        "plate_text": obs.plate_text,
        "plate_confidence": obs.plate_confidence,
        "frame_available": frame_path.exists(),
        "frame_url": f"/data/frames/{observation_id}.jpg" if frame_path.exists() else None,
        "video_available": video_path.exists(),
        "video_url": f"/data/videos/{obs.camera_id}.mp4" if video_path.exists() else None,
        "message": (
            "Source frame asset verified in storage."
            if frame_path.exists()
            else f"Perception frame asset '{observation_id}.jpg' and camera feed '{obs.camera_id}.mp4' are not present in data storage. Upstream perception pipeline has not exported media files."
        )
    }


@router.get("/cameras", response_model=List[CameraModel])
def list_cameras():
    pkg = adapter.get_normalized_package()
    return pkg.cameras


@router.get("/cameras/{camera_id}", response_model=CameraModel)
def get_camera_details(camera_id: str):
    pkg = adapter.get_normalized_package()
    for c in pkg.cameras:
        if c.camera_id.lower() == camera_id.lower():
            return c
    raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")


@router.get("/camera-network", response_model=CameraNetworkModel)
def get_camera_network():
    pkg = adapter.get_normalized_package()
    return pkg.camera_network


@router.get("/trajectories")
def list_all_trajectories():
    pkg = adapter.get_normalized_package()
    return [
        {
            "global_vehicle_id": v.global_vehicle_id,
            "vehicle_type": v.vehicle_type,
            "primary_plate": v.primary_plate,
            "steps_count": len(v.trajectory),
            "trajectory": v.trajectory,
            "association_confidence": v.association_confidence,
            "tracking_type": v.tracking_type,
            "identity_status": v.identity_status,
            "cameras_visited": v.cameras_visited,
            "total_observations": v.total_observations,
            "available_observations": v.available_observations
        }
        for v in pkg.vehicles
        if len(v.trajectory) > 0
    ]


@router.get("/analytics")
def get_full_analytics():
    pkg = adapter.get_normalized_package()

    # Dynamic vehicle type counts
    vtype_counts: Dict[str, int] = {}
    for v in pkg.vehicles:
        vt = v.vehicle_type or "Unknown"
        vtype_counts[vt] = vtype_counts.get(vt, 0) + 1

    # Camera activity counts
    cam_activity = [
        {
            "camera_id": c.camera_id,
            "name": c.name or c.camera_id,
            "vehicles": c.vehicles_observed,
            "observations": c.total_observations
        }
        for c in pkg.cameras
    ]

    # Trajectory length distribution
    trajectory_lengths: Dict[int, int] = {}
    for v in pkg.vehicles:
        n = len(v.trajectory)
        trajectory_lengths[n] = trajectory_lengths.get(n, 0) + 1

    # Camera-to-camera transitions directly from trajectories
    c2c_transitions: Dict[str, int] = {}
    for v in pkg.vehicles:
        for i in range(len(v.trajectory) - 1):
            if v.trajectory[i].camera_id == v.trajectory[i + 1].camera_id:
                continue  # same-camera tracklet hop is not a camera-to-camera transition
            pair = f"{v.trajectory[i].camera_id} → {v.trajectory[i+1].camera_id}"
            c2c_transitions[pair] = c2c_transitions.get(pair, 0) + 1

    transition_list = [{"route": k, "count": v} for k, v in c2c_transitions.items()]

    return {
        "data_mode": pkg.metadata.data_mode,
        "vehicle_type_distribution": [{"type": k, "count": v} for k, v in vtype_counts.items()],
        "camera_activity": cam_activity,
        "trajectory_lengths": [{"hops": k, "count": v} for k, v in sorted(trajectory_lengths.items())],
        "camera_flows": transition_list,
        "camera_network": pkg.camera_network
    }


@router.post("/refresh")
def refresh_pipeline_data():
    """
    Re-scans storage files (pipeline or demo), reloads the data adapter,
    and returns fresh metrics, verification counts, and timestamps.
    """
    from datetime import datetime, timezone
    adapter.invalidate_cache()
    pkg = adapter.get_normalized_package()
    now_iso = datetime.now(timezone.utc).isoformat()

    located_cams = [c for c in pkg.cameras if c.latitude is not None and c.longitude is not None]
    unlocated_cams = [c.camera_id for c in pkg.cameras if c.latitude is None or c.longitude is None]

    warnings = []
    if unlocated_cams:
        warnings.append(f"{len(unlocated_cams)} camera(s) ({', '.join(unlocated_cams)}) lack verified geographic coordinates.")

    return {
        "status": "SUCCESS",
        "message": f"Pipeline data successfully refreshed in {pkg.metadata.data_mode} mode.",
        "data_mode": pkg.metadata.data_mode,
        "last_refreshed_at": now_iso,
        "cameras_count": len(pkg.cameras),
        "located_cameras_count": len(located_cams),
        "vehicles_count": len(pkg.vehicles),
        "observations_count": len(pkg.observations),
        "active_edges": len(pkg.camera_network.edges),
        "warnings": warnings
    }


@router.post("/import")
def import_pipeline_package(payload: Dict[str, Any]):
    """
    Imports and validates a new multi-camera intelligence or observation dataset,
    writing it to data/pipeline for live consumption.
    """
    from datetime import datetime, timezone
    import json

    now_iso = datetime.now(timezone.utc).isoformat()
    if not isinstance(payload, dict) or not (
        isinstance(payload.get("cameras", []), list)
        and isinstance(payload.get("global_vehicles", []), list)
        and ("cameras" in payload or "global_vehicles" in payload or "observations" in payload)
    ):
        raise HTTPException(status_code=422, detail="Payload must contain cameras[], global_vehicles[] and/or observations[].")
    pipeline_dir = PROJECT_ROOT / "data" / "pipeline"
    pipeline_dir.mkdir(parents=True, exist_ok=True)

    imported_intel = False
    imported_obs = False
    warnings = []

    # 1. Multi-camera Intelligence Import
    if "cameras" in payload or "global_vehicles" in payload:
        intel_data = {
            "system_metadata": payload.get("system_metadata", {
                "generated_at": now_iso,
                "pipeline_version": "1.0.0-imported",
                "data_mode": "LIVE_PIPELINE",
                "notes": "Imported via UrbanTrack AI Ingestion API."
            }),
            "cameras": payload.get("cameras", []),
            "camera_network": payload.get("camera_network", {"nodes": [], "edges": []}),
            "global_vehicles": payload.get("global_vehicles", []),
            **({"pipeline_metrics": payload["pipeline_metrics"]} if "pipeline_metrics" in payload else {}),
        }
        intel_path = pipeline_dir / "multicam_intelligence.json"
        with open(intel_path, "w", encoding="utf-8") as f:
            json.dump(intel_data, f, indent=2)
        imported_intel = True

    # 2. Observations Import
    if "observations" in payload and isinstance(payload["observations"], list):
        obs_path = pipeline_dir / "observations.json"
        with open(obs_path, "w", encoding="utf-8") as f:
            json.dump(payload["observations"], f, indent=2)
        imported_obs = True

    # Validate resulting package
    adapter.invalidate_cache()
    pkg = adapter.get_normalized_package()
    unlocated = [c.camera_id for c in pkg.cameras if c.latitude is None or c.longitude is None]
    if unlocated:
        warnings.append(f"{len(unlocated)} camera(s) lack verified WGS84 coordinates.")

    return {
        "status": "SUCCESS",
        "message": "Dataset successfully validated and ingested.",
        "imported_intelligence": imported_intel,
        "imported_observations": imported_obs,
        "imported_at": now_iso,
        "current_data_mode": pkg.metadata.data_mode,
        "total_vehicles": len(pkg.vehicles),
        "total_cameras": len(pkg.cameras),
        "total_observations": len(pkg.observations),
        "warnings": warnings
    }



@router.post("/upload")
def upload_file(kind: str = Query(..., pattern="^(observations|intelligence)$"), payload: Any = Body(...)):
    """Upload one Member 1 / Member 2 file. Validated, then written to data/pipeline."""
    import json
    pipeline_dir = PROJECT_ROOT / "data" / "pipeline"
    pipeline_dir.mkdir(parents=True, exist_ok=True)
    if kind == "observations":
        if isinstance(payload, dict) and isinstance(payload.get("observations"), list):
            payload = payload["observations"]
        if not isinstance(payload, list) or not all(isinstance(o, dict) for o in payload):
            raise HTTPException(422, "observations must be a JSON array of objects.")
        bad = [i for i, o in enumerate(payload[:5000]) if "camera_id" not in o]
        if bad:
            raise HTTPException(422, f"Records without camera_id (first at index {bad[0]}). Expected fields: observation_id, camera_id, track_id, timestamp, vehicle_type.")
        for i, o in enumerate(payload):
            o.setdefault("observation_id", f"obs_{i:06d}")
            o.setdefault("track_id", 0)
        target = pipeline_dir / "observations.json"
    else:
        if not isinstance(payload, dict) or not any(k in payload for k in ("cameras", "global_vehicles", "camera_network")):
            raise HTTPException(422, "intelligence must be an object with cameras[], global_vehicles[] and/or camera_network.")
        target = pipeline_dir / "multicam_intelligence.json"
    with open(target, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    adapter.invalidate_cache()
    pkg = adapter.get_normalized_package()
    return {"status": "SUCCESS", "kind": kind, "data_mode": pkg.metadata.data_mode,
            "observations": len(pkg.observations), "vehicles": len(pkg.vehicles), "cameras": len(pkg.cameras),
            "cameras_with_coordinates": len([c for c in pkg.cameras if c.latitude is not None]),
            "issues": pkg.data_issues}


@router.post("/reset")
def reset_to_demo():
    """Remove uploaded files so the app returns to the demo fixtures."""
    for name in ("observations.json", "multicam_intelligence.json"):
        f = PROJECT_ROOT / "data" / "pipeline" / name
        if f.exists():
            f.unlink()
    adapter.invalidate_cache()
    pkg = adapter.get_normalized_package()
    return {"status": "SUCCESS", "data_mode": pkg.metadata.data_mode, "vehicles": len(pkg.vehicles)}


@router.get("/observations/summary")
def observations_summary():
    """Chart-ready aggregates computed from the loaded observations (nothing precomputed or invented)."""
    from collections import Counter
    pkg = adapter.get_normalized_package()
    obs = pkg.observations
    per_min = Counter(o.timestamp[:16] for o in obs if o.timestamp)
    timeline = [{"t": k[11:16] if len(k) >= 16 else k, "count": v} for k, v in sorted(per_min.items())][-120:]
    bins = [0] * 10
    n_conf = 0
    for o in obs:
        if o.detection_confidence is not None:
            n_conf += 1
            bins[min(9, max(0, int(o.detection_confidence * 10)))] += 1
    conf_hist = [{"range": f"{i/10:.1f}-{(i+1)/10:.1f}", "count": bins[i]} for i in range(10)] if n_conf else []
    by_cam_type = Counter((o.camera_id, o.vehicle_type or "Unknown") for o in obs)
    status = Counter(("single_camera" if v.tracking_type == "single_camera" else v.identity_status) for v in pkg.vehicles)
    return {
        "total": len(obs),
        "timeline": timeline,
        "confidence_hist": conf_hist,
        "with_confidence": n_conf,
        "with_plate": len([o for o in obs if o.plate_text]),
        "by_camera_type": [{"camera_id": c, "type": t, "count": n} for (c, t), n in sorted(by_cam_type.items())],
        "status_distribution": [{"status": k, "count": n} for k, n in sorted(status.items())],
        "local_tracks": len({(o.camera_id, o.track_id) for o in obs}),
    }


@router.get("/alerts", response_model=List[AlertModel])
def list_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: high, medium, low"),
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    alert_type: Optional[str] = Query(None, alias="type", description="Filter by alert type")
):
    """List system alerts from the synthetic/live intelligence pipeline."""
    pkg = adapter.get_normalized_package()
    alerts = pkg.alerts or [AlertModel(**a) for a in adapter.load_alerts()]
    if severity:
        alerts = [a for a in alerts if (a.severity or "").lower() == severity.lower()]
    if camera_id:
        alerts = [a for a in alerts if (a.camera_id or "").lower() == camera_id.lower()]
    if alert_type:
        alerts = [a for a in alerts if (a.type or "").lower() == alert_type.lower()]
    return alerts


@router.get("/traffic-analytics")
@router.get("/traffic")
def get_traffic_analytics(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    congestion_level: Optional[str] = Query(None, description="Filter by congestion level: low, medium, high"),
    limit: int = Query(200, ge=1, le=1000)
):
    """Query 5-minute traffic analytics windows including density, speed, occupancy and congestion level."""
    rows = adapter.load_traffic_analytics()
    if camera_id:
        rows = [r for r in rows if r.get("camera_id", "").lower() == camera_id.lower()]
    if congestion_level:
        rows = [r for r in rows if r.get("congestion_level", "").lower() == congestion_level.lower()]

    high_windows = len([r for r in rows if (r.get("congestion_level") or "").lower() == "high"])

    return {
        "total_records": len(rows),
        "high_congestion_windows": high_windows,
        "records": rows[:limit]
    }


@router.get("/journeys", response_model=List[JourneyModel])
def list_journeys(
    camera_id: Optional[str] = Query(None, description="Filter by camera visited in route"),
    vehicle_id: Optional[str] = Query(None, description="Filter by synthetic vehicle ID"),
    route_status: Optional[str] = Query(None, description="Filter by route status"),
    limit: int = Query(100, ge=1, le=500)
):
    """List multi-camera reconstructed vehicle journeys."""
    pkg = adapter.get_normalized_package()
    journeys = pkg.journeys or [JourneyModel(**j) for j in adapter.load_journeys()]
    if camera_id:
        journeys = [j for j in journeys if camera_id in j.route_camera_sequence]
    if vehicle_id:
        journeys = [j for j in journeys if (j.synthetic_vehicle_id or "").lower() == vehicle_id.lower()]
    if route_status:
        journeys = [j for j in journeys if (j.route_status or "").lower() == route_status.lower()]
    return journeys[:limit]


@router.get("/journeys/{journey_id}", response_model=JourneyModel)
def get_journey_by_id(journey_id: str):
    """Get single reconstructed journey details by journey_id."""
    pkg = adapter.get_normalized_package()
    journeys = pkg.journeys or [JourneyModel(**j) for j in adapter.load_journeys()]
    for j in journeys:
        if j.journey_id.lower() == journey_id.lower():
            return j
    raise HTTPException(status_code=404, detail=f"Journey '{journey_id}' not found.")


@router.get("/associations")
@router.get("/association-hypotheses")
def list_association_hypotheses(
    decision: Optional[str] = Query(None, description="Filter by decision: confirmed, ambiguous, rejected"),
    camera_id: Optional[str] = Query(None, description="Filter by source or target camera ID"),
    min_score: Optional[float] = Query(None, ge=0.0, le=1.0),
    limit: int = Query(100, ge=1, le=1000)
):
    """List pairwise cross-camera association hypotheses with confidence and decision labels."""
    assocs = adapter.load_association_hypotheses()
    if decision:
        assocs = [a for a in assocs if (a.get("decision") or "").lower() == decision.lower()]
    if camera_id:
        cid = camera_id.lower()
        assocs = [a for a in assocs if a.get("source_camera_id", "").lower() == cid or a.get("target_camera_id", "").lower() == cid]
    if min_score is not None:
        assocs = [a for a in assocs if float(a.get("association_score", 0)) >= min_score]
    return {
        "total": len(assocs),
        "results": assocs[:limit]
    }


@router.get("/plate-lookup")
@router.get("/plates")
def lookup_plates(
    q: Optional[str] = Query(None, description="Search plate text or vehicle ID"),
    limit: int = Query(50, ge=1, le=500)
):
    """Search plate lookup registry for synthetic vehicle identities."""
    entries = adapter.load_plate_lookup()
    if q:
        s = q.lower().strip()
        entries = [
            e for e in entries
            if s in (e.get("plate_text") or "").lower()
            or s in (e.get("synthetic_vehicle_id_for_ground_truth_only") or "").lower()
            or s in (e.get("journey_id") or "").lower()
        ]
    return {
        "count": len(entries),
        "results": entries[:limit]
    }


@router.get("/dashboard-summary")
def get_dashboard_summary():
    """Returns headline metrics and dataset verification counts."""
    pkg = adapter.get_normalized_package()
    if pkg.dashboard_summary:
        return pkg.dashboard_summary
    p = PROJECT_ROOT / "data" / "demo" / "14_dashboard_summary.json"
    if p.exists():
        import json
        return json.loads(p.read_text(encoding="utf-8"))
    return {}
