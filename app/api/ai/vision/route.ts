import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { runAquaVision } from "@/server/aiGateway";
import { getTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const body=await request.json() as {tankId?:string;tank?:Tank;imageDataUrl?:string;question?:string;language?:"ar"|"en"};
    if(!body.imageDataUrl?.startsWith("data:image/"))return NextResponse.json({ok:false,error:"imageDataUrl must be a data:image URL"},{status:400});
    let tank=body.tank;
    if(!tank&&body.tankId)tank=(await getTank(workspace,body.tankId))?.tank;
    if(!tank)return NextResponse.json({ok:false,error:"tank or tankId is required"},{status:400});
    const result=await runAquaVision({workspace,tank,imageDataUrl:body.imageDataUrl,question:body.question,language:body.language});
    return NextResponse.json({ok:true,...result});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Vision request failed"},{status:Number(error?.status)||500});}
}
