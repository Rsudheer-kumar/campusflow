"use client";
import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useReducedMotion, useInView } from "framer-motion";
import { CampusGround } from "@/components/3d/campus-ground";
import { CampusPaths } from "@/components/3d/campus-paths";
import { CampusBuilding } from "@/components/3d/campus-building";
import { SceneEnvironment } from "@/components/3d/scene-environment";
import { WebGLErrorBoundary } from "@/components/3d/error-boundary";
import { SceneFallback } from "@/components/3d/scene-fallback";
import { VERIFIED_CAMPUS_BUILDINGS } from "@/lib/campus-data";

export function LandingScene() {
  const containerRef = useRef(null);
  const controlsRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const isInView = useInView(containerRef, { margin: "50px" });
  const [isMounted, setIsMounted] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  // Progressive mount: allows HTML and hero text to paint on frame 1
  useEffect(() => {
    let active = true;
    const raf = requestAnimationFrame(() => {
      if (active) setIsMounted(true);
    });
    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll detection: pause 3D render loop during active page scroll to ensure silky 60fps scrolling
  useEffect(() => {
    let scrollTimeout = null;
    const handleScroll = () => {
      setIsScrolling(true);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 120);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  // Intercept wheel event: only zoom if Ctrl/Cmd is held, otherwise allow native page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e) => {
      if (controlsRef.current) {
        controlsRef.current.enableZoom = Boolean(e.ctrlKey || e.metaKey);
      }
    };
    container.addEventListener("wheel", handleWheel, { capture: true, passive: true });
    return () => container.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  const shouldRender = isInView && !prefersReducedMotion && !isScrolling;

  return (
    <div ref={containerRef} className="w-full h-full relative group bg-[#070C18]">
      {/* Desktop Interaction Hint */}
      <div className="absolute bottom-32 right-6 md:bottom-8 md:right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none hidden sm:flex items-center gap-2 bg-[#0B1224]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#1E2A44] text-[#94A3B8] text-[11px] font-medium tracking-wide shadow-lg">
        Drag to orbit &bull; Ctrl + scroll to zoom
      </div>

      <WebGLErrorBoundary
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-[#050816] text-[#F8FAFC]">
            <SceneFallback />
          </div>
        }
      >
        <div
          className={`w-full h-full transition-opacity duration-500 ease-out ${
            sceneReady ? "opacity-100" : "opacity-0"
          }`}
        >
          {isMounted && (
            <Canvas
              shadows="percentage"
              dpr={[1, 1.25]}
              gl={{
                powerPreference: "high-performance",
                antialias: true,
                alpha: true,
                stencil: false,
                depth: true,
              }}
              camera={{ position: [20, 16, 26], fov: 40 }}
              style={{ width: "100%", height: "100%", background: "#070C18" }}
              frameloop={shouldRender ? "always" : "never"}
              onCreated={() => {
                setSceneReady(true);
              }}
            >
              <Suspense fallback={null}>
                <SceneEnvironment />
                <CampusGround />
                <CampusPaths />
                {VERIFIED_CAMPUS_BUILDINGS.map((b) => (
                  <CampusBuilding
                    key={b.id}
                    buildingId={b.id}
                    buildingCode={b.code}
                    position={b.position}
                    size={b.size}
                    type={b.architecturalType}
                  />
                ))}
                <OrbitControls
                  ref={controlsRef}
                  makeDefault
                  enableDamping
                  dampingFactor={0.06}
                  minDistance={15}
                  maxDistance={45}
                  maxPolarAngle={Math.PI / 2.2}
                  enablePan={false}
                  enableZoom={true}
                  autoRotate={shouldRender}
                  autoRotateSpeed={0.5}
                  target={[0, 0, 0]}
                />
              </Suspense>
            </Canvas>
          )}
        </div>
      </WebGLErrorBoundary>
    </div>
  );
}
