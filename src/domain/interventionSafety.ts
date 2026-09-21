import type { IntelligenceEvent,Tank } from "./types";
import { activeRelocation,isTankArchived } from "./tankLifecycle";

export type InterventionKind=
  |"correctiveDosing"|"waterChange"|"medication"|"filterMedia"
  |"livestockAddition"|"equipmentChange"|"plantFertilizer";

export interface InterventionEvidence{
  id:string;kind:InterventionKind;timestamp:string;ar:string;en:string;domain:string;verb:string;
}
export interface InterventionGate{
  level:"good"|"warn"|"danger";
  blocked:boolean;
  recent:InterventionEvidence[];
  distinctKinds:number;
  ar:string;
  en:string;
}

const HOUR=3600000;
function classify(e:IntelligenceEvent):InterventionKind|null{
  if(e.domain==="dosing"&&e.verb==="dose_given")return"correctiveDosing";
  if(e.domain==="waterChange"&&e.verb==="water_changed")return"waterChange";
  if(e.domain==="quarantine"&&e.verb==="dose_given")return"medication";
  if(e.domain==="sump"&&(e.verb==="media_installed"||e.verb==="media_replaced"))return"filterMedia";
  if(e.domain==="livestock"&&e.verb==="added")return"livestockAddition";
  if(e.domain==="equipment"&&(e.verb==="installed"||e.verb==="removed"))return"equipmentChange";
  if(e.domain==="plantCare"&&e.verb==="fertilized")return"plantFertilizer";
  return null;
}
function label(kind:InterventionKind,lang:"ar"|"en"){
  const ar:Record<InterventionKind,string>={
    correctiveDosing:"جرعة تصحيحية",waterChange:"تغيير ماء",medication:"جرعة علاج",
    filterMedia:"تغيير ميديا فلترة",livestockAddition:"إضافة كائنات",equipmentChange:"تغيير تجهيزات",plantFertilizer:"تسميد نباتات"
  };
  const en:Record<InterventionKind,string>={
    correctiveDosing:"corrective dose",waterChange:"water change",medication:"treatment dose",
    filterMedia:"filter-media change",livestockAddition:"livestock addition",equipmentChange:"equipment change",plantFertilizer:"plant fertilization"
  };
  return lang==="ar"?ar[kind]:en[kind];
}

export function recentMajorInterventions(tank:Tank,hours=12){
  const since=Date.now()-Math.max(1,hours)*HOUR;
  return (tank.intelligenceEvents??[])
    .map(e=>({event:e,kind:classify(e)}))
    .filter((x):x is {event:IntelligenceEvent;kind:InterventionKind}=>Boolean(x.kind)&&Number.isFinite(new Date(x.event.timestamp).getTime())&&new Date(x.event.timestamp).getTime()>=since)
    .map(({event,kind})=>({
      id:event.id,kind,timestamp:event.timestamp,ar:event.textAr,en:event.textEn,domain:event.domain,verb:event.verb
    }))
    .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
}

