"use client";
import { useEffect } from "react";

export function PWARegister() {
  useEffect(()=>{
    if(process.env.NODE_ENV!=="production"||!("serviceWorker" in navigator)) return;

    let registration:ServiceWorkerRegistration|undefined;
    let applying=false;

    const activateWaiting=()=>{
      const waiting=registration?.waiting;
      if(!waiting)return;
      // Do not reload an active workflow. Activating the new worker is safe;
      // the current React session keeps running and the newest shell is used
      // automatically on the next user-driven launch/navigation.
      waiting.postMessage({type:"SKIP_WAITING"});
    };
    const checkForUpdate=()=>registration?.update().then(activateWaiting).catch(()=>{});

    navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(reg=>{
      registration=reg;
      activateWaiting();
      reg.addEventListener("updatefound",()=>{
        const worker=reg.installing;
        worker?.addEventListener("statechange",()=>{
          if(worker.state==="installed"&&navigator.serviceWorker.controller)activateWaiting();
        });
      });
      checkForUpdate();
    }).catch(()=>{});

    const onControllerChange=()=>{
      if(applying)return;
      applying=true;
      // Deliberately no forced reload: acclimation timers/forms remain intact.
      // The next cold launch is already controlled by the newest worker.
    };
    const onVisible=()=>{if(document.visibilityState==="visible")checkForUpdate();};
    navigator.serviceWorker.addEventListener("controllerchange",onControllerChange);
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("focus",checkForUpdate);
    window.addEventListener("online",checkForUpdate);

    return()=>{
      navigator.serviceWorker.removeEventListener("controllerchange",onControllerChange);
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("focus",checkForUpdate);
      window.removeEventListener("online",checkForUpdate);
    };
  },[]);
  return null;
}
