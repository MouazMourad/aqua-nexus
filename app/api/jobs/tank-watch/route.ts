import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { chemistryAgeDays,maintenanceHealth } from "@/domain/health";
import { smartInsights } from "@/domain/smartInsights";
import { proactivePredictions } from "@/domain/tankLearning";
import { query } from "@/server/db";
import { sendWorkspacePush } from "@/server/push";

export const runtime="nodejs";
export const maxDuration=60;

type WatchAlert={level:"danger"|"warn"|"info";page:"emergency"|"diseases"|"chemistry"|"maintenance"|"quarantine"|"alerts";ar:string;en:string};

function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret)return false;
  return request.headers.get("authorization")===`Bearer ${secret}`;
}

function alertsFor(tank:Tank):WatchAlert[]{
  const alerts:WatchAlert[]=[];
  const emergency=(tank.emergencySessions??[]).find(x=>x.status==="active");
  if(emergency)alerts.push({level:"danger",page:"emergency",ar:`حالة طارئة نشطة: ${emergency.titleAr}`,en:`Active emergency: ${emergency.titleEn}`});

  const treatment=tank.livestock.filter(x=>x.health==="treatment");
  const activeQuarantine=tank.quarantine.filter(x=>x.status==="active");
  if(treatment.length)alerts.push({level:"danger",page:"diseases",ar:`يوجد ${treatment.length} كائن بحالة علاج/مرض مسجلة.`,en:`${treatment.length} livestock item(s) are in treatment.`});
  else if(activeQuarantine.length)alerts.push({level:"danger",page:"diseases",ar:`يوجد ${activeQuarantine.length} علاج أو حجر صحي نشط.`,en:`${activeQuarantine.length} active treatment/quarantine case(s).`});

  const age=chemistryAgeDays(tank);
  if(age>10)alerts.push({level:"warn",page:"chemistry",ar:`آخر فحص كيميائي منذ ${Math.floor(age)} يوم — يجب تحديث القياسات.`,en:`Last chemistry test was ${Math.floor(age)} days ago — refresh the readings.`});

  const now=Date.now(),maint=maintenanceHealth(tank);
  const overdue=tank.maintenance.filter(x=>!x.done&&x.nextDue&&new Date(x.nextDue).getTime()<now);
  if(overdue.length||maint<70)alerts.push({level:"warn",page:"maintenance",ar:overdue.length?`${overdue.length} مهمة صيانة متأخرة — صحة الصيانة ${maint}%.`:`صحة الصيانة منخفضة (${maint}%).`,en:overdue.length?`${overdue.length} overdue maintenance task(s) — maintenance health ${maint}%.`:`Maintenance health is low (${maint}%).`});

  const dose=tank.quarantine.find(x=>x.status==="active"&&x.nextDoseAt&&new Date(x.nextDoseAt).getTime()<=now);
  if(dose)alerts.push({level:"warn",page:"quarantine",ar:`موعد جرعة الحجر/العلاج لـ ${dose.organism} مستحق الآن.`,en:`A quarantine/treatment dose for ${dose.organism} is due now.`});

  if(!alerts.length){
    const prediction=proactivePredictions(tank).find(x=>x.days<=2&&(x.level==="danger"||x.level==="warn"));
    if(prediction)alerts.push({level:prediction.level==="danger"?"danger":"warn",page:"alerts",ar:prediction.ar,en:prediction.en});
    else {
      const insight=smartInsights(tank).find(x=>x.level==="danger"||x.level==="warn");
      if(insight)alerts.push({level:insight.level==="danger"?"danger":"warn",page:"alerts",ar:insight.ar,en:insight.en});
    }
  }
  return alerts;
}

async function run(request:NextRequest){
  if(!process.env.CRON_SECRET)return NextResponse.json({ok:false,error:"CRON_SECRET is not configured"},{status:503});
  if(!authorized(request))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});

  try{
    const rows=await query<{workspace_key:string;tank_id:string;name:string;data:Tank}>("SELECT workspace_key,tank_id,name,data FROM aqua_tanks ORDER BY updated_at DESC");
    const hourBucket=new Date().toISOString().slice(0,13);
    const result:any[]=[];

    for(const row of rows.rows){
      const alerts=alertsFor(row.data);
      if(!alerts.length)continue;
      const primary=alerts.find(x=>x.level==="danger")??alerts[0];
      const jobName=`tank-watch:${row.workspace_key}:${row.tank_id}:${hourBucket}`;
      const prior=await query("SELECT 1 FROM aqua_job_runs WHERE job_name=$1 AND status='sent' LIMIT 1",[jobName]);
      if((prior.rowCount??0)>0){result.push({tankId:row.tank_id,status:"already-sent-this-hour"});continue;}

      const bodyAr=alerts.slice(0,3).map(x=>x.ar).join(" • ");
      const push=await sendWorkspacePush(row.workspace_key,{
        title:primary.level==="danger"?`🚨 Aqua Nexus • ${row.name}`:`⚠ Aqua Nexus • ${row.name}`,
        body:bodyAr,
        url:`/?aquaPage=${primary.page}&tankId=${encodeURIComponent(row.tank_id)}`,
        tag:`aqua-watch-${row.tank_id}`,
        renotify:true,
        data:{tankId:row.tank_id,level:primary.level,page:primary.page,reasons:alerts.map(x=>x.key??x.page)}
      });
      const status=push.configured&&push.sent>0?"sent":"not-delivered";
      await query("INSERT INTO aqua_job_runs(job_name,status,details) VALUES($1,$2,$3::jsonb)",[jobName,status,JSON.stringify({tankId:row.tank_id,alerts,push})]);
      result.push({tankId:row.tank_id,status,alerts:alerts.length,push});
    }

    return NextResponse.json({ok:true,checked:rows.rows.length,alerts:result.length,result});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Tank watch failed"},{status:500});}
}

export async function GET(request:NextRequest){return run(request);}
export async function POST(request:NextRequest){return run(request);}