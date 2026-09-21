import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { listTanks,upsertTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";
import { validateTankShape } from "@/domain/backupValidation";
import { declaredBodyTooLarge,publicApiError } from "@/server/requestSafety";

export const runtime="nodejs";

function errorResponse(error:unknown){const safe=publicApiError(error,"Backend error");return NextResponse.json({ok:false,error:safe.message},{status:safe.status});}

export async function GET(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    return NextResponse.json({ok:true,items:await listTanks(workspace)});
  }catch(error){return errorResponse(error);}
}

export async function POST(request:NextRequest){
  try{
    if(declaredBodyTooLarge(request,8*1024*1024))return NextResponse.json({ok:false,error:"Tank payload exceeds the server size limit."},{status:413});
    const workspace=workspaceKey(request);
    const body=await request.json() as {tank?:Tank;expectedVersion?:number};
    const validated=validateTankShape(body?.tank,0);
    if(!validated.ok)return NextResponse.json({ok:false,error:validated.error},{status:400});
    const result=await upsertTank(workspace,validated.tank,body.expectedVersion);
    if(result.conflict)return NextResponse.json({ok:false,conflict:true,current:result.current},{status:409});
    return NextResponse.json({ok:true,...result});
  }catch(error){return errorResponse(error);}
}
