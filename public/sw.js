const CACHE_NAME="aqua-nexus-pwa-v8";
const APP_SHELL=["/","/manifest.webmanifest","/aqua-nexus-icon-180.png","/aqua-nexus-icon-192.png","/aqua-nexus-icon-512.png"];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url=>{
      try{await cache.add(url);}catch{}
    }));
    await self.skipWaiting();
  })());
});

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
    renotify:Boolean(data.renotify),
    requireInteraction:Boolean(data.renotify),
    data:{url:data.url||"/"}
  });
}

self.addEventListener("message",event=>{
  const data=event.data||{};
  if(data.type==="SKIP_WAITING"){self.skipWaiting();return;}
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
    const absolute=new URL(url,self.location.origin).href;
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      if("navigate" in client){
        try{await client.navigate(absolute);}catch{}
      }
      if("focus" in client){await client.focus();return;}
    }
    if(self.clients.openWindow) await self.clients.openWindow(absolute);
  })());
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith("/api/"))return;

  if(request.mode==="navigate"){
    // App-shell first: an installed iOS PWA must paint immediately instead of
    // waiting on a slow/captive/VPN network before showing anything. Refresh
    // the shell in the background so the next launch gets the newest deploy.
    event.respondWith((async()=>{
      const cached=(await caches.match(request))||(await caches.match("/"));
      const refresh=fetch(request,{cache:"no-store"}).then(async response=>{
        if(response&&response.ok){
          const cache=await caches.open(CACHE_NAME);
          await cache.put("/",response.clone());
        }
        return response;
      }).catch(()=>null);
      if(cached){event.waitUntil(refresh);return cached;}
      return (await refresh)||Response.error();
    })());
    return;
  }

  const staticAsset=url.pathname.startsWith("/_next/static/")
    ||url.pathname.startsWith("/icons/")
    ||url.pathname.endsWith(".webmanifest")
    ||url.pathname.endsWith(".css")
    ||url.pathname.endsWith(".js")
    ||url.pathname.endsWith(".woff2");

  if(staticAsset){
    event.respondWith((async()=>{
      const cached=await caches.match(request);
      if(cached)return cached;
      try{
        const response=await fetch(request);
        if(response&&response.ok){
          const cache=await caches.open(CACHE_NAME);
          cache.put(request,response.clone()).catch(()=>{});
        }
        return response;
      }catch{
        return Response.error();
      }
    })());
  }
});
