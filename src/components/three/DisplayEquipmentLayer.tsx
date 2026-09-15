"use client";
import type { Equipment, Tank } from "@/domain/types";
import {
  displayScenePosition,
  overflowReturnScenePosition,
  resolvedOverflowReturnPosition,
  resolvedPosition
} from "@/lib/displayLayout";
import { EquipmentModel } from "./equipment/EquipmentModel";

function ReturnOutlet({
  equipment,width,depth,height,displayBottom,index,total
}:{
  equipment:Equipment;width:number;depth:number;height:number;displayBottom:number;index:number;total:number
}) {
  const pos=overflowReturnScenePosition(equipment,width,depth,height,displayBottom,index,total);
  const p=resolvedOverflowReturnPosition(equipment,index,total);
  return <group position={pos} rotation={[0,(p.rotationY??0)*Math.PI/180,0]} scale={p.scale??.82}>
    <mesh rotation={[0,0,Math.PI/2]}>
      <cylinderGeometry args={[.055,.055,.18,18]}/>
      <meshStandardMaterial color="#153844" metalness={.5} roughness={.26}/>
    </mesh>
    <mesh position={[.11,0,0]} rotation={[0,0,Math.PI/2]}>
      <cylinderGeometry args={[.034,.052,.08,18]}/>
      <meshStandardMaterial color="#55e2ff" emissive="#16829a" emissiveIntensity={.45} metalness={.35}/>
    </mesh>
  </group>;
}

export function DisplayEquipmentLayer({
  tank,width,depth,height,displayBottom
}:{
  tank:Tank;width:number;depth:number;height:number;displayBottom:number
}) {
  const devices=tank.equipment.filter(e=>e.location==="display" && e.kind!=="lighting");
  const kindCounts=new Map<string,number>();
  devices.forEach(e=>kindCounts.set(e.kind,(kindCounts.get(e.kind)||0)+1));
  const used=new Map<string,number>();

  return <group>{devices.map(e=>{
    const idx=used.get(e.kind)||0;used.set(e.kind,idx+1);
    const total=kindCounts.get(e.kind)||1;
    const pos=displayScenePosition(e,width,depth,height,displayBottom,idx,total);
    const p=resolvedPosition(e,idx,total);
    const base=e.kind==="overflow"?.72:e.kind==="waveMaker"?.7:.58;
    const scale=base*(p.scale??1);
    return <group key={e.id}>
      <group position={pos} rotation={[0,(p.rotationY??0)*Math.PI/180,0]}>
        <EquipmentModel kind={e.kind} scale={scale}/>
      </group>
      {e.kind==="overflow"&&
        <ReturnOutlet equipment={e} width={width} depth={depth} height={height} displayBottom={displayBottom} index={idx} total={total}/>
      }
    </group>;
  })}</group>;
}
