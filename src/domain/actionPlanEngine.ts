import type { Tank } from "./types";
import type { AquaAIAnswer } from "./aquaAIBrain";
import { tankStateScore } from "./tankIntelligence";
import { parseAquaQuestion } from "./aquaAIIntent";
import { reasonLocally } from "./aquaAILocalReasoner";
import { chemistryCatalogForTank } from "./chemistryProfile";
import { equipmentAdequacy } from "./equipmentAdequacy";
import { maintenanceEffectiveState } from "./maintenanceSchedule";
import { sumpIntelligence } from "./sumpIntelligence";
import { latestParameterSample } from "./chemistryDataQuality";
import { localDateKey } from "./timeSafety";

export interface AquaActionStep{ id:string; titleAr:string; titleEn:string; done:boolean; completedAt?:string; }
export type AquaPlanMetricDirection="lower"|"higher"|"ideal-range";
export interface AquaPlanMetric{
 key:string;labelAr:string;labelEn:string;before:number|null;direction:AquaPlanMetricDirection;
 idealMin?:number;idealMax?:number;tolerance?:number;
}
export interface AquaPlanFocus{domain:string;metrics:AquaPlanMetric[];}
export interface AquaPlanMetricResult extends AquaPlanMetric{after:number|null;result:"improved"|"stable"|"worse"|"unknown";}
export interface AquaActionPlan{
 id:string;createdAt:string;sourceQuestion:string;titleAr:string;titleEn:string;status:"active"|"completed";
 baselineScore:number;reviewAfterHours:number;steps:AquaActionStep[];focus?:AquaPlanFocus;completedAt?:string;outcomeScore?:number;outcome?:"improved"|"stable"|"worse";
 outcomeDetails?:AquaPlanMetricResult[];outcomeSummaryAr?:string;outcomeSummaryEn?:string;
}

const uid=(p:string)=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const today=()=>localDateKey();

function latestChemistry(tank:Tank,param:string){return latestParameterSample(tank,param)?.value??null;}
function maintenanceOverdue(tank:Tank){return tank.maintenance.filter(x=>maintenanceEffectiveState(x,today()).overdue).length;}
function quarantineConcern(tank:Tank){return tank.quarantine.filter(x=>x.status==="active"&&!["improved","resolved"].includes(String(x.outcome||""))).length;}
function latestTdsOut(tank:Tank){
 const row=[...tank.rodi].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0];
 return row&&Number.isFinite(row.tdsOut)?row.tdsOut:null;
}
function metricValue(tank:Tank,key:string){
 if(key.startsWith("chem:"))return latestChemistry(tank,key.slice(5));
 if(key==="equipment:adequacy")return equipmentAdequacy(tank).score;
 if(key==="equipment:warnings")return tank.equipment.filter(x=>x.status==="warning"||x.status==="off").length;
 if(key==="maintenance:overdue")return maintenanceOverdue(tank);
 if(key==="emergency:active")return (tank.emergencySessions??[]).filter(x=>x.status==="active").length;
 if(key==="quarantine:concern")return quarantineConcern(tank);
 if(key==="livestock:concern")return tank.livestock.filter(x=>x.health!=="good").length;
 if(key==="rodi:tdsOut")return latestTdsOut(tank);
 if(key==="acclimation:active")return (tank.acclimationSessions??[]).filter(x=>x.status!=="completed").length;
 if(key==="inventory:low")return tank.inventory.filter(x=>x.quantity<=x.minimum).length;
 if(key==="sump:issues")return sumpIntelligence(tank).issues.length;
 return null;
}
function uniqueParams(params:string[]){return [...new Set(params.filter(Boolean))];}

