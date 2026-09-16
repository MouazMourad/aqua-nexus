"use client";

import { useEffect,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { backendHealth,backupTanks } from "@/lib/cloudSync";

export function CloudSyncBridge(){
  const tanks=useAquaStore(s=>s.tanks);
  const [enabled,setEnabled]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    backendHealth().then(x=>{if(!cancelled&&x.database==="ready")setEnabled(true);}).catch(()=>{});
    return()=>{cancelled=true};
  },[]);

  useEffect(()=>{
    if(!enabled)return;
    const timer=window.setTimeout(()=>{backupTanks(tanks).catch(()=>{})},2500);
    return()=>window.clearTimeout(timer);
  },[enabled,tanks]);

  return null;
}
