"use client";

import { useEffect,useRef,useState } from "react";
import { tr } from "@/i18n";
import type { Language } from "@/domain/types";
import { GlobalHelpButton,PageHelpButton } from "@/components/help/HelpCenter";

export type AppPage =
  | "dashboard" | "tanks" | "equipment" | "sump" | "livestock" | "acclimation" | "library"
  | "chemistry" | "maintenance" | "inventory" | "diseases" | "timeline"
  | "journal" | "waterchange" | "feeding" | "dosing" | "quarantine"
  | "emergency" | "rodi" | "expenses" | "alerts" | "reports" | "settings";

const items: { key: AppPage; label: string; icon: string; color:string }[] = [
  {key:"dashboard",label:"dashboard",icon:"⌂",color:"#55e8ff"},
  {key:"tanks",label:"tanks",icon:"▣",color:"#55b8ff"},
  {key:"equipment",label:"equipment",icon:"⚙",color:"#8b8cff"},
  {key:"sump",label:"sump",icon:"▤",color:"#3ed2c0"},
  {key:"livestock",label:"livestock",icon:"◉",color:"#ffb44d"},
  {key:"acclimation",label:"acclimation",icon:"⇄",color:"#ff7fc5"},
  {key:"library",label:"library",icon:"◇",color:"#b68cff"},
  {key:"chemistry",label:"chemistry",icon:"◌",color:"#54e5a9"},
  {key:"maintenance",label:"maintenance",icon:"✓",color:"#77da68"},
  {key:"inventory",label:"inventory",icon:"▦",color:"#dfc857"},
  {key:"diseases",label:"diseases",icon:"✚",color:"#ff7777"},
  {key:"timeline",label:"timeline",icon:"↺",color:"#76b8ff"},
  {key:"journal",label:"journal",icon:"▧",color:"#ec8cff"},
  {key:"waterchange",label:"waterChange",icon:"≈",color:"#4ddaf3"},
  {key:"feeding",label:"feeding",icon:"⋯",color:"#ffac6e"},
  {key:"dosing",label:"dosing",icon:"滴",color:"#56d7ff"},
  {key:"quarantine",label:"quarantine",icon:"⊞",color:"#f0cf5b"},
  {key:"emergency",label:"emergency",icon:"!",color:"#ff5f6d"},
  {key:"rodi",label:"rodi",icon:"◫",color:"#75f2e0"},
  {key:"expenses",label:"expenses",icon:"$",color:"#8ee56d"},
  {key:"alerts",label:"alerts",icon:"△",color:"#ff8c57"},
  {key:"reports",label:"reports",icon:"▥",color:"#9da6ff"},
  {key:"settings",label:"settings",icon:"⚙",color:"#c0d5df"}
];

function dockScale(index:number,hoverIndex:number|null){
  if(hoverIndex===null)return 1;
  const distance=Math.abs(index-hoverIndex);
  if(distance===0)return 1.55;
  if(distance===1)return 1.30;
  if(distance===2)return 1.13;
  return 1;
}

export function MainNav({active,onChange,lang}:{active:AppPage;onChange:(p:AppPage)=>void;lang:Language}) {
  const viewport=useRef<HTMLDivElement>(null);
  const [hoverIndex,setHoverIndex]=useState<number|null>(null);
  const move=(dir:-1|1)=>viewport.current?.scrollBy({left:dir*420,behavior:"smooth"});

  useEffect(()=>{
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("aqua:page",{detail:active}));
  },[active]);

  return <div className="nav-zone">
    <div className="nav-help-row">
      <PageHelpButton page={active}/>
      <GlobalHelpButton lang={lang}/>
    </div>
    <div className="dock-shell">
      <button type="button" className="dock-arrow dock-arrow-left" aria-label="Previous modules" onClick={()=>move(-1)}>‹</button>
      <div className="dock-viewport" ref={viewport} dir="ltr">
        <nav className="main-nav full-modules-nav mac-dock" onMouseLeave={()=>setHoverIndex(null)}>
          {items.map((item,index)=>{
            const scale=dockScale(index,hoverIndex);
            return <button type="button" data-aqua-page={item.key} key={item.key} className={`nav-item dock-item ${active===item.key?"active":""}`} style={{"--dock-scale":scale,"--dock-color":item.color} as React.CSSProperties} onMouseEnter={()=>setHoverIndex(index)} onFocus={()=>setHoverIndex(index)} onBlur={()=>setHoverIndex(null)} onClick={(e)=>{e.preventDefault();e.stopPropagation();onChange(item.key)}}>
              <span className="nav-icon">{item.icon}</span>
              <span className="dock-label" dir={lang==="ar"?"rtl":"ltr"}>{tr(lang,item.label)}</span>
            </button>;
          })}
        </nav>
      </div>
      <button type="button" className="dock-arrow dock-arrow-right" aria-label="Next modules" onClick={()=>move(1)}>›</button>
    </div>
  </div>;
}