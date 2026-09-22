import type { Language, Tank } from "@/domain/types";
import { systemHealth,systemHealthTrend } from "@/domain/systemHealth";
import { systemAlerts } from "@/domain/alertEngine";
import { maintenanceEffectiveState } from "@/domain/maintenanceSchedule";
import { biologicalCycleStatus } from "@/domain/biologicalCycle";
import { aquaWorkspaceHeaders,getAquaDeviceId } from "@/lib/anonymousWorkspace";
import { activeVacation,isTankArchived } from "@/domain/tankLifecycle";
import { latestMeasuredChemistryReading } from "@/domain/chemistryDataQuality";

const FALLBACK_VAPID_PUBLIC_KEY="BD9A5jEWZLVFsG8PGXEIZyM4OCv1H4QHOJyXTi26-AyWb8Cm-b9q0wuQZiMG4SVAdoQYsrMGu5SBPcmsxu1_c20";

async function vapidPublicKey(){
  try{
    const response=await fetch("/api/push/key",{cache:"no-store"});
    if(response.ok){const json=await response.json();if(json?.publicKey)return String(json.publicKey);}
  }catch{}
  return FALLBACK_VAPID_PUBLIC_KEY;
}

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
  const health=systemHealth(t),trend=systemHealthTrend(t),alerts=systemAlerts(t);
  const reasons=[...new Set(alerts.filter(x=>x.level!=="info").map(x=>x.domain))];
  return {
    overall:health.score,
    chemistry:health.chemistry,
    maintenance:health.maintenance,
    bioload:health.bioload,
    equipment:health.equipment,
    compatibility:health.compatibility,
    livestock:health.livestock,
    trend,
    equipmentWarnings:health.equipmentAudit.issues.length,
    unstable:health.score<80||alerts.some(x=>x.level==="danger"),
    critical:health.score<60||alerts.some(x=>x.level==="danger"),
    reasons
  };
}

function backgroundAlertState(t:Tank){
  const cycle=biologicalCycleStatus(t);
  const activeEmergency=(t.emergencySessions??[]).find(x=>x.status==="active");
  const activeQuarantine=t.quarantine.filter(x=>x.status==="active");
  const nextDose=[...activeQuarantine]
    .filter(x=>x.nextDoseAt)
    .sort((a,b)=>new Date(a.nextDoseAt!).getTime()-new Date(b.nextDoseAt!).getTime())[0];
  return {
    lastChemistryAt:latestMeasuredChemistryReading(t)?.timestamp??null,
    maintenanceTasks:t.maintenance.filter(x=>!maintenanceEffectiveState(x).completed).slice(0,30).map(x=>({id:x.id,title:x.title,titleEn:x.titleEn??x.title,nextDue:x.nextDue??null})),
    treatmentCount:t.livestock.filter(x=>x.health==="treatment").reduce((sum,x)=>sum+Math.max(1,x.quantity),0),
    watchCount:t.livestock.filter(x=>x.health==="watch").reduce((sum,x)=>sum+Math.max(1,x.quantity),0),
    activeQuarantineCount:activeQuarantine.length,
    activeEmergencyCount:(t.emergencySessions??[]).filter(x=>x.status==="active").length,
    emergencyTitleAr:activeEmergency?.titleAr??null,
    emergencyTitleEn:activeEmergency?.titleEn??null,
    nextDoseAt:nextDose?.nextDoseAt??null,
    doseOrganism:nextDose?.organism??null,
    cyclingActive:cycle.active,
    cycleDay:cycle.day,
    cycleReady:cycle.ready,
    cycleNextAr:cycle.active?cycle.nextAr:null,
    cycleNextEn:cycle.active?cycle.nextEn:null
  };
}

export async function syncPushReminders(tanks:Tank[],language:Language,createSubscription=false){
  if(typeof window==="undefined"||!("serviceWorker" in navigator)||!("Notification" in window)) return {ok:false,reason:"unsupported"};
  if(Notification.permission!=="granted") return {ok:false,reason:"permission"};
  const registration=await navigator.serviceWorker.ready;
  if(!("PushManager" in window)||!registration.pushManager) return {ok:false,reason:"push-unsupported"};
  const publicKey=await vapidPublicKey();
  let subscription=await registration.pushManager.getSubscription();
  if(subscription&&uint8ToBase64Url(subscription.options.applicationServerKey)!==publicKey){
    await subscription.unsubscribe().catch(()=>false);
    subscription=null;
  }
  if(!subscription&&createSubscription){
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(publicKey)});
  }
  if(!subscription) return {ok:false,reason:"no-subscription"};
  const now=Date.now();
  const tankState=tanks.filter(t=>!isTankArchived(t)).map(t=>{
    const key=`aqua-nexus-last-visit:${t.id}`;
    let lastVisit=Number(localStorage.getItem(key));
    if(!Number.isFinite(lastVisit)||lastVisit<=0){lastVisit=now;localStorage.setItem(key,String(now));}
    const vacation=activeVacation(t);
    return {id:t.id,name:t.name,lastVisit,vacationActive:Boolean(vacation),vacationPlannedEndAt:vacation?.plannedEndAt??null,...stabilityState(t),...backgroundAlertState(t)};
  });
  const response=await fetch("/api/push/register",{
    method:"POST",
    headers:aquaWorkspaceHeaders({"content-type":"application/json"}),
    body:JSON.stringify({deviceId:getAquaDeviceId(),language,subscription:subscription.toJSON(),tanks:tankState})
  });
  return {ok:response.ok,reason:response.ok?"ok":"server"};
}