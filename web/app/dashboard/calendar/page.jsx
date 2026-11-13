"use client";
import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock,
  CalendarCheck,
  Clock,
  Building2,
  Users,
  RefreshCw,
  Eye,
  Wrench,
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout";
import { Card, Badge, Button, Select, Skeleton, EmptyState, ErrorState, Modal } from "@/components/ui";
import { BookingModal } from "@/components/calendar/booking-modal";
import { TimetableDetailModal } from "@/components/calendar/timetable-detail-modal";
import { BookingDetailModal } from "@/components/calendar/booking-detail-modal";
import { CheckInModal } from "@/components/bookings/check-in-modal";
import { HolidayNoticeModal } from "@/components/calendar/holiday-notice-modal";
import { DeclareHolidayModal } from "@/components/calendar/declare-holiday-modal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, resolveReservationTimezone, localToUtc } from "@/lib/utils";

function CalendarView() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("ADMIN") || user?.role === "ADMIN";
  const searchParams = useSearchParams();
  const router = useRouter();

  // Selected state
  const [resources, setResources] = useState([]);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const qStart = searchParams.get("date") || searchParams.get("startAt");
    if (qStart) {
      const parsed = new Date(qStart);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  });

  // View Mode: "month" | "week" | "day"
  const [viewMode, setViewMode] = useState(() => {
    const qView = searchParams.get("view");
    return qView === "day" || qView === "month" || qView === "week" ? qView : "month";
  });

  // Filter & Holiday states
  const [selectedBlock, setSelectedBlock] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [holidays, setHolidays] = useState([]);
  const [noticeHoliday, setNoticeHoliday] = useState(null);
  const [isDeclareHolidayOpen, setIsDeclareHolidayOpen] = useState(false);

  // Data state
  const [timetables, setTimetables] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [resourceError, setResourceError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal interaction states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSlot, setModalSlot] = useState(null);
  const [selectedTimetable, setSelectedTimetable] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [checkInModalBooking, setCheckInModalBooking] = useState(null);
  const [maintenanceNoticeFacility, setMaintenanceNoticeFacility] = useState(null);

  // Fast In-Memory Client Cache Ref
  const scheduleCacheRef = useRef(new Map());
  const initialResourceIdRef = useRef(null);
  const initialSlotHandledRef = useRef(false);

  // 1. Fetch Resources catalogue — runs once on mount
  const fetchResources = useCallback(async () => {
    setIsLoadingResources(true);
    setResourceError(null);
    try {
      const res = await api.resources.list({ limit: 50 });
      const fetched = res.resources || [];
      setResources(fetched);
      setResourceError(null);
      const queryResId = initialResourceIdRef.current;
      const matched = queryResId
        ? fetched.find((r) => r._id === queryResId || r.code === queryResId)
        : null;
      if (matched) {
        setSelectedResourceId(matched._id);
      } else if (fetched.length > 0) {
        setSelectedResourceId(fetched[0]._id);
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Failed to fetch resources", err);
      const msg = err instanceof Error ? err.message : "Unable to load campus facilities. Please check connectivity.";
      setResourceError(msg);
      setResources([]);
      setIsLoading(false);
    } finally {
      setIsLoadingResources(false);
    }
  }, []);

  useEffect(() => {
    initialResourceIdRef.current = searchParams.get("resourceId");
    const queryStartAt = searchParams.get("startAt");
    const queryEndAt = searchParams.get("endAt");
    let initialSlot = null;
    if (queryStartAt && queryEndAt) {
      const s = new Date(queryStartAt);
      const e = new Date(queryEndAt);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s.getTime() < e.getTime()) {
        initialSlot = { start: s.toISOString(), end: e.toISOString() };
      }
    }

    let ignore = false;
    api.resources
      .list({ limit: 50 })
      .then((res) => {
        if (!ignore) {
          const fetched = res.resources || [];
          setResources(fetched);
          setResourceError(null);
          setIsLoadingResources(false);
          const queryResId = initialResourceIdRef.current;
          const matched = queryResId
            ? fetched.find((r) => r._id === queryResId || r.code === queryResId)
            : null;
          if (matched) {
            setSelectedResourceId(matched._id);
          } else if (fetched.length > 0) {
            setSelectedResourceId(fetched[0]._id);
          } else {
            setIsLoading(false);
          }

          const shouldOpenModal = searchParams.get("book") === "true" || searchParams.get("action") === "book";
          if (initialSlot && shouldOpenModal && !initialSlotHandledRef.current) {
            initialSlotHandledRef.current = true;
            setModalSlot(initialSlot);
            setIsModalOpen(true);
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Failed to fetch resources", err);
          const msg = err instanceof Error ? err.message : "Unable to load campus facilities. Please check connectivity.";
          setResourceError(msg);
          setResources([]);
          setIsLoadingResources(false);
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync selected resource with URL
  const handleResourceChange = (resId) => {
    setSelectedResourceId(resId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("resourceId", resId);
    router.replace(`/dashboard/calendar?${params.toString()}`);
  };

  // Find currently active resource object
  const activeResource = useMemo(() => {
    return resources.find((r) => r._id === selectedResourceId) || null;
  }, [resources, selectedResourceId]);

  // Operating hours (08:00 to 20:00 in facility local timezone)
  const facilityTz = resolveReservationTimezone(activeResource);
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 8), []);

  // Calculate Monday of the active week
  const weekDays = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diffToMonday);
    monday.setUTCHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setUTCDate(monday.getUTCDate() + i);
      days.push(nextDay);
    }
    return days;
  }, [selectedDate]);

  // Calculate Month Grid Days (42 calendar cells = 6 weeks)
  const monthDays = useMemo(() => {
    const y = selectedDate.getUTCFullYear();
    const m = selectedDate.getUTCMonth();
    const firstDay = new Date(Date.UTC(y, m, 1));
    const dayOfWeek = firstDay.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const gridStart = new Date(firstDay);
    gridStart.setUTCDate(firstDay.getUTCDate() + diffToMonday);
    gridStart.setUTCHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 42; i++) {
      const nextDay = new Date(gridStart);
      nextDay.setUTCDate(gridStart.getUTCDate() + i);
      days.push(nextDay);
    }
    return days;
  }, [selectedDate]);

  // Visible Date Range depending on current view mode
  const visibleRange = useMemo(() => {
    if (viewMode === "month") {
      const startAt = monthDays[0].toISOString();
      const endAt = new Date(monthDays[41].getTime() + 86400000 - 1).toISOString();
      return { startAt, endAt };
    }
    if (viewMode === "week") {
      const startAt = weekDays[0].toISOString();
      const endAt = new Date(weekDays[6].getTime() + 86400000 - 1).toISOString();
      return { startAt, endAt };
    }
    // Day view
    const d = new Date(selectedDate);
    d.setUTCHours(0, 0, 0, 0);
    const startAt = d.toISOString();
    const endAt = new Date(d.getTime() + 86400000 - 1).toISOString();
    return { startAt, endAt };
  }, [viewMode, monthDays, weekDays, selectedDate]);

  // 2. Fetch Timetable Entries, Bookings, and Holidays for the visible range
  const loadScheduleData = useCallback(
    async (forceRefresh = false) => {
      if (!selectedResourceId) return;

      const { startAt, endAt } = visibleRange;
      const cacheKey = `${selectedResourceId}_${viewMode}_${startAt.slice(0, 10)}`;

      if (!forceRefresh && scheduleCacheRef.current.has(cacheKey)) {
        const cached = scheduleCacheRef.current.get(cacheKey);
        setTimetables(cached.timetables || []);
        setBookings(cached.bookings || []);
        if (cached.holidays?.length) setHolidays(cached.holidays);
        setIsLoading(false);
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const selectedYear = new Date(startAt).getUTCFullYear();
        const [ttRes, bkRes, holRes] = await Promise.all([
          api.timetables.list({
            resourceId: selectedResourceId,
            startAt,
            endAt,
          }),
          api.bookings.list({
            resourceId: selectedResourceId,
            startAt,
            endAt,
            limit: 100,
          }),
          api.holidays
            .list({
              year: selectedYear,
            })
            .catch(() => []),
        ]);

        const newTimetables = ttRes.entries || [];
        const newBookings = (bkRes.bookings || []).filter(
          (b) => b.status === "CONFIRMED" || b.status === "PENDING" || b.status === "CHECKED_IN"
        );
        const newHolidays = Array.isArray(holRes) ? holRes : [];

        setTimetables(newTimetables);
        setBookings(newBookings);
        if (newHolidays.length > 0) {
          setHolidays(newHolidays);
        }

        scheduleCacheRef.current.set(cacheKey, {
          timetables: newTimetables,
          bookings: newBookings,
          holidays: newHolidays.length > 0 ? newHolidays : holidays,
        });
      } catch (err) {
        console.error("Failed to load schedule data", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedResourceId, visibleRange, viewMode, holidays]
  );

  useEffect(() => {
    if (!selectedResourceId) return;
    loadScheduleData();
  }, [selectedResourceId, visibleRange, loadScheduleData]);

  // Date Navigation Handlers
  const handlePrev = () => {
    const nextDate = new Date(selectedDate);
    if (viewMode === "month") {
      nextDate.setUTCMonth(nextDate.getUTCMonth() - 1);
    } else if (viewMode === "week") {
      nextDate.setUTCDate(nextDate.getUTCDate() - 7);
    } else {
      nextDate.setUTCDate(nextDate.getUTCDate() - 1);
    }
    setSelectedDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(selectedDate);
    if (viewMode === "month") {
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
    } else if (viewMode === "week") {
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
    } else {
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    }
    setSelectedDate(nextDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleJumpToDate = (e) => {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split("-").map(Number);
    const jump = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    if (!isNaN(jump.getTime())) {
      setSelectedDate(jump);
    }
  };

  // Open booking modal for a specific day and hour
  const handleOpenBooking = useCallback((dayDate, hour) => {
    const currentTime = Date.now();
    if (activeResource?.status === "MAINTENANCE") {
      setMaintenanceNoticeFacility(activeResource);
      return;
    }
    const dayDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: facilityTz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dayDate);

    const start = localToUtc(dayDateStr, `${String(hour).padStart(2, "0")}:00`, facilityTz);
    const end = localToUtc(dayDateStr, `${String(hour + 1).padStart(2, "0")}:00`, facilityTz);

    if (end.getTime() <= currentTime) {
      return;
    }

    if (start.getTime() < currentTime) {
      const nowObj = new Date(currentTime);
      const nextMin = Math.ceil((nowObj.getUTCMinutes() + 1) / 15) * 15;
      start.setUTCHours(nowObj.getUTCHours(), nextMin, 0, 0);
      if (end.getTime() <= start.getTime()) {
        end.setTime(start.getTime() + 60 * 60 * 1000);
      }
    }

    setModalSlot({
      start: start.toISOString(),
      end: end.toISOString(),
    });
    setIsModalOpen(true);
  }, [activeResource, facilityTz]);

  const handleBookingSuccess = () => {
    scheduleCacheRef.current.clear();
    setIsRefreshing(true);
    loadScheduleData(true);
  };

  // Header Labels
  const monthYearLabel = useMemo(() => {
    const options = { month: "long", year: "numeric", timeZone: "UTC" };
    return new Intl.DateTimeFormat("en-US", options).format(selectedDate);
  }, [selectedDate]);

  const fullSelectedDateLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(selectedDate);
  }, [selectedDate]);

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchBlock =
        selectedBlock === "ALL" ||
        r.block === selectedBlock ||
        (r.location?.building && r.location.building.toLowerCase().includes(selectedBlock.replace("_", " ").toLowerCase()));
      const matchCategory = selectedCategory === "ALL" || r.roomCategory === selectedCategory;
      return matchBlock && matchCategory;
    });
  }, [resources, selectedBlock, selectedCategory]);

  // Current timestamp snapshot
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const selectedDateStr = selectedDate.toISOString().slice(0, 10);

  // Helper to test if a given dayDateStr is a holiday
  const getHolidayForDate = (dateStr) => {
    const matched = holidays.find((h) => {
      if (h.date === dateStr) return true;
      if (h.startDate && h.endDate && dateStr >= h.startDate && dateStr <= h.endDate) return true;
      if (h.startAt && h.endAt) {
        const sIso = new Date(h.startAt).toISOString().slice(0, 10);
        const eIso = new Date(h.endAt).toISOString().slice(0, 10);
        return dateStr >= sIso && dateStr <= eIso;
      }
      return false;
    });

    if (matched) return matched;

    // Default institutional winter recess fallback
    if (dateStr >= "2026-12-25" && dateStr <= "2026-12-31") {
      return {
        name:
          dateStr === "2026-12-25"
            ? "Christmas Day"
            : dateStr === "2026-12-31"
            ? "New Year's Eve (Campus Closure)"
            : "Winter Break & Year-End Closure",
        date: dateStr,
        reason: "Official Institutional Campus Holiday: Winter Break & Year-End Closure",
        scope: "CAMPUS_WIDE",
      };
    }
    return null;
  };

  // Helper to compute daily availability breakdown for any day
  const getDayAvailability = (dateObj) => {
    const dateStr = dateObj.toISOString().slice(0, 10);
    const holiday = getHolidayForDate(dateStr);
    const isMaintenance = activeResource?.status === "MAINTENANCE";
    const isPastDay = dateStr < todayStr;

    // Filter sessions overlapping this day
    const dayTt = timetables.filter((tt) => {
      const s = new Date(tt.startAt).toISOString().slice(0, 10);
      const e = new Date(tt.endAt).toISOString().slice(0, 10);
      return dateStr >= s && dateStr <= e;
    });

    const dayBk = bookings.filter((bk) => {
      const s = new Date(bk.startAt).toISOString().slice(0, 10);
      const e = new Date(bk.endAt).toISOString().slice(0, 10);
      return dateStr >= s && dateStr <= e;
    });

    // Approximate booked hours count across operating window (8am-8pm = 12h)
    let bookedHours = 0;
    for (const h of hours) {
      const slotStartUtc = localToUtc(dateStr, `${String(h).padStart(2, "0")}:00`, facilityTz);
      const slotEndUtc = localToUtc(dateStr, `${String(h + 1).padStart(2, "0")}:00`, facilityTz);
      const hasTt = dayTt.some((tt) => new Date(tt.startAt) < slotEndUtc && new Date(tt.endAt) > slotStartUtc);
      const hasBk = dayBk.some((bk) => new Date(bk.startAt) < slotEndUtc && new Date(bk.endAt) > slotStartUtc);
      if (hasTt || hasBk) bookedHours++;
    }

    const availableHours = Math.max(0, 12 - bookedHours);

    return {
      dateStr,
      holiday,
      isMaintenance,
      isPastDay,
      dayTt,
      dayBk,
      bookedHours,
      availableHours,
      isFullyBooked: bookedHours >= 12,
      isPartiallyBooked: bookedHours > 0 && bookedHours < 12,
      isAllAvailable: bookedHours === 0 && !holiday && !isMaintenance && !isPastDay,
    };
  };

  return (
    <div className="min-h-full py-8 grid-background">
      <PageContainer className="space-y-6">
        {/* Header with Title and Action Button */}
        <PageHeader
          title="Campus Timetable & Availability"
          description="Institutional curriculum sessions, academic timetables, and resource reservations across University blocks."
          action={
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={<CalendarCheck className="h-4 w-4 text-amber-400" />}
                  onClick={() => setIsDeclareHolidayOpen(true)}
                >
                  Declare Holiday
                </Button>
              )}
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setModalSlot(null);
                  setIsModalOpen(true);
                }}
                disabled={!activeResource}
              >
                New Booking
              </Button>
            </div>
          }
        />

        {/* Four-Block Campus Navigation Pills */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-1">Campus Block:</span>
          {[
            { id: "ALL", label: "All Blocks" },
            { id: "BLOCK_A", label: "Block A (Comp Labs)" },
            { id: "BLOCK_B", label: "Block B (ECE/EE Labs)" },
            { id: "BLOCK_C", label: "Block C (Chemical Labs)" },
            { id: "BLOCK_D", label: "Block D (Faculty & HOD)" },
          ].map((blk) => (
            <button
              key={blk.id}
              type="button"
              onClick={() => {
                setSelectedBlock(blk.id);
                const nextRes = resources.find((r) => blk.id === "ALL" || r.block === blk.id);
                if (nextRes) handleResourceChange(nextRes._id);
              }}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                selectedBlock === blk.id
                  ? "bg-primary text-white"
                  : "bg-surface text-muted hover:text-foreground border border-border"
              )}
            >
              {blk.label}
            </button>
          ))}
        </div>

        {/* Holiday Announcement Banner */}
        {holidays.length > 0 && (
          <div className="p-3.5 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-3">
            <span className="text-lg">🏛️</span>
            <div>
              <div className="font-semibold text-xs uppercase tracking-wider text-amber-200">
                Official Campus Holiday / Institutional Closure
              </div>
              <div className="text-xs mt-0.5">
                {holidays.map((h) => `${h.name} (${h.date}): ${h.reason}`).join(" • ")}
              </div>
            </div>
          </div>
        )}

        {/* Top Control Bar: Facility Selector, Date Navigation, View Mode, Jump to Date */}
        <Card className="p-4 bg-surface-2/40 border-border/80">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Facility Selector */}
            <div className="w-full lg:w-80">
              <Select
                label="Selected Campus Facility"
                value={selectedResourceId}
                onChange={(e) => handleResourceChange(e.target.value)}
                options={(filteredResources.length > 0 ? filteredResources : resources).map((r) => ({
                  value: r._id,
                  label: `${r.name} (${r.code}) — ${r.location?.building}${
                    r.status === "MAINTENANCE" ? " ⚠️ [Under Maintenance]" : ""
                  }`,
                }))}
                disabled={resources.length === 0}
              />
            </div>

            {/* Date Navigation & Jump To Date Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Today Button */}
              <Button variant="secondary" size="sm" onClick={handleToday} className="text-xs font-semibold">
                Today
              </Button>

              {/* Prev / Current Month / Next Navigation Pill */}
              <div className="flex items-center border border-border rounded-[var(--radius-md)] bg-surface shadow-xs">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-1.5 hover:bg-white/[0.08] text-muted hover:text-foreground transition-colors rounded-l"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 text-xs font-bold text-foreground tracking-wide min-w-[120px] text-center">
                  {monthYearLabel}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  className="p-1.5 hover:bg-white/[0.08] text-muted hover:text-foreground transition-colors rounded-r"
                  aria-label="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Jump to Date Picker */}
              <div
                className="flex items-center gap-1.5 bg-surface border border-border rounded-[var(--radius-md)] px-2.5 py-1 text-xs shadow-xs"
                title="Jump directly to any date"
              >
                <CalendarIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[11px] text-muted hidden sm:inline">Jump:</span>
                <input
                  type="date"
                  value={selectedDateStr}
                  onChange={handleJumpToDate}
                  className="bg-transparent text-xs text-foreground outline-none cursor-pointer font-medium"
                />
              </div>

              {/* Month / Week / Day View Mode Switcher */}
              <div className="flex rounded-[var(--radius-md)] border border-border bg-surface p-0.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("month")}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded transition-colors",
                    viewMode === "month"
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("week")}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded transition-colors",
                    viewMode === "week"
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("day")}
                  className={cn(
                    "px-3 py-1 text-xs font-semibold rounded transition-colors",
                    viewMode === "day"
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  Day
                </button>
              </div>

              {/* Refresh indicator */}
              <button
                type="button"
                onClick={() => {
                  scheduleCacheRef.current.clear();
                  setIsRefreshing(true);
                  loadScheduleData(true);
                }}
                disabled={isRefreshing}
                className="p-2 text-muted hover:text-foreground transition-colors"
                title="Refresh schedule"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Full Selected Date Banner */}
          <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span className="text-muted font-medium">Selected Date:</span>
              <span className="font-bold text-foreground text-sm tracking-wide bg-surface-2 px-2.5 py-0.5 rounded border border-border/80">
                {fullSelectedDateLabel}
              </span>
            </div>

            {/* Active Facility Metadata */}
            {activeResource && (
              <div className="flex flex-wrap items-center gap-3 text-muted text-[11px]">
                <div className="flex items-center gap-1.5 text-foreground font-medium">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span>{activeResource.name}</span>
                  <span className="text-muted">({activeResource.code})</span>
                </div>
                <span>•</span>
                <div>
                  {activeResource.location?.building}, Floor {activeResource.location?.floor || "1"}, Room{" "}
                  {activeResource.location?.roomNumber || activeResource.code}
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span>{activeResource.capacity} seats</span>
                </div>
              </div>
            )}
          </div>

          {/* Availability Legend (Section 4) */}
          <div className="mt-3 pt-2.5 border-t border-border/40 flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-muted">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-foreground/80">Legend:</span>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-xs" />
                <span>Available Slots</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-xs" />
                <span>Academic Timetable</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-400 shadow-xs" />
                <span>User Reservation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-xs" />
                <span>Campus Holiday / Closed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-xs" />
                <span>Fully Booked</span>
              </div>
            </div>

            <div className="text-[10px] text-muted/80 italic">
              Timezone: {facilityTz} • Private reservations protected
            </div>
          </div>
        </Card>

        {/* Schedule Grid Area */}
        {isLoadingResources || (isLoading && !isRefreshing && timetables.length === 0 && bookings.length === 0) ? (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                  <span className="text-sm font-semibold text-foreground">Loading Campus Schedule...</span>
                </div>
                <p className="text-xs text-muted">Retrieving institutional timetable constraints and reservations</p>
              </div>
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="grid grid-cols-7 gap-2 pt-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-72 w-full" />
              ))}
            </div>
          </Card>
        ) : resourceError ? (
          <Card className="min-h-[350px] flex items-center justify-center border-danger/30 bg-danger/5">
            <ErrorState
              title="Failed to Load Facilities"
              description={resourceError}
              action={
                <Button variant="secondary" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={fetchResources}>
                  Retry Loading Facilities
                </Button>
              }
            />
          </Card>
        ) : resources.length === 0 ? (
          <Card className="min-h-[350px] flex items-center justify-center">
            <EmptyState
              icon={<Building2 className="h-8 w-8 text-primary" />}
              title="No Facilities Available"
              description="There are currently no campus facilities or laboratories registered in the institutional catalogue."
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Facility Under Maintenance Warning Banner */}
            {activeResource && activeResource.status === "MAINTENANCE" && (
              <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-red-950/90 via-red-900/60 to-red-950/90 border-2 border-red-500/80 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
                    <Wrench className="h-7 w-7 text-red-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="font-extrabold text-red-200 text-lg md:text-2xl tracking-wide uppercase">
                        FACILITY UNDER MAINTENANCE
                      </h2>
                      <Badge
                        variant="warning"
                        className="bg-red-500/30 text-red-200 border-red-400 text-xs font-bold uppercase tracking-wider px-3 py-1"
                      >
                        ONLINE BOOKING PAUSED
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm md:text-base text-red-200/90 leading-relaxed max-w-3xl">
                      <strong>
                        {activeResource.name} ({activeResource.code})
                      </strong>{" "}
                      is temporarily closed for maintenance work. All dates and time slots in this calendar are locked and
                      cannot be booked until reactivated by campus administration.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                1. MONTH VIEW (Full Calendar Grid)
               ══════════════════════════════════════════════════════════ */}
            {viewMode === "month" && (
              <div className="space-y-4">
                <Card className="p-0 border-border overflow-hidden" noPadding>
                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 border-b border-border bg-surface-2/70 text-center font-bold text-xs uppercase tracking-wider text-muted py-2.5">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName, idx) => (
                      <div key={idx} className={cn("px-1", idx >= 5 && "text-muted/60")}>
                        {dayName}
                      </div>
                    ))}
                  </div>

                  {/* 42-Day Month Grid */}
                  <div className="grid grid-cols-7 divide-x divide-y divide-border/50 bg-surface">
                    {monthDays.map((d, index) => {
                      const dayStr = d.toISOString().slice(0, 10);
                      const isCurrentMonth = d.getUTCMonth() === selectedDate.getUTCMonth();
                      const isToday = dayStr === todayStr;
                      const isSelected = dayStr === selectedDateStr;
                      const availability = getDayAvailability(d);

                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setSelectedDate(d);
                            if (availability.holiday) {
                              setNoticeHoliday({
                                name: availability.holiday.name,
                                date: availability.holiday.date || dayStr,
                                reason: availability.holiday.reason || "Official Institutional Campus Holiday",
                                scope: availability.holiday.scope || "CAMPUS_WIDE",
                              });
                            }
                          }}
                          className={cn(
                            "min-h-[96px] md:min-h-[112px] p-2 transition-all cursor-pointer relative flex flex-col justify-between group",
                            !isCurrentMonth && "bg-surface-2/20 text-muted/40 opacity-55",
                            isCurrentMonth && "hover:bg-primary/5",
                            isSelected && "ring-2 ring-primary ring-inset bg-primary/10",
                            isToday && "bg-primary/5 font-semibold",
                            availability.holiday && "bg-amber-950/20"
                          )}
                        >
                          {/* Top Row: Date Number and Status Badge */}
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold",
                                isToday && "bg-primary text-white font-bold shadow-xs",
                                isSelected && !isToday && "bg-foreground/15 text-foreground font-bold",
                                !isToday && !isSelected && "text-foreground/90"
                              )}
                            >
                              {d.getUTCDate()}
                            </span>

                            {/* Status Pills */}
                            {availability.holiday ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-tight">
                                Holiday
                              </span>
                            ) : availability.isMaintenance ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 uppercase tracking-tight">
                                Locked
                              </span>
                            ) : availability.isFullyBooked ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-tight">
                                Full
                              </span>
                            ) : availability.isPartiallyBooked ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {availability.availableHours}h Free
                              </span>
                            ) : availability.isPastDay ? (
                              <span className="text-[9px] text-muted/50 font-mono">Past</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                12h Open
                              </span>
                            )}
                          </div>

                          {/* Middle: Content Tags / Mini Dots */}
                          <div className="space-y-1 my-1">
                            {availability.holiday && (
                              <p className="text-[10px] text-amber-300/90 truncate font-medium">
                                🏛️ {availability.holiday.name}
                              </p>
                            )}

                            {availability.dayTt.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-primary-bright/90 truncate font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                <span className="truncate">
                                  {availability.dayTt.length} Class Session
                                  {availability.dayTt.length > 1 ? "s" : ""}
                                </span>
                              </div>
                            )}

                            {availability.dayBk.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-400 truncate font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                                <span className="truncate">
                                  {availability.dayBk.length} Reservation
                                  {availability.dayBk.length > 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Bottom Row: Quick Action Pill */}
                          <div className="pt-1 flex items-center justify-between text-[10px] text-muted">
                            <span className="text-[9px] opacity-70">
                              {availability.bookedHours > 0 ? `${availability.bookedHours}h booked` : "Clear"}
                            </span>
                            <span className="text-primary text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                              Inspect →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Selected Day Quick Inspector & Actions Drawer */}
                <Card className="p-4 bg-surface-2/40 border-border">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="h-4 w-4 text-primary" />
                        <h3 className="font-bold text-foreground text-sm">
                          Schedule Overview: {fullSelectedDateLabel}
                        </h3>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        Facility: <strong>{activeResource?.name}</strong> • Timezone: {facilityTz}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setViewMode("day")}
                        className="text-xs font-semibold"
                      >
                        <Clock className="h-3.5 w-3.5 mr-1 text-primary" />
                        Detailed Day View
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          handleOpenBooking(selectedDate, 9);
                        }}
                        disabled={
                          activeResource?.status === "MAINTENANCE" ||
                          !!getHolidayForDate(selectedDateStr) ||
                          selectedDateStr < todayStr
                        }
                        className="text-xs font-semibold"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Book on this Date
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                2. WEEK VIEW (7-Day Column Grid)
               ══════════════════════════════════════════════════════════ */}
            {viewMode === "week" && (
              <div className="space-y-2">
                <Card className="overflow-x-auto p-0 border-border" noPadding>
                  <div className="min-w-[850px]">
                    {/* Day Header Row */}
                    <div className="grid grid-cols-8 border-b border-border bg-surface-2/70 text-xs font-semibold text-foreground">
                      <div className="p-3 text-center border-r border-border/60 text-muted uppercase tracking-wider text-[11px]">
                        {facilityTz ? facilityTz.split("/").pop().replace(/_/g, " ") : "Local"} Time
                      </div>
                      {weekDays.map((d, i) => {
                        const dayStr = d.toISOString().slice(0, 10);
                        const isToday = dayStr === todayStr;
                        const isSelected = dayStr === selectedDateStr;
                        const isPastDay = dayStr < todayStr;
                        const dayName = new Intl.DateTimeFormat("en-US", {
                          weekday: "short",
                          timeZone: "UTC",
                        }).format(d);
                        const dayNum = d.getUTCDate();
                        return (
                          <div
                            key={i}
                            onClick={() => setSelectedDate(d)}
                            className={cn(
                              "p-3 text-center border-r border-border/60 last:border-r-0 transition-colors cursor-pointer",
                              isToday && "bg-primary/10 text-primary-bright font-bold",
                              isSelected && !isToday && "bg-surface-2/60 text-foreground font-bold",
                              isPastDay && "opacity-80 bg-surface-2/30"
                            )}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="block text-[11px] opacity-80 uppercase tracking-wider">{dayName}</span>
                              {isToday && (
                                <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary-bright text-[9px] font-bold uppercase tracking-wider">
                                  Today
                                </span>
                              )}
                              {isPastDay && (
                                <span className="text-[9px] text-muted opacity-60 font-mono">Past</span>
                              )}
                            </div>
                            <span className="text-sm font-semibold">{dayNum}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Hourly Rows (08:00 to 20:00) */}
                    <div className="divide-y divide-border/40">
                      {hours.map((hour) => {
                        const timeLabel = `${String(hour).padStart(2, "0")}:00`;
                        return (
                          <div key={hour} className="grid grid-cols-8 min-h-[64px]">
                            {/* Hour Label */}
                            <div className="p-2 border-r border-border/60 text-[11px] font-mono text-muted text-center flex items-center justify-center bg-surface-2/20">
                              {timeLabel}
                            </div>

                            {/* 7 Day Columns */}
                            {weekDays.map((dayDate, dayIdx) => {
                              const dayDateStr = new Intl.DateTimeFormat("en-CA", {
                                timeZone: facilityTz,
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              }).format(dayDate);
                              const slotStartUtc = localToUtc(
                                dayDateStr,
                                `${String(hour).padStart(2, "0")}:00`,
                                facilityTz
                              );
                              const slotEndUtc = localToUtc(
                                dayDateStr,
                                `${String(hour + 1).padStart(2, "0")}:00`,
                                facilityTz
                              );
                              const isPastCell = slotEndUtc.getTime() <= now.getTime();
                              const isCurrentCell =
                                slotStartUtc.getTime() <= now.getTime() && now.getTime() < slotEndUtc.getTime();
                              const matchingTt =
                                timetables.find(
                                  (tt) => new Date(tt.startAt) < slotEndUtc && new Date(tt.endAt) > slotStartUtc
                                ) ?? null;
                              const matchingBk =
                                bookings.find(
                                  (bk) => new Date(bk.startAt) < slotEndUtc && new Date(bk.endAt) > slotStartUtc
                                ) ?? null;
                              const matchingHoliday = getHolidayForDate(dayDateStr);
                              const isMaintenanceFacility = activeResource?.status === "MAINTENANCE";

                              return (
                                <div
                                  key={dayIdx}
                                  className={cn(
                                    "border-r border-border/40 last:border-r-0 p-1 relative transition-colors select-none",
                                    isMaintenanceFacility && !matchingTt && !matchingBk
                                      ? "bg-red-950/5 cursor-pointer hover:bg-red-950/15"
                                      : matchingHoliday && !matchingTt && !matchingBk
                                      ? "bg-amber-950/20 border-amber-500/30 cursor-pointer"
                                      : isPastCell && !matchingTt && !matchingBk
                                      ? "bg-surface-2/10 cursor-not-allowed opacity-60"
                                      : !matchingTt && !matchingBk
                                      ? "hover:bg-primary/5 cursor-pointer group"
                                      : "cursor-pointer"
                                  )}
                                  onClick={() => {
                                    if (matchingTt) {
                                      setSelectedTimetable(matchingTt);
                                    } else if (matchingBk) {
                                      setSelectedBooking(matchingBk);
                                    } else if (isMaintenanceFacility) {
                                      setMaintenanceNoticeFacility(activeResource);
                                    } else if (matchingHoliday) {
                                      setNoticeHoliday({
                                        name: matchingHoliday.name,
                                        date: matchingHoliday.date || dayDateStr,
                                        reason: matchingHoliday.reason || "Official Institutional Campus Holiday",
                                        scope: matchingHoliday.scope || "CAMPUS_WIDE",
                                      });
                                    } else if (!isPastCell) {
                                      handleOpenBooking(dayDate, hour);
                                    }
                                  }}
                                >
                                  {/* 1. Academic Timetable Session */}
                                  {matchingTt && (
                                    <div
                                      data-timetable-entry={matchingTt.courseCode}
                                      className={cn(
                                        "h-full w-full rounded-[var(--radius-sm)] p-1.5 border text-foreground flex flex-col justify-between shadow-xs transition-all hover:scale-[1.01] cursor-pointer",
                                        isCurrentCell
                                          ? "bg-gradient-to-br from-primary/35 to-[#1E293B] border-primary-bright ring-1 ring-primary/40 shadow-md"
                                          : isPastCell
                                          ? "bg-gradient-to-br from-primary/15 to-[#0F172A] border-primary/30 opacity-80"
                                          : "bg-gradient-to-br from-primary/25 to-[#1E293B] border-primary/50"
                                      )}
                                      title={`Academic Timetable: ${matchingTt.courseCode} - ${matchingTt.courseTitle} (Click for details)`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTimetable(matchingTt);
                                      }}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[11px] font-bold text-primary-bright truncate">
                                            {matchingTt.courseCode}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            {isCurrentCell && (
                                              <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                              </span>
                                            )}
                                            <Lock className="h-3 w-3 text-primary-bright shrink-0" />
                                          </div>
                                        </div>
                                        <p className="text-[10px] text-foreground/90 truncate leading-tight font-medium">
                                          {matchingTt.courseTitle}
                                        </p>
                                      </div>
                                      <div className="flex items-center justify-between text-[9px] text-muted pt-0.5">
                                        <span className="truncate">{matchingTt.instructorName || "Curriculum"}</span>
                                        <span className="font-mono text-primary-bright/80 shrink-0">
                                          {new Date(matchingTt.startAt).getUTCHours()}:
                                          {String(new Date(matchingTt.startAt).getUTCMinutes()).padStart(2, "0")}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* 2. User Reservation */}
                                  {!matchingTt && matchingBk && (
                                    <div
                                      data-booking-entry={matchingBk._id}
                                      className={cn(
                                        "h-full w-full rounded-[var(--radius-sm)] p-1.5 border text-foreground flex flex-col justify-between transition-all hover:scale-[1.01] cursor-pointer",
                                        isCurrentCell
                                          ? "bg-emerald-500/25 border-emerald-400 ring-1 ring-emerald-400/40 shadow-xs"
                                          : isPastCell
                                          ? "bg-emerald-500/10 border-emerald-500/30 opacity-75"
                                          : "bg-emerald-500/15 border-emerald-500/40"
                                      )}
                                      title={`Reservation: ${matchingBk.title} (Click for details)`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedBooking(matchingBk);
                                      }}
                                    >
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[11px] font-semibold text-emerald-400 truncate">
                                          {matchingBk.title}
                                        </span>
                                        <CalendarCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                                      </div>
                                      <div className="flex items-center justify-between text-[9px] text-muted">
                                        <span className="text-emerald-300 font-medium">{matchingBk.status}</span>
                                        <span className="font-mono">
                                          {new Date(matchingBk.startAt).getUTCHours()}:
                                          {String(new Date(matchingBk.startAt).getUTCMinutes()).padStart(2, "0")}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* 3. Official Campus Holiday Closure */}
                                  {matchingHoliday && !matchingTt && !matchingBk && (
                                    <div
                                      className="h-full w-full rounded-[var(--radius-sm)] p-1.5 border border-amber-500/40 bg-amber-950/25 text-amber-200 flex flex-col justify-center items-center text-center shadow-xs cursor-not-allowed select-none"
                                      title={`Campus Closed: ${matchingHoliday.name} (${
                                        matchingHoliday.reason || "Official Holiday"
                                      })`}
                                    >
                                      <span className="text-[10px] font-bold tracking-wide uppercase text-amber-400">
                                        Holiday
                                      </span>
                                      <span className="text-[9px] text-amber-300/80 truncate max-w-full">
                                        {matchingHoliday.name}
                                      </span>
                                    </div>
                                  )}

                                  {/* 4. Empty Slot: Maintenance vs Past vs Future Bookable */}
                                  {!matchingTt && !matchingBk && !matchingHoliday && (
                                    isMaintenanceFacility ? (
                                      <div
                                        className="h-full w-full flex items-center justify-center select-none"
                                        title="Facility under maintenance — booking locked"
                                      >
                                        <span className="text-[10px] text-red-400/40 font-mono">—</span>
                                      </div>
                                    ) : isPastCell ? (
                                      <div className="h-full w-full flex items-center justify-center">
                                        <span className="text-[10px] text-muted/30 font-mono select-none">—</span>
                                      </div>
                                    ) : (
                                      <div className="h-full w-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <span className="text-[10px] text-primary flex items-center gap-0.5 font-medium">
                                          <Plus className="h-3 w-3" /> Book
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                3. DAY VIEW (Detailed 12-Hour List)
               ══════════════════════════════════════════════════════════ */}
            {viewMode === "day" && (
              <div className="space-y-4">
                <Card className="p-4 bg-surface-2/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Detailed Daily Schedule: {fullSelectedDateLabel}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewMode("month")}
                      className="text-xs self-start sm:self-auto"
                    >
                      ← Back to Month Overview
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {hours.map((hour) => {
                      const selectedDateStr = new Intl.DateTimeFormat("en-CA", {
                        timeZone: facilityTz,
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }).format(selectedDate);
                      const cellStartUtc = localToUtc(selectedDateStr, `${String(hour).padStart(2, "0")}:00`, facilityTz);
                      const cellEndUtc = localToUtc(selectedDateStr, `${String(hour + 1).padStart(2, "0")}:00`, facilityTz);
                      const isPastCell = cellEndUtc.getTime() <= now.getTime();
                      const isCurrentCell = cellStartUtc.getTime() <= now.getTime() && now.getTime() < cellEndUtc.getTime();
                      const matchingTt =
                        timetables.find((tt) => new Date(tt.startAt) < cellEndUtc && new Date(tt.endAt) > cellStartUtc) ??
                        null;
                      const matchingBk =
                        bookings.find((bk) => new Date(bk.startAt) < cellEndUtc && new Date(bk.endAt) > cellStartUtc) ??
                        null;
                      const matchingHoliday = getHolidayForDate(selectedDateStr);
                      const isMaintenanceFacility = activeResource?.status === "MAINTENANCE";

                      return (
                        <div
                          key={hour}
                          className={cn(
                            "p-3 rounded-[var(--radius-md)] border flex items-center justify-between gap-4 transition-colors",
                            matchingHoliday
                              ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
                              : matchingTt
                              ? "bg-primary/10 border-primary/40 text-foreground cursor-pointer hover:border-primary/80"
                              : matchingBk
                              ? "bg-emerald-500/10 border-emerald-500/30 text-foreground cursor-pointer hover:border-emerald-400"
                              : isMaintenanceFacility
                              ? "bg-red-950/15 border-red-500/30 text-foreground cursor-pointer hover:bg-red-950/25"
                              : isPastCell
                              ? "bg-surface-2/10 border-border/40 opacity-60 cursor-not-allowed"
                              : "bg-surface border-border/60 hover:border-primary/40"
                          )}
                          onClick={() => {
                            if (matchingHoliday) {
                              setNoticeHoliday({
                                name: matchingHoliday.name,
                                date: matchingHoliday.date || selectedDateStr,
                                reason: matchingHoliday.reason || "Official Institutional Campus Holiday",
                                scope: matchingHoliday.scope || "CAMPUS_WIDE",
                              });
                            } else if (matchingTt) {
                              setSelectedTimetable(matchingTt);
                            } else if (matchingBk) {
                              setSelectedBooking(matchingBk);
                            } else if (isMaintenanceFacility) {
                              setMaintenanceNoticeFacility(activeResource);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-semibold text-muted w-14">
                              {String(hour).padStart(2, "0")}:00
                            </span>

                            {matchingHoliday ? (
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-amber-300 text-sm">
                                    🏛️ {matchingHoliday.name}
                                  </span>
                                  <Badge variant="warning">Campus Closed</Badge>
                                </div>
                                <p className="text-xs text-amber-200/80 mt-0.5">
                                  {matchingHoliday.reason || "Official campus holiday closure"}
                                </p>
                              </div>
                            ) : matchingTt ? (
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-primary-bright text-sm">
                                    {matchingTt.courseCode} — {matchingTt.courseTitle}
                                  </span>
                                  <Badge variant={isCurrentCell ? "occupied" : "neutral"} dot={isCurrentCell}>
                                    {isCurrentCell ? "In Progress" : isPastCell ? "Completed" : "Institutional Session"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted mt-0.5">
                                  Instructor: {matchingTt.instructorName || "Faculty"} • Click to view class details
                                </p>
                              </div>
                            ) : matchingBk ? (
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-emerald-400 text-sm">{matchingBk.title}</span>
                                  <Badge variant="available" dot={isCurrentCell}>
                                    {matchingBk.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted mt-0.5">
                                  Active Reservation • Click to view reservation details
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {isMaintenanceFacility ? (
                                  <span className="text-xs text-red-400/50 font-mono">— Maintenance Lock</span>
                                ) : (
                                  <>
                                    <span className="text-sm font-medium text-muted">
                                      {isPastCell ? "Past time slot" : "Available for booking"}
                                    </span>
                                    <Badge variant={isPastCell ? "neutral" : "available"}>
                                      {isPastCell ? "Expired" : "Open"}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            {matchingHoliday ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNoticeHoliday({
                                    name: matchingHoliday.name,
                                    date: matchingHoliday.date || selectedDateStr,
                                    reason: matchingHoliday.reason || "Official Institutional Campus Holiday",
                                    scope: matchingHoliday.scope || "CAMPUS_WIDE",
                                  });
                                }}
                                className="text-xs text-amber-300 border-amber-500/40"
                              >
                                View Notice
                              </Button>
                            ) : matchingTt ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTimetable(matchingTt);
                                }}
                                className="text-xs"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> View Class
                              </Button>
                            ) : matchingBk ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBooking(matchingBk);
                                }}
                                className="text-xs text-emerald-400"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" /> View Booking
                              </Button>
                            ) : isMaintenanceFacility ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setMaintenanceNoticeFacility(activeResource)}
                                className="text-xs text-red-400/60 border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
                              >
                                <Lock className="h-3.5 w-3.5 mr-1" /> Slot Locked
                              </Button>
                            ) : isPastCell ? (
                              <Button size="sm" variant="secondary" disabled className="text-xs opacity-50">
                                Unbookable
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenBooking(selectedDate, hour)}
                              >
                                Reserve Slot
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Timetable Class Detail Modal */}
        <TimetableDetailModal
          open={!!selectedTimetable}
          onClose={() => setSelectedTimetable(null)}
          timetable={selectedTimetable}
        />

        {/* User Reservation Detail Modal */}
        <BookingDetailModal
          open={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          booking={selectedBooking}
          onCheckIn={(bk) => {
            setSelectedBooking(null);
            setCheckInModalBooking(bk);
          }}
        />

        {/* Check-In Modal with camera scanner */}
        <CheckInModal
          open={!!checkInModalBooking}
          onClose={() => setCheckInModalBooking(null)}
          booking={checkInModalBooking}
          onSuccess={loadScheduleData}
        />

        {/* Maintenance Advisory Notice Modal */}
        <Modal
          open={!!maintenanceNoticeFacility}
          onClose={() => setMaintenanceNoticeFacility(null)}
          title="Facility Maintenance Notice"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-400">
              <Wrench className="h-6 w-6 shrink-0" />
              <div>
                <h4 className="font-semibold text-sm text-red-300">Online Booking Temporarily Paused</h4>
                <p className="text-xs text-red-300/80 mt-0.5">
                  {maintenanceNoticeFacility?.name} ({maintenanceNoticeFacility?.code}) is undergoing scheduled
                  facility maintenance.
                </p>
              </div>
            </div>
            <div className="text-xs text-muted space-y-2">
              <p>
                During maintenance windows, room availability cannot be guaranteed and online slot reservations are
                disabled by campus administration.
              </p>
              <p>
                If you require urgent facility access or emergency laboratory space, please consult the Department Head
                (HOD) or use the Emergency Escalation workflow.
              </p>
            </div>
            <div className="pt-3 flex justify-center">
              <Button variant="secondary" onClick={() => setMaintenanceNoticeFacility(null)}>
                Understood
              </Button>
            </div>
          </div>
        </Modal>

        {/* Official Holiday Closure Notice Modal */}
        <HolidayNoticeModal
          open={!!noticeHoliday}
          onClose={() => setNoticeHoliday(null)}
          holiday={noticeHoliday}
        />

        {/* Administrator Declare Campus Holiday Modal */}
        <DeclareHolidayModal
          open={isDeclareHolidayOpen}
          onClose={() => setIsDeclareHolidayOpen(false)}
          onSuccess={() => {
            scheduleCacheRef.current.clear();
            loadScheduleData(true);
          }}
        />

        {/* Booking Creation Modal */}
        <BookingModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          resource={activeResource}
          initialStartAt={modalSlot?.start}
          initialEndAt={modalSlot?.end}
          onSuccess={handleBookingSuccess}
        />
      </PageContainer>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full py-8 grid-background">
          <PageContainer>
            <Skeleton className="h-10 w-48 mb-6" />
            <Skeleton className="h-96 w-full" />
          </PageContainer>
        </div>
      }
    >
      <CalendarView />
    </Suspense>
  );
}
