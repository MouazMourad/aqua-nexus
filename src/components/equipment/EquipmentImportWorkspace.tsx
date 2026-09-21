"use client";
import { useMemo,useRef,useState } from "react";
import type { EquipmentKind,ExternalImportVendor,Tank } from "@/domain/types";
import {
  autoMatchImportedDevice,normalizeEquipmentImportCandidate,parseGenericEquipmentExport,
  type EquipmentImportCandidate,type EquipmentImportDeviceCandidate,type EquipmentImportMeasurementCandidate
} from "@/domain/equipmentImport";
import { prepareEquipmentImportApplication } from "@/domain/equipmentImportApply";
import { appendHistoricalDomainRows,type HistoricalDomain } from "@/lib/longTermHistory";
import { aquaWorkspaceHeaders } from "@/lib/anonymousWorkspace";
import { useAquaStore } from "@/store/useAquaStore";
import { bi } from "@/i18n";
import { nowISO,uid } from "@/lib/appUtils";

const VENDORS:Array<{id:ExternalImportVendor;ar:string;en:string}>=[
 {id:"generic",ar:"عام / Generic",en:"Generic"},
 {id:"neptune-apex",ar:"Neptune Apex",en:"Neptune Apex"},
 {id:"redsea-reefbeat",ar:"Red Sea / ReefBeat",en:"Red Sea / ReefBeat"},
 {id:"hydros",ar:"HYDROS",en:"HYDROS"},
 {id:"ghl",ar:"GHL",en:"GHL"},
 {id:"ai-mobius",ar:"AI / Mobius",en:"AI / Mobius"},
 {id:"ecotech-mobius",ar:"EcoTech / Mobius",en:"EcoTech / Mobius"},
 {id:"maxspect",ar:"Maxspect",en:"Maxspect"},
 {id:"seneye",ar:"Seneye",en:"Seneye"},
 {id:"other",ar:"شركة/نظام آخر",en:"Other vendor/system"}
];
const EQUIPMENT_KINDS:EquipmentKind[]=["lighting","waveMaker","overflow","skimmer","returnPump","filterSock","rollerFilter","reactor","heater","doser","uv","ozone","ato","refugiumLight","turfScrubber","probe","co2","other"];

async function fileFingerprint(file:File){
 const bytes=await file.arrayBuffer();
 if(globalThis.crypto?.subtle){
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
 }
 let h=2166136261;for(const b of new Uint8Array(bytes)){h^=b;h=Math.imul(h,16777619)}
 return "fallback-"+(h>>>0).toString(36)+"-"+file.size;
}
async function fileAsDataUrl(file:File){
 const bytes=new Uint8Array(await file.arrayBuffer());let binary="",i=0,chunk=0x8000;
 for(;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+chunk)));
 return "data:"+(file.type||"application/octet-stream")+";base64,"+btoa(binary);
}
function sourceType(file:File){
 const lower=file.name.toLowerCase();
 if(file.type.startsWith("image/")||/\.(png|jpe?g|webp)$/i.test(lower))return"image" as const;
 if(lower.endsWith(".csv"))return"csv" as const;
 if(lower.endsWith(".json"))return"json" as const;
 if(/\.(txt|xml|log)$/i.test(lower))return"text" as const;
 return"other" as const;
}
function sourceLabel(lang:"ar"|"en",vendor:ExternalImportVendor){
 const row=VENDORS.find(x=>x.id===vendor);return row?(lang==="ar"?row.ar:row.en):vendor;
}
function selectedCounts(candidate:EquipmentImportCandidate|null){
 if(!candidate)return{equipment:0,chemistry:0,telemetry:0,dosing:0,topOff:0,alerts:0};
 return{
  equipment:candidate.devices.filter(x=>x.enabled).length,
  chemistry:candidate.measurements.filter(x=>x.enabled&&x.destination==="chemistry").length,
  telemetry:candidate.measurements.filter(x=>x.enabled&&x.destination==="telemetry").length,
  dosing:candidate.doses.filter(x=>x.enabled).length,
  topOff:candidate.topOff.filter(x=>x.enabled).length,
  alerts:candidate.alerts.filter(x=>x.enabled).length
 };
}

