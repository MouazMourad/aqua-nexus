import type { Tank } from "./types";
import type { AquaAIAnswer,AquaAIPage } from "./aquaAIBrain";
import type { AquaQuestionIntent } from "./aquaAIIntent";
import { buildAquaAIQueryPlan,type AquaAIQueryPlan,type AquaDomain } from "./aquaAIQueryPlan";
import { reasonLocally } from "./aquaAILocalReasoner";
import { chemistryGuidance } from "./chemistryGuidance";
import { bioload,maintenanceHealth } from "./health";
import { tankIntelligenceCore } from "./intelligenceCore";
import { tankMood } from "./tankLearning";
import { analyzeNutrients } from "./nutrientEngine";
import { tankEnergy } from "./equipmentIntelligence";
import { answerSpecialOperation } from "./aquaAIOperationAnswers";
import { unifiedInventory } from "./inventoryIntelligence";
import { feedingIntelligence } from "./feedingIntelligence";
import { rodiIntelligence } from "./rodiIntelligence";
import { sumpIntelligence } from "./sumpIntelligence";
import { maintenanceEffectiveState } from "./maintenanceSchedule";
import { measuredChemistryReadings } from "./chemistryDataQuality";
import { localDateKey } from "./timeSafety";

function actionDomain(page:string):AquaDomain{
 if(page==="chemistry")return "chemistry";
 if(page==="dosing")return "dosing";
 if(page==="livestock"||page==="quarantine")return "livestock";
 if(page==="equipment")return "equipment";
 if(page==="maintenance")return "maintenance";
 if(page==="acclimation")return "acclimation";
 if(page==="emergency")return "emergency";
 if(page==="rodi")return "rodi";
 if(page==="inventory")return "inventory";
 if(page==="expenses")return "expenses";
 if(page==="diseases")return "diseases";
 if(page==="journal")return "journal";
 if(page==="sump")return "sump";
 if(page==="feeding")return "feeding";
 if(page==="waterchange")return "water";
 return "system";
}

function coreHasCritical(tank:Tank){
 const core=tankIntelligenceCore(tank);
 return core.actions.some(x=>x.level==="danger");
}

function domainTitle(domain:AquaDomain,lang:"ar"|"en"){
 const ar:Record<AquaDomain,string>={system:"الوضع العام للحوض",chemistry:"الكيمياء",bioload:"الحمل الحيوي",livestock:"الكائنات",equipment:"المعدات",maintenance:"الصيانة",dosing:"الجرعات",acclimation:"الإقلمة",emergency:"الطوارئ",rodi:"RO/DI وماء المصدر",feeding:"التغذية",water:"تغيير الماء",inventory:"المخزون",expenses:"المصاريف",diseases:"الأمراض",quarantine:"الحجر والعلاج",journal:"الصور والتطور",sump:"السامب"};
 const en:Record<AquaDomain,string>={system:"Overall tank status",chemistry:"Chemistry",bioload:"Bioload",livestock:"Livestock",equipment:"Equipment",maintenance:"Maintenance",dosing:"Dosing",acclimation:"Acclimation",emergency:"Emergency",rodi:"RO/DI & source water",feeding:"Feeding",water:"Water changes",inventory:"Inventory",expenses:"Expenses",diseases:"Diseases",quarantine:"Quarantine & treatment",journal:"Photos & progression",sump:"Sump"};
 return (lang==="ar"?ar:en)[domain];
}

