export type PersistenceHealth="ok"|"degraded"|"failed";
export interface DataSafetyStatus{
  persistence:PersistenceHealth;
  lastDurableWriteAt?:string;
  lastFailureAt?:string;
  lastFailure?:string;
}

const KEY="aqua-nexus-data-safety-v1";
const globalSafety=globalThis as typeof globalThis&{aquaDataSafetyStatus?:DataSafetyStatus};
const EVENT="aqua:data-safety";

function storage(){
  try{return typeof window!=="undefined"?window.localStorage:null}catch{return null}
}

export function readDataSafetyStatus():DataSafetyStatus{
  if(globalSafety.aquaDataSafetyStatus)return globalSafety.aquaDataSafetyStatus;
  const s=storage();
  if(!s)return{persistence:"degraded",lastFailure:"Browser storage is unavailable"};
  try{
    const parsed=JSON.parse(s.getItem(KEY)||"null");
    if(parsed&&["ok","degraded","failed"].includes(parsed.persistence))return parsed;
  }catch{}
  return{persistence:"ok"};
}

export function writeDataSafetyStatus(next:DataSafetyStatus){
  globalSafety.aquaDataSafetyStatus=next;
  const s=storage();
  try{s?.setItem(KEY,JSON.stringify(next))}catch{}
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(EVENT,{detail:next}));
}

export function markDurableWrite(){
  writeDataSafetyStatus({persistence:"ok",lastDurableWriteAt:new Date().toISOString()});
}

export function markPersistenceDegraded(message:string){
  const prev=readDataSafetyStatus();
  writeDataSafetyStatus({...prev,persistence:"degraded",lastFailureAt:new Date().toISOString(),lastFailure:message});
}

export function markPersistenceFailed(message:string){
  const prev=readDataSafetyStatus();
  writeDataSafetyStatus({...prev,persistence:"failed",lastFailureAt:new Date().toISOString(),lastFailure:message});
}

export function subscribeDataSafety(listener:(status:DataSafetyStatus)=>void){
  if(typeof window==="undefined")return()=>{};
  const fn=(event:Event)=>listener((event as CustomEvent<DataSafetyStatus>).detail);
  window.addEventListener(EVENT,fn);
  return()=>window.removeEventListener(EVENT,fn);
}
