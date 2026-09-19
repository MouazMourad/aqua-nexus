import type { HealthSnapshot, Tank, TimelineEvent } from "./types";
import { bioload, chemistryAgeDays, chemistryHealthAssessment, chemistryHistoryScore, maintenanceHealth } from "./health";
import { systemHealth } from "./systemHealth";
import { chemistryGuidance } from "./chemistryGuidance";

export type TankStateBand = "excellent" | "stable" | "watch" | "stressed" | "critical";

export interface StateDriver {
  level: "good" | "info" | "warn" | "danger";
  ar: string;
  en: string;
}

export interface TankStateView {
  score: number;
  band: TankStateBand;
  ar: string;
  en: string;
  drivers: StateDriver[];
}

export interface HealthTimelinePoint {
  id: string;
  timestamp: string;
  score: number;
  chemistry: number;
  maintenance: number;
  source: "snapshot" | "estimated";
  reasonAr: string;
  reasonEn: string;
  delta: number;
  event?: TimelineEvent;
  recoveryEvent?: TimelineEvent;
}

export interface TankForecast {
  current: number;
  projected7d: number | null;
  direction: "improving" | "stable" | "declining";
  confidence: "low" | "medium" | "high";
  ar: string;
  en: string;
}

const DAY = 86400000;
const clamp = (n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));

export function stateBand(score:number):TankStateBand {
  if(score>=90)return "excellent";
  if(score>=80)return "stable";
  if(score>=65)return "watch";
  if(score>=50)return "stressed";
  return "critical";
}

function bandText(band:TankStateBand){
  switch(band){
    case "excellent": return {ar:"ممتاز ومريح",en:"Excellent & comfortable"};
    case "stable": return {ar:"مستقر",en:"Stable"};
    case "watch": return {ar:"بحاجة مراقبة",en:"Needs attention"};
    case "stressed": return {ar:"متوتر",en:"Stressed"};
    default: return {ar:"حرج ويحتاج تدخلاً",en:"Critical — intervention needed"};
  }
}

function contextPenalty(tank:Tank){
  let penalty=0;
  const bio=bioload(tank);
  if(bio.status==="high")penalty-=4;
  if(bio.status==="danger")penalty-=10;

  const equipmentRisk=tank.equipment.filter(x=>x.status==="warning"||x.status==="service").length;
  penalty-=Math.min(10,equipmentRisk*3);

  const watch=tank.livestock.filter(x=>x.health==="watch").length;
  const treatment=tank.livestock.filter(x=>x.health==="treatment").length;
  penalty-=Math.min(12,watch*2+treatment*5);

  const activeQuarantine=tank.quarantine.filter(x=>x.status==="active").length;
  penalty-=Math.min(6,activeQuarantine*2);
  return penalty;
}

export function tankStateScore(tank:Tank){
  return systemHealth(tank).score;
}

