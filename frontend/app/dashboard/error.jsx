"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { PageContainer } from "@/components/layout";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error("Dashboard error caught by boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <PageContainer className="max-w-md w-full">
        <Card className="p-8 text-center bg-[#0B1224]/95 border-border shadow-2xl backdrop-blur-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 border border-danger/30 text-danger mb-4 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <AlertTriangle className="h-8 w-8" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Something went wrong
          </h2>

          <p className="text-sm text-muted leading-relaxed mb-6">
            {error?.message ||
              "An unexpected error occurred while rendering the dashboard. Please try again or return to the main portal."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => reset()}
              icon={<RefreshCw className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Try Again
            </Button>

            <Link href="/" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                icon={<Home className="h-4 w-4" />}
                className="w-full sm:w-auto"
              >
                Campus Home
              </Button>
            </Link>
          </div>
        </Card>
      </PageContainer>
    </div>
  );
}

