"use client";
import { useState } from "react";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Equipment, Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { cm } from "@/lib/units";
import { clamp, displayScenePosition, overflowReturnScenePosition, resolvedPosition } from "@/lib/displayLayout";
import { GlassBox } from "./GlassBox";
import { WaterSurface } from "./WaterSurface";
import { SumpScene, sumpChamberSceneCenter } from "./SumpScene";
import { HabitatScene } from "./HabitatScene";
import { LightingRig } from "./LightingRig";
import { FlowRoute } from "./FlowRoute";
import { DisplayEquipmentLayer } from "./DisplayEquipmentLayer";
import { TankFlowField } from "./TankFlowField";
import { ExternalEquipmentRack } from "./ExternalEquipmentRack";

function Frame({ width, depth, displayBottom, sumpBottom }: { width:number; depth:number; displayBottom:number; sumpBottom:number }) {
  const frameW=width+.24, frameD=depth+.16, postH=Math.max(.5,displayBottom-sumpBottom+.08), postY=(displayBottom+sumpBottom)/2;
  return <group>
    <mesh position={[0,displayBottom-.07,0]}><boxGeometry args={[frameW,.08,frameD]}/><meshStandardMaterial color="#0b151d" metalness={.82} roughness={.2}/></mesh>
    <mesh position={[0,sumpBottom-.10,0]}><boxGeometry args={[frameW,.08,frameD]}/><meshStandardMaterial color="#0b151d" metalness={.82} roughness={.2}/></mesh>
    {[-1,1].flatMap(x=>[-1,1].map(z=><mesh key={`${x}-${z}`} position={[x*frameW*.47,postY,z*frameD*.43]}><boxGeometry args={[.055,postH,.055]}/><meshStandardMaterial color="#0b151d" metalness={.82} roughness={.2}/></mesh>))}
  </group>;
}

function Backdrop({accent}:{accent:string}){
 return <group>
   <mesh position={[0,.15,-2.25]}><planeGeometry args={[8.6,6.8]}/><meshStandardMaterial color="#06131d" roughness={.76} metalness={.08}/></mesh>
   <pointLight position={[0,1.6,-1.8]} color={accent} intensity={.72} distance={6}/>
 </group>;
}


function equipmentLabel(e:Equipment, lang:"ar"|"en", index:number){
  const raw=(e.name||"").trim();
  const ignore=/^(lightinglighting|waveMaker|wavemaker|lighting|123)$/i;
  if(raw && !ignore.test(raw)) return raw;

  const idx=index+1;
  const ar:Record<string,string>={
    lighting:`إنارة ${idx}`,
    waveMaker:`ويف ميكر ${idx}`,
    overflow:`أوفر فلو ${idx}`,
    returnPump:`مضخة رجوع ${idx}`,
    skimmer:`سكيمر ${idx}`,
    filterSock:`فلترة ميكانيكية ${idx}`,
    heater:`سخان ${idx}`,
    refugiumLight:`إنارة ريفوجيوم ${idx}`,
    turfScrubber:`تيرف ${idx}`,
    ozone:`أوزون ${idx}`,
    uv:`UV ${idx}`,
    reactor:`رياكتر ${idx}`,
    probe:`مجس ${idx}`,
    ato:`تعويض تبخر ${idx}`,
    doser:`دوزر ${idx}`,
    rollerFilter:`رولر فلتر ${idx}`,
    other:`تجهيزة ${idx}`,
  };
  const en:Record<string,string>={
    lighting:`Lighting ${idx}`,
    waveMaker:`Wave Maker ${idx}`,
    overflow:`Overflow ${idx}`,
    returnPump:`Return Pump ${idx}`,
    skimmer:`Skimmer ${idx}`,
    filterSock:`Filter Sock ${idx}`,
    heater:`Heater ${idx}`,
    refugiumLight:`Refugium Light ${idx}`,
    turfScrubber:`Turf Scrubber ${idx}`,
    ozone:`Ozone ${idx}`,
    uv:`UV ${idx}`,
    reactor:`Reactor ${idx}`,
    probe:`Probe ${idx}`,
    ato:`ATO ${idx}`,
    doser:`Doser ${idx}`,
    rollerFilter:`Roller Filter ${idx}`,
    other:`Equipment ${idx}`,
  };
  const key=e.kind in ar?e.kind:"other";
  return lang==="ar"?ar[key]:en[key];
}

