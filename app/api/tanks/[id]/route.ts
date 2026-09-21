import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { deleteTankVersioned,getTank,upsertTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";
import { validateTankShape } from "@/domain/backupValidation";
import { declaredBodyTooLarge,publicApiError } from "@/server/requestSafety";

export const runtime="nodejs";

type Params={params:Promise<{id:string}>};
function fail(error:unknown){const safe=publicApiError(error,"Backend error");return NextResponse.json({ok:false,error:safe.message},{status:safe.status});}

export async function GET(request:NextRequest,{params}:Params){
  try{
    const workspace=workspaceKey(request),{id}=await params;
    const item=await getTank(workspace,id);
    return item?NextResponse.json({ok:true,...item}):NextResponse.json({ok:false,error:"Tank not found"},{status:404});
  }catch(error){return fail(error);}
}

export async function PUT(request:NextRequest,{params}:Params){
  try{
    if(declaredBodyTooLarge(request,8*1024*1024))return NextResponse.json({ok:false,error:"Tank payload exceeds the server size limit."},{status:413});
    const workspace=workspaceKey(request),{id}=await params;
    const body=await request.json() as {tank?:Tank;expectedVersion?:number};
    if(!body.tank||body.tank.id!==id)return NextResponse.json({ok:false,error:"Tank id mismatch."},{status:400});
    const validated=validateTankShape(body.tank,0);
    if(!validated.ok)return NextResponse.json({ok:false,error:validated.error},{status:400});
    const result=await upsertTank(workspace,validated.tank,body.expectedVersion);
    if(result.conflict)return NextResponse.json({ok:false,conflict:true,current:result.current},{status:409});
    return NextResponse.json({ok:true,...result});
  }catch(error){return fail(error);}
}

export async function DELETE(request:NextRequest,{params}:Params){
  try{
    const workspace=workspaceKey(request),{id}=await params;
    const raw=request.nextUrl.searchParams.get("expectedVersion");
    const expectedVersion=raw!==null&&raw!==""?Number(raw):undefined;
    if(expectedVersion!==undefined&&!Number.isFinite(expectedVersion))return NextResponse.json({ok:false,error:"expectedVersion must be numeric"},{status:400});
    const result=await deleteTankVersioned(workspace,id,expectedVersion);
    if(result.conflict)return NextResponse.json({ok:false,conflict:true,current:result.current},{status:409});
    return NextResponse.json({ok:true,deleted:result.deleted});
  }catch(error){return fail(error);}
}
