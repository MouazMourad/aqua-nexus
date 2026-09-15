"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function FlowPipe({
  x,
  yTop,
  yBottom,
  z,
  direction,
}: {
  x: number;
  yTop: number;
  yBottom: number;
  z: number;
  direction: "down" | "up";
}) {
  const particles = useRef<THREE.Group>(null);
  const height = yTop - yBottom;

  useFrame(({ clock }) => {
    const g = particles.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const speed = 0.45 + i * 0.05;
      const phase = (clock.elapsedTime * speed + i / 6) % 1;
      const y = direction === "down"
        ? yTop - phase * height
        : yBottom + phase * height;
      child.position.y = y;
    });
  });

  return (
    <group>
      <mesh position={[x, (yTop + yBottom) / 2, z]}>
        <cylinderGeometry args={[0.045, 0.045, height, 20]} />
        <meshStandardMaterial color="#172b35" metalness={0.45} roughness={0.3} />
      </mesh>

      <group ref={particles}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[x, yTop, z]}>
            <sphereGeometry args={[0.025, 12, 12]} />
            <meshBasicMaterial color="#79eff7" transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
