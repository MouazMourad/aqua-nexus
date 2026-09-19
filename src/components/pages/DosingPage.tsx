"use client";
import { useEffect,useMemo,useState } from "react";
import type { DoserChannel,Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { calculateDose,DOSING_PRESETS,type DosingForm,type DosingParameter } from "@/domain/dosingCalculator";
import { chemistryGuidance } from "@/domain/chemistryGuidance";

const colors=["#27c2dc","#62d48f","#f6c85f","#c877ff","#ff7e79","#4b8bff"];

function idealTarget(tank:Tank,param:DosingParameter){
 const meta=(CHEMISTRY_CATALOG as any)[tank.type]?.[param];
 return meta?.ideal ? (Number(meta.ideal[0])+Number(meta.ideal[1]))/2 : param==="KH"?8:param==="Ca"?430:1325;
}

function latestValue(tank:Tank,param:DosingParameter){
 const v=tank.chemistry[0]?.values?.[param];
 return typeof v==="number"&&Number.isFinite(v)?v:undefined;
}

function datePlusDays(days:number){return new Date(Date.now()+days*86400000).toISOString().slice(0,10);}

export function DosingPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const availableParams:DosingParameter[]=tank.type==="marine"?["KH","Ca","Mg"]:["KH"];
 const [param,setParam]=useState<DosingParameter>("KH");
 const [cur,setCur]=useState(()=>latestValue(tank,"KH")??7);
 const [target,setTarget]=useState(()=>idealTarget(tank,"KH"));
 const [form,setForm]=useState<DosingForm>("dry");
 const [presetId,setPresetId]=useState("nahco3");
 const [purity,setPurity]=useState(100);
 const [stockGramsPerLiter,setStockGramsPerLiter]=useState(84);
 const [productRaise,setProductRaise]=useState(0);

 useEffect(()=>{
  const current=latestValue(tank,param);
  if(current!==undefined)setCur(current);
  setTarget(idealTarget(tank,param));
  const first=DOSING_PRESETS.find(x=>x.parameter===param);
  if(first)setPresetId(first.id);
 },[param,tank.id,tank.chemistry.length]);

 const presets=DOSING_PRESETS.filter(x=>x.parameter===param);
 const chosen=presets.find(x=>x.id===presetId)??presets[0];
 const guide=useMemo(()=>chemistryGuidance(tank),[tank]);
 const latestReading=tank.chemistry[0];
 const readingAgeHours=latestReading?Math.max(0,(Date.now()-new Date(latestReading.timestamp).getTime())/3600000):99999;
 const latestParamValue=latestValue(tank,param);
 const dataIssue=guide.dataIssues.find(x=>x.key===param);
 const dosingReady=Boolean(latestReading)&&latestParamValue!==undefined&&readingAgeHours<=48&&!dataIssue;
 const calc=useMemo(()=>calculateDose({
  parameter:param,current:cur,target,volumeLiters:tank.systemVolumeLiters,form,presetId:chosen?.id,purityPercent:purity,stockGramsPerLiter,productRaisePerMlPer100L:productRaise
 }),[param,cur,target,tank.systemVolumeLiters,form,chosen?.id,purity,stockGramsPerLiter,productRaise]);

 function setCount(n:number){
  patch(tank.id,t=>{
   const channels=[...t.doserChannels];
   while(channels.length<n) channels.push({id:uid("dc"),name:`Channel ${channels.length+1}`,material:"",capacityMl:1000,currentMl:1000,consumption:0,period:"daily",color:colors[channels.length%colors.length]});
   return {...t,doserChannels:channels.slice(0,n)};
  });
 }
 function updateChannel(id:string,p:Partial<DoserChannel>){patch(tank.id,t=>({...t,doserChannels:t.doserChannels.map(x=>x.id===id?{...x,...p}:x)}))}
 function log(){
  if(!calc.valid||!dosingReady)return;
  const material=form==="product"?(lang==="ar"?"محلول تجاري":"Commercial product"):(lang==="ar"?chosen?.ar:chosen?.en)||chosen?.formula||param;
  const ts=nowISO();
  patch(tank.id,t=>{
   const channels=calc.steps===1&&calc.unit==="mL"?t.doserChannels.map(ch=>ch.material.trim().toLowerCase()===material.trim().toLowerCase()?{...ch,currentMl:Math.max(0,ch.currentMl-calc.amount)}:ch):t.doserChannels;
   const dose:any={id:uid("dose"),timestamp:ts,parameter:param,current:cur,target,ml:calc.unit==="mL"?calc.amount:0,amount:calc.amount,unit:calc.unit,material,calculatorMode:form,steps:calc.steps,perStep:calc.perStep,status:calc.steps>1?"planned":"logged"};
   const amountText=`${calc.amount.toFixed(calc.unit==="g"?2:1)} ${calc.unit}`;
   const perStepText=`${calc.perStep.toFixed(calc.unit==="g"?2:1)} ${calc.unit}`;
   const stepTasks=Array.from({length:calc.steps},(_,i)=>({id:uid("task"),title:`جرعة ${param} ${i+1}/${calc.steps}: ${perStepText}`,titleEn:`${param} dose ${i+1}/${calc.steps}: ${perStepText}`,cadence:"once" as const,done:false,nextDue:datePlusDays(i),manual:true}));
   const retestTasks=Array.from({length:calc.steps},(_,i)=>({id:uid("task"),title:`إعادة قياس ${param} بعد الجرعة ${i+1}/${calc.steps}`,titleEn:`Retest ${param} after dose ${i+1}/${calc.steps}`,cadence:"once" as const,done:false,nextDue:datePlusDays(i+1),manual:true}));
   return {...t,
    doserChannels:channels,
    dosing:[dose,...t.dosing],
    timeline:[{id:uid("ev"),timestamp:ts,type:"dosing",textAr:calc.steps>1?`تم إنشاء خطة تصحيح ${param} من ${cur} إلى ${target}: ${amountText} من ${material} مقسمة إلى ${calc.steps} جرعات (${perStepText} لكل جرعة).`:`تم تسجيل جرعة ${material}: ${amountText} لتصحيح ${param} من ${cur} إلى ${target}.`,textEn:calc.steps>1?`Created ${param} correction plan from ${cur} to ${target}: ${amountText} of ${material}, split into ${calc.steps} doses (${perStepText} each).`:`Logged ${material} dose: ${amountText} to correct ${param} from ${cur} to ${target}.`},...t.timeline],
    maintenance:[...t.maintenance,...stepTasks,...retestTasks]
   };
  });
 }
 function projectedDays(ch:DoserChannel){
  const daily=ch.period==="daily"?ch.consumption:ch.period==="weekly"?ch.consumption/7:ch.consumption/30;
  return daily>0?Math.floor(ch.currentMl/daily):null;
 }

 const amountLabel=calc.valid?`${calc.amount.toFixed(calc.unit==="g"?2:1)} ${calc.unit}`:"—";
 const stepLabel=calc.valid?`${calc.perStep.toFixed(calc.unit==="g"?2:1)} ${calc.unit}`:"—";
 const safetyLimit=param==="KH"?"1 dKH/day":param==="Mg"?"100 ppm/day":"25 ppm/day";

 return <section className="page-grid"><PageHeader eyebrow="DOSING & CHEMISTRY" title={tr(lang,"dosing")}/>

 <div className="card panel full-span">
  <div className="module-head"><div><h3>{lang==="ar"?"حاسبة الجرعات الكيميائية":"Chemical Dosing Calculator"}</h3><p className="note">{lang==="ar"?"تستخدم الحجم الحقيقي للنظام وآخر قراءة مسجلة وتحسب الكمية حسب نوع المركب أو تركيز المحلول.":"Uses real system volume and the latest reading to calculate the required amount by compound or solution strength."}</p></div><span className="scene-badge">{tank.systemVolumeLiters.toFixed(1)} L</span></div>

  <div className="form-grid">
   <label className="field"><span>{lang==="ar"?"البارامتر":"Parameter"}</span><select value={param} onChange={e=>setParam(e.target.value as DosingParameter)}>{availableParams.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
   <label className="field"><span>{lang==="ar"?"القراءة الحالية":"Current reading"}</span><input type="number" step="any" value={cur} onChange={e=>setCur(Number(e.target.value))}/></label>
   <label className="field"><span>{lang==="ar"?"الهدف":"Target"}</span><input type="number" step="any" value={target} onChange={e=>setTarget(Number(e.target.value))}/></label>
   <label className="field"><span>{lang==="ar"?"شكل الجرعة":"Dose form"}</span><select value={form} onChange={e=>setForm(e.target.value as DosingForm)}><option value="dry">{lang==="ar"?"مادة جافة":"Dry compound"}</option><option value="stock">{lang==="ar"?"محلول محضر بتركيز معروف":"Known stock solution"}</option><option value="product">{lang==="ar"?"منتج تجاري حسب الملصق":"Commercial product label"}</option></select></label>
  </div>

  {form!=="product"&&<div className="form-grid" style={{marginTop:12}}>
   <label className="field"><span>{lang==="ar"?"المركب":"Compound"}</span><select value={chosen?.id||""} onChange={e=>setPresetId(e.target.value)}>{presets.map(x=><option value={x.id} key={x.id}>{lang==="ar"?x.ar:x.en} — {x.formula}</option>)}</select></label>
   <label className="field"><span>{lang==="ar"?"النقاوة %":"Purity %"}</span><input type="number" min="1" max="100" step="1" value={purity} onChange={e=>setPurity(Number(e.target.value))}/></label>
   {form==="stock"&&<label className="field"><span>{lang==="ar"?"تركيز المحلول غ/لتر":"Stock concentration g/L"}</span><input type="number" min="0" step="any" value={stockGramsPerLiter} onChange={e=>setStockGramsPerLiter(Number(e.target.value))}/></label>}
  </div>}

  {form==="product"&&<div className="form-grid" style={{marginTop:12}}>
   <label className="field full-field"><span>{lang==="ar"?`حسب ملصق المنتج: 1 mL لكل 100 L يرفع ${param} بمقدار`:`Product label: 1 mL per 100 L raises ${param} by`}</span><input type="number" min="0" step="any" value={productRaise||""} onChange={e=>setProductRaise(Number(e.target.value))} placeholder={lang==="ar"?"أدخل القيمة المكتوبة على العبوة":"Enter label value"}/></label>
  </div>}

  <div className="summary-strip" style={{marginTop:14}}>
   <div className="summary"><small>{lang==="ar"?"الفرق المطلوب":"Required change"}</small><b>{Math.max(0,target-cur).toFixed(2)} {param==="KH"?"dKH":"ppm"}</b></div>
   <div className="summary"><small>{lang==="ar"?"الكمية المحسوبة":"Calculated amount"}</small><b>{amountLabel}</b></div>
   <div className="summary"><small>{lang==="ar"?"عدد الأيام/الخطوات":"Days / steps"}</small><b>{calc.valid?calc.steps:"—"}</b></div>
   <div className="summary"><small>{lang==="ar"?"الكمية بكل خطوة":"Per step"}</small><b>{stepLabel}</b></div>
   <div className="summary"><small>{lang==="ar"?"حد الأمان اليومي":"Daily safety limit"}</small><b>{safetyLimit}</b></div>
  </div>

  {!dosingReady&&<div className="inline-alert danger" style={{marginTop:12}}><b>{lang==="ar"?"حماية الجرعات: يلزم قياس حديث وموثوق":"Dosing safety gate: a fresh reliable reading is required"}</b><p>{!latestReading?(lang==="ar"?"ما في قراءة كيمياء مسجلة. سجل فحصاً أولاً.":"No chemistry reading is logged. Record a test first."):latestParamValue===undefined?(lang==="ar"?`آخر فحص ما فيه قراءة ${param}.`:`Latest test does not include ${param}.`):dataIssue?(lang==="ar"?dataIssue.reasonAr:dataIssue.reasonEn):readingAgeHours>48?(lang==="ar"?`آخر قراءة أقدم من 48 ساعة (${Math.floor(readingAgeHours)} ساعة). أعد القياس قبل جرعة تصحيحية.`:`Latest reading is older than 48 hours (${Math.floor(readingAgeHours)}h). Retest before corrective dosing.`):""}</p></div>}
  {!calc.valid&&<div className="inline-alert warn" style={{marginTop:12}}>{form==="product"?(lang==="ar"?"أدخل قوة المنتج كما هي مكتوبة على العبوة حتى يتم الحساب.":"Enter the product strength from its label to calculate the dose."):(lang==="ar"?"تأكد أن الهدف أعلى من القراءة الحالية وأن بيانات التركيز صحيحة.":"Make sure the target is above the current reading and concentration data is valid.")}</div>}
  {calc.largeCorrection&&<div className="inline-alert warn" style={{marginTop:12}}>{lang==="ar"?`التصحيح كبير؛ قُسّم تلقائياً إلى ${calc.steps} جرعات يومية محافظة، وسيتم إنشاء مهمة جرعة ومهمة إعادة قياس لكل خطوة. لا تنفذ الخطوة التالية إذا لم تؤكد القراءة الجديدة الاستجابة المتوقعة.`:`This correction is large; it is automatically split into ${calc.steps} conservative daily doses. A dose task and retest task will be created for each step. Do not continue unless the new reading confirms the expected response.`}</div>}
  {form!=="product"&&<div className="note" style={{marginTop:10}}>{lang==="ar"?"الحساب للمركب المحدد كما هو مكتوب، لذلك يجب اختيار الشكل الكيميائي الصحيح (مثلاً سداسي الماء مقابل اللامائي) وإدخال النقاوة الفعلية.":"The calculation is specific to the selected chemical form. Choose the exact hydrate/anhydrous form and enter actual purity."}</div>}
  <div style={{marginTop:12}}><button className="btn primary" onClick={log} disabled={!calc.valid||!dosingReady}>{calc.steps>1?(lang==="ar"?"إنشاء خطة الجرعات الآمنة":"Create safe dosing plan"):(lang==="ar"?"تسجيل الجرعة وإنشاء مهمة إعادة قياس":"Log dose & create retest task")}</button></div>
 </div>

 <div className="card panel full-span">
  <div className="module-head"><h3>{tr(lang,"doserManager")}</h3><label className="field compact"><span>{tr(lang,"channels")}</span><input type="number" min="0" max="12" value={tank.doserChannels.length} onChange={e=>setCount(Number(e.target.value))}/></label></div>
  <div className="doser-editor-grid">{tank.doserChannels.map((ch,i)=>{const pct=Math.max(0,Math.min(100,ch.currentMl/ch.capacityMl*100)),days=projectedDays(ch);return <article className="doser-editor-card" key={ch.id}>
   <div className="doser-tank"><div className="doser-liquid animated-liquid" style={{height:`${pct}%`,background:ch.color}}/><div className="doser-info"><b>{ch.material||`Channel ${i+1}`}</b><span>{Math.round(ch.currentMl)} / {ch.capacityMl} mL</span><small>{pct.toFixed(0)}%</small></div></div>
   <div className="form-grid one-col">
    <label className="field"><span>{tr(lang,"liquid")}</span><input value={ch.material} onChange={e=>updateChannel(ch.id,{material:e.target.value})}/></label>
    <label className="field"><span>{tr(lang,"capacity")} mL</span><input type="number" value={ch.capacityMl} onChange={e=>updateChannel(ch.id,{capacityMl:Number(e.target.value)})}/></label>
    <label className="field"><span>{tr(lang,"remaining")} mL</span><input type="number" value={ch.currentMl} onChange={e=>updateChannel(ch.id,{currentMl:Number(e.target.value)})}/></label>
    <label className="field"><span>{tr(lang,"consumption")}</span><input type="number" step="any" value={ch.consumption} onChange={e=>updateChannel(ch.id,{consumption:Number(e.target.value)})}/></label>
    <label className="field"><span>{tr(lang,"period")}</span><select value={ch.period} onChange={e=>updateChannel(ch.id,{period:e.target.value as any})}><option value="daily">{tr(lang,"daily")}</option><option value="weekly">{tr(lang,"weekly")}</option><option value="monthly">{tr(lang,"monthly")}</option></select></label>
   </div>
   <div className="inline-alert info">{days===null?"—":`${days} ${lang==="ar"?"يوم متوقع حتى النفاد":"estimated days remaining"}`}</div>
  </article>})}</div>
 </div>

 <div className="card panel full-span"><h3>{tr(lang,"timeline")}</h3><div className="history-list">{tank.dosing.slice(0,20).map(x=>{const d:any=x;const amount=typeof d.amount==="number"?d.amount:x.ml;const unit=d.unit||"mL";return <div className="history-row" key={x.id}><b>{x.parameter}: {amount.toFixed(unit==="g"?2:1)} {unit}{d.material?` • ${d.material}`:""}{d.steps>1?` • ${d.steps} steps`:""}</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>})}</div></div>
 </section>;
}
