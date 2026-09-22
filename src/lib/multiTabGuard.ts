const LEASE_KEY="aqua-nexus-writer-lease-v1";
const LEASE_MS=12_000;
const HEARTBEAT_MS=3_000;
const TAB_ID=typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface Lease{owner:string;heartbeat:number}

function readLease():Lease|null{
  if(typeof window==="undefined")return null;
  try{
    const raw=localStorage.getItem(LEASE_KEY);if(!raw)return null;
    const parsed=JSON.parse(raw) as Lease;
    return typeof parsed.owner==="string"&&Number.isFinite(parsed.heartbeat)?parsed:null;
  }catch{return null}
}
function writeLease(lease:Lease){
  if(typeof window==="undefined")return false;
  try{localStorage.setItem(LEASE_KEY,JSON.stringify(lease));return true}catch{return false}
}
function fresh(lease:Lease|null,now=Date.now()){return Boolean(lease&&now-lease.heartbeat<LEASE_MS)}

export function tryAcquireWriteLease(force=false){
  if(typeof window==="undefined")return true;
  const current=readLease(),now=Date.now();
  if(force||!fresh(current,now)||current?.owner===TAB_ID)return writeLease({owner:TAB_ID,heartbeat:now});
  return false;
}

export function canWriteFromThisTab(){
  if(typeof window==="undefined")return true;
  const current=readLease(),now=Date.now();
  if(current?.owner===TAB_ID&&fresh(current,now))return true;
  return tryAcquireWriteLease(false);
}

export function forceTakeOverWriteLease(){return tryAcquireWriteLease(true)}

export function notifyWriteConflict(){
  if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("aqua-nexus-storage-conflict"));
}

export function startMultiTabWriteLease(onWritable:(writable:boolean)=>void){
  if(typeof window==="undefined")return()=>{};
  let disposed=false;
  const update=()=>{
    if(disposed)return;
    const writable=canWriteFromThisTab();
    if(writable)writeLease({owner:TAB_ID,heartbeat:Date.now()});
    onWritable(writable);
  };
  const onStorage=(event:StorageEvent)=>{if(event.key===LEASE_KEY)update()};
  const onConflict=()=>onWritable(false);
  const release=()=>{
    const lease=readLease();
    if(lease?.owner===TAB_ID){try{localStorage.removeItem(LEASE_KEY)}catch{}}
  };
  update();
  const timer=window.setInterval(update,HEARTBEAT_MS);
  window.addEventListener("storage",onStorage);
  window.addEventListener("aqua-nexus-storage-conflict",onConflict);
  window.addEventListener("beforeunload",release);
  return()=>{disposed=true;window.clearInterval(timer);window.removeEventListener("storage",onStorage);window.removeEventListener("aqua-nexus-storage-conflict",onConflict);window.removeEventListener("beforeunload",release);release()};
}
