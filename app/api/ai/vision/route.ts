import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { runAquaVision } from "@/server/aiGateway";
import { getTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";
import { sanitizeVisionQuestion,validateVisionDataUrl } from "@/domain/visionRequestSafety";
import { enforceRateLimitDistributed,publicApiError,readJsonBodyLimited } from "@/server/requestSafety";

export const runtime="nodejs";
const MAX_REQUEST_BYTES=8*1024*1024;

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const rate=await enforceRateLimitDistributed(`ai-vision:${workspace}`,10);
    if(!rate.ok)return NextResponse.json({ok:false,error:"Too many Vision requests. Retry shortly."},{status:429,headers:{"Retry-After":String(rate.retryAfterSeconds)}});
    const body=await readJsonBodyLimited<{tankId?:string;tank?:Tank;imageDataUrl?:string;question?:string;language?:"ar"|"en"}>(request,MAX_REQUEST_BYTES);
    const imageDataUrl=String(body.imageDataUrl||"");
    const safe=validateVisionDataUrl(imageDataUrl);
    if(!safe.ok)return NextResponse.json({ok:false,error:safe.error},{status:safe.error?.includes("size limit")?413:400});

    let tank=body.tank;
    if(!tank&&body.tankId)tank=(await getTank(workspace,body.tankId))?.tank;
    if(!tank)return NextResponse.json({ok:false,error:"tank or tankId is required"},{status:400});

    const result=await runAquaVision({
      workspace,
      tank,
      imageDataUrl,
      question:sanitizeVisionQuestion(body.question),
      language:body.language==="en"?"en":"ar"
    });
    return NextResponse.json({ok:true,...result});
  }catch(error){
    const safe=publicApiError(error,"Vision request failed");
    return NextResponse.json({ok:false,error:safe.message},{status:safe.status});
  }
}
