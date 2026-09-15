"use client";
import { Line } from "@react-three/drei";
import type { Tank } from "@/domain/types";
import { cm } from "@/lib/units";

function Measure({a,b,color}:{a:[number,number,number];b:[number,number,number];color:string}){
 return <Line points={[a,b]} color={color} lineWidth={1.2} transparent opacity={.82}/>;
}
export function SumpDimensions3D({tank,y}:{tank:Tank;y:number}){
 if(!tank.sump.enabled)return null;
 const w=cm(tank.sump.dimensions.length),d=cm(tank.sump.dimensions.width),h=cm(tank.sump.dimensions.height),bottom=y-h/2,front=d/2+.12,color=tank.type==="marine"?"#55dcea":"#58d79b";
 return <group>
   <Measure a={[-w/2,bottom-.09,front]} b={[w/2,bottom-.09,front]} color={color}/>
   <Measure a={[w/2+.10,bottom,front]} b={[w/2+.10,bottom+h,front]} color={color}/>
   <Measure a={[-w/2-.12,bottom-.04,-d/2]} b={[-w/2-.12,bottom-.04,d/2]} color={color}/>
 </group>;
}
