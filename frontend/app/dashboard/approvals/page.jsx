"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Clock,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  User,
  RefreshCw,
  Search,
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
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { resolveTimezone, formatDateInterval } from "@/features/dashboard/hooks/use-dashboard";

function ApprovalsQueueContent() {
  const { user } = useAuth();
  const timeZone = useMemo(() => resolveTimezone(user), [user]);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [sortBy, setSortBy] = useState("deadline_asc");
  const [searchQuery, setSearchQuery] = useState("");

  // Action Modals State
  const [approveItem, setApproveItem] = useState(null);
  const [approveComment, setApproveComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState(null);

  const [rejectItem, setRejectItem] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState(null);

  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await api.approvals.getPending({
        sortBy,
        page: currentPage,
        limit: pageSize,
      });
      const list = res.items || [];
      setItems(list);
      setTotal(res.total ?? list.length);
      setTotalPages(res.totalPages ?? 1);
    } catch (err) {
      console.error("Failed to fetch pending approval queue", err);
      setFetchError(err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, currentPage, pageSize]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Check if current user is ADMIN acting as override
  const isAdminOverride = useMemo(() => {
    if (!user || !approveItem) return false;
    const isAdmin = user.roles?.includes("ADMIN");
    const isStepRole = user.roles?.includes(approveItem.currentApproverRole);
    return Boolean(isAdmin && !isStepRole);
  }, [user, approveItem]);

  const handleConfirmApprove = async () => {
    if (!approveItem) return;
    if (isAdminOverride && approveComment.trim().length < 5) {
      setApproveError(
        "Admin overrides require a justification comment of at least 5 characters."
      );
      return;
    }
    setIsApproving(true);
    setApproveError(null);
    try {
      await api.bookings.approve(
        approveItem._id,
        approveComment.trim() || undefined
      );
      setApproveItem(null);
      setApproveComment("");
      fetchQueue();
    } catch (err) {
      setApproveError(
        err instanceof Error
          ? err.message
          : "Failed to approve reservation step"
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectItem) return;
    if (rejectReason.trim().length < 5) {
      setRejectError("Rejection reason must be at least 5 characters long.");
      return;
    }
    setIsRejecting(true);
    setRejectError(null);
    try {
      await api.bookings.reject(rejectItem._id, rejectReason.trim());
      setRejectItem(null);
      setRejectReason("");
      fetchQueue();
    } catch (err) {
      setRejectError(
        err instanceof Error ? err.message : "Failed to reject reservation"
      );
    } finally {
      setIsRejecting(false);
    }
  };

  // Search filtering
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const titleMatch = item.title?.toLowerCase().includes(q);
      const resObj = typeof item.resource === "object" ? item.resource : null;
      const resNameMatch = resObj?.name?.toLowerCase().includes(q);
      const resCodeMatch = resObj?.code?.toLowerCase().includes(q);
      const userObj = typeof item.user === "object" ? item.user : null;
      const userNameMatch = userObj?.name?.toLowerCase().includes(q);
      return titleMatch || resNameMatch || resCodeMatch || userNameMatch;
    });
  }, [items, searchQuery]);

  return (
    <div className="min-h-full py-8 grid-background">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Approval Queue"
          description="Review, verify, and action pending resource booking requests under campus workflow policies."
          action={
            <div className="flex items-center gap-2">
              <Link href="/dashboard/approval-policies">
                <Button size="sm" variant="outline">
                  Approval Policies
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                icon={<RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />}
                onClick={fetchQueue}
              >
                Refresh
              </Button>
            </div>
          }
        />

        {/* Filter & Search Bar */}
        <Card className="p-4 bg-surface-2/40 border-border/80">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:w-80">
              <SearchInput
                placeholder="Search by title, room, or requester..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-muted whitespace-nowrap">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-surface text-foreground text-xs rounded-lg border border-border px-3 py-1.5 outline-none focus:border-primary"
              >
                <option value="deadline_asc">Urgent First (Deadline Asc)</option>
                <option value="deadline_desc">Latest Deadline</option>
                <option value="created_desc">Newest Requests</option>
                <option value="created_asc">Oldest Requests</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-6 space-y-3">
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ))}
          </div>
        ) : fetchError ? (
          <ErrorState
            title="Failed to Load Approvals Queue"
            description={fetchError?.message || "Unable to retrieve pending requests."}
            onRetry={fetchQueue}
          />
        ) : filteredItems.length === 0 ? (
          <Card className="min-h-[350px] flex items-center justify-center">
            <EmptyState
              icon={<ClipboardCheck className="h-8 w-8 text-primary" />}
              title="No Pending Approvals"
              description={
                searchQuery.trim()
                  ? "No requests match your current search criteria."
                  : "All booking requests assigned to your role have been verified and processed."
              }
              action={
                searchQuery.trim() ? (
                  <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>
                    Clear Search
                  </Button>
                ) : null
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const resObj = typeof item.resource === "object" ? item.resource : null;
              const resName = resObj?.name || "Campus Facility";
              const resCode = resObj?.code || "RES";
              const building = resObj?.location?.building || "University Campus";
              const userObj = typeof item.user === "object" ? item.user : null;
              const requesterName = userObj?.name || "Campus User";
              const requesterDept = userObj?.department || "";

              const intervalStr = formatDateInterval(item.startAt, item.endAt, timeZone);

              const deadlineDate = item.activeStepDeadline
                ? new Date(item.activeStepDeadline)
                : null;
              const isOverdue =
                deadlineDate && deadlineDate.getTime() < currentTime;

              return (
                <Card
                  key={item._id}
                  className={cn(
                    "p-5 border-border hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/90",
                    isOverdue && "border-danger/40 bg-danger/5"
                  )}
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary-bright px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                        {resCode}
                      </span>
                      <Badge variant={isOverdue ? "danger" : "warning"} dot>
                        Step {item.currentStepOrder} of {item.approvalChain?.length || 1}:{" "}
                        {item.currentApproverRole || "APPROVAL"}
                      </Badge>
                      {item.activeStepDeadline && (
                        <span
                          className={cn(
                            "text-xs flex items-center gap-1 font-mono",
                            isOverdue ? "text-danger font-semibold" : "text-muted"
                          )}
                        >
                          <Clock className="h-3 w-3" />
                          {isOverdue ? "OVERDUE — Auto-reject imminent" : `Due: ${deadlineDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-foreground leading-snug">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-muted line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-1">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <User className="h-3.5 w-3.5 text-muted" />
                        <span>
                          {requesterName}
                          {requesterDept && ` (${requesterDept})`}
                        </span>
                      </div>
                      <span>&bull;</span>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        <span>
                          {resName} • {building}
                        </span>
                      </div>
                      <span>&bull;</span>
                      <div className="flex items-center gap-1.5 font-mono">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>{intervalStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      onClick={() => {
                        setApproveItem(item);
                        setApproveComment("");
                        setApproveError(null);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<XCircle className="h-4 w-4" />}
                      onClick={() => {
                        setRejectItem(item);
                        setRejectReason("");
                        setRejectError(null);
                      }}
                    >
                      Reject
                    </Button>
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

        {/* Approve Modal */}
        <Modal
          open={Boolean(approveItem)}
          onClose={() => setApproveItem(null)}
          title={`Approve Reservation: ${approveItem?.title}`}
          description={`Sign off on step ${approveItem?.currentStepOrder} (${approveItem?.currentApproverRole}) for this booking.`}
          size="md"
        >
          <div className="space-y-4">
            {approveError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{approveError}</span>
              </div>
            )}

            {isAdminOverride && (
              <div className="p-3 rounded bg-warning/10 border border-warning/30 text-xs text-warning flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">
                    Executive Administrative Override
                  </span>
                  <span>
                    You are signing off as an Administrator on behalf of {approveItem?.currentApproverRole}. An audit comment of at least 5 characters is mandatory.
                  </span>
                </div>
              </div>
            )}

            <Textarea
              label={`Approval Comment ${isAdminOverride ? "(Mandatory)" : "(Optional)"}`}
              placeholder="e.g. Approved. Please adhere to laboratory safety standards."
              rows={2}
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <Button
                variant="ghost"
                onClick={() => setApproveItem(null)}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmApprove}
                disabled={isApproving}
              >
                {isApproving ? "Approving..." : "Confirm Approval"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Reject Modal */}
        <Modal
          open={Boolean(rejectItem)}
          onClose={() => setRejectItem(null)}
          title={`Reject Reservation: ${rejectItem?.title}`}
          description="Rejecting this reservation immediately stops the workflow and cancels the requested slot."
          size="md"
        >
          <div className="space-y-4">
            {rejectError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{rejectError}</span>
              </div>
            )}

            <Textarea
              label="Rejection Justification (Required)"
              placeholder="e.g. Departmental meeting scheduled in room; please select alternate facility."
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <Button
                variant="ghost"
                onClick={() => setRejectItem(null)}
                disabled={isRejecting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmReject}
                disabled={isRejecting}
              >
                {isRejecting ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </Modal>
      </PageContainer>
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <ProtectedRoute
      requiredRoles={["ADMIN", "FACILITY_MANAGER", "DEPARTMENT_HEAD", "FACULTY"]}
    >
      <ApprovalsQueueContent />
    </ProtectedRoute>
  );
}
