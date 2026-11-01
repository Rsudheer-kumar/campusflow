"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  LogOut,
  Globe,
  UserCheck,
  Shield,
  GraduationCap,
  Briefcase,
  Wrench,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, logout, switchRole, activeRole, setActiveRole } = useAuth();
  const isDev = process.env.NODE_ENV === "development";

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CF";

  const userRoles = Array.isArray(user?.roles) ? user.roles : [];
  const hasMultipleRoles = userRoles.length > 1;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Open user menu"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 border border-border shadow-sm outline-none transition-all duration-[var(--transition-fast)]",
          "focus-visible:ring-2 focus-visible:ring-primary/50",
          isOpen ? "ring-2 ring-primary/50" : "hover:bg-white/[0.06]"
        )}
      >
        <span className="text-sm font-semibold text-primary-bright">
          {initials}
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-[var(--radius-lg)] border border-border bg-[#0B1224] py-1.5 shadow-2xl z-50 origin-top-right focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          style={{ animation: "fade-in var(--transition-fast) ease-out forwards" }}
        >
          {/* User Info Header */}
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.name || "CampusFlow User"}
            </p>
            <p className="truncate text-xs text-muted">
              {user?.email || "student@campusflow.edu"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {userRoles.map((r) => (
                <span
                  key={r}
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border",
                    r === activeRole
                      ? "bg-primary/20 text-primary-bright border-primary/40"
                      : "bg-surface-2 text-muted border-border"
                  )}
                >
                  {r.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>

          {/* Perspective Switcher for Multi-Role Users */}
          {hasMultipleRoles && (
            <div className="px-3 py-2 border-b border-border/50 bg-surface-2/20">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                Switch Active View
              </p>
              <div className="flex flex-wrap gap-1">
                {userRoles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setActiveRole(role);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs transition-colors font-medium",
                      activeRole === role
                        ? "bg-primary text-white"
                        : "bg-surface-2 text-muted hover:text-foreground border border-border"
                    )}
                  >
                    {role.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Development-Only Demo Switcher */}
          {isDev && (
            <div className="px-3 py-2 border-b border-border/50 bg-amber-500/5">
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
                Dev Identity Simulator
              </p>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    switchRole("STUDENT");
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 rounded transition-colors",
                    activeRole === "STUDENT"
                      ? "bg-primary/20 text-primary-bright border border-primary/40 font-medium"
                      : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                  )}
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    switchRole("FACULTY");
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 rounded transition-colors",
                    activeRole === "FACULTY"
                      ? "bg-primary/20 text-primary-bright border border-primary/40 font-medium"
                      : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                  )}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Faculty</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    switchRole("DEPARTMENT_HEAD");
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 rounded transition-colors",
                    activeRole === "DEPARTMENT_HEAD"
                      ? "bg-primary/20 text-primary-bright border border-primary/40 font-medium"
                      : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                  )}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>Dept Head</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    switchRole("FACILITY_MANAGER");
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 rounded transition-colors",
                    activeRole === "FACILITY_MANAGER"
                      ? "bg-primary/20 text-primary-bright border border-primary/40 font-medium"
                      : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                  )}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Facility Mgr</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    switchRole("ADMIN");
                    setIsOpen(false);
                  }}
                  className={cn(
                    "col-span-2 flex items-center justify-center gap-1.5 p-1.5 rounded transition-colors",
                    activeRole === "ADMIN"
                      ? "bg-primary/20 text-primary-bright border border-primary/40 font-medium"
                      : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                  )}
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>Administrator</span>
                </button>
              </div>
            </div>
          )}

          {/* Menu Items */}
          <div className="p-1 space-y-0.5">
            <Link
              href="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-muted outline-none transition-colors hover:bg-white/[0.04] hover:text-foreground focus:bg-white/[0.04] focus:text-foreground"
              role="menuitem"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Settings &amp; Profile
            </Link>

            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-muted outline-none transition-colors hover:bg-white/[0.04] hover:text-foreground focus:bg-white/[0.04] focus:text-foreground"
              role="menuitem"
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              Landing Page
            </Link>
          </div>

          <div className="border-t border-border p-1">
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-danger outline-none transition-colors hover:bg-danger/10 focus:bg-danger/10"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
