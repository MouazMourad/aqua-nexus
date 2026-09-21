import type { StateStorage } from "zustand/middleware";

const DB_NAME="aqua-nexus-state-v1";
const STORE="zustand";

function hasIndexedDb(){return typeof window!=="undefined"&&"indexedDB" in window;}

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(!hasIndexedDb()){reject(new Error("IndexedDB unavailable"));return;}
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error("IndexedDB open failed"));
  });
}

async function readIdb(key:string){
  const db=await openDb();
  return new Promise<string|null>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly"),req=tx.objectStore(STORE).get(key);
    req.onsuccess=()=>resolve(typeof req.result==="string"?req.result:null);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>{db.close();reject(tx.error)};
  });
}
async function writeIdb(key:string,value:string){
  const db=await openDb();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite"),req=tx.objectStore(STORE).put(value,key);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error)};
  });
}
async function removeIdb(key:string){
  const db=await openDb();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite"),req=tx.objectStore(STORE).delete(key);
    req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error)};
  });
}

function localGet(name:string){
  if(typeof window==="undefined")return null;
  try{return localStorage.getItem(name)}catch{return null}
}
function localSet(name:string,value:string){
  if(typeof window==="undefined")return;
  try{localStorage.setItem(name,value)}catch{}
}
function localRemove(name:string){
  if(typeof window==="undefined")return;
  try{localStorage.removeItem(name)}catch{}
}
function fallbackDirtyKey(name:string){return `${name}:fallback-dirty`;}

/**
 * Local-first durable Zustand storage.
 *
 * Existing Aqua Nexus installs used localStorage. On first successful IndexedDB
 * read/write we copy that exact serialized state into IndexedDB, verify the copy,
 * then remove the old primary key so multi-year history is no longer constrained
 * by localStorage quota. If IndexedDB is unavailable or fails, localStorage stays
 * as a compatibility fallback rather than losing user data.
 */
export const aquaStateStorage:StateStorage={
  async getItem(name){
    if(!hasIndexedDb())return localGet(name);
    // If an IndexedDB write failed previously, the localStorage fallback is the
    // newest committed copy. Prefer it until it has been verified back into IDB.
    const dirty=localGet(fallbackDirtyKey(name));
    if(dirty==="1"){
      const fallback=localGet(name);
      if(fallback!==null){
        try{
          await writeIdb(name,fallback);
          const verified=await readIdb(name);
          if(verified===fallback){localRemove(fallbackDirtyKey(name));localRemove(name);}
        }catch{}
        return fallback;
      }
      localRemove(fallbackDirtyKey(name));
    }
    try{
      const stored=await readIdb(name);
      if(stored!==null)return stored;
      const legacy=localGet(name);
      if(legacy!==null){
        await writeIdb(name,legacy);
        const verified=await readIdb(name);
        if(verified===legacy)localRemove(name);
        return legacy;
      }
      return null;
    }catch{
      return localGet(name);
    }
  },
  async setItem(name,value){
    if(!hasIndexedDb()){localSet(name,value);return;}
    try{
      await writeIdb(name,value);
      const verified=await readIdb(name);
      if(verified!==value)throw new Error("IndexedDB verification failed");
      // A successful verified IndexedDB write makes the fallback unnecessary.
      localRemove(name);
      localRemove(fallbackDirtyKey(name));
    }catch{
      localSet(name,value);
      localSet(fallbackDirtyKey(name),"1");
    }
  },
  async removeItem(name){
    localRemove(name);
    localRemove(fallbackDirtyKey(name));
    if(!hasIndexedDb())return;
    try{await removeIdb(name)}catch{}
  }
};
