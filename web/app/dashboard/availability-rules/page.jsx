"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  CalendarOff,
  Scale,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Building2,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +05:30)" },
  { value: "UTC", label: "UTC (Universal Coordinated Time)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +08:00)" },
];

export default function AvailabilityRulesPage() {
  const { user } = useAuth();
  const canManage = Boolean(
    user?.roles?.includes("ADMIN") || user?.roles?.includes("FACILITY_MANAGER")
  );

  const [activeTab, setActiveTab] = useState("rules"); // "rules" | "blackouts" | "quotas"
  const [resources, setResources] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Operating Rules State
  const [rules, setRules] = useState([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    resource: "",
    name: "Standard Academic Operating Hours",
    timezone: "Asia/Kolkata",
    minDurationMinutes: 30,
    maxDurationMinutes: 240,
    minLeadTimeMinutes: 60,
    maxAdvanceBookingDays: 14,
    effectiveFrom: "",
    effectiveTo: "",
    windows: [
      { dayOfWeek: "MONDAY", startTime: "08:00", endTime: "20:00" },
      { dayOfWeek: "TUESDAY", startTime: "08:00", endTime: "20:00" },
      { dayOfWeek: "WEDNESDAY", startTime: "08:00", endTime: "20:00" },
      { dayOfWeek: "THURSDAY", startTime: "08:00", endTime: "20:00" },
      { dayOfWeek: "FRIDAY", startTime: "08:00", endTime: "20:00" },
    ],
  });
  const [ruleModalError, setRuleModalError] = useState(null);
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);

  // Blackouts State
  const [blackouts, setBlackouts] = useState([]);
  const [isBlackoutModalOpen, setIsBlackoutModalOpen] = useState(false);
  const [blackoutForm, setBlackoutForm] = useState({
    resource: "",
    reason: "",
    category: "HOLIDAY",
    startAt: "",
    endAt: "",
    description: "",
  });
  const [blackoutModalError, setBlackoutModalError] = useState(null);
  const [isSubmittingBlackout, setIsSubmittingBlackout] = useState(false);

  // Quotas State
  const [quotas, setQuotas] = useState([]);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [quotaForm, setQuotaForm] = useState({
    name: "Department Weekly Hours Limit",
    scopeType: "RESOURCE_TYPE",
    resource: "",
    resourceType: "",
    subjectType: "DEPARTMENT",
    role: "STUDENT",
    department: "Computer Science and Engineering",
    metric: "DURATION_MINUTES",
    period: "WEEKLY",
    limit: 600, // 10 hours
    timezone: "Asia/Kolkata",
  });
  const [quotaModalError, setQuotaModalError] = useState(null);
  const [isSubmittingQuota, setIsSubmittingQuota] = useState(false);

  // Load all foundational data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resData, typesData, rulesData, blackoutsData, quotasData] =
        await Promise.all([
          api.resources.list({ limit: 100 }),
          api.resources.getTypes().catch(() => ({ resourceTypes: [] })),
          api.availabilityRules.list().catch(() => ({ rules: [] })),
          api.blackouts.list().catch(() => ({ blackouts: [] })),
          api.quotas.list().catch(() => ({ quotas: [] })),
        ]);

      setResources(resData.resources || []);
      setResourceTypes(typesData.resourceTypes || []);
      setRules(rulesData.rules || []);
      setBlackouts(blackoutsData.blackouts || []);
      setQuotas(quotasData.quotas || []);

      if (resData.resources?.length > 0 && !ruleForm.resource) {
        setRuleForm((prev) => ({ ...prev, resource: resData.resources[0]._id }));
        setBlackoutForm((prev) => ({ ...prev, resource: resData.resources[0]._id }));
      }
      if (typesData.resourceTypes?.length > 0 && !quotaForm.resourceType) {
        setQuotaForm((prev) => ({ ...prev, resourceType: typesData.resourceTypes[0]._id }));
      }
    } catch (err) {
      console.error("Failed to load availability rules data", err);
      setError(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Operating Rule Handlers
  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setRuleForm({
      resource: resources[0]?._id || "",
      name: "Standard Academic Operating Hours",
      timezone: "Asia/Kolkata",
      minDurationMinutes: 30,
      maxDurationMinutes: 240,
      minLeadTimeMinutes: 60,
      maxAdvanceBookingDays: 14,
      effectiveFrom: "",
      effectiveTo: "",
      windows: [
        { dayOfWeek: "MONDAY", startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: "TUESDAY", startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: "WEDNESDAY", startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: "THURSDAY", startTime: "08:00", endTime: "20:00" },
        { dayOfWeek: "FRIDAY", startTime: "08:00", endTime: "20:00" },
      ],
    });
    setRuleModalError(null);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      resource: typeof rule.resource === "object" ? rule.resource?._id : rule.resource,
      name: rule.name || "",
      timezone: rule.timezone || "Asia/Kolkata",
      minDurationMinutes: rule.bookingPolicy?.minDurationMinutes || 30,
      maxDurationMinutes: rule.bookingPolicy?.maxDurationMinutes || 240,
      minLeadTimeMinutes: rule.bookingPolicy?.minLeadTimeMinutes || 0,
      maxAdvanceBookingDays: rule.bookingPolicy?.maxAdvanceBookingDays || 30,
      effectiveFrom: rule.effectiveFrom || "",
      effectiveTo: rule.effectiveTo || "",
      windows: rule.windows || [],
    });
    setRuleModalError(null);
    setIsRuleModalOpen(true);
  };

  const handleAddWindow = () => {
    setRuleForm((prev) => ({
      ...prev,
      windows: [
        ...prev.windows,
        { dayOfWeek: "SATURDAY", startTime: "09:00", endTime: "17:00" },
      ],
    }));
  };

  const handleRemoveWindow = (index) => {
    setRuleForm((prev) => ({
      ...prev,
      windows: prev.windows.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateWindow = (index, field, value) => {
    setRuleForm((prev) => {
      const nextWin = [...prev.windows];
      nextWin[index] = { ...nextWin[index], [field]: value };
      return { ...prev, windows: nextWin };
    });
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    setIsSubmittingRule(true);
    setRuleModalError(null);

    const payload = {
      resource: ruleForm.resource,
      name: ruleForm.name.trim(),
      timezone: ruleForm.timezone,
      bookingPolicy: {
        minDurationMinutes: Number(ruleForm.minDurationMinutes),
        maxDurationMinutes: Number(ruleForm.maxDurationMinutes),
        minLeadTimeMinutes: Number(ruleForm.minLeadTimeMinutes),
        maxAdvanceBookingDays: Number(ruleForm.maxAdvanceBookingDays),
      },
      windows: ruleForm.windows,
      effectiveFrom: ruleForm.effectiveFrom || undefined,
      effectiveTo: ruleForm.effectiveTo || undefined,
    };

    try {
      if (editingRule) {
        await api.availabilityRules.update(editingRule._id, payload);
      } else {
        await api.availabilityRules.create(payload);
      }
      setIsRuleModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Failed to save availability rule", err);
      setRuleModalError(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setIsSubmittingRule(false);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this availability rule?")) return;
    try {
      await api.availabilityRules.delete(id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete rule");
    }
  };

  // Blackout Handlers
  const handleOpenCreateBlackout = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    setBlackoutForm({
      resource: resources[0]?._id || "",
      reason: "Campus Public Holiday",
      category: "HOLIDAY",
      startAt: now.toISOString().slice(0, 16),
      endAt: tomorrow.toISOString().slice(0, 16),
      description: "University closure — all bookings blocked.",
    });
    setBlackoutModalError(null);
    setIsBlackoutModalOpen(true);
  };

  const handleSaveBlackout = async (e) => {
    e.preventDefault();
    setIsSubmittingBlackout(true);
    setBlackoutModalError(null);

    const payload = {
      resource: blackoutForm.resource,
      reason: blackoutForm.reason.trim(),
      category: blackoutForm.category,
      startAt: new Date(blackoutForm.startAt).toISOString(),
      endAt: new Date(blackoutForm.endAt).toISOString(),
      description: blackoutForm.description.trim() || undefined,
    };

    try {
      await api.blackouts.create(payload);
      setIsBlackoutModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Failed to create blackout", err);
      setBlackoutModalError(err instanceof Error ? err.message : "Failed to create blackout");
    } finally {
      setIsSubmittingBlackout(false);
    }
  };

  const handleDeleteBlackout = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this blackout period?")) return;
    try {
      await api.blackouts.delete(id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete blackout");
    }
  };

  // Quota Handlers
  const handleOpenCreateQuota = () => {
    setQuotaForm({
      name: "Department Weekly Hours Limit",
      scopeType: "RESOURCE_TYPE",
      resource: resources[0]?._id || "",
      resourceType: resourceTypes[0]?._id || "",
      subjectType: "DEPARTMENT",
      role: "STUDENT",
      department: "Computer Science and Engineering",
      metric: "DURATION_MINUTES",
      period: "WEEKLY",
      limit: 600,
      timezone: "Asia/Kolkata",
    });
    setQuotaModalError(null);
    setIsQuotaModalOpen(true);
  };

  const handleSaveQuota = async (e) => {
    e.preventDefault();
    setIsSubmittingQuota(true);
    setQuotaModalError(null);

    const payload = {
      name: quotaForm.name.trim(),
      scopeType: quotaForm.scopeType,
      resource: quotaForm.scopeType === "RESOURCE" ? quotaForm.resource : undefined,
      resourceType: quotaForm.scopeType === "RESOURCE_TYPE" ? quotaForm.resourceType : undefined,
      subjectType: quotaForm.subjectType,
      role: quotaForm.subjectType === "ROLE" ? quotaForm.role : undefined,
      department: quotaForm.subjectType === "DEPARTMENT" ? quotaForm.department.trim() : undefined,
      metric: quotaForm.metric,
      period: quotaForm.period,
      limit: Number(quotaForm.limit),
      timezone: quotaForm.timezone,
    };

    try {
      await api.quotas.create(payload);
      setIsQuotaModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Failed to create quota", err);
      setQuotaModalError(err instanceof Error ? err.message : "Failed to create quota");
    } finally {
      setIsSubmittingQuota(false);
    }
  };

  const handleDeleteQuota = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this quota policy?")) return;
    try {
      await api.quotas.delete(id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete quota");
    }
  };

  return (
    <div className="min-h-full py-8 grid-background">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Availability & Booking Rules Engine"
          description="Configure authoritative operating windows, holiday blackout intervals, and multi-dimensional departmental quotas."
          action={
            canManage && (
              <div className="flex items-center gap-2">
                {activeTab === "rules" && (
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={handleOpenCreateRule}
                  >
                    Add Operating Rule
                  </Button>
                )}
                {activeTab === "blackouts" && (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<CalendarOff className="h-4 w-4" />}
                    onClick={handleOpenCreateBlackout}
                  >
                    Add Blackout / Holiday
                  </Button>
                )}
                {activeTab === "quotas" && (
                  <Button
                    size="sm"
                    icon={<Scale className="h-4 w-4" />}
                    onClick={handleOpenCreateQuota}
                  >
                    Add Booking Quota
                  </Button>
                )}
              </div>
            )
          }
        />

        {/* Tab Selector */}
        <div className="flex border-b border-border/80 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "rules"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Operating Hours & Policies ({rules.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("blackouts")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "blackouts"
                ? "border-danger text-danger"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <CalendarOff className="h-4 w-4" />
            <span>Blackouts & Holidays ({blackouts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quotas")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "quotas"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Scale className="h-4 w-4" />
            <span>Departmental & Role Quotas ({quotas.length})</span>
          </button>
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error ? (
          <Card className="p-8 text-center border-destructive/40 bg-destructive/5 space-y-4">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-foreground font-semibold">{error}</p>
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={loadData}
            >
              Retry
            </Button>
          </Card>
        ) : (
          <>
            {/* TAB 1: OPERATING RULES */}
            {activeTab === "rules" && (
              <div className="space-y-4">
                {rules.length === 0 ? (
                  <Card className="min-h-[250px] flex items-center justify-center p-8">
                    <EmptyState
                      icon={<Clock className="h-8 w-8 text-primary" />}
                      title="No Operating Hours Configured"
                      description="Create an availability rule to define recurring weekly operating windows, duration bounds, and lead times."
                    />
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {rules.map((rule) => (
                      <Card
                        key={rule._id}
                        className="p-5 border-border bg-surface/90 hover:border-primary/40 transition-colors space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-foreground">
                                {rule.name}
                              </h3>
                              <Badge variant={rule.isActive ? "available" : "secondary"}>
                                {rule.isActive ? "ACTIVE" : "INACTIVE"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted mt-0.5">
                              Target Facility:{" "}
                              <strong className="text-foreground">
                                {rule.resource?.name || "All Facilities"} (
                                {rule.resource?.code || "N/A"})
                              </strong>{" "}
                              • Timezone: <span className="font-mono">{rule.timezone}</span>
                            </p>
                          </div>

                          {canManage && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="xs"
                                variant="outline"
                                icon={<Pencil className="h-3.5 w-3.5" />}
                                onClick={() => handleOpenEditRule(rule)}
                              >
                                Edit Policy
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                className="text-danger hover:bg-danger/10"
                                icon={<Trash2 className="h-3.5 w-3.5" />}
                                onClick={() => handleDeleteRule(rule._id)}
                              >
                                Deactivate
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Booking Policies Overview */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-2/30 p-3 rounded-lg text-xs">
                          <div>
                            <span className="text-muted block">Min Duration:</span>
                            <span className="font-semibold text-foreground">
                              {rule.bookingPolicy?.minDurationMinutes} mins
                            </span>
                          </div>
                          <div>
                            <span className="text-muted block">Max Duration:</span>
                            <span className="font-semibold text-foreground">
                              {rule.bookingPolicy?.maxDurationMinutes} mins
                            </span>
                          </div>
                          <div>
                            <span className="text-muted block">Min Lead Time:</span>
                            <span className="font-semibold text-foreground">
                              {rule.bookingPolicy?.minLeadTimeMinutes} mins
                            </span>
                          </div>
                          <div>
                            <span className="text-muted block">Advance Limit:</span>
                            <span className="font-semibold text-foreground">
                              {rule.bookingPolicy?.maxAdvanceBookingDays} days
                            </span>
                          </div>
                        </div>

                        {/* Weekly Windows */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                            Recurring Weekly Operating Hours
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {rule.windows?.map((win, idx) => (
                              <div
                                key={idx}
                                className="text-xs px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-foreground flex items-center gap-1.5 font-medium"
                              >
                                <span className="text-primary-bright font-bold">
                                  {win.dayOfWeek.slice(0, 3)}
                                </span>
                                <span>
                                  {win.startTime} – {win.endTime}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: BLACKOUTS & HOLIDAYS */}
            {activeTab === "blackouts" && (
              <div className="space-y-4">
                {blackouts.length === 0 ? (
                  <Card className="min-h-[250px] flex items-center justify-center p-8">
                    <EmptyState
                      icon={<CalendarOff className="h-8 w-8 text-danger" />}
                      title="No Blackouts or Closures Configured"
                      description="Create a blackout interval to block university holidays, emergency closures, or special campus events."
                    />
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {blackouts.map((bo) => (
                      <Card
                        key={bo._id}
                        className="p-5 border-border bg-surface/90 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  bo.category === "HOLIDAY"
                                    ? "warning"
                                    : bo.category === "SPECIAL_EVENT"
                                    ? "primary"
                                    : "danger"
                                }
                              >
                                {bo.category}
                              </Badge>
                              <h4 className="text-base font-semibold text-foreground">
                                {bo.reason}
                              </h4>
                            </div>
                            <p className="text-xs text-muted mt-1">
                              Resource:{" "}
                              <strong className="text-foreground">
                                {bo.resource?.name || "Campus-wide"} (
                                {bo.resource?.code || "N/A"})
                              </strong>
                            </p>
                          </div>

                          {canManage && (
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-danger hover:bg-danger/10"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              onClick={() => handleDeleteBlackout(bo._id)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>

                        <div className="p-2.5 rounded bg-surface-2/40 border border-border/50 text-xs font-mono space-y-1">
                          <div className="flex items-center justify-between text-muted">
                            <span>Blocked From:</span>
                            <span className="text-foreground font-semibold">
                              {new Date(bo.startAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-muted">
                            <span>Blocked Until:</span>
                            <span className="text-foreground font-semibold">
                              {new Date(bo.endAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {bo.description && (
                          <p className="text-xs text-muted leading-relaxed">
                            {bo.description}
                          </p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DEPARTMENTAL & ROLE QUOTAS */}
            {activeTab === "quotas" && (
              <div className="space-y-4">
                {quotas.length === 0 ? (
                  <Card className="min-h-[250px] flex items-center justify-center p-8">
                    <EmptyState
                      icon={<Scale className="h-8 w-8 text-primary" />}
                      title="No Quotas Enforced"
                      description="Create a quota policy to prevent booking monopolization by department or student role."
                    />
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quotas.map((q) => (
                      <Card
                        key={q._id}
                        className="p-5 border-border bg-surface/90 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="primary">{q.period}</Badge>
                              <h4 className="text-base font-semibold text-foreground">
                                {q.name}
                              </h4>
                            </div>
                            <p className="text-xs text-muted mt-1">
                              Subject:{" "}
                              <strong className="text-foreground">
                                {q.subjectType === "DEPARTMENT"
                                  ? `Dept: ${q.department}`
                                  : q.subjectType === "ROLE"
                                  ? `Role: ${q.role}`
                                  : `User ID: ${q.user?._id || "User"}`}
                              </strong>
                            </p>
                          </div>

                          {canManage && (
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-danger hover:bg-danger/10"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              onClick={() => handleDeleteQuota(q._id)}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>

                        <div className="p-3 rounded-lg bg-surface-2/40 border border-border/50 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-muted block">Enforced Limit:</span>
                            <span className="text-base font-bold text-primary-bright">
                              {q.metric === "DURATION_MINUTES"
                                ? `${q.limit} mins (${Math.round(q.limit / 60)} hrs)`
                                : `${q.limit} bookings`}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted block">Scope Target:</span>
                            <span className="font-semibold text-foreground">
                              {q.scopeType === "RESOURCE_TYPE"
                                ? `Category: ${q.resourceType?.name || "All Types"}`
                                : `Facility: ${q.resource?.name || "All Rooms"}`}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* MODAL 1: CONFIGURE AVAILABILITY RULE */}
        <Modal
          open={isRuleModalOpen}
          onClose={() => setIsRuleModalOpen(false)}
          title={editingRule ? "Edit Availability Policy" : "Configure Operating Hours & Policy"}
          description="Define half-open operating windows [start, end) and booking duration bounds."
          size="lg"
        >
          <form onSubmit={handleSaveRule} className="space-y-4">
            {ruleModalError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{ruleModalError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Target Resource Facility"
                value={ruleForm.resource}
                required
                options={resources.map((r) => ({
                  value: r._id,
                  label: `${r.name} (${r.code})`,
                }))}
                onChange={(e) =>
                  setRuleForm((prev) => ({ ...prev, resource: e.target.value }))
                }
              />

              <Input
                label="Rule Name"
                value={ruleForm.name}
                required
                onChange={(e) =>
                  setRuleForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Authoritative Timezone (IANA)"
                value={ruleForm.timezone}
                required
                options={TIMEZONES}
                onChange={(e) =>
                  setRuleForm((prev) => ({ ...prev, timezone: e.target.value }))
                }
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Min Duration (min)"
                  type="number"
                  min="15"
                  value={ruleForm.minDurationMinutes}
                  required
                  onChange={(e) =>
                    setRuleForm((prev) => ({
                      ...prev,
                      minDurationMinutes: e.target.value,
                    }))
                  }
                />
                <Input
                  label="Max Duration (min)"
                  type="number"
                  min="30"
                  value={ruleForm.maxDurationMinutes}
                  required
                  onChange={(e) =>
                    setRuleForm((prev) => ({
                      ...prev,
                      maxDurationMinutes: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Min Lead Time (min)"
                type="number"
                min="0"
                value={ruleForm.minLeadTimeMinutes}
                onChange={(e) =>
                  setRuleForm((prev) => ({
                    ...prev,
                    minLeadTimeMinutes: e.target.value,
                  }))
                }
              />

              <Input
                label="Max Advance Booking (days)"
                type="number"
                min="1"
                value={ruleForm.maxAdvanceBookingDays}
                onChange={(e) =>
                  setRuleForm((prev) => ({
                    ...prev,
                    maxAdvanceBookingDays: e.target.value,
                  }))
                }
              />
            </div>

            {/* Operating Windows */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted">
                  Operating Time Windows (HH:mm)
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  icon={<Plus className="h-3 w-3" />}
                  onClick={handleAddWindow}
                >
                  Add Window
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {ruleForm.windows.map((win, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded bg-surface-2/40 border border-border/40 text-xs"
                  >
                    <select
                      value={win.dayOfWeek}
                      onChange={(e) =>
                        handleUpdateWindow(idx, "dayOfWeek", e.target.value)
                      }
                      className="rounded bg-surface border border-border px-2 py-1 text-foreground"
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="08:00"
                      value={win.startTime}
                      onChange={(e) =>
                        handleUpdateWindow(idx, "startTime", e.target.value)
                      }
                      className="w-20 rounded bg-surface border border-border px-2 py-1 text-center font-mono text-foreground"
                    />
                    <span>to</span>
                    <input
                      type="text"
                      placeholder="20:00"
                      value={win.endTime}
                      onChange={(e) =>
                        handleUpdateWindow(idx, "endTime", e.target.value)
                      }
                      className="w-20 rounded bg-surface border border-border px-2 py-1 text-center font-mono text-foreground"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveWindow(idx)}
                      className="ml-auto text-muted hover:text-danger p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingRule}
                onClick={() => setIsRuleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmittingRule}>
                Save Availability Rule
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL 2: ADD BLACKOUT / HOLIDAY */}
        <Modal
          open={isBlackoutModalOpen}
          onClose={() => setIsBlackoutModalOpen(false)}
          title="Block Facility Interval (Blackout / Holiday)"
          description="Reservations overlapping this interval will be authoritatively rejected by the booking engine."
          size="md"
        >
          <form onSubmit={handleSaveBlackout} className="space-y-4">
            {blackoutModalError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{blackoutModalError}</span>
              </div>
            )}

            <Select
              label="Target Facility"
              value={blackoutForm.resource}
              required
              options={resources.map((r) => ({
                value: r._id,
                label: `${r.name} (${r.code})`,
              }))}
              onChange={(e) =>
                setBlackoutForm((prev) => ({ ...prev, resource: e.target.value }))
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Reason / Closure Title"
                placeholder="e.g. Diwali Public Holiday"
                value={blackoutForm.reason}
                required
                onChange={(e) =>
                  setBlackoutForm((prev) => ({ ...prev, reason: e.target.value }))
                }
              />

              <Select
                label="Category"
                value={blackoutForm.category}
                options={[
                  { value: "HOLIDAY", label: "HOLIDAY" },
                  { value: "SPECIAL_EVENT", label: "SPECIAL EVENT" },
                  { value: "ADMINISTRATIVE", label: "ADMINISTRATIVE CLOSURE" },
                  { value: "OTHER", label: "OTHER" },
                ]}
                onChange={(e) =>
                  setBlackoutForm((prev) => ({ ...prev, category: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Start Time (Local)"
                type="datetime-local"
                value={blackoutForm.startAt}
                required
                onChange={(e) =>
                  setBlackoutForm((prev) => ({ ...prev, startAt: e.target.value }))
                }
              />

              <Input
                label="End Time (Local)"
                type="datetime-local"
                value={blackoutForm.endAt}
                required
                onChange={(e) =>
                  setBlackoutForm((prev) => ({ ...prev, endAt: e.target.value }))
                }
              />
            </div>

            <Input
              label="Description / Notes"
              placeholder="e.g. Campus closed for statutory public holiday."
              value={blackoutForm.description}
              onChange={(e) =>
                setBlackoutForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingBlackout}
                onClick={() => setIsBlackoutModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={isSubmittingBlackout}>
                Enforce Blackout
              </Button>
            </div>
          </form>
        </Modal>

        {/* MODAL 3: ADD QUOTA */}
        <Modal
          open={isQuotaModalOpen}
          onClose={() => setIsQuotaModalOpen(false)}
          title="Create Booking Quota Policy"
          description="Enforce departmental or student role limits across days, weeks, or months."
          size="md"
        >
          <form onSubmit={handleSaveQuota} className="space-y-4">
            {quotaModalError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{quotaModalError}</span>
              </div>
            )}

            <Input
              label="Quota Policy Name"
              value={quotaForm.name}
              required
              onChange={(e) =>
                setQuotaForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Scope Type"
                value={quotaForm.scopeType}
                options={[
                  { value: "RESOURCE_TYPE", label: "Resource Category (Type)" },
                  { value: "RESOURCE", label: "Specific Facility (Resource)" },
                ]}
                onChange={(e) =>
                  setQuotaForm((prev) => ({ ...prev, scopeType: e.target.value }))
                }
              />

              {quotaForm.scopeType === "RESOURCE_TYPE" ? (
                <Select
                  label="Target Category"
                  value={quotaForm.resourceType}
                  options={resourceTypes.map((t) => ({
                    value: t._id,
                    label: `${t.name} (${t.code})`,
                  }))}
                  onChange={(e) =>
                    setQuotaForm((prev) => ({ ...prev, resourceType: e.target.value }))
                  }
                />
              ) : (
                <Select
                  label="Target Facility"
                  value={quotaForm.resource}
                  options={resources.map((r) => ({
                    value: r._id,
                    label: `${r.name} (${r.code})`,
                  }))}
                  onChange={(e) =>
                    setQuotaForm((prev) => ({ ...prev, resource: e.target.value }))
                  }
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Subject Type"
                value={quotaForm.subjectType}
                options={[
                  { value: "DEPARTMENT", label: "DEPARTMENT (Academic / Admin Unit)" },
                  { value: "ROLE", label: "USER ROLE (e.g. STUDENT)" },
                ]}
                onChange={(e) =>
                  setQuotaForm((prev) => ({ ...prev, subjectType: e.target.value }))
                }
              />

              {quotaForm.subjectType === "DEPARTMENT" ? (
                <Input
                  label="Department Name"
                  placeholder="e.g. Computer Science"
                  value={quotaForm.department}
                  required
                  onChange={(e) =>
                    setQuotaForm((prev) => ({ ...prev, department: e.target.value }))
                  }
                />
              ) : (
                <Select
                  label="User Role"
                  value={quotaForm.role}
                  options={[
                    { value: "STUDENT", label: "STUDENT" },
                    { value: "FACULTY", label: "FACULTY" },
                    { value: "STAFF", label: "STAFF" },
                  ]}
                  onChange={(e) =>
                    setQuotaForm((prev) => ({ ...prev, role: e.target.value }))
                  }
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Metric"
                value={quotaForm.metric}
                options={[
                  { value: "DURATION_MINUTES", label: "Duration (Minutes)" },
                  { value: "BOOKING_COUNT", label: "Booking Count" },
                ]}
                onChange={(e) =>
                  setQuotaForm((prev) => ({ ...prev, metric: e.target.value }))
                }
              />

              <Select
                label="Period"
                value={quotaForm.period}
                options={[
                  { value: "DAILY", label: "Daily" },
                  { value: "WEEKLY", label: "Weekly" },
                  { value: "MONTHLY", label: "Monthly" },
                ]}
                onChange={(e) =>
                  setQuotaForm((prev) => ({ ...prev, period: e.target.value }))
                }
              />

              <Input
                label="Limit Cap"
                type="number"
                min="1"
                value={quotaForm.limit}
                required
                onChange={(e) =>
                  setQuotaForm((prev) => ({ ...prev, limit: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingQuota}
                onClick={() => setIsQuotaModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmittingQuota}>
                Enforce Quota
              </Button>
            </div>
          </form>
        </Modal>
      </PageContainer>
    </div>
  );
}
