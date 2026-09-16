import type { Tank } from "@/domain/types";
import { aquaAIAnswer } from "@/domain/aquaAIBrain";
import { aquaAISystemPrompt,buildTankAIContext } from "@/domain/aiContext";
import { query } from "./db";

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
    await query("INSERT INTO aqua_ai_audit(workspace_key,tank_id,mode,question,provider,model,response) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)",[workspace,tankId||null,mode,question||null,provider,model||null,JSON.stringify(response)]);
  }catch{}
}

export async function runAquaChat(input:{workspace:string;tank:Tank;question:string;page?:string;language?:"ar"|"en"}) : Promise<GatewayResult>{
  const language=input.language||"ar";
  const cfg=providerConfig();
  if(!cfg.configured){
    const answer=aquaAIAnswer(input.question,input.tank,input.page||"dashboard");
    await audit(input.workspace,input.tank.id,"chat",input.question,"local",undefined,answer);
    return {mode:"local",provider:"Aqua Nexus local intelligence",answer};
  }

  const context=buildTankAIContext(input.tank);
  const response=await fetch(`${cfg.base}/chat/completions`,{
    method:"POST",
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
  const prompt=input.question||"Assess the visible aquarium organism condition. Give a differential assessment, confidence, relevant tank-context links, and safe next observations/actions. Do not claim a definitive diagnosis.";
  const response=await fetch(`${cfg.base}/chat/completions`,{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${cfg.key}`},
    body:JSON.stringify({
      model:cfg.model,
      temperature:.15,
      messages:[
        {role:"system",content:aquaAISystemPrompt(language)},
        {role:"system",content:`AQUA_NEXUS_TANK_CONTEXT\n${JSON.stringify(context)}`},
        {role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:input.imageDataUrl}}]}
      ]
    })
  });
  if(!response.ok)throw new Error(`Vision provider returned ${response.status}`);
  const json:any=await response.json();
  const text=json?.choices?.[0]?.message?.content??json?.output_text??json;
  const answer={text,contextSchema:context.schema};
  await audit(input.workspace,input.tank.id,"vision",input.question,"external",cfg.model,answer);
  return {mode:"external",provider:"configured AI provider",model:cfg.model,answer};
}
