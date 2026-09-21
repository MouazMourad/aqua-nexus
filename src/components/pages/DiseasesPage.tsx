"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { diseaseEntriesFor,diseaseGroupCounts } from "@/domain/diseaseCatalog";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,categoryText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContextHint } from "@/components/ui/ContextHint";
import { uid,today,nowISO } from "@/lib/appUtils";

export function DiseasesPage({tank,onVisualInsight}:{tank:Tank;onVisualInsight?:()=>void}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[group,setGroup]=useState("all"),[search,setSearch]=useState(""),[added,setAdded]=useState<string|null>(null),[subjectId,setSubjectId]=useState("");
 const entries=useMemo(()=>diseaseEntriesFor(tank.type),[tank.type]);
 const groupCounts=useMemo(()=>diseaseGroupCounts(tank.type),[tank.type]);
 const groups=Object.keys(groupCounts);
 const filtered=useMemo(()=>diseaseEntriesFor(tank.type,group,search),[tank.type,group,search]);

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
 <div className="full-span"><ContextHint id="disease-reference-safety" lang={lang} tone="safety" dismissible={false} ar="مكتبة الأمراض مرجع أعراض وعلاج مبدئي، مو تشخيص قطعي. ربط الحالة بكائن بيفتح متابعة علاج منظمة بدل تنفيذ دواء تلقائياً." en="The disease library is a symptom and treatment reference, not a definitive diagnosis. Linking a case creates structured follow-up rather than auto-medicating."/></div>
 <div className="filter-bar full-span"><label className="field"><span>{tr(lang,"organism")}</span><select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">— {lang==="ar"?"مرجع عام بدون ربط كائن":"General reference only"} —</option>{tank.livestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label><label className="field"><span>{tr(lang,"category")}</span><select value={group} onChange={e=>setGroup(e.target.value)}><option value="all">{tr(lang,"all")} ({entries.length})</option>{groups.map(g=><option key={g} value={g}>{categoryText(lang,g)} ({groupCounts[g]??0})</option>)}</select></label><label className="field grow"><span>{tr(lang,"search")}</span><input value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 {filtered.length===0&&<div className="inline-alert info full-span"><b>{lang==="ar"?"ما في نتائج بهالفلتر الحالي.":"No results match the current filter."}</b><p>{lang==="ar"?"جرّب امسح البحث أو اختار «الكل». التصنيفات نفسها ما بتحذف الأمراض؛ هي بس بتعرض المجموعة المطلوبة.":"Clear search or choose “All”. Categories do not remove diseases; they only show the selected group."}</p></div>}
 <div className="disease-grid full-span">{filtered.map(x=><article className="disease-card" key={x.id}><div className="kpi-row"><h3>{lang==="ar"?x.ar:x.en}</h3>{x.urgent&&<span className="status warn">{tr(lang,"urgent")}</span>}</div><h4>{tr(lang,"symptoms")}</h4><p>{lang==="ar"?x.symAr:x.symEn}</p><h4>{tr(lang,"treatment")}</h4><p>{lang==="ar"?x.txAr:x.txEn}</p><button className="btn primary" onClick={()=>addTreatment(x)}>{added===x.id?"✓ "+tr(lang,"treatmentTaskAdded"):(subjectId?(lang==="ar"?"بدء حالة علاج مرتبطة بالكائن":"Start linked treatment case"):tr(lang,"addTreatmentTask"))}</button></article>)}</div>
 </section>;
}
