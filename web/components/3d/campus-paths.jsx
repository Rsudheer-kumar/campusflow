"use client";

import { memo } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";

// Architectural walkway materials & colors
const pathColor = "#0E1729";       // Refined dark paver stone
const edgeColor = "#223552";       // Contrasting architectural paver curb lines
const lawnColor = "#0E2A1E";       // Rich manicured emerald campus lawn
const lawnEdgeColor = "#1B4734";   // Crisp landscaped lawn border

// Reusable static geometries
const mainPathGeometry = new THREE.PlaneGeometry(3.2, 34);
const crossPathNorthGeometry = new THREE.PlaneGeometry(26, 3.2);
const crossPathSouthGeometry = new THREE.PlaneGeometry(24, 3.2);
const diagonalPathWestGeometry = new THREE.PlaneGeometry(16, 2.4);
const diagonalPathEastGeometry = new THREE.PlaneGeometry(16, 2.4);
const plazaGeometry = new THREE.PlaneGeometry(9, 9);
const innerPlazaGeometry = new THREE.PlaneGeometry(4.8, 4.8);

// Lawn Island Geometries
const lawnNorthWestGeometry = new THREE.PlaneGeometry(7.5, 9);
const lawnNorthEastGeometry = new THREE.PlaneGeometry(7.5, 9);
const lawnSouthWestGeometry = new THREE.PlaneGeometry(7.5, 9);
const lawnSouthEastGeometry = new THREE.PlaneGeometry(7.5, 9);

// Reusable Materials
const pathMaterial = new THREE.MeshStandardMaterial({
  color: pathColor,
  roughness: 0.88,
  metalness: 0.18,
});
const lawnMaterial = new THREE.MeshStandardMaterial({
  color: lawnColor,
  roughness: 0.95,
  metalness: 0.05,
});
const innerPlazaMaterial = new THREE.MeshBasicMaterial({ color: "#16233B" });

// Stylized Campus Tree Geometries & Materials
const treeTrunkGeometry = new THREE.CylinderGeometry(0.08, 0.14, 0.85, 8);
const treeFoliageLowerGeometry = new THREE.ConeGeometry(0.7, 1.1, 8);
const treeFoliageUpperGeometry = new THREE.ConeGeometry(0.5, 0.9, 8);
const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: "#1E293B", roughness: 0.9 });
const treeFoliageMaterial = new THREE.MeshStandardMaterial({
  color: "#0B3627",
  roughness: 0.85,
  metalness: 0.08,
});
const treeFoliageAccentMaterial = new THREE.MeshStandardMaterial({
  color: "#114B37",
  roughness: 0.82,
  metalness: 0.1,
});

// Glowing Pathway Light Bollards (Directly inspired by the glowing lampposts in the reference photo)
const bollardPoleGeometry = new THREE.CylinderGeometry(0.04, 0.05, 0.85, 8);
const bollardCapGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8);
const bollardPoleMaterial = new THREE.MeshStandardMaterial({
  color: "#1E293B",
  roughness: 0.6,
  metalness: 0.8,
});
const bollardLightMaterial = new THREE.MeshStandardMaterial({
  color: "#FEF08A",
  emissive: "#F59E0B",
  emissiveIntensity: 0.95,
  roughness: 0.2,
  metalness: 0.1,
});

// Coordinated tree positions along campus greenspaces and walkway borders
const TREE_COORDINATES = [
  [-4.2, 0, -2.4],
  [4.2, 0, -2.4],
  [-4.2, 0, 2.4],
  [4.2, 0, 2.4],
  [-2.4, 0, -9.2],
  [2.4, 0, -9.2],
  [-2.4, 0, 9.2],
  [2.4, 0, 9.2],
  [-12.2, 0, 2.8],
  [12.2, 0, 2.8],
  [-12.2, 0, -8.2],
  [12.2, 0, -8.2],
];

// Glowing walkway light pole coordinates flanking the central promenades
const LIGHT_BOLLARD_COORDINATES = [
  // Flanking North-South Spine
  [-1.9, 0, -7.0],
  [1.9, 0, -7.0],
  [-1.9, 0, -3.2],
  [1.9, 0, -3.2],
  [-1.9, 0, 3.2],
  [1.9, 0, 3.2],
  [-1.9, 0, 7.0],
  [1.9, 0, 7.0],
  // Flanking North Walkway to TSC and HEC
  [-6.5, 0, -3.0],
  [-6.5, 0, -6.0],
  [6.5, 0, -3.0],
  [6.5, 0, -6.0],
  // Flanking South Walkway to CCC and IC
  [-5.8, 0, 4.8],
  [-5.8, 0, 7.6],
  [5.8, 0, 4.8],
  [5.8, 0, 7.6],
  // Plaza Corners
  [-4.8, 0, -4.8],
  [4.8, 0, -4.8],
  [-4.8, 0, 4.8],
  [4.8, 0, 4.8],
];

