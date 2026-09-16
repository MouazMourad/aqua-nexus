import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { deleteTank,getTank,upsertTank } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

type Params={params:Promise<{id:string}>};
function fail(error:any){return NextResponse.json({ok:false,error:error?.message||"Backend error"},{status:Number(error?.status)||500});}

export async function GET(request:NextRequest,{params}:Params){
  try{
    const workspace=workspaceKey(request),{id}=await params;
    const item=await getTank(workspace,id);
    return item?NextResponse.json({ok:true,...item}):NextResponse.json({ok:false,error:"Tank not found"},{status:404});
  }catch(error){return fail(error);}
}

export async function PUT(request:NextRequest,{params}:Params){
  try{
    const workspace=workspaceKey(request),{id}=await params;
    const body=await request.json() as {tank?:Tank;expectedVersion?:number};
    if(!body.tank||body.tank.id!==id)return NextResponse.json({ok:false,error:"Tank id mismatch."},{status:400});
    const result=await upsertTank(workspace,body.tank,body.expectedVersion);
    if(result.conflict)return NextResponse.json({ok:false,conflict:true,current:result.current},{status:409});
    return NextResponse.json({ok:true,...result});
  }catch(error){return fail(error);}
}

export async function DELETE(request:NextRequest,{params}:Params){
  try{
    const workspace=workspaceKey(request),{id}=await params;
    const deleted=await deleteTank(workspace,id);
    return NextResponse.json({ok:true,deleted});
  }catch(error){return fail(error);}
}
