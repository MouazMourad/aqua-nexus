import type { Tank } from "./types";
import { bioload, chemistryHealth, maintenanceHealth } from "./health";
import { smartInsights } from "./smartInsights";
import { tankForecast, tankStateView } from "./tankIntelligence";
import { biologicalMemory, eventChemistryLinks, proactivePredictions, tankMood } from "./tankLearning";
import { analyzeNutrients } from "./nutrientEngine";
import { tankEnergy } from "./equipmentIntelligence";
import { chemistryGuidance } from "./chemistryGuidance";
import { parseAquaQuestion,type AquaQuestionIntent,type AquaQuestionParam } from "./aquaAIIntent";
import { reasonLocally } from "./aquaAILocalReasoner";
import { stockingReadiness } from "./stockingReadiness";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { answerAquaQuery } from "./aquaAIQueryEngine";
import { tankIntelligenceCore } from "./intelligenceCore";
import { maintenanceEffectiveState } from "./maintenanceSchedule";
import { biologicalCycleStatus } from "./biologicalCycle";
import { buildAquaAIQueryPlan } from "./aquaAIQueryPlan";
import { answerBiologicalCycleQuestion } from "./biologicalCycleKnowledge";
import { isAquariumScopedQuestion,offTopicAquaAnswer } from "./aquaAIScope";
import { tankLearningMaturity } from "./tankPatterns";

export type AquaAIConfidence="low"|"medium"|"high";
export type AquaAIPage="dashboard"|"chemistry"|"maintenance"|"equipment"|"livestock"|"timeline"|"dosing"|"quarantine"|"emergency"|"rodi"|"journal"|"acclimation"|"inventory"|"feeding"|"waterchange"|"expenses"|"sump"|"diseases"|"alerts";

export interface AquaAIAction {
  page:AquaAIPage;
  ar:string;
  en:string;
}

export interface AquaAIAnswer {
  titleAr:string;
  titleEn:string;
  summaryAr:string;
  summaryEn:string;
  detailsAr:string[];
  detailsEn:string[];
  evidenceAr:string[];
  evidenceEn:string[];
  confidence:AquaAIConfidence;
  /** Evidence required for this answer but not currently available. */
  missingEvidenceAr?:string[];
  missingEvidenceEn?:string[];
  /** Keeps observed facts separate from interpretations/recommendations. */
  factsAr?:string[];
  factsEn?:string[];
  inferencesAr?:string[];
  inferencesEn?:string[];
  action?:AquaAIAction;
}

const DAY=86400000;
const PARAMS=["KH","Ca","Mg","NO3","PO4","pH","salinity","temperature","NH3","NO2","GH","TDS"] as const;
type Param=typeof PARAMS[number];

function n(v:unknown){return typeof v==="number"&&Number.isFinite(v)?v:undefined;}
function fmt(param:string,value:number){
  if(param==="PO4")return value.toFixed(3);
  if(param==="salinity")return value.toFixed(3);
  if(param==="KH"||param==="pH")return value.toFixed(2);
  return value.toFixed(1);
}
function unit(param:string){return param==="KH"?"dKH":param==="salinity"?"SG":param==="pH"?"":param==="temperature"?"°C":"ppm";}
function textParam(q:string):Param|undefined{
  const s=q.toLowerCase();
  if(/\bkh\b|alkal|قلو|الكربونات/.test(s))return "KH";
  if(/\bca\b|calcium|كالسيوم/.test(s))return "Ca";
  if(/\bmg\b|magnesium|مغنيسيوم/.test(s))return "Mg";
  if(/\bno3\b|nitrate|نترات/.test(s))return "NO3";
  if(/\bpo4\b|phosphate|فوسفات/.test(s))return "PO4";
  if(/\bph\b|حموض/.test(s))return "pH";
  if(/salin|ملوح/.test(s))return "salinity";
  if(/temp|حرار/.test(s))return "temperature";
  return undefined;
}
function confidence(tank:Tank):AquaAIConfidence{
  const readings=tank.chemistry.length;
  const events=tank.timeline.length;
  if(readings>=5&&events>=8)return "high";
  if(readings>=2&&events>=3)return "medium";
  return "low";
}
function latestValue(tank:Tank,param:Param){return n(tank.chemistry[0]?.values?.[param]);}
function previousValue(tank:Tank,param:Param){return n(tank.chemistry[1]?.values?.[param]);}
function recentEvents(tank:Tank,days=14){
  const cutoff=Date.now()-days*DAY;
  return tank.timeline.filter(x=>new Date(x.timestamp).getTime()>=cutoff);
}
function ageDays(timestamp?:string){
  if(!timestamp)return undefined;
  const t=new Date(timestamp).getTime();
  return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/DAY)):undefined;
}
function normText(s:string){return (s||"").toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[^a-z0-9\u0600-\u06ff]+/g," ").replace(/\s+/g," ").trim();}
function candidateFromQuestion(question:string,tank:Tank){
 const q=normText(question);
 const rows=(LIVESTOCK_LIBRARY as readonly any[]).filter(x=>!x.type||x.type===tank.type);
 const scored=rows.map(x=>{
  const names=[x.ar,x.en,x.id].filter(Boolean).map((v:string)=>normText(v));
  const match=Math.max(0,...names.map((n:string)=>q.includes(n)?n.length:0));
  return{x,match};
 }).filter(x=>x.match>2).sort((a,b)=>b.match-a.match);
 return scored[0]?.x;
}
function quantityFromQuestion(question:string){
 const map:any={"٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9"};
 const normalized=(question||"").replace(/[٠-٩]/g,m=>map[m]||m);
 const m=normalized.match(/(?:x|×|عدد|qty|quantity)?\s*(\d{1,2})/i);
 const n=m?Number(m[1]):1;
 return Number.isFinite(n)&&n>0?Math.min(50,n):1;
}

export function nextBestAction(tank:Tank):AquaAIAction{
  const core=tankIntelligenceCore(tank);
  const primary=core.actions[0];
  if(primary)return {page:primary.page as AquaAIPage,ar:primary.ar,en:primary.en};
  return {page:"dashboard",ar:"استمر بالمراقبة وسجّل أي تغير مهم",en:"Keep monitoring and log meaningful changes"};
}

