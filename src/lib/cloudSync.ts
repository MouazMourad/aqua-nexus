import type { Tank } from "@/domain/types";
import { aquaWorkspaceHeaders } from "@/lib/anonymousWorkspace";

export async function backendHealth(){
  const response=await fetch("/api/health",{cache:"no-store"});
  return response.json() as Promise<{ok:boolean;database:string;mode:string}>;
}

export async function backupTanks(tanks:Tank[]){
  const response=await fetch("/api/sync/import",{
    method:"POST",
    headers:aquaWorkspaceHeaders({"content-type":"application/json"}),
    body:JSON.stringify({tanks})
  });
  if(!response.ok)throw new Error(`Cloud backup failed (${response.status})`);
  return response.json();
}

export async function restoreTanks(){
  const response=await fetch("/api/sync/export",{headers:aquaWorkspaceHeaders(),cache:"no-store"});
  if(!response.ok)throw new Error(`Cloud restore failed (${response.status})`);
  return response.json() as Promise<{ok:boolean;tanks:Tank[];versions:Record<string,number>}>;
}

export async function backupTank(tank:Tank,expectedVersion?:number){
  const response=await fetch(`/api/tanks/${encodeURIComponent(tank.id)}`,{
    method:"PUT",
    headers:aquaWorkspaceHeaders({"content-type":"application/json"}),
    body:JSON.stringify({tank,expectedVersion})
  });
  const json=await response.json();
  if(response.status===409)return {ok:false,conflict:true,...json};
  if(!response.ok)throw new Error(json?.error||`Tank backup failed (${response.status})`);
  return json;
}

export async function deleteCloudTank(tankId:string,expectedVersion?:number){
  const suffix=expectedVersion===undefined?"":`?expectedVersion=${encodeURIComponent(String(expectedVersion))}`;
  const response=await fetch(`/api/tanks/${encodeURIComponent(tankId)}${suffix}`,{method:"DELETE",headers:aquaWorkspaceHeaders()});
  const json=await response.json();
  if(response.status===409)return {ok:false,conflict:true,...json};
  if(!response.ok)throw new Error(json?.error||`Tank delete failed (${response.status})`);
  return json as {ok:true;deleted:boolean};
}
