"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileJson, RotateCcw, Upload, XCircle } from "lucide-react";
import type { AppData } from "@/lib/useData";
import { api } from "@/lib/useData";
import type { Observation } from "@/types";
import { Badge, NA, Panel, fullTime, statusOf } from "./ui";

/* ============================== VEHICLES ============================== */
export function VehiclesTab({ data, selectedId, onSelect, openExplore }: { data: AppData; selectedId: string | null; onSelect: (id: string) => void; openExplore: () => void }) {
  const [f, setF] = useState("");
  const [status, setStatus] = useState("ALL");
  const [obs, setObs] = useState<Observation[]>([]);
  const rows = useMemo(() => data.vehicles.filter((v) => {
    const s = f.toLowerCase();
    const okText = !s || [v.global_vehicle_id, v.vehicle_type, v.primary_plate ?? "", v.cameras_visited.join(" ")].join(" ").toLowerCase().includes(s);
    return okText && (status === "ALL" || statusOf(v) === status);
  }), [data.vehicles, f, status]);
  const sel = data.vehicles.find((v) => v.global_vehicle_id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) { setObs([]); return; }
    let alive = true;
    api(`/vehicles/${encodeURIComponent(selectedId)}/observations`).then((o) => alive && setObs(o)).catch(() => alive && setObs([]));
    return () => { alive = false; };
  }, [selectedId]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 ut-fade">
      <Panel className="xl:col-span-3" title="Vehicle records" sub="One row = one record the pipeline produced. A record is not a verified real-world identity."
        right={<div className="flex gap-2">
          <input value={f} onChange={(e) => setF(e.target.value)} placeholder="Filter…" className="rounded-lg bg-[#0a1022] border border-[var(--line)] px-3 py-1.5 text-xs outline-none focus:border-cyan-400" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg bg-[#0a1022] border border-[var(--line)] px-2 py-1.5 text-xs">
            <option value="ALL">All statuses</option>
            {["single_camera", "candidate", "ambiguous", "confirmed", "guarded", "rejected"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select></div>}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
              {["ID", "Type", "Plate", "Status", "Cameras", "Obs (loaded/reported)", "Assoc."].map((h) => <th key={h} className="py-2 pr-3 font-bold">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.global_vehicle_id} onClick={() => onSelect(v.global_vehicle_id)} className={`cursor-pointer border-b border-[#16224a] hover:bg-white/5 ${v.global_vehicle_id === selectedId ? "bg-cyan-400/10" : ""}`}>
                  <td className="py-2 pr-3 font-mono font-bold">{v.global_vehicle_id}</td>
                  <td className="pr-3">{v.vehicle_type}</td>
                  <td className="pr-3 font-mono">{v.primary_plate ?? <span className="text-[var(--muted)]">—</span>}</td>
                  <td className="pr-3"><Badge status={statusOf(v)} /></td>
                  <td className="pr-3 font-mono">{v.cameras_visited.join(", ")}</td>
                  <td className="pr-3 font-mono">{v.available_observations ?? "?"}/{v.total_observations}</td>
                  <td className="font-mono">{v.association_confidence != null ? `${(v.association_confidence * 100).toFixed(0)}%` : "—"}</td>
                </tr>))}
              {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-[var(--muted)]">No records match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="xl:col-span-2" title={sel ? `Dossier · ${sel.global_vehicle_id}` : "Dossier"} sub="evidence behind the selected record">
        {!sel ? <p className="text-sm text-[var(--muted)]">Select a row to inspect its evidence.</p> : (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2"><Badge status={statusOf(sel)} /><span className="text-[var(--muted)]">{sel.vehicle_type}</span></div>
            <dl className="grid grid-cols-[130px_1fr] gap-y-1.5">
              <dt className="text-[var(--muted)]">Plate</dt><dd className="font-mono">{sel.primary_plate ?? NA}</dd>
              <dt className="text-[var(--muted)]">Association probability</dt><dd className="font-mono">{sel.association_confidence != null ? `${(sel.association_confidence * 100).toFixed(1)}%` : NA}</dd>
              <dt className="text-[var(--muted)]">First seen</dt><dd className="font-mono">{fullTime(sel.first_seen) ?? NA}</dd>
              <dt className="text-[var(--muted)]">Last seen</dt><dd className="font-mono">{fullTime(sel.last_seen) ?? NA}</dd>
              <dt className="text-[var(--muted)]">Local tracks</dt><dd className="font-mono">{sel.camera_local_associations.map((a) => `${a.camera_id}#${a.track_id}`).join(", ") || NA}</dd>
            </dl>
            {sel.available_observations !== undefined && sel.available_observations < sel.total_observations && (
              <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2 text-amber-200">Summary reports {sel.total_observations} observations; only {sel.available_observations} exist in the loaded file. Nothing is invented to fill the gap.</p>)}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">Supporting observations ({obs.length})</div>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-[var(--line)]">
                <table className="w-full"><thead className="sticky top-0 bg-[var(--panel2)] text-[10px] text-[var(--muted)]"><tr><th className="p-1.5 text-left">Obs</th><th className="text-left">Cam</th><th className="text-left">Trk</th><th className="text-left">Time</th><th className="text-left">Det. conf.</th></tr></thead>
                  <tbody>{obs.map((o) => <tr key={o.observation_id} className="border-t border-[#16224a] font-mono"><td className="p-1.5">{o.observation_id}</td><td>{o.camera_id}</td><td>#{o.track_id}</td><td>{o.timestamp?.slice(11, 19) ?? "—"}</td><td>{o.detection_confidence != null ? `${(o.detection_confidence * 100).toFixed(0)}%` : "—"}</td></tr>)}
                    {obs.length === 0 && <tr><td colSpan={5} className="p-3 text-[var(--muted)]">No observation rows in the loaded file.</td></tr>}</tbody></table>
              </div>
            </div>
            <button onClick={openExplore} className="w-full rounded-xl bg-cyan-400 text-slate-900 font-bold py-2 hover:bg-cyan-300">Show on map &amp; 3D</button>
          </div>)}
      </Panel>
    </div>
  );
}

/* ============================== DATA ============================== */
interface Result { ok: boolean; msg: string }
export function DataTab({ data, reload, goOverview }: { data: AppData; reload: (hard?: boolean) => Promise<void>; goOverview: () => void }) {
  const [res, setRes] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState(false);

  const send = async (kind: "observations" | "intelligence", file: File) => {
    setBusy(true);
    try {
      const json = JSON.parse(await file.text());
      const r = await api(`/upload?kind=${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
      setRes((p) => ({ ...p, [kind]: { ok: true, msg: `${file.name}: ${r.observations.toLocaleString()} observations · ${r.vehicles} vehicle records · ${r.cameras} cameras (${r.cameras_with_coordinates} with coordinates)` } }));
      await reload(true);
    } catch (e) {
      setRes((p) => ({ ...p, [kind]: { ok: false, msg: e instanceof SyntaxError ? `${file.name} is not valid JSON.` : (e as Error).message } }));
    } finally { setBusy(false); }
  };
  const reset = async () => { setBusy(true); try { await api("/reset", { method: "POST" }); setRes({}); await reload(true); } finally { setBusy(false); } };

  return (
    <div className="space-y-4 max-w-5xl ut-fade">
      <div>
        <h2 className="text-xl font-bold">Add your data</h2>
        <p className="text-sm text-[var(--muted)] mt-1">Drop the files from Member 1 and Member 2. The dashboard re-reads them and rebuilds every number, chart, map marker and 3D tower. Nothing is kept in your browser; files are validated by the backend.</p>
      </div>
      <div className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${data.mode === "DEMO" ? "border-amber-400/40 bg-amber-400/10 text-amber-100" : data.mode === "LIVE_PIPELINE" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : "border-[var(--line)]"}`}>
        <span>{data.mode === "DEMO" ? "Showing built-in DEMO data. Upload files to replace it." : data.mode === "LIVE_PIPELINE" ? "Showing YOUR uploaded data." : "Checking data source…"}</span>
        <span className="font-mono text-xs">{data.totalObservations.toLocaleString()} observations · {data.vehicles.length} records · {data.cameras.length} cameras</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Drop kind="observations" title="1 · Observations (Member 1)" file="observations.json" busy={busy} result={res.observations} onFile={(f) => send("observations", f)}
          hint={'JSON array. Each item needs camera_id. Best fields: observation_id, track_id, timestamp (ISO), vehicle_type, detection_confidence, plate_text, bbox, frame_idx.'} />
        <Drop kind="intelligence" title="2 · Multi-camera intelligence (Member 2)" file="multicam_intelligence.json" busy={busy} result={res.intelligence} onFile={(f) => send("intelligence", f)}
          hint={'JSON object with cameras[] (add latitude/longitude to put them on the map), camera_network{nodes,edges} and global_vehicles[] with trajectory and identity_status. Optional pipeline_metrics{} shows evaluation numbers.'} />
      </div>
      <Panel title="What happens if I upload only observations?" sub="">
        <p className="text-xs text-[var(--muted)]">Cameras and vehicle records are derived from the observations (one record per camera-local track) and shown as <b className="text-cyan-300">single camera</b>. No cross-camera link is invented: that needs Member 2&apos;s file. Cameras without latitude/longitude are listed but never placed on the map; the 3D scene lays them out schematically.</p>
      </Panel>
      <div className="flex gap-3">
        <button onClick={goOverview} className="rounded-xl bg-cyan-400 text-slate-900 font-bold px-4 py-2 text-sm">See the dashboard</button>
        <button onClick={reset} disabled={busy || data.mode === "DEMO"} className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:border-cyan-400"><RotateCcw className="w-4 h-4" /> Back to demo data</button>
      </div>
    </div>
  );
}

function Drop({ title, file, hint, busy, result, onFile }: { kind: string; title: string; file: string; hint: string; busy: boolean; result?: Result; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={`rounded-2xl border-2 border-dashed p-5 transition ${over ? "border-cyan-400 bg-cyan-400/10" : "border-[var(--line)] bg-[var(--panel)]"}`}>
      <div className="flex items-center gap-2 font-bold"><FileJson className="w-5 h-5 text-cyan-300" />{title}</div>
      <p className="text-[11px] text-[var(--muted)] mt-2">{hint}</p>
      <button onClick={() => input.current?.click()} disabled={busy} className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--panel2)] border border-[var(--line)] hover:border-cyan-400 px-4 py-2 text-xs font-semibold disabled:opacity-50">
        <Upload className="w-4 h-4" /> {busy ? "Working…" : `Choose ${file} or drop it here`}
      </button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {result && (
        <div className={`mt-3 flex gap-2 text-xs rounded-lg p-2 ${result.ok ? "bg-emerald-400/10 text-emerald-200" : "bg-red-400/10 text-red-200"}`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}<span>{result.msg}</span>
        </div>)}
    </div>
  );
}
