import type { Tank } from "@/domain/types";

const DB_NAME="aqua-nexus-long-history-v1";
const STORE="records";
const INDEX="tank-domain-time";

export type HistoricalDomain=
  |"timeline"|"intelligenceEvents"|"chemistry"|"healthSnapshots"|"feeding"|"dosing"
  |"expenses"|"waterChanges"|"rodi"|"rodiServiceEvents"|"plantCare"
  |"acclimationSessions"|"emergencySessions"|"livestockExits"|"aiActionPlans";

export interface HistoricalRecord{
  key:string;tankId:string;domain:HistoricalDomain;timestampMs:number;timestamp:string;id:string;payload:unknown;
}
export interface HistoricalPage<T=unknown>{
  rows:Array<HistoricalRecord&{payload:T}>;
  nextCursor:{timestampMs:number;id:string}|null;
}

function available(){return typeof window!=="undefined"&&"indexedDB" in window;}
function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(!available()){reject(new Error("IndexedDB unavailable"));return}
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      const store=db.objectStoreNames.contains(STORE)?request.transaction!.objectStore(STORE):db.createObjectStore(STORE,{keyPath:"key"});
      if(!store.indexNames.contains(INDEX))store.createIndex(INDEX,["tankId","domain","timestampMs","id"],{unique:false});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error("Long-term history open failed"));
  });
}
function timestampOf(domain:HistoricalDomain,row:any){
  const raw=domain==="acclimationSessions"?row.startedAt:domain==="aiActionPlans"?row.createdAt:domain==="emergencySessions"?(row.startedAt??row.timestamp):row.timestamp;
  const ms=new Date(String(raw??"")).getTime();
  return Number.isFinite(ms)?{timestampMs:ms,timestamp:new Date(ms).toISOString()}:null;
}
function idOf(domain:HistoricalDomain,row:any,index:number){
  return String(row?.id??`${domain}:${row?.timestamp??row?.startedAt??row?.createdAt??index}`);
}
function keyOf(tankId:string,domain:HistoricalDomain,timestampMs:number,id:string){
  return `${tankId}|${domain}|${String(timestampMs).padStart(16,"0")}|${id}`;
}
async function putRecords(records:HistoricalRecord[]){
  if(!records.length)return;
  const db=await openDb();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);
    for(const row of records)store.put(row);
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error??new Error("Long-term history write failed"))};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("Long-term history write aborted"))};
  });
}
async function countDomain(tankId:string,domain:HistoricalDomain){
  const db=await openDb();
  return new Promise<number>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly"),idx=tx.objectStore(STORE).index(INDEX);
    const range=IDBKeyRange.bound([tankId,domain,0,""],[tankId,domain,Number.MAX_SAFE_INTEGER,"\uffff"]);
    const req=idx.count(range);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>{db.close();reject(tx.error)};
  });
}

export const historicalDomains:HistoricalDomain[]=[
  "timeline","intelligenceEvents","chemistry","healthSnapshots","feeding","dosing",
  "expenses","waterChanges","rodi","rodiServiceEvents","plantCare",
  "acclimationSessions","emergencySessions","livestockExits","aiActionPlans"
];

function archivable(domain:HistoricalDomain,row:any,cutoff:number){
  const ts=timestampOf(domain,row); if(!ts||ts.timestampMs>=cutoff)return false;
  if(domain==="acclimationSessions")return row.status==="completed";
  if(domain==="emergencySessions")return row.status!=="active";
  if(domain==="aiActionPlans")return row.status==="completed";
  return true;
}

export async function archiveHistoricalDomains(tank:Tank,beforeISO:string){
  if(!available())return{ok:false as const,reason:"indexeddb-unavailable",tank,archived:0,byDomain:{} as Record<string,number>};
  const cutoff=new Date(beforeISO).getTime();
  if(!Number.isFinite(cutoff))return{ok:false as const,reason:"invalid-cutoff",tank,archived:0,byDomain:{} as Record<string,number>};
  const next:any={...tank},records:HistoricalRecord[]=[]; const byDomain:Record<string,number>={};
  for(const domain of historicalDomains){
    const rows=Array.isArray((tank as any)[domain])?(tank as any)[domain] as any[]:[];
    const keep:any[]=[];
    rows.forEach((row,index)=>{
      if(archivable(domain,row,cutoff)){
        const ts=timestampOf(domain,row)!; const id=idOf(domain,row,index);
        records.push({key:keyOf(tank.id,domain,ts.timestampMs,id),tankId:tank.id,domain,timestampMs:ts.timestampMs,timestamp:ts.timestamp,id,payload:row});
        byDomain[domain]=(byDomain[domain]??0)+1;
      }else keep.push(row);
    });
    next[domain]=keep;
  }
  if(!records.length)return{ok:true as const,tank,archived:0,byDomain};
  try{
    await putRecords(records);
    for(const [domain,count] of Object.entries(byDomain)){
      const actual=await countDomain(tank.id,domain as HistoricalDomain);
      if(actual<count)throw new Error(`Archive verification failed for ${domain}`);
    }
    return{ok:true as const,tank:next as Tank,archived:records.length,byDomain};
  }catch{
    return{ok:false as const,reason:"archive-write-failed",tank,archived:0,byDomain:{}};
  }
}

