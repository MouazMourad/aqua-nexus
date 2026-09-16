import type { Tank } from "./types";
import { bioload, chemistryHealth, maintenanceHealth, tankHealth } from "./health";
import { smartInsights } from "./smartInsights";
import { tankForecast, tankStateView } from "./tankIntelligence";
import { biologicalMemory, eventChemistryLinks, proactivePredictions, tankMood } from "./tankLearning";
import { analyzeNutrients } from "./nutrientEngine";
import { tankEnergy } from "./equipmentIntelligence";

export type AquaAIConfidence="low"|"medium"|"high";
export type AquaAIPage="dashboard"|"chemistry"|"maintenance"|"equipment"|"livestock"|"timeline"|"dosing"|"quarantine"|"emergency"|"rodi"|"journal";

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
const PARAMS=["KH","Ca","Mg","NO3","PO4","pH","salinity","temperature"] as const;
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

export function nextBestAction(tank:Tank):AquaAIAction{
  const activeEmergency=(tank.emergencySessions??[]).some(x=>x.status==="active");
  if(activeEmergency)return {page:"emergency",ar:"كمّل بروتوكول الطوارئ النشط",en:"Continue the active emergency protocol"};
  const today=new Date().toISOString().slice(0,10);
  const overdue=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today));
  const oldChem=tank.chemistry[0]?Math.floor((Date.now()-new Date(tank.chemistry[0].timestamp).getTime())/DAY):999;
  if(oldChem>7)return {page:"chemistry",ar:"سجل فحص كيميائي جديد",en:"Log a fresh chemistry test"};
  const pred=proactivePredictions(tank)[0];
  if(pred&&pred.days<=5&&["KH","Ca","Mg"].includes(pred.parameter))return {page:"dosing",ar:`راجع جرعة ${pred.parameter} قبل الوصول للحد الأدنى`,en:`Review ${pred.parameter} dosing before the lower boundary`};
  if(overdue.length)return {page:"maintenance",ar:`أنجز ${overdue.length} مهمة صيانة مستحقة`,en:`Complete ${overdue.length} due maintenance task(s)`};
  const warning=tank.equipment.find(x=>x.status==="warning"||x.status==="service");
  if(warning)return {page:"equipment",ar:`راجع ${warning.name}`,en:`Review ${warning.name}`};
  if(tank.quarantine.some(x=>x.status==="active"))return {page:"quarantine",ar:"راجع الحجر/العلاج النشط",en:"Review the active quarantine/treatment"};
  return {page:"dashboard",ar:"استمر بالمراقبة وسجل أي تغير جديد",en:"Keep monitoring and log meaningful changes"};
}

function parameterAnswer(tank:Tank,param:Param):AquaAIAnswer{
  const current=latestValue(tank,param),previous=previousValue(tank,param);
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
    detailsAr.push(`مقارنة بالقراءة السابقة: ${d>=0?"ارتفع":"انخفض"} ${Math.abs(d).toFixed(param==="PO4"?3:2)}.`);
    detailsEn.push(`Versus the previous reading: ${d>=0?"up":"down"} ${Math.abs(d).toFixed(param==="PO4"?3:2)}.`);
  }
  if(prediction){detailsAr.push(prediction.ar);detailsEn.push(prediction.en);}
  if(links[0]){
    detailsAr.push(`ارتباط زمني محتمل: ${links[0].ar}`);
    detailsEn.push(`Possible temporal link: ${links[0].en}`);
  }
  if(doses.length){
    detailsAr.push(`يوجد ${doses.length} تسجيل جرعة حديثة لـ ${param} ضمن السجل الظاهر.`);
    detailsEn.push(`${doses.length} recent ${param} dose log(s) are available in the visible history.`);
  }
  if(!detailsAr.length){detailsAr.push(`ما عندي بيانات كافية عن ${param} لهالحوض بعد.`);detailsEn.push(`There is not enough ${param} data for this tank yet.`);}
  return {
    titleAr:`تحليل ${param} لهالحوض`,titleEn:`${param} analysis for this tank`,
    summaryAr:prediction?`في نمط قابل للقياس لـ ${param} وبقدر أستخدمه للتنبؤ المبكر.`:`حالياً بقدر أوصف اتجاه ${param}، بس التنبؤ الشخصي بيتحسن مع قراءات أكثر.`,
    summaryEn:prediction?`There is a measurable ${param} pattern that can support an early forecast.`:`I can describe the current ${param} direction; personalized forecasting improves with more readings.`,
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
    summaryAr:rows.length?"عم أربط القرارات السابقة بالأثر يلي ظهر بعدها على الصحة والكيمياء، مع اعتبارها علاقة زمنية مو إثبات سببية.":"لسه التاريخ قصير. كل جرعة، تغيير ماء، صيانة وقراءة جديدة رح تقوّي ذاكرة الحوض.",
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
    detailsAr:pred.length?pred.slice(0,4).map(x=>x.ar):["ما في استهلاك/هبوط ثابت كافي حالياً لبناء تنبؤ كيميائي شخصي موثوق."],
    detailsEn:pred.length?pred.slice(0,4).map(x=>x.en):["There is not yet a stable enough depletion pattern for a reliable personalized chemistry forecast."],
    evidenceAr:[`${tank.healthSnapshots?.length??0} نقاط حالة محفوظة`,`${tank.chemistry.length} قراءات كيميائية`],
    evidenceEn:[`${tank.healthSnapshots?.length??0} saved state points`,`${tank.chemistry.length} chemistry readings`],
    confidence:f.confidence,action:nextBestAction(tank)
  };
}

