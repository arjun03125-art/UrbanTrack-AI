export interface TrajectoryStep {
  step: number;
  camera_id: string;
  track_id: number;
  timestamp: string | null;
  observation_id?: string | null;
}

export interface CameraLocalAssoc {
  camera_id: string;
  track_id: number;
  confidence: number | null;
}

export interface GlobalVehicle {
  global_vehicle_id: string;
  vehicle_type: string;
  primary_plate: string | null;
  plate_confidence?: number | null;
  color_label?: string | null;
  association_confidence: number | null;
  first_seen: string | null;
  last_seen: string | null;
  total_observations: number;
  available_observations?: number;
  cameras_visited: string[];
  trajectory: TrajectoryStep[];
  camera_local_associations: CameraLocalAssoc[];
  tracking_type?: "single_camera" | "cross_camera" | string;
  identity_status?: "confirmed" | "candidate" | "ambiguous" | "rejected" | "guarded" | "single_camera" | string;
}

export interface EvidenceInfo {
  observation_id: string;
  camera_id: string;
  frame_idx: number | null;
  track_id: number;
  bbox: [number, number, number, number] | null;
  detection_confidence: number | null;
  plate_text: string | null;
  plate_confidence: number | null;
  frame_available: boolean;
  frame_url: string | null;
  video_available: boolean;
  video_url: string | null;
  message: string;
}

export interface Observation {
  observation_id: string;
  camera_id: string;
  track_id: number;
  global_vehicle_id: string | null;
  timestamp: string | null;
  vehicle_type: string;
  detection_confidence: number | null;
  plate_text: string | null;
  plate_confidence: number | null;
  bbox: [number, number, number, number] | null;
  frame_idx: number | null;
}

export interface Camera {
  camera_id: string;
  name: string | null;
  location_description: string | null;
  status: string;
  fps: number | null;
  video_available: boolean;
  vehicles_observed: number;
  total_observations: number;
  last_observation: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coordinate_system?: string | null;
}

export interface CameraNetworkNode {
  id: string;
  label: string;
  x?: number;
  y?: number;
  latitude?: number | null;
  longitude?: number | null;
  coordinate_system?: string | null;
}

export interface CameraNetworkEdge {
  source: string;
  target: string;
  vehicle_flow_count: number;
}

export interface CameraNetwork {
  nodes: CameraNetworkNode[];
  edges: CameraNetworkEdge[];
}

export interface SystemMetadata {
  generated_at: string | null;
  pipeline_version: string | null;
  data_mode: "LIVE_PIPELINE" | "DEMO" | "NO_DATA";
  total_cameras: number;
  notes: string | null;
}

export interface OverviewMetrics {
  total_observations: number;
  unique_global_vehicles: number;
  active_cameras: number;
  vehicles_with_plate: number;
  reconstructed_trajectories: number;
}

export interface OverviewData {
  data_mode: "LIVE_PIPELINE" | "DEMO" | "NO_DATA";
  metadata: SystemMetadata;
  metrics: OverviewMetrics;
  dashboard_summary?: DashboardSummary | null;
  vehicle_type_distribution: Record<string, number>;
  camera_summary: Array<{
    camera_id: string;
    name: string | null;
    vehicles_observed: number;
    total_observations: number;
    status: string;
  }>;
}

export interface AnalyticsData {
  data_mode: "LIVE_PIPELINE" | "DEMO" | "NO_DATA";
  vehicle_type_distribution: Array<{ type: string; count: number }>;
  camera_activity: Array<{
    camera_id: string;
    name: string;
    vehicles: number;
    observations: number;
  }>;
  trajectory_lengths: Array<{ hops: number; count: number }>;
  camera_flows: Array<{ route: string; count: number }>;
  camera_network: CameraNetwork;
}

export interface MvpTelemetry {
  /** false => the loaded data contains no pipeline-level metrics; show "not available", never defaults. */
  available: boolean;
  source: string | null;
  dataset_scope: string | null;
  total_observations: number | null;
  total_tracklets: number | null;
  persisted_embeddings: number | null;
  embedding_dimension: number | null;
  pairwise_decisions: { confirmed: number; ambiguous: number; rejected: number } | null;
  identity_clusters: Record<string, number> | null;
  evaluation: Record<string, unknown> | null;
  calibration: Record<string, unknown> | null;
  cameras: Record<string, Record<string, unknown>>;
  extra: Record<string, unknown>;
}

export interface MvpCameraTelemetry {
  camera_id: string;
  fps: number;
  duration_s: number;
  frames_processed: number;
  tracklets: number;
  persisted_embeddings: number;
  reliability: number;
  mean_detection_confidence: number;
  reid_model: string;
  reid_compatibility: string;
  sync_offset_s: number;
}

export interface Alert {
  alert_id: string;
  timestamp: string | null;
  type: string | null;
  severity: string | null;
  camera_id: string | null;
  title: string | null;
  description: string | null;
  recommended_action: string | null;
  synthetic?: boolean;
}

export interface Journey {
  journey_id: string;
  scenario_id?: string | null;
  synthetic_vehicle_id?: string | null;
  tracklets: Array<{ camera_id: string; track_id: string }>;
  route_camera_sequence: string[];
  first_seen?: string | null;
  last_seen?: string | null;
  route_status?: string | null;
  synthetic?: boolean;
}

export interface TrafficRecord {
  timestamp: string;
  scenario_id: string;
  camera_id: string;
  road_segment: string;
  vehicles_per_5min: string | number;
  average_speed_kmh: string | number;
  congestion_level: string;
  occupancy_pct: string | number;
  source_type?: string;
  synthetic?: string | boolean;
}

export interface DashboardSummary {
  cameras: number;
  vehicles: number;
  tracklets: number;
  observations: number;
  journeys: number;
  association_confirmed: number;
  association_ambiguous: number;
  association_rejected: number;
  high_congestion_windows: number;
}
