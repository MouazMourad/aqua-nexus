import type { Tank } from "./types";
import type { AquaAIAnswer,AquaAIPage } from "./aquaAIBrain";
import type { AquaQuestionIntent } from "./aquaAIIntent";
import { buildAquaAIQueryPlan,type AquaAIQueryPlan,type AquaDomain } from "./aquaAIQueryPlan";
import { reasonLocally } from "./aquaAILocalReasoner";
import { chemistryGuidance } from "./chemistryGuidance";
import { bioload,maintenanceHealth } from "./health";
import { tankStateView } from "./tankIntelligence";
import { tankMood } from "./tankLearning";
import { analyzeNutrients } from "./nutrientEngine";
import { tankEnergy } from "./equipmentIntelligence";

function actionDomain(page:string):AquaDomain{
 if(page==="chemistry")return "chemistry";
 if(page==="dosing")return "dosing";
 if(page==="livestock"||page==="quarantine")return "livestock";
 if(page==="equipment")return "equipment";
 if(page==="maintenance")return "maintenance";
 if(page==="acclimation")return "acclimation";
 if(page==="emergency")return "emergency";
 if(page==="rodi")return "rodi";
 return "system";
}

function domainTitle(domain:AquaDomain,lang:"ar"|"en"){
 const ar:Record<AquaDomain,string>={system:"الوضع العام للحوض",chemistry:"الكيمياء",bioload:"الحمل الحيوي",livestock:"الكائنات",equipment:"المعدات",maintenance:"الصيانة",dosing:"الجرعات",acclimation:"الإقلمة",emergency:"الطوارئ",rodi:"RO/DI وماء المصدر",feeding:"التغذية",water:"تغيير الماء"};
 const en:Record<AquaDomain,string>={system:"Overall tank status",chemistry:"Chemistry",bioload:"Bioload",livestock:"Livestock",equipment:"Equipment",maintenance:"Maintenance",dosing:"Dosing",acclimation:"Acclimation",emergency:"Emergency",rodi:"RO/DI & source water",feeding:"Feeding",water:"Water changes"};
 return (lang==="ar"?ar:en)[domain];
}

