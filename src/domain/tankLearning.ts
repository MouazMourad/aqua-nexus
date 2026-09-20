import type { Tank, TimelineEvent } from "./types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { healthTimeline, tankForecast, tankStateView } from "./tankIntelligence";

const DAY=86400000;

type Parameter="KH"|"Ca"|"Mg"|"NO3"|"PO4";

export interface ProactivePrediction {
  id:string;
  parameter:Parameter;
  days:number;
  ratePerDay:number;
  current:number;
  threshold:number;
  confidence:"low"|"medium"|"high";
  level:"info"|"warn"|"danger";
  ar:string;
  en:string;
}

export interface EventImpact {
  id:string;
  event:TimelineEvent;
  scoreDelta?:number;
  chemistryChanges:{parameter:string;before:number;after:number;delta:number}[];
  level:"good"|"info"|"warn"|"danger";
  ar:string;
  en:string;
}

export interface TankMood {
  key:"calm"|"balanced"|"watchful"|"stressed"|"critical"|"recovering";
  symbol:string;
  ar:string;
  en:string;
  noteAr:string;
  noteEn:string;
}

function ts(x:string){return new Date(x).getTime();}
function finite(v:any):v is number{return typeof v==="number"&&Number.isFinite(v);}

function sortedReadings(tank:Tank){
  return [...tank.chemistry].filter(x=>Number.isFinite(ts(x.timestamp))).sort((a,b)=>ts(a.timestamp)-ts(b.timestamp));
}

function idealLower(tank:Tank,param:Parameter){
  const meta=(CHEMISTRY_CATALOG as any)[tank.type]?.[param];
  return meta?.ideal?Number(meta.ideal[0]):undefined;
}

function disturbedBetween(tank:Tank,param:Parameter,start:number,end:number){
  const water=tank.waterChanges.some(x=>{const t=ts(x.timestamp);return t>start&&t<end;});
  const dose=tank.dosing.some((x:any)=>{const t=ts(x.timestamp);return t>start&&t<end&&String(x.parameter||"").toLowerCase()===param.toLowerCase();});
  return water||dose;
}

function parameterDepletion(tank:Tank,param:Parameter){
  const all=sortedReadings(tank).filter(r=>finite(r.values[param]));
  const points=all.slice(-8);
  if(points.length<2)return null;
  const rates:number[]=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const ta=ts(a.timestamp),tb=ts(b.timestamp),days=(tb-ta)/DAY;
    if(days<.25||days>21||disturbedBetween(tank,param,ta,tb))continue;
    const before=Number(a.values[param]),after=Number(b.values[param]);
    const decline=(before-after)/days;
    if(decline>0)rates.push(decline);
  }
  if(!rates.length)return null;
  rates.sort((a,b)=>a-b);
  const rate=rates.length%2?rates[(rates.length-1)/2]:(rates[rates.length/2-1]+rates[rates.length/2])/2;
  const current=Number(points[points.length-1].values[param]);
  const threshold=idealLower(tank,param);
  if(!finite(threshold)||current<=threshold||rate<=0)return null;
  const days=(current-threshold)/rate;
  if(!Number.isFinite(days)||days<.5||days>60)return null;
  return {rate,current,threshold,days,samples:rates.length};
}

export function proactivePredictions(tank:Tank):ProactivePrediction[]{
  const params:Parameter[]=tank.type==="marine"?["KH","Ca","Mg","NO3","PO4"]:["KH","NO3"];
  const out:ProactivePrediction[]=[];
  for(const param of params){
    const p=parameterDepletion(tank,param);
    if(!p)continue;
    const days=Math.max(1,Math.round(p.days));
    const confidence=p.samples>=3?"high":p.samples>=2?"medium":"low";
    const level=days<=2?"danger":days<=5?"warn":"info";
    const unit=param==="KH"?"dKH/day":"ppm/day";
    const correction=["KH","Ca","Mg"].includes(param);
    out.push({
      id:`pred-${param}`,
      parameter:param,
      days,
      ratePerDay:p.rate,
      current:p.current,
      threshold:p.threshold,
      confidence,
      level,
      ar:correction
        ? `بمعدل الانخفاض الصافي الحالي لـ ${param} (${p.rate.toFixed(param==="KH"?2:1)} ${unit}) قد يصل للحد الأدنى المثالي خلال نحو ${days} يوم. خطط لإعادة القياس والتصحيح قبلها.`
        : `${param} ينخفض بمعدل صافي يقارب ${p.rate.toFixed(2)} ${unit} وقد يقترب من الحد الأدنى المثالي خلال نحو ${days} يوم.`,
      en:correction
        ? `At the current net ${param} decline (${p.rate.toFixed(param==="KH"?2:1)} ${unit}), it may reach the lower ideal boundary in about ${days} day(s). Plan a retest/correction before then.`
        : `${param} is declining at about ${p.rate.toFixed(2)} ${unit} and may approach the lower ideal boundary in about ${days} day(s).`
    });
  }
  return out.sort((a,b)=>a.days-b.days).slice(0,5);
}

