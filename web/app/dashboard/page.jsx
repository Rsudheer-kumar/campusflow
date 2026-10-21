"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Clock,
  Compass,
  RefreshCw,
  ShieldCheck,
  Wrench,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Settings,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Card, Badge, Button, Skeleton } from "@/components/ui";
import { CampusWorkspace } from "@/components/campus/campus-workspace";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Valid active reservation states under the authoritative CampusFlow finite-state machine.
 * Terminal states (COMPLETED, CANCELLED, REJECTED, EXPIRED, NO_SHOW) are excluded from upcoming active agendas.
 */
const ACTIVE_RESERVATION_STATES = Object.freeze(["CONFIRMED", "PENDING", "CHECKED_IN"]);

/**
 * Roles permitted to access the multi-tier pending approvals queue (/api/approvals/pending).
 */
const REVIEWER_ROLES = Object.freeze(["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD"]);

/**
 * Resolves the institutional or user display timezone.
 * Priority:
 * 1. Explicit user preferences (user.preferences.timezone)
 * 2. Institutional default via environment (NEXT_PUBLIC_DEFAULT_TIMEZONE)
 * 3. Client browser runtime environment (Intl.DateTimeFormat)
 * 4. Authoritative fallback ("UTC")
 */
function resolveInstitutionalTimezone(user) {
  if (user?.preferences?.timezone && typeof user.preferences.timezone === "string") {
    return user.preferences.timezone.trim();
  }
  if (
    typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_DEFAULT_TIMEZONE &&
    typeof process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE === "string"
  ) {
    return process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE.trim();
  }
  try {
    const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (clientTz && typeof clientTz === "string" && (clientTz.includes("/") || clientTz === "UTC" || clientTz === "GMT")) {
      return clientTz;
    }
  } catch {
    // Intl timezone resolution unavailable
  }
  return "UTC";
}

/**
 * Extracts zoned calendar date and clock parts in a specified IANA timezone.
 */
function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const find = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(find("year")),
    month: Number(find("month")),
    day: Number(find("day")),
    hour: Number(find("hour") === "24" ? 0 : find("hour")),
    minute: Number(find("minute")),
    second: Number(find("second")),
  };
}

/**
 * Converts a local calendar date string (YYYY-MM-DD) and a local 24-hr time string (00:00 - 24:00)
 * in an authoritative IANA timezone into an exact UTC Date instance, with two-pass DST verification.
 */
function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const [origYear, origMonth, origDay] = dateStr.split("-").map(Number);
  let year = origYear;
  let month = origMonth;
  let day = origDay;

  let hours;
  let minutes;

  if (timeStr === "24:00") {
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
    year = nextDay.getUTCFullYear();
    month = nextDay.getUTCMonth() + 1;
    day = nextDay.getUTCDate();
    hours = 0;
    minutes = 0;
  } else {
    const [h, m] = timeStr.split(":").map(Number);
    hours = h;
    minutes = m;
  }

  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  const parts = getZonedParts(guess, timeZone);
  const diff =
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) -
    Date.UTC(year, month - 1, day, hours, minutes);
  const result = new Date(guess.getTime() - diff);

  const verifyParts = getZonedParts(result, timeZone);
  const verifyDiff =
    Date.UTC(verifyParts.year, verifyParts.month - 1, verifyParts.day, verifyParts.hour, verifyParts.minute) -
    Date.UTC(year, month - 1, day, hours, minutes);

  return new Date(result.getTime() - verifyDiff);
}

/**
 * Computes the start [00:00) and end [24:00) exact UTC boundaries for "Today"
 * in the specified authoritative timezone.
 */
function getTodayBoundsInTimezone(now = new Date(), timeZone = "UTC") {
  const parts = getZonedParts(now, timeZone);
  const dateStr = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const startInstant = zonedTimeToUtc(dateStr, "00:00", timeZone);
  const endInstant = zonedTimeToUtc(dateStr, "24:00", timeZone);
  return { dateStr, startInstant, endInstant };
}

function formatRole(role) {
  const map = {
    STUDENT: "Student",
    FACULTY: "Faculty Member",
    ADMIN: "System Administrator",
    FACILITY_MANAGER: "Facility Manager",
    DEPARTMENT_HEAD: "Department Head",
    DEAN: "Academic Dean",
    STAFF: "Campus Staff",
    CUSTODIAN: "Facility Custodian",
  };
  return map[role] || role;
}

