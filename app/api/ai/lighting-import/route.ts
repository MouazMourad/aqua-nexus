import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { runAquaLightingImport } from "@/server/aiGateway";
import { getTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";
import { validateVisionDataUrl } from "@/domain/visionRequestSafety";
import { enforceRateLimitDistributed,publicApiError,readJsonBodyLimited } from "@/server/requestSafety";

export const runtime="nodejs";
const MAX_REQUEST_BYTES=9*1024*1024;
const MAX_TEXT_CHARS=200_000;

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const rate=await enforceRateLimitDistributed(`ai-lighting-import:${workspace}`,12);
    if(!rate.ok)return NextResponse.json({ok:false,error:"Too many lighting import analyses. Retry shortly."},{status:429,headers:{"Retry-After":String(rate.retryAfterSeconds)}});
    const body=await readJsonBodyLimited<{
      tankId?:string;tank?:Tank;sourceKind?:"image"|"text"|"structured";sourceCompany?:string;fileName?:string;fileType?:string;
      imageDataUrl?:string;textContent?:string;language?:"ar"|"en"
    }>(request,MAX_REQUEST_BYTES);
    let tank=body.tank;
    if(!tank&&body.tankId)tank=(await getTank(workspace,body.tankId))?.tank;
    if(!tank)return NextResponse.json({ok:false,error:"tank or tankId is required"},{status:400});

    const sourceKind=body.sourceKind==="image"?"image":"text";
    if(sourceKind==="image"){
      const safe=validateVisionDataUrl(String(body.imageDataUrl||""));
      if(!safe.ok)return NextResponse.json({ok:false,error:safe.error},{status:safe.error?.includes("size limit")?413:400});
    }else{
      const text=String(body.textContent||"");
      if(!text.trim())return NextResponse.json({ok:false,error:"textContent is required for text lighting import"},{status:400});
      if(text.length>MAX_TEXT_CHARS)return NextResponse.json({ok:false,error:"Lighting import text exceeds the analysis size limit."},{status:413});
    }

    const result=await runAquaLightingImport({
      workspace,tank,sourceKind,
      sourceCompany:String(body.sourceCompany||"generic").slice(0,80),
      fileName:String(body.fileName||"lighting-import").slice(0,500),
      fileType:String(body.fileType||"unknown").slice(0,120),
      imageDataUrl:sourceKind==="image"?String(body.imageDataUrl||""):undefined,
      textContent:sourceKind==="text"?String(body.textContent||""):undefined,
      language:body.language==="en"?"en":"ar"
    });
    if(result.mode!=="external"&&result.answer?.providerConfigured===false){
      return NextResponse.json({ok:false,error:"Vision/AI provider is not configured for lighting import analysis."},{status:503});
    }
    return NextResponse.json({ok:true,...result});
  }catch(error){
    const safe=publicApiError(error,"Lighting import analysis failed");
    return NextResponse.json({ok:false,error:safe.message},{status:safe.status});
  }
}
