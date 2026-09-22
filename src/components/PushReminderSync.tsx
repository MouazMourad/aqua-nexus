"use client";
import { useEffect,useRef,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { syncPushReminders } from "@/lib/pushNotifications";
import { bioload,chemistryHealth,maintenanceHealth,tankHealth,tankHealthTrend } from "@/domain/health";
import { activeVacation,isTankArchived } from "@/domain/tankLifecycle";
import { today } from "@/lib/appUtils";

const PROMPT_KEY="aqua-nexus-notification-prompt-v1";

function unstableTank(t:any){
  return tankHealth(t)<80||chemistryHealth(t)<75||maintenanceHealth(t)<70||tankHealthTrend(t)==="declining"||bioload(t).status==="danger"||t.equipment.some((x:any)=>x.status==="warning"||x.status==="service");
}

export function PushReminderSync(){
  const tanks=useAquaStore(s=>s.tanks),selectedTankId=useAquaStore(s=>s.selectedTankId),language=useAquaStore(s=>s.language);
  const registered=useRef(false);
  const [promptVisible,setPromptVisible]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");

  const showNotice=(text:string)=>{
    setNotice(text);
    window.setTimeout(()=>setNotice(""),4500);
  };

  const finishPrompt=(message?:string)=>{
    localStorage.setItem(PROMPT_KEY,"seen");
    setPromptVisible(false);
    if(message)showNotice(message);
  };

  useEffect(()=>{
    if(typeof window==="undefined"||!("Notification" in window))return;
    if(Notification.permission==="granted")return;
    if(localStorage.getItem(PROMPT_KEY))return;
    const timer=window.setTimeout(()=>setPromptVisible(true),900);
    return()=>window.clearTimeout(timer);
  },[]);

  useEffect(()=>{
    let disposed=false;
    const attempt=async()=>{
      if(disposed||registered.current||typeof window==="undefined"||!("Notification" in window))return;
      if(Notification.permission!=="granted")return;
      try{
        const result=await syncPushReminders(tanks,language,true);
        if(result.ok)registered.current=true;
      }catch{}
    };
    attempt();
    const timer=window.setInterval(attempt,2500);
    return()=>{disposed=true;window.clearInterval(timer)};
  },[tanks,selectedTankId,language]);

  useEffect(()=>{
    if(typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted")return;
    const unstable=tanks.filter(t=>!isTankArchived(t)).filter(t=>{
      if(!unstableTank(t))return false;
      const vacation=activeVacation(t);
      return !vacation||tankHealth(t)<60||t.equipment.some((x:any)=>x.status==="warning"||x.status==="service");
    });
    if(!unstable.length)return;
    const signature=unstable.map(t=>`${t.id}:${tankHealth(t)}:${chemistryHealth(t)}:${maintenanceHealth(t)}:${tankHealthTrend(t)}`).join("|");
    const key=`aqua-nexus-unstable:${today()}`;
    if(localStorage.getItem(key)===signature)return;
    const names=unstable.map(t=>t.name).join(language==="ar"?"، ":", ");
    navigator.serviceWorker?.ready.then(reg=>reg.active?.postMessage({
      type:"SHOW_NOTIFICATION",
      title:language==="ar"?"Aqua Nexus • الحوض غير مستقر":"Aqua Nexus • Aquarium unstable",
      body:language==="ar"?`تنبيه: ${names} يحتاج مراجعة الآن. افتح Aqua Nexus لمعرفة السبب.`:`Alert: ${names} needs review now. Open Aqua Nexus to see why.`,
      tag:"aqua-unstable-health",
      url:"/"
    })).catch(()=>{});
    localStorage.setItem(key,signature);
  },[tanks,language]);

  useEffect(()=>{
    if(!registered.current||typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted")return;
    const timer=window.setTimeout(()=>{syncPushReminders(tanks,language,false).catch(()=>{})},700);
    return()=>window.clearTimeout(timer);
  },[tanks,selectedTankId,language]);

  async function enableFromPrompt(){
    if(typeof window==="undefined")return;
    const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone=(window.matchMedia?.("(display-mode: standalone)").matches)||(navigator as Navigator & {standalone?:boolean}).standalone===true;
    if(isiOS&&!standalone){
      finishPrompt(language==="ar"?"على الآيفون أضف Aqua Nexus إلى الشاشة الرئيسية أولاً. بعدها فعّل التنبيهات من الإعدادات.":"On iPhone, add Aqua Nexus to the Home Screen first. Then enable notifications from Settings.");
      return;
    }
    if(!("Notification" in window)||!("serviceWorker" in navigator)){
      finishPrompt(language==="ar"?"التنبيهات غير مدعومة على هذا المتصفح. يمكنك مراجعة الإعدادات لاحقاً.":"Notifications are not supported in this browser. You can review Settings later.");
      return;
    }
    setBusy(true);
    const permission=await Notification.requestPermission();
    if(permission!=="granted"){
      setBusy(false);
      finishPrompt(language==="ar"?"لم يتم تفعيل التنبيهات. يمكنك تفعيلها لاحقاً من الإعدادات.":"Notifications were not enabled. You can enable them later from Settings.");
      return;
    }
    try{
      const result=await syncPushReminders(tanks,language,true);
      if(result.ok){
        registered.current=true;
        finishPrompt(language==="ar"?"تم تفعيل تنبيهات المتابعة وعدم الاستقرار.":"Follow-up and instability alerts are enabled.");
      }else{
        finishPrompt(language==="ar"?"تم السماح بالتنبيهات، ويمكن إكمال إعدادها من صفحة الإعدادات.":"Notification permission is granted; setup can be completed from Settings.");
      }
    }catch{
      finishPrompt(language==="ar"?"تعذر إكمال التفعيل الآن. جرّب لاحقاً من الإعدادات.":"Setup could not be completed now. Try again later from Settings.");
    }finally{
      setBusy(false);
    }
  }

  if(!promptVisible&&!notice)return null;

  return <div dir={language==="ar"?"rtl":"ltr"} style={{position:"fixed",top:"max(12px, env(safe-area-inset-top))",left:"50%",transform:"translateX(-50%)",zIndex:7600,width:"min(420px, calc(100vw - 24px))",pointerEvents:"none"}}>
    {promptVisible&&<div style={{pointerEvents:"auto",padding:"12px 14px",borderRadius:16,border:"1px solid rgba(80,220,235,.38)",background:"rgba(3,24,34,.96)",color:"#f3feff",boxShadow:"0 16px 42px rgba(0,0,0,.38)",backdropFilter:"blur(16px)"}}>
      <div style={{fontWeight:900,marginBottom:5}}>🔔 {language==="ar"?"تفعيل تنبيهات Aqua Nexus":"Enable Aqua Nexus alerts"}</div>
      <div style={{fontSize:12,lineHeight:1.65,opacity:.86}}>{language==="ar"?"ننبهك إذا مرّ أكثر من أسبوع بدون متابعة الحوض أو إذا أصبح وضعه غير مستقر.":"Get notified if a tank is not checked for over a week or becomes unstable."}</div>
      <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
        <button type="button" className="btn primary" onClick={enableFromPrompt} disabled={busy}>{busy?(language==="ar"?"جاري التفعيل...":"Enabling..."):(language==="ar"?"تفعيل التنبيهات":"Enable alerts")}</button>
        <button type="button" className="btn" onClick={()=>finishPrompt(language==="ar"?"يمكنك تفعيل التنبيهات لاحقاً من الإعدادات.":"You can enable notifications later from Settings.")}>{language==="ar"?"لاحقاً":"Later"}</button>
      </div>
    </div>}
    {notice&&!promptVisible&&<div style={{pointerEvents:"none",padding:"9px 12px",borderRadius:13,border:"1px solid rgba(80,210,230,.28)",background:"rgba(3,24,34,.94)",color:"#dff9ff",fontSize:11,lineHeight:1.55,boxShadow:"0 12px 34px rgba(0,0,0,.34)",textAlign:"center"}}>{notice}</div>}
  </div>;
}