function snapshot(tank:Tank,plan:AquaAIQueryPlan){
 const core=tankIntelligenceCore(tank);
 const measuredChemistry=measuredChemistryReadings(tank);
 const guide=chemistryGuidance(tank),bio=core.bioload,state=core.state,maint=core.maintenance;
 const system=core.health;
 const today=localDateKey();
 const due=tank.maintenance.filter(x=>maintenanceEffectiveState(x,today).due);
 const warnings=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
 const watch=tank.livestock.filter(x=>x.health==="watch"||x.health==="treatment");
 const activeAcc=(tank.acclimationSessions??[]).filter(x=>x.status!=="completed");
 const lastRodi=tank.rodi[0],lastWater=tank.waterChanges[0];
 const energy=tankEnergy(tank),nutrients=analyzeNutrients(tank),mood=tankMood(tank),stock=unifiedInventory(tank),feeding=feedingIntelligence(tank),rodiIntel=rodiIntelligence(tank),sumpIntel=sumpIntelligence(tank),alerts=core.alerts;
 switch(plan.primary){
  case "chemistry":{
   const top=guide.problems.slice(0,4);
   return {ar:`صحة الكيمياء ${guide.health}%. ${top[0]?`أهم ملاحظة: ${top[0].reasonAr}`:"ما في مشكلة رئيسية واضحة بالقراءات الحالية."}`,en:`Chemistry health is ${guide.health}%. ${top[0]?`Main note: ${top[0].reasonEn}`:"No major issue is obvious in the current readings."}`,dar:top.map(x=>`${x.reasonAr} الإجراء: ${x.actionAr}`),den:top.map(x=>`${x.reasonEn} Action: ${x.actionEn}`),ear:[`${measuredChemistry.length} قراءات كيميائية`,`صحة الكيمياء ${guide.health}%`],een:[`${measuredChemistry.length} chemistry readings`,`${guide.health}% chemistry health`]};
  }
  case "bioload":
   return {ar:`الحمل الحيوي الحالي حوالي ${Math.round(bio.ratio*100)}% من القدرة التقديرية، ومكوّن الحمل ضمن الصحة العامة تقييمه ${system.bioload}%.`,en:`Current bioload is about ${Math.round(bio.ratio*100)}% of estimated capacity, and the bioload component contributes ${system.bioload}% to system health.`,dar:[`الحمل المحسوب ${Number(bio.load.toFixed(1))} من قدرة تقديرية ${Number((tank.systemVolumeLiters/35).toFixed(1))} وحدة.`,`توافق الكائنات ${system.compatibility}% لأن الحمل ما بينقرأ بمعزل عن التوافق.`,`NO3/PO4: ${nutrients.signals.find(x=>x.level!=="good")?.ar||"ما في إشارة خطر واضحة من التوازن الحالي."}`],den:[`Calculated load ${Number(bio.load.toFixed(1))} of an estimated ${Number((tank.systemVolumeLiters/35).toFixed(1))} units.`,`Livestock compatibility is ${system.compatibility}% because load is not evaluated in isolation.`,`NO3/PO4: ${nutrients.signals.find(x=>x.level!=="good")?.en||"No clear risk signal from the current balance."}`],ear:[`الصحة العامة ${system.score}%`,`الحمل الحيوي ${system.bioload}%`,`التوافق ${system.compatibility}%`],een:[`Overall health ${system.score}%`,`Bioload ${system.bioload}%`,`Compatibility ${system.compatibility}%`]};
  case "livestock":
   return {ar:`عندك ${tank.livestock.length} سجل كائنات؛ توافق الكائنات ${system.compatibility}% والحمل الحيوي ${system.bioload}%.`,en:`There are ${tank.livestock.length} livestock records; compatibility is ${system.compatibility}% and bioload health is ${system.bioload}%.`,dar:[...(system.compatibilityAudit.issues.length?system.compatibilityAudit.issues.slice(0,4).map(x=>`⚠ ${x.ar}`):["ما في تعارض معروف مسجل بين الكائنات الحالية."]),...watch.slice(0,4).map(x=>`${x.name}: ${x.health}.`)],den:[...(system.compatibilityAudit.issues.length?system.compatibilityAudit.issues.slice(0,4).map(x=>`⚠ ${x.en}`):["No known compatibility conflict is detected among current livestock."]),...watch.slice(0,4).map(x=>`${x.nameEn||x.name}: ${x.health}.`)],ear:[`الصحة العامة ${system.score}%`,`التوافق ${system.compatibility}%`,`الحمل الحيوي ${system.bioload}%`],een:[`Overall health ${system.score}%`,`Compatibility ${system.compatibility}%`,`Bioload ${system.bioload}%`]};
  case "equipment":
   return {ar:`كفاية التجهيزات ${system.equipment}% ضمن الصحة العامة. عندك ${tank.equipment.length} جهاز مسجل، و${warnings.length} بحالة تحذير/صيانة.`,en:`Equipment adequacy is ${system.equipment}% within overall health. ${tank.equipment.length} devices are registered and ${warnings.length} are warning/service.`,dar:[...system.equipmentAudit.issues.slice(0,5).map(x=>`${x.ar}${x.recommendationAr?` — ${x.recommendationAr}`:""}`),...system.equipmentAudit.suggestions.slice(0,3).map(x=>`اقتراح: ${x.ar}${x.recommendationAr?` — ${x.recommendationAr}`:""}`),`تغطية بيانات الحجم/التدفق ${system.equipmentAudit.sizingCoverage}%.`],den:[...system.equipmentAudit.issues.slice(0,5).map(x=>`${x.en}${x.recommendationEn?` — ${x.recommendationEn}`:""}`),...system.equipmentAudit.suggestions.slice(0,3).map(x=>`Suggestion: ${x.en}${x.recommendationEn?` — ${x.recommendationEn}`:""}`),`Sizing-data coverage ${system.equipmentAudit.sizingCoverage}%.`],ear:[`الصحة العامة ${system.score}%`,`كفاية التجهيزات ${system.equipment}%`],een:[`Overall health ${system.score}%`,`Equipment adequacy ${system.equipment}%`]};
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
   return {ar:`التغذية: ${feeding.recent7d} تسجيل خلال 7 أيام، وضغط المغذيات ${feeding.nutrientPressure}.`,en:`Feeding: ${feeding.recent7d} log(s) in 7 days; nutrient pressure is ${feeding.nutrientPressure}.`,dar:feeding.suggestions,den:feeding.suggestions,ear:[`${tank.livestock.length} سجلات كائنات`,`${feeding.recent7d} تغذيات/7 أيام`],een:[`${tank.livestock.length} livestock records`,`${feeding.recent7d} feedings/7d`]};
  case "inventory":
   return {ar:`المخزون الموحد فيه ${stock.total} عنصر، منها ${stock.low.length} منخفضة.`,en:`Unified inventory has ${stock.total} item(s), with ${stock.low.length} low.`,dar:stock.low.slice(0,6).map(x=>`${x.name}: ${x.quantity} ${x.unit} / الحد ${x.minimum}`),den:stock.low.slice(0,6).map(x=>`${x.nameEn||x.name}: ${x.quantity} ${x.unit} / min ${x.minimum}`),ear:[`${stock.consumables.length} مستهلكات معدات`],een:[`${stock.consumables.length} equipment consumables`]};
  case "expenses":{
   const month=new Date().toISOString().slice(0,7),rows=tank.expenses.filter(x=>x.date.startsWith(month));const totals=rows.reduce((m:any,x)=>{m[x.currency]=(m[x.currency]||0)+x.amount;return m;},{});
   return {ar:`هذا الشهر عندك ${rows.length} مصروف مسجل.`,en:`There are ${rows.length} logged expense(s) this month.`,dar:[...Object.entries(totals).map(([c,v])=>`${Number(v).toFixed(2)} ${c}`),`استهلاك الطاقة التقديري ${energy.monthlyKwh.toFixed(1)} kWh/شهر.`],den:[...Object.entries(totals).map(([c,v])=>`${Number(v).toFixed(2)} ${c}`),`Estimated energy use ${energy.monthlyKwh.toFixed(1)} kWh/month.`],ear:[`${tank.expenses.length} مصاريف مسجلة`],een:[`${tank.expenses.length} logged expenses`]};}
  case "diseases":{
   const treatment=tank.livestock.filter(x=>x.health==="treatment"||x.health==="watch");
   return {ar:treatment.length?`في ${treatment.length} سجل كائن تحت المراقبة/العلاج.`:"ما في كائن مسجل تحت العلاج حالياً.",en:treatment.length?`${treatment.length} livestock record(s) are under watch/treatment.`:"No livestock is currently marked under treatment.",dar:[...treatment.slice(0,5).map(x=>`${x.name}: ${x.health}`),...tank.quarantine.filter(x=>x.status==="active").slice(0,4).map(x=>`${x.organism}: ${x.reason}`)],den:[...treatment.slice(0,5).map(x=>`${x.nameEn||x.name}: ${x.health}`),...tank.quarantine.filter(x=>x.status==="active").slice(0,4).map(x=>`${x.organism}: ${x.reason}`)],ear:[`${tank.quarantine.filter(x=>x.status==="active").length} حالات علاج نشطة`],een:[`${tank.quarantine.filter(x=>x.status==="active").length} active treatment cases`]};}
  case "quarantine":{
   const active=tank.quarantine.filter(x=>x.status==="active");
   return {ar:active.length?`في ${active.length} حالة حجر/علاج نشطة.`:"ما في حجر أو علاج نشط.",en:active.length?`${active.length} quarantine/treatment case(s) are active.`:"No active quarantine/treatment cases.",dar:active.slice(0,6).map(x=>`${x.organism}: ${x.reason}${x.nextDoseAt?` • الجرعة القادمة ${new Date(x.nextDoseAt).toLocaleString()}`:""}`),den:active.slice(0,6).map(x=>`${x.organism}: ${x.reason}${x.nextDoseAt?` • next dose ${new Date(x.nextDoseAt).toLocaleString()}`:""}`),ear:[`${tank.quarantine.length} حالات مسجلة`],een:[`${tank.quarantine.length} logged cases`]};}
  case "journal":{
   const latest:any=((tank as any).visionAssessments??[])[0];
   return {ar:latest?`آخر تحليل بصري: ${latest.triage?.summaryAr||"مسجل"}.`:`عندك ${tank.photos.length} صورة، لكن ما في تحليل بصري حديث.`,en:latest?`Latest visual assessment: ${latest.triage?.summaryEn||"logged"}.`:`There are ${tank.photos.length} photo(s), but no recent visual assessment.`,dar:latest?(latest.triage?.nextAr||[]).slice(0,5):[],den:latest?(latest.triage?.nextEn||[]).slice(0,5):[],ear:[`${tank.photos.length} صور`],een:[`${tank.photos.length} photos`]};}
  case "sump":
   return {ar:sumpIntel.enabled?`السامب ${sumpIntel.issues.length?"يحتاج مراجعة":"ما فيه مشكلة هندسية واضحة"}؛ هامش الأمان التقديري ${sumpIntel.safetyMargin.toFixed(1)} لتر.`:"الحوض مسجل بدون سامب.",en:sumpIntel.enabled?`Sump ${sumpIntel.issues.length?"needs review":"has no obvious geometry issue"}; estimated safety margin ${sumpIntel.safetyMargin.toFixed(1)} L.`:"Tank is configured without a sump.",dar:sumpIntel.issues,den:sumpIntel.issues,ear:[`Freeboard ${sumpIntel.freeboard.toFixed(1)} L`],een:[`Freeboard ${sumpIntel.freeboard.toFixed(1)} L`]};
  case "water":
   return {ar:lastWater?`آخر تغيير ماء مسجل ${lastWater.liters} لتر بتاريخ ${new Date(lastWater.timestamp).toLocaleDateString()}.`:"ما في تغيير ماء مسجل مؤخراً.",en:lastWater?`Latest logged water change: ${lastWater.liters} L on ${new Date(lastWater.timestamp).toLocaleDateString()}.`:"No recent water change is logged.",dar:[`صحة الكيمياء الحالية ${guide.health}%.`],den:[`Current chemistry health is ${guide.health}%.`],ear:[`${tank.waterChanges.length} تغييرات ماء مسجلة`],een:[`${tank.waterChanges.length} logged water changes`]};
  default:
   return {ar:`الحوض ${mood.ar}. الصحة العامة ${system.score}%: الكيمياء ${system.chemistry}%، الصيانة ${system.maintenance}%، الحمل الحيوي ${system.bioload}%، التجهيزات ${system.equipment}%، التوافق ${system.compatibility}%، وحالة الكائنات ${system.livestock}%.`,en:`The tank is ${mood.en}. Overall health is ${system.score}%: chemistry ${system.chemistry}%, maintenance ${system.maintenance}%, bioload ${system.bioload}%, equipment ${system.equipment}%, compatibility ${system.compatibility}%, and livestock condition ${system.livestock}%.`,dar:[...alerts.slice(0,4).map(x=>x.ar),...state.drivers.slice(0,4).map(x=>x.ar),...(system.compatibilityAudit.issues[0]?[`تعارض مستمر: ${system.compatibilityAudit.issues[0].ar}`]:[])],den:[...alerts.slice(0,4).map(x=>x.en),...state.drivers.slice(0,4).map(x=>x.en),...(system.compatibilityAudit.issues[0]?[`Persistent conflict: ${system.compatibilityAudit.issues[0].en}`]:[])],ear:[`الصحة العامة ${system.score}%`,`التجهيزات ${system.equipment}%`,`التوافق ${system.compatibility}%`],een:[`Overall health ${system.score}%`,`Equipment ${system.equipment}%`,`Compatibility ${system.compatibility}%`]};
 }
}

