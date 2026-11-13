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
  Plus,
  Sparkles,
  MapPin,
  Users,
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
const REVIEWER_ROLES = Object.freeze(["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD", "FACULTY"]);

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
    if (typeof window !== "undefined") {
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (clientTz && typeof clientTz === "string" && (clientTz.includes("/") || clientTz === "UTC" || clientTz === "GMT")) {
        return clientTz;
      }
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
  const [scheduleTab, setScheduleTab] = useState("UPCOMING"); // "UPCOMING" | "TODAY"

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
        {/* ─── Page Header: Clean, Welcoming, Action-Focused ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {user?.name ? `Welcome back, ${user.name}` : "Welcome to CampusFlow"}
              </h1>
              {user?.roles?.[0] && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 border border-primary/20 text-primary-bright">
                  {formatRole(user.roles[0])}
                </span>
              )}
            </div>
            <p className="text-sm text-muted">
              Manage your bookings, explore campus facilities, and check live room availability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Date / Timezone Pill */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-2/60 border border-border/80 text-xs font-medium text-muted font-mono"
              title={`Institutional display timezone: ${timeZone}`}
              suppressHydrationWarning
            >
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span suppressHydrationWarning>{formatHeaderDate(new Date(), timeZone)}</span>
              <span suppressHydrationWarning className="px-1.5 py-0.5 rounded bg-surface border border-border/60 text-[10px] text-foreground font-semibold">
                {timeZone === "UTC" ? "UTC" : timeZone.split("/").pop().replace(/_/g, " ")}
              </span>
            </div>

            {/* Primary Action Buttons */}
            <Link href="/dashboard/calendar">
              <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />}>
                Book a Room
              </Button>
            </Link>

            <Link href="/dashboard/resources">
              <Button size="sm" variant="secondary" icon={<Building2 className="h-4 w-4" />}>
                All Facilities
              </Button>
            </Link>

            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || Object.values(sectionStatus).some((s) => s.isLoading)}
              aria-label="Refresh dashboard metrics"
              title="Refresh dashboard metrics"
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

        {/* ─── 4 Streamlined Stat Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Available Rooms */}
          <Link href="/dashboard/resources" className="block group">
            <Card className="h-full border-border/80 hover:border-emerald-500/40 transition-all p-4 flex flex-col justify-between shadow-sm group-hover:shadow-md bg-surface/90">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Available Rooms
                  </span>
                  <div className="text-2xl font-extrabold text-foreground mt-1">
                    {campusMetrics.available !== null ? (
                      <span className="text-emerald-400 font-mono">{campusMetrics.available}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border/40 mt-3">
                <span>Open for reservation</span>
                <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 2: My Bookings */}
          <Link href="/dashboard/bookings" className="block group">
            <Card className="h-full border-border/80 hover:border-primary/40 transition-all p-4 flex flex-col justify-between shadow-sm group-hover:shadow-md bg-surface/90">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    My Bookings
                  </span>
                  <div className="text-2xl font-extrabold text-foreground mt-1">
                    {sectionStatus.bookings.isLoading ? (
                      <Skeleton className="h-8 w-10" />
                    ) : (
                      <span className="text-primary-bright font-mono">{upcomingBookings.length}</span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary-bright shrink-0">
                  <CalendarCheck className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border/40 mt-3">
                <span>Active &amp; upcoming</span>
                <span className="text-primary group-hover:translate-x-0.5 transition-transform flex items-center">
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 3: Pending Approvals */}
          <Link
            href={isReviewer ? "/dashboard/approvals" : "/dashboard/bookings?status=PENDING"}
            className="block group"
          >
            <Card className="h-full border-border/80 hover:border-amber-500/40 transition-all p-4 flex flex-col justify-between shadow-sm group-hover:shadow-md bg-surface/90">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider truncate block">
                    {isReviewer ? "Pending Queue" : "Awaiting Review"}
                  </span>
                  <div className="text-2xl font-extrabold text-foreground mt-1">
                    {sectionStatus.approvals.isLoading || (sectionStatus.bookings.isLoading && !isReviewer) ? (
                      <Skeleton className="h-8 w-10" />
                    ) : (
                      <span className="text-amber-400 font-mono">{displayedPendingCount ?? 0}</span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border/40 mt-3">
                <span>{isReviewer ? "Faculty sign-offs" : "Pending sign-off"}</span>
                <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 4: Total Facilities */}
          <Link href="/dashboard/resources" className="block group">
            <Card className="h-full border-border/80 hover:border-indigo-500/40 transition-all p-4 flex flex-col justify-between shadow-sm group-hover:shadow-md bg-surface/90">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Campus Spaces
                  </span>
                  <div className="text-2xl font-extrabold text-foreground mt-1">
                    {sectionStatus.activeResources.isLoading ? (
                      <Skeleton className="h-8 w-10" />
                    ) : (
                      <span className="text-indigo-400 font-mono">
                        {activeResourcesTotal ?? campusMetrics.total ?? 6}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted pt-2 border-t border-border/40 mt-3">
                <span>Labs &amp; lecture halls</span>
                <span className="text-indigo-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </Link>
        </div>

        {/* ─── Integrated Interactive 3D Campus Explorer ─── */}
        <section aria-label="3D Campus Digital Twin" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Compass className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Interactive Campus Digital Twin
                </h2>
                <p className="text-xs text-muted">
                  Click any building to inspect room status, real-time availability, and book slots.
                </p>
              </div>
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
          {/* Left Column (8 cols): Unified Schedule & Reservations Hub */}
          <div className="xl:col-span-8 space-y-6">
            <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-6 shadow-md">
              {/* Header with Clean Tab Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary-bright">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      My Schedule &amp; Bookings
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Your upcoming confirmed reservations and class agenda.
                    </p>
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-surface-2/80 p-0.5 rounded-xl border border-border/60 text-xs">
                    <button
                      type="button"
                      onClick={() => setScheduleTab("UPCOMING")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        scheduleTab === "UPCOMING"
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Upcoming ({upcomingBookings.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleTab("TODAY")}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        scheduleTab === "TODAY"
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Today ({todayScheduleData.items.length})
                    </button>
                  </div>

                  <Link href="/dashboard/bookings">
                    <Button size="sm" variant="ghost" className="text-xs text-muted hover:text-foreground">
                      All ({userBookings.length}) <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Tab Content */}
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
                      <span>Unable to retrieve bookings: {sectionStatus.bookings.error}</span>
                    </div>
                    <Button size="sm" variant="secondary" onClick={handleRefresh}>
                      Retry
                    </Button>
                  </div>
                ) : scheduleTab === "UPCOMING" ? (
                  upcomingBookings.length > 0 ? (
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
                            className="p-4 rounded-xl bg-surface-2/60 border border-border/60 hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
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
                                href={`/dashboard/calendar?resourceId=${resObj?._id || (typeof b.resource === "object" ? b.resource?._id : b.resource)}&date=${b.startAt}`}
                              >
                                <Button size="sm" variant="secondary" className="text-xs">
                                  View on Calendar
                                </Button>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-xl bg-surface-2/30 border border-dashed border-border/80 flex flex-col items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-surface-2 flex items-center justify-center mb-3 text-muted border border-border">
                        <CalendarDays className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        No upcoming bookings
                      </h3>
                      <p className="text-xs text-muted max-w-sm mt-1 mb-5">
                        You have no upcoming sessions scheduled. Reserve a laboratory, lecture theater, or seminar room to get started.
                      </p>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link href="/dashboard/calendar">
                          <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />}>
                            Book a Room
                          </Button>
                        </Link>
                        <Link href="/dashboard/resources">
                          <Button size="sm" variant="secondary">
                            Browse Facilities
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                ) : (
                  todayScheduleData.items.length > 0 ? (
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
                                href={`/dashboard/calendar?resourceId=${resObj?._id || (typeof b.resource === "object" ? b.resource?._id : b.resource)}&date=${b.startAt}`}
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
                    <div className="p-8 text-center rounded-xl bg-surface-2/30 border border-dashed border-border/80 flex flex-col items-center justify-center">
                      <div className="h-12 w-12 rounded-full bg-surface-2 flex items-center justify-center mb-3 text-muted border border-border">
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        No sessions scheduled today
                      </h3>
                      <p className="text-xs text-muted max-w-sm mt-1 mb-5">
                        Your agenda is completely open today ({todayScheduleData.todayDateStr}). Need a quiet room to study or host a team session?
                      </p>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link href="/dashboard/calendar">
                          <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />}>
                            Book a Slot
                          </Button>
                        </Link>
                        <Link href="/dashboard/resources">
                          <Button size="sm" variant="secondary">
                            Browse Labs
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                )}
              </div>
            </Card>
          </div>

          {/* Right Column (4 cols): Quick Room Finder & Helpful Student Guidelines */}
          <div className="xl:col-span-4 space-y-6">
            {/* Quick Room Finder (Popular Facilities) */}
            <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-6 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-foreground">
                  Quick Room Finder
                </h2>
                <Link href="/dashboard/resources" className="text-xs text-primary hover:underline font-medium">
                  View All
                </Link>
              </div>
              <p className="text-xs text-muted mb-4">
                Fast 1-click booking for popular campus spaces.
              </p>

              <div className="space-y-3">
                {/* Facility 1 */}
                <div className="p-3 rounded-xl bg-surface-2/60 border border-border/60 hover:border-blue-500/40 transition-all flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        LAB-301
                      </span>
                      <span className="text-xs font-semibold text-foreground truncate">
                        AI &amp; Robotics Lab
                      </span>
                    </div>
                    <div className="text-[11px] text-muted flex items-center gap-2">
                      <span>Turing Center • Floor 3</span>
                      <span>&bull;</span>
                      <span>45 seats</span>
                    </div>
                  </div>
                  <Link href="/dashboard/calendar?resourceId=LAB-301">
                    <Button size="sm" variant="secondary" className="text-xs shrink-0">
                      Book
                    </Button>
                  </Link>
                </div>

                {/* Facility 2 */}
                <div className="p-3 rounded-xl bg-surface-2/60 border border-border/60 hover:border-purple-500/40 transition-all flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        LH-102
                      </span>
                      <span className="text-xs font-semibold text-foreground truncate">
                        Hopper Lecture Hall
                      </span>
                    </div>
                    <div className="text-[11px] text-muted flex items-center gap-2">
                      <span>Hopper Complex • Floor 1</span>
                      <span>&bull;</span>
                      <span>80 seats</span>
                    </div>
                  </div>
                  <Link href="/dashboard/calendar?resourceId=LH-102">
                    <Button size="sm" variant="secondary" className="text-xs shrink-0">
                      Book
                    </Button>
                  </Link>
                </div>

                {/* Facility 3 */}
                <div className="p-3 rounded-xl bg-surface-2/60 border border-border/60 hover:border-emerald-500/40 transition-all flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        SEM-204
                      </span>
                      <span className="text-xs font-semibold text-foreground truncate">
                        Executive Seminar Room
                      </span>
                    </div>
                    <div className="text-[11px] text-muted flex items-center gap-2">
                      <span>Innovation Center • Floor 2</span>
                      <span>&bull;</span>
                      <span>25 seats</span>
                    </div>
                  </div>
                  <Link href="/dashboard/calendar?resourceId=SEM-204">
                    <Button size="sm" variant="secondary" className="text-xs shrink-0">
                      Book
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            {/* Role-Appropriate Card: Approver Oversight (Reviewer) OR Helpful Tips (Student) */}
            {isReviewer ? (
              <Card className="border-border/80 bg-surface/90 backdrop-blur-sm p-6 shadow-md">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-5 w-5 text-purple-400" />
                  <h2 className="text-base font-bold text-foreground">
                    Approver Oversight
                  </h2>
                </div>
                <p className="text-xs text-muted mb-4">
                  Multi-tier reservation governance and student approval review.
                </p>

                <div className="p-3.5 rounded-xl bg-surface-2/50 border border-border/60 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Awaiting Your Action:</span>
                    <span className="font-bold text-amber-400">
                      {pendingApprovalsTotal !== null ? `${pendingApprovalsTotal} Requests` : "0 Requests"}
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
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-bold text-foreground">
                    Campus Booking Tips
                  </h2>
                </div>
                <p className="text-xs text-muted mb-4">
                  Important guidelines for students reserving university rooms.
                </p>

                <div className="space-y-3.5 text-xs text-muted">
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">15-Min QR Check-In: </span>
                      Check in at the room door within 15 minutes of start time to prevent auto-release.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Two-Step Approval: </span>
                      Student reservations are submitted to department faculty and admin for sign-off.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CalendarCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Free Cancellation: </span>
                      Plans change? Cancel your booking ahead of time so fellow students can use the room.
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
