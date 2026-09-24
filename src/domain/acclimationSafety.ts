import type { AcclimationItem,AcclimationSession,CoralDipRun } from "./types";
import { isPlausibleOperationalTimestamp } from "./timeSafety";

export interface AcclimationTransferGate {
  allowed:boolean;
  reasonAr:string;
  reasonEn:string;
  run?:CoralDipRun;
}

export function latestCoralDipRunForItem(session:AcclimationSession,itemId:string){
  return [...(session.coralDipRuns??[])]
    .filter(run=>run.status!=="cancelled"&&run.itemIds.includes(itemId)&&isPlausibleOperationalTimestamp(run.startedAt))
    .sort((a,b)=>new Date(b.startedAt).getTime()-new Date(a.startedAt).getTime())[0];
}

export function coralTransferGate(session:AcclimationSession,item:AcclimationItem):AcclimationTransferGate{
  if(item.category!=="coral"||!session.coralDipEnabled)return{allowed:true,reasonAr:"لا يوجد Coral Dip مطلوب لهذا الكائن.",reasonEn:"No Coral Dip is required for this item."};
  if((session.coralDipSkippedItemIds??[]).includes(item.id))return{allowed:true,reasonAr:"تم تسجيل تجاوز Coral Dip بشكل صريح بسبب حالة الكائن.",reasonEn:"Coral Dip was explicitly skipped because of the livestock condition."};
  const run=latestCoralDipRunForItem(session,item.id);
  if(!run)return{allowed:false,reasonAr:"المرجان يحتاج Coral Dip مسجلاً قبل النقل للحوض.",reasonEn:"This coral requires a recorded Coral Dip before transfer to the tank."};
  if(run.status==="running")return{allowed:false,run,reasonAr:"Coral Dip ما زال قيد التشغيل. انتظر انتهاء العداد.",reasonEn:"Coral Dip is still running. Wait for the timer to finish."};
  if(run.status==="ready_to_rinse")return{allowed:false,run,reasonAr:"انتهى الـDip لكن لازم تأكيد الشطف بماء منفصل قبل النقل.",reasonEn:"The dip is complete, but a separate rinse must be confirmed before transfer."};
  if(run.status==="rinsed")return{allowed:true,run,reasonAr:"تم الـDip والشطف ويمكن متابعة قرار النقل.",reasonEn:"Dip and rinse are complete; transfer can proceed."};
  return{allowed:false,run,reasonAr:"مسار Coral Dip غير مكتمل.",reasonEn:"The Coral Dip workflow is incomplete."};
}

export function coralDipBatchRun(session:AcclimationSession,batchId:string){
  return [...(session.coralDipRuns??[])]
    .filter(run=>run.batchId===batchId&&run.status!=="cancelled"&&isPlausibleOperationalTimestamp(run.startedAt))
    .sort((a,b)=>new Date(b.startedAt).getTime()-new Date(a.startedAt).getTime())[0];
}
