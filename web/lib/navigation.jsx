import { BarChart3, Boxes, Calendar, CalendarCheck, ClipboardList, Clock, Database, LayoutDashboard, Settings, ShieldCheck, User, Wrench, } from "lucide-react";
export const mainNavItems = [
    {
        label: "Dashboard",
        href: "/dashboard",
        icon: <LayoutDashboard className="h-4 w-4"/>,
    },
    {
        label: "Resources",
        href: "/dashboard/resources",
        icon: <Database className="h-4 w-4"/>,
    },
    {
        label: "Availability & Rules",
        href: "/dashboard/availability-rules",
        icon: <Clock className="h-4 w-4"/>,
        roles: ["ADMIN", "FACILITY_MANAGER"],
    },
    {
        label: "My Bookings",
        href: "/dashboard/bookings",
        icon: <CalendarCheck className="h-4 w-4"/>,
    },
    {
        label: "Calendar",
        href: "/dashboard/calendar",
        icon: <Calendar className="h-4 w-4"/>,
    },
    {
        label: "Approvals",
        href: "/dashboard/approvals",
        icon: <ClipboardList className="h-4 w-4"/>,
        roles: ["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD"],
    },
    {
        label: "Approval Policies",
        href: "/dashboard/approval-policies",
        icon: <ShieldCheck className="h-4 w-4"/>,
        roles: ["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD"],
    },
    {
        label: "Maintenance",
        href: "/dashboard/maintenance",
        icon: <Wrench className="h-4 w-4"/>,
        enabled: false, // Pending implementation (P20 Module 7)
    },
    {
        label: "Inventory",
        href: "/dashboard/inventory",
        icon: <Boxes className="h-4 w-4"/>,
        enabled: false, // Pending implementation (P20 Module 8)
    },
    {
        label: "Analytics",
        href: "/dashboard/analytics",
        icon: <BarChart3 className="h-4 w-4"/>,
        roles: ["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD"],
    },
];
export const bottomNavItems = [
    {
        label: "Settings",
        href: "/dashboard/settings",
        icon: <Settings className="h-4 w-4"/>,
    },
    {
        label: "Profile",
        href: "/dashboard/profile",
        icon: <User className="h-4 w-4"/>,
        enabled: false, // Pending implementation
    },
];