export function tankStateView(tank:Tank):TankStateView {
  const score=tankStateScore(tank);
  const band=stateBand(score);
  const text=bandText(band);
  const drivers:StateDriver[]=[];
  const chemAssessment=chemistryHealthAssessment(tank),chem=chemAssessment.score,maint=maintenanceHealth(tank),age=chemistryAgeDays(tank),bio=bioload(tank);
  const system=systemHealth(tank);
  const chemGuide=chemistryGuidance(tank);
  const overdue=tank.maintenance.filter(x=>!x.done&&x.nextDue&&x.nextDue<new Date().toISOString().slice(0,10));
  const equipment=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
  const livestock=tank.livestock.filter(x=>x.health==="watch"||x.health==="treatment");

  if(chemGuide.dataIssues.length){
    const issue=chemGuide.dataIssues[0];
    drivers.push({level:"danger",ar:`مشكلة بيانات كيميائية: ${issue.reasonAr}`,en:`Chemistry data issue: ${issue.reasonEn}`});
  }

  if(chem===null)drivers.push({level:"warn",ar:"لا توجد بيانات كيميائية مقاسة كافية لتقييم الحالة.",en:"There is not enough measured chemistry data to assess the state."});
  else if(chem<60)drivers.push({level:"danger",ar:`الكيمياء هي العامل الأضعف حالياً (${chem}%).`,en:`Chemistry is currently the weakest driver (${chem}%).`});
  else if(chem<80)drivers.push({level:"warn",ar:`الكيمياء تحتاج متابعة (${chem}%).`,en:`Chemistry needs attention (${chem}%).`});
  else drivers.push({level:"good",ar:`الكيمياء ضمن حالة جيدة (${chem}%).`,en:`Chemistry is in good condition (${chem}%).`});

  chemGuide.problems
    .filter(item=>!item.suspectedFormat)
    .slice(0,2)
    .forEach(item=>drivers.push({
      level:item.level==="danger"?"danger":"warn",
      ar:`${item.reasonAr} الإجراء المقترح: ${item.actionAr}`,
      en:`${item.reasonEn} Suggested action: ${item.actionEn}`
    }));

  if(maint<70||overdue.length)drivers.push({level:maint<50?"danger":"warn",ar:`الصيانة ${maint}%${overdue.length?` • ${overdue.length} مهمة متأخرة`:""}.`,en:`Maintenance is ${maint}%${overdue.length?` • ${overdue.length} overdue task(s)`:""}.`});
  if(age>7)drivers.push({level:"warn",ar:`آخر فحص كيميائي منذ ${Math.floor(age)} يوم.`,en:`The last chemistry test was ${Math.floor(age)} days ago.`});
  if(bio.status==="high"||bio.status==="danger")drivers.push({level:bio.status==="danger"?"danger":"warn",ar:`الحمل البيولوجي ${Math.round(bio.ratio*100)}% ويؤثر على هامش استقرار الحوض.`,en:`Bioload is ${Math.round(bio.ratio*100)}% and is reducing the tank's stability margin.`});
  if(equipment.length)drivers.push({level:"warn",ar:`هناك ${equipment.length} جهاز يحتاج انتباهاً أو صيانة.`,en:`${equipment.length} equipment item(s) need attention or service.`});
  if(system.equipmentAudit.issues.length){
    const first=system.equipmentAudit.issues[0];
    drivers.push({level:first.level==="danger"?"danger":"warn",ar:`كفاية التجهيزات ${system.equipment}%: ${first.ar}`,en:`Equipment adequacy ${system.equipment}%: ${first.en}`});
  } else if(system.equipment<90){
    drivers.push({level:"info",ar:`كفاية التجهيزات ${system.equipment}% وتحتاج استكمال بعض بيانات السعة/التدفق.`,en:`Equipment adequacy is ${system.equipment}%; some capacity/flow data still needs to be completed.`});
  }
  if(system.compatibilityAudit.issues.length){
    const first=system.compatibilityAudit.issues[0];
    drivers.push({level:first.level==="danger"?"danger":"warn",ar:`توافق الكائنات ${system.compatibility}%: ${first.ar}`,en:`Livestock compatibility ${system.compatibility}%: ${first.en}`});
  }
  if(livestock.length)drivers.push({level:"warn",ar:`هناك ${livestock.length} كائن بحالة مراقبة أو علاج.`,en:`${livestock.length} livestock item(s) are under watch or treatment.`});
  if(tank.quarantine.some(x=>x.status==="active"))drivers.push({level:"info",ar:"يوجد حجر/علاج نشط يجب أخذه بالحسبان عند تقييم الحالة.",en:"An active quarantine/treatment case is part of the current tank context."});
  if((tank.acclimationSessions??[]).some(x=>x.status!=="completed"))drivers.push({level:"info",ar:"هناك جلسة أقلمة نشطة حالياً.",en:"An acclimation session is currently active."});

  return {score,band,ar:text.ar,en:text.en,drivers:drivers.slice(0,8)};
}

function nearestEvent(tank:Tank,timestamp:string,maxHours=48){
  const target=new Date(timestamp).getTime();
  if(!Number.isFinite(target))return undefined;
  let best:TimelineEvent|undefined;
  let bestDistance=Infinity;
  for(const event of tank.timeline){
    const d=Math.abs(new Date(event.timestamp).getTime()-target);
    if(Number.isFinite(d)&&d<bestDistance&&d<=maxHours*3600000){best=event;bestDistance=d;}
  }
  return best;
}

function estimatedPoints(tank:Tank):HealthTimelinePoint[]{
  // Historical estimates must not be recomputed from today's equipment,
  // livestock or maintenance state. A chemistry-only estimate is explicitly
  // marked estimated; real HealthSnapshots remain the authoritative history.
  return tank.chemistry.filter(reading=>!reading.usingDefaults).map((reading,index)=>{
    const originalIndex=tank.chemistry.indexOf(reading);
    const chem=chemistryHistoryScore(tank,originalIndex)??0;
    const event=nearestEvent(tank,reading.timestamp);
    return {
      id:`chem-${index}-${reading.timestamp}`,
      timestamp:reading.timestamp,
      score:chem,
      chemistry:chem,
      maintenance:0,
      source:"estimated" as const,
      reasonAr:event?.textAr||"تقدير تاريخي من قراءة كيمياء مقاسة",
      reasonEn:event?.textEn||"Historical estimate from a measured chemistry reading",
      delta:0,
      event
    };
  });
}

function snapshotPoints(tank:Tank):HealthTimelinePoint[]{
  return (tank.healthSnapshots??[]).map((s:HealthSnapshot)=>({
    id:s.id,timestamp:s.timestamp,score:s.score,chemistry:s.chemistry,maintenance:s.maintenance,
    source:"snapshot" as const,reasonAr:s.reasonAr,reasonEn:s.reasonEn,delta:0,
    event:s.relatedEventId?tank.timeline.find(e=>e.id===s.relatedEventId):nearestEvent(tank,s.timestamp,24)
  }));
}