type TrackedLabel={id:string;text:string;x:number;y:number;visible:boolean};

function equipmentAnchorWorld(
  e:Equipment,
  width:number,
  depth:number,
  height:number,
  displayBottom:number,
  index:number,
  total:number
):THREE.Vector3 {
  if(e.kind==="overflow"){
    const pos=displayScenePosition(e,width,depth,height,displayBottom,index,total);
    return new THREE.Vector3(pos[0],pos[1]+0.16,pos[2]);
  }

  if(e.kind==="lighting"){
    const p=resolvedPosition(e,index,total);
    const x=-width/2 + (clamp(p.xPct,0,100)/100)*width;
    const y=displayBottom + (clamp(p.yPct,0,130)/100)*height + 0.12;
    const z=-depth/2 + (clamp(p.zPct,0,100)/100)*depth;
    return new THREE.Vector3(x,y,z);
  }

  const pos=displayScenePosition(e,width,depth,height,displayBottom,index,total);
  const side=(resolvedPosition(e,index,total).xPct??50)>=50?1:-1;
  if(e.kind==="waveMaker") return new THREE.Vector3(pos[0]+(0.20*side),pos[1]+0.04,pos[2]);
  return new THREE.Vector3(pos[0],pos[1]+0.12,pos[2]);
}

function SceneLabelTracker({
  tank,lang,width,depth,height,displayBottom,onUpdate
}:{
  tank:Tank;lang:"ar"|"en";width:number;depth:number;height:number;displayBottom:number;onUpdate:(labels:TrackedLabel[])=>void
}){
  const {camera,size}=useThree();
  const devices=tank.equipment.filter(e=>e.location==="display"&&e.status!=="off");
  useFrame(()=>{
    const kindCounts=new Map<string,number>();
    devices.forEach(e=>kindCounts.set(e.kind,(kindCounts.get(e.kind)||0)+1));
    const used=new Map<string,number>();
    const next:TrackedLabel[]=[];
    for(const e of devices){
      const idx=used.get(e.kind)||0;
      used.set(e.kind,idx+1);
      const total=kindCounts.get(e.kind)||1;
      const world=equipmentAnchorWorld(e,width,depth,height,displayBottom,idx,total);
      const projected=world.clone().project(camera);
      const visible=projected.z>-1&&projected.z<1&&projected.x>=-1.25&&projected.x<=1.25&&projected.y>=-1.25&&projected.y<=1.25;
      const x=(projected.x*0.5+0.5)*size.width;
      const y=(-projected.y*0.5+0.5)*size.height;
      next.push({id:e.id,text:equipmentLabel(e,lang,idx),x,y,visible});
    }
    onUpdate(next);
  });
  return null;
}

function DisplayLabelsOverlay({labels,lang}:{labels:TrackedLabel[];lang:"ar"|"en"}){
  if(!labels.length)return null;
  return <div className="scene-device-label-layer" dir={lang==="ar"?"rtl":"ltr"}>
    {labels.map(x=><div key={x.id} className="scene-device-tag dom-tag" style={{left:`${x.x}px`,top:`${x.y}px`,opacity:x.visible?1:0,transform:"translate(-50%,-50%)"}}>{x.text}</div>)}
  </div>;
}

