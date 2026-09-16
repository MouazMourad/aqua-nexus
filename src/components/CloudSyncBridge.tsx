"use client";

import { useEffect,useRef } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { backendHealth,backupTanks } from "@/lib/cloudSync";

export function CloudSyncBridge(){
  const tanks=useAquaStore(s=>s.tanks);
  const ready=useRef(false);
  const signature=JSON.stringify(tanks.map(t=>[t.id,t.timeline[0]?.id,t.chemistry[0]?.timestamp,t.healthSnapshots?.[0]?.id,t.photos.length,t.equipment.length,t.livestock.length,t.maintenance.length]));

  useEffect(()=>{
    let cancelled=false;
    if(process.env.NEXT_PUBLIC_AQUA_CLOUD_SYNC!=="1")return;
    backendHealth().then(x=>{if(!cancelled&&x.database==="ready")ready.current=true;}).catch(()=>{});
    return()=>{cancelled=true};
  },[]);

  useEffect(()=>{
    if(process.env.NEXT_PUBLIC_AQUA_CLOUD_SYNC!=="1"||!ready.current)return;
    const timer=window.setTimeout(()=>{backupTanks(tanks).catch(()=>{})},2500);
    return()=>window.clearTimeout(timer);
  },[signature,tanks]);

  return null;
}
