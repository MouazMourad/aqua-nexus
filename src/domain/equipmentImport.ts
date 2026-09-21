import type { EquipmentKind,ExternalImportVendor,Tank } from "./types";

export type EquipmentImportSourceKind="image"|"text"|"structured";
export type EquipmentImportDestination="chemistry"|"telemetry";

export interface EquipmentImportDeviceCandidate{
  key:string;
  sourceRecordId?:string;
  enabled:boolean;
  targetEquipmentId?:string;
  name:string;
  kind:EquipmentKind;
  brand?:string;
  model?:string;
  location:string;
  status:"on"|"off"|"service"|"warning";
  powerWatts?:number;
  hoursPerDay?:number;
  ratedVolumeLiters?:number;
  flowLph?:number;
}

export interface EquipmentImportMeasurementCandidate{
  key:string;
  sourceRecordId?:string;
  enabled:boolean;
  timestamp:string;
  parameter:string;
  value:number;
  unit?:string;
  deviceName?:string;
  destination:EquipmentImportDestination;
}

export interface EquipmentImportDoseCandidate{
  key:string;
  sourceRecordId?:string;
  enabled:boolean;
  timestamp:string;
  parameter:string;
  ml:number;
  amount?:number;
  unit?:string;
  material?:string;
  deviceName?:string;
}

export interface EquipmentImportTopOffCandidate{
  key:string;
  sourceRecordId?:string;
  enabled:boolean;
  timestamp:string;
  liters:number;
  deviceName?:string;
}

export interface EquipmentImportAlertCandidate{
  key:string;
  sourceRecordId?:string;
  enabled:boolean;
  timestamp:string;
  level:"info"|"warn"|"danger";
  message:string;
  deviceName?:string;
}

export interface EquipmentImportCandidate{
  sourceKind:EquipmentImportSourceKind;
  confidence:number;
  vendorDetected?:string;
  devices:EquipmentImportDeviceCandidate[];
  measurements:EquipmentImportMeasurementCandidate[];
  doses:EquipmentImportDoseCandidate[];
  topOff:EquipmentImportTopOffCandidate[];
  alerts:EquipmentImportAlertCandidate[];
  warnings:string[];
  evidence:string[];
}

export interface EquipmentImportIntelligence{
  latestImport?:NonNullable<Tank["externalImports"]>[number];
  unacknowledgedAlerts:number;
  dangerAlerts:number;
  recentTelemetry:number;
  recentTopOffLiters:number;
  recentImportedChemistry:number;
  issues:Array<{id:string;level:"info"|"warn"|"danger";ar:string;en:string}>;
}

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const equipmentKinds=new Set<EquipmentKind>([
  "lighting","waveMaker","skimmer","returnPump","filterSock","rollerFilter","reactor","heater","doser","uv","ozone",
  "ato","refugiumLight","turfScrubber","probe","overflow","co2","other"
]);

const chemistryAliases:Record<string,string>={
  ph:"pH",temperature:"temperature",temp:"temperature",water_temperature:"temperature",
  salinity:"salinity",specific_gravity:"salinity",sg:"salinity",
  kh:"KH",alk:"KH",alkalinity:"KH",dkh:"KH",
  calcium:"Ca",ca:"Ca",magnesium:"Mg",mg:"Mg",
  nitrate:"NO3",no3:"NO3",nitrite:"NO2",no2:"NO2",
  phosphate:"PO4",po4:"PO4",ammonia:"NH3",nh3:"NH3",
  gh:"GH",tds:"TDS",orp:"ORP"
};

