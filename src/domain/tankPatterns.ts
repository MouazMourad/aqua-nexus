import type { Tank } from "./types";
import { eventChemistryLinks } from "./tankLearning";

const DAY=86400000;
type Parameter="KH"|"Ca"|"Mg"|"NO3"|"PO4"|"pH"|"salinity"|"temperature";

export interface TankBaseline {
  parameter:Parameter;
  samples:number;
  median:number;
  observedLow:number;
  observedHigh:number;
  mad:number;
  current:number;
  status:"within"|"above-usual"|"below-usual";
  usualDeclinePerDay?:number;
  recentDeclinePerDay?:number;
  consumptionState?:"usual"|"faster"|"slower";
}

export interface LearnedSignal {
  id:string;
  level:"good"|"info"|"warn";
  ar:string;
  en:string;
}

export interface RepeatedResponsePattern {
  id:string;
  eventType:string;
  parameter:string;
  count:number;
  sameDirectionCount:number;
  averageDelta:number;
  direction:"up"|"down";
  confidence:"medium"|"high";
  ar:string;
  en:string;
}

export interface TankLearningMaturity {
  score:number;
  level:"early"|"growing"|"mature";
  confidence:"low"|"medium"|"high";
  measuredReadings:number;
  observedDays:number;
  repeatedPatterns:number;
  linkedEvents:number;
  ar:string;
  en:string;
}

function ts(x:string){return new Date(x).getTime();}
function finite(v:unknown):v is number{return typeof v==="number"&&Number.isFinite(v);}
function median(values:number[]){
  if(!values.length)return NaN;
  const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}
function quantile(values:number[],q:number){
  const s=[...values].sort((a,b)=>a-b);
  if(!s.length)return NaN;
  const p=(s.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);
  if(lo===hi)return s[lo];
  return s[lo]+(s[hi]-s[lo])*(p-lo);
}
function interventionBetween(tank:Tank,param:Parameter,start:number,end:number){
  const wc=tank.waterChanges.some(x=>{const t=ts(x.timestamp);return t>start&&t<end;});
  const dose=tank.dosing.some((x:any)=>{const t=ts(x.timestamp);return t>start&&t<end&&String(x.parameter||"").toLowerCase()===param.toLowerCase();});
  return wc||dose;
}
function paramsFor(tank:Tank):Parameter[]{
  return tank.type==="marine"?["KH","Ca","Mg","NO3","PO4","pH","salinity","temperature"]:["KH","NO3","pH","temperature"];
}
function declineRates(tank:Tank,param:Parameter){
  const all=[...tank.chemistry]
    .filter(x=>!x.usingDefaults&&finite(x.values[param])&&Number.isFinite(ts(x.timestamp)))
    .sort((a,b)=>ts(a.timestamp)-ts(b.timestamp));
  const cutoff=Date.now()-365*DAY;
  const recent=all.filter(x=>ts(x.timestamp)>=cutoff);
  const readings=(recent.length>=2?recent:all).slice(-120);
  const rates:{rate:number;end:number}[]=[];
  for(let i=1;i<readings.length;i++){
    const a=readings[i-1],b=readings[i],ta=ts(a.timestamp),tb=ts(b.timestamp),days=(tb-ta)/DAY;
    if(days<.25||days>21||interventionBetween(tank,param,ta,tb))continue;
    const before=Number(a.values[param]),after=Number(b.values[param]);
    const rate=(before-after)/days;
    if(rate>0)rates.push({rate,end:tb});
  }
  return rates;
}
function normalizedEventType(raw:string){
  const s=raw.toLowerCase();
  if(/water.?change|تغيير.?ماء/.test(s))return "waterchange";
  if(/dosing|dose|جرع/.test(s))return "dosing";
  if(/feeding|feed|تغذ/.test(s))return "feeding";
  if(/livestock|fish|coral|سمك|مرجان|كائن/.test(s))return "livestock";
  if(/maintenance|service|صيان/.test(s))return "maintenance";
  if(/media|gfo|carbon|ميديا|كربون/.test(s))return "media";
  if(/treatment|quarantine|علاج|حجر/.test(s))return "treatment";
  return s.split(/\s+/)[0]||"event";
}
function eventLabel(type:string,lang:"ar"|"en"){
  const map:Record<string,[string,string]>={waterchange:["تغيير الماء","water change"],dosing:["الجرعات","dosing"],feeding:["التغذية","feeding"],livestock:["إضافة/تغيير الكائنات","livestock changes"],maintenance:["الصيانة","maintenance"],media:["تغيير الميديا","media changes"],treatment:["العلاج/الحجر","treatment/quarantine"]};
  return map[type]?.[lang==="ar"?0:1]??type;
}

