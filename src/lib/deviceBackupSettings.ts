const KEY="aqua-nexus-device-backup-enabled-v1";
const EVENT="aqua:device-backup-setting";

export function deviceBackupEnabled(){
  if(typeof window==="undefined")return false;
  try{return localStorage.getItem(KEY)==="1"}catch{return false}
}
export function setDeviceBackupEnabled(enabled:boolean){
  if(typeof window==="undefined")return;
  try{
    if(enabled)localStorage.setItem(KEY,"1"); else localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(EVENT,{detail:enabled}));
  }catch{}
}
export function subscribeDeviceBackupSetting(listener:(enabled:boolean)=>void){
  if(typeof window==="undefined")return()=>{};
  const fn=(e:Event)=>listener(Boolean((e as CustomEvent<boolean>).detail));
  window.addEventListener(EVENT,fn);
  return()=>window.removeEventListener(EVENT,fn);
}
