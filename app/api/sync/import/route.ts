import { NextRequest,NextResponse } from "next/server";
import { importTanks } from "@/server/tankRepository";
import { validateTankImportPayload } from "@/domain/backupValidation";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const body=await request.json();
    const validated=validateTankImportPayload(body);
    if(!validated.ok)return NextResponse.json({ok:false,error:validated.error},{status:400});
    const items=await importTanks(workspace,validated.tanks);
    return NextResponse.json({ok:true,imported:items.length,items});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Import failed"},{status:Number(error?.status)||500});}
}
