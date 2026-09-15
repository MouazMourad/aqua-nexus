"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

const vertexShader = `
uniform float uTime;
varying float vWave;
void main(){
  vec3 p = position;
  float w1 = sin((p.x * 5.0) + uTime * 1.8) * 0.035;
  float w2 = cos((p.y * 7.0) - uTime * 1.25) * 0.025;
  float w3 = sin((p.x + p.y) * 4.0 + uTime) * 0.015;
  p.z += w1 + w2 + w3;
  vWave = w1 + w2 + w3;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = `
uniform vec3 uDeep;
uniform vec3 uLight;
varying float vWave;
void main(){
  float t = clamp((vWave + 0.08) * 5.0, 0.0, 1.0);
  vec3 color = mix(uDeep, uLight, t);
  gl_FragColor = vec4(color, 0.68);
}
`;

export function WaterSurface({
  width,
  depth,
  y,
  freshwater = false,
}: {
  width: number;
  depth: number;
  y: number;
  freshwater?: boolean;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(freshwater ? "#0b614b" : "#075074") },
      uLight: { value: new THREE.Color(freshwater ? "#58d9a3" : "#6ee8f4") },
    }),
    [freshwater]
  );

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
      <planeGeometry args={[width, depth, 72, 48]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
