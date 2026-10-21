"use client";

import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { CampusWorkspace } from "@/components/campus/campus-workspace";

export default function CampusMapPage() {
  return (
    <div className="min-h-full py-6 sm:py-8 grid-background">
      <PageContainer className="space-y-6 max-w-[1600px] mx-auto">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl bg-surface hover:bg-surface-2 text-muted hover:text-foreground border border-border transition-colors group"
              title="Return to Main Dashboard"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-blue-400" />
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Campus Digital Twin — Dedicated View
                </h1>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Full-screen spatial operations workspace with 3D architectural models, floor filtering, and real-time facility inspection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-2 text-xs font-medium text-foreground border border-border transition-colors"
            >
              <span>Dashboard Overview</span>
            </Link>
          </div>
        </div>

        {/* Unified Campus Operations Workspace */}
        <CampusWorkspace standalone={true} />
      </PageContainer>
    </div>
  );
}