function buildPlanFocus(tank:Tank,page:string,question:string):AquaPlanFocus|undefined{
 const intent=parseAquaQuestion(question);
 const catalog:any=chemistryCatalogForTank(tank);
 const explicit=uniqueParams(intent.params);
 const chemistryParams=explicit.length?explicit:page==="dosing"?["KH","Ca","Mg"].filter(x=>latestChemistry(tank,x)!==null):[];
 if((page==="chemistry"||page==="dosing"||explicit.length)&&chemistryParams.length){
  const metrics=chemistryParams.map(param=>{
   const meta=catalog?.[param],ideal=Array.isArray(meta?.ideal)?meta.ideal:[];
   return {key:`chem:${param}`,labelAr:param,labelEn:param,before:latestChemistry(tank,param),direction:"ideal-range" as const,
    idealMin:Number.isFinite(Number(ideal[0]))?Number(ideal[0]):undefined,idealMax:Number.isFinite(Number(ideal[1]))?Number(ideal[1]):undefined,
    tolerance:param==="KH"?.15:param==="Ca"?5:param==="Mg"?15:param==="PO4"?.01:param==="NO3"?1:param==="pH"?.05:0};
  }).filter(x=>x.before!==null);
  if(metrics.length)return{domain:"chemistry",metrics};
 }
 if(page==="equipment")return{domain:"equipment",metrics:[
  {key:"equipment:adequacy",labelAr:"كفاية المعدات",labelEn:"Equipment adequacy",before:equipmentAdequacy(tank).score,direction:"higher",tolerance:1},
  {key:"equipment:warnings",labelAr:"تحذيرات المعدات",labelEn:"Equipment warnings",before:metricValue(tank,"equipment:warnings"),direction:"lower",tolerance:0}
 ]};
 if(page==="maintenance")return{domain:"maintenance",metrics:[{key:"maintenance:overdue",labelAr:"الصيانة المتأخرة",labelEn:"Overdue maintenance",before:maintenanceOverdue(tank),direction:"lower",tolerance:0}]};
 if(page==="emergency")return{domain:"emergency",metrics:[{key:"emergency:active",labelAr:"حالات الطوارئ النشطة",labelEn:"Active emergencies",before:metricValue(tank,"emergency:active"),direction:"lower",tolerance:0}]};
 if(page==="quarantine")return{domain:"quarantine",metrics:[{key:"quarantine:concern",labelAr:"حالات العلاج التي ما زالت مقلقة",labelEn:"Treatment cases still concerning",before:quarantineConcern(tank),direction:"lower",tolerance:0}]};
 if(page==="livestock")return{domain:"livestock",metrics:[{key:"livestock:concern",labelAr:"كائنات تحتاج متابعة",labelEn:"Livestock needing attention",before:metricValue(tank,"livestock:concern"),direction:"lower",tolerance:0}]};
 if(page==="rodi")return{domain:"rodi",metrics:[{key:"rodi:tdsOut",labelAr:"TDS الخارج",labelEn:"Output TDS",before:latestTdsOut(tank),direction:"lower",tolerance:0}]};
 if(page==="feeding"||page==="waterchange"){
  const params=page==="feeding"?(tank.type==="marine"?["NO3","PO4"]:["NO3"]):(tank.type==="marine"?["NO3","PO4","salinity"]:["NO3","pH"]);
  const metrics=params.map(param=>{
    const meta=catalog?.[param],ideal=Array.isArray(meta?.ideal)?meta.ideal:[];
    return {key:`chem:${param}`,labelAr:param,labelEn:param,before:latestChemistry(tank,param),direction:"ideal-range" as const,
      idealMin:Number.isFinite(Number(ideal[0]))?Number(ideal[0]):undefined,idealMax:Number.isFinite(Number(ideal[1]))?Number(ideal[1]):undefined,
      tolerance:param==="PO4"?.01:param==="NO3"?1:param==="salinity"?.001:param==="pH"?.05:0};
  }).filter(x=>x.before!==null);
  if(metrics.length)return{domain:page==="feeding"?"feeding":"waterChange",metrics};
 }
 if(page==="acclimation")return{domain:"acclimation",metrics:[
  {key:"acclimation:active",labelAr:"جلسات الإقلمة النشطة",labelEn:"Active acclimation sessions",before:metricValue(tank,"acclimation:active"),direction:"lower",tolerance:0},
  {key:"livestock:concern",labelAr:"كائنات تحتاج متابعة",labelEn:"Livestock needing attention",before:metricValue(tank,"livestock:concern"),direction:"lower",tolerance:0}
 ]};
 if(page==="sump")return{domain:"sump",metrics:[{key:"sump:issues",labelAr:"ملاحظات السامب",labelEn:"Sump issues",before:metricValue(tank,"sump:issues"),direction:"lower",tolerance:0}]};
 if(page==="inventory")return{domain:"inventory",metrics:[{key:"inventory:low",labelAr:"مواد مخزون منخفض",labelEn:"Low-stock items",before:metricValue(tank,"inventory:low"),direction:"lower",tolerance:0}]};
 return undefined;
}

