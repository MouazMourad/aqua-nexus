const CACHE_NAME="aqua-nexus-pwa-v2";

self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("aqua-nexus")&&k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

function show(data={}){
  return self.registration.showNotification(data.title||"Aqua Nexus",{
    body:data.body||"Your aquarium needs attention.",
    tag:data.tag||"aqua-nexus-reminder",
    renotify:false,
    data:{url:data.url||"/"}
  });
}

self.addEventListener("message",event=>{
  const data=event.data||{};
  if(data.type!=="SHOW_NOTIFICATION") return;
  event.waitUntil(show(data));
});

self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch{data={body:event.data?.text?.()||"Your aquarium needs attention."};}
  event.waitUntil(show(data));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const url=event.notification.data?.url||"/";
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      if("focus" in client){await client.focus();return;}
    }
    if(self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
