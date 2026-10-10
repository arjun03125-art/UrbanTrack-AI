# UrbanTrack AI — System Data Contracts & Architecture

UrbanTrack AI is an AI-powered multi-camera vehicle intelligence system for urban surveillance and traffic monitoring.

## Multi-Member Architecture

```
CCTV Feeds / Video Streams
           │
           ▼
┌──────────────────────────────────────────────┐
│  MEMBER 1: Perception Pipeline               │
│  - Video Ingestion & YOLOv8/v11 Detection     │
│  - Vehicle Classification                    │
│  - ByteTrack Single-Camera Tracking          │
│  - License Plate Localization & Recognition  │
│  - Annotated Video Export                    │
└──────────────────────────────────────────────┘
           │
           │ Structured Observations JSON / CSV
           ▼
┌──────────────────────────────────────────────┐
│  MEMBER 2: Multi-Camera Intelligence         │
│  - Cross-Camera Re-Identification (Re-ID)    │
│  - Identity Fusion & Spatio-Temporal Graph   │
│  - Global Vehicle ID Assignment (e.g. V001)  │
│  - Trajectory Reconstruction (Camera-Network)│
│  - Association Confidence Calculation        │
└──────────────────────────────────────────────┘
           │
           │ Multi-Camera Intelligence Results JSON
           ▼
┌──────────────────────────────────────────────┐
│  MEMBER 3: Dashboard & Integration (This Layer)│
│  - Command Center / Overview Analytics       │
│  - Searchable Vehicle Explorer               │
│  - Vehicle Investigation & Timeline Trace    │
│  - Trajectory & Camera Flow Network Graph    │
│  - Live / Annotated Video Inspection Player  │
│  - Strict Data Integrity & Mode Separation   │
└──────────────────────────────────────────────┘
```

## Data Schema Specification

### 1. Member 1 Output: `observations.json`
Represents individual single-camera vehicle detections and tracking records.

```json
[
  {
    "observation_id": "obs_001",
    "camera_id": "CAM_A",
    "track_id": 17,
    "timestamp": "2026-10-08T10:31:12Z",
    "vehicle_type": "Car",
    "detection_confidence": 0.94,
    "plate_text": "MH12AB1234",
    "plate_confidence": 0.88,
    "bbox": [120, 340, 260, 480],
    "frame_idx": 45
  }
]
```

### 2. Member 2 Output: `multicam_intelligence.json`
Represents cross-camera identity fusion and trajectory reconstruction.

```json
{
  "system_metadata": {
    "generated_at": "2026-10-08T10:45:00Z",
    "pipeline_version": "1.0.0",
    "total_cameras": 4,
    "data_mode": "LIVE_PIPELINE"
  },
  "cameras": [
    {
      "camera_id": "CAM_A",
      "name": "North Junction Gate",
      "location_description": "North Gate Entry",
      "status": "ACTIVE",
      "fps": 30
    }
  ],
  "global_vehicles": [
    {
      "global_vehicle_id": "V023",
      "vehicle_type": "Car",
      "primary_plate": "MH12AB1234",
      "association_confidence": 0.89,
      "first_seen": "2026-10-08T10:31:12Z",
      "last_seen": "2026-10-08T10:33:08Z",
      "total_observations": 41,
      "cameras_visited": ["CAM_A", "CAM_C", "CAM_D"],
      "trajectory": [
        {
          "step": 1,
          "camera_id": "CAM_A",
          "track_id": 17,
          "timestamp": "2026-10-08T10:31:12Z",
          "observation_id": "obs_001"
        },
        {
          "step": 2,
          "camera_id": "CAM_C",
          "track_id": 42,
          "timestamp": "2026-10-08T10:31:49Z",
          "observation_id": "obs_042"
        },
        {
          "step": 3,
          "camera_id": "CAM_D",
          "track_id": 8,
          "timestamp": "2026-10-08T10:33:08Z",
          "observation_id": "obs_088"
        }
      ],
      "camera_local_associations": [
        { "camera_id": "CAM_A", "track_id": 17, "confidence": 0.95 },
        { "camera_id": "CAM_C", "track_id": 42, "confidence": 0.89 },
        { "camera_id": "CAM_D", "track_id": 8, "confidence": 0.83 }
      ]
    }
  ],
  "camera_network": {
    "nodes": [
      { "id": "CAM_A", "label": "CAM_A - North Junction" },
      { "id": "CAM_B", "label": "CAM_B - East Expressway" },
      { "id": "CAM_C", "label": "CAM_C - Central Plaza" },
      { "id": "CAM_D", "label": "CAM_D - South Tollway" }
    ],
    "edges": [
      { "source": "CAM_A", "target": "CAM_C", "vehicle_flow_count": 31 },
      { "source": "CAM_C", "target": "CAM_D", "vehicle_flow_count": 18 },
      { "source": "CAM_A", "target": "CAM_B", "vehicle_flow_count": 12 },
      { "source": "CAM_B", "target": "CAM_D", "vehicle_flow_count": 9 }
    ]
  }
}
```

## Data Integrity Guarantee
- If any optional attribute (`plate_text`, `association_confidence`, `timestamp`, `location`) is missing or null, the dashboard explicitly renders `"Not currently available from upstream pipeline"`.
- Never invent coordinates or values.
- Explicit visual badges distinguish `LIVE_PIPELINE` vs `DEMO` data.
