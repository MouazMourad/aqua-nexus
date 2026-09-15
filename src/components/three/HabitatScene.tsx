"use client";

import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Tank } from "@/domain/types";

function Rock({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow>
        <dodecahedronGeometry args={[0.22, 1]} />
        <meshStandardMaterial color="#243d43" roughness={0.88} metalness={0.03} />
      </mesh>
      <mesh position={[0.16, 0.03, 0.05]} scale={0.66} castShadow>
        <dodecahedronGeometry args={[0.22, 1]} />
        <meshStandardMaterial color="#314d4d" roughness={0.9} />
      </mesh>
      <mesh position={[-0.14, 0.04, -0.02]} scale={0.54} castShadow>
        <dodecahedronGeometry args={[0.22, 1]} />
        <meshStandardMaterial color="#1d353a" roughness={0.94} />
      </mesh>
    </group>
  );
}

function BranchCoral({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.025,0.035,0.32,10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.12} roughness={0.65}/></mesh>
      <mesh position={[0.08,0.25,0]} rotation={[0,0,-0.72]}><cylinderGeometry args={[0.018,0.026,0.22,10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.12}/></mesh>
      <mesh position={[-0.08,0.25,0]} rotation={[0,0,0.72]}><cylinderGeometry args={[0.018,0.026,0.22,10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.12}/></mesh>
      <mesh position={[0.02,0.35,0.04]} rotation={[0.45,0,-0.25]}><cylinderGeometry args={[0.015,0.022,0.18,10]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.14}/></mesh>
    </group>
  );
}

function SoftCoral({ position, color, scale = 1 }: { position: [number, number, number]; color: string; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return <mesh key={i} position={[Math.cos(a)*0.065,0.11+((i%2)*0.02),Math.sin(a)*0.065]} scale={[0.8,1.4,0.8]}><sphereGeometry args={[0.055,14,10]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.08} roughness={0.55}/></mesh>;
      })}
    </group>
  );
}

function PlantCluster({ position, color = "#39b96d", scale = 1 }: { position: [number, number, number]; color?: string; scale?: number }) {
  return <group position={position} scale={scale}>{Array.from({length:12},(_,i)=>{
    const x=((i%4)-1.5)*0.06, z=(Math.floor(i/4)-1)*0.07, h=0.22+(i%3)*0.08;
    return <mesh key={i} position={[x,h/2,z]} rotation={[0,0,(i%2?1:-1)*0.12]}><cylinderGeometry args={[0.009,0.014,h,8]}/><meshStandardMaterial color={color} roughness={0.8}/></mesh>;
  })}</group>;
}

function Fish({ index, width, height, depth, color, bottomY }: { index: number; width: number; height: number; depth: number; color: string; bottomY:number }) {
  const ref = useRef<THREE.Group>(null);
  const seed = useMemo(() => index * 1.73 + 0.4, [index]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * (0.18 + (index%3)*0.025) + seed;
    const x = Math.sin(t) * width * 0.34;
    const centerY = bottomY + height * (0.48 + (index%3)*0.07);
    const y = centerY + Math.sin(t*1.35+index) * height * 0.11;
    const z = Math.cos(t*0.7+index) * depth * 0.28;
    ref.current.position.set(
      Math.max(-width*.39,Math.min(width*.39,x)),
      Math.max(bottomY+height*.18,Math.min(bottomY+height*.78,y)),
      Math.max(-depth*.36,Math.min(depth*.36,z))
    );
    ref.current.rotation.y = Math.cos(t) >= 0 ? 0 : Math.PI;
  });
  return <group ref={ref}>
    <mesh scale={[0.12,0.07,0.045]}><sphereGeometry args={[1,18,12]}/><meshStandardMaterial color={color} roughness={0.45} metalness={0.06}/></mesh>
    <mesh position={[-0.13,0,0]} rotation={[0,0,Math.PI/2]}><coneGeometry args={[0.065,0.11,3]}/><meshStandardMaterial color={color}/></mesh>
  </group>;
}

export function HabitatScene({ tank, width, depth, height, baseY }: { tank: Tank; width: number; depth: number; height: number; baseY: number }) {
  if (tank.type === "freshwater") {
    return <group>
      <mesh position={[0,baseY+0.025,0]}><boxGeometry args={[width*0.96,0.05,depth*0.94]}/><meshStandardMaterial color="#4b3828" roughness={1}/></mesh>
      <PlantCluster position={[-width*.25,baseY+.03,-.05]} scale={1.15}/>
      <PlantCluster position={[0,baseY+.03,.12]} color="#5ac66f" scale={1.35}/>
      <PlantCluster position={[width*.25,baseY+.03,-.08]} color="#279b74" scale={1.05}/>
      <Sparkles count={28} scale={[width*.85,height*.7,depth*.75]} size={1.2} speed={0.12} opacity={0.2} color="#84f1c0" />
    </group>;
  }

  const fishCount = Math.min(6, tank.livestock.filter(x=>x.category==="fish").reduce((s,x)=>s+x.quantity,0));
  const fishColors = ["#ffd641","#3286ff","#ff8b42","#53c96e","#f26aac","#7d8cff"];
  return <group>
    <mesh position={[0,baseY+0.025,0]}><boxGeometry args={[width*0.97,0.05,depth*0.94]}/><meshStandardMaterial color="#d8c89d" roughness={1}/></mesh>
    <Rock position={[-width*.25,baseY+.18,0]} scale={1.55}/>
    <Rock position={[0,baseY+.18,-.04]} scale={1.85}/>
    <Rock position={[width*.28,baseY+.17,.02]} scale={1.5}/>
    <BranchCoral position={[-width*.30,baseY+.25,-.02]} color="#ef76b3" scale={1.05}/>
    <BranchCoral position={[-width*.08,baseY+.28,.04]} color="#6bd675" scale={1.1}/>
    <BranchCoral position={[width*.18,baseY+.27,-.03]} color="#8b72df" scale={1.18}/>
    <BranchCoral position={[width*.34,baseY+.24,.03]} color="#cf6acb" scale={0.92}/>
    <SoftCoral position={[-width*.18,baseY+.20,.16]} color="#5dcddd" scale={1.15}/>
    <SoftCoral position={[width*.02,baseY+.21,.13]} color="#91be50" scale={1.25}/>
    <SoftCoral position={[width*.27,baseY+.19,.15]} color="#bd64ae" scale={1.05}/>
    {Array.from({length:fishCount},(_,i)=><Fish key={i} index={i} width={width} height={height} depth={depth} bottomY={baseY} color={fishColors[i%fishColors.length]}/>) }
    <Sparkles count={40} scale={[width*.88,height*.72,depth*.76]} size={1.3} speed={0.16} opacity={0.22} color="#9beeff" />
  </group>;
}
