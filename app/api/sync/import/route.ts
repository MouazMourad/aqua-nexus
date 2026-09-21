import { NextRequest,NextResponse } from "next/server";
import { importTanks } from "@/server/tankRepository";
import { validateTankImportPayload } from "@/domain/backupValidation";
import { workspaceKey } from "@/server/workspace";
import { declaredBodyTooLarge,publicApiError } from "@/server/requestSafety";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    if(declaredBodyTooLarge(request,32*1024*1024))return NextResponse.json({ok:false,error:"Import payload exceeds the server size limit."},{status:413});
    const workspace=workspaceKey(request);
    const body=await request.json();
    const validated=validateTankImportPayload(body);
    if(!validated.ok)return NextResponse.json({ok:false,error:validated.error},{status:400});
    const items=await importTanks(workspace,validated.tanks);
    return NextResponse.json({ok:true,imported:items.length,items});
  }catch(error){const safe=publicApiError(error,"Import failed");return NextResponse.json({ok:false,error:safe.message},{status:safe.status});}
}
