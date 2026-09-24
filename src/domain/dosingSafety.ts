import type { DosingLog,Tank } from "./types";
import { latestParameterSample } from "./chemistryDataQuality";
import { isPlausibleOperationalTimestamp } from "./timeSafety";

export function latestCorrectiveDoseExecution(tank:Tank,parameter:string){
  return tank.dosing
    .filter(x=>x.parameter===parameter&&x.calculatorMode!=="routine"&&x.status!=="planned"&&x.status!=="invalidated")
    .map(x=>({log:x,at:new Date(x.lastExecutedAt||x.timestamp).getTime()}))
    .filter(x=>Number.isFinite(x.at)&&isPlausibleOperationalTimestamp(x.log.lastExecutedAt||x.log.timestamp))
    .sort((a,b)=>b.at-a.at)[0];
}

export function requiresPostDoseRetest(tank:Tank,parameter:string,sampleTimestamp?:string){
  if(!sampleTimestamp)return false;
  const execution=latestCorrectiveDoseExecution(tank,parameter);
  if(!execution)return false;
  const sampleTime=new Date(sampleTimestamp).getTime();
  return Number.isFinite(sampleTime)&&execution.at>=sampleTime;
}

export interface DoseStepGate{
  ok:boolean;
  amount:number;
  sampleTimestamp?:string;
  sampleValue?:number;
  code?:"missing_retest"|"stale_measurement"|"low_confidence"|"volume_changed"|"target_reached"|"unexpected_response"|"invalid_plan";
  ar:string;
  en:string;
}

