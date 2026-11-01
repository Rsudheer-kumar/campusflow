"use client";

import Link from "next/link";
import {
  Building2,
  CalendarCheck,
  ClipboardList,
  ShieldCheck,
  TrendingUp,
  Clock,
  ArrowRight,
  Shield,
  Wrench,
  Compass,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Layers,
} from "lucide-react";
import { Card, Badge, Button, Skeleton } from "@/components/ui";
import { MetricCard } from "./metric-card";
import { CampusWorkspace } from "@/components/campus/campus-workspace";
import { formatDateInterval } from "../hooks/use-dashboard";

export function AdminDashboard({ dashboard }) {
  const {
    user,
    timeZone,
    activeResourcesTotal,
    maintenanceResourcesTotal,
    pendingApprovals,
    analyticsOverview,
    approvalPoliciesTotal,
    availabilityRulesTotal,
    campusMetrics,
    setCampusMetrics,
    workspaceRefreshKey,
    status,
    refresh,
  } = dashboard;

  const totalFacilities =
    (activeResourcesTotal || 0) + (maintenanceResourcesTotal || 0);
  const pendingTotal = pendingApprovals.total || 0;
  const pendingItems = pendingApprovals.items || [];

  return (
    <div className="space-y-6">
      {/* ─── Metric Ribbon ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Campus Facilities"
          value={totalFacilities || activeResourcesTotal}
          icon={Building2}
          subtext="Total Registered"
          href="/dashboard/resources"
          variant="primary"
          isLoading={status.resources.isLoading}
        />

        <MetricCard
          title="Sign-offs Pending"
          value={pendingTotal}
          icon={ClipboardList}
          subtext="Institution Queue"
          href="/dashboard/approvals"
          variant="amber"
          isLoading={status.approvals.isLoading}
          error={status.approvals.error}
        />

        <MetricCard
          title="System Utilization"
          value={
            analyticsOverview?.averageUtilizationRate !== undefined
              ? `${Math.round(analyticsOverview.averageUtilizationRate)}%`
              : "Active"
          }
          icon={TrendingUp}
          subtext="Campus-Wide Load"
          href="/dashboard/analytics"
          variant="emerald"
          isLoading={status.analytics.isLoading}
          error={status.analytics.error}
        />

        <MetricCard
          title="Maintenance Lock"
          value={maintenanceResourcesTotal}
          icon={Wrench}
          subtext="Service Restricted"
          href="/dashboard/resources?status=MAINTENANCE"
          variant="purple"
          isLoading={status.resources.isLoading}
        />
      </div>

      {/* ─── 3D Campus Digital Twin Workspace ─── */}
      <section aria-label="Campus Digital Twin Operations Centerpiece">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary-bright" />
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Campus Operations &amp; Digital Twin Center
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
        {/* Left Column (8 cols): Approval Queue with Admin Override & System Analytics */}
        <div className="xl:col-span-8 space-y-6">
          {/* Pending Approvals with Admin Override */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Global Approval Queue &amp; Executive Override
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Review reservations pending sign-off across all campus departments.
                  </p>
                </div>
              </div>

              <Link href="/dashboard/approvals">
                <Button size="sm" variant="primary">
                  Open Queue ({pendingTotal})
                </Button>
              </Link>
            </div>

            <div className="pt-4">
              {status.approvals.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : pendingItems.length > 0 ? (
                <div className="space-y-3">
                  {pendingItems.slice(0, 4).map((item) => {
                    const resObj = typeof item.resource === "object" ? item.resource : null;
                    const resName = resObj?.name || "Campus Facility";
                    const resCode = resObj?.code || "RES";
                    const building = resObj?.location?.building || "University Campus";
                    const userObj = typeof item.user === "object" ? item.user : null;
                    const requesterName = userObj?.name || "Campus User";
                    const intervalStr = formatDateInterval(item.startAt, item.endAt, timeZone);

                    return (
                      <div
                        key={item._id}
                        className="p-3.5 rounded-xl bg-surface-2/60 border border-border/60 hover:border-amber-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary-bright">
                              {resCode}
                            </span>
                            <span className="text-xs font-medium text-foreground">
                              {resName}
                            </span>
                            <span className="text-xs text-muted">&bull;</span>
                            <span className="text-xs text-muted">{building}</span>
                          </div>

                          <h4 className="text-sm font-semibold text-foreground">
                            {item.title}
                          </h4>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-mono">
                            <span>Requester: {requesterName}</span>
                            <span>&bull;</span>
                            <span>{intervalStr}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link href="/dashboard/approvals">
                            <Button size="xs" variant="primary">
                              Admin Review
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-surface-2/30 border border-dashed border-border flex flex-col items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Zero Pending Approvals
                  </h4>
                  <p className="text-xs text-muted max-w-sm mt-1">
                    No booking requests are currently awaiting departmental or administrative sign-off.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Institutional Analytics Breakdown */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Institutional Governance &amp; Analytics
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Campus-wide booking density, peak hours, and resource utilization.
                  </p>
                </div>
              </div>

              <Link href="/dashboard/analytics">
                <Button size="sm" variant="secondary">
                  Full Report
                </Button>
              </Link>
            </div>

            <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] text-muted uppercase tracking-wider block">
                  Total Bookings
                </span>
                <span className="text-xl font-bold font-mono text-foreground mt-1 block">
                  {analyticsOverview?.totalBookings ?? "—"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] text-muted uppercase tracking-wider block">
                  Completed
                </span>
                <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                  {analyticsOverview?.completedBookings ?? "—"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] text-muted uppercase tracking-wider block">
                  Active Policies
                </span>
                <span className="text-xl font-bold font-mono text-purple-400 mt-1 block">
                  {approvalPoliciesTotal ?? "—"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] text-muted uppercase tracking-wider block">
                  Operating Rules
                </span>
                <span className="text-xl font-bold font-mono text-blue-400 mt-1 block">
                  {availabilityRulesTotal ?? "—"}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (4 cols): Administrative Command Center */}
        <div className="xl:col-span-4 space-y-6">
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <Shield className="h-5 w-5 text-primary-bright" />
              <h3 className="text-sm font-bold text-foreground">
                Administrative Command Center
              </h3>
            </div>
            <p className="text-xs text-muted my-3">
              Direct access to university resource governance, policies, and system rules.
            </p>

            <div className="space-y-2.5">
              <Link
                href="/dashboard/approval-policies"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-purple-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-purple-400 transition-colors">
                      Approval Policies
                    </div>
                    <div className="text-[11px] text-muted">
                      Multi-tier governance rules
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/availability-rules"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-amber-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-amber-400 transition-colors">
                      Availability &amp; Quotas
                    </div>
                    <div className="text-[11px] text-muted">
                      Operating hours &amp; blackouts
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

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
                      Manage physical spaces &amp; halls
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/analytics"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-blue-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors">
                      System Analytics
                    </div>
                    <div className="text-[11px] text-muted">
                      Track campus resource health
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

