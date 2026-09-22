"use client";

import { useEffect,useState,type ReactNode } from "react";
import { useAquaStore } from "@/store/useAquaStore";

export function AdvancedSection({titleAr="إعدادات متقدمة",titleEn="Advanced",summaryAr,summaryEn,children,defaultOpen}:{
  titleAr?:string;
  titleEn?:string;
  summaryAr?:string;
  summaryEn?:string;
  children:ReactNode;
  defaultOpen?:boolean;
}){
  const lang=useAquaStore(s=>s.language);
  const experience=useAquaStore(s=>s.aquariumExperience);
  const [open,setOpen]=useState(defaultOpen??experience==="advanced");

  useEffect(()=>{
    if(defaultOpen!==undefined)return;
    if(experience==="advanced")setOpen(true);
    if(experience==="beginner")setOpen(false);
  },[experience,defaultOpen]);

  return <section className={`advanced-section ${open?"open":""}`}>
    <button type="button" className="advanced-section-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <span className="advanced-section-icon">⚙</span>
      <span className="advanced-section-copy">
        <b>{lang==="ar"?titleAr:titleEn}</b>
        {(summaryAr||summaryEn)&&<small>{lang==="ar"?summaryAr:summaryEn}</small>}
      </span>
      <span className="advanced-section-state">{open?"−":"+"}</span>
    </button>
    {open&&<div className="advanced-section-body">{children}</div>}
    <style jsx>{`
      .advanced-section{border:1px solid rgba(149,184,210,.13);border-radius:14px;background:rgba(255,255,255,.018);overflow:hidden}
      .advanced-section.open{border-color:rgba(119,180,214,.22)}
      .advanced-section-toggle{width:100%;border:0;background:transparent;color:inherit;padding:11px 12px;display:grid;grid-template-columns:30px 1fr 26px;align-items:center;gap:9px;text-align:start;cursor:pointer}
      .advanced-section-icon{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(129,166,205,.08);border:1px solid rgba(129,166,205,.13);font-size:14px}
      .advanced-section-copy{display:grid;gap:2px}.advanced-section-copy b{font-size:12px}.advanced-section-copy small{font-size:9px;line-height:1.4;opacity:.62}
      .advanced-section-state{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.05);font-weight:900}
      .advanced-section-body{padding:0 12px 12px;border-top:1px solid rgba(255,255,255,.055)}
    `}</style>
  </section>;
}
