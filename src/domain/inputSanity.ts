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


export function validateTankSetupEntry(input:{
  length:number;width:number;height:number;displacementPercent:number;ageMonths:number;
  sumpEnabled:boolean;sumpLength:number;sumpWidth:number;sumpHeight:number;sumpFillPercent:number;
}){
  const issues:InputSanityIssue[]=[];
  const add=(x:InputSanityIssue|undefined)=>{if(x)issues.push(x)};
  add(range("length",input.length,1,2000,"طول الحوض","Tank length"));
  add(range("width",input.width,1,1000,"عرض الحوض","Tank width"));
  add(range("height",input.height,1,1000,"ارتفاع الحوض","Tank height"));
  add(range("displacementPercent",input.displacementPercent,0,90,"نسبة الإزاحة","Displacement percent"));
  add(range("ageMonths",input.ageMonths,0,1200,"عمر الحوض","Tank age"));
  if(input.sumpEnabled){
    add(range("sumpLength",input.sumpLength,1,2000,"طول السامب","Sump length"));
    add(range("sumpWidth",input.sumpWidth,1,1000,"عرض السامب","Sump width"));
    add(range("sumpHeight",input.sumpHeight,1,1000,"ارتفاع السامب","Sump height"));
    add(range("sumpFillPercent",input.sumpFillPercent,1,100,"نسبة تعبئة السامب","Sump fill percent"));
  }
  return{ok:!issues.some(x=>x.level==="danger"),issues};
}

export function sanitizeSumpDimension(value:number,fallback:number,max=2000){
  return finite(value)?Math.max(1,Math.min(max,value)):Math.max(1,fallback);
}
export function sanitizeSumpFill(value:number,fallback:number){
  return finite(value)?Math.max(1,Math.min(100,value)):Math.max(1,Math.min(100,fallback));
}
export function sanitizeNonNegative(value:number,fallback=0,max=1_000_000){
  return finite(value)?Math.max(0,Math.min(max,value)):Math.max(0,fallback);
}


export function validateEquipmentEntry(input:{
  serviceIntervalDays:number;powerWatts:number;hoursPerDay:number;ratedVolumeLiters:number;flowLph:number;
  parAtTargetDepth:number;coverageLengthCm:number;coverageWidthCm:number;
}){
  const issues:InputSanityIssue[]=[]; const add=(x:InputSanityIssue|undefined)=>{if(x)issues.push(x)};
  add(range("serviceIntervalDays",input.serviceIntervalDays,1,3650,"فترة الصيانة بالأيام","Service interval days"));
  add(range("powerWatts",input.powerWatts,0,100000,"القدرة بالواط","Power watts"));
  add(range("hoursPerDay",input.hoursPerDay,0,24,"ساعات التشغيل اليومية","Hours per day"));
  add(range("ratedVolumeLiters",input.ratedVolumeLiters,0,5_000_000,"الحجم المصنف","Rated volume"));
  add(range("flowLph",input.flowLph,0,20_000_000,"التدفق","Flow"));
  add(range("parAtTargetDepth",input.parAtTargetDepth,0,5000,"PAR","PAR"));
  add(range("coverageLengthCm",input.coverageLengthCm,0,5000,"طول التغطية","Coverage length"));
  add(range("coverageWidthCm",input.coverageWidthCm,0,5000,"عرض التغطية","Coverage width"));
  return{ok:!issues.some(x=>x.level==="danger"),issues};
}

export function validateInventoryEntry(input:{quantity:number;minimum:number;unit:string;name:string}){
  const issues:InputSanityIssue[]=[]; const add=(x:InputSanityIssue|undefined)=>{if(x)issues.push(x)};
  add(range("quantity",input.quantity,0,1_000_000_000,"كمية المخزون","Inventory quantity"));
  add(range("minimum",input.minimum,0,1_000_000_000,"حد المخزون الأدنى","Minimum stock"));
  if(!input.name.trim())issues.push({field:"name",level:"danger",ar:"اسم المادة مطلوب.",en:"Item name is required."});
  if(!input.unit.trim())issues.push({field:"unit",level:"danger",ar:"وحدة القياس مطلوبة.",en:"Unit is required."});
  if(input.minimum>input.quantity&&input.quantity>0)issues.push({field:"minimum",level:"warn",ar:"الحد الأدنى أعلى من الكمية الحالية؛ ستظهر المادة كمخزون منخفض مباشرة.",en:"Minimum stock is above current quantity; the item will immediately appear low."});
  return{ok:!issues.some(x=>x.level==="danger"),issues};
}

