import type { RecoveryBackupEnvelope } from "@/lib/recoveryBackup";

const DB_NAME="aqua-nexus-recovery-checkpoints-v1";
const STORE="checkpoints";
const KEY="last-destructive-action";

export interface RecoveryCheckpoint{
  createdAt:string;
  reason:"restore"|"delete-tank";
  detail?:string;
  backup:RecoveryBackupEnvelope;
}

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined"){reject(new Error("IndexedDB unavailable"));return}
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error??new Error("Recovery checkpoint storage failed"));
  });
}

export async function saveRecoveryCheckpoint(checkpoint:RecoveryCheckpoint){
  const db=await openDb();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(checkpoint,KEY);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error??new Error("Recovery checkpoint write failed"));
    tx.onabort=()=>reject(tx.error??new Error("Recovery checkpoint write aborted"));
  }).finally(()=>db.close());
}

export async function readRecoveryCheckpoint():Promise<RecoveryCheckpoint|null>{
  const db=await openDb();
  return new Promise<RecoveryCheckpoint|null>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly"),req=tx.objectStore(STORE).get(KEY);
    req.onsuccess=()=>resolve((req.result as RecoveryCheckpoint|undefined)??null);
    req.onerror=()=>reject(req.error??new Error("Recovery checkpoint read failed"));
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>{db.close();reject(tx.error??new Error("Recovery checkpoint read failed"))};
  });
}

export async function clearRecoveryCheckpoint(){
  const db=await openDb();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error??new Error("Recovery checkpoint delete failed"));
  }).finally(()=>db.close());
}
