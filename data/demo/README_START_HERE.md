# UrbanTrack AI — Complete Synthetic Project Dataset

**Synthetic-only end-to-end demo.** All 46 cameras, coordinates, plate strings, tracklets, observations, associations, journeys, ground-truth labels, traffic counts, and alerts are generated for demonstration. They are not real CCTV or AI City records and must not be presented as measured model performance.

## Included
1. Camera registry (46 fictional cameras)
2. Directed camera graph with soft illustrative transition priors
3. Synthetic vehicle registry / ground-truth identities
4. Camera-local tracklets with timestamps, OCR-like fields, embedding-availability flags, motion and quality fields
5. Frame-level observations in JSONL
6. Association hypotheses with confirmed / ambiguous / rejected decisions
7. Pre-generated illustrative journeys
8. Plate-search lookup
9. Synthetic ground-truth links for testing only
10. Traffic analytics (46 cameras × 12 five-minute windows)
11. CSV tracklets for spreadsheet/data-frame import
12. Per-camera analytics summary
13. Alerts
14. Dashboard summary

## Keying and semantics
- Use `(scenario_id, camera_id, track_id)` as the unique tracklet key.
- All camera IDs use `SYN_CAM_01` … `SYN_CAM_46`.
- `association_score` and `prior_score` are illustrative scores, **not calibrated probabilities**.
- `synthetic_vehicle_id_for_ground_truth_only` is for synthetic evaluation only; do not pass it to the inference algorithm as a feature.
- `09_synthetic_ground_truth_links.json` can be used by a separate demo evaluator. Keep it out of the inference input path to avoid label leakage.
- `synthetic: true` and `source_type: synthetic_demo` are included for provenance.

## Suggested demo
1. Load camera registry and graph.
2. Load tracklets and observations.
3. Run your actual pipeline on these inputs only if its schema adapter supports them.
4. Otherwise use the pre-generated associations/journeys strictly as a UI demo.
5. Search plates using `08_plate_search_lookup.json`.
6. Display congestion from `10_traffic_analytics.csv` and alerts from `13_alerts.json`.

## Important
This dataset is internally coherent as an illustrative demo pack, but it is not a validated benchmark and is not evidence that UrbanTrack's real models achieve any particular accuracy. The pre-generated journeys and association labels are sample outputs, not outputs produced by your trained models.
