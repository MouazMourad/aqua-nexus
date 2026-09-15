"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export function FlowRoute({
  points,
  direction,
  label,
  color = "#35e4ff",
}: {
  points: [number, number, number][];
  direction: "down" | "up" | "across";
  label?: string;
  color?: string;
}) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.25),
    [points]
  );
  const movers = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!movers.current) return;
    movers.current.children.forEach((child, i) => {
      const phase = (clock.elapsedTime * 0.18 + i / 8) % 1;
      const t = direction === "down" ? phase : direction === "up" ? phase : phase;
      const p = curve.getPoint(t);
      child.position.copy(p);
      const tangent = curve.getTangent(Math.min(0.999, t + 0.001));
      child.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize());
    });
  });

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 80, 0.038, 14, false]} />
        <meshStandardMaterial color="#0b2633" metalness={0.75} roughness={0.22} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 80, 0.014, 10, false]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
      <group ref={movers}>
        {Array.from({ length: 8 }, (_, i) => (
          <group key={i}>
            <mesh>
              <coneGeometry args={[0.042, 0.12, 14]} />
              <meshBasicMaterial color={color} transparent opacity={0.95} />
            </mesh>
            <pointLight color={color} intensity={0.45} distance={0.55} />
          </group>
        ))}
      </group>
    </group>
  );
}
