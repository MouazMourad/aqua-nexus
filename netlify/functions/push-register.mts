import { getStore } from "@netlify/blobs";

export default async (req:Request) => {
  if(req.method!=="POST") return new Response("Method not allowed",{status:405});
  const body=await req.json().catch(()=>null) as any;
  if(!body?.deviceId||!body?.subscription||!Array.isArray(body?.tanks)) return new Response("Invalid payload",{status:400});
  const store=getStore("aqua-push-devices",{consistency:"strong"});
  const key=`device:${String(body.deviceId).slice(0,180)}`;
  const previous=await store.get(key,{type:"json"}).catch(()=>null) as any;
  await store.setJSON(key,{deviceId:body.deviceId,language:body.language==="en"?"en":"ar",subscription:body.subscription,tanks:body.tanks,updatedAt:new Date().toISOString(),lastNotifiedAt:previous?.lastNotifiedAt??null});
  return Response.json({ok:true});
};

export const config={path:"/api/push/register"};
