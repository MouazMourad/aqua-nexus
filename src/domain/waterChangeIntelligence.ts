import type { Tank } from "./types";

export function waterChangeIntelligence(tank:Tank,percent:number,replacementSalinity?:number,replacementTemperature?:number){
  const latest=tank.chemistry[0]?.values??{};
  const no3=typeof latest.NO3==="number"?latest.NO3:null;
  const po4=typeof latest.PO4==="number"?latest.PO4:null;
  const tankSal=typeof latest.salinity==="number"?latest.salinity:null;
  const tankTemp=typeof latest.temperature==="number"?latest.temperature:null;
  const fraction=Math.max(0,Math.min(.9,percent/100));
  const projectedNO3=no3===null?null:no3*(1-fraction);
  const projectedPO4=po4===null?null:po4*(1-fraction);
  const warnings:string[]=[];
  let suggestedPercent=10;
  if((no3!==null&&no3>40)||(po4!==null&&po4>.3))suggestedPercent=20;
  else if((no3!==null&&no3>25)||(po4!==null&&po4>.2))suggestedPercent=15;
  if(tank.type==="marine"&&tankSal!==null&&replacementSalinity!==undefined){
    const diff=Math.abs(tankSal-replacementSalinity);
    if(diff>.004)warnings.push("فرق الملوحة كبير جداً؛ اضبط ماء التغيير قبل الإدخال.");
    else if(diff>.002)warnings.push("فرق الملوحة ملحوظ؛ الأفضل تقريبه أكثر من ملوحة الحوض.");
  }
  if(tankTemp!==null&&replacementTemperature!==undefined&&Math.abs(tankTemp-replacementTemperature)>2)warnings.push("فرق الحرارة أكبر من 2°C؛ قرّب حرارة ماء التغيير من الحوض.");
  return {projectedNO3,projectedPO4,suggestedPercent,warnings,safe:warnings.length===0};
}
