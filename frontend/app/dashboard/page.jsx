"use client";

import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { StudentDashboard } from "@/features/dashboard/components/student-dashboard";
import { FacultyDashboard } from "@/features/dashboard/components/faculty-dashboard";
import { DepartmentHeadDashboard } from "@/features/dashboard/components/department-head-dashboard";
import { FacilityManagerDashboard } from "@/features/dashboard/components/facility-manager-dashboard";
import { AdminDashboard } from "@/features/dashboard/components/admin-dashboard";
import { PageContainer } from "@/components/layout";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { setActiveRole } = useAuth();
  const dashboard = useDashboard();
  const { user, activeRole, timeZone, isRefreshing, refresh, status } = dashboard;

  // Identify any failed queries to surface clean notification without breaking the dashboard
  const partialErrors = Object.entries(status)
    .filter(([, s]) => s.error)
    .map(([key, s]) => ({ key, message: s.error }));

  return (
    <div className="min-h-full py-6 sm:py-8 grid-background">
      <PageContainer className="space-y-6 max-w-[1600px] mx-auto">
        {/* ─── Role-Aware Dashboard Header ─── */}
        <DashboardHeader
          user={user}
          activeRole={activeRole}
          setActiveRole={setActiveRole}
          timeZone={timeZone}
          isRefreshing={isRefreshing}
          onRefresh={refresh}
        />

        {/* ─── Partial Network Failure Alert ─── */}
        {partialErrors.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Partial Connectivity Notice: Some secondary metrics could not be loaded. Showing available data.
              </span>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="text-amber-200 underline hover:text-white font-medium shrink-0 self-start sm:self-auto"
            >
              Retry
            </button>
          </div>
        )}

        {/* ─── Distinct Role-Specific Composition ─── */}
        {activeRole === "STUDENT" && <StudentDashboard dashboard={dashboard} />}
        {activeRole === "FACULTY" && <FacultyDashboard dashboard={dashboard} />}
        {activeRole === "DEPARTMENT_HEAD" && (
          <DepartmentHeadDashboard dashboard={dashboard} />
        )}
        {activeRole === "FACILITY_MANAGER" && (
          <FacilityManagerDashboard dashboard={dashboard} />
        )}
        {activeRole === "ADMIN" && <AdminDashboard dashboard={dashboard} />}

        {/* Fallback for unrecognized role */}
        {!["STUDENT", "FACULTY", "DEPARTMENT_HEAD", "FACILITY_MANAGER", "ADMIN"].includes(
          activeRole
        )}
      </PageContainer>
    </div>
  );
}
