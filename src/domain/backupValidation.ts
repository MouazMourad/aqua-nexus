import type { Language,Tank } from "./types";

export const CURRENT_BACKUP_SCHEMA=10;

export interface ValidBackupPayload{
  language:Language;
  selectedTankId:string;
  tanks:Tank[];
}

export type BackupValidationResult=
 |{ok:true;data:ValidBackupPayload}
 |{ok:false;error:string};

const MAX_TANKS=100;
const MAX_TEXT=500;

function isObject(value:unknown):value is Record<string,unknown>{
  return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
}
function finite(value:unknown){
  return typeof value==="number"&&Number.isFinite(value);
}
function validText(value:unknown,max=MAX_TEXT){
  return typeof value==="string"&&value.trim().length>0&&value.length<=max;
}
function validDimensions(value:unknown){
  if(!isObject(value))return false;
  return finite(value.length)&&finite(value.width)&&finite(value.height)
    && Number(value.length)>0&&Number(value.width)>0&&Number(value.height)>0;
}
function arraysAreArrays(tank:Record<string,unknown>){
  const fields=["equipment","chemistry","maintenance","livestock","inventory","timeline","photos","visionAssessments","feeding","dosing","doserChannels","quarantine","expenses","waterChanges","rodi","rodiServiceEvents","plantCare","acclimationSessions","emergencySessions","filterMedia","livestockExits"];
  return fields.every(key=>tank[key]===undefined||Array.isArray(tank[key]));
}

export function validateTankShape(value:unknown,index=0):{ok:true;tank:Tank}|{ok:false;error:string}{
  if(!isObject(value))return{ok:false,error:`Tank #${index+1} is not an object.`};
  if(!validText(value.id,160))return{ok:false,error:`Tank #${index+1} has an invalid id.`};
  if(!validText(value.name,200))return{ok:false,error:`Tank #${index+1} has an invalid name.`};
  if(value.type!=="marine"&&value.type!=="freshwater")return{ok:false,error:`Tank #${index+1} has an invalid type.`};
  if(!isObject(value.display)||!validDimensions(value.display))return{ok:false,error:`Tank #${index+1} has invalid display dimensions.`};
  if(!isObject(value.sump)||!isObject(value.sump.dimensions)||!validDimensions(value.sump.dimensions)||!Array.isArray(value.sump.chambers))return{ok:false,error:`Tank #${index+1} has invalid sump data.`};
  if(!finite(value.systemVolumeLiters)||Number(value.systemVolumeLiters)<=0)return{ok:false,error:`Tank #${index+1} has an invalid system volume.`};
  if(!arraysAreArrays(value))return{ok:false,error:`Tank #${index+1} contains an invalid collection field.`};
  return{ok:true,tank:value as unknown as Tank};
}

export function validateBackupPayload(input:unknown):BackupValidationResult{
  if(!isObject(input))return{ok:false,error:"Backup root must be an object."};
  if(typeof input.schemaVersion==="number"&&input.schemaVersion>CURRENT_BACKUP_SCHEMA)return{ok:false,error:`Backup schema ${input.schemaVersion} is newer than this Aqua Nexus build supports (${CURRENT_BACKUP_SCHEMA}). Update Aqua Nexus before restoring it.`};
  if(!Array.isArray(input.tanks))return{ok:false,error:"Backup must contain a tanks array."};
  if(input.tanks.length>MAX_TANKS)return{ok:false,error:`Backup contains more than ${MAX_TANKS} tanks.`};
  const ids=new Set<string>();
  const tanks:Tank[]=[];
  for(let i=0;i<input.tanks.length;i++){
    const result=validateTankShape(input.tanks[i],i);
    if(!result.ok)return result;
    if(ids.has(result.tank.id))return{ok:false,error:`Duplicate tank id: ${result.tank.id}`};
    ids.add(result.tank.id);
    tanks.push(result.tank);
  }
  const language:Language=input.language==="en"?"en":"ar";
  const selected=typeof input.selectedTankId==="string"&&ids.has(input.selectedTankId)?input.selectedTankId:(tanks[0]?.id??"");
  return{ok:true,data:{language,selectedTankId:selected,tanks}};
}

export function validateTankImportPayload(input:unknown):{ok:true;tanks:Tank[]}|{ok:false;error:string}{
  if(!isObject(input)||!Array.isArray(input.tanks))return{ok:false,error:"tanks array is required"};
  if(input.tanks.length>MAX_TANKS)return{ok:false,error:`Maximum ${MAX_TANKS} tanks per import.`};
  const ids=new Set<string>(),tanks:Tank[]=[];
  for(let i=0;i<input.tanks.length;i++){
    const result=validateTankShape(input.tanks[i],i);
    if(!result.ok)return result;
    if(ids.has(result.tank.id))return{ok:false,error:`Duplicate tank id: ${result.tank.id}`};
    ids.add(result.tank.id);tanks.push(result.tank);
  }
  return{ok:true,tanks};
}
