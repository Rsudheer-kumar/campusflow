"use client";

import Link from "next/link";
import {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Clock,
  Compass,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  BookOpen,
  MapPin,
  AlertCircle,
} from "lucide-react";
import { Card, Badge, Button, Skeleton } from "@/components/ui";
import { MetricCard } from "./metric-card";
import { CampusWorkspace } from "@/components/campus/campus-workspace";
import { formatDateInterval, formatTime } from "../hooks/use-dashboard";

export function StudentDashboard({ dashboard }) {
  const {
    user,
    timeZone,
    bookings,
    todaySchedule,
    upcomingBookings,
    activeResourcesTotal,
    campusMetrics,
    setCampusMetrics,
    workspaceRefreshKey,
    status,
    refresh,
  } = dashboard;

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* ─── Metric Ribbon ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Upcoming Reservations"
          value={upcomingBookings.length}
          icon={CalendarCheck}
          subtext="Confirmed & Active"
          href="/dashboard/bookings"
          variant="primary"
          isLoading={status.bookings.isLoading}
          error={status.bookings.error}
        />

        <MetricCard
          title="Awaiting Review"
          value={pendingCount}
          icon={Clock}
          subtext="Faculty/Dept Sign-off"
          href="/dashboard/bookings"
          variant="amber"
          isLoading={status.bookings.isLoading}
          error={status.bookings.error}
        />

        <MetricCard
          title="Available Now"
          value={campusMetrics.available}
          icon={CheckCircle2}
          subtext="Evaluated Window"
          variant="emerald"
        />

        <MetricCard
          title="Campus Facilities"
          value={activeResourcesTotal ?? campusMetrics.total}
          icon={Building2}
          subtext="Active Catalogue"
          href="/dashboard/resources"
          variant="blue"
          isLoading={status.resources.isLoading}
        />
      </div>

      {/* ─── Main Two-Column Grid ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Today's Schedule & Upcoming Reservations */}
        <div className="xl:col-span-8 space-y-6">
          {/* Today's Schedule */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
                    Today&apos;s Sessions &amp; Study Slots
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Your scheduled bookings for today ({timeZone}).
                  </p>
                </div>
              </div>

              <Link href="/dashboard/calendar">
                <Button size="sm" variant="secondary" icon={<Calendar className="h-4 w-4" />}>
                  Calendar
                </Button>
              </Link>
            </div>

            <div className="pt-4">
              {status.bookings.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : status.bookings.error ? (
                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Failed to load today&apos;s agenda.</span>
                  </div>
                  <Button size="xs" variant="secondary" onClick={refresh}>
                    Retry
                  </Button>
                </div>
              ) : todaySchedule.length > 0 ? (
                <div className="space-y-3">
                  {todaySchedule.map((b) => {
                    const resObj = typeof b.resource === "object" ? b.resource : null;
                    const resName = resObj?.name || "Campus Facility";
                    const resCode = resObj?.code || "RES";
                    const building = resObj?.location?.building || "University Campus";
                    const sTime = formatTime(b.startAt, timeZone);
                    const eTime = formatTime(b.endAt, timeZone);

                    return (
                      <div
                        key={b._id || b.id}
                        className="p-3.5 rounded-xl bg-surface-2/60 border border-border/60 hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                              {resCode}
                            </span>
                            <span className="text-xs font-medium text-foreground">
                              {resName}
                            </span>
                            <span className="text-xs text-muted">&bull;</span>
                            <span className="text-xs text-muted">{building}</span>
                          </div>
                          <h3 className="text-sm font-semibold text-foreground">
                            {b.title}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
                            <Clock className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <span>
                              {sTime} – {eTime} ({timeZone})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <Badge
                            variant={
                              b.status === "CONFIRMED" || b.status === "CHECKED_IN"
                                ? "available"
                                : b.status === "PENDING"
                                ? "pending"
                                : "neutral"
                            }
                            dot
                          >
                            {b.status}
                          </Badge>
                          <Link href={`/dashboard/calendar?resourceId=${resObj?._id || b.resource}`}>
                            <Button size="xs" variant="secondary">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-surface-2/30 border border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className="p-2.5 rounded-full bg-surface-2 border border-border text-muted shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        No Bookings Today
                      </h3>
                      <p className="text-xs text-muted mt-0.5">
                        You have no study spaces or laboratories scheduled for today.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href="/dashboard/resources">
                      <Button size="sm" variant="secondary">
                        Browse Labs
                      </Button>
                    </Link>
                    <Link href="/dashboard/calendar">
                      <Button size="sm" variant="primary">
                        Reserve Facility
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Upcoming Reservations */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary-bright">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
                    Upcoming Active Bookings
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Your future reservations across campus buildings.
                  </p>
                </div>
              </div>

              <Link href="/dashboard/bookings">
                <Button size="sm" variant="secondary">
                  View All ({bookings.length})
                </Button>
              </Link>
            </div>

            <div className="pt-4">
              {status.bookings.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : upcomingBookings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingBookings.slice(0, 4).map((b) => {
                    const resObj = typeof b.resource === "object" ? b.resource : null;
                    const resName = resObj?.name || "Campus Facility";
                    const resCode = resObj?.code || "RES";
                    const building = resObj?.location?.building || "University Campus";
                    const intervalStr = formatDateInterval(b.startAt, b.endAt, timeZone);

                    return (
                      <div
                        key={b._id || b.id}
                        className="p-3.5 rounded-xl bg-surface-2/60 border border-border/60 hover:border-border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
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
                            {b.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
                            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{intervalStr}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <Badge
                            variant={
                              b.status === "CONFIRMED" || b.status === "CHECKED_IN"
                                ? "available"
                                : b.status === "PENDING"
                                ? "pending"
                                : "neutral"
                            }
                            dot
                          >
                            {b.status}
                          </Badge>
                          <Link href={`/dashboard/calendar?resourceId=${resObj?._id || b.resource}`}>
                            <Button size="xs" variant="secondary">
                              Calendar
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-surface-2/30 border border-dashed border-border flex flex-col items-center justify-center">
                  <CalendarCheck className="h-10 w-10 text-muted mb-2" />
                  <h3 className="text-sm font-semibold text-foreground">
                    No Upcoming Reservations
                  </h3>
                  <p className="text-xs text-muted max-w-sm mt-1 mb-4">
                    Reserve a computer lab, lecture hall, or study room from the facility catalogue.
                  </p>
                  <Link href="/dashboard/resources">
                    <Button size="sm" variant="primary">
                      Explore Facilities
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* 3D Campus Twin Section */}
          <section aria-label="Campus Digital Twin Overview">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-blue-400" />
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Campus Digital Twin Workspace
                </h3>
              </div>
              <Link href="/dashboard/campus-map">
                <Button size="sm" variant="secondary" className="text-xs" icon={<Compass className="h-3.5 w-3.5" />}>
                  Full Screen
                </Button>
              </Link>
            </div>
            <CampusWorkspace
              onMetricsUpdate={setCampusMetrics}
              refreshKey={workspaceRefreshKey}
            />
          </section>
        </div>

        {/* Right Column (4 cols): Student Profile & Shortcuts & Rules */}
        <div className="xl:col-span-4 space-y-6">
          {/* Student Profile Card */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center gap-3 pb-3 border-b border-border/60">
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-foreground truncate">
                  {user?.name || "Student"}
                </h3>
                <p className="text-xs text-muted truncate">
                  {user?.identifier ? `ID: ${user.identifier}` : user?.email}
                </p>
              </div>
            </div>

            <div className="pt-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted">Department:</span>
                <span className="font-medium text-foreground">
                  {user?.department || "Computer Science"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted">Role:</span>
                <span className="font-semibold text-primary-bright">
                  Enrolled Student
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Timezone:</span>
                <span className="font-mono text-foreground">{timeZone}</span>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-border/60">
              <Link href="/dashboard/settings">
                <Button size="xs" variant="outline" className="w-full justify-between">
                  <span>Manage Preferences</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Quick Reserve Shortcuts */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <h3 className="text-sm font-bold text-foreground mb-1">
              Quick Actions
            </h3>
            <p className="text-xs text-muted mb-4">
              Direct access to university facilities and booking tools.
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
                      Facility Catalogue
                    </div>
                    <div className="text-[11px] text-muted">
                      Browse lecture halls &amp; computer labs
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/calendar"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-indigo-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-indigo-400 transition-colors">
                      Book a Room
                    </div>
                    <div className="text-[11px] text-muted">
                      Select date, time &amp; book instantly
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/campus-map"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-blue-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Compass className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors">
                      Campus 3D Twin
                    </div>
                    <div className="text-[11px] text-muted">
                      Interactive building &amp; room navigator
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </Card>

          {/* Student Booking Guidelines */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <h3 className="text-sm font-bold text-foreground mb-1">
              Booking Guidelines
            </h3>
            <p className="text-xs text-muted mb-4">
              Automated reservation policies enforced across campus.
            </p>

            <div className="space-y-3 text-xs text-muted">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    15-Minute Grace Window:{" "}
                  </span>
                  Check in within 15 minutes of session start or the slot is automatically vacated.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Timetable Precedence:{" "}
                  </span>
                  Academic course timetables have priority over ad-hoc student requests.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Faculty Sign-off:{" "}
                  </span>
                  Specialized laboratory requests require approval from faculty or department heads.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

