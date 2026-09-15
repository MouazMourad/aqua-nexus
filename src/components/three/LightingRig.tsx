"use client";
import type { Equipment } from "@/domain/types";
import { clamp, resolvedPosition } from "@/lib/displayLayout";

function Fixture({ name, x, y, z, marine, scale=1 }: { name: string; x: number; y: number; z:number; marine: boolean; scale?:number }) {
  const lightColor = marine ? "#597dff" : "#d9fff1";
  return <group position={[x,y,z]} scale={scale}>
    <mesh castShadow><boxGeometry args={[0.78,0.075,0.22]}/><meshStandardMaterial color="#1c2f48" metalness={0.72} roughness={0.22}/></mesh>
    <mesh position={[0,-0.043,0]}><boxGeometry args={[0.67,0.02,0.13]}/><meshStandardMaterial color={lightColor} emissive={lightColor} emissiveIntensity={2.8}/></mesh>
    <mesh position={[-0.29,0.14,0]}><boxGeometry args={[0.025,0.25,0.03]}/><meshStandardMaterial color="#263a49" metalness={0.6}/></mesh>
    <mesh position={[0.29,0.14,0]}><boxGeometry args={[0.025,0.25,0.03]}/><meshStandardMaterial color="#263a49" metalness={0.6}/></mesh>
    <pointLight position={[0,-0.22,0]} intensity={marine?1.9:1.45} color={lightColor} distance={3.2} decay={2}/>
  </group>;
}

export function LightingRig({ equipment, width, depth, height, topY, marine }: { equipment: Equipment[]; width: number; depth:number; height:number; topY: number; marine: boolean }) {
  const lights = equipment.filter(e=>e.kind==="lighting" && e.location==="display" && e.status!=="off");
  if (!lights.length) return null;
  return <group>{lights.map((e,i)=>{
    const p=resolvedPosition(e,i,lights.length);
    const x=-width/2+(clamp(p.xPct,2,98)/100)*width;
    const z=-depth/2+(clamp(p.zPct,2,98)/100)*depth;
    const y=topY + ((clamp(p.yPct,102,145)-116)/100)*height;
    return <Fixture key={e.id} name={e.name} x={x} y={y} z={z} marine={marine} scale={clamp(p.scale??1,.55,1.65)}/>;
  })}</group>;
}
