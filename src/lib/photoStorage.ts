import type { JournalPhoto,Tank } from "@/domain/types";

const DB_NAME="aqua-nexus-media-v1";
const STORE="photos";

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
  if(!indexedDbAvailable()||!dataUrl)return false;
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

/**
 * Any embedded image payload belongs in IndexedDB, not Zustand/localStorage.
 * This also migrates the older hardening format where the full image had
 * already moved out but a JPEG thumbnail still remained in tank.photos[].dataUrl.
 */
export function photoNeedsExternalization(photo:JournalPhoto){
  return Boolean(photo.dataUrl?.startsWith("data:image/"));
}

export async function externalizePhoto(photo:JournalPhoto):Promise<JournalPhoto>{
  if(!photoNeedsExternalization(photo))return photo;

  const fullKey=photo.assetKey||`photo:${photo.id}:full`;
  const previewKey=photo.previewKey||`photo:${photo.id}:preview`;

  // Imported backups always carry the full image in dataUrl. Older local state
  // may carry only a preview when assetKey already exists; preserve the existing
  // full asset in that case instead of overwriting it with the preview.
  const existingFull=photo.assetKey?await getPhotoAsset(photo.assetKey):null;
  const full=existingFull||photo.dataUrl;
  const fullStored=Boolean(existingFull)||await putPhotoAsset(fullKey,full);
  if(!fullStored)return photo;

  const preview=await createPhotoPreview(photo.dataUrl);
  const previewStored=await putPhotoAsset(previewKey,preview);
  if(!previewStored)return {...photo,assetKey:fullKey,fullResolutionStored:true};

  // No binary/thumbnail payload remains in the persisted Tank JSON.
  return {...photo,dataUrl:"",assetKey:fullKey,previewKey,fullResolutionStored:true};
}

export async function resolveFullPhoto(photo:JournalPhoto){
  const stored=await getPhotoAsset(photo.assetKey);
  return stored||photo.dataUrl;
}

export async function resolvePhotoPreview(photo:JournalPhoto){
  const preview=await getPhotoAsset(photo.previewKey);
  if(preview)return preview;
  if(photo.dataUrl)return photo.dataUrl;
  return await getPhotoAsset(photo.assetKey);
}

export async function externalizeTankPhotos(tank:Tank):Promise<Tank>{
  if(!tank.photos.some(photoNeedsExternalization))return tank;
  const photos:JournalPhoto[]=[];
  for(const photo of tank.photos)photos.push(await externalizePhoto(photo));
  const changed=photos.some((photo,index)=>photo!==tank.photos[index]);
  return changed?{...tank,photos}:tank;
}

export async function externalizeAllTankPhotos(tanks:Tank[]){
  const out:Tank[]=[];
  for(const tank of tanks)out.push(await externalizeTankPhotos(tank));
  return out;
}

/**
 * JSON backup remains a full recovery artifact: full photo payloads are pulled
 * from IndexedDB only while exporting. Runtime tank state contains references
 * and metadata, so years of photos do not consume localStorage.
 */
export async function hydrateTankPhotosForBackup(tanks:Tank[]){
  const out:Tank[]=[];
  for(const tank of tanks){
    const photos:JournalPhoto[]=[];
    for(const photo of tank.photos){
      const full=await resolveFullPhoto(photo);
      photos.push({...photo,dataUrl:full||""});
    }
    out.push({...tank,photos});
  }
  return out;
}

export interface PhotoBackupAudit{
  expected:number;
  complete:number;
  missing:Array<{tankId:string;photoId:string;assetKey?:string}>;
}

export async function hydrateTankPhotosForBackupStrict(tanks:Tank[]){
  const out:Tank[]=[],audit:PhotoBackupAudit={expected:0,complete:0,missing:[]};
  for(const tank of tanks){
    const photos:JournalPhoto[]=[];
    for(const photo of tank.photos){
      audit.expected++;
      const full=await resolveFullPhoto(photo);
      if(!full||!full.startsWith("data:image/")){
        audit.missing.push({tankId:tank.id,photoId:photo.id,assetKey:photo.assetKey});
        photos.push({...photo,dataUrl:""});
        continue;
      }
      audit.complete++;
      photos.push({...photo,dataUrl:full});
    }
    out.push({...tank,photos});
  }
  if(audit.missing.length){
    const error=new Error(`Recovery backup is incomplete: ${audit.missing.length} photo asset(s) are unavailable.`) as Error&{audit?:PhotoBackupAudit};
    error.audit=audit;throw error;
  }
  return{tanks:out,audit};
}
