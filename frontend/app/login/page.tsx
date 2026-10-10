"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Compass,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  Radio,
  Camera,
  GitFork,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { API_BASE } from "@/lib/config";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Invalid credentials.");
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Cannot reach the UrbanTrack API backend. Verify that the server is online."
          : e instanceof Error
          ? e.message
          : "Authentication failed. Please verify credentials."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080D14] px-4 py-8 flex items-center justify-center font-mono select-none">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[#29384B] bg-[#111C2B] shadow-2xl grid md:grid-cols-2">
        {/* Left Panel: Subtle Technical Camera Network Illustration & Branding */}
        <section className="relative hidden md:flex flex-col justify-between overflow-hidden bg-[#0D1420] p-10 border-r border-[#29384B]">
          {/* Subtle Ambient SVG Camera Network Topology Background */}
          <div className="absolute inset-0 opacity-25 pointer-events-none" aria-hidden="true">
            <svg viewBox="0 0 400 400" className="w-full h-full">
              <defs>
                <pattern id="login-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#55D6E8" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#login-grid)" />

              {/* Technical Camera Network Nodes and Hops */}
              <line x1="80" y1="100" x2="240" y2="80" stroke="#55D6E8" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1="240" y1="80" x2="320" y2="220" stroke="#8295FF" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1="80" y1="100" x2="160" y2="280" stroke="#55D6E8" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1="160" y1="280" x2="320" y2="220" stroke="#34D399" strokeWidth="1.5" />

              <circle cx="80" cy="100" r="14" fill="#111C2B" stroke="#55D6E8" strokeWidth="2" />
              <circle cx="240" cy="80" r="14" fill="#111C2B" stroke="#8295FF" strokeWidth="2" />
              <circle cx="320" cy="220" r="14" fill="#111C2B" stroke="#34D399" strokeWidth="2" />
              <circle cx="160" cy="280" r="14" fill="#111C2B" stroke="#55D6E8" strokeWidth="2" />
            </svg>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-[#172437] border border-[#55D6E8]/40 flex items-center justify-center text-[#55D6E8] shadow-[0_0_12px_rgba(85,214,232,0.25)]">
              <Compass className="w-5 h-5" />
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#55D6E8]">
                URBAN MOVEMENT INTELLIGENCE
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#F1F5F9] mt-1">
                URBANTRACK <span className="text-[#55D6E8]">AI</span>
              </h1>
              <p className="mt-3 text-xs leading-relaxed text-[#94A3B8]">
                Forensic investigation workstation for cross-camera vehicle identification, spatial trajectory reconstruction, and camera network topology.
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-[#29384B]/60 text-[11px] text-[#94A3B8] space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#34D399]" />
              <span>Strict Data Integrity &amp; Provenance Protocol</span>
            </div>
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-[#55D6E8]" />
              <span>Multi-Camera Spatio-Temporal Association</span>
            </div>
          </div>
        </section>

        {/* Right Panel: Authentication Form */}
        <section className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-base font-bold text-[#F1F5F9] tracking-wider uppercase">
              AUTHENTICATE WORKSTATION
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              Provide operator credentials to initialize investigation session.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Username Input */}
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase mb-1.5">
                Operator Username
              </label>
              <div className="relative">
                <UserRound className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full bg-[#080D14] border border-[#29384B] rounded-lg pl-9 pr-3 py-2 text-xs text-[#F1F5F9] placeholder-[#94A3B8]/40 focus:border-[#55D6E8] outline-none"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-[11px] font-bold text-[#94A3B8] uppercase mb-1.5">
                Session Password
              </label>
              <div className="relative">
                <LockKeyhole className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#080D14] border border-[#29384B] rounded-lg pl-9 pr-9 py-2 text-xs text-[#F1F5F9] placeholder-[#94A3B8]/40 focus:border-[#55D6E8] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#F1F5F9]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-lg bg-[#55D6E8] hover:bg-[#55D6E8]/90 text-[#080D14] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {busy ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>AUTHENTICATING...</span>
                </>
              ) : (
                <span>INITIALIZE INVESTIGATION WORKSTATION</span>
              )}
            </button>

            {/* Session Info Hint */}
            <div className="pt-2 text-[10px] text-[#94A3B8]/70 text-center leading-relaxed">
              Environment configured session auth · Preserves token in encrypted HTTP-only cookie.
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#080D14] flex items-center justify-center text-[#55D6E8] font-mono text-xs">
          LOADING AUTHENTICATION GATE...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
