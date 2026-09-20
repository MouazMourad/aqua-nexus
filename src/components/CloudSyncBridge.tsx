"use client";

import { useCallback,useEffect,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { backendHealth,backupTanks } from "@/lib/cloudSync";

export function CloudSyncBridge(){
  const tanks=useAquaStore(s=>s.tanks);
  const lang=useAquaStore(s=>s.language);
  const [enabled,setEnabled]=useState(false);
  const [syncState,setSyncState]=useState<"idle"|"saving"|"ok"|"error">("idle");
  const [error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    backendHealth()
      .then(x=>{if(!cancelled&&x.database==="ready")setEnabled(true);})
      .catch(()=>{/* Local-first mode stays silent when cloud backend is unavailable. */});
    return()=>{cancelled=true};
  },[]);

  const runBackup=useCallback(async()=>{
    if(!enabled)return;
    setSyncState("saving");setError("");
    try{
      await backupTanks(tanks);
      setSyncState("ok");
    }catch(e){
      const message=e instanceof Error?e.message:"Cloud backup failed";
      setError(message);setSyncState("error");
    }
  },[enabled,tanks]);

  useEffect(()=>{
    if(!enabled)return;
    const timer=window.setTimeout(()=>{void runBackup()},2500);
    return()=>window.clearTimeout(timer);
  },[enabled,tanks,runBackup]);

  if(syncState!=="error")return null;
  return <aside className="cloud-sync-error" role="alert" dir={lang==="ar"?"rtl":"ltr"}>
    <div><b>{lang==="ar"?"تعذر حفظ آخر تغييراتك على السحابة":"Latest cloud backup failed"}</b><small>{lang==="ar"?"بياناتك المحلية ما زالت محفوظة على هذا الجهاز.":"Your local data remains saved on this device."}</small>{error&&<small className="cloud-sync-tech">{error}</small>}</div>
    <button type="button" onClick={()=>void runBackup()}>{lang==="ar"?"إعادة المحاولة":"Retry"}</button>
    <style jsx>{`
      .cloud-sync-error{position:fixed;z-index:9999;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));max-width:min(430px,calc(100vw - 24px));display:flex;gap:12px;align-items:center;background:#201319;border:1px solid #7e3948;border-radius:14px;padding:12px 14px;box-shadow:0 10px 35px #0008;color:#fff}
      .cloud-sync-error div{display:grid;gap:3px;min-width:0}.cloud-sync-error small{opacity:.82;line-height:1.35}.cloud-sync-tech{opacity:.55!important;overflow-wrap:anywhere}.cloud-sync-error button{border:1px solid #a95b6b;background:#44212b;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;white-space:nowrap}
      @media(max-width:520px){.cloud-sync-error{right:12px;left:12px;max-width:none;align-items:flex-start}.cloud-sync-error button{padding:8px 10px}}
    `}</style>
  </aside>;
}
