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
  Briefcase,
  User,
  AlertCircle,
  CheckCircle2,
  CheckCheck,
} from "lucide-react";
import { Card, Badge, Button, Skeleton } from "@/components/ui";
import { MetricCard } from "./metric-card";
import { formatDateInterval } from "../hooks/use-dashboard";

export function DepartmentHeadDashboard({ dashboard }) {
  const {
    user,
    timeZone,
    pendingApprovals,
    analyticsOverview,
    approvalPoliciesTotal,
    activeResourcesTotal,
    status,
    refresh,
  } = dashboard;

  const pendingItems = pendingApprovals.items || [];
  const pendingTotal = pendingApprovals.total || 0;

  return (
    <div className="space-y-6">
      {/* ─── Metric Ribbon ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Pending Sign-offs"
          value={pendingTotal}
          icon={ClipboardList}
          subtext="Awaiting Decision"
          href="/dashboard/approvals"
          variant="amber"
          isLoading={status.approvals.isLoading}
          error={status.approvals.error}
        />

        <MetricCard
          title="Department Facilities"
          value={activeResourcesTotal}
          icon={Building2}
          subtext="Operational Spaces"
          href="/dashboard/resources"
          variant="blue"
          isLoading={status.resources.isLoading}
        />

        <MetricCard
          title="Capacity Utilization"
          value={
            analyticsOverview?.averageUtilizationRate !== undefined
              ? `${Math.round(analyticsOverview.averageUtilizationRate)}%`
              : "Active"
          }
          icon={TrendingUp}
          subtext="Institutional Average"
          href="/dashboard/analytics"
          variant="emerald"
          isLoading={status.analytics.isLoading}
          error={status.analytics.error}
        />

        <MetricCard
          title="Active Policies"
          value={approvalPoliciesTotal ?? "Enforced"}
          icon={ShieldCheck}
          subtext="Governance Rules"
          href="/dashboard/approval-policies"
          variant="purple"
          isLoading={status.policies.isLoading}
        />
      </div>

      {/* ─── Main Two-Column Grid ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Approval Queue & Department Overview */}
        <div className="xl:col-span-8 space-y-6">
          {/* Pending Approval Queue */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
                    Action Required: Pending Approvals Queue
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Reservation requests requiring departmental sign-off or justification review.
                  </p>
                </div>
              </div>

              <Link href="/dashboard/approvals">
                <Button size="sm" variant="primary" icon={<ClipboardList className="h-4 w-4" />}>
                  Queue ({pendingTotal})
                </Button>
              </Link>
            </div>

            <div className="pt-4">
              {status.approvals.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : status.approvals.error ? (
                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Unable to load pending approval requests.</span>
                  </div>
                  <Button size="xs" variant="secondary" onClick={refresh}>
                    Retry
                  </Button>
                </div>
              ) : pendingItems.length > 0 ? (
                <div className="space-y-3">
                  {pendingItems.slice(0, 5).map((item) => {
                    const resObj = typeof item.resource === "object" ? item.resource : null;
                    const resName = resObj?.name || "Campus Facility";
                    const resCode = resObj?.code || "RES";
                    const building = resObj?.location?.building || "University Campus";
                    const userObj = typeof item.user === "object" ? item.user : null;
                    const requesterName = userObj?.name || "Student / Staff";
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

                          <h3 className="text-sm font-semibold text-foreground">
                            {item.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-mono">
                            <span className="flex items-center gap-1 text-foreground">
                              <User className="h-3 w-3 text-muted" />
                              {requesterName}
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-amber-400" />
                              {intervalStr}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/dashboard/approvals`}>
                            <Button size="sm" variant="primary" className="text-xs">
                              Review Sign-off
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-surface-2/30 border border-dashed border-border flex flex-col items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2">
                    <CheckCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Approval Queue Cleared
                  </h3>
                  <p className="text-xs text-muted max-w-sm mt-1">
                    All departmental booking requests have been reviewed and resolved.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Department Utilization & Analytics Overview */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
                    Department Resource Utilization
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Aggregated booking density and capacity metrics.
                  </p>
                </div>
              </div>

              <Link href="/dashboard/analytics">
                <Button size="sm" variant="secondary">
                  Full Analytics
                </Button>
              </Link>
            </div>

            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] text-muted uppercase tracking-wider block">
                  Total Reservations
                </span>
                <span className="text-xl font-bold font-mono text-foreground mt-1 block">
                  {analyticsOverview?.totalBookings ?? "—"}
                </span>
                <span className="text-[10px] text-muted">Across all facilities</span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] text-muted uppercase tracking-wider block">
                  Completed Sessions
                </span>
                <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                  {analyticsOverview?.completedBookings ?? "—"}
                </span>
                <span className="text-[10px] text-muted">Successfully fulfilled</span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2/40 border border-border/60">
                <span className="text-[11px] text-muted uppercase tracking-wider block">
                  Cancellation Ratio
                </span>
                <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                  {analyticsOverview?.cancellationRate !== undefined
                    ? `${Math.round(analyticsOverview.cancellationRate)}%`
                    : "—"}
                </span>
                <span className="text-[10px] text-muted">Vacated before start</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column (4 cols): Department Governance & Actions */}
        <div className="xl:col-span-4 space-y-6">
          {/* Department Head Profile */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center gap-3 pb-3 border-b border-border/60">
              <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                <Briefcase className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-foreground truncate">
                  {user?.name || "Department Head"}
                </h3>
                <p className="text-xs text-muted truncate">
                  {user?.department || "Academic Department"}
                </p>
              </div>
            </div>

            <div className="pt-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted">Sign-off Authority:</span>
                <span className="font-semibold text-purple-400">
                  Level 2 Tier Approver
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted">Assigned Department:</span>
                <span className="font-medium text-foreground">
                  {user?.department || "Computer Science"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">System Timezone:</span>
                <span className="font-mono text-foreground">{timeZone}</span>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <h3 className="text-sm font-bold text-foreground mb-1">
              Governance Tools
            </h3>
            <p className="text-xs text-muted mb-4">
              Manage booking approvals, policies, and calendar allocations.
            </p>

            <div className="space-y-2.5">
              <Link
                href="/dashboard/approvals"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-amber-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-amber-400 transition-colors">
                      Approval Queue
                    </div>
                    <div className="text-[11px] text-muted">
                      Review sign-offs ({pendingTotal} pending)
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

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
                      Configure multi-tier workflow rules
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/analytics"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-emerald-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-emerald-400 transition-colors">
                      Institutional Analytics
                    </div>
                    <div className="text-[11px] text-muted">
                      Track department room density
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </Card>

          {/* Department Head Responsibilities */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <h3 className="text-sm font-bold text-foreground mb-1">
              Sign-off Responsibilities
            </h3>
            <p className="text-xs text-muted mb-4">
              Governance obligations under the institutional charter.
            </p>

            <div className="space-y-3 text-xs text-muted">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Timely Review:{" "}
                  </span>
                  Resolve pending requests within the configured approval timeout window.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Audit Logging:{" "}
                  </span>
                  All approval and rejection decisions are immutably logged with timestamp and author credentials.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

