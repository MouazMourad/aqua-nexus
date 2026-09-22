import type { Tank } from "./types";
import type { AquaAIAnswer,AquaAIPage } from "./aquaAIBrain";
import type { AquaQuestionIntent } from "./aquaAIIntent";
import type { AquaAIQueryPlan } from "./aquaAIQueryPlan";
import { resolveAquaEntities,equipmentKindLabel } from "./aquaAIEntities";
import { maintenanceProcedure } from "./aquaAIMaintenanceKnowledge";
import { latestTankAnswer } from "./aquaAILatestAnswer";
import { answerWhatIf } from "./aquaAIWhatIf";
import { unifiedInventory } from "./inventoryIntelligence";
import { maintenanceEffectiveState } from "./maintenanceSchedule";
import { localDateKey } from "./timeSafety";

function dateOnly(value?:string){
 if(!value)return undefined;
 const d=new Date(value);
 return Number.isFinite(d.getTime())?d:undefined;
}
function daysFromNow(value?:string){
 const d=dateOnly(value);if(!d)return undefined;
 const today=new Date();today.setHours(0,0,0,0);d.setHours(0,0,0,0);
 return Math.round((d.getTime()-today.getTime())/86400000);
}
function whenLabelAr(days:number){
 if(days===0)return "اليوم";
 if(days===1)return "بكرا";
 if(days<0)return `متأخرة ${Math.abs(days)} يوم`;
 return `بعد ${days} يوم`;
}
function whenLabelEn(days:number){
 if(days===0)return "today";
 if(days===1)return "tomorrow";
 if(days<0)return `${Math.abs(days)} day(s) overdue`;
 return `in ${days} day(s)`;
}
function cadenceAr(c:string){
 const m:Record<string,string>={daily:"يومية",weekly:"أسبوعية",monthly:"شهرية",quarterly:"كل 3 أشهر",semiannual:"كل 6 أشهر",annual:"سنوية",once:"مرة واحدة"};
 return m[c]||c;
}
function cadenceEn(c:string){
 const m:Record<string,string>={daily:"daily",weekly:"weekly",monthly:"monthly",quarterly:"quarterly",semiannual:"semiannual",annual:"annual",once:"one-time"};
 return m[c]||c;
}

function procedureAnswer(tank:Tank,intent:AquaQuestionIntent):AquaAIAnswer|undefined{
 const entities=resolveAquaEntities(tank,intent.raw);
 const equipment=tank.equipment.find(x=>entities.equipmentIds.includes(x.id));
 const kind=equipment?.kind||entities.equipmentKinds[0];
 if(!kind)return undefined;
 const p=maintenanceProcedure(kind);
 const interval=equipment?.serviceIntervalDays??p.suggestedIntervalDays;
 const last=equipment?.lastServiceAt;
 const next=last&&interval?localDateKey(new Date(new Date(last).getTime()+interval*86400000)):undefined;
 return {
  titleAr:p.titleAr,titleEn:p.titleEn,
  summaryAr:`هاي صيانة عملية لـ ${equipment?.name||equipmentKindLabel(kind,"ar")}. نفذها بالترتيب، والأهم افصل الكهرباء قبل فك أي جزء كهربائي.`,
  summaryEn:`This is a practical maintenance procedure for ${equipment?.name||equipmentKindLabel(kind,"en")}. Follow it in order and disconnect power before opening electrical equipment.`,
  detailsAr:[
   ...p.stepsAr.map((x,i)=>`${i+1}. ${x}`),
   `⚠️ ${p.cautionAr}`,
   `بعدها: ${p.recheckAr}`,
   interval?`الدورية المرجعية: تقريباً كل ${interval} يوم`:"",
   last?`آخر صيانة مسجلة: ${new Date(last).toLocaleDateString()}`:"",
   next?`الموعد المحسوب التالي: ${new Date(next).toLocaleDateString()}`:""
  ].filter(Boolean),
  detailsEn:[
   ...p.stepsEn.map((x,i)=>`${i+1}. ${x}`),
   `⚠️ ${p.cautionEn}`,
   `Afterward: ${p.recheckEn}`,
   interval?`Reference interval: about every ${interval} days`:"",
   last?`Last logged service: ${new Date(last).toLocaleDateString()}`:"",
   next?`Calculated next service: ${new Date(next).toLocaleDateString()}`:""
  ].filter(Boolean),
  evidenceAr:[equipment?`الجهاز المسجل: ${equipment.name}`:`نوع الجهاز: ${equipmentKindLabel(kind,"ar")}`,last?"يوجد تاريخ صيانة مسجل":"لا يوجد تاريخ صيانة مسجل"],
  evidenceEn:[equipment?`Registered equipment: ${equipment.name}`:`Equipment type: ${equipmentKindLabel(kind,"en")}`,last?"A service date is logged":"No service date is logged"],
  confidence:equipment?"high":"medium",
  action:{page:"equipment",ar:"افتح الجهاز وحدّث تاريخ الصيانة بعد ما تخلص",en:"Open the equipment and update its service date when finished"}
 };
}

