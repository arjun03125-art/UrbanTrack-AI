"use client";
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowRight, Box, Map as MapIcon, Search, SplitSquareHorizontal, Upload } from "lucide-react";
import type { AppData } from "@/lib/useData";
import { api } from "@/lib/useData";
import type { GlobalVehicle } from "@/types";
import { Badge, NA, Panel, STATUS_META, Stat, clock, fullTime, statusOf } from "./ui";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <Spinner t="Loading map…" /> });
const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false, loading: () => <Spinner t="Loading 3D…" /> });
function Spinner({ t }: { t: string }) {
  return <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--muted)]"><span className="w-4 h-4 mr-2 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />{t}</div>;
}

const PALETTE = ["#22d3ee", "#a78bfa", "#fbbf24", "#34d399", "#f87171", "#fb923c", "#60a5fa", "#f472b6"];
const AX = { stroke: "#8b9bc4", fontSize: 11 } as const;
const TIP = { contentStyle: { background: "#0f1730", border: "1px solid #22305a", borderRadius: 10, color: "#e8eeff", fontSize: 12 }, cursor: { fill: "#ffffff10" } };

/* ============================== OVERVIEW ============================== */
export function OverviewTab({ data, go, onPick }: { data: AppData; go: (t: string) => void; onPick: (id: string) => void }) {
  const { summary, vehicles, cameras, telemetry, issues } = data;
  const empty = !summary || summary.total === 0;
  const cross = vehicles.filter((v) => new Set(v.cameras_visited).size > 1).length;
  const confirmed = vehicles.filter((v) => v.identity_status === "confirmed").length;

  const typeData = useMemo(() => {
    const m = new Map<string, number>();
    summary?.by_camera_type.forEach((r) => m.set(r.type, (m.get(r.type) ?? 0) + r.count));
    return Array.from(m, ([name, value]) => ({ name, value }));
  }, [summary]);
  const types = typeData.map((t) => t.name);
  const camData = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    summary?.by_camera_type.forEach((r) => {
      const row = m.get(r.camera_id) ?? { camera: r.camera_id };
      row[r.type] = r.count; m.set(r.camera_id, row);
    });
    return Array.from(m.values());
  }, [summary]);

  if (empty)
    return (
      <div className="max-w-xl mx-auto mt-24 text-center ut-fade">
        <div className="text-2xl font-bold">No data loaded yet</div>
        <p className="text-[var(--muted)] mt-2">Upload your observations (and optionally the multi-camera intelligence file). Counts, charts, map and 3D scene are all built from what you upload.</p>
        <button onClick={() => go("data")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 text-slate-900 font-bold px-5 py-2.5"><Upload className="w-4 h-4" /> Add data</button>
      </div>
    );

  const flow = [
    { n: 1, t: "Detect", v: summary!.total, d: "vehicle detections (observations) read from the cameras", c: "#22d3ee" },
    { n: 2, t: "Track", v: summary!.local_tracks, d: "camera-local tracks: one vehicle followed inside ONE camera", c: "#60a5fa" },
    { n: 3, t: "Compare", v: cross, d: "records seen on more than one camera (possible same vehicle)", c: "#fbbf24" },
    { n: 4, t: "Confirm", v: confirmed, d: "cross-camera identities the pipeline itself marked confirmed", c: "#34d399" },
  ];

  return (
    <div className="space-y-5 ut-fade">
      <div className="rounded-2xl border border-[var(--line)] p-6 bg-gradient-to-br from-[#10204a] via-[#0f1730] to-[#1a1245] relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <h1 className="text-2xl md:text-3xl font-extrabold">Follow one vehicle across a city of cameras</h1>
        <p className="text-[var(--muted)] mt-2 max-w-3xl text-sm">
          UrbanTrack AI detects vehicles in CCTV video, tracks them inside each camera, then asks a harder question: <b className="text-white">is the car on camera B the same car as on camera A?</b> Every number below comes from the files you loaded.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <button onClick={() => go("explore")} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 text-slate-900 font-bold px-4 py-2 text-sm hover:bg-cyan-300">Explore map &amp; 3D <ArrowRight className="w-4 h-4" /></button>
          <button onClick={() => go("vehicles")} className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:border-cyan-400">Browse vehicles</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {flow.map((f, i) => (
          <div key={f.n} className="relative rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full grid place-items-center text-xs font-bold text-slate-900" style={{ background: f.c }}>{f.n}</span><span className="font-bold">{f.t}</span></div>
            <div className="text-3xl font-mono font-bold mt-2" style={{ color: f.c }}>{f.v.toLocaleString()}</div>
            <p className="text-[11px] text-[var(--muted)] mt-1">{f.d}</p>
            {i < 3 && <ArrowRight className="hidden md:block absolute -right-3.5 top-1/2 w-5 h-5 text-[var(--line)] z-10" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Cameras" value={cameras.length} hint={`${cameras.filter((c) => typeof c.latitude === "number").length} with map coordinates`} accent="#a78bfa" />
        <Stat label="Vehicle records" value={vehicles.length} hint="not verified real-world identities" accent="#22d3ee" />
        <Stat label="With plate text" value={summary!.with_plate} hint={`of ${summary!.total.toLocaleString()} observations`} accent="#fbbf24" />
        <Stat label="Pairwise decisions" value={telemetry?.available && telemetry.pairwise_decisions ? Object.values(telemetry.pairwise_decisions).reduce((a, b) => a + b, 0).toLocaleString() : null} hint="needs pipeline_metrics in the file" accent="#34d399" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Detections over time" sub="observations per minute" className="lg:col-span-2">
          <div className="h-56">
            {summary!.timeline.length < 2 ? <p className="text-xs text-[var(--muted)] pt-8">Needs timestamps spanning more than one minute.</p> : (
              <ResponsiveContainer><AreaChart data={summary!.timeline}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#1b2750" vertical={false} /><XAxis dataKey="t" {...AX} /><YAxis {...AX} allowDecimals={false} /><Tooltip {...TIP} />
                <Area type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} fill="url(#g1)" isAnimationActive />
              </AreaChart></ResponsiveContainer>)}
          </div>
        </Panel>
        <Panel title="Vehicle types" sub="share of all observations">
          <div className="h-56"><ResponsiveContainer><PieChart>
            <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3} stroke="none">
              {typeData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie><Tooltip {...TIP} /><Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Observations per camera" sub="stacked by vehicle type" className="lg:col-span-2">
          <div className="h-56"><ResponsiveContainer><BarChart data={camData}>
            <CartesianGrid stroke="#1b2750" vertical={false} /><XAxis dataKey="camera" {...AX} /><YAxis {...AX} allowDecimals={false} /><Tooltip {...TIP} /><Legend wrapperStyle={{ fontSize: 11 }} />
            {types.map((t, i) => <Bar key={t} dataKey={t} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === types.length - 1 ? [4, 4, 0, 0] : 0} />)}
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Association status" sub="how sure is the system about each record?">
          <div className="space-y-2 mt-1">
            {summary!.status_distribution.map((s) => {
              const m = STATUS_META[s.status]; const pct = (s.count / Math.max(1, vehicles.length)) * 100;
              return (<div key={s.status} title={m?.hint}>
                <div className="flex justify-between text-xs"><span style={{ color: m?.color }} className="font-semibold">{m?.label ?? s.status}</span><span className="font-mono">{s.count}</span></div>
                <div className="h-2 rounded-full bg-[#1b2750] mt-1"><div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: m?.color ?? "#94a3b8" }} /></div>
              </div>);
            })}
            <p className="text-[11px] text-[var(--muted)] pt-2">Only “Confirmed” means the pipeline accepted the identity. “Candidate” is a hypothesis.</p>
          </div>
        </Panel>
        {summary!.confidence_hist.length > 0 && (
          <Panel title="Detection confidence" sub="how sure the detector was (not identity confidence)" className="lg:col-span-3">
            <div className="h-40"><ResponsiveContainer><BarChart data={summary!.confidence_hist}>
              <CartesianGrid stroke="#1b2750" vertical={false} /><XAxis dataKey="range" {...AX} /><YAxis {...AX} allowDecimals={false} /><Tooltip {...TIP} />
              <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer></div>
          </Panel>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Try these records" sub="click to open on the map and 3D scene">
          <div className="space-y-2">
            {vehicles.slice(0, 5).map((v) => (
              <button key={v.global_vehicle_id} onClick={() => { onPick(v.global_vehicle_id); go("explore"); }} className="w-full flex items-center justify-between rounded-xl border border-[var(--line)] hover:border-cyan-400 px-3 py-2 text-left">
                <span><span className="font-mono font-bold">{v.global_vehicle_id}</span> <span className="text-xs text-[var(--muted)]">{v.vehicle_type} · {v.cameras_visited.join(" → ")}</span></span>
                <Badge status={statusOf(v)} />
              </button>))}
          </div>
        </Panel>
        <Panel title="Data honesty" sub="what this dashboard cannot claim">
          {issues.length === 0 ? <p className="text-sm text-emerald-300">No data inconsistencies detected.</p> : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {issues.map((i) => <li key={i} className="flex gap-2 text-xs text-amber-200"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{i}</li>)}
            </ul>)}
          {telemetry?.available && telemetry.evaluation && (
            <pre className="mt-3 text-[11px] bg-[#0a1022] rounded-lg p-3 overflow-x-auto text-[var(--muted)]">{JSON.stringify(telemetry.evaluation, null, 1)}</pre>)}
        </Panel>
      </div>
    </div>
  );
}