export function interventionGate(tank:Tank,next:InterventionKind,hours=12):InterventionGate{
  const recent=recentMajorInterventions(tank,hours).filter(x=>x.kind!==next || next==="waterChange" || next==="correctiveDosing");
  if(isTankArchived(tank))return{
    level:"danger",blocked:true,recent,distinctKinds:new Set(recent.map(x=>x.kind)).size,
    ar:"الحوض مؤرشف والعمليات التشغيلية مقفلة. أعد الحوض من الأرشيف قبل تسجيل تدخل جديد.",
    en:"This tank is archived and operational workflows are locked. Restore it before logging a new intervention."
  };
  const relocation=activeRelocation(tank);
  if(relocation)return{
    level:"danger",blocked:next==="livestockAddition",recent,distinctKinds:new Set(recent.map(x=>x.kind)).size,
    ar:"نقل الحوض قيد التنفيذ. لا تضف كائنات جديدة، وتجنب أي تدخل كبير غير ضروري حتى يستقر النظام بعد النقل.",
    en:"Tank relocation is in progress. Do not add new livestock and avoid unnecessary major interventions until the system stabilizes after the move."
  };
  const distinct=new Set(recent.map(x=>x.kind));
  const emergency=(tank.emergencySessions??[]).some(x=>x.status==="active");
  if(emergency){
    return{
      level:recent.length?"warn":"good",blocked:false,recent,distinctKinds:distinct.size,
      ar:recent.length?"يوجد بروتوكول طوارئ نشط ومعه "+recent.length+" تدخل حديث. نفّذ فقط خطوات الطوارئ الموثقة وسجّل كل تغيير حتى يبقى السبب والنتيجة قابلين للتتبع.":"بروتوكول الطوارئ نشط؛ نفّذ خطواته الموثقة وسجّل كل تغيير.",
      en:recent.length?"An emergency protocol is active with "+recent.length+" recent intervention(s). Follow only the documented emergency steps and log each change so cause/effect remains traceable.":"An emergency protocol is active. Follow its documented steps and log each change."
    };
  }

  const nextLabelAr=label(next,"ar"),nextLabelEn=label(next,"en");
  if(recent.length===0)return{
    level:"good",blocked:false,recent,distinctKinds:0,
    ar:"ما في تدخل كبير حديث يتعارض مع "+nextLabelAr+".",
    en:"No recent major intervention conflicts with this "+nextLabelEn+"."
  };

  const namesAr=[...new Set(recent.map(x=>label(x.kind,"ar")))].join("، ");
  const namesEn=[...new Set(recent.map(x=>label(x.kind,"en")))].join(", ");
  const highDensity=distinct.size>=2||recent.length>=3;
  if(highDensity)return{
    level:"danger",blocked:false,recent,distinctKinds:distinct.size,
    ar:"خلال آخر "+hours+" ساعة صار أكثر من تدخل كبير ("+namesAr+"). إضافة "+nextLabelAr+" الآن قد تجعل أي تحسن/تدهور غير قابل للتفسير وتزيد خطر التغيير السريع. الأفضل تثبيت الحوض وإعادة القياس قبل تدخل جديد، إلا إذا في ضرورة واضحة.",
    en:"Multiple major interventions occurred in the last "+hours+" hours ("+namesEn+"). Adding a "+nextLabelEn+" now can make outcomes hard to interpret and increase rapid-change risk. Prefer stabilization and retesting before another intervention unless there is a clear necessity."
  };
  return{
    level:"warn",blocked:false,recent,distinctKinds:distinct.size,
    ar:"في تدخل كبير حديث خلال آخر "+hours+" ساعة ("+namesAr+"). قبل "+nextLabelAr+" تأكد أنك بحاجة للتغيير الآن، وسجّل السبب حتى يقدر Aqua Nexus يقيّم النتيجة بشكل صحيح.",
    en:"There is a recent major intervention within the last "+hours+" hours ("+namesEn+"). Before another "+nextLabelEn+", confirm it is needed now and record the reason so Aqua Nexus can evaluate the outcome correctly."
  };
}

export function interventionDensityAlert(tank:Tank,hours=12){
  const recent=recentMajorInterventions(tank,hours);
  const distinctKinds=new Set(recent.map(x=>x.kind)).size;
  if(recent.length<2||distinctKinds<2)return null;
  const danger=distinctKinds>=3||recent.length>=4;
  return{
    level:danger?"danger" as const:"warn" as const,
    recent,distinctKinds,
    ar:danger
      ?"تم تسجيل "+recent.length+" تدخلات كبيرة من "+distinctKinds+" أنواع خلال "+hours+" ساعة. ثبّت الحوض وأعد القياس قبل إضافة تغييرات جديدة ما لم تكن طارئة."
      :"تم تسجيل أكثر من نوع تدخل كبير خلال "+hours+" ساعة. حاول تغيير عامل واحد في كل مرة ومراقبة النتيجة قبل تدخل جديد.",
    en:danger
      ?recent.length+" major interventions across "+distinctKinds+" categories were logged within "+hours+" hours. Stabilize and retest before adding more changes unless urgent."
      :"More than one major intervention category was logged within "+hours+" hours. Prefer changing one major factor at a time and observing the result."
  };
}
