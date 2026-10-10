"""
Tests for UrbanTrack AI Backend and Data Adapter
Validates:
- JSON parsing and normalization
- Data integrity guarantees (no fabricated fields, null safety)
- Filtering logic
- Dynamic calculation of analytics from real data
- Demo vs Live data mode separation
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from app.services.data_adapter import adapter, GlobalVehicleModel, CameraModel

client = TestClient(app)
# Existing API behavior tests run as an authenticated dashboard user.
login_response = client.post(
    "/api/auth/login",
    json={"username": "admin", "password": "UrbanTrack@2026!"},
)
assert login_response.status_code == 200


def test_authentication_protects_data_api():
    anonymous = TestClient(app)
    assert anonymous.get("/api/overview").status_code == 401
    signed_in = anonymous.post(
        "/api/auth/login",
        json={"username": "admin", "password": "UrbanTrack@2026!"},
    )
    assert signed_in.status_code == 200
    assert anonymous.get("/api/overview").status_code == 200
    assert anonymous.post("/api/auth/logout").status_code == 200
    assert anonymous.get("/api/overview").status_code == 401


def test_invalid_login_is_rejected():
    anonymous = TestClient(app)
    response = anonymous.post(
        "/api/auth/login",
        json={"username": "admin", "password": "incorrect"},
    )
    assert response.status_code == 401


def test_api_status():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert data["data_mode"] in ["DEMO", "LIVE_PIPELINE"]


def test_overview_metrics_dynamic_calculation():
    response = client.get("/api/overview")
    assert response.status_code == 200
    data = response.json()
    metrics = data["metrics"]
    
    # Must be non-negative integers calculated from data
    assert metrics["total_observations"] >= 0
    assert metrics["unique_global_vehicles"] >= 0
    assert metrics["active_cameras"] >= 0
    assert metrics["vehicles_with_plate"] >= 0
    assert metrics["reconstructed_trajectories"] >= 0

    # Distribution must match sum of vehicles
    vtype_dist = data["vehicle_type_distribution"]
    total_types = sum(vtype_dist.values())
    assert total_types == metrics["unique_global_vehicles"]


def test_vehicles_list_and_filters():
    response = client.get("/api/vehicles")
    assert response.status_code == 200
    vehicles = response.json()
    assert isinstance(vehicles, list)
    assert len(vehicles) > 0

    first_vehicle = vehicles[0]
    assert "global_vehicle_id" in first_vehicle
    assert "vehicle_type" in first_vehicle
    assert "trajectory" in first_vehicle

    # Test filter by vehicle type
    v_type = first_vehicle["vehicle_type"]
    resp_filtered = client.get(f"/api/vehicles?vehicle_type={v_type}")
    assert resp_filtered.status_code == 200
    for v in resp_filtered.json():
        assert v["vehicle_type"].lower() == v_type.lower()


def test_vehicle_details_and_traceability():
    response = client.get("/api/vehicles")
    vehicles = response.json()
    v_id = vehicles[0]["global_vehicle_id"]

    resp_detail = client.get(f"/api/vehicles/{v_id}")
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert detail["global_vehicle_id"] == v_id

    # Traceability observations check
    resp_obs = client.get(f"/api/vehicles/{v_id}/observations")
    assert resp_obs.status_code == 200
    obs_list = resp_obs.json()
    assert isinstance(obs_list, list)
    # Each observation must link to this vehicle
    for o in obs_list:
        assert "camera_id" in o
        assert "track_id" in o


def test_missing_field_integrity():
    # Find motorcycle V031 which has no plate
    resp_detail = client.get("/api/vehicles/V031")
    if resp_detail.status_code == 200:
        data = resp_detail.json()
        assert data["primary_plate"] is None  # Must NOT fabricate plate


def test_camera_list_and_details():
    response = client.get("/api/cameras")
    assert response.status_code == 200
    cameras = response.json()
    assert len(cameras) >= 4

    cam_id = cameras[0]["camera_id"]
    resp_single = client.get(f"/api/cameras/{cam_id}")
    assert resp_single.status_code == 200
    data = resp_single.json()
    assert data["camera_id"] == cam_id
    assert "latitude" in data
    assert "longitude" in data
    assert data["latitude"] is not None
    assert data["longitude"] is not None
    assert data["coordinate_system"] == "WGS84"


def test_camera_network():
    response = client.get("/api/camera-network")
    assert response.status_code == 200
    net = response.json()
    assert "nodes" in net
    assert "edges" in net
    assert len(net["nodes"]) > 0
    first_node = net["nodes"][0]
    assert "latitude" in first_node
    assert "longitude" in first_node
    assert first_node["latitude"] is not None
    assert first_node["longitude"] is not None



def test_analytics_calculations():
    response = client.get("/api/analytics")
    assert response.status_code == 200
    analytics = response.json()
    assert "vehicle_type_distribution" in analytics
    assert "camera_activity" in analytics
    assert "camera_flows" in analytics


def test_vehicle_single_camera_and_observations_integrity():
    """
    Validates single-camera vehicle integrity:
    - Summary reports observations
    - Single camera tracklet
    - Null safety preserved
    """
    vehs = client.get("/api/vehicles").json()
    single_cam_v = next((v for v in vehs if v["tracking_type"] == "single_camera"), vehs[0])
    v_id = single_cam_v["global_vehicle_id"]

    resp = client.get(f"/api/vehicles/{v_id}")
    assert resp.status_code == 200
    v = resp.json()
    assert v["global_vehicle_id"] == v_id
    assert "tracking_type" in v
    assert len(v["cameras_visited"]) >= 1

    # Fetch observations for vehicle
    resp_obs = client.get(f"/api/vehicles/{v_id}/observations")
    assert resp_obs.status_code == 200
    obs_list = resp_obs.json()
    assert len(obs_list) >= 1
    assert "camera_id" in obs_list[0]
    assert "track_id" in obs_list[0]


def test_strict_vehicle_separation():
    """Ensure observations from different vehicles are never mixed."""
    vehs = client.get("/api/vehicles").json()
    assert len(vehs) >= 2
    v1_id = vehs[0]["global_vehicle_id"]
    v2_id = vehs[1]["global_vehicle_id"]

    resp_v1_obs = client.get(f"/api/vehicles/{v1_id}/observations").json()
    resp_v2_obs = client.get(f"/api/vehicles/{v2_id}/observations").json()
    obs_ids_v1 = {o["observation_id"] for o in resp_v1_obs}
    obs_ids_v2 = {o["observation_id"] for o in resp_v2_obs}

    assert len(obs_ids_v1.intersection(obs_ids_v2)) == 0


def test_evidence_endpoint_integrity():
    """Test observation evidence endpoint with explicit missing-media indication."""
    vehs = client.get("/api/vehicles").json()
    v_id = vehs[0]["global_vehicle_id"]
    obs_list = client.get(f"/api/vehicles/{v_id}/observations").json()
    first_obs_id = obs_list[0]["observation_id"]

    resp = client.get(f"/api/evidence/{first_obs_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["observation_id"] == first_obs_id
    assert "camera_id" in data
    assert "track_id" in data
    assert data["frame_available"] is False
    assert "not present in data storage" in data["message"]


def test_search_by_camera_track_and_observation():
    cameras = client.get("/api/cameras").json()
    test_cam = cameras[0]["camera_id"]
    r = client.get("/api/search", params={"q": test_cam}).json()
    assert r["count"] >= 1
    assert any("camera_id" in h["matched_on"] for h in r["results"])

    vehs = client.get("/api/vehicles").json()
    test_vid = vehs[0]["global_vehicle_id"]
    r = client.get("/api/search", params={"q": test_vid}).json()
    assert r["count"] >= 1
    assert any("vehicle_id" in h["matched_on"] for h in r["results"])


def test_telemetry_schema():
    t = client.get("/api/telemetry").json()
    assert "available" in t
    if t["available"]:
        assert t["total_tracklets"] is not None


def test_no_same_camera_flows():
    a = client.get("/api/analytics").json()
    for f in a["camera_flows"]:
        src, dst = f["route"].split(" → ")
        assert src != dst


def test_status_data_issues():
    s = client.get("/api/status").json()
    assert "data_issues" in s
    assert isinstance(s["data_issues"], list)


def test_alerts_endpoint():
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    alerts = resp.json()
    assert isinstance(alerts, list)
    assert len(alerts) > 0
    first = alerts[0]
    assert "alert_id" in first
    assert "severity" in first
    assert "title" in first


def test_traffic_analytics_endpoint():
    resp = client.get("/api/traffic")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_records" in data
    assert "records" in data
    assert data["total_records"] > 0
    first = data["records"][0]
    assert "camera_id" in first
    assert "congestion_level" in first


def test_journeys_endpoint():
    resp = client.get("/api/journeys")
    assert resp.status_code == 200
    journeys = resp.json()
    assert isinstance(journeys, list)
    assert len(journeys) > 0
    first = journeys[0]
    assert "journey_id" in first
    assert "route_camera_sequence" in first

    # Test single journey
    j_id = first["journey_id"]
    resp_single = client.get(f"/api/journeys/{j_id}")
    assert resp_single.status_code == 200
    assert resp_single.json()["journey_id"] == j_id


def test_associations_endpoint():
    resp = client.get("/api/associations")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "results" in data
    assert data["total"] > 0
    first = data["results"][0]
    assert "source_camera_id" in first
    assert "decision" in first


def test_plate_lookup_endpoint():
    resp = client.get("/api/plate-lookup")
    assert resp.status_code == 200
    data = resp.json()
    assert "count" in data
    assert "results" in data
    assert data["count"] > 0
    first = data["results"][0]
    assert "plate_text" in first


def test_dashboard_summary_endpoint():
    resp = client.get("/api/dashboard-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "cameras" in data
    assert "vehicles" in data
    assert data["cameras"] == 46


def test_upload_observations_only_derives_vehicles_and_reset():
    obs = [
        {"observation_id": "o1", "camera_id": "CAM_S01_C001", "track_id": 2, "timestamp": "2026-01-01T10:00:00Z", "vehicle_type": "car", "detection_confidence": 0.8},
        {"observation_id": "o2", "camera_id": "CAM_S01_C001", "track_id": 2, "timestamp": "2026-01-01T10:00:01Z", "vehicle_type": "car", "detection_confidence": 0.7},
        {"observation_id": "o3", "camera_id": "CAM_S01_C002", "track_id": 9, "timestamp": "2026-01-01T10:00:05Z", "vehicle_type": "truck"},
    ]
    try:
        r = client.post("/api/upload?kind=observations", json=obs)
        assert r.status_code == 200 and r.json()["vehicles"] == 2 and r.json()["cameras"] == 2
        assert client.get("/api/status").json()["data_mode"] == "LIVE_PIPELINE"
        assert all(v["identity_status"] == "single_camera" for v in client.get("/api/vehicles").json())
        assert client.post("/api/upload?kind=observations", json=[{"x": 1}]).status_code == 422
    finally:
        client.post("/api/reset")
    assert client.get("/api/status").json()["data_mode"] == "DEMO"
