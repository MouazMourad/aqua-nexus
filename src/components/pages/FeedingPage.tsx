"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
import { feedingIntelligence } from "@/domain/feedingIntelligence";

export function FeedingPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[food,setFood]=useState(""),[amount,setAmount]=useState(""),[notes,setNotes]=useState("");
 const plan=useMemo(()=>feedingIntelligence(tank),[tank]);
 const add=()=>{if(!food.trim())return;const ts=nowISO();patch(tank.id,t=>({...t,feeding:[{id:uid("feed"),timestamp:ts,food:food.trim(),amount,notes},...t.feeding],timeline:[{id:uid("ev"),timestamp:ts,type:"feeding",textAr:`تم تسجيل تغذية: ${food.trim()} ${amount}`,textEn:`Feeding logged: ${food.trim()} ${amount}`},...t.timeline]}));setFood("");setAmount("");setNotes("")};
 return <section className="page-grid"><PageHeader eyebrow="FEEDING INTELLIGENCE" title={tr(lang,"feeding")}/>
 <div className="card panel full-span"><div className="module-head"><div><h3>{bi(lang,"خطة التغذية المرتبطة بالحوض","Tank-aware feeding plan")}</h3><p className="note">{bi(lang,"البرنامج يربط سجل التغذية بالكائنات وبـ NO3/PO4 حتى تقدر تشوف إذا الروتين عم يضغط على المغذيات.","Feeding history is linked to livestock and NO3/PO4 so nutrient pressure can be interpreted in context.")}</p></div><span className={`status ${plan.nutrientPressure==="high"?"danger":plan.nutrientPressure==="watch"?"warn":""}`}>{plan.nutrientPressure}</span></div><div className="summary-strip"><div className="summary"><small>{bi(lang,"تغذيات / 7 أيام","Feedings / 7d")}</small><b>{plan.recent7d}</b></div><div className="summary"><small>{bi(lang,"أسماك","Fish")}</small><b>{plan.fish}</b></div><div className="summary"><small>{bi(lang,"لافقاريات","Inverts")}</small><b>{plan.inverts}</b></div><div className="summary"><small>{bi(lang,"مرجان","Corals")}</small><b>{plan.corals}</b></div></div>{plan.suggestions.map((x,i)=><div className="inline-alert info" key={i}>{x}</div>)}</div>
 <div className="card panel"><div className="form-grid"><label className="field"><span>{tr(lang,"food")}</span><input value={food} onChange={e=>setFood(e.target.value)}/></label><label className="field"><span>{tr(lang,"feedAmount")}</span><input value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="field full-field"><span>{tr(lang,"notes")}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><button className="btn primary" onClick={add} disabled={!food.trim()}>{tr(lang,"addFeeding")}</button></div>
 <div className="card panel"><div className="history-list">{tank.feeding.map(x=><div className="history-row" key={x.id}><b>{x.food} • {x.amount}</b><span>{new Date(x.timestamp).toLocaleString()}</span><small>{x.notes}</small></div>)}</div></div>
 </section>;
}