export function EquipmentImportWorkspace({tank,onClose}:{tank:Tank;onClose:()=>void}){
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const fileInput=useRef<HTMLInputElement>(null);
 const [vendor,setVendor]=useState<ExternalImportVendor>("generic");
 const [file,setFile]=useState<File|null>(null),[fingerprint,setFingerprint]=useState("");
 const [candidate,setCandidate]=useState<EquipmentImportCandidate|null>(null);
 const [analysisMode,setAnalysisMode]=useState<"structured-file"|"ai-text"|"ai-image"|null>(null);
 const [preview,setPreview]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [allowDuplicate,setAllowDuplicate]=useState(false),[visible,setVisible]=useState(80);
 const duplicate=useMemo(()=>fingerprint?(tank.externalImports??[]).find(x=>x.fingerprint===fingerprint&&x.status==="applied"):undefined,[fingerprint,tank.externalImports]);
 const counts=selectedCounts(candidate);

 function withAutoMatches(next:EquipmentImportCandidate){
  return{...next,devices:next.devices.map(row=>({...row,targetEquipmentId:row.targetEquipmentId??autoMatchImportedDevice(tank,row)}))};
 }
 async function aiAnalyze(args:{file:File;kind:"image"|"text";imageDataUrl?:string;textContent?:string}){
  const response=await fetch("/api/ai/equipment-import",{
   method:"POST",
   headers:aquaWorkspaceHeaders({"content-type":"application/json"}),
   body:JSON.stringify({
    tank,sourceKind:args.kind,vendor,fileName:args.file.name,fileType:args.file.type||args.file.name.split(".").pop()||"unknown",
    imageDataUrl:args.imageDataUrl,textContent:args.textContent,language:lang
   })
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(json?.error||("Equipment import analysis failed ("+response.status+")"));
  const normalized=normalizeEquipmentImportCandidate(json?.answer?.candidate,args.kind);
  if(!normalized.ok)throw new Error(normalized.error);
  return normalized.candidate;
 }
 async function analyzeFile(nextFile?:File){
  if(!nextFile)return;
  setBusy(true);setMessage("");setCandidate(null);setPreview(null);setAllowDuplicate(false);setFile(nextFile);setVisible(80);
  try{
   if(nextFile.size>10*1024*1024)throw new Error(bi(lang,"الملف أكبر من 10MB. صدّر نطاق البيانات المطلوب أو صغّر الصورة.","File is larger than 10MB. Export the needed range or resize the image."));
   const fp=await fileFingerprint(nextFile);setFingerprint(fp);
   const kind=sourceType(nextFile);
   let next:EquipmentImportCandidate|null=null,mode:"structured-file"|"ai-text"|"ai-image";
   if(kind==="image"){
    const data=await fileAsDataUrl(nextFile);setPreview(data);
    next=await aiAnalyze({file:nextFile,kind:"image",imageDataUrl:data});mode="ai-image";
   }else{
    const text=await nextFile.text();
    next=parseGenericEquipmentExport(text,nextFile.name,vendor);
    if(next)mode="structured-file";
    else{next=await aiAnalyze({file:nextFile,kind:"text",textContent:text});mode="ai-text";}
   }
   setCandidate(withAutoMatches(next));setAnalysisMode(mode);
   setMessage(bi(lang,"تم إنشاء مسودة الاستيراد. عدّل أو ألغِ أي قيمة قبل الاعتماد.","Import draft created. Edit or disable any value before applying it."));
  }catch(error){setMessage(error instanceof Error?error.message:String(error));}
  finally{setBusy(false);if(fileInput.current)fileInput.current.value="";}
 }
 function updateDevice(index:number,patchRow:Partial<EquipmentImportDeviceCandidate>){
  setCandidate(current=>current?{...current,devices:current.devices.map((row,i)=>i===index?{...row,...patchRow}:row)}:current);
 }
 function updateMeasurement(index:number,patchRow:Partial<EquipmentImportMeasurementCandidate>){
  setCandidate(current=>current?{...current,measurements:current.measurements.map((row,i)=>i===index?{...row,...patchRow}:row)}:current);
 }
 function updateArray<K extends "doses"|"topOff"|"alerts">(key:K,index:number,patchRow:any){
  setCandidate(current=>current?{...current,[key]:(current[key] as any[]).map((row,i)=>i===index?{...row,...patchRow}:row)}:current);
 }
 async function applyImport(){
  if(!candidate||!file||!analysisMode)return;
  if(duplicate&&!allowDuplicate){setMessage(bi(lang,"هذا الملف مستورد سابقاً. فعّل «إعادة الاستيراد» فقط إذا كنت تقصد ذلك.","This exact file was already imported. Enable re-import only if intentional."));return}
  setBusy(true);setMessage("");
  try{
   const importId=uid("ext-import"),importedAt=nowISO();
   const application=prepareEquipmentImportApplication(tank,candidate,{
    importId,importedAt,vendor,sourceName:file.name,sourceType:sourceType(file),fingerprint,analysisMode
   });
   if(application.blockedIssues.length){
    setMessage((lang==="ar"?application.blockedIssues.map(x=>x.ar):application.blockedIssues.map(x=>x.en)).join("\n"));
    setBusy(false);return;
   }
   const domains:Array<[HistoricalDomain,unknown[]]>=[
    ["chemistry",application.overflow.chemistry],
    ["dosing",application.overflow.dosing],
    ["deviceTelemetry",application.overflow.deviceTelemetry],
    ["topOff",application.overflow.topOff],
    ["deviceAlerts",application.overflow.deviceAlerts]
   ];
   for(const [domain,rows] of domains)if(rows.length)await appendHistoricalDomainRows(tank.id,domain,rows);
   patch(tank.id,()=>application.tank);
   setMessage(bi(lang,"تم اعتماد الاستيراد وتوزيع البيانات على أقسام Aqua Nexus وربطها بعقل الحوض.","Import applied, routed into Aqua Nexus domains and connected to Tank Brain."));
   setCandidate(null);setFile(null);setFingerprint("");setPreview(null);
  }catch(error){setMessage(error instanceof Error?error.message:String(error));}
  finally{setBusy(false);}
 }

 return <section className="card panel full-span equipment-import-workspace">
  <div className="module-head"><div><small className="eyebrow-mini">UNIFIED EQUIPMENT IMPORT</small><h3>{bi(lang,"استيراد بيانات الأجهزة والأنظمة","Import device & controller data")}</h3><p className="note">{bi(lang,"ملف أو Screenshot → تحليل → مسودة قابلة للتعديل → اعتماد → توزيع تلقائي على Equipment / Chemistry / Dosing / ATO / Telemetry / Alerts.","File or screenshot → analysis → editable draft → apply → automatic routing to Equipment / Chemistry / Dosing / ATO / Telemetry / Alerts.")}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close">×</button></div>

  <div className="equipment-import-source">
   <label className="field"><span>{bi(lang,"الشركة / النظام","Vendor / system")}</span><select value={vendor} onChange={e=>setVendor(e.target.value as ExternalImportVendor)}>{VENDORS.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.ar:x.en}</option>)}</select></label>
   <button className="btn primary" disabled={busy} onClick={()=>fileInput.current?.click()}>{busy?bi(lang,"عم يحلل…","Analyzing…"):"⇧ "+bi(lang,"اختيار صورة أو ملف","Choose image or file")}</button>
   <input ref={fileInput} data-testid="equipment-import-input" hidden type="file" accept=".csv,.json,.txt,.xml,.log,.png,.jpg,.jpeg,.webp,text/csv,application/json,text/plain,text/xml,application/xml,image/png,image/jpeg,image/webp" onChange={e=>void analyzeFile(e.target.files?.[0])}/>
   <div className="inline-alert info"><b>{bi(lang,"المبدأ","Rule")}</b><p>{bi(lang,"Aqua Nexus ما بيحفظ أي قيمة مستوردة مباشرة. كل شي يمر بالمراجعة، والكيمياء غير المنطقية تُحجب قبل الاعتماد.","Aqua Nexus never writes imported values immediately. Everything is reviewed, and implausible chemistry is blocked before apply.")}</p></div>
  </div>

  {message&&<div className={"inline-alert "+(candidate?"info":"warn")} style={{whiteSpace:"pre-wrap"}}>{message}</div>}
  {duplicate&&<div className="inline-alert danger"><b>{bi(lang,"ملف مكرر","Duplicate file")}</b><p>{bi(lang,"نفس الملف تم اعتماده بتاريخ ","The same file was applied on ")+new Date(duplicate.importedAt).toLocaleString()}.</p><label className="checkbox-row"><input type="checkbox" checked={allowDuplicate} onChange={e=>setAllowDuplicate(e.target.checked)}/><span>{bi(lang,"أعرف أنه مكرر وأريد إعادة الاستيراد","I know it is a duplicate and want to re-import")}</span></label></div>}

  {candidate&&<div className="equipment-import-review">
   <div className="module-head"><div><small className="eyebrow-mini">REVIEW BEFORE APPLY</small><h3>{sourceLabel(lang,vendor)} • {file?.name}</h3></div><span className={"status "+(candidate.confidence>=80?"good":candidate.confidence>=55?"warn":"danger")}>{Math.round(candidate.confidence)}%</span></div>
   {preview&&<div className="equipment-import-image"><img src={preview} alt={bi(lang,"صورة الجهاز أو التطبيق المستوردة","Imported equipment/controller screenshot")}/></div>}
   <div className="summary-strip equipment-import-summary">
    <div className="summary"><small>Equipment</small><b>{counts.equipment}</b></div>
    <div className="summary"><small>Chemistry</small><b>{counts.chemistry}</b></div>
    <div className="summary"><small>Telemetry</small><b>{counts.telemetry}</b></div>
    <div className="summary"><small>Dosing</small><b>{counts.dosing}</b></div>
    <div className="summary"><small>ATO</small><b>{counts.topOff}</b></div>
    <div className="summary"><small>Alerts</small><b>{counts.alerts}</b></div>
   </div>
   {candidate.warnings.map((w,i)=><div className="inline-alert warn" key={i}>{w}</div>)}

   {candidate.devices.length>0&&<div className="equipment-import-section"><h4>⚙ {bi(lang,"الأجهزة المكتشفة","Detected equipment")}</h4>{candidate.devices.slice(0,visible).map((row,i)=><div className="equipment-import-row device" key={row.key}>
    <label className="checkbox-row"><input type="checkbox" checked={row.enabled} onChange={e=>updateDevice(i,{enabled:e.target.checked})}/></label>
    <input value={row.name} aria-label={"Device name "+i} onChange={e=>updateDevice(i,{name:e.target.value})}/>
    <select value={row.kind} onChange={e=>updateDevice(i,{kind:e.target.value as EquipmentKind})}>{EQUIPMENT_KINDS.map(k=><option key={k}>{k}</option>)}</select>
    <input value={row.brand??""} placeholder="Brand" onChange={e=>updateDevice(i,{brand:e.target.value})}/>
    <input value={row.model??""} placeholder="Model" onChange={e=>updateDevice(i,{model:e.target.value})}/>
    <input type="number" min="0" value={row.powerWatts??""} placeholder="W" onChange={e=>updateDevice(i,{powerWatts:e.target.value===""?undefined:Number(e.target.value)})}/>
    <input type="number" min="0" value={row.flowLph??""} placeholder="L/h" onChange={e=>updateDevice(i,{flowLph:e.target.value===""?undefined:Number(e.target.value)})}/>
    <select value={row.targetEquipmentId??""} onChange={e=>updateDevice(i,{targetEquipmentId:e.target.value||undefined})}><option value="">{bi(lang,"إضافة كجهاز جديد","Add as new")}</option>{tank.equipment.map(x=><option key={x.id} value={x.id}>{bi(lang,"تحديث","Update")} • {x.name}</option>)}</select>
   </div>)}</div>}

   {candidate.measurements.length>0&&<div className="equipment-import-section"><h4>◌ {bi(lang,"القراءات","Measurements")}</h4>{candidate.measurements.slice(0,visible).map((row,i)=><div className="equipment-import-row measurement" key={row.key}>
    <label className="checkbox-row"><input type="checkbox" checked={row.enabled} onChange={e=>updateMeasurement(i,{enabled:e.target.checked})}/></label>
    <input value={row.timestamp} onChange={e=>updateMeasurement(i,{timestamp:e.target.value})}/>
    <input value={row.parameter} onChange={e=>updateMeasurement(i,{parameter:e.target.value})}/>
    <input type="number" step="any" value={row.value} onChange={e=>updateMeasurement(i,{value:Number(e.target.value)})}/>
    <input value={row.unit??""} placeholder="unit" onChange={e=>updateMeasurement(i,{unit:e.target.value})}/>
    <select value={row.destination} onChange={e=>updateMeasurement(i,{destination:e.target.value as any})}><option value="chemistry">Chemistry</option><option value="telemetry">Telemetry</option></select>
    <span className="import-source-device">{row.deviceName||"—"}</span>
   </div>)}</div>}

   {candidate.doses.length>0&&<div className="equipment-import-section"><h4>💧 {bi(lang,"الجرعات المنفذة","Executed dosing")}</h4>{candidate.doses.slice(0,visible).map((row,i)=><div className="equipment-import-row dose" key={row.key}>
    <label className="checkbox-row"><input type="checkbox" checked={row.enabled} onChange={e=>updateArray("doses",i,{enabled:e.target.checked})}/></label>
    <input value={row.timestamp} onChange={e=>updateArray("doses",i,{timestamp:e.target.value})}/>
    <input value={row.parameter} onChange={e=>updateArray("doses",i,{parameter:e.target.value})}/>
    <input type="number" min="0" step="any" value={row.ml} onChange={e=>updateArray("doses",i,{ml:Number(e.target.value)})}/>
    <span>mL</span>
   </div>)}</div>}

   {candidate.topOff.length>0&&<div className="equipment-import-section"><h4>↟ {bi(lang,"تعويض الماء / ATO","Top-off / ATO")}</h4>{candidate.topOff.slice(0,visible).map((row,i)=><div className="equipment-import-row topoff" key={row.key}>
    <label className="checkbox-row"><input type="checkbox" checked={row.enabled} onChange={e=>updateArray("topOff",i,{enabled:e.target.checked})}/></label>
    <input value={row.timestamp} onChange={e=>updateArray("topOff",i,{timestamp:e.target.value})}/>
    <input type="number" min="0" step="any" value={row.liters} onChange={e=>updateArray("topOff",i,{liters:Number(e.target.value)})}/>
    <span>L</span><span>{row.deviceName||"—"}</span>
   </div>)}</div>}

   {candidate.alerts.length>0&&<div className="equipment-import-section"><h4>⚠ {bi(lang,"تنبيهات الأجهزة","Device alerts")}</h4>{candidate.alerts.slice(0,visible).map((row,i)=><div className="equipment-import-row alert" key={row.key}>
    <label className="checkbox-row"><input type="checkbox" checked={row.enabled} onChange={e=>updateArray("alerts",i,{enabled:e.target.checked})}/></label>
    <input value={row.timestamp} onChange={e=>updateArray("alerts",i,{timestamp:e.target.value})}/>
    <select value={row.level} onChange={e=>updateArray("alerts",i,{level:e.target.value})}><option value="info">info</option><option value="warn">warn</option><option value="danger">danger</option></select>
    <input value={row.message} onChange={e=>updateArray("alerts",i,{message:e.target.value})}/>
   </div>)}</div>}

   {Math.max(candidate.devices.length,candidate.measurements.length,candidate.doses.length,candidate.topOff.length,candidate.alerts.length)>visible&&<button className="btn" onClick={()=>setVisible(v=>v+100)}>+ {bi(lang,"إظهار 100 سجل إضافي","Show 100 more rows")}</button>}
   <div className="modal-actions equipment-import-actions"><button className="btn" onClick={()=>{setCandidate(null);setFile(null);setPreview(null);setFingerprint("");}}>{bi(lang,"إلغاء المسودة","Discard draft")}</button><button className="btn primary" disabled={busy||Boolean(duplicate&&!allowDuplicate)} onClick={()=>void applyImport()}>{bi(lang,"اعتماد الاستيراد","Apply import")}</button></div>
  </div>}

  {(tank.externalImports??[]).length>0&&<div className="equipment-import-history"><div className="module-head"><div><h4>{bi(lang,"سجل الاستيراد","Import history")}</h4></div><span className="scene-badge">{tank.externalImports?.length}</span></div><div className="history-list">{(tank.externalImports??[]).slice(0,10).map(x=><div className="history-row" key={x.id}><div><b>{sourceLabel(lang,x.vendor)} • {x.sourceName}</b><small>{new Date(x.importedAt).toLocaleString()} • {x.analysisMode} • {Math.round(x.confidence)}% • E{x.counts.equipment} C{x.counts.chemistry} T{x.counts.telemetry} D{x.counts.dosing} ATO{x.counts.topOff} !{x.counts.alerts}</small></div><span className={"status "+(x.confidence>=80?"good":x.confidence>=55?"warn":"danger")}>{x.status}</span></div>)}</div></div>}
 </section>;
}
