import { NextRequest,NextResponse } from "next/server";
import { saveMedia } from "@/server/mediaStore";
import { workspaceKey } from "@/server/workspace";
import { declaredBodyTooLarge,enforceRateLimit,publicApiError } from "@/server/requestSafety";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const configuredMb=Math.max(1,Number(process.env.AQUA_UPLOAD_MAX_MB||12));
    if(declaredBodyTooLarge(request,(configuredMb+1)*1024*1024))return NextResponse.json({ok:false,error:"Upload request exceeds the configured size limit."},{status:413});
    const workspace=workspaceKey(request);
    const rate=enforceRateLimit(`media:${workspace}`,20);
    if(!rate.ok)return NextResponse.json({ok:false,error:"Too many uploads. Retry shortly."},{status:429,headers:{"Retry-After":String(rate.retryAfterSeconds)}});
    const form=await request.formData();
    const file=form.get("file"),tankId=String(form.get("tankId")||"").trim();
    const livestockId=String(form.get("livestockId")||"").trim()||undefined;
    const kind=String(form.get("kind")||"photo").trim();
    if(!(file instanceof File)||!tankId)return NextResponse.json({ok:false,error:"file and tankId are required"},{status:400});
    const asset=await saveMedia({workspace,tankId,livestockId,kind,file});
    return NextResponse.json({ok:true,asset},{status:201});
  }catch(error){const safe=publicApiError(error,"Upload failed");return NextResponse.json({ok:false,error:safe.message},{status:safe.status});}
}
