import webpush from "web-push";
import { query } from "./db";

export interface PushPayload { title:string; body:string; url?:string; tag?:string; data?:Record<string,unknown>; }

function configured(){return Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);}

function setup(){
  if(!configured())return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
  return true;
}

export async function savePushSubscription(workspace:string,subscription:any){
  const endpoint=String(subscription?.endpoint||"");
  if(!endpoint.startsWith("https://"))throw Object.assign(new Error("Invalid push subscription endpoint."),{status:400});
  await query(`
    INSERT INTO aqua_push_subscriptions(workspace_key,endpoint,subscription)
    VALUES($1,$2,$3::jsonb)
    ON CONFLICT(workspace_key,endpoint) DO UPDATE SET subscription=excluded.subscription,updated_at=now()
  `,[workspace,endpoint,JSON.stringify(subscription)]);
  return true;
}

export async function removePushSubscription(workspace:string,endpoint:string){
  await query("DELETE FROM aqua_push_subscriptions WHERE workspace_key=$1 AND endpoint=$2",[workspace,endpoint]);
}

export async function sendWorkspacePush(workspace:string,payload:PushPayload){
  if(!setup())return {configured:false,sent:0,failed:0};
  const result=await query<{id:number;endpoint:string;subscription:any}>("SELECT id,endpoint,subscription FROM aqua_push_subscriptions WHERE workspace_key=$1",[workspace]);
  let sent=0,failed=0;
  for(const row of result.rows){
    try{
      await webpush.sendNotification(row.subscription,JSON.stringify(payload),{TTL:300,urgency:"high"});
      sent++;
    }catch(error:any){
      failed++;
      if(error?.statusCode===404||error?.statusCode===410){
        await query("DELETE FROM aqua_push_subscriptions WHERE id=$1",[row.id]);
      }
    }
  }
  return {configured:true,sent,failed};
}
