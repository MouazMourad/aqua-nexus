"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today,nowISO } from "@/lib/appUtils";

function addHoursISO(hours:number){return new Date(Date.now()+Math.max(1,hours)*3600000).toISOString();}
function dateOnly(iso?:string){return iso?new Date(iso).toISOString().slice(0,10):today();}

export function QuarantinePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [organism,setOrganism]=useState(""),[reason,setReason]=useState(""),[plan,setPlan]=useState("");
 const [volume,setVolume]=useState(Math.max(20,Math.round(tank.systemVolumeLiters*.12)));
 const [product,setProduct]=useState(""),[labelDose,setLabelDose]=useState(0),[intervalHours,setIntervalHours]=useState(24),[totalDoses,setTotalDoses]=useState(1);
 const calculatedDose=useMemo(()=>labelDose>0&&volume>0?labelDose*(volume/100):0,[labelDose,volume]);

 function add(){
  if(!organism.trim())return;
  const ts=nowISO();
  const treatment=product.trim()&&labelDose>0;
  const nextDoseAt=treatment?ts:undefined;
  patch(tank.id,t=>({...t,
   quarantine:[{id:uid("q"),organism:organism.trim(),reason:reason.trim(),plan:plan.trim(),start:today(),status:"active",quarantineVolumeLiters:volume,treatmentProduct:product.trim()||undefined,labelDoseMlPer100L:labelDose||undefined,intervalHours:intervalHours||undefined,totalDoses:Math.max(1,totalDoses),dosesGiven:0,nextDoseAt},...t.quarantine],
   timeline:[{id:uid("ev"),timestamp:ts,type:"quarantine",textAr:`بدأ الحجر الصحي لـ ${organism.trim()}${treatment?` مع خطة علاج ${product.trim()}`:""}.`,textEn:`Quarantine started for ${organism.trim()}${treatment?` with ${product.trim()} treatment plan`:""}.`},...t.timeline]
  }));
  setOrganism("");setReason("");setPlan("");setProduct("");setLabelDose(0);setTotalDoses(1);
 }

 function logDose(id:string){
  const q=tank.quarantine.find(x=>x.id===id);
  if(!q||q.status!=="active"||!q.treatmentProduct||!q.labelDoseMlPer100L||!q.quarantineVolumeLiters)return;
  const dose=q.labelDoseMlPer100L*(q.quarantineVolumeLiters/100);
  const dosesGiven=(q.dosesGiven??0)+1;
  const total=Math.max(1,q.totalDoses??1);
  const more=dosesGiven<total;
  const nextDoseAt=more?addHoursISO(q.intervalHours??24):undefined;
  const ts=nowISO();
  patch(tank.id,t=>({...t,
   quarantine:t.quarantine.map(x=>x.id===id?{...x,dosesGiven,lastDoseAt:ts,nextDoseAt}:x),
   maintenance:more?[...t.maintenance,{id:uid("task"),title:`جرعة حجر: ${q.treatmentProduct} — ${q.organism}`,titleEn:`Quarantine dose: ${q.treatmentProduct} — ${q.organism}`,cadence:"once",done:false,nextDue:dateOnly(nextDoseAt),manual:true}]:t.maintenance,
   timeline:[{id:uid("ev"),timestamp:ts,type:"quarantine-dose",textAr:`تم تسجيل جرعة ${dose.toFixed(2)} mL من ${q.treatmentProduct} لـ ${q.organism} (${dosesGiven}/${total}) حسب ملصق المنتج.`,textEn:`Logged ${dose.toFixed(2)} mL of ${q.treatmentProduct} for ${q.organism} (${dosesGiven}/${total}) using the product-label rate.`},...t.timeline]
  }));
 }

 function close(id:string){
  const q=tank.quarantine.find(x=>x.id===id);
  const ts=nowISO();
  patch(tank.id,t=>({...t,
   quarantine:t.quarantine.map(x=>x.id===id?{...x,status:"closed",nextDoseAt:undefined}:x),
   timeline:q?[{id:uid("ev"),timestamp:ts,type:"quarantine",textAr:`تم إنهاء الحجر الصحي لـ ${q.organism}.`,textEn:`Quarantine closed for ${q.organism}.`},...t.timeline]:t.timeline
  }));
 }

 return <section className="page-grid"><PageHeader eyebrow="QUARANTINE PROTOCOL" title={tr(lang,"quarantine")}/>
 <div className="card panel full-span">
  <div className="module-head"><div><h3>{bi(lang,"إنشاء حالة حجر أو علاج","Create quarantine / treatment case")}</h3><p className="note">{bi(lang,"أدخل جرعة المنتج كما هي مكتوبة على الملصق فقط. Aqua Nexus يحسب الحجم للحوض الحجري ويتابع المواعيد، ولا يفترض تركيزاً دوائياً من عنده.","Enter the dose exactly as printed on the product label. Aqua Nexus scales it to quarantine volume and tracks timing without assuming medication concentration.")}</p></div></div>
  <div className="form-grid">
   <label className="field"><span>{tr(lang,"organism")}</span><input value={organism} onChange={e=>setOrganism(e.target.value)}/></label>
   <label className="field"><span>{tr(lang,"reason")}</span><input value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <label className="field"><span>{bi(lang,"حجم حوض الحجر L","Quarantine volume L")}</span><input type="number" min="1" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(lang,"اسم المنتج / الدواء","Product / medication")}</span><input value={product} onChange={e=>setProduct(e.target.value)}/></label>
   <label className="field"><span>{bi(lang,"جرعة الملصق mL لكل 100L","Label dose mL per 100L")}</span><input type="number" min="0" step="any" value={labelDose||""} onChange={e=>setLabelDose(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(lang,"الفاصل بين الجرعات (ساعة)","Dose interval (hours)")}</span><input type="number" min="1" value={intervalHours} onChange={e=>setIntervalHours(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(lang,"عدد الجرعات المخطط","Planned doses")}</span><input type="number" min="1" max="60" value={totalDoses} onChange={e=>setTotalDoses(Number(e.target.value))}/></label>
   <label className="field full-field"><span>{tr(lang,"plan")}</span><textarea value={plan} onChange={e=>setPlan(e.target.value)}/></label>
  </div>
  {product&&labelDose>0&&<div className="summary-strip" style={{marginTop:12}}><div className="summary"><small>{bi(lang,"الجرعة المحسوبة من الملصق","Label-scaled dose")}</small><b>{calculatedDose.toFixed(2)} mL</b></div><div className="summary"><small>{bi(lang,"حجم الحجر","Quarantine volume")}</small><b>{volume} L</b></div><div className="summary"><small>{bi(lang,"كل","Every")}</small><b>{intervalHours} h</b></div></div>}
  <div className="inline-alert warn" style={{marginTop:12}}>{bi(lang,"لا تستخدم الحاسبة لتخمين تركيز النحاس أو الفورمالين أو أي دواء. يجب إدخال معدل الجرعة من ملصق المنتج المستخدم فعلياً، وإعادة القياس عند وجود Test Kit خاص بالدواء.","Do not use this calculator to guess copper, formalin or other medication concentration. Enter the dosing rate from the exact product label and verify with the appropriate test kit when applicable.")}</div>
  <button className="btn primary" onClick={add} disabled={!organism.trim()} style={{marginTop:12}}>+ {tr(lang,"addCase")}</button>
 </div>

 <div className="card panel full-span"><div className="history-list">{tank.quarantine.map(x=>{
  const dose=(x.labelDoseMlPer100L&&x.quarantineVolumeLiters)?x.labelDoseMlPer100L*(x.quarantineVolumeLiters/100):0;
  const given=x.dosesGiven??0,total=Math.max(1,x.totalDoses??1),completeTreatment=given>=total;
  return <div className="case-row" key={x.id} style={{alignItems:"flex-start"}}><div style={{flex:1}}><b>{x.organism}</b><span>{x.reason}</span><small>{x.plan}</small>{x.treatmentProduct&&<div className="note" style={{marginTop:6}}><b>{x.treatmentProduct}</b> • {dose.toFixed(2)} mL / dose • {given}/{total}{x.nextDoseAt?` • ${bi(lang,"القادمة","next")}: ${new Date(x.nextDoseAt).toLocaleString()}`:""}</div>}</div><span className={`status ${x.status==="active"?"warn":""}`}>{tr(lang,x.status==="active"?"active":"completed")}</span>{x.status==="active"&&<div className="modal-actions" style={{marginTop:0}}>{x.treatmentProduct&&!completeTreatment&&<button className="btn primary" onClick={()=>logDose(x.id)}>{bi(lang,"تسجيل الجرعة","Log dose")}</button>}<button className="btn good" onClick={()=>close(x.id)}>✓ {bi(lang,"إنهاء","Close")}</button></div>}</div>
 })}</div></div>
 </section>;
}
