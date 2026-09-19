import type { Language,Tank } from "./types";
import { chemistryGuidance } from "./chemistryGuidance";
import { systemHealth } from "./systemHealth";
import { maintenanceEffectiveState } from "./maintenanceSchedule";

export type SystemAlertLevel="info"|"warn"|"danger";

export interface SystemAlert{
  id:string;
  level:SystemAlertLevel;
  domain:"chemistry"|"maintenance"|"equipment"|"livestock"|"inventory"|"quarantine"|"emergency"|"acclimation"|"system";
  ar:string;
  en:string;
  actionPage?:"chemistry"|"maintenance"|"equipment"|"livestock"|"inventory"|"quarantine"|"emergency"|"acclimation";
}

function pushUnique(list:SystemAlert[],alert:SystemAlert){
  if(!list.some(x=>x.id===alert.id))list.push(alert);
}

export function systemAlerts(tank:Tank):SystemAlert[]{
  const out:SystemAlert[]=[];
  const guide=chemistryGuidance(tank);
  const system=systemHealth(tank);
  const today=new Date().toISOString().slice(0,10);

  if(guide.health===null)pushUnique(out,{id:"chem-unknown",level:"warn",domain:"chemistry",ar:"بيانات الكيمياء غير كافية لتحديد Chemistry Health موثوق.",en:"Chemistry data is insufficient for a reliable Chemistry Health state.",actionPage:"chemistry"});
  for(const x of guide.dataIssues.slice(0,5)){
    pushUnique(out,{id:`chem-data-${x.key}`,level:"warn",domain:"chemistry",ar:x.reasonAr,en:x.reasonEn,actionPage:"chemistry"});
  }
  for(const x of guide.problems.slice(0,6)){
    pushUnique(out,{id:`chem-${x.key}`,level:x.level==="danger"?"danger":"warn",domain:"chemistry",ar:x.reasonAr,en:x.reasonEn,actionPage:"chemistry"});
  }

  for(const task of tank.maintenance){
    const state=maintenanceEffectiveState(task,today);
    if(state.overdue){
      pushUnique(out,{id:`maint-${task.id}`,level:"warn",domain:"maintenance",ar:`مهمة صيانة متأخرة: ${task.title}`,en:`Overdue maintenance: ${task.titleEn||task.title}`,actionPage:"maintenance"});
    }
  }

  for(const issue of system.equipmentAudit.issues.slice(0,8)){
    pushUnique(out,{id:`eq-${issue.id}`,level:issue.level==="danger"?"danger":"warn",domain:"equipment",ar:issue.ar,en:issue.en,actionPage:"equipment"});
  }
  for(const issue of system.compatibilityAudit.issues.slice(0,8)){
    pushUnique(out,{id:`compat-${issue.ar}`,level:issue.level==="danger"?"danger":"warn",domain:"livestock",ar:issue.ar,en:issue.en,actionPage:"livestock"});
  }

  for(const item of tank.livestock.filter(x=>x.health==="watch"||x.health==="treatment")){
    pushUnique(out,{id:`live-${item.id}`,level:item.health==="treatment"?"danger":"warn",domain:"livestock",ar:`${item.name}: الحالة مسجلة ${item.health==="treatment"?"تحت العلاج":"تحتاج مراقبة"}.`,en:`${item.nameEn||item.name}: status is ${item.health==="treatment"?"under treatment":"watch"}.`,actionPage:"livestock"});
  }

  for(const item of tank.inventory.filter(x=>x.quantity<=x.minimum)){
    pushUnique(out,{id:`inv-${item.id}`,level:item.quantity<=0?"danger":"warn",domain:"inventory",ar:`المخزون منخفض: ${item.name} (${item.quantity} ${item.unit}).`,en:`Low stock: ${item.nameEn||item.name} (${item.quantity} ${item.unit}).`,actionPage:"inventory"});
  }

  for(const e of tank.equipment){
    for(const c of e.consumables??[]){
      const stock=c.quantityOnHand??0,min=c.minimumOnHand??0;
      if(min>0&&stock<min){
        pushUnique(out,{id:`cons-${e.id}-${c.id}`,level:stock<=0?"danger":"warn",domain:"inventory",ar:`${e.name}: مخزون ${c.name} أقل من الحد الأدنى (${stock}/${min}).`,en:`${e.name}: ${c.nameEn||c.name} stock is below minimum (${stock}/${min}).`,actionPage:"inventory"});
      }
    }
  }

  const emergency=(tank.emergencySessions??[]).find(x=>x.status==="active");
  if(emergency)pushUnique(out,{id:`em-${emergency.id}`,level:"danger",domain:"emergency",ar:`بروتوكول طوارئ نشط: ${emergency.titleAr}`,en:`Active emergency protocol: ${emergency.titleEn}`,actionPage:"emergency"});

  const activeQuarantine=tank.quarantine.filter(x=>x.status==="active");
  if(activeQuarantine.length)pushUnique(out,{id:"quarantine-active",level:"warn",domain:"quarantine",ar:`يوجد ${activeQuarantine.length} حالة حجر/علاج نشطة.`,en:`${activeQuarantine.length} quarantine/treatment case(s) are active.`,actionPage:"quarantine"});

  const activeAcc=(tank.acclimationSessions??[]).find(x=>x.status!=="completed");
  if(activeAcc)pushUnique(out,{id:`acc-${activeAcc.id}`,level:"info",domain:"acclimation",ar:"هناك جلسة إقلمة نشطة حالياً.",en:"An acclimation session is currently active.",actionPage:"acclimation"});

  if(system.score<60)pushUnique(out,{id:"system-critical",level:"danger",domain:"system",ar:`صحة النظام الكلية ${system.score}% وتحتاج تدخل منظم حسب أعلى التنبيهات.`,en:`Overall system health is ${system.score}% and needs structured action based on the highest-priority alerts.`});
  else if(system.score<80)pushUnique(out,{id:"system-watch",level:"warn",domain:"system",ar:`صحة النظام الكلية ${system.score}% وتحتاج متابعة.`,en:`Overall system health is ${system.score}% and needs attention.`});

  const order={danger:0,warn:1,info:2};
  return out.sort((a,b)=>order[a.level]-order[b.level]);
}

export function localizedAlert(alert:SystemAlert,lang:Language){return lang==="ar"?alert.ar:alert.en;}
