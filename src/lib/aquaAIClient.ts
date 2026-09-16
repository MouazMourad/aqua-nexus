import type { Tank } from "@/domain/types";
import { aquaWorkspaceHeaders } from "@/lib/anonymousWorkspace";

export async function askAquaAI(input:{tank:Tank;question:string;page?:string;language:"ar"|"en"}){
  const response=await fetch("/api/ai/chat",{
    method:"POST",
    headers:aquaWorkspaceHeaders({"content-type":"application/json"}),
    body:JSON.stringify(input)
  });
  if(!response.ok)throw new Error(`Aqua AI backend failed (${response.status})`);
  return response.json() as Promise<{ok:boolean;mode:"local"|"external";provider:string;model?:string;answer:any}>;
}

export async function askAquaVision(input:{tank:Tank;imageDataUrl:string;question?:string;language:"ar"|"en"}){
  const response=await fetch("/api/ai/vision",{
    method:"POST",
    headers:aquaWorkspaceHeaders({"content-type":"application/json"}),
    body:JSON.stringify(input)
  });
  if(!response.ok)throw new Error(`Aqua Vision backend failed (${response.status})`);
  return response.json() as Promise<{ok:boolean;mode:"local"|"external";provider:string;model?:string;answer:any}>;
}
