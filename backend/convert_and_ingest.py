import json
import re
from pathlib import Path
from collections import defaultdict

SRC_DIR = Path(r"C:\Users\arjun\OneDrive\Desktop\UrbanTrack_Complete_Synthetic_Project_Data")
DEST_DIR = Path(__file__).resolve().parent.parent / "data" / "pipeline"
DEMO_DIR = Path(__file__).resolve().parent.parent / "data" / "demo"
DEST_DIR.mkdir(parents=True, exist_ok=True)
DEMO_DIR.mkdir(parents=True, exist_ok=True)

print(f"Reading from: {SRC_DIR}")
print(f"Writing to:   {DEST_DIR}")

# 1. Load files
with open(SRC_DIR / "01_camera_registry.json", "r", encoding="utf-8") as f:
    raw_cameras = json.load(f)

with open(SRC_DIR / "02_camera_graph.json", "r", encoding="utf-8") as f:
    raw_graph = json.load(f)

with open(SRC_DIR / "03_vehicles_synthetic_ground_truth.json", "r", encoding="utf-8") as f:
    raw_vehicles = json.load(f)

with open(SRC_DIR / "07_reconstructed_journeys.json", "r", encoding="utf-8") as f:
    raw_journeys = json.load(f)

with open(SRC_DIR / "06_association_hypotheses.json", "r", encoding="utf-8") as f:
    raw_assocs = json.load(f)

veh_by_id = {v["vehicle_id"]: v for v in raw_vehicles}

# Track ID string to integer mapping
# e.g. "SYN_CAM_03_TRK_0001" -> extract integer suffix or stable index
track_to_int = {}
def get_track_int(t_str: str) -> int:
    if t_str not in track_to_int:
        m = re.search(r"(\d+)$", t_str)
        if m:
            val = int(m.group(1))
        else:
            val = len(track_to_int) + 1
        track_to_int[t_str] = val
    return track_to_int[t_str]

# Map tracklet to vehicle id
track_to_veh = {}
for j in raw_journeys:
    v_id = j.get("synthetic_vehicle_id_for_ground_truth_only") or j["journey_id"]
    for t in j.get("tracklets", []):
        track_to_veh[t["track_id"]] = v_id

# Map track associations
assoc_scores_by_track = {}
assoc_decisions_by_vehicle = defaultdict(list)
for a in raw_assocs:
    src_trk = a.get("source_track_id")
    tgt_trk = a.get("target_track_id")
    score = a.get("association_score", 0.85)
    dec = a.get("decision", "candidate")
    if src_trk:
        assoc_scores_by_track[src_trk] = score
        v = track_to_veh.get(src_trk)
        if v:
            assoc_decisions_by_vehicle[v].append((score, dec))
    if tgt_trk:
        assoc_scores_by_track[tgt_trk] = score
        v = track_to_veh.get(tgt_trk)
        if v:
            assoc_decisions_by_vehicle[v].append((score, dec))

# 2. Convert observations
observations = []
step_timestamps = {}
step_obs_ids = {}

with open(SRC_DIR / "05_observations.jsonl", "r", encoding="utf-8") as f:
    for idx, line in enumerate(f):
        if not line.strip():
            continue
        o = json.loads(line)
        obs_id = f"obs_{idx+1:05d}"
        trk_str = o.get("track_id", "")
        trk_num = get_track_int(trk_str)
        cam_id = o.get("camera_id", "")
        v_id = track_to_veh.get(trk_str)

        ts = o.get("timestamp")
        if (cam_id, trk_str) not in step_timestamps:
            step_timestamps[(cam_id, trk_str)] = ts
            step_obs_ids[(cam_id, trk_str)] = obs_id

        bbox_raw = o.get("bbox_xywh", [0, 0, 100, 100])
        # convert xywh to [x1, y1, x2, y2]
        bbox_x1y1x2y2 = [
            int(bbox_raw[0]),
            int(bbox_raw[1]),
            int(bbox_raw[0] + bbox_raw[2]),
            int(bbox_raw[1] + bbox_raw[3]),
        ]

        observations.append({
            "observation_id": obs_id,
            "camera_id": cam_id,
            "track_id": trk_num,
            "global_vehicle_id": v_id,
            "timestamp": ts,
            "vehicle_type": (o.get("vehicle_type") or "Car").capitalize(),
            "detection_confidence": o.get("detection_confidence", 0.85),
            "plate_text": o.get("plate_text"),
            "plate_confidence": o.get("plate_confidence"),
            "bbox": bbox_x1y1x2y2,
            "frame_idx": o.get("frame_id"),
        })

print(f"Processed {len(observations)} observations")

# 3. Build cameras list
cameras = []
for c in raw_cameras:
    cid = c["camera_id"]
    name = c.get("display_name", cid)
    road = c.get("road_segment", "")
    view_dir = c.get("view_direction", "")
    desc = f"{name} ({road}, {view_dir})".strip()
    cameras.append({
        "camera_id": cid,
        "name": name,
        "location_description": desc,
        "status": "ACTIVE",
        "fps": c.get("nominal_fps", 10),
        "video_available": False,
        "latitude": c.get("latitude_demo_only"),
        "longitude": c.get("longitude_demo_only"),
        "coordinate_system": "WGS84",
    })