function nearestBefore(readings:ReturnType<typeof sortedReadings>,time:number,maxDays=7){
  return [...readings].reverse().find(r=>ts(r.timestamp)<=time&&time-ts(r.timestamp)<=maxDays*DAY);
}
function nearestAfter(readings:ReturnType<typeof sortedReadings>,time:number,maxDays=7){
  return readings.find(r=>ts(r.timestamp)>=time&&ts(r.timestamp)-time<=maxDays*DAY);
}

function significant(parameter:string,before:number,after:number){
  const delta=Math.abs(after-before);
  const fixed:Record<string,number>={KH:.4,Ca:20,Mg:50,NO3:3,PO4:.03,pH:.15,salinity:.002,temperature:1};
  return delta>=(fixed[parameter]??Math.max(.1,Math.abs(before)*.15));
}

export function eventChemistryLinks(tank:Tank,maxLinks=6,eventWindow=250):EventImpact[]{
  const readings=sortedReadings(tank);
  if(readings.length<2)return [];
  const events=[...tank.timeline].sort((a,b)=>ts(b.timestamp)-ts(a.timestamp)).slice(0,Math.max(1,eventWindow));
  const out:EventImpact[]=[];
  for(const event of events){
    const t=ts(event.timestamp); if(!Number.isFinite(t))continue;
    const before=nearestBefore(readings,t),after=nearestAfter(readings,t);
    if(!before||!after||before.timestamp===after.timestamp)continue;
    const keys=["KH","Ca","Mg","NO3","PO4","pH","salinity","temperature"];
    const changes=keys.flatMap(parameter=>{
      const a=before.values[parameter],b=after.values[parameter];
      if(!finite(a)||!finite(b)||!significant(parameter,a,b))return [];
      return [{parameter,before:a,after:b,delta:b-a}];
    });
    if(!changes.length)continue;
    const nitrate=changes.find(x=>x.parameter==="NO3");
    const phosphate=changes.find(x=>x.parameter==="PO4");
    let ar=`بعد حدث «${event.textAr}» ظهرت تغيّرات ملحوظة: ${changes.slice(0,3).map(x=>`${x.parameter} ${x.delta>0?"↑":"↓"} ${Math.abs(x.delta).toFixed(x.parameter==="PO4"?2:1)}`).join(" • ")}.`;
    let en=`After “${event.textEn}”, notable changes appeared: ${changes.slice(0,3).map(x=>`${x.parameter} ${x.delta>0?"↑":"↓"} ${Math.abs(x.delta).toFixed(x.parameter==="PO4"?2:1)}`).join(" • ")}.`;
    let level:EventImpact["level"]="info";
    if(/waterchange|تغيير ماء/i.test(`${event.type} ${event.textAr} ${event.textEn}`)&&nitrate&&nitrate.delta>0){
      ar+=` ارتفاع النترات بعد تغيير الماء لا يثبت السبب، لكنه يستحق التحقق من TDS لمياه RO/DI وماء الخلط والملح المستخدم.`;
      en+=` A nitrate rise after a water change does not prove causation, but it is worth checking RO/DI TDS, source water and the salt mix.`;
      level="warn";
    }
    if(phosphate&&phosphate.after<=.01&&phosphate.delta<0){
      ar+=` الفوسفات اقترب من الصفر؛ تجنب خفضه أكثر بسرعة.`;
      en+=` Phosphate approached zero; avoid pushing it lower too quickly.`;
      level="warn";
    }
    out.push({id:`impact-${event.id}`,event,chemistryChanges:changes,level,ar,en});
  }
  return out.slice(0,Math.max(1,maxLinks));
}

