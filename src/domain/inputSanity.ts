export interface InputSanityIssue{
  field:string;
  level:"warn"|"danger";
  ar:string;
  en:string;
}

function finite(value:number){return Number.isFinite(value);}
function range(field:string,value:number,min:number,max:number,arLabel:string,enLabel:string):InputSanityIssue|undefined{
  if(!finite(value))return{field,level:"danger",ar:`${arLabel}: القيمة ليست رقماً صالحاً.`,en:`${enLabel}: value is not a valid number.`};
  if(value<min||value>max)return{field,level:"danger",ar:`${arLabel}: القيمة ${value} خارج المجال المنطقي ${min}–${max}.`,en:`${enLabel}: ${value} is outside the plausible range ${min}–${max}.`};
}

export function validateRodiEntry(input:{tdsIn:number;tdsOut:number;liters:number;wasteLiters:number;productionMinutes:number;sourcePressurePsi:number}){
  const issues:InputSanityIssue[]=[];
  const checks=[
    range("tdsIn",input.tdsIn,0,5000,"TDS الداخل","Input TDS"),
    range("tdsOut",input.tdsOut,0,5000,"TDS الخارج","Output TDS"),
    range("liters",input.liters,.1,5000,"الماء المنتج","Produced water"),
    range("wasteLiters",input.wasteLiters,0,20000,"ماء الرفض","Waste water"),
    range("productionMinutes",input.productionMinutes,.1,10080,"وقت الإنتاج","Production time"),
    range("sourcePressurePsi",input.sourcePressurePsi,0,200,"ضغط المصدر","Source pressure")
  ].filter(Boolean) as InputSanityIssue[];
  issues.push(...checks);
  if(finite(input.tdsIn)&&finite(input.tdsOut)&&input.tdsOut>input.tdsIn)issues.push({
    field:"tdsOut",level:"danger",
    ar:"TDS الخارج أعلى من TDS الداخل. تحقق من الإدخال أو مكان القياس قبل الحفظ.",
    en:"Output TDS is higher than input TDS. Verify the entry or measurement point before saving."
  });
  if(input.tdsIn>0&&input.tdsOut/input.tdsIn>.5)issues.push({
    field:"rejection",level:"warn",
    ar:"نسبة الرفض المحسوبة منخفضة جداً. إذا القيم صحيحة فالنظام يحتاج فحصاً قبل استخدام الماء للحوض.",
    en:"Calculated rejection is extremely low. If the readings are correct, inspect the system before using this water."
  });
  if(input.sourcePressurePsi>0&&input.sourcePressurePsi<20)issues.push({
    field:"sourcePressurePsi",level:"warn",
    ar:"ضغط المصدر أقل من 20 PSI؛ الإنتاج/الرفض قد يكونان غير طبيعيين. تأكد من القياس.",
    en:"Source pressure is below 20 PSI; production/rejection may be abnormal. Verify the reading."
  });
  return {ok:!issues.some(x=>x.level==="danger"),issues};
}

export function validatePositiveQuantity(value:number,field="quantity"){
  if(!finite(value)||value<=0)return{ok:false,issue:{field,level:"danger" as const,ar:"الكمية يجب أن تكون رقماً أكبر من صفر.",en:"Quantity must be a number greater than zero."}};
  return{ok:true as const};
}

export function validatePercent(value:number,field="percent"){
  if(!finite(value)||value<0||value>100)return{ok:false,issue:{field,level:"danger" as const,ar:"النسبة يجب أن تكون بين 0 و100.",en:"Percentage must be between 0 and 100."}};
  return{ok:true as const};
}
