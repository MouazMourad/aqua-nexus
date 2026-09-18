import type { Tank } from "./types";
import type { AquaAIAnswer } from "./aquaAIBrain";
import { tankStateScore } from "./tankIntelligence";
import { parseAquaQuestion } from "./aquaAIIntent";
import { reasonLocally } from "./aquaAILocalReasoner";

export interface AquaActionStep{ id:string; titleAr:string; titleEn:string; done:boolean; completedAt?:string; }
export interface AquaActionPlan{
 id:string;createdAt:string;sourceQuestion:string;titleAr:string;titleEn:string;status:"active"|"completed";
 baselineScore:number;reviewAfterHours:number;steps:AquaActionStep[];completedAt?:string;outcomeScore?:number;outcome?:"improved"|"stable"|"worse";
}

const uid=(p:string)=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

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
  steps=[{titleAr:"أنجز المهام المستحقة الأعلى تأثيراً أولاً",titleEn:"Complete the highest-impact due tasks first"},{titleAr:"سجل أي ملاحظة غير طبيعية أثناء الصيانة",titleEn:"Log any abnormal observation during maintenance"},{titleAr:"راجع الكيمياء بعد الصيانة إذا كان التغيير كبيراً",titleEn:"Recheck chemistry if maintenance was substantial"},{titleAr:"قارن Health Score بعد التنفيذ",titleEn:"Compare Health Score after completion"}];reviewAfterHours=48;
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
 return {id:uid("plan"),createdAt:new Date().toISOString(),sourceQuestion:question,titleAr:answer.titleAr,titleEn:answer.titleEn,status:"active",baselineScore:tankStateScore(tank),reviewAfterHours,steps:steps.map(s=>({id:uid("step"),done:false,...s}))};
}

export function evaluatePlanOutcome(tank:Tank,plan:AquaActionPlan){
 const current=tankStateScore(tank),delta=current-plan.baselineScore;
 const outcome:AquaActionPlan["outcome"]=delta>=4?"improved":delta<=-4?"worse":"stable";
 return {current,delta,outcome};
}
