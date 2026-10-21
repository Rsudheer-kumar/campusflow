"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Database,
  Building2,
  Users,
  CalendarDays,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Plus,
  Pencil,
  Archive,
  AlertCircle,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  Star,
  CheckCircle2,
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

const INITIAL_FORM = {
  name: "",
  code: "",
  resourceType: "",
  building: "",
  floor: "",
  roomNumber: "",
  campus: "",
  capacity: 30,
  status: "ACTIVE",
  description: "",
  photos: [],
};

const SAMPLE_CSV_TEMPLATE = `name,code,resourceType,capacity,building,floor,roomNumber,description
Alan Turing Auditorium,ATA-101,LECTURE_HALL,150,Computing Complex,1,101,Main departmental lecture theater with laser projection.
Advanced Robotics Lab,ROBO-204,LABORATORY,30,Engineering Block,2,204,Autonomous systems research lab with workbench power.
Ada Lovelace Seminar Hall,ALH-302,SEMINAR_ROOM,45,Innovation Center,3,302,Executive conference and seminar hall with telepresence.`;

export default function ResourcesPage() {
  const { user } = useAuth();
  const canManage = Boolean(
    user?.roles?.includes("ADMIN") || user?.roles?.includes("FACILITY_MANAGER")
  );

  const [resources, setResources] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState("ALL");

  // Create / Edit Facility Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState(null);

  // Photo Input State in Modal
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoCaption, setNewPhotoCaption] = useState("");
  const [newPhotoIsPrimary, setNewPhotoIsPrimary] = useState(false);

  // Bulk Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Archive Modal State
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState(null);

  // Fetch Resources & Resource Types
  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [resData, typesData] = await Promise.all([
        api.resources.list({ limit: 100 }),
        api.resources.getTypes().catch(() => ({ resourceTypes: [] })),
      ]);
      setResources(resData.resources || []);
      setResourceTypes(typesData.resourceTypes || []);
    } catch (err) {
      console.error("Failed to fetch resources", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load campus resources. Please try again.";
      setFetchError(message);
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Compute unique buildings for filter tabs
  const buildings = useMemo(() => {
    const bSet = new Set();
    for (const r of resources) {
      if (r.location?.building) {
        bSet.add(r.location.building);
      }
    }
    return Array.from(bSet).sort();
  }, [resources]);

  // Filtered resources
  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.location?.building &&
          r.location.building.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesBuilding =
        selectedBuilding === "ALL" || r.location?.building === selectedBuilding;
      return matchesSearch && matchesBuilding;
    });
  }, [resources, searchQuery, selectedBuilding]);

  // Active categories only for resource creation
  const activeCategories = useMemo(() => {
    return resourceTypes.filter((t) => t.isActive !== false);
  }, [resourceTypes]);

  // Modal Handlers
  const handleOpenCreate = () => {
    setEditingResource(null);
    setFormData({
      ...INITIAL_FORM,
      resourceType: activeCategories[0]?._id || resourceTypes[0]?._id || "",
      photos: [],
    });
    setFormErrors({});
    setFormSubmitError(null);
    setNewPhotoUrl("");
    setNewPhotoCaption("");
    setNewPhotoIsPrimary(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (resItem) => {
    setEditingResource(resItem);
    const typeId =
      typeof resItem.resourceType === "object"
        ? resItem.resourceType?._id
        : resItem.resourceType;
    setFormData({
      name: resItem.name || "",
      code: resItem.code || "",
      resourceType: typeId || activeCategories[0]?._id || "",
      building: resItem.location?.building || "",
      floor: resItem.location?.floor || "",
      roomNumber: resItem.location?.roomNumber || "",
      campus: resItem.location?.campus || "",
      capacity: resItem.capacity || 30,
      status: resItem.status || "ACTIVE",
      description: resItem.description || "",
      photos: resItem.photos || [],
    });
    setFormErrors({});
    setFormSubmitError(null);
    setNewPhotoUrl("");
    setNewPhotoCaption("");
    setNewPhotoIsPrimary(false);
    setIsModalOpen(true);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Photo handlers in modal
  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    const isPrimary = newPhotoIsPrimary || formData.photos.length === 0;

    let updatedPhotos = formData.photos;
    if (isPrimary) {
      updatedPhotos = updatedPhotos.map((p) => ({ ...p, isPrimary: false }));
    }

    const newPhoto = {
      url: newPhotoUrl.trim(),
      caption: newPhotoCaption.trim(),
      isPrimary,
    };

    setFormData((prev) => ({
      ...prev,
      photos: [...updatedPhotos, newPhoto],
    }));
    setNewPhotoUrl("");
    setNewPhotoCaption("");
    setNewPhotoIsPrimary(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image file size exceeds the 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result;
      if (typeof dataUri === "string") {
        setNewPhotoUrl(dataUri);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (index) => {
    setFormData((prev) => {
      const remaining = prev.photos.filter((_, i) => i !== index);
      if (remaining.length > 0 && !remaining.some((p) => p.isPrimary)) {
        remaining[0].isPrimary = true;
      }
      return { ...prev, photos: remaining };
    });
  };

  const handleSetPrimaryPhoto = (index) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.map((p, i) => ({
        ...p,
        isPrimary: i === index,
      })),
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    }
    if (!formData.code.trim() || !/^[A-Za-z0-9_-]+$/.test(formData.code.trim())) {
      errors.code = "Code must contain only letters, numbers, hyphens, and underscores";
    }
    if (!formData.resourceType) {
      errors.resourceType = "Please select an active resource category";
    }
    if (!formData.building.trim()) {
      errors.building = "Building name is required";
    }
    const capNum = Number(formData.capacity);
    if (!Number.isInteger(capNum) || capNum < 1) {
      errors.capacity = "Capacity must be an integer >= 1";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveResource = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormSubmitError(null);

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      resourceType: formData.resourceType,
      capacity: Number(formData.capacity),
      location: {
        building: formData.building.trim(),
        floor: formData.floor.trim() || undefined,
        roomNumber: formData.roomNumber.trim() || undefined,
        campus: formData.campus.trim() || undefined,
      },
      description: formData.description.trim() || undefined,
      status: formData.status,
      photos: formData.photos,
    };

    try {
      if (editingResource) {
        await api.resources.update(editingResource._id, payload);
      } else {
        await api.resources.create(payload);
      }
      setIsModalOpen(false);
      await fetchResources();
    } catch (err) {
      console.error("Failed to save resource", err);
      setFormSubmitError(
        err instanceof Error ? err.message : "Failed to save facility"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk CSV Import Handlers
  const handleOpenImport = () => {
    setImportCsvText(SAMPLE_CSV_TEMPLATE);
    setImportError(null);
    setImportResult(null);
    setIsImportModalOpen(true);
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setImportCsvText(text);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleExecuteImport = async () => {
    if (!importCsvText.trim()) {
      setImportError("Please provide CSV content to import.");
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const result = await api.resources.bulkImport(importCsvText);
      setImportResult(result);
      await fetchResources();
    } catch (err) {
      console.error("Failed to bulk import resources", err);
      setImportError(err instanceof Error ? err.message : "Bulk import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setIsArchiving(true);
    setArchiveError(null);

    try {
      await api.resources.archive(archiveTarget._id);
      setArchiveTarget(null);
      await fetchResources();
    } catch (err) {
      console.error("Failed to archive resource", err);
      setArchiveError(
        err instanceof Error ? err.message : "Failed to archive facility"
      );
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="min-h-full py-8 grid-background">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Campus Resource Catalogue"
          description="Browse university lecture halls, computer laboratories, and collaborative facilities."
          action={
            <div className="flex items-center gap-2">
              {canManage && (
                <>
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={handleOpenCreate}
                  >
                    Add Facility
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Upload className="h-4 w-4" />}
                    onClick={handleOpenImport}
                  >
                    Bulk Import CSV
                  </Button>
                </>
              )}
              <Link href="/dashboard/calendar">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<CalendarDays className="h-4 w-4" />}
                >
                  View Full Calendar
                </Button>
              </Link>
            </div>
          }
        />

        {/* Filter & Search Bar */}
        <Card className="p-4 bg-surface-2/40 border-border/80">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:w-80 relative">
              <Input
                placeholder="Search facility name, code, or building..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Building Quick Filters */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedBuilding("ALL")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedBuilding === "ALL"
                    ? "bg-primary text-white"
                    : "bg-surface text-muted hover:text-foreground border border-border"
                }`}
              >
                All Facilities ({resources.length})
              </button>
              {buildings.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSelectedBuilding(b)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedBuilding === b
                      ? "bg-primary text-white"
                      : "bg-surface text-muted hover:text-foreground border border-border"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Resources Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-4">
                <Skeleton className="h-32 w-full rounded" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </Card>
            ))}
          </div>
        ) : fetchError ? (
          <Card className="min-h-[350px] flex items-center justify-center border-destructive/40 bg-destructive/5">
            <div className="flex flex-col items-center gap-4 text-center p-8 max-w-md">
              <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/30">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  Failed to Load Resources
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {fetchError}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={fetchResources}
              >
                Retry
              </Button>
            </div>
          </Card>
        ) : filteredResources.length === 0 ? (
          <Card className="min-h-[350px] flex items-center justify-center">
            <EmptyState
              icon={<Database className="h-8 w-8 text-primary" />}
              title={
                resources.length === 0
                  ? "No Facilities Available"
                  : "No Matching Facilities"
              }
              description={
                resources.length === 0
                  ? "No campus resources have been configured yet. Contact your administrator."
                  : "No campus resources matched your current search filters. Try clearing your query."
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResources.map((resource) => {
              const primaryPhoto =
                resource.photos?.find((p) => p.isPrimary) ||
                resource.photos?.[0];

              return (
                <Card
                  key={resource._id}
                  className="flex flex-col justify-between p-5 border-border hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-lg bg-surface/90"
                >
                  <div className="space-y-3">
                    {/* Facility Image Thumbnail */}
                    {primaryPhoto ? (
                      <div className="relative h-36 w-full rounded-md overflow-hidden bg-surface-2 border border-border/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={primaryPhoto.url}
                          alt={primaryPhoto.caption || resource.name}
                          className="h-full w-full object-cover"
                        />
                        {primaryPhoto.caption && (
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1 text-[11px] text-white truncate backdrop-blur-xs">
                            {primaryPhoto.caption}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-24 w-full rounded-md bg-surface-2/60 border border-dashed border-border/60 flex items-center justify-center text-muted gap-2 text-xs">
                        <ImageIcon className="h-4 w-4" />
                        <span>No image provided</span>
                      </div>
                    )}

                    {/* Top Bar: Code & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-primary-bright px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                        {resource.code}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            resource.status === "ACTIVE"
                              ? "available"
                              : resource.status === "MAINTENANCE"
                              ? "warning"
                              : "secondary"
                          }
                          dot
                        >
                          {resource.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Resource Name & Description */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground leading-snug">
                        {resource.name}
                      </h3>
                      <p className="text-xs text-muted line-clamp-2 mt-1">
                        {resource.description ||
                          "University campus resource facility."}
                      </p>
                    </div>

                    {/* Metadata Chips */}
                    <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs text-muted">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        <span>{resource.location?.building}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>
                          Floor {resource.location?.floor || "1"} • Room{" "}
                          {resource.location?.roomNumber || resource.code}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Users className="h-3.5 w-3.5 text-muted" />
                          {resource.capacity} seats
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-4 mt-4 border-t border-border/50 space-y-2">
                    <Link
                      href={`/dashboard/calendar?resourceId=${resource._id}`}
                      className="block w-full"
                    >
                      <Button
                        variant="primary"
                        className="w-full justify-between group"
                      >
                        <span>View Schedule & Book</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </Link>

                    {/* Admin controls */}
                    {canManage && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => handleOpenEdit(resource)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-muted hover:text-danger"
                          icon={<Archive className="h-3.5 w-3.5" />}
                          disabled={resource.status === "RETIRED"}
                          onClick={() => {
                            setArchiveTarget(resource);
                            setArchiveError(null);
                          }}
                        >
                          {resource.status === "RETIRED" ? "Archived" : "Archive"}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create / Edit Facility Modal */}
        <Modal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingResource ? `Edit Facility: ${editingResource.name}` : "Add Campus Facility"}
          description={
            editingResource
              ? "Update facility specifications, operational status, photos, or room details."
              : "Register a bookable university hall, laboratory, or campus resource."
          }
          size="lg"
        >
          <form onSubmit={handleSaveResource} className="space-y-4">
            {formSubmitError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formSubmitError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Facility Name"
                placeholder="e.g. Turing Lecture Hall"
                value={formData.name}
                error={formErrors.name}
                required
                onChange={(e) => handleFormChange("name", e.target.value)}
              />

              <Input
                label="Facility Code"
                placeholder="e.g. LH101"
                value={formData.code}
                error={formErrors.code}
                required
                onChange={(e) => handleFormChange("code", e.target.value.toUpperCase())}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Resource Category / Type"
                value={formData.resourceType}
                error={formErrors.resourceType}
                required
                options={activeCategories.map((t) => ({
                  value: t._id,
                  label: `${t.name} (${t.code})`,
                }))}
                onChange={(e) => handleFormChange("resourceType", e.target.value)}
              />

              <Input
                label="Capacity (Seats)"
                type="number"
                min="1"
                value={formData.capacity}
                error={formErrors.capacity}
                required
                onChange={(e) => handleFormChange("capacity", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Building"
                placeholder="e.g. Science Center"
                value={formData.building}
                error={formErrors.building}
                required
                onChange={(e) => handleFormChange("building", e.target.value)}
              />

              <Input
                label="Floor"
                placeholder="e.g. 1"
                value={formData.floor}
                onChange={(e) => handleFormChange("floor", e.target.value)}
              />

              <Input
                label="Room Number"
                placeholder="e.g. 101"
                value={formData.roomNumber}
                onChange={(e) => handleFormChange("roomNumber", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Select
                  label="Operational Status"
                  value={formData.status}
                  options={[
                    { value: "ACTIVE", label: "ACTIVE — Operational & Bookable" },
                    { value: "MAINTENANCE", label: "MAINTENANCE — Under Service" },
                    { value: "INACTIVE", label: "INACTIVE — Closed / Disabled" },
                    { value: "RETIRED", label: "RETIRED — Decommissioned (Archived)" },
                  ]}
                  onChange={(e) => handleFormChange("status", e.target.value)}
                />
                {formData.status === "RETIRED" && (
                  <p className="text-[11px] text-warning mt-1">
                    * Retiring this facility automatically deactivates future bookings while preserving historical records.
                  </p>
                )}
              </div>

              <Input
                label="Campus Zone"
                placeholder="e.g. North Campus"
                value={formData.campus}
                onChange={(e) => handleFormChange("campus", e.target.value)}
              />
            </div>

            <Textarea
              label="Description / Equipment Notes"
              placeholder="e.g. Dual 4K laser projectors, 120 seats with power outlets, microphones..."
              rows={2}
              value={formData.description}
              onChange={(e) => handleFormChange("description", e.target.value)}
            />

            {/* Photo Management Section */}
            <div className="pt-2 border-t border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted">
                  Facility Photos & Visual Assets
                </span>
                <span className="text-xs text-muted">
                  {formData.photos.length}/10 uploaded
                </span>
              </div>

              {/* Add New Photo Fields */}
              <div className="p-3 rounded-lg bg-surface-2/40 border border-border/60 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Paste image URL (https://... or data:image/...)"
                    value={newPhotoUrl}
                    onChange={(e) => setNewPhotoUrl(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Caption (e.g. Front Stage)"
                      value={newPhotoCaption}
                      onChange={(e) => setNewPhotoCaption(e.target.value)}
                    />
                    <label className="cursor-pointer shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <span className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-2 text-foreground">
                        <Upload className="h-3.5 w-3.5" />
                        File
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPhotoIsPrimary}
                      onChange={(e) => setNewPhotoIsPrimary(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>Set as Primary Display Photo</span>
                  </label>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    disabled={!newPhotoUrl.trim()}
                    onClick={handleAddPhoto}
                  >
                    Add Photo
                  </Button>
                </div>
              </div>

              {/* Photos Gallery */}
              {formData.photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {formData.photos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative group rounded border border-border overflow-hidden bg-surface aspect-video"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption || `Facility ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {photo.isPrimary && (
                        <div className="absolute top-1 left-1 bg-primary text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                          Primary
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                        {!photo.isPrimary && (
                          <button
                            type="button"
                            title="Set Primary"
                            onClick={() => handleSetPrimaryPhoto(index)}
                            className="p-1 rounded bg-surface text-foreground hover:text-primary"
                          >
                            <Star className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Remove Photo"
                          onClick={() => handleRemovePhoto(index)}
                          className="p-1 rounded bg-surface text-danger hover:bg-danger/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                {editingResource ? "Save Changes" : "Create Facility"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Bulk CSV Import Modal */}
        <Modal
          open={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          title="Bulk CSV Resource Import"
          description="Batch import university facilities with row-level validation, duplicate detection, and category verification."
          size="lg"
        >
          <div className="space-y-4">
            {importError && (
              <div className="p-3 rounded bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {importResult && (
              <div className="p-4 rounded-lg bg-surface-2/60 border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="text-sm font-semibold text-foreground">
                    Bulk Import Processed: {importResult.importedCount} of {importResult.totalRows} successfully imported.
                  </span>
                </div>

                {importResult.errors?.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <span className="text-xs font-bold text-danger uppercase tracking-wider block">
                      Row-Level Validation Rejections ({importResult.errors.length})
                    </span>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {importResult.errors.map((err, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-danger/5 border border-danger/20 text-xs flex items-start gap-2"
                        >
                          <span className="font-mono font-bold text-danger shrink-0">
                            Row {err.row}:
                          </span>
                          <span className="text-foreground">
                            {err.code ? `[${err.code}] ` : ""}
                            {err.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCsvFileUpload}
                />
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-2 text-foreground">
                  <Upload className="h-3.5 w-3.5" />
                  Upload CSV File
                </span>
              </label>

              <button
                type="button"
                onClick={() => setImportCsvText(SAMPLE_CSV_TEMPLATE)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                Reset Sample CSV Template
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted block mb-1">
                CSV Payload Content (Headers: name, code, resourceType, capacity, building, floor, roomNumber, description)
              </label>
              <textarea
                rows={8}
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder="name,code,resourceType,capacity,building,floor,roomNumber,description"
                className="w-full font-mono text-xs p-3 rounded-lg bg-surface border border-border text-foreground focus:outline-hidden focus:border-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <Button
                variant="outline"
                disabled={isImporting}
                onClick={() => setIsImportModalOpen(false)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                loading={isImporting}
                onClick={handleExecuteImport}
              >
                Import Resources
              </Button>
            </div>
          </div>
        </Modal>

        {/* Archive Confirmation Modal */}
        <Modal
          open={!!archiveTarget}
          onClose={() => setArchiveTarget(null)}
          title={`Archive Facility: ${archiveTarget?.name}`}
          description="Safe deactivation will retire this facility from future bookings while preserving historical records."
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
              Are you sure you want to retire{" "}
              <strong className="text-foreground">{archiveTarget?.name}</strong> (
              <span className="font-mono text-xs">{archiveTarget?.code}</span>)? It will
              be marked as <strong className="text-warning">RETIRED</strong> and removed from the active booking catalogue.
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
                Confirm Deactivation
              </Button>
            </div>
          </div>
        </Modal>
      </PageContainer>
    </div>
  );
}
