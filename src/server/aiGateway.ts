import type { Tank } from "@/domain/types";
import { aquaAIAnswer } from "@/domain/aquaAIBrain";
import { aquaAISystemPrompt,buildTankAIContext } from "@/domain/aiContext";
import { query } from "./db";
import { ensureWorkspace } from "./workspace";
import { isAquariumScopedQuestion,offTopicAquaAnswer } from "@/domain/aquaAIScope";
import { normalizeLightingImportCandidate,type LightingImportSourceKind } from "@/domain/lightingImport";
import { normalizeEquipmentImportCandidate,type EquipmentImportSourceKind } from "@/domain/equipmentImport";

export interface GatewayResult {
  mode:"local"|"external";
  provider:string;
  model?:string;
  answer:any;
}

function providerConfig(){
  const key=process.env.AQUA_AI_API_KEY;
  const base=(process.env.AQUA_AI_BASE_URL||"").replace(/\/$/,"");
  const model=process.env.AQUA_AI_MODEL||"";
  return {configured:Boolean(key&&base&&model),key,base,model};
}

async function audit(workspace:string,tankId:string|undefined,mode:string,question:string|undefined,provider:string,model:string|undefined,response:any){
  try{
    await ensureWorkspace(workspace);
    await query("INSERT INTO aqua_ai_audit(workspace_key,tank_id,mode,question,provider,model,response) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)",[workspace,tankId||null,mode,question||null,provider,model||null,JSON.stringify(response)]);
  }catch{}
}

export async function runAquaChat(input:{workspace:string;tank:Tank;question:string;page?:string;language?:"ar"|"en"}) : Promise<GatewayResult>{
  const language=input.language||"ar";
  if(!isAquariumScopedQuestion(input.question,input.tank)){
    const answer=offTopicAquaAnswer(input.question);
    await audit(input.workspace,input.tank.id,"chat",input.question,"local-scope-guard",undefined,answer);
    return {mode:"local",provider:"Aqua Nexus scope guard",answer};
  }
  const cfg=providerConfig();
  if(!cfg.configured){
    const answer=aquaAIAnswer(input.question,input.tank,input.page||"dashboard");
    await audit(input.workspace,input.tank.id,"chat",input.question,"local",undefined,answer);
    return {mode:"local",provider:"Aqua Nexus local intelligence",answer};
  }

  const context=buildTankAIContext(input.tank);
  const response=await fetch(`${cfg.base}/chat/completions`,{
    method:"POST",
    signal:AbortSignal.timeout(45_000),
    headers:{"content-type":"application/json","authorization":`Bearer ${cfg.key}`},
    body:JSON.stringify({
      model:cfg.model,
      temperature:.2,
      messages:[
        {role:"system",content:aquaAISystemPrompt(language)},
        {role:"system",content:`AQUA_NEXUS_TANK_CONTEXT\n${JSON.stringify(context)}`},
        {role:"user",content:input.question}
      ]
    })
  });
  if(!response.ok)throw new Error(`AI provider returned ${response.status}`);
  const json:any=await response.json();
  const text=json?.choices?.[0]?.message?.content??json?.output_text??json;
  const answer={text,contextSchema:context.schema};
  await audit(input.workspace,input.tank.id,"chat",input.question,"external",cfg.model,answer);
  return {mode:"external",provider:"configured AI provider",model:cfg.model,answer};
}

export async function runAquaVision(input:{workspace:string;tank:Tank;imageDataUrl:string;question?:string;language?:"ar"|"en"}) : Promise<GatewayResult>{
  const cfg=providerConfig();
  if(!cfg.configured){
    const answer={
      providerConfigured:false,
      messageAr:"مسار Vision الخارجي جاهز في الباك إند، لكن نموذج الرؤية لم يتم ربطه بمفتاح API بعد. استخدم Visual Health Intake المحلي حالياً.",
      messageEn:"The external Vision backend path is ready, but no vision-capable provider key is configured yet. Use the local Visual Health Intake for now."
    };
    await audit(input.workspace,input.tank.id,"vision",input.question,"local",undefined,answer);
    return {mode:"local",provider:"Aqua Nexus local visual workflow",answer};
  }

  const context=buildTankAIContext(input.tank);
  const language=input.language||"ar";
  const basePrompt=language==="ar"
    ?"حلل الصورة كـ رأي بصري ثانٍ لحوض أسماك. افصل بوضوح بين ما تراه فعلاً وبين الاحتمالات. لا تعتبر الصورة تشخيصاً مؤكداً، ولا توصي بدواء أو جرعة اعتماداً على الصورة وحدها. اربط الملاحظات ببيانات الحوض المرفقة، واذكر مستوى الاستعجال وما الذي يجب فحصه أو مراقبته قبل أي علاج."
    :"Analyze this as a second visual opinion for an aquarium. Clearly separate visible findings from differential possibilities. Do not treat the image as a confirmed diagnosis and do not recommend medication or dosing from the image alone. Link findings to the supplied tank context, state urgency, and list the safest checks or observations needed before treatment.";
  const requested=input.question?.trim();
  const prompt=`${basePrompt}\n\n${requested?"LOCAL AQUA NEXUS CONTEXT / USER NOTES:\n"+requested:""}\n\nReturn a concise response with these sections: Visible findings; Differential possibilities; Tank-context links; Safe next checks; Urgency and confidence.`;
  const response=await fetch(`${cfg.base}/chat/completions`,{
    method:"POST",
    signal:AbortSignal.timeout(45_000),
    headers:{"content-type":"application/json","authorization":`Bearer ${cfg.key}`},
    body:JSON.stringify({
      model:cfg.model,
      temperature:.1,
      max_tokens:900,
      messages:[
        {role:"system",content:aquaAISystemPrompt(language)},
        {role:"system",content:"You are an aquarium visual triage assistant. Never overstate image certainty. Do not prescribe medication solely from an image. Use the supplied Aqua Nexus tank context as evidence, not as permission to infer missing facts."},
        {role:"system",content:`AQUA_NEXUS_TANK_CONTEXT\n${JSON.stringify(context)}`},
        {role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:input.imageDataUrl}}]}
      ]
    })
  });
  if(!response.ok)throw Object.assign(new Error(`Vision provider returned ${response.status}`),{status:502});
  const json:any=await response.json();
  const raw=json?.choices?.[0]?.message?.content??json?.output_text??json;
  const text=typeof raw==="string"?raw.slice(0,12000):JSON.stringify(raw).slice(0,12000);
  const answer={text,contextSchema:context.schema,secondOpinion:true};
  await audit(input.workspace,input.tank.id,"vision",input.question,"external",cfg.model,answer);
  return {mode:"external",provider:"configured AI provider",model:cfg.model,answer};
}


