import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export async function showCriticalAquariumNotification(title:string,body:string,tag:string){
  if(typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted")return false;
  try{
    if("serviceWorker" in navigator){
      const registration=await navigator.serviceWorker.ready;
      await registration.showNotification(title,{body,tag,renotify:true,requireInteraction:true,data:{url:"/"}} as NotificationOptions);
      return true;
    }
  }catch{}
  try{new Notification(title,{body,tag});return true;}catch{return false;}
}

export type NativeAlarmRequest={id:string;fireAt:number;title:string;body:string;url?:string};

function nativeId(id:string){
  let hash=0;
  for(let i=0;i<id.length;i++)hash=((hash<<5)-hash+id.charCodeAt(i))|0;
  return Math.max(1,Math.abs(hash));
}

async function ensureNativePermission(){
  const current=await LocalNotifications.checkPermissions();
  if(current.display==="granted")return true;
  const requested=await LocalNotifications.requestPermissions();
  return requested.display==="granted";
}

export async function scheduleNativeLocalAlarm(request:NativeAlarmRequest){
  if(typeof window==="undefined"||!Capacitor.isNativePlatform())return false;
  try{
    if(!(await ensureNativePermission()))return false;
    await LocalNotifications.schedule({notifications:[{
      id:nativeId(request.id),
      title:request.title,
      body:request.body,
      schedule:{at:new Date(request.fireAt),allowWhileIdle:true},
      extra:{alarmKey:request.id,url:request.url||"/"}
    }]});
    return true;
  }catch{return false;}
}

export async function cancelNativeLocalAlarm(id:string){
  if(typeof window==="undefined"||!Capacitor.isNativePlatform())return false;
  try{await LocalNotifications.cancel({notifications:[{id:nativeId(id)}]});return true;}catch{return false;}
}

export function hasNativeLocalAlarmSupport(){
  return typeof window!=="undefined"&&Capacitor.isNativePlatform();
}
