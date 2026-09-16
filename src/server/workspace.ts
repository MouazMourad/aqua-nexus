import { NextRequest } from "next/server";
import { query } from "./db";

const KEY=/^[a-zA-Z0-9_-]{12,120}$/;

export class WorkspaceError extends Error {
  status=400;
  constructor(message:string){super(message);this.name="WorkspaceError";}
}

export function workspaceKey(request:NextRequest){
  const key=request.headers.get("x-aqua-device-id")?.trim()||"";
  if(!KEY.test(key))throw new WorkspaceError("Missing or invalid x-aqua-device-id header.");
  return key;
}

export async function ensureWorkspace(key:string){
  await query("INSERT INTO aqua_workspaces(workspace_key) VALUES($1) ON CONFLICT(workspace_key) DO UPDATE SET updated_at=now()",[key]);
  return key;
}