function parameterAnswer(tank:Tank,param:Param):AquaAIAnswer{
  const current=latestValue(tank,param),previous=previousValue(tank,param);
  const guidance=chemistryGuidance(tank).all.find(x=>x.key===param);
  const prediction=proactivePredictions(tank).find(x=>x.parameter===param);
  const links=eventChemistryLinks(tank).filter(x=>x.chemistryChanges.some(c=>c.parameter===param)).slice(0,2);
  const doses=tank.dosing.filter((x:any)=>String(x.parameter||"").toLowerCase()===param.toLowerCase()).slice(0,3);
  const detailsAr:string[]=[],detailsEn:string[]=[];
  if(current!==undefined){
    detailsAr.push(`آخر قراءة ${param}: ${fmt(param,current)} ${unit(param)}.`.trim());
    detailsEn.push(`Latest ${param}: ${fmt(param,current)} ${unit(param)}.`.trim());
  }
  if(current!==undefined&&previous!==undefined){
    const d=current-previous;
    detailsAr.push(`مقارنة بالقراءة السابقة: ${d>=0?"ارتفع":"انخفض"} بمقدار ${Math.abs(d).toFixed(param==="PO4"?3:2)}.`);
    detailsEn.push(`Versus the previous reading: ${d>=0?"up":"down"} ${Math.abs(d).toFixed(param==="PO4"?3:2)}.`);
  }
  if(prediction){detailsAr.push(prediction.ar);detailsEn.push(prediction.en);}
  if(links[0]){
    detailsAr.push(`ارتباط زمني محتمل: ${links[0].ar}`);
    detailsEn.push(`Possible temporal link: ${links[0].en}`);
  }
  if(doses.length){
    detailsAr.push(`يوجد ${doses.length} تسجيل جرعة حديثة لـ ${param} ضمن السجل المتاح.`);
    detailsEn.push(`${doses.length} recent ${param} dose log(s) are available in the visible history.`);
  }
  if(guidance){detailsAr.unshift(guidance.reasonAr);detailsAr.push(`الإجراء المقترح: ${guidance.actionAr}`);detailsEn.unshift(guidance.reasonEn);detailsEn.push(`Suggested action: ${guidance.actionEn}`);}
  if(!detailsAr.length){detailsAr.push(`لا توجد بيانات كافية عن ${param} لهذا الحوض حتى الآن.`);detailsEn.push(`There is not enough ${param} data for this tank yet.`);}
  return {
    titleAr:`تحليل ${param} لهذا الحوض`,titleEn:`${param} analysis for this tank`,
    summaryAr:guidance?(guidance.suspectedFormat?`في قراءة ${param} مشكلة تنسيق محتملة ويجب تصحيح البيانات قبل تعديل الحوض.`:`${guidance.reasonAr} ${guidance.actionAr}`):(prediction?`يوجد نمط قابل للقياس لـ ${param} ويمكن استخدامه للتنبؤ المبكر.`:`يمكن وصف اتجاه ${param} حالياً، لكن التنبؤ الشخصي يتحسن مع المزيد من القراءات.`),
    summaryEn:guidance?(guidance.suspectedFormat?`The ${param} reading may be misformatted; correct the data before changing the tank.`:`${guidance.reasonEn} ${guidance.actionEn}`):(prediction?`There is a measurable ${param} pattern that can support an early forecast.`:`I can describe the current ${param} direction; personalized forecasting improves with more readings.`),
    detailsAr,detailsEn,
    evidenceAr:[`${tank.chemistry.length} قراءة كيميائية`,`${links.length} ارتباط حدث قريب`,`${doses.length} جرعات مسجلة`],
    evidenceEn:[`${tank.chemistry.length} chemistry readings`,`${links.length} nearby event link(s)`,`${doses.length} logged doses`],
    confidence:confidence(tank),
    action:["KH","Ca","Mg"].includes(param)?{page:"dosing",ar:"افتح الجرعات والحاسبة",en:"Open dosing & calculator"}:{page:"chemistry",ar:"افتح الكيمياء",en:"Open chemistry"}
  };
}

function memoryAnswer(tank:Tank):AquaAIAnswer{
  const memory=biologicalMemory(tank);
  const links=eventChemistryLinks(tank);
  const maturity=tankLearningMaturity(tank);
  const rows=memory.slice(0,4);
  return {
    titleAr:"الذاكرة البيولوجية للحوض",titleEn:"Tank biological memory",
    summaryAr:rows.length?`${maturity.ar} أربط القرارات السابقة بما ظهر بعدها على الصحة والكيمياء كعلاقة زمنية، مو كإثبات سببية.`:maturity.ar,
    summaryEn:rows.length?`${maturity.en} I link past actions with later health and chemistry changes as temporal associations, not proof of causation.`:maturity.en,
    detailsAr:rows.map(x=>x.ar),detailsEn:rows.map(x=>x.en),
    evidenceAr:[`نضج التعلم ${maturity.score}% • ${maturity.level}`,`${maturity.measuredReadings} قراءة عبر ${maturity.observedDays} يوم`,`${maturity.repeatedPatterns} نمط استجابة متكرر`,`${maturity.linkedEvents} ربط كيميائي مع أحداث`],
    evidenceEn:[`Learning maturity ${maturity.score}% • ${maturity.level}`,`${maturity.measuredReadings} readings across ${maturity.observedDays} days`,`${maturity.repeatedPatterns} repeated response pattern(s)`,`${maturity.linkedEvents} chemistry-event link(s)`],
    confidence:maturity.confidence,action:{page:"timeline",ar:"افتح الخط الزمني",en:"Open timeline"}
  };
}

