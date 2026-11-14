"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  TableProperties,
  Users,
  Wrench,
  X,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isFacultyOrHodRoom } from "@/lib/utils";
import {
  VERIFIED_CAMPUS_BUILDINGS,
  CAMPUS_GEOMETRY_DISCLAIMER,
  getBuildingArchitecturalPalette,
} from "@/lib/campus-data";
import {
  getFacilityStatusMeta,
  getBuildingStateMeta,
} from "@/lib/status-precedence";
import { CampusScene } from "@/components/3d/campus-scene";

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CampusWorkspace({
  standalone = false,
  onMetricsUpdate,
  refreshKey = 0,
  className = "",
}) {
  const { user } = useAuth();
  const isStudent = Boolean(
    user?.roles?.includes("STUDENT") &&
      !user?.roles?.some((r) =>
        ["FACULTY", "ADMIN", "DEPARTMENT_HEAD", "FACILITY_MANAGER"].includes(r)
      )
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState("bld-turing");
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    if (now.getUTCHours() >= 21) {
      return "09:00";
    }
    const currentUtcHour = now.getUTCHours();
    const targetHour = Math.min(20, Math.max(8, currentUtcHour));
    return `${String(targetHour).padStart(2, "0")}:00`;
  });
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [viewMode, setViewMode] = useState("3d"); // "3d" | "2d"
  const [selectedFloor, setSelectedFloor] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availabilityMap, setAvailabilityMap] = useState({});

  // Compute requested ISO timestamps
  const queryInterval = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const [hours, minutes] = startTime.split(":").map(Number);
      const start = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0, 0));
      const end = new Date(start.getTime() + durationMinutes * 60000);
      const endHours = String(end.getUTCHours()).padStart(2, "0");
      const endMinutes = String(end.getUTCMinutes()).padStart(2, "0");
      return {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        startLocalStr: `${selectedDate} ${startTime} UTC`,
        endLocalStr: `${endHours}:${endMinutes} UTC`,
        isValid: start.getTime() < end.getTime(),
      };
    } catch {
      return { isValid: false };
    }
  }, [selectedDate, startTime, durationMinutes]);

  // Fetch building availability in parallel for all verified campus buildings
  const fetchAvailability = useCallback(async () => {
    if (!queryInterval.isValid) return;

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        VERIFIED_CAMPUS_BUILDINGS.map((b) =>
          api.bookings.getBuildingAvailability({
            building: b.name,
            startAt: queryInterval.startAt,
            endAt: queryInterval.endAt,
          })
        )
      );

      const nextMap = {};
      let totalAvailable = 0;
      let totalOccupied = 0;
      let totalMaintenance = 0;
      let totalUnknown = 0;
      let totalFacilitiesCount = 0;

      results.forEach((res, index) => {
        const b = VERIFIED_CAMPUS_BUILDINGS[index];
        const payload = res.status === "fulfilled" ? (res.value?.data || res.value) : null;
        if (payload?.summary) {
          const data = payload;
          nextMap[b.name] = data;

          const counts = data.summary?.counts || {};
          totalAvailable += counts.available || 0;
          totalOccupied += counts.occupied || 0;
          totalMaintenance += counts.maintenance || 0;
          totalUnknown += counts.unknown || 0;
          totalFacilitiesCount += data.summary?.total || b.resources.length;
        } else {
          // Fail-closed fallback: mark building as unknown/verification error
          const fallbackCount = b.resources.length;
          totalUnknown += fallbackCount;
          totalFacilitiesCount += fallbackCount;

          nextMap[b.name] = {
            building: b.name,
            summary: {
              total: fallbackCount,
              counts: {
                available: 0,
                occupied: 0,
                maintenance: 0,
                unavailable: 0,
                unknown: fallbackCount,
              },
              hasAvailability: false,
              availabilityRatio: `0/${fallbackCount}`,
              displayBadge: `${fallbackCount} Facilities (Unverified)`,
              buildingVisualState: "indeterminate_warning",
            },
            resources: b.resources.map((r) => ({
              id: r.code,
              name: r.name,
              code: r.code,
              floor: r.floor,
              roomNumber: r.roomNumber,
              capacity: r.capacity,
              resourceType: { name: r.type, code: r.type },
              generalStatus: "ACTIVE",
              availability: {
                available: false,
                visualStatus: "unknown",
                reason: "CALCULATION_ERROR",
                message: "Unable to verify live schedule for this facility",
                occupiedSoon: false,
                nextBookingAt: null,
                quota: null,
              },
            })),
          };
        }
      });

      setAvailabilityMap(nextMap);

      // Notify parent of fresh aggregate operational counts
      onMetricsUpdate?.({
        available: totalAvailable,
        occupied: totalOccupied,
        maintenance: totalMaintenance,
        unknown: totalUnknown,
        total: totalFacilitiesCount,
      });
    } catch (err) {
      setError(err?.message || "Failed to load building availability data");
    } finally {
      setLoading(false);
    }
  }, [queryInterval, onMetricsUpdate]);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        fetchAvailability();
      }
    }, 0);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [fetchAvailability, refreshKey]);

  // Currently inspected building
  const activeBuilding = useMemo(() => {
    if (!selectedBuildingId) return null;
    return VERIFIED_CAMPUS_BUILDINGS.find((b) => b.id === selectedBuildingId) || null;
  }, [selectedBuildingId]);

  const activePalette = useMemo(() => {
    if (!activeBuilding) return null;
    return getBuildingArchitecturalPalette(activeBuilding.code);
  }, [activeBuilding]);

  const activeBuildingAvail = useMemo(() => {
    if (!activeBuilding) return null;
    return availabilityMap[activeBuilding.name] || null;
  }, [activeBuilding, availabilityMap]);

  // Student-visible resources for currently active building (hides HOD & Faculty rooms from students)
  const studentVisibleResources = useMemo(() => {
    if (!activeBuildingAvail?.resources) return [];
    if (!isStudent) return activeBuildingAvail.resources;
    return activeBuildingAvail.resources.filter((r) => !isFacultyOrHodRoom(r));
  }, [activeBuildingAvail, isStudent]);

  // Distinct floors available in the inspected building
  const buildingFloors = useMemo(() => {
    if (!studentVisibleResources.length) return [];
    const floors = new Set(studentVisibleResources.map((r) => r.floor || "1"));
    return Array.from(floors).sort();
  }, [studentVisibleResources]);

  // Filtered facilities based on floor tab
  const filteredFacilities = useMemo(() => {
    if (!studentVisibleResources.length) return [];
    if (selectedFloor === "ALL") return studentVisibleResources;
    return studentVisibleResources.filter((r) => (r.floor || "1") === selectedFloor);
  }, [studentVisibleResources, selectedFloor]);

  // Evaluated status counts for active building (filtered for student if applicable)
  const displayCounts = useMemo(() => {
    if (!activeBuildingAvail?.resources) {
      return { available: 0, occupied: 0, maintenance: 0, unknown: 0 };
    }
    if (!isStudent) {
      return activeBuildingAvail.summary?.counts || { available: 0, occupied: 0, maintenance: 0, unknown: 0 };
    }
    return {
      available: studentVisibleResources.filter((r) => r.availability?.available).length,
      occupied: studentVisibleResources.filter((r) => r.availability?.visualStatus === "occupied").length,
      maintenance: studentVisibleResources.filter((r) => r.availability?.visualStatus === "maintenance").length,
      unknown: studentVisibleResources.filter((r) => !r.availability?.visualStatus || r.availability?.visualStatus === "unknown").length,
    };
  }, [activeBuildingAvail, isStudent, studentVisibleResources]);

  // 3D Scene availability map: adjust Block D counts for student view so pins show student-accessible facilities
  const sceneAvailabilityMap = useMemo(() => {
    if (!isStudent) return availabilityMap;
    const adjusted = { ...availabilityMap };
    for (const b of VERIFIED_CAMPUS_BUILDINGS) {
      if (b.block === "BLOCK_D" && adjusted[b.name]) {
        const avail = adjusted[b.name];
        const visibleRes = (avail.resources || []).filter((r) => !isFacultyOrHodRoom(r));
        const availCount = visibleRes.filter((r) => r.availability?.available).length;
        adjusted[b.name] = {
          ...avail,
          summary: {
            ...avail.summary,
            counts: {
              ...avail.summary?.counts,
              available: availCount,
            },
            total: visibleRes.length,
            displayBadge: `${availCount} Available`,
          },
        };
      }
    }
    return adjusted;
  }, [availabilityMap, isStudent]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* ─── Workspace Header Controls ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-surface border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/25 text-primary shrink-0">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                Interactive 3D Campus Map
              </h2>
              {standalone && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-medium text-primary">
                  Full View
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">
              Click any building model or tab below to inspect live room availability and book slots.
            </p>
          </div>
        </div>

        {/* Time Window Controls & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <input
              type="date"
              aria-label="Reservation Date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-foreground text-xs outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* Time Picker */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
            <Clock className="h-3.5 w-3.5 text-warning" />
            <input
              type="time"
              aria-label="Start Time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-transparent text-foreground text-xs outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* Duration Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-muted">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted" />
            <select
              aria-label="Booking Duration"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="bg-transparent text-foreground outline-none cursor-pointer text-xs"
            >
              <option value={30} className="bg-surface text-foreground">30m</option>
              <option value={60} className="bg-surface text-foreground">1 hour</option>
              <option value={120} className="bg-surface text-foreground">2 hours</option>
              <option value={180} className="bg-surface text-foreground">3 hours</option>
              <option value={240} className="bg-surface text-foreground">4 hours</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchAvailability}
            disabled={loading}
            aria-label="Refresh availability data"
            className="p-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 transition-colors disabled:opacity-50"
            title="Recalculate availability"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Mode Switcher: 3D Twin vs 2D Grid */}
          <div className="flex items-center bg-surface-2 p-0.5 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "3d"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>3D Twin</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("2d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "2d"
                  ? "bg-primary text-white shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <TableProperties className="h-3.5 w-3.5" />
              <span>2D Grid</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── MAIN WORKSPACE CONTENT ─── */}
      {viewMode === "3d" ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-h-[560px]">
          {/* Left/Center 3D Campus Canvas Viewport */}
          <div className="xl:col-span-8 min-h-[460px] xl:min-h-[580px] rounded-2xl overflow-hidden border border-border shadow-md relative bg-black">
            <CampusScene
              selectedBuildingId={selectedBuildingId}
              onSelectBuilding={(id) => {
                setSelectedBuildingId(id);
                setSelectedFloor("ALL");
              }}
              buildingAvailabilityMap={sceneAvailabilityMap}
            />

            {/* Quick Campus Zone Overlay Pills */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-surface/90 backdrop-blur-md border border-border text-[11px] font-semibold text-primary uppercase tracking-wider shadow-xs">
                North Campus &bull; Central Campus
              </span>
              {loading && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface/90 backdrop-blur-md border border-primary/40 text-[11px] font-medium text-primary shadow-xs">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Calculating availability...
                </span>
              )}
            </div>

            {/* Selected Time Interval Badge */}
            <div className="absolute bottom-4 left-4 z-10 bg-surface/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-border text-xs text-muted pointer-events-none hidden sm:block shadow-xs">
              Evaluated Window: <span className="font-semibold text-foreground">{queryInterval.startLocalStr} – {queryInterval.endLocalStr}</span>
            </div>
          </div>

          {/* Right Building Inspector Drawer */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            {activeBuilding ? (
              <div className={`rounded-2xl border ${activePalette?.borderClass || "border-border"} bg-surface p-4 sm:p-5 flex flex-col gap-4 shadow-sm h-full max-h-[620px] overflow-y-auto`}>
                {/* Building Header */}
                <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${activePalette?.badgeClass || "bg-primary/10 text-primary border border-primary/25"}`}>
                        {activeBuilding.code}
                      </span>
                      <span className="text-xs text-muted">{activeBuilding.campus}</span>
                      {activePalette?.theme && (
                        <span className="text-[11px] text-muted border-l border-border pl-2">
                          {activePalette.theme}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mt-1">
                      {activeBuilding.name}
                    </h3>
                    {activePalette?.architecturalStyle && (
                      <p className="text-xs text-muted italic mt-0.5">
                        {activePalette.architecturalStyle}
                      </p>
                    )}
                    <p className="text-xs text-muted mt-1 line-clamp-2">
                      {activeBuilding.description}
                    </p>
                  </div>
                </div>

                {/* Independent Facility Status Breakdown */}
                {activeBuildingAvail?.summary?.counts && (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                      <div className="text-base font-bold text-primary">
                        {displayCounts.available}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5 font-medium">
                        Available
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-warning/10 border border-warning/20">
                      <div className="text-base font-bold text-warning">
                        {displayCounts.occupied}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5 font-medium">
                        Occupied
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-danger/10 border border-danger/20">
                      <div className="text-base font-bold text-danger">
                        {displayCounts.maintenance}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5 font-medium">
                        Maint.
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-surface-2 border border-border">
                      <div className="text-base font-bold text-foreground">
                        {displayCounts.unknown}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5 font-medium">
                        Unverified
                      </div>
                    </div>
                  </div>
                )}

                {/* Floor Filter Tabs */}
                {buildingFloors.length > 1 && (
                  <div className="flex items-center gap-1.5 border-b border-border/40 pb-2 overflow-x-auto">
                    <span className="text-[11px] text-muted mr-1 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Floor:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFloor("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        selectedFloor === "ALL"
                          ? "bg-primary text-white"
                          : "text-muted hover:text-foreground hover:bg-surface-2"
                      }`}
                    >
                      All ({studentVisibleResources.length})
                    </button>
                    {buildingFloors.map((floor) => {
                      const count = studentVisibleResources.filter((r) => (r.floor || "1") === floor).length;
                      return (
                        <button
                          key={floor}
                          type="button"
                          onClick={() => setSelectedFloor(floor)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            selectedFloor === floor
                              ? "bg-primary text-white"
                              : "text-muted hover:text-foreground hover:bg-surface-2"
                          }`}
                        >
                          Floor {floor} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Facility Cards List */}
                <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
                  {filteredFacilities.map((r) => {
                    const statusMeta = getFacilityStatusMeta(r.availability?.visualStatus);
                    const isAvailable = r.availability?.available;
                    const bookUrl = `/dashboard/calendar?resourceId=${r.code}&startAt=${encodeURIComponent(
                      queryInterval.startAt
                    )}&endAt=${encodeURIComponent(queryInterval.endAt)}`;

                    return (
                      <div
                        key={r.code}
                        className="p-3 rounded-xl bg-surface-2/60 border border-border hover:border-primary/40 transition-colors flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-xs sm:text-sm">
                                {r.name}
                              </span>
                              <span className="font-mono text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface border border-border">
                                {r.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Floor {r.floor || "1"} • Room {r.roomNumber || r.code}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" /> {r.capacity} seats
                              </span>
                            </div>
                          </div>

                          {/* Operational Status Pill */}
                          <span
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusMeta.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                            {statusMeta.label}
                          </span>
                        </div>

                        {/* Booking Action Button */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                          <span className="text-[11px] text-muted">
                            {r.resourceType?.name || "Academic Facility"}
                          </span>

                          {isAvailable ? (
                            <Link
                              href={bookUrl}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary hover:bg-primary-bright text-white font-medium text-xs shadow-xs transition-colors"
                            >
                              <span>Book Slot</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[11px] text-muted italic"
                                title={r.availability?.message || statusMeta.description}
                              >
                                {r.availability?.visualStatus === "occupied"
                                  ? "Occupied for window"
                                  : r.availability?.visualStatus === "maintenance"
                                  ? "Under Maintenance"
                                  : r.availability?.reason === "TIMETABLE_CONFLICT"
                                  ? "Curriculum Class"
                                  : (r.availability?.message || "Unavailable")}
                              </span>
                              <Link
                                href={`/dashboard/calendar?resourceId=${r.code}&date=${encodeURIComponent(queryInterval.startAt)}`}
                                className="text-[11px] text-primary hover:text-primary-bright underline font-medium"
                              >
                                Schedule
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 flex flex-col items-center justify-center text-center h-full text-muted">
                <Compass className="h-10 w-10 text-muted mb-3" />
                <p className="text-sm font-medium text-foreground">Select a Building</p>
                <p className="text-xs max-w-xs mt-1">
                  Click on any 3D architectural model or marker to inspect building facilities and operational availability.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── 2D SCHEDULE MATRIX (ACCESSIBLE FALLBACK) ─── */
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border bg-surface-2/40 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground text-base">Comprehensive Facility Schedule Matrix</h3>
              <p className="text-xs text-muted mt-0.5">
                Complete accessible breakdown for interval {queryInterval.startLocalStr} – {queryInterval.endLocalStr}
              </p>
            </div>
            <span className="text-xs text-primary font-mono font-medium">
              Verified Campus Facilities
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-foreground">
              <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3">Building</th>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Floor & Room</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Evaluated Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {VERIFIED_CAMPUS_BUILDINGS.flatMap((b) => {
                  const bAvail = availabilityMap[b.name];
                  const bPalette = getBuildingArchitecturalPalette(b.code);
                  let resources = bAvail?.resources || b.resources.map((r) => ({
                    id: r.code,
                    code: r.code,
                    name: r.name,
                    type: r.type,
                    floor: r.floor,
                    roomNumber: r.roomNumber,
                    capacity: r.capacity,
                    roomCategory: r.roomCategory,
                    allowedRoles: r.allowedRoles,
                    availability: { visualStatus: "unknown", available: false },
                  }));

                  if (isStudent) {
                    resources = resources.filter((r) => !isFacultyOrHodRoom(r));
                  }

                  return resources.map((r) => {
                    const statusMeta = getFacilityStatusMeta(r.availability?.visualStatus);
                    const isAvailable = r.availability?.available;
                    const bookUrl = `/dashboard/calendar?resourceId=${r.code}&startAt=${encodeURIComponent(
                      queryInterval.startAt
                    )}&endAt=${encodeURIComponent(queryInterval.endAt)}`;

                    return (
                      <tr key={`${b.code}-${r.code}`} className="hover:bg-surface-2/60 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold mr-2 ${bPalette.badgeClass}`}>
                            {b.code}
                          </span>
                          <span className="font-medium text-foreground">{b.name}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {r.name} <span className="font-mono text-muted text-[11px]">({r.code})</span>
                        </td>
                        <td className="px-4 py-3 text-muted">{r.type || r.resourceType?.name || "Facility"}</td>
                        <td className="px-4 py-3">Floor {r.floor || "1"} • Room {r.roomNumber || r.code}</td>
                        <td className="px-4 py-3">{r.capacity} seats</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusMeta.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAvailable ? (
                            <Link
                              href={bookUrl}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary hover:bg-primary-bright text-white font-medium text-xs transition-colors shadow-xs"
                            >
                              Book
                            </Link>
                          ) : (
                            <span className="text-muted text-[11px] italic">Unavailable</span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
