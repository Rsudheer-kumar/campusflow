"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft, LogOut, RefreshCw } from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export function AccessDenied({
  title = "Access Restricted",
  description = "You do not have the required permissions to access this administrative portal.",
  requiredRoles = [],
}) {
  const { user, logout, activeRole, setActiveRole } = useAuth();

  const otherAvailableRoles = (user?.roles || []).filter(
    (r) => r !== activeRole && (requiredRoles.length === 0 || requiredRoles.includes(r))
  );

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center bg-[#0B1224]/90 border-border/80 shadow-2xl backdrop-blur-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-5 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <ShieldAlert className="h-8 w-8" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
          {title}
        </h2>

        <p className="text-sm text-muted leading-relaxed mb-6">
          {description}
        </p>

        {requiredRoles.length > 0 && (
          <div className="mb-6 p-3.5 rounded-xl bg-surface-2/40 border border-border/60 text-xs">
            <span className="text-muted block mb-1.5 font-medium">
              Required Privilege Tier:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {requiredRoles.map((role) => (
                <Badge key={role} variant="neutral" className="font-mono text-[11px]">
                  {role.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {otherAvailableRoles.length > 0 && (
          <div className="mb-6 p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs text-primary-bright">
            <span>You possess an assigned role that can view this page: </span>
            <div className="mt-2 flex justify-center gap-2">
              {otherAvailableRoles.map((r) => (
                <Button
                  key={r}
                  size="xs"
                  variant="primary"
                  onClick={() => setActiveRole(r)}
                  icon={<RefreshCw className="h-3 w-3" />}
                >
                  Switch to {r.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Dashboard Overview
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto text-muted hover:text-danger hover:border-danger/40"
            onClick={() => logout()}
            icon={<LogOut className="h-4 w-4" />}
          >
            Switch Account
          </Button>
        </div>
      </Card>
    </div>
  );
}

