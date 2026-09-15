"use client";
import type { Tank } from "@/domain/types";
import { EquipmentModel } from "./equipment/EquipmentModel";

export function ExternalEquipmentRack({tank,x,y,z}:{tank:Tank;x:number;y:number;z:number}) {
  const items=tank.equipment.filter(e=>e.location==="external");
  if(!items.length)return null;
  const cols=3,rows=Math.ceil(items.length/cols),rackH=Math.max(1.05,.38+rows*.42);
  return <group position={[x,y,z]}>
    <mesh position={[0,rackH/2-.18,0]}><boxGeometry args={[.76,rackH,.38]}/><meshStandardMaterial color="#091720" metalness={.35} roughness={.38}/></mesh>
    {items.map((e,i)=>{
      const col=i%cols,row=Math.floor(i/cols),px=(col-1)*.21,py=rackH-.43-row*.42;
      return <group key={e.id} position={[px,py,.2]} scale={.42}>
        <EquipmentModel kind={e.kind}/>
      </group>;
    })}
  </group>;
}
