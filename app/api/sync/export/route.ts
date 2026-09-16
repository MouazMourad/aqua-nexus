import { NextRequest,NextResponse } from "next/server";
import { listTanks } from "@/server/tankRepository";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

export async function GET(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const items=await listTanks(workspace);
    return NextResponse.json({ok:true,exportedAt:new Date().toISOString(),tanks:items.map(x=>x.tank),versions:Object.fromEntries(items.map(x=>[x.tank.id,x.version]))});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Export failed"},{status:Number(error?.status)||500});}
}
