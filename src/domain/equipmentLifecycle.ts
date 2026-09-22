import type { Equipment,EquipmentConsumable,EquipmentKind,MaintenanceTask,Tank } from "./types";
import { addLocalCalendarDays,localDateKey } from "./timeSafety";

const DAY=86400000;
const nowDate=()=>localDateKey();
const addDays=(date:string,days:number)=>addLocalCalendarDays(date,days);
const ageDays=(date?:string)=>date?Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/DAY)):0;

type Cadence=MaintenanceTask["cadence"];
interface MaintenanceBlueprint{key:string;ar:string;en:string;days:number;cadence:Cadence;checklist:string[];}
interface LifeDefaults{min:number;max:number;criticality:"critical"|"important"|"normal";tasks:MaintenanceBlueprint[];consumables:Array<Omit<EquipmentConsumable,"id">>;}

const Y=365;
const T=(key:string,ar:string,en:string,days:number,cadence:Cadence,checklist:string[]):MaintenanceBlueprint=>({key,ar,en,days,cadence,checklist});
const C=(name:string,nameEn:string,lifeDays:number,minimumOnHand=1,unit:NonNullable<EquipmentConsumable["unit"]>="pc"):Omit<EquipmentConsumable,"id">=>({name,nameEn,lifeDays,minimumOnHand,quantityOnHand:0,unit});

