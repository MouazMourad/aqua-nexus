import type { ChemistryReading,MaintenanceTask,Tank } from "./types";

const DAY=86400000;
const HOUR=3600000;
const AMMONIA_CLEAR=0.02;
const NITRITE_CLEAR=0.05;

export type BiologicalCyclePhase="setup"|"ammonia"|"processing"|"confirmation"|"ready";

export interface BiologicalCycleStatus {
  active:boolean;
  day:number;
  phase:BiologicalCyclePhase;
  progress:number;
  ready:boolean;
  startedAt:string;
  sourceAdded:boolean;
  bacteriaSeeded:boolean;
  processingEvidence:boolean;
  latestMeasured?:ChemistryReading;
  previousMeasured?:ChemistryReading;
  latestAmmonia:number|null;
  latestNitrite:number|null;
  latestNitrate:number|null;
  firstClear:boolean;
  twoConsecutiveClear:boolean;
  confirmationGapHours:number|null;
  latestAgeHours:number|null;
  blockersAr:string[];
  blockersEn:string[];
  nextAr:string;
  nextEn:string;
  actionPage:"equipment"|"chemistry"|"maintenance";
}

function finiteValue(reading:ChemistryReading|undefined,key:string){
  const raw=reading?.values?.[key];
  return typeof raw==="number"&&Number.isFinite(raw)?raw:null;
}
function ageHours(ts?:string){
  if(!ts)return null;
  const n=new Date(ts).getTime();
  return Number.isFinite(n)?Math.max(0,(Date.now()-n)/HOUR):null;
}
function measured(tank:Tank){
  return tank.chemistry
    .filter(x=>!x.usingDefaults)
    .filter(x=>Number.isFinite(new Date(x.timestamp).getTime()))
    .slice()
    .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
}
function readingClear(tank:Tank,reading?:ChemistryReading){
  if(!reading)return false;
  const nh3=finiteValue(reading,"NH3");
  if(nh3===null||nh3>AMMONIA_CLEAR)return false;
  if(tank.type==="freshwater"){
    const no2=finiteValue(reading,"NO2");
    if(no2===null||no2>NITRITE_CLEAR)return false;
  }
  return true;
}

export function isBiologicalCycleActive(tank:Tank){
  return !tank.isTraining&&(tank.status==="new"||tank.status==="cycling")&&!tank.biologicalCycle?.completedAt;
}

