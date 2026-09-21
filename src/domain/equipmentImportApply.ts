import type {
  ChemistryReading,DeviceTelemetryLog,DosingLog,Equipment,ExternalDeviceAlert,ExternalImportRecord,ExternalImportVendor,Tank,TopOffLog
} from "./types";
import { autoMatchImportedDevice,type EquipmentImportCandidate } from "./equipmentImport";
import { createDefaultConsumables } from "./equipmentLifecycle";
import { validateChemistryValues } from "./chemistryDataQuality";

export interface EquipmentImportApplyMeta{
  importId:string;
  importedAt:string;
  vendor:ExternalImportVendor;
  sourceName:string;
  sourceType:ExternalImportRecord["sourceType"];
  fingerprint:string;
  analysisMode:ExternalImportRecord["analysisMode"];
}

export interface EquipmentImportArchiveOverflow{
  chemistry:ChemistryReading[];
  dosing:DosingLog[];
  deviceTelemetry:DeviceTelemetryLog[];
  topOff:TopOffLog[];
  deviceAlerts:ExternalDeviceAlert[];
}

export interface EquipmentImportApplication{
  tank:Tank;
  importRecord:ExternalImportRecord;
  overflow:EquipmentImportArchiveOverflow;
  skippedDuplicates:number;
  blockedIssues:Array<{ar:string;en:string}>;
}

const HOT_LIMIT={chemistry:2500,dosing:2500,deviceTelemetry:5000,topOff:5000,deviceAlerts:2000};

function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n))}
function norm(value:unknown){
  return String(value??"").trim().toLowerCase().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[^a-z0-9\u0600-\u06ff]+/g,"_");
}
function hash(value:string){
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
}
function stableId(prefix:string,...parts:unknown[]){return prefix+"-"+hash(parts.map(x=>String(x??"")).join("|"))}
function validLocation(value:string):Equipment["location"]{
  return value==="display"||value==="external"||value.startsWith("sump:")?value as Equipment["location"]:"external";
}
function compactDevice(row:any){
  const out:any={};
  for(const key of ["name","kind","brand","model","status","powerWatts","hoursPerDay","ratedVolumeLiters","flowLph"]){
    if(row[key]!==undefined&&row[key]!==null&&row[key]!=="")out[key]=row[key];
  }
  out.location=validLocation(String(row.location||"external"));
  return out;
}
function splitImportedHot<T extends {timestamp:string}>(rows:T[],limit:number){
  const sorted=[...rows].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
  return{hot:sorted.slice(0,limit),overflow:sorted.slice(limit)};
}
function existingRecordKeys(rows:Array<{sourceSystem?:string;sourceRecordId?:string}>,vendor:string){
  return new Set(rows.filter(x=>x.sourceSystem===vendor&&x.sourceRecordId).map(x=>String(x.sourceRecordId)));
}
function deviceIdForName(equipment:Equipment[],name:string|undefined){
  if(!name)return undefined;
  const n=norm(name);
  return equipment.find(x=>norm(x.name)===n||norm(x.model)===n||norm([x.brand,x.model].filter(Boolean).join(" "))===n)?.id;
}

