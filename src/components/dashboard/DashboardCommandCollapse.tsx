"use client";

import { useEffect } from "react";

/**
 * Keeps the daily command center glanceable on the dashboard.
 * The emergency console remains outside this behavior and is always visible.
 * Share/customization panels stay directly below their toolbar controls and
 * above the smart command cards, so opening them does not feel disconnected.
 */
export function DashboardCommandCollapse(){
  useEffect(()=>{
    const placeCommandLayer=()=>{
      const dashboard=document.querySelector<HTMLElement>(".progressive-dashboard");
      const mount=document.getElementById("aqua-command-layer-mount");
      const moduleGrid=dashboard?.querySelector<HTMLElement>(".pd-module-grid");
      if(!dashboard||!mount||!moduleGrid)return;
      // React may insert Share/Customize after the portal mount. Keep the
      // command layer immediately before the normal module grid so those
      // temporary panels always remain above Emergency/Today.
      if(mount.nextElementSibling!==moduleGrid)dashboard.insertBefore(mount,moduleGrid);
    };

    const bind=(panel:HTMLElement)=>{
      if(panel.dataset.aquaCollapsible==="1")return;
      const head=panel.querySelector<HTMLElement>(".command-head");
      if(!head)return;

      panel.dataset.aquaCollapsible="1";
      panel.classList.add("aqua-command-collapsed");
      head.setAttribute("role","button");
      head.setAttribute("tabindex","0");
      head.setAttribute("aria-expanded","false");

      const toggle=()=>{
        const opening=panel.classList.contains("aqua-command-collapsed");
        panel.classList.toggle("aqua-command-collapsed",!opening);
        panel.classList.toggle("aqua-command-expanded",opening);
        head.setAttribute("aria-expanded",String(opening));
      };
      const onKey=(event:KeyboardEvent)=>{
        if(event.key!=="Enter"&&event.key!==" ")return;
        event.preventDefault();
        toggle();
      };
      head.addEventListener("click",toggle);
      head.addEventListener("keydown",onKey);
    };

    const scan=()=>{
      placeCommandLayer();
      document.querySelectorAll<HTMLElement>(".aqua-command-center").forEach(bind);
    };
    scan();
    const observer=new MutationObserver(scan);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  return <style jsx global>{`
    .aqua-command-center[data-aqua-collapsible="1"]{transition:border-color .18s ease,box-shadow .18s ease}
    .aqua-command-center[data-aqua-collapsible="1"] .command-head{cursor:pointer;position:relative;outline:none;border-radius:12px}
    .aqua-command-center[data-aqua-collapsible="1"] .command-head:focus-visible{box-shadow:0 0 0 2px rgba(83,218,255,.45)}
    .aqua-command-center[data-aqua-collapsible="1"] .command-head:after{content:"−";width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);font-size:19px;font-weight:900;line-height:1;color:#aeefff;margin-inline-start:7px}
    .aqua-command-center.aqua-command-collapsed{padding:12px 14px!important;overflow:hidden}
    .aqua-command-center.aqua-command-collapsed .command-head:after{content:"+"}
    .aqua-command-center.aqua-command-collapsed .command-grid,
    .aqua-command-center.aqua-command-collapsed .quick-log,
    .aqua-command-center.aqua-command-collapsed .quick-note,
    .aqua-command-center.aqua-command-collapsed .smart-followup{display:none!important}
    .aqua-command-center.aqua-command-collapsed .today-actions{margin-top:9px}
    .aqua-command-center.aqua-command-collapsed .today-actions>*:not(:first-child){display:none!important}
    .aqua-command-center.aqua-command-collapsed .today-actions button,
    .aqua-command-center.aqua-command-collapsed .today-clear{min-height:48px;padding:9px 11px}
    .aqua-command-center.aqua-command-expanded{border-color:rgba(83,218,255,.22)!important;box-shadow:0 14px 34px rgba(0,0,0,.16)}
    @media(max-width:760px){
      .aqua-command-center.aqua-command-collapsed{padding:11px 12px!important}
      .aqua-command-center[data-aqua-collapsible="1"] .command-head{gap:8px;align-items:center}
      .aqua-command-center[data-aqua-collapsible="1"] .command-head:after{width:26px;height:26px;flex-basis:26px;font-size:18px;margin-inline-start:2px}
      .aqua-command-center.aqua-command-collapsed .command-head h3{font-size:18px;margin-top:2px}
      .aqua-command-center.aqua-command-collapsed .today-actions button{font-size:12px}
    }
  `}</style>;
}
