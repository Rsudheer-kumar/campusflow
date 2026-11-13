"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCode } from "@/components/ui/qr-code";
import {
  DoorClosed,
  Copy,
  Check,
  Camera,
  MapPin,
  Users,
  ShieldCheck,
  Printer,
} from "lucide-react";

export function DoorPlaqueModal({ open, onClose, resource, onLaunchCameraScan }) {
  const [copied, setCopied] = useState(false);

  if (!resource) return null;

  const resName = resource.name || "Campus Facility";
  const resCode = resource.code || "ROOM";
  const building = resource.location?.building || "University Campus";
  const floor = resource.location?.floor != null ? `Floor ${resource.location.floor}` : "Ground Floor";
  const roomNumber = resource.location?.roomNumber ? `Room ${resource.location.roomNumber}` : "";
  const block = resource.block ? `Block ${resource.block}` : "Main Campus";
  const capacity = resource.capacity ? `${resource.capacity} seats` : "Standard capacity";
  const qrPayload = `CAMPUSFLOW-DOOR:${resCode}:${resource._id || ""}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(resCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Facility Door QR Plaque"
      description={`Official digital door plaque for ${resName}`}
      size="md"
    >
      <div className="space-y-4">
        {/* Physical Door Plaque Card */}
        <div className="relative overflow-hidden rounded-xl border-2 border-primary/30 bg-gradient-to-b from-surface-2 to-surface p-6 shadow-2xl text-center space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
              <DoorClosed className="h-4 w-4" />
              <span>CampusFlow Access Plaque</span>
            </div>
            <Badge variant="available">{block}</Badge>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-foreground font-mono tracking-wide">
              {resCode}
            </h2>
            <h3 className="text-sm font-semibold text-primary">{resName}</h3>
            <div className="flex items-center justify-center gap-3 text-xs text-muted pt-1">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {building} {floor ? `• ${floor}` : ""} {roomNumber ? `• ${roomNumber}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {capacity}
              </span>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex justify-center py-2">
            <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-200">
              <QRCode value={qrPayload} size={190} />
            </div>
          </div>

          <div className="space-y-1 bg-surface-2/60 p-2.5 rounded-lg border border-border/60 text-xs">
            <div className="flex items-center justify-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span>Door Access & Check-In Code: <code className="font-mono font-bold text-primary">{resCode}</code></span>
            </div>
            <p className="text-[11px] text-muted">
              Scan with CampusFlow from 10–15 minutes before your booked time slot to verify attendance and unlock this room.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" icon={copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} onClick={handleCopy}>
            {copied ? "Copied Room Code!" : "Copy Code"}
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print Plaque
            </Button>
            {onLaunchCameraScan && (
              <Button variant="primary" size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => {
                onClose();
                onLaunchCameraScan(resource);
              }}>
                Scan Door QR
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