export const EQUIPMENT_LIFECYCLE:Record<EquipmentKind,LifeDefaults>={
 lighting:{min:5*Y,max:10*Y,criticality:"important",tasks:[
  T("clean","تنظيف العدسات والغطاء","Clean lenses and cover",30,"monthly",["افصل الكهرباء","نظف الملح والغبار بدون منظفات منزلية","افحص المراوح والحرارة","تأكد من ثبات الجدول"]),
  T("output","مراجعة شدة وتغطية الإضاءة","Review light output and coverage",182,"semiannual",["راجع PAR إن توفر","راجع مناطق الظل","قارن الشدة مع آخر قياس","سجل أي قناة ضعفت"])
 ],consumables:[]},
 waveMaker:{min:3*Y,max:7*Y,criticality:"important",tasks:[
  T("clean","تنظيف Wave Maker","Clean wave maker",30,"monthly",["افصل الكهرباء","نظف الـimpeller والمغناطيس","أزل الكلس والطحالب","اختبر الاهتزاز والصوت","أكد اتجاه التدفق"])
 ],consumables:[]},
 skimmer:{min:8*Y,max:15*Y,criticality:"important",tasks:[
  T("cup","تنظيف كوب ورقبة السكيمر","Clean skimmer cup and neck",7,"weekly",["افرغ الكوب","نظف الرقبة","اشطف جيداً","راجع مستوى الرغوة"]),
  T("air","فحص Venturi ومدخل الهواء","Inspect skimmer venturi and air path",30,"monthly",["افحص خرطوم الهواء","أزل الملح من venturi","تأكد من سحب الهواء"]),
  T("pump","تنظيف مضخة السكيمر","Service skimmer pump",90,"quarterly",["افصل الكهرباء","فك المضخة حسب الدليل","نظف impeller والحجرة","افحص البوش/المحور","اختبر التشغيل بعد التركيب"])
 ],consumables:[]},
 returnPump:{min:4*Y,max:10*Y,criticality:"critical",tasks:[
  T("flow","فحص تدفق مضخة الرجوع","Check return-pump flow",30,"monthly",["راجع التدفق الفعلي","افحص الصوت والاهتزاز","افحص التسريب","تأكد من عدم سحب هواء"]),
  T("deep","تنظيف مضخة الرجوع والـImpeller","Deep-clean return pump and impeller",90,"quarterly",["افصل الكهرباء وأغلق الصمامات","نظف impeller والحجرة","افحص O-rings","أعد فتح الصمامات","اختبر التدفق والتسريب"])
 ],consumables:[]},
 filterSock:{min:180,max:540,criticality:"normal",tasks:[
  T("wash","تبديل/غسيل Filter Sock","Change / wash filter sock",3,"weekly",["أخرج الجراب بدون نشر الرواسب","ركب جراب نظيف","اغسل المتسخ","جففه بالكامل"])
 ],consumables:[C("Filter Sock احتياطي","Spare filter sock",365,2)]},
 rollerFilter:{min:3*Y,max:7*Y,criticality:"important",tasks:[
  T("sensor","فحص حساس ومسار الرول","Inspect roller sensor and path",7,"weekly",["نظف حساس المستوى","افحص حركة الرول","افحص المحرك","تأكد من عدم انحراف القماش"])
 ],consumables:[C("Roller fleece","Roller fleece",30,1)]},
 reactor:{min:8*Y,max:15*Y,criticality:"normal",tasks:[
  T("flow","فحص تدفق وميديا الرياكتر","Check reactor flow and media",30,"monthly",["راجع التدفق","افحص تكتل الميديا","افحص O-ring والتسريب","بدل الميديا عند الحاجة"])
 ],consumables:[C("Media refill","Media refill",45,250,"g")]},
 heater:{min:2*Y,max:5*Y,criticality:"critical",tasks:[
  T("verify","فحص السخان ومقارنة الحرارة","Inspect heater and verify temperature",30,"monthly",["قارن الحرارة بمرجع مستقل","افحص الغلاف والكابل","تأكد من عدم وجود تكاثف/صدأ","راجع عمل الكنترولر"]),
  T("safety","مراجعة أمان السخان","Heater safety review",90,"quarterly",["اختبر فصل الكنترولر","افحص تثبيت السخان","راجع سجل الحرارة","قرر إن كان يلزم استبدال وقائي"])
 ],consumables:[]},
 doser:{min:4*Y,max:8*Y,criticality:"important",tasks:[
  T("calibrate","معايرة الدوزر","Calibrate dosing pump",90,"quarterly",["اختبر جرعة في مخبار","قارن الفعلي بالمبرمج","افحص الأنابيب","نظف مخارج الجرعات","حدث المعايرة"])
 ],consumables:[C("Dosing tubing","Dosing tubing",365,1)]},
 uv:{min:5*Y,max:10*Y,criticality:"normal",tasks:[
  T("sleeve","تنظيف Quartz Sleeve للـUV","Clean UV quartz sleeve",90,"quarterly",["افصل الكهرباء والماء","دع الوحدة تبرد","نظف quartz sleeve","افحص O-rings","اختبر التسريب قبل تشغيل UV"])
 ],consumables:[C("UV-C lamp","UV-C lamp",300,1),C("UV O-ring","UV O-ring",730,1)]},
 ozone:{min:3*Y,max:7*Y,criticality:"normal",tasks:[
  T("check","فحص مولد الأوزون ومسار الهواء","Inspect ozone generator and air path",30,"monthly",["افحص الرائحة والتسريب","راجع مجفف الهواء","افحص الكربون على المخارج","راجع ORP والتحكم"])
 ],consumables:[C("Air dryer media","Air dryer media",60,250,"g"),C("Activated carbon","Activated carbon",30,250,"g")]},
 ato:{min:4*Y,max:8*Y,criticality:"important",tasks:[
  T("test","اختبار حساس ومضخة ATO","Test ATO sensor and pump",7,"weekly",["اختبر توقف المضخة","نظف الحساس/العوامة","افحص السيفون العكسي","اختبر حماية التشغيل الطويل"])
 ],consumables:[]},
 refugiumLight:{min:4*Y,max:8*Y,criticality:"normal",tasks:[
  T("clean","تنظيف وفحص إضاءة الرفيوجيوم","Clean and inspect refugium light",30,"monthly",["نظف العدسة","راجع الحرارة","راقب نمو الماكرو ألجي","راجع الجدول"])
 ],consumables:[]},
 turfScrubber:{min:8*Y,max:15*Y,criticality:"normal",tasks:[
  T("harvest","حصاد وتنظيف Turf Scrubber","Harvest and inspect turf scrubber",14,"weekly",["احصد تدريجياً","نظف مسار الماء","افحص المضخة","راجع توزيع الإضاءة"])
 ],consumables:[]},
 probe:{min:Y,max:3*Y,criticality:"important",tasks:[
  T("calibrate","تنظيف ومعايرة المجس","Clean and calibrate probe",30,"monthly",["اشطف المجس","نظفه حسب نوعه","عاير بمحاليل صالحة","قارن بمرجع مستقل","سجل النتيجة"])
 ],consumables:[C("Calibration solution","Calibration solution",180,100,"mL")]},
 co2:{min:5*Y,max:12*Y,criticality:"important",tasks:[
  T("leak","فحص تسريب وضغط منظومة CO₂","Inspect CO₂ pressure and leaks",30,"monthly",["افحص ضغط الأسطوانة","اختبر الوصلات للتسريب","افحص المنظم والـsolenoid","راجع الـbubble counter والـdiffuser","أكد توقيت CO₂ مع الإضاءة"]),
  T("diffuser","تنظيف وفحص CO₂ diffuser","Clean and inspect CO₂ diffuser",30,"monthly",["أوقف CO₂ بأمان","نظف الـdiffuser حسب تعليمات الشركة","افحص انسداد المسام","أعد التشغيل وراقب الانتشار"])
 ],consumables:[C("CO₂ cylinder/refill","CO₂ cylinder/refill",180,1),C("CO₂ tubing","CO₂ tubing",730,1,"m")]},
 overflow:{min:10*Y,max:20*Y,criticality:"critical",tasks:[
  T("inspect","فحص Overflow ومسار الصرف","Inspect overflow and drain path",30,"monthly",["افحص الأسنان/الشبك","تأكد من عدم وجود انسداد","راجع الصوت ومستوى الماء","افحص التسريب"]),
  T("poweroff","اختبار انقطاع الكهرباء والرجوع","Power-off and backflow test",182,"semiannual",["افصل مضخة الرجوع","راقب مستوى السامب","تأكد من توقف السيفون بأمان","أعد التشغيل وتأكد من استقرار الصرف"])
 ],consumables:[]},
 other:{min:3*Y,max:8*Y,criticality:"normal",tasks:[
  T("inspect","فحص وصيانة الجهاز","Inspect and service equipment",90,"quarterly",["افصل الكهرباء إن لزم","افحص الاتساخ والتسريب","نظف حسب دليل الشركة","اختبر التشغيل"])
 ],consumables:[]}
};

