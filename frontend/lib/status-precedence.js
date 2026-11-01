/**
 * CampusFlow - Centralized Digital Twin Status Precedence & Accessible Mappings
 *
 * Precedence Waterfall:
 * 1. MAINTENANCE (Red #EF4444)
 * 2. UNAVAILABLE (Grey #64748B)
 * 3. OCCUPIED (Amber #F59E0B)
 * 4. OCCUPIED_SOON (Amber Badge / Blue #3B82F6)
 * 5. AVAILABLE (Blue #3B82F6)
 * 6. UNKNOWN (Grey Striped #94A3B8 with alert - Fail-closed fallback)
 */

export const STATUS_META = {
  maintenance: {
    key: "maintenance",
    label: "Under Maintenance",
    hex: "#EF4444",
    threeColor: "#EF4444",
    badgeClass: "bg-red-500/15 text-red-400 border border-red-500/30",
    dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
    description: "Facility is closed for scheduled maintenance work.",
    accessibleText: "Under Maintenance. Not bookable.",
    bookable: false,
  },
  unavailable: {
    key: "unavailable",
    label: "Unavailable",
    hex: "#64748B",
    threeColor: "#64748B",
    badgeClass: "bg-slate-700/30 text-slate-400 border border-slate-600/40",
    dotClass: "bg-slate-500",
    description: "Facility is closed, outside operating hours, or reserved by academic timetable.",
    accessibleText: "Unavailable for the selected time window.",
    bookable: false,
  },
  occupied: {
    key: "occupied",
    label: "Occupied",
    hex: "#F59E0B",
    threeColor: "#F59E0B",
    badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    dotClass: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
    description: "In active use by another confirmed reservation.",
    accessibleText: "Currently occupied during this time.",
    bookable: false,
  },
  occupied_soon: {
    key: "occupied_soon",
    label: "Available (Occupied Soon)",
    hex: "#3B82F6",
    borderHex: "#F59E0B",
    threeColor: "#0284C7",
    badgeClass: "bg-blue-500/15 text-blue-300 border border-amber-500/50",
    dotClass: "bg-blue-500 ring-2 ring-amber-400",
    description: "Open for the requested slot; a subsequent booking begins shortly after.",
    accessibleText: "Available now, but occupied soon after.",
    bookable: true,
  },
  available: {
    key: "available",
    label: "Available",
    hex: "#3B82F6",
    threeColor: "#2563EB",
    badgeClass: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    dotClass: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]",
    description: "Open for immediate reservation.",
    accessibleText: "Available and ready to book.",
    bookable: true,
  },
  unknown: {
    key: "unknown",
    label: "Status Unknown",
    hex: "#94A3B8",
    threeColor: "#64748B",
    badgeClass: "bg-slate-800/60 text-slate-400 border border-dashed border-slate-600",
    dotClass: "bg-slate-500",
    description: "Availability could not be verified due to a technical error or missing schedule rule.",
    accessibleText: "Status unknown. Verification failed.",
    bookable: false,
  },
};

export const BUILDING_STATE_META = {
  fully_available: {
    label: "Fully Available",
    hex: "#2563EB",
    badgeClass: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    description: "All facilities in this building are available.",
  },
  partially_available: {
    label: "Partially Available",
    hex: "#0284C7",
    badgeClass: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    description: "Some facilities are open; others are reserved or offline.",
  },
  fully_occupied: {
    label: "Fully Occupied",
    hex: "#F59E0B",
    badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    description: "All facilities in this building are currently in use.",
  },
  maintenance_blocked: {
    label: "Under Maintenance",
    hex: "#EF4444",
    badgeClass: "bg-red-500/15 text-red-400 border border-red-500/30",
    description: "All facilities in this building are offline for maintenance.",
  },
  unavailable: {
    label: "Closed / Unavailable",
    hex: "#64748B",
    badgeClass: "bg-slate-700/30 text-slate-400 border border-slate-600/40",
    description: "Building is currently closed outside operating hours.",
  },
  indeterminate_warning: {
    label: "Verification Alert",
    hex: "#94A3B8",
    badgeClass: "bg-slate-800 text-amber-400 border border-dashed border-amber-500/40",
    description: "Some facilities could not be verified.",
  },
};

/**
 * Returns standard metadata for an individual facility status.
 */
export function getFacilityStatusMeta(visualStatus) {
  return STATUS_META[visualStatus] || STATUS_META.unknown;
}

/**
 * Returns standard metadata for an aggregate building status.
 */
export function getBuildingStateMeta(buildingVisualState) {
  return BUILDING_STATE_META[buildingVisualState] || BUILDING_STATE_META.unavailable;
}
