import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { runAquaChat } from "@/server/aiGateway";
import { getTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const body=await request.json() as {tankId?:string;tank?:Tank;question?:string;page?:string;language?:"ar"|"en"};
    if(!body.question?.trim())return NextResponse.json({ok:false,error:"question is required"},{status:400});
    let tank=body.tank;
    if(!tank&&body.tankId)tank=(await getTank(workspace,body.tankId))?.tank;
    if(!tank)return NextResponse.json({ok:false,error:"tank or tankId is required"},{status:400});
    const result=await runAquaChat({workspace,tank,question:body.question,page:body.page,language:body.language});
    return NextResponse.json({ok:true,...result});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"AI request failed"},{status:Number(error?.status)||500});}
}
