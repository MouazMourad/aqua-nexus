import type { Tank } from "./types";

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
  const readings=[...tank.chemistry]
    .filter(x=>!x.usingDefaults&&finite(x.values[param])&&Number.isFinite(ts(x.timestamp)))
    .sort((a,b)=>ts(a.timestamp)-ts(b.timestamp))
    .slice(-14);
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

export function tankBaselines(tank:Tank):TankBaseline[]{
  const out:TankBaseline[]=[];
  for(const parameter of paramsFor(tank)){
    const values=[...tank.chemistry]
      .filter(x=>!x.usingDefaults&&finite(x.values[parameter]))
      .slice(0,12)
      .map(x=>Number(x.values[parameter]));
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
  if(!out.length&&baselines.length>=2)out.push({id:"baseline-stable",level:"good",ar:"القراءات الحالية قريبة من السلوك المعتاد الذي تعلّمه Aqua Nexus لهذا الحوض.",en:"Current readings are close to the behavior Aqua Nexus has learned as usual for this tank."});
  return out.slice(0,5);
}
