import type { Tank } from "./types";
import { currentChemistryValues } from "./chemistryDataQuality";

export function feedingIntelligence(tank:Tank){
  const cutoff=Date.now()-7*86400000;
  const recent=tank.feeding.filter(x=>new Date(x.timestamp).getTime()>=cutoff);
  const fish=tank.livestock.filter(x=>x.category==="fish").reduce((s,x)=>s+x.quantity,0);
  const inverts=tank.livestock.filter(x=>x.category==="invert").reduce((s,x)=>s+x.quantity,0);
  const corals=tank.livestock.filter(x=>x.category==="coral").reduce((s,x)=>s+x.quantity,0);
  const plants=tank.livestock.filter(x=>x.category==="plant").reduce((s,x)=>s+x.quantity,0);
  const latest=currentChemistryValues(tank);
  const no3=typeof latest.NO3==="number"?latest.NO3:null;
  const po4=typeof latest.PO4==="number"?latest.PO4:null;
  const nutrientPressure=tank.type==="marine"
    ? ((no3!==null&&no3>25)||(po4!==null&&po4>.2)?"high":(no3!==null&&no3>15)||(po4!==null&&po4>.12)?"watch":"normal")
    : ((no3!==null&&no3>40)?"high":(no3!==null&&no3>25)?"watch":"normal");
  const suggestions:string[]=[];
  if(fish>0)suggestions.push("قسم غذاء الأسماك إلى وجبات صغيرة بدل دفعة كبيرة، وسجل الكمية بشكل ثابت للمقارنة.");
  if(inverts>0)suggestions.push("راقب احتياجات اللافقاريات الموجهة للغذاء ولا تعتبر غذاء الأسماك كافياً لكل الأنواع.");
  if(corals>0)suggestions.push("تغذية المرجان اختيارية حسب النوع؛ اربط أي زيادة بالغذاء مع NO3/PO4 واستجابة المرجان.");
  if(nutrientPressure==="high")suggestions.push("المغذيات مرتفعة؛ راجع الكمية وبقايا الطعام قبل زيادة أي تغذية.");
  else if(nutrientPressure==="watch")suggestions.push("المغذيات تحتاج مراقبة؛ ثبّت الروتين ولا تغيّر الكمية بسرعة.");
  return {recent7d:recent.length,fish,inverts,corals,plants,nutrientPressure,suggestions};
}