export async function runAquaLightingImport(input:{
  workspace:string;
  tank:Tank;
  sourceKind:LightingImportSourceKind;
  sourceCompany?:string;
  fileName?:string;
  fileType?:string;
  imageDataUrl?:string;
  textContent?:string;
  language?:"ar"|"en";
}):Promise<GatewayResult>{
  const cfg=providerConfig();
  if(!cfg.configured){
    const answer={providerConfigured:false,error:"Lighting import AI provider is not configured."};
    await audit(input.workspace,input.tank.id,"lighting-import",input.fileName,"local",undefined,answer);
    return {mode:"local",provider:"Aqua Nexus lighting import",answer};
  }
  const language=input.language||"ar";
  const context=buildTankAIContext(input.tank);
  const schemaPrompt=[
    "You extract aquarium lighting schedules from screenshots or export text.",
    "Return JSON only. Do not add prose outside JSON.",
    "Never invent a channel, time point, fixture model, wattage or value that is not visible or strongly evidenced.",
    "If a graph requires approximation, use the closest defensible value and add a warning; lower confidence accordingly.",
    "All channel intensity values must be 0..100 and times must be minute-of-day 0..1439.",
    "Allowed spectrum values: uv,violet,royalBlue,blue,cyan,green,red,warmWhite,coolWhite,white,other.",
    "Output exactly: {confidence:number,vendorDetected?:string,programName?:string,fixture?:{brand?:string,model?:string,powerWatts?:number,mountingHeightCm?:number},channels:[{key:string,name:string,spectrum:string,parWeight?:number,confidence?:number}],points:[{minute:number,values:{[channelKey]:number}}],warnings:string[],evidence:string[]}.",
    "Use the same channel keys in every point. Missing visible values should be 0 only when the screenshot/export clearly shows zero; otherwise include a warning and keep confidence low.",
    "This is data extraction for editable review. It is not permission to make aquarium treatment or dosing decisions."
  ].join("\n");
  const sourceMeta="Vendor selected by user: "+(input.sourceCompany||"unknown")+"\nFilename: "+(input.fileName||"unknown")+"\nFile type: "+(input.fileType||"unknown");
  const userContent:any[]=[{type:"text",text:schemaPrompt+"\n\n"+sourceMeta}];
  if(input.imageDataUrl)userContent.push({type:"image_url",image_url:{url:input.imageDataUrl}});
  else userContent[0].text+="\n\nEXPORT CONTENT:\n"+String(input.textContent||"").slice(0,180000);

  const response=await fetch(`${cfg.base}/chat/completions`,{
    method:"POST",
    signal:AbortSignal.timeout(60_000),
    headers:{"content-type":"application/json","authorization":`Bearer ${cfg.key}`},
    body:JSON.stringify({
      model:cfg.model,
      temperature:0,
      max_tokens:1800,
      messages:[
        {role:"system",content:aquaAISystemPrompt(language)},
        {role:"system",content:"You are Aqua Nexus Lighting Import Extractor. Extract only lighting-program data and preserve uncertainty."},
        {role:"system",content:`AQUA_NEXUS_TANK_CONTEXT\n${JSON.stringify(context)}`},
        {role:"user",content:userContent}
      ]
    })
  });
  if(!response.ok)throw Object.assign(new Error(`Lighting import provider returned ${response.status}`),{status:502});
  const json:any=await response.json();
  const raw=json?.choices?.[0]?.message?.content??json?.output_text??json;
  const normalized=normalizeLightingImportCandidate(typeof raw==="string"?raw:JSON.stringify(raw),input.sourceKind);
  if(!normalized.ok)throw Object.assign(new Error(normalized.error),{status:422});
  const answer={candidate:normalized.candidate,contextSchema:context.schema};
  await audit(input.workspace,input.tank.id,"lighting-import",input.fileName,"external",cfg.model,answer);
  return {mode:"external",provider:"configured AI provider",model:cfg.model,answer};
}