function forecastAnswer(tank:Tank):AquaAIAnswer{
  const f=tankForecast(tank),pred=proactivePredictions(tank);
  return {
    titleAr:"التوقع الاستباقي",titleEn:"Proactive outlook",
    summaryAr:f.ar,summaryEn:f.en,
    detailsAr:pred.length?pred.slice(0,4).map(x=>x.ar):["لا يوجد حالياً نمط استهلاك أو هبوط ثابت بما يكفي لبناء تنبؤ كيميائي شخصي موثوق."],
    detailsEn:pred.length?pred.slice(0,4).map(x=>x.en):["There is not yet a stable enough depletion pattern for a reliable personalized chemistry forecast."],
    evidenceAr:[`${tank.healthSnapshots?.length??0} نقاط حالة محفوظة`,`${tank.chemistry.length} قراءات كيميائية`],
    evidenceEn:[`${tank.healthSnapshots?.length??0} saved state points`,`${tank.chemistry.length} chemistry readings`],
    confidence:f.confidence,action:nextBestAction(tank)
  };
}

function maintenanceAnswer(tank:Tank):AquaAIAnswer{
  const today=new Date().toISOString().slice(0,10);
  const due=tank.maintenance.filter(x=>maintenanceEffectiveState(x,today).due);
  const upcoming=tank.maintenance.filter(x=>!maintenanceEffectiveState(x,today).completed&&x.nextDue&&x.nextDue>today).sort((a,b)=>String(a.nextDue).localeCompare(String(b.nextDue))).slice(0,3);
  return {
    titleAr:"تحليل الصيانة",titleEn:"Maintenance analysis",
    summaryAr:due.length?`هناك ${due.length} مهمة مستحقة تؤثر على حالة الصيانة الحالية.`:"لا توجد مهام متأخرة حالياً.",
    summaryEn:due.length?`${due.length} due task(s) are affecting the current maintenance state.`:"There are no overdue maintenance tasks right now.",
    detailsAr:[`صحة الصيانة: ${maintenanceHealth(tank)}%.`,...(due.slice(0,4).map(x=>`مستحق: ${x.title}${x.nextDue?` • ${x.nextDue}`:""}.`)),...(upcoming.map(x=>`قريباً: ${x.title}${x.nextDue?` • ${x.nextDue}`:""}.`))],
    detailsEn:[`Maintenance health: ${maintenanceHealth(tank)}%.`,...(due.slice(0,4).map(x=>`Due: ${x.titleEn||x.title}${x.nextDue?` • ${x.nextDue}`:""}.`)),...(upcoming.map(x=>`Upcoming: ${x.titleEn||x.title}${x.nextDue?` • ${x.nextDue}`:""}.`))],
    evidenceAr:[`${tank.maintenance.length} مهمة مسجلة`,`${due.length} مستحقة`],evidenceEn:[`${tank.maintenance.length} registered tasks`,`${due.length} due`],confidence:"high",action:{page:"maintenance",ar:"افتح الصيانة",en:"Open maintenance"}
  };
}

function livestockAnswer(tank:Tank):AquaAIAnswer{
  const bio=bioload(tank),watch=tank.livestock.filter(x=>x.health==="watch"),treatment=tank.livestock.filter(x=>x.health==="treatment");
  const recent=tank.livestock.filter(x=>{const d=ageDays(x.addedAt);return d!==undefined&&d<=14;});
  return {
    titleAr:"تحليل الكائنات والحمل الحيوي",titleEn:"Livestock & bioload analysis",
    summaryAr:watch.length||treatment.length?"توجد كائنات تحتاج متابعة، لذلك يجب قراءة سلوكها مع الكيمياء والأحداث الأخيرة لا بشكل منفصل.":"لا توجد كائنات مسجلة بحالة علاج أو مراقبة حالياً.",
    summaryEn:watch.length||treatment.length?"Some livestock need attention, so their condition should be read together with chemistry and recent events rather than in isolation.":"No livestock are currently marked for treatment or watch.",
    detailsAr:[`الحمل الحيوي التقريبي: ${Math.round(bio.ratio*100)}%.`,`كائنات تحت المراقبة: ${watch.length} • تحت العلاج: ${treatment.length}.`,`إضافات خلال 14 يوماً: ${recent.length}.`,...(watch.slice(0,3).map(x=>`مراقبة: ${x.name}.`)),...(treatment.slice(0,3).map(x=>`علاج: ${x.name}.`))],
    detailsEn:[`Estimated bioload: ${Math.round(bio.ratio*100)}%.`,`Under watch: ${watch.length} • treatment: ${treatment.length}.`,`Added in the last 14 days: ${recent.length}.`,...(watch.slice(0,3).map(x=>`Watch: ${x.nameEn||x.name}.`)),...(treatment.slice(0,3).map(x=>`Treatment: ${x.nameEn||x.name}.`))],
    evidenceAr:[`${tank.livestock.length} سجل كائنات`,`${recent.length} إضافات حديثة`],evidenceEn:[`${tank.livestock.length} livestock records`,`${recent.length} recent additions`],confidence:confidence(tank),action:{page:"livestock",ar:"افتح الكائنات",en:"Open livestock"}
  };
}

function emergencyAnswer(tank:Tank):AquaAIAnswer{
  const active=(tank.emergencySessions??[]).filter(x=>x.status==="active");
  const warnings=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
  return {
    titleAr:"وضع الطوارئ",titleEn:"Emergency status",
    summaryAr:active.length?`هناك ${active.length} بروتوكول طوارئ نشط ويجب إكماله قبل اعتبار الحوض مستقراً.`:"لا يوجد بروتوكول طوارئ نشط حالياً.",
    summaryEn:active.length?`${active.length} emergency protocol(s) are active and should be completed before the tank is considered stable.`:"No emergency protocol is active right now.",
    detailsAr:[...(active.map(x=>`${x.titleAr}: أُنجز ${x.completedSteps.length} خطوة حتى الآن.`)),...(warnings.slice(0,3).map(x=>`جهاز بحاجة انتباه: ${x.name} (${x.status}).`)),active.length?"بعد انتهاء الطوارئ، أعد فحص الكيمياء والمعدات وسجّل النتيجة لمقارنة التعافي.":"يمكن تشغيل بروتوكول الطوارئ عند الحاجة من صفحة الطوارئ."],
    detailsEn:[...(active.map(x=>`${x.titleEn}: ${x.completedSteps.length} step(s) completed so far.`)),...(warnings.slice(0,3).map(x=>`Equipment attention: ${x.name} (${x.status}).`)),active.length?"After the emergency, recheck chemistry/equipment and log the result to track recovery.":"An emergency protocol can be started from the Emergency page when needed."],
    evidenceAr:[`${active.length} طوارئ نشطة`,`${warnings.length} تحذيرات معدات`],evidenceEn:[`${active.length} active emergency`,`${warnings.length} equipment warnings`],confidence:"high",action:{page:"emergency",ar:"افتح الطوارئ",en:"Open emergency"}
  };
}