function equipmentAnswer(tank:Tank):AquaAIAnswer{
  const warnings=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
  const energy=tankEnergy(tank);
  const currency=tank.energySettings?.currency||"";
  const top=[...energy.rows].sort((a,b)=>b.monthlyKwh-a.monthlyKwh).slice(0,3);
  const detailsAr=[
    `${tank.equipment.length} تجهيزة مسجلة؛ ${warnings.length} منها بحاجة انتباه/صيانة.`,
    energy.configured?`الاستهلاك المحسوب تقريباً ${energy.monthlyKwh.toFixed(1)} kWh بالشهر${tank.energySettings?.pricePerKwh?`، بتكلفة ${energy.monthlyCost.toFixed(2)} ${currency}`:""}.`:"بيانات الطاقة مو مكتملة بعد لكل الأجهزة.",
    ...(top.filter(x=>x.monthlyKwh>0).map(x=>`${x.equipment.name}: ${x.monthlyKwh.toFixed(1)} kWh/شهر.`))
  ];
  const detailsEn=[
    `${tank.equipment.length} device(s) registered; ${warnings.length} need attention/service.`,
    energy.configured?`Estimated energy use is ${energy.monthlyKwh.toFixed(1)} kWh/month${tank.energySettings?.pricePerKwh?`, costing ${energy.monthlyCost.toFixed(2)} ${currency}`:""}.`:"Energy data is not complete for all devices yet.",
    ...(top.filter(x=>x.monthlyKwh>0).map(x=>`${x.equipment.name}: ${x.monthlyKwh.toFixed(1)} kWh/month.`))
  ];
  return {titleAr:"ذكاء المعدات والطاقة",titleEn:"Equipment & energy intelligence",summaryAr:warnings.length?"في أجهزة لازم تنفحص قبل ما تتحول لمشكلة بالحوض.":"ما في تحذير جهاز مباشر حالياً، وبقدر كمان أراقب أثر الطاقة والتكلفة.",summaryEn:warnings.length?"Some devices need attention before they become a tank problem.":"No device is directly flagged right now; I can also track energy and cost impact.",detailsAr,detailsEn,evidenceAr:[`${energy.configured} جهاز ببيانات طاقة`],evidenceEn:[`${energy.configured} device(s) with energy data`],confidence:energy.configured>=2?"medium":"low",action:{page:"equipment",ar:"افتح إدارة المعدات",en:"Open equipment management"}};
}

export function aquaAIAnswer(question:string,tank:Tank,page:string):AquaAIAnswer{
  const q=(question||"").trim().toLowerCase();
  const param=textParam(q);
  if(param)return parameterAnswer(tank,param);
  if(/ذاكر|history|memory|ليش صار|شو صار بعد|بعد ما|اثر|أثر|event|حدث/.test(q))return memoryAnswer(tank);
  if(/توقع|forecast|predict|كم يوم|رايح|مستقبل|الاستهلاك/.test(q))return forecastAnswer(tank);
  if(/جهاز|معدات|equipment|pump|light|skimmer|heater|طاقة|كهرب|energy|cost/.test(q))return equipmentAnswer(tank);

  const mood=tankMood(tank),state=tankStateView(tank),forecast=tankForecast(tank),pred=proactivePredictions(tank)[0],memory=biologicalMemory(tank)[0],nutrients=analyzeNutrients(tank),insights=smartInsights(tank);
  const today=new Date().toISOString().slice(0,10);
  const due=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today));
  const bio=Math.round(bioload(tank).ratio*100);
  const action=nextBestAction(tank);
  const detailsAr=[
    `مزاج الحوض: ${mood.ar}. ${mood.noteAr}`,
    `الحالة ${state.score}% • الكيمياء ${chemistryHealth(tank)}% • الصيانة ${maintenanceHealth(tank)}% • الحمل الحيوي ${bio}%.`,
    `توقع 7 أيام: ${forecast.projected7d}% (${forecast.direction}).`,
    pred?.ar||"ما في تنبؤ استهلاك كيميائي قوي كفاية حالياً.",
    memory?`من ذاكرة الحوض: ${memory.ar}`:(insights[0]?.ar||"لا توجد إشارة حرجة إضافية حالياً."),
    nutrients.signals.find(x=>x.level!=="good")?.ar||"توازن NO3/PO4 ما عم يعطي إشارة خطر واضحة حالياً."
  ];
  const detailsEn=[
    `Tank mood: ${mood.en}. ${mood.noteEn}`,
    `State ${state.score}% • chemistry ${chemistryHealth(tank)}% • maintenance ${maintenanceHealth(tank)}% • bioload ${bio}%.`,
    `7-day outlook: ${forecast.projected7d}% (${forecast.direction}).`,
    pred?.en||"There is not yet a strong enough chemistry depletion forecast.",
    memory?`From tank memory: ${memory.en}`:(insights[0]?.en||"No additional critical signal is detected."),
    nutrients.signals.find(x=>x.level!=="good")?.en||"NO3/PO4 balance is not showing a clear risk signal right now."
  ];
  return {
    titleAr:q?"تحليل Aqua AI للحوض":"ملخص Aqua AI الحي",
    titleEn:q?"Aqua AI tank analysis":"Live Aqua AI summary",
    summaryAr:`${tank.name} حالياً ${mood.ar}. أهم خطوة مقترحة: ${action.ar}.`,
    summaryEn:`${tank.name} is currently ${mood.en}. Best next step: ${action.en}.`,
    detailsAr,detailsEn,
    evidenceAr:[`${tank.chemistry.length} قراءات`,`${recentEvents(tank).length} أحداث / 14 يوم`,`${due.length} مهام مستحقة`, `الواجهة الحالية: ${page}`],
    evidenceEn:[`${tank.chemistry.length} readings`,`${recentEvents(tank).length} events / 14d`,`${due.length} due tasks`,`Current section: ${page}`],
    confidence:confidence(tank),action
  };
}
