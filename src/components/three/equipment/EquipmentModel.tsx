"use client";

import type { EquipmentKind } from "@/domain/types";

function Mat({ color = "#213845" }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.35} roughness={0.28} />;
}

export function EquipmentModel({ kind, scale = 1 }: { kind: EquipmentKind; scale?: number }) {
  if (kind === "skimmer") {
    return (
      <group scale={scale}>
        <mesh position={[0, .22, 0]}><cylinderGeometry args={[.12,.15,.44,28]} /><meshPhysicalMaterial color="#bcebf1" transparent opacity={.28} roughness={.1} /></mesh>
        <mesh position={[0,.49,0]}><cylinderGeometry args={[.16,.16,.12,28]} /><meshPhysicalMaterial color="#d5f6fa" transparent opacity={.35} /></mesh>
        <mesh position={[.13,.18,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.035,.035,.22,16]} /><Mat /></mesh>
      </group>
    );
  }

  if (kind === "returnPump") {
    return (
      <group scale={scale}>
        <mesh position={[0,.12,0]}><boxGeometry args={[.32,.24,.26]} /><Mat color="#172b34" /></mesh>
        <mesh position={[.2,.2,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.06,.06,.22,18]} /><Mat /></mesh>
        <mesh position={[-.05,.12,.14]}><cylinderGeometry args={[.07,.07,.2,18]} /><Mat color="#203c48" /></mesh>
      </group>
    );
  }

  if (kind === "filterSock") {
    return (
      <group scale={scale}>
        {[-.08,.08].map((x) => (
          <mesh key={x} position={[x,.18,0]}><cylinderGeometry args={[.055,.04,.34,18]} /><meshStandardMaterial color="#e7f4f5" transparent opacity={.58} roughness={.7} /></mesh>
        ))}
      </group>
    );
  }

  if (kind === "turfScrubber") {
    return (
      <group scale={scale}>
        <mesh position={[0,.22,0]}><boxGeometry args={[.3,.42,.08]} /><meshStandardMaterial color="#3d8c4f" roughness={.85} /></mesh>
        <mesh position={[0,.22,-.05]}><boxGeometry args={[.36,.48,.05]} /><Mat color="#192d34" /></mesh>
      </group>
    );
  }

  if (kind === "refugiumLight") {
    return (
      <group scale={scale}>
        <mesh position={[0,.48,0]}><boxGeometry args={[.32,.06,.16]} /><Mat color="#29364b" /></mesh>
        <pointLight position={[0,.38,0]} color="#a76cff" intensity={1.2} distance={1.4} />
      </group>
    );
  }

  if (kind === "heater") {
    return (
      <mesh scale={scale} position={[0,.22,0]}>
        <cylinderGeometry args={[.035,.035,.42,16]} />
        <meshStandardMaterial color="#ff7b5c" emissive="#7a2216" emissiveIntensity={.4} />
      </mesh>
    );
  }

  if (kind === "reactor") {
    return (
      <group scale={scale}>
        <mesh position={[0,.24,0]}><cylinderGeometry args={[.11,.11,.46,22]} /><meshPhysicalMaterial color="#b6ecf1" transparent opacity={.25} /></mesh>
        <mesh position={[0,.48,0]}><cylinderGeometry args={[.13,.13,.06,22]} /><Mat /></mesh>
      </group>
    );
  }

  if (kind === "waveMaker") {
    return (
      <group scale={scale}>
        <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.12,.12,.18,24]} /><Mat color="#111d24" /></mesh>
        <mesh position={[.11,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.08,.11,.07,24]} /><Mat color="#203744" /></mesh>
      </group>
    );
  }

  if (kind === "lighting") {
    return (
      <group scale={scale}>
        <mesh><boxGeometry args={[.8,.07,.18]} /><meshStandardMaterial color="#1d2d47" metalness={.72} roughness={.2} /></mesh>
        <mesh position={[0,-.045,0]}><boxGeometry args={[.68,.018,.12]} /><meshStandardMaterial color="#6f7fff" emissive="#5a6fff" emissiveIntensity={2.2} metalness={.15} roughness={.25} /></mesh>
      </group>
    );
  }


  if (kind === "overflow") {
    return (
      <group scale={scale}>
        <mesh position={[0,.18,0]}><boxGeometry args={[.22,.46,.16]} /><Mat color="#132a35" /></mesh>
        {Array.from({length:7},(_,i)=><mesh key={i} position={[-.075+i*.025,.34,.085]}><boxGeometry args={[.012,.09,.018]}/><meshStandardMaterial color="#55d9e7" emissive="#1d7583" emissiveIntensity={.35}/></mesh>)}
        <mesh position={[0,-.08,0]}><cylinderGeometry args={[.045,.045,.2,16]}/><Mat color="#203b46"/></mesh>
      </group>
    );
  }

  if (kind === "doser") {
    // Deliberately channel-agnostic: the 3D twin only communicates that a doser exists here.
    return (
      <group scale={scale}>
        <mesh position={[0,.14,0]}><boxGeometry args={[.38,.27,.18]} /><Mat color="#182d3a" /></mesh>
        <mesh position={[0,.14,.101]}><circleGeometry args={[.055,24]} /><meshStandardMaterial color="#49d7d5" emissive="#176f73" emissiveIntensity={.45} /></mesh>
        <mesh position={[0,.02,0]}><boxGeometry args={[.22,.025,.13]} /><Mat color="#203b46" /></mesh>
      </group>
    );
  }

  if (kind === "uv") {
    return <group scale={scale}><mesh position={[0,.18,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.055,.055,.46,20]}/><Mat color="#263946"/></mesh><mesh position={[-.18,.25,0]}><cylinderGeometry args={[.025,.025,.15,14]}/><Mat/></mesh><mesh position={[.18,.25,0]}><cylinderGeometry args={[.025,.025,.15,14]}/><Mat/></mesh></group>;
  }
  if (kind === "probe") {
    return <group scale={scale}><mesh position={[0,.20,0]}><cylinderGeometry args={[.018,.018,.40,12]}/><meshStandardMaterial color="#b8d8de" metalness={.55} roughness={.22}/></mesh><mesh position={[0,.42,0]}><cylinderGeometry args={[.035,.035,.08,12]}/><Mat color="#1d3440"/></mesh></group>;
  }
  if (kind === "ato") {
    return <group scale={scale}><mesh position={[-.06,.10,0]}><boxGeometry args={[.16,.18,.14]}/><Mat color="#172b34"/></mesh><mesh position={[.08,.26,0]}><boxGeometry args={[.035,.30,.035]}/><meshStandardMaterial color="#59d7e2" emissive="#1b6970" emissiveIntensity={.3}/></mesh></group>;
  }
  if (kind === "rollerFilter") {
    return <group scale={scale}><mesh position={[0,.20,0]}><boxGeometry args={[.30,.38,.22]}/><Mat color="#172b34"/></mesh>{[-.09,.09].map(x=><mesh key={x} position={[x,.43,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.055,.055,.08,18]}/><meshStandardMaterial color="#d7ecec" roughness={.65}/></mesh>)}</group>;
  }
  if (kind === "co2") {
    return <group scale={scale}><mesh position={[0,.22,0]}><cylinderGeometry args={[.08,.08,.42,18]}/><meshStandardMaterial color="#697b80" metalness={.7} roughness={.22}/></mesh><mesh position={[0,.46,0]}><cylinderGeometry args={[.035,.035,.07,14]}/><Mat color="#182d3a"/></mesh></group>;
  }
  if (kind === "ozone") {
    return <group scale={scale}><mesh position={[0,.16,0]}><boxGeometry args={[.30,.30,.16]}/><Mat color="#1b3040"/></mesh><mesh position={[0,.16,.085]}><torusGeometry args={[.055,.012,10,22]}/><meshStandardMaterial color="#72b7ff" emissive="#2861a0" emissiveIntensity={.5}/></mesh></group>;
  }

  return (
    <mesh scale={scale} position={[0,.12,0]}>
      <boxGeometry args={[.24,.24,.24]} />
      <Mat />
    </mesh>
  );
}
