"""
UrbanTrack AI - Data Adapter & Ingestion Service
Supports the new Complete Synthetic Project Dataset schema (46 cameras, tracklets-based).
Falls back to legacy demo (multicam_intelligence.json) or pipeline uploads if present.
"""

from pathlib import Path
import json
import csv
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
PIPELINE_DIR = DATA_DIR / "pipeline"
DEMO_DIR = DATA_DIR / "demo"


class ObservationModel(BaseModel):
    observation_id: str
    camera_id: str
    track_id: str
    global_vehicle_id: Optional[str] = None
    timestamp: Optional[str] = None
    vehicle_type: str = "Unknown"
    detection_confidence: Optional[float] = None
    plate_text: Optional[str] = None
    plate_confidence: Optional[float] = None
    bbox: Optional[List[int]] = None
    frame_idx: Optional[int] = None


class TrajectoryStepModel(BaseModel):
    step: int
    camera_id: str
    track_id: str
    timestamp: Optional[str] = None
    observation_id: Optional[str] = None


class CameraLocalAssocModel(BaseModel):
    camera_id: str
    track_id: str
    confidence: Optional[float] = None


class GlobalVehicleModel(BaseModel):
    global_vehicle_id: str
    vehicle_type: str
    primary_plate: Optional[str] = None
    plate_confidence: Optional[float] = None
    color_label: Optional[str] = None
    association_confidence: Optional[float] = None
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    total_observations: int = 0
    available_observations: int = 0
    cameras_visited: List[str] = []
    trajectory: List[TrajectoryStepModel] = []
    camera_local_associations: List[CameraLocalAssocModel] = []
    tracking_type: str = "cross_camera"
    identity_status: str = "candidate"


class CameraModel(BaseModel):
    camera_id: str
    name: Optional[str] = None
    location_description: Optional[str] = None
    status: str = "UNKNOWN"
    fps: Optional[int] = None
    video_available: bool = False
    vehicles_observed: int = 0
    total_observations: int = 0
    last_observation: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coordinate_system: Optional[str] = "WGS84"
    view_direction: Optional[str] = None
    road_segment: Optional[str] = None
    reliability_score: Optional[float] = None
    avg_vehicles_per_5min: Optional[float] = None
    avg_speed_kmh: Optional[float] = None
    high_congestion_windows: Optional[int] = None


class CameraNetworkEdgeModel(BaseModel):
    source: str
    target: str
    vehicle_flow_count: int
    prior_score: Optional[float] = None
    estimated_travel_time_min: Optional[float] = None


class CameraNetworkNodeModel(BaseModel):
    id: str
    label: str
    x: Optional[float] = None
    y: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coordinate_system: Optional[str] = "WGS84"


class CameraNetworkModel(BaseModel):
    nodes: List[CameraNetworkNodeModel] = []
    edges: List[CameraNetworkEdgeModel] = []


class SystemMetadataModel(BaseModel):
    generated_at: Optional[str] = None
    pipeline_version: Optional[str] = None
    data_mode: str = "DEMO"
    total_cameras: int = 0
    notes: Optional[str] = None
    scenario_id: Optional[str] = None


class MvpTelemetryModel(BaseModel):
    available: bool = False
    source: Optional[str] = None
    dataset_scope: Optional[str] = None
    total_observations: Optional[int] = None
    total_tracklets: Optional[int] = None
    persisted_embeddings: Optional[int] = None
    embedding_dimension: Optional[int] = None
    pairwise_decisions: Optional[Dict[str, int]] = None
    identity_clusters: Optional[Dict[str, int]] = None
    evaluation: Optional[Dict[str, Any]] = None
    calibration: Optional[Dict[str, Any]] = None
    cameras: Dict[str, Dict[str, Any]] = {}
    extra: Dict[str, Any] = {}


class AlertModel(BaseModel):
    alert_id: str
    timestamp: Optional[str] = None
    type: Optional[str] = None
    severity: Optional[str] = None
    camera_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    recommended_action: Optional[str] = None
    synthetic: bool = True