export async function readHistoricalPage<T=unknown>(tankId:string,domain:HistoricalDomain,opts:{limit?:number;cursor?:{timestampMs:number;id:string}|null}={}):Promise<HistoricalPage<T>>{
  if(!available())throw new Error("IndexedDB unavailable");
  const limit=Math.max(1,Math.min(500,Math.round(opts.limit??100))),db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly"),idx=tx.objectStore(STORE).index(INDEX);
    const upper=opts.cursor?[tankId,domain,opts.cursor.timestampMs,opts.cursor.id]:[tankId,domain,Number.MAX_SAFE_INTEGER,"\uffff"];
    const lower=[tankId,domain,0,""];
    const range=IDBKeyRange.bound(lower,upper,false,Boolean(opts.cursor));
    const req=idx.openCursor(range,"prev"),rows:Array<HistoricalRecord&{payload:T}>=[]; let finished=false;
    const finish=(hasMore:boolean)=>{if(finished)return;finished=true;const last=rows.at(-1);resolve({rows,nextCursor:hasMore&&last?{timestampMs:last.timestampMs,id:last.id}:null})};
    req.onsuccess=()=>{
      const cursor=req.result;
      if(!cursor){finish(false);return}
      if(rows.length>=limit){finish(true);return}
      rows.push(cursor.value);cursor.continue();
    };
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>{db.close();finish(false)};
    tx.onerror=()=>{db.close();reject(tx.error)};
  });
}

export async function readAllHistoricalDomain<T=unknown>(tankId:string,domain:HistoricalDomain){
  const out:Array<HistoricalRecord&{payload:T}>=[]; let cursor:null|{timestampMs:number;id:string}=null;
  do{
    const page=await readHistoricalPage<T>(tankId,domain,{limit:500,cursor});
    out.push(...page.rows);cursor=page.nextCursor;
  }while(cursor);
  return out;
}

export async function hydrateLongTermHistoryStrict(tank:Tank):Promise<Tank>{
  if(!available())throw new Error("IndexedDB unavailable while verifying long-term history");
  const next:any={...tank};
  for(const domain of historicalDomains){
    const archived=await readAllHistoricalDomain<any>(tank.id,domain);
    if(!archived.length)continue;
    const current=Array.isArray((tank as any)[domain])?[...(tank as any)[domain]]:[];
    const seen=new Set(current.map((x:any,i:number)=>idOf(domain,x,i)));
    for(const row of archived)if(!seen.has(row.id)){current.push(row.payload);seen.add(row.id)}
    current.sort((a:any,b:any)=>(timestampOf(domain,b)?.timestampMs??0)-(timestampOf(domain,a)?.timestampMs??0));
    next[domain]=current;
  }
  return next as Tank;
}

export async function longTermHistoryStats(tankId:string){
  const byDomain:Partial<Record<HistoricalDomain,number>>={}; let total=0;
  if(!available())return{total,byDomain};
  for(const domain of historicalDomains){const count=await countDomain(tankId,domain);if(count){byDomain[domain]=count;total+=count}}
  return{total,byDomain};
}

export async function clearLongTermHistory(tankId:string){
  if(!available())return;
  const db=await openDb();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE),idx=store.index(INDEX);
    let domainIndex=0;
    const nextDomain=()=>{
      if(domainIndex>=historicalDomains.length)return;
      const domain=historicalDomains[domainIndex++];
      const range=IDBKeyRange.bound([tankId,domain,0,""],[tankId,domain,Number.MAX_SAFE_INTEGER,"\uffff"]);
      const req=idx.openKeyCursor(range);
      req.onsuccess=()=>{const cur=req.result;if(!cur){nextDomain();return}store.delete(cur.primaryKey);cur.continue()};
      req.onerror=()=>reject(req.error);
    };
    nextDomain();
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error)};
  });
}
