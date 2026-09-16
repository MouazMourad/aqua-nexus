import { NextRequest,NextResponse } from "next/server";
import { savePushSubscription } from "@/server/push";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const body=await request.json();
    const subscription=body?.subscription??body;
    await savePushSubscription(workspace,subscription);
    return NextResponse.json({ok:true});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Push registration failed"},{status:Number(error?.status)||500});}
}