export function healthTimeline(tank:Tank):HealthTimelinePoint[]{
  const real=snapshotPoints(tank);
  const estimated=estimatedPoints(tank);
  const merged=[...estimated,...real]
    .filter(x=>Number.isFinite(new Date(x.timestamp).getTime()))
    .sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());

  const deduped:HealthTimelinePoint[]=[];
  for(const point of merged){
    const last=deduped[deduped.length-1];
    if(last&&Math.abs(new Date(point.timestamp).getTime()-new Date(last.timestamp).getTime())<60000){
      if(point.source==="snapshot")deduped[deduped.length-1]=point;
      continue;
    }
    deduped.push(point);
  }

  const limited=deduped.slice(-60);
  limited.forEach((point,index)=>{
    point.delta=index?point.score-limited[index-1].score:0;
    if(Math.abs(point.delta)>=5&&!point.event)point.event=nearestEvent(tank,point.timestamp,72);
  });

  for(let i=0;i<limited.length;i++){
    if(limited[i].delta>=-4)continue;
    for(let j=i+1;j<limited.length;j++){
      if(limited[j].score>=limited[i].score+5){
        limited[i].recoveryEvent=limited[j].event;
        break;
      }
    }
  }
  return limited;
}

export function tankForecast(tank:Tank):TankForecast {
  const points=healthTimeline(tank);
  const current=tankStateScore(tank);
  const real=points.filter(x=>x.source==="snapshot");
  const evidence=real.length>=2?real:points;
  let dailySlope=0,spanDays=0;
  if(evidence.length>=2){
    const sample=evidence.slice(-6),first=sample[0],last=sample[sample.length-1];
    spanDays=Math.max(0,(new Date(last.timestamp).getTime()-new Date(first.timestamp).getTime())/DAY);
    if(spanDays>0)dailySlope=(last.score-first.score)/spanDays;
  }
  const sufficient=evidence.length>=3&&spanDays>=2;
  if(!sufficient){
    return {current,projected7d:null,direction:"stable",confidence:"low",
      ar:"لا يوجد تاريخ كافٍ لإعطاء توقع رقمي موثوق لـ7 أيام.",
      en:"There is not enough history for a reliable numeric 7-day forecast."};
  }
  dailySlope=Math.max(-2,Math.min(2,dailySlope));
  const projected=clamp(Math.round(current+dailySlope*7));
  const direction=projected>=current+4?"improving":projected<=current-4?"declining":"stable";
  const realSpan=real.length>=2?(new Date(real.at(-1)!.timestamp).getTime()-new Date(real[0].timestamp).getTime())/DAY:0;
  const confidence:TankForecast["confidence"]=real.length>=5&&realSpan>=7?"high":real.length>=3?"medium":"low";
  const view=tankStateView(tank),main=view.drivers.find(x=>x.level==="danger"||x.level==="warn");
  const ar=direction==="declining"
    ? `إذا استمر النمط الحالي، قد تنتقل حالة الحوض من ${current}% إلى نحو ${projected}% خلال 7 أيام.${main?` العامل الأهم: ${main.ar}`:""}`
    : direction==="improving"
      ? `المسار الحالي إيجابي؛ التقدير بعد 7 أيام نحو ${projected}% مقابل ${current}% الآن.`
      : `المسار الحالي مستقر ضمن البيانات المتاحة؛ التقدير بعد 7 أيام نحو ${projected}% مقابل ${current}% الآن.`;
  const en=direction==="declining"
    ? `If the current pattern continues, tank state may move from ${current}% to about ${projected}% within 7 days.${main?` Main driver: ${main.en}`:""}`
    : direction==="improving"
      ? `The current path is positive; the 7-day estimate is about ${projected}% versus ${current}% now.`
      : `The current path is stable within the available evidence; the 7-day estimate is about ${projected}% versus ${current}% now.`;
  return {current,projected7d:projected,direction,confidence,ar,en};
}

export function eventCorrelations(tank:Tank){
  return healthTimeline(tank)
    .filter(x=>Math.abs(x.delta)>=5)
    .slice(-5)
    .reverse();
}

export function tankContextStats(tank:Tank){
  const now=Date.now();
  const within=(timestamp:string,days:number)=>now-new Date(timestamp).getTime()<=days*DAY;
  const monthKey=new Date().toISOString().slice(0,7);
  return {
    feedings7d:tank.feeding.filter(x=>within(x.timestamp,7)).length,
    dosing7d:tank.dosing.filter(x=>within(x.timestamp,7)).length,
    waterChanges30d:tank.waterChanges.filter(x=>within(x.timestamp,30)).length,
    activeQuarantine:tank.quarantine.filter(x=>x.status==="active").length,
    monthlySpend:tank.expenses.filter(x=>x.date.startsWith(monthKey)).reduce((sum,x)=>sum+x.amount,0),
    currency:tank.expenses.find(x=>x.date.startsWith(monthKey))?.currency||tank.expenses[0]?.currency||""
  };
}
