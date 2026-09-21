import type { Tank } from "./types";
import type { AquaAIAnswer } from "./aquaAIBrain";
import { tankStateScore } from "./tankIntelligence";
import { parseAquaQuestion } from "./aquaAIIntent";
import { reasonLocally } from "./aquaAILocalReasoner";
import { chemistryCatalogForTank } from "./chemistryProfile";
import { equipmentAdequacy } from "./equipmentAdequacy";
import { maintenanceEffectiveState } from "./maintenanceSchedule";

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
const today=()=>new Date().toISOString().slice(0,10);

function latestChemistry(tank:Tank,param:string){
 for(const reading of [...tank.chemistry].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())){
  const value=reading.values[param];
  if(typeof value==="number"&&Number.isFinite(value))return value;
 }
 return null;
}
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