function Scene({ tank, view, lang, onLabelsUpdate }: { tank: Tank; view:"system"|"display"; lang:"ar"|"en"; onLabelsUpdate:(labels:TrackedLabel[])=>void }) {
  const w=cm(tank.display.length),d=cm(tank.display.width),h=cm(tank.display.height);
  const displayY=view==="display"?.15:1.15,displayBottom=displayY-h/2,waterY=displayY+h/2-.08;
  const sumpHeight=tank.sump.enabled?cm(tank.sump.dimensions.height):.6,sumpY=-1.02,sumpBottom=sumpY-sumpHeight/2;
  const displayEquipment=tank.equipment.filter(e=>e.location==="display");
  const marine=tank.type==="marine",accent=marine?"#39dcff":"#56d99b",bg=marine?"#020b14":"#04130e";
  const showSystem=view==="system";

  const overflow=tank.equipment.find(e=>e.location==="display"&&e.kind==="overflow");
  const overflowPos=overflow
    ? displayScenePosition(overflow,w,d,h,displayBottom,0,1)
    : [w/2-.12,waterY-.12,-d/2+.10] as [number,number,number];
  const returnOutletPos=overflow
    ? overflowReturnScenePosition(overflow,w,d,h,displayBottom,0,1)
    : [-w/2+.10,waterY-.14,d*.26] as [number,number,number];

  const first=tank.sump.chambers[0];
  const returnPump=tank.equipment.find(e=>e.kind==="returnPump"&&e.location.startsWith("sump:"));
  const returnChamberId=returnPump?.location.startsWith("sump:")
    ? returnPump.location.slice(5)
    : (tank.sump.chambers.at(-1)?.id||"");
  const inletCenter=first
    ? sumpChamberSceneCenter(tank,first.id,sumpY)
    : [-w*.35,sumpY,0] as [number,number,number];
  const returnCenter=returnChamberId
    ? sumpChamberSceneCenter(tank,returnChamberId,sumpY)
    : [w*.35,sumpY,0] as [number,number,number];

  const drainSide=overflowPos[0]>=0?1:-1;
  const returnSide=returnOutletPos[0]>=0?1:-1;
  const drainPipeX=drainSide*(w/2+.17);
  let returnPipeX=returnSide*(w/2+.17);
  if(drainSide===returnSide) returnPipeX+=returnSide*.10;

  const downPoints:[number,number,number][]=[
    [overflowPos[0],Math.min(waterY-.07,overflowPos[1]),overflowPos[2]],
    [drainPipeX,displayY+.10,overflowPos[2]],
    [drainPipeX,sumpY+.18,inletCenter[2]],
    [inletCenter[0],sumpY+.12,inletCenter[2]]
  ];
  const upPoints:[number,number,number][]=[
    [returnCenter[0],sumpY+.12,returnCenter[2]],
    [returnPipeX,sumpY+.18,returnOutletPos[2]],
    [returnPipeX,displayY+.12,returnOutletPos[2]],
    [returnOutletPos[0],Math.min(waterY-.06,returnOutletPos[1]),returnOutletPos[2]]
  ];

  return <>
    <color attach="background" args={[bg]}/><fog attach="fog" args={[bg,8,18]}/>
    <ambientLight intensity={.6}/><directionalLight position={[3.5,6,5]} intensity={1.55} color="#dffcff" castShadow/><pointLight position={[0,2.8,-2]} intensity={1.1} color={accent} distance={6}/>
    <Backdrop accent={accent}/>
    <group>
      {showSystem&&<Frame width={w} depth={d} displayBottom={displayBottom} sumpBottom={sumpBottom}/>}      
      <GlassBox width={w} depth={d} height={h} position={[0,displayY,0]} edge={accent}/>
      <mesh position={[0,displayY,-d/2+.025]}><boxGeometry args={[w*.98,h*.97,.035]}/><meshStandardMaterial color={marine?"#073151":"#0b4034"} transparent opacity={.58} roughness={.7}/></mesh>
      <WaterSurface width={w*.985} depth={d*.985} y={waterY} freshwater={!marine}/>
      <HabitatScene tank={tank} width={w} depth={d} height={h} baseY={displayBottom+.02}/>
      <LightingRig equipment={displayEquipment} width={w} depth={d} height={h} topY={displayY+h/2+.34} marine={marine}/>
      <DisplayEquipmentLayer tank={tank} width={w} depth={d} height={h} displayBottom={displayBottom}/>
      <TankFlowField tank={tank} width={w} depth={d} height={h} displayBottom={displayBottom} accent={accent}/>
      {showSystem&&tank.sump.enabled&&<>
        <SumpScene tank={tank} y={sumpY}/>
        <FlowRoute points={downPoints} direction="down" color={accent}/>
        <FlowRoute points={upPoints} direction="up" color={accent}/>
      </>}
      {showSystem&&<ExternalEquipmentRack tank={tank} x={w/2+1.0} y={-.15} z={-.08}/>}
      <SceneLabelTracker tank={tank} lang={lang} width={w} depth={d} height={h} displayBottom={displayBottom} onUpdate={onLabelsUpdate}/>
    </group>
    <ContactShadows position={[0,showSystem?sumpBottom-.17:displayBottom-.22,0]} opacity={.42} scale={7} blur={2.8} far={4}/>
    <OrbitControls makeDefault target={[0,showSystem?.05:displayY,0]} minDistance={view==="display"?3.0:4.7} maxDistance={view==="display"?7.5:12} minPolarAngle={.7} maxPolarAngle={1.43} enablePan={false}/>
  </>;
}

