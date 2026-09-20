import type { DosingLog,Tank } from "./types";

export function latestCorrectiveDoseExecution(tank:Tank,parameter:string){
  return tank.dosing
    .filter(x=>x.parameter===parameter&&x.calculatorMode!=="routine"&&x.status!=="planned")
    .map(x=>({log:x,at:new Date(x.lastExecutedAt||x.timestamp).getTime()}))
    .filter(x=>Number.isFinite(x.at))
    .sort((a,b)=>b.at-a.at)[0];
}

export function requiresPostDoseRetest(tank:Tank,parameter:string,sampleTimestamp?:string){
  if(!sampleTimestamp)return false;
  const execution=latestCorrectiveDoseExecution(tank,parameter);
  if(!execution)return false;
  const sampleTime=new Date(sampleTimestamp).getTime();
  return Number.isFinite(sampleTime)&&execution.at>=sampleTime;
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
