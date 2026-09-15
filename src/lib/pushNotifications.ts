import type { Language, Tank } from "@/domain/types";

const VAPID_PUBLIC_KEY="BD9A5jEWZLVFsG8PGXEIZyM4OCv1H4QHOJyXTi26-AyWb8Cm-b9q0wuQZiMG4SVAdoQYsrMGu5SBPcmsxu1_c20";

function urlBase64ToUint8Array(value:string){
  const padding="=".repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=window.atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

function deviceId(){
  const key="aqua-nexus-device-id";
  let id=localStorage.getItem(key);
  if(!id){id=`device-${crypto.randomUUID?.()??Math.random().toString(36).slice(2)}-${Date.now()}`;localStorage.setItem(key,id);}
  return id;
}

export async function syncPushReminders(tanks:Tank[],language:Language,createSubscription=false){
  if(typeof window==="undefined"||!("serviceWorker" in navigator)||!("Notification" in window)) return {ok:false,reason:"unsupported"};
  if(Notification.permission!=="granted") return {ok:false,reason:"permission"};
  const registration=await navigator.serviceWorker.ready;
  if(!("PushManager" in window)||!registration.pushManager) return {ok:false,reason:"push-unsupported"};
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription&&createSubscription){
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
  }
  if(!subscription) return {ok:false,reason:"no-subscription"};
  const now=Date.now();
  const tankState=tanks.map(t=>{
    const key=`aqua-nexus-last-visit:${t.id}`;
    let lastVisit=Number(localStorage.getItem(key));
    if(!Number.isFinite(lastVisit)||lastVisit<=0){lastVisit=now;localStorage.setItem(key,String(now));}
    return {id:t.id,name:t.name,lastVisit};
  });
  const response=await fetch("/api/push/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({deviceId:deviceId(),language,subscription:subscription.toJSON(),tanks:tankState})});
  return {ok:response.ok,reason:response.ok?"ok":"server"};
}