function formatHeaderDate(date = new Date(), timeZone = "UTC") {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(date);
}

function formatBookingInterval(startAt, endAt, timeZone = "UTC") {
  try {
    const s = new Date(startAt);
    const e = new Date(endAt);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return "Scheduled Interval";

    const dateStr = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone,
    }).format(s);

    const sTime = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(s);

    const eTime = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(e);

    const tzShort = timeZone === "UTC" ? "UTC" : `(${timeZone})`;
    return `${dateStr} • ${sTime} – ${eTime} ${tzShort}`;
  } catch {
    return "Scheduled Interval";
  }
}

function formatTimeOnly(date, timeZone = "UTC") {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "--:--";
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(d);
  } catch {
    return "--:--";
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const timeZone = useMemo(() => resolveInstitutionalTimezone(user), [user]);

  // Section Data State
  const [rawBookings, setRawBookings] = useState([]);
  const [activeResourcesTotal, setActiveResourcesTotal] = useState(null);
  const [maintenanceResourcesTotal, setMaintenanceResourcesTotal] = useState(null);
  const [pendingApprovalsTotal, setPendingApprovalsTotal] = useState(null);
  const [campusMetrics, setCampusMetrics] = useState({
    available: null,
    occupied: null,
    maintenance: null,
    unknown: null,
    total: null,
  });
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);

  // Independent Section Loading & Error State
  const [sectionStatus, setSectionStatus] = useState({
    bookings: { isLoading: true, error: null },
    activeResources: { isLoading: true, error: null },
    maintenanceResources: { isLoading: true, error: null },
    approvals: { isLoading: true, error: null },
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestIdRef = useRef(0);

  const isReviewer = useMemo(() => {
    return user?.roles?.some((r) => REVIEWER_ROLES.includes(r));
  }, [user]);

  const [lastFetchedAt, setLastFetchedAt] = useState(() => Date.now());

  // Load Dashboard Data with Promise.allSettled for isolated error handling
  const loadDashboardData = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    // Reset error states while loading
    setSectionStatus((prev) => ({
      bookings: { isLoading: true, error: null },
      activeResources: { isLoading: true, error: null },
      maintenanceResources: { isLoading: true, error: null },
      approvals: { isLoading: true, error: null },
    }));

    // Build concurrent promises using existing authorized API client methods
    const bookingsPromise = api.bookings.list({ limit: 50 });
    const activeResPromise = api.resources.list({ status: "ACTIVE", limit: 1 });
    const maintResPromise = api.resources.list({ status: "MAINTENANCE", limit: 1 });

    // Reviewers query the institution/department approval queue; non-reviewers skip to avoid 403 Forbidden
    const approvalsPromise = isReviewer
      ? api.approvals.getPending({ limit: 1 })
      : Promise.resolve(null);

    const [bookingsResult, activeResult, maintResult, approvalsResult] =
      await Promise.allSettled([
        bookingsPromise,
        activeResPromise,
        maintResPromise,
        approvalsPromise,
      ]);

    // Ignore if a newer request was dispatched or component unmounted
    if (currentRequestId !== requestIdRef.current) return;

    // 1. Process Bookings
    if (bookingsResult.status === "fulfilled") {
      const list = bookingsResult.value?.bookings || bookingsResult.value?.items || [];
      setRawBookings(list);
      setSectionStatus((prev) => ({
        ...prev,
        bookings: { isLoading: false, error: null },
      }));
    } else {
      const errMsg =
        bookingsResult.reason?.message || "Failed to load reservations";
      setRawBookings([]);
      setSectionStatus((prev) => ({
        ...prev,
        bookings: { isLoading: false, error: errMsg },
      }));
    }

    // 2. Process Operational Facilities
    if (activeResult.status === "fulfilled") {
      const total =
        typeof activeResult.value?.total === "number" ? activeResult.value.total : 0;
      setActiveResourcesTotal(total);
      setSectionStatus((prev) => ({
        ...prev,
        activeResources: { isLoading: false, error: null },
      }));
    } else {
      const errMsg =
        activeResult.reason?.message || "Failed to load operational catalogue count";
      setActiveResourcesTotal(null);
      setSectionStatus((prev) => ({
        ...prev,
        activeResources: { isLoading: false, error: errMsg },
      }));
    }

    // 3. Process Maintenance Facilities
    if (maintResult.status === "fulfilled") {
      const total =
        typeof maintResult.value?.total === "number" ? maintResult.value.total : 0;
      setMaintenanceResourcesTotal(total);
      setSectionStatus((prev) => ({
        ...prev,
        maintenanceResources: { isLoading: false, error: null },
      }));
    } else {
      const errMsg =
        maintResult.reason?.message || "Failed to load maintenance records count";
      setMaintenanceResourcesTotal(null);
      setSectionStatus((prev) => ({
        ...prev,
        maintenanceResources: { isLoading: false, error: errMsg },
      }));
    }

    // 4. Process Approvals
    if (isReviewer) {
      if (approvalsResult.status === "fulfilled") {
        const total =
          typeof approvalsResult.value?.total === "number"
            ? approvalsResult.value.total
            : 0;
        setPendingApprovalsTotal(total);
        setSectionStatus((prev) => ({
          ...prev,
          approvals: { isLoading: false, error: null },
        }));
      } else {
        const errMsg =
          approvalsResult.reason?.message || "Failed to load pending approvals queue";
        setPendingApprovalsTotal(null);
        setSectionStatus((prev) => ({
          ...prev,
          approvals: { isLoading: false, error: errMsg },
        }));
      }
    } else {
      // Non-reviewer: marked complete; count is derived below from user's own bookings
      setSectionStatus((prev) => ({
        ...prev,
        approvals: { isLoading: false, error: null },
      }));
    }

    setLastFetchedAt(Date.now());
    setIsRefreshing(false);
  }, [isReviewer]);

  // Initial load with cleanup to prevent cascading render warnings in React 19
  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        loadDashboardData();
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [loadDashboardData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setWorkspaceRefreshKey((k) => k + 1);
    loadDashboardData();
  };

  // Deduplicate bookings by ID and enforce user ownership filter
  const userBookings = useMemo(() => {
    const map = new Map();
    for (const b of rawBookings) {
      const id = b._id || b.id;
      if (id && !map.has(id)) {
        map.set(id, b);
      }
    }
    const deduped = Array.from(map.values());

    // If user identity is known, ensure we only present the authenticated user's own bookings
    // (This guarantees that even if a privileged account receives multi-user lists, the dashboard displays personal schedule)
    if (user?.id) {
      return deduped.filter((b) => {
        const bUserId =
          b.user?._id || b.user?.id || (typeof b.user === "string" ? b.user : null);
        return !bUserId || bUserId === user.id;
      });
    }
    return deduped;
  }, [rawBookings, user]);

  // Calculate Today's Schedule using exact IANA timezone boundaries & half-open interval overlap
  const todayScheduleData = useMemo(() => {
    const refDate = new Date(lastFetchedAt);
    const bounds = getTodayBoundsInTimezone(refDate, timeZone);
    const startMs = bounds.startInstant.getTime();
    const endMs = bounds.endInstant.getTime();

    const filtered = userBookings
      .filter((b) => {
        if (!ACTIVE_RESERVATION_STATES.includes(b.status)) return false;
        const bStartMs = new Date(b.startAt).getTime();
        const bEndMs = new Date(b.endAt).getTime();
        if (isNaN(bStartMs) || isNaN(bEndMs)) return false;

        // Half-open interval overlap calculus: [bStart, bEnd) overlaps [startMs, endMs)
        return bStartMs < endMs && bEndMs > startMs;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    return {
      todayDateStr: bounds.dateStr,
      items: filtered,
    };
  }, [userBookings, timeZone, lastFetchedAt]);

  // Filter Upcoming Reservations (future ending, active lifecycle status, sorted chronologically ascending)
  const upcomingBookings = useMemo(() => {
    const nowMs = lastFetchedAt;
    return userBookings
      .filter((b) => {
        if (!ACTIVE_RESERVATION_STATES.includes(b.status)) return false;
        const bStartMs = new Date(b.startAt).getTime();
        const bEndMs = new Date(b.endAt).getTime();
        if (isNaN(bStartMs) || isNaN(bEndMs)) return false;
        return bEndMs > nowMs;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [userBookings, lastFetchedAt]);

  // Derive pending count for standard users from their own verified bookings
  const displayedPendingCount = useMemo(() => {
    if (isReviewer) {
      return pendingApprovalsTotal;
    }
    if (sectionStatus.bookings.error) {
      return null;
    }
    return userBookings.filter((b) => b.status === "PENDING").length;
  }, [isReviewer, pendingApprovalsTotal, userBookings, sectionStatus.bookings.error]);

  // Partial failure detection: check if any section failed while at least one succeeded
  const partialFailures = useMemo(() => {
    const errors = [];
    if (sectionStatus.bookings.error) {
      errors.push({ section: "User Bookings", message: sectionStatus.bookings.error });
    }
    if (sectionStatus.activeResources.error) {
      errors.push({ section: "Active Facilities", message: sectionStatus.activeResources.error });
    }
    if (sectionStatus.maintenanceResources.error) {
      errors.push({ section: "Maintenance Records", message: sectionStatus.maintenanceResources.error });
    }
    if (isReviewer && sectionStatus.approvals.error) {
      errors.push({ section: "Approvals Queue", message: sectionStatus.approvals.error });
    }
    return errors;
  }, [sectionStatus, isReviewer]);

  return (
    <div className="min-h-full py-6 sm:py-8 grid-background">
      <PageContainer className="space-y-6 max-w-[1600px] mx-auto">
        {/* ─── Page Header ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {user?.name ? `Welcome back, ${user.name}` : "Welcome to CampusFlow"}
              </h1>
              {user?.roles?.[0] && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 border border-primary/20 text-primary-bright">
                  {formatRole(user.roles[0])}
                </span>
              )}
            </div>
            <p className="text-sm text-muted">
              Unified resource booking, academic timetable coordination, and facility governance overview.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date & Timezone Badge */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs text-muted font-mono"
              title={`Institutional display timezone: ${timeZone}`}
            >
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span>{formatHeaderDate(new Date(), timeZone)}</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-foreground font-semibold">
                {timeZone === "UTC" ? "UTC" : timeZone}
              </span>
            </div>

            {/* Quick Action Navigation Buttons */}
            <Link href="/dashboard/resources">
              <Button size="sm" variant="secondary" icon={<Building2 className="h-4 w-4" />}>
                Facilities
              </Button>
            </Link>

            <Link href="/dashboard/calendar">
              <Button size="sm" variant="secondary" icon={<CalendarDays className="h-4 w-4" />}>
                Calendar
              </Button>
            </Link>

            <Link href="/dashboard/campus-map">
              <Button size="sm" variant="primary" icon={<Compass className="h-4 w-4" />}>
                Campus Map
              </Button>
            </Link>

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || Object.values(sectionStatus).some((s) => s.isLoading)}
              aria-label="Refresh dashboard metrics"
              title="Refresh dashboard metrics from live API"
              className="p-2 rounded-xl bg-surface hover:bg-surface-2 text-muted hover:text-foreground border border-border transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>

        {/* ─── Partial Failure / Connectivity Alert ─── */}
        {partialFailures.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Partial Connectivity Notice: Some dashboard metrics could not be loaded</span>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="underline hover:text-white font-medium"
              >
                Retry All
              </button>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-300/90 pl-1">
              {partialFailures.map((pf) => (
                <li key={pf.section}>
                  <span className="font-semibold text-amber-200">{pf.section}:</span> {pf.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ─── Compact Campus Operations Summary Ribbon (Section 3.C) ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Metric 1: Available Now (Evaluated Window) */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                  Available Now
                </span>
                <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {campusMetrics.available !== null ? (
                    <span className="text-emerald-400 font-mono">{campusMetrics.available}</span>
                  ) : (
                    <span className="text-muted text-lg">—</span>
                  )}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-[10px] text-muted pt-2 border-t border-border/40 mt-2 truncate">
              Evaluated Window
            </div>
          </Card>

          {/* Metric 2: Occupied Facilities (Evaluated Window) */}
          <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-4 flex flex-col justify-between shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                  Occupied
                </span>
                <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {campusMetrics.occupied !== null ? (
                    <span className="text-amber-400 font-mono">{campusMetrics.occupied}</span>
                  ) : (
                    <span className="text-muted text-lg">—</span>
                  )}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-[10px] text-muted pt-2 border-t border-border/40 mt-2 truncate">
              In-Session / Booked
            </div>
          </Card>

          {/* Metric 3: Active Facilities */}
          <Link href="/dashboard/resources" className="block group">
            <Card className="h-full border-border/80 hover:border-blue-500/40 transition-all p-4 flex flex-col justify-between shadow-sm group-hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                    Campus Facilities
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                    {sectionStatus.activeResources.isLoading ? (
                      <Skeleton className="h-7 w-10" />
                    ) : activeResourcesTotal !== null ? (
                      <span className="text-blue-400 font-mono">{activeResourcesTotal}</span>
                    ) : campusMetrics.total !== null ? (
                      <span className="text-blue-400 font-mono">{campusMetrics.total}</span>
                    ) : (
                      <span className="text-muted text-lg">—</span>
                    )}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-border/40 mt-2">
                <span>Active Catalogue</span>
                <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                  <ArrowRight className="h-2.5 w-2.5" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Metric 4: Under Maintenance */}
          <Link href="/dashboard/resources?status=MAINTENANCE" className="block group">
            <Card className="h-full border-border/80 hover:border-purple-500/40 transition-all p-4 flex flex-col justify-between shadow-sm group-hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                    Maintenance
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                    {sectionStatus.maintenanceResources.isLoading ? (
                      <Skeleton className="h-7 w-10" />
                    ) : maintenanceResourcesTotal !== null ? (
                      <span className="text-purple-400 font-mono">{maintenanceResourcesTotal}</span>
                    ) : campusMetrics.maintenance !== null ? (
                      <span className="text-purple-400 font-mono">{campusMetrics.maintenance}</span>
                    ) : (
                      <span className="text-muted text-lg">—</span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
                  <Wrench className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-border/40 mt-2">
                <span>Service Lock</span>
                <span className="text-purple-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                  <ArrowRight className="h-2.5 w-2.5" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Metric 5: My Bookings */}
          <Link href="/dashboard/bookings" className="block group">
            <Card className="h-full border-border/80 hover:border-primary/40 transition-all p-4 flex flex-col justify-between shadow-sm group-hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                    My Bookings
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                    {sectionStatus.bookings.isLoading ? (
                      <Skeleton className="h-7 w-10" />
                    ) : sectionStatus.bookings.error ? (
                      <span className="text-muted text-lg flex items-center gap-1">
                        — <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      </span>
                    ) : (
                      <span className="text-primary-bright font-mono">{upcomingBookings.length}</span>
                    )}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary-bright shrink-0">
                  <CalendarCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-border/40 mt-2">
                <span>Upcoming</span>
                <span className="text-primary group-hover:translate-x-0.5 transition-transform flex items-center">
                  <ArrowRight className="h-2.5 w-2.5" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Metric 6: Approvals / Review */}
          <Link
            href={isReviewer ? "/dashboard/approvals" : "/dashboard/bookings?status=PENDING"}
            className="block group"
          >
            <Card className="h-full border-border/80 hover:border-amber-500/40 transition-all p-4 flex flex-col justify-between shadow-sm group-hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider truncate block">
                    {isReviewer ? "Pending Queue" : "Awaiting Review"}
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                    {sectionStatus.approvals.isLoading || (sectionStatus.bookings.isLoading && !isReviewer) ? (
                      <Skeleton className="h-7 w-10" />
                    ) : displayedPendingCount !== null ? (
                      <span className="text-amber-400 font-mono">{displayedPendingCount}</span>
                    ) : (
                      <span className="text-muted text-lg">—</span>
                    )}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-border/40 mt-2">
                <span>{isReviewer ? "Sign-offs" : "Pending"}</span>
                <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                  <ArrowRight className="h-2.5 w-2.5" />
                </span>
              </div>
            </Card>
          </Link>
        </div>

        {/* ─── Integrated Interactive 3D Campus Operations Centerpiece (Section 3.B) ─── */}
        <section aria-label="3D Campus Digital Twin Operations Workspace" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                3D Campus Operations Workspace
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

        {/* ─── Main Two-Column Layout ─── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Today's Schedule & Upcoming Bookings */}
          <div className="xl:col-span-8 space-y-6">
            {/* Section 1: Today's Schedule */}
            <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-6 shadow-md">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      Today&apos;s Schedule &amp; Agenda
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Your scheduled sessions for today ({todayScheduleData.todayDateStr} • {timeZone}).
                    </p>
                  </div>
                </div>

                <Link href="/dashboard/calendar">
                  <Button size="sm" variant="secondary" icon={<Calendar className="h-4 w-4" />}>
                    Open Calendar
                  </Button>
                </Link>
              </div>

              {/* Today's Content */}
              <div className="pt-4">
                {sectionStatus.bookings.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                ) : sectionStatus.bookings.error ? (
                  <div className="p-6 rounded-xl bg-danger/10 border border-danger/30 text-danger flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <span>Unable to retrieve today&apos;s agenda: {sectionStatus.bookings.error}</span>
                    </div>
                    <Button size="sm" variant="secondary" onClick={handleRefresh}>
                      Retry
                    </Button>
                  </div>
                ) : todayScheduleData.items.length > 0 ? (
                  <div className="space-y-3">
                    {todayScheduleData.items.map((b) => {
                      const resObj = typeof b.resource === "object" && b.resource ? b.resource : null;
                      const resName = resObj?.name || "Campus Facility";
                      const resCode = resObj?.code || "RES";
                      const building = resObj?.location?.building || "Campus";
                      const sTime = formatTimeOnly(b.startAt, timeZone);
                      const eTime = formatTimeOnly(b.endAt, timeZone);

                      return (
                        <div
                          key={b._id || b.id}
                          className="p-4 rounded-xl bg-surface-2/60 border border-border/60 hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
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
                              <span>{sTime} – {eTime} ({timeZone})</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
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
                            <Link
                              href={`/dashboard/calendar?resourceId=${resObj?._id || b.resource}&startAt=${b.startAt}&endAt=${b.endAt}`}
                            >
                              <Button size="sm" variant="secondary" className="text-xs">
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
                          No Sessions Scheduled for Today
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                          You have no active facility bookings or reservations on your personal agenda today.
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
                          Book Slot
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Section 2: Upcoming Bookings & Scheduled Sessions */}
            <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-6 shadow-md">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary-bright">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      Upcoming Reservations
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Your scheduled campus bookings and active reservation requests.
                    </p>
                  </div>
                </div>

                <Link href="/dashboard/bookings">
                  <Button size="sm" variant="secondary">
                    All Reservations ({userBookings.length})
                  </Button>
                </Link>
              </div>

              {/* Feed Content */}
              <div className="pt-4">
                {sectionStatus.bookings.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                  </div>
                ) : sectionStatus.bookings.error ? (
                  <div className="p-6 rounded-xl bg-danger/10 border border-danger/30 text-danger flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <span>Unable to retrieve reservations: {sectionStatus.bookings.error}</span>
                    </div>
                    <Button size="sm" variant="secondary" onClick={handleRefresh}>
                      Retry
                    </Button>
                  </div>
                ) : upcomingBookings.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingBookings.slice(0, 5).map((b) => {
                      const resObj = typeof b.resource === "object" && b.resource ? b.resource : null;
                      const resName = resObj?.name || "Campus Facility";
                      const resCode = resObj?.code || "RES";
                      const building = resObj?.location?.building || "University Campus";
                      const intervalStr = formatBookingInterval(b.startAt, b.endAt, timeZone);

                      return (
                        <div
                          key={b._id || b.id}
                          className="p-4 rounded-xl bg-surface-2/60 border border-border/60 hover:border-border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5">
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

                            <div className="text-sm font-semibold text-foreground">
                              {b.title}
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
                              <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{intervalStr}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
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

                            <Link
                              href={`/dashboard/calendar?resourceId=${resObj?._id || b.resource}&startAt=${b.startAt}&endAt=${b.endAt}`}
                            >
                              <Button size="sm" variant="secondary" className="text-xs">
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
                    <div className="h-12 w-12 rounded-full bg-surface-2 flex items-center justify-center mb-3 text-muted border border-border">
                      <CalendarDays className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      No Upcoming Reservations
                    </h3>
                    <p className="text-xs text-muted max-w-sm mt-1 mb-4">
                      You currently have no active or pending facility bookings. Browse available labs and lecture halls to reserve a slot.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href="/dashboard/resources">
                        <Button size="sm" variant="secondary">
                          Browse Catalogue
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
          </div>

          {/* Right Column (4 cols): Quick Access Shortcuts & Role Summaries */}
          <div className="xl:col-span-4 space-y-6">
            {/* Quick Access Shortcuts */}
            <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-6 shadow-md">
              <h2 className="text-base font-bold text-foreground mb-1">
                Quick Actions
              </h2>
              <p className="text-xs text-muted mb-4">
                Direct shortcuts to verified platform modules.
              </p>

              <div className="space-y-2.5">
                <Link
                  href="/dashboard/calendar"
                  className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-indigo-500/30 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground group-hover:text-indigo-400 transition-colors">
                        Master Calendar
                      </div>
                      <div className="text-[11px] text-muted">
                        Interactive schedule &amp; slot booking
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
                      <div className="text-sm font-medium text-foreground group-hover:text-emerald-400 transition-colors">
                        Facility Catalogue
                      </div>
                      <div className="text-[11px] text-muted">
                        Browse lecture halls &amp; labs
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </Link>

                <Link
                  href="/dashboard/bookings"
                  className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-amber-500/30 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <CalendarCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground group-hover:text-amber-400 transition-colors">
                        My Bookings
                      </div>
                      <div className="text-[11px] text-muted">
                        Manage reservations &amp; check-in
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
                      <div className="text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors">
                        Campus Map
                      </div>
                      <div className="text-[11px] text-muted">
                        Spatial twin &amp; availability explorer
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </Link>

                {isReviewer && (
                  <Link
                    href="/dashboard/approvals"
                    className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-purple-500/30 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground group-hover:text-purple-400 transition-colors">
                          Approval Queue
                        </div>
                        <div className="text-[11px] text-muted">
                          Multi-tier sign-off review
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </Link>
                )}

                <Link
                  href="/dashboard/settings"
                  className="p-3 rounded-xl bg-surface-2/50 hover:bg-surface-2 border border-border/60 hover:border-slate-500/30 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      <Settings className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground group-hover:text-slate-300 transition-colors">
                        Settings
                      </div>
                      <div className="text-[11px] text-muted">
                        Preferences &amp; profile
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </Link>
              </div>
            </Card>

            {/* Role-Appropriate Operational Summary Card */}
            {isReviewer ? (
              <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-6 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-5 w-5 text-purple-400" />
                  <h2 className="text-base font-bold text-foreground">
                    Approver Oversight
                  </h2>
                </div>
                <p className="text-xs text-muted mb-4">
                  Multi-tier reservation governance and institutional compliance overview.
                </p>

                <div className="p-3.5 rounded-xl bg-surface-2/50 border border-border/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Awaiting Your Action:</span>
                    <span className="font-bold text-amber-400">
                      {sectionStatus.approvals.isLoading ? (
                        <Skeleton className="h-4 w-8 inline-block" />
                      ) : pendingApprovalsTotal !== null ? (
                        `${pendingApprovalsTotal} Requests`
                      ) : (
                        <span className="text-muted flex items-center gap-1">
                          — <AlertTriangle className="h-3 w-3 text-amber-400" />
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Facility Service Lock:</span>
                    <span className="font-bold text-purple-400">
                      {sectionStatus.maintenanceResources.isLoading ? (
                        <Skeleton className="h-4 w-8 inline-block" />
                      ) : maintenanceResourcesTotal !== null ? (
                        `${maintenanceResourcesTotal} Facilities`
                      ) : (
                        <span className="text-muted flex items-center gap-1">
                          — <AlertTriangle className="h-3 w-3 text-amber-400" />
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <Link
                      href="/dashboard/approvals"
                      className="text-primary hover:underline font-medium text-xs flex items-center gap-1"
                    >
                      Open Approval Queue <ArrowRight className="h-3 w-3" />
                    </Link>
                    <Link
                      href="/dashboard/approval-policies"
                      className="text-muted hover:text-foreground text-xs"
                    >
                      Policies
                    </Link>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-6 shadow-md">
                <h2 className="text-base font-bold text-foreground mb-1">
                  Booking Guidelines
                </h2>
                <p className="text-xs text-muted mb-4">
                  Campus scheduling policies enforced automatically by CampusFlow.
                </p>

                <div className="space-y-3.5 text-xs text-muted">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Conflict Serialization: </span>
                      Slots are atomically locked during reservation to prevent collision.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Timetable Precedence: </span>
                      Academic course schedules take priority over ad-hoc user requests.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Autonomous Release: </span>
                      Unclaimed confirmed slots are automatically vacated after the 15-minute grace window.
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
