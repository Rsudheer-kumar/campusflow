"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { CalendarCheck, Plus, Clock, Building2, Calendar, AlertCircle, QrCode, LogOut, ShieldCheck, CheckCircle2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout";
import { Card, Badge, Button, Modal, Textarea, Skeleton, EmptyState } from "@/components/ui";
import { CheckInModal } from "@/components/bookings/check-in-modal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, resolveReservationTimezone } from "@/lib/utils";
export default function BookingsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterTab, setFilterTab] = useState("ALL");
    // Check-In & Checkout Modal state
    const [checkInModalBooking, setCheckInModalBooking] = useState(null);
    // Cancellation Modal state
    const [cancelModalBooking, setCancelModalBooking] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelError, setCancelError] = useState(null);
    const fetchBookings = useCallback(async () => {
        if (!user && !authLoading) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const res = await api.bookings.list({ limit: 50 });
            setBookings(res.bookings || []);
        }
        catch (err) {
            if (err?.status !== 401) {
                console.error("Failed to fetch bookings", err);
            }
        }
        finally {
            setIsLoading(false);
        }
    }, [user, authLoading]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setIsLoading(false);
            return;
        }
        fetchBookings();
    }, [user, authLoading, fetchBookings]);
    // Execute cancellation
    const handleConfirmCancel = async () => {
        if (!cancelModalBooking)
            return;
        setIsCancelling(true);
        setCancelError(null);
        try {
            await api.bookings.cancel(cancelModalBooking._id, cancelReason.trim() || undefined);
            setCancelModalBooking(null);
            setCancelReason("");
            fetchBookings();
        }
        catch (err) {
            setCancelError(err instanceof Error ? err.message : "Failed to cancel booking");
        }
        finally {
            setIsCancelling(false);
        }
    };
    // Filter bookings based on active tab with past completion calculation
    const [nowMs] = useState(() => Date.now());
    const pendingBookings = useMemo(() => {
        return bookings.filter((b) => b.status === "PENDING" && new Date(b.endAt).getTime() > nowMs);
    }, [bookings, nowMs]);

    const activeBookings = useMemo(() => {
        return bookings.filter((b) => (b.status === "CONFIRMED" || b.status === "PENDING" || b.status === "CHECKED_IN") && new Date(b.endAt).getTime() > nowMs);
    }, [bookings, nowMs]);

    const completedBookings = useMemo(() => {
        return bookings.filter((b) => b.status === "COMPLETED" || ((b.status === "CONFIRMED" || b.status === "CHECKED_IN") && new Date(b.endAt).getTime() <= nowMs));
    }, [bookings, nowMs]);

    const cancelledBookings = useMemo(() => {
        return bookings.filter((b) => b.status === "CANCELLED" || b.status === "REJECTED");
    }, [bookings]);

    const filteredBookings = useMemo(() => {
        if (filterTab === "PENDING") return pendingBookings;
        if (filterTab === "ACTIVE") return activeBookings;
        if (filterTab === "COMPLETED") return completedBookings;
        if (filterTab === "CANCELLED") return cancelledBookings;
        return bookings;
    }, [bookings, filterTab, pendingBookings, activeBookings, completedBookings, cancelledBookings]);
    return (<div className="min-h-full py-8 grid-background">
      <PageContainer className="space-y-6">
        <PageHeader title="My Reservations & Bookings" description="View, manage, and inspect your campus facility reservations and booking history." action={<Link href="/dashboard/calendar">
              <Button size="sm" icon={<Plus className="h-4 w-4"/>}>
                Reserve Facility
              </Button>
            </Link>}/>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <button type="button" onClick={() => setFilterTab("ALL")} className={cn("px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors", filterTab === "ALL"
            ? "bg-primary text-white"
            : "bg-surface text-muted hover:text-foreground border border-border")}>
            All Reservations ({bookings.length})
          </button>
          <button type="button" onClick={() => setFilterTab("PENDING")} className={cn("px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors", filterTab === "PENDING"
            ? "bg-amber-500 text-black font-semibold"
            : "bg-surface text-muted hover:text-foreground border border-border")}>
            Pending Approval ({pendingBookings.length})
          </button>
          <button type="button" onClick={() => setFilterTab("ACTIVE")} className={cn("px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors", filterTab === "ACTIVE"
            ? "bg-primary text-white"
            : "bg-surface text-muted hover:text-foreground border border-border")}>
            Active &amp; Upcoming ({activeBookings.length})
          </button>
          <button type="button" onClick={() => setFilterTab("COMPLETED")} className={cn("px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors", filterTab === "COMPLETED"
            ? "bg-primary text-white"
            : "bg-surface text-muted hover:text-foreground border border-border")}>
            Completed ({completedBookings.length})
          </button>
          <button type="button" onClick={() => setFilterTab("CANCELLED")} className={cn("px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors", filterTab === "CANCELLED"
            ? "bg-primary text-white"
            : "bg-surface text-muted hover:text-foreground border border-border")}>
            Cancelled &amp; Rejected ({cancelledBookings.length})
          </button>
        </div>

        {/* Bookings List */}
        {isLoading ? (<div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (<Card key={i} className="p-5 space-y-3">
                <Skeleton className="h-6 w-1/3"/>
                <Skeleton className="h-4 w-1/4"/>
                <Skeleton className="h-10 w-full"/>
              </Card>))}
          </div>) : filteredBookings.length === 0 ? (<Card className="min-h-[350px] flex items-center justify-center">
            <EmptyState icon={<CalendarCheck className="h-8 w-8 text-primary"/>} title="No Reservations Found" description="You have no active or historical bookings in this category. Browse available campus facilities to schedule a session." action={<Link href="/dashboard/calendar">
                  <Button size="sm">Explore Campus Calendar</Button>
                </Link>}/>
          </Card>) : (<div className="space-y-4">
            {filteredBookings.map((booking) => {
                const resObj = typeof booking.resource === "object" && booking.resource
                    ? booking.resource
                    : null;
                const resName = resObj?.name || "Campus Facility";
                const resCode = resObj?.code || "RES";
                const building = resObj?.location?.building || "University Campus";
                const sDate = new Date(booking.startAt);
                const eDate = new Date(booking.endAt);
                const isPast = eDate.getTime() <= nowMs;
                const isCompleted = booking.status === "COMPLETED" || ((booking.status === "CONFIRMED" || booking.status === "CHECKED_IN") && isPast);
                const displayStatus = booking.status === "CANCELLED" || booking.status === "REJECTED"
                    ? booking.status
                    : isCompleted
                    ? "COMPLETED"
                    : booking.status;

                const bTz = booking.timezone || resObj?.timezone || resolveReservationTimezone(resObj);
                const tzLabel = bTz ? bTz.split("/").pop().replace(/_/g, " ") : "Local";
                const formattedDate = new Intl.DateTimeFormat("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: bTz,
                }).format(sDate);
                const startTimeStr = new Intl.DateTimeFormat("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: bTz,
                }).format(sDate);
                const endTimeStr = new Intl.DateTimeFormat("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: bTz,
                }).format(eDate);

                // Only allow cancellation and check-in for upcoming/active sessions
                const isCancelable = (booking.status === "CONFIRMED" || booking.status === "PENDING") && !isPast;
                const canCheckIn = booking.status === "CONFIRMED" && !isPast;
                const canCheckout = booking.status === "CHECKED_IN" && !isPast;
                return (<Card key={booking._id} className="p-5 border-border hover:border-border/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/90">
                  <div className="space-y-2">
                    {/* Status Badge & Code */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary-bright px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                        {resCode}
                      </span>
                      {resObj?.block && (
                        <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-2 border border-border text-foreground">
                          {resObj.block.replace('_', ' ')}
                        </span>
                      )}
                      {booking.priority === 'EMERGENCY' && (
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          ⚡ Emergency Meeting
                        </span>
                      )}
                      <Badge variant={displayStatus === "COMPLETED"
                        ? "neutral"
                        : displayStatus === "CONFIRMED" || displayStatus === "CHECKED_IN"
                        ? "available"
                        : displayStatus === "NO_SHOW"
                            ? booking.noShowPardoned
                                ? "neutral"
                                : "danger"
                            : displayStatus === "CANCELLED" || displayStatus === "REJECTED"
                                ? "cancelled"
                                : "warning"} dot>
                        {displayStatus === "PENDING" && booking.currentStepOrder && booking.approvalChain?.length
                        ? `PENDING (Step ${booking.currentStepOrder}/${booking.approvalChain.length}: ${booking.currentApproverRole || "APPROVAL"})`
                        : displayStatus === "NO_SHOW" && booking.noShowPardoned
                            ? "NO_SHOW (Pardoned)"
                            : displayStatus}
                      </Badge>
                      {booking.status === "NO_SHOW" && booking.noShowPardoned && (<span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                          <ShieldCheck className="h-3.5 w-3.5"/>
                          Strike Pardoned
                        </span>)}
                      {booking.status === "PENDING" && booking.activeStepDeadline && (<span className="text-[11px] text-warning flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3"/>
                          Due: {new Date(booking.activeStepDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>)}
                      <span className="text-xs text-muted">ID: {booking._id.slice(-6)}</span>
                    </div>

                    {/* Holiday Review Notification Banner */}
                    {booking.holidayReview?.requiresReview && (
                      <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                        <span>
                          <strong>Campus Closure Review:</strong> {booking.holidayReview.reason || "This booking falls on a newly declared campus closure date."}
                        </span>
                      </div>
                    )}

                    {/* Relocation Notification Banner */}
                    {booking.relocationAudit?.displacedAt && (
                      <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-blue-400" />
                        <span>
                          <strong>Relocation Scheduled:</strong> {booking.relocationAudit.reason} ({booking.relocationAudit.alternativeOffered})
                        </span>
                      </div>
                    )}

                    {/* Booking Title */}
                    <div>
                      <h3 className="text-base font-semibold text-foreground leading-snug">
                        {booking.title}
                      </h3>
                      {booking.description && (<p className="text-xs text-muted line-clamp-1 mt-0.5">
                          {booking.description}
                        </p>)}
                    </div>

                    {/* Multi-step Approval Chain Visualization */}
                    {booking.approvalChain && booking.approvalChain.length > 0 && (<div className="p-2.5 rounded bg-surface-2/60 border border-border/50 text-xs space-y-1.5 my-1">
                        <div className="font-semibold text-[11px] text-muted uppercase tracking-wider">
                          Approval Workflow ({booking.approvalChain.length} {booking.approvalChain.length === 1 ? 'Step' : 'Steps'})
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {booking.approvalChain.map((step, idx) => (<div key={idx} className={cn("flex items-center gap-1.5 px-2 py-1 rounded text-xs border", step.status === "APPROVED"
                                ? "bg-success/10 border-success/30 text-success"
                                : step.status === "REJECTED"
                                    ? "bg-danger/10 border-danger/30 text-danger"
                                    : step.stepOrder === booking.currentStepOrder
                                        ? "bg-warning/10 border-warning/30 text-warning font-semibold animate-pulse"
                                        : "bg-surface-2 border-border/40 text-muted")}>
                              <span className="font-mono">#{step.stepOrder}</span>
                              <span>{step.approverRole}</span>
                              <span>•</span>
                              <span>{step.status}</span>
                              {step.comment && (<span className="text-[11px] opacity-80">({step.comment})</span>)}
                            </div>))}
                        </div>
                      </div>)}

                    {/* Facility & Date Info */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary"/>
                        <span>
                          {resName} • {building}
                        </span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary"/>
                        <span>{formattedDate}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-primary"/>
                        <span>
                          {startTimeStr} – {endTimeStr}
                        </span>
                      </div>
                    </div>

                    {/* Cancellation reason if present */}
                    {booking.cancellationReason && (<p className="text-xs text-danger/80 italic pt-1">
                        Reason for cancellation: {booking.cancellationReason}
                      </p>)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {/* Phase 3.3 Check-In Trigger */}
                    {canCheckIn && (<Button variant="primary" size="sm" icon={<QrCode className="h-4 w-4"/>} onClick={() => setCheckInModalBooking(booking)}>
                        Check In
                      </Button>)}

                    {/* Phase 3.3 Early Checkout Trigger */}
                    {canCheckout && (<Button variant="secondary" size="sm" icon={<LogOut className="h-4 w-4"/>} onClick={() => setCheckInModalBooking(booking)}>
                        Checkout
                      </Button>)}

                    {/* Concluded session pill */}
                    {displayStatus === "COMPLETED" && (<span className="text-xs text-muted font-medium flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-2/60 border border-border/50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400"/>
                        Class Completed
                      </span>)}

                    {resObj && (<Link href={`/dashboard/calendar?resourceId=${resObj._id}&date=${booking.startAt}`}>
                        <Button variant="ghost" size="sm">
                          View on Calendar
                        </Button>
                      </Link>)}

                    {isCancelable && (<Button variant="danger" size="sm" onClick={() => {
                            setCancelReason("");
                            setCancelError(null);
                            setCancelModalBooking(booking);
                        }}>
                        Cancel Booking
                      </Button>)}
                  </div>
                </Card>);
            })}
          </div>)}

        {/* Cancellation Confirmation Modal */}
        <Modal open={!!cancelModalBooking} onClose={() => setCancelModalBooking(null)} title="Cancel Reservation" description={`Are you sure you want to cancel "${cancelModalBooking?.title}"?`} size="md">
          <div className="space-y-4">
            {cancelError && (<div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0"/>
                <span>{cancelError}</span>
              </div>)}

            <p className="text-xs text-muted">
              Cancelling will immediately release this time slot back to campus availability. This
              action cannot be undone.
            </p>

            <Textarea label="Reason for cancellation (optional)" placeholder="e.g. Rescheduled meeting, room no longer required..." rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}/>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <Button variant="ghost" onClick={() => setCancelModalBooking(null)} disabled={isCancelling}>
                Keep Booking
              </Button>
              <Button variant="danger" onClick={handleConfirmCancel} disabled={isCancelling}>
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Phase 3.3 Check-In & Checkout Modal */}
        <CheckInModal open={!!checkInModalBooking} onClose={() => setCheckInModalBooking(null)} booking={checkInModalBooking} onSuccess={fetchBookings}/>
      </PageContainer>
    </div>);
}