export async function runAquaEquipmentImport(input:{
  workspace:string;
  tank:Tank;
  sourceKind:EquipmentImportSourceKind;
  vendor?:string;
  fileName?:string;
  fileType?:string;
  imageDataUrl?:string;
  textContent?:string;
  language?:"ar"|"en";
}):Promise<GatewayResult>{
  const cfg=providerConfig();
  if(!cfg.configured){
    const answer={providerConfigured:false,error:"Equipment import AI provider is not configured."};
    await audit(input.workspace,input.tank.id,"equipment-import",input.fileName,"local",undefined,answer);
    return {mode:"local",provider:"Aqua Nexus equipment import",answer};
  }
  const language=input.language||"ar",context=buildTankAIContext(input.tank);
  const prompt=[
    "You extract aquarium controller/equipment information from screenshots or exported text.",
    "Return JSON only, no prose outside JSON.",
    "Do not invent missing devices, measurements, doses, top-off volumes, timestamps or alerts.",
    "If a value is visually approximate or ambiguous, preserve the closest defensible value, add a warning and lower confidence.",
    "Use ISO 8601 timestamps when visible. If the source gives only a date/time, preserve the best supported timestamp instead of fabricating a different time.",
    "Allowed equipment kinds: lighting,waveMaker,skimmer,returnPump,filterSock,rollerFilter,reactor,heater,doser,uv,ozone,ato,refugiumLight,turfScrubber,probe,overflow,co2,other.",
    "Output exactly: {confidence:number,vendorDetected?:string,devices:[{sourceRecordId?:string,name:string,kind:string,brand?:string,model?:string,location?:string,status?:string,powerWatts?:number,hoursPerDay?:number,ratedVolumeLiters?:number,flowLph?:number}],measurements:[{sourceRecordId?:string,timestamp:string,parameter:string,value:number,unit?:string,deviceName?:string}],doses:[{sourceRecordId?:string,timestamp:string,parameter:string,ml:number,amount?:number,unit?:string,material?:string,deviceName?:string}],topOff:[{sourceRecordId?:string,timestamp:string,liters:number,deviceName?:string}],alerts:[{sourceRecordId?:string,timestamp:string,level?:string,message:string,deviceName?:string}],warnings:string[],evidence:string[]}.",
    "For chemistry, preserve the source parameter name and numeric value; Aqua Nexus will map/validate it locally.",
    "For dosing, record only doses that the export says actually occurred; do not convert schedules into executed dose logs.",
    "For top-off, record only actual delivered volume when present.",
    "This is extraction into an editable review draft. It must not make treatment, dosing or equipment-control decisions."
  ].join("\n");
  const meta="Vendor selected by user: "+(input.vendor||"generic")+"\nFilename: "+(input.fileName||"unknown")+"\nFile type: "+(input.fileType||"unknown");
  const userContent:any[]=[{type:"text",text:prompt+"\n\n"+meta}];
  if(input.imageDataUrl)userContent.push({type:"image_url",image_url:{url:input.imageDataUrl}});
  else userContent[0].text+="\n\nEXPORT CONTENT:\n"+String(input.textContent||"").slice(0,220000);

  const response=await fetch(`${cfg.base}/chat/completions`,{
    method:"POST",
    signal:AbortSignal.timeout(60_000),
    headers:{"content-type":"application/json","authorization":`Bearer ${cfg.key}`},
    body:JSON.stringify({
      model:cfg.model,temperature:0,max_tokens:3000,
      messages:[
        {role:"system",content:aquaAISystemPrompt(language)},
        {role:"system",content:"You are Aqua Nexus Equipment Import Extractor. Preserve provenance and uncertainty. Never infer control actions."},
        {role:"system",content:`AQUA_NEXUS_TANK_CONTEXT\n${JSON.stringify(context)}`},
        {role:"user",content:userContent}
      ]
    })
  });
  if(!response.ok)throw Object.assign(new Error(`Equipment import provider returned ${response.status}`),{status:502});
  const json:any=await response.json();
  const raw=json?.choices?.[0]?.message?.content??json?.output_text??json;
  const normalized=normalizeEquipmentImportCandidate(typeof raw==="string"?raw:JSON.stringify(raw),input.sourceKind);
  if(!normalized.ok)throw Object.assign(new Error(normalized.error),{status:422});
  const answer={candidate:normalized.candidate,contextSchema:context.schema};
  await audit(input.workspace,input.tank.id,"equipment-import",input.fileName,"external",cfg.model,answer);
  return {mode:"external",provider:"configured AI provider",model:cfg.model,answer};
}