function rodiAnswer(tank:Tank):AquaAIAnswer{
  const last=tank.rodi[0];
  const links=eventChemistryLinks(tank).filter(x=>/water.?change|تغيير.?ماء/i.test(`${x.event.type} ${x.event.textAr} ${x.event.textEn}`)).slice(0,2);
  const age=ageDays(last?.timestamp);
  const detailsAr=last?[`آخر TDS داخل: ${last.tdsIn} • خارج: ${last.tdsOut}.`,`آخر تسجيل منذ ${age??0} يوم • إنتاج ${last.liters} لتر.`,...(links.map(x=>x.ar))]:["لا توجد قراءات RO/DI مسجلة حتى الآن."];
  const detailsEn=last?[`Latest TDS in: ${last.tdsIn} • out: ${last.tdsOut}.`,`Last log: ${age??0} day(s) ago • ${last.liters} L produced.`,...(links.map(x=>x.en))]:["No RO/DI readings have been logged yet."];
  return {titleAr:"تحليل RO/DI وماء المصدر",titleEn:"RO/DI & source-water analysis",summaryAr:last?(last.tdsOut>2?"TDS الخارج يستحق المراجعة قبل استخدام الماء في تغيير جديد.":"آخر قراءة RO/DI لا تُظهر مشكلة واضحة بحد ذاتها."):"أحتاج إلى قراءة TDS كي أربط جودة ماء المصدر بتغييرات الحوض.",summaryEn:last?(last.tdsOut>2?"Product-water TDS deserves review before the next water change.":"The latest RO/DI reading does not show an obvious issue by itself."):"A TDS reading is needed before source-water quality can be linked to tank changes.",detailsAr,detailsEn,evidenceAr:[`${tank.rodi.length} سجلات RO/DI`,`${links.length} روابط مع تغيير الماء`],evidenceEn:[`${tank.rodi.length} RO/DI logs`,`${links.length} water-change links`],confidence:last?"medium":"low",action:{page:"rodi",ar:"افتح RO/DI",en:"Open RO/DI"}};
}

function equipmentAnswer(tank:Tank):AquaAIAnswer{
  const warnings=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
  const energy=tankEnergy(tank);
  const currency=tank.energySettings?.currency||"";
  const top=[...energy.rows].sort((a,b)=>b.monthlyKwh-a.monthlyKwh).slice(0,3);
  const detailsAr=[
    `${tank.equipment.length} تجهيزة مسجلة؛ ${warnings.length} منها بحاجة انتباه أو صيانة.`,
    energy.configured?`الاستهلاك المحسوب تقريباً ${energy.monthlyKwh.toFixed(1)} kWh شهرياً${tank.energySettings?.pricePerKwh?`، بتكلفة ${energy.monthlyCost.toFixed(2)} ${currency}`:""}.`:"بيانات الطاقة غير مكتملة بعد لكل الأجهزة.",
    ...(top.filter(x=>x.monthlyKwh>0).map(x=>`${x.equipment.name}: ${x.monthlyKwh.toFixed(1)} kWh/شهر.`))
  ];
  const detailsEn=[
    `${tank.equipment.length} device(s) registered; ${warnings.length} need attention/service.`,
    energy.configured?`Estimated energy use is ${energy.monthlyKwh.toFixed(1)} kWh/month${tank.energySettings?.pricePerKwh?`, costing ${energy.monthlyCost.toFixed(2)} ${currency}`:""}.`:"Energy data is not complete for all devices yet.",
    ...(top.filter(x=>x.monthlyKwh>0).map(x=>`${x.equipment.name}: ${x.monthlyKwh.toFixed(1)} kWh/month.`))
  ];
  return {titleAr:"ذكاء المعدات والطاقة",titleEn:"Equipment & energy intelligence",summaryAr:warnings.length?"هناك أجهزة يجب فحصها قبل أن تتحول إلى مشكلة في الحوض.":"لا يوجد تحذير جهاز مباشر حالياً، ويمكن أيضاً مراقبة أثر الطاقة والتكلفة.",summaryEn:warnings.length?"Some devices need attention before they become a tank problem.":"No device is directly flagged right now; I can also track energy and cost impact.",detailsAr,detailsEn,evidenceAr:[`${energy.configured} جهاز ببيانات طاقة`],evidenceEn:[`${energy.configured} device(s) with energy data`],confidence:energy.configured>=2?"medium":"low",action:{page:"equipment",ar:"افتح إدارة المعدات",en:"Open equipment management"}};
}

