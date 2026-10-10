# UrbanTrack AI — Multi-Camera Vehicle Intelligence & Surveillance Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-000000.svg?style=flat&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/UI-React%2019-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org)
[![Pytest](https://img.shields.io/badge/Tests-Pytest%20(24%20Passed)-449C44.svg?style=flat&logo=pytest&logoColor=white)](https://docs.pytest.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](LICENSE)

**UrbanTrack AI** is an enterprise-grade AI-powered multi-camera vehicle intelligence and urban surveillance platform. It bridges deep learning computer vision perception pipelines with an operator-ready command console to track, re-identify, and reconstruct vehicle journeys across distributed camera networks in complex urban environments.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Core Features](#-core-features)
- [Strict Data Integrity Guarantees](#-strict-data-integrity-guarantees)
- [Technology Stack](#-technology-stack)
- [Repository Structure](#-repository-structure)
- [Quickstart Guide](#-quickstart-guide)
  - [Prerequisites](#prerequisites)
  - [1. Backend Setup (FastAPI)](#1-backend-setup-fastapi)
  - [2. Frontend Setup (Next.js)](#2-frontend-setup-nextjs)
  - [3. Running Backend Test Suite](#3-running-backend-test-suite)
- [Security & Access Control](#-security--access-control)
- [Upstream Pipeline Integration](#-upstream-pipeline-integration)
- [API Reference](#-api-reference)
- [Synthetic Benchmark Dataset](#-synthetic-benchmark-dataset)
- [Contributing & License](#-contributing--license)

---

## 🏛 System Architecture

The platform operates as a modular three-tier pipeline designed for distributed urban monitoring:

```
                  Distributed CCTV Feeds / Video Streams
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  MEMBER 1: Perception & Single-Camera Tracking Pipeline               │
│  • Video Ingestion & Multi-Stream Processing                          │
│  • YOLOv8 / YOLOv11 Vehicle Detection & Classification                 │
│  • ByteTrack Single-Camera Persistent Tracking                         │
│  • License Plate Localization & Character Recognition (OCR)           │
│  • Visual Feature Extraction & Annotated Video Export                  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ observations.json
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  MEMBER 2: Multi-Camera Intelligence & Identity Fusion                │
│  • Cross-Camera Re-Identification (Re-ID) Deep Metric Embeddings       │
│  • Spatio-Temporal Transition Graph & Feasibility Constraints          │
│  • Global Vehicle Identity Clustering (e.g., V001, V023)               │
│  • Multi-Hop Camera Trajectory Reconstruction                          │
│  • Cross-Camera Transition Matrices & Association Confidences          │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ multicam_intelligence.json
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  MEMBER 3: Dashboard, Visual Analytics & Forensic Application Layer    │
│  • FastAPI High-Throughput Normalization Adapter & Strict Validation  │
│  • Next.js 16 Dark-Themed Mission-Critical Operations Console          │
│  • Searchable Vehicle Explorer & Evidence Trace Dossiers               │
│  • Camera-Network Topological Trajectory Graph (Zero GPS hallucination)│
│  • CCTV Sensor Node Health, Telemetry & Transition Matrix Flow         │
│  • 4-Step Incident Forensics & Investigation Workflow                  │
│  • Signed HttpOnly Cookie Session Security & Role-Based API Guard     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Core Features

### 1. Operations Command Center
- Real-time operational overview displaying total observations, unique global vehicles identified, active CCTV nodes, and license plate capture rates.
- Dynamic vehicle distribution charts (Sedan, SUV, Truck, Van, Motorcycle, Bus) computed directly from real observations.
- System health telemetry, data ingestion status, and anomaly alert summaries.

### 2. Searchable Vehicle Explorer & Forensic Dossiers
- Global lookup by Plate Number, Global Vehicle ID (`V001`, `V023`), Camera Node, or Vehicle Type.
- Comprehensive vehicle dossier pages presenting chronological sighting timelines, visual bounding boxes, detection confidences, and camera hop transitions.
- Raw evidence trace traceability linking back to observation records and source video frames.

### 3. Topological Trajectory Visualizer
- Multi-hop journey reconstruction rendering sequential camera transitions (`CAM_01` → `CAM_04` → `CAM_12`).
- Hop interval calculations, travel time estimations, and association confidence scoring.
- **Zero-hallucination guarantee**: Visualized as topological camera network graphs rather than fabricated geographic coordinates.

### 4. CCTV Camera Network & Flow Analysis
- Node monitoring across the entire camera network (46 camera nodes in benchmark dataset).
- Dynamic camera-to-camera transition matrices highlighting frequent vehicle migration paths and traffic bottlenecks.
- Per-camera metrics including capture volume, OCR hit rates, and sensor operational status.

### 5. Incident Forensic Investigation Suite
- Guided 4-step forensic investigation workflow:
  1. **Incident Parameter Definition**: Timestamp windows, camera zones, target descriptions.
  2. **Vehicle Candidate Filtering**: Multi-attribute ranking and matching scores.
  3. **Timeline Corroboration**: Cross-camera sighting verification and timeline alignment.
  4. **Forensic Report Generation**: Exportable case summary with complete chain of custody.

### 6. Live Perception Feed Inspection
- Direct viewing interface for annotated camera video streams.
- Frame-level bounding box overlays, track ID labels, and OCR recognition tags.

---

## 🛡️ Strict Data Integrity Guarantees

UrbanTrack AI is built on principles of forensic and scientific integrity:

1. **Zero Data Fabrication**: The application never fabricates missing license plates, GPS coordinates, timestamps, or confidence scores.
2. **Explicit Fallbacks**: Any field unavailable from the upstream computer vision models explicitly displays `"Not currently available from upstream pipeline"` or `null`.
3. **Dual Data Mode Separation**:
   - `DATA MODE: LIVE PIPELINE`: Active when consuming live pipeline outputs from `data/pipeline/`.
   - `DATA MODE: DEMO`: Active when running against verified synthetic benchmark datasets in `data/demo/`.
4. **Topological Truth**: Because fixed CCTV cameras do not transmit GPS telemetry, paths are represented as topological camera transitions rather than misleading geographic map points.

---

## 💻 Technology Stack

### Frontend Application
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 with custom dark mission-control design system
- **Icons**: Lucide React
- **Data Visualizations**: Recharts, Three.js, Leaflet

### Backend Service
- **Framework**: FastAPI (Asynchronous high-performance Python framework)
- **Server**: Uvicorn (ASGI)
- **Validation**: Pydantic v2
- **Language**: Python 3.10+
- **Security**: Cryptographically signed HttpOnly session cookies, CORS whitelist
- **Testing**: Pytest, FastAPI TestClient, Starlette test harness

---

## 📁 Repository Structure

```
UrbanTrack AI/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── api.py           # REST endpoints (/api/overview, /api/vehicles, /api/trajectories, etc.)
│   │   │   └── auth.py          # Session authentication (/api/auth/login, /api/auth/me, /api/auth/logout)
│   │   └── services/
│   │       └── data_adapter.py  # Data adapter, Pydantic schemas, normalization & integrity validator
│   ├── tests/
│   │   └── test_api.py          # Pytest suite verifying endpoints, auth, and data integrity (24 tests)
│   ├── main.py                  # FastAPI application entrypoint & static mounts
│   ├── requirements.txt         # Python dependencies
│   └── .env.example             # Environment variable template
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Command Center Overview & Dynamic Analytics
│   │   ├── vehicles/            # Searchable Vehicle Explorer & Filters
│   │   │   └── [id]/page.tsx    # Forensic Vehicle Dossier & Evidence Traceability
│   │   ├── trajectories/        # Topological Trajectory Path Visualizer
│   │   ├── cameras/             # CCTV Sensor Nodes & Flow Graph
│   │   ├── analytics/           # Traffic Flow & Category Distributions
│   │   ├── live/                # Live Annotated Perception Feeds
│   │   ├── investigation/       # 4-Step Incident Forensics Investigation Workflow
│   │   ├── login/               # Secure Operator Sign-in Portal
│   │   └── layout.tsx           # Global Layout & Shell Provider
│   ├── components/
│   │   ├── DashboardShell.tsx   # Professional Dark UI Shell & Navigation
│   │   └── DataModeBadge.tsx    # Live vs Demo integrity indicator & SafeText utility
│   ├── lib/
│   │   └── api.ts               # Authenticated API Client with cookie credentials
│   ├── types/
│   │   └── index.ts             # Strict TypeScript interfaces matching backend models
│   ├── package.json             # Frontend dependencies & scripts
│   └── tsconfig.json            # TypeScript configuration
├── data/
│   ├── demo/                    # 46-camera synthetic benchmark dataset (ground truth & tracklets)
│   └── pipeline/                # Live pipeline dropzone for Member 1 & 2 outputs
├── DATA_CONTRACT.md             # Strict inter-member schema specifications
├── PROJECT_RULES.md             # Development governance and engineering standards
├── VERSION                      # Current system release version
└── README.md                    # Project documentation
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: v18.17.0 or later (Node 20+ recommended)
- **Python**: v3.10, v3.11, or v3.12+
- **Package Managers**: `npm` and `pip`

---

### 1. Backend Setup (FastAPI)

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. (Optional but recommended) Create and activate a Python virtual environment:
   ```bash
   # On Windows (PowerShell):
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # On Linux / macOS:
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Launch the FastAPI development server:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

5. The backend API is now running at `http://localhost:8000`.
   - Interactive Swagger API Documentation: `http://localhost:8000/docs`
   - Redoc Documentation: `http://localhost:8000/redoc`

---

### 2. Frontend Setup (Next.js)

1. Open a second terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the Next.js development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

### 3. Running Backend Test Suite

To verify data normalization, authentication routines, and API contracts:

```bash
cd backend
python -m pytest tests
```

*Expected Result: 24 passed tests validating schema adherence, session validation, route authorization, and data integrity.*

---

## 🔐 Security & Access Control

The dashboard implements secure access controls for surveillance operations:

- **Authentication Flow**: Operators sign in via `/login`. Upon authentication, the backend issues a signed `HttpOnly` session cookie (`urbantrack_session`).
- **Endpoint Authorization**: All `/api/*` and `/data/*` routes are protected by middleware and reject unauthenticated requests with HTTP 401.
- **Session Lifespan**: Configurable via environment variables (default: 8 hours).

### Local Demo Credentials

| Field | Value |
|---|---|
| **Username** | `admin` |
| **Password** | `UrbanTrack@2026!` |

### Environment Variables (`backend/.env`)

```ini
URBANTRACK_ADMIN_USERNAME=admin
URBANTRACK_ADMIN_PASSWORD=UrbanTrack@2026!
URBANTRACK_SESSION_SECRET=c2e8a109bf4321d0a5e82f7c0019283746501928
URBANTRACK_SESSION_TTL_SECONDS=28800
URBANTRACK_COOKIE_SECURE=0
URBANTRACK_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

> **Note**: For HTTPS deployments in production, set `URBANTRACK_COOKIE_SECURE=1`, supply a cryptographically secure random session secret, and limit `URBANTRACK_ALLOWED_ORIGINS` to the authorized frontend domain.

---

## 🔍 Upstream Pipeline Integration

UrbanTrack AI seamlessly connects to upstream vision and tracking models:

1. **Member 1 (Perception)** outputs single-camera vehicle detections and OCR records to:
   ```
   data/pipeline/observations.json
   ```
2. **Member 2 (Multi-Camera Intelligence)** outputs identity fusion and trajectory associations to:
   ```
   data/pipeline/multicam_intelligence.json
   ```

### Zero-Downtime Live Transition
When files are dropped into `data/pipeline/`, the normalization adapter automatically detects them:
- The UI status badge dynamically switches from `DATA MODE: DEMO` to `DATA MODE: LIVE PIPELINE`.
- All operational dashboards, trajectory graphs, and dossiers immediately render live data.
- If pipeline files are removed or cleared, the system safely falls back to the benchmark demo dataset without runtime errors.

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate operator credentials and issue signed session cookie |
| `GET` | `/api/auth/me` | Retrieve active authenticated session profile |
| `POST` | `/api/auth/logout` | Terminate session and clear authentication cookie |
| `GET` | `/api/status` | System health status, data mode (`LIVE` vs `DEMO`), and issue count |
| `GET` | `/api/overview` | Core dashboard metrics, vehicle type distribution, and camera summary |
| `GET` | `/api/vehicles` | List all unique globally identified vehicles with query filters |
| `GET` | `/api/vehicles/{id}` | Detailed forensic dossier for a specific global vehicle ID |
| `GET` | `/api/vehicles/{id}/observations` | Chronological list of raw observation sightings for a vehicle |
| `GET` | `/api/trajectories` | Reconstructed multi-camera trajectory journeys across the network |
| `GET` | `/api/cameras` | List all registered CCTV camera sensor nodes |
| `GET` | `/api/cameras/{id}` | Specific camera details, activity metrics, and status |
| `GET` | `/api/camera-network` | Directed camera network graph with transition counts |
| `GET` | `/api/analytics` | High-level analytics, traffic distributions, and capture rates |
| `GET` | `/api/traffic-analytics` | Time-windowed traffic volume analytics per camera |
| `GET` | `/api/alerts` | Active automated alerts (speeding, unusual paths, plate watchlists) |
| `GET` | `/api/journeys` | Complete reconstructed journey paths |
| `GET` | `/api/plate-lookup` | Fast indexed license plate search |
| `POST` | `/api/refresh` | Force cache refresh of input data files |

---

## 📊 Synthetic Benchmark Dataset

The repository includes a comprehensive 46-camera synthetic urban dataset in `data/demo/`:
- **46 Fictional Camera Nodes**: Identifiers `SYN_CAM_01` through `SYN_CAM_46`.
- **Directed Graph Matrix**: Calibrated transition priors across interconnected intersections.
- **Tracklets & Observations**: Frame-level vehicle sightings with OCR-like text, bounding boxes, and timestamp sequences.
- **Association Hypotheses**: Ground-truth link labels for empirical validation and scoring.

---

## 📄 License & Attribution

This project is developed for urban surveillance research, forensic investigation, and intelligent transportation systems.

Released under the [MIT License](LICENSE).