export const CampusPaths = memo(function CampusPaths() {
  return (
    <group position={[0, -0.012, 0]}>
      {/* ─── Landscaped Campus Lawn Grass Islands ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-7.5, -0.003, -9.5]} geometry={lawnNorthWestGeometry} material={lawnMaterial} receiveShadow>
        <Edges linewidth={1} threshold={15} color={lawnEdgeColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[7.5, -0.003, -9.5]} geometry={lawnNorthEastGeometry} material={lawnMaterial} receiveShadow>
        <Edges linewidth={1} threshold={15} color={lawnEdgeColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-7.5, -0.003, 11.5]} geometry={lawnSouthWestGeometry} material={lawnMaterial} receiveShadow>
        <Edges linewidth={1} threshold={15} color={lawnEdgeColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[7.5, -0.003, 11.5]} geometry={lawnSouthEastGeometry} material={lawnMaterial} receiveShadow>
        <Edges linewidth={1} threshold={15} color={lawnEdgeColor} />
      </mesh>

      {/* ─── Main North-South Central Spine Promenade ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} geometry={mainPathGeometry} material={pathMaterial} receiveShadow>
        <Edges linewidth={1.2} threshold={15} color={edgeColor} />
      </mesh>

      {/* ─── North Cross Path connecting Turing Science (West) and Hopper Engineering (East) ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4.5]} geometry={crossPathNorthGeometry} material={pathMaterial} receiveShadow>
        <Edges linewidth={1.2} threshold={15} color={edgeColor} />
      </mesh>

      {/* ─── South Cross Path connecting Central Campus (West) and Innovation (East) ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 6.2]} geometry={crossPathSouthGeometry} material={pathMaterial} receiveShadow>
        <Edges linewidth={1.2} threshold={15} color={edgeColor} />
      </mesh>

      {/* ─── Diagonal Approach Walkways ─── */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[-5.5, 0, 1.2]} geometry={diagonalPathWestGeometry} material={pathMaterial} receiveShadow>
        <Edges linewidth={1} threshold={15} color={edgeColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -Math.PI / 4]} position={[5.5, 0, 1.2]} geometry={diagonalPathEastGeometry} material={pathMaterial} receiveShadow>
        <Edges linewidth={1} threshold={15} color={edgeColor} />
      </mesh>

      {/* ─── Campus Central Quad Plaza ─── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} geometry={plazaGeometry} material={pathMaterial} receiveShadow>
        <Edges linewidth={1.8} threshold={15} color={edgeColor} />

        {/* Decorative inner plaza emblem */}
        <mesh position={[0, 0.005, 0]} geometry={innerPlazaGeometry} material={innerPlazaMaterial}>
          <Edges linewidth={1.2} threshold={15} color="#2D436B" />
        </mesh>
      </mesh>

      {/* ─── Glowing Pathway Light Bollards (Evening Campus Lighting) ─── */}
      {LIGHT_BOLLARD_COORDINATES.map(([bx, by, bz], idx) => (
        <group key={`bollard-${idx}`} position={[bx, by, bz]}>
          <mesh position={[0, 0.42, 0]} geometry={bollardPoleGeometry} material={bollardPoleMaterial} castShadow />
          <mesh position={[0, 0.88, 0]} geometry={bollardCapGeometry} material={bollardLightMaterial} />
        </group>
      ))}

      {/* ─── Stylized Campus Greenery & Trees ─── */}
      {TREE_COORDINATES.map(([tx, ty, tz], idx) => (
        <group key={`tree-${idx}`} position={[tx, ty, tz]}>
          <mesh position={[0, 0.42, 0]} geometry={treeTrunkGeometry} material={treeTrunkMaterial} castShadow />
          <mesh position={[0, 1.2, 0]} geometry={treeFoliageLowerGeometry} material={treeFoliageMaterial} castShadow />
          <mesh position={[0, 1.85, 0]} geometry={treeFoliageUpperGeometry} material={treeFoliageAccentMaterial} castShadow />
        </group>
      ))}
    </group>
  );
});
