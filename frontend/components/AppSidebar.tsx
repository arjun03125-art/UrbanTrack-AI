"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Camera,
  Car,
  GitFork,
  Search,
  BarChart3,
  UploadCloud,
  Video,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  Activity,
} from "lucide-react";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  exact?: boolean;
}

const WORKSPACE_NAV: NavItem[] = [
  { label: "Movement Intelligence", href: "/", icon: Compass, exact: true },
  { label: "Camera Network", href: "/cameras", icon: Camera },
  { label: "Vehicle Records", href: "/vehicles", icon: Car },
  { label: "Trajectory Analysis", href: "/trajectories", icon: GitFork },
  { label: "Investigations", href: "/investigation", icon: Search },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

const DATA_NAV: NavItem[] = [
  { label: "Import & Validation", href: "/data", icon: UploadCloud },
];

const SYSTEM_NAV: NavItem[] = [
  { label: "Live Sensor Feeds", href: "/live", icon: Video },
];

export function AppSidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: AppSidebarProps) {
  const pathname = usePathname();

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const renderSection = (title: string, items: NavItem[]) => (
    <div className="py-2">
      {!collapsed && (
        <div className="px-3 pb-1 text-[10px] font-mono font-bold tracking-wider text-[#94A3B8]/70 uppercase">
          {title}
        </div>
      )}
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={collapsed ? item.label : undefined}
              className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                active
                  ? "bg-[#172437] text-[#55D6E8] border border-[#55D6E8]/30 shadow-[0_0_12px_rgba(85,214,232,0.15)]"
                  : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#111C2B]/80 border border-transparent"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  active ? "text-[#55D6E8]" : "text-[#94A3B8] group-hover:text-[#F1F5F9]"
                }`}
              />
              {!collapsed && (
                <span className="truncate tracking-wide">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span className="ml-auto text-[9px] px-1.5 py-0.2 rounded bg-[#55D6E8]/10 text-[#55D6E8] border border-[#55D6E8]/20">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0D1420] border-r border-[#29384B] transition-all duration-200 select-none ${
          collapsed ? "w-16" : "w-64"
        } ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-3 border-b border-[#29384B] shrink-0">
          <Link
            href="/"
            onClick={onMobileClose}
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <div className="w-8 h-8 rounded-lg bg-[#111C2B] border border-[#55D6E8]/40 flex items-center justify-center text-[#55D6E8] shadow-[0_0_10px_rgba(85,214,232,0.2)] shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold tracking-wider text-sm text-[#F1F5F9]">
                    URBAN<span className="text-[#55D6E8]">TRACK</span>
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-[#55D6E8]/10 text-[#55D6E8] border border-[#55D6E8]/30">
                    AI
                  </span>
                </div>
                <div className="text-[9px] font-mono text-[#94A3B8] tracking-widest uppercase">
                  MOVEMENT INTELLIGENCE
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2 py-3 divide-y divide-[#29384B]/50">
          {renderSection("Workspace", WORKSPACE_NAV)}
          {renderSection("Data", DATA_NAV)}
          {renderSection("System", SYSTEM_NAV)}
        </div>

        {/* Footer Technical Meta & Collapse Toggle */}
        <div className="p-3 border-t border-[#29384B] shrink-0 bg-[#080D14]/50">
          {!collapsed && (
            <div className="mb-2 px-2 py-1.5 rounded bg-[#111C2B] border border-[#29384B] text-[10px] font-mono text-[#94A3B8]">
              <div className="flex items-center justify-between text-[#F1F5F9]">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                  ENGINE v1.0.4
                </span>
                <span className="text-[#55D6E8]">TOPOLOGICAL</span>
              </div>
              <div className="text-[9px] text-[#94A3B8]/70 mt-0.5 truncate">
                Multi-Camera Vehicle Correlation
              </div>
            </div>
          )}

          <button
            onClick={onToggle}
            className="w-full hidden lg:flex items-center justify-center gap-2 px-2 py-1.5 rounded-lg border border-[#29384B] text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#111C2B] text-xs font-mono transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-[#55D6E8]" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 text-[#55D6E8]" />
                <span className="text-[11px]">COLLAPSE WORKBENCH</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
