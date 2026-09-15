"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo,useRef } from "react";
import * as THREE from "three";
import type { Equipment, Tank } from "@/domain/types";
import { clamp, displayScenePosition, resolvedPosition } from "@/lib/displayLayout";

function Jet({
  equipment,width,depth,height,displayBottom,index,total,color
}:{
  equipment:Equipment;width:number;depth:number;height:number;displayBottom:number;index:number;total:number;color:string
}) {
  const group=useRef<THREE.Group>(null);
  const p=resolvedPosition(equipment,index,total);
  const startArr=displayScenePosition(equipment,width,depth,height,displayBottom,index,total);
  const angle=(p.rotationY??0)*Math.PI/180;
  const strength=clamp(p.flowStrength??100,20,160)/100;
  const start=useMemo(()=>new THREE.Vector3(...startArr),[startArr[0],startArr[1],startArr[2]]);
  const curve=useMemo(()=>{
    const dx=Math.cos(angle),dz=-Math.sin(angle);
    const travel=Math.min(width,depth*1.8)*.72*strength;
    const end=new THREE.Vector3(
      clamp(start.x+dx*travel,-width*.43,width*.43),
      clamp(start.y+Math.sin(index*.8)*height*.07,displayBottom+height*.18,displayBottom+height*.82),
      clamp(start.z+dz*travel,-depth*.42,depth*.42)
    );
    const mid=start.clone().lerp(end,.52);
    mid.y+=Math.sin(index+1)*height*.045;
    mid.z+=Math.cos(index+2)*depth*.06;
    return new THREE.CatmullRomCurve3([start,mid,end],false,"catmullrom",.35);
  },[start.x,start.y,start.z,angle,strength,width,depth,height,displayBottom,index]);

  useFrame(({clock})=>{
    if(!group.current)return;
    group.current.children.forEach((c,i)=>{
      const t=(clock.elapsedTime*(.22+.12*strength)+i/10)%1;
      c.position.copy(curve.getPoint(t));
      const tangent=curve.getTangent(Math.min(.999,t+.001)).normalize();
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent);
    });
  });

  return <group>
    <mesh>
      <tubeGeometry args={[curve,50,.008,8,false]}/>
      <meshBasicMaterial color={color} transparent opacity={.18}/>
    </mesh>
    <group ref={group}>
      {Array.from({length:10},(_,i)=><mesh key={i}>
        <coneGeometry args={[.025,.075,10]}/>
        <meshBasicMaterial color={color} transparent opacity={.55}/>
      </mesh>)}
    </group>
  </group>;
}

export function TankFlowField({
  tank,width,depth,height,displayBottom,accent
}:{
  tank:Tank;width:number;depth:number;height:number;displayBottom:number;accent:string
}) {
  const waves=tank.equipment.filter(e=>e.location==="display"&&e.kind==="waveMaker"&&e.status!=="off");
  return <group>{waves.map((e,i)=><Jet key={e.id} equipment={e} width={width} depth={depth} height={height} displayBottom={displayBottom} index={i} total={waves.length} color={accent}/>)}</group>;
}