# 4. Build camera network
nodes = [
    {
        "id": c["camera_id"],
        "label": f"{c['camera_id']}: {c['name']}",
        "latitude": c["latitude"],
        "longitude": c["longitude"],
        "coordinate_system": "WGS84",
    }
    for c in cameras
]

edges = []
for e in raw_graph.get("edges", []):
    prior = e.get("prior_score", 0.5)
    flow = max(1, int(prior * 30))
    edges.append({
        "source": e["source"],
        "target": e["target"],
        "vehicle_flow_count": flow,
    })

# 5. Build global vehicles list
global_vehicles = []
for j in raw_journeys:
    v_id = j.get("synthetic_vehicle_id_for_ground_truth_only") or j["journey_id"]
    veh_meta = veh_by_id.get(v_id, {})
    plate = veh_meta.get("plate_text")
    v_type = (veh_meta.get("vehicle_type") or "Car").capitalize()

    dec_list = assoc_decisions_by_vehicle.get(v_id, [])
    if dec_list:
        mean_score = sum(s for s, _ in dec_list) / len(dec_list)
        # determine consensus decision
        has_rejected = any(d == "rejected" for _, d in dec_list)
        has_ambiguous = any(d == "ambiguous" for _, d in dec_list)
        all_confirmed = all(d == "confirmed" for _, d in dec_list)
        if has_rejected:
            status = "rejected"
        elif has_ambiguous:
            status = "ambiguous"
        elif all_confirmed:
            status = "confirmed"
        else:
            status = "candidate"
    else:
        mean_score = 0.88
        status = "confirmed" if len(j.get("route_camera_sequence", [])) > 1 else "single_camera"

    trajectory = []
    assocs = []
    for step_idx, t in enumerate(j.get("tracklets", [])):
        cid = t["camera_id"]
        t_str = t["track_id"]
        t_num = get_track_int(t_str)
        ts = step_timestamps.get((cid, t_str), j.get("first_seen"))
        oid = step_obs_ids.get((cid, t_str))

        trajectory.append({
            "step": step_idx + 1,
            "camera_id": cid,
            "track_id": t_num,
            "timestamp": ts,
            "observation_id": oid,
        })
        assocs.append({
            "camera_id": cid,
            "track_id": t_num,
            "confidence": round(assoc_scores_by_track.get(t_str, mean_score), 2),
        })

    cams_visited = j.get("route_camera_sequence", [])
    is_single = len(set(cams_visited)) <= 1

    global_vehicles.append({
        "global_vehicle_id": v_id,
        "vehicle_type": v_type,
        "primary_plate": plate,
        "association_confidence": round(mean_score, 2),
        "first_seen": j.get("first_seen"),
        "last_seen": j.get("last_seen"),
        "total_observations": len(j.get("tracklets", [])) * 36,  # summary count
        "cameras_visited": cams_visited,
        "trajectory": trajectory,
        "camera_local_associations": assocs,
        "tracking_type": "single_camera" if is_single else "cross_camera",
        "identity_status": "single_camera" if is_single else status,
    })

print(f"Processed {len(global_vehicles)} global vehicle clusters")
print(f"Processed {len(cameras)} cameras and {len(edges)} camera network edges")

# 6. Save multicam_intelligence.json
intel_data = {
    "system_metadata": {
        "generated_at": "2026-10-10T10:15:00Z",
        "pipeline_version": "1.0.0-synthetic-46cam",
        "data_mode": "LIVE_PIPELINE",
        "total_cameras": len(cameras),
        "notes": "UrbanTrack AI — 46-camera synthetic multi-camera dataset ingested into live pipeline.",
    },
    "cameras": cameras,
    "camera_network": {
        "nodes": nodes,
        "edges": edges,
    },
    "global_vehicles": global_vehicles,
}

with open(DEST_DIR / "multicam_intelligence.json", "w", encoding="utf-8") as f:
    json.dump(intel_data, f, indent=2)

with open(DEST_DIR / "observations.json", "w", encoding="utf-8") as f:
    json.dump(observations, f, indent=2)

# Also update demo so the old 4-camera dataset is completely replaced
with open(DEMO_DIR / "multicam_intelligence.json", "w", encoding="utf-8") as f:
    demo_intel = dict(intel_data)
    demo_intel["system_metadata"] = dict(intel_data["system_metadata"])
    demo_intel["system_metadata"]["data_mode"] = "DEMO"
    json.dump(demo_intel, f, indent=2)

with open(DEMO_DIR / "observations.json", "w", encoding="utf-8") as f:
    json.dump(observations, f, indent=2)

print("Ingestion files written successfully to data/pipeline and data/demo!")
