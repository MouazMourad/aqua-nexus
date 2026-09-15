"use client";

import { Edges } from "@react-three/drei";

export function GlassBox({
  width,
  depth,
  height,
  position = [0, 0, 0] as [number, number, number],
  edge = "#62d9e8",
}: {
  width: number;
  depth: number;
  height: number;
  position?: [number, number, number];
  edge?: string;
}) {
  const t = 0.025;
  const glass = (
    <meshPhysicalMaterial
      color="#7bddea"
      transparent
      opacity={0.13}
      roughness={0.08}
      metalness={0}
      transmission={0.25}
      thickness={0.18}
      depthWrite={false}
    />
  );

  return (
    <group position={position}>
      <mesh position={[0, 0, -depth / 2]}><boxGeometry args={[width, height, t]} />{glass}</mesh>
      <mesh position={[0, 0, depth / 2]}><boxGeometry args={[width, height, t]} />{glass}</mesh>
      <mesh position={[-width / 2, 0, 0]}><boxGeometry args={[t, height, depth]} />{glass}</mesh>
      <mesh position={[width / 2, 0, 0]}><boxGeometry args={[t, height, depth]} />{glass}</mesh>
      <mesh position={[0, -height / 2, 0]}>
        <boxGeometry args={[width, t, depth]} />
        {glass}
        <Edges color={edge} threshold={15} />
      </mesh>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges color={edge} threshold={15} />
      </mesh>
    </group>
  );
}
