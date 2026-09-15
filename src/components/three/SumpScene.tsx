"use client";
import type { EquipmentKind, Tank } from "@/domain/types";
import { cm } from "@/lib/units";
import { GlassBox } from "./GlassBox";
import { WaterSurface } from "./WaterSurface";
import { EquipmentModel } from "./equipment/EquipmentModel";
import { FlowRoute } from "./FlowRoute";

const itemMap:Record<string,EquipmentKind>={filterSock:"filterSock",skimmer:"skimmer",refugium:"refugiumLight",turf:"turfScrubber",returnPump:"returnPump",heater:"heater",reactor:"reactor"};

export function sumpChamberSceneCenter(tank:Tank, chamberId:string, y=-1.05):[number,number,number] {
  const s=tank.sump,width=cm(s.dimensions.length),depth=cm(s.dimensions.width);
  const c=s.chambers.find(x=>x.id===chamberId) ?? s.chambers[0];
  if(!c)return [0,y,0];
  const cw=cm(c.length),cd=cm(c.width);
  return [-width/2+cm(c.x)+cw/2,y,-depth/2+cm(c.y)+cd/2];
}

export function SumpScene({ tank, y = -1.05 }: { tank: Tank; y?: number }) {
  if (!tank.sump.enabled) return null;
  const sump=tank.sump,width=cm(sump.dimensions.length),depth=cm(sump.dimensions.width),height=cm(sump.dimensions.height),waterY=y-height/2+cm(sump.dimensions.height*sump.operatingFillPercent/100);
  const edge=tank.type==="marine"?"#55dcea":"#58d79b";

  const flowPoints:[number,number,number][]=sump.chambers.map(c=>{
    const cw=cm(c.length),cd=cm(c.width);
    return [-width/2+cm(c.x)+cw/2,waterY-.045,-depth/2+cm(c.y)+cd*.58];
  });

  return <group>
    <GlassBox width={width} depth={depth} height={height} position={[0,y,0]} edge={edge}/>
    <WaterSurface width={width*.98} depth={depth*.98} y={waterY} freshwater={tank.type==="freshwater"}/>
    <mesh position={[0,y-height/2-.075,0]}><boxGeometry args={[width+.16,.12,depth+.16]}/><meshStandardMaterial color="#101d24" metalness={.5} roughness={.3}/></mesh>

    {sump.chambers.map((c,index)=>{
      const cw=cm(c.length),cd=cm(c.width),ch=cm(c.height),localX=-width/2+cm(c.x)+cw/2,localZ=-depth/2+cm(c.y)+cd/2;
      const eq=tank.equipment.filter(e=>e.location===`sump:${c.id}`);
      const chamberItems=(c.items||[]).map(k=>itemMap[k]).filter((k): k is EquipmentKind => Boolean(k)).filter(k=>!eq.some(e=>e.kind===k));
      return <group key={c.id} position={[localX,y,localZ]}>
        {index>0&&<mesh position={[-cw/2,0,0]}><boxGeometry args={[.018,ch,cd]}/><meshPhysicalMaterial color={edge} transparent opacity={.28}/></mesh>}
        <mesh position={[0,-ch/2+.02,0]}><boxGeometry args={[cw*.94,.035,cd*.92]}/><meshStandardMaterial color={index%2?"#102a31":"#0d242b"} roughness={.8}/></mesh>
        {[...eq.map(e=>e.kind),...chamberItems].map((kind,ii,arr)=>{
          const cols=Math.min(3,Math.max(1,arr.length)),rows=Math.ceil(arr.length/cols),col=ii%cols,row=Math.floor(ii/cols);
          const ex=cols===1?0:(col-(cols-1)/2)*Math.min(cw*.28,.15);
          const ez=rows===1?0:(row-(rows-1)/2)*Math.min(cd*.26,.14);
          const sc=Math.min(.92,Math.max(.48,cw/(.42*Math.max(1,cols/1.5))));
          return <group key={`${kind}-${ii}`} position={[ex,-height/2+.08,ez]}><EquipmentModel kind={kind} scale={sc}/></group>;
        })}
        {c.media.includes("refugium")&&<group position={[0,-height/2+.03,0]}>{Array.from({length:15},(_,i)=><mesh key={i} position={[((i%5)-2)*.055,.11+(i%3)*.055,(Math.floor(i/5)-1)*.07]}><cylinderGeometry args={[.01,.016,.22+(i%3)*.04,8]}/><meshStandardMaterial color="#48c976" roughness={.8}/></mesh>)}</group>}
      </group>;
    })}

    {flowPoints.length>1&&<FlowRoute points={flowPoints} direction="across" color={edge}/>}
  </group>;
}
