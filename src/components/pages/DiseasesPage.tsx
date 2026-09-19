"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { DISEASE_LIBRARY } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,categoryText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today,nowISO } from "@/lib/appUtils";

export function DiseasesPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[group,setGroup]=useState("all"),[search,setSearch]=useState(""),[added,setAdded]=useState<string|null>(null),[subjectId,setSubjectId]=useState("");
 const entries:any[]=DISEASE_LIBRARY.filter((x:any)=>x.type===tank.type),groups=[...new Set(entries.map(x=>x.group))];
 const filtered=useMemo(()=>entries.filter(x=>(group==="all"||x.group===group)&&(!search||`${x.ar} ${x.en} ${x.symAr} ${x.symEn}`.toLowerCase().includes(search.toLowerCase()))),[group,search,tank.type]);

 function addTreatment(x:any){
  const due=new Date(Date.now()+2*86400000).toISOString().slice(0,10),subject=tank.livestock.find(y=>y.id===subjectId),ts=nowISO();
  patch(tank.id,t=>({...t,
   livestock:subject?t.livestock.map(y=>y.id===subject.id?{...y,health:"treatment" as const,lastObservedAt:ts}:y):t.livestock,
   quarantine:subject?[{id:uid("q"),livestockId:subject.id,suspectedDiseaseId:x.id,symptoms:lang==="ar"?x.symAr:x.symEn,organism:subject.name,reason:lang==="ar"?x.ar:x.en,plan:lang==="ar"?x.txAr:x.txEn,start:today(),status:"active" as const},...t.quarantine]:t.quarantine,
   maintenance:[...t.maintenance,{id:uid("task"),title:`متابعة علاج: ${x.ar}${subject?` — ${subject.name}`:""}`,titleEn:`Treatment follow-up: ${x.en}${subject?` — ${subject.nameEn||subject.name}`:""}`,cadence:"once",done:false,nextDue:due,manual:true}],
   timeline:[{id:uid("ev"),timestamp:ts,type:"treatment",textAr:`تم بدء متابعة علاج: ${x.ar}${subject?` لـ ${subject.name}`:""}.`,textEn:`Treatment follow-up started: ${x.en}${subject?` for ${subject.nameEn||subject.name}`:""}.`},...t.timeline]
  }));
  setAdded(x.id);setTimeout(()=>setAdded(null),1800);
 }

 return <section className="page-grid"><PageHeader eyebrow="DISEASES & TREATMENT" title={tr(lang,"diseases")}/>
 <div className="filter-bar full-span"><label className="field"><span>{tr(lang,"organism")}</span><select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">— {lang==="ar"?"مرجع عام بدون ربط كائن":"General reference only"} —</option>{tank.livestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label><label className="field"><span>{tr(lang,"category")}</span><select value={group} onChange={e=>setGroup(e.target.value)}><option value="all">{tr(lang,"all")}</option>{groups.map(g=><option key={g}>{categoryText(lang,g)}</option>)}</select></label><label className="field grow"><span>{tr(lang,"search")}</span><input value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 <div className="disease-grid full-span">{filtered.map(x=><article className="disease-card" key={x.id}><div className="kpi-row"><h3>{lang==="ar"?x.ar:x.en}</h3>{x.urgent&&<span className="status warn">{tr(lang,"urgent")}</span>}</div><h4>{tr(lang,"symptoms")}</h4><p>{lang==="ar"?x.symAr:x.symEn}</p><h4>{tr(lang,"treatment")}</h4><p>{lang==="ar"?x.txAr:x.txEn}</p><button className="btn primary" onClick={()=>addTreatment(x)}>{added===x.id?"✓ "+tr(lang,"treatmentTaskAdded"):(subjectId?(lang==="ar"?"بدء حالة علاج مرتبطة بالكائن":"Start linked treatment case"):tr(lang,"addTreatmentTask"))}</button></article>)}</div>
 </section>;
}
