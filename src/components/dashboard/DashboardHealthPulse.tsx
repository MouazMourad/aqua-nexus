"use client";

import { useEffect } from "react";
import { chemistryHealth,tankHealth } from "@/domain/health";
import { useAquaStore } from "@/store/useAquaStore";

type HealthTone="excellent"|"stable"|"watch"|"stressed"|"critical";

function toneFor(score:number):HealthTone{
  if(score>=90)return "excellent";
  if(score>=80)return "stable";
  if(score>=65)return "watch";
  if(score>=50)return "stressed";
  return "critical";
}

/**
 * Keeps the dashboard's health surfaces visually tied to live tank data.
 * It deliberately reuses the existing soft healthHeartbeat animation so the
 * pulse stays consistent with the original Aqua Nexus health language.
 */
export function DashboardHealthPulse(){
  const tanks=useAquaStore(s=>s.tanks);
  const selectedTankId=useAquaStore(s=>s.selectedTankId);
  const tank=tanks.find(t=>t.id===selectedTankId)??tanks[0];
  const health=tank?tankHealth(tank):0;
  const chemistry=tank?chemistryHealth(tank):0;

  useEffect(()=>{
    if(!tank||typeof document==="undefined")return;

    const healthTone=toneFor(health);
    const chemistryTone=toneFor(chemistry);

    const applyTone=(element:Element|null,tone:HealthTone,score:number)=>{
      if(!(element instanceof HTMLElement))return;
      element.dataset.aquaHealthTone=tone;
      element.dataset.aquaHealthScore=String(score);
    };

    const sync=()=>{
      // Current compact Tank Health score in the dashboard hero.
      document.querySelectorAll(".pd-health-score,.system-health-card").forEach(el=>applyTone(el,healthTone,health));

      // Chemistry is uniquely identified by the chemistry icon, so dashboard
      // reordering/customization never breaks the state color binding.
      document.querySelectorAll<HTMLElement>(".pd-module").forEach(card=>{
        const icon=card.querySelector<HTMLElement>(".pd-module-icon")?.textContent?.trim();
        if(icon==="⚗")applyTone(card,chemistryTone,chemistry);
      });
    };

    sync();
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[tank?.id,health,chemistry]);

  return <style jsx global>{`
    [data-aqua-health-tone="excellent"]{--health-rgb:72,224,181;--health-color:#48e0b5;--health-pulse-speed:3.7s}
    [data-aqua-health-tone="stable"]{--health-rgb:115,216,137;--health-color:#73d889;--health-pulse-speed:3.5s}
    [data-aqua-health-tone="watch"]{--health-rgb:255,200,90;--health-color:#ffc85a;--health-pulse-speed:3.1s}
    [data-aqua-health-tone="stressed"]{--health-rgb:255,138,91;--health-color:#ff8a5b;--health-pulse-speed:2.7s}
    [data-aqua-health-tone="critical"]{--health-rgb:255,95,109;--health-color:#ff5f6d;--health-pulse-speed:2.35s}

    .pd-health-score[data-aqua-health-tone],
    .pd-module[data-aqua-health-tone]{
      position:relative;
      isolation:isolate;
      border-color:rgba(var(--health-rgb),.40)!important;
      background:
        radial-gradient(circle at 82% 14%,rgba(var(--health-rgb),.19),transparent 36%),
        linear-gradient(145deg,rgba(var(--health-rgb),.105),rgba(255,255,255,.024) 54%,rgba(3,17,26,.10))!important;
      animation:healthHeartbeat var(--health-pulse-speed) ease-in-out infinite;
    }

    .pd-health-score[data-aqua-health-tone]::after,
    .pd-module[data-aqua-health-tone]::after{
      content:"";
      position:absolute;
      z-index:-1;
      width:118px;
      height:118px;
      inset-inline-end:-38px;
      top:-42px;
      border-radius:50%;
      background:rgba(var(--health-rgb),.17);
      filter:blur(28px);
      pointer-events:none;
    }

    .pd-health-score[data-aqua-health-tone] b,
    .pd-module[data-aqua-health-tone] .pd-module-copy>b{
      color:var(--health-color);
      text-shadow:0 0 18px rgba(var(--health-rgb),.16);
    }

    .pd-module[data-aqua-health-tone] .pd-module-icon{
      color:var(--health-color)!important;
      background:rgba(var(--health-rgb),.105)!important;
      border-color:rgba(var(--health-rgb),.25)!important;
      box-shadow:0 0 18px rgba(var(--health-rgb),.10);
    }

    .pd-module[data-aqua-health-tone] .pd-module-state{
      color:var(--health-color)!important;
      background:rgba(var(--health-rgb),.085)!important;
    }

    @media(prefers-reduced-motion:reduce){
      .pd-health-score[data-aqua-health-tone],
      .pd-module[data-aqua-health-tone]{animation:none!important}
    }
  `}</style>;
}
