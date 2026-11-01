"use client";

import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

const VARIANT_MAP = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    hoverBorder: "hover:border-blue-500/40",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    hoverBorder: "hover:border-emerald-500/40",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
    hoverBorder: "hover:border-purple-500/40",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    hoverBorder: "hover:border-amber-500/40",
  },
  primary: {
    bg: "bg-primary/10",
    border: "border-primary/20",
    text: "text-primary-bright",
    hoverBorder: "hover:border-primary/40",
  },
};

export function MetricCard({
  title,
  value,
  icon: Icon,
  subtext,
  href,
  variant = "blue",
  isLoading = false,
  error = null,
  className,
}) {
  const styles = VARIANT_MAP[variant] || VARIANT_MAP.blue;

  const content = (
    <Card
      className={cn(
        "h-full border-border/80 bg-surface/90 backdrop-blur-sm p-4 flex flex-col justify-between shadow-sm transition-all",
        href && cn("group hover:shadow-md cursor-pointer", styles.hoverBorder),
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-medium text-muted uppercase tracking-wider block truncate">
            {title}
          </span>
          <div className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : error ? (
              <span className="text-muted text-base flex items-center gap-1">
                — <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              </span>
            ) : value !== null && value !== undefined ? (
              <span className={cn("font-mono", styles.text)}>{value}</span>
            ) : (
              <span className="text-muted text-lg">—</span>
            )}
          </div>
        </div>

        {Icon && (
          <div
            className={cn(
              "p-2 rounded-xl border shrink-0 transition-transform",
              styles.bg,
              styles.border,
              styles.text,
              href && "group-hover:scale-105"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted pt-2 border-t border-border/40 mt-2 truncate">
        <span className="truncate">{subtext || "Platform Metric"}</span>
        {href && (
          <span
            className={cn(
              "shrink-0 flex items-center transition-transform",
              styles.text,
              "group-hover:translate-x-0.5"
            )}
          >
            <ArrowRight className="h-2.5 w-2.5 ml-1" />
          </span>
        )}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}

