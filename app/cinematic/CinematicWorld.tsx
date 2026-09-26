"use client";
import {Canvas,useFrame} from "@react-three/fiber";
import {Float,Stars} from "@react-three/drei";
import * as THREE from "three";
import {useMemo,useRef} from "react";

function Water(){
 const ref=useRef<THREE.Mesh>(null);
 useFrame(({clock})=>{if(ref.current){ref.current.rotation.z=Math.sin(clock.elapsedTime*.12)*.03;ref.current.position.y=-2.25+Math.sin(clock.elapsedTime*.4)*.04}});
 return <mesh ref={ref} rotation={[-Math.PI/2,0,0]} position={[0,-2.25,0]}>
  <planeGeometry args={[40,40,80,80]}/><meshStandardMaterial color="#063c52" roughness={.18} metalness={.12} transparent opacity={.72}/>
 </mesh>
}
function DataFish(){
 const group=useRef<THREE.Group>(null);
 const pts=useMemo(()=>{const a=[] as number[];for(let i=0;i<1200;i++){const x=(Math.random()-.5)*3.2;const profile=Math.max(.08,1-Math.pow(x/1.7,2));const ang=Math.random()*Math.PI*2;const r=Math.sqrt(Math.random())*profile*.82;a.push(x,Math.cos(ang)*r,Math.sin(ang)*r*.52)}return new Float32Array(a)},[]);
 useFrame(({clock})=>{if(group.current){const t=clock.elapsedTime;group.current.position.x=Math.sin(t*.28)*2.2;group.current.position.y=.25+Math.sin(t*.7)*.18;group.current.rotation.y=-.18+Math.sin(t*.35)*.22}});
 return <Float speed={1.1} rotationIntensity={.12} floatIntensity={.25}><group ref={group} position={[-1,.2,0]}>
  <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[pts,3]}/></bufferGeometry><pointsMaterial size={.035} color="#69efff" transparent opacity={.92} depthWrite={false}/></points>
  <mesh position={[1.25,.16,.28]}><sphereGeometry args={[.08,20,20]}/><meshBasicMaterial color="white"/></mesh>
  <mesh position={[-1.75,0,0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[.82,1.25,3]}/><meshStandardMaterial color="#19bfe0" transparent opacity={.34} emissive="#087f9d" emissiveIntensity={1.5}/></mesh>
 </group></Float>
}
function Life(){
 const group=useRef<THREE.Group>(null);
 useFrame(({clock})=>{if(group.current)group.current.rotation.y=Math.sin(clock.elapsedTime*.22)*.12});
 return <group ref={group} position={[2.5,-2.05,-1]}>
  {[-1.1,-.55,0,.55,1.05].map((x,i)=><mesh key={x} position={[x,.65+(i%2)*.25,0]} rotation={[0,0,(i-2)*.13]}><cylinderGeometry args={[.035,.09,1.7+(i%2)*.5,8]}/><meshStandardMaterial color="#31d99b" emissive="#0b5c46" emissiveIntensity={.8}/></mesh>)}
  <mesh position={[0,.2,.2]}><dodecahedronGeometry args={[.75,1]}/><meshStandardMaterial color="#d93aa9" emissive="#6d164f" emissiveIntensity={.9} roughness={.65}/></mesh>
 </group>
}
function Trail(){
 const ref=useRef<THREE.Points>(null);
 const p=useMemo(()=>{const a=[] as number[];for(let i=0;i<450;i++){const x=-7+i/42;a.push(x,-.15+Math.sin(i*.08)*.08,(Math.random()-.5)*.16)}return new Float32Array(a)},[]);
 useFrame(({clock})=>{if(ref.current)ref.current.rotation.z=Math.sin(clock.elapsedTime*.25)*.015});
 return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[p,3]}/></bufferGeometry><pointsMaterial size={.025} color="#38dfff" transparent opacity={.55} depthWrite={false}/></points>
}
function CameraRig(){
 useFrame(({camera,clock})=>{const t=clock.elapsedTime;camera.position.x=Math.sin(t*.08)*.45;camera.position.y=.45+Math.sin(t*.1)*.15;camera.position.z=8.2-Math.min(t*.025,.7);camera.lookAt(0,-.1,0)});
 return null;
}
export default function CinematicWorld(){
 return <Canvas dpr={[1,1.7]} camera={{position:[0,.5,8.2],fov:48}} gl={{antialias:true,alpha:false,powerPreference:"high-performance"}}>
  <color attach="background" args={["#000307"]}/><fog attach="fog" args={["#00111b",7,22]}/>
  <ambientLight intensity={.22}/><pointLight position={[2,4,4]} color="#65efff" intensity={35} distance={14}/><pointLight position={[-4,-1,1]} color="#176cff" intensity={18} distance={10}/><pointLight position={[4,-1,-2]} color="#3dffc0" intensity={12} distance={8}/>
  <Stars radius={35} depth={18} count={1200} factor={1.4} saturation={.4} fade speed={.25}/><Water/><Trail/><DataFish/><Life/><CameraRig/>
 </Canvas>
}