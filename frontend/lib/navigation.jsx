import {
  BarChart3,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Clock,
  Compass,
  Database,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from "lucide-react";

/**
 * Main application navigation items.
 * Filtered by user roles in the sidebar and mobile drawer.
 */
export const mainNavItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Resources",
    href: "/dashboard/resources",
    icon: <Database className="h-4 w-4" />,
  },
  {
    label: "Campus Map",
    href: "/dashboard/campus-map",
    icon: <Compass className="h-4 w-4" />,
  },
  {
    label: "My Bookings",
    href: "/dashboard/bookings",
    icon: <CalendarCheck className="h-4 w-4" />,
  },
  {
    label: "Calendar",
    href: "/dashboard/calendar",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    label: "Availability & Rules",
    href: "/dashboard/availability-rules",
    icon: <Clock className="h-4 w-4" />,
    roles: ["ADMIN", "FACILITY_MANAGER"],
  },
  {
    label: "Approvals Queue",
    href: "/dashboard/approvals",
    icon: <ClipboardList className="h-4 w-4" />,
    roles: ["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD"],
  },
  {
    label: "Approval Policies",
    href: "/dashboard/approval-policies",
    icon: <ShieldCheck className="h-4 w-4" />,
    roles: ["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD"],
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD"],
  },
];

/**
 * Secondary / utility navigation pinned to bottom of sidebar.
 */
export const bottomNavItems = [
  {
    label: "Settings & Profile",
    href: "/dashboard/settings",
    icon: <Settings className="h-4 w-4" />,
  },
];
