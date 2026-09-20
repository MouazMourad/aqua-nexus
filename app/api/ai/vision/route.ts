import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { sanitizeVisionQuestion,validateVisionDataUrl } from "@/domain/visionRequestSafety";
import { runAquaVision } from "@/server/aiGateway";
import { getTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

const WINDOW_MS=60_000,MAX_REQUESTS=8;
const buckets=new Map<string,{startedAt:number;count:number}>();

function allowVisionRequest(key:string){
  const now=Date.now(),entry=buckets.get(key);
  if(!entry||now-entry.startedAt>=WINDOW_MS){buckets.set(key,{startedAt:now,count:1});return true}
  if(entry.count>=MAX_REQUESTS)return false;
  entry.count++;return true;
}

export async function POST(request:NextRequest){
  try{
    const contentLength=Number(request.headers.get("content-length")||0);
    if(Number.isFinite(contentLength)&&contentLength>10*1024*1024)return NextResponse.json({ok:false,error:"Vision request is too large"},{status:413});

    const workspace=workspaceKey(request);
    if(!allowVisionRequest(workspace))return NextResponse.json({ok:false,error:"Too many Vision requests. Try again in a minute."},{status:429});

    const body=await request.json() as {tankId?:string;tank?:Tank;imageDataUrl?:string;question?:string;language?:"ar"|"en"};
    const imageDataUrl=body.imageDataUrl||"";
    const imageCheck=validateVisionDataUrl(imageDataUrl);
    if(!imageCheck.ok)return NextResponse.json({ok:false,error:imageCheck.error},{status:imageCheck.approximateBytes?413:400});

    let tank=body.tank;
    if(tank){
      const tankBytes=Buffer.byteLength(JSON.stringify(tank),"utf8");
      if(tankBytes>2.5*1024*1024)return NextResponse.json({ok:false,error:"Tank context is too large for a Vision request"},{status:413});
      if(!tank.id||!tank.name||(tank.type!=="marine"&&tank.type!=="freshwater"))return NextResponse.json({ok:false,error:"Invalid tank context"},{status:400});
    }
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
  }catch(error:any){
    return NextResponse.json({ok:false,error:error?.message||"Vision request failed"},{status:Number(error?.status)||500});
  }
}