export function tankBaselines(tank:Tank):TankBaseline[]{
  const out:TankBaseline[]=[];
  for(const parameter of paramsFor(tank)){
    const all=[...tank.chemistry]
      .filter(x=>!x.usingDefaults&&finite(x.values[parameter])&&Number.isFinite(ts(x.timestamp)))
      .sort((a,b)=>ts(b.timestamp)-ts(a.timestamp));
    const cutoff=Date.now()-365*DAY;
    const recent=all.filter(x=>ts(x.timestamp)>=cutoff);
    const rows=(recent.length>=3?recent:all).slice(0,120);
    const values=rows.map(x=>Number(x.values[parameter]));
    if(values.length<3)continue;
    const center=median(values),mad=median(values.map(x=>Math.abs(x-center)));
    const low=quantile(values,.15),high=quantile(values,.85),current=values[0];
    const fixedFloor=parameter==="PO4" ? 0.01 : parameter==="KH" ? 0.2 : 0.05;
    const naturalBand=Math.max(mad*2,Math.abs(center)*.03,fixedFloor);
    const status:TankBaseline["status"]=current>high+naturalBand?"above-usual":current<low-naturalBand?"below-usual":"within";
    const rates=declineRates(tank,parameter);
    let usualDeclinePerDay:number|undefined,recentDeclinePerDay:number|undefined,consumptionState:TankBaseline["consumptionState"]|undefined;
    if(rates.length>=2){
      usualDeclinePerDay=median(rates.map(x=>x.rate));
      recentDeclinePerDay=rates[rates.length-1].rate;
      if(usualDeclinePerDay>0){
        const ratio=recentDeclinePerDay/usualDeclinePerDay;
        consumptionState=ratio>=1.5?"faster":ratio<=.55?"slower":"usual";
      }
    }
    out.push({parameter,samples:values.length,median:center,observedLow:low,observedHigh:high,mad,current,status,usualDeclinePerDay,recentDeclinePerDay,consumptionState});
  }
  return out;
}

export function repeatedResponsePatterns(tank:Tank):RepeatedResponsePattern[]{
  const links=eventChemistryLinks(tank,200,250);
  const groups=new Map<string,{type:string;parameter:string;deltas:number[]}>();
  for(const link of links){
    const type=normalizedEventType(`${link.event.type} ${link.event.textEn} ${link.event.textAr}`);
    for(const change of link.chemistryChanges){
      const key=`${type}:${change.parameter}`;
      const row=groups.get(key)??{type,parameter:change.parameter,deltas:[]};
      row.deltas.push(change.delta);groups.set(key,row);
    }
  }
  const out:RepeatedResponsePattern[]=[];
  for(const [key,row] of groups){
    if(row.deltas.length<2)continue;
    const positive=row.deltas.filter(x=>x>0),negative=row.deltas.filter(x=>x<0);
    const winner=positive.length>=negative.length?positive:negative;
    if(winner.length/row.deltas.length<.67)continue;
    const avg=winner.reduce((s,x)=>s+x,0)/winner.length;
    const direction=avg>0?"up":"down";
    const confidence=winner.length>=3&&winner.length/row.deltas.length>=.75?"high":"medium";
    const arLabel=eventLabel(row.type,"ar"),enLabel=eventLabel(row.type,"en");
    out.push({
      id:`repeat-${key}`,eventType:row.type,parameter:row.parameter,count:row.deltas.length,sameDirectionCount:winner.length,averageDelta:avg,direction,confidence,
      ar:`بـ ${winner.length} من أصل ${row.deltas.length} مرات بعد ${arLabel} تحرك ${row.parameter} بنفس الاتجاه (${direction==="up"?"ارتفاع":"انخفاض"}) بمتوسط ${Math.abs(avg).toFixed(row.parameter==="PO4"?3:1)}. هاد نمط متكرر بهالحوض، مو إثبات سببية.`,
      en:`In ${winner.length} of ${row.deltas.length} observations after ${enLabel}, ${row.parameter} moved in the same direction (${direction}) by an average ${Math.abs(avg).toFixed(row.parameter==="PO4"?3:1)}. This is a repeated tank-specific association, not proof of causation.`
    });
  }
  return out.sort((a,b)=>(b.confidence==="high"?2:1)-(a.confidence==="high"?2:1)||b.sameDirectionCount-a.sameDirectionCount).slice(0,5);
}

