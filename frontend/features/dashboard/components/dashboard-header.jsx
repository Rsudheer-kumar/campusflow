"use client";

import Link from "next/link";
import {
  Building2,
  Calendar,
  CalendarDays,
  Compass,
  RefreshCw,
  UserCheck,
  Shield,
  GraduationCap,
  Briefcase,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatHeaderDate } from "../hooks/use-dashboard";

const ROLE_META = {
  STUDENT: {
    label: "Student",
    icon: GraduationCap,
    badgeClass: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  },
  FACULTY: {
    label: "Faculty Member",
    icon: UserCheck,
    badgeClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  },
  DEPARTMENT_HEAD: {
    label: "Department Head",
    icon: Briefcase,
    badgeClass: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  },
  FACILITY_MANAGER: {
    label: "Facility Manager",
    icon: Wrench,
    badgeClass: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  },
  ADMIN: {
    label: "Administrator",
    icon: Shield,
    badgeClass: "bg-primary/15 text-primary-bright border border-primary/30",
  },
};

export function DashboardHeader({
  user,
  activeRole,
  setActiveRole,
  timeZone,
  isRefreshing,
  onRefresh,
}) {
  const currentRoleMeta = ROLE_META[activeRole] || {
    label: activeRole?.replace(/_/g, " ") || "Member",
    icon: GraduationCap,
    badgeClass: "bg-surface-2 text-muted border border-border",
  };
  const RoleIcon = currentRoleMeta.icon;

  const userRoles = Array.isArray(user?.roles) ? user.roles : [];
  const hasMultipleRoles = userRoles.length > 1;

  return (
    <div className="space-y-4 pb-4 border-b border-border/60">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {user?.name ? `Welcome back, ${user.name}` : "Welcome to CampusFlow"}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide",
                currentRoleMeta.badgeClass
              )}
            >
              <RoleIcon className="h-3.5 w-3.5" />
              {currentRoleMeta.label}
            </span>
          </div>
          <p className="text-sm text-muted">
            {activeRole === "STUDENT" &&
              "Browse university facilities, book study spaces and laboratories, and track reservation statuses."}
            {activeRole === "FACULTY" &&
              "Coordinate teaching schedules, reserve classrooms and research labs, and monitor course session timetables."}
            {activeRole === "DEPARTMENT_HEAD" &&
              "Oversee departmental resource utilization, review student and staff reservations, and enforce booking governance."}
            {activeRole === "FACILITY_MANAGER" &&
              "Manage campus facility availability, coordinate maintenance service locks, and oversee physical space operations."}
            {activeRole === "ADMIN" &&
              "Comprehensive campus administration, approval policy governance, global booking oversight, and institutional analytics."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Institutional Date & Timezone */}
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

          {/* Quick Action Navigation */}
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

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh dashboard data"
            title="Refresh dashboard metrics"
            className="p-2 rounded-xl bg-surface hover:bg-surface-2 text-muted hover:text-foreground border border-border transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin text-primary")}
            />
          </button>
        </div>
      </div>

      {/* Role Switcher Bar for Multi-Role Users */}
      {hasMultipleRoles && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
          <span className="text-xs text-muted font-medium">
            Active Role Perspective:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {userRoles.map((role) => {
              const meta = ROLE_META[role] || { label: role };
              const isSelected = activeRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setActiveRole(role)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : "bg-surface text-muted hover:text-foreground border border-border"
                  )}
                >
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

