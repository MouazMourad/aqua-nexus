import { getStore } from "@netlify/blobs";
// @ts-ignore web-push ships runtime JS used by Netlify Functions
import webpush from "web-push";

declare const Netlify:any;

export default async () => {
  const publicKey=Netlify.env.get("VAPID_PUBLIC_KEY");
  const privateKey=Netlify.env.get("VAPID_PRIVATE_KEY");
  const subject=Netlify.env.get("VAPID_SUBJECT")||"mailto:admin@example.com";
  if(!publicKey||!privateKey){console.error("Missing VAPID configuration");return;}
  webpush.setVapidDetails(subject,publicKey,privateKey);
  const store=getStore("aqua-push-devices",{consistency:"strong"});
  const {blobs}=await store.list({prefix:"device:"});
  const now=Date.now(),week=7*86400000,day=24*3600000;
  for(const item of blobs){
    const record=await store.get(item.key,{type:"json"}).catch(()=>null) as any;
    if(!record?.subscription||!Array.isArray(record?.tanks)) continue;
    const stale=record.tanks.filter((t:any)=>Number.isFinite(Number(t.lastVisit))&&now-Number(t.lastVisit)>=week);
    if(!stale.length) continue;
    if(record.lastNotifiedAt&&now-new Date(record.lastNotifiedAt).getTime()<day) continue;
    const lang=record.language==="en"?"en":"ar";
    const names=stale.map((x:any)=>x.name).join(lang==="ar"?"، ":", ");
    const payload=JSON.stringify({title:lang==="ar"?"Aqua Nexus • متابعة الحوض":"Aqua Nexus • Tank follow-up",body:lang==="ar"?`الحوض ${names} بحاجة متابعة، مرّ أكثر من أسبوع بدون دخول.`:`${names} needs attention; it has been over a week since the last check-in.`,url:"/",tag:"aqua-weekly-followup"});
    try{
      await webpush.sendNotification(record.subscription,payload,{TTL:3600});
      await store.setJSON(item.key,{...record,lastNotifiedAt:new Date().toISOString()});
    }catch(error:any){
      const code=error?.statusCode;
      if(code===404||code===410) await store.delete(item.key);
      else console.error("Push failed",code,error?.message);
    }
  }
};

export const config={schedule:"0 9 * * *"};
