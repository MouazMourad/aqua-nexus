import { NextRequest,NextResponse } from "next/server";
import { loadMedia } from "@/server/mediaStore";
import { workspaceKey } from "@/server/workspace";

export const runtime="nodejs";
type Params={params:Promise<{id:string}>};

export async function GET(request:NextRequest,{params}:Params){
  try{
    const workspace=workspaceKey(request),{id}=await params;
    const asset=await loadMedia(workspace,id);
    if(!asset)return NextResponse.json({ok:false,error:"Media not found"},{status:404});
    return new NextResponse(new Uint8Array(asset.data),{status:200,headers:{"content-type":asset.mimeType,"content-length":String(asset.sizeBytes),"cache-control":"private, max-age=3600"}});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Media read failed"},{status:Number(error?.status)||500});}
}