export function answerAquaQuery(tank:Tank,intent:AquaQuestionIntent):AquaAIAnswer{
 const plan=buildAquaAIQueryPlan(intent);
 const special=answerSpecialOperation(tank,intent,plan);
 if(special)return special;
 const reasoned=reasonLocally(tank,intent);
 const snap=snapshot(tank,plan);
 const signals=reasoned.signals.filter(x=>plan.crossDomain||plan.allowedSources.includes(x.source));
 const actions=reasoned.actions.filter(x=>plan.crossDomain||actionDomain(x.page)===plan.primary||plan.secondary.includes(actionDomain(x.page)));
 const topSignal=signals[0],topAction=actions[0];
 const noLivestock=tank.livestock.length===0;
 const measuredForAnswer=measuredChemistryReadings(tank);
 const noChemistry=measuredForAnswer.length===0;
 const latestChem=measuredForAnswer[0];
 const latestChemAgeDays=latestChem?Math.max(0,(Date.now()-new Date(latestChem.timestamp).getTime())/86400000):Infinity;
 const requestedReadings=intent.params.map(param=>{
  const sample=measuredForAnswer.find(r=>typeof r.values[param]==="number"&&Number.isFinite(r.values[param]));
  return {param,value:sample?Number(sample.values[param]):undefined,timestamp:sample?.timestamp};
 });
 const requestedValuesEn=requestedReadings.map(x=>x.value===undefined?`${x.param}: not recorded`:`${x.param}: ${x.value}`).join(", ");
 const requestedValuesAr=requestedReadings.map(x=>x.value===undefined?`${x.param}: غير مسجل`:`${x.param}: ${x.value}`).join("، ");
 const activeEmergency=(tank.emergencySessions??[]).some(x=>x.status==="active");
 const activeAcclimation=(tank.acclimationSessions??[]).some(x=>x.status!=="completed");
 const equipmentWarnings=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
 const addMissingAr:string[]=[]; const addMissingEn:string[]=[];
 if(noChemistry){addMissingAr.push("قراءات كيمياء حديثة");addMissingEn.push("recent chemistry readings");}
 else if(latestChemAgeDays>7){addMissingAr.push("قراءة كيمياء أحدث من 7 أيام");addMissingEn.push("a chemistry reading newer than 7 days");}
 if(noLivestock){addMissingAr.push("سجل الكائنات الحالية");addMissingEn.push("current livestock record");}
 const insufficientForAdd=plan.operation==="canAdd"&&addMissingAr.length>0;
 const addBlockers=plan.operation==="canAdd"&&!insufficientForAdd&&(activeEmergency||activeAcclimation||equipmentWarnings.length>0||coreHasCritical(tank));
 const howTarget=intent.normalized;
 const specificEquipment=tank.equipment.find(x=>intent.raw.toLowerCase().includes(x.name.toLowerCase()))||tank.equipment.find(x=>howTarget.includes(x.kind.toLowerCase()));
 const specificMaintenance=specificEquipment?tank.maintenance.filter(x=>x.sourceEquipmentId===specificEquipment.id):[];
 let summaryAr=snap.ar,summaryEn=snap.en;
 if(intent.params.length){
  summaryAr=`القراءات المطلوبة الحالية: ${requestedValuesAr}.`;
  summaryEn=`Current requested readings: ${requestedValuesEn}.`;
 }
 if(insufficientForAdd){
  const missingAr=addMissingAr.join(" و");
  const missingEn=addMissingEn.join(" and ");
  summaryAr=`ما في بيانات كافية حتى أقول إن إضافة كائن جديد آمنة. ناقصني ${missingAr}. أي نسبة توافق/حمل ظاهرة مع سجل فارغ ليست موافقة على الإضافة.`;
  summaryEn=`There is not enough evidence to say a new livestock addition is safe. Missing: ${missingEn}. Any compatibility/bioload percentage shown with an empty record is not approval to add livestock.`;
 }
 if(addBlockers){
  summaryAr="ما بنصح بإضافة كائن جديد هلق لأن في عامل حالي لازم ينحل أو يتأكد أولاً.";
  summaryEn="I would not treat the tank as ready for new livestock yet because a current blocker needs resolution or verification first.";
 }
 if(!insufficientForAdd&&!addBlockers&&plan.operation==="how"&&specificEquipment){
  const task=specificMaintenance[0];
  summaryAr=task?`لـ ${specificEquipment.name}: اتبع مهمة الصيانة المسجلة «${task.title}»${task.nextDue?`، وموعدها ${task.nextDue}`:""}. لا أضيف خطوات مصنّع غير موجودة ببيانات الجهاز.`:`عندي ${specificEquipment.name} مسجل، لكن ما عندي تعليمات صيانة خاصة بالموديل. افحص/نظف الجهاز حسب دليل الشركة وسجّل الصيانة؛ ما رح أخترع خطوات غير موثقة.`;
  summaryEn=task?`For ${specificEquipment.name}: follow the registered maintenance task “${task.titleEn||task.title}”${task.nextDue?`, due ${task.nextDue}`:""}. I will not invent manufacturer-specific steps that are not in the device data.`:`${specificEquipment.name} is registered, but model-specific maintenance instructions are not available. Follow the manufacturer manual and log the service; I will not invent undocumented steps.`;
 }else if(!insufficientForAdd&&!addBlockers&&plan.operation==="why"){
  summaryAr=topSignal?`السبب الأقرب حسب بيانات ${domainTitle(plan.primary,"ar")}: ${topSignal.ar}`:`ما عندي حالياً دليل كافي يحدد سبب واضح ضمن ${domainTitle(plan.primary,"ar")}.`;
  summaryEn=topSignal?`Most likely explanation from ${domainTitle(plan.primary,"en")} data: ${topSignal.en}`:`There is not enough evidence yet to identify a clear cause in ${domainTitle(plan.primary,"en")}.`;
 }else if(!insufficientForAdd&&!addBlockers&&(plan.operation==="action"||plan.operation==="dose")){
  summaryAr=topAction?`${topAction.ar} السبب: ${topAction.whyAr}`:`ما في إجراء تصحيحي واضح مطلوب ضمن ${domainTitle(plan.primary,"ar")} حالياً.`;
  summaryEn=topAction?`${topAction.en} Why: ${topAction.whyEn}`:`No clear corrective action is required in ${domainTitle(plan.primary,"en")} right now.`;
 }else if(!insufficientForAdd&&!addBlockers&&(plan.operation==="trend"||plan.operation==="compare")){
  summaryAr=topSignal?`أهم اتجاه ظاهر: ${topSignal.ar}`:snap.ar;
  summaryEn=topSignal?`Main visible trend: ${topSignal.en}`:snap.en;
 }
 const suffixAr=plan.operation==="whatIf"?"محاكاة":plan.operation==="why"?"تحليل السبب":plan.operation==="action"?"الخطوة التالية":plan.operation==="how"?"طريقة العمل":plan.operation==="when"?"الموعد":plan.operation==="list"?"القائمة":plan.operation==="count"?"العدد":plan.operation==="trend"?"الاتجاه":plan.operation==="compare"?"المقارنة":"الحالة";
 const suffixEn=plan.operation==="whatIf"?"simulation":plan.operation==="why"?"cause analysis":plan.operation==="action"?"next action":plan.operation==="how"?"how to":plan.operation==="when"?"timing":plan.operation==="list"?"list":plan.operation==="count"?"count":plan.operation==="trend"?"trend":plan.operation==="compare"?"comparison":"status";
 return {
  titleAr:`${domainTitle(plan.primary,"ar")} — ${suffixAr}`,titleEn:`${domainTitle(plan.primary,"en")} — ${suffixEn}`,
  summaryAr,summaryEn,
  detailsAr:[...(intent.params.length?[`القيم المطلوبة: ${requestedValuesAr}.`]:[]),...(insufficientForAdd?["سجّل الكائنات الموجودة وآخر فحص كيميائي أولاً؛ بعدها أعيد تقييم الجاهزية والتوافق والحمل الحيوي."]:snap.dar),...signals.slice(0,4).map(x=>x.ar),...actions.slice(0,2).map(x=>`الإجراء: ${x.ar} — راقب بعدها: ${x.recheckAr}`)].filter((x,i,a)=>x&&a.indexOf(x)===i),
  detailsEn:[...(intent.params.length?[`Requested values: ${requestedValuesEn}.`]:[]),...(insufficientForAdd?["Log the current livestock and a recent chemistry test first; then I can reassess readiness, compatibility and bioload."]:snap.den),...signals.slice(0,4).map(x=>x.en),...actions.slice(0,2).map(x=>`Action: ${x.en} — Recheck: ${x.recheckEn}`)].filter((x,i,a)=>x&&a.indexOf(x)===i),
  evidenceAr:[...snap.ear,...reasoned.evidenceAr.slice(0,3)],evidenceEn:[...snap.een,...reasoned.evidenceEn.slice(0,3)],
  confidence:insufficientForAdd?"low":reasoned.confidence,
  missingEvidenceAr:addMissingAr.length?addMissingAr:undefined,
  missingEvidenceEn:addMissingEn.length?addMissingEn:undefined,
  factsAr:[...snap.ear,...reasoned.evidenceAr.slice(0,3)],
  factsEn:[...snap.een,...reasoned.evidenceEn.slice(0,3)],
  inferencesAr:signals.slice(0,4).map(x=>x.ar),
  inferencesEn:signals.slice(0,4).map(x=>x.en),
  action:topAction?{page:topAction.page as AquaAIPage,ar:topAction.ar,en:topAction.en}:undefined
 };
}
