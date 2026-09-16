import { NextResponse } from "next/server";

export const runtime="nodejs";

export async function GET(){
  const publicKey=process.env.VAPID_PUBLIC_KEY||"";
  return NextResponse.json({ok:Boolean(publicKey),publicKey},{status:publicKey?200:503});
}
