import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { importTanks } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const body=await request.json() as {tanks?:Tank[]};
    if(!Array.isArray(body.tanks))return NextResponse.json({ok:false,error:"tanks array is required"},{status:400});
    const items=await importTanks(workspace,body.tanks);
    return NextResponse.json({ok:true,imported:items.length,items});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Import failed"},{status:Number(error?.status)||500});}
}
