import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { listTanks,upsertTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

function errorResponse(error:any){
  const status=Number(error?.status)||500;
  return NextResponse.json({ok:false,error:error?.message||"Backend error"},{status});
}

export async function GET(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    return NextResponse.json({ok:true,items:await listTanks(workspace)});
  }catch(error){return errorResponse(error);}
}

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const body=await request.json() as {tank?:Tank;expectedVersion?:number};
    if(!body?.tank?.id||!body.tank.name||!body.tank.type)return NextResponse.json({ok:false,error:"A valid tank payload is required."},{status:400});
    const result=await upsertTank(workspace,body.tank,body.expectedVersion);
    if(result.conflict)return NextResponse.json({ok:false,conflict:true,current:result.current},{status:409});
    return NextResponse.json({ok:true,...result});
  }catch(error){return errorResponse(error);}
}
