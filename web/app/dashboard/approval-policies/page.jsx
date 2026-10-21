"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Layers,
  Users,
  Trash2,
  Pencil,
  AlertCircle,
  ArrowRight,
  Sliders,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  Textarea,
  Modal,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const VALID_APPROVER_ROLES = [
  { value: "DEPARTMENT_HEAD", label: "Department Head" },
  { value: "FACILITY_MANAGER", label: "Facility Manager" },
  { value: "ADMIN", label: "System Administrator" },
];

const REQUESTER_ROLES = [
  { value: "", label: "All Roles (Wildcard Policy)" },
  { value: "STUDENT", label: "Student" },
  { value: "FACULTY", label: "Faculty" },
  { value: "STAFF", label: "Staff" },
  { value: "DEPARTMENT_HEAD", label: "Department Head" },
  { value: "FACILITY_MANAGER", label: "Facility Manager" },
  { value: "CUSTODIAN", label: "Custodian" },
  { value: "ADMIN", label: "Administrator" },
];

const DEFAULT_FORM = {
  name: "",
  description: "",
  scopeType: "RESOURCE",
  resource: "",
  resourceType: "",
  requesterRole: "",
  requiresApproval: true,
  approvalChain: [{ stepOrder: 1, approverRole: "DEPARTMENT_HEAD", timeoutHours: 24 }],
};