function distanceToRange(value:number,min?:number,max?:number){
 if(min===undefined||max===undefined)return null;
 if(value<min)return min-value;
 if(value>max)return value-max;
 return 0;
}
function evaluateMetric(metric:AquaPlanMetric,after:number|null):AquaPlanMetricResult{
 if(metric.before===null||after===null)return{...metric,after,result:"unknown"};
 const tol=Math.max(0,metric.tolerance??0);
 let delta=0;
 if(metric.direction==="higher")delta=after-metric.before;
 else if(metric.direction==="lower")delta=metric.before-after;
 else{
  const beforeDistance=distanceToRange(metric.before,metric.idealMin,metric.idealMax),afterDistance=distanceToRange(after,metric.idealMin,metric.idealMax);
  if(beforeDistance===null||afterDistance===null)return{...metric,after,result:"unknown"};
  delta=beforeDistance-afterDistance;
 }
 const result:AquaPlanMetricResult["result"]=delta>tol?"improved":delta<-tol?"worse":"stable";
 return{...metric,after,result};
}

export function createActionPlan(tank:Tank,question:string,answer:AquaAIAnswer):AquaActionPlan{
 const page=answer.action?.page||"dashboard";
 const reasoning=reasonLocally(tank,parseAquaQuestion(question));
 let steps:Omit<AquaActionStep,"id"|"done">[]=[];
 let reviewAfterHours=48;
 if(page==="dosing"){
  steps=[{titleAr:"أكد القراءة الحالية بفحص حديث قبل التصحيح",titleEn:"Confirm the current value with a fresh test before correction"},{titleAr:"استخدم حاسبة الجرعات وحدد الهدف والمادة بدقة",titleEn:"Use the dosing calculator and confirm target/compound"},{titleAr:"نفذ الجرعة المحافظة المسجلة فقط",titleEn:"Apply only the recorded conservative dose"},{titleAr:"أعد القياس بعد الجرعة وقارن الاستجابة المتوقعة بالفعلية",titleEn:"Retest after dosing and compare expected vs actual response"}];reviewAfterHours=24;
 } else if(page==="chemistry"){
  steps=[{titleAr:"سجل فحص كيميائي جديد",titleEn:"Log a fresh chemistry test"},{titleAr:"راجع القيم المتغيرة مقارنة بآخر قراءتين",titleEn:"Review values that changed versus the last two readings"},{titleAr:"لا تعدل أكثر من عامل واحد إذا ما في طارئ",titleEn:"Avoid changing more than one variable unless there is an emergency"},{titleAr:"أعد تقييم حالة الحوض بعد 24–48 ساعة",titleEn:"Reassess tank state after 24–48 hours"}];reviewAfterHours=36;
 } else if(page==="equipment"){
  steps=[{titleAr:"افحص الجهاز المشار إليه بصرياً ووظيفياً",titleEn:"Inspect the flagged device visually and functionally"},{titleAr:"نفذ التنظيف/الصيانة المطلوبة وسجلها",titleEn:"Perform and log required cleaning/service"},{titleAr:"تحقق من أثر الجهاز على التدفق/الحرارة/الفلترة",titleEn:"Verify its effect on flow/temperature/filtration"},{titleAr:"راقب حالة الحوض بعد الصيانة",titleEn:"Monitor tank state after service"}];reviewAfterHours=24;
 } else if(page==="maintenance"){
  steps=[{titleAr:"أنجز المهام المستحقة الأعلى تأثيراً أولاً",titleEn:"Complete the highest-impact due tasks first"},{titleAr:"سجل أي ملاحظة غير طبيعية أثناء الصيانة",titleEn:"Log any abnormal observation during maintenance"},{titleAr:"راجع الكيمياء بعد الصيانة إذا كان التغيير كبيراً",titleEn:"Recheck chemistry if maintenance was substantial"},{titleAr:"قارن النتيجة مع المهام المتأخرة قبل التنفيذ",titleEn:"Compare the result against overdue tasks before execution"}];reviewAfterHours=48;
 } else if(page==="emergency"){
  steps=[{titleAr:"أكمل بروتوكول الطوارئ النشط بالكامل",titleEn:"Complete the active emergency protocol"},{titleAr:"أكد استقرار الحرارة والتدفق والأكسجة",titleEn:"Confirm stable temperature, flow and oxygenation"},{titleAr:"أعد فحص الكيمياء بعد استقرار الحالة",titleEn:"Retest chemistry after stabilization"},{titleAr:"راجع سبب الحادث وسجل إجراء منع التكرار",titleEn:"Review root cause and log a prevention action"}];reviewAfterHours=12;
 } else if(page==="quarantine"){
  steps=[{titleAr:"راجع الجرعة والمنتج حسب ملصق الشركة",titleEn:"Verify medication dose/product label"},{titleAr:"راقب الكائن والسلوك قبل الجرعة التالية",titleEn:"Observe organism and behavior before next dose"},{titleAr:"سجل كل جرعة وتغيير ماء بالحجر",titleEn:"Log each dose and quarantine water change"},{titleAr:"قيّم الاستجابة قبل تمديد أو تغيير العلاج",titleEn:"Assess response before extending/changing treatment"}];reviewAfterHours=24;
 } else if(page==="waterchange"){
  steps=[{titleAr:"أكد سبب تغيير الماء والحجم المطلوب",titleEn:"Confirm the reason and required water-change volume"},{titleAr:"طابق حرارة ومواصفات ماء التعويض",titleEn:"Match replacement-water temperature and parameters"},{titleAr:"سجل التغيير والمواد/دفعة RO/DI المستخدمة",titleEn:"Log the change and linked preparation/RODI resources"},{titleAr:"أعد فحص المؤشرات المتأثرة وقارنها بخط الأساس",titleEn:"Retest affected parameters and compare with baseline"}];reviewAfterHours=24;
 } else if(page==="feeding"){
  steps=[{titleAr:"سجل كمية التغذية الفعلية بدقة",titleEn:"Log the actual feeding amount accurately"},{titleAr:"تجنب أي زيادة إضافية خلال فترة التقييم",titleEn:"Avoid extra feeding during the review window"},{titleAr:"راقب سلوك الكائنات وبقايا الطعام",titleEn:"Observe livestock response and uneaten food"},{titleAr:"راجع NO3/PO4 قبل تعديل الروتين بشكل دائم",titleEn:"Review NO3/PO4 before permanently changing the routine"}];reviewAfterHours=72;
 } else if(page==="acclimation"){
  steps=[{titleAr:"أكمل المرحلة الحالية بدون تجاوز البوابات",titleEn:"Complete the current stage without bypassing gates"},{titleAr:"سجل أي Stress أو مسار استثنائي",titleEn:"Log any stress or exception path"},{titleAr:"أكد Dip والشطف للمرجان عند الحاجة",titleEn:"Confirm coral dip and rinse when required"},{titleAr:"راجع صحة الكائن بعد النقل",titleEn:"Review livestock health after transfer"}];reviewAfterHours=24;
 } else if(page==="sump"){
  steps=[{titleAr:"راجع الحجرة أو الميديا المرتبطة بالمشكلة",titleEn:"Inspect the chamber or media linked to the issue"},{titleAr:"نفذ تغييراً واحداً موثقاً فقط",titleEn:"Make one documented change at a time"},{titleAr:"تحقق من مستوى التشغيل والـdrain-back",titleEn:"Verify operating level and drain-back safety"},{titleAr:"راجع أثر التغيير على التدفق والكيمياء",titleEn:"Review the effect on flow and chemistry"}];reviewAfterHours=48;
 } else if(page==="inventory"){
  steps=[{titleAr:"حدد المواد المنخفضة أو الحرجة فعلاً",titleEn:"Identify genuinely low or critical stock"},{titleAr:"صحح الكمية/الحد الأدنى إذا كانت البيانات غير دقيقة",titleEn:"Correct quantity/minimum if the record is inaccurate"},{titleAr:"اربط المواد بالاستهلاك الصحيح",titleEn:"Link stock to the correct consumption workflow"},{titleAr:"تأكد أن المخزون لم يعد تحت الحد المطلوب",titleEn:"Confirm stock is no longer below the required minimum"}];reviewAfterHours=12;
 } else if(page==="rodi"){
  steps=[{titleAr:"أكد TDS الداخل والخارج بقياس جديد",titleEn:"Confirm input/output TDS with a fresh measurement"},{titleAr:"راجع ضغط المصدر ونسبة الرفض",titleEn:"Review source pressure and membrane rejection"},{titleAr:"بدّل المستهلك الموثق فقط إذا لزم",titleEn:"Replace only the evidenced consumable if needed"},{titleAr:"سجل دفعة جديدة وقارن TDS بعد الخدمة",titleEn:"Log a new batch and compare post-service TDS"}];reviewAfterHours=24;
 } else if(page==="livestock"){
  steps=[{titleAr:"حدد الكائنات التي تحتاج متابعة فعلياً",titleEn:"Identify livestock that genuinely need attention"},{titleAr:"ثبت الكيمياء والبيئة قبل أي تغيير إضافي",titleEn:"Stabilize chemistry/environment before additional changes"},{titleAr:"سجل الملاحظة أو العلاج/الحجر المرتبط",titleEn:"Log the observation or linked treatment/quarantine"},{titleAr:"أعد تقييم الحالة والسلوك",titleEn:"Reassess condition and behavior"}];reviewAfterHours=24;
 } else {
  const ranked=reasoning.actions.slice(0,4);
  if(ranked.length){
   steps=ranked.map(x=>({titleAr:x.ar,titleEn:x.en}));
   const verify=ranked[0];
   if(steps.length<4)steps.push({titleAr:verify.recheckAr,titleEn:verify.recheckEn});
   reviewAfterHours=ranked.some(x=>x.level==="danger")?12:ranked.some(x=>x.level==="warn")?24:36;
  } else {
   steps=[{titleAr:answer.action?.ar||"نفذ الإجراء المقترح",titleEn:answer.action?.en||"Apply the suggested action"},{titleAr:"سجل الحدث أو التغيير على الخط الزمني",titleEn:"Log the event/change on the timeline"},{titleAr:"لا تغيّر عدة عوامل معاً إلا للضرورة",titleEn:"Avoid changing several variables at once unless necessary"},{titleAr:"أعد تقييم حالة الحوض وقارن النتيجة",titleEn:"Reassess tank state and compare the result"}];
  }
 }
 return {id:uid("plan"),createdAt:new Date().toISOString(),sourceQuestion:question,titleAr:answer.titleAr,titleEn:answer.titleEn,status:"active",baselineScore:tankStateScore(tank),reviewAfterHours,focus:buildPlanFocus(tank,page,question),steps:steps.map(s=>({id:uid("step"),done:false,...s}))};
}

