import { NextRequest,NextResponse } from "next/server";
import { saveMedia } from "@/server/mediaStore";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const workspace=workspaceKey(request);
    const form=await request.formData();
    const file=form.get("file"),tankId=String(form.get("tankId")||"").trim();
    const livestockId=String(form.get("livestockId")||"").trim()||undefined;
    const kind=String(form.get("kind")||"photo").trim();
    if(!(file instanceof File)||!tankId)return NextResponse.json({ok:false,error:"file and tankId are required"},{status:400});
    const asset=await saveMedia({workspace,tankId,livestockId,kind,file});
    return NextResponse.json({ok:true,asset},{status:201});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Upload failed"},{status:Number(error?.status)||500});}
}