export function equipmentDefaults(kind:EquipmentKind){return EQUIPMENT_LIFECYCLE[kind]??EQUIPMENT_LIFECYCLE.other;}

export function createDefaultConsumables(kind:EquipmentKind):EquipmentConsumable[]{
  return equipmentDefaults(kind).consumables.map((x,i)=>({...x,id:`cons-${kind}-${i}`,installedAt:nowDate()}));
}

export function hydrateEquipment(e:Equipment):Equipment{
  const d=equipmentDefaults(e.kind);
  return {
    ...e,
    expectedLifeMinDays:e.expectedLifeMinDays??d.min,
    expectedLifeMaxDays:e.expectedLifeMaxDays??d.max,
    criticality:e.criticality??d.criticality,
    spareAvailable:e.spareAvailable??false,
    failures:e.failures??[],
    consumables:e.consumables??createDefaultConsumables(e.kind)
  };
}

export function equipmentLife(e:Equipment){
  const h=hydrateEquipment(e),age=ageDays(h.installedAt),min=h.expectedLifeMinDays||1,max=Math.max(min,h.expectedLifeMaxDays||min);
  const midpoint=(min+max)/2;
  const used=Math.max(0,age/midpoint*100);
  const failures=(h.failures??[]).length;
  const status=age>=max||failures>=4?"replace":age>=min||failures>=2?"review":used>=75?"watch":"good";
  return {ageDays:age,minDays:min,maxDays:max,usedPercent:Math.round(used),status,failures};
}