export function evaluatePlanOutcome(tank:Tank,plan:AquaActionPlan){
 const current=tankStateScore(tank),delta=current-plan.baselineScore;
 const details=(plan.focus?.metrics??[]).map(metric=>evaluateMetric(metric,metricValue(tank,metric.key)));
 const known=details.filter(x=>x.result!=="unknown"),improved=known.filter(x=>x.result==="improved").length,worse=known.filter(x=>x.result==="worse").length;
 const usedDomainMetrics=known.length>0;
 const outcome:AquaActionPlan["outcome"]=usedDomainMetrics
  ?(improved>worse?"improved":worse>improved?"worse":"stable")
  :(delta>=4?"improved":delta<=-4?"worse":"stable");
 const changed=details.filter(x=>x.result==="improved"||x.result==="worse");
 const arDetail=changed.slice(0,3).map(x=>`${x.labelAr}: ${x.before??"—"} → ${x.after??"—"}`).join(" • ");
 const enDetail=changed.slice(0,3).map(x=>`${x.labelEn}: ${x.before??"—"} → ${x.after??"—"}`).join(" • ");
 const summaryAr=usedDomainMetrics
  ?`التقييم اعتمد على ${plan.focus?.domain||"المجال"} نفسه${arDetail?`: ${arDetail}`:"؛ ما ظهر تغير جوهري بعد"}.`
  :`ما توفر مقياس تخصصي كافٍ؛ تم استخدام صحة الحوض العامة ${plan.baselineScore}% → ${current}%.`;
 const summaryEn=usedDomainMetrics
  ?`Outcome was evaluated from the ${plan.focus?.domain||"domain"} itself${enDetail?`: ${enDetail}`:"; no material domain change was detected"}.`
  :`No sufficient domain-specific metric was available; overall tank health was used (${plan.baselineScore}% → ${current}%).`;
 return {current,delta,outcome,details,summaryAr,summaryEn,usedDomainMetrics};
}