export function doseStepExecutionGate(tank:Tank,dose:DosingLog,step:number):DoseStepGate{
  const total=Math.max(1,dose.steps??1);
  const baseAmount=Number(dose.perStep??0);
  if(!Number.isFinite(step)||step<1||step>total||!Number.isFinite(baseAmount)||baseAmount<=0){
    return {ok:false,amount:0,code:"invalid_plan",ar:"خطة الجرعات غير صالحة للتنفيذ. أعد إنشاء الخطة من صفحة الجرعات.",en:"The dosing plan is not valid for execution. Recreate it from Dosing."};
  }
  const sample=latestParameterSample(tank,dose.parameter);
  if(!sample){
    return {ok:false,amount:0,code:"missing_retest",ar:`لا يمكن تنفيذ الجرعة ${step}. لازم يكون في قياس ${dose.parameter} فعلي حديث أولاً.`,en:`Dose step ${step} is blocked. A recent measured ${dose.parameter} result is required first.`};
  }
  const sampleAt=new Date(sample.timestamp).getTime(),ageHours=Math.max(0,(Date.now()-sampleAt)/3600000);
  if(ageHours>48){
    return {ok:false,amount:0,code:"stale_measurement",sampleTimestamp:sample.timestamp,sampleValue:sample.value,ar:`آخر قياس ${dose.parameter} أقدم من 48 ساعة. أعد القياس قبل تنفيذ أي خطوة من الخطة.`,en:`The latest ${dose.parameter} measurement is older than 48 hours. Retest before executing any plan step.`};
  }
  if(step>1){
    const executedAt=new Date(dose.lastExecutedAt||"").getTime();
    if(!Number.isFinite(executedAt)||sampleAt<=executedAt){
      return {ok:false,amount:0,code:"missing_retest",sampleTimestamp:sample.timestamp,sampleValue:sample.value,ar:`لا يمكن تنفيذ الجرعة ${step}. لازم تسجّل قياس ${dose.parameter} فعلي جديد بعد الجرعة السابقة أولاً.`,en:`Dose step ${step} is blocked. Log a new measured ${dose.parameter} result after the previous dose first.`};
    }
  }else if(dose.sourceReadingTimestamp){
    const sourceAt=new Date(dose.sourceReadingTimestamp).getTime();
    if(Number.isFinite(sourceAt)&&sampleAt<sourceAt){
      return {ok:false,amount:0,code:"invalid_plan",sampleTimestamp:sample.timestamp,sampleValue:sample.value,ar:"قراءة إنشاء الخطة لم تعد موجودة كأحدث دليل صالح. أعد إنشاء الخطة قبل التنفيذ.",en:"The plan's source reading is no longer the latest valid evidence. Recreate the plan before execution."};
    }
  }
  if(sample.confidence==="low"){
    return {ok:false,amount:0,code:"low_confidence",sampleTimestamp:sample.timestamp,sampleValue:sample.value,ar:"إعادة القياس موجودة لكن ثقتها منخفضة. أعد القياس قبل متابعة الخطة.",en:"A retest exists but confidence is low. Retest before continuing the plan."};
  }

  const originalVolume=Number(dose.systemVolumeLiters??0),currentVolume=Number(tank.systemVolumeLiters);
  const tolerance=Math.max(1,originalVolume*.01);
  if(!Number.isFinite(originalVolume)||originalVolume<=0||!Number.isFinite(currentVolume)||Math.abs(currentVolume-originalVolume)>tolerance){
    return {ok:false,amount:0,code:"volume_changed",sampleTimestamp:sample.timestamp,sampleValue:sample.value,ar:`حجم النظام تغيّر منذ إنشاء الخطة (${originalVolume.toFixed(1)} → ${currentVolume.toFixed(1)} L). أوقف الخطة وأنشئ جرعة جديدة على الحجم الحالي.`,en:`System volume changed since this plan was created (${originalVolume.toFixed(1)} → ${currentVolume.toFixed(1)} L). Stop this plan and recalculate from the current volume.`};
  }

  const start=Number(dose.current),target=Number(dose.target),totalAmount=Number(dose.amount??dose.ml);
  const initialDelta=target-start,remainingDelta=target-sample.value;
  if(!Number.isFinite(start)||!Number.isFinite(target)||!Number.isFinite(totalAmount)||totalAmount<=0||initialDelta<=0){
    return {ok:false,amount:0,code:"invalid_plan",sampleTimestamp:sample.timestamp,sampleValue:sample.value,ar:"بيانات الخطة الأصلية ناقصة؛ لا يمكن إعادة حساب الخطوة بأمان.",en:"The original plan context is incomplete, so the next step cannot be recalculated safely."};
  }
  if(remainingDelta<=0){
    return {ok:false,amount:0,code:"target_reached",sampleTimestamp:sample.timestamp,sampleValue:sample.value,ar:`القياس الجديد ${sample.value} وصل/تجاوز الهدف ${target}. لا تنفذ جرعة إضافية؛ أوقف الخطة.`,en:`The new reading ${sample.value} reached/exceeded the target ${target}. Do not execute another dose; stop this plan.`};
  }

  const rate=totalAmount/initialDelta;
  const remainingSteps=Math.max(1,total-step+1);
  const recalculated=(rate*remainingDelta)/remainingSteps;
  const maxSafe=baseAmount*1.01;
  if(!Number.isFinite(recalculated)||recalculated<=0||recalculated>maxSafe){
    return {ok:false,amount:0,code:"unexpected_response",sampleTimestamp:sample.timestamp,sampleValue:sample.value,ar:"الاستجابة بعد الجرعة لا تسمح بمتابعة نفس الخطة بدون زيادة الخطوة عن الحد الأصلي. أعد الحساب من القراءة الجديدة.",en:"The post-dose response would require a larger step than the original safety cap. Recalculate from the new measurement instead."};
  }
  return {ok:true,amount:recalculated,sampleTimestamp:sample.timestamp,sampleValue:sample.value,ar:`تمت إعادة حساب الخطوة على قراءة ${dose.parameter} الجديدة: ${sample.value}.`,en:`This step was recalculated from the new measured ${dose.parameter}: ${sample.value}.`};
}

export function dosingContextSnapshot(log:DosingLog){
  return {
    parameter:log.parameter,
    readingTimestamp:log.sourceReadingTimestamp,
    executionTimestamp:log.lastExecutedAt||log.timestamp,
    systemVolumeLiters:log.systemVolumeLiters,
    amount:log.amount??log.ml,
    unit:log.unit||"mL"
  };
}