export function tankLearningMaturity(tank:Tank):TankLearningMaturity{
  const measured=tank.chemistry.filter(x=>!x.usingDefaults&&Number.isFinite(ts(x.timestamp))).slice().sort((a,b)=>ts(a.timestamp)-ts(b.timestamp));
  const measuredReadings=measured.length;
  const observedDays=measured.length>=2?Math.max(0,Math.round((ts(measured[measured.length-1].timestamp)-ts(measured[0].timestamp))/DAY)):0;
  const repeatedPatterns=repeatedResponsePatterns(tank).length;
  const linkedEvents=eventChemistryLinks(tank,200,250).length;
  const readingScore=Math.min(35,measuredReadings/36*35);
  const spanScore=Math.min(30,observedDays/365*30);
  const patternScore=Math.min(25,repeatedPatterns/4*25);
  const eventScore=Math.min(10,linkedEvents/20*10);
  const score=Math.max(0,Math.min(100,Math.round(readingScore+spanScore+patternScore+eventScore)));
  const level:TankLearningMaturity["level"]=score>=70?"mature":score>=35?"growing":"early";
  const confidence:TankLearningMaturity["confidence"]=level==="mature"?"high":level==="growing"?"medium":"low";
  const ar=level==="mature"
    ?`Tank Brain صار عنده ذاكرة ناضجة لهالحوض: ${measuredReadings} قراءة عبر ${observedDays} يوم و${repeatedPatterns} نمط متكرر موثق.`
    :level==="growing"
      ?`Tank Brain عم يبني بصمة الحوض: ${measuredReadings} قراءة عبر ${observedDays} يوم. دقته الشخصية رح تزيد مع الاستمرار بالتسجيل.`
      :`Tank Brain لسا بمرحلة التعلم المبكر: عنده ${measuredReadings} قراءة موثقة. النصائح حالياً تعتمد أكثر على قواعد الأمان العامة.`;
  const en=level==="mature"
    ?`Tank Brain has a mature tank-specific memory: ${measuredReadings} measured readings across ${observedDays} days and ${repeatedPatterns} repeated response pattern(s).`
    :level==="growing"
      ?`Tank Brain is building this tank's fingerprint: ${measuredReadings} readings across ${observedDays} days. Personal confidence increases with continued logging.`
      :`Tank Brain is still in early learning: ${measuredReadings} measured reading(s). Guidance currently relies more heavily on general safety rules.`;
  return{score,level,confidence,measuredReadings,observedDays,repeatedPatterns,linkedEvents,ar,en};
}

export function learnedTankSignals(tank:Tank):LearnedSignal[]{
  const baselines=tankBaselines(tank),out:LearnedSignal[]=[];
  for(const b of baselines){
    if(b.status!=="within"){
      const direction=b.status==="above-usual"?"أعلى":"أخفض";
      const directionEn=b.status==="above-usual"?"above":"below";
      out.push({id:`baseline-${b.parameter}`,level:"info",ar:`${b.parameter} حالياً ${direction} من المجال المعتاد لهالحوض نفسه بناءً على ${b.samples} قراءات، حتى لو كان الرقم ضمن مجال عام مقبول.`,en:`${b.parameter} is currently ${directionEn} this tank's own observed range based on ${b.samples} readings, even if the number may still sit inside a general acceptable range.`});
    }
    if(b.consumptionState==="faster"&&b.usualDeclinePerDay&&b.recentDeclinePerDay){
      out.push({id:`rate-${b.parameter}`,level:"warn",ar:`معدل انخفاض ${b.parameter} الأخير (${b.recentDeclinePerDay.toFixed(b.parameter==="KH"?2:1)}/يوم) أسرع من نمط الحوض المعتاد (${b.usualDeclinePerDay.toFixed(b.parameter==="KH"?2:1)}/يوم). راقب إذا استمر النمط قبل زيادة الجرعات بشكل دائم.`,en:`Recent ${b.parameter} decline (${b.recentDeclinePerDay.toFixed(b.parameter==="KH"?2:1)}/day) is faster than this tank's usual pattern (${b.usualDeclinePerDay.toFixed(b.parameter==="KH"?2:1)}/day). Confirm the pattern before permanently increasing dosing.`});
    }
  }
  for(const pattern of repeatedResponsePatterns(tank).slice(0,2))out.push({id:pattern.id,level:"info",ar:pattern.ar,en:pattern.en});
  if(!out.length&&baselines.length>=2)out.push({id:"baseline-stable",level:"good",ar:"القراءات الحالية قريبة من السلوك المعتاد الذي تعلّمه Aqua Nexus لهذا الحوض.",en:"Current readings are close to the behavior Aqua Nexus has learned as usual for this tank."});
  return out.slice(0,6);
}
