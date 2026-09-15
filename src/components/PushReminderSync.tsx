"use client";
import { useEffect,useRef } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { syncPushReminders } from "@/lib/pushNotifications";

export function PushReminderSync(){
  const tanks=useAquaStore(s=>s.tanks),selectedTankId=useAquaStore(s=>s.selectedTankId),language=useAquaStore(s=>s.language);
  const registered=useRef(false);
  useEffect(()=>{
    let disposed=false;
    const attempt=async()=>{
      if(disposed||registered.current||typeof window==="undefined"||!("Notification" in window))return;
      if(Notification.permission!=="granted")return;
      try{
        const result=await syncPushReminders(tanks,language,true);
        if(result.ok||result.reason==="unsupported"||result.reason==="push-unsupported") registered.current=true;
      }catch{}
    };
    attempt();
    const timer=window.setInterval(attempt,2500);
    return()=>{disposed=true;window.clearInterval(timer)};
  },[tanks,selectedTankId,language]);

  useEffect(()=>{
    if(!registered.current||typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted")return;
    const timer=window.setTimeout(()=>{syncPushReminders(tanks,language,false).catch(()=>{})},700);
    return()=>window.clearTimeout(timer);
  },[tanks,selectedTankId,language]);
  return null;
}
