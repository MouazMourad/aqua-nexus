export async function showCriticalAquariumNotification(title:string,body:string,tag:string){
  if(typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted")return false;
  try{
    if("serviceWorker" in navigator){
      const registration=await navigator.serviceWorker.ready;
      await registration.showNotification(title,{
        body,tag,renotify:true,requireInteraction:true,
        data:{url:"/"}
      } as NotificationOptions);
      return true;
    }
  }catch{}
  try{
    new Notification(title,{body,tag});
    return true;
  }catch{return false;}
}


export type NativeAlarmRequest={id:string;fireAt:number;title:string;body:string;url?:string};
export async function scheduleNativeLocalAlarm(request:NativeAlarmRequest){
  if(typeof window==="undefined")return false;
  const bridge=(window as any).AquaNexusNative;
  if(!bridge?.scheduleLocalNotification)return false;
  try{await bridge.scheduleLocalNotification(request);return true;}catch{return false;}
}
export async function cancelNativeLocalAlarm(id:string){
  if(typeof window==="undefined")return false;
  const bridge=(window as any).AquaNexusNative;
  if(!bridge?.cancelLocalNotification)return false;
  try{await bridge.cancelLocalNotification(id);return true;}catch{return false;}
}
export function hasNativeLocalAlarmSupport(){
  return typeof window!=="undefined"&&Boolean((window as any).AquaNexusNative?.scheduleLocalNotification);
}