/* ============================== EXPLORE ============================== */
type VM = "map" | "split" | "3d";
export function ExploreTab({ data, selectedId, onSelect, step, setStep, cam, setCam }: {
  data: AppData; selectedId: string | null; onSelect: (id: string) => void; step: number; setStep: (n: number) => void; cam: string | null; setCam: (c: string | null) => void;
}) {
  const [vm, setVm] = useState<VM>("split");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ vehicle: GlobalVehicle; matched_on: string[] }[] | null>(null);
  const selected = data.vehicles.find((v) => v.global_vehicle_id === selectedId) ?? null;

  useEffect(() => {
    const s = q.trim();
    if (!s) { setHits(null); return; }
    let alive = true;
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(s)}`).then((d) => alive && setHits(d.results)).catch(() => alive && setHits([])), 160);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const list = hits ?? data.vehicles.map((v) => ({ vehicle: v, matched_on: [] as string[] }));
  const views: [VM, string, React.ReactNode][] = [["map", "Map", <MapIcon key="m" className="w-3.5 h-3.5" />], ["split", "Map + 3D", <SplitSquareHorizontal key="s" className="w-3.5 h-3.5" />], ["3d", "3D", <Box key="b" className="w-3.5 h-3.5" />]];

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[320px] shrink-0 border-r border-[var(--line)] bg-[var(--panel)] flex flex-col min-h-0">
        <div className="p-3 border-b border-[var(--line)]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--muted)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Vehicle ID, plate, camera, track #, obs ID" className="w-full rounded-xl bg-[#0a1022] border border-[var(--line)] pl-9 pr-3 py-2 text-xs outline-none focus:border-cyan-400" aria-label="Search vehicles" />
          </div>
          <div className="text-[10px] text-[var(--muted)] mt-1.5">{hits ? `${list.length} match${list.length === 1 ? "" : "es"}` : `${list.length} records`}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
          {list.length === 0 && <p className="text-xs text-[var(--muted)] p-3">Nothing matches “{q}”.</p>}
          {list.map(({ vehicle: v, matched_on }) => (
            <button key={v.global_vehicle_id} onClick={() => onSelect(v.global_vehicle_id)}
              className={`w-full text-left rounded-xl border px-3 py-2 transition ${v.global_vehicle_id === selectedId ? "border-cyan-400 bg-cyan-400/10" : "border-[var(--line)] hover:border-[#3a4d8a]"}`}>
              <div className="flex items-center justify-between"><span className="font-mono font-bold text-sm">{v.global_vehicle_id}</span><Badge status={statusOf(v)} /></div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5">{v.vehicle_type}{v.primary_plate ? ` · ${v.primary_plate}` : ""} · {v.cameras_visited.join(" → ") || "no camera"}</div>
              {matched_on.length > 0 && <div className="text-[10px] text-cyan-300 mt-0.5">matched: {matched_on.join(", ").replace(/_/g, " ")}</div>}
            </button>))}
        </div>
        {selected && (
          <div className="border-t border-[var(--line)] p-3 max-h-[42%] overflow-y-auto">
            <div className="ut-label text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">Journey of {selected.global_vehicle_id}</div>
            {statusOf(selected) === "single_camera" && <p className="text-[11px] text-cyan-200 mb-2">One camera only: a local track, not a city journey.</p>}
            <ol className="space-y-1">
              {selected.trajectory.map((t, i) => (
                <li key={`${t.step}-${i}`}>
                  <button onClick={() => { setStep(i); setCam(t.camera_id); }} className={`w-full text-left rounded-lg px-2 py-1.5 text-xs border ${i === step ? "border-cyan-400 bg-cyan-400/10" : "border-transparent hover:bg-white/5"}`}>
                    <span className="font-mono font-bold">{i + 1}. {t.camera_id}</span><span className="float-right font-mono text-[var(--muted)]">{clock(t.timestamp)}</span>
                    <span className="block text-[10px] text-[var(--muted)]">local track #{t.track_id}{t.observation_id ? ` · ${t.observation_id}` : ""}</span>
                  </button>
                </li>))}
            </ol>
          </div>)}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-[var(--line)] bg-[var(--panel)]">
          <div className="flex rounded-xl border border-[var(--line)] overflow-hidden">
            {views.map(([id, label, icon]) => (
              <button key={id} onClick={() => setVm(id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${vm === id ? "bg-cyan-400 text-slate-900" : "hover:bg-white/5"}`}>{icon}{label}</button>))}
          </div>
          {selected ? (
            <div className="text-xs text-[var(--muted)] flex flex-wrap gap-x-4 gap-y-0.5">
              <span><b className="text-white font-mono">{selected.global_vehicle_id}</b> {selected.vehicle_type}</span>
              <span>Plate: {selected.primary_plate ?? NA}</span>
              <span>Association: {selected.association_confidence != null ? `${(selected.association_confidence * 100).toFixed(0)}%` : NA}</span>
              <span>{fullTime(selected.first_seen) ?? "—"} → {fullTime(selected.last_seen) ?? "—"}</span>
              {selected.available_observations !== undefined && selected.available_observations < selected.total_observations && (
                <span className="text-amber-300">{selected.available_observations} of {selected.total_observations} observations in file</span>)}
            </div>) : <span className="text-xs text-[var(--muted)]">Pick a vehicle on the left.</span>}
          <div className="ml-auto flex items-center gap-4 text-[10px] text-[var(--muted)]">
            <span className="flex items-center gap-1"><i className="w-5 h-0.5 bg-cyan-400 inline-block" />observed path</span>
            <span className="flex items-center gap-1"><i className="w-5 border-t-2 border-dashed border-[#4b5d92] inline-block" />camera link</span>
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full bg-white inline-block" />active camera</span>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-px bg-[var(--line)]">
          {(vm === "map" || vm === "split") && (
            <div className="relative flex-1 min-w-0 min-h-[260px] bg-[var(--bg)]"><div className="absolute inset-0">
              <MapView cameras={data.cameras} network={data.network} vehicle={selected} step={step} onStep={setStep} selectedCamera={cam} onSelectCamera={setCam} />
            </div></div>)}
          {(vm === "3d" || vm === "split") && (
            <div className="relative flex-1 min-w-0 min-h-[260px] bg-[var(--bg)]"><div className="absolute inset-0">
              <Scene3D cameras={data.cameras} network={data.network} vehicle={selected} step={step} onStep={setStep} />
            </div></div>)}
        </div>
      </div>
    </div>
  );
}
