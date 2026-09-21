import type { IntelligenceEvent,Tank,TimelineEvent } from "@/domain/types";

const DB_NAME="aqua-nexus-history-v1";
const STORE="tank-history";

export interface TankHistoryArchive{
  tankId:string;
  timeline:TimelineEvent[];
  intelligenceEvents:IntelligenceEvent[];
  updatedAt:string;
}

function available(){return typeof window!=="undefined"&&"indexedDB" in window;}
function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(!available()){reject(new Error("IndexedDB unavailable"));return}
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error("History archive open failed"));
  });
}
async function readRaw(tankId:string):Promise<TankHistoryArchive|null>{
  if(!available())return null;
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly"),req=tx.objectStore(STORE).get(tankId);
    req.onsuccess=()=>resolve(req.result??null);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>{db.close();reject(tx.error)};
  });
}
async function writeRaw(tankId:string,value:TankHistoryArchive){
  const db=await openDb();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite"),req=tx.objectStore(STORE).put(value,tankId);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error)};
  });
}
function mergeById<T extends {id:string}>(a:T[],b:T[]){
  const map=new Map<string,T>();
  for(const row of [...a,...b])map.set(row.id,row);
  return [...map.values()].sort((x:any,y:any)=>new Date(y.timestamp).getTime()-new Date(x.timestamp).getTime());
}

export async function readTankHistoryArchive(tankId:string){
  try{return await readRaw(tankId)}catch{return null}
}

export async function readTankHistoryArchiveStrict(tankId:string){
  if(!available())throw new Error("IndexedDB unavailable while verifying legacy history archive");
  return await readRaw(tankId);
}

export async function archiveOldTankHistory(tank:Tank,beforeISO:string){
  if(!available())return {ok:false as const,reason:"indexeddb-unavailable" as const,tank,archivedTimeline:0,archivedEvents:0};
  const cutoff=new Date(beforeISO).getTime();
  if(!Number.isFinite(cutoff))return {ok:false as const,reason:"invalid-cutoff" as const,tank,archivedTimeline:0,archivedEvents:0};
  const oldTimeline=tank.timeline.filter(x=>new Date(x.timestamp).getTime()<cutoff);
  const oldEvents=(tank.intelligenceEvents??[]).filter(x=>new Date(x.timestamp).getTime()<cutoff);
  if(!oldTimeline.length&&!oldEvents.length)return {ok:true as const,tank,archivedTimeline:0,archivedEvents:0};
  try{
    const current=await readRaw(tank.id);
    const archive:TankHistoryArchive={
      tankId:tank.id,
      timeline:mergeById(current?.timeline??[],oldTimeline),
      intelligenceEvents:mergeById(current?.intelligenceEvents??[],oldEvents),
      updatedAt:new Date().toISOString()
    };
    await writeRaw(tank.id,archive);
    const verified=await readRaw(tank.id);
    if(!verified||verified.timeline.length<archive.timeline.length||verified.intelligenceEvents.length<archive.intelligenceEvents.length)throw new Error("History archive verification failed");
    return{
      ok:true as const,
      archivedTimeline:oldTimeline.length,
      archivedEvents:oldEvents.length,
      tank:{...tank,timeline:tank.timeline.filter(x=>new Date(x.timestamp).getTime()>=cutoff),intelligenceEvents:(tank.intelligenceEvents??[]).filter(x=>new Date(x.timestamp).getTime()>=cutoff)}
    };
  }catch{
    return {ok:false as const,reason:"archive-write-failed" as const,tank,archivedTimeline:0,archivedEvents:0};
  }
}

export async function hydrateTankHistoryArchive(tank:Tank):Promise<Tank>{
  const archive=await readTankHistoryArchive(tank.id);
  if(!archive)return tank;
  return{
    ...tank,
    timeline:mergeById(tank.timeline,archive.timeline),
    intelligenceEvents:mergeById(tank.intelligenceEvents??[],archive.intelligenceEvents)
  };
}

export async function hydrateTankHistoryArchiveStrict(tank:Tank):Promise<Tank>{
  const archive=await readTankHistoryArchiveStrict(tank.id);
  if(!archive)return tank;
  return{
    ...tank,
    timeline:mergeById(tank.timeline,archive.timeline),
    intelligenceEvents:mergeById(tank.intelligenceEvents??[],archive.intelligenceEvents)
  };
}

export async function hydrateAllTankHistoryArchives(tanks:Tank[]){
  const out:Tank[]=[];
  for(const tank of tanks)out.push(await hydrateTankHistoryArchive(tank));
  return out;
}

export async function clearTankHistoryArchive(tankId:string){
  if(!available())return;
  try{
    const db=await openDb();
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite"),req=tx.objectStore(STORE).delete(tankId);
      req.onerror=()=>reject(req.error);
      tx.oncomplete=()=>{db.close();resolve()};
      tx.onerror=()=>{db.close();reject(tx.error)};
    });
  }catch{}
}
