export async function showCriticalAquariumNotification(title:string,body:string,tag:string){
  if(typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted")return false;
  try{
    if("serviceWorker" in navigator){
      const registration=await navigator.serviceWorker.ready;
      await registration.showNotification(title,{
        body,tag,renotify:true,requireInteraction:true,
        icon:"/icons/icon-192.png",
        badge:"/icons/icon-192.png",
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