function maintenanceWhenAnswer(tank:Tank,intent:AquaQuestionIntent):AquaAIAnswer{
 const entities=resolveAquaEntities(tank,intent.raw);
 const matchedTasks=tank.maintenance.filter(x=>entities.maintenanceTaskIds.includes(x.id));
 const pool=(matchedTasks.length?matchedTasks:tank.maintenance)
  .filter(x=>Boolean(x.nextDue)&&(x.cadence!=="once"||!x.done))
  .map(x=>({task:x,days:daysFromNow(x.nextDue)!}))
  .filter(x=>Number.isFinite(x.days))
  .sort((a,b)=>a.days-b.days);
 const equipment=tank.equipment.find(x=>entities.equipmentIds.includes(x.id));
 const kind=equipment?.kind||entities.equipmentKinds[0];
 const proc=kind?maintenanceProcedure(kind):undefined;
 if(pool.length){
  const first=pool[0];
  return {
   titleAr:"موعد الصيانة القادم",titleEn:"Next maintenance due",
   summaryAr:`المهمة الجاية هي «${first.task.title}» — ${whenLabelAr(first.days)} (${new Date(first.task.nextDue!).toLocaleDateString()}).`,
   summaryEn:`The next task is “${first.task.titleEn||first.task.title}” — ${whenLabelEn(first.days)} (${new Date(first.task.nextDue!).toLocaleDateString()}).`,
   detailsAr:[`الدورية: ${cadenceAr(first.task.cadence)}.`,first.task.lastDone?`آخر تنفيذ: ${new Date(first.task.lastDone).toLocaleDateString()}.`:"لا يوجد آخر تنفيذ مسجل.",...pool.slice(1,4).map(x=>`بعدها: ${x.task.title} — ${whenLabelAr(x.days)}.`)],
   detailsEn:[`Cadence: ${cadenceEn(first.task.cadence)}.`,first.task.lastDone?`Last completed: ${new Date(first.task.lastDone).toLocaleDateString()}.`:"No last completion is logged.",...pool.slice(1,4).map(x=>`Then: ${x.task.titleEn||x.task.title} — ${whenLabelEn(x.days)}.`)],
   evidenceAr:[`${tank.maintenance.length} مهام صيانة مسجلة`],evidenceEn:[`${tank.maintenance.length} maintenance tasks logged`],
   confidence:"high",action:{page:"maintenance",ar:"افتح جدول الصيانة",en:"Open maintenance schedule"}
  };
 }
 if(equipment){
  const interval=equipment.serviceIntervalDays??proc?.suggestedIntervalDays;
  if(equipment.lastServiceAt&&interval){
   const next=new Date(new Date(equipment.lastServiceAt).getTime()+interval*86400000);
   const days=daysFromNow(next.toISOString())??0;
   return {
    titleAr:`موعد صيانة ${equipment.name}`,titleEn:`${equipment.name} service timing`,
    summaryAr:`حسب آخر صيانة والدورية المسجلة، الموعد المحسوب ${whenLabelAr(days)} (${next.toLocaleDateString()}).`,
    summaryEn:`Based on the last service and interval, the calculated due date is ${whenLabelEn(days)} (${next.toLocaleDateString()}).`,
    detailsAr:[`آخر صيانة: ${new Date(equipment.lastServiceAt).toLocaleDateString()}.`,`الدورية: كل ${interval} يوم.`],
    detailsEn:[`Last service: ${new Date(equipment.lastServiceAt).toLocaleDateString()}.`,`Interval: every ${interval} days.`],
    evidenceAr:["الحساب مبني على سجل الجهاز"],evidenceEn:["Calculated from the equipment record"],
    confidence:"high",action:{page:"equipment",ar:"افتح الجهاز",en:"Open equipment"}
   };
  }
 }
 return {
  titleAr:"جدول الصيانة",titleEn:"Maintenance schedule",
  summaryAr:"ما في مهمة قادمة بتاريخ محدد حالياً. يعني المشكلة مو إنه ما في صيانة؛ مواعيد Next Due غير مسجلة.",
  summaryEn:"There is no maintenance task with a specific upcoming due date. That does not mean no maintenance is needed; Next Due dates are not configured.",
  detailsAr:[
   proc&&kind?`لهذا النوع (${equipmentKindLabel(kind,"ar")}) الدورية المرجعية تقريباً كل ${equipment?.serviceIntervalDays??proc.suggestedIntervalDays??"—"} يوم.`:"",
   "الأفضل نربط كل جهاز بمهمة صيانة ودورية وتاريخ آخر تنفيذ حتى يعطيك موعد دقيق بدل جواب عام."
  ].filter(Boolean),
  detailsEn:[
   proc&&kind?`For this type (${equipmentKindLabel(kind,"en")}), the reference interval is about every ${equipment?.serviceIntervalDays??proc.suggestedIntervalDays??"—"} days.`:"",
   "Link each device to a maintenance task, interval and last-service date so the assistant can calculate an exact next due date."
  ].filter(Boolean),
  evidenceAr:[`${tank.maintenance.length} مهام مسجلة، بدون موعد قادم قابل للاستخدام`],evidenceEn:[`${tank.maintenance.length} tasks logged, with no usable upcoming due date`],
  confidence:"high",action:{page:"maintenance",ar:"افتح الصيانة وحدد Next Due",en:"Open maintenance and set Next Due"}
 };
}