export function biologicalMemory(tank:Tank):EventImpact[]{
  const points=healthTimeline(tank);
  const chemistryLinks=eventChemistryLinks(tank,200,250);
  const byEvent=new Map(chemistryLinks.map(x=>[x.event.id,x]));
  const events=[...tank.timeline].sort((a,b)=>ts(b.timestamp)-ts(a.timestamp)).slice(0,250);
  const out:EventImpact[]=[];
  for(const event of events){
    const t=ts(event.timestamp); if(!Number.isFinite(t))continue;
    const before=[...points].reverse().find(p=>ts(p.timestamp)<=t&&t-ts(p.timestamp)<=4*DAY);
    const after=points.find(p=>ts(p.timestamp)>=t&&ts(p.timestamp)-t<=7*DAY);
    const linked=byEvent.get(event.id);
    const scoreDelta=before&&after&&before.id!==after.id?after.score-before.score:undefined;
    if(scoreDelta===undefined&&!linked)continue;
    if(scoreDelta!==undefined&&Math.abs(scoreDelta)<3&&!linked)continue;
    const changes=linked?.chemistryChanges??[];
    const level:EventImpact["level"]=scoreDelta===undefined?linked!.level:scoreDelta>=5?"good":scoreDelta<=-5?"warn":"info";
    const effectAr=scoreDelta===undefined?"":scoreDelta>0?` وتحسنت حالة الحوض ${scoreDelta} نقاط بعده.`:scoreDelta<0?` وتراجعت حالة الحوض ${Math.abs(scoreDelta)} نقاط بعده.`:"";
    const effectEn=scoreDelta===undefined?"":scoreDelta>0?` Tank state improved by ${scoreDelta} points afterward.`:scoreDelta<0?` Tank state declined by ${Math.abs(scoreDelta)} points afterward.`:"";
    out.push({
      id:`memory-${event.id}`,
      event,
      scoreDelta,
      chemistryChanges:changes,
      level,
      ar:`${event.textAr}.${effectAr}${changes.length?` أبرز التغيرات: ${changes.slice(0,2).map(x=>`${x.parameter} ${x.delta>0?"↑":"↓"}`).join("، ")}.`:""}`,
      en:`${event.textEn}.${effectEn}${changes.length?` Main changes: ${changes.slice(0,2).map(x=>`${x.parameter} ${x.delta>0?"↑":"↓"}`).join(", ")}.`:""}`
    });
  }
  return out.slice(0,6);
}

export function tankMood(tank:Tank):TankMood{
  const state=tankStateView(tank),forecast=tankForecast(tank);
  if(state.band==="critical")return {key:"critical",symbol:"!",ar:"حرج",en:"Critical",noteAr:"الحوض يحتاج تدخلاً سريعاً ومراقبة لصيقة.",noteEn:"The tank needs rapid intervention and close monitoring."};
  if(state.band==="stressed")return {key:"stressed",symbol:"≈",ar:"متوتر",en:"Stressed",noteAr:"في عدة إشارات ضغط والحوض خارج راحته المعتادة.",noteEn:"Multiple stress signals are pushing the tank outside its normal comfort zone."};
  if(forecast.direction==="improving")return {key:"recovering",symbol:"↗",ar:"عم يتحسن",en:"Recovering",noteAr:"الاتجاه الحالي إيجابي والحوض عم يستجيب للإجراءات الأخيرة.",noteEn:"The current direction is positive and the tank is responding to recent actions."};
  if(state.band==="watch")return {key:"watchful",symbol:"◌",ar:"مترقّب",en:"Watchful",noteAr:"الوضع مقبول بس في إشارات لازم تضل تحت المراقبة.",noteEn:"The tank is acceptable, but some signals still need watching."};
  if(state.band==="excellent")return {key:"calm",symbol:"●",ar:"مرتاح",en:"Calm",noteAr:"المؤشرات متماسكة والحوض ضمن أفضل حالاته الحالية.",noteEn:"The signals are coherent and the tank is in one of its best current states."};
  return {key:"balanced",symbol:"◎",ar:"هادي ومستقر",en:"Calm & stable",noteAr:"الحوض متوازن وما في ضغط واضح حالياً.",noteEn:"The tank is balanced with no clear stress signal right now."};
}
