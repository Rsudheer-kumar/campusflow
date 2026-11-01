"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  Clock,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout";
import {
  Card,
  Badge,
  Button,
  Skeleton,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAuthorized = Boolean(
    user?.roles?.some((role) =>
      ["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD"].includes(role)
    )
  );

  const fetchAnalytics = useCallback(async () => {
    if (!isAuthorized) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.analytics.getOverview();
      setData(res);
    } catch (err) {
      setError(err?.message || "Failed to load campus analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    let ignore = false;
    if (!isAuthorized) {
      return;
    }
    api.analytics
      .getOverview()
      .then((res) => {
        if (!ignore) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err?.message || "Failed to load campus analytics.");
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  // Status badge styling helper
  const getStatusBadge = (status) => {
    switch (status) {
      case "CONFIRMED":
      case "CHECKED_IN":
        return <Badge variant="success" dot>{status.replace("_", " ")}</Badge>;
      case "PENDING":
        return <Badge variant="warning" dot>Pending Approval</Badge>;
      case "COMPLETED":
        return <Badge variant="neutral">Completed</Badge>;
      case "CANCELLED":
      case "REJECTED":
        return <Badge variant="danger">Cancelled</Badge>;
      case "NO_SHOW":
        return <Badge variant="danger" dot>No Show</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-full py-8">
        <PageContainer className="space-y-6">
          <PageHeader
            title="Institutional Analytics"
            description="Facility utilization, booking density, and campus capacity metrics."
          />
          <Card className="p-8 text-center bg-surface-2/40 border-border">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-warning mb-4">
              <ShieldAlert className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Administrative Access Required
            </h2>
            <p className="text-sm text-muted max-w-md mx-auto mb-6">
              CampusFlow analytics dashboards are restricted to Department Heads, Facility Managers, and System Administrators.
            </p>
            <Link href="/dashboard">
              <Button variant="secondary" size="sm">
                Return to Campus Overview
              </Button>
            </Link>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-full py-8">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Campus Analytics & Utilization"
          description="Live reservation statistics, facility utilization by building, and capacity metrics."
          action={
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />}
              onClick={fetchAnalytics}
              disabled={isLoading}
            >
              Refresh Data
            </Button>
          }
        />

        {error ? (
          <ErrorState
            title="Failed to Load Analytics"
            message={error}
            onRetry={fetchAnalytics}
          />
        ) : isLoading ? (
          <div className="space-y-6">
            {/* Top Metric Skeletons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="p-5 space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-36" />
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5 space-y-4">
                <Skeleton className="h-5 w-40" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </Card>
              <Card className="p-5 space-y-4">
                <Skeleton className="h-5 w-40" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </Card>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* 4 Summary Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 relative overflow-hidden bg-gradient-to-b from-surface to-surface-2 border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Total Bookings
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary-bright">
                    <CalendarCheck className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-bold text-foreground">
                    {data.summary?.totalBookings ?? 0}
                  </div>
                  <p className="text-xs text-muted mt-1">
                    All-time recorded reservations
                  </p>
                </div>
              </Card>

              <Card className="p-5 relative overflow-hidden bg-gradient-to-b from-surface to-surface-2 border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Active & In-Progress
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center text-success">
                    <Activity className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-bold text-foreground">
                    {data.summary?.activeBookings ?? 0}
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Confirmed and checked-in slots
                  </p>
                </div>
              </Card>

              <Card className="p-5 relative overflow-hidden bg-gradient-to-b from-surface to-surface-2 border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Pending Approvals
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-3xl font-bold text-foreground">
                    {data.summary?.pendingApprovals ?? 0}
                  </div>
                  {data.summary?.pendingApprovals > 0 && (
                    <Badge variant="warning" dot>Needs Review</Badge>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">
                  Awaiting tiered departmental approval
                </p>
              </Card>

              <Card className="p-5 relative overflow-hidden bg-gradient-to-b from-surface to-surface-2 border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Campus Facility Load
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary-bright">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-bold text-primary-bright">
                    {data.summary?.utilizationRate ?? 0}%
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, data.summary?.utilizationRate || 0)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted mt-2">
                    {data.summary?.activeResources ?? 0} active out of {data.summary?.totalResources ?? 0} facilities
                  </p>
                </div>
              </Card>
            </div>

            {/* Breakdowns Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Utilization by Building */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary-bright" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Bookings by Campus Building
                    </h3>
                  </div>
                  <span className="text-xs text-muted">
                    {data.byBuilding?.length ?? 0} Buildings
                  </span>
                </div>

                {data.byBuilding?.length === 0 ? (
                  <p className="text-sm text-muted text-center py-6">
                    No building booking records available.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.byBuilding?.map((item) => {
                      const maxBookings = Math.max(...data.byBuilding.map((b) => b.totalBookings), 1);
                      const pct = Math.round((item.totalBookings / maxBookings) * 100);
                      return (
                        <div key={item.building} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-foreground">
                              {item.building}
                            </span>
                            <div className="flex items-center gap-2 text-muted">
                              <span>{item.totalBookings} total</span>
                              {item.activeBookings > 0 && (
                                <Badge variant="success">
                                  {item.activeBookings} active
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-primary to-primary-bright h-2 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Status Breakdown & Resource Types */}
              <div className="space-y-6">
                {/* Status Distribution */}
                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary-bright" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Reservation Status Breakdown
                      </h3>
                    </div>
                  </div>

                  {data.byStatus?.length === 0 ? (
                    <p className="text-sm text-muted text-center py-4">
                      No reservation data.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {data.byStatus?.map((item) => (
                        <div
                          key={item.status}
                          className="p-3 rounded-[var(--radius-sm)] bg-surface-2/60 border border-border flex flex-col justify-between"
                        >
                          <span className="text-[11px] text-muted font-mono uppercase tracking-wider">
                            {item.status.replace("_", " ")}
                          </span>
                          <span className="text-xl font-bold text-foreground mt-1">
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Resource Category Distribution */}
                {data.byType?.length > 0 && (
                  <Card className="p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                      Bookings by Facility Category
                    </h3>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {data.byType.map((t) => (
                        <div
                          key={t.type}
                          className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-surface border border-border text-xs flex items-center gap-2"
                        >
                          <span className="text-foreground font-medium">{t.type}</span>
                          <span className="text-primary-bright font-bold">({t.count})</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Recent Booking Activity Table */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary-bright" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Recent Reservation Activity
                  </h3>
                </div>
                <Link
                  href="/dashboard/bookings"
                  className="text-xs text-primary-bright hover:underline flex items-center gap-1"
                >
                  View all bookings
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {data.recentActivity?.length === 0 ? (
                <EmptyState
                  icon={<CalendarCheck className="h-8 w-8 text-muted" />}
                  title="No Recent Activity"
                  description="When reservations are submitted or transitioned, they will appear here in real time."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-muted font-medium uppercase tracking-wider">
                        <th className="pb-2.5">Title & Facility</th>
                        <th className="pb-2.5">Location</th>
                        <th className="pb-2.5">Requester</th>
                        <th className="pb-2.5">Scheduled Slot (UTC)</th>
                        <th className="pb-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {data.recentActivity.map((r) => (
                        <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 pr-3">
                            <p className="font-semibold text-foreground text-sm">
                              {r.title}
                            </p>
                            <p className="text-[11px] text-muted">
                              {r.resourceName} ({r.resourceCode})
                            </p>
                          </td>
                          <td className="py-3 pr-3 text-muted">
                            {r.building}
                          </td>
                          <td className="py-3 pr-3">
                            <p className="text-foreground">{r.userName}</p>
                            <p className="text-[10px] text-muted">{r.userEmail}</p>
                          </td>
                          <td className="py-3 pr-3 text-muted font-mono text-[11px]">
                            {new Date(r.startAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "UTC",
                            })}
                          </td>
                          <td className="py-3 text-right">
                            {getStatusBadge(r.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </PageContainer>
    </div>
  );
}
