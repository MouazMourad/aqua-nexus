"use client";
import { useEffect } from "react";

export function PWARegister() {
  useEffect(()=>{
    if(process.env.NODE_ENV!=="production"||!("serviceWorker" in navigator)) return;

    let reloading=false;
    const reloadOnControllerChange=()=>{
      if(reloading)return;
      reloading=true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange",reloadOnControllerChange);

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
      navigator.serviceWorker.removeEventListener("controllerchange",reloadOnControllerChange);
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("focus",checkForUpdate);
    };
  },[]);
  return null;
}