export function validateExpenseEntry(input:{amount:number;description:string;currency:string}){
  const issues:InputSanityIssue[]=[]; const add=(x:InputSanityIssue|undefined)=>{if(x)issues.push(x)};
  add(range("amount",input.amount,.000001,1_000_000_000,"قيمة المصروف","Expense amount"));
  if(!input.description.trim())issues.push({field:"description",level:"danger",ar:"وصف المصروف مطلوب.",en:"Expense description is required."});
  if(!/^[A-Za-z0-9 ._-]{2,12}$/.test(input.currency.trim()))issues.push({field:"currency",level:"danger",ar:"رمز العملة غير منطقي. استخدم رمزاً قصيراً مثل USD أو EUR.",en:"Currency code looks invalid. Use a short code such as USD or EUR."});
  return{ok:!issues.some(x=>x.level==="danger"),issues};
}

export function validateWaterChangeEntry(input:{liters:number;systemVolumeLiters:number;salinity?:number;temperature?:number}){
  const issues:InputSanityIssue[]=[]; const add=(x:InputSanityIssue|undefined)=>{if(x)issues.push(x)};
  add(range("liters",input.liters,.1,Math.max(.1,input.systemVolumeLiters*2),"حجم تغيير الماء","Water-change volume"));
  if(input.salinity!==undefined)add(range("salinity",input.salinity,.99,1.06,"ملوحة ماء التعويض","Replacement salinity"));
  if(input.temperature!==undefined)add(range("temperature",input.temperature,0,45,"حرارة ماء التعويض","Replacement temperature"));
  if(input.systemVolumeLiters>0&&input.liters>input.systemVolumeLiters)issues.push({field:"liters",level:"danger",ar:"حجم تغيير الماء أكبر من حجم النظام المسجل.",en:"Water-change volume is larger than the recorded system volume."});
  return{ok:!issues.some(x=>x.level==="danger"),issues};
}

export function validateDoserChannelEntry(input:{capacityMl:number;currentMl:number;consumption:number}){
  const issues:InputSanityIssue[]=[]; const add=(x:InputSanityIssue|undefined)=>{if(x)issues.push(x)};
  add(range("capacityMl",input.capacityMl,.1,1_000_000,"سعة قناة الدوزر","Doser capacity"));
  add(range("currentMl",input.currentMl,0,1_000_000,"الكمية المتبقية","Doser remaining volume"));
  add(range("consumption",input.consumption,0,1_000_000,"الاستهلاك","Doser consumption"));
  if(input.currentMl>input.capacityMl)issues.push({field:"currentMl",level:"danger",ar:"الكمية المتبقية لا يمكن أن تكون أكبر من سعة الخزان.",en:"Remaining volume cannot exceed reservoir capacity."});
  return{ok:!issues.some(x=>x.level==="danger"),issues};
}

export function validateFilterMediaEntry(input:{amountGrams:number;referenceLifeDays:number}){
  const issues:InputSanityIssue[]=[]; const add=(x:InputSanityIssue|undefined)=>{if(x)issues.push(x)};
  add(range("amountGrams",input.amountGrams,.1,100_000,"كمية الميديا","Media amount"));
  add(range("referenceLifeDays",input.referenceLifeDays,1,3650,"العمر المرجعي","Reference life"));
  return{ok:!issues.some(x=>x.level==="danger"),issues};
}

export function validateEnergySettings(input:{pricePerKwh:number;currency:string}){
  const issues:InputSanityIssue[]=[]; const add=(x:InputSanityIssue|undefined)=>{if(x)issues.push(x)};
  add(range("pricePerKwh",input.pricePerKwh,0,1_000_000,"سعر الكهرباء","Electricity price"));
  if(input.currency.trim()&&!/^[A-Za-z0-9 ._-]{2,12}$/.test(input.currency.trim()))issues.push({field:"currency",level:"danger",ar:"رمز العملة غير منطقي.",en:"Currency code looks invalid."});
  return{ok:!issues.some(x=>x.level==="danger"),issues};
}

export function sanitizeBounded(value:number,min:number,max:number,fallback=min){
  return finite(value)?Math.max(min,Math.min(max,value)):fallback;
}