function reasoningAnswer(tank:Tank,intent:AquaQuestionIntent):AquaAIAnswer{
 const reasoning=reasonLocally(tank,intent);
 const firstAction=reasoning.actions[0];
 const topSignal=reasoning.signals[0];
 const titleMap:Record<string,[string,string]>={
  why:["تحليل الأسباب المحتملة","Likely-cause analysis"],
  action:["أفضل خطوة الآن","Best next action"],
  status:[intent.asksAboutBioload?"حالة الحمل الحيوي الآن":"حالة الحوض الآن",intent.asksAboutBioload?"Current bioload status":"Current tank state"],
  trend:["تحليل الاتجاه","Trend analysis"],
  compare:["مقارنة القراءات والتغيرات","Reading & change comparison"],
  forecast:["التوقع المحلي","Local forecast"],
  dose:["قرار الجرعة","Dosing decision"],
  general:["تحليل الحوض","Tank analysis"]
 };
 const title=titleMap[intent.mode]||titleMap.general;
 const detailSignals=reasoning.signals.slice(0,6);
 const actionDetails=reasoning.actions.slice(0,3);
 let summaryAr=reasoning.summaryAr,summaryEn=reasoning.summaryEn;
 if((intent.mode==="action"||intent.mode==="dose")&&firstAction){
  summaryAr=`${firstAction.ar} السبب: ${firstAction.whyAr}`;
  summaryEn=`${firstAction.en} Why: ${firstAction.whyEn}`;
 }else if(intent.mode==="why"&&topSignal){
  summaryAr=`السبب الأقرب حسب بيانات الحوض: ${topSignal.ar}`;
  summaryEn=`Most likely explanation from tank data: ${topSignal.en}`;
 }else if(intent.mode==="status"&&topSignal){
  summaryAr=topSignal.ar;
  summaryEn=topSignal.en;
 }
 const detailsAr=(intent.mode==="action"||intent.mode==="dose")
  ?[...actionDetails.map((x,i)=>`${i+1}. ${x.ar} — ليش: ${x.whyAr} — راقب بعدها: ${x.recheckAr}`),...detailSignals.slice(0,3).map(x=>x.ar)]
  :[...detailSignals.map(x=>x.ar),...actionDetails.map((x,i)=>`${i+1}. ${x.ar} — ليش: ${x.whyAr} — راقب بعدها: ${x.recheckAr}`)];
 const detailsEn=(intent.mode==="action"||intent.mode==="dose")
  ?[...actionDetails.map((x,i)=>`${i+1}. ${x.en} — Why: ${x.whyEn} — Recheck: ${x.recheckEn}`),...detailSignals.slice(0,3).map(x=>x.en)]
  :[...detailSignals.map(x=>x.en),...actionDetails.map((x,i)=>`${i+1}. ${x.en} — Why: ${x.whyEn} — Recheck: ${x.recheckEn}`)];
 return {
  titleAr:title[0],titleEn:title[1],
  summaryAr,summaryEn,
  detailsAr,detailsEn,
  evidenceAr:reasoning.evidenceAr,evidenceEn:reasoning.evidenceEn,
  confidence:reasoning.confidence,
  action:firstAction?{page:firstAction.page as AquaAIPage,ar:firstAction.ar,en:firstAction.en}:undefined
 };
}
function multiParameterAnswer(tank:Tank,params:AquaQuestionParam[]):AquaAIAnswer{
  const guidance=chemistryGuidance(tank);
  const rows=params.map(param=>guidance.all.find(x=>x.key===param)).filter(Boolean) as NonNullable<ReturnType<typeof chemistryGuidance>["all"][number]>[];
  const problems=rows.filter(x=>x.level!=="good"||x.suspectedFormat);
  const detailsAr=(problems.length?problems:rows).map(x=>`${x.reasonAr} الإجراء: ${x.actionAr}`);
  const detailsEn=(problems.length?problems:rows).map(x=>`${x.reasonEn} Action: ${x.actionEn}`);
  const top=problems[0]||rows[0];
  return {
    titleAr:"تحليل القيم المطلوبة معاً",titleEn:"Combined parameter analysis",
    summaryAr:top?`الأولوية الآن: ${top.titleAr}. ${top.actionAr}`:"لا توجد بيانات كافية للقيم المطلوبة.",
    summaryEn:top?`Current priority: ${top.titleEn}. ${top.actionEn}`:"There is not enough data for the requested parameters.",
    detailsAr:detailsAr.length?detailsAr:["لا توجد بيانات كافية حالياً."],detailsEn:detailsEn.length?detailsEn:["There is not enough data yet."],
    evidenceAr:[`${tank.chemistry.length} قراءات كيميائية`,`${params.length} عوامل مطلوبة`],evidenceEn:[`${tank.chemistry.length} chemistry readings`,`${params.length} requested parameters`],
    confidence:confidence(tank),action:{page:"chemistry",ar:"افتح الكيمياء والتفاصيل",en:"Open chemistry details"}
  };
}

