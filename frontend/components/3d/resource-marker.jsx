"use client";
import { useState, useEffect, memo } from "react";
import { Html, Float } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
const statusColorMap = {
  fully_available: "#2563EB",
  partially_available: "#0284C7",
  available: "#3B82F6",
  occupied_soon: "#3B82F6",
  occupied: "#F59E0B",
  fully_occupied: "#F59E0B",
  maintenance: "#EF4444",
  maintenance_blocked: "#EF4444",
  unavailable: "#64748B",
  unknown: "#94A3B8",
  indeterminate_warning: "#94A3B8",
};
// Reusable static marker geometry
const markerGeometry = new THREE.OctahedronGeometry(0.5, 0);
const ringGeometry = new THREE.RingGeometry(0.7, 0.8, 32);
// Module-level material caches to eliminate runtime shader compilation and GC thrashing
const markerMaterialCache = new Map();
const ringMaterialCache = new Map();
function getMarkerMaterial(color, selected, hovered) {
    const key = `${color}_${selected ? "1" : "0"}_${hovered ? "1" : "0"}`;
    let mat = markerMaterialCache.get(key);
    if (!mat) {
        mat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: selected ? 0.8 : hovered ? 0.5 : 0.1,
            roughness: 0.1,
            metalness: 0.8,
        });
        markerMaterialCache.set(key, mat);
    }
    return mat;
}
function getRingMaterial(color) {
    let mat = ringMaterialCache.get(color);
    if (!mat) {
        mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
        });
        ringMaterialCache.set(color, mat);
    }
    return mat;
}
export const ResourceMarker = memo(function ResourceMarker({ buildingId, position, label, count, badgeText, status = "available", onClick, onSelect, selected = false, labelOffset = [0, 0.72, 0], }) {
    const [hovered, setHovered] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const color = statusColorMap[status] || "#64748B";

    const prefersReducedMotion = useReducedMotion();
    // Safely mount HTML overlay on animation frame to prevent React 19 concurrent unmount collision
    useEffect(() => {
        let active = true;
        const raf = requestAnimationFrame(() => {
            if (active)
                setIsMounted(true);
        });
        return () => {
            active = false;
            cancelAnimationFrame(raf);
            setIsMounted(false);
        };
    }, []);
    const markerMaterial = getMarkerMaterial(color, selected, hovered);
    const ringMaterial = getRingMaterial(color);
    // Avoid unnecessary animation loop work when not moving or interacting
    const floatSpeed = prefersReducedMotion ? 0 : hovered || selected ? 1.5 : 0;
    return (<group position={position}>
      <Float speed={floatSpeed} rotationIntensity={prefersReducedMotion ? 0 : 0.2} floatIntensity={prefersReducedMotion ? 0 : 0.5} floatingRange={prefersReducedMotion ? [0, 0] : [-0.1, 0.1]}>
        {/* Core Marker Geometry */}
        <mesh onClick={(e) => {
            e.stopPropagation();
            if (buildingId && onSelect) {
                onSelect(buildingId);
            }
            else {
                onClick?.();
            }
        }} onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
        }} onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
            document.body.style.cursor = "default";
        }} geometry={markerGeometry} material={markerMaterial} castShadow/>

        {/* Selected Ring */}
        {selected && (<mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} geometry={ringGeometry} material={ringMaterial}/>)}

        {/* HTML UI Panel (anchored to 3D position) */}
        {isMounted && (<Html position={labelOffset} center distanceFactor={20} zIndexRange={[100, 0]} style={{
                transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
                opacity: hovered || selected ? 1 : 0.85,
            }}>
            <button type="button" aria-label={`${label}. ${count} resources. Status: ${status}.`} className={cn("flex cursor-pointer select-none flex-col items-center gap-1 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full", selected ? "scale-105" : "scale-100 hover:scale-[1.03]")} onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}>
              <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-[#111C30]/95 px-2.5 py-1 font-sans shadow-xl">
                <span className="h-1.5 w-1.5 rounded-full shadow-[0_0_6px_rgba(0,0,0,0.5)]" style={{ backgroundColor: color, boxShadow: `0 0 7px ${color}` }}/>
                <span className="font-semibold text-white/95 text-[10px] sm:text-[11px] tracking-wide">{label}</span>
                <span className="text-white/60 text-[10px] font-medium">({count})</span>
              </div>

              {/* Contextual tooltip content only visible when selected */}
              {selected && (<div className="mt-1.5 w-max rounded-[var(--radius-md)] border border-border/80 bg-[#101A31] p-3.5 text-center shadow-2xl mx-auto cursor-default">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                    Status
                  </p>
                  <span className="block font-bold capitalize text-base" style={{ color }}>
                    {status}
                  </span>
                </div>)}
            </button>
          </Html>)}
      </Float>
    </group>);
});
