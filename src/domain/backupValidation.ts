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
  const fields=["equipment","chemistry","maintenance","livestock","inventory","timeline","intelligenceEvents","guidanceActions","healthSnapshots","photos","visionAssessments","feeding","dosing","doserChannels","quarantine","expenses","waterChanges","rodi","rodiServiceEvents","plantCare","acclimationSessions","emergencySessions","filterMedia","livestockExits"];
  return fields.every(key=>tank[key]===undefined||Array.isArray(tank[key]));
}

function validTimestamp(value:unknown){
  return typeof value==="string"&&value.length<=80&&Number.isFinite(new Date(value).getTime());
}
function duplicateId(items:unknown[]){
  const seen=new Set<string>();
  for(const item of items){
    if(!isObject(item)||typeof item.id!=="string"||!item.id)continue;
    if(seen.has(item.id))return item.id;
    seen.add(item.id);
  }
  return null;
}
function nestedDataIssue(tank:Record<string,unknown>){
  const arrays=["equipment","maintenance","livestock","inventory","timeline","photos","visionAssessments","feeding","dosing","doserChannels","quarantine","expenses","waterChanges","rodi","rodiServiceEvents","plantCare","acclimationSessions","emergencySessions","filterMedia","livestockExits"];
  for(const field of arrays){
    const items=(tank[field] as unknown[]|undefined)??[];
    const dup=duplicateId(items);
    if(dup)return `${field} contains duplicate id ${dup}`;
  }

  for(const [i,row] of (((tank.chemistry as unknown[])??[])).entries()){
    if(!isObject(row)||!validTimestamp(row.timestamp)||!isObject(row.values))return `chemistry #${i+1} has an invalid timestamp or values object`;
    for(const [key,value] of Object.entries(row.values)){
      if(value!==null&&value!==undefined&&!finite(value))return `chemistry #${i+1} contains a non-finite value for ${key}`;
    }
  }
  for(const [i,row] of (((tank.inventory as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validText(row.name,300)||!validText(row.unit,40)||!finite(row.quantity)||Number(row.quantity)<0)return `inventory #${i+1} is invalid or has negative stock`;
    if(row.minimum!==undefined&&(!finite(row.minimum)||Number(row.minimum)<0))return `inventory #${i+1} has an invalid minimum`;
  }
  for(const [i,row] of (((tank.livestock as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validText(row.name,300)||!finite(row.quantity)||Number(row.quantity)<=0)return `livestock #${i+1} is invalid`;
  }
  for(const [i,row] of (((tank.dosing as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp))return `dosing #${i+1} is invalid`;
    for(const key of ["amount","ml","perStep"]){
      const value=row[key];
      if(value!==undefined&&(!finite(value)||Number(value)<0))return `dosing #${i+1} has an invalid ${key}`;
    }
  }
  for(const [i,row] of (((tank.waterChanges as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp)||!finite(row.liters)||Number(row.liters)<=0||!finite(row.percent)||Number(row.percent)<=0||Number(row.percent)>100)return `waterChanges #${i+1} is invalid`;
  }
  for(const [i,row] of (((tank.timeline as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp)||(!validText(row.textAr,4000)&&!validText(row.textEn,4000)))return `timeline #${i+1} is invalid`;
  }
  for(const [i,row] of (((tank.equipment as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validText(row.name,300)||!validText(row.kind,80))return `equipment #${i+1} is invalid`;
  }

  for(const [i,row] of (((tank.rodi as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp))return `rodi #${i+1} is invalid`;
    for(const key of ["tdsIn","tdsOut","liters","wasteLiters","productionMinutes","sourcePressurePsi"]){
      const value=row[key];if(value!==undefined&&(!finite(value)||Number(value)<0))return `rodi #${i+1} has an invalid ${key}`;
    }
  }
  for(const [i,row] of (((tank.rodiServiceEvents as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp)||!["sediment","carbon","di"].includes(String(row.component)))return `rodiServiceEvents #${i+1} is invalid`;
  }
  for(const [i,row] of (((tank.plantCare as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp)||!["fertilizer","co2_refill"].includes(String(row.kind)))return `plantCare #${i+1} is invalid`;
  }
  for(const [i,row] of (((tank.expenses as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validText(row.description,500)||!finite(row.amount)||Number(row.amount)<0||!validText(row.currency,20))return `expenses #${i+1} is invalid`;
  }
  for(const [i,row] of (((tank.doserChannels as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validText(row.name,300))return `doserChannels #${i+1} is invalid`;
    for(const key of ["capacityMl","currentMl","consumption"]){const value=row[key];if(value!==undefined&&(!finite(value)||Number(value)<0))return `doserChannels #${i+1} has an invalid ${key}`;}
  }
  for(const [i,row] of (((tank.filterMedia as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validText(row.name,300)||!finite(row.amountGrams)||Number(row.amountGrams)<0)return `filterMedia #${i+1} is invalid`;
  }
  for(const [i,row] of (((tank.photos as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp)||typeof row.dataUrl!=="string")return `photos #${i+1} is invalid`;
    if(row.dataUrl.length>60*1024*1024)return `photos #${i+1} exceeds the per-photo recovery limit`;
  }
  for(const [i,row] of (((tank.acclimationSessions as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.startedAt)||!Array.isArray(row.items)||!Array.isArray(row.events))return `acclimationSessions #${i+1} is invalid`;
    for(const [j,item] of row.items.entries()){
      if(!isObject(item)||!validText(item.id,160)||!validText(item.name,300)||!finite(item.quantity)||Number(item.quantity)<=0)return `acclimationSessions #${i+1} item #${j+1} is invalid`;
      for(const key of ["dripMinutes","intervalMinutes","remainingMs"]){const value=item[key];if(value!==undefined&&(!finite(value)||Number(value)<0))return `acclimationSessions #${i+1} item #${j+1} has an invalid ${key}`;}
    }
  }
  for(const [i,row] of (((tank.maintenance as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validText(row.title,500)||!validText(row.cadence,80))return `maintenance #${i+1} is invalid`;
  }
  for(const [i,row] of (((tank.livestockExits as unknown[])??[])).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp)||!validText(row.name,300)||!finite(row.quantity)||Number(row.quantity)<=0)return `livestockExits #${i+1} is invalid`;
  }
  return null;
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
  const nested=nestedDataIssue(value);
  if(nested)return{ok:false,error:`Tank #${index+1}: ${nested}.`};
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