function snapshot(tank:Tank,plan:AquaAIQueryPlan){
 const guide=chemistryGuidance(tank),bio=bioload(tank),state=tankStateView(tank),maint=maintenanceHealth(tank);
 const today=new Date().toISOString().slice(0,10);
 const due=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today));
 const warnings=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
 const watch=tank.livestock.filter(x=>x.health==="watch"||x.health==="treatment");
 const activeAcc=(tank.acclimationSessions??[]).filter(x=>x.status!=="completed");
 const lastRodi=tank.rodi[0],lastWater=tank.waterChanges[0];
 const energy=tankEnergy(tank),nutrients=analyzeNutrients(tank),mood=tankMood(tank);
 switch(plan.primary){
  case "chemistry":{
   const top=guide.problems.slice(0,4);
   return {ar:`صحة الكيمياء ${guide.health}%. ${top[0]?`أهم ملاحظة: ${top[0].reasonAr}`:"ما في مشكلة رئيسية واضحة بالقراءات الحالية."}`,en:`Chemistry health is ${guide.health}%. ${top[0]?`Main note: ${top[0].reasonEn}`:"No major issue is obvious in the current readings."}`,dar:top.map(x=>`${x.reasonAr} الإجراء: ${x.actionAr}`),den:top.map(x=>`${x.reasonEn} Action: ${x.actionEn}`),ear:[`${tank.chemistry.length} قراءات كيميائية`,`صحة الكيمياء ${guide.health}%`],een:[`${tank.chemistry.length} chemistry readings`,`${guide.health}% chemistry health`]};
  }
  case "bioload":
   return {ar:`الحمل الحيوي الحالي حوالي ${Math.round(bio.ratio*100)}% من القدرة التقديرية للحوض (${Number(bio.load.toFixed(1))} من ${Number((tank.systemVolumeLiters/35).toFixed(1))} وحدة حمل).`,en:`Current bioload is about ${Math.round(bio.ratio*100)}% of estimated capacity (${Number(bio.load.toFixed(1))} of ${Number((tank.systemVolumeLiters/35).toFixed(1))} load units).`,dar:[`عدد سجلات الكائنات: ${tank.livestock.length}.`,`التصنيف الحالي: ${bio.status}.`,`NO3/PO4: ${nutrients.signals.find(x=>x.level!=="good")?.ar||"ما في إشارة خطر واضحة من التوازن الحالي."}`],den:[`Livestock records: ${tank.livestock.length}.`,`Current class: ${bio.status}.`,`NO3/PO4: ${nutrients.signals.find(x=>x.level!=="good")?.en||"No clear risk signal from the current balance."}`],ear:[`${tank.systemVolumeLiters} لتر حجم نظام`,`${tank.livestock.length} سجلات كائنات`],een:[`${tank.systemVolumeLiters} L system volume`,`${tank.livestock.length} livestock records`]};
  case "livestock":
   return {ar:`عندك ${tank.livestock.length} سجل كائنات؛ ${watch.length} منها تحت مراقبة أو علاج.`,en:`There are ${tank.livestock.length} livestock records; ${watch.length} are under watch or treatment.`,dar:[`الحمل الحيوي: ${Math.round(bio.ratio*100)}%.`,...watch.slice(0,4).map(x=>`${x.name}: ${x.health}.`)],den:[`Bioload: ${Math.round(bio.ratio*100)}%.`,...watch.slice(0,4).map(x=>`${x.nameEn||x.name}: ${x.health}.`)],ear:[`${tank.livestock.length} سجلات كائنات`],een:[`${tank.livestock.length} livestock records`]};
  case "equipment":
   return {ar:`عندك ${tank.equipment.length} جهاز مسجل؛ ${warnings.length} بحاجة انتباه أو صيانة.`,en:`${tank.equipment.length} equipment items are registered; ${warnings.length} need attention or service.`,dar:[...warnings.slice(0,4).map(x=>`${x.name}: ${x.status}.`),energy.configured?`استهلاك الطاقة المقدر ${energy.monthlyKwh.toFixed(1)} kWh/شهر.`:"بيانات الطاقة غير مكتملة."],den:[...warnings.slice(0,4).map(x=>`${x.name}: ${x.status}.`),energy.configured?`Estimated energy use ${energy.monthlyKwh.toFixed(1)} kWh/month.`:"Energy data is incomplete."],ear:[`${tank.equipment.length} أجهزة`],een:[`${tank.equipment.length} equipment items`]};
  case "maintenance":
   return {ar:`صحة الصيانة ${maint}%؛ في ${due.length} مهمة مستحقة حالياً.`,en:`Maintenance health is ${maint}%; ${due.length} task(s) are due now.`,dar:due.length?due.slice(0,5).map(x=>`مستحق: ${x.title}.`):["لا توجد مهام مستحقة حالياً."],den:due.length?due.slice(0,5).map(x=>`Due: ${x.titleEn||x.title}.`):["No maintenance tasks are due now."],ear:[`${tank.maintenance.length} مهام مسجلة`],een:[`${tank.maintenance.length} registered tasks`]};
  case "acclimation":
   return {ar:activeAcc.length?`في ${activeAcc.length} جلسة أقلمة نشطة حالياً.`:"ما في جلسة أقلمة نشطة حالياً.",en:activeAcc.length?`${activeAcc.length} acclimation session(s) are active.`:"No acclimation session is active.",dar:activeAcc.slice(0,3).map(x=>`الجلسة ${x.id}: الحالة ${x.status}.`),den:activeAcc.slice(0,3).map(x=>`Session ${x.id}: status ${x.status}.`),ear:[`${tank.acclimationSessions?.length??0} جلسات أقلمة`],een:[`${tank.acclimationSessions?.length??0} acclimation sessions`]};
  case "emergency":{
   const active=(tank.emergencySessions??[]).filter(x=>x.status==="active");
   return {ar:active.length?`في ${active.length} بروتوكول طوارئ نشط.`:"ما في بروتوكول طوارئ نشط.",en:active.length?`${active.length} emergency protocol(s) are active.`:"No emergency protocol is active.",dar:[...active.slice(0,3).map(x=>x.titleAr),...warnings.slice(0,3).map(x=>`جهاز بحاجة انتباه: ${x.name}.`)],den:[...active.slice(0,3).map(x=>x.titleEn),...warnings.slice(0,3).map(x=>`Equipment attention: ${x.name}.`)],ear:[`${active.length} طوارئ نشطة`],een:[`${active.length} active emergencies`]};
  }
  case "rodi":
   return {ar:lastRodi?`آخر RO/DI: TDS داخل ${lastRodi.tdsIn} وخارج ${lastRodi.tdsOut}.`:"ما في قراءة RO/DI مسجلة.",en:lastRodi?`Latest RO/DI: TDS in ${lastRodi.tdsIn}, out ${lastRodi.tdsOut}.`:"No RO/DI reading is logged.",dar:lastRodi?[`الإنتاج المسجل: ${lastRodi.liters} لتر.`]:[],den:lastRodi?[`Logged production: ${lastRodi.liters} L.`]:[],ear:[`${tank.rodi.length} سجلات RO/DI`],een:[`${tank.rodi.length} RO/DI logs`]};
  case "dosing":
   return {ar:`عندك ${tank.dosing.length} جرعة مسجلة. قرار الجرعة لازم ينطلق من آخر قراءة واتجاه KH/Ca/Mg وليس من رقم منفرد.`,en:`There are ${tank.dosing.length} logged doses. Dosing decisions should use the latest reading and KH/Ca/Mg trend, not a single number.`,dar:guide.problems.filter(x=>["KH","Ca","Mg"].includes(x.key)).slice(0,3).map(x=>`${x.reasonAr} ${x.actionAr}`),den:guide.problems.filter(x=>["KH","Ca","Mg"].includes(x.key)).slice(0,3).map(x=>`${x.reasonEn} ${x.actionEn}`),ear:[`${tank.dosing.length} جرعات مسجلة`],een:[`${tank.dosing.length} logged doses`]};
  case "feeding":
   return {ar:`التغذية لازم تنقرأ مع الحمل الحيوي والمغذيات. الحمل الحالي ${Math.round(bio.ratio*100)}%.`,en:`Feeding should be read together with bioload and nutrients. Current bioload is ${Math.round(bio.ratio*100)}%.`,dar:[nutrients.signals.find(x=>x.level!=="good")?.ar||"ما في إشارة مغذيات واضحة حالياً."],den:[nutrients.signals.find(x=>x.level!=="good")?.en||"No clear nutrient signal is present right now."],ear:[`${tank.livestock.length} سجلات كائنات`],een:[`${tank.livestock.length} livestock records`]};
  case "water":
   return {ar:lastWater?`آخر تغيير ماء مسجل ${lastWater.liters} لتر بتاريخ ${new Date(lastWater.timestamp).toLocaleDateString()}.`:"ما في تغيير ماء مسجل مؤخراً.",en:lastWater?`Latest logged water change: ${lastWater.liters} L on ${new Date(lastWater.timestamp).toLocaleDateString()}.`:"No recent water change is logged.",dar:[`صحة الكيمياء الحالية ${guide.health}%.`],den:[`Current chemistry health is ${guide.health}%.`],ear:[`${tank.waterChanges.length} تغييرات ماء مسجلة`],een:[`${tank.waterChanges.length} logged water changes`]};
  default:
   return {ar:`الحوض ${mood.ar}. حالة النظام ${state.score}%؛ الكيمياء ${guide.health}%، الصيانة ${maint}%، الحمل الحيوي ${Math.round(bio.ratio*100)}%.`,en:`The tank is ${mood.en}. System state is ${state.score}%; chemistry ${guide.health}%, maintenance ${maint}%, bioload ${Math.round(bio.ratio*100)}%.`,dar:state.drivers.slice(0,4).map(x=>x.ar),den:state.drivers.slice(0,4).map(x=>x.en),ear:[`حالة النظام ${state.score}%`],een:[`System state ${state.score}%`]};
 }
}

