"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertCircle, ShieldAlert, Check } from "lucide-react";
import { api } from "@/lib/api";

export function DeclareHolidayModal({ open, onClose, onSuccess, initialStartDate }) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState(initialStartDate || "");
  const [endDate, setEndDate] = useState(initialStartDate || "");
  const [scope, setScope] = useState("CAMPUS_WIDE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !reason.trim() || !startDate) {
      setError("Please provide holiday name, reason, and start date.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.holidays.declare({
        name: name.trim(),
        reason: reason.trim(),
        startDate,
        endDate: endDate || startDate,
        scope,
        isUniversityClosed: true,
      });

      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to declare campus holiday.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
    setReason("");
    setError(null);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Declare Campus Holiday"
      description="Administrator tool to declare unexpected university closures, local holidays, or academic breaks."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 rounded-lg bg-surface-2/60 border border-border text-xs space-y-1">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            Administrative Holiday Policy
          </span>
          <p className="text-[11px] text-muted">
            Declaring a campus holiday blocks future bookings across the chosen scope. Any existing reservations falling in this date range will be preserved and flagged for administrative review.
          </p>
        </div>

        {/* Holiday Name */}
        <Input
          label="Holiday Name"
          required
          placeholder="e.g. Winter Break, Emergency Storm Closure, Local Festival"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Date Range Selectors */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start Date"
            type="date"
            required
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || endDate < e.target.value) {
                setEndDate(e.target.value);
              }
            }}
          />
          <Input
            label="End Date"
            type="date"
            required
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Reason */}
        <Textarea
          label="Administrative Reason"
          required
          rows={2}
          placeholder="e.g. Year-end institutional recess approved by University Academic Council..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {/* Scope Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Holiday Scope</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setScope("CAMPUS_WIDE")}
              className={`p-2.5 rounded-lg border text-left transition-colors ${
                scope === "CAMPUS_WIDE"
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              <span className="block font-medium">Campus-Wide</span>
              <span className="text-[10px] opacity-80">All blocks &amp; facilities</span>
            </button>

            <button
              type="button"
              onClick={() => setScope("SPECIFIC_BLOCKS")}
              className={`p-2.5 rounded-lg border text-left transition-colors ${
                scope === "SPECIFIC_BLOCKS"
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              <span className="block font-medium">Selected Blocks</span>
              <span className="text-[10px] opacity-80">Block A, B, C or D</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || !name.trim() || !startDate}>
            {isSubmitting ? "Publishing Holiday..." : "Publish Campus Holiday"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
