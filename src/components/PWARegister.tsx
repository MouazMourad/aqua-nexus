"use client";
import { useEffect } from "react";

export function PWARegister() {
  useEffect(()=>{
    if(process.env.NODE_ENV!=="production"||!("serviceWorker" in navigator)) return;

    // Never force-reload an active aquarium session when a new service worker
    // takes control. Acclimation timers, forms and emergency workflows must not
    // be interrupted by an infrastructure update. The new worker can activate
    // immediately; the page will naturally load the newest shell on the next
    // user-driven navigation/reload.
    let registration:ServiceWorkerRegistration|undefined;
    const checkForUpdate=()=>registration?.update().catch(()=>{});

    navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(reg=>{
      registration=reg;
      checkForUpdate();
    }).catch(()=>{});

    const onVisible=()=>{if(document.visibilityState==="visible")checkForUpdate();};
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("focus",checkForUpdate);

    return()=>{
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("focus",checkForUpdate);
    };
  },[]);
  return null;
}