export default function ApprovalPoliciesPage() {
  const { user } = useAuth();

  const isPrivileged = Boolean(
    user?.roles?.includes("ADMIN") || user?.roles?.includes("FACILITY_MANAGER")
  );
  const isAuthorized = Boolean(
    isPrivileged || user?.roles?.includes("DEPARTMENT_HEAD")
  );

  const [policies, setPolicies] = useState([]);
  const [resources, setResources] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState(null);

  // Archive Modal State
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState(null);

  // Fetch Policies and Scoping Targets
  const fetchPolicies = useCallback(async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const [policiesRes, resourcesRes, typesRes] = await Promise.all([
        api.approvalPolicies.list({ limit: 100 }),
        api.resources.list({ limit: 100 }).catch(() => ({ resources: [] })),
        api.resources.getTypes().catch(() => ({ resourceTypes: [] })),
      ]);
      setPolicies(policiesRes.policies || []);
      setResources(resourcesRes.resources || []);
      setResourceTypes(typesRes.resourceTypes || []);
    } catch (err) {
      console.error("Failed to fetch approval policies", err);
      setFetchError(
        err instanceof Error
          ? err.message
          : "Unable to load approval policies. Please check permissions or network."
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    let ignore = false;
    Promise.all([
      api.approvalPolicies.list({ limit: 100 }),
      api.resources.list({ limit: 100 }).catch(() => ({ resources: [] })),
      api.resources.getTypes().catch(() => ({ resourceTypes: [] })),
    ])
      .then(([policiesRes, resourcesRes, typesRes]) => {
        if (!ignore) {
          setPolicies(policiesRes.policies || []);
          setResources(resourcesRes.resources || []);
          setResourceTypes(typesRes.resourceTypes || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Failed to fetch approval policies", err);
          setFetchError(
            err instanceof Error
              ? err.message
              : "Unable to load approval policies. Please check permissions or network."
          );
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  // Filtered Policies
  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      // Scope filter
      if (scopeFilter !== "ALL" && p.scopeType !== scopeFilter) return false;
      // Status filter
      if (statusFilter === "ACTIVE" && !p.isActive) return false;
      if (statusFilter === "INACTIVE" && p.isActive) return false;
      // Search query
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesTarget =
          p.resource?.name?.toLowerCase().includes(q) ||
          p.resource?.code?.toLowerCase().includes(q) ||
          p.resourceType?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesTarget) return false;
      }
      return true;
    });
  }, [policies, scopeFilter, statusFilter, searchQuery]);

  // Modal handlers
  const handleOpenCreate = () => {
    setEditingPolicy(null);
    setFormData({
      ...DEFAULT_FORM,
      resource: resources[0]?._id || "",
      resourceType: resourceTypes[0]?._id || "",
    });
    setFormErrors({});
    setFormSubmitError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name || "",
      description: policy.description || "",
      scopeType: policy.scopeType || "RESOURCE",
      resource: policy.resource?._id || policy.resource || resources[0]?._id || "",
      resourceType:
        policy.resourceType?._id || policy.resourceType || resourceTypes[0]?._id || "",
      requesterRole: policy.requesterRole || "",
      requiresApproval: policy.requiresApproval !== false,
      approvalChain:
        policy.approvalChain?.length > 0
          ? policy.approvalChain.map((s, idx) => ({
              stepOrder: idx + 1,
              approverRole: s.approverRole,
              timeoutHours: s.timeoutHours || 24,
            }))
          : [{ stepOrder: 1, approverRole: "DEPARTMENT_HEAD", timeoutHours: 24 }],
    });
    setFormErrors({});
    setFormSubmitError(null);
    setIsModalOpen(true);
  };

  // Chain Builder Handlers
  const handleAddChainStep = () => {
    if (formData.approvalChain.length >= 5) return;
    const existingRoles = new Set(formData.approvalChain.map((s) => s.approverRole));
    const nextRoleOption = VALID_APPROVER_ROLES.find((r) => !existingRoles.has(r.value));
    const newRole = nextRoleOption ? nextRoleOption.value : "ADMIN";

    setFormData((prev) => ({
      ...prev,
      approvalChain: [
        ...prev.approvalChain,
        {
          stepOrder: prev.approvalChain.length + 1,
          approverRole: newRole,
          timeoutHours: 24,
        },
      ],
    }));
  };

  const handleRemoveChainStep = (index) => {
    if (formData.approvalChain.length <= 1) return;
    setFormData((prev) => {
      const nextChain = prev.approvalChain
        .filter((_, i) => i !== index)
        .map((step, idx) => ({ ...step, stepOrder: idx + 1 }));
      return { ...prev, approvalChain: nextChain };
    });
  };

  const handleChainStepChange = (index, field, value) => {
    setFormData((prev) => {
      const nextChain = [...prev.approvalChain];
      nextChain[index] = { ...nextChain[index], [field]: value };
      return { ...prev, approvalChain: nextChain };
    });
  };

  // Form Validation & Submission
  const validatePolicyForm = () => {
    const errors = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = "Policy name must be at least 2 characters";
    }
    if (formData.scopeType === "RESOURCE" && !formData.resource) {
      errors.resource = "Please select a target resource";
    }
    if (formData.scopeType === "RESOURCE_TYPE" && !formData.resourceType) {
      errors.resourceType = "Please select a target resource category";
    }

    if (formData.requiresApproval) {
      if (!formData.approvalChain || formData.approvalChain.length === 0) {
        errors.approvalChain = "At least one approval step is required";
      } else if (formData.approvalChain.length > 5) {
        errors.approvalChain = "Approval chain cannot exceed 5 steps";
      } else {
        const seenRoles = new Set();
        for (const step of formData.approvalChain) {
          if (seenRoles.has(step.approverRole)) {
            errors.approvalChain = `Duplicate approver role "${step.approverRole}" in chain`;
            break;
          }
          seenRoles.add(step.approverRole);
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    if (!validatePolicyForm()) return;

    setIsSubmitting(true);
    setFormSubmitError(null);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      scopeType: formData.scopeType,
      resource: formData.scopeType === "RESOURCE" ? formData.resource : null,
      resourceType: formData.scopeType === "RESOURCE_TYPE" ? formData.resourceType : null,
      requesterRole: formData.requesterRole || null,
      requiresApproval: formData.requiresApproval,
      approvalChain: formData.requiresApproval
        ? formData.approvalChain.map((step, idx) => ({
            stepOrder: idx + 1,
            approverRole: step.approverRole,
            timeoutHours: step.timeoutHours ? Number(step.timeoutHours) : undefined,
          }))
        : [],
    };

    try {
      if (editingPolicy) {
        await api.approvalPolicies.update(editingPolicy._id, payload);
      } else {
        await api.approvalPolicies.create(payload);
      }
      setIsModalOpen(false);
      await fetchPolicies();
    } catch (err) {
      console.error("Failed to save approval policy", err);
      setFormSubmitError(
        err instanceof Error ? err.message : "Failed to save approval policy"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Policy Status
  const handleToggleStatus = async (policy) => {
    try {
      await api.approvalPolicies.toggleStatus(policy._id, !policy.isActive);
      await fetchPolicies();
    } catch (err) {
      console.error("Failed to toggle policy status", err);
      alert(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  // Archive Policy
  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setIsArchiving(true);
    setArchiveError(null);
    try {
      await api.approvalPolicies.archive(archiveTarget._id);
      setArchiveTarget(null);
      await fetchPolicies();
    } catch (err) {
      console.error("Failed to archive policy", err);
      setArchiveError(
        err instanceof Error ? err.message : "Failed to archive policy"
      );
    } finally {
      setIsArchiving(false);
    }
  };

  // Unauthorized view for Students / unauthorized roles
  if (!isAuthorized) {
    return (
      <div className="min-h-full py-8 grid-background">
        <PageContainer className="space-y-6">
          <PageHeader
            title="Approval Policies"
            description="Multi-tier booking authorization and workflow governance."
          />
          <Card className="min-h-[350px] flex items-center justify-center border-danger/30 bg-danger/5">
            <div className="flex flex-col items-center gap-4 text-center p-8 max-w-md">
              <div className="h-14 w-14 rounded-full bg-danger/10 flex items-center justify-center border border-danger/30 text-danger">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  Access Restricted
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  Approval policy administration is restricted to Department Heads, Facility
                  Managers, and System Administrators.
                </p>
              </div>
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-full py-8 grid-background">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Approval Policy Administration"
          description="Configure multi-tier authorization workflows, approver escalations, and facility governance."
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                icon={<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />}
                onClick={fetchPolicies}
              >
                Refresh
              </Button>
              {isPrivileged && (
                <Button
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={handleOpenCreate}
                >
                  New Policy
                </Button>
              )}
            </div>
          }
        />

        {/* Filter Bar */}
        <Card className="p-4 bg-surface-2/40 border-border/80">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:w-80 relative">
              <Input
                placeholder="Search policy name or target..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-muted font-medium">Scope:</span>
              <button
                type="button"
                onClick={() => setScopeFilter("ALL")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  scopeFilter === "ALL"
                    ? "bg-primary text-white"
                    : "bg-surface text-muted hover:text-foreground border border-border"
                }`}
              >
                All Scopes
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("RESOURCE")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  scopeFilter === "RESOURCE"
                    ? "bg-primary text-white"
                    : "bg-surface text-muted hover:text-foreground border border-border"
                }`}
              >
                Specific Facility
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("RESOURCE_TYPE")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  scopeFilter === "RESOURCE_TYPE"
                    ? "bg-primary text-white"
                    : "bg-surface text-muted hover:text-foreground border border-border"
                }`}
              >
                Category Wide
              </button>

              <div className="h-4 w-px bg-border mx-1" />

              <span className="text-xs text-muted font-medium">Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === "ALL"
                    ? "bg-primary text-white"
                    : "bg-surface text-muted hover:text-foreground border border-border"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ACTIVE")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === "ACTIVE"
                    ? "bg-primary text-white"
                    : "bg-surface text-muted hover:text-foreground border border-border"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("INACTIVE")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === "INACTIVE"
                    ? "bg-primary text-white"
                    : "bg-surface text-muted hover:text-foreground border border-border"
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </Card>

        {/* Policies Listing */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-12 w-full" />
              </Card>
            ))}
          </div>
        ) : fetchError ? (
          <Card className="min-h-[350px] flex items-center justify-center border-destructive/40 bg-destructive/5">
            <div className="flex flex-col items-center gap-4 text-center p-8 max-w-md">
              <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/30 text-destructive">
                <AlertCircle className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  Failed to Load Policies
                </h3>
                <p className="text-sm text-muted leading-relaxed">{fetchError}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={fetchPolicies}
              >
                Retry
              </Button>
            </div>
          </Card>
        ) : filteredPolicies.length === 0 ? (
          <Card className="min-h-[350px] flex items-center justify-center">
            <EmptyState
              icon={<ShieldCheck className="h-8 w-8 text-primary" />}
              title={
                policies.length === 0
                  ? "No Approval Policies Configured"
                  : "No Matching Policies"
              }
              description={
                policies.length === 0
                  ? "No approval policies exist. Click 'New Policy' to establish authorization rules."
                  : "No approval policies matched your search or filters. Try adjusting your criteria."
              }
              action={
                isPrivileged && policies.length === 0 ? (
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={handleOpenCreate}
                  >
                    Create First Policy
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPolicies.map((policy) => {
              const targetName =
                policy.scopeType === "RESOURCE"
                  ? `${policy.resource?.name || "Target Resource"} (${policy.resource?.code || "CODE"})`
                  : `${policy.resourceType?.name || "Target Category"} (${policy.resourceType?.code || "CAT"})`;

              return (
                <Card
                  key={policy._id}
                  className="p-5 border-border hover:border-primary/40 transition-all duration-200 bg-surface/90"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Metadata & Target */}
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {policy.name}
                        </h3>
                        <Badge
                          variant={policy.isActive ? "available" : "secondary"}
                          dot
                        >
                          {policy.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                          {policy.scopeType === "RESOURCE" ? (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-primary" />
                              Facility Scope
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Layers className="h-3 w-3 text-primary" />
                              Category Scope
                            </span>
                          )}
                        </Badge>
                        <Badge variant="secondary">
                          <Users className="h-3 w-3 mr-1 text-muted" />
                          {policy.requesterRole
                            ? `Requester: ${policy.requesterRole}`
                            : "All Requester Roles"}
                        </Badge>
                      </div>

                      {policy.description && (
                        <p className="text-xs text-muted line-clamp-2">
                          {policy.description}
                        </p>
                      )}

                      <div className="text-xs text-muted flex items-center gap-2 pt-0.5">
                        <span className="font-medium text-foreground">Target:</span>
                        <span className="font-mono text-xs text-primary-bright px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                          {targetName}
                        </span>
                        {!policy.requiresApproval && (
                          <span className="text-xs text-success font-medium ml-2">
                            ✓ Auto-approved (No workflow chain required)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    {isPrivileged && (
                      <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleToggleStatus(policy)}
                        >
                          {policy.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => handleOpenEdit(policy)}
                        >
                          Edit
                        </Button>
                        {user?.roles?.includes("ADMIN") && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-muted hover:text-danger"
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setArchiveTarget(policy);
                              setArchiveError(null);
                            }}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Multi-tier Approval Chain Steps */}
                  {policy.requiresApproval && policy.approvalChain?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/60">
                      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                        Approval Workflow Tiers ({policy.approvalChain.length}{" "}
                        {policy.approvalChain.length === 1 ? "Step" : "Steps"}):
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {policy.approvalChain.map((step, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs">
                              <span className="font-mono text-[10px] text-primary font-bold px-1 rounded bg-primary/10">
                                #{step.stepOrder}
                              </span>
                              <span className="font-medium text-foreground">
                                {step.approverRole}
                              </span>
                              {step.timeoutHours ? (
                                <span className="flex items-center gap-0.5 text-[11px] text-muted">
                                  <Clock className="h-3 w-3 text-warning" />
                                  {step.timeoutHours}h timeout
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted/60">
                                  No timeout
                                </span>
                              )}
                            </div>
                            {idx < policy.approvalChain.length - 1 && (
                              <ArrowRight className="h-3.5 w-3.5 text-muted shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Create / Edit Policy Modal */}
        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingPolicy ? `Edit Policy: ${editingPolicy.name}` : "Create Approval Policy"}
          description="Establish authorization rules, target scope, and approver escalation tiers."
          size="xl"
        >
          <form onSubmit={handleSavePolicy} className="space-y-4">
            {formSubmitError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formSubmitError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Policy Name"
                placeholder="e.g. Auditorium Departmental Multi-Tier"
                value={formData.name}
                error={formErrors.name}
                required
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />

              <Select
                label="Requester Role Filter"
                value={formData.requesterRole}
                options={REQUESTER_ROLES}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, requesterRole: e.target.value }))
                }
                helperText="Leave as wildcard to apply to all requester roles"
              />
            </div>

            <Textarea
              label="Description (Optional)"
              placeholder="e.g. Requires Department Head sign-off followed by Facility Manager logistics review."
              rows={2}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <Select
                label="Scope Target Type"
                value={formData.scopeType}
                options={[
                  { value: "RESOURCE", label: "Specific Facility (Resource)" },
                  { value: "RESOURCE_TYPE", label: "Entire Category (Resource Type)" },
                ]}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, scopeType: e.target.value }))
                }
              />

              {formData.scopeType === "RESOURCE" ? (
                <Select
                  label="Target Facility"
                  value={formData.resource}
                  error={formErrors.resource}
                  required
                  options={resources.map((r) => ({
                    value: r._id,
                    label: `${r.name} (${r.code} - ${r.location?.building || "Campus"})`,
                  }))}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, resource: e.target.value }))
                  }
                />
              ) : (
                <Select
                  label="Target Resource Category"
                  value={formData.resourceType}
                  error={formErrors.resourceType}
                  required
                  options={resourceTypes.map((t) => ({
                    value: t._id,
                    label: `${t.name} (${t.code} - ${t.category})`,
                  }))}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, resourceType: e.target.value }))
                  }
                />
              )}
            </div>

            {/* Requires Approval Checkbox */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="requiresApprovalCheck"
                checked={formData.requiresApproval}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    requiresApproval: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
              />
              <label
                htmlFor="requiresApprovalCheck"
                className="text-sm font-medium text-foreground cursor-pointer select-none"
              >
                Require Approval Workflow (unchecked = auto-confirm bookings)
              </label>
            </div>

            {/* Approval Chain Builder */}
            {formData.requiresApproval && (
              <div className="p-4 rounded-xl border border-border/80 bg-surface/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Approval Workflow Chain (1 to 5 Tiers)
                    </h4>
                    <p className="text-xs text-muted">
                      Bookings must pass through each tier sequentially before confirmation.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    disabled={formData.approvalChain.length >= 5}
                    onClick={handleAddChainStep}
                  >
                    Add Tier
                  </Button>
                </div>

                {formErrors.approvalChain && (
                  <p className="text-xs text-danger">{formErrors.approvalChain}</p>
                )}

                <div className="space-y-2.5">
                  {formData.approvalChain.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-lg bg-surface border border-border/60"
                    >
                      <span className="font-mono text-xs font-bold text-primary px-2 py-1 rounded bg-primary/10 shrink-0">
                        Tier {idx + 1}
                      </span>

                      <div className="flex-1 min-w-[180px]">
                        <Select
                          label={undefined}
                          value={step.approverRole}
                          options={VALID_APPROVER_ROLES}
                          onChange={(e) =>
                            handleChainStepChange(idx, "approverRole", e.target.value)
                          }
                        />
                      </div>

                      <div className="w-36 shrink-0">
                        <Input
                          label={undefined}
                          type="number"
                          min="1"
                          max="168"
                          placeholder="Timeout (hours)"
                          value={step.timeoutHours || ""}
                          onChange={(e) =>
                            handleChainStepChange(
                              idx,
                              "timeoutHours",
                              e.target.value ? Number(e.target.value) : undefined
                            )
                          }
                        />
                      </div>

                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        className="text-muted hover:text-danger shrink-0"
                        disabled={formData.approvalChain.length <= 1}
                        onClick={() => handleRemoveChainStep(idx)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {editingPolicy ? "Update Policy" : "Create Policy"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Archive Confirmation Modal */}
        <Modal
          open={!!archiveTarget}
          onClose={() => setArchiveTarget(null)}
          title={`Archive Policy: ${archiveTarget?.name}`}
          description="Archiving will remove this policy from future booking evaluations."
          size="md"
        >
          <div className="space-y-4">
            {archiveError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{archiveError}</span>
              </div>
            )}

            <p className="text-sm text-muted leading-relaxed">
              Are you sure you want to archive{" "}
              <strong className="text-foreground">{archiveTarget?.name}</strong>?
              Historical bookings processed under this policy will retain their audit trail,
              but this policy will no longer govern new booking requests.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                disabled={isArchiving}
                onClick={() => setArchiveTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={isArchiving}
                onClick={handleConfirmArchive}
              >
                Confirm Archive
              </Button>
            </div>
          </div>
        </Modal>
      </PageContainer>
    </div>
  );
}
