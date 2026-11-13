"use client";
import React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ShieldAlert, Building2, MapPin, Check } from "lucide-react";

export function HolidayNoticeModal({ open, onClose, holiday, dateStr }) {
  if (!holiday) return null;

  const holidayName = holiday.name || "Official Campus Holiday";
  const holidayDate = holiday.date || dateStr || "Institutional Holiday";
  const reason = holiday.reason || "Official Institutional Closure";
  const scope = holiday.scope || "CAMPUS_WIDE";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Campus Holiday Closure"
      description={`Official institutional closure on ${holidayDate}`}
      size="md"
    >
      <div className="space-y-4">
        {/* Visual Header Card */}
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-surface-2 p-5 text-center space-y-3 shadow-lg">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <Badge variant="warning" className="uppercase tracking-wider font-bold text-[10px]">
              University Closed • No Bookings
            </Badge>
            <h3 className="text-lg font-bold text-foreground pt-1">{holidayName}</h3>
            <p className="text-xs text-amber-300 font-mono">{holidayDate}</p>
          </div>

          <div className="p-3 rounded-lg bg-surface/80 border border-border/70 text-left text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
              <span className="text-muted">Closure Scope:</span>
              <span className="font-semibold text-foreground">
                {scope === "CAMPUS_WIDE" ? "Entire Campus (All Blocks)" : scope.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-muted shrink-0">Official Reason:</span>
              <span className="text-right text-foreground font-medium">{reason}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted text-center max-w-sm mx-auto leading-relaxed">
          All campus facilities, laboratories, and lecture halls are closed on this date.
          Academic timetable sessions and ad-hoc room bookings are prohibited.
        </p>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            Understood
          </Button>
        </div>
      </div>
    </Modal>
  );
}