function norm(value:unknown){
  return String(value??"").trim().toLowerCase().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[^a-z0-9\u0600-\u06ff]+/g,"_").replace(/^_+|_+$/g,"");
}
function finite(value:unknown){
  const n=typeof value==="number"?value:Number(String(value??"").replace(",","."));
  return Number.isFinite(n)?n:null;
}
function safeTimestamp(value:unknown){
  const raw=String(value??"").trim();
  if(!raw)return new Date().toISOString();
  const ms=new Date(raw).getTime();
  return Number.isFinite(ms)?new Date(ms).toISOString():new Date().toISOString();
}
function keyHash(value:string){
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
}
function recordKey(prefix:string,...parts:unknown[]){return prefix+"-"+keyHash(parts.map(x=>String(x??"")).join("|"))}
function equipmentKind(value:unknown):EquipmentKind{
  const n=norm(value);
  if(equipmentKinds.has(n as EquipmentKind))return n as EquipmentKind;
  if(/light|led|lamp|انار|اضاء/.test(n))return"lighting";
  if(/wave|wavemaker|gyre|powerhead|موج/.test(n))return"waveMaker";
  if(/skimmer|protein/.test(n))return"skimmer";
  if(/return|main_pump|مضخه_رفع|مضخة_رفع/.test(n))return"returnPump";
  if(/heater|heat|سخان/.test(n))return"heater";
  if(/doser|dose|جرع/.test(n))return"doser";
  if(/ato|top.?off|تعويض/.test(n))return"ato";
  if(/probe|sensor|monitor|حساس/.test(n))return"probe";
  if(/reactor/.test(n))return"reactor";
  if(/roller/.test(n))return"rollerFilter";
  if(/sock/.test(n))return"filterSock";
  if(/overflow/.test(n))return"overflow";
  if(/^uv$|ultraviolet/.test(n))return"uv";
  if(/ozone|o3/.test(n))return"ozone";
  if(/co2/.test(n))return"co2";
  return"other";
}
export function canonicalChemistryParameter(value:unknown){
  const n=norm(value);
  return chemistryAliases[n]??null;
}
function plausibleChemistry(parameter:string,value:number){
  const ranges:Record<string,[number,number]>={
    pH:[4,10],temperature:[0,45],salinity:[0.95,1.08],KH:[0,30],Ca:[0,1000],Mg:[0,2500],
    NO3:[0,1000],NO2:[0,100],PO4:[0,50],NH3:[0,50],GH:[0,50],TDS:[0,5000],ORP:[-1000,1000]
  };
  const r=ranges[parameter];return Boolean(r&&value>=r[0]&&value<=r[1]);
}
function alertLevel(value:unknown,message:string):"info"|"warn"|"danger"{
  const n=norm(String(value??"")+" "+message);
  if(/critical|danger|emergency|fatal|alarm|overheat|leak|dry_run|خطر|حرج|تسريب/.test(n))return"danger";
  if(/warn|warning|fault|error|offline|low|high|تنبيه|عطل/.test(n))return"warn";
  return"info";
}
function stripFence(value:string){
  const ticks=String.fromCharCode(96,96,96);let clean=value.trim();
  if(clean.startsWith(ticks))clean=clean.replace(new RegExp("^"+ticks+"(?:json)?\\s*","i"),"");
  if(clean.endsWith(ticks))clean=clean.slice(0,-3).trim();
  const start=clean.indexOf("{"),end=clean.lastIndexOf("}");
  return start>=0&&end>start?clean.slice(start,end+1):clean;
}

