"use client";
import { useEffect,useMemo,useState } from "react";
import type { DoserChannel,DosingLog,Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
import { chemistryCatalogForTank } from "@/domain/chemistryProfile";
import { calculateDose,DOSING_PRESETS,type DosingForm,type DosingParameter } from "@/domain/dosingCalculator";
import { chemistryGuidance } from "@/domain/chemistryGuidance";
import { latestParameterSample,validateChemistryValue,validateDosingTarget } from "@/domain/chemistryDataQuality";
import { correctiveDosingInventory,inventoryProfile,routineDosingInventory } from "@/domain/inventoryIntelligence";

const colors=["#27c2dc","#62d48f","#f6c85f","#c877ff","#ff7e79","#4b8bff"];
function idealTarget(tank:Tank,param:DosingParameter){const meta:any=chemistryCatalogForTank(tank)?.[param];return meta?.ideal?(Number(meta.ideal[0])+Number(meta.ideal[1]))/2:param==="KH"?8:param==="Ca"?430:1325;}
function datePlusDays(days:number){return new Date(Date.now()+days*86400000).toISOString().slice(0,10);}

export function DosingPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),availableParams:DosingParameter[]=tank.type==="marine"?["KH","Ca","Mg"]:["KH"];
 const [param,setParam]=useState<DosingParameter>("KH"),[target,setTarget]=useState(()=>idealTarget(tank,"KH")),[form,setForm]=useState<DosingForm>("dry"),[presetId,setPresetId]=useState("nahco3"),[purity,setPurity]=useState(100),[stockGramsPerLiter,setStockGramsPerLiter]=useState(84),[productRaise,setProductRaise]=useState(0),[productName,setProductName]=useState(""),[inventoryItemId,setInventoryItemId]=useState(""),[routineItemId,setRoutineItemId]=useState(""),[routineAmount,setRoutineAmount]=useState(""),[showAdvanced,setShowAdvanced]=useState(false),[showDoser,setShowDoser]=useState(false);
 useEffect(()=>{setTarget(idealTarget(tank,param));const first=DOSING_PRESETS.find(x=>x.parameter===param);if(first)setPresetId(first.id);},[param,tank.id]);
 const presets=DOSING_PRESETS.filter(x=>x.parameter===param),chosen=presets.find(x=>x.id===presetId)??presets[0],guide=useMemo(()=>chemistryGuidance(tank),[tank]),sample=useMemo(()=>latestParameterSample(tank,param),[tank,param]);
 const correctiveStock=useMemo(()=>correctiveDosingInventory(tank,param,form,chosen?.id),[tank,param,form,chosen?.id]);
 const routineStock=useMemo(()=>routineDosingInventory(tank),[tank]);
 const routineItem=routineStock.find(x=>x.id===routineItemId);
 useEffect(()=>{if(inventoryItemId&&!correctiveStock.some(x=>x.id===inventoryItemId))setInventoryItemId("");},[inventoryItemId,correctiveStock]);
 const current=sample?.value,readingAgeHours=sample?Math.max(0,(Date.now()-new Date(sample.timestamp).getTime())/3600000):99999,currentIssue=current===undefined?undefined:validateChemistryValue(tank,param,current),dataIssue=guide.dataIssues.find(x=>x.key===param),targetCheck=useMemo(()=>validateDosingTarget(tank,param,target),[tank,param,target]);
 const latestCorrectiveExecution=useMemo(()=>tank.dosing
  .filter(x=>x.parameter===param&&x.calculatorMode!=="routine"&&x.status!=="planned")
  .map(x=>({log:x,at:new Date(x.lastExecutedAt||x.timestamp).getTime()}))
  .filter(x=>Number.isFinite(x.at))
  .sort((a,b)=>b.at-a.at)[0],[tank.dosing,param]);
 const sampleTime=sample?new Date(sample.timestamp).getTime():0;
 const needsPostDoseRetest=Boolean(sample&&latestCorrectiveExecution&&latestCorrectiveExecution.at>=sampleTime);
 const dosingReady=current!==undefined&&readingAgeHours<=48&&sample?.confidence!=="low"&&!currentIssue&&!dataIssue&&!needsPostDoseRetest&&!targetCheck.blocked;
 const calc=useMemo(()=>calculateDose({parameter:param,current:current??Number.NaN,target,volumeLiters:tank.systemVolumeLiters,form,presetId:chosen?.id,purityPercent:purity,stockGramsPerLiter,productRaisePerMlPer100L:productRaise}),[param,current,target,tank.systemVolumeLiters,form,chosen?.id,purity,stockGramsPerLiter,productRaise]);
 function setCount(n:number){patch(tank.id,t=>{const channels=[...t.doserChannels];while(channels.length<n)channels.push({id:uid("dc"),name:`Channel ${channels.length+1}`,material:"",capacityMl:1000,currentMl:1000,consumption:0,period:"daily",color:colors[channels.length%colors.length]});return {...t,doserChannels:channels.slice(0,n)};});}
 function updateChannel(id:string,p:Partial<DoserChannel>){patch(tank.id,t=>({...t,doserChannels:t.doserChannels.map(x=>x.id===id?{...x,...p}:x)}))}
 function log(){
  if(!calc.valid||!dosingReady||current===undefined||targetCheck.blocked)return;
  if(targetCheck.level==="warn"&&!window.confirm(lang==="ar"?`${targetCheck.ar} هل تريد المتابعة ضمن المجال الآمن؟`:`${targetCheck.en} Continue within the safe range?`))return;
  const stockItem=inventoryItemId?correctiveStock.find(x=>x.id===inventoryItemId):undefined;
  if(inventoryItemId&&!stockItem){window.alert(lang==="ar"?"مادة المخزون المختارة لا تطابق نوع الجرعة الحالية. أعد اختيار المادة.":"The selected inventory item does not match the current dosing setup. Select it again.");return}
  if(stockItem&&stockItem.unit.toLowerCase()!==calc.unit.toLowerCase()){window.alert(lang==="ar"?`وحدة المخزون ${stockItem.unit} لا تطابق وحدة الجرعة ${calc.unit}.`:`Inventory unit ${stockItem.unit} does not match dose unit ${calc.unit}.`);return}
  const neededNow=calc.steps>1?calc.perStep:calc.amount;
  if(stockItem&&stockItem.quantity<neededNow){window.alert(lang==="ar"?`المخزون غير كافٍ لأول جرعة. المطلوب ${neededNow.toFixed(calc.unit==="g"?2:1)} ${calc.unit} والمتوفر ${stockItem.quantity} ${stockItem.unit}.`:`Insufficient stock for the next dose. Required ${neededNow.toFixed(calc.unit==="g"?2:1)} ${calc.unit}; available ${stockItem.quantity} ${stockItem.unit}.`);return}
  const material=stockItem
   ?(lang==="ar"?stockItem.name:(stockItem.nameEn||stockItem.name))
   :form==="product"?(productName.trim()||(lang==="ar"?"منتج تجاري غير مسمى":"Unnamed commercial product"))
   :(lang==="ar"?chosen?.ar:chosen?.en)||chosen?.formula||param;
  const ts=nowISO(),doseId=uid("dose");
  patch(tank.id,t=>{
   const linked=t.inventory.find(x=>x.id===inventoryItemId);
   const consume=linked&&calc.steps===1?calc.amount:0;
   const channels=calc.steps===1&&calc.unit==="mL"?t.doserChannels.map(ch=>ch.material.trim().toLowerCase()===material.trim().toLowerCase()?{...ch,currentMl:Math.max(0,ch.currentMl-calc.amount)}:ch):t.doserChannels;
   const dose:DosingLog={id:doseId,timestamp:ts,parameter:param,current,target,ml:calc.unit==="mL"?calc.amount:0,amount:calc.amount,unit:calc.unit,material,calculatorMode:form,steps:calc.steps,perStep:calc.perStep,stepIndex:calc.steps>1?0:1,status:calc.steps>1?"planned":"logged",sourceReadingTimestamp:sample?.timestamp,systemVolumeLiters:t.systemVolumeLiters,lastExecutedAt:calc.steps===1?ts:undefined,inventoryItemId:linked?.id,verifyAfter:new Date(Date.now()+24*3600000).toISOString()};
   const amountText=`${calc.amount.toFixed(calc.unit==="g"?2:1)} ${calc.unit}`,perStepText=`${calc.perStep.toFixed(calc.unit==="g"?2:1)} ${calc.unit}`;
   const stepTasks=calc.steps>1?Array.from({length:calc.steps},(_,i)=>({id:uid("task"),title:`جرعة ${param} ${i+1}/${calc.steps}: ${perStepText}`,titleEn:`${param} dose ${i+1}/${calc.steps}: ${perStepText}`,cadence:"once" as const,done:false,nextDue:datePlusDays(i),manual:true,sourceDomain:"dosing" as const,sourceId:`dose-step:${doseId}:${i+1}`})):[];
   const retestTasks=Array.from({length:calc.steps},(_,i)=>({id:uid("task"),title:`إعادة قياس ${param} بعد الجرعة ${i+1}/${calc.steps}`,titleEn:`Retest ${param} after dose ${i+1}/${calc.steps}`,cadence:"once" as const,done:false,nextDue:datePlusDays(i+1),manual:true,sourceDomain:"dosing" as const,sourceId:`dose-retest:${doseId}:${i+1}`}));
   return {...t,
    inventory:consume?t.inventory.map(x=>x.id===linked?.id?{...x,quantity:Math.max(0,x.quantity-consume)}:x):t.inventory,
    doserChannels:channels,
    dosing:[dose,...t.dosing],
    timeline:[{id:uid("ev"),timestamp:ts,type:"dosing",textAr:calc.steps>1?`تم إنشاء خطة تصحيح ${param}: ${amountText} من ${material} على ${calc.steps} جرعات. المخزون سيُخصم عند تنفيذ كل خطوة.`:`تم تسجيل جرعة ${material}: ${amountText} اعتماداً على القراءة الموثقة ${current} للوصول إلى ${target}.`,textEn:calc.steps>1?`Created a ${param} correction plan: ${amountText} of ${material} over ${calc.steps} doses. Inventory will be deducted as each step is executed.`:`Logged ${material} dose: ${amountText}, based on verified reading ${current} toward ${target}.`},...t.timeline],
    maintenance:[...t.maintenance,...stepTasks,...retestTasks]
   };
  });
 }
 function logRoutineDose(){
  const item=routineStock.find(x=>x.id===routineItemId),q=Number(routineAmount);
  if(!item){window.alert(lang==="ar"?"اختر All For Reef أو المتمم من المخزون أولاً.":"Select All For Reef or a supplement from inventory first.");return}
  if(!Number.isFinite(q)||q<=0){window.alert(lang==="ar"?"أدخل الكمية المستخدمة فعلياً.":"Enter the amount actually used.");return}
  if(q>item.quantity){window.alert(lang==="ar"?`المخزون غير كافٍ. المتوفر ${item.quantity} ${item.unit}.`:`Insufficient stock. Available: ${item.quantity} ${item.unit}.`);return}
  const profile=inventoryProfile(item),ts=nowISO(),material=lang==="ar"?item.name:(item.nameEn||item.name);
  patch(tank.id,t=>({...t,
   inventory:t.inventory.map(x=>x.id===item.id?{...x,quantity:Math.max(0,x.quantity-q)}:x),
   dosing:[{id:uid("dose"),timestamp:ts,parameter:profile.subcategory==="balanced_reef"?"Balanced Reef":"Supplement",ml:item.unit.toLowerCase()==="ml"?q:0,amount:q,unit:item.unit,material,inventoryItemId:item.id,calculatorMode:"routine",steps:1,perStep:q,stepIndex:1,status:"logged",systemVolumeLiters:t.systemVolumeLiters,lastExecutedAt:ts},...t.dosing],
   timeline:[{id:uid("ev"),timestamp:ts,type:"dosing",textAr:`تم تسجيل جرعة روتينية من ${item.name}: ${q} ${item.unit} • المتبقي ${Math.max(0,item.quantity-q)} ${item.unit}.`,textEn:`Routine dose logged for ${item.nameEn||item.name}: ${q} ${item.unit} • remaining ${Math.max(0,item.quantity-q)} ${item.unit}.`},...t.timeline]
  }));
  setRoutineAmount("");
 }
 function projectedDays(ch:DoserChannel){const daily=ch.period==="daily"?ch.consumption:ch.period==="weekly"?ch.consumption/7:ch.consumption/30;return daily>0?Math.floor(ch.currentMl/daily):null;}
 const amountLabel=calc.valid?`${calc.amount.toFixed(calc.unit==="g"?2:1)} ${calc.unit}`:"—",stepLabel=calc.valid?`${calc.perStep.toFixed(calc.unit==="g"?2:1)} ${calc.unit}`:"—",safetyLimit=param==="KH"?"1 dKH/day":param==="Mg"?"100 ppm/day":"25 ppm/day";
 const noCorrectionNeeded=current!==undefined&&target<=current&&!targetCheck.blocked;
 const gateReason=!sample
  ?(lang==="ar"?`ما في قراءة حديثة لـ ${param}. سجّل القياس أولاً.`:`No recent ${param} reading is available. Log a measurement first.`)
  :sample.confidence==="low"
   ?(lang==="ar"?"ثقة القراءة منخفضة. أعد القياس قبل الجرعة.":"Reading confidence is low. Retest before dosing.")
   :currentIssue?(lang==="ar"?currentIssue.ar:currentIssue.en)
   :dataIssue?(lang==="ar"?dataIssue.reasonAr:dataIssue.reasonEn)
   :needsPostDoseRetest
    ?(lang==="ar"?`تم تنفيذ جرعة ${param} بعد آخر قراءة مسجلة. أعد قياس ${param} قبل أي تصحيح جديد؛ ما رح يعتمد Aqua Nexus على نفس القراءة مرتين.`:`A ${param} dose was executed after the latest recorded reading. Retest ${param} before any new correction; Aqua Nexus will not reuse the same reading twice.`)
   :readingAgeHours>48
    ?(lang==="ar"?`قراءة ${param} أقدم من 48 ساعة. أعد القياس قبل أي جرعة.`:`${param} reading is older than 48 hours. Retest before dosing.`)
    :targetCheck.blocked?(lang==="ar"?targetCheck.ar:targetCheck.en)
    :"";
 const missingSetup=calc.reason==="missing-product-strength"
  ?(lang==="ar"?"أدخل قوة المنتج المكتوبة على العبوة.":"Enter the product strength from the label.")
  :calc.reason==="missing-stock-strength"
   ?(lang==="ar"?"أدخل تركيز المحلول المحضّر.":"Enter the prepared stock concentration.")
   :!calc.valid&&!noCorrectionNeeded&&current!==undefined
    ?(lang==="ar"?"راجع الهدف وطريقة الجرعة حتى يكتمل الحساب.":"Review the target and dosing method to complete the calculation.")
    :"";
 const doseState=!dosingReady
  ?"blocked"
  :noCorrectionNeeded
   ?"none"
   :calc.valid
    ?"ready"
    :"setup";
 const doseHeadline=lang==="ar"
  ?doseState==="blocked"?"الجرعة موقوفة حالياً":doseState==="none"?"ما في جرعة تصحيحية مطلوبة":doseState==="ready"?(calc.steps>1?"الخطة جاهزة بأمان":"الجرعة جاهزة للتسجيل"):"باقي معلومة واحدة للحساب"
  :doseState==="blocked"?"Dosing is currently blocked":doseState==="none"?"No corrective dose is needed":doseState==="ready"?(calc.steps>1?"Safe plan is ready":"Dose is ready to log"):"One setup detail is still needed";
 const doseAction=lang==="ar"
  ?doseState==="blocked"?gateReason:doseState==="none"?`القراءة الحالية ${current} ليست أقل من الهدف ${target}. راقب فقط ولا تضف جرعة تصحيحية.`:doseState==="ready"?(calc.steps>1?`ابدأ بالخطوة الأولى فقط: ${stepLabel}. بعدها أعد قياس ${param} قبل الخطوة التالية.`:`الكمية الحالية: ${amountLabel}. بعد التنفيذ رح ينشئ Aqua Nexus مهمة إعادة قياس.`):missingSetup
  :doseState==="blocked"?gateReason:doseState==="none"?`Current value ${current} is not below the target ${target}. Monitor only; do not add a corrective dose.`:doseState==="ready"?(calc.steps>1?`Start only with step 1: ${stepLabel}. Retest ${param} before the next step.`:`Current amount: ${amountLabel}. Aqua Nexus will create a retest task after logging.`):missingSetup;
 return <section className="page-grid dosing-page"><PageHeader eyebrow="DOSING & CHEMISTRY" title={tr(lang,"dosing")}/>

 <section className="card panel full-span dosing-command-card">
  <div className="module-head"><div><small className="eyebrow-mini">{lang==="ar"?"قرار الجرعة الآن":"DOSING DECISION NOW"}</small><h3>{doseHeadline}</h3><p className="note">{doseAction}</p></div><span className={`status ${doseState==="blocked"?"danger":doseState==="ready"?"good":doseState==="setup"?"warn":""}`}>{doseState==="blocked"?(lang==="ar"?"موقوف":"BLOCKED"):doseState==="ready"?(lang==="ar"?"جاهز":"READY"):doseState==="none"?(lang==="ar"?"مراقبة":"MONITOR"):(lang==="ar"?"إعداد":"SETUP")}</span></div>
  <div className="dosing-first-look">
   <div><small>{lang==="ar"?"شو القراءة؟":"Current reading"}</small><b>{current===undefined?"—":`${current} ${param==="KH"?"dKH":"ppm"}`}</b><span>{sample?(lang==="ar"?`منذ ${Math.max(0,Math.floor(readingAgeHours))} ساعة • ${sample.confidence}`:`${Math.max(0,Math.floor(readingAgeHours))}h ago • ${sample.confidence}`):(lang==="ar"?"ما في قياس موثّق":"No verified measurement")}</span></div>
   <div><small>{lang==="ar"?"شو الهدف؟":"Target"}</small><b>{target} {param==="KH"?"dKH":"ppm"}</b><span>{lang==="ar"?"الهدف محكوم بمجال الأمان":"Target is checked against the safe range"}</span></div>
   <div><small>{lang==="ar"?"شو أعمل؟":"What should I do?"}</small><b>{doseState==="ready"?(calc.steps>1?stepLabel:amountLabel):doseState==="none"?(lang==="ar"?"لا تضيف جرعة":"Do not dose"):(lang==="ar"?"كمّل الشرط أولاً":"Complete the safety gate")}</b><span>{doseState==="ready"?(calc.steps>1?(lang==="ar"?`خطوة 1 من ${calc.steps}`:`Step 1 of ${calc.steps}`):(lang==="ar"?"جرعة واحدة + إعادة قياس":"Single dose + retest")):(lang==="ar"?"Aqua Nexus ما رح يسمح بالتنفيذ قبل الجاهزية":"Aqua Nexus will not allow execution before readiness")}</span></div>
  </div>
 </section>

 <section className="card panel full-span">
  <div className="module-head"><div><small className="eyebrow-mini">{lang==="ar"?"إعداد موجّه":"GUIDED SETUP"}</small><h3>{lang==="ar"?"اختار المادة والهدف، والباقي على النظام":"Choose the target and material; the system handles the rest"}</h3><p className="note">{lang==="ar"?"القيم الحساسة مخفية عن الواجهة الأساسية. القراءة الحالية تؤخذ فقط من Chemistry ولا يمكن تعديلها من هون.":"Sensitive technical values stay out of the primary flow. The current reading comes only from Chemistry and cannot be overridden here."}</p></div><button className="btn" onClick={()=>setShowAdvanced(v=>!v)}>{showAdvanced?(lang==="ar"?"إخفاء Advanced":"Hide Advanced"):(lang==="ar"?"Advanced":"Advanced")}</button></div>

  <div className="dosing-guided-grid">
   <label className="field"><span>{lang==="ar"?"شو بدك تصحح؟":"What are you correcting?"}</span><select value={param} onChange={e=>setParam(e.target.value as DosingParameter)}>{availableParams.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
   <label className="field"><span>{lang==="ar"?"القراءة الحالية":"Current reading"}</span><input type="number" step="any" value={current??""} readOnly placeholder={lang==="ar"?"سجّل قياس بالكيمياء أولاً":"Log a chemistry reading first"}/>{sample&&<small>{new Date(sample.timestamp).toLocaleString()}</small>}</label>
   <label className="field"><span>{lang==="ar"?"الهدف":"Target"}</span><input type="number" step="any" value={target} onChange={e=>setTarget(Number(e.target.value))}/></label>
   <label className="field"><span>{lang==="ar"?"شو رح تستخدم؟":"What will you use?"}</span><select value={form} onChange={e=>{setForm(e.target.value as DosingForm);setInventoryItemId("")}}><option value="dry">{lang==="ar"?"بودرة / مادة جافة":"Dry compound"}</option><option value="stock">{lang==="ar"?"محلول أنا محضّره":"Prepared stock solution"}</option><option value="product">{lang==="ar"?"منتج تجاري جاهز":"Commercial product"}</option></select></label>
   <label className="field"><span>{lang==="ar"?"المادة المطابقة من المخزون":"Matching inventory item"}</span><select value={inventoryItemId} onChange={e=>setInventoryItemId(e.target.value)}><option value="">{lang==="ar"?"بدون ربط بالمخزون":"Not linked to inventory"}</option>{correctiveStock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)} • {x.quantity} {x.unit}</option>)}</select><small>{correctiveStock.length?lang==="ar"?"يظهر فقط المخزون المطابق لنوع الجرعة الحالية.":"Only stock matching the current correction is shown.":lang==="ar"?"ما في مادة مطابقة بالمخزون؛ يمكنك الحساب بدون خصم أو إضافة المادة الدقيقة للمخزون.":"No matching stock item; you can calculate without deduction or add the exact material to inventory."}</small></label>
  </div>

  {form!=="product"&&<div className="form-grid" style={{marginTop:12}}><label className="field"><span>{lang==="ar"?"اسم المادة":"Material"}</span><select value={chosen?.id||""} onChange={e=>setPresetId(e.target.value)}>{presets.map(x=><option value={x.id} key={x.id}>{lang==="ar"?x.ar:x.en} — {x.formula}</option>)}</select></label>{form==="stock"&&<label className="field"><span>{lang==="ar"?"كم غرام حطيت بكل لتر من المحلول؟":"How many grams are in each liter?"}</span><input type="number" min="0" step="any" value={stockGramsPerLiter||""} onChange={e=>setStockGramsPerLiter(Number(e.target.value))}/><small>{lang==="ar"?"هاي المعلومة ضرورية لأن تركيز المحلول بيغيّر كمية الـmL المطلوبة.":"This is required because solution strength changes the required mL."}</small></label>}</div>}
  {form==="product"&&<div className="form-grid" style={{marginTop:12}}><label className="field"><span>{lang==="ar"?"اسم المنتج التجاري":"Commercial product name"}</span><input value={productName} onChange={e=>setProductName(e.target.value)} placeholder={lang==="ar"?"مثال: منتج KH محدد":"e.g. a specific KH product"}/></label><label className="field"><span>{lang==="ar"?`من العبوة: 1 mL لكل 100 L بيرفع ${param} قديش؟`:`From the label: how much does 1 mL per 100 L raise ${param}?`}</span><input type="number" min="0" step="any" value={productRaise||""} onChange={e=>setProductRaise(Number(e.target.value))} placeholder={lang==="ar"?"اكتب الرقم الموجود على الملصق":"Enter the label value"}/></label></div>}

  {showAdvanced&&<div className="dosing-advanced">
   <div className="module-head"><div><h4>{lang==="ar"?"ضبط دقيق وحسابات متقدمة":"Fine tuning & advanced calculation"}</h4><p className="note">{lang==="ar"?"هاي التفاصيل مو مطلوبة لمعظم الاستخدام اليومي، لكنها موجودة للمستخدم الخبير وللمواد غير القياسية.":"These details are not needed for most daily use, but remain available for expert and non-standard setups."}</p></div></div>
   <div className="form-grid">
    {form!=="product"&&<label className="field"><span>{lang==="ar"?"النقاوة الفعلية للمادة %":"Actual material purity %"}</span><input type="number" min="1" max="100" step="1" value={purity} onChange={e=>setPurity(Number(e.target.value))}/></label>}
   </div>
   <div className="summary-strip" style={{marginTop:12}}>
    <div className="summary"><small>{lang==="ar"?"فرق التصحيح":"Required change"}</small><b>{current===undefined?"—":Math.max(0,target-current).toFixed(2)} {param==="KH"?"dKH":"ppm"}</b></div>
    <div className="summary"><small>{lang==="ar"?"الإجمالي المحسوب":"Calculated total"}</small><b>{amountLabel}</b></div>
    <div className="summary"><small>{lang==="ar"?"عدد الخطوات":"Steps"}</small><b>{calc.valid?calc.steps:"—"}</b></div>
    <div className="summary"><small>{lang==="ar"?"كل خطوة":"Per step"}</small><b>{stepLabel}</b></div>
    <div className="summary"><small>{lang==="ar"?"حد الأمان اليومي":"Daily safety limit"}</small><b>{safetyLimit}</b></div>
   </div>
  </div>}

  <div className={`inline-alert ${targetCheck.level==="danger"?"danger":targetCheck.level==="warn"?"warn":"good"}`} style={{marginTop:12}}>{lang==="ar"?targetCheck.ar:targetCheck.en}</div>
  {doseState==="blocked"&&<div className="inline-alert danger" style={{marginTop:10}}><b>{lang==="ar"?"ليش الجرعة موقوفة؟":"Why is dosing blocked?"}</b><p>{gateReason}</p></div>}
  {doseState==="setup"&&<div className="inline-alert warn" style={{marginTop:10}}><b>{lang==="ar"?"شو ناقص؟":"What is missing?"}</b><p>{missingSetup}</p></div>}
  {calc.largeCorrection&&doseState==="ready"&&<div className="inline-alert warn" style={{marginTop:10}}><b>{lang==="ar"?`التصحيح كبير، لذلك انقسم إلى ${calc.steps} خطوات.`:`This is a large correction, so it is split into ${calc.steps} steps.`}</b><p>{lang==="ar"?"نفّذ خطوة واحدة فقط، وبعدها أعد القياس. الخطوة التالية ما لازم تعتمد على الحساب القديم بدون تحقق.":"Do one step only, then retest. Do not continue the next step from the old calculation without verification."}</p></div>}

  <div className="dosing-primary-action">
   <div><small>{lang==="ar"?"الإجراء الحالي":"CURRENT ACTION"}</small><b>{doseAction}</b></div>
   <button className="btn primary" onClick={log} disabled={doseState!=="ready"||!calc.valid||targetCheck.blocked}>{calc.steps>1?(lang==="ar"?"إنشاء الخطة الآمنة":"Create safe plan"):(lang==="ar"?"تسجيل الجرعة":"Log dose")}</button>
  </div>
 </section>

 <section className="card panel full-span">
  <div className="module-head"><div><small className="eyebrow-mini">BALANCED REEF & SUPPLEMENTS</small><h3>{lang==="ar"?"جرعات روتينية منفصلة عن التصحيح":"Routine dosing, separate from corrective dosing"}</h3><p className="note">{lang==="ar"?"All For Reef والعناصر النادرة والأحماض الأمينية والبكتيريا لا تدخل في حاسبة تصحيح KH/Ca/Mg. سجّل هنا فقط الكمية التي استخدمتها فعلياً، وسيُخصم المخزون مباشرة.":"All For Reef, trace elements, amino acids and bacteria do not use the KH/Ca/Mg correction calculator. Log only the amount actually used here; inventory is deducted immediately."}</p></div></div>
  {routineStock.length===0?<div className="inline-alert info">{lang==="ar"?"ما في All For Reef أو متممات مصنفة بالمخزون حالياً.":"No balanced reef products or supplements are currently classified in inventory."}</div>:<div className="form-grid"><label className="field"><span>{lang==="ar"?"المادة":"Material"}</span><select value={routineItemId} onChange={e=>setRoutineItemId(e.target.value)}><option value="">{lang==="ar"?"اختر من المخزون":"Select from inventory"}</option>{routineStock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)} • {x.quantity} {x.unit}</option>)}</select></label><label className="field"><span>{lang==="ar"?"الكمية المستخدمة":"Amount used"}</span><input type="number" min="0" step="any" value={routineAmount} disabled={!routineItem} onChange={e=>setRoutineAmount(e.target.value)} placeholder={routineItem?.unit||""}/></label><div className="field"><span>&nbsp;</span><button className="btn primary" disabled={!routineItem||!(Number(routineAmount)>0)} onClick={logRoutineDose}>{lang==="ar"?"تسجيل وخصم المخزون":"Log & deduct inventory"}</button></div></div>}
 </section>

 <section className="card panel full-span">
  <div className="module-head"><div><small className="eyebrow-mini">AUTOMATIC DOSER</small><h3>{tr(lang,"doserManager")}</h3><p className="note">{lang==="ar"?`عندك ${tank.doserChannels.length} قناة مسجلة. إدارة المضخة منفصلة عن قرار الجرعة اليدوي فوق.`:`${tank.doserChannels.length} channel(s) are registered. Pump management is separate from the manual dosing decision above.`}</p></div><button className="btn" onClick={()=>setShowDoser(v=>!v)}>{showDoser?(lang==="ar"?"إخفاء الإدارة":"Hide manager"):(lang==="ar"?"إدارة الدوزر":"Manage doser")}</button></div>
  {!showDoser&&<div className="summary-strip"><div className="summary"><small>{lang==="ar"?"القنوات":"Channels"}</small><b>{tank.doserChannels.length}</b></div><div className="summary"><small>{lang==="ar"?"قنوات قريبة من النفاد":"Low channels"}</small><b>{tank.doserChannels.filter(ch=>ch.capacityMl>0&&ch.currentMl/ch.capacityMl<.2).length}</b></div></div>}
  {showDoser&&<><label className="field compact" style={{maxWidth:180,marginBottom:12}}><span>{tr(lang,"channels")}</span><input type="number" min="0" max="12" value={tank.doserChannels.length} onChange={e=>setCount(Number(e.target.value))}/></label><div className="doser-editor-grid">{tank.doserChannels.map((ch,i)=>{const pct=Math.max(0,Math.min(100,ch.currentMl/ch.capacityMl*100)),days=projectedDays(ch);return <article className="doser-editor-card" key={ch.id}><div className="doser-tank"><div className="doser-liquid animated-liquid" style={{height:`${pct}%`,background:ch.color}}/><div className="doser-info"><b>{ch.material||`Channel ${i+1}`}</b><span>{Math.round(ch.currentMl)} / {ch.capacityMl} mL</span><small>{pct.toFixed(0)}%</small></div></div><div className="form-grid one-col"><label className="field"><span>{tr(lang,"liquid")}</span><input value={ch.material} onChange={e=>updateChannel(ch.id,{material:e.target.value})}/></label><label className="field"><span>{tr(lang,"capacity")} mL</span><input type="number" value={ch.capacityMl} onChange={e=>updateChannel(ch.id,{capacityMl:Number(e.target.value)})}/></label><label className="field"><span>{tr(lang,"remaining")} mL</span><input type="number" value={ch.currentMl} onChange={e=>updateChannel(ch.id,{currentMl:Number(e.target.value)})}/></label><label className="field"><span>{tr(lang,"consumption")}</span><input type="number" step="any" value={ch.consumption} onChange={e=>updateChannel(ch.id,{consumption:Number(e.target.value)})}/></label><label className="field"><span>{tr(lang,"period")}</span><select value={ch.period} onChange={e=>updateChannel(ch.id,{period:e.target.value as any})}><option value="daily">{tr(lang,"daily")}</option><option value="weekly">{tr(lang,"weekly")}</option><option value="monthly">{tr(lang,"monthly")}</option></select></label></div><div className="inline-alert info">{days===null?"—":`${days} ${lang==="ar"?"يوم متوقع حتى النفاد":"estimated days remaining"}`}</div></article>})}</div></>}
 </section>

 <section className="card panel full-span">
  <div className="module-head"><div><small className="eyebrow-mini">{lang==="ar"?"سجل التنفيذ":"HISTORY"}</small><h3>{tr(lang,"timeline")}</h3></div><span className="status">{tank.dosing.length}</span></div>
  {tank.dosing.length===0?<div className="inline-alert info">{lang==="ar"?"لسا ما في جرعات مسجلة. أول جرعة رح تظهر هون مع القراءة والهدف وخطة إعادة القياس.":"No doses are logged yet. The first one will appear here with its source reading, target and retest plan."}</div>:<div className="history-list">{tank.dosing.slice(0,20).map(x=>{const d:any=x,amount=typeof d.amount==="number"?d.amount:x.ml,unit=d.unit||"mL";return <div className="history-row" key={x.id}><b>{x.parameter}: {amount.toFixed(unit==="g"?2:1)} {unit}{d.material?` • ${d.material}`:""}{d.steps>1?` • ${d.steps} steps`:""}</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>})}</div>}
 </section>

 <style jsx>{`
  .dosing-command-card{display:grid;gap:12px;background:linear-gradient(135deg,rgba(12,44,59,.88),rgba(4,24,34,.94))}
  .dosing-first-look{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
  .dosing-first-look>div{display:grid;gap:3px;padding:11px 12px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:rgba(255,255,255,.025)}
  .dosing-first-look small{font-size:10px;opacity:.62;font-weight:800}.dosing-first-look b{font-size:16px;line-height:1.3}.dosing-first-look span{font-size:10px;opacity:.66}
  .dosing-guided-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
  .dosing-advanced{margin-top:12px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.02)}
  .dosing-primary-action{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px;padding:12px 14px;border:1px solid rgba(75,220,206,.18);border-radius:14px;background:rgba(75,220,206,.045)}
  .dosing-primary-action>div{display:grid;gap:3px;min-width:0}.dosing-primary-action small{font-size:9px;opacity:.6;font-weight:800}.dosing-primary-action b{font-size:13px;line-height:1.4}
  @media(max-width:900px){.dosing-guided-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:620px){.dosing-first-look,.dosing-guided-grid{grid-template-columns:1fr}.dosing-primary-action{align-items:stretch;flex-direction:column}.dosing-primary-action .btn{width:100%}}
 `}</style>
 </section>;
}