export function prepareEquipmentImportApplication(tank:Tank,candidate:EquipmentImportCandidate,meta:EquipmentImportApplyMeta):EquipmentImportApplication{
  const vendor=meta.vendor;
  let skippedDuplicates=0;
  const blockedIssues:Array<{ar:string;en:string}>=[];
  let equipment=[...tank.equipment];

  for(const row of candidate.devices.filter(x=>x.enabled)){
    const targetId=row.targetEquipmentId||autoMatchImportedDevice({...tank,equipment},row);
    if(targetId){
      equipment=equipment.map(current=>current.id===targetId?{
        ...current,
        ...compactDevice(row),
        id:current.id,
        displayPosition:current.displayPosition,
        overflowReturnPosition:current.overflowReturnPosition,
        sourceSystem:vendor,
        sourceImportId:meta.importId,
        sourceRecordId:row.sourceRecordId
      }:current);
    }else{
      const id=stableId("eq",vendor,row.sourceRecordId??row.key);
      if(equipment.some(x=>x.id===id)){skippedDuplicates++;continue}
      equipment.push({
        id,
        name:row.name,
        kind:row.kind,
        brand:row.brand,
        model:row.model,
        location:validLocation(row.location),
        status:row.status,
        powerWatts:row.powerWatts===undefined?undefined:Math.max(0,row.powerWatts),
        hoursPerDay:row.hoursPerDay===undefined?undefined:clamp(row.hoursPerDay,0,24),
        ratedVolumeLiters:row.ratedVolumeLiters===undefined?undefined:Math.max(0,row.ratedVolumeLiters),
        flowLph:row.flowLph===undefined?undefined:Math.max(0,row.flowLph),
        sourceSystem:vendor,
        sourceImportId:meta.importId,
        sourceRecordId:row.sourceRecordId,
        consumables:createDefaultConsumables(row.kind)
      });
    }
  }

  const chemistryExistingKeys=existingRecordKeys(tank.chemistry,vendor);
  const dosingExistingKeys=existingRecordKeys(tank.dosing,vendor);
  const telemetryExistingKeys=existingRecordKeys(tank.deviceTelemetry??[],vendor);
  const topOffExistingKeys=existingRecordKeys(tank.topOff??[],vendor);
  const alertExistingKeys=existingRecordKeys(tank.deviceAlerts??[],vendor);

  const chemistryGroups=new Map<string,Array<typeof candidate.measurements[number]>>();
  const telemetryImported:DeviceTelemetryLog[]=[];
  for(const row of candidate.measurements.filter(x=>x.enabled)){
    if(row.destination==="chemistry"){
      const key=row.timestamp;
      const group=chemistryGroups.get(key)??[];
      group.push(row);chemistryGroups.set(key,group);
    }else{
      const sourceRecordId=row.sourceRecordId??stableId("telemetry",row.timestamp,row.parameter,row.value,row.deviceName);
      if(telemetryExistingKeys.has(sourceRecordId)){skippedDuplicates++;continue}
      telemetryImported.push({
        id:stableId("telemetry",vendor,sourceRecordId),
        timestamp:row.timestamp,metric:row.parameter,value:row.value,unit:row.unit,
        equipmentId:deviceIdForName(equipment,row.deviceName),sourceDevice:row.deviceName,
        sourceSystem:vendor,sourceImportId:meta.importId,sourceRecordId
      });
    }
  }

  const chemistryImported:ChemistryReading[]=[];
  for(const [timestamp,rows] of chemistryGroups){
    const values:Record<string,number|null>={};
    rows.forEach(row=>{values[row.parameter]=row.value});
    const validation=validateChemistryValues(tank,values);
    if(validation.length){
      blockedIssues.push(...validation.map(x=>({ar:"قراءة مستوردة محجوبة: "+x.ar,en:"Blocked imported reading: "+x.en})));
      continue;
    }
    const sourceRecordId=stableId("chem",vendor,timestamp,...rows.map(x=>String(x.sourceRecordId??x.parameter)+":"+x.value).sort());
    if(chemistryExistingKeys.has(sourceRecordId)){skippedDuplicates++;continue}
    chemistryImported.push({
      timestamp,values,
      notes:"Imported from "+vendor+" • "+meta.sourceName,
      source:"device",
      confidence:candidate.confidence>=80?"high":candidate.confidence>=55?"medium":"low",
      sourceSystem:vendor,sourceImportId:meta.importId,sourceRecordId
    });
  }

  const dosingImported:DosingLog[]=[];
  for(const row of candidate.doses.filter(x=>x.enabled&&x.ml>0)){
    const sourceRecordId=row.sourceRecordId??stableId("dose",row.timestamp,row.parameter,row.ml,row.deviceName);
    if(dosingExistingKeys.has(sourceRecordId)){skippedDuplicates++;continue}
    dosingImported.push({
      id:stableId("dose",vendor,sourceRecordId),timestamp:row.timestamp,parameter:row.parameter,ml:row.ml,
      amount:row.amount,unit:row.unit,material:row.material,status:"logged",
      reason:"Imported from "+vendor+" • "+meta.sourceName,
      sourceSystem:vendor,sourceImportId:meta.importId,sourceRecordId
    });
  }

  const topOffImported:TopOffLog[]=[];
  for(const row of candidate.topOff.filter(x=>x.enabled&&x.liters>0)){
    const sourceRecordId=row.sourceRecordId??stableId("ato",row.timestamp,row.liters,row.deviceName);
    if(topOffExistingKeys.has(sourceRecordId)){skippedDuplicates++;continue}
    topOffImported.push({
      id:stableId("ato",vendor,sourceRecordId),timestamp:row.timestamp,liters:row.liters,
      equipmentId:deviceIdForName(equipment,row.deviceName),sourceSystem:vendor,sourceImportId:meta.importId,sourceRecordId
    });
  }

  const alertsImported:ExternalDeviceAlert[]=[];
  for(const row of candidate.alerts.filter(x=>x.enabled)){
    const sourceRecordId=row.sourceRecordId??stableId("alert",row.timestamp,row.message,row.deviceName);
    if(alertExistingKeys.has(sourceRecordId)){skippedDuplicates++;continue}
    alertsImported.push({
      id:stableId("alert",vendor,sourceRecordId),timestamp:row.timestamp,level:row.level,message:row.message,
      equipmentId:deviceIdForName(equipment,row.deviceName),sourceDevice:row.deviceName,
      sourceSystem:vendor,sourceImportId:meta.importId,sourceRecordId
    });
  }

  const chemSplit=splitImportedHot(chemistryImported,HOT_LIMIT.chemistry);
  const doseSplit=splitImportedHot(dosingImported,HOT_LIMIT.dosing);
  const telemetrySplit=splitImportedHot(telemetryImported,HOT_LIMIT.deviceTelemetry);
  const topSplit=splitImportedHot(topOffImported,HOT_LIMIT.topOff);
  const alertSplit=splitImportedHot(alertsImported,HOT_LIMIT.deviceAlerts);

  const counts={
    equipment:candidate.devices.filter(x=>x.enabled).length,
    chemistry:chemistryImported.length,
    dosing:dosingImported.length,
    topOff:topOffImported.length,
    telemetry:telemetryImported.length,
    alerts:alertsImported.length
  };
  const importRecord:ExternalImportRecord={
    id:meta.importId,importedAt:meta.importedAt,vendor,sourceName:meta.sourceName,sourceType:meta.sourceType,
    fingerprint:meta.fingerprint,analysisMode:meta.analysisMode,confidence:candidate.confidence,
    status:"applied",counts,warnings:candidate.warnings
  };
  const alertTimeline=alertsImported.filter(x=>x.level!=="info").slice(0,20).map(x=>({
    id:stableId("ev",meta.importId,x.id),timestamp:x.timestamp,type:"device-alert-import",
    textAr:"تنبيه مستورد من "+vendor+(x.sourceDevice?" • "+x.sourceDevice:"")+": "+x.message,
    textEn:"Imported device alert from "+vendor+(x.sourceDevice?" • "+x.sourceDevice:"")+": "+x.message
  }));
  const summary={
    id:stableId("ev",meta.importId,"summary"),timestamp:meta.importedAt,type:"equipment-import",
    textAr:"تم اعتماد استيراد "+meta.sourceName+" من "+vendor+": "+counts.equipment+" جهاز، "+counts.chemistry+" قراءة كيمياء، "+counts.telemetry+" Telemetry، "+counts.dosing+" جرعة، "+counts.topOff+" تعويض ماء، "+counts.alerts+" تنبيه.",
    textEn:"Applied "+meta.sourceName+" import from "+vendor+": "+counts.equipment+" equipment, "+counts.chemistry+" chemistry, "+counts.telemetry+" telemetry, "+counts.dosing+" dosing, "+counts.topOff+" top-off and "+counts.alerts+" alert record(s)."
  };

  const next:Tank={
    ...tank,equipment,
    externalImports:[importRecord,...(tank.externalImports??[])].slice(0,100),
    chemistry:[...chemSplit.hot,...tank.chemistry].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
    dosing:[...doseSplit.hot,...tank.dosing].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
    deviceTelemetry:[...telemetrySplit.hot,...(tank.deviceTelemetry??[])].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
    topOff:[...topSplit.hot,...(tank.topOff??[])].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
    deviceAlerts:[...alertSplit.hot,...(tank.deviceAlerts??[])].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
    timeline:[summary,...alertTimeline,...tank.timeline]
  };

  return{
    tank:next,importRecord,skippedDuplicates,blockedIssues,
    overflow:{
      chemistry:chemSplit.overflow,dosing:doseSplit.overflow,deviceTelemetry:telemetrySplit.overflow,
      topOff:topSplit.overflow,deviceAlerts:alertSplit.overflow
    }
  };
}
