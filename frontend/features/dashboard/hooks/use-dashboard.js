"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const REVIEWER_ROLES = Object.freeze([
  "ADMIN",
  "FACILITY_MANAGER",
  "DEPARTMENT_HEAD",
]);

const ANALYTICS_ROLES = Object.freeze([
  "ADMIN",
  "FACILITY_MANAGER",
  "DEPARTMENT_HEAD",
]);

const RULE_ADMIN_ROLES = Object.freeze(["ADMIN", "FACILITY_MANAGER"]);

export function resolveTimezone(user) {
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
    if (clientTz && (clientTz.includes("/") || clientTz === "UTC" || clientTz === "GMT")) {
      return clientTz;
    }
  } catch {
    // Intl timezone resolution unavailable
  }
  return "UTC";
}

export function formatHeaderDate(date = new Date(), timeZone = "UTC") {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(date);
}

export function formatTime(isoString, timeZone = "UTC") {
  try {
    const d = new Date(isoString);
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

export function formatDateInterval(startAt, endAt, timeZone = "UTC") {
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

    const sTime = formatTime(startAt, timeZone);
    const eTime = formatTime(endAt, timeZone);
    const tzLabel = timeZone === "UTC" ? "UTC" : `(${timeZone})`;

    return `${dateStr} • ${sTime} – ${eTime} ${tzLabel}`;
  } catch {
    return "Scheduled Interval";
  }
}

export function useDashboard() {
  const { user, activeRole } = useAuth();
  const timeZone = useMemo(() => resolveTimezone(user), [user]);

  const [rawBookings, setRawBookings] = useState([]);
  const [activeResourcesTotal, setActiveResourcesTotal] = useState(null);
  const [maintenanceResourcesTotal, setMaintenanceResourcesTotal] = useState(null);
  const [allResources, setAllResources] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState({ items: [], total: 0 });
  const [analyticsOverview, setAnalyticsOverview] = useState(null);
  const [availabilityRulesTotal, setAvailabilityRulesTotal] = useState(null);
  const [approvalPoliciesTotal, setApprovalPoliciesTotal] = useState(null);

  const [campusMetrics, setCampusMetrics] = useState({
    available: null,
    occupied: null,
    maintenance: null,
    total: null,
  });

  const [status, setStatus] = useState({
    bookings: { isLoading: true, error: null },
    resources: { isLoading: true, error: null },
    approvals: { isLoading: false, error: null },
    analytics: { isLoading: false, error: null },
    rules: { isLoading: false, error: null },
    policies: { isLoading: false, error: null },
  });

  const [lastFetchedAt, setLastFetchedAt] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);

  const requestIdRef = useRef(0);

  const isReviewer = useMemo(
    () => REVIEWER_ROLES.includes(activeRole),
    [activeRole]
  );
  const hasAnalyticsAccess = useMemo(
    () => ANALYTICS_ROLES.includes(activeRole),
    [activeRole]
  );
  const hasRuleAdminAccess = useMemo(
    () => RULE_ADMIN_ROLES.includes(activeRole),
    [activeRole]
  );

  const loadData = useCallback(async () => {
    const currentReqId = ++requestIdRef.current;

    setStatus({
      bookings: { isLoading: true, error: null },
      resources: { isLoading: true, error: null },
      approvals: { isLoading: isReviewer, error: null },
      analytics: { isLoading: hasAnalyticsAccess, error: null },
      rules: { isLoading: hasRuleAdminAccess, error: null },
      policies: { isLoading: isReviewer, error: null },
    });

    const bookingsPromise = api.bookings.list({ limit: 50 });
    const resourcesPromise = api.resources.list({ limit: 100 });
    const activeResPromise = api.resources.list({ status: "ACTIVE", limit: 1 });
    const maintResPromise = api.resources.list({ status: "MAINTENANCE", limit: 1 });

    const approvalsPromise = isReviewer
      ? api.approvals.getPending({ limit: 10 })
      : Promise.resolve(null);

    const analyticsPromise = hasAnalyticsAccess
      ? api.analytics.getOverview()
      : Promise.resolve(null);

    const rulesPromise = hasRuleAdminAccess
      ? api.availabilityRules.list({ limit: 1 })
      : Promise.resolve(null);

    const policiesPromise = isReviewer
      ? api.approvalPolicies.list({ limit: 1 })
      : Promise.resolve(null);

    const [
      bookingsRes,
      resourcesRes,
      activeRes,
      maintRes,
      approvalsRes,
      analyticsRes,
      rulesRes,
      policiesRes,
    ] = await Promise.allSettled([
      bookingsPromise,
      resourcesPromise,
      activeResPromise,
      maintResPromise,
      approvalsPromise,
      analyticsPromise,
      rulesPromise,
      policiesPromise,
    ]);

    if (currentReqId !== requestIdRef.current) return;

    // 1. User Bookings
    if (bookingsRes.status === "fulfilled") {
      const list = bookingsRes.value?.bookings || bookingsRes.value?.items || [];
      setRawBookings(list);
      setStatus((s) => ({ ...s, bookings: { isLoading: false, error: null } }));
    } else {
      setRawBookings([]);
      setStatus((s) => ({
        ...s,
        bookings: {
          isLoading: false,
          error: bookingsRes.reason?.message || "Failed to load bookings",
        },
      }));
    }

    // 2. Resources Catalogue
    if (resourcesRes.status === "fulfilled") {
      setAllResources(resourcesRes.value?.resources || []);
    } else {
      setAllResources([]);
    }

    // 3. Active / Maintenance Counts
    if (activeRes.status === "fulfilled") {
      setActiveResourcesTotal(
        typeof activeRes.value?.total === "number" ? activeRes.value.total : 0
      );
    }
    if (maintRes.status === "fulfilled") {
      setMaintenanceResourcesTotal(
        typeof maintRes.value?.total === "number" ? maintRes.value.total : 0
      );
    }
    setStatus((s) => ({ ...s, resources: { isLoading: false, error: null } }));

    // 4. Pending Approvals
    if (isReviewer) {
      if (approvalsRes.status === "fulfilled") {
        setPendingApprovals({
          items: approvalsRes.value?.items || [],
          total: approvalsRes.value?.total || 0,
        });
        setStatus((s) => ({ ...s, approvals: { isLoading: false, error: null } }));
      } else {
        setPendingApprovals({ items: [], total: 0 });
        setStatus((s) => ({
          ...s,
          approvals: {
            isLoading: false,
            error: approvalsRes.reason?.message || "Failed to load approval queue",
          },
        }));
      }
    }

    // 5. Analytics
    if (hasAnalyticsAccess) {
      if (analyticsRes.status === "fulfilled") {
        setAnalyticsOverview(analyticsRes.value);
        setStatus((s) => ({ ...s, analytics: { isLoading: false, error: null } }));
      } else {
        setAnalyticsOverview(null);
        setStatus((s) => ({
          ...s,
          analytics: {
            isLoading: false,
            error: analyticsRes.reason?.message || "Failed to load analytics",
          },
        }));
      }
    }

    // 6. Availability Rules
    if (hasRuleAdminAccess) {
      if (rulesRes.status === "fulfilled") {
        setAvailabilityRulesTotal(rulesRes.value?.total ?? (rulesRes.value?.rules?.length || 0));
        setStatus((s) => ({ ...s, rules: { isLoading: false, error: null } }));
      } else {
        setStatus((s) => ({ ...s, rules: { isLoading: false, error: null } }));
      }
    }

    // 7. Approval Policies
    if (isReviewer) {
      if (policiesRes.status === "fulfilled") {
        setApprovalPoliciesTotal(policiesRes.value?.total ?? (policiesRes.value?.policies?.length || 0));
        setStatus((s) => ({ ...s, policies: { isLoading: false, error: null } }));
      } else {
        setStatus((s) => ({ ...s, policies: { isLoading: false, error: null } }));
      }
    }

    setLastFetchedAt(Date.now());
    setIsRefreshing(false);
  }, [isReviewer, hasAnalyticsAccess, hasRuleAdminAccess]);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        loadData();
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [loadData]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setWorkspaceRefreshKey((k) => k + 1);
    loadData();
  }, [loadData]);

  // User-specific deduped bookings
  const userBookings = useMemo(() => {
    const map = new Map();
    for (const b of rawBookings) {
      const id = b._id || b.id;
      if (id && !map.has(id)) {
        map.set(id, b);
      }
    }
    const deduped = Array.from(map.values());
    if (user?.id) {
      return deduped.filter((b) => {
        const bUserId =
          b.user?._id || b.user?.id || (typeof b.user === "string" ? b.user : null);
        return !bUserId || bUserId === user.id;
      });
    }
    return deduped;
  }, [rawBookings, user]);

  // Today's schedule in authoritative timezone
  const todaySchedule = useMemo(() => {
    const now = new Date(lastFetchedAt);
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now); // YYYY-MM-DD

    return userBookings
      .filter((b) => {
        if (!["CONFIRMED", "PENDING", "CHECKED_IN"].includes(b.status)) return false;
        const s = new Date(b.startAt);
        if (isNaN(s.getTime())) return false;
        const bDateStr = new Intl.DateTimeFormat("en-CA", { timeZone }).format(s);
        return bDateStr === todayStr;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [userBookings, timeZone, lastFetchedAt]);

  // Upcoming active reservations
  const upcomingBookings = useMemo(() => {
    const nowMs = lastFetchedAt;
    return userBookings
      .filter((b) => {
        if (!["CONFIRMED", "PENDING", "CHECKED_IN"].includes(b.status)) return false;
        const endMs = new Date(b.endAt).getTime();
        return !isNaN(endMs) && endMs > nowMs;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [userBookings, lastFetchedAt]);

  return {
    user,
    activeRole,
    timeZone,
    bookings: userBookings,
    todaySchedule,
    upcomingBookings,
    allResources,
    activeResourcesTotal,
    maintenanceResourcesTotal,
    pendingApprovals,
    analyticsOverview,
    availabilityRulesTotal,
    approvalPoliciesTotal,
    campusMetrics,
    setCampusMetrics,
    workspaceRefreshKey,
    status,
    isRefreshing,
    refresh,
    lastFetchedAt,
  };
}

