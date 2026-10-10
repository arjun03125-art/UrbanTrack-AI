import json
from pathlib import Path

src = Path(r"C:\Users\arjun\OneDrive\Desktop\UrbanTrack_Complete_Synthetic_Project_Data")
with open(src / "01_camera_registry.json", "r", encoding="utf-8") as f:
    cams = json.load(f)
with open(src / "02_camera_graph.json", "r", encoding="utf-8") as f:
    graph = json.load(f)
with open(src / "03_vehicles_synthetic_ground_truth.json", "r", encoding="utf-8") as f:
    vehs = json.load(f)
with open(src / "07_reconstructed_journeys.json", "r", encoding="utf-8") as f:
    journeys = json.load(f)
with open(src / "06_association_hypotheses.json", "r", encoding="utf-8") as f:
    assocs = json.load(f)

print("Sample Camera:", json.dumps(cams[0], indent=2))
print("Sample Graph Edge:", json.dumps(graph["edges"][0], indent=2))
print("Sample Vehicle:", json.dumps(vehs[0], indent=2))
print("Sample Journey:", json.dumps(journeys[0], indent=2))
print("Sample Assoc:", json.dumps(assocs[0], indent=2))

with open(src / "05_observations.jsonl", "r", encoding="utf-8") as f:
    first_obs = json.loads(f.readline())
    print("Sample Obs:", json.dumps(first_obs, indent=2))
