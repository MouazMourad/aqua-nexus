"use client";
import { useEffect,useRef,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { syncPushReminders } from "@/lib/pushNotifications";

export function PushReminderSync(){
  const tanks=useAquaStore(s=>s.tanks),selectedTankId=useAquaStore(s=>s.selectedTankId),language=useAquaStore(s=>s.language);
  const registered=useRef(false);
  const [state,setState]=useState<"idle"|"enabled"|"unsupported"|"install"|"denied"|"busy">("idle");
  const [note,setNote]=useState("");

  useEffect(()=>{
    if(typeof window==="undefined"||!("Notification" in window)){setState("unsupported");return;}
    if(Notification.permission==="denied"){setState("denied");return;}
    if(Notification.permission==="granted")setState("enabled");
  },[]);

  useEffect(()=>{
    let disposed=false;
    const attempt=async()=>{
      if(disposed||registered.current||typeof window==="undefined"||!("Notification" in window))return;
      if(Notification.permission!=="granted")return;
      try{
        const result=await syncPushReminders(tanks,language,true);
        if(result.ok){registered.current=true;setState("enabled");}
        else if(result.reason==="unsupported"||result.reason==="push-unsupported")setState("unsupported");
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

  async function enable(){
    if(typeof window==="undefined")return;
    const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone=(window.matchMedia?.("(display-mode: standalone)").matches)||(navigator as Navigator & {standalone?:boolean}).standalone===true;
    if(isiOS&&!standalone){
      setState("install");
      setNote(language==="ar"?"على الآيفون: أضف Aqua Nexus إلى الشاشة الرئيسية أولاً، ثم فعّل التنبيهات من داخل التطبيق.":"On iPhone, add Aqua Nexus to the Home Screen first, then enable notifications inside the app.");
      return;
    }
    if(!("Notification" in window)||!("serviceWorker" in navigator)){
      setState("unsupported");
      setNote(language==="ar"?"التنبيهات غير مدعومة على هذا المتصفح.":"Notifications are not supported in this browser.");
      return;
    }
    setState("busy");
    const permission=await Notification.requestPermission();
    if(permission!=="granted"){
      setState(permission==="denied"?"denied":"idle");
      setNote(language==="ar"?"لم يتم السماح بالتنبيهات.":"Notification permission was not granted.");
      return;
    }
    try{
      const result=await syncPushReminders(tanks,language,true);
      if(result.ok){
        registered.current=true;
        setState("enabled");
        setNote(language==="ar"?"تم تفعيل تنبيه المتابعة الأسبوعية حتى لو كان التطبيق مغلقاً.":"Weekly follow-up push notifications are enabled, even when the app is closed.");
      }else{
        setState("unsupported");
        setNote(language==="ar"?"تعذر تفعيل Web Push على هذا الجهاز.":"Web Push could not be enabled on this device.");
      }
    }catch{
      setState("unsupported");
      setNote(language==="ar"?"تعذر تسجيل تنبيهات الهاتف حالياً.":"Phone notification registration failed.");
    }
  }

  const label=state==="enabled"?(language==="ar"?"التنبيهات مفعّلة":"Alerts on"):(language==="ar"?"تفعيل تنبيهات المتابعة":"Enable follow-up alerts");
  return <div dir={language==="ar"?"rtl":"ltr"} style={{position:"fixed",left:12,bottom:"max(16px, env(safe-area-inset-bottom))",zIndex:7200,display:"grid",gap:7,maxWidth:"min(310px, calc(100vw - 24px))",justifyItems:"start",pointerEvents:"none"}}>
    {note&&<div style={{pointerEvents:"auto",padding:"8px 10px",borderRadius:12,border:"1px solid rgba(80,210,230,.28)",background:"rgba(3,24,34,.94)",color:"#dff9ff",fontSize:10,lineHeight:1.55,boxShadow:"0 12px 34px rgba(0,0,0,.34)"}}>{note}</div>}
    <button type="button" onClick={enable} disabled={state==="busy"||state==="enabled"} style={{pointerEvents:"auto",minHeight:42,padding:"8px 12px",borderRadius:14,border:"1px solid rgba(80,220,235,.38)",background:state==="enabled"?"rgba(20,120,90,.88)":"rgba(5,40,54,.92)",color:"#f3feff",fontWeight:800,boxShadow:"0 10px 30px rgba(0,0,0,.3)",backdropFilter:"blur(14px)",opacity:state==="busy"?.65:1}}>{state==="enabled"?"🔔 ✓":"🔔"} {state==="busy"?(language==="ar"?"جاري التفعيل...":"Enabling..."):label}</button>
  </div>;
}
