"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CampusGround } from "./campus-ground";
import { CampusPaths } from "./campus-paths";
import { CampusBuilding } from "./campus-building";
import { ResourceMarker } from "./resource-marker";
import { SceneEnvironment } from "./scene-environment";
import { WebGLErrorBoundary } from "./error-boundary";
import { SceneFallback } from "./scene-fallback";
import { VERIFIED_CAMPUS_BUILDINGS } from "@/lib/campus-data";
import { getBuildingStateMeta } from "@/lib/status-precedence";

export function CampusScene({
  onSelectBuilding,
  selectedBuildingId,
  buildingAvailabilityMap = {},
}) {
  const containerRef = useRef(null);
  const controlsRef = useRef(null);
  const [detailsReady, setDetailsReady] = useState(false);

  // Progressive initialization: render cheap visible scene on frame 1,
  // then mount secondary floating details and HTML markers on frame 2.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setDetailsReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleSelect = useCallback(
    (id) => {
      onSelectBuilding?.(id === selectedBuildingId ? null : id);
    },
    [onSelectBuilding, selectedBuildingId]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e) => {
      if (controlsRef.current) {
        controlsRef.current.enableZoom = e.ctrlKey || e.metaKey;
      }
    };
    container.addEventListener("wheel", handleWheel, { capture: true, passive: true });
    return () => container.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative group">
      {/* Desktop Interaction Hint */}
      <div className="absolute bottom-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none hidden sm:flex items-center gap-2 bg-[#0B1224]/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#1E2A44] text-[#94A3B8] text-[11px] font-medium tracking-wide shadow-lg">
        Drag to orbit &bull; Ctrl + scroll to zoom
      </div>

      <WebGLErrorBoundary fallback={<SceneFallback />}>
        <Canvas
          shadows="percentage"
          dpr={[1, 1.5]}
          camera={{ position: [24, 15, 30], fov: 42 }}
          style={{
            width: "100%",
            height: "100%",
            background: "#101827",
          }}
        >
          <Suspense fallback={null}>
            <SceneEnvironment />
            <CampusGround />
            <CampusPaths />

            {/* Verified Campus Buildings */}
            {VERIFIED_CAMPUS_BUILDINGS.map((b) => {
              const isSelected = selectedBuildingId === b.id;
              const avail = buildingAvailabilityMap[b.name];
              const visualState = avail?.summary?.buildingVisualState || "unavailable";
              const statusMeta = getBuildingStateMeta(visualState);
              const availableCount = avail?.summary?.counts?.available ?? 0;
              const totalCount = avail?.summary?.total ?? b.resources.length;
              const badgeLabel = avail?.summary?.displayBadge || `${totalCount} Facilities`;

              const isMaintenance = visualState === "maintenance_blocked";

              return (
                <group key={b.id}>
                  <CampusBuilding
                    buildingId={b.id}
                    buildingCode={b.code}
                    position={b.position}
                    size={b.size}
                    type={b.architecturalType || "lab"}
                    statusColor={statusMeta.hex}
                    isMaintenance={isMaintenance}
                    selected={isSelected}
                    onSelect={handleSelect}
                  />
                  {detailsReady && (
                    <ResourceMarker
                      buildingId={b.id}
                      position={[
                        b.position[0],
                        b.position[1] + b.size[1] / 2 + 1.2,
                        b.position[2],
                      ]}
                      label={b.name}
                      count={availableCount}
                      badgeText={badgeLabel}
                      status={visualState}
                      selected={isSelected}
                      labelOffset={{
                        "bld-turing": [-0.35, 1.7, 0],
                        "bld-hopper": [1.15, 1.8, 0],
                        "bld-innovation": [1.05, 0.9, 0],
                        "bld-central": [0.6, 1.15, 0],
                      }[b.id]}
                      onSelect={() => handleSelect(b.id)}
                    />
                  )}
                </group>
              );
            })}

            {/* User Interaction Controls */}
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.05}
              minDistance={10}
              maxDistance={55}
              maxPolarAngle={Math.PI / 2.1}
              enablePan={false}
              enableZoom={true}
              target={[0, 0.4, 0]}
            />
          </Suspense>
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
