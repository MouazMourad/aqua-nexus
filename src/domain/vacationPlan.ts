import type { TankType } from "./types";

export interface VacationTaskDraft{
  title:string;titleEn:string;cadence:"once";done:false;nextDue:string;manual:true;
}

function addDateDays(dateOnly:string,offset:number){
  const [y,m,d]=dateOnly.split("-").map(Number);
  const date=new Date(Date.UTC(y,m-1,d+offset));
  return date.toISOString().slice(0,10);
}

export function vacationDays(startDate:string,endDate?:string){
  if(!endDate)return null;
  const start=new Date(startDate+"T00:00:00Z").getTime(),end=new Date(endDate+"T00:00:00Z").getTime();
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return null;
  return Math.max(1,Math.round((end-start)/86400000));
}

export function buildVacationTaskDrafts(input:{departure:string;daysAway:number;caretaker?:string;tankType:TankType}):VacationTaskDraft[]{
  const span=Math.max(1,Math.min(365,Math.round(input.daysAway)));
  const who=input.caretaker?.trim()||"";
  const prefix="[TRAVEL]";
  const preDate=addDateDays(input.departure,-1);
  const out:VacationTaskDraft[]=[];
  const add=(ar:string,en:string,due:string)=>out.push({title:`${prefix} ${ar}`,titleEn:`${prefix} ${en}`,cadence:"once",done:false,nextDue:due,manual:true});
  add("فحص كيمياء كامل وتسجيل القيم الأساسية قبل السفر","Run a full chemistry test and save baseline values before travel",preDate);
  add("فحص مضخة الرجوع والسخان والويف ميكر والـATO والتأكد من عدم وجود إنذارات","Inspect return pump, heater, wave makers and ATO; confirm there are no warnings",preDate);
  add("تعبئة خزان ATO وخزانات الدوزر وتجهيز حصص الطعام بدون زيادة","Refill ATO/doser reservoirs and prepare pre-portioned food without overfeeding",preDate);
  if(input.tankType==="marine")add("تأكد من الملوحة وثبات حرارة ماء التعويض وعدم ترك خلطات غير موثقة","Confirm salinity and top-off setup; do not leave undocumented mixes",preDate);
  const interval=span<=14?1:2;
  for(let d=0;d<span;d+=interval){
    const due=addDateDays(input.departure,d),day=d+1;
    add(`سفر يوم ${day}: نظرة بصرية على الكائنات + الحرارة + مستوى الماء + عمل المضخات${who?` — المسؤول: ${who}`:""}`,`Travel day ${day}: visual livestock check + temperature + water level + pump operation${who?` — caretaker: ${who}`:""}`,due);
    if(d%7===6||day===span)add(`سفر يوم ${day}: مراجعة التنبيهات وعدم تعديل الجرعات أو المعدات بدون سبب واضح`,`Travel day ${day}: review alerts; avoid changing dosing or equipment without a clear reason`,due);
  }
  if(span>=7)add("فحص كيمياء مختصر أثناء الغياب إذا كان الشخص المسؤول قادر عليه","Run a limited chemistry check during absence if the caretaker can do it safely",addDateDays(input.departure,Math.min(7,span-1)));
  add("بعد العودة: فحص كيمياء كامل ومقارنة الحالة مع خط الأساس قبل السفر","After return: run a full chemistry test and compare with the pre-travel baseline",addDateDays(input.departure,span));
  return out;
}
