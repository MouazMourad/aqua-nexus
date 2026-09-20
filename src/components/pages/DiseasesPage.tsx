"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { DISEASE_LIBRARY } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,categoryText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today,nowISO } from "@/lib/appUtils";

export function DiseasesPage({tank,onVisualInsight}:{tank:Tank;onVisualInsight?:()=>void}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[group,setGroup]=useState("all"),[search,setSearch]=useState(""),[added,setAdded]=useState<string|null>(null),[subjectId,setSubjectId]=useState("");
 const entries:any[]=DISEASE_LIBRARY.filter((x:any)=>x.type===tank.type);
 const groups=[...new Set(entries.map(x=>String(x.group)))];
 const groupCounts=Object.fromEntries(groups.map(g=>[g,entries.filter(x=>String(x.group)===g).length]));
 const filtered=useMemo(()=>{
  const q=search.trim().toLowerCase();
  return entries.filter(x=>{
   const groupMatch=group==="all"||String(x.group)===group;
   const searchMatch=!q||(`${x.ar} ${x.en} ${x.symAr} ${x.symEn} ${x.txAr} ${x.txEn}`).toLowerCase().includes(q);
   return groupMatch&&searchMatch;
  });
 },[entries,group,search]);

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

 return <section className="page-grid"><PageHeader eyebrow="DISEASES & TREATMENT" title={tr(lang,"diseases")} actions={onVisualInsight?<button className="btn primary" onClick={onVisualInsight}>{lang==="ar"?"📷 تحليل صورة / AI Vision":"📷 Analyze photo / AI Vision"}</button>:undefined}/>
 <div className="inline-alert info full-span"><b>{lang==="ar"?"مو متأكد شو الحالة؟ ابدأ بالصورة قبل اختيار العلاج.":"Not sure what the condition is? Start with the image before choosing treatment."}</b><p>{lang==="ar"?"Visual Insight بيربط الصورة بالكائن والكيمياء والتاريخ، ويعطي احتمالات ومراجع من مكتبة الأمراض بدون ما يثبت تشخيص أو دواء تلقائياً.":"Visual Insight links the image to livestock, chemistry and history, then suggests possibilities and disease-library references without auto-confirming a diagnosis or medication."}</p>{onVisualInsight&&<button className="btn" onClick={onVisualInsight}>{lang==="ar"?"فتح Visual Insight":"Open Visual Insight"}</button>}</div>
 <div className="filter-bar full-span"><label className="field"><span>{tr(lang,"organism")}</span><select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">— {lang==="ar"?"مرجع عام بدون ربط كائن":"General reference only"} —</option>{tank.livestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label><label className="field"><span>{tr(lang,"category")}</span><select value={group} onChange={e=>setGroup(e.target.value)}><option value="all">{tr(lang,"all")} ({entries.length})</option>{groups.map(g=><option key={g} value={g}>{categoryText(lang,g)} ({groupCounts[g]??0})</option>)}</select></label><label className="field grow"><span>{tr(lang,"search")}</span><input value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 {filtered.length===0&&<div className="inline-alert info full-span"><b>{lang==="ar"?"ما في نتائج بهالفلتر الحالي.":"No results match the current filter."}</b><p>{lang==="ar"?"جرّب امسح البحث أو اختار «الكل». التصنيفات نفسها ما بتحذف الأمراض؛ هي بس بتعرض المجموعة المطلوبة.":"Clear search or choose “All”. Categories do not remove diseases; they only show the selected group."}</p></div>}
 <div className="disease-grid full-span">{filtered.map(x=><article className="disease-card" key={x.id}><div className="kpi-row"><h3>{lang==="ar"?x.ar:x.en}</h3>{x.urgent&&<span className="status warn">{tr(lang,"urgent")}</span>}</div><h4>{tr(lang,"symptoms")}</h4><p>{lang==="ar"?x.symAr:x.symEn}</p><h4>{tr(lang,"treatment")}</h4><p>{lang==="ar"?x.txAr:x.txEn}</p><button className="btn primary" onClick={()=>addTreatment(x)}>{added===x.id?"✓ "+tr(lang,"treatmentTaskAdded"):(subjectId?(lang==="ar"?"بدء حالة علاج مرتبطة بالكائن":"Start linked treatment case"):tr(lang,"addTreatmentTask"))}</button></article>)}</div>
 </section>;
}
