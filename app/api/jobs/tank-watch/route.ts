import { NextRequest,NextResponse } from "next/server";
import type { Tank } from "@/domain/types";
import { smartInsights } from "@/domain/smartInsights";
import { proactivePredictions } from "@/domain/tankLearning";
import { query } from "@/server/db";
import { sendWorkspacePush } from "@/server/push";

export const runtime="nodejs";
export const maxDuration=60;

function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret)return false;
  return request.headers.get("authorization")===`Bearer ${secret}`;
}

function alertFor(tank:Tank){
  const emergency=(tank.emergencySessions??[]).find(x=>x.status==="active");
  if(emergency)return {level:"danger",ar:`طوارئ نشطة: ${emergency.titleAr}`,en:`Active emergency: ${emergency.titleEn}`};

  const now=Date.now();
  const dose=tank.quarantine.find(x=>x.status==="active"&&x.nextDoseAt&&new Date(x.nextDoseAt).getTime()<=now);
  if(dose)return {level:"warn",ar:`موعد جرعة الحجر/العلاج لـ ${dose.organism} مستحق الآن.`,en:`A quarantine/treatment dose for ${dose.organism} is due now.`};

  const prediction=proactivePredictions(tank).find(x=>x.days<=2);
  if(prediction)return {level:prediction.level,ar:prediction.ar,en:prediction.en};

  const insight=smartInsights(tank).find(x=>x.level==="danger"||x.level==="warn");
  return insight??null;
}

async function run(request:NextRequest){
  if(!process.env.CRON_SECRET)return NextResponse.json({ok:false,error:"CRON_SECRET is not configured"},{status:503});
  if(!authorized(request))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});

  try{
    const rows=await query<{workspace_key:string;tank_id:string;name:string;data:Tank}>("SELECT workspace_key,tank_id,name,data FROM aqua_tanks ORDER BY updated_at DESC");
    const today=new Date().toISOString().slice(0,10);
    const result:any[]=[];

    for(const row of rows.rows){
      const alert=alertFor(row.data);
      if(!alert)continue;
      const jobName=`tank-watch:${row.workspace_key}:${row.tank_id}:${today}`;
      const prior=await query("SELECT 1 FROM aqua_job_runs WHERE job_name=$1 AND status='sent' LIMIT 1",[jobName]);
      if((prior.rowCount??0)>0){result.push({tankId:row.tank_id,status:"already-sent"});continue;}

      const push=await sendWorkspacePush(row.workspace_key,{
        title:alert.level==="danger"?`Aqua Nexus • ${row.name} ⚠`:`Aqua Nexus • ${row.name}`,
        body:alert.ar,
        url:"/",
        tag:`aqua-watch-${row.tank_id}`,
        data:{tankId:row.tank_id,level:alert.level}
      });
      const status=push.configured&&push.sent>0?"sent":"not-delivered";
      await query("INSERT INTO aqua_job_runs(job_name,status,details) VALUES($1,$2,$3::jsonb)",[jobName,status,JSON.stringify({tankId:row.tank_id,alert,push})]);
      result.push({tankId:row.tank_id,status,push});
    }

    return NextResponse.json({ok:true,checked:rows.rows.length,alerts:result.length,result});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Tank watch failed"},{status:500});}
}

export async function GET(request:NextRequest){return run(request);}
export async function POST(request:NextRequest){return run(request);}