function liters(n:number){ return `${n.toFixed(1)} L`; }

export function AquariumScene({ tank, view="system" }: { tank: Tank; view?:"system"|"display" }) {
  const lang=useAquaStore(s=>s.language);
  const [trackedLabels,setTrackedLabels]=useState<TrackedLabel[]>([]);
  const showSystem=view==="system";
  const camera=showSystem?{position:[4.35,1.65,7.45] as [number,number,number],fov:42}:{position:[3.55,1.9,5.7] as [number,number,number],fov:39};

  const sumpGross = tank.sump.enabled ? tank.sump.dimensions.length * tank.sump.dimensions.width * tank.sump.dimensions.height / 1000 : 0;
  const sumpNet = tank.sump.enabled ? sumpGross * tank.sump.operatingFillPercent / 100 : 0;

  return <div className="aquarium-scene-wrap">
    <div className="scene-side-stack" dir={lang==="ar"?"rtl":"ltr"}>
      <div className="scene-side-card">
        <small>{lang==="ar"?"أبعاد الحوض":"Display dimensions"}</small>
        <div className="scene-side-main"><b>{tank.display.length} × {tank.display.width} × {tank.display.height}</b><em>cm</em></div>
      </div>

      {showSystem&&tank.sump.enabled&&<div className="scene-side-card">
        <small>{lang==="ar"?"أبعاد السامب":"Sump dimensions"}</small>
        <div className="scene-side-main"><b>{tank.sump.dimensions.length} × {tank.sump.dimensions.width} × {tank.sump.dimensions.height}</b><em>cm</em></div>
      </div>}

      <div className="scene-side-card volume">
        <small>{lang==="ar"?"حجم الحوض المرئي":"Display volume"}</small>
        <div className="scene-side-main"><b>{liters(tank.display.netLiters)}</b></div>
      </div>

      {showSystem&&tank.sump.enabled&&<div className="scene-side-card volume">
        <small>{lang==="ar"?"حجم السامب":"Sump volume"}</small>
        <div className="scene-side-main"><b>{liters(sumpNet)}</b></div>
      </div>}

      <div className="scene-side-card volume">
        <small>{lang==="ar"?"الحجم الكلي":"System volume"}</small>
        <div className="scene-side-main"><b>{liters(tank.systemVolumeLiters)}</b></div>
      </div>
    </div>

    <DisplayLabelsOverlay labels={trackedLabels} lang={lang}/>

    <Canvas shadows dpr={[1,1.6]} camera={camera} gl={{antialias:true,alpha:false,powerPreference:"high-performance"}} onCreated={({gl})=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.16;}}>
      <Scene tank={tank} view={view} lang={lang} onLabelsUpdate={setTrackedLabels}/>
    </Canvas>
  </div>;
}
