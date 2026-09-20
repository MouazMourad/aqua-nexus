import type { Tank } from "./types";

export type WaterChangeRisk="normal"|"warn"|"danger";

export function waterChangeIntelligence(tank:Tank,percent:number,replacementSalinity?:number,replacementTemperature?:number){
  const latest=tank.chemistry[0]?.values??{};
  const no3=typeof latest.NO3==="number"?latest.NO3:null;
  const po4=typeof latest.PO4==="number"?latest.PO4:null;
  const tankSal=typeof latest.salinity==="number"?latest.salinity:null;
  const tankTemp=typeof latest.temperature==="number"?latest.temperature:null;
  const numeric=Number(percent);
  const blocked=!Number.isFinite(numeric)||numeric<=0||numeric>100;
  const fraction=Math.max(0,Math.min(.9,Number.isFinite(numeric)?numeric/100:0));
  const projectedNO3=no3===null?null:no3*(1-fraction);
  const projectedPO4=po4===null?null:po4*(1-fraction);
  const warnings:string[]=[];
  let risk:WaterChangeRisk="normal",suggestedPercent=10;

  if((no3!==null&&no3>40)||(po4!==null&&po4>.3))suggestedPercent=20;
  else if((no3!==null&&no3>25)||(po4!==null&&po4>.2))suggestedPercent=15;

  if(blocked){
    warnings.push("حجم تغيير الماء غير صالح؛ النسبة لازم تكون أكبر من 0% ولا تتجاوز 100% من حجم النظام.");
    risk="danger";
  }else if(numeric>50){
    warnings.push("تغيير أكبر من 50% يُعتبر تغييراً كبيراً وقد يسبب تبدلاً سريعاً بالكيمياء والحرارة والملوحة/المعادن. استخدمه فقط لسبب واضح مع ماء مطابق ومراقبة لصيقة.");
    risk="danger";
  }else if(numeric>35){
    warnings.push("تغيير الماء أكبر من 35%؛ راجع سبب الحاجة إليه وتأكد أن ماء التعويض مطابق قدر الإمكان قبل التنفيذ.");
    risk="warn";
  }

  let mismatchCount=0;
  if(tank.type==="marine"&&tankSal!==null&&replacementSalinity!==undefined){
    const diff=Math.abs(tankSal-replacementSalinity);
    if(diff>.004){warnings.push("فرق الملوحة كبير جداً؛ اضبط ماء التغيير قبل الإدخال.");risk="danger";mismatchCount++;}
    else if(diff>.002){warnings.push("فرق الملوحة ملحوظ؛ الأفضل تقريبه أكثر من ملوحة الحوض.");if(risk==="normal")risk="warn";mismatchCount++;}
  }
  if(tankTemp!==null&&replacementTemperature!==undefined){
    const diff=Math.abs(tankTemp-replacementTemperature);
    if(diff>3){warnings.push("فرق الحرارة أكبر من 3°C؛ لا تنفذ التغيير قبل تقريب حرارة ماء التعويض من الحوض.");risk="danger";mismatchCount++;}
    else if(diff>2){warnings.push("فرق الحرارة أكبر من 2°C؛ قرّب حرارة ماء التغيير من الحوض.");if(risk==="normal")risk="warn";mismatchCount++;}
  }
  if(numeric>30&&mismatchCount>0){
    warnings.push("اجتماع تغيير ماء كبير مع فرق في خصائص ماء التعويض يرفع الخطر أكثر من كل عامل لوحده.");
    risk="danger";
  }

  return {
    projectedNO3,projectedPO4,suggestedPercent,warnings,risk,blocked,
    requiresConfirmation:risk==="warn"||risk==="danger",
    safe:risk==="normal"&&!blocked
  };
}