function listOrCountAnswer(tank:Tank,plan:AquaAIQueryPlan):AquaAIAnswer|undefined{
 const isCount=plan.operation==="count";
 if(plan.primary==="livestock"){
  const total=tank.livestock.reduce((s,x)=>s+x.quantity,0);
  return {
   titleAr:isCount?"عدد الكائنات":"كائنات الحوض",titleEn:isCount?"Livestock count":"Tank livestock",
   summaryAr:isCount?`عندك ${total} كائن فعلي ضمن ${tank.livestock.length} سجل.`:`عندك ${tank.livestock.length} سجل كائنات بإجمالي ${total} كائن.`,
   summaryEn:isCount?`You have ${total} individual livestock across ${tank.livestock.length} records.`:`You have ${tank.livestock.length} livestock records totaling ${total} individuals.`,
   detailsAr:tank.livestock.slice(0,12).map(x=>`${x.name} ×${x.quantity} — ${x.health}`),
   detailsEn:tank.livestock.slice(0,12).map(x=>`${x.nameEn||x.name} ×${x.quantity} — ${x.health}`),
   evidenceAr:[`${tank.livestock.length} سجلات`],evidenceEn:[`${tank.livestock.length} records`],
   confidence:"high",action:{page:"livestock",ar:"افتح قائمة الكائنات",en:"Open livestock list"}
  };
 }
 if(plan.primary==="equipment"){
  return {
   titleAr:isCount?"عدد المعدات":"معدات الحوض",titleEn:isCount?"Equipment count":"Tank equipment",
   summaryAr:`عندك ${tank.equipment.length} جهاز مسجل.`,summaryEn:`You have ${tank.equipment.length} registered equipment item(s).`,
   detailsAr:tank.equipment.slice(0,12).map(x=>`${x.name} — ${equipmentKindLabel(x.kind,"ar")} — ${x.status}`),
   detailsEn:tank.equipment.slice(0,12).map(x=>`${x.name} — ${equipmentKindLabel(x.kind,"en")} — ${x.status}`),
   evidenceAr:[`${tank.equipment.length} أجهزة`],evidenceEn:[`${tank.equipment.length} equipment items`],
   confidence:"high",action:{page:"equipment",ar:"افتح المعدات",en:"Open equipment"}
  };
 }
 if(plan.primary==="maintenance"){
  const pending=tank.maintenance.filter(x=>!maintenanceEffectiveState(x).completed);
  return {
   titleAr:isCount?"عدد مهام الصيانة":"مهام الصيانة",titleEn:isCount?"Maintenance task count":"Maintenance tasks",
   summaryAr:`عندك ${tank.maintenance.length} مهمة صيانة، منها ${pending.length} غير منجزة حالياً.`,summaryEn:`You have ${tank.maintenance.length} maintenance tasks, with ${pending.length} currently not completed.`,
   detailsAr:pending.slice(0,12).map(x=>`${x.title}${x.nextDue?` — ${new Date(x.nextDue).toLocaleDateString()}`:" — بدون موعد"}`),
   detailsEn:pending.slice(0,12).map(x=>`${x.titleEn||x.title}${x.nextDue?` — ${new Date(x.nextDue).toLocaleDateString()}`:" — no due date"}`),
   evidenceAr:[`${tank.maintenance.length} مهام`],evidenceEn:[`${tank.maintenance.length} tasks`],
   confidence:"high",action:{page:"maintenance",ar:"افتح الصيانة",en:"Open maintenance"}
  };
 }
 if(plan.primary==="inventory"){
  const stock=unifiedInventory(tank),low=stock.low;
  return {titleAr:isCount?"عدد عناصر المخزون":"المخزون الموحد",titleEn:isCount?"Inventory count":"Unified inventory",summaryAr:`عندك ${stock.total} عنصر مخزون، منها ${low.length} منخفضة.`,summaryEn:`You have ${stock.total} stock item(s), with ${low.length} low.`,detailsAr:stock.rows.slice(0,12).map(x=>`${x.name}: ${x.quantity} ${x.unit} (الحد ${x.minimum})`),detailsEn:stock.rows.slice(0,12).map(x=>`${x.nameEn||x.name}: ${x.quantity} ${x.unit} (min ${x.minimum})`),evidenceAr:[`${stock.consumables.length} مستهلكات معدات`],evidenceEn:[`${stock.consumables.length} equipment consumables`],confidence:"high",action:{page:"inventory",ar:"افتح المخزون",en:"Open inventory"}};
 }
 if(plan.primary==="quarantine"){
  const active=tank.quarantine.filter(x=>x.status==="active");
  return {titleAr:isCount?"حالات الحجر النشطة":"الحجر والعلاج",titleEn:isCount?"Active quarantine cases":"Quarantine & treatment",summaryAr:`في ${active.length} حالة نشطة من أصل ${tank.quarantine.length}.`,summaryEn:`${active.length} active case(s) out of ${tank.quarantine.length} total.`,detailsAr:active.map(x=>`${x.organism}: ${x.reason}`),detailsEn:active.map(x=>`${x.organism}: ${x.reason}`),evidenceAr:[`${tank.quarantine.length} حالات`],evidenceEn:[`${tank.quarantine.length} cases`],confidence:"high",action:{page:"quarantine",ar:"افتح الحجر",en:"Open quarantine"}};
 }
 return undefined;
}

export function answerSpecialOperation(tank:Tank,intent:AquaQuestionIntent,plan:AquaAIQueryPlan):AquaAIAnswer|undefined{
 if(plan.operation==="whatIf")return answerWhatIf(tank,intent.raw);
 if(plan.operation==="how"){
  const procedure=procedureAnswer(tank,intent);
  if(procedure)return procedure;
 }
 if((plan.operation==="when"||(plan.operation==="list"&&plan.primary==="maintenance"))&&(plan.primary==="maintenance"||plan.primary==="equipment"))return maintenanceWhenAnswer(tank,intent);
 if(plan.operation==="latest")return latestTankAnswer(tank,plan);
 if(plan.operation==="list"||plan.operation==="count")return listOrCountAnswer(tank,plan);
 return undefined;
}
