"use client";
import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Building2, ShieldCheck, Wrench } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { resolveReservationTimezone } from "@/lib/utils";
function getInitialValues(initialStartAt, initialEndAt) {
    if (initialStartAt && initialEndAt) {
        const s = new Date(initialStartAt);
        const e = new Date(initialEndAt);
        const yyyy = s.getUTCFullYear();
        const mm = String(s.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(s.getUTCDate()).padStart(2, "0");
        const sH = String(s.getUTCHours()).padStart(2, "0");
        const sM = String(s.getUTCMinutes()).padStart(2, "0");
        const eH = String(e.getUTCHours()).padStart(2, "0");
        const eM = String(e.getUTCMinutes()).padStart(2, "0");
        return {
            date: `${yyyy}-${mm}-${dd}`,
            startTime: `${sH}:${sM}`,
            endTime: `${eH}:${eM}`,
        };
    }
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const nextHour = Math.min(20, Math.max(8, now.getUTCHours() + 1));
    return {
        date: `${yyyy}-${mm}-${dd}`,
        startTime: `${String(nextHour).padStart(2, "0")}:00`,
        endTime: `${String(Math.min(21, nextHour + 1)).padStart(2, "0")}:00`,
    };
}

function BookingModalContent({ open, onClose, resource, initialStartAt, initialEndAt, onSuccess, }) {
    if (resource?.status === "MAINTENANCE") {
        return (
            <Modal open={open} onClose={onClose} title="Facility Under Maintenance" description={`Maintenance lock on ${resource.name} (${resource.code})`} size="md">
                <div className="py-6 px-4 text-center space-y-4">
                    <div className="mx-auto h-12 w-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                        <Wrench className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Facility Currently Under Maintenance
                        </h3>
                        <p className="text-sm text-muted mt-1.5 leading-relaxed max-w-sm mx-auto">
                            <strong>{resource.name} ({resource.code})</strong> is currently undergoing scheduled maintenance. Reservations cannot be booked until maintenance is completed.
                        </p>
                    </div>
                    <div className="pt-2 flex justify-center">
                        <Button variant="secondary" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>
        );
    }
    const [initial] = useState(() => getInitialValues(initialStartAt, initialEndAt));
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState(initial.date);
    const [startTime, setStartTime] = useState(initial.startTime);
    const [endTime, setEndTime] = useState(initial.endTime);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [conflictError, setConflictError] = useState(null);
    const handleClose = () => {
        setConflictError(null);
        onClose();
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!resource)
            return;
        setConflictError(null);
        setIsSubmitting(true);
        try {
            const [sH, sM] = startTime.split(":").map(Number);
            const [eH, eM] = endTime.split(":").map(Number);
            const [y, m, d] = date.split("-").map(Number);
            const startAtDate = new Date(Date.UTC(y, m - 1, d, sH, sM, 0, 0));
            const endAtDate = new Date(Date.UTC(y, m - 1, d, eH, eM, 0, 0));
            if (startAtDate >= endAtDate) {
                setConflictError({
                    code: "INVALID_INTERVAL",
                    message: "End time must be strictly later than start time.",
                    isTimetable: false,
                });
                setIsSubmitting(false);
                return;
            }
            if (startAtDate.getTime() < Date.now()) {
                setConflictError({
                    code: "PAST_TIME_DISALLOWED",
                    message: "Cannot create reservations in the past. Please select an upcoming date and time.",
                    isTimetable: false,
                });
                setIsSubmitting(false);
                return;
            }
            const res = await api.bookings.create({
                resourceId: resource._id,
                title: title.trim(),
                description: description.trim() || undefined,
                startAt: startAtDate.toISOString(),
                endAt: endAtDate.toISOString(),
                timezone: resolveReservationTimezone(resource),
            });
            onSuccess(res.booking);
            handleClose();
        }
        catch (err) {
            if (err instanceof ApiError) {
                const isAuthError = err.status === 401 ||
                    err.code === "UNAUTHORIZED" ||
                    err.message.toLowerCase().includes("authorization header") ||
                    err.message.toLowerCase().includes("bearer token");
                const isTimetableConflict = err.code === "TIMETABLE_CONFLICT" ||
                    err.message.includes("TIMETABLE_CONFLICT") ||
                    err.message.toLowerCase().includes("academic timetable");
                const isNoShowSuspension = err.code === "NO_SHOW_RESTRICTION_ACTIVE" ||
                    err.message.includes("unexcused no-shows");
                let formattedMessage = isAuthError
                    ? "You must be signed in with your university account to reserve facilities. Your session may have expired."
                    : isTimetableConflict
                    ? "Academic Timetable Conflict: This facility is reserved for an authoritative institutional curriculum session during this period. Academic courses take precedence over ad-hoc user reservations."
                    : err.message;
                if (isNoShowSuspension) {
                    // Format raw ISO timestamps into human-readable date/time string
                    formattedMessage = formattedMessage.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, (iso) => {
                        const d = new Date(iso);
                        return isNaN(d.getTime())
                            ? iso
                            : new Intl.DateTimeFormat("en-US", {
                                dateStyle: "medium",
                                timeStyle: "short",
                            }).format(d);
                    });
                }
                setConflictError({
                    code: err.code,
                    message: formattedMessage,
                    isTimetable: isTimetableConflict,
                    isNoShowSuspension,
                    isAuth: isAuthError,
                });
            }
            else {
                setConflictError({
                    code: "UNKNOWN_ERROR",
                    message: err instanceof Error ? err.message : "Failed to create booking",
                    isTimetable: false,
                });
            }
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (<Modal open={open} onClose={handleClose} title="Create Resource Reservation" description={resource
            ? `Booking ${resource.name} (${resource.code}) in ${resource.location?.building}`
            : "Reserve campus facility"} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="space-y-4">
          {/* Timetable or General Conflict Error Banner */}
          {conflictError && (<div className={`p-3.5 rounded-[var(--radius-md)] border text-sm flex items-start gap-3 animate-fade-in ${conflictError.isTimetable || conflictError.isNoShowSuspension || conflictError.isAuth
                ? "bg-danger/10 border-danger/40 text-danger"
                : "bg-warning/10 border-warning/40 text-warning"}`}>
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5"/>
              <div className="space-y-2 w-full">
                <div>
                  <p className="font-semibold leading-tight">
                    {conflictError.isAuth
                  ? "Authentication Required (HTTP 401)"
                  : conflictError.isTimetable
                  ? "Institutional Timetable Conflict (HTTP 409)"
                  : conflictError.isNoShowSuspension
                      ? "Booking Privileges Suspended (No-Show Policy)"
                      : "Reservation Conflict"}
                  </p>
                  <p className="text-xs leading-relaxed opacity-90 mt-0.5">{conflictError.message}</p>
                </div>
                {conflictError.isAuth && (
                  <div>
                    <Link href="/signin">
                      <Button size="sm" variant="primary" type="button">
                        Sign In with Institutional Account
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>)}

          {/* Resource Badge Info */}
          {resource && (<div className="flex items-center gap-2 p-2.5 rounded-[var(--radius-sm)] bg-surface-2/60 border border-border/50 text-xs text-muted">
              <Building2 className="h-4 w-4 text-primary"/>
              <span className="font-medium text-foreground">{resource.name}</span>
              <span>•</span>
              <span>Capacity: {resource.capacity} seats</span>
              <span>•</span>
              <span>Room {resource.location?.roomNumber || resource.code}</span>
            </div>)}

          {/* Title */}
          <Input label="Reservation Title" required placeholder="e.g. CS Study Group, Research Project Review" value={title} onChange={(e) => setTitle(e.target.value)}/>

          {/* Date & Time Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)}/>

            <Input label="Start Time (UTC)" type="time" required step="1800" value={startTime} onChange={(e) => setStartTime(e.target.value)}/>

            <Input label="End Time (UTC)" type="time" required step="1800" value={endTime} onChange={(e) => setEndTime(e.target.value)}/>
          </div>

          {/* Description */}
          <Textarea label="Purpose / Notes (Optional)" rows={2} placeholder="Describe the activity, equipment requirements, or attendee details..." value={description} onChange={(e) => setDescription(e.target.value)}/>

          <div className="space-y-1.5 pt-0.5">
            <div className="text-[11px] text-muted flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary/70 shrink-0"/>
              <span>
                Institutional timetable sessions are authoritative. Bookings conflicting with published
                courses will be automatically rejected.
              </span>
            </div>
            <div className="text-[11px] text-muted flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success/70 shrink-0"/>
              <span>
                Approval Policy &amp; Slot Hold: Student reservations require approval by faculty and administration before confirmation. Your reservation enters PENDING state while holding this slot against competing bookings.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions - Pinned and clearly visible */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 pt-4 mt-4 border-t border-border/60 bg-surface-elevated/95 backdrop-blur-xs">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || !title.trim() || !resource}>
            {isSubmitting ? "Verifying & Reserving..." : "Confirm Reservation"}
          </Button>
        </div>
      </form>
    </Modal>);
}

export function BookingModal(props) {
    if (!props.open)
        return null;
    return <BookingModalContent key={`${props.initialStartAt || ""}-${props.initialEndAt || ""}`} {...props}/>;
}
