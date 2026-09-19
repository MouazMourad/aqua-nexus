"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
import { waterChangeIntelligence } from "@/domain/waterChangeIntelligence";

export function WaterChangePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[liters,setLiters]=useState(Math.round(tank.systemVolumeLiters*.15)),[sal,setSal]=useState(1.025),[temp,setTemp]=useState(25),[notes,setNotes]=useState("");
 const pct=useMemo(()=>tank.systemVolumeLiters?liters/tank.systemVolumeLiters*100:0,[liters,tank.systemVolumeLiters]);
 const intel=useMemo(()=>waterChangeIntelligence(tank,pct,tank.type==="marine"?sal:undefined,temp),[tank,pct,sal,temp]);
 const save=()=>{if(!intel.safe&&!window.confirm(lang==="ar"?"في فرق ملحوظ بماء التغيير. هل أنت متأكد أنك ضبطته فعلياً وتريد التسجيل؟":"Replacement water differs materially. Confirm it is actually adjusted before logging."))return;const ts=nowISO();patch(tank.id,t=>({...t,waterChanges:[{id:uid("wc"),timestamp:ts,liters,percent:pct,salinity:t.type==="marine"?sal:undefined,temperature:temp,notes},...t.waterChanges],timeline:[{id:uid("ev"),timestamp:ts,type:"waterchange",textAr:`تم تغيير ${liters} لتر (${pct.toFixed(1)}%).`,textEn:`A ${liters} L water change (${pct.toFixed(1)}%) was logged.`},...t.timeline]}))};
 return <section className="page-grid"><PageHeader eyebrow="WATER CHANGE PLANNER" title={tr(lang,"waterChange")}/>
 <div className="card panel full-span"><div className="module-head"><div><h3>{bi(lang,"تخطيط قبل التنفيذ","Plan before changing water")}</h3><p className="note">{bi(lang,`اقتراح أولي حسب القراءات الحالية: حوالي ${intel.suggestedPercent}% عند الحاجة، مع معالجة السبب الأساسي وليس تغيير الماء وحده.`,`Initial suggestion from current readings: about ${intel.suggestedPercent}% when needed, while addressing root cause rather than relying on water changes alone.`)}</p></div></div><div className="summary-strip"><div className="summary"><small>NO3 {bi(lang,"نظري بعد التغيير","theoretical after")}</small><b>{intel.projectedNO3===null?"—":intel.projectedNO3.toFixed(1)}</b></div><div className="summary"><small>PO4 {bi(lang,"نظري بعد التغيير","theoretical after")}</small><b>{intel.projectedPO4===null?"—":intel.projectedPO4.toFixed(3)}</b></div><div className="summary"><small>{bi(lang,"الحجم المقترح","Suggested")}</small><b>{intel.suggestedPercent}%</b></div></div>{intel.warnings.map((w,i)=><div className="inline-alert warn" key={i}>{w}</div>)}</div>
 <div className="card panel"><div className="form-grid"><label className="field"><span>{tr(lang,"changeLiters")}</span><input type="number" min="0" value={liters} onChange={e=>setLiters(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"changePercent")}</span><input value={`${pct.toFixed(1)}%`} readOnly/></label>{tank.type==="marine"&&<label className="field"><span>{tr(lang,"replacementSalinity")}</span><input type="number" step=".001" value={sal} onChange={e=>setSal(Number(e.target.value))}/></label>}<label className="field"><span>{tr(lang,"temperature")}</span><input type="number" step=".1" value={temp} onChange={e=>setTemp(Number(e.target.value))}/></label><label className="field full-field"><span>{tr(lang,"notes")}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><button className="btn primary" onClick={save}>{tr(lang,"waterChangeLog")}</button></div>
 <div className="card panel"><div className="history-list">{tank.waterChanges.map(x=><div className="history-row" key={x.id}><b>{x.liters} L • {x.percent.toFixed(1)}%</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>)}</div></div>
 </section>;
}
