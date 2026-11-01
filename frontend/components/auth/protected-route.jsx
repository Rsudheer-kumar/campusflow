"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AccessDenied } from "./access-denied";
import { Skeleton } from "@/components/ui";

export function ProtectedRoute({
  children,
  requiredRoles = [],
  fallback = null,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const query = typeof window !== "undefined" ? window.location.search : "";
      const fullPath = query ? `${pathname}${query}` : pathname;
      const destination = `/signin?redirect=${encodeURIComponent(fullPath)}`;
      router.replace(destination);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  // Prevent flash of unauthorized or unauthenticated content while initializing session
  if (isLoading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 animate-pulse flex items-center justify-center text-primary-bright">
          <div className="h-4 w-4 bg-primary rounded-sm animate-ping" />
        </div>
        <div className="space-y-2 text-center max-w-xs">
          <Skeleton className="h-4 w-40 mx-auto" />
          <Skeleton className="h-3 w-28 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Role validation if specific privileges are demanded
  if (requiredRoles.length > 0) {
    const userRoles = Array.isArray(user?.roles) ? user.roles : [];
    const hasPermission = userRoles.some((r) => requiredRoles.includes(r));

    if (!hasPermission) {
      if (fallback) return fallback;
      return (
        <AccessDenied
          title="Administrative Permission Required"
          description="Your current institutional profile lacks the specific role required to view this operational section."
          requiredRoles={requiredRoles}
        />
      );
    }
  }

  return children;
}
