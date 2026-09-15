"use client";
import { Line } from "@react-three/drei";
import type { Tank } from "@/domain/types";

function Dim({
  a,b,color="#6ce8f1"
}:{
  a:[number,number,number];b:[number,number,number];color?:string
}) {
  return <group>
    <Line points={[a,b]} color={color} lineWidth={1.2} transparent opacity={.82}/>
    <mesh position={a}><sphereGeometry args={[.018,8,8]}/><meshBasicMaterial color={color}/></mesh>
    <mesh position={b}><sphereGeometry args={[.018,8,8]}/><meshBasicMaterial color={color}/></mesh>
  </group>;
}

export function TankDimensions({
  tank,width,depth,height,displayBottom,accent
}:{
  tank:Tank;width:number;depth:number;height:number;displayBottom:number;accent:string
}) {
  const front=depth/2+.16;
  return <group>
    <Dim a={[-width/2,displayBottom-.13,front]} b={[width/2,displayBottom-.13,front]} color={accent}/>
    <Dim a={[width/2+.14,displayBottom,front]} b={[width/2+.14,displayBottom+height,front]} color={accent}/>
    <Dim a={[-width/2-.16,displayBottom-.08,-depth/2]} b={[-width/2-.16,displayBottom-.08,depth/2]} color={accent}/>
  </group>;
}
