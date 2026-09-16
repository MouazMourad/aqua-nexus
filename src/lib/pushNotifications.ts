import type { Language, Tank } from "@/domain/types";
import { bioload,chemistryHealth,maintenanceHealth,tankHealth,tankHealthTrend } from "@/domain/health";
import { aquaWorkspaceHeaders,getAquaDeviceId } from "@/lib/anonymousWorkspace";

const VAPID_PUBLIC_KEY="BD9A5jEWZLVFsG8PGXEIZyM4OCv1H4QHOJyXTi26-AyWb8Cm-b9q0wuQZiMG4SVAdoQYsrMGu5SBPcmsxu1_c20";

function urlBase64ToUint8Array(value:string){
  const padding="=".repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=window.atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

function uint8ToBase64Url(value:ArrayBuffer|null){
  if(!value)return "";
  const bytes=new Uint8Array(value);
  let binary="";
  bytes.forEach(b=>binary+=String.fromCharCode(b));
  return window.btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

function stabilityState(t:Tank){
  const overall=tankHealth(t),chemistry=chemistryHealth(t),maintenance=maintenanceHealth(t),trend=tankHealthTrend(t),bio=bioload(t);
  const equipmentWarnings=t.equipment.filter(x=>x.status==="warning"||x.status==="service").length;
  const reasons:string[]=[];
  if(overall<80) reasons.push("health");
  if(chemistry<75) reasons.push("chemistry");
  if(maintenance<70) reasons.push("maintenance");
  if(trend==="declining") reasons.push("declining");
  if(bio.status==="danger") reasons.push("bioload");
  if(equipmentWarnings>0) reasons.push("equipment");
  return {overall,chemistry,maintenance,trend,bioload:bio.status,equipmentWarnings,unstable:reasons.length>0,reasons};
}

export async function syncPushReminders(tanks:Tank[],language:Language,createSubscription=false){
  if(typeof window==="undefined"||!("serviceWorker" in navigator)||!("Notification" in window)) return {ok:false,reason:"unsupported"};
  if(Notification.permission!=="granted") return {ok:false,reason:"permission"};
  const registration=await navigator.serviceWorker.ready;
  if(!("PushManager" in window)||!registration.pushManager) return {ok:false,reason:"push-unsupported"};
  let subscription=await registration.pushManager.getSubscription();
  if(subscription&&uint8ToBase64Url(subscription.options.applicationServerKey)!==VAPID_PUBLIC_KEY){
    await subscription.unsubscribe().catch(()=>false);
    subscription=null;
  }
  if(!subscription&&createSubscription){
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
  }
  if(!subscription) return {ok:false,reason:"no-subscription"};
  const now=Date.now();
  const tankState=tanks.map(t=>{
    const key=`aqua-nexus-last-visit:${t.id}`;
    let lastVisit=Number(localStorage.getItem(key));
    if(!Number.isFinite(lastVisit)||lastVisit<=0){lastVisit=now;localStorage.setItem(key,String(now));}
    return {id:t.id,name:t.name,lastVisit,...stabilityState(t)};
  });
  const response=await fetch("/api/push/register",{
    method:"POST",
    headers:aquaWorkspaceHeaders({"content-type":"application/json"}),
    body:JSON.stringify({deviceId:getAquaDeviceId(),language,subscription:subscription.toJSON(),tanks:tankState})
  });
  return {ok:response.ok,reason:response.ok?"ok":"server"};
}
