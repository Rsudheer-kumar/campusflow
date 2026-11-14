"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QRCode } from "@/components/ui/qr-code";
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  Timer,
  Clock,
  Building2,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Copy,
  Check,
  Camera,
  CameraOff,
  DoorOpen,
  Sparkles,
  Zap,
  MapPin,
  Flame,
} from "lucide-react";
import { api } from "@/lib/api";
import QrScanner from "qr-scanner";

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // AudioContext not allowed or not supported; ignore silently
  }
}

export function CheckInModal({ open, onClose, booking, onSuccess }) {
  const [activeTab, setActiveTab] = useState("camera"); // "camera" | "plaque" | "manual"
  const [tokenData, setTokenData] = useState(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [scannedResourceId, setScannedResourceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [tokenSecondsRemaining, setTokenSecondsRemaining] = useState(null);
  const [graceSecondsRemaining, setGraceSecondsRemaining] = useState(null);
  const [earlyTestMode, setEarlyTestMode] = useState(false);

  // Camera Scanner state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [scannedFeedback, setScannedFeedback] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const qrScannerRef = useRef(null);

  // Extract facility info
  const resObj =
    typeof booking?.resource === "object" && booking?.resource !== null
      ? booking.resource
      : null;
  const resourceName = resObj?.name || "Campus Facility";
  const resourceCode = resObj?.code || "FACILITY";
  const building = resObj?.location?.building || "University Campus";
  const block = resObj?.block ? `Block ${resObj.block}` : "Main Campus";
  const floor = resObj?.location?.floor != null ? `Floor ${resObj.location.floor}` : "";

  // Time calculations
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startAtMs = booking?.startAt ? new Date(booking.startAt).getTime() : 0;
  const endAtMs = booking?.endAt ? new Date(booking.endAt).getTime() : 0;
  const earlyWindowMinutes = 15;
  const validFromMs = startAtMs - earlyWindowMinutes * 60000;
  const isWithinWindow = nowMs >= validFromMs && nowMs <= endAtMs;
  const isEarly = nowMs < validFromMs;
  const minutesUntilOpen = isEarly ? Math.max(1, Math.ceil((validFromMs - nowMs) / 60000)) : 0;

  // Request fresh token with optional early test mode
  const fetchToken = useCallback(
    async (allowEarly = false) => {
      if (!booking?._id) return;
      setIsLoadingToken(true);
      setTokenError(null);
      try {
        const data = await api.bookings.getCheckInToken(booking._id, { allowEarly });
        setTokenData(data);
        setScannedResourceId(data.resourceId || resourceCode);
      } catch (err) {
        setTokenError(
          err instanceof Error ? err.message : "Failed to generate ephemeral check-in token"
        );
      } finally {
        setIsLoadingToken(false);
      }
    },
    [booking, resourceCode]
  );

  // Initial load when modal opens
  useEffect(() => {
    if (!open || !booking?._id || booking.status !== "CONFIRMED") {
      return;
    }
    fetchToken(earlyTestMode);
  }, [open, booking, earlyTestMode, fetchToken]);

  // Live countdown timer for token expiry and grace window
  useEffect(() => {
    if (!open || !tokenData) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const tokenExp = new Date(tokenData.expiresAt).getTime();
      const graceExp = new Date(tokenData.validUntil).getTime();
      const remToken = Math.max(0, Math.floor((tokenExp - now) / 1000));
      const remGrace = Math.max(0, Math.floor((graceExp - now) / 1000));
      setTokenSecondsRemaining(remToken);
      setGraceSecondsRemaining(remGrace);
    }, 1000);
    return () => clearInterval(interval);
  }, [open, tokenData]);

  // Handle camera stream setup
  const stopCamera = useCallback(() => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Code processor for camera scans
  const handleDetectedCode = useCallback((code) => {
    playBeep();
    const clean = String(code).trim();
    let matchedCode = resourceCode;

    if (clean.includes("CAMPUSFLOW-DOOR:")) {
      const parts = clean.split(":");
      matchedCode = parts[1] || resourceCode;
    } else if (clean.includes(resourceCode)) {
      matchedCode = resourceCode;
    } else if (clean.length > 0) {
      matchedCode = resourceCode;
    }

    setScannedResourceId(matchedCode);
    setScannedFeedback({
      code: matchedCode,
      raw: clean,
      time: new Date().toLocaleTimeString(),
    });
    stopCamera();
  }, [resourceCode, stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Camera API is not supported in this browser environment.");
      }
      if (!videoRef.current) {
        throw new Error("Camera preview is not ready. Please try again.");
      }

      stopCamera();
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const value = typeof result === "string" ? result : result?.data;
          if (value) handleDetectedCode(value);
        },
        {
          preferredCamera: "environment",
          returnDetailedScanResult: true,
        }
      );
      qrScannerRef.current = scanner;
      await scanner.start();
      setIsCameraActive(true);
    } catch (err) {
      stopCamera();
      setCameraError(
        err instanceof Error ? err.message : "Unable to access camera. Please allow camera permissions."
      );
      setIsCameraActive(false);
    }
  }, [handleDetectedCode, stopCamera]);

  // Camera scanner uses qr-scanner so it works in browsers without BarcodeDetector.
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Instant Test Door Scan trigger
  const handleTestScan = () => {
    handleDetectedCode(`CAMPUSFLOW-DOOR:${resourceCode}:${resObj?._id || ""}`);
  };

  // Submit QR check-in
  const handleCheckInSubmit = async () => {
    if (!booking) return;

    // If no token was loaded yet (e.g. before window), request one with allowEarly
    let activeToken = tokenData?.token;
    if (!activeToken) {
      try {
        setIsSubmitting(true);
        const data = await api.bookings.getCheckInToken(booking._id, { allowEarly: true });
        setTokenData(data);
        activeToken = data.token;
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Unable to acquire check-in token.");
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const facilityId = resObj?._id || tokenData?.resourceId || "";
      const effectiveResourceId = facilityId || scannedResourceId.trim() || resourceCode;

      const res = await api.bookings.checkIn(booking._id, {
        token: activeToken,
        resourceId: effectiveResourceId,
        scannedCode: scannedResourceId.trim() || resourceCode,
        allowEarly: true,
      });

      playBeep();
      setSuccessInfo({
        checkInAt: res.checkInAt || new Date().toISOString(),
        isIdempotent: res.isIdempotent,
        allocatedRoom: res.allocatedRoom || {
          name: resourceName,
          code: resourceCode,
          building,
          block,
        },
      });
      onSuccess();
    } catch (err) {
      const errorMsg = Array.isArray(err?.details?.errors)
        ? err.details.errors.map(e => e.message).join(", ")
        : err instanceof Error
        ? err.message
        : "Check-in failed. Please verify credentials.";
      setSubmitError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Early Checkout
  const handleCheckout = async () => {
    if (!booking) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.bookings.checkout(booking._id);
      onSuccess();
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to check out");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setTokenData(null);
    setTokenError(null);
    setSuccessInfo(null);
    setSubmitError(null);
    setScannedFeedback(null);
    setIsLoadingToken(false);
    setEarlyTestMode(false);
    onClose();
  };

  if (!booking) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={booking.status === "CHECKED_IN" ? "Active Session & Checkout" : "Facility Check-In & Room Access"}
      description={`Reservation: ${booking.title}`}
      size="md"
    >
      <div className="space-y-4">
        {/* Status & Facility Header */}
        <div className="p-3.5 rounded-lg bg-surface-2/70 border border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-primary/10 border border-primary/20 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-foreground block">{resourceName}</span>
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span className="font-mono text-primary font-bold">{resourceCode}</span>
                <span>•</span>
                <span>{building}</span>
                {floor && <span>• {floor}</span>}
              </div>
            </div>
          </div>
          <Badge
            variant={
              booking.status === "CHECKED_IN"
                ? "available"
                : booking.status === "CONFIRMED"
                ? "warning"
                : "neutral"
            }
          >
            {booking.status}
          </Badge>
        </div>

        {/* ===================== VIEW 1: ACTIVE SESSION & CHECKOUT ===================== */}
        {booking.status === "CHECKED_IN" ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-success/10 border border-success/30 text-success text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <DoorOpen className="h-5 w-5 shrink-0" />
                <span>Room Allocated • Session Currently Active</span>
              </div>
              <p className="text-[11px] text-foreground/80 leading-relaxed">
                You checked into <strong>{resourceName} ({resourceCode})</strong> {booking.checkInAt ? `at ${new Date(booking.checkInAt).toLocaleTimeString()}` : "successfully"}. The room door is unlocked and capacity is allocated to you.
              </p>
            </div>

            {submitError && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
                Keep Session Active
              </Button>
              <Button
                variant="danger"
                icon={<LogOut className="h-4 w-4" />}
                onClick={handleCheckout}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Checking out..." : "Check Out & Release Room"}
              </Button>
            </div>
          </div>
        ) : successInfo ? (
          /* ===================== VIEW 2: CELEBRATORY ROOM ALLOCATION ===================== */
          <div className="space-y-4 text-center py-4">
            <div className="relative mx-auto w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center shadow-lg border-2 border-success/30 animate-in zoom-in-75 duration-300">
              <DoorOpen className="h-8 w-8 text-success" />
              <div className="absolute -top-1 -right-1 p-1 bg-primary rounded-full text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="space-y-1">
              <Badge variant="available" className="uppercase font-bold tracking-wider">
                Access Granted • Door Unlocked
              </Badge>
              <h3 className="text-lg font-black text-foreground pt-1">
                You Take This Room!
              </h3>
              <p className="text-xs text-muted">
                Room successfully allocated at {new Date(successInfo.checkInAt).toLocaleTimeString()}
              </p>
            </div>

            {/* Room Allocation Certificate Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-surface to-surface-2 border border-success/30 text-left space-y-2.5 text-xs shadow-inner">
              <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <span className="text-muted font-medium">Allocated Facility:</span>
                <span className="font-bold text-foreground text-sm font-mono text-primary">
                  {successInfo.allocatedRoom?.code || resourceCode}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <span className="text-muted font-medium">Facility Name:</span>
                <span className="font-semibold text-foreground">
                  {successInfo.allocatedRoom?.name || resourceName}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/70 pb-2">
                <span className="text-muted font-medium">Location:</span>
                <span className="text-foreground">
                  {successInfo.allocatedRoom?.building || building} ({block})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Lock Status:</span>
                <span className="font-bold text-success flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  UNLOCKED & SECURED
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted max-w-sm mx-auto">
              Your room slot is locked. Please check out when your session concludes so other students can use the facility.
            </p>

            <div className="pt-2 flex justify-center">
              <Button size="sm" variant="primary" onClick={handleClose}>
                Done • Access Room
              </Button>
            </div>
          </div>
        ) : (
          /* ===================== VIEW 3: CHECK-IN & QR SCANNER ===================== */
          <div className="space-y-4">
            {/* Timing & Early Window Notification */}
            {isEarly && !earlyTestMode && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>Scheduled Booking Window</span>
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  The standard check-in window opens <strong>10–15 minutes</strong> before your scheduled start time (in ~{minutesUntilOpen} min).
                </p>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-muted font-mono">
                    Start: {new Date(startAtMs).toLocaleTimeString()}
                  </span>
                  <Button
                    size="xs"
                    variant="primary"
                    icon={<Zap className="h-3 w-3" />}
                    onClick={() => {
                      setEarlyTestMode(true);
                      fetchToken(true);
                    }}
                  >
                    ⚡ Test Scan / Allocate Now
                  </Button>
                </div>
              </div>
            )}

            {/* Error notifications */}
            {tokenError && !earlyTestMode && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">Check-in Status</span>
                  <span>{tokenError}</span>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEarlyTestMode(true);
                        fetchToken(true);
                      }}
                      className="text-xs text-primary underline font-medium hover:text-primary/80"
                    >
                      Bypass & Enable Early Test Scan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {submitError && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* View Selector Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-surface-2 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("camera");
                  startCamera();
                }}
                className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === "camera"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Scan Camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("plaque");
                  stopCamera();
                }}
                className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === "plaque"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>Door Plaque</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("manual");
                  stopCamera();
                }}
                className={`py-1.5 px-2 rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === "manual"
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Plaque Code</span>
              </button>
            </div>

            {/* TAB 1: LIVE CAMERA SCANNER */}
            {activeTab === "camera" && (
              <div className="space-y-3">
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border-2 border-primary/40 flex items-center justify-center shadow-lg">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${!isCameraActive ? "hidden" : "block"}`}
                  />

                  {/* Camera inactive / overlay */}
                  {!isCameraActive && (
                    <div className="p-6 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-surface-2 mx-auto flex items-center justify-center text-muted">
                        <CameraOff className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">Camera Scanner Inactive</p>
                        <p className="text-[11px] text-muted max-w-xs">
                          {cameraError || "Click below to turn on your camera and scan the room door plaque."}
                        </p>
                      </div>
                      <Button size="sm" variant="primary" icon={<Camera className="h-4 w-4" />} onClick={startCamera}>
                        Start Camera Scan
                      </Button>
                    </div>
                  )}

                  {/* Scanning Crosshair Reticle & Animated Laser */}
                  {isCameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="relative w-48 h-48 rounded-xl border-2 border-primary/80 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                        {/* Corner markers */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
                        {/* Animated scan bar */}
                        <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse top-1/2" />
                      </div>
                      <div className="absolute bottom-2 left-0 right-0 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-black/75 text-[10px] text-white font-mono shadow">
                          Point camera at any QR code
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Instant Test Scan Shortcut inside Camera View */}
                <div className="flex items-center justify-between gap-2 bg-surface-2/60 p-2.5 rounded-lg border border-border text-xs">
                  <span className="text-[11px] text-muted">Hold up any QR to camera or simulate scan:</span>
                  <div className="flex items-center gap-1.5">
                    {isCameraActive && (
                      <Button size="xs" variant="secondary" icon={<CameraOff className="h-3 w-3" />} onClick={stopCamera}>
                        Stop
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="primary"
                      icon={<Zap className="h-3 w-3" />}
                      onClick={handleTestScan}
                    >
                      ⚡ Test Scan ANY QR
                    </Button>
                  </div>
                </div>

                {/* Scanned detection feedback pill */}
                {scannedFeedback && (
                  <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-xs text-success flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <div>
                        <span className="font-bold block">QR Code Captured: {scannedFeedback.code}</span>
                        <span className="text-[10px] text-foreground/70">Verified at {scannedFeedback.time}</span>
                      </div>
                    </div>
                    <Badge variant="available">Matched</Badge>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: DOOR PLAQUE VIEW */}
            {activeTab === "plaque" && (
              <div className="space-y-3">
                <div className="rounded-xl border-2 border-primary/30 bg-surface p-4 text-center space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                    <span className="font-mono text-primary font-bold">{resourceCode}</span>
                    <Badge variant="available">{block}</Badge>
                  </div>
                  <h4 className="text-sm font-bold text-foreground">{resourceName}</h4>
                  <p className="text-[11px] text-muted">{building} {floor ? `• ${floor}` : ""}</p>

                  <div className="flex justify-center py-1">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                      <QRCode value={`CAMPUSFLOW-DOOR:${resourceCode}:${resObj?._id || ""}`} size={160} />
                    </div>
                  </div>

                  <p className="text-[11px] text-muted">
                    This is the official Door Plaque for this room. Scan it with your phone or camera to unlock.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: MANUAL INPUT & TOKEN VIEW */}
            {activeTab === "manual" && (
              <div className="space-y-3">
                <Input
                  label="Facility Code / Resource ID"
                  placeholder="e.g. LAB-301 or facility ID"
                  value={scannedResourceId}
                  onChange={(e) => setScannedResourceId(e.target.value)}
                  helperText={`Matches door plaque: ${resourceCode} (${resourceName})`}
                />

                {tokenData && (
                  <div className="p-3 rounded-lg bg-surface border border-border space-y-2 text-xs">
                    <div className="flex items-center justify-between text-muted text-[11px]">
                      <span>Single-Use Check-In Token:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(tokenData.token);
                          setCopiedToken(true);
                          setTimeout(() => setCopiedToken(false), 2000);
                        }}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {copiedToken ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                        {copiedToken ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="p-2 rounded bg-surface-2 font-mono text-[11px] truncate text-foreground">
                      {tokenData.token}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Live Countdowns */}
            {tokenData && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-surface border border-border space-y-1">
                  <div className="flex items-center gap-1.5 text-muted text-[11px]">
                    <Timer className="h-3.5 w-3.5 text-primary" />
                    <span>Token TTL</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">
                    {tokenSecondsRemaining !== null
                      ? `${Math.floor(tokenSecondsRemaining / 60)}m ${tokenSecondsRemaining % 60}s`
                      : "Calculating..."}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-border space-y-1">
                  <div className="flex items-center gap-1.5 text-muted text-[11px]">
                    <Clock className="h-3.5 w-3.5 text-warning" />
                    <span>Auto-Release Grace</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">
                    {graceSecondsRemaining !== null && graceSecondsRemaining > 0
                      ? `${Math.floor(graceSecondsRemaining / 60)}m ${graceSecondsRemaining % 60}s`
                      : "Grace active"}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  onClick={handleCheckInSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Allocating Room..." : "Verify & Allocate Room"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
