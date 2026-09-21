"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import type { Equipment,LightingChannel,LightingImportRecord,LightingProgram,Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { DecisionGuidance } from "@/components/ui/DecisionGuidance";
import { LightingHeatmap3D } from "@/components/lighting/LightingHeatmap3D";
import { defaultLightingProgram,formatLightMinute,lightingAtMinute,lightingFrontGrid,lightingGrid,lightingIntelligence,lightingSchedule,LIGHTING_SPECTRA } from "@/domain/lightingIntelligence";
import { lightingCandidateToProgram,normalizeLightingImportCandidate,type LightingImportCandidate } from "@/domain/lightingImport";
import { aquaWorkspaceHeaders } from "@/lib/anonymousWorkspace";
import { bi,tr } from "@/i18n";
import { nowISO,uid } from "@/lib/appUtils";

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));

function toTime(minute:number){
 const m=Math.max(0,Math.min(1439,Math.round(minute)));
 return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
}
function fromTime(value:string){
 const parts=value.split(":").map(Number);
 return clamp((parts[0]||0)*60+(parts[1]||0),0,1439);
}
function heatCss(value:number,max:number){
 const t=clamp(value/Math.max(1,max),0,1),hue=Math.round((1-t)*225);
 return "hsl("+hue+" 86% "+(36+t*18)+"%)";
}
function levelClass(level:string){return level==="danger"?"danger":level==="warn"?"warn":"good";}
function fileAsDataUrl(file:File){
 return new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||""));
  reader.onerror=()=>reject(reader.error??new Error("File read failed"));
  reader.readAsDataURL(file);
 });
}


const IMPORT_COMPANIES=[
 {id:"generic",ar:"ملف عام / Generic",en:"Generic file"},
 {id:"maxspect",ar:"Maxspect",en:"Maxspect"},
 {id:"redsea",ar:"Red Sea / ReefBeat",en:"Red Sea / ReefBeat"},
 {id:"ai-mobius",ar:"AI / Mobius",en:"AI / Mobius"},
 {id:"ecotech",ar:"EcoTech / Mobius",en:"EcoTech / Mobius"},
 {id:"apex",ar:"Neptune Apex",en:"Neptune Apex"},
 {id:"hydros",ar:"HYDROS",en:"HYDROS"},
 {id:"ghl",ar:"GHL",en:"GHL"},
 {id:"other",ar:"شركة أخرى",en:"Other vendor"}
] as const;
type ImportCompany=typeof IMPORT_COMPANIES[number]["id"];

