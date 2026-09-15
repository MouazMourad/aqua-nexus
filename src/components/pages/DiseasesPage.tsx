"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { DISEASE_LIBRARY } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,categoryText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today,nowISO } from "@/lib/appUtils";

export function DiseasesPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[group,setGroup]=useState("all"),[search,setSearch]=useState(""),[added,setAdded]=useState<string|null>(null);
 const entries:any[]=DISEASE_LIBRARY.filter((x:any)=>x.type===tank.type),groups=[...new Set(entries.map(x=>x.group))];
 const filtered=useMemo(()=>entries.filter(x=>(group==="all"||x.group===group)&&(!search||`${x.ar} ${x.en} ${x.symAr} ${x.symEn}`.toLowerCase().includes(search.toLowerCase()))),[group,search,tank.type]);

 function addTreatment(x:any){
  const due=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
  patch(tank.id,t=>({...t,
   maintenance:[...t.maintenance,{id:uid("task"),title:`متابعة علاج: ${x.ar}`,titleEn:`Treatment follow-up: ${x.en}`,cadence:"once",done:false,nextDue:due,manual:true}],
   timeline:[{id:uid("ev"),timestamp:nowISO(),type:"treatment",textAr:`تم بدء متابعة علاج: ${x.ar}`,textEn:`Treatment follow-up started: ${x.en}`},...t.timeline]
  }));
  setAdded(x.id);setTimeout(()=>setAdded(null),1800);
 }

 return <section className="page-grid"><PageHeader eyebrow="DISEASES & TREATMENT" title={tr(lang,"diseases")}/>
 <div className="filter-bar full-span"><label className="field"><span>{tr(lang,"category")}</span><select value={group} onChange={e=>setGroup(e.target.value)}><option value="all">{tr(lang,"all")}</option>{groups.map(g=><option key={g}>{categoryText(lang,g)}</option>)}</select></label><label className="field grow"><span>{tr(lang,"search")}</span><input value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 <div className="disease-grid full-span">{filtered.map(x=><article className="disease-card" key={x.id}><div className="kpi-row"><h3>{lang==="ar"?x.ar:x.en}</h3>{x.urgent&&<span className="status warn">{tr(lang,"urgent")}</span>}</div><h4>{tr(lang,"symptoms")}</h4><p>{lang==="ar"?x.symAr:x.symEn}</p><h4>{tr(lang,"treatment")}</h4><p>{lang==="ar"?x.txAr:x.txEn}</p><button className="btn primary" onClick={()=>addTreatment(x)}>{added===x.id?"✓ "+tr(lang,"treatmentTaskAdded"):tr(lang,"addTreatmentTask")}</button></article>)}</div>
 </section>;
}
