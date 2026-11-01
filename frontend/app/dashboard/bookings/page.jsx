"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Plus,
  Clock,
  Building2,
  Calendar,
  AlertCircle,
  QrCode,
  LogOut,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout";
import {
  Card,
  Badge,
  Button,
  Modal,
  Textarea,
  Skeleton,
  EmptyState,
  ErrorState,
  Pagination,
  SearchInput,
} from "@/components/ui";
import { CheckInModal } from "@/components/bookings/check-in-modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { resolveTimezone, formatDateInterval } from "@/features/dashboard/hooks/use-dashboard";

export default function BookingsPage() {
  const { user } = useAuth();
  const timeZone = useMemo(() => resolveTimezone(user), [user]);

  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [filterTab, setFilterTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Check-In & Checkout Modal state
  const [checkInModalBooking, setCheckInModalBooking] = useState(null);

  // Cancellation Modal state
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    const params = {
      page: currentPage,
      limit: pageSize,
    };

    if (filterTab === "CONFIRMED") params.status = "CONFIRMED";
    else if (filterTab === "PENDING") params.status = "PENDING";
    else if (filterTab === "CHECKED_IN") params.status = "CHECKED_IN";
    else if (filterTab === "CANCELLED") params.status = "CANCELLED";

    try {
      const res = await api.bookings.list(params);
      const items = res.bookings || res.items || [];
      setBookings(items);
      setTotal(res.total ?? items.length);
      setTotalPages(res.totalPages ?? 1);
    } catch (err) {
      console.error("Failed to fetch bookings", err);
      setFetchError(
        err instanceof Error ? err.message : "Unable to load campus bookings."
      );
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, filterTab]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Execute cancellation
  const handleConfirmCancel = async () => {
    if (!cancelModalBooking) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await api.bookings.cancel(
        cancelModalBooking._id,
        cancelReason.trim() || undefined
      );
      setCancelModalBooking(null);
      setCancelReason("");
      fetchBookings();
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : "Failed to cancel booking"
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Client-side search filtering across title, resource name, or code
  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter((b) => {
      const titleMatch = b.title?.toLowerCase().includes(q);
      const resObj = typeof b.resource === "object" ? b.resource : null;
      const resNameMatch = resObj?.name?.toLowerCase().includes(q);
      const resCodeMatch = resObj?.code?.toLowerCase().includes(q);
      return titleMatch || resNameMatch || resCodeMatch;
    });
  }, [bookings, searchQuery]);

  return (
    <div className="min-h-full py-8 grid-background">
      <PageContainer className="space-y-6">
        <PageHeader
          title="My Reservations &amp; Bookings"
          description="View, manage, and inspect your campus facility reservations and booking history."
          action={
            <Link href="/dashboard/calendar">
              <Button size="sm" icon={<Plus className="h-4 w-4" />}>
                Reserve Facility
              </Button>
            </Link>
          }
        />

        {/* Tab Filters & Search Bar */}
        <Card className="p-4 bg-surface-2/40 border-border/80">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="w-full lg:w-80">
              <SearchInput
                placeholder="Search booking title or room code..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
              {[
                { id: "ALL", label: "All Reservations" },
                { id: "CONFIRMED", label: "Confirmed" },
                { id: "PENDING", label: "Pending Approval" },
                { id: "CHECKED_IN", label: "Checked In" },
                { id: "CANCELLED", label: "Cancelled / Rejected" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setFilterTab(tab.id);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                    filterTab === tab.id
                      ? "bg-primary text-white"
                      : "bg-surface text-muted hover:text-foreground border border-border"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Bookings List */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ))}
          </div>
        ) : fetchError ? (
          <ErrorState
            title="Failed to Load Reservations"
            description={fetchError}
            onRetry={fetchBookings}
          />
        ) : filteredBookings.length === 0 ? (
          <Card className="min-h-[350px] flex items-center justify-center">
            <EmptyState
              icon={<CalendarCheck className="h-8 w-8 text-primary" />}
              title="No Reservations Found"
              description={
                searchQuery.trim() || filterTab !== "ALL"
                  ? "No reservations match your current query. Try adjusting filters."
                  : "You have no active or historical bookings. Browse campus facilities to schedule a session."
              }
              action={
                searchQuery.trim() || filterTab !== "ALL" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterTab("ALL");
                      setCurrentPage(1);
                    }}
                  >
                    Clear Filter
                  </Button>
                ) : (
                  <Link href="/dashboard/calendar">
                    <Button size="sm">Explore Campus Calendar</Button>
                  </Link>
                )
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const resObj =
                typeof booking.resource === "object" && booking.resource
                  ? booking.resource
                  : null;
              const resName = resObj?.name || "Campus Facility";
              const resCode = resObj?.code || "RES";
              const building =
                resObj?.location?.building || "University Campus";

              const intervalStr = formatDateInterval(
                booking.startAt,
                booking.endAt,
                timeZone
              );

              const isCancelable =
                booking.status === "CONFIRMED" || booking.status === "PENDING";

              return (
                <Card
                  key={booking._id}
                  className="p-5 border-border hover:border-border/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/90"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    {/* Status Badge & Code */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary-bright px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                        {resCode}
                      </span>
                      <Badge
                        variant={
                          booking.status === "CONFIRMED" ||
                          booking.status === "CHECKED_IN"
                            ? "available"
                            : booking.status === "NO_SHOW"
                            ? booking.noShowPardoned
                              ? "neutral"
                              : "danger"
                            : booking.status === "CANCELLED" ||
                              booking.status === "REJECTED"
                            ? "cancelled"
                            : "warning"
                        }
                        dot
                      >
                        {booking.status === "PENDING" &&
                        booking.currentStepOrder &&
                        booking.approvalChain?.length
                          ? `PENDING (Step ${booking.currentStepOrder}/${booking.approvalChain.length}: ${booking.currentApproverRole || "APPROVAL"})`
                          : booking.status === "NO_SHOW" && booking.noShowPardoned
                          ? "NO_SHOW (Pardoned)"
                          : booking.status}
                      </Badge>
                      {booking.status === "NO_SHOW" && booking.noShowPardoned && (
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Strike Pardoned
                        </span>
                      )}
                      {booking.status === "PENDING" &&
                        booking.activeStepDeadline && (
                          <span className="text-[11px] text-warning flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3" />
                            Due:{" "}
                            {new Date(booking.activeStepDeadline).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        )}
                      <span className="text-xs text-muted font-mono">
                        ID: {booking._id?.slice(-6)}
                      </span>
                    </div>

                    {/* Booking Title */}
                    <div>
                      <h3 className="text-base font-semibold text-foreground leading-snug">
                        {booking.title}
                      </h3>
                      {booking.description && (
                        <p className="text-xs text-muted line-clamp-1 mt-0.5">
                          {booking.description}
                        </p>
                      )}
                    </div>

                    {/* Multi-step Approval Chain Visualization */}
                    {booking.approvalChain &&
                      booking.approvalChain.length > 0 && (
                        <div className="p-2.5 rounded bg-surface-2/60 border border-border/50 text-xs space-y-1.5 my-1">
                          <div className="font-semibold text-[11px] text-muted uppercase tracking-wider">
                            Approval Workflow (
                            {booking.approvalChain.length}{" "}
                            {booking.approvalChain.length === 1
                              ? "Step"
                              : "Steps"}
                            )
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {booking.approvalChain.map((step, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "flex items-center gap-1.5 px-2 py-1 rounded text-xs border",
                                  step.status === "APPROVED"
                                    ? "bg-success/10 border-success/30 text-success"
                                    : step.status === "REJECTED"
                                    ? "bg-danger/10 border-danger/30 text-danger"
                                    : step.stepOrder === booking.currentStepOrder
                                    ? "bg-warning/10 border-warning/30 text-warning font-semibold animate-pulse"
                                    : "bg-surface-2 border-border/40 text-muted"
                                )}
                              >
                                <span className="font-mono">#{step.stepOrder}</span>
                                <span>{step.approverRole}</span>
                                <span>•</span>
                                <span>{step.status}</span>
                                {step.comment && (
                                  <span className="text-[11px] opacity-80">
                                    ({step.comment})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Facility & Date Info */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        <span>
                          {resName} • {building}
                        </span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span>{intervalStr}</span>
                      </div>
                    </div>

                    {/* Cancellation reason if present */}
                    {booking.cancellationReason && (
                      <p className="text-xs text-danger/80 italic pt-1">
                        Reason for cancellation: {booking.cancellationReason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {booking.status === "CONFIRMED" && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<QrCode className="h-4 w-4" />}
                        onClick={() => setCheckInModalBooking(booking)}
                      >
                        Check In
                      </Button>
                    )}

                    {booking.status === "CHECKED_IN" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<LogOut className="h-4 w-4" />}
                        onClick={() => setCheckInModalBooking(booking)}
                      >
                        Checkout
                      </Button>
                    )}

                    {resObj && (
                      <Link
                        href={`/dashboard/calendar?resourceId=${resObj._id}`}
                      >
                        <Button variant="ghost" size="sm">
                          View Calendar
                        </Button>
                      </Link>
                    )}

                    {isCancelable && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setCancelReason("");
                          setCancelError(null);
                          setCancelModalBooking(booking);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

        {/* Cancellation Confirmation Modal */}
        <Modal
          open={Boolean(cancelModalBooking)}
          onClose={() => setCancelModalBooking(null)}
          title="Cancel Reservation"
          description={`Are you sure you want to cancel "${cancelModalBooking?.title}"?`}
          size="md"
        >
          <div className="space-y-4">
            {cancelError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{cancelError}</span>
              </div>
            )}

            <p className="text-xs text-muted leading-relaxed">
              Cancelling will immediately release this time slot back to campus availability. This
              action cannot be undone.
            </p>

            <Textarea
              label="Reason for cancellation (optional)"
              placeholder="e.g. Rescheduled meeting, room no longer required..."
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <Button
                variant="ghost"
                onClick={() => setCancelModalBooking(null)}
                disabled={isCancelling}
              >
                Keep Booking
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Check-In & Checkout Modal */}
        <CheckInModal
          open={Boolean(checkInModalBooking)}
          onClose={() => setCheckInModalBooking(null)}
          booking={checkInModalBooking}
          onSuccess={fetchBookings}
        />
      </PageContainer>
    </div>
  );
}
