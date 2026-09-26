"use client";
import {Canvas,useFrame} from "@react-three/fiber";
import {Environment,Float,Sparkles} from "@react-three/drei";
import {Bloom,DepthOfField,EffectComposer,Vignette} from "@react-three/postprocessing";
import * as THREE from "three";
import {useMemo,useRef} from "react";

const TAU=Math.PI*2;
function Fish(){
 const g=useRef<THREE.Group>(null), tail=useRef<THREE.Mesh>(null);
 const pts=useMemo(()=>{const a:number[]=[];for(let i=0;i<2600;i++){const x=(Math.random()-.5)*3.7;const q=x/1.85;const profile=Math.sqrt(Math.max(.02,1-q*q));const th=Math.random()*TAU;const r=Math.sqrt(Math.random())*profile;a.push(x,Math.cos(th)*r*.9,Math.sin(th)*r*.58)}return new Float32Array(a)},[]);
 useFrame(({clock})=>{const t=clock.elapsedTime;if(g.current){g.current.position.set(Math.sin(t*.34)*1.35,.25+Math.sin(t*.8)*.18,Math.sin(t*.28)*1.1);g.current.rotation.y=-.35+Math.sin(t*.42)*.38;g.current.rotation.z=Math.sin(t*.7)*.035}if(tail.current)tail.current.rotation.y=Math.sin(t*4.2)*.3});
 return <Float speed={1.2} floatIntensity={.18} rotationIntensity={.04}><group ref={g}>
  <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[pts,3]}/></bufferGeometry><pointsMaterial size={.026} color="#8df7ff" transparent opacity={.94} depthWrite={false} blending={THREE.AdditiveBlending}/></points>
  <mesh ref={tail} position={[-2.15,0,0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[.95,1.45,3]}/><meshStandardMaterial color="#0aaed0" emissive="#067d9c" emissiveIntensity={2} transparent opacity={.48} side={THREE.DoubleSide}/></mesh>
  <mesh position={[1.48,.25,.42]}><sphereGeometry args={[.075,24,24]}/><meshBasicMaterial color="#fff"/></mesh>
 </group></Float>
}
function Kelp({x,z,s=1}:{x:number,z:number,s?:number}){
 const g=useRef<THREE.Group>(null);useFrame(({clock})=>{if(g.current)g.current.rotation.z=Math.sin(clock.elapsedTime*1.1+x)*.08});
 return <group ref={g} position={[x,-2.45,z]} scale={s}>{[0,.22,-.22].map((o,i)=><mesh key={i} position={[o,1,0]} rotation={[0,0,o]}><cylinderGeometry args={[.035,.09,2.2,7]}/><meshStandardMaterial color={i===1?"#2ce1a0":"#087a67"} roughness={.5} emissive="#063f35" emissiveIntensity={.8}/></mesh>)}</group>
}
function Reef(){
 return <group position={[3,-2.15,-2]}>{[[-.7,0,.3],[0,0,0],[.65,.1,.25],[.25,.25,-.45]].map((p,i)=><mesh key={i} position={p as [number,number,number]} scale={.45+i*.09}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color={i%2?"#c833a1":"#ff765e"} roughness={.72} emissive={i%2?"#4a0b39":"#5c1910"} emissiveIntensity={.7}/></mesh>)}</group>
}
function Seabed(){
 const m=useRef<THREE.Mesh>(null);useFrame(({clock})=>{if(m.current)m.current.rotation.z=Math.sin(clock.elapsedTime*.18)*.01});
 return <mesh ref={m} position={[0,-2.55,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[45,45,90,90]}/><meshPhysicalMaterial color="#042733" roughness={.3} metalness={.08} transparent opacity={.86}/></mesh>
}
function Bubbles(){
 const p=useRef<THREE.Points>(null);const pos=useMemo(()=>{const a:number[]=[];for(let i=0;i<600;i++)a.push((Math.random()-.5)*16,Math.random()*9-4,(Math.random()-.5)*12);return new Float32Array(a)},[]);
 useFrame(({clock})=>{if(p.current){p.current.position.y=(clock.elapsedTime*.13)%1;p.current.rotation.y=clock.elapsedTime*.015}});
 return <points ref={p}><bufferGeometry><bufferAttribute attach="attributes-position" args={[pos,3]}/></bufferGeometry><pointsMaterial size={.018} color="#b9f9ff" transparent opacity={.32} depthWrite={false}/></points>
}
function LightRays(){
 return <group position={[0,4,-4]} rotation={[0,0,.08]}>{[-3,-1.5,0,1.5,3].map((x,i)=><mesh key={x} position={[x,0,0]} rotation={[0,0,(i-2)*.035]}><coneGeometry args={[1.1,10,20,1,true]}/><meshBasicMaterial color="#53dff5" transparent opacity={.018} side={THREE.DoubleSide} depthWrite={false}/></mesh>)}</group>
}
function CameraRig(){
 useFrame(({camera,clock})=>{const t=clock.elapsedTime;const phase=(t%18)/18;let x,y,z;
 if(phase<.28){const p=phase/.28;x=-7+4.8*p;y=1.8-.9*p;z=10-3.8*p}
 else if(phase<.58){const p=(phase-.28)/.30;x=-2.2+5.6*p;y=.9+Math.sin(p*Math.PI)*.8;z=6.2-4.4*p}
 else if(phase<.82){const p=(phase-.58)/.24;x=3.4-1.4*p;y=1.0-.8*p;z=1.8-3.8*p}
 else{const p=(phase-.82)/.18;x=2-9*p;y=.2+1.6*p;z=-2+12*p}
 camera.position.lerp(new THREE.Vector3(x,y,z),.035);camera.lookAt(Math.sin(t*.22)*.5,-.1,0)});
 return null;
}
export default function CinematicWorld(){
 return <Canvas dpr={[1,2]} camera={{position:[-7,1.8,10],fov:46}} gl={{antialias:true,powerPreference:"high-performance",toneMapping:THREE.ACESFilmicToneMapping}} onCreated={({gl})=>{gl.toneMappingExposure=1.05}}>
  <color attach="background" args={["#00060b"]}/><fog attach="fog" args={["#001722",5,18]}/>
  <ambientLight intensity={.16}/><directionalLight position={[1,7,5]} color="#a8f8ff" intensity={2.2}/><pointLight position={[2,2,2]} color="#39dfff" intensity={38} distance={13}/><pointLight position={[-4,-1,-2]} color="#0a5fff" intensity={26} distance={10}/><pointLight position={[4,-1,-3]} color="#4dffbd" intensity={18} distance={9}/>
  <Environment preset="night"/><LightRays/><Seabed/><Bubbles/><Sparkles count={170} scale={[13,8,10]} size={1.4} speed={.18} opacity={.24}/>
  <Kelp x={-5} z={-2} s={1.35}/><Kelp x={-3.8} z={2.1} s={.85}/><Kelp x={4.8} z={1.5} s={1.2}/><Kelp x={1.9} z={-4} s={.8}/><Reef/><Fish/><CameraRig/>
  <EffectComposer multisampling={0}><DepthOfField focusDistance={.012} focalLength={.028} bokehScale={2.1}/><Bloom luminanceThreshold={.55} mipmapBlur intensity={1.05}/><Vignette eskil={false} offset={.16} darkness={.72}/></EffectComposer>
 </Canvas>
}