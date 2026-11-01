"use client";

import Link from "next/link";
import {
  Building2,
  Wrench,
  Clock,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CalendarDays,
  Layers,
} from "lucide-react";
import { Card, Badge, Button, Skeleton } from "@/components/ui";
import { MetricCard } from "./metric-card";
import { CampusWorkspace } from "@/components/campus/campus-workspace";

export function FacilityManagerDashboard({ dashboard }) {
  const {
    activeResourcesTotal,
    maintenanceResourcesTotal,
    availabilityRulesTotal,
    campusMetrics,
    setCampusMetrics,
    workspaceRefreshKey,
    status,
  } = dashboard;

  const totalFacilities =
    (activeResourcesTotal || 0) + (maintenanceResourcesTotal || 0);

  return (
    <div className="space-y-6">
      {/* ─── Metric Ribbon ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Operational Facilities"
          value={activeResourcesTotal}
          icon={Building2}
          subtext="Bookable & Active"
          href="/dashboard/resources?status=ACTIVE"
          variant="emerald"
          isLoading={status.resources.isLoading}
        />

        <MetricCard
          title="Service Lock / Maintenance"
          value={maintenanceResourcesTotal}
          icon={Wrench}
          subtext="Offline for Repair"
          href="/dashboard/resources?status=MAINTENANCE"
          variant="amber"
          isLoading={status.resources.isLoading}
        />

        <MetricCard
          title="Occupied Now"
          value={campusMetrics.occupied}
          icon={Clock}
          subtext="In-Session Facilities"
          variant="blue"
        />

        <MetricCard
          title="Operating Rules"
          value={availabilityRulesTotal ?? "Active"}
          icon={ShieldCheck}
          subtext="Configured Policies"
          href="/dashboard/availability-rules"
          variant="purple"
          isLoading={status.rules.isLoading}
        />
      </div>

      {/* ─── 3D Campus Digital Twin Workspace (Core Operations Tool) ─── */}
      <section aria-label="3D Campus Spatial Workspace">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Physical Space &amp; Building Operations Workspace
            </h2>
          </div>
          <Link href="/dashboard/campus-map">
            <Button size="sm" variant="secondary" className="text-xs" icon={<Compass className="h-3.5 w-3.5" />}>
              Dedicated View
            </Button>
          </Link>
        </div>
        <CampusWorkspace
          onMetricsUpdate={setCampusMetrics}
          refreshKey={workspaceRefreshKey}
        />
      </section>

      {/* ─── Main Two-Column Grid ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Service Locks & Operations Overview */}
        <div className="xl:col-span-8 space-y-6">
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Facility Maintenance &amp; Decommissioning Overview
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Monitor rooms locked for maintenance and equipment inspection.
                  </p>
                </div>
              </div>

              <Link href="/dashboard/resources">
                <Button size="sm" variant="secondary">
                  Manage Catalogue
                </Button>
              </Link>
            </div>

            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                  Total Catalogued
                </span>
                <span className="text-2xl font-bold font-mono text-foreground mt-1 block">
                  {totalFacilities || "—"}
                </span>
                <span className="text-[10px] text-muted">Across all campus towers</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                  Available Slots
                </span>
                <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                  {campusMetrics.available ?? "—"}
                </span>
                <span className="text-[10px] text-muted">Immediate booking window</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                  Under Service
                </span>
                <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
                  {maintenanceResourcesTotal ?? 0}
                </span>
                <span className="text-[10px] text-muted">Maintenance lock active</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (4 cols): Operations Shortcuts & Protocols */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <h3 className="text-sm font-bold text-foreground mb-1">
              Operations Center
            </h3>
            <p className="text-xs text-muted mb-4">
              Direct access to operating schedules and physical spaces.
            </p>

            <div className="space-y-2.5">
              <Link
                href="/dashboard/resources"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-emerald-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-emerald-400 transition-colors">
                      Resource Catalogue
                    </div>
                    <div className="text-[11px] text-muted">
                      Add, edit, or archive facilities
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/availability-rules"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-purple-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-purple-400 transition-colors">
                      Availability Rules
                    </div>
                    <div className="text-[11px] text-muted">
                      Operating hours &amp; blackout periods
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/calendar"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-blue-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors">
                      Building Schedule
                    </div>
                    <div className="text-[11px] text-muted">
                      Inspect reservation load across floors
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

