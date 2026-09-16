import { NextRequest,NextResponse } from "next/server";
import { removePushSubscription,savePushSubscription } from "@/server/push";
import { query } from "@/server/db";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const body=await request.json();
    const subscription=body?.subscription??body;
    await savePushSubscription(workspace,subscription);
    if(Array.isArray(body?.tanks)){
      const language=body?.language==="en"?"en":"ar";
      await query(`
        INSERT INTO aqua_push_state(workspace_key,language,tanks,updated_at)
        VALUES($1,$2,$3::jsonb,now())
        ON CONFLICT(workspace_key)
        DO UPDATE SET language=excluded.language,tanks=excluded.tanks,updated_at=now()
      `,[workspace,language,JSON.stringify(body.tanks)]);
    }
    return NextResponse.json({ok:true});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Push registration failed"},{status:Number(error?.status)||500});}
}

export async function DELETE(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const body=await request.json() as {endpoint?:string};
    if(!body.endpoint)return NextResponse.json({ok:false,error:"endpoint is required"},{status:400});
    await removePushSubscription(workspace,body.endpoint);
    return NextResponse.json({ok:true});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Push removal failed"},{status:Number(error?.status)||500});}
}