function stockingReadinessAnswer(tank:Tank,question:string):AquaAIAnswer{
  const candidate=candidateFromQuestion(question,tank),quantity=quantityFromQuestion(question);
  const readiness=stockingReadiness(tank,{candidate,quantity,candidateKnown:candidate?true:undefined});
  const candidateAr=candidate?.ar||candidate?.en,candidateEn=candidate?.en||candidate?.ar;
  const stateAr=readiness.state==="ready"?"جاهز مبدئياً":readiness.state==="not_now"?"غير مناسب للإضافة الآن":"ما في بيانات كافية للحكم";
  const stateEn=readiness.state==="ready"?"Provisionally ready":readiness.state==="not_now"?"Not suitable for an addition now":"Not enough evidence to decide";
  const detailsAr=[
    candidate?("الكائن المطلوب: "+candidateAr+" ×"+quantity+"."):"التقييم عام للحوض لأن السؤال ما حدد نوع معروف من المكتبة.",
    ...readiness.factsAr,
    ...(readiness.compatibility?[("الحمل المتوقع بعد الإضافة: "+Math.round(readiness.compatibility.projectedRatio*100)+"%.")]:[]),
    ...readiness.blockersAr.map(x=>"مانع: "+x),
    ...readiness.cautionsAr.map(x=>"تنبيه: "+x)
  ];
  const detailsEn=[
    candidate?("Requested livestock: "+candidateEn+" ×"+quantity+"."):"This is a general tank-readiness assessment because no known library species was identified.",
    ...readiness.factsEn,
    ...(readiness.compatibility?[("Projected bioload after addition: "+Math.round(readiness.compatibility.projectedRatio*100)+"%.")]:[]),
    ...readiness.blockersEn.map(x=>"Blocker: "+x),
    ...readiness.cautionsEn.map(x=>"Caution: "+x)
  ];
  return {
   titleAr:"جاهزية إضافة كائنات",titleEn:"Livestock-addition readiness",
   summaryAr:readiness.state==="ready"
    ?(candidate?("المؤشرات الحالية تسمح مبدئياً بإضافة "+candidateAr+" ×"+quantity+"، مع مراعاة التنبيهات والمراقبة بعد الإضافة."):"المؤشرات الحالية تسمح مبدئياً بإضافة كائنات بشكل محافظ مع المراقبة.")
    :readiness.state==="not_now"
     ?("القرار الحالي: "+stateAr+". عالج المانع قبل الإضافة.")
     :("القرار الحالي: "+stateAr+". حدّث البيانات المطلوبة قبل اعتبار الحوض جاهزاً."),
   summaryEn:readiness.state==="ready"
    ?(candidate?("Current evidence provisionally supports adding "+candidateEn+" ×"+quantity+", with cautions and post-addition monitoring."):"Current evidence provisionally supports a conservative addition with monitoring.")
    :readiness.state==="not_now"
     ?("Current decision: "+stateEn+". Resolve the blocker before adding livestock.")
     :("Current decision: "+stateEn+". Refresh the required evidence before treating the tank as ready."),
   detailsAr,detailsEn,
   evidenceAr:readiness.factsAr,evidenceEn:readiness.factsEn,
   missingEvidenceAr:readiness.missingEvidenceAr,missingEvidenceEn:readiness.missingEvidenceEn,
   factsAr:readiness.factsAr,factsEn:readiness.factsEn,
   inferencesAr:["حالة الجاهزية: "+stateAr+"."],inferencesEn:["Readiness state: "+stateEn+"."],
   confidence:readiness.state==="insufficient_evidence"?"low":readiness.chemistryConfidence>=75?"high":"medium",
   action:{page:readiness.state==="ready"?"livestock":readiness.state==="not_now"?"alerts":"chemistry",ar:readiness.state==="ready"?"افتح الكائنات وخطط للإضافة":readiness.state==="not_now"?"راجع الموانع أولاً":"حدّث بيانات الكيمياء",en:readiness.state==="ready"?"Open livestock and plan the addition":readiness.state==="not_now"?"Review blockers first":"Refresh chemistry evidence"}
  };
}
function waterChangeAnswer(tank:Tank):AquaAIAnswer{
  const guide=chemistryGuidance(tank);
  const latest=tank.waterChanges[0];
  const highNutrients=guide.problems.filter(x=>["NO3","PO4","NH3","NO2"].includes(x.key));
  const dataIssue=guide.dataIssues[0];
  const needs=dataIssue?false:highNutrients.length>0||(guide.health!==null&&guide.health<70);
  return {
   titleAr:"هل تغيير الماء هو الخطوة المناسبة؟",titleEn:"Is a water change the right next step?",
   summaryAr:dataIssue?"قبل قرار تغيير الماء صحح القراءة المشكوك فيها أولاً.":needs?"تغيير ماء مناسب قد يكون جزءاً من الحل، لكن لازم يترافق مع معالجة السبب وليس كحل وحيد.":"ما في إشارة حالياً إن تغيير ماء كبير هو أول إجراء لازم.",
   summaryEn:dataIssue?"Correct the suspicious reading before deciding on a water change.":needs?"An appropriate water change may be part of the solution, but it should accompany root-cause correction rather than act as the only fix.":"There is no clear sign that a large water change is the first action needed right now.",
   detailsAr:[...(dataIssue?[dataIssue.reasonAr,dataIssue.actionAr]:[]),...highNutrients.slice(0,3).map(x=>`${x.reasonAr} ${x.actionAr}`),latest?`آخر تغيير ماء مسجل: ${latest.liters} لتر بتاريخ ${new Date(latest.timestamp).toLocaleDateString()}.`:"لا يوجد تغيير ماء مسجل مؤخراً."],
   detailsEn:[...(dataIssue?[dataIssue.reasonEn,dataIssue.actionEn]:[]),...highNutrients.slice(0,3).map(x=>`${x.reasonEn} ${x.actionEn}`),latest?`Latest logged water change: ${latest.liters} L on ${new Date(latest.timestamp).toLocaleDateString()}.`:"No recent water change is logged."],
   evidenceAr:[`${guide.health}% صحة كيمياء`,`${tank.waterChanges.length} تغييرات ماء مسجلة`],evidenceEn:[`${guide.health}% chemistry health`,`${tank.waterChanges.length} logged water changes`],confidence:confidence(tank),action:{page:"chemistry",ar:"راجع الكيمياء قبل القرار",en:"Review chemistry before deciding"}
  };
}

function bioloadAnswer(tank:Tank):AquaAIAnswer{
  const bio=bioload(tank);
  const ratio=Math.round(bio.ratio*100);
  const capacity=tank.systemVolumeLiters/35;
  const labelAr=bio.status==="danger"?"خطر":bio.status==="high"?"مرتفع":bio.status==="good"?"جيد":"منخفض";
  const labelEn=bio.status==="danger"?"danger":bio.status==="high"?"high":bio.status==="good"?"good":"low";
  const action=bio.status==="danger"||bio.status==="high"
    ? {page:"livestock" as AquaAIPage,ar:"لا تضيف كائنات جديدة حالياً، وراجع التغذية والفلترة وNO3/PO4 قبل أي إضافة.",en:"Do not add new livestock now; review feeding, filtration and NO3/PO4 before another addition."}
    : {page:"livestock" as AquaAIPage,ar:"الحمل الحالي مقبول. خليك على إضافات تدريجية وراقب NO3/PO4 بعد كل إضافة.",en:"Current bioload is acceptable. Keep additions gradual and monitor NO3/PO4 after each addition."};
  return {
    titleAr:"حالة الحمل الحيوي",titleEn:"Bioload status",
    summaryAr:`الحمل الحيوي الحالي حوالي ${ratio}% من القدرة التقديرية للحوض، وتصنيفه ${labelAr}.`,
    summaryEn:`Current bioload is about ${ratio}% of estimated capacity and is classified as ${labelEn}.`,
    detailsAr:[
      `الحمل المحسوب: ${Number(bio.load.toFixed(1))} وحدة.`,
      `القدرة التقديرية: ${Number(capacity.toFixed(1))} وحدة بناءً على حجم النظام.`,
      `عدد سجلات الكائنات: ${tank.livestock.length}.`,
      action.ar
    ],
    detailsEn:[
      `Calculated load: ${Number(bio.load.toFixed(1))} units.`,
      `Estimated capacity: ${Number(capacity.toFixed(1))} units based on system volume.`,
      `Livestock records: ${tank.livestock.length}.`,
      action.en
    ],
    evidenceAr:[`${tank.systemVolumeLiters} لتر حجم نظام`,`${tank.livestock.length} سجلات كائنات`],
    evidenceEn:[`${tank.systemVolumeLiters} L system volume`,`${tank.livestock.length} livestock records`],
    confidence:"high",action
  };
}

