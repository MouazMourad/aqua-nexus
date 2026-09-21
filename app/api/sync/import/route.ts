import { NextRequest,NextResponse } from "next/server";
import { importTanks } from "@/server/tankRepository";
import { validateTankImportPayload } from "@/domain/backupValidation";
import { workspaceKey } from "@/server/workspace";
import { publicApiError,readJsonBodyLimited } from "@/server/requestSafety";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const body=await readJsonBodyLimited(request,32*1024*1024);
    const validated=validateTankImportPayload(body);
    if(!validated.ok)return NextResponse.json({ok:false,error:validated.error},{status:400});
    const items=await importTanks(workspace,validated.tanks);
    return NextResponse.json({ok:true,imported:items.length,items});
  }catch(error){const safe=publicApiError(error,"Import failed");return NextResponse.json({ok:false,error:safe.message},{status:safe.status});}
}
