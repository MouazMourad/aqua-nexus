"use client";

import { useEffect,useRef } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { externalizeTankPhotos,photoNeedsExternalization } from "@/lib/photoStorage";

/**
 * One-time/lazy storage migration for older builds that kept full image data
 * inside Zustand/localStorage. It is intentionally silent and lossless:
 * the full image is written to IndexedDB first, then the tank state is replaced
 * with a small preview + asset reference.
 */
export function PhotoStorageBridge(){
  const tanks=useAquaStore(s=>s.tanks);
  const patch=useAquaStore(s=>s.patchTank);
  const running=useRef(false);

  useEffect(()=>{
    if(running.current)return;
    const candidates=tanks.filter(t=>t.photos.some(photoNeedsExternalization));
    if(!candidates.length)return;
    running.current=true;
    let cancelled=false;
    (async()=>{
      try{
        for(const tank of candidates){
          const compact=await externalizeTankPhotos(tank);
          if(cancelled)break;
          if(compact!==tank)patch(tank.id,t=>({...t,photos:compact.photos}));
        }
      }finally{running.current=false;}
    })();
    return()=>{cancelled=true};
  },[tanks,patch]);

  return null;
}
