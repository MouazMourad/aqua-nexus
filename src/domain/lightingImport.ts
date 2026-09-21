import type { LightingChannel,LightingProgram } from "@/domain/types";

export type LightingImportSourceKind="image"|"text"|"structured";
export interface LightingImportCandidateChannel{
  key:string;
  name:string;
  spectrum:LightingChannel["spectrum"];
  parWeight?:number;
  confidence?:number;
}
export interface LightingImportCandidatePoint{
  minute:number;
  values:Record<string,number>;
}
export interface LightingImportCandidate{
  sourceKind:LightingImportSourceKind;
  confidence:number;
  vendorDetected?:string;
  programName?:string;
  fixture?:{brand?:string;model?:string;powerWatts?:number;mountingHeightCm?:number};
  channels:LightingImportCandidateChannel[];
  points:LightingImportCandidatePoint[];
  warnings:string[];
  evidence:string[];
}

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const spectra=new Set(["uv","violet","royalBlue","blue","cyan","green","red","warmWhite","coolWhite","white","other"]);

function stripFence(value:string){
  const ticks=String.fromCharCode(96,96,96);
  let clean=value.trim();
  if(clean.startsWith(ticks))clean=clean.replace(new RegExp("^"+ticks+"(?:json)?\\s*","i"),"");
  if(clean.endsWith(ticks))clean=clean.slice(0,-3).trim();
  const start=clean.indexOf("{"),end=clean.lastIndexOf("}");
  return start>=0&&end>start?clean.slice(start,end+1):clean;
}
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
function weight(s:LightingChannel["spectrum"]){
  const map:Record<LightingChannel["spectrum"],number>={uv:.88,violet:.96,royalBlue:1,blue:.98,cyan:.78,green:.48,red:.58,warmWhite:.64,coolWhite:.72,white:.72,other:.7};
  return map[s]??.7;
}

export function normalizeLightingImportCandidate(raw:unknown,sourceKind:LightingImportSourceKind):{ok:true;candidate:LightingImportCandidate}|{ok:false;error:string}{
  let obj:any=raw;
  if(typeof raw==="string"){
    try{obj=JSON.parse(stripFence(raw))}catch{return{ok:false,error:"AI response did not contain valid JSON"}}
  }
  if(!obj||typeof obj!=="object")return{ok:false,error:"Lighting import analysis is not an object"};
  const rawChannels=Array.isArray(obj.channels)?obj.channels:[];
  const rawPoints=Array.isArray(obj.points)?obj.points:[];
  if(!rawChannels.length||rawChannels.length>32)return{ok:false,error:"Lighting import must contain 1–32 channels"};
  if(rawPoints.length<2||rawPoints.length>288)return{ok:false,error:"Lighting import must contain 2–288 time points"};

  const used=new Set<string>();
  const channels:LightingImportCandidateChannel[]=rawChannels.map((ch:any,index:number)=>{
    let key=String(ch?.key??ch?.id??ch?.name??("channel-"+index)).trim().replace(/\s+/g,"-").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64)||("channel-"+index);
    while(used.has(key))key+="-"+index;
    used.add(key);
    const name=String(ch?.name??ch?.label??key).trim().slice(0,120)||key;
    const requested=String(ch?.spectrum??"");
    const spectrum=(spectra.has(requested)?requested:inferSpectrum(name)) as LightingChannel["spectrum"];
    return{key,name,spectrum,parWeight:clamp(Number(ch?.parWeight??weight(spectrum)),0,2),confidence:clamp(Number(ch?.confidence??obj.confidence??70),0,100)};
  });
  const points:LightingImportCandidatePoint[]=rawPoints.map((row:any)=>{
    let minute=Number(row?.minute);
    if(!Number.isFinite(minute)&&typeof row?.time==="string"){
      const m=row.time.match(/^(\d{1,2}):(\d{2})/);if(m)minute=Number(m[1])*60+Number(m[2]);
    }
    minute=clamp(Number.isFinite(minute)?Math.round(minute):0,0,1439);
    const source=row?.values&&typeof row.values==="object"?row.values:row;
    const values:Record<string,number>={};
    for(const ch of channels){
      const direct=source?.[ch.key]??source?.[ch.name];
      values[ch.key]=clamp(Number.isFinite(Number(direct))?Number(direct):0,0,100);
    }
    return{minute,values};
  }).sort((a,b)=>a.minute-b.minute);

  if(new Set(points.map(x=>x.minute)).size<2)return{ok:false,error:"Lighting import needs at least two distinct times"};
  const confidence=clamp(Number(obj.confidence??70),0,100);
  const fixtureRaw=obj.fixture&&typeof obj.fixture==="object"?obj.fixture:{};
  const fixture={
    brand:fixtureRaw.brand?String(fixtureRaw.brand).slice(0,120):undefined,
    model:fixtureRaw.model?String(fixtureRaw.model).slice(0,160):undefined,
    powerWatts:Number.isFinite(Number(fixtureRaw.powerWatts))?clamp(Number(fixtureRaw.powerWatts),1,5000):undefined,
    mountingHeightCm:Number.isFinite(Number(fixtureRaw.mountingHeightCm))?clamp(Number(fixtureRaw.mountingHeightCm),1,150):undefined
  };
  return{ok:true,candidate:{
    sourceKind,
    confidence,
    vendorDetected:obj.vendorDetected?String(obj.vendorDetected).slice(0,160):undefined,
    programName:obj.programName?String(obj.programName).slice(0,240):undefined,
    fixture,
    channels,
    points,
    warnings:Array.isArray(obj.warnings)?obj.warnings.slice(0,20).map((x:any)=>String(x).slice(0,500)):[],
    evidence:Array.isArray(obj.evidence)?obj.evidence.slice(0,20).map((x:any)=>String(x).slice(0,500)):[],
  }};
}

export function lightingCandidateToProgram(candidate:LightingImportCandidate,name:string):LightingProgram{
  const now=new Date().toISOString();
  const channels:LightingChannel[]=candidate.channels.map((ch,index)=>({
    id:"imp-"+index+"-"+ch.key,
    name:ch.name,
    nameEn:ch.name,
    spectrum:ch.spectrum,
    parWeight:clamp(ch.parWeight??weight(ch.spectrum),0,2),
    enabled:true
  }));
  const keyMap=new Map(candidate.channels.map((ch,index)=>[ch.key,channels[index].id]));
  return{
    id:"light-import-"+Date.now().toString(36),
    name:candidate.programName||name,
    createdAt:now,updatedAt:now,
    channels,
    points:candidate.points.map((p,index)=>({
      id:"imp-p-"+index,
      minute:p.minute,
      values:Object.fromEntries(Object.entries(p.values).map(([key,value])=>[keyMap.get(key)??key,clamp(value,0,100)]))
    })),
    notes:[
      "Imported into Aqua Nexus for editable review.",
      "Import confidence: "+Math.round(candidate.confidence)+"%.",
      ...candidate.warnings.map(x=>"Warning: "+x)
    ].join(" ")
  };
}
