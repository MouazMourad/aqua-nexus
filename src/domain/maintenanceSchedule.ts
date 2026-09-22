import type { MaintenanceTask } from "./types";
import { addLocalCalendarDays,localDateKey } from "./timeSafety";

const DAY=86400000;

export const CADENCE_DAYS:Record<MaintenanceTask["cadence"],number>={
  daily:1,weekly:7,monthly:30,quarterly:90,semiannual:182,annual:365,once:3650
};

export function maintenanceIntervalDays(task:MaintenanceTask){
  return Math.max(1,task.intervalDays??CADENCE_DAYS[task.cadence]??30);
}

export function datePlusDays(dateOnly:string,offset:number){
  return addLocalCalendarDays(dateOnly,offset);
}

export function maintenanceTaskDue(task:MaintenanceTask,atDate=localDateKey()){
  if(task.cadence==="once")return !task.done&&Boolean(task.nextDue&&task.nextDue<=atDate);
  if(!task.nextDue)return !task.done;
  return task.nextDue<=atDate;
}

export function maintenanceTaskCompletedForCycle(task:MaintenanceTask,atDate=localDateKey()){
  if(task.cadence==="once")return task.done;
  // A recurring task stops counting as complete when its next cycle becomes due,
  // even if an older persisted "done" flag still exists.
  return Boolean(task.done)&&!maintenanceTaskDue(task,atDate);
}

export function completeMaintenanceTask(task:MaintenanceTask,atDate=localDateKey()):MaintenanceTask{
  if(task.cadence==="once")return {...task,done:true,lastDone:atDate,checklistDone:task.checklist?.map((_,i)=>i)??task.checklistDone};
  return {
    ...task,
    done:true,
    lastDone:atDate,
    nextDue:datePlusDays(atDate,maintenanceIntervalDays(task)),
    checklistDone:task.checklist?.map((_,i)=>i)??task.checklistDone
  };
}

export function maintenanceEffectiveState(task:MaintenanceTask,atDate=localDateKey()){
  const due=maintenanceTaskDue(task,atDate);
  const completed=maintenanceTaskCompletedForCycle(task,atDate);
  return {due,completed,pending:!completed,overdue:due&&Boolean(task.nextDue&&task.nextDue<atDate)};
}

export function recurringMaintenanceHealth(tasks:MaintenanceTask[],atDate=localDateKey()){
  if(!tasks.length)return 70;
  let points=0;
  for(const task of tasks){
    const state=maintenanceEffectiveState(task,atDate);
    if(state.completed)points+=1;
    else if(state.overdue)points+=.15;
    else points+=.65;
  }
  return Math.round(points/tasks.length*100);
}
