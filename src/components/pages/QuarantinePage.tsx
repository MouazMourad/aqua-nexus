"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdvancedSection } from "@/components/ui/AdvancedSection";
import { ContextHint } from "@/components/ui/ContextHint";
import { uid,today,nowISO } from "@/lib/appUtils";
import { claimCriticalAction } from "@/lib/actionGuard";
import { inventoryForConsumer } from "@/domain/inventoryIntelligence";
import { interventionGate } from "@/domain/interventionSafety";
import { useSafetyOverrideDialog } from "@/components/ui/SafetyOverrideDialog";
import { validatePositiveQuantity,validateTreatmentSetup } from "@/domain/inputSanity";
import { localDateKey } from "@/domain/timeSafety";

function addHoursISO(hours:number){return new Date(Date.now()+Math.max(1,hours)*3600000).toISOString();}
function dateOnly(iso?:string){return iso?localDateKey(new Date(iso)):today();}

export function QuarantinePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const {requestOverride,overrideDialog}=useSafetyOverrideDialog(lang);
 const [organism,setOrganism]=useState(""),[subjectId,setSubjectId]=useState(""),[reason,setReason]=useState(""),[plan,setPlan]=useState("");
 const [volume,setVolume]=useState(Math.max(20,Math.round(tank.systemVolumeLiters*.12)));
 const [product,setProduct]=useState(""),[labelDose,setLabelDose]=useState(0),[intervalHours,setIntervalHours]=useState(24),[totalDoses,setTotalDoses]=useState(1),[medInventoryId,setMedInventoryId]=useState("");
 const medicationStock=useMemo(()=>inventoryForConsumer(tank,"quarantine"),[tank]);
 const calculatedDose=useMemo(()=>labelDose>0&&volume>0?labelDose*(volume/100):0,[labelDose,volume]);

 function add(){
  if(!organism.trim())return;
  const ts=nowISO();
  const treatment=Boolean(product.trim()&&labelDose>0);
  if(product.trim()&&!labelDose){window.alert(bi(lang,"إذا اخترت دواء لازم تدخل جرعة الملصق الفعلية. Aqua Nexus ما رح يخمّن الجرعة.","If you enter a medication, enter the exact label dose. Aqua Nexus will not guess it."));return}
  if(labelDose>0&&!product.trim()){window.alert(bi(lang,"اكتب اسم المنتج المرتبط بجرعة الملصق حتى يبقى العلاج قابلاً للتدقيق.","Enter the product name associated with the label dose so treatment remains auditable."));return}
  if(!validatePositiveQuantity(volume,"quarantineVolume").ok){window.alert(bi(lang,"حجم حوض الحجر يجب أن يكون أكبر من صفر.","Quarantine volume must be greater than zero."));return}
  if(treatment){
    const treatmentCheck=validateTreatmentSetup({volumeLiters:volume,labelDoseMlPer100L:labelDose,intervalHours,totalDoses});
    const danger=treatmentCheck.issues.find(x=>x.level==="danger");
    if(danger){window.alert(lang==="ar"?danger.ar:danger.en);return}
  }
  const selectedMedication=medInventoryId?medicationStock.find(i=>i.id===medInventoryId):undefined;
  if(medInventoryId&&!selectedMedication){window.alert(bi(lang,"الدواء المحدد لم يعد متاحاً ضمن مخزون العلاج.","The selected medication is no longer available in treatment inventory."));return}
  if(selectedMedication&&selectedMedication.unit.toLowerCase()!=="ml"){window.alert(bi(lang,"حاسبة الحجر الحالية تعتمد mL. اختر دواء مخزون بوحدة mL أو اترك الربط فارغاً.","The current quarantine calculator uses mL. Select medication stock measured in mL or leave inventory unlinked."));return}
  if(!claimCriticalAction(`quarantine-create:${tank.id}`))return;
  const nextDoseAt=treatment?ts:undefined;
  patch(tank.id,t=>({...t,
   livestock:subjectId?t.livestock.map(x=>x.id===subjectId?{...x,health:"treatment" as const,lastObservedAt:ts}:x):t.livestock,
   quarantine:[{id:uid("q"),livestockId:subjectId||undefined,organism:organism.trim(),reason:reason.trim(),plan:plan.trim(),start:today(),status:"active",quarantineVolumeLiters:volume,treatmentProduct:product.trim()||undefined,labelDoseMlPer100L:labelDose||undefined,intervalHours:intervalHours||undefined,totalDoses:Math.max(1,totalDoses),dosesGiven:0,nextDoseAt,medicationInventoryItemId:medInventoryId||undefined,medicationUnit:medInventoryId?t.inventory.find(i=>i.id===medInventoryId)?.unit:undefined,medicationQuantityPerDose:medInventoryId?calculatedDose:undefined},...t.quarantine],
   timeline:[{id:uid("ev"),timestamp:ts,type:"quarantine",textAr:`بدأ الحجر الصحي لـ ${organism.trim()}${treatment?` مع خطة علاج ${product.trim()}`:""}.`,textEn:`Quarantine started for ${organism.trim()}${treatment?` with ${product.trim()} treatment plan`:""}.`},...t.timeline]
  }));
  setOrganism("");setSubjectId("");setReason("");setPlan("");setProduct("");setLabelDose(0);setTotalDoses(1);
 }

 async function logDose(id:string){
  const q=tank.quarantine.find(x=>x.id===id);
  if(!q||q.status!=="active"||!q.treatmentProduct||!q.labelDoseMlPer100L||!q.quarantineVolumeLiters)return;
  const setupCheck=validateTreatmentSetup({volumeLiters:q.quarantineVolumeLiters,labelDoseMlPer100L:q.labelDoseMlPer100L,intervalHours:q.intervalHours??24,totalDoses:q.totalDoses??1});
  const setupDanger=setupCheck.issues.find(x=>x.level==="danger");
  if(setupDanger){window.alert(lang==="ar"?setupDanger.ar:setupDanger.en);return}
  if(q.nextDoseAt&&Date.now()+60_000<new Date(q.nextDoseAt).getTime()){
    window.alert(bi(lang,`الجرعة التالية ليست مستحقة بعد. الموعد المسجل: ${new Date(q.nextDoseAt).toLocaleString()}. لا تسجّل جرعة مبكرة وتكسر فاصل ملصق المنتج.`,`The next dose is not due yet. Scheduled: ${new Date(q.nextDoseAt).toLocaleString()}. Do not log an early dose that violates the product-label interval.`));return;
  }
  const dose=q.labelDoseMlPer100L*(q.quarantineVolumeLiters/100);
  const dosesGiven=(q.dosesGiven??0)+1;
  const total=Math.max(1,q.totalDoses??1);
  const more=dosesGiven<total;
  const nextDoseAt=more?addHoursISO(q.intervalHours??24):undefined;
  const ts=nowISO();
  const intervention=interventionGate(tank,"medication");
  if(intervention.level==="warn"&&!window.confirm(lang==="ar"?intervention.ar+" هل جرعة العلاج مستحقة الآن حسب الخطة؟":intervention.en+" Is the treatment dose due now according to the plan?"))return;
  let overrideReason="";
  if(intervention.level==="danger"){
   const reason=await requestOverride({title:lang==="ar"?"تجاوز تحذير جرعة علاج":"Treatment-dose safety override",message:lang==="ar"?intervention.ar:intervention.en,requireReason:true});
   if(!reason)return;overrideReason=reason;
  }
  if(!claimCriticalAction(`quarantine-dose:${tank.id}:${id}`))return;
  const inv=q.medicationInventoryItemId?medicationStock.find(i=>i.id===q.medicationInventoryItemId):undefined;
  const consume=q.medicationQuantityPerDose??dose;
  if(q.medicationInventoryItemId&&!inv){window.alert(bi(lang,"الدواء المرتبط بهذه الحالة غير موجود ضمن مخزون العلاج.","The medication linked to this case is missing from treatment inventory."));return}
  if(inv&&inv.quantity<consume){window.alert(bi(lang,`المخزون غير كافٍ. المطلوب ${consume.toFixed(2)} ${inv.unit} والمتوفر ${inv.quantity} ${inv.unit}.`,`Insufficient stock. Required ${consume.toFixed(2)} ${inv.unit}; available ${inv.quantity} ${inv.unit}.`));return}
  patch(tank.id,t=>({...t,
   inventory:inv?t.inventory.map(i=>i.id===inv.id?{...i,quantity:Math.max(0,i.quantity-consume)}:i):t.inventory,
   quarantine:t.quarantine.map(x=>x.id===id?{...x,dosesGiven,lastDoseAt:ts,nextDoseAt,responseObservedAt:undefined}:x),
   maintenance:more?[...t.maintenance,{id:uid("task"),title:`جرعة حجر: ${q.treatmentProduct} — ${q.organism}`,titleEn:`Quarantine dose: ${q.treatmentProduct} — ${q.organism}`,cadence:"once",done:false,nextDue:dateOnly(nextDoseAt),manual:true}]:t.maintenance,
   timeline:[...(overrideReason?[{id:uid("ev"),timestamp:ts,type:"safety-override",textAr:`تم تجاوز تحذير جرعة علاج. السبب: ${overrideReason}`,textEn:`Treatment-dose safety warning overridden. Reason: ${overrideReason}`}]:[]),{id:uid("ev"),timestamp:ts,type:"quarantine-dose",textAr:`تم تسجيل جرعة ${dose.toFixed(2)} mL من ${q.treatmentProduct} لـ ${q.organism} (${dosesGiven}/${total}) حسب ملصق المنتج.`,textEn:`Logged ${dose.toFixed(2)} mL of ${q.treatmentProduct} for ${q.organism} (${dosesGiven}/${total}) using the product-label rate.`},...t.timeline]
  }));
 }

 function close(id:string,resolved=true){
  if(!claimCriticalAction(`quarantine-close:${tank.id}:${id}`))return;
  const q=tank.quarantine.find(x=>x.id===id);
  const ts=nowISO();
  patch(tank.id,t=>({...t,
   quarantine:t.quarantine.map(x=>x.id===id?{...x,status:"closed",nextDoseAt:undefined,outcome:resolved?"resolved":"stable"}:x),
   livestock:q?.livestockId?t.livestock.map(x=>x.id===q.livestockId?{...x,health:resolved?"good" as const:"watch" as const,lastObservedAt:ts}:x):t.livestock,
   timeline:q?[{id:uid("ev"),timestamp:ts,type:"quarantine",textAr:`تم إنهاء الحجر الصحي لـ ${q.organism}.`,textEn:`Quarantine closed for ${q.organism}.`},...t.timeline]:t.timeline
  }));
 }

 return <>{overrideDialog}<section className="page-grid"><PageHeader eyebrow="QUARANTINE PROTOCOL" title={tr(lang,"quarantine")}/>
 <div className="card panel full-span">
  <div className="module-head"><div><h3>{bi(lang,"إنشاء حالة حجر أو علاج","Create quarantine / treatment case")}</h3><p className="note">{bi(lang,"أدخل جرعة المنتج كما هي مكتوبة على الملصق فقط. Aqua Nexus يحسب الحجم للحوض الحجري ويتابع المواعيد، ولا يفترض تركيزاً دوائياً من عنده.","Enter the dose exactly as printed on the product label. Aqua Nexus scales it to quarantine volume and tracks timing without assuming medication concentration.")}</p></div></div>
  <div className="form-grid">
   <label className="field"><span>{bi(lang,"ربط بكائن مسجل","Link to registered livestock")}</span><select value={subjectId} onChange={e=>{const id=e.target.value;setSubjectId(id);const s=tank.livestock.find(x=>x.id===id);if(s)setOrganism(lang==="ar"?s.name:(s.nameEn||s.name))}}><option value="">—</option>{tank.livestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label><label className="field"><span>{tr(lang,"organism")}</span><input value={organism} onChange={e=>setOrganism(e.target.value)}/></label>
   <label className="field"><span>{tr(lang,"reason")}</span><input value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <label className="field"><span>{bi(lang,"حجم حوض الحجر L","Quarantine volume L")}</span><input type="number" min=".1" max="1000000" step=".1" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(lang,"اسم المنتج / الدواء","Product / medication")}</span><input value={product} onChange={e=>setProduct(e.target.value)}/></label>
   <label className="field"><span>{bi(lang,"جرعة الملصق mL لكل 100L","Label dose mL per 100L")}</span><input type="number" min=".000001" max="10000" step="any" value={labelDose||""} onChange={e=>setLabelDose(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(lang,"الفاصل بين الجرعات (ساعة)","Dose interval (hours)")}</span><input type="number" min=".25" max="720" step=".25" value={intervalHours} onChange={e=>setIntervalHours(Number(e.target.value))}/></label>
   <label className="field"><span>{bi(lang,"عدد الجرعات المخطط","Planned doses")}</span><input type="number" min="1" max="100" value={totalDoses} onChange={e=>setTotalDoses(Number(e.target.value))}/></label>
  </div>
  <ContextHint id="quarantine-label-dose" lang={lang} tone="safety" dismissible={false} ar="الجرعة لازم تكون من ملصق نفس المنتج المستخدم فعلياً. Aqua Nexus يحسب الحجم فقط وما بيخمن تركيز الدواء." en="The dose must come from the exact product label in use. Aqua Nexus scales volume only and never guesses medication concentration."/>
  <AdvancedSection titleAr="توثيق العلاج المتقدم" titleEn="Advanced treatment documentation" summaryAr="ربط الدواء بالمخزون وخطة نصية إضافية؛ ما بيغيروا حساب الجرعة الأساسية." summaryEn="Inventory linking and extra plan notes; they do not change the core dose calculation."><div className="form-grid" style={{paddingTop:10}}><label className="field"><span>{bi(lang,"ربط الدواء بالمخزون (اختياري)","Link medication to inventory (optional)")}</span><select value={medInventoryId} onChange={e=>setMedInventoryId(e.target.value)}><option value="">—</option>{medicationStock.map(i=><option key={i.id} value={i.id}>{lang==="ar"?i.name:(i.nameEn||i.name)} • {i.quantity} {i.unit}</option>)}</select></label>
   <label className="field full-field"><span>{tr(lang,"plan")}</span><textarea value={plan} onChange={e=>setPlan(e.target.value)}/></label></div></AdvancedSection>
  {product&&labelDose>0&&<div className="summary-strip" style={{marginTop:12}}><div className="summary"><small>{bi(lang,"الجرعة المحسوبة من الملصق","Label-scaled dose")}</small><b>{calculatedDose.toFixed(2)} mL</b></div><div className="summary"><small>{bi(lang,"حجم الحجر","Quarantine volume")}</small><b>{volume} L</b></div><div className="summary"><small>{bi(lang,"كل","Every")}</small><b>{intervalHours} h</b></div></div>}
  <div className="inline-alert warn" style={{marginTop:12}}>{bi(lang,"لا تستخدم الحاسبة لتخمين تركيز النحاس أو الفورمالين أو أي دواء. يجب إدخال معدل الجرعة من ملصق المنتج المستخدم فعلياً، وإعادة القياس عند وجود Test Kit خاص بالدواء.","Do not use this calculator to guess copper, formalin or other medication concentration. Enter the dosing rate from the exact product label and verify with the appropriate test kit when applicable.")}</div>
  <button className="btn primary" onClick={add} disabled={!organism.trim()} style={{marginTop:12}}>+ {tr(lang,"addCase")}</button>
 </div>

 <div className="card panel full-span"><div className="history-list">{tank.quarantine.map(x=>{
  const dose=(x.labelDoseMlPer100L&&x.quarantineVolumeLiters)?x.labelDoseMlPer100L*(x.quarantineVolumeLiters/100):0;
  const given=x.dosesGiven??0,total=Math.max(1,x.totalDoses??1),completeTreatment=given>=total;
  return <div className="case-row" key={x.id} style={{alignItems:"flex-start"}}><div style={{flex:1}}><b>{x.organism}</b><span>{x.reason}</span><small>{x.plan}</small>{x.treatmentProduct&&<div className="note" style={{marginTop:6}}><b>{x.treatmentProduct}</b> • {dose.toFixed(2)} mL / dose • {given}/{total}{x.nextDoseAt?` • ${bi(lang,"القادمة","next")}: ${new Date(x.nextDoseAt).toLocaleString()}`:""}</div>}</div><span className={`status ${x.status==="active"?"warn":""}`}>{tr(lang,x.status==="active"?"active":"completed")}</span>{x.status==="active"&&<div className="modal-actions" style={{marginTop:0}}>{x.treatmentProduct&&!completeTreatment&&<button className="btn primary" onClick={()=>logDose(x.id)}>{bi(lang,"تسجيل الجرعة","Log dose")}</button>}<button className="btn good" onClick={()=>close(x.id,true)}>✓ {bi(lang,"تم التعافي","Resolved")}</button><button className="btn" onClick={()=>close(x.id,false)}>{bi(lang,"إغلاق مع مراقبة","Close • watch")}</button></div>}</div>
 })}</div></div>
 </section></>;
}
