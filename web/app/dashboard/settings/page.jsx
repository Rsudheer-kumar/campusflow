"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  User,
  Bell,
  Clock,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  Server,
  Layers,
  KeyRound,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/layout";
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  Skeleton,
  ErrorState,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Form states
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [defaultView, setDefaultView] = useState("week");
  const [notifications, setNotifications] = useState(true);
  const [timezone, setTimezone] = useState("UTC");

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await api.auth.getProfile();
      setProfile(data);
      setName(data.name || "");
      setDepartment(data.department || "");
      setDefaultView(data.preferences?.defaultView || "week");
      setNotifications(data.preferences?.notifications ?? true);
      setTimezone(data.preferences?.timezone || "UTC");
    } catch (err) {
      setFetchError(err?.message || "Failed to load user settings.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    api.auth
      .getProfile()
      .then((data) => {
        if (!ignore) {
          setProfile(data);
          setName(data.name || "");
          setDepartment(data.department || "");
          setDefaultView(data.preferences?.defaultView || "week");
          setNotifications(data.preferences?.notifications ?? true);
          setTimezone(data.preferences?.timezone || "UTC");
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setFetchError(err?.message || "Failed to load user settings.");
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const updated = await api.auth.updateProfile({
        name,
        department,
        preferences: {
          defaultView,
          notifications,
          timezone,
        },
      });
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err?.message || "Failed to update profile settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = Boolean(profile?.roles?.includes("ADMIN") || user?.roles?.includes("ADMIN"));

  return (
    <div className="min-h-full py-8">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Account & System Settings"
          description="Manage your institutional profile, display preferences, and view platform configuration."
        />

        {fetchError ? (
          <ErrorState
            title="Unable to Load Settings"
            message={fetchError}
            onRetry={loadProfile}
          />
        ) : isLoading ? (
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
            <Card className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          </div>
        ) : profile ? (
          <form onSubmit={handleSave} className="space-y-6">
            {saveSuccess && (
              <div className="p-4 rounded-[var(--radius-md)] bg-success/10 border border-success/30 flex items-center gap-3 text-success">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">
                  Settings updated successfully! Your preferences have been saved.
                </span>
              </div>
            )}

            {saveError && (
              <div className="p-4 rounded-[var(--radius-md)] bg-danger/10 border border-danger/30 flex items-center gap-3 text-danger">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{saveError}</span>
              </div>
            )}

            {/* Profile & Identity Card */}
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <User className="h-5 w-5 text-primary-bright" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Institutional Identity
                  </h3>
                  <p className="text-xs text-muted">
                    Your campus credentials, authorized roles, and academic department.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Email Address (Read-only)
                  </label>
                  <Input
                    value={profile.email}
                    disabled
                    className="opacity-70 cursor-not-allowed bg-surface-2"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Managed by institutional single sign-on directory.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Campus Roles
                  </label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {profile.roles?.map((role) => (
                      <Badge key={role} variant="primary">
                        {role}
                      </Badge>
                    ))}
                    {profile.isActive && (
                      <Badge variant="success" dot>
                        Active Account
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Full Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Department
                  </label>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science & Engineering"
                  />
                </div>
              </div>
            </Card>

            {/* User Preferences Card */}
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <Settings className="h-5 w-5 text-primary-bright" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Interface & Notification Preferences
                  </h3>
                  <p className="text-xs text-muted">
                    Customize your timetable display format and notification preferences.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Default Calendar View
                  </label>
                  <Select
                    value={defaultView}
                    onChange={(e) => setDefaultView(e.target.value)}
                    options={[
                      { value: "week", label: "Week View (Standard)" },
                      { value: "day", label: "Day View (Detailed)" },
                      { value: "month", label: "Month View (Overview)" },
                    ]}
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Initial layout loaded when opening the campus timetable.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                    Display Timezone Context
                  </label>
                  <Select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    options={[
                      { value: "UTC", label: "UTC (Coordinated Universal Time)" },
                      { value: "America/New_York", label: "America/New_York (Eastern)" },
                      { value: "America/Chicago", label: "America/Chicago (Central)" },
                      { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific)" },
                      { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
                      { value: "Europe/London", label: "Europe/London (GMT/BST)" },
                    ]}
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Dates remain normalized to UTC internally per locked architecture.
                  </p>
                </div>

                <div className="md:col-span-2 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={notifications}
                      onChange={(e) => setNotifications(e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-surface-2 text-primary focus:ring-primary/50"
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        Enable Booking Notification Alerts
                      </span>
                      <p className="text-xs text-muted">
                        Receive instant updates when your reservation enters approval tiers or status transitions.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  icon={<Save className="h-4 w-4" />}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving Preferences…" : "Save Settings"}
                </Button>
              </div>
            </Card>

            {/* System Governance & Architecture (Administrator Context) */}
            {isAdmin && (
              <Card className="p-6 space-y-5 bg-gradient-to-b from-surface to-[#0B1527] border-primary/20">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <Shield className="h-5 w-5 text-primary-bright" />
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        CampusFlow System Governance
                      </h3>
                      <p className="text-xs text-muted">
                        Institution-wide architectural settings and daemon service status.
                      </p>
                    </div>
                  </div>
                  <Badge variant="primary" dot>
                    Administrator Only
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-[var(--radius-sm)] bg-surface-2/60 border border-border">
                    <div className="flex items-center gap-2 text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                      <Clock className="h-3.5 w-3.5 text-primary-bright" />
                      Auto-Release Grace
                    </div>
                    <div className="text-xl font-bold text-foreground">
                      15 Minutes
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Abandoned slots automatically released to campus inventory.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-[var(--radius-sm)] bg-surface-2/60 border border-border">
                    <div className="flex items-center gap-2 text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                      <Database className="h-3.5 w-3.5 text-success" />
                      Database Engine
                    </div>
                    <div className="text-xl font-bold text-foreground">
                      MongoDB 8.2 (rs0)
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Multi-document ACID transactions with replica set isolation.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-[var(--radius-sm)] bg-surface-2/60 border border-border">
                    <div className="flex items-center gap-2 text-muted text-xs font-semibold uppercase tracking-wider mb-1">
                      <KeyRound className="h-3.5 w-3.5 text-primary-bright" />
                      Token Revocation
                    </div>
                    <div className="text-xl font-bold text-foreground">
                      Active (v{profile.tokenVersion ?? 0})
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      Strict tokenVersion verification on all authenticated routes.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </form>
        ) : null}
      </PageContainer>
    </div>
  );
}
