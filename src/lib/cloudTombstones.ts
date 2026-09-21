const KEY="aqua-nexus-cloud-delete-tombstones-v1";

function read(){
  if(typeof window==="undefined")return [] as string[];
  try{
    const value=JSON.parse(localStorage.getItem(KEY)||"[]");
    return Array.isArray(value)?value.filter(x=>typeof x==="string"&&x):[];
  }catch{return [];}
}
function write(ids:string[]){
  if(typeof window==="undefined")return;
  try{localStorage.setItem(KEY,JSON.stringify([...new Set(ids)]));}catch{}
}

export function recordCloudDeleteTombstone(tankId:string){
  if(!tankId)return;
  write([...read(),tankId]);
}
export function cloudDeleteTombstones(){return read();}
export function clearCloudDeleteTombstone(tankId:string){write(read().filter(x=>x!==tankId));}
