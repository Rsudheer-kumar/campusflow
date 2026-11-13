"use client";

import { memo } from "react";

export const SceneEnvironment = memo(function SceneEnvironment() {
  return (
    <>
      {/* Balanced ambient base to ensure all architectural facets and relief remain legible */}
      <ambientLight intensity={0.85} color="#D9E3F0" />

      {/* Hemisphere light providing natural twilight sky & ground color contrast */}
      <hemisphereLight
        skyColor="#1E293B"
        groundColor="#0B1120"
        intensity={0.8}
      />

      {/* Main Golden-Hour Key Light (Inspired by warm sunset in reference photo) */}
      <directionalLight
        position={[24, 28, 20]}
        intensity={2.25}
        color="#FFF5E0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={85}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-bias={-0.0003}
        shadow-radius={3}
      />

      {/* Cool Twilight Fill Light from opposite quadrant to reveal architectural depth */}
      <directionalLight
        position={[-24, 18, 12]}
        intensity={1.15}
        color="#60A5FA"
      />

      {/* Sunset Horizon Rim Light (Grazes rooflines, spires, and curved canopies) */}
      <directionalLight
        position={[0, 16, -28]}
        intensity={0.65}
        color="#FB923C"
      />

      {/* Canopy Underside Bounce Light to soften deep shadows below entrance overhangs */}
      <directionalLight
        position={[0, -4, 0]}
        intensity={0.18}
        color="#38BDF8"
      />

      {/* Atmospheric Fog aligned with #050816 dark interface theme (recessed for clear campus readability) */}
      <fog attach="fog" args={["#101827", 65, 150]} />
    </>
  );
});