export function normalizeEquipmentImportCandidate(raw:unknown,sourceKind:EquipmentImportSourceKind):{ok:true;candidate:EquipmentImportCandidate}|{ok:false;error:string}{
  let obj:any=raw;
  if(typeof raw==="string"){
    try{obj=JSON.parse(stripFence(raw))}catch{return{ok:false,error:"Import analysis did not contain valid JSON"}}
  }
  if(!obj||typeof obj!=="object")return{ok:false,error:"Import analysis is not an object"};
  const confidence=clamp(finite(obj.confidence)??70,0,100);
  const devicesRaw=Array.isArray(obj.devices)?obj.devices:Array.isArray(obj.equipment)?obj.equipment:[];
  const measurementsRaw=Array.isArray(obj.measurements)?obj.measurements:Array.isArray(obj.telemetry)?obj.telemetry:[];
  const dosesRaw=Array.isArray(obj.doses)?obj.doses:Array.isArray(obj.dosing)?obj.dosing:[];
  const topRaw=Array.isArray(obj.topOff)?obj.topOff:Array.isArray(obj.ato)?obj.ato:[];
  const alertsRaw=Array.isArray(obj.alerts)?obj.alerts:[];

  const devices:EquipmentImportDeviceCandidate[]=devicesRaw.slice(0,500).map((x:any,i:number)=>{
    const name=String(x?.name??x?.deviceName??x?.model??("Device "+(i+1))).trim().slice(0,300)||("Device "+(i+1));
    const brand=x?.brand?String(x.brand).slice(0,120):undefined,model=x?.model?String(x.model).slice(0,160):undefined;
    const sourceRecordId=x?.sourceRecordId?String(x.sourceRecordId).slice(0,200):recordKey("dev",name,brand,model,x?.kind);
    const kind=equipmentKind(x?.kind??x?.type??name);
    const statusRaw=norm(x?.status);
    const status:EquipmentImportDeviceCandidate["status"]=statusRaw==="off"?"off":/service|maintenance/.test(statusRaw)?"service":/warn|fault|error/.test(statusRaw)?"warning":"on";
    const locationRaw=String(x?.location??"external");
    const location=(locationRaw==="display"||locationRaw==="external"||locationRaw.startsWith("sump:"))?locationRaw:"external";
    return{
      key:"dev-"+i+"-"+keyHash(sourceRecordId),sourceRecordId,enabled:x?.enabled!==false,name,kind,brand,model,location,status,
      powerWatts:finite(x?.powerWatts)??undefined,hoursPerDay:finite(x?.hoursPerDay)??undefined,
      ratedVolumeLiters:finite(x?.ratedVolumeLiters)??undefined,flowLph:finite(x?.flowLph)??undefined
    };
  });

  const measurements:EquipmentImportMeasurementCandidate[]=measurementsRaw.slice(0,100000).map((x:any,i:number)=>{
    const parameter=String(x?.parameter??x?.metric??x?.name??"metric").trim().slice(0,160)||"metric";
    const value=finite(x?.value)??0,canonical=canonicalChemistryParameter(parameter);
    const timestamp=safeTimestamp(x?.timestamp??x?.time??x?.date);
    const sourceRecordId=x?.sourceRecordId?String(x.sourceRecordId).slice(0,220):recordKey("m",timestamp,parameter,value,x?.deviceName);
    return{
      key:"m-"+i+"-"+keyHash(sourceRecordId),sourceRecordId,enabled:x?.enabled!==false,timestamp,parameter:canonical??parameter,value,
      unit:x?.unit?String(x.unit).slice(0,60):undefined,deviceName:x?.deviceName?String(x.deviceName).slice(0,300):undefined,
      destination:canonical&&plausibleChemistry(canonical,value)?"chemistry":"telemetry"
    };
  }).filter((x:EquipmentImportMeasurementCandidate)=>Number.isFinite(x.value));

  const doses:EquipmentImportDoseCandidate[]=dosesRaw.slice(0,100000).map((x:any,i:number)=>{
    const timestamp=safeTimestamp(x?.timestamp??x?.time??x?.date),parameter=String(x?.parameter??x?.material??x?.name??"dose").slice(0,160);
    const ml=Math.max(0,finite(x?.ml??x?.volumeMl??x?.value)??0);
    const sourceRecordId=x?.sourceRecordId?String(x.sourceRecordId).slice(0,220):recordKey("dose",timestamp,parameter,ml,x?.deviceName);
    return{key:"dose-"+i+"-"+keyHash(sourceRecordId),sourceRecordId,enabled:x?.enabled!==false,timestamp,parameter,ml,
      amount:finite(x?.amount)??undefined,unit:x?.unit?String(x.unit).slice(0,60):undefined,material:x?.material?String(x.material).slice(0,200):undefined,
      deviceName:x?.deviceName?String(x.deviceName).slice(0,300):undefined};
  }).filter((x:EquipmentImportDoseCandidate)=>x.ml>=0);

  const topOff:EquipmentImportTopOffCandidate[]=topRaw.slice(0,100000).map((x:any,i:number)=>{
    const timestamp=safeTimestamp(x?.timestamp??x?.time??x?.date),liters=Math.max(0,finite(x?.liters??x?.volumeLiters??x?.value)??0);
    const sourceRecordId=x?.sourceRecordId?String(x.sourceRecordId).slice(0,220):recordKey("ato",timestamp,liters,x?.deviceName);
    return{key:"ato-"+i+"-"+keyHash(sourceRecordId),sourceRecordId,enabled:x?.enabled!==false,timestamp,liters,deviceName:x?.deviceName?String(x.deviceName).slice(0,300):undefined};
  });

  const alerts:EquipmentImportAlertCandidate[]=alertsRaw.slice(0,10000).map((x:any,i:number)=>{
    const timestamp=safeTimestamp(x?.timestamp??x?.time??x?.date),message=String(x?.message??x?.text??x?.alert??"Device alert").trim().slice(0,4000);
    const sourceRecordId=x?.sourceRecordId?String(x.sourceRecordId).slice(0,220):recordKey("alert",timestamp,message,x?.deviceName);
    return{key:"alert-"+i+"-"+keyHash(sourceRecordId),sourceRecordId,enabled:x?.enabled!==false,timestamp,level:alertLevel(x?.level??x?.severity,message),message,deviceName:x?.deviceName?String(x.deviceName).slice(0,300):undefined};
  });

  if(!devices.length&&!measurements.length&&!doses.length&&!topOff.length&&!alerts.length)return{ok:false,error:"No usable equipment, measurement, dosing, top-off or alert records were detected"};
  return{ok:true,candidate:{
    sourceKind,confidence,vendorDetected:obj.vendorDetected?String(obj.vendorDetected).slice(0,160):undefined,
    devices,measurements,doses,topOff,alerts,
    warnings:Array.isArray(obj.warnings)?obj.warnings.slice(0,50).map((x:any)=>String(x).slice(0,1000)):[],
    evidence:Array.isArray(obj.evidence)?obj.evidence.slice(0,50).map((x:any)=>String(x).slice(0,1000)):[]
  }};
}