export function autoMaintenanceTasks(equipment:Equipment[]):MaintenanceTask[]{
  return equipment.flatMap(raw=>{
    const e=hydrateEquipment(raw),d=equipmentDefaults(e.kind),base=e.lastServiceAt||e.installedAt||nowDate();
    return d.tasks.map(bp=>({
      id:`eqm:${e.id}:${bp.key}`,
      title:bp.ar,
      titleEn:bp.en,
      cadence:bp.cadence,
      done:false,
      nextDue:addDays(base,bp.days),
      lastDone:e.lastServiceAt,
      sourceEquipmentId:e.id,
      sourceEquipmentName:e.name,
      autoGenerated:true,
      intervalDays:bp.days,
      checklist:bp.checklist,
      checklistDone:[]
    }));
  });
}

export function syncEquipmentSystem(tank:Tank):Pick<Tank,"equipment"|"maintenance">{
  const equipment=tank.equipment.map(hydrateEquipment);
  const generated=autoMaintenanceTasks(equipment);
  const existingById=new Map(tank.maintenance.map(x=>[x.id,x]));
  const mergedGenerated=generated.map(g=>{
    const old=existingById.get(g.id);
    return old?{...g,...old,sourceEquipmentId:g.sourceEquipmentId,sourceEquipmentName:g.sourceEquipmentName,autoGenerated:true,intervalDays:g.intervalDays,checklist:g.checklist}:g;
  });
  const manual=tank.maintenance.filter(x=>!x.autoGenerated&&!String(x.id).startsWith("eqm:"));
  return {equipment,maintenance:[...mergedGenerated,...manual]};
}

