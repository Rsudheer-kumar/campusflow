"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function AuthGuard({ children }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/signin?redirect=${encodeURIComponent(pathname || "/dashboard")}`);
    }
  }, [user, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050816] text-[#F8FAFC] flex flex-col items-center justify-center selection:bg-[#4F8CFF]/30">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-xs text-muted tracking-wide animate-pulse">
          Authenticating university session...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050816] text-[#F8FAFC] flex flex-col items-center justify-center selection:bg-[#4F8CFF]/30">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-xs text-muted tracking-wide">
          Redirecting to Sign In...
        </p>
      </div>
    );
  }

  return children;
}
