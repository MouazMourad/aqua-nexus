import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { runAquaChat } from "@/server/aiGateway";
import { getTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";
import { enforceRateLimitDistributed,publicApiError,readJsonBodyLimited,sanitizeAIQuestion } from "@/server/requestSafety";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const rate=await enforceRateLimitDistributed(`ai-chat:${workspace}`,30);
    if(!rate.ok)return NextResponse.json({ok:false,error:"Too many AI requests. Retry shortly."},{status:429,headers:{"Retry-After":String(rate.retryAfterSeconds)}});
    const body=await readJsonBodyLimited<{tankId?:string;tank?:Tank;question?:string;page?:string;language?:"ar"|"en"}>(request,4*1024*1024);
    const question=sanitizeAIQuestion(body.question);
    if(!question)return NextResponse.json({ok:false,error:"question is required"},{status:400});
    let tank=body.tank;
    if(!tank&&body.tankId)tank=(await getTank(workspace,body.tankId))?.tank;
    if(!tank)return NextResponse.json({ok:false,error:"tank or tankId is required"},{status:400});
    const result=await runAquaChat({workspace,tank,question,page:body.page,language:body.language});
    return NextResponse.json({ok:true,...result});
  }catch(error){const safe=publicApiError(error,"AI request failed");return NextResponse.json({ok:false,error:safe.message},{status:safe.status});}
}
