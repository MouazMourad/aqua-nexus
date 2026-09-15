"use client";
import { useState } from "react";
import type { Tank } from "@/domain/types";
import { EMERGENCY_SCENARIOS } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
export function EmergencyPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),entries=Object.entries(EMERGENCY_SCENARIOS as any).filter(([,x]:any)=>!x.types||x.types.includes(tank.type)),[selected,setSelected]=useState(entries[0]?.[0]??"");
 const e:any=(EMERGENCY_SCENARIOS as any)[selected];
 return <section className="page-grid"><PageHeader eyebrow="EMERGENCY RESPONSE" title={tr(lang,"emergency")}/>
 <div className="card panel"><div className="emergency-list">{entries.map(([k,x]:any)=><button type="button" className={`emergency-card ${selected===k?"selected":""}`} key={k} onClick={()=>setSelected(k)}><b>{lang==="ar"?x.ar:x.en}</b><span className={`status ${x.priority==="critical"?"warn":""}`}>{x.priority}</span><small>{lang==="ar"?x.summaryAr:x.summaryEn}</small></button>)}</div></div>
 <div className="card panel">{e&&<><div className="kpi-row"><h3>{lang==="ar"?e.ar:e.en}</h3><span className="status warn">{e.priority}</span></div><p className="note">{lang==="ar"?e.summaryAr:e.summaryEn}</p><ol className="response-steps">{(lang==="ar"?e.stepsAr:e.stepsEn).map((s:string,i:number)=><li key={i}>{s}</li>)}</ol><div className="inline-alert warn"><b>{tr(lang,"avoid")}:</b> {lang==="ar"?e.avoidAr:e.avoidEn}</div></>}</div>
 </section>;
}
