import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { runAquaVision } from "@/server/aiGateway";
import { getTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";
import { sanitizeVisionQuestion,validateVisionDataUrl } from "@/domain/visionRequestSafety";

export const runtime="nodejs";
const MAX_REQUEST_BYTES=8*1024*1024;

export async function POST(request:NextRequest){
  try{
    const declared=Number(request.headers.get("content-length")||0);
    if(declared>MAX_REQUEST_BYTES)return NextResponse.json({ok:false,error:"Vision request exceeds the server size limit."},{status:413});

    const workspace=workspaceKey(request);
    const body=await request.json() as {tankId?:string;tank?:Tank;imageDataUrl?:string;question?:string;language?:"ar"|"en"};
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
  }catch(error:any){
    const message=error?.message||"Vision request failed";
    const status=/body|size|large/i.test(message)?413:Number(error?.status)||500;
    return NextResponse.json({ok:false,error:message},{status});
  }
}
