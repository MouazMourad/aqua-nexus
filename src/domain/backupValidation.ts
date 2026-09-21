import type { AquariumExperienceLevel,Language,Tank } from "./types";
import { validateChemistryValues } from "./chemistryDataQuality";

export const CURRENT_BACKUP_SCHEMA=15;

export interface ValidBackupPayload{
  language:Language;
  aquariumExperience:AquariumExperienceLevel;
  selectedTankId:string;
  tanks:Tank[];
}

export type BackupValidationResult=
 |{ok:true;data:ValidBackupPayload}
 |{ok:false;error:string};

const MAX_TANKS=100;
const MAX_TEXT=500;
const MAX_ROWS_PER_COLLECTION=250_000;

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
  const fields=["equipment","chemistry","maintenance","livestock","inventory","timeline","intelligenceEvents","guidanceActions","healthSnapshots","photos","visionAssessments","feeding","dosing","doserChannels","quarantine","expenses","waterChanges","rodi","rodiServiceEvents","plantCare","acclimationSessions","emergencySessions","filterMedia","livestockExits","aiActionPlans"];
  return fields.every(key=>tank[key]===undefined||(Array.isArray(tank[key])&&(tank[key] as unknown[]).length<=MAX_ROWS_PER_COLLECTION));
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
    if(row.lightingDepthCm!==undefined&&(!finite(row.lightingDepthCm)||Number(row.lightingDepthCm)<0||Number(row.lightingDepthCm)>Number((tank.display as Record<string,unknown>).height)))return `livestock #${i+1} has invalid lightingDepthCm`;
    for(const key of ["lightingXPct","lightingZPct"]){const value=row[key];if(value!==undefined&&(!finite(value)||Number(value)<0||Number(value)>100))return `livestock #${i+1} has invalid ${key}`;}
    if(row.lightingExposure!==undefined&&!["open","partialShade","shade"].includes(String(row.lightingExposure)))return `livestock #${i+1} has invalid lightingExposure`;
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
    for(const key of ["powerWatts","parAtTargetDepth","mountingHeightCm","parReferenceDepthCm","coverageLengthCm","coverageWidthCm"]){
      const value=row[key];
      if(value!==undefined&&(!finite(value)||Number(value)<0))return `equipment #${i+1} has invalid ${key}`;
    }
    if(row.mountingHeightCm!==undefined&&Number(row.mountingHeightCm)>150)return `equipment #${i+1} has mountingHeightCm above 150`;
    if(row.parAtTargetDepth!==undefined&&Number(row.parAtTargetDepth)>5000)return `equipment #${i+1} has implausible parAtTargetDepth`;
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
    if(finite(row.capacityMl)&&finite(row.currentMl)&&Number(row.currentMl)>Number(row.capacityMl))return `doserChannels #${i+1} has current volume above capacity`;
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

  if(tank.lighting!==undefined){
    if(!isObject(tank.lighting))return "lighting must be an object";
    const lighting=tank.lighting as Record<string,unknown>;
    if(lighting.mapDepthPct!==undefined&&(!finite(lighting.mapDepthPct)||Number(lighting.mapDepthPct)<0||Number(lighting.mapDepthPct)>100))return "lighting.mapDepthPct is invalid";
    if(lighting.manualCalibrationFactor!==undefined&&(!finite(lighting.manualCalibrationFactor)||Number(lighting.manualCalibrationFactor)<=0||Number(lighting.manualCalibrationFactor)>4))return "lighting.manualCalibrationFactor is invalid";
    if(lighting.calibrationPoints!==undefined){
      if(!Array.isArray(lighting.calibrationPoints)||lighting.calibrationPoints.length>1000)return "lighting.calibrationPoints is invalid";
      for(const [i,row] of lighting.calibrationPoints.entries()){
        if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp)||!finite(row.xPct)||!finite(row.zPct)||!finite(row.depthPct)||!finite(row.measuredPar))return `lighting.calibrationPoints #${i+1} is invalid`;
        if(Number(row.xPct)<0||Number(row.xPct)>100||Number(row.zPct)<0||Number(row.zPct)>100||Number(row.depthPct)<0||Number(row.depthPct)>100||Number(row.measuredPar)<=0||Number(row.measuredPar)>5000)return `lighting.calibrationPoints #${i+1} is out of range`;
        if(row.minute!==undefined&&(!finite(row.minute)||Number(row.minute)<0||Number(row.minute)>1439))return `lighting.calibrationPoints #${i+1} has invalid minute`;
      }
    }
    const program=lighting.activeProgram;
    if(program!==undefined){
      if(!isObject(program)||!validText(program.id,160)||!validText(program.name,300)||!validTimestamp(program.createdAt)||!validTimestamp(program.updatedAt)||!Array.isArray(program.channels)||!Array.isArray(program.points))return "lighting.activeProgram is invalid";
      if(program.channels.length<1||program.channels.length>32||program.points.length<2||program.points.length>288)return "lighting.activeProgram has an invalid channel/time-point count";
      const channelIds=new Set<string>();
      for(const [i,ch] of program.channels.entries()){
        if(!isObject(ch)||!validText(ch.id,160)||!validText(ch.name,200)||!finite(ch.parWeight)||Number(ch.parWeight)<0||Number(ch.parWeight)>2||typeof ch.enabled!=="boolean")return `lighting channel #${i+1} is invalid`;
        if(channelIds.has(String(ch.id)))return `lighting contains duplicate channel id ${String(ch.id)}`;
        channelIds.add(String(ch.id));
      }
      for(const [i,row] of program.points.entries()){
        if(!isObject(row)||!validText(row.id,160)||!finite(row.minute)||Number(row.minute)<0||Number(row.minute)>1439||!isObject(row.values))return `lighting point #${i+1} is invalid`;
        for(const id of channelIds){
          const value=row.values[id];
          if(value!==undefined&&(!finite(value)||Number(value)<0||Number(value)>100))return `lighting point #${i+1} has an invalid channel value`;
        }
      }
    }
    if(lighting.history!==undefined&&(!Array.isArray(lighting.history)||lighting.history.length>100))return "lighting.history is invalid";
    if(lighting.imports!==undefined){
      if(!Array.isArray(lighting.imports)||lighting.imports.length>100)return "lighting.imports is invalid";
      for(const [i,row] of lighting.imports.entries()){
        if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.importedAt)||!validText(row.sourceCompany,80)||!validText(row.fileName,500)||!validText(row.fileType,120)||!finite(row.fileSize)||Number(row.fileSize)<0)return `lighting.imports #${i+1} is invalid`;
        if(!["parsed","analyzed","metadata-only","unsupported"].includes(String(row.status)))return `lighting.imports #${i+1} has invalid status`;
        if(row.analysisMode!==undefined&&!["structured-file","ai-text","ai-image"].includes(String(row.analysisMode)))return `lighting.imports #${i+1} has invalid analysisMode`;
        if(row.confidence!==undefined&&(!finite(row.confidence)||Number(row.confidence)<0||Number(row.confidence)>100))return `lighting.imports #${i+1} has invalid confidence`;
        if(row.warnings!==undefined&&(!Array.isArray(row.warnings)||row.warnings.length>50||row.warnings.some(x=>typeof x!=="string"||x.length>1000)))return `lighting.imports #${i+1} has invalid warnings`;
        for(const key of ["detectedChannels","detectedPoints"]){const value=row[key];if(value!==undefined&&(!finite(value)||Number(value)<0||Number(value)>10000))return `lighting.imports #${i+1} has invalid ${key}`;}
      }
    }
  }

  if(tank.lifecycle!==undefined){
    if(!isObject(tank.lifecycle))return "lifecycle must be an object";
    const lifecycle=tank.lifecycle as Record<string,unknown>;
    for(const key of ["vacations","relocations","restarts"])if(lifecycle[key]!==undefined&&!Array.isArray(lifecycle[key]))return `lifecycle.${key} must be an array`;
    if(lifecycle.archivedAt!==undefined&&!validTimestamp(lifecycle.archivedAt))return "lifecycle archivedAt is invalid";
    for(const [i,row] of (((lifecycle.vacations as unknown[])??[])).entries()){
      if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.startedAt))return `lifecycle.vacations #${i+1} is invalid`;
      if(row.plannedEndAt!==undefined&&!validTimestamp(row.plannedEndAt)&&!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(row.plannedEndAt)))return `lifecycle.vacations #${i+1} has invalid plannedEndAt`;
      if(row.endedAt!==undefined&&!validTimestamp(row.endedAt))return `lifecycle.vacations #${i+1} has invalid endedAt`;
      const startAt=new Date(String(row.startedAt)).getTime(),planned=row.plannedEndAt?new Date(String(row.plannedEndAt)).getTime():null,ended=row.endedAt?new Date(String(row.endedAt)).getTime():null;
      if(planned!==null&&Number.isFinite(planned)&&planned<startAt)return `lifecycle.vacations #${i+1} ends before it starts`;
      if(ended!==null&&Number.isFinite(ended)&&ended<startAt)return `lifecycle.vacations #${i+1} endedAt precedes startedAt`;
    }
    for(const [i,row] of (((lifecycle.relocations as unknown[])??[])).entries()){
      if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.startedAt)||!["planned","in_progress","completed"].includes(String(row.status)))return `lifecycle.relocations #${i+1} is invalid`;
      if(row.completedAt!==undefined&&!validTimestamp(row.completedAt))return `lifecycle.relocations #${i+1} has invalid completedAt`;
      if(row.completedAt!==undefined&&new Date(String(row.completedAt)).getTime()<new Date(String(row.startedAt)).getTime())return `lifecycle.relocations #${i+1} completed before it started`;
    }
    for(const [i,row] of (((lifecycle.restarts as unknown[])??[])).entries()){
      if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.timestamp))return `lifecycle.restarts #${i+1} is invalid`;
    }
  }
  for(const [i,row] of ((((tank.aiActionPlans as unknown[])??[]))).entries()){
    if(!isObject(row)||!validText(row.id,160)||!validTimestamp(row.createdAt)||!Array.isArray(row.steps))return `aiActionPlans #${i+1} is invalid`;
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
  const candidate=value as unknown as Tank;
  for(const [readingIndex,reading] of candidate.chemistry.entries()){
    const chemistryIssues=validateChemistryValues(candidate,reading.values);
    if(chemistryIssues.length)return{ok:false,error:`Tank #${index+1}: chemistry #${readingIndex+1}: ${chemistryIssues[0].en}`};
  }
  return{ok:true,tank:candidate};
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
  const aquariumExperience:AquariumExperienceLevel=["beginner","intermediate","advanced"].includes(String(input.aquariumExperience))
    ? input.aquariumExperience as AquariumExperienceLevel
    : "beginner";
  const selected=typeof input.selectedTankId==="string"&&ids.has(input.selectedTankId)?input.selectedTankId:(tanks[0]?.id??"");
  return{ok:true,data:{language,aquariumExperience,selectedTankId:selected,tanks}};
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
