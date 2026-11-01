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
  UserCheck,
  BookOpen,
  FlaskConical,
  GraduationCap,
  AlertCircle,
  ClipboardCheck,
} from "lucide-react";
import { Card, Badge, Button, Skeleton } from "@/components/ui";
import { MetricCard } from "./metric-card";
import { CampusWorkspace } from "@/components/campus/campus-workspace";
import { formatDateInterval, formatTime } from "../hooks/use-dashboard";

export function FacultyDashboard({ dashboard }) {
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

  const confirmedSessions = bookings.filter(
    (b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN"
  ).length;

  return (
    <div className="space-y-6">
      {/* ─── Metric Ribbon ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Today's Sessions"
          value={todaySchedule.length}
          icon={CalendarDays}
          subtext="Teaching & Lectures"
          href="/dashboard/calendar"
          variant="emerald"
          isLoading={status.bookings.isLoading}
          error={status.bookings.error}
        />

        <MetricCard
          title="Confirmed Bookings"
          value={confirmedSessions}
          icon={CalendarCheck}
          subtext="Active Facilities"
          href="/dashboard/bookings"
          variant="primary"
          isLoading={status.bookings.isLoading}
          error={status.bookings.error}
        />

        <MetricCard
          title="Available Now"
          value={campusMetrics.available}
          icon={CheckCircle2}
          subtext="Ready for Ad-hoc Class"
          variant="blue"
        />

        <MetricCard
          title="Campus Facilities"
          value={activeResourcesTotal ?? campusMetrics.total}
          icon={Building2}
          subtext="Bookable Catalogue"
          href="/dashboard/resources"
          variant="purple"
          isLoading={status.resources.isLoading}
        />
      </div>

      {/* ─── Main Two-Column Grid ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Today's Teaching Schedule & Quick Booking */}
        <div className="xl:col-span-8 space-y-6">
          {/* Today's Teaching Schedule */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
                    Today&apos;s Academic &amp; Lecture Schedule
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Your scheduled lectures, labs, and office hours for today ({timeZone}).
                  </p>
                </div>
              </div>

              <Link href="/dashboard/calendar">
                <Button size="sm" variant="secondary" icon={<Calendar className="h-4 w-4" />}>
                  Master Calendar
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
                    <span>Failed to load today&apos;s schedule.</span>
                  </div>
                  <Button size="xs" variant="secondary" onClick={refresh}>
                    Retry
                  </Button>
                </div>
              ) : todaySchedule.length > 0 ? (
                <div className="space-y-3">
                  {todaySchedule.map((b) => {
                    const resObj = typeof b.resource === "object" ? b.resource : null;
                    const resName = resObj?.name || "Academic Facility";
                    const resCode = resObj?.code || "FAC";
                    const building = resObj?.location?.building || "University Campus";
                    const sTime = formatTime(b.startAt, timeZone);
                    const eTime = formatTime(b.endAt, timeZone);

                    return (
                      <div
                        key={b._id || b.id}
                        className="p-3.5 rounded-xl bg-surface-2/60 border border-border/60 hover:border-emerald-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
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
                            <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
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
                                : "pending"
                            }
                            dot
                          >
                            {b.status}
                          </Badge>
                          <Link href={`/dashboard/calendar?resourceId=${resObj?._id || b.resource}`}>
                            <Button size="xs" variant="secondary">
                              View Slot
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
                        No Teaching Slots Today
                      </h3>
                      <p className="text-xs text-muted mt-0.5">
                        You have no lectures or laboratory courses scheduled on your agenda today.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href="/dashboard/calendar">
                      <Button size="sm" variant="primary">
                        Reserve Lecture Hall
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Upcoming Faculty Reservations */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary-bright">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
                    Upcoming Course Reservations &amp; Labs
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Your scheduled academic rooms, computer labs, and departmental sessions.
                  </p>
                </div>
              </div>

              <Link href="/dashboard/bookings">
                <Button size="sm" variant="secondary">
                  Manage All ({bookings.length})
                </Button>
              </Link>
            </div>

            <div className="pt-4">
              {upcomingBookings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingBookings.slice(0, 4).map((b) => {
                    const resObj = typeof b.resource === "object" ? b.resource : null;
                    const resName = resObj?.name || "Campus Facility";
                    const resCode = resObj?.code || "FAC";
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
                                : "pending"
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
                    No Future Reservations Scheduled
                  </h3>
                  <p className="text-xs text-muted max-w-sm mt-1 mb-4">
                    Book a lecture theater, seminar room, or specialized computer laboratory for your upcoming courses.
                  </p>
                  <Link href="/dashboard/calendar">
                    <Button size="sm" variant="primary">
                      Book Classroom or Lab
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* 3D Campus Digital Twin */}
          <section aria-label="Campus Digital Twin Overview">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Campus Facilities Digital Twin
                </h3>
              </div>
              <Link href="/dashboard/campus-map">
                <Button size="sm" variant="secondary" className="text-xs" icon={<Compass className="h-3.5 w-3.5" />}>
                  Full Map
                </Button>
              </Link>
            </div>
            <CampusWorkspace
              onMetricsUpdate={setCampusMetrics}
              refreshKey={workspaceRefreshKey}
            />
          </section>
        </div>

        {/* Right Column (4 cols): Faculty Profile & Actions & Notice */}
        <div className="xl:col-span-4 space-y-6">
          {/* Faculty Profile Card */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <div className="flex items-center gap-3 pb-3 border-b border-border/60">
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                <UserCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-foreground truncate">
                  {user?.name || "Faculty Member"}
                </h3>
                <p className="text-xs text-muted truncate">
                  {user?.identifier ? `Staff ID: ${user.identifier}` : user?.email}
                </p>
              </div>
            </div>

            <div className="pt-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted">Academic Department:</span>
                <span className="font-medium text-foreground">
                  {user?.department || "Computer Science"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted">Academic Tier:</span>
                <span className="font-semibold text-emerald-400">
                  Instructional Faculty
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Preferred Timezone:</span>
                <span className="font-mono text-foreground">{timeZone}</span>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-border/60">
              <Link href="/dashboard/settings">
                <Button size="xs" variant="outline" className="w-full justify-between">
                  <span>Faculty Preferences</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </Card>

          {/* Quick Reserve Shortcuts for Faculty */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <h3 className="text-sm font-bold text-foreground mb-1">
              Teaching &amp; Space Actions
            </h3>
            <p className="text-xs text-muted mb-4">
              Direct tools for scheduling lectures, exams, and laboratories.
            </p>

            <div className="space-y-2.5">
              <Link
                href="/dashboard/calendar"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-emerald-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-emerald-400 transition-colors">
                      Book Classroom
                    </div>
                    <div className="text-[11px] text-muted">
                      Schedule lecture theaters &amp; seminar halls
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/resources"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-blue-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors">
                      Book Laboratory
                    </div>
                    <div className="text-[11px] text-muted">
                      Reserve specialized workstation spaces
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/approvals"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-amber-500/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-amber-400 transition-colors">
                      Pending Approvals
                    </div>
                    <div className="text-[11px] text-muted">
                      Review student reservation requests
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                href="/dashboard/bookings"
                className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-primary/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary-bright border border-primary/20">
                    <CalendarCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      Reservation Status
                    </div>
                    <div className="text-[11px] text-muted">
                      Inspect pending and confirmed requests
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </Card>

          {/* Faculty Governance Notice */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-5 sm:p-6 shadow-md">
            <h3 className="text-sm font-bold text-foreground mb-1">
              Faculty Scheduling Protocol
            </h3>
            <p className="text-xs text-muted mb-4">
              Academic timetable standards and precedence rules.
            </p>

            <div className="space-y-3 text-xs text-muted">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Timetable Protection:{" "}
                  </span>
                  Published academic courses are immutably reserved and cannot be preempted by ad-hoc bookings.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-foreground">
                    Exam Period Blackouts:{" "}
                  </span>
                  Scheduled examination windows automatically lock facilities for general use.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

