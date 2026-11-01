"use client";
import { memo } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
// Reusable static geometries and materials to avoid re-allocating on every remount/render
const plinthGeometry = new THREE.PlaneGeometry(40, 40);
const plinthMaterial = new THREE.MeshStandardMaterial({ color: "#0B1120", roughness: 0.9 });
const baseGeometry = new THREE.PlaneGeometry(150, 150);
const baseMaterial = new THREE.MeshStandardMaterial({ color: "#050816", roughness: 1 });
export const CampusGround = memo(function CampusGround() {
    return (<group>
      {/* Inner Campus Foundation / Plinth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} geometry={plinthGeometry} material={plinthMaterial} receiveShadow>
        <Edges linewidth={1.5} threshold={15} color="#1E2A44"/>
      </mesh>

      {/* Main infinite solid receiver for shadows/raycasting, dark base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} geometry={baseGeometry} material={baseMaterial} receiveShadow/>
    </group>);
});
