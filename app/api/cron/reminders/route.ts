import { NextRequest,NextResponse } from "next/server";
import { query } from "@/server/db";
import { sendWorkspacePush } from "@/server/push";

export const runtime="nodejs";

type PushTankState={
  id:string;name:string;lastVisit?:number;unstable?:boolean;overall?:number;chemistry?:number;maintenance?:number;trend?:string;
  equipmentWarnings?:number;cyclingActive?:boolean;cycleDay?:number;cycleReady?:boolean;cycleNextAr?:string|null;cycleNextEn?:string|null;
  activeEmergencyCount?:number;emergencyTitleAr?:string|null;emergencyTitleEn?:string|null;
  nextDoseAt?:string|null;doseOrganism?:string|null;activeQuarantineCount?:number;treatmentCount?:number;watchCount?:number;
};
type PushStateRow={workspace_key:string;language:string;tanks:PushTankState[];last_notified_at:string|null};

function reminderFor(row:PushStateRow){
  const now=Date.now(),week=7*86400000,day=24*3600000;
  if(row.last_notified_at&&now-new Date(row.last_notified_at).getTime()<20*3600000)return null;
  const tanks=Array.isArray(row.tanks)?row.tanks:[];
  const emergency=tanks.find(t=>(t.activeEmergencyCount??0)>0);
  const dueDose=tanks.find(t=>t.nextDoseAt&&new Date(t.nextDoseAt).getTime()<=now+day);
  const cycling=tanks.find(t=>t.cyclingActive);
  const unstable=tanks.filter(t=>t.unstable===true||Number(t.overall)<80||Number(t.chemistry)<75||Number(t.maintenance)<70||t.trend==="declining"||Number(t.equipmentWarnings)>0);
  const stale=tanks.filter(t=>Number.isFinite(Number(t.lastVisit))&&now-Number(t.lastVisit)>=week);
  if(!emergency&&!dueDose&&!cycling&&!unstable.length&&!stale.length)return null;
  const ar=row.language!=="en";
  if(emergency)return{
    title:ar?"Aqua Nexus • طوارئ نشطة":"Aqua Nexus • Active emergency",
    body:ar?`${emergency.name}: ${emergency.emergencyTitleAr||"هناك بروتوكول طوارئ نشط يحتاج متابعة."}`:`${emergency.name}: ${emergency.emergencyTitleEn||"An active emergency protocol needs follow-up."}`,
    tag:"aqua-emergency-followup"
  };
  if(dueDose)return{
    title:ar?"Aqua Nexus • متابعة علاج":"Aqua Nexus • Treatment follow-up",
    body:ar?`${dueDose.name}: موعد جرعة/متابعة ${dueDose.doseOrganism||"حالة الحجر"} اقترب أو حان. راجع الخطة والملصق قبل أي جرعة.`:`${dueDose.name}: a dose/follow-up for ${dueDose.doseOrganism||"quarantine"} is due or approaching. Review the plan and product label before dosing.`,
    tag:"aqua-treatment-followup"
  };
  if(cycling)return{
    title:ar?"Aqua Nexus • الدورة البيولوجية":"Aqua Nexus • Biological cycle",
    body:ar
      ?`${cycling.name} — اليوم ${cycling.cycleDay??1}: ${cycling.cycleReady?"شروط الجاهزية تحققت؛ افتح Aqua Nexus للتحقق النهائي.":(cycling.cycleNextAr||"تابع الفحوصات وخطوات الدورة.")}`
      :`${cycling.name} — day ${cycling.cycleDay??1}: ${cycling.cycleReady?"Readiness criteria are met; open Aqua Nexus for final verification.":(cycling.cycleNextEn||"Continue cycle testing and follow-up.")}`,
    tag:"aqua-cycle-followup"
  };
  const names=[...new Set([...unstable,...stale].map(t=>t.name))].join(ar?"، ":", ");
  return{
    title:ar?"Aqua Nexus • متابعة الحوض":"Aqua Nexus • Aquarium follow-up",
    body:unstable.length
      ?(ar?`${names} بحاجة مراجعة بسبب عدم الاستقرار أو وجود تنبيه مهم.`:`${names} needs review because the system is unstable or has an important alert.`)
      :(ar?`${names}: مرّ أكثر من أسبوع بدون متابعة مسجلة.`:`${names}: it has been over a week since the last recorded check-in.`),
    tag:"aqua-tank-attention"
  };
}

export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({ok:false},{status:401});
  const states=await query<PushStateRow>("SELECT workspace_key,language,tanks,last_notified_at FROM aqua_push_state ORDER BY updated_at DESC");
  let considered=0,sent=0,failed=0;
  for(const row of states.rows){
    const reminder=reminderFor(row);if(!reminder)continue;considered++;
    const result=await sendWorkspacePush(row.workspace_key,{...reminder,url:"/",renotify:true});
    sent+=result.sent;failed+=result.failed;
    if(result.sent>0)await query("UPDATE aqua_push_state SET last_notified_at=now() WHERE workspace_key=$1",[row.workspace_key]);
  }
  await query("INSERT INTO aqua_job_runs(job_name,status,details) VALUES($1,$2,$3::jsonb)",["vercel-push-reminders",failed?"partial":"ok",JSON.stringify({considered,sent,failed})]);
  return NextResponse.json({ok:true,considered,sent,failed});
}
