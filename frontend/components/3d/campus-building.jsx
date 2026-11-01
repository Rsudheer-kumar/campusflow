"use client";

import { useState, useMemo, Component, Suspense, memo } from "react";
import * as THREE from "three";
import { Edges, useGLTF } from "@react-three/drei";
import { getBuildingArchitecturalPalette } from "@/lib/campus-data";

// Module-level geometry cache with deterministic keys to prevent GC spikes and memory leaks
const geometryCache = new Map();

function getBoxGeometry(w, h, d) {
  const key = `box_${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
  let geom = geometryCache.get(key);
  if (!geom) {
    geom = new THREE.BoxGeometry(w, h, d);
    geometryCache.set(key, geom);
  }
  return geom;
}

function getCylinderGeometry(
  radiusTop,
  radiusBottom,
  height,
  radialSegments = 16,
  heightSegments = 1,
  openEnded = false,
  thetaStart = 0,
  thetaLength = Math.PI * 2
) {
  const key = `cyl_${radiusTop.toFixed(2)}_${radiusBottom.toFixed(2)}_${height.toFixed(2)}_${thetaLength.toFixed(2)}_${radialSegments}`;
  let geom = geometryCache.get(key);
  if (!geom) {
    geom = new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      radialSegments,
      heightSegments,
      openEnded,
      thetaStart,
      thetaLength
    );
    geometryCache.set(key, geom);
  }
  return geom;
}

function getSphereGeometry(
  radius,
  widthSegments = 16,
  heightSegments = 12,
  phiStart = 0,
  phiLength = Math.PI * 2,
  thetaStart = 0,
  thetaLength = Math.PI * 0.5
) {
  const key = `sph_${radius.toFixed(2)}_${phiLength.toFixed(2)}_${thetaLength.toFixed(2)}_${widthSegments}_${heightSegments}`;
  let geom = geometryCache.get(key);
  if (!geom) {
    geom = new THREE.SphereGeometry(
      radius,
      widthSegments,
      heightSegments,
      phiStart,
      phiLength,
      thetaStart,
      thetaLength
    );
    geometryCache.set(key, geom);
  }
  return geom;
}

function getPlaneGeometry(w, d) {
  const key = `plane_${w.toFixed(2)}_${d.toFixed(2)}`;
  let geom = geometryCache.get(key);
  if (!geom) {
    geom = new THREE.PlaneGeometry(w, d);
    geometryCache.set(key, geom);
  }
  return geom;
}

// Module-level material cache indexed deterministically by building code, massing type, and state
const materialCache = new Map();

function getBuildingMaterials(palette, type, selected, isMaintenance) {
  const key = `${palette.code}_${type}_${selected ? "1" : "0"}_${isMaintenance ? "1" : "0"}`;
  let set = materialCache.get(key);
  if (!set) {
    const wallColor = selected ? palette.selectedBodyColor : palette.bodyColor;

    set = {
      // Primary architectural facade panels
      body: new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: 0.52,
        metalness: 0.22,
      }),
      // Secondary structural elements (framing, base plinth, columns)
      secondaryBody: new THREE.MeshStandardMaterial({
        color: palette.trimColor || "#1E293B",
        roughness: 0.65,
        metalness: 0.32,
      }),
      // Architectural precast concrete trim (crisp, light, non-plastic)
      precastTrim: new THREE.MeshStandardMaterial({
        color: "#94A3B8",
        roughness: 0.72,
        metalness: 0.18,
      }),
      // Luminous architectural glass with controlled specular response & transparency
      glass: new THREE.MeshStandardMaterial({
        color: palette.glassColor,
        emissive: palette.glassEmissive,
        emissiveIntensity: selected ? 0.45 : 0.25,
        roughness: 0.08,
        metalness: 0.85,
        transparent: true,
        opacity: palette.glassOpacity || 0.78,
      }),
      // Warm glowing interior core seen through curtain glazing (matching photo's evening illumination)
      interiorGlow: new THREE.MeshStandardMaterial({
        color: type === "sports" || type === "seminar" ? "#FEF08A" : "#BFDBFE",
        emissive: type === "sports" || type === "seminar" ? "#F59E0B" : "#3B82F6",
        emissiveIntensity: selected ? 0.68 : 0.48,
        roughness: 0.35,
        metalness: 0.1,
      }),
      // Roof material: Distinct architectural finish with double-sided rendering to prevent backface culling
      roof: new THREE.MeshStandardMaterial({
        color: type === "sports" ? "#4A3B2C" : palette.roofColor,
        roughness: 0.48,
        metalness: 0.45,
        side: THREE.DoubleSide,
      }),
      // Aerodynamic canopy metallic shell for CCC (champagne/sandstone titanium)
      canopyShell: new THREE.MeshStandardMaterial({
        color: "#8C6A48",
        roughness: 0.36,
        metalness: 0.58,
        side: THREE.DoubleSide,
      }),
      // Accent features (canopies, louvers, fins)
      accent: new THREE.MeshStandardMaterial({
        color: palette.accentColor,
        emissive: palette.accentColor,
        emissiveIntensity: selected ? 0.45 : 0.2,
        roughness: 0.32,
        metalness: 0.68,
      }),
      // Dark structural mullions
      mullion: new THREE.MeshStandardMaterial({
        color: "#0F172A",
        roughness: 0.38,
        metalness: 0.82,
      }),
      // Spandrel floor bands
      spandrel: new THREE.MeshStandardMaterial({
        color: "#1E293B",
        roughness: 0.58,
        metalness: 0.38,
      }),
      // Observatory Dome shell
      observatoryDome: new THREE.MeshStandardMaterial({
        color: "#E2E8F0",
        roughness: 0.26,
        metalness: 0.68,
      }),
      // Glowing ridge skylight spine
      skylightGlow: new THREE.MeshStandardMaterial({
        color: "#FEF08A",
        emissive: "#F59E0B",
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.1,
      }),
      // Ground emphasis halo upon selection
      selectedGround: new THREE.MeshBasicMaterial({
        color: palette.primaryHex,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
      // Maintenance beacon
      maintenanceBeacon: new THREE.MeshStandardMaterial({
        color: "#EF4444",
        emissive: "#EF4444",
        emissiveIntensity: 0.85,
        roughness: 0.2,
      }),
    };
    materialCache.set(key, set);
  }
  return set;
}

// Authoritative mapping from building code / ID to Blender exported GLTF 2.0 asset
const BLENDER_MODEL_PATHS = {
  TSC: "/models/tsc.glb",
  "bld-turing": "/models/tsc.glb",
  HEC: "/models/hec.glb",
  "bld-hopper": "/models/hec.glb",
  IC: "/models/ic.glb",
  "bld-innovation": "/models/ic.glb",
  CCC: "/models/ccc.glb",
  "bld-central": "/models/ccc.glb",
};

// Safe Error Boundary for GLTF model loading fallback
class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn("Blender GLTF fallback triggered:", err);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Blender Architectural GLTF Model Renderer
function BlenderBuildingModel({ modelPath, h }) {
  const { scene } = useGLTF(modelPath);

  // Clone scene instance to prevent shared state mutation across unmounts/remounts
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  if (!clonedScene) return null;

  // The base of each Blender model is at Y=0, so positioning at [0, -h / 2, 0] sits on the foundation plinth
  return (
    <group position={[0, -h / 2, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

// Procedural 3D Architecture Fallback (Used when GLB is loading or if model asset fails)
const ProceduralBuilding = memo(function ProceduralBuilding({
  type,
  materials,
  selected,
  w,
  h,
  d,
}) {
  return (
    <group>
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. TURING SCIENCE CENTER (TSC) — Research Tower & Observatory Dome  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {type === "research" && (
        <group>
          {/* Main Central Vertical Research Tower */}
          <mesh
            position={[0, h * 0.08, -d * 0.04]}
            castShadow
            receiveShadow
            geometry={getBoxGeometry(w * 0.64, h * 1.05, d * 0.66)}
            material={materials.body}
          >
            {selected && <Edges linewidth={1.5} threshold={30} color="#FFFFFF" />}
          </mesh>

          {/* Warm Interior Core Illumination behind Glass */}
          <mesh
            position={[0, h * 0.08, d * 0.28]}
            geometry={getBoxGeometry(w * 0.52, h * 0.9, 0.06)}
            material={materials.interiorGlow}
          />

          {/* Stepped Horizontal Spandrel Facade Reveals (5 Floor Levels) */}
          {[-0.34, -0.14, 0.08, 0.28, 0.48].map((yNorm, idx) => (
            <group key={`tsc-floor-${idx}`} position={[0, h * yNorm, -d * 0.04]}>
              <mesh
                geometry={getBoxGeometry(w * 0.68, 0.14, d * 0.7)}
                material={materials.spandrel}
                castShadow
              />
            </group>
          ))}

          {/* Majestic Front Sapphire Glass Curtain-Wall */}
          <mesh
            position={[0, h * 0.08, d * 0.3 + 0.02]}
            geometry={getBoxGeometry(w * 0.56, h * 0.94, 0.12)}
            material={materials.glass}
            castShadow
          />

          {/* Vertical Structural Mullions across the Sapphire Glass Facade */}
          {[-w * 0.22, -w * 0.11, 0, w * 0.11, w * 0.22].map((xPos, idx) => (
            <mesh
              key={`tsc-mullion-${idx}`}
              position={[xPos, h * 0.08, d * 0.3 + 0.09]}
              geometry={getBoxGeometry(0.06, h * 0.94, 0.06)}
              material={materials.mullion}
            />
          ))}

          {/* Stepped West Specialized Computing Wing (3-tier massing) */}
          <group position={[-w * 0.36, -h * 0.1, -d * 0.04]}>
            <mesh
              castShadow
              receiveShadow
              geometry={getBoxGeometry(w * 0.28, h * 0.68, d * 0.55)}
              material={materials.body}
            />
            {/* Horizontal ribbon glazing on West wing */}
            <mesh
              position={[0, h * 0.12, d * 0.28 + 0.01]}
              geometry={getBoxGeometry(w * 0.24, 0.35, 0.06)}
              material={materials.glass}
            />
            <mesh
              position={[0, -h * 0.08, d * 0.28 + 0.01]}
              geometry={getBoxGeometry(w * 0.24, 0.35, 0.06)}
              material={materials.glass}
            />
            {/* West Wing Solar Louvers */}
            <mesh
              position={[0, h * 0.22, d * 0.28 + 0.06]}
              geometry={getBoxGeometry(w * 0.26, 0.04, 0.14)}
              material={materials.accent}
            />
          </group>

          {/* Stepped East AI Robotics & Server Wing (2-tier massing) */}
          <group position={[w * 0.36, -h * 0.16, -d * 0.04]}>
            <mesh
              castShadow
              receiveShadow
              geometry={getBoxGeometry(w * 0.28, h * 0.56, d * 0.55)}
              material={materials.body}
            />
            {/* Server ventilation louvers / horizontal relief */}
            <mesh
              position={[0, h * 0.08, d * 0.28 + 0.01]}
              geometry={getBoxGeometry(w * 0.22, 0.28, 0.06)}
              material={materials.accent}
            />
            <mesh
              position={[0, -h * 0.08, d * 0.28 + 0.01]}
              geometry={getBoxGeometry(w * 0.22, 0.28, 0.06)}
              material={materials.glass}
            />
          </group>

          {/* Grand 2-Story Glazed Main Entrance Atrium */}
          <group position={[0, -h * 0.31, d * 0.36]}>
            <mesh
              castShadow
              receiveShadow
              geometry={getBoxGeometry(w * 0.44, h * 0.32, d * 0.22)}
              material={materials.glass}
            />
            {/* Entrance Columns */}
            <mesh
              position={[-w * 0.18, 0, d * 0.12]}
              geometry={getCylinderGeometry(0.12, 0.12, h * 0.32, 12)}
              material={materials.secondaryBody}
            />
            <mesh
              position={[w * 0.18, 0, d * 0.12]}
              geometry={getCylinderGeometry(0.12, 0.12, h * 0.32, 12)}
              material={materials.secondaryBody}
            />
            {/* Floating Cyan Entrance Canopy */}
            <mesh
              position={[0, h * 0.17, d * 0.12]}
              castShadow
              geometry={getBoxGeometry(w * 0.48, 0.08, d * 0.26)}
              material={materials.accent}
            />
          </group>

          {/* Rooftop Research Penthouse & Mechanical Plant */}
          <mesh
            position={[0, h * 0.58, -d * 0.04]}
            castShadow
            geometry={getBoxGeometry(w * 0.44, 0.72, d * 0.46)}
            material={materials.roof}
          />

          {/* Iconic Rooftop Astronomical Observatory Dome (Inspired by Reference Image) */}
          <group position={[-w * 0.16, h * 0.58 + 0.36, 0]}>
            {/* Drum base */}
            <mesh
              position={[0, 0.18, 0]}
              geometry={getCylinderGeometry(0.7, 0.74, 0.38, 24)}
              material={materials.precastTrim}
              castShadow
            />
            {/* Observatory Dome Shell */}
            <mesh
              position={[0, 0.38, 0]}
              geometry={getSphereGeometry(0.7, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5)}
              material={materials.observatoryDome}
              castShadow
            />
            {/* Observatory Slit Shutter Band */}
            <mesh
              position={[0, 0.58, 0.3]}
              rotation={[0.2, 0, 0]}
              geometry={getBoxGeometry(0.18, 0.54, 0.36)}
              material={materials.roof}
            />
          </group>

          {/* Research Communications Spire / Antenna Mast with Warning Beacon */}
          <group position={[w * 0.16, h * 0.58 + 0.9, -d * 0.1]}>
            <mesh
              geometry={getCylinderGeometry(0.03, 0.07, 1.8, 8)}
              material={materials.accent}
            />
            {/* Beacon Cap */}
            <mesh
              position={[0, 0.95, 0]}
              geometry={getCylinderGeometry(0.06, 0.06, 0.1, 8)}
              material={materials.maintenanceBeacon}
            />
          </group>
        </group>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. HOPPER ENGINEERING COMPLEX (HEC) — Connected Wings & Atrium      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {type === "lab" && (
        <group>
          {/* West Heavy Engineering Laboratory Wing (4-tier volume) */}
          <group position={[-w * 0.26, 0, 0]}>
            <mesh
              castShadow
              receiveShadow
              geometry={getBoxGeometry(w * 0.44, h * 0.96, d * 0.88)}
              material={materials.body}
            >
              {selected && <Edges linewidth={1.5} threshold={30} color="#FFFFFF" />}
            </mesh>
            {/* Horizontal Ribbon Windows across 3 floor levels */}
            {[-h * 0.25, 0, h * 0.25].map((yPos, idx) => (
              <mesh
                key={`hec-west-ribbon-${idx}`}
                position={[0, yPos, d * 0.44 + 0.01]}
                geometry={getBoxGeometry(w * 0.4, 0.28, 0.06)}
                material={materials.glass}
              />
            ))}
            {/* Structural Pilasters between window bays */}
            {[-w * 0.15, 0, w * 0.15].map((xP, idx) => (
              <mesh
                key={`hec-west-pilaster-${idx}`}
                position={[xP, 0, d * 0.44 + 0.04]}
                geometry={getBoxGeometry(0.06, h * 0.85, 0.06)}
                material={materials.precastTrim}
              />
            ))}
            {/* Rooftop Ventilation Penthouse */}
            <mesh
              position={[0, h / 2 + 0.25, 0]}
              castShadow
              geometry={getBoxGeometry(w * 0.34, 0.5, d * 0.6)}
              material={materials.roof}
            />
          </group>

          {/* Central Glazed Multi-Story Atrium Connector */}
          <group position={[0, -h * 0.04, 0]}>
            <mesh
              castShadow
              receiveShadow
              geometry={getBoxGeometry(w * 0.24, h * 0.88, d * 0.74)}
              material={materials.glass}
            />
            {/* Internal Skybridge Lines visible through glass */}
            {[-h * 0.15, h * 0.1].map((yB, idx) => (
              <mesh
                key={`hec-bridge-${idx}`}
                position={[0, yB, 0]}
                geometry={getBoxGeometry(w * 0.26, 0.12, d * 0.42)}
                material={materials.precastTrim}
              />
            ))}
            {/* Main Center Entrance Portico Canopy */}
            <mesh
              position={[0, -h * 0.32, d * 0.42]}
              castShadow
              geometry={getBoxGeometry(w * 0.28, 0.1, d * 0.24)}
              material={materials.accent}
            />
          </group>

          {/* East Technical Prototyping & Experimentation Wing (3-tier volume) */}
          <group position={[w * 0.26, -h * 0.1, 0]}>
            <mesh
              castShadow
              receiveShadow
              geometry={getBoxGeometry(w * 0.44, h * 0.78, d * 0.82)}
              material={materials.body}
            >
              {selected && <Edges linewidth={1.5} threshold={30} color="#FFFFFF" />}
            </mesh>
            {/* Large Experimental Bay Windows */}
            {[-h * 0.2, h * 0.05, h * 0.24].map((yPos, idx) => (
              <mesh
                key={`hec-east-glaze-${idx}`}
                position={[0, yPos, d * 0.41 + 0.01]}
                geometry={getBoxGeometry(w * 0.38, 0.26, 0.06)}
                material={materials.glass}
              />
            ))}
            {/* Industrial Sawtooth Roof Skylights */}
            <mesh
              position={[0, h * 0.34, 0]}
              castShadow
              geometry={getBoxGeometry(w * 0.38, 0.42, d * 0.68)}
              material={materials.roof}
            />
          </group>

          {/* Exoskeleton Columns along the front facade */}
          {[-w * 0.44, -w * 0.06, w * 0.06, w * 0.44].map((xCol, idx) => (
            <mesh
              key={`hec-col-${idx}`}
              position={[xCol, -h * 0.04, d * 0.45]}
              geometry={getBoxGeometry(0.12, h * 0.92, 0.12)}
              material={materials.secondaryBody}
            />
          ))}
        </group>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3. INNOVATION CENTER (IC) — Sculpted Asymmetric Cantilever Hub     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {type === "seminar" && (
        <group>
          {/* Lower Incubation & Presentation Level (Recessed Plinth) */}
          <mesh
            position={[0, -h * 0.24, -d * 0.05]}
            castShadow
            receiveShadow
            geometry={getBoxGeometry(w * 0.88, h * 0.52, d * 0.82)}
            material={materials.body}
          >
            {selected && <Edges linewidth={1.5} threshold={30} color="#FFFFFF" />}
          </mesh>

          {/* Dramatically Cantilevered Upper Executive Level (Shuffled Forward) */}
          <group position={[-w * 0.04, h * 0.18, d * 0.08]}>
            <mesh
              castShadow
              receiveShadow
              geometry={getBoxGeometry(w * 0.94, h * 0.52, d * 0.86)}
              material={materials.body}
            >
              {selected && <Edges linewidth={1.5} threshold={30} color="#FFFFFF" />}
            </mesh>
            {/* Warm Interior Illumination within Cantilever */}
            <mesh
              position={[0, 0, d * 0.36]}
              geometry={getBoxGeometry(w * 0.74, h * 0.38, 0.04)}
              material={materials.interiorGlow}
            />
            {/* Wrap-around Crystalline Corner Glass Curtain Wall */}
            <mesh
              position={[0, 0, d * 0.43 + 0.02]}
              geometry={getBoxGeometry(w * 0.78, h * 0.42, 0.12)}
              material={materials.glass}
              castShadow
            />
            {/* Vertical Silver-Violet Architectural Louvers / Fins */}
            {[-w * 0.32, -w * 0.16, 0, w * 0.16, w * 0.32].map((xFin, idx) => (
              <mesh
                key={`ic-fin-${idx}`}
                position={[xFin, 0, d * 0.43 + 0.12]}
                geometry={getBoxGeometry(0.08, h * 0.46, 0.14)}
                material={materials.accent}
              />
            ))}
          </group>

          {/* Sloped Angular Roof Terrace with Glass Balustrade */}
          <group position={[-w * 0.04, h * 0.46, d * 0.08]}>
            <mesh
              rotation={[0.06, 0, 0]}
              castShadow
              geometry={getBoxGeometry(w * 0.98, 0.16, d * 0.88)}
              material={materials.roof}
            />
            {/* Roof Pavilion Pod */}
            <mesh
              position={[w * 0.18, 0.35, -d * 0.1]}
              geometry={getBoxGeometry(w * 0.38, 0.5, d * 0.4)}
              material={materials.secondaryBody}
            />
          </group>

          {/* Front Corner Glass Reception Pavilion & Entry Portal */}
          <group position={[w * 0.28, -h * 0.24, d * 0.38]}>
            <mesh
              castShadow
              geometry={getBoxGeometry(w * 0.36, h * 0.44, d * 0.26)}
              material={materials.glass}
            />
            {/* Cantilever Entrance Overhang */}
            <mesh
              position={[0, h * 0.24, d * 0.1]}
              castShadow
              geometry={getBoxGeometry(w * 0.44, 0.1, d * 0.32)}
              material={materials.accent}
            />
          </group>
        </group>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 4. CENTRAL CAMPUS CENTER (CCC) — Sweeping Aerodynamic Canopy Roof  */}
      {/*    (Directly inspired by the iconic reference photograph)          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {type === "sports" && (
        <group>
          {/* Tiered Sandstone Foundation Plinth & Civic Approach Steps */}
          <mesh
            position={[0, -h * 0.32, 0]}
            castShadow
            receiveShadow
            geometry={getBoxGeometry(w * 1.05, h * 0.32, d * 1.05)}
            material={materials.secondaryBody}
          >
            {selected && <Edges linewidth={1.5} threshold={30} color="#FFFFFF" />}
          </mesh>

          {/* Main Civic Assembly Hall Enclosure (Lower Podium Level) */}
          <mesh
            position={[0, -h * 0.12, 0]}
            castShadow
            receiveShadow
            geometry={getBoxGeometry(w * 0.92, h * 0.44, d * 0.88)}
            material={materials.body}
          >
            {selected && <Edges linewidth={1.5} threshold={30} color="#FFFFFF" />}
          </mesh>

          {/* Warm Glowing Interior Assembly Hall Volume (Visible through glass) */}
          <mesh
            position={[0, h * 0.05, d * 0.18]}
            geometry={getBoxGeometry(w * 0.82, h * 0.58, d * 0.48)}
            material={materials.interiorGlow}
          />

          {/* Grand Curved Glass Curtain Wall Facade (Double-height front entrance) */}
          <mesh
            position={[0, h * 0.05, d * 0.46]}
            geometry={getBoxGeometry(w * 0.88, h * 0.64, 0.12)}
            material={materials.glass}
            castShadow
          />

          {/* Angled Diagrid / Structural Support Columns across Front Glazed Facade */}
          {[-w * 0.38, -w * 0.25, -w * 0.12, 0, w * 0.12, w * 0.25, w * 0.38].map((xRib, idx) => {
            const angle = (idx - 3) * 0.05;
            return (
              <mesh
                key={`ccc-rib-${idx}`}
                position={[xRib, h * 0.05, d * 0.48]}
                rotation={[0, 0, angle]}
                geometry={getBoxGeometry(0.09, h * 0.66, 0.12)}
                material={materials.precastTrim}
              />
            );
          })}

          {/* ─── SIGNATURE SWEEPING AERODYNAMIC CURVED CANOPY ROOF ─── */}
          {/* Solid 3D aero-canopy with visible thickness and illuminated ceiling soffit */}
          <group position={[0, h * 0.32, d * 0.04]}>
            {/* Primary Curved Aerodynamic Canopy Shell (Solid Top Arch) */}
            <mesh
              rotation={[0, 0, Math.PI / 2]}
              castShadow
              receiveShadow
              geometry={getCylinderGeometry(
                (d / 2) * 1.15,
                (d / 2) * 1.15,
                w * 1.1,
                32,
                1,
                false,
                0,
                Math.PI
              )}
              material={materials.canopyShell}
            />

            {/* Solid Ceiling Soffit Slab (Encloses underside so roof has real thickness) */}
            <mesh
              position={[0, 0.02, 0]}
              geometry={getBoxGeometry(w * 1.1, 0.18, d * 1.12)}
              material={materials.roof}
              castShadow
            />

            {/* Radiant Skylight Spine along Roof Ridge (Matching Photo's Glowing Apex) */}
            <mesh
              position={[0, (d / 2) * 1.15 + 0.04, 0]}
              geometry={getBoxGeometry(w * 0.96, 0.1, d * 0.26)}
              material={materials.skylightGlow}
            />

            {/* Cantilevered Aerodynamic Front Overhang / Canopy Visor Brow */}
            <mesh
              position={[0, (d / 2) * 0.25, d * 0.52]}
              rotation={[0.16, 0, 0]}
              castShadow
              geometry={getBoxGeometry(w * 1.14, 0.18, d * 0.34)}
              material={materials.accent}
            />
          </group>

          {/* West & East Arched Cathedral Glazed Gables with Radiating Mullions */}
          {[-w * 0.46, w * 0.46].map((xGable, idx) => (
            <group key={`ccc-gable-${idx}`} position={[xGable, h * 0.32, d * 0.04]}>
              <mesh
                rotation={[0, 0, Math.PI / 2]}
                geometry={getCylinderGeometry(
                  (d / 2) * 1.08,
                  (d / 2) * 1.08,
                  0.12,
                  24,
                  1,
                  false,
                  0,
                  Math.PI
                )}
                material={materials.glass}
              />
              {/* Radiating Arched Mullions */}
              {[-0.6, -0.2, 0.2, 0.6].map((mAngle, mIdx) => (
                <mesh
                  key={`ccc-arch-mullion-${mIdx}`}
                  position={[0, (d / 3.8) * Math.sin(Math.PI / 2 + mAngle), (d / 3.8) * Math.cos(Math.PI / 2 + mAngle)]}
                  rotation={[mAngle, 0, 0]}
                  geometry={getBoxGeometry(0.12, (d / 2) * 0.85, 0.06)}
                  material={materials.accent}
                />
              ))}
            </group>
          ))}

          {/* Flanking Colonnade Pillars along Lateral Facades */}
          {[-w * 0.36, -w * 0.18, 0, w * 0.18, w * 0.36].map((xCol, idx) => (
            <group key={`ccc-col-${idx}`}>
              <mesh
                position={[xCol, -h * 0.08, -d * 0.46]}
                geometry={getBoxGeometry(0.18, h * 0.72, 0.18)}
                material={materials.secondaryBody}
              />
            </group>
          ))}

          {/* Grand Front Entrance Portal with Stepped Sandstone Entry */}
          <group position={[0, -h * 0.18, d * 0.52]}>
            <mesh
              castShadow
              geometry={getBoxGeometry(w * 0.48, h * 0.42, 0.35)}
              material={materials.body}
            />
            {/* Cathedral Entrance Doors */}
            <mesh
              position={[0, -h * 0.04, 0.18]}
              geometry={getBoxGeometry(w * 0.38, h * 0.34, 0.06)}
              material={materials.glass}
            />
            {/* Grand Bronze Entrance Cornice / Canopy */}
            <mesh
              position={[0, h * 0.22, 0.12]}
              castShadow
              geometry={getBoxGeometry(w * 0.54, 0.12, 0.38)}
              material={materials.accent}
            />
          </group>
        </group>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 5. GENERAL MULTI-PURPOSE COMPLEX (Fallback)                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {type === "general" && (
        <group>
          <mesh
            castShadow
            receiveShadow
            geometry={getBoxGeometry(w, h, d)}
            material={materials.body}
          />
          <mesh
            position={[0, h * 0.1, d / 2 + 0.05]}
            geometry={getBoxGeometry(w * 0.8, h * 0.4, 0.1)}
            material={materials.glass}
          />
        </group>
      )}
    </group>
  );
});

// Interactive Campus Building with Blender GLTF Architecture & Procedural Fallback
export const CampusBuilding = memo(function CampusBuilding({
  buildingId,
  buildingCode,
  position,
  size,
  type = "lab",
  statusColor,
  isMaintenance = false,
  onClick,
  onSelect,
  selected = false,
}) {
  const [hovered, setHovered] = useState(false);

  // Resolve deterministic architectural identity palette
  const palette = getBuildingArchitecturalPalette(buildingCode || buildingId);
  const materials = getBuildingMaterials(palette, type, selected, isMaintenance);

  // Subtle architectural edge highlight (only for plinth and selected focus)
  const edgeColor = selected
    ? "#FFFFFF"
    : hovered
    ? "#E2E8F0"
    : statusColor || "#334155";
  const edgeWidth = selected ? 2.0 : 1.0;

  // Destructure sizes
  const [w, h, d] = size;

  // Resolve Blender model asset path
  const modelPath = BLENDER_MODEL_PATHS[buildingCode] || BLENDER_MODEL_PATHS[buildingId];

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        if (buildingId && onSelect) {
          onSelect(buildingId);
        } else {
          onClick?.();
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      {/* ─── Ground Foundation Plinth & Sub-base ─── */}
      <mesh
        position={[0, -h / 2 + 0.08, 0]}
        castShadow
        receiveShadow
        geometry={getBoxGeometry(w * 1.08, 0.16, d * 1.08)}
        material={materials.secondaryBody}
      >
        <Edges linewidth={edgeWidth} threshold={35} color={edgeColor} />
      </mesh>

      {/* Selected state ground emphasis halo */}
      {selected && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -h / 2 + 0.02, 0]}
          geometry={getPlaneGeometry(w * 1.45, d * 1.45)}
          material={materials.selectedGround}
        />
      )}

      {/* Maintenance lock roof indicator */}
      {isMaintenance && (
        <mesh
          position={[0, h / 2 + 0.35, 0]}
          geometry={getBoxGeometry(0.9, 0.35, 0.9)}
          material={materials.maintenanceBeacon}
        />
      )}

      {/* Architectural 3D Geometry: Blender PBR Model with Procedural Fallback */}
      {modelPath ? (
        <ModelErrorBoundary
          fallback={
            <ProceduralBuilding
              type={type}
              materials={materials}
              selected={selected}
              w={w}
              h={h}
              d={d}
            />
          }
        >
          <Suspense
            fallback={
              <ProceduralBuilding
                type={type}
                materials={materials}
                selected={selected}
                w={w}
                h={h}
                d={d}
              />
            }
          >
            <BlenderBuildingModel modelPath={modelPath} h={h} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        <ProceduralBuilding
          type={type}
          materials={materials}
          selected={selected}
          w={w}
          h={h}
          d={d}
        />
      )}
    </group>
  );
});

// Preload Blender models in client browser environment
if (typeof window !== "undefined") {
  useGLTF.preload("/models/tsc.glb");
  useGLTF.preload("/models/hec.glb");
  useGLTF.preload("/models/ic.glb");
  useGLTF.preload("/models/ccc.glb");
}