function chemistryOverviewAnswer(tank:Tank):AquaAIAnswer{
  const guide=chemistryGuidance(tank);
  const top=guide.problems.slice(0,4);
  const dataIssue=guide.dataIssues[0];
  const first= dataIssue || top[0];
  const summaryAr=dataIssue
    ? `صحة الكيمياء ${guide.health}%. قبل أي تصحيح بالحوض في مشكلة بيانات لازم تتأكد منها: ${dataIssue.reasonAr}`
    : top.length
      ? `صحة الكيمياء ${guide.health}%. أهم عامل يحتاج انتباه الآن: ${top[0].reasonAr}`
      : `صحة الكيمياء ${guide.health}% والقيم الحالية ما فيها مشكلة رئيسية واضحة.`;
  const summaryEn=dataIssue
    ? `Chemistry health is ${guide.health}%. Before changing the tank, verify this data issue: ${dataIssue.reasonEn}`
    : top.length
      ? `Chemistry health is ${guide.health}%. The main parameter needing attention is: ${top[0].reasonEn}`
      : `Chemistry health is ${guide.health}% and there is no clear major issue in the current readings.`;
  return {
    titleAr:"وضع الكيمياء الآن",titleEn:"Current chemistry status",
    summaryAr,summaryEn,
    detailsAr:[
      ...(dataIssue?[dataIssue.reasonAr,dataIssue.actionAr]:[]),
      ...top.filter(x=>x!==dataIssue).slice(0,4).map(x=>`${x.reasonAr} الإجراء: ${x.actionAr}`),
      guide.agePenalty>0?`تنبيه: في خصم ${guide.agePenalty} نقطة بسبب قدم آخر قراءة.`:""
    ].filter(Boolean),
    detailsEn:[
      ...(dataIssue?[dataIssue.reasonEn,dataIssue.actionEn]:[]),
      ...top.filter(x=>x!==dataIssue).slice(0,4).map(x=>`${x.reasonEn} Action: ${x.actionEn}`),
      guide.agePenalty>0?`Note: ${guide.agePenalty} points are deducted because the latest reading is old.`:""
    ].filter(Boolean),
    evidenceAr:[`${tank.chemistry.length} قراءات كيميائية`,`صحة الكيمياء ${guide.health}%`],
    evidenceEn:[`${tank.chemistry.length} chemistry readings`,`${guide.health}% chemistry health`],
    confidence:confidence(tank),
    action:first?{page:"chemistry",ar:first.actionAr,en:first.actionEn}:{page:"chemistry",ar:"استمر بالمراقبة وسجّل القراءة القادمة",en:"Keep monitoring and log the next reading"}
  };
}

function systemOverviewAnswer(tank:Tank):AquaAIAnswer{
  const state=tankStateView(tank),guide=chemistryGuidance(tank),bio=bioload(tank),mood=tankMood(tank);
  const maint=maintenanceHealth(tank);
  const warning=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
  const activeAcclimation=(tank.acclimationSessions??[]).some(x=>x.status!=="completed");
  const primary=nextBestAction(tank);
  return {
    titleAr:"الوضع العام للحوض",titleEn:"Overall tank status",
    summaryAr:`الحوض ${mood.ar} حالياً. حالة النظام ${state.score}%، الكيمياء ${guide.health}%، الصيانة ${maint}%، والحمل الحيوي ${Math.round(bio.ratio*100)}%.`,
    summaryEn:`The tank is currently ${mood.en}. System state is ${state.score}%, chemistry ${guide.health}%, maintenance ${maint}%, and bioload ${Math.round(bio.ratio*100)}%.`,
    detailsAr:[
      `المزاج: ${mood.ar}. ${mood.noteAr}`,
      guide.problems[0]?`أهم ملاحظة كيميائية: ${guide.problems[0].reasonAr}`:"الكيمياء ما فيها مشكلة رئيسية واضحة.",
      warning.length?`في ${warning.length} جهاز بحاجة انتباه.`:"ما في أجهزة مسجلة بتحذير أو صيانة حالياً.",
      activeAcclimation?"في جلسة أقلمة نشطة حالياً.":"ما في جلسة أقلمة نشطة.",
      `أفضل خطوة الآن: ${primary.ar}.`
    ],
    detailsEn:[
      `Mood: ${mood.en}. ${mood.noteEn}`,
      guide.problems[0]?`Main chemistry note: ${guide.problems[0].reasonEn}`:"No major chemistry issue is currently obvious.",
      warning.length?`${warning.length} equipment item(s) need attention.`:"No equipment is currently marked warning/service.",
      activeAcclimation?"An acclimation session is active.":"No acclimation session is active.",
      `Best next action: ${primary.en}.`
    ],
    evidenceAr:[`حالة النظام ${state.score}%`,`الكيمياء ${guide.health}%`,`الصيانة ${maint}%`,`الحمل الحيوي ${Math.round(bio.ratio*100)}%`],
    evidenceEn:[`System state ${state.score}%`,`Chemistry ${guide.health}%`,`Maintenance ${maint}%`,`Bioload ${Math.round(bio.ratio*100)}%`],
    confidence:confidence(tank),action:primary
  };
}

