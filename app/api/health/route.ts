import { NextResponse } from "next/server";
import { dbConfigured, query } from "@/server/db";

export const runtime="nodejs";

export async function GET(){
  if(!dbConfigured())return NextResponse.json({ok:true,app:"aqua-nexus",database:"not-configured",mode:"local-first"});
  try{
    await query("SELECT 1");
    return NextResponse.json({ok:true,app:"aqua-nexus",database:"ready",mode:"server"});
  }catch(error:any){
    return NextResponse.json({ok:false,database:"error",message:error?.message||"Database error"},{status:503});
  }
}
