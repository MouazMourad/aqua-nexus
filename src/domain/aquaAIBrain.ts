import type { Tank } from "./types";
import { bioload, chemistryHealth, maintenanceHealth, tankHealth } from "./health";
import { smartInsights } from "./smartInsights";
import { tankForecast, tankStateView } from "./tankIntelligence";
import { biologicalMemory, eventChemistryLinks, proactivePredictions, tankMood } from "./tankLearning";
import { analyzeNutrients } from "./nutrientEngine";
import { tankEnergy } from "./equipmentIntelligence";
import { chemistryGuidance } from "./chemistryGuidance";
import { parseAquaQuestion,type AquaQuestionIntent,type AquaQuestionParam } from "./aquaAIIntent";
import { reasonLocally } from "./aquaAILocalReasoner";

export type AquaAIConfidence="low"|"medium"|"high";
export type AquaAIPage="dashboard"|"chemistry"|"maintenance"|"equipment"|"livestock"|"timeline"|"dosing"|"quarantine"|"emergency"|"rodi"|"journal"|"acclimation";

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

export function nextBestAction(tank:Tank):AquaAIAction{
  const activeEmergency=(tank.emergencySessions??[]).some(x=>x.status==="active");
  if(activeEmergency)return {page:"emergency",ar:"أكمل بروتوكول الطوارئ النشط",en:"Continue the active emergency protocol"};
  const chemistry=chemistryGuidance(tank);
  if(chemistry.dataIssues.length){const issue=chemistry.dataIssues[0];return {page:"chemistry",ar:issue.actionAr,en:issue.actionEn};}
  if(chemistry.problems.length){const issue=chemistry.problems[0];return {page:"chemistry",ar:`${issue.titleAr}: ${issue.actionAr}`,en:`${issue.titleEn}: ${issue.actionEn}`};}
  const today=new Date().toISOString().slice(0,10);
  const overdue=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today));
  const oldChem=tank.chemistry[0]?Math.floor((Date.now()-new Date(tank.chemistry[0].timestamp).getTime())/DAY):999;
  if(oldChem>7)return {page:"chemistry",ar:"سجّل فحصاً كيميائياً جديداً",en:"Log a fresh chemistry test"};
  const pred=proactivePredictions(tank)[0];
  if(pred&&pred.days<=5&&["KH","Ca","Mg"].includes(pred.parameter))return {page:"dosing",ar:`راجع جرعة ${pred.parameter} قبل الوصول إلى الحد الأدنى`,en:`Review ${pred.parameter} dosing before the lower boundary`};
  if(overdue.length)return {page:"maintenance",ar:`أنجز ${overdue.length} مهمة صيانة مستحقة`,en:`Complete ${overdue.length} due maintenance task(s)`};
  const warning=tank.equipment.find(x=>x.status==="warning"||x.status==="service");
  if(warning)return {page:"equipment",ar:`راجع ${warning.name}`,en:`Review ${warning.name}`};
  if(tank.quarantine.some(x=>x.status==="active"))return {page:"quarantine",ar:"راجع الحجر أو العلاج النشط",en:"Review the active quarantine/treatment"};
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
  const rows=memory.slice(0,4);
  return {
    titleAr:"الذاكرة البيولوجية للحوض",titleEn:"Tank biological memory",
    summaryAr:rows.length?"أربط القرارات السابقة بالأثر الذي ظهر بعدها على الصحة والكيمياء، مع اعتبارها علاقة زمنية لا إثباتاً للسببية.":"التاريخ ما يزال قصيراً. كل جرعة وتغيير ماء وصيانة وقراءة جديدة تقوّي ذاكرة الحوض.",
    summaryEn:rows.length?"I am linking past actions with the health and chemistry changes that followed, treating these as temporal associations rather than proof of causation.":"The history is still short. Each dose, water change, maintenance action and new reading strengthens the tank memory.",
    detailsAr:rows.map(x=>x.ar),detailsEn:rows.map(x=>x.en),
    evidenceAr:[`${memory.length} نمط متعلم`,`${links.length} ربط كيميائي مع أحداث`],
    evidenceEn:[`${memory.length} learned pattern(s)`,`${links.length} chemistry-event link(s)`],
    confidence:confidence(tank),action:{page:"timeline",ar:"افتح الخط الزمني",en:"Open timeline"}
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
  const due=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today));
  const upcoming=tank.maintenance.filter(x=>!x.done&&x.nextDue&&x.nextDue>today).sort((a,b)=>String(a.nextDue).localeCompare(String(b.nextDue))).slice(0,3);
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
 const titleMap:Record<string,[string,string]>={
  why:["تحليل الأسباب المحتملة","Likely-cause analysis"],
  action:["أفضل خطوة الآن","Best next action"],
  status:["حالة الحوض الآن","Current tank state"],
  trend:["تحليل الاتجاه","Trend analysis"],
  compare:["مقارنة القراءات والتغيرات","Reading & change comparison"],
  forecast:["التوقع المحلي","Local forecast"],
  dose:["قرار الجرعة","Dosing decision"],
  general:["تحليل الحوض","Tank analysis"]
 };
 const title=titleMap[intent.mode]||titleMap.general;
 const detailSignals=reasoning.signals.slice(0,6);
 const actionDetails=reasoning.actions.slice(0,3);
 return {
  titleAr:title[0],titleEn:title[1],
  summaryAr:reasoning.summaryAr,summaryEn:reasoning.summaryEn,
  detailsAr:[...detailSignals.map(x=>x.ar),...actionDetails.map((x,i)=>`${i+1}. ${x.ar} — ليش: ${x.whyAr} — راقب بعدها: ${x.recheckAr}`)],
  detailsEn:[...detailSignals.map(x=>x.en),...actionDetails.map((x,i)=>`${i+1}. ${x.en} — Why: ${x.whyEn} — Recheck: ${x.recheckEn}`)],
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

function stockingReadinessAnswer(tank:Tank):AquaAIAnswer{
  const guide=chemistryGuidance(tank),bio=bioload(tank),state=tankStateView(tank);
  const activeAcclimation=(tank.acclimationSessions??[]).some(x=>x.status!=="completed");
  const blocking=guide.problems.filter(x=>x.level==="danger"||x.suspectedFormat);
  const caution=guide.problems.filter(x=>x.level==="warn"&&!x.suspectedFormat);
  const canAdd=blocking.length===0&&bio.status!=="danger"&&state.band!=="critical"&&!activeAcclimation;
  const detailsAr=[`حالة الحوض: ${state.score}% (${state.ar}).`,`الحمل الحيوي: ${Math.round(bio.ratio*100)}%.`,`الكيمياء: ${guide.health}%.`,...(blocking.slice(0,3).map(x=>`مانع محتمل: ${x.reasonAr}`)),...(caution.slice(0,2).map(x=>`تنبيه: ${x.reasonAr}`)),activeAcclimation?"هناك جلسة أقلمة نشطة حالياً؛ الأفضل عدم إضافة كائنات جديدة حتى تنتهي وتستقر الكائنات.":"لا توجد جلسة أقلمة نشطة."];
  const detailsEn=[`Tank state: ${state.score}% (${state.en}).`,`Bioload: ${Math.round(bio.ratio*100)}%.`,`Chemistry: ${guide.health}%.`,...(blocking.slice(0,3).map(x=>`Potential blocker: ${x.reasonEn}`)),...(caution.slice(0,2).map(x=>`Caution: ${x.reasonEn}`)),activeAcclimation?"An acclimation session is active; avoid adding more livestock until it is complete and livestock settles.":"No acclimation session is active."];
  return {
   titleAr:"جاهزية إضافة كائنات",titleEn:"Livestock-addition readiness",
   summaryAr:canAdd?"المؤشرات الحالية لا تظهر مانعاً واضحاً، لكن أضف تدريجياً وراقب الحمل الحيوي والكيمياء بعد الإضافة.":"حالياً في عوامل لازم تنحل أو تتأكد قبل إضافة كائنات جديدة.",
   summaryEn:canAdd?"Current indicators show no obvious blocker, but add gradually and monitor bioload and chemistry afterward.":"There are current factors to resolve or verify before adding new livestock.",
   detailsAr,detailsEn,evidenceAr:[`${guide.health}% صحة كيمياء`,`${Math.round(bio.ratio*100)}% حمل حيوي`,`حالة النظام ${state.score}%`],evidenceEn:[`${guide.health}% chemistry health`,`${Math.round(bio.ratio*100)}% bioload`,`System state ${state.score}%`],confidence:confidence(tank),action:{page:canAdd?"livestock":"chemistry",ar:canAdd?"افتح الكائنات وخطط للإضافة":"راجع الكيمياء أولاً",en:canAdd?"Open livestock and plan the addition":"Review chemistry first"}
  };
}

function waterChangeAnswer(tank:Tank):AquaAIAnswer{
  const guide=chemistryGuidance(tank);
  const latest=tank.waterChanges[0];
  const highNutrients=guide.problems.filter(x=>["NO3","PO4","NH3","NO2"].includes(x.key));
  const dataIssue=guide.dataIssues[0];
  const needs=dataIssue?false:highNutrients.length>0||guide.health<70;
  return {
   titleAr:"هل تغيير الماء هو الخطوة المناسبة؟",titleEn:"Is a water change the right next step?",
   summaryAr:dataIssue?"قبل قرار تغيير الماء صحح القراءة المشكوك فيها أولاً.":needs?"تغيير ماء مناسب قد يكون جزءاً من الحل، لكن لازم يترافق مع معالجة السبب وليس كحل وحيد.":"ما في إشارة حالياً إن تغيير ماء كبير هو أول إجراء لازم.",
   summaryEn:dataIssue?"Correct the suspicious reading before deciding on a water change.":needs?"An appropriate water change may be part of the solution, but it should accompany root-cause correction rather than act as the only fix.":"There is no clear sign that a large water change is the first action needed right now.",
   detailsAr:[...(dataIssue?[dataIssue.reasonAr,dataIssue.actionAr]:[]),...highNutrients.slice(0,3).map(x=>`${x.reasonAr} ${x.actionAr}`),latest?`آخر تغيير ماء مسجل: ${latest.liters} لتر بتاريخ ${new Date(latest.timestamp).toLocaleDateString()}.`:"لا يوجد تغيير ماء مسجل مؤخراً."],
   detailsEn:[...(dataIssue?[dataIssue.reasonEn,dataIssue.actionEn]:[]),...highNutrients.slice(0,3).map(x=>`${x.reasonEn} ${x.actionEn}`),latest?`Latest logged water change: ${latest.liters} L on ${new Date(latest.timestamp).toLocaleDateString()}.`:"No recent water change is logged."],
   evidenceAr:[`${guide.health}% صحة كيمياء`,`${tank.waterChanges.length} تغييرات ماء مسجلة`],evidenceEn:[`${guide.health}% chemistry health`,`${tank.waterChanges.length} logged water changes`],confidence:confidence(tank),action:{page:"chemistry",ar:"راجع الكيمياء قبل القرار",en:"Review chemistry before deciding"}
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
export function aquaAIAnswer(question:string,tank:Tank,page:string):AquaAIAnswer{
  const q=(question||"").trim().toLowerCase();
  const intent=parseAquaQuestion(question);
  const localReasoning=reasonLocally(tank,intent);
  if(intent.params.length>1)return multiParameterAnswer(tank,intent.params);
  if(intent.params.length===1)return parameterAnswer(tank,intent.params[0] as Param);
  if(intent.mode==="canAdd")return stockingReadinessAnswer(tank);
  if(intent.mode==="waterChange")return waterChangeAnswer(tank);
  if(intent.mode==="forecast")return forecastAnswer(tank);
  if(intent.mode==="why"||intent.mode==="action"||intent.mode==="status"||intent.mode==="trend"||intent.mode==="compare"||intent.mode==="dose")return reasoningAnswer(tank,intent);
  if(localReasoning.mentionedLivestock.length||localReasoning.mentionedEquipment.length)return reasoningAnswer(tank,intent);
  if(intent.topics.includes("maintenance"))return maintenanceAnswer(tank);
  if(intent.topics.includes("livestock"))return livestockAnswer(tank);
  if(intent.topics.includes("emergency"))return emergencyAnswer(tank);
  if(intent.topics.includes("rodi"))return rodiAnswer(tank);
  if(intent.topics.includes("equipment"))return equipmentAnswer(tank);
  if(/ذاكر|history|memory|لماذا حدث|شو صار بعد|بعد ما|اثر|أثر|event|حدث/.test(q))return memoryAnswer(tank);

  const mood=tankMood(tank),state=tankStateView(tank),forecast=tankForecast(tank),pred=proactivePredictions(tank)[0],memory=biologicalMemory(tank)[0],nutrients=analyzeNutrients(tank),insights=smartInsights(tank);
  const reasoned=reasonLocally(tank,intent);
  const chemistry=chemistryGuidance(tank);
  const today=new Date().toISOString().slice(0,10);
  const due=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today));
  const bio=Math.round(bioload(tank).ratio*100);
  const action=nextBestAction(tank);
  const chemProblemAr=chemistry.problems.slice(0,3).map(x=>x.suspectedFormat?`مشكلة بيانات: ${x.reasonAr} ${x.actionAr}`:`${x.reasonAr} الإجراء المقترح: ${x.actionAr}`);
  const chemProblemEn=chemistry.problems.slice(0,3).map(x=>x.suspectedFormat?`Data issue: ${x.reasonEn} ${x.actionEn}`:`${x.reasonEn} Suggested action: ${x.actionEn}`);
  const detailsAr=[
    `مزاج الحوض: ${mood.ar}. ${mood.noteAr}`,
    `الحالة ${state.score}% • الكيمياء ${chemistry.health}% • الصيانة ${maintenanceHealth(tank)}% • الحمل الحيوي ${bio}%.`,
    ...chemProblemAr,
    `توقع 7 أيام: ${forecast.projected7d}% (${forecast.direction}).`,
    pred?.ar||"لا يوجد تنبؤ استهلاك كيميائي قوي بما يكفي حالياً.",
    memory?`من ذاكرة الحوض: ${memory.ar}`:(insights[0]?.ar||"لا توجد إشارة حرجة إضافية حالياً."),
    nutrients.signals.find(x=>x.level!=="good")?.ar||"توازن NO3/PO4 لا يعطي إشارة خطر واضحة حالياً."
  ];
  const detailsEn=[
    `Tank mood: ${mood.en}. ${mood.noteEn}`,
    `State ${state.score}% • chemistry ${chemistry.health}% • maintenance ${maintenanceHealth(tank)}% • bioload ${bio}%.`,
    ...chemProblemEn,
    `7-day outlook: ${forecast.projected7d}% (${forecast.direction}).`,
    pred?.en||"There is not yet a strong enough chemistry depletion forecast.",
    memory?`From tank memory: ${memory.en}`:(insights[0]?.en||"No additional critical signal is detected."),
    nutrients.signals.find(x=>x.level!=="good")?.en||"NO3/PO4 balance is not showing a clear risk signal right now."
  ];
  return {
    titleAr:q?"تحليل Aqua AI للحوض":"ملخص Aqua AI الحي",
    titleEn:q?"Aqua AI tank analysis":"Live Aqua AI summary",
    summaryAr:reasoned.summaryAr,
    summaryEn:reasoned.summaryEn,
    detailsAr,detailsEn,
    evidenceAr:[...reasoned.evidenceAr,`الواجهة الحالية: ${page}`],
    evidenceEn:[...reasoned.evidenceEn,`Current section: ${page}`],
    confidence:reasoned.confidence,action:reasoned.actions[0]?{page:reasoned.actions[0].page as AquaAIPage,ar:reasoned.actions[0].ar,en:reasoned.actions[0].en}:action
  };
}