function actionAnswer(tank:Tank):AquaAIAnswer{
  const guide=chemistryGuidance(tank),state=tankStateView(tank),action=nextBestAction(tank);
  const top=guide.problems.slice(0,3);
  return {
   titleAr:"أفضل خطوة الآن",titleEn:"Best next action",
   summaryAr:`${action.ar}.`,summaryEn:`${action.en}.`,
   detailsAr:[`حالة النظام: ${state.score}% (${state.ar}).`,...top.map(x=>`${x.reasonAr} ${x.actionAr}`),...(state.drivers.filter(x=>x.level==="danger"||x.level==="warn").slice(0,2).map(x=>x.ar))],
   detailsEn:[`System state: ${state.score}% (${state.en}).`,...top.map(x=>`${x.reasonEn} ${x.actionEn}`),...(state.drivers.filter(x=>x.level==="danger"||x.level==="warn").slice(0,2).map(x=>x.en))],
   evidenceAr:[`${guide.health}% صحة كيمياء`,`حالة النظام ${state.score}%`],evidenceEn:[`${guide.health}% chemistry health`,`System state ${state.score}%`],confidence:confidence(tank),action
  };
}
function metaAnswer(question:string):AquaAIAnswer|undefined{
 const q=normText(question);
 if(/(?:^|\s)(شو اسمك|اسمك شو|مين انت|من انت|مين حضرتك|who are you|what is your name|what s your name)(?:$|\s)/i.test(q)){
  return {
   titleAr:"أنا Local Best AI 🐠",titleEn:"I’m Local Best AI 🐠",
   summaryAr:"أنا المساعد الذكي المحلي داخل Aqua Nexus، اختصاصي حوضك وبياناته فقط. بفهم الكيمياء والكائنات والمعدات والصيانة والأقلمة وبساعدك تاخد قرار أوضح بدون ما أطلع برا عالم الأحواض.",
   summaryEn:"I’m the local intelligence inside Aqua Nexus. I focus only on your aquarium and its data: chemistry, livestock, equipment, maintenance and acclimation.",
   detailsAr:["اسمي Local Best AI.","أشتغل على بيانات الحوض الحالي داخل Aqua Nexus.","إذا سألتني عن شي برا الأحواض برجعك للمي بطريقة محترمة ومضحكة 😄"],
   detailsEn:["My name is Local Best AI.","I work from the current tank data inside Aqua Nexus.","If you ask about something outside aquariums, I’ll steer you back to the tank with a little humor 😄"],
   evidenceAr:["تعريف المساعد المحلي"],evidenceEn:["Local assistant identity"],
   confidence:"high"
  };
 }
 return undefined;
}

export function aquaAIAnswer(question:string,tank:Tank,page:string):AquaAIAnswer{
  const meta=metaAnswer(question);if(meta)return meta;
  if(!isAquariumScopedQuestion(question,tank))return offTopicAquaAnswer(question);
  const q=(question||"").trim().toLowerCase();
  const intent=parseAquaQuestion(question);
  const cycle=biologicalCycleStatus(tank);
  const explicitCycleQuestion=/cycle|cycling|nitrogen cycle|دورة بيولوج|الدورة البيولوج|دورة النيتروجين/.test(q);
  const cycleTroubleshootingQuestion=cycle.active&&/ammonia|nh3|nh4|nitrite|no2|nitrate|no3|امونيا|أمونيا|نتريت|نترات|chlorine|chloramine|كلور|bacteria|بكتيريا|cloudy|bloom|عكر|diatom|دياتوم|water change|تغيير مي|تغيير ماء|filter|فلتر|oxygen|اكسج|أكسج|power|كهربا/.test(q);
  if(explicitCycleQuestion||cycleTroubleshootingQuestion){
    const k=answerBiologicalCycleQuestion(tank,question);
    return{
      titleAr:k.titleAr,titleEn:k.titleEn,
      summaryAr:k.summaryAr,summaryEn:k.summaryEn,
      detailsAr:k.detailsAr,detailsEn:k.detailsEn,
      evidenceAr:k.evidenceAr,evidenceEn:k.evidenceEn,
      confidence:"high",
      action:{page:k.actionPage as AquaAIPage,ar:cycle.active?cycle.nextAr:"افتح الصفحة المرتبطة للمراجعة",en:cycle.active?cycle.nextEn:"Open the related page to review"}
    };
  }
  if(cycle.active){
    const plan=buildAquaAIQueryPlan(intent);
    const dosingQuestion=/جرعه|جرعة|جرعات|دوز|dose|dosing|supplement|مكمل/.test(q);
    const allowedDomains=new Set(["system","chemistry","equipment","maintenance","emergency","rodi","inventory","water","sump","journal"]);
    const mustStayInCycle=dosingQuestion||plan.primary==="system"||!allowedDomains.has(plan.primary)||intent.mode==="canAdd"||intent.mode==="dose";
    if(mustStayInCycle){
      const blocked=plan.primary!=="system"&&(!allowedDomains.has(plan.primary)||intent.mode==="canAdd"||intent.mode==="dose");
      return{
        titleAr:`الدورة البيولوجية — اليوم ${cycle.day}`,titleEn:`Biological cycle — day ${cycle.day}`,
        summaryAr:(blocked||dosingQuestion)?`هالعملية موقوفة مؤقتاً لأن الحوض ضمن الدورة البيولوجية. ${cycle.nextAr}`:`${cycle.nextAr}`,
        summaryEn:(blocked||dosingQuestion)?`This workflow is temporarily paused while the tank is cycling. ${cycle.nextEn}`:`${cycle.nextEn}`,
        detailsAr:[...cycle.blockersAr.slice(0,4),"الوقت وحده لا يكفي لاعتبار الحوض جاهزاً؛ لازم تثبت الجاهزية بالقياسات."],
        detailsEn:[...cycle.blockersEn.slice(0,4),"Elapsed time alone does not make the tank ready; readiness must be proven by measured tests."],
        evidenceAr:[`اليوم ${cycle.day} من الدورة`,`تقدم الدورة ${cycle.progress}%`],
        evidenceEn:[`Cycle day ${cycle.day}`,`Cycle progress ${cycle.progress}%`],
        confidence:"high",
        action:{page:cycle.actionPage as AquaAIPage,ar:cycle.nextAr,en:cycle.nextEn}
      };
    }
  }

  // High-specificity handlers stay explicit; every normal aquarium question
  // is planned generically by domain + operation, so one signal cannot hijack unrelated topics.
  if(intent.params.length>1)return multiParameterAnswer(tank,intent.params);
  if(intent.params.length===1)return parameterAnswer(tank,intent.params[0] as Param);
  if(intent.mode==="canAdd")return stockingReadinessAnswer(tank,question);
  if(intent.mode==="whatIf")return answerAquaQuery(tank,intent);
  if(intent.mode==="waterChange")return waterChangeAnswer(tank);
  if(intent.mode==="forecast")return forecastAnswer(tank);
  if(/ذاكر|history|memory|لماذا حدث|شو صار بعد|بعد ما|اثر|أثر|event|حدث/.test(q))return memoryAnswer(tank);

  return answerAquaQuery(tank,intent);
}