export function answerAquaQuery(tank:Tank,intent:AquaQuestionIntent):AquaAIAnswer{
 const plan=buildAquaAIQueryPlan(intent);
 const reasoned=reasonLocally(tank,intent);
 const snap=snapshot(tank,plan);
 const signals=reasoned.signals.filter(x=>plan.crossDomain||plan.allowedSources.includes(x.source));
 const actions=reasoned.actions.filter(x=>plan.crossDomain||actionDomain(x.page)===plan.primary||plan.secondary.includes(actionDomain(x.page)));
 const topSignal=signals[0],topAction=actions[0];
 let summaryAr=snap.ar,summaryEn=snap.en;
 if(plan.operation==="why"){
  summaryAr=topSignal?`السبب الأقرب حسب بيانات ${domainTitle(plan.primary,"ar")}: ${topSignal.ar}`:`ما عندي حالياً دليل كافي يحدد سبب واضح ضمن ${domainTitle(plan.primary,"ar")}.`;
  summaryEn=topSignal?`Most likely explanation from ${domainTitle(plan.primary,"en")} data: ${topSignal.en}`:`There is not enough evidence yet to identify a clear cause in ${domainTitle(plan.primary,"en")}.`;
 }else if(plan.operation==="action"||plan.operation==="dose"){
  summaryAr=topAction?`${topAction.ar} السبب: ${topAction.whyAr}`:`ما في إجراء تصحيحي واضح مطلوب ضمن ${domainTitle(plan.primary,"ar")} حالياً.`;
  summaryEn=topAction?`${topAction.en} Why: ${topAction.whyEn}`:`No clear corrective action is required in ${domainTitle(plan.primary,"en")} right now.`;
 }else if(plan.operation==="trend"||plan.operation==="compare"){
  summaryAr=topSignal?`أهم اتجاه ظاهر: ${topSignal.ar}`:snap.ar;
  summaryEn=topSignal?`Main visible trend: ${topSignal.en}`:snap.en;
 }
 const suffixAr=plan.operation==="why"?"تحليل السبب":plan.operation==="action"?"الخطوة التالية":plan.operation==="trend"?"الاتجاه":plan.operation==="compare"?"المقارنة":"الحالة";
 const suffixEn=plan.operation==="why"?"cause analysis":plan.operation==="action"?"next action":plan.operation==="trend"?"trend":plan.operation==="compare"?"comparison":"status";
 return {
  titleAr:`${domainTitle(plan.primary,"ar")} — ${suffixAr}`,titleEn:`${domainTitle(plan.primary,"en")} — ${suffixEn}`,
  summaryAr,summaryEn,
  detailsAr:[...snap.dar,...signals.slice(0,4).map(x=>x.ar),...actions.slice(0,2).map(x=>`الإجراء: ${x.ar} — راقب بعدها: ${x.recheckAr}`)].filter((x,i,a)=>x&&a.indexOf(x)===i),
  detailsEn:[...snap.den,...signals.slice(0,4).map(x=>x.en),...actions.slice(0,2).map(x=>`Action: ${x.en} — Recheck: ${x.recheckEn}`)].filter((x,i,a)=>x&&a.indexOf(x)===i),
  evidenceAr:[...snap.ear,...reasoned.evidenceAr.slice(0,3)],evidenceEn:[...snap.een,...reasoned.evidenceEn.slice(0,3)],
  confidence:reasoned.confidence,
  action:topAction?{page:topAction.page as AquaAIPage,ar:topAction.ar,en:topAction.en}:undefined
 };
}
