import type { FilterMediaItem, Tank } from "./types";

export type MediaState = "fresh" | "watch" | "replace";

export interface MediaPrediction {
  estimatedLifeDays: number;
  ageDays: number;
  remainingDays: number;
  state: MediaState;
  confidence: "low" | "medium" | "high";
  reasonAr: string;
  reasonEn: string;
}

function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}
function daysBetween(from:string,to=Date.now()){
  const t=new Date(from).getTime();
  return Number.isFinite(t)?Math.max(0,(to-t)/86400000):0;
}

function latestPair(tank:Tank,key:string){
  const values=tank.chemistry
    .map(r=>({timestamp:r.timestamp,value:r.values[key]}))
    .filter(x=>typeof x.value==="number"&&Number.isFinite(x.value as number)) as {timestamp:string;value:number}[];
  return values.slice(0,2);
}

export function predictMediaLife(tank:Tank,item:FilterMediaItem):MediaPrediction{
  const ageDays=daysBetween(item.installedAt);
  const base=Math.max(1,item.referenceLifeDays||30);
  const volume=Math.max(1,tank.systemVolumeLiters);
  const nominalPer100=item.kind==="gfo"?50:item.kind==="activatedCarbon"?75:60;
  const nominalAmount=nominalPer100*(volume/100);
  const capacityFactor=clamp((item.amountGrams||nominalAmount)/Math.max(1,nominalAmount),.45,2.25);

  let loadFactor=1;
  let confidence:"low"|"medium"|"high"="low";
  let reasonAr="التقدير يعتمد على العمر المرجعي، كمية الميديا وحجم النظام.";
  let reasonEn="Estimate uses reference life, media amount and system volume.";

  if(item.kind==="gfo"){
    const pair=latestPair(tank,"PO4");
    if(pair.length){
      const current=pair[0].value;
      const concentrationFactor=clamp(current/.08,.65,2.6);
      loadFactor*=concentrationFactor;
      confidence=pair.length>=2?"high":"medium";
      if(pair.length>=2){
        const previous=pair[1].value;
        const delta=current-previous;
        if(delta>0.02) loadFactor*=1.22;
        else if(delta<-0.02) loadFactor*=1.08;
        reasonAr=`تم استخدام PO4 الحالي (${current.toFixed(3)}) واتجاه آخر قراءتين مع حجم الحوض وكمية GFO.`;
        reasonEn=`Current PO4 (${current.toFixed(3)}) and the latest trend were combined with tank volume and GFO amount.`;
      } else {
        reasonAr=`تم استخدام PO4 الحالي (${current.toFixed(3)}) مع حجم الحوض وكمية GFO.`;
        reasonEn=`Current PO4 (${current.toFixed(3)}) was combined with tank volume and GFO amount.`;
      }
    }
  } else if(item.kind==="activatedCarbon"){
    confidence="low";
    reasonAr="لا يوجد بارامتر كيميائي مباشر يحدد تشبع الكربون، لذلك هذا تقدير محافظ مبني على العمر والكمية وحجم النظام.";
    reasonEn="Activated carbon has no direct chemistry marker here, so this is a conservative estimate based on age, amount and system volume.";
  }

  const estimatedLifeDays=Math.max(3,Math.round((base*capacityFactor)/Math.max(.55,loadFactor)));
  const remainingDays=Math.round(estimatedLifeDays-ageDays);
  const pct=ageDays/estimatedLifeDays;
  const state:MediaState=remainingDays<=0||pct>=1?"replace":remainingDays<=Math.max(3,estimatedLifeDays*.2)?"watch":"fresh";
  return {estimatedLifeDays,ageDays:Math.round(ageDays),remainingDays,state,confidence,reasonAr,reasonEn};
}

export function mediaPredictions(tank:Tank){
  return (tank.filterMedia??[]).map(item=>({item,prediction:predictMediaLife(tank,item)}));
}
