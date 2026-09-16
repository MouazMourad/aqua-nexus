"use client";
import { Html } from "@react-three/drei";
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

function ParFootprint({x,z,y,radius,par}:{x:number;z:number;y:number;radius:number;par:number}){
  return <group position={[x,y,z]}>
    <mesh rotation={[-Math.PI/2,0,0]}>
      <circleGeometry args={[radius,40]}/>
      <meshBasicMaterial color="#4cc9ff" transparent opacity={.055} depthWrite={false}/>
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.002,0]}>
      <ringGeometry args={[radius*.42,radius*.72,40]}/>
      <meshBasicMaterial color="#ffc15a" transparent opacity={.08} depthWrite={false}/>
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.004,0]}>
      <circleGeometry args={[radius*.36,40]}/>
      <meshBasicMaterial color="#ff695f" transparent opacity={.09} depthWrite={false}/>
    </mesh>
    <Html position={[0,.045,0]} center distanceFactor={8} style={{pointerEvents:"none"}}>
      <div style={{fontSize:10,lineHeight:1.1,padding:"3px 5px",borderRadius:8,whiteSpace:"nowrap",background:"rgba(2,12,20,.72)",color:"#dffcff",border:"1px solid rgba(130,220,255,.25)"}}>≈ {Math.round(par)} PAR</div>
    </Html>
  </group>;
}

export function LightingRig({ equipment, width, depth, height, topY, marine }: { equipment: Equipment[]; width: number; depth:number; height:number; topY: number; marine: boolean }) {
  const lights = equipment.filter(e=>e.kind==="lighting" && e.location==="display" && e.status!=="off");
  if (!lights.length) return null;
  const floorY=topY-height-.34;
  return <group>{lights.map((e,i)=>{
    const p=resolvedPosition(e,i,lights.length);
    const x=-width/2+(clamp(p.xPct,2,98)/100)*width;
    const z=-depth/2+(clamp(p.zPct,2,98)/100)*depth;
    const y=topY + ((clamp(p.yPct,102,145)-116)/100)*height;
    const scale=clamp(p.scale??1,.55,1.65);
    const mountingGap=Math.max(.18,y-(floorY+height));
    const base=marine?320:170;
    const estimatedPar=base*Math.pow(scale,1.45)/Math.pow(1+mountingGap*1.25,1.35);
    const spread=clamp((.44+mountingGap*.8)*scale,.32,Math.max(.42,Math.min(width,depth)*.72));
    return <group key={e.id}>
      <Fixture name={e.name} x={x} y={y} z={z} marine={marine} scale={scale}/>
      <ParFootprint x={x} z={z} y={floorY+.035} radius={spread} par={estimatedPar}/>
    </group>;
  })}</group>;
}
