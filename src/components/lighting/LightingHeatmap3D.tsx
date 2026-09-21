"use client";
import { Canvas } from "@react-three/fiber";
import { Html,OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Tank } from "@/domain/types";
import { estimatedParAt,lightingAtMinute,lightingGrid,lightingIntelligence } from "@/domain/lightingIntelligence";
import { cm } from "@/lib/units";
import { clamp } from "@/lib/displayLayout";
import { GlassBox } from "@/components/three/GlassBox";
import { WaterSurface } from "@/components/three/WaterSurface";

function compositeLightColor(tank:Tank,minute:number){
 const program=tank.lighting?.activeProgram;
 if(!program)return{color:new THREE.Color("#8fcfff"),intensity:.08};
 const state=lightingAtMinute(program,minute),rgb={r:0,g:0,b:0};
 const palette:Record<string,[number,number,number]>={
  uv:[.42,.18,1],violet:[.55,.25,1],royalBlue:[.12,.34,1],blue:[.08,.55,1],cyan:[.12,.95,1],
  green:[.25,1,.3],red:[1,.16,.1],warmWhite:[1,.72,.48],coolWhite:[.82,.94,1],white:[.9,.95,1],other:[.75,.85,1]
 };
 let total=0;
 for(const ch of program.channels){
  if(!ch.enabled)continue;
  const v=Math.max(0,Math.min(100,state.values[ch.id]??0))/100;
  const p=palette[ch.spectrum]??palette.other;
  rgb.r+=p[0]*v;rgb.g+=p[1]*v;rgb.b+=p[2]*v;total+=v;
 }
 const max=Math.max(rgb.r,rgb.g,rgb.b,.001);
 const color=new THREE.Color(rgb.r/max,rgb.g/max,rgb.b/max);
 return{color,intensity:Math.max(.02,Math.min(1.35,state.weightedPercent/100*1.35)),weightedPercent:state.weightedPercent};
}

function heatColor(value:number,max:number){
  const t=Math.max(0,Math.min(1,value/Math.max(1,max)));
  const hue=(1-t)*.62;
  return new THREE.Color().setHSL(hue,.9,.52);
}

function FixtureMarker({x,y,z,label,color,intensity}:{x:number;y:number;z:number;label:string;color:THREE.Color;intensity:number}){
 return <group position={[x,y,z]}>
  <mesh castShadow><boxGeometry args={[.55,.06,.18]}/><meshStandardMaterial color="#172b3b" metalness={.65} roughness={.28}/></mesh>
  <mesh position={[0,-.035,0]}><boxGeometry args={[.45,.012,.10]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5+intensity*2}/></mesh>
  <pointLight position={[0,-.08,0]} color={color} intensity={intensity*1.8} distance={2.2} decay={2}/>
  <Html position={[0,.16,0]} center distanceFactor={8} style={{pointerEvents:"none"}}><div className="scene-device-tag dom-tag" style={{whiteSpace:"nowrap"}}>{label}</div></Html>
 </group>;
}

function HeatScene({tank,minute,depthPct}:{tank:Tank;minute:number;depthPct:number}){
 const w=cm(tank.display.length),d=cm(tank.display.width),h=cm(tank.display.height),centerY=.15,bottom=centerY-h/2,top=centerY+h/2;
 const grid=lightingGrid(tank,{minute,depthPct,cols:15,rows:9});
 const cellW=w/grid.cols,cellD=d/grid.rows,mapY=top-(depthPct/100)*h;
 const fixtures=tank.equipment.filter(x=>x.kind==="lighting"&&x.location==="display"&&x.status!=="off");
 const visual=compositeLightColor(tank,minute);
 const bg=new THREE.Color("#01060b").lerp(visual.color.clone().multiplyScalar(.22),Math.min(.72,visual.intensity*.58));
 return <>
  <color attach="background" args={[bg]}/><fog attach="fog" args={[bg,6,14]}/>
  <ambientLight intensity={.12+visual.intensity*.45} color={visual.color}/><directionalLight position={[3,5,4]} intensity={.08+visual.intensity*1.15} color={visual.color}/>
  <GlassBox width={w} depth={d} height={h} position={[0,centerY,0]} edge="#39dcff"/>
  <WaterSurface width={w*.985} depth={d*.985} y={top-.04}/>
  <group>
   {grid.cells.map((cell,i)=>{
    const xi=i%grid.cols,zi=Math.floor(i/grid.cols);
    const x=-w/2+cellW/2+xi*cellW,z=-d/2+cellD/2+zi*cellD;
    const color=heatColor(cell.par,Math.max(100,grid.max));
    return <mesh key={i} position={[x,mapY,z]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[cellW*.94,cellD*.94]}/>
      <meshBasicMaterial color={color} transparent opacity={.58} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>;
   })}
  </group>
  {fixtures.map((f,i)=>{
    const p=f.displayPosition??{xPct:(i+1)/(fixtures.length+1)*100,yPct:116,zPct:50};
    const x=-w/2+(clamp(p.xPct,0,100)/100)*w,z=-d/2+(clamp(p.zPct,0,100)/100)*d;
    const mountCm=typeof f.mountingHeightCm==="number"?clamp(f.mountingHeightCm,1,150):Math.max(5,(clamp(p.yPct,100,150)-100)/100*tank.display.height+10);
    const y=top+cm(mountCm);
    return <FixtureMarker key={f.id} x={x} y={y} z={z} label={f.name} color={visual.color} intensity={visual.intensity}/>;
  })}
  <gridHelper args={[Math.max(w,d)*1.25,12,"#123a4b","#0b2633"]} position={[0,bottom-.05,0]}/>
  <OrbitControls makeDefault target={[0,centerY,0]} minDistance={2.5} maxDistance={8} minPolarAngle={.45} maxPolarAngle={1.48} enablePan={false}/>
 </>;
}

export function LightingHeatmap3D({tank,minute,depthPct}:{tank:Tank;minute:number;depthPct:number}){
 const intel=lightingIntelligence(tank);
 const currentCenterPar=estimatedParAt(tank,50,50,depthPct,minute);
 const mode=intel.calibrationPoints?("calibrated ×"+intel.calibrationFactor.toFixed(2)):"estimated";
 return <div className="lighting-3d-wrap">
  <Canvas camera={{position:[3.5,2.4,5.1],fov:40}} dpr={[1,1.6]} gl={{antialias:true,powerPreference:"high-performance"}} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.1}}>
   <HeatScene tank={tank} minute={minute} depthPct={depthPct}/>
  </Canvas>
  <div className="lighting-3d-badge"><b>{Math.round(currentCenterPar)} PAR</b><small>{mode}</small></div>
  <style jsx>{`
   .lighting-3d-wrap{height:430px;position:relative;border:1px solid rgba(91,205,231,.16);border-radius:18px;overflow:hidden;background:#020b14}
   .lighting-3d-badge{position:absolute;inset-inline-end:12px;top:12px;display:grid;gap:2px;padding:8px 10px;border:1px solid rgba(112,214,245,.2);border-radius:11px;background:rgba(3,22,32,.8);backdrop-filter:blur(8px)}
   .lighting-3d-badge b{font-size:14px}.lighting-3d-badge small{font-size:8px;opacity:.65;text-transform:uppercase}
   @media(max-width:700px){.lighting-3d-wrap{height:340px}}
  `}</style>
 </div>;
}