function inferSpectrum(name:string):LightingChannel["spectrum"]{
 const n=name.toLowerCase();
 if(/royal/.test(n))return"royalBlue";
 if(/uv|ultra/.test(n))return"uv";
 if(/violet|purple/.test(n))return"violet";
 if(/cyan/.test(n))return"cyan";
 if(/green/.test(n))return"green";
 if(/red/.test(n))return"red";
 if(/warm.*white/.test(n))return"warmWhite";
 if(/white/.test(n))return"coolWhite";
 if(/blue/.test(n))return"blue";
 return"other";
}
function channelWeight(s:LightingChannel["spectrum"]){
 const row=[...LIGHTING_SPECTRA].find(x=>x.id===s);
 return row?.weight??.7;
}
function parseTimeCell(value:unknown){
 if(typeof value==="number"&&Number.isFinite(value))return clamp(value<=24?Math.round(value*60):Math.round(value),0,1439);
 const s=String(value??"").trim();
 const m=s.match(/^(\d{1,2}):(\d{2})/);
 if(m)return clamp(Number(m[1])*60+Number(m[2]),0,1439);
 const n=Number(s);return Number.isFinite(n)?clamp(n<=24?Math.round(n*60):Math.round(n),0,1439):null;
}
function normalizedImportedProgram(rows:Array<Record<string,unknown>>,name:string):LightingProgram|null{
 if(rows.length<2)return null;
 const keys=Object.keys(rows[0]??{});
 const timeKey=keys.find(k=>/^(time|hour|minute|timestamp|وقت|الوقت)$/i.test(k.trim()))??keys.find(k=>/time|hour|وقت/i.test(k));
 if(!timeKey)return null;
 const channelKeys=keys.filter(k=>k!==timeKey&&rows.some(r=>Number.isFinite(Number(r[k])))).slice(0,24);
 if(!channelKeys.length)return null;
 const channels:LightingChannel[]=channelKeys.map((k,i)=>{const spectrum=inferSpectrum(k);return{id:"imp-"+i+"-"+k.replace(/[^a-z0-9]+/gi,"-").slice(0,24),name:k,nameEn:k,spectrum,parWeight:channelWeight(spectrum),enabled:true}});
 const points=rows.map((row,i)=>{
  const minute=parseTimeCell(row[timeKey]);if(minute===null)return null;
  const values=Object.fromEntries(channels.map((ch,ci)=>[ch.id,clamp(Number(row[channelKeys[ci]])||0,0,100)]));
  return{id:"imp-p-"+i,minute,values};
 }).filter((x):x is NonNullable<typeof x>=>Boolean(x)).sort((a,b)=>a.minute-b.minute);
 if(points.length<2)return null;
 const now=nowISO();return{id:uid("light-import"),name,createdAt:now,updatedAt:now,channels,points,notes:"Imported for review in Aqua Nexus"};
}
function parseLightingFile(text:string,fileName:string,company:ImportCompany):LightingProgram|null{
 const vendor=IMPORT_COMPANIES.find(x=>x.id===company)?.en??company;
 if(fileName.toLowerCase().endsWith(".json")||text.trim().startsWith("{")||text.trim().startsWith("[")){
  try{
   const data=JSON.parse(text);
   const direct=data?.program??data?.lightingProgram??data;
   if(direct&&Array.isArray(direct.channels)&&Array.isArray(direct.points)){
    const channels:LightingChannel[]=direct.channels.slice(0,24).map((x:any,i:number)=>{const name=String(x.name??x.label??x.id??("Channel "+(i+1))),spectrum=inferSpectrum(String(x.spectrum??name));return{id:String(x.id??("imp-"+i)),name,nameEn:String(x.nameEn??name),spectrum,parWeight:clamp(Number(x.parWeight??channelWeight(spectrum)),0,2),enabled:x.enabled!==false}});
    const points=direct.points.slice(0,288).map((x:any,i:number)=>({id:String(x.id??("imp-p-"+i)),minute:parseTimeCell(x.minute??x.time??x.hour)??0,values:Object.fromEntries(channels.map((ch,ci)=>[ch.id,clamp(Number(x.values?.[ch.id]??x.values?.[ci]??x[ch.name]??0),0,100)]))}));
    if(channels.length&&points.length>=2){const now=nowISO();return{id:uid("light-import"),name:vendor+" Import",createdAt:now,updatedAt:now,channels,points,notes:"Imported JSON • review before saving"}}
   }
   const rows=Array.isArray(data)?data:(Array.isArray(data?.rows)?data.rows:Array.isArray(data?.data)?data.data:null);
   if(rows)return normalizedImportedProgram(rows,vendor+" Import");
  }catch{}
 }
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length>=3){
  const delimiter=lines[0].includes("\t")?"\t":lines[0].includes(";")?";":",";
  const headers=lines[0].split(delimiter).map(x=>x.trim().replace(/^["']|["']$/g,""));
  const rows=lines.slice(1,500).map(line=>{const cells=line.split(delimiter).map(x=>x.trim().replace(/^["']|["']$/g,""));return Object.fromEntries(headers.map((h,i)=>[h,cells[i]??""]))});
  return normalizedImportedProgram(rows,vendor+" Import");
 }
 return null;
}

function ProgramCurve({program}:{program:LightingProgram}){
 const pts=[...program.points].sort((a,b)=>a.minute-b.minute);
 const colors=["#885cff","#a86dff","#4f7cff","#3ebfff","#d9f5ff","#ff806f","#7adf8b","#55d8d0"];
 return <div className="lighting-curve">
  <svg viewBox="0 0 720 230" role="img" aria-label="Lighting program curve">
   {[0,25,50,75,100].map(v=><g key={v}><line x1="42" x2="708" y1={200-v*1.65} y2={200-v*1.65} className="grid"/><text x="4" y={204-v*1.65}>{v}%</text></g>)}
   {[0,6,12,18,24].map(h=><g key={h}><line y1="20" y2="200" x1={42+h/24*666} x2={42+h/24*666} className="grid"/><text x={32+h/24*666} y="222">{String(h).padStart(2,"0")}</text></g>)}
   {program.channels.filter(x=>x.enabled).map((ch,ci)=>{
    const points=pts.map(p=>{
      const x=42+p.minute/1439*666,y=200-clamp(Number(p.values[ch.id]||0),0,100)*1.65;
      return x+","+y;
    }).join(" ");
    return <polyline key={ch.id} points={points} fill="none" stroke={colors[ci%colors.length]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>;
   })}
  </svg>
  <div className="lighting-curve-legend">{program.channels.filter(x=>x.enabled).map((ch,i)=><span key={ch.id}><i style={{background:colors[i%colors.length]}}/>{ch.name}</span>)}</div>
 </div>;
}

function HeatGrid({cells,cols,max,front=false}:{cells:Array<any>;cols:number;max:number;front?:boolean}){
 return <div className={"lighting-heat-grid "+(front?"front":"")} style={{gridTemplateColumns:"repeat("+cols+",1fr)"}}>
  {cells.map((cell,i)=><div key={i} className="lighting-heat-cell" style={{background:heatCss(cell.par,Math.max(120,max))}} title={Math.round(cell.par)+" PAR"}><span>{Math.round(cell.par)}</span></div>)}
 </div>;
}

export function LightingPage({tank,onEquipment}:{tank:Tank;onEquipment:()=>void}){
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const saved=tank.lighting?.activeProgram;
 const [draft,setDraft]=useState<LightingProgram>(()=>clone(saved??defaultLightingProgram(tank)));
 const initialSchedule=lightingSchedule(draft);
 const now=new Date(),initialMinute=now.getHours()*60+now.getMinutes();
 const [viewMinute,setViewMinute]=useState(initialMinute);
 const [demoPlaying,setDemoPlaying]=useState(false);
 const [depthPct,setDepthPct]=useState(tank.lighting?.mapDepthPct??50);
 const [calX,setCalX]=useState(50),[calZ,setCalZ]=useState(50),[calDepth,setCalDepth]=useState(50),[calPar,setCalPar]=useState(0);
 const importInput=useRef<HTMLInputElement>(null);
 const [importCompany,setImportCompany]=useState<ImportCompany>("generic"),[importNote,setImportNote]=useState("");
 const [importAnalysis,setImportAnalysis]=useState<LightingImportCandidate|null>(null),[importPreview,setImportPreview]=useState<string|null>(null),[importBusy,setImportBusy]=useState(false);
 const previewTank=useMemo<Tank>(()=>({...tank,lighting:{...(tank.lighting??{}),activeProgram:draft,mapDepthPct:depthPct}}),[tank,draft,depthPct]);
 const intel=useMemo(()=>lightingIntelligence(previewTank),[previewTank]);
 const schedule=intel.schedule;
 const at=useMemo(()=>lightingAtMinute(draft,viewMinute),[draft,viewMinute]);
 const top=useMemo(()=>lightingGrid(previewTank,{minute:viewMinute,depthPct,cols:13,rows:7}),[previewTank,viewMinute,depthPct]);
 const front=useMemo(()=>lightingFrontGrid(previewTank,{minute:viewMinute,zPct:50,cols:13,rows:7}),[previewTank,viewMinute]);
 const fixtures=tank.equipment.filter(x=>x.kind==="lighting"&&x.location==="display");
 const dirty=JSON.stringify(saved??null)!==JSON.stringify(draft);
 useEffect(()=>{
  if(!demoPlaying)return;
  const timer=window.setInterval(()=>setViewMinute(m=>(m+2.5)%1440),250); // 10 simulated minutes per real second
  return()=>window.clearInterval(timer);
 },[demoPlaying]);

 function mutateProgram(mutator:(p:LightingProgram)=>void){
  setDraft(current=>{const next=clone(current);mutator(next);next.updatedAt=nowISO();return next});
 }
 function saveProgram(){
  if(draft.points.length<2){window.alert(bi(lang,"برنامج الإنارة يحتاج نقطتين زمنيتين على الأقل.","Lighting program needs at least two time points."));return}
  const cleaned=clone(draft);
  cleaned.points=cleaned.points.map(p=>({...p,minute:clamp(Math.round(p.minute),0,1439),values:Object.fromEntries(cleaned.channels.map(ch=>[ch.id,clamp(Number(p.values[ch.id]??0),0,100)]))})).sort((a,b)=>a.minute-b.minute);
  cleaned.channels=cleaned.channels.map(ch=>({...ch,parWeight:clamp(Number(ch.parWeight)||0,0,2)}));
  cleaned.updatedAt=nowISO();
  const ts=nowISO();
  patch(tank.id,t=>{
   const previous=t.lighting?.activeProgram;
   const history=previous&&JSON.stringify(previous)!==JSON.stringify(cleaned)
    ?[{id:uid("light-ver"),timestamp:ts,reason:"program-update",program:clone(previous)},...(t.lighting?.history??[])].slice(0,50)
    :(t.lighting?.history??[]);
   return{...t,lighting:{...(t.lighting??{}),activeProgram:cleaned,history,mapDepthPct:depthPct},timeline:[{id:uid("ev"),timestamp:ts,type:"lighting-program",textAr:"تم حفظ برنامج الإنارة "+cleaned.name+" وربطه بتحليل Tank Brain.",textEn:"Lighting program "+cleaned.name+" was saved and linked to Tank Brain analysis."},...t.timeline]};
  });
  setDraft(cleaned);
 }
 function addPoint(){
  const existing=[...draft.points].sort((a,b)=>a.minute-b.minute),last=existing.at(-1);
  const minute=last?clamp(last.minute+60,0,1439):720;
  mutateProgram(p=>p.points.push({id:uid("lp"),minute,values:Object.fromEntries(p.channels.map(ch=>[ch.id,0]))}));
 }
 function addChannel(){
  mutateProgram(p=>{
   const id=uid("ch");
   p.channels.push({id,name:lang==="ar"?"قناة جديدة":"New Channel",nameEn:"New Channel",spectrum:"other",parWeight:.7,enabled:true});
   p.points=p.points.map(x=>({...x,values:{...x.values,[id]:0}}));
  });
 }
 function removeChannel(id:string){
  if(draft.channels.length<=1)return;
  mutateProgram(p=>{p.channels=p.channels.filter(x=>x.id!==id);p.points=p.points.map(x=>{const values={...x.values};delete values[id];return{...x,values}})});
 }
 function updateFixture(id:string,partial:Partial<Equipment>){
  const ts=nowISO();
  patch(tank.id,t=>({...t,equipment:t.equipment.map(x=>x.id===id?{...x,...partial}:x),timeline:[{id:uid("ev"),timestamp:ts,type:"lighting-fixture-model",textAr:"تم تحديث نموذج وحدة إنارة لتحسين تقدير التوزيع الضوئي.",textEn:"A lighting fixture model was updated to improve light-distribution estimation."},...t.timeline]}));
 }
 async function analyzeLightingImportWithAI(args:{file:File;sourceKind:"image"|"text";imageDataUrl?:string;textContent?:string}){
  const response=await fetch("/api/ai/lighting-import",{
   method:"POST",
   headers:aquaWorkspaceHeaders({"content-type":"application/json"}),
   body:JSON.stringify({
    tank,
    sourceKind:args.sourceKind,
    sourceCompany:importCompany,
    fileName:args.file.name,
    fileType:args.file.type||args.file.name.split(".").pop()||"unknown",
    imageDataUrl:args.imageDataUrl,
    textContent:args.textContent,
    language:lang
   })
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(json?.error||("Lighting import analysis failed ("+response.status+")"));
  const normalized=normalizeLightingImportCandidate(json?.answer?.candidate,args.sourceKind);
  if(!normalized.ok)throw new Error(normalized.error);
  return normalized.candidate;
 }
 function applyImportedCandidate(candidate:LightingImportCandidate,file:File,mode:"structured-file"|"ai-text"|"ai-image"){
  const source=IMPORT_COMPANIES.find(x=>x.id===importCompany),ts=nowISO();
  const program=lightingCandidateToProgram(candidate,(source?.en??importCompany)+" Import");
  const importRecord:LightingImportRecord={
   id:uid("light-import-log"),importedAt:ts,sourceCompany:importCompany,fileName:file.name,
   fileType:file.type||file.name.split(".").pop()||"unknown",fileSize:file.size,
   status:mode==="structured-file"?"parsed":"analyzed",analysisMode:mode,confidence:candidate.confidence,
   detectedChannels:program.channels.length,detectedPoints:program.points.length,warnings:candidate.warnings
  };
  patch(tank.id,t=>({...t,lighting:{...(t.lighting??{}),imports:[importRecord,...(t.lighting?.imports??[])].slice(0,50)},timeline:[{id:uid("ev"),timestamp:ts,type:"lighting-import",textAr:"تم تحليل استيراد إنارة من "+(source?.ar??importCompany)+": "+file.name+" وتحويله لمسودة قابلة للتعديل. الثقة "+Math.round(candidate.confidence)+"%.",textEn:"Lighting import from "+(source?.en??importCompany)+": "+file.name+" was analyzed into an editable draft. Confidence "+Math.round(candidate.confidence)+"%."},...t.timeline]}));
  setDraft(program);
  setImportAnalysis(candidate);
  setViewMinute(new Date().getHours()*60+new Date().getMinutes());
  setImportNote(bi(lang,
   "تم تعبئة القنوات والأوقات والنسب داخل الصفحة كمسودة قابلة للتعديل. راجع أي تحذير وعدّل القيم إذا لزم، ثم احفظ لتصبح جزءاً من Tank Brain وLocal Best AI.",
   "Channels, times and intensities were filled into the page as an editable draft. Review warnings, edit if needed, then save to make it active in Tank Brain and Local Best AI."
  ));
 }
 async function importLightingFile(file?:File){
  if(!file)return;
  setImportNote("");setImportAnalysis(null);setImportPreview(null);setImportBusy(true);
  try{
   const lower=file.name.toLowerCase(),isImage=file.type.startsWith("image/")||/\.(png|jpe?g|webp)$/i.test(lower);
   if(isImage){
    if(file.size>5*1024*1024)throw new Error(bi(lang,"الصورة أكبر من 5MB؛ صغّرها قبل التحليل.","Image is larger than 5MB; resize it before analysis."));
    const imageDataUrl=await fileAsDataUrl(file);
    setImportPreview(imageDataUrl);
    const candidate=await analyzeLightingImportWithAI({file,sourceKind:"image",imageDataUrl});
    applyImportedCandidate(candidate,file,"ai-image");
   }else{
    if(file.size>2*1024*1024)throw new Error(bi(lang,"ملف النص أكبر من 2MB؛ صدّر نطاق الإنارة فقط.","Text export is larger than 2MB; export the lighting range only."));
    const textContent=await file.text();
    const parsed=parseLightingFile(textContent,file.name,importCompany);
    if(parsed){
     const candidateRaw={
      confidence:100,
      programName:parsed.name,
      channels:parsed.channels.map(ch=>({key:ch.id,name:ch.name,spectrum:ch.spectrum,parWeight:ch.parWeight,confidence:100})),
      points:parsed.points.map(p=>({minute:p.minute,values:p.values})),
      warnings:[],evidence:["Parsed directly from structured export"]
     };
     const normalized=normalizeLightingImportCandidate(candidateRaw,"structured");
     if(!normalized.ok)throw new Error(normalized.error);
     applyImportedCandidate(normalized.candidate,file,"structured-file");
    }else{
     const candidate=await analyzeLightingImportWithAI({file,sourceKind:"text",textContent});
     applyImportedCandidate(candidate,file,"ai-text");
    }
   }
  }catch(error){
   const ts=nowISO(),source=IMPORT_COMPANIES.find(x=>x.id===importCompany),message=error instanceof Error?error.message:String(error);
   const importRecord:LightingImportRecord={id:uid("light-import-log"),importedAt:ts,sourceCompany:importCompany,fileName:file.name,fileType:file.type||file.name.split(".").pop()||"unknown",fileSize:file.size,status:"unsupported",notes:message};
   patch(tank.id,t=>({...t,lighting:{...(t.lighting??{}),imports:[importRecord,...(t.lighting?.imports??[])].slice(0,50)},timeline:[{id:uid("ev"),timestamp:ts,type:"lighting-import",textAr:"فشل تحليل استيراد الإنارة "+file.name+": "+message,textEn:"Lighting import analysis failed for "+file.name+": "+message},...t.timeline]}));
   setImportNote(message);
  }finally{
   setImportBusy(false);
   if(importInput.current)importInput.current.value="";
  }
 }
 function applyImportedFixtureHint(){
  const hint=importAnalysis?.fixture,fixture=fixtures[0];
  if(!hint||!fixture)return;
  updateFixture(fixture.id,{
   brand:hint.brand??fixture.brand,
   model:hint.model??fixture.model,
   powerWatts:hint.powerWatts??fixture.powerWatts,
   mountingHeightCm:hint.mountingHeightCm??fixture.mountingHeightCm
  });
 }

 function addCalibration(){
  if(!Number.isFinite(calPar)||calPar<=0){window.alert(bi(lang,"أدخل قراءة PAR فعلية أكبر من صفر.","Enter a measured PAR value greater than zero."));return}
  const ts=nowISO(),row={id:uid("par"),timestamp:ts,xPct:clamp(calX,0,100),zPct:clamp(calZ,0,100),depthPct:clamp(calDepth,0,100),measuredPar:clamp(calPar,1,3000),minute:viewMinute};
  patch(tank.id,t=>({...t,lighting:{...(t.lighting??{}),activeProgram:t.lighting?.activeProgram??draft,calibrationPoints:[row,...(t.lighting?.calibrationPoints??[])].slice(0,50),mapDepthPct:depthPct},timeline:[{id:uid("ev"),timestamp:ts,type:"lighting-par-calibration",textAr:"تمت إضافة نقطة معايرة PAR فعلية: "+Math.round(row.measuredPar)+" PAR.",textEn:"Measured PAR calibration point added: "+Math.round(row.measuredPar)+" PAR."},...t.timeline]}));
  setCalPar(0);
 }
 function removeCalibration(id:string){patch(tank.id,t=>({...t,lighting:{...(t.lighting??{}),calibrationPoints:(t.lighting?.calibrationPoints??[]).filter(x=>x.id!==id)}}));}

 const why=intel.issues[0]?(lang==="ar"?intel.issues[0].ar:intel.issues[0].en):bi(lang,"البرنامج الحالي ضمن الحدود العامة للمراجعة، والخرائط تستخدم نموذجاً تقديرياً يمكن معايرته بقياسات PAR حقيقية.","The current program is within general review limits; maps use an estimate that can be calibrated with real PAR readings.");
 const next=intel.issues[0]?.id==="no-fixture"?bi(lang,"سجّل وحدة الإنارة وموقعها أولاً.","Register the light fixture and its position first."):intel.calibrationPoints?bi(lang,"راقب استجابة الكائنات والكيمياء قبل أي تعديل كبير جديد.","Observe livestock and chemistry response before another large change."):bi(lang,"أضف 3–5 نقاط PAR حقيقية لتحويل الخريطة من تقدير عام إلى نموذج معاير لحوضك.","Add 3–5 measured PAR points to calibrate the map to your aquarium.");

 return <section className="page-grid lighting-page">
  <PageHeader eyebrow="LIGHTING INTELLIGENCE" title={bi(lang,"الإنارة الذكية","Lighting Intelligence")} actions={<div className="lighting-page-actions"><button className="btn" onClick={()=>importInput.current?.click()}>⇧ {bi(lang,"استيراد","Import")}</button><button className="btn primary" onClick={saveProgram} disabled={!dirty}>{dirty?bi(lang,"حفظ البرنامج","Save program"):bi(lang,"البرنامج محفوظ","Program saved")}</button><input ref={importInput} type="file" hidden accept=".csv,.json,.txt,.png,.jpg,.jpeg,.webp,text/csv,application/json,text/plain,image/png,image/jpeg,image/webp" onChange={e=>void importLightingFile(e.target.files?.[0])}/></div>}/>

  <section className="card panel full-span lighting-command">
   <div className="module-head"><div><small className="eyebrow-mini">TANK BRAIN • LIGHT</small><h3>{tank.type==="marine"?bi(lang,"إنارة بحرية — مرجان وطيف واختراق","Marine lighting — coral, spectrum & penetration"):bi(lang,"إنارة نهري — نباتات وتوازن الضوء مع CO₂ والمغذيات","Freshwater lighting — plants, CO₂ & nutrient balance")}</h3><p className="note">{bi(lang,"Aqua Nexus يقرأ البرنامج، قوة كل وحدة، مواقعها، أبعاد الحوض، معايرة PAR والكيمياء ليعطيك صورة واحدة قابلة للفهم.","Aqua Nexus combines the schedule, fixture wattage, positions, tank geometry, PAR calibration and chemistry into one readable model.")}</p></div><div className="lighting-head-badges"><span className="scene-badge">{tank.type==="marine"?bi(lang,"بحري","MARINE"):bi(lang,"نهري","FRESHWATER")}</span><span className={"status "+levelClass(intel.level)}>{intel.level.toUpperCase()}</span></div></div>
   <DecisionGuidance what={bi(lang,"برنامج "+draft.name+" • "+Math.round(schedule.photoperiodMinutes/60*10)/10+" ساعة • Peak "+Math.round(schedule.peakPercent)+"%","Program "+draft.name+" • "+(schedule.photoperiodMinutes/60).toFixed(1)+" h • Peak "+Math.round(schedule.peakPercent)+"%")} why={why} next={next} safety={bi(lang,"قيم PAR في الصفحة تقديرية ما لم تتم معايرتها بقياس فعلي. لا ترفع الضوء بقفزة كبيرة اعتماداً على الخريطة وحدها.","PAR values are estimates until calibrated with real measurements. Do not make a large light increase from the map alone.")}/>
   <div className="summary-strip">
    <div className="summary"><small>{bi(lang,"الفترة الضوئية","Photoperiod")}</small><b>{(schedule.photoperiodMinutes/60).toFixed(1)} h</b></div>
    <div className="summary"><small>{bi(lang,"الجرعة النسبية","Relative dose")}</small><b>{schedule.relativeDoseHours.toFixed(1)} h-eq</b></div>
    <div className="summary"><small>{bi(lang,"PAR وسط الحوض","Center PAR")}</small><b>≈ {Math.round(intel.centerPeak)}</b></div>
    <div className="summary"><small>{bi(lang,"ثقة النموذج","Model confidence")}</small><b>{intel.confidence}%</b></div>
    <div className="summary"><small>{bi(lang,"المعايرة","Calibration")}</small><b>{intel.calibrationPoints?intel.calibrationPoints+" PAR":"EST."}</b></div>
   </div>
  </section>

  <section className="card panel full-span">
   <div className="module-head"><div><small className="eyebrow-mini">3D LIGHT FIELD</small><h3>{bi(lang,"الخريطة الضوئية على التوأم ثلاثي الأبعاد","3D light field on the digital twin")}</h3></div><span className="scene-badge">{formatLightMinute(viewMinute)}</span></div>
   <div className="lighting-demo-toolbar">
    <button className={"btn "+(demoPlaying?"good":"primary")} onClick={()=>setDemoPlaying(v=>!v)}>{demoPlaying?"⏸ "+bi(lang,"إيقاف الديمو","Pause demo"):"▶ "+bi(lang,"ديمو اليوم 10×","Day demo 10×")}</button>
    <button className="btn" onClick={()=>{const d=new Date();setDemoPlaying(false);setViewMinute(d.getHours()*60+d.getMinutes())}}>◉ {bi(lang,"الوقت الحالي","Now")}</button>
    <button className="btn" onClick={()=>{setDemoPlaying(false);setViewMinute(schedule.peakMinute)}}>☀ {bi(lang,"الذروة","Peak")}</button>
    <span className="lighting-demo-clock">{formatLightMinute(viewMinute)}</span>
   </div>
   <div className="lighting-controls">
    <label className="field lighting-time-field"><span>{bi(lang,"مرّر الوقت لأي ساعة تريدها","Scrub to any time of day")} • {formatLightMinute(viewMinute)}</span><input aria-label="Lighting simulation time" type="range" min="0" max="1439" step="5" value={viewMinute} onChange={e=>{setDemoPlaying(false);setViewMinute(Number(e.target.value))}}/></label>
    <label className="field"><span>{bi(lang,"عمق خريطة Top View","Top-map depth")} • {Math.round(depthPct)}%</span><input aria-label="Lighting map depth" type="range" min="0" max="100" step="5" value={depthPct} onChange={e=>setDepthPct(Number(e.target.value))}/></label>
    <div className="inline-alert info"><b>{bi(lang,"الشدة المركبة بهالساعة","Composite intensity at this time")}: {Math.round(at.weightedPercent)}%</b><p>{bi(lang,"المجسم يتغير مباشرة حسب الساعة والطيف. ديمو 10× يمر باليوم بسرعة 10 دقائق محاكاة لكل ثانية فعلية.","The 3D tank changes instantly with time and spectrum. 10× demo advances 10 simulated minutes per real second.")}</p></div>
   </div>
   <LightingHeatmap3D tank={previewTank} minute={viewMinute} depthPct={depthPct}/>
  </section>

  <section className="lighting-map-pair full-span">
   <div className="card panel"><div className="module-head"><div><h3>{bi(lang,"Top View — توزيع PAR","Top View — PAR distribution")}</h3><p className="note">{bi(lang,"من الأعلى عند العمق المختار.","From above at the selected depth.")}</p></div><span className="status">{Math.round(top.min)}–{Math.round(top.max)}</span></div><HeatGrid cells={top.cells} cols={top.cols} max={top.max}/></div>
   <div className="card panel"><div className="module-head"><div><h3>{bi(lang,"Front View — اختراق الضوء","Front View — light penetration")}</h3><p className="note">{bi(lang,"مقطع أمامي بمنتصف عرض الحوض؛ الأعلى سطح الماء والأسفل القاع.","Front section at mid-width; surface is at the top, bottom at the base.")}</p></div><span className="status">{Math.round(front.min)}–{Math.round(front.max)}</span></div><HeatGrid cells={front.cells} cols={front.cols} max={front.max} front/></div>
  </section>

  <section className="card panel full-span lighting-placement-panel">
   <div className="module-head"><div><small className="eyebrow-mini">{tank.type==="marine"?"CORAL PLACEMENT":"PLANT PLACEMENT"}</small><h3>{tank.type==="marine"?bi(lang,"تموضع المرجان حسب حاجته للضوء","Coral placement by light demand"):bi(lang,"تموضع النباتات حسب النوع والحاجة للضوء","Plant placement by species & light demand")}</h3><p className="note">{tank.type==="marine"?bi(lang,"Aqua Nexus يفرق بين SPS وLPS والـSoft/مشروم ويعطي نطاق PAR ومكان بداية محافظ.","Aqua Nexus separates SPS, LPS and soft/mushroom corals and gives a conservative starting PAR/zone."):bi(lang,"Aqua Nexus يفرق بين نباتات الظل والـCrypt والنباتات الساقية/الكاربت ويعطي نطاق PAR ومكان مناسب.","Aqua Nexus separates shade plants, Crypts and higher-light stem/carpet plants with suitable PAR zones.")}</p></div><span className="scene-badge">{intel.placementRecommendations.length}</span></div>
   {intel.placementRecommendations.length?<div className="lighting-placement-grid">{intel.placementRecommendations.map(x=><article className={"lighting-placement-card zone-"+x.zone} key={x.livestockId}><div><b>{x.name}</b><span>{x.zone==="top"?bi(lang,"أعلى","TOP"):x.zone==="mid"?bi(lang,"وسط","MID"):x.zone==="shade"?bi(lang,"ظل","SHADE"):bi(lang,"أسفل","BOTTOM")}</span></div><strong>{x.parMin}–{x.parMax} PAR</strong><p>{lang==="ar"?x.ar:x.en}</p></article>)}</div>:<div className="inline-alert info">{tank.type==="marine"?bi(lang,"سجّل المرجان بالحوض حتى تظهر توصيات التموضع الخاصة بكل نوع.","Register corals to get per-species placement guidance."):bi(lang,"سجّل النباتات بالحوض حتى تظهر توصيات التموضع الخاصة بكل نوع.","Register plants to get per-species placement guidance.")}</div>}
  </section>

  <section className="card panel full-span">
   <div className="module-head"><div><small className="eyebrow-mini">PROGRAM</small><h3>{bi(lang,"البرنامج الزمني والطيف","Schedule & spectrum")}</h3><p className="note">{bi(lang,"أي تغيير هون يظهر فوراً بالمنحنى والـ3D قبل الحفظ. الحفظ ينشئ نسخة تاريخية من البرنامج السابق.","Changes preview instantly in the curve and 3D before saving. Saving stores a historical version of the previous program.")}</p></div><span className={dirty?"status warn":"status good"}>{dirty?bi(lang,"تعديلات غير محفوظة","UNSAVED"):bi(lang,"محفوظ","SAVED")}</span></div>
   <div className="form-grid compact-fields"><label className="field"><span>{bi(lang,"اسم البرنامج","Program name")}</span><input value={draft.name} onChange={e=>mutateProgram(p=>{p.name=e.target.value})}/></label><label className="field full-field"><span>{tr(lang,"notes")}</span><input value={draft.notes??""} onChange={e=>mutateProgram(p=>{p.notes=e.target.value})}/></label></div>
   <ProgramCurve program={draft}/>
   <div className="lighting-channel-editor">
    {draft.channels.map(ch=><div className="lighting-channel-row" key={ch.id}>
      <label className="checkbox-row"><input type="checkbox" checked={ch.enabled} onChange={e=>mutateProgram(p=>{const x=p.channels.find(v=>v.id===ch.id);if(x)x.enabled=e.target.checked})}/><span>{bi(lang,"فعالة","On")}</span></label>
      <input value={ch.name} aria-label="Channel name" onChange={e=>mutateProgram(p=>{const x=p.channels.find(v=>v.id===ch.id);if(x)x.name=e.target.value})}/>
      <select value={ch.spectrum} aria-label="Spectrum" onChange={e=>mutateProgram(p=>{const x=p.channels.find(v=>v.id===ch.id);if(x)x.spectrum=e.target.value as LightingChannel["spectrum"]})}>{[...LIGHTING_SPECTRA,{id:"other",ar:"أخرى",en:"Other",weight:.7} as any].map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.ar:x.en}</option>)}</select>
      <label className="field mini"><span>PAR weight</span><input type="number" min="0" max="2" step=".05" value={ch.parWeight} onChange={e=>mutateProgram(p=>{const x=p.channels.find(v=>v.id===ch.id);if(x)x.parWeight=Number(e.target.value)})}/></label>
      <button className="icon-btn" onClick={()=>removeChannel(ch.id)} aria-label="Remove channel">×</button>
    </div>)}
    <button className="btn" onClick={addChannel}>+ {bi(lang,"قناة","Channel")}</button>
   </div>

   <div className="lighting-points-wrap">
    <table className="lighting-points-table"><thead><tr><th>{bi(lang,"الوقت","Time")}</th>{draft.channels.map(ch=><th key={ch.id}>{ch.name}</th>)}<th/></tr></thead><tbody>
     {[...draft.points].sort((a,b)=>a.minute-b.minute).map(pt=><tr key={pt.id}><td><input type="time" value={toTime(pt.minute)} onChange={e=>mutateProgram(p=>{const x=p.points.find(v=>v.id===pt.id);if(x)x.minute=fromTime(e.target.value)})}/></td>{draft.channels.map(ch=><td key={ch.id}><input type="number" min="0" max="100" value={pt.values[ch.id]??0} onChange={e=>mutateProgram(p=>{const x=p.points.find(v=>v.id===pt.id);if(x)x.values[ch.id]=clamp(Number(e.target.value),0,100)})}/></td>)}<td><button className="icon-btn" onClick={()=>mutateProgram(p=>{if(p.points.length>2)p.points=p.points.filter(x=>x.id!==pt.id)})}>×</button></td></tr>)}
    </tbody></table>
    <button className="btn" onClick={addPoint}>+ {bi(lang,"نقطة زمنية","Time point")}</button>
   </div>
  </section>

  <section className="card panel full-span lighting-import-panel">
   <div className="module-head"><div><small className="eyebrow-mini">IMPORT • VISION + FILE</small><h3>{bi(lang,"استيراد صورة أو ملف وتحويله لمسودة قابلة للتعديل","Import an image or file into an editable lighting draft")}</h3><p className="note">{bi(lang,"صورة Screenshot تُحلل بصرياً، والـCSV/JSON/TXT يُقرأ مباشرة أو عبر AI fallback. النتيجة تعبّي القنوات والأوقات والنسب بنفس محرر الصفحة قبل الحفظ.","Screenshots are analyzed visually; CSV/JSON/TXT are parsed directly or through AI fallback. The result fills the same editable channel/time/intensity editor before save.")}</p></div><button className="btn primary" disabled={importBusy} onClick={()=>importInput.current?.click()}>{importBusy?bi(lang,"عم يحلل…","Analyzing…"):"⇧ "+bi(lang,"اختيار صورة أو ملف","Choose image or file")}</button></div>
   <div className="form-grid compact-fields">
    <label className="field"><span>{bi(lang,"الشركة / النظام","Vendor / system")}</span><select value={importCompany} onChange={e=>setImportCompany(e.target.value as ImportCompany)}>{IMPORT_COMPANIES.map(x=><option value={x.id} key={x.id}>{lang==="ar"?x.ar:x.en}</option>)}</select></label>
    <div className="field"><span>{bi(lang,"آخر استيراد","Last import")}</span><b className="input-like">{tank.lighting?.imports?.[0]?new Date(tank.lighting.imports[0].importedAt).toLocaleString():"—"}</b></div>
   </div>
   {importBusy&&<div className="inline-alert info"><b>{bi(lang,"عم نحلل الاستيراد","Analyzing import")}</b><p>{bi(lang,"الصورة/الملف عم يتحول إلى قنوات ونقاط زمنية قابلة للمراجعة. ما رح تنحفظ كبرنامج فعال قبل ما تضغط حفظ.","The image/file is being converted into reviewable channels and time points. It will not become the active program until you save.")}</p></div>}
   {importAnalysis&&<div className="lighting-import-review">
    {importPreview&&<div className="lighting-import-preview"><img src={importPreview} alt={bi(lang,"الصورة المستوردة لبرنامج الإنارة","Imported lighting-program screenshot")}/></div>}
    <div className="lighting-import-review-body">
     <div className="module-head"><div><small className="eyebrow-mini">AI REVIEW</small><h4>{bi(lang,"نتيجة التحليل قبل الحفظ","Analysis result before save")}</h4></div><span className={"status "+(importAnalysis.confidence>=80?"good":importAnalysis.confidence>=55?"warn":"danger")}>{Math.round(importAnalysis.confidence)}%</span></div>
     <div className="summary-strip"><div className="summary"><small>{bi(lang,"القنوات","Channels")}</small><b>{importAnalysis.channels.length}</b></div><div className="summary"><small>{bi(lang,"النقاط الزمنية","Time points")}</small><b>{importAnalysis.points.length}</b></div><div className="summary"><small>{bi(lang,"المصدر","Source")}</small><b>{importAnalysis.sourceKind}</b></div></div>
     {importAnalysis.warnings.length>0&&<div className="lighting-import-warnings">{importAnalysis.warnings.map((w,i)=><div className="inline-alert warn" key={i}>{w}</div>)}</div>}
     {importAnalysis.fixture&&(importAnalysis.fixture.brand||importAnalysis.fixture.model||importAnalysis.fixture.powerWatts)&&<div className="inline-alert info"><b>{bi(lang,"معلومة جهاز مكتشفة","Detected fixture info")}</b><p>{[importAnalysis.fixture.brand,importAnalysis.fixture.model,importAnalysis.fixture.powerWatts?importAnalysis.fixture.powerWatts+" W":null].filter(Boolean).join(" • ")}</p>{fixtures.length>0&&<button className="btn" onClick={applyImportedFixtureHint}>{bi(lang,"تطبيقها على جهاز الإنارة","Apply to lighting fixture")}</button>}</div>}
     <div className="inline-alert good">{bi(lang,"كل القيم صارت بالـProgram Editor فوق وقابلة للتعديل. بعد Save تدخل مباشرة بتحليل Tank Brain وLocal Best AI والـ3D/PAR.","All extracted values are now in the Program Editor above and remain editable. After Save they feed Tank Brain, Local Best AI and the 3D/PAR model directly.")}</div>
    </div>
   </div>}
   {importNote&&<div className="inline-alert info">{importNote}</div>}
   {(tank.lighting?.imports??[]).length>0&&<div className="history-list lighting-import-history">{(tank.lighting?.imports??[]).slice(0,8).map(x=><div className="history-row" key={x.id}><div><b>{(IMPORT_COMPANIES.find(v=>v.id===x.sourceCompany)?.[lang==="ar"?"ar":"en"]??x.sourceCompany)+" • "+x.fileName}</b><small>{new Date(x.importedAt).toLocaleString()+" • "+x.fileType+" • "+(x.fileSize/1024).toFixed(1)+" KB"+(x.detectedChannels?(" • "+x.detectedChannels+" ch • "+x.detectedPoints+" pts"):"")}</small></div><span className={"status "+((x.status==="parsed"||x.status==="analyzed")?"good":"warn")}>{x.status}{typeof x.confidence==="number"?" • "+Math.round(x.confidence)+"%":""}</span></div>)}</div>}
  </section>

  <section className="card panel full-span">
   <div className="module-head"><div><small className="eyebrow-mini">FIXTURES</small><h3>{bi(lang,"وحدات الإنارة والنموذج البصري","Fixtures & optical model")}</h3><p className="note">{bi(lang,"الأجهزة نفسها تأتي من صفحة Equipment. هون نكمل المعلومات التي يحتاجها حساب الضوء فقط.","Hardware comes from Equipment; this section adds only the optical data needed for light modelling.")}</p></div><button className="btn" onClick={onEquipment}>{bi(lang,"فتح المعدات","Open Equipment")}</button></div>
   {!fixtures.length&&<div className="inline-alert warn">{bi(lang,"ما في وحدة Lighting مسجلة فوق الحوض. أضفها من Equipment أولاً؛ الصفحة لن تخترع جهازاً غير موجود.","No display Lighting fixture is registered. Add the real hardware in Equipment first; this page will not invent a fixture.")}</div>}
   <div className="lighting-fixtures">{fixtures.map((f,i)=>{
    const p=f.displayPosition??{xPct:(i+1)/(fixtures.length+1)*100,yPct:116,zPct:50};
    return <article className="lighting-fixture-card" key={f.id}><div><b>{f.name}</b><small>{[f.brand,f.model].filter(Boolean).join(" • ")||f.kind}</small></div><div className="form-grid compact-fields">
      <label className="field lighting-required-field"><span>{bi(lang,"قوة وحدة الإنارة W — مطلوب","Fixture power W — required")}</span><input type="number" min="1" max="5000" defaultValue={f.powerWatts??""} placeholder={bi(lang,"مثلاً 100","e.g. 100")} onBlur={e=>updateFixture(f.id,{powerWatts:Number(e.target.value)>0?Number(e.target.value):undefined})}/><small>{bi(lang,"الواط يدخل مباشرة بحساب التقدير إذا ما في PAR مرجعي مقاس.","Wattage feeds the estimate directly when no measured reference PAR is available.")}</small></label>
      <label className="field"><span>{bi(lang,"ارتفاع فوق سطح الماء cm","Height above water cm")}</span><input type="number" min="1" max="150" defaultValue={f.mountingHeightCm??20} onBlur={e=>updateFixture(f.id,{mountingHeightCm:clamp(Number(e.target.value),1,150)})}/></label>
      <label className="field"><span>{bi(lang,"PAR مرجعي","Reference PAR")}</span><input type="number" min="0" max="3000" defaultValue={f.parAtTargetDepth??""} placeholder="e.g. 250" onBlur={e=>updateFixture(f.id,{parAtTargetDepth:Number(e.target.value)>0?Number(e.target.value):undefined})}/></label>
      <label className="field"><span>{bi(lang,"عمق قياس PAR cm","PAR reference depth cm")}</span><input type="number" min="0" max={tank.display.height} defaultValue={f.parReferenceDepthCm??Math.round(tank.display.height*.5)} onBlur={e=>updateFixture(f.id,{parReferenceDepthCm:clamp(Number(e.target.value),0,tank.display.height)})}/></label>
      <label className="field"><span>{bi(lang,"تغطية الطول cm","Coverage length cm")}</span><input type="number" min="1" defaultValue={f.coverageLengthCm??Math.round(tank.display.length*.62)} onBlur={e=>updateFixture(f.id,{coverageLengthCm:Math.max(1,Number(e.target.value))})}/></label>
      <label className="field"><span>{bi(lang,"تغطية العرض cm","Coverage width cm")}</span><input type="number" min="1" defaultValue={f.coverageWidthCm??Math.round(tank.display.width*.78)} onBlur={e=>updateFixture(f.id,{coverageWidthCm:Math.max(1,Number(e.target.value))})}/></label>
      <label className="field"><span>X %</span><input type="number" min="0" max="100" defaultValue={Math.round(p.xPct)} onBlur={e=>updateFixture(f.id,{displayPosition:{...p,xPct:clamp(Number(e.target.value),0,100)}})}/></label>
      <label className="field"><span>Z %</span><input type="number" min="0" max="100" defaultValue={Math.round(p.zPct)} onBlur={e=>updateFixture(f.id,{displayPosition:{...p,zPct:clamp(Number(e.target.value),0,100)}})}/></label>
    </div></article>;
   })}</div>
  </section>

  <section className="card panel full-span">
   <div className="module-head"><div><small className="eyebrow-mini">PAR CALIBRATION</small><h3>{bi(lang,"حوّل التقدير إلى خريطة معايرة لحوضك","Calibrate the estimate to your aquarium")}</h3><p className="note">{bi(lang,"حط جهاز PAR في نقطة معروفة وسجّل مكانها وعمقها والقراءة. Aqua Nexus يحسب معامل معايرة robust من كل النقاط بدل الاعتماد على قراءة واحدة.","Place a PAR meter at known positions and log depth/readings. Aqua Nexus derives a robust calibration factor from all points instead of trusting one reading.")}</p></div><span className="scene-badge">×{intel.calibrationFactor.toFixed(2)}</span></div>
   <div className="form-grid compact-fields">
    <label className="field"><span>X %</span><input type="number" min="0" max="100" value={calX} onChange={e=>setCalX(Number(e.target.value))}/></label>
    <label className="field"><span>Z %</span><input type="number" min="0" max="100" value={calZ} onChange={e=>setCalZ(Number(e.target.value))}/></label>
    <label className="field"><span>{bi(lang,"العمق %","Depth %")}</span><input type="number" min="0" max="100" value={calDepth} onChange={e=>setCalDepth(Number(e.target.value))}/></label>
    <label className="field"><span>{bi(lang,"PAR المقاس","Measured PAR")}</span><input type="number" min="0" max="3000" value={calPar||""} onChange={e=>setCalPar(Number(e.target.value))}/></label>
    <div className="field"><span>{bi(lang,"وقت القياس","Measurement time")}</span><b className="input-like">{formatLightMinute(viewMinute)}</b></div>
   </div>
   <button className="btn primary" onClick={addCalibration}>+ {bi(lang,"إضافة نقطة معايرة","Add calibration point")}</button>
   <div className="history-list" style={{marginTop:12}}>{(tank.lighting?.calibrationPoints??[]).map(x=><div className="history-row" key={x.id}><div><b>{Math.round(x.measuredPar)} PAR</b><small>X {Math.round(x.xPct)}% • Z {Math.round(x.zPct)}% • {bi(lang,"عمق","depth")} {Math.round(x.depthPct)}% • {formatLightMinute(x.minute??schedule.peakMinute)}</small></div><button className="icon-btn" onClick={()=>removeCalibration(x.id)}>×</button></div>)}</div>
  </section>

  <section className="card panel full-span">
   <div className="module-head"><div><small className="eyebrow-mini">TANK BRAIN CONNECTIONS</small><h3>{bi(lang,"شو شايف عقل الحوض من الإنارة؟","What does Tank Brain see from lighting?")}</h3></div><span className={"status "+levelClass(intel.level)}>{intel.confidence}%</span></div>
   <div className="lighting-brain-grid">
    <div><h4>{bi(lang,"السلامة الضوئية","Light safety")}</h4>{intel.issues.length?intel.issues.map(x=><div className={"inline-alert "+levelClass(x.level)} key={x.id}>{lang==="ar"?x.ar:x.en}</div>):<div className="inline-alert good">✓ {bi(lang,"ما في مشكلة ضوئية رئيسية واضحة من البيانات الحالية.","No major lighting issue is obvious from current data.")}</div>}</div>
    <div><h4>{bi(lang,"الربط مع الكيمياء","Chemistry link")}</h4>{intel.chemistrySignals.length?intel.chemistrySignals.map(x=><div className="inline-alert info" key={x}>{x} • {bi(lang,"ارتباط زمني محتمل، وليس إثبات سببية.","possible temporal association, not proof of causation.")}</div>):<div className="inline-alert info">{bi(lang,"لا يوجد تغير كيميائي حديث قوي لربطه بالضوء حالياً. Tank Brain سيستفيد من تاريخ تغييرات البرنامج والقراءات القادمة.","No strong recent chemistry shift is available to associate with light yet. Tank Brain will use program-change history and future readings.")}</div>}</div>
    <div><h4>{bi(lang,"التبخر وتعويض الماء","Evaporation & top-off")}</h4><div className="inline-alert info">{bi(lang,"الإنارة الأطول/الأقوى قد ترفع الحرارة والتبخر، لكن Aqua Nexus ما بيخترع كمية تعويض. إذا صار عنده سجل ATO/تعويض ماء فعلي، Tank Brain يقدر يربطه زمنياً بتغييرات الإنارة.","Longer/stronger lighting can increase heat and evaporation, but Aqua Nexus will not invent top-off volume. When measured ATO/top-off history exists, Tank Brain can relate it temporally to lighting changes.")}</div></div>
    <div><h4>Local Best AI</h4><div className="inline-alert good">{bi(lang,"الذكاء المحلي صار يقرأ برنامج الإنارة، الجرعة الضوئية، PAR المقدر/المعاير، التغييرات الحديثة وإشارات الكيمياء عند الإجابة عن أسئلة الإنارة.","Local Best AI now reads the schedule, relative light dose, estimated/calibrated PAR, recent program changes and chemistry signals when answering lighting questions.")}</div></div>
   </div>
  </section>

  {(tank.lighting?.history??[]).length>0&&<section className="card panel full-span"><div className="module-head"><div><small className="eyebrow-mini">PROGRAM HISTORY</small><h3>{bi(lang,"نسخ البرامج السابقة","Previous program versions")}</h3></div><span className="status">{tank.lighting?.history?.length}</span></div><div className="history-list">{(tank.lighting?.history??[]).slice(0,10).map(x=>{const s=lightingSchedule(x.program);return <div className="history-row" key={x.id}><div><b>{x.program.name}</b><small>{new Date(x.timestamp).toLocaleString()} • {(s.photoperiodMinutes/60).toFixed(1)} h • dose {s.relativeDoseHours.toFixed(1)}</small></div></div>})}</div></section>}
 </section>;
}