class JourneyModel(BaseModel):
    journey_id: str
    scenario_id: Optional[str] = None
    synthetic_vehicle_id: Optional[str] = None
    tracklets: List[Dict[str, str]] = []
    route_camera_sequence: List[str] = []
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    route_status: Optional[str] = None
    synthetic: bool = True


class DashboardSummaryModel(BaseModel):
    cameras: int = 0
    vehicles: int = 0
    tracklets: int = 0
    observations: int = 0
    journeys: int = 0
    association_confirmed: int = 0
    association_ambiguous: int = 0
    association_rejected: int = 0
    high_congestion_windows: int = 0


class UrbanTrackDataPackage(BaseModel):
    metadata: SystemMetadataModel
    vehicles: List[GlobalVehicleModel]
    cameras: List[CameraModel]
    camera_network: CameraNetworkModel
    observations: List[ObservationModel]
    alerts: List[AlertModel] = []
    journeys: List[JourneyModel] = []
    dashboard_summary: Optional[DashboardSummaryModel] = None
    mvp_telemetry: MvpTelemetryModel = Field(default_factory=MvpTelemetryModel)
    data_issues: List[str] = []


class DataAdapter:
    def __init__(self):
        self._current_mode = "AUTO"
        self._cached_package: Optional[UrbanTrackDataPackage] = None
        self._cache_source: Optional[str] = None

    def invalidate_cache(self):
        self._cached_package = None
        self._cache_source = None

    def _pipeline_present(self) -> bool:
        return (PIPELINE_DIR / "multicam_intelligence.json").exists() or \
               (PIPELINE_DIR / "observations.json").exists()

    def _new_schema_present(self) -> bool:
        return (DEMO_DIR / "01_camera_registry.json").exists() and \
               (DEMO_DIR / "04_tracklets.json").exists()

    def get_effective_data_mode(self) -> str:
        if self._pipeline_present():
            return "LIVE_PIPELINE"
        return "DEMO"

    def _load_new_schema_package(self) -> "UrbanTrackDataPackage":
        issues: List[str] = []
        cam_reg_raw = json.loads((DEMO_DIR / "01_camera_registry.json").read_text(encoding="utf-8"))
        cam_graph_raw = json.loads((DEMO_DIR / "02_camera_graph.json").read_text(encoding="utf-8"))
        tracklets_raw = json.loads((DEMO_DIR / "04_tracklets.json").read_text(encoding="utf-8"))
        assoc_raw = json.loads((DEMO_DIR / "06_association_hypotheses.json").read_text(encoding="utf-8"))
        journeys_raw = json.loads((DEMO_DIR / "07_reconstructed_journeys.json").read_text(encoding="utf-8"))
        plate_lookup_raw = json.loads((DEMO_DIR / "08_plate_search_lookup.json").read_text(encoding="utf-8"))
        cam_analytics_raw = json.loads((DEMO_DIR / "12_camera_analytics_summary.json").read_text(encoding="utf-8")) if (DEMO_DIR / "12_camera_analytics_summary.json").exists() else []
        alerts_raw = json.loads((DEMO_DIR / "13_alerts.json").read_text(encoding="utf-8")) if (DEMO_DIR / "13_alerts.json").exists() else []
        dash_raw = json.loads((DEMO_DIR / "14_dashboard_summary.json").read_text(encoding="utf-8")) if (DEMO_DIR / "14_dashboard_summary.json").exists() else {}

        raw_edges = cam_graph_raw.get("edges", []) if isinstance(cam_graph_raw, dict) else cam_graph_raw
        cam_analytics_map = {c["camera_id"]: c for c in cam_analytics_raw if "camera_id" in c}

        cam_tracklet_count: Dict[str, int] = {}
        cam_vehicle_ids: Dict[str, set] = {}
        cam_last_seen: Dict[str, str] = {}
        tracklet_map: Dict[str, Dict] = {}

        for t in tracklets_raw:
            cid = t.get("camera_id", "")
            tid = t.get("track_id", "")
            cam_tracklet_count[cid] = cam_tracklet_count.get(cid, 0) + 1
            veh_id = t.get("synthetic_vehicle_id_for_ground_truth_only")
            if veh_id:
                cam_vehicle_ids.setdefault(cid, set()).add(veh_id)
            end_t = t.get("end_time", "")
            if end_t and (not cam_last_seen.get(cid) or end_t > cam_last_seen[cid]):
                cam_last_seen[cid] = end_t
            if tid:
                tracklet_map[tid] = t

        cameras: List[CameraModel] = []
        for c in cam_reg_raw:
            cid = c.get("camera_id", "")
            analytics = cam_analytics_map.get(cid, {})
            lat = c.get("latitude_demo_only")
            lon = c.get("longitude_demo_only")
            if lat is not None and lon is not None:
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    issues.append(f"{cid}: invalid lat/lon, excluded from map.")
                    lat = lon = None
            cameras.append(CameraModel(
                camera_id=cid,
                name=c.get("display_name"),
                location_description=c.get("road_segment"),
                status="ACTIVE",
                fps=c.get("nominal_fps"),
                video_available=False,
                vehicles_observed=len(cam_vehicle_ids.get(cid, set())),
                total_observations=cam_tracklet_count.get(cid, 0),
                last_observation=cam_last_seen.get(cid),
                latitude=lat,
                longitude=lon,
                coordinate_system="WGS84" if lat is not None else None,
                view_direction=c.get("view_direction"),
                road_segment=c.get("road_segment"),
                reliability_score=c.get("camera_reliability_score"),
                avg_vehicles_per_5min=analytics.get("avg_vehicles_per_5min"),
                avg_speed_kmh=analytics.get("avg_speed_kmh"),
                high_congestion_windows=analytics.get("high_congestion_windows"),
            ))

        nodes = [CameraNetworkNodeModel(id=c.camera_id, label=c.name or c.camera_id, latitude=c.latitude, longitude=c.longitude, coordinate_system=c.coordinate_system) for c in cameras]
        edges = [CameraNetworkEdgeModel(source=e.get("source", ""), target=e.get("target", ""), vehicle_flow_count=1, prior_score=e.get("prior_score"), estimated_travel_time_min=e.get("estimated_travel_time_min")) for e in raw_edges if e.get("source") and e.get("target")]
        camera_network = CameraNetworkModel(nodes=nodes, edges=edges)

        journeys: List[JourneyModel] = [JourneyModel(journey_id=j.get("journey_id", ""), scenario_id=j.get("scenario_id"), synthetic_vehicle_id=j.get("synthetic_vehicle_id_for_ground_truth_only"), tracklets=j.get("tracklets", []), route_camera_sequence=j.get("route_camera_sequence", []), first_seen=j.get("first_seen"), last_seen=j.get("last_seen"), route_status=j.get("route_status", "reconstructed"), synthetic=j.get("synthetic", True)) for j in journeys_raw]

        veh_journey_map = {j.synthetic_vehicle_id: j for j in journeys if j.synthetic_vehicle_id}
        veh_tracklets_map: Dict[str, List[Dict]] = {}
        for t in tracklets_raw:
            vid = t.get("synthetic_vehicle_id_for_ground_truth_only")
            if vid:
                veh_tracklets_map.setdefault(vid, []).append(t)

        plate_lookup_map = {}
        for entry in plate_lookup_raw:
            vid = entry.get("synthetic_vehicle_id_for_ground_truth_only") or entry.get("vehicle_id")
            plate = entry.get("plate_text") or entry.get("plate")
            if vid and plate:
                plate_lookup_map[vid] = plate

        assoc_map: Dict[str, Dict] = {}
        assoc_decisions = {"confirmed": 0, "ambiguous": 0, "rejected": 0}
        for a in assoc_raw:
            src_tid = a.get("source_track_id", "")
            decision = a.get("decision", "ambiguous")
            assoc_map[src_tid] = a
            if decision in assoc_decisions:
                assoc_decisions[decision] += 1

        def _identity_status(vid):
            trks = veh_tracklets_map.get(vid, [])
            decisions = [assoc_map[t.get("track_id", "")].get("decision", "ambiguous") for t in trks if t.get("track_id") in assoc_map]
            if not decisions:
                return "single_camera" if len(trks) <= 1 else "candidate"
            if "confirmed" in decisions:
                return "confirmed"
            if "ambiguous" in decisions:
                return "ambiguous"
            return "rejected"

        obs_file = DEMO_DIR / "05_observations.jsonl"
        observations: List[ObservationModel] = []
        track_first_obs: Dict[str, str] = {}
        veh_obs_count: Dict[str, int] = {}
        cam_obs_count: Dict[str, int] = {}

        if obs_file.exists():
            with open(obs_file, "r", encoding="utf-8") as f:
                for idx, line in enumerate(f):
                    line_s = line.strip()
                    if not line_s:
                        continue
                    o = json.loads(line_s)
                    t_id = o.get("track_id", "")
                    cid = o.get("camera_id", "")
                    obs_id = f"obs_{idx+1:05d}"
                    if t_id and t_id not in track_first_obs:
                        track_first_obs[t_id] = obs_id

                    t_info = tracklet_map.get(t_id, {})
                    vid = t_info.get("synthetic_vehicle_id_for_ground_truth_only")
                    if vid:
                        veh_obs_count[vid] = veh_obs_count.get(vid, 0) + 1
                    if cid:
                        cam_obs_count[cid] = cam_obs_count.get(cid, 0) + 1

                    bbox_raw = o.get("bbox_xywh")
                    bbox_x1y1x2y2 = None
                    if bbox_raw and len(bbox_raw) == 4:
                        bbox_x1y1x2y2 = [
                            int(bbox_raw[0]),
                            int(bbox_raw[1]),
                            int(bbox_raw[0] + bbox_raw[2]),
                            int(bbox_raw[1] + bbox_raw[3]),
                        ]

                    observations.append(ObservationModel(
                        observation_id=obs_id,
                        camera_id=cid,
                        track_id=t_id,
                        global_vehicle_id=vid,
                        timestamp=o.get("timestamp"),
                        vehicle_type=(o.get("vehicle_type") or "Unknown").capitalize(),
                        detection_confidence=o.get("detection_confidence"),
                        plate_text=o.get("plate_text"),
                        plate_confidence=o.get("plate_confidence"),
                        bbox=bbox_x1y1x2y2,
                        frame_idx=o.get("frame_id"),
                    ))
        else:
            observations = [ObservationModel(observation_id=t.get("track_id", f"obs_{i:06d}"), camera_id=t.get("camera_id",""), track_id=t.get("track_id",""), global_vehicle_id=t.get("synthetic_vehicle_id_for_ground_truth_only"), timestamp=t.get("start_time"), vehicle_type=t.get("vehicle_type","Unknown"), detection_confidence=t.get("detection_confidence"), plate_text=t.get("plate_text"), plate_confidence=t.get("plate_confidence")) for i, t in enumerate(tracklets_raw)]

        # If observations were loaded, update cameras total observations
        if cam_obs_count:
            for c in cameras:
                if c.camera_id in cam_obs_count:
                    c.total_observations = cam_obs_count[c.camera_id]

        vehicles: List[GlobalVehicleModel] = []
        all_veh_ids = set(veh_journey_map.keys()) | set(veh_tracklets_map.keys())
        for vid in sorted(all_veh_ids):
            journey = veh_journey_map.get(vid)
            trks = veh_tracklets_map.get(vid, [])
            trajectory: List[TrajectoryStepModel] = []
            if journey:
                for i, step in enumerate(journey.tracklets):
                    cam_id = step.get("camera_id", "")
                    tid = step.get("track_id", "")
                    mt = tracklet_map.get(tid, {})
                    step_obs_id = track_first_obs.get(tid, tid)
                    trajectory.append(TrajectoryStepModel(step=i+1, camera_id=cam_id, track_id=tid, timestamp=mt.get("start_time"), observation_id=step_obs_id))
            elif trks:
                for i, t in enumerate(sorted(trks, key=lambda x: x.get("start_time", ""))):
                    tid = t.get("track_id", "")
                    step_obs_id = track_first_obs.get(tid, tid)
                    trajectory.append(TrajectoryStepModel(step=i+1, camera_id=t.get("camera_id", ""), track_id=tid, timestamp=t.get("start_time"), observation_id=step_obs_id))
            assocs = [CameraLocalAssocModel(camera_id=t.get("camera_id", ""), track_id=t.get("track_id", ""), confidence=t.get("detection_confidence")) for t in trks]
            cameras_visited = list(dict.fromkeys(step.camera_id for step in trajectory))
            plates = sorted([t for t in trks if t.get("plate_text")], key=lambda x: x.get("plate_confidence", 0), reverse=True)
            primary_plate = plates[0].get("plate_text") if plates else plate_lookup_map.get(vid)
            plate_conf = plates[0].get("plate_confidence") if plates else None
            color_label = next((t["color_label"] for t in trks if t.get("color_label")), None)
            scores = [assoc_map[t.get("track_id","")].get("association_score") for t in trks if t.get("track_id") in assoc_map and assoc_map[t.get("track_id")].get("association_score") is not None]
            avg_conf = sum(scores)/len(scores) if scores else None
            times = [t.get("start_time") for t in trks if t.get("start_time")]
            end_times = [t.get("end_time") for t in trks if t.get("end_time")]
            obs_cnt = veh_obs_count.get(vid, len(trks))
            vehicles.append(GlobalVehicleModel(
                global_vehicle_id=vid, vehicle_type=trks[0].get("vehicle_type","Unknown") if trks else "Unknown",
                primary_plate=primary_plate, plate_confidence=plate_conf, color_label=color_label, association_confidence=avg_conf,
                first_seen=min(times) if times else (journey.first_seen if journey else None),
                last_seen=max(end_times) if end_times else (journey.last_seen if journey else None),
                total_observations=obs_cnt, available_observations=obs_cnt,
                cameras_visited=cameras_visited, trajectory=trajectory, camera_local_associations=assocs,
                tracking_type="single_camera" if len(cameras_visited) <= 1 else "cross_camera",
                identity_status=_identity_status(vid),
            ))

        alerts = [AlertModel(alert_id=a.get("alert_id",f"alert_{i}"), timestamp=a.get("timestamp"), type=a.get("type"), severity=a.get("severity"), camera_id=a.get("camera_id"), title=a.get("title"), description=a.get("description"), recommended_action=a.get("recommended_action"), synthetic=a.get("synthetic",True)) for i,a in enumerate(alerts_raw)]
        headline = dash_raw.get("headline_metrics", dash_raw.get("counts", {}))
        dashboard_summary = DashboardSummaryModel(cameras=headline.get("cameras",len(cameras)), vehicles=headline.get("vehicles",len(vehicles)), tracklets=headline.get("tracklets",len(tracklets_raw)), observations=headline.get("observations",len(observations)), journeys=headline.get("journeys",len(journeys)), association_confirmed=headline.get("association_confirmed",assoc_decisions.get("confirmed",0)), association_ambiguous=headline.get("association_ambiguous",assoc_decisions.get("ambiguous",0)), association_rejected=headline.get("association_rejected",assoc_decisions.get("rejected",0)), high_congestion_windows=headline.get("high_congestion_windows",0))
        scenario_id = tracklets_raw[0].get("scenario_id") if tracklets_raw else "SYNTH_URBANTRACK_46CAM"
        metadata = SystemMetadataModel(generated_at="2026-10-10T00:00:00Z", pipeline_version="synthetic-v1", data_mode="DEMO", total_cameras=len(cameras), notes="Complete Synthetic 46-Camera Dataset - all records are synthetic.", scenario_id=scenario_id)
        telemetry = MvpTelemetryModel(available=True, source="DEMO", total_observations=len(observations), total_tracklets=len(tracklets_raw), pairwise_decisions=assoc_decisions)
        return UrbanTrackDataPackage(metadata=metadata, vehicles=vehicles, cameras=cameras, camera_network=camera_network, observations=observations, alerts=alerts, journeys=journeys, dashboard_summary=dashboard_summary, mvp_telemetry=telemetry, data_issues=issues)

    def load_raw_intelligence(self) -> Dict[str, Any]:
        pipeline_file = PIPELINE_DIR / "multicam_intelligence.json"
        demo_file = DEMO_DIR / "multicam_intelligence.json"
        if pipeline_file.exists():
            with open(pipeline_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                data.setdefault("system_metadata", {})["data_mode"] = "LIVE_PIPELINE"
                return data
        elif self._pipeline_present():
            return {"system_metadata": {"data_mode": "LIVE_PIPELINE", "notes": "Derived from uploaded observations only."}, "cameras": [], "global_vehicles": [], "camera_network": {"nodes": [], "edges": []}}
        elif demo_file.exists():
            with open(demo_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                data.setdefault("system_metadata", {})["data_mode"] = "DEMO"
                return data
        else:
            return {"system_metadata": {"data_mode": "NO_DATA", "notes": "No data files found."}, "cameras": [], "global_vehicles": [], "camera_network": {"nodes": [], "edges": []}}

    def load_raw_observations(self) -> List[Dict[str, Any]]:
        pipeline_file = PIPELINE_DIR / "observations.json"
        demo_file = DEMO_DIR / "observations.json"
        if self._pipeline_present():
            target_file = pipeline_file if pipeline_file.exists() else None
        else:
            target_file = demo_file if demo_file.exists() else None
        if target_file and target_file.exists():
            with open(target_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def _load_legacy_package(self) -> "UrbanTrackDataPackage":
        raw_intel = self.load_raw_intelligence()
        raw_obs = self.load_raw_observations()
        meta_dict = raw_intel.get("system_metadata", {})
        metadata = SystemMetadataModel(generated_at=meta_dict.get("generated_at"), pipeline_version=meta_dict.get("pipeline_version"), data_mode=meta_dict.get("data_mode", self.get_effective_data_mode()), total_cameras=meta_dict.get("total_cameras", len(raw_intel.get("cameras", []))), notes=meta_dict.get("notes"))
        observations: List[ObservationModel] = [ObservationModel(observation_id=str(o.get("observation_id","")), camera_id=str(o.get("camera_id","")), track_id=str(o.get("track_id",0)), global_vehicle_id=o.get("global_vehicle_id"), timestamp=o.get("timestamp"), vehicle_type=o.get("vehicle_type","Unknown"), detection_confidence=o.get("detection_confidence"), plate_text=o.get("plate_text"), plate_confidence=o.get("plate_confidence"), bbox=o.get("bbox"), frame_idx=o.get("frame_idx")) for o in raw_obs]
        raw_vehicles = list(raw_intel.get("global_vehicles", []))
        derived = False
        if not raw_vehicles and raw_obs:
            derived = True
            groups: Dict[str, List[ObservationModel]] = {}
            for o in observations:
                key = o.global_vehicle_id or f"{o.camera_id}_trk_{o.track_id}"
                groups.setdefault(key, []).append(o)
            for key, obs in groups.items():
                obs.sort(key=lambda x: (x.timestamp or "", x.frame_idx or 0))
                seen: List[Any] = []
                for o in obs:
                    pair = (o.camera_id, o.track_id)
                    if not seen or seen[-1] != pair:
                        seen.append(pair)
                plates = [o.plate_text for o in obs if o.plate_text]
                raw_vehicles.append({"global_vehicle_id": key, "vehicle_type": obs[0].vehicle_type, "primary_plate": plates[0] if plates else None, "association_confidence": None, "first_seen": obs[0].timestamp, "last_seen": obs[-1].timestamp, "total_observations": len(obs), "cameras_visited": list(dict.fromkeys(o.camera_id for o in obs)), "trajectory": [{"step": i+1, "camera_id": c, "track_id": t, "timestamp": next((o.timestamp for o in obs if (o.camera_id,o.track_id)==(c,t)),None), "observation_id": next((o.observation_id for o in obs if (o.camera_id,o.track_id)==(c,t)),None)} for i,(c,t) in enumerate(seen)], "camera_local_associations": [{"camera_id": c, "track_id": t, "confidence": None} for c,t in seen], "identity_status": "single_camera" if len({c for c,_ in seen})<=1 else "candidate"})
        vehicles: List[GlobalVehicleModel] = []
        for v in raw_vehicles:
            v_id = str(v.get("global_vehicle_id",""))
            trajectories = [TrajectoryStepModel(step=t.get("step",idx+1), camera_id=t.get("camera_id"), track_id=str(t.get("track_id")), timestamp=t.get("timestamp"), observation_id=t.get("observation_id")) for idx,t in enumerate(v.get("trajectory",[]))]
            assocs = [CameraLocalAssocModel(camera_id=a.get("camera_id"), track_id=str(a.get("track_id")), confidence=a.get("confidence")) for a in v.get("camera_local_associations",[])]
            assoc_pairs = {(a.camera_id, a.track_id) for a in assocs}
            matching_obs_count = sum(1 for o in observations if (o.global_vehicle_id or "").lower()==v_id.lower() or (not o.global_vehicle_id and (o.camera_id,o.track_id) in assoc_pairs))
            cams_visited = v.get("cameras_visited",[])
            unique_cams = set(cams_visited) or {t.camera_id for t in trajectories}
            is_single_cam = len(unique_cams) <= 1
            raw_status = v.get("identity_status") or v.get("status")
            identity_status = str(raw_status).lower() if raw_status else ("single_camera" if is_single_cam else ("ambiguous" if not v.get("association_confidence") or v.get("association_confidence",0)<0.5 else "candidate"))
            vehicles.append(GlobalVehicleModel(global_vehicle_id=v_id, vehicle_type=v.get("vehicle_type","Unknown"), primary_plate=v.get("primary_plate"), association_confidence=v.get("association_confidence"), first_seen=v.get("first_seen"), last_seen=v.get("last_seen"), total_observations=v.get("total_observations",len(trajectories)), available_observations=matching_obs_count, cameras_visited=cams_visited, trajectory=trajectories, camera_local_associations=assocs, tracking_type="single_camera" if is_single_cam else "cross_camera", identity_status=identity_status))
        cam_obs_count: Dict[str, int] = {}
        cam_unique_vehicles: Dict[str, set] = {}
        cam_last_obs: Dict[str, str] = {}
        pair_to_vehicle = {(a.camera_id,a.track_id): vv.global_vehicle_id for vv in vehicles for a in vv.camera_local_associations}
        for o in observations:
            cid = o.camera_id
            cam_obs_count[cid] = cam_obs_count.get(cid,0)+1
            gid = o.global_vehicle_id or pair_to_vehicle.get((o.camera_id,o.track_id))
            if gid:
                cam_unique_vehicles.setdefault(cid,set()).add(gid)
            if o.timestamp and (not cam_last_obs.get(cid) or o.timestamp>cam_last_obs[cid]):
                cam_last_obs[cid] = o.timestamp
        raw_cams = raw_intel.get("cameras",[])
        known_cam_ids = {c.get("camera_id") for c in raw_cams}
        cameras = [CameraModel(camera_id=c.get("camera_id"), name=c.get("name"), location_description=c.get("location_description"), status=c.get("status","ACTIVE"), fps=c.get("fps"), video_available=c.get("video_available",False), vehicles_observed=len(cam_unique_vehicles.get(c.get("camera_id"),set())), total_observations=cam_obs_count.get(c.get("camera_id"),0), last_observation=cam_last_obs.get(c.get("camera_id")), latitude=c.get("latitude"), longitude=c.get("longitude"), coordinate_system=c.get("coordinate_system","WGS84") if c.get("latitude") is not None else None) for c in raw_cams]
        cameras += [CameraModel(camera_id=cid, name=f"Camera {cid}", status="ACTIVE", vehicles_observed=len(cam_unique_vehicles.get(cid,set())), total_observations=cam_obs_count[cid], last_observation=cam_last_obs.get(cid)) for cid in cam_obs_count if cid not in known_cam_ids]
        net = raw_intel.get("camera_network",{})
        nodes = [CameraNetworkNodeModel(id=n.get("id"), label=n.get("label",n.get("id")), x=n.get("x"), y=n.get("y"), latitude=n.get("latitude"), longitude=n.get("longitude"), coordinate_system=n.get("coordinate_system","WGS84") if n.get("latitude") is not None else None) for n in net.get("nodes",[])]
        edges = [CameraNetworkEdgeModel(source=e.get("source"), target=e.get("target"), vehicle_flow_count=e.get("vehicle_flow_count",0)) for e in net.get("edges",[])]
        camera_network = CameraNetworkModel(nodes=nodes, edges=edges)
        issues = ["No multicam_intelligence.json supplied; vehicles derived from observations only."] if derived else []
        tele_raw = raw_intel.get("pipeline_metrics") or raw_intel.get("mvp_telemetry")
        if isinstance(tele_raw, dict):
            known = {k: tele_raw[k] for k in MvpTelemetryModel.model_fields if k in tele_raw and k not in ("available","source","extra")}
            extra = {k: v for k,v in tele_raw.items() if k not in MvpTelemetryModel.model_fields}
            telemetry = MvpTelemetryModel(available=True, source=metadata.data_mode, extra=extra, **known)
        else:
            telemetry = MvpTelemetryModel(available=False, source=metadata.data_mode)
        return UrbanTrackDataPackage(mvp_telemetry=telemetry, data_issues=issues, metadata=metadata, vehicles=vehicles, cameras=cameras, camera_network=camera_network, observations=observations)

    def get_normalized_package(self) -> UrbanTrackDataPackage:
        eff_mode = self.get_effective_data_mode()
        has_pipeline = self._pipeline_present()
        cache_key = f"{eff_mode}_{has_pipeline}"
        if self._cached_package is not None and self._cache_source == cache_key:
            return self._cached_package

        if has_pipeline:
            pkg = self._load_legacy_package()
        elif self._new_schema_present():
            pkg = self._load_new_schema_package()
        else:
            pkg = self._load_legacy_package()

        self._cached_package = pkg
        self._cache_source = cache_key
        return pkg

    def load_traffic_analytics(self) -> List[Dict[str, Any]]:
        traffic_path = DEMO_DIR / "10_traffic_analytics.csv"
        if traffic_path.exists():
            with open(traffic_path, encoding="utf-8") as f:
                return list(csv.DictReader(f))
        return []

    def load_alerts(self) -> List[Dict[str, Any]]:
        p = DEMO_DIR / "13_alerts.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []

    def load_journeys(self) -> List[Dict[str, Any]]:
        p = DEMO_DIR / "07_reconstructed_journeys.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []

    def load_plate_lookup(self) -> List[Dict[str, Any]]:
        p = DEMO_DIR / "08_plate_search_lookup.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []

    def load_association_hypotheses(self) -> List[Dict[str, Any]]:
        p = DEMO_DIR / "06_association_hypotheses.json"
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


adapter = DataAdapter()
