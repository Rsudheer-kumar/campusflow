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
  const [selectedBuildingId, setSelectedBuildingId] = useState("bld-turing");
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [startTime, setStartTime] = useState("09:00");
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

  // Distinct floors available in the inspected building
  const buildingFloors = useMemo(() => {
    if (!activeBuildingAvail?.resources) return [];
    const floors = new Set(activeBuildingAvail.resources.map((r) => r.floor || "1"));
    return Array.from(floors).sort();
  }, [activeBuildingAvail]);

  // Filtered facilities based on floor tab
  const filteredFacilities = useMemo(() => {
    if (!activeBuildingAvail?.resources) return [];
    if (selectedFloor === "ALL") return activeBuildingAvail.resources;
    return activeBuildingAvail.resources.filter((r) => (r.floor || "1") === selectedFloor);
  }, [activeBuildingAvail, selectedFloor]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* ─── Workspace Header Controls ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-card/80 backdrop-blur-md border border-border/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Campus Digital Twin & Facility Operations
              </h2>
              {standalone && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-medium text-blue-400">
                  Full View
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Interactive 3D architectural models, real-time slot occupancy, and facility reservation dispatch.
            </p>
          </div>
        </div>

        {/* Time Window Controls & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-background/80 border border-border/70 text-xs">
            <Calendar className="h-3.5 w-3.5 text-blue-400" />
            <input
              type="date"
              aria-label="Reservation Date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white text-xs outline-none cursor-pointer"
            />
          </div>

          {/* Time Picker */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-background/80 border border-border/70 text-xs">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <input
              type="time"
              aria-label="Start Time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-transparent text-white text-xs outline-none cursor-pointer"
            />
          </div>

          {/* Duration Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-background/80 border border-border/70 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <select
              aria-label="Booking Duration"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="bg-transparent text-white outline-none cursor-pointer text-xs"
            >
              <option value={30} className="bg-slate-900">30m</option>
              <option value={60} className="bg-slate-900">1 hour</option>
              <option value={120} className="bg-slate-900">2 hours</option>
              <option value={180} className="bg-slate-900">3 hours</option>
              <option value={240} className="bg-slate-900">4 hours</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchAvailability}
            disabled={loading}
            aria-label="Refresh availability data"
            className="p-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition-colors disabled:opacity-50"
            title="Recalculate availability"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Mode Switcher: 3D Twin vs 2D Grid */}
          <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "3d"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-muted-foreground hover:text-white"
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
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <TableProperties className="h-3.5 w-3.5" />
              <span>2D Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Procedural Geometry Disclaimer Banner ─── */}
      <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-slate-300 text-xs">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="flex-1 leading-relaxed">
          <span className="font-semibold text-white">Illustrative Digital Twin: </span>
          {CAMPUS_GEOMETRY_DISCLAIMER}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── MAIN WORKSPACE CONTENT ─── */}
      {viewMode === "3d" ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-h-[560px]">
          {/* Left/Center 3D Campus Canvas Viewport */}
          <div className="xl:col-span-8 min-h-[460px] xl:min-h-[580px] rounded-2xl overflow-hidden border border-border/80 shadow-2xl relative bg-[#050816]">
            <CampusScene
              selectedBuildingId={selectedBuildingId}
              onSelectBuilding={(id) => {
                setSelectedBuildingId(id);
                setSelectedFloor("ALL");
              }}
              buildingAvailabilityMap={availabilityMap}
            />

            {/* Quick Campus Zone Overlay Pills */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-[11px] font-semibold text-blue-400 uppercase tracking-wider shadow-sm">
                North Campus &bull; Central Campus
              </span>
              {loading && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/85 backdrop-blur-md border border-blue-500/40 text-[11px] font-medium text-blue-200 shadow-sm">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Calculating availability...
                </span>
              )}
            </div>

            {/* Selected Time Interval Badge */}
            <div className="absolute bottom-4 left-4 z-10 bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 pointer-events-none hidden sm:block shadow-md">
              Evaluated Window: <span className="font-semibold text-white">{queryInterval.startLocalStr} – {queryInterval.endLocalStr}</span>
            </div>
          </div>

          {/* Right Building Inspector Drawer */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            {activeBuilding ? (
              <div className={`rounded-2xl border ${activePalette?.borderClass || "border-border/80"} bg-card/95 backdrop-blur-md p-4 sm:p-5 flex flex-col gap-4 shadow-xl h-full max-h-[620px] overflow-y-auto`}>
                {/* Building Header */}
                <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${activePalette?.badgeClass || "bg-blue-500/10 text-blue-400"}`}>
                        {activeBuilding.code}
                      </span>
                      <span className="text-xs text-muted-foreground">{activeBuilding.campus}</span>
                      {activePalette?.theme && (
                        <span className="text-[11px] text-slate-400 border-l border-slate-750 pl-2">
                          {activePalette.theme}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">
                      {activeBuilding.name}
                    </h3>
                    {activePalette?.architecturalStyle && (
                      <p className="text-xs text-slate-400 italic mt-0.5">
                        {activePalette.architecturalStyle}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {activeBuilding.description}
                    </p>
                  </div>
                </div>

                {/* Independent Facility Status Breakdown */}
                {activeBuildingAvail?.summary?.counts && (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="text-base font-bold text-blue-400">
                        {activeBuildingAvail.summary.counts.available}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
                        Available
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="text-base font-bold text-amber-400">
                        {activeBuildingAvail.summary.counts.occupied}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
                        Occupied
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                      <div className="text-base font-bold text-red-400">
                        {activeBuildingAvail.summary.counts.maintenance}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
                        Maint.
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
                      <div className="text-base font-bold text-slate-300">
                        {activeBuildingAvail.summary.counts.unknown}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
                        Unverified
                      </div>
                    </div>
                  </div>
                )}

                {/* Floor Filter Tabs */}
                {buildingFloors.length > 1 && (
                  <div className="flex items-center gap-1.5 border-b border-border/40 pb-2 overflow-x-auto">
                    <span className="text-[11px] text-muted-foreground mr-1 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Floor:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFloor("ALL")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        selectedFloor === "ALL"
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                      }`}
                    >
                      All ({activeBuildingAvail?.resources?.length || 0})
                    </button>
                    {buildingFloors.map((floor) => {
                      const count = activeBuildingAvail.resources.filter((r) => (r.floor || "1") === floor).length;
                      return (
                        <button
                          key={floor}
                          type="button"
                          onClick={() => setSelectedFloor(floor)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            selectedFloor === floor
                              ? "bg-blue-600 text-white"
                              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
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
                        className="p-3 rounded-xl bg-background/60 border border-border/70 hover:border-blue-500/40 transition-colors flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-xs sm:text-sm">
                                {r.name}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/80">
                                {r.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
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
                          <span className="text-[11px] text-slate-400">
                            {r.resourceType?.name || "Academic Facility"}
                          </span>

                          {isAvailable ? (
                            <Link
                              href={bookUrl}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-colors"
                            >
                              <span>Book Slot</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              {r.availability?.visualStatus === "occupied"
                                ? "Occupied for window"
                                : r.availability?.visualStatus === "maintenance"
                                ? "Under Maintenance"
                                : "Unavailable"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 flex flex-col items-center justify-center text-center h-full text-muted-foreground">
                <Compass className="h-10 w-10 text-slate-600 mb-3" />
                <p className="text-sm font-medium text-white">Select a Building</p>
                <p className="text-xs max-w-xs mt-1">
                  Click on any 3D architectural model or marker to inspect building facilities and operational availability.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── 2D SCHEDULE MATRIX (ACCESSIBLE FALLBACK) ─── */
        <div className="rounded-2xl border border-border/80 bg-card/90 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-border/60 bg-slate-900/40 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Comprehensive Facility Schedule Matrix</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Complete accessible breakdown for interval {queryInterval.startLocalStr} – {queryInterval.endLocalStr}
              </p>
            </div>
            <span className="text-xs text-blue-400 font-mono">
              {VERIFIED_CAMPUS_BUILDINGS.reduce((acc, b) => acc + (b.resources?.length || 0), 0)} Verified Campus Resources
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-border/60">
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
              <tbody className="divide-y divide-border/40">
                {VERIFIED_CAMPUS_BUILDINGS.flatMap((b) => {
                  const bAvail = availabilityMap[b.name];
                  const bPalette = getBuildingArchitecturalPalette(b.code);
                  const resources = bAvail?.resources || b.resources.map((r) => ({
                    id: r.code,
                    code: r.code,
                    name: r.name,
                    type: r.type,
                    floor: r.floor,
                    roomNumber: r.roomNumber,
                    capacity: r.capacity,
                    availability: { visualStatus: "unknown", available: false },
                  }));

                  return resources.map((r) => {
                    const statusMeta = getFacilityStatusMeta(r.availability?.visualStatus);
                    const isAvailable = r.availability?.available;
                    const bookUrl = `/dashboard/calendar?resourceId=${r.code}&startAt=${encodeURIComponent(
                      queryInterval.startAt
                    )}&endAt=${encodeURIComponent(queryInterval.endAt)}`;

                    return (
                      <tr key={`${b.code}-${r.code}`} className="hover:bg-slate-900/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold mr-2 ${bPalette.badgeClass}`}>
                            {b.code}
                          </span>
                          <span className="font-medium text-white">{b.name}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {r.name} <span className="font-mono text-slate-400 text-[11px]">({r.code})</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{r.type || r.resourceType?.name || "Facility"}</td>
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
                            >
                              Book
                            </Link>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">Unavailable</span>
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
