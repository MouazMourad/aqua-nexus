import type { JournalPhoto,Tank } from "@/domain/types";

const DB_NAME="aqua-nexus-media-v1";
const STORE="photos";
const FULL_DATA_THRESHOLD=140_000;

function indexedDbAvailable(){return typeof window!=="undefined"&&"indexedDB" in window;}

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(!indexedDbAvailable()){reject(new Error("IndexedDB unavailable"));return;}
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error("IndexedDB open failed"));
  });
}

async function withStore<T>(mode:IDBTransactionMode,fn:(store:IDBObjectStore,resolve:(value:T)=>void,reject:(reason?:unknown)=>void)=>void){
  const db=await openDb();
  return new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>{db.close();reject(tx.error??new Error("IndexedDB transaction failed"));};
    fn(store,resolve,reject);
  });
}

export async function putPhotoAsset(key:string,dataUrl:string){
  if(!indexedDbAvailable())return false;
  try{
    await withStore<boolean>("readwrite",(store,resolve,reject)=>{
      const req=store.put(dataUrl,key);
      req.onsuccess=()=>resolve(true);
      req.onerror=()=>reject(req.error);
    });
    return true;
  }catch{return false;}
}

export async function getPhotoAsset(key?:string){
  if(!key||!indexedDbAvailable())return null;
  try{
    return await withStore<string|null>("readonly",(store,resolve,reject)=>{
      const req=store.get(key);
      req.onsuccess=()=>resolve(typeof req.result==="string"?req.result:null);
      req.onerror=()=>reject(req.error);
    });
  }catch{return null;}
}

export async function deletePhotoAsset(key?:string){
  if(!key||!indexedDbAvailable())return;
  try{
    await withStore<boolean>("readwrite",(store,resolve,reject)=>{
      const req=store.delete(key);
      req.onsuccess=()=>resolve(true);
      req.onerror=()=>reject(req.error);
    });
  }catch{}
}

function loadImage(dataUrl:string){
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("Image decode failed"));
    img.src=dataUrl;
  });
}

export async function createPhotoPreview(dataUrl:string,maxSide=360,quality=.72){
  if(typeof document==="undefined")return dataUrl;
  try{
    const img=await loadImage(dataUrl);
    const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext("2d");
    if(!ctx)return dataUrl;
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL("image/jpeg",quality);
  }catch{return dataUrl;}
}

export function photoNeedsExternalization(photo:JournalPhoto){
  return !photo.assetKey&&Boolean(photo.dataUrl?.startsWith("data:image/"))&&photo.dataUrl.length>=FULL_DATA_THRESHOLD;
}

export async function externalizePhoto(photo:JournalPhoto):Promise<JournalPhoto>{
  if(photo.assetKey&&photo.fullResolutionStored)return photo;
  if(!photoNeedsExternalization(photo))return photo;
  const key=`photo:${photo.id}`;
  const stored=await putPhotoAsset(key,photo.dataUrl);
  if(!stored)return photo;
  const preview=await createPhotoPreview(photo.dataUrl);
  return {...photo,dataUrl:preview,assetKey:key,fullResolutionStored:true};
}

export async function resolveFullPhoto(photo:JournalPhoto){
  const stored=await getPhotoAsset(photo.assetKey);
  return stored||photo.dataUrl;
}

export async function externalizeTankPhotos(tank:Tank):Promise<Tank>{
  if(!tank.photos.some(photoNeedsExternalization))return tank;
  const photos:JournalPhoto[]=[];
  for(const photo of tank.photos)photos.push(await externalizePhoto(photo));
  return {...tank,photos};
}

export async function externalizeAllTankPhotos(tanks:Tank[]){
  const out:Tank[]=[];
  for(const tank of tanks)out.push(await externalizeTankPhotos(tank));
  return out;
}

/**
 * JSON backup remains a full recovery artifact: full photo payloads are pulled
 * back from IndexedDB only while exporting, while normal app state keeps small
 * previews so multi-year journals do not exhaust localStorage.
 */
export async function hydrateTankPhotosForBackup(tanks:Tank[]){
  const out:Tank[]=[];
  for(const tank of tanks){
    const photos:JournalPhoto[]=[];
    for(const photo of tank.photos){
      const full=await resolveFullPhoto(photo);
      photos.push({...photo,dataUrl:full});
    }
    out.push({...tank,photos});
  }
  return out;
}