export function equipmentReliability(tank:Tank){
  const equipment=tank.equipment.map(hydrateEquipment);
  const issues:Array<{id:string;level:"info"|"warn"|"danger";ar:string;en:string;recommendationAr?:string;recommendationEn?:string}>=[];
  const suggestions:typeof issues=[];
  let lifecycleScore=100,redundancyScore=100,consumablesScore=100;

  for(const e of equipment){
    const life=equipmentLife(e);
    if(life.status==="replace"){
      lifecycleScore-=25;issues.push({id:`life-${e.id}`,level:"danger",ar:`${e.name}: وصل/تجاوز نافذة العمر الافتراضي أو عنده أعطال متكررة.`,en:`${e.name}: has reached its expected replacement window or has repeated failures.`,recommendationAr:"خطط للاستبدال ولا تنتظر الفشل الكامل، خصوصاً إذا الجهاز حرج.",recommendationEn:"Plan replacement before total failure, especially for critical equipment."});
    }else if(life.status==="review"){
      lifecycleScore-=12;issues.push({id:`life-${e.id}`,level:"warn",ar:`${e.name}: دخل نافذة مراجعة العمر الافتراضي (${Math.floor(life.ageDays/365)} سنة تقريباً).`,en:`${e.name}: has entered its lifecycle review window (about ${Math.floor(life.ageDays/365)} years old).`,recommendationAr:"راجع الأداء، الأعطال، وتوفر البديل قبل قرار الاستبدال.",recommendationEn:"Review performance, failures and backup availability before replacement."});
    }else if(life.status==="watch"){
      lifecycleScore-=5;suggestions.push({id:`life-${e.id}`,level:"info",ar:`${e.name}: استهلك تقريباً ${life.usedPercent}% من العمر المرجعي المتوسط.`,en:`${e.name}: has used about ${life.usedPercent}% of its midpoint reference life.`,recommendationAr:"راقب الأداء وخطط للميزانية/البديل مبكراً.",recommendationEn:"Monitor performance and plan budget/replacement early."});
    }

    const failures=(e.failures??[]).filter(f=>Date.now()-new Date(f.timestamp).getTime()<180*DAY).length;
    if(failures>=2){lifecycleScore-=10;issues.push({id:`fail-${e.id}`,level:"warn",ar:`${e.name}: سجل ${failures} أعطال خلال آخر 180 يوم.`,en:`${e.name}: logged ${failures} failures in the last 180 days.`,recommendationAr:"قارن كلفة الأعطال والصيانة مع الاستبدال الوقائي.",recommendationEn:"Compare repeated service cost/risk against preventive replacement."});}

    for(const c of e.consumables??[]){
      const age=ageDays(c.installedAt),lifeDays=c.lifeDays||0,stock=c.quantityOnHand??0,min=c.minimumOnHand??0;
      if(lifeDays>0&&age>=lifeDays){consumablesScore-=8;issues.push({id:`cons-life-${e.id}-${c.id}`,level:"warn",ar:`${e.name}: ${c.name} وصل موعد الاستبدال المرجعي.`,en:`${e.name}: ${c.nameEn||c.name} reached its reference replacement age.`,recommendationAr:"بدّل القطعة الاستهلاكية وسجل تاريخ التركيب الجديد.",recommendationEn:"Replace the consumable and record the new installation date."});}
      if(min>0&&stock<min){consumablesScore-=6;suggestions.push({id:`cons-stock-${e.id}-${c.id}`,level:"warn",ar:`${e.name}: مخزون ${c.name} أقل من الحد الأدنى (${stock}/${min}).`,en:`${e.name}: ${c.nameEn||c.name} stock is below minimum (${stock}/${min}).`,recommendationAr:"أضف قطعة احتياطية للمخزون.",recommendationEn:"Restock the spare consumable."});}
    }
  }

  const criticalKinds=new Set<EquipmentKind>();
  if(tank.sump?.enabled){criticalKinds.add("returnPump");criticalKinds.add("overflow");}
  criticalKinds.add("heater");
  if(tank.type==="marine")criticalKinds.add("waveMaker");
  const profile=tank.ecosystemProfile;
  if(profile==="reef"||profile==="planted"){criticalKinds.add("lighting");}

  for(const kind of criticalKinds){
    const list=equipment.filter(x=>x.kind===kind&&x.status!=="off");
    if(!list.length)continue;
    const hasRedundancy=list.length>1||list.some(x=>x.spareAvailable||Boolean(x.backupPlan?.trim()));
    if(!hasRedundancy){
      const severe=kind==="returnPump"||kind==="heater";
      redundancyScore-=severe?18:10;
      issues.push({id:`spof-${kind}`,level:severe?"danger":"warn",ar:`${list[0].name}: نقطة فشل واحدة بدون جهاز احتياطي أو خطة Backup مسجلة.`,en:`${list[0].name}: single point of failure with no spare device or backup plan recorded.`,recommendationAr:"سجل جهاز احتياطي أو خطة تشغيل بديلة واضحة.",recommendationEn:"Register a spare device or a clear operational backup plan."});
    }
  }

  for(const e of equipment.filter(x=>x.postActionCheckAt&&new Date(x.postActionCheckAt).getTime()<=Date.now())){
    suggestions.push({id:`post-${e.id}`,level:"info",ar:`حان فحص ما بعد الإجراء لـ ${e.name}.`,en:`Post-action verification is due for ${e.name}.`,recommendationAr:"أكد التدفق/الحرارة/الصوت/التسريب حسب وظيفة الجهاز ثم امسح موعد المتابعة.",recommendationEn:"Verify flow/temperature/noise/leaks as appropriate, then clear the follow-up."});
  }

  lifecycleScore=Math.max(0,lifecycleScore);redundancyScore=Math.max(0,redundancyScore);consumablesScore=Math.max(0,consumablesScore);
  const score=Math.round(lifecycleScore*.45+redundancyScore*.35+consumablesScore*.20);
  return {score,lifecycleScore,redundancyScore,consumablesScore,issues,suggestions,equipment};
}
