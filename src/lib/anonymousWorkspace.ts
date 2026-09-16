export const AQUA_DEVICE_ID_KEY="aqua-nexus-device-id";

export function getAquaDeviceId(){
  if(typeof window==="undefined")return "";
  let id=localStorage.getItem(AQUA_DEVICE_ID_KEY);
  if(!id){
    const random=crypto.randomUUID?.()??Math.random().toString(36).slice(2);
    id=`device-${random}-${Date.now()}`;
    localStorage.setItem(AQUA_DEVICE_ID_KEY,id);
  }
  return id;
}

export function aquaWorkspaceHeaders(extra:Record<string,string>={}){
  return {...extra,"x-aqua-device-id":getAquaDeviceId()};
}
