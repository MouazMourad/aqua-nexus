"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { backendHealth,backupTank,deleteCloudTank,restoreTanks } from "@/lib/cloudSync";
import { clearCloudDeleteTombstone,cloudDeleteTombstones } from "@/lib/cloudTombstones";
import type { Tank } from "@/domain/types";

function stableValue(value:unknown):unknown{
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==="object"){
    return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stableValue(v)]));
  }
  return value;
}
function signature(tank:Tank){return JSON.stringify(stableValue(tank));}

export function CloudSyncBridge(){
  const tanks=useAquaStore(s=>s.tanks);
  const lang=useAquaStore(s=>s.language);
  const [enabled,setEnabled]=useState(false);
  const [syncState,setSyncState]=useState<"idle"|"saving"|"ok"|"error">("idle");
  const [error,setError]=useState("");
  const versionsRef=useRef<Record<string,number>>({});
  const baselineRef=useRef<Map<string,string>>(new Map());
  const conflictsRef=useRef<Set<string>>(new Set());
  const initializedRef=useRef(false);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const health=await backendHealth();
        if(cancelled||health.database!=="ready")return;
        const remote=await restoreTanks();
        if(cancelled)return;
        versionsRef.current=remote.versions??{};
        const remoteById=new Map((remote.tanks??[]).map(t=>[t.id,t]));
        for(const deletedId of cloudDeleteTombstones()){
          const cloud=remoteById.get(deletedId);
          if(!cloud){clearCloudDeleteTombstone(deletedId);continue;}
          const result=await deleteCloudTank(deletedId,remote.versions?.[deletedId]);
          if(result.conflict){
            setSyncState("error");setError("CONFLICT:"+deletedId);continue;
          }
          remoteById.delete(deletedId);clearCloudDeleteTombstone(deletedId);
          delete versionsRef.current[deletedId];
        }
        const baseline=new Map<string,string>();
        const conflicts=new Set<string>();

        for(const local of tanks.filter(t=>!t.isTraining)){
          const localSig=signature(local),cloud=remoteById.get(local.id);
          if(!cloud){
            // No cloud copy exists. Leave an empty baseline so this local tank
            // is created safely on the first sync pass.
            baseline.set(local.id,"");
            continue;
          }
          const cloudSig=signature(cloud);
          baseline.set(local.id,localSig);
          if(cloudSig!==localSig)conflicts.add(local.id);
        }

        baselineRef.current=baseline;
        conflictsRef.current=conflicts;
        initializedRef.current=true;
        setEnabled(true);
        if(conflicts.size){
          setSyncState("error");
          setError("CONFLICT:"+[...conflicts].join(","));
        }
      }catch{
        // Local-first operation remains available when the optional backend is
        // unavailable. Never convert a backend failure into local data loss.
      }
    })();
    return()=>{cancelled=true};
    // Bootstrap exactly once from the local state present at application load.
    // Subsequent tank changes are handled by the versioned sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const runBackup=useCallback(async()=>{
    if(!enabled||!initializedRef.current)return;
    for(const deletedId of cloudDeleteTombstones()){
      const result=await deleteCloudTank(deletedId,versionsRef.current[deletedId]);
      if(result.conflict){conflictsRef.current.add(deletedId);setSyncState("error");setError("CONFLICT:"+deletedId);return;}
      clearCloudDeleteTombstone(deletedId);delete versionsRef.current[deletedId];baselineRef.current.delete(deletedId);conflictsRef.current.delete(deletedId);
    }
    const real=tanks.filter(t=>!t.isTraining);
    const changed=real.filter(t=>!conflictsRef.current.has(t.id)&&baselineRef.current.get(t.id)!==signature(t));
    if(!changed.length){
      if(conflictsRef.current.size){
        setSyncState("error");setError("CONFLICT:"+[...conflictsRef.current].join(","));
      }else setSyncState("ok");
      return;
    }

    setSyncState("saving");setError("");
    try{
      for(const tank of changed){
        const expected=versionsRef.current[tank.id];
        const result=await backupTank(tank,expected);
        if(result.conflict){
          conflictsRef.current.add(tank.id);
          setSyncState("error");
          setError("CONFLICT:"+tank.id);
          return;
        }
        if(typeof result.version==="number")versionsRef.current[tank.id]=result.version;
        baselineRef.current.set(tank.id,signature(tank));
      }
      setSyncState(conflictsRef.current.size?"error":"ok");
      if(conflictsRef.current.size)setError("CONFLICT:"+[...conflictsRef.current].join(","));
    }catch(e){
      const message=e instanceof Error?e.message:"Cloud backup failed";
      setError(message);setSyncState("error");
    }
  },[enabled,tanks]);

  useEffect(()=>{
    if(!enabled||!initializedRef.current)return;
    const timer=window.setTimeout(()=>{void runBackup()},2500);
    return()=>window.clearTimeout(timer);
  },[enabled,tanks,runBackup]);

  if(syncState!=="error")return null;
  const conflict=error.startsWith("CONFLICT:");
  return <aside className="cloud-sync-error" role="alert" dir={lang==="ar"?"rtl":"ltr"}>
    <div>
      <b>{conflict
        ?(lang==="ar"?"تم إيقاف المزامنة لحماية نسخة أحدث":"Sync paused to protect a newer copy")
        :(lang==="ar"?"تعذر حفظ آخر تغييراتك على السحابة":"Latest cloud backup failed")}</b>
      <small>{conflict
        ?(lang==="ar"?"نسخة الجهاز والنسخة السحابية مختلفتان. Aqua Nexus لن يكتب فوق أي نسخة تلقائياً. صدّر JSON محلياً قبل أي تسوية أو نقل لجهاز آخر.":"Local and cloud copies differ. Aqua Nexus will not overwrite either copy automatically. Export a local JSON backup before reconciling or moving devices.")
        :(lang==="ar"?"بياناتك المحلية ما زالت محفوظة على هذا الجهاز.":"Your local data remains saved on this device.")}</small>
      {!conflict&&error&&<small className="cloud-sync-tech">{error}</small>}
    </div>
    {!conflict&&<button type="button" onClick={()=>void runBackup()}>{lang==="ar"?"إعادة المحاولة":"Retry"}</button>}
    <style jsx>{`
      .cloud-sync-error{position:fixed;z-index:9999;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));max-width:min(430px,calc(100vw - 24px));display:flex;gap:12px;align-items:center;background:#201319;border:1px solid #7e3948;border-radius:14px;padding:12px 14px;box-shadow:0 10px 35px #0008;color:#fff}
      .cloud-sync-error div{display:grid;gap:3px;min-width:0}.cloud-sync-error small{opacity:.82;line-height:1.35}.cloud-sync-tech{opacity:.55!important;overflow-wrap:anywhere}.cloud-sync-error button{border:1px solid #a95b6b;background:#44212b;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;white-space:nowrap}
      @media(max-width:520px){.cloud-sync-error{right:12px;left:12px;max-width:none;align-items:flex-start}.cloud-sync-error button{padding:8px 10px}}
    `}</style>
  </aside>;
}
