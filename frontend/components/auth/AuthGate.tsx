"use client";

import React, { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE } from "@/lib/config";

function AuthGateContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [checking, setChecking] = useState(!isLogin);

  useEffect(() => {
    if (isLogin) return;
    let cancelled = false;

    fetch(`${API_BASE}/auth/me`, { cache: "no-store", credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthenticated");
        return res.json();
      })
      .then(() => {
        if (!cancelled) setChecking(false);
      })
      .catch(() => {
        if (!cancelled) {
          const query = typeof window !== "undefined" ? window.location.search : "";
          const next = `${pathname}${query}`;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLogin, pathname, router]);

  if (isLogin) return <>{children}</>;
  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#080D14] text-[#F1F5F9]">
        <div className="rounded-xl border border-[#29384B] bg-[#111C2B] px-8 py-6 shadow-2xl text-center font-mono">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#29384B] border-t-[#55D6E8]" />
          <p className="text-xs uppercase tracking-widest text-[#55D6E8] font-bold">URBANTRACK AI</p>
          <p className="mt-1 text-[11px] text-[#94A3B8]">AUTHENTICATING WORKSTATION SESSION…</p>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#080D14] text-[#94A3B8] font-mono text-xs">
          INITIALIZING URBANTRACK CLIENT…
        </div>
      }
    >
      <AuthGateContent>{children}</AuthGateContent>
    </Suspense>
  );
}
