"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Globe, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, logout, isLoading } = useAuth();

  // Close on click outside (unconditionally at top level)
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

  // Handle escape key (unconditionally at top level)
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Conditional returns AFTER all hooks have executed
  if (isLoading) {
    return <div className="h-9 w-9 rounded-full bg-surface-2 animate-pulse" />;
  }

  if (!user) {
    return (
      <Link href="/signin">
        <Button size="sm" variant="primary" className="text-xs font-medium">
          Sign In
        </Button>
      </Link>
    );
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CF";

  const primaryRole = user?.roles?.[0] || "STUDENT";

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
        <span className="text-sm font-semibold text-primary-bright">{initials}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-[var(--radius-lg)] border border-border bg-[#0B1224] py-1.5 shadow-2xl z-50 origin-top-right focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          style={{ animation: "fade-in var(--transition-fast) ease-out forwards" }}
        >
          {/* User Info Header */}
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-sm font-medium text-foreground">{user?.name || "CampusFlow User"}</p>
            <p className="truncate text-xs text-muted">{user?.email || "student@campusflow.edu"}</p>
            <span className="mt-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary-bright uppercase tracking-wider">
              {primaryRole}
            </span>
          </div>

          {/* Menu Items */}
          <div className="p-1 space-y-0.5">
            <Link
              href="/dashboard/settings"
              prefetch={true}
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-muted outline-none transition-colors hover:bg-white/[0.04] hover:text-foreground focus:bg-white/[0.04] focus:text-foreground"
              role="menuitem"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Settings & Profile
            </Link>
            <Link
              href="/"
              prefetch={true}
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
              onClick={async () => {
                setIsOpen(false);
                await logout();
                router.push("/dashboard");
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