export function biologicalCycleStatus(tank:Tank):BiologicalCycleStatus{
  const active=isBiologicalCycleActive(tank);
  const startedAt=tank.biologicalCycle?.startedAt||tank.createdAt||new Date().toISOString();
  const startedMs=new Date(startedAt).getTime();
  const day=Number.isFinite(startedMs)?Math.max(1,Math.floor((Date.now()-startedMs)/DAY)+1):1;
  const readings=measured(tank),latest=readings[0],previous=readings[1];
  const latestAmmonia=finiteValue(latest,"NH3");
  const latestNitrite=finiteValue(latest,"NO2");
  const latestNitrate=finiteValue(latest,"NO3");
  const sourceAdded=Boolean(tank.biologicalCycle?.sourceAddedAt);
  const bacteriaSeeded=Boolean(tank.biologicalCycle?.bacteriaSeededAt);
  const processingEvidence=readings.some(r=>{
    const nh3=finiteValue(r,"NH3"),no2=finiteValue(r,"NO2"),no3=finiteValue(r,"NO3");
    return (nh3!==null&&nh3>AMMONIA_CLEAR)||(tank.type==="freshwater"&&no2!==null&&no2>NITRITE_CLEAR)||(no3!==null&&no3>0.5);
  });
  const firstClear=readingClear(tank,latest);
  const gap=latest&&previous?Math.abs(new Date(latest.timestamp).getTime()-new Date(previous.timestamp).getTime())/HOUR:null;
  const twoConsecutiveClear=Boolean(latest&&previous&&readingClear(tank,latest)&&readingClear(tank,previous)&&gap!==null&&gap>=12);
  const latestAgeHours=ageHours(latest?.timestamp);
  const recent=latestAgeHours!==null&&latestAgeHours<=48;
  const ready=active&&sourceAdded&&processingEvidence&&twoConsecutiveClear&&recent;

  const blockersAr:string[]=[],blockersEn:string[]=[];
  if(!sourceAdded){blockersAr.push("لم يتم تسجيل إضافة مصدر أمونيا/بدء دورة Fishless بعد.");blockersEn.push("No ammonia source / fishless-cycle start has been recorded yet.");}
  if(!processingEvidence){blockersAr.push("لا يوجد بعد دليل مقاس أن دورة النيتروجين بدأت بالمعالجة.");blockersEn.push("There is not yet measured evidence that the nitrogen cycle is processing waste.");}
  if(!firstClear){blockersAr.push(tank.type==="freshwater"?"آخر قراءة يجب أن تظهر NH3/NH4 وNO2 عند الصفر العملي.":"آخر قراءة يجب أن تظهر NH3 عند الصفر العملي.");blockersEn.push(tank.type==="freshwater"?"The latest reading must show practical-zero NH3/NH4 and NO2.":"The latest reading must show practical-zero NH3.");}
  if(firstClear&&!twoConsecutiveClear){blockersAr.push("نحتاج قراءة تأكيد ثانية نظيفة بعد 12 ساعة على الأقل.");blockersEn.push("A second clear confirmation reading at least 12 hours later is required.");}
  if(latest&&!recent){blockersAr.push("آخر فحص أقدم من 48 ساعة ويجب تحديثه.");blockersEn.push("The latest measured test is older than 48 hours and must be refreshed.");}

  let phase:BiologicalCyclePhase="setup",nextAr="",nextEn="",actionPage:BiologicalCycleStatus["actionPage"]="maintenance";
  if(!sourceAdded){
    phase="ammonia";nextAr="سجّل إضافة مصدر الأمونيا لبدء الدورة بدون أسماك.";nextEn="Record the ammonia source to start the fishless cycle.";actionPage="maintenance";
  }else if(!readings.length){
    phase="processing";nextAr="سجّل أول فحص مقاس لـ NH3/NH4 وNO2/NO3 حسب نوع الحوض.";nextEn="Log the first measured NH3/NH4 and NO2/NO3 test for this tank.";actionPage="chemistry";
  }else if(!processingEvidence){
    phase="processing";nextAr="استمر بالمراقبة والفحص؛ نحتاج دليل أن الأمونيا/النتريت ظهرت أو أن النترات بدأت تتكوّن.";nextEn="Keep testing; we need evidence that ammonia/nitrite appeared or nitrate production has begun.";actionPage="chemistry";
  }else if(!firstClear){
    phase="processing";nextAr=tank.type==="freshwater"?"أعد فحص NH3/NH4 وNO2 حتى يصلا للصفر العملي.":"أعد فحص NH3 حتى يصل للصفر العملي.";nextEn=tank.type==="freshwater"?"Retest NH3/NH4 and NO2 until both reach practical zero.":"Retest NH3 until it reaches practical zero.";actionPage="chemistry";
  }else if(!twoConsecutiveClear){
    phase="confirmation";nextAr="القراءة الأولى نظيفة. انتظر 12 ساعة على الأقل ثم أعد الفحص للتأكيد.";nextEn="The first clear reading is in. Wait at least 12 hours, then retest for confirmation.";actionPage="chemistry";
  }else if(!recent){
    phase="confirmation";nextAr="أعد فحص التأكيد لأن آخر قراءة أصبحت قديمة.";nextEn="Repeat the confirmation test because the latest reading is stale.";actionPage="chemistry";
  }else{
    phase="ready";nextAr="شروط الدورة تحققت. راجع القراءات ثم أنهِ Cycling Mode لفتح بقية البرنامج.";nextEn="Cycle criteria are satisfied. Review the readings, then complete Cycling Mode to unlock the rest of Aqua Nexus.";actionPage="maintenance";
  }

  const checks=[true,sourceAdded,processingEvidence,firstClear,twoConsecutiveClear&&recent];
  const progress=Math.round(checks.filter(Boolean).length/checks.length*100);
  return{active,day,phase,progress,ready,startedAt,sourceAdded,bacteriaSeeded,processingEvidence,latestMeasured:latest,previousMeasured:previous,latestAmmonia,latestNitrite,latestNitrate,firstClear,twoConsecutiveClear,confirmationGapHours:gap===null?null:Math.round(gap*10)/10,latestAgeHours:latestAgeHours===null?null:Math.round(latestAgeHours*10)/10,blockersAr,blockersEn,nextAr,nextEn,actionPage};
}

const ALLOWED_DURING_CYCLE=new Set([
  "dashboard","tanks","equipment","lighting","sump","chemistry","maintenance","inventory","library",
  "timeline","journal","waterchange","rodi","alerts","settings","emergency"
]);

export function isCyclePageAllowed(page:string){
  return ALLOWED_DURING_CYCLE.has(page);
}

export function cycleRelevantMaintenanceTask(task:MaintenanceTask){
  if(task.sourceId?.startsWith("cycle:"))return true;
  const text=`${task.title} ${task.titleEn||""}`.toLowerCase();
  return /cycle|cycling|nitrogen|ammonia|nitrite|nitrate|دورة|أمونيا|امونيا|نتريت|نترات|كيميائ/.test(text);
}

export function biologicalCycleAlert(tank:Tank){
  const state=biologicalCycleStatus(tank);
  if(!state.active)return null;
  return {
    level:state.ready?"info" as const:"warn" as const,
    page:state.actionPage,
    ar:`الدورة البيولوجية — اليوم ${state.day}: ${state.nextAr}`,
    en:`Biological cycle — day ${state.day}: ${state.nextEn}`
  };
}