function rowObject(headers:string[],cells:string[]){
  return Object.fromEntries(headers.map((h,i)=>[h,cells[i]??""]));
}
function splitDelimited(text:string){
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length<2)return null;
  const delimiter=lines[0].includes("\t")?"\t":lines[0].includes(";")?";":",";
  const headers=lines[0].split(delimiter).map(x=>x.trim().replace(/^["']|["']$/g,""));
  const rows=lines.slice(1,100001).map(line=>rowObject(headers,line.split(delimiter).map(x=>x.trim().replace(/^["']|["']$/g,""))));
  return{headers,rows};
}
function firstValue(row:Record<string,unknown>,patterns:RegExp[]){
  const key=Object.keys(row).find(k=>patterns.some(p=>p.test(norm(k))));
  return key?row[key]:undefined;
}

function candidateFromRows(rows:Array<Record<string,unknown>>,vendor?:string):EquipmentImportCandidate|null{
  if(!rows.length)return null;
  const devices:any[]=[],measurements:any[]=[],doses:any[]=[],topOff:any[]=[],alerts:any[]=[];
  for(const row of rows){
    const timestamp=firstValue(row,[/^timestamp$/, /^time$/, /^date_time$/, /^datetime$/, /^date$/, /^وقت$/, /^تاريخ$/]);
    const deviceName=firstValue(row,[/^device$/, /^device_name$/, /^equipment$/, /^equipment_name$/, /^name$/, /^جهاز$/]);
    const type=firstValue(row,[/^kind$/, /^type$/, /^device_type$/, /^equipment_type$/]);
    const brand=firstValue(row,[/^brand$/, /^manufacturer$/]),model=firstValue(row,[/^model$/]);
    const power=firstValue(row,[/^power_watts$/, /^watts$/, /^watt$/, /^power$/]),flow=firstValue(row,[/^flow_lph$/, /^flow$/, /^lph$/]);
    const rated=firstValue(row,[/^rated_volume_liters$/, /^rated_volume$/, /^capacity_liters$/]);
    if(deviceName&&(type||brand||model||power||flow||rated)){
      devices.push({name:deviceName,kind:type??deviceName,brand,model,powerWatts:power,flowLph:flow,ratedVolumeLiters:rated,sourceRecordId:firstValue(row,[/^id$/, /^device_id$/])});
    }

    const metric=firstValue(row,[/^metric$/, /^parameter$/, /^sensor$/, /^reading_name$/]);
    const value=firstValue(row,[/^value$/, /^reading$/, /^measurement$/]),unit=firstValue(row,[/^unit$/, /^units$/]);
    if(metric!==undefined&&value!==undefined)measurements.push({timestamp,parameter:metric,value,unit,deviceName});
    else{
      for(const [key,val] of Object.entries(row)){
        const canonical=canonicalChemistryParameter(key);
        if(canonical&&finite(val)!==null)measurements.push({timestamp,parameter:canonical,value:val,unit:"",deviceName});
      }
    }

    const top=firstValue(row,[/^topoff_liters$/, /^top_off_liters$/, /^ato_liters$/, /^topoff$/, /^ato_volume$/]);
    if(top!==undefined&&finite(top)!==null)topOff.push({timestamp,liters:top,deviceName});

    const doseMl=firstValue(row,[/^dose_ml$/, /^dosing_ml$/, /^volume_ml$/]);
    const doseParam=firstValue(row,[/^dose_parameter$/, /^dosing_parameter$/, /^material$/, /^additive$/]);
    if(doseMl!==undefined&&finite(doseMl)!==null)doses.push({timestamp,parameter:doseParam??"dose",ml:doseMl,deviceName});

    const alert=firstValue(row,[/^alert$/, /^alarm$/, /^message$/, /^event_message$/]);
    if(alert)alerts.push({timestamp,message:alert,level:firstValue(row,[/^severity$/, /^level$/, /^status$/]),deviceName});
  }
  const normalized=normalizeEquipmentImportCandidate({confidence:100,vendorDetected:vendor,devices,measurements,doses,topOff,alerts,warnings:[],evidence:["Parsed directly from structured export"]},"structured");
  return normalized.ok?normalized.candidate:null;
}

export function parseGenericEquipmentExport(text:string,fileName:string,vendor?:ExternalImportVendor):EquipmentImportCandidate|null{
  const clean=text.trim();if(!clean)return null;
  if(fileName.toLowerCase().endsWith(".json")||clean.startsWith("{")||clean.startsWith("[")){
    try{
      const data=JSON.parse(clean);
      const direct=normalizeEquipmentImportCandidate(data,"structured");
      if(direct.ok)return direct.candidate;
      const rows=Array.isArray(data)?data:Array.isArray(data?.rows)?data.rows:Array.isArray(data?.data)?data.data:null;
      if(rows)return candidateFromRows(rows,vendor);
    }catch{}
  }
  const delimited=splitDelimited(clean);
  return delimited?candidateFromRows(delimited.rows,vendor):null;
}

export function autoMatchImportedDevice(tank:Tank,row:EquipmentImportDeviceCandidate){
  const key=(x:string|undefined)=>norm(x);
  const bySource=tank.equipment.find(x=>row.sourceRecordId&&x.sourceRecordId===row.sourceRecordId);
  if(bySource)return bySource.id;
  const byModel=tank.equipment.find(x=>row.model&&key(x.model)===key(row.model)&&(!row.brand||key(x.brand)===key(row.brand)));
  if(byModel)return byModel.id;
  const byName=tank.equipment.find(x=>key(x.name)===key(row.name)&&x.kind===row.kind);
  return byName?.id;
}

export function equipmentImportIntelligence(tank:Tank):EquipmentImportIntelligence{
  const now=Date.now(),day=86400000,weekAgo=now-7*day;
  const latestImport=tank.externalImports?.[0];
  const alerts=(tank.deviceAlerts??[]).filter(x=>!x.acknowledgedAt);
  const recentTelemetry=(tank.deviceTelemetry??[]).filter(x=>new Date(x.timestamp).getTime()>=now-day).length;
  const recentTopOff=(tank.topOff??[]).filter(x=>new Date(x.timestamp).getTime()>=weekAgo);
  const recentImportedChemistry=tank.chemistry.filter(x=>x.source==="device"&&new Date(x.timestamp).getTime()>=weekAgo).length;
  const issues:EquipmentImportIntelligence["issues"]=[];
  const danger=alerts.filter(x=>x.level==="danger");
  const warn=alerts.filter(x=>x.level==="warn");
  if(danger.length)issues.push({id:"device-alert-danger",level:"danger",ar:"يوجد "+danger.length+" إنذار جهاز خطير غير مؤكد المعالجة. آخرها: "+danger[0].message,en:"There are "+danger.length+" unacknowledged critical device alert(s). Latest: "+danger[0].message});
  else if(warn.length)issues.push({id:"device-alert-warn",level:"warn",ar:"يوجد "+warn.length+" تنبيه جهاز غير مؤكد المعالجة. آخرها: "+warn[0].message,en:"There are "+warn.length+" unacknowledged device warning(s). Latest: "+warn[0].message});
  if(latestImport&&latestImport.confidence<55)issues.push({id:"low-import-confidence",level:"warn",ar:"آخر استيراد من الأجهزة منخفض الثقة ("+Math.round(latestImport.confidence)+"%). راجع القيم قبل الاعتماد عليها.",en:"The latest device import has low confidence ("+Math.round(latestImport.confidence)+"%). Review values before relying on it."});
  return{
    latestImport,
    unacknowledgedAlerts:alerts.length,
    dangerAlerts:danger.length,
    recentTelemetry,
    recentTopOffLiters:recentTopOff.reduce((s,x)=>s+x.liters,0),
    recentImportedChemistry,
    issues
  };
}
