import { NextRequest,NextResponse } from "next/server";
import { query } from "@/server/db";
import { sendWorkspacePush } from "@/server/push";

export const runtime="nodejs";
export const maxDuration=60;

type WatchPage="emergency"|"diseases"|"chemistry"|"maintenance"|"quarantine"|"alerts";
type WatchAlert={level:"danger"|"warn"|"info";page:WatchPage;ar:string;en:string};
type PushTankState={
  id:string;name:string;lastVisit?:number;overall?:number;chemistry?:number;maintenance?:number;trend?:string;
  unstable?:boolean;reasons?:string[];equipmentWarnings?:number;lastChemistryAt?:string|null;
  maintenanceTasks?:Array<{id?:string;title?:string;titleEn?:string;nextDue?:string|null}>;
  treatmentCount?:number;watchCount?:number;activeQuarantineCount?:number;activeEmergencyCount?:number;
  emergencyTitleAr?:string|null;emergencyTitleEn?:string|null;nextDoseAt?:string|null;doseOrganism?:string|null;
  cyclingActive?:boolean;cycleDay?:number;cycleReady?:boolean;cycleNextAr?:string|null;cycleNextEn?:string|null;
};
type PushStateRow={workspace_key:string;language:string;tanks:PushTankState[]|string;updated_at:string};

function authorized(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret)return false;
  return request.headers.get("authorization")===`Bearer ${secret}`;
}

function validTime(value?:string|null){
  const n=value?new Date(value).getTime():NaN;
  return Number.isFinite(n)?n:null;
}

function alertsFor(tank:PushTankState):WatchAlert[]{
  const alerts:WatchAlert[]=[];
  const now=Date.now();
  const today=new Date().toISOString().slice(0,10);

  if(tank.cyclingActive){
    alerts.push({
      level:tank.cycleReady?"info":"warn",page:tank.cycleReady?"maintenance":"chemistry",
      ar:tank.cycleReady?`الدورة البيولوجية — اليوم ${tank.cycleDay??1}: شروط الجاهزية تحققت؛ راجع القراءات وأنهِ Cycling Mode.`:`الدورة البيولوجية — اليوم ${tank.cycleDay??1}: ${tank.cycleNextAr||"تابع الفحوصات وخطوات الدورة."}`,
      en:tank.cycleReady?`Biological cycle — day ${tank.cycleDay??1}: readiness criteria are met; review the tests and complete Cycling Mode.`:`Biological cycle — day ${tank.cycleDay??1}: ${tank.cycleNextEn||"Continue cycle testing and follow-up."}`
    });
    if((tank.activeEmergencyCount??0)>0){
      alerts.unshift({
        level:"danger",page:"emergency",
        ar:tank.emergencyTitleAr?`حالة طارئة نشطة: ${tank.emergencyTitleAr}`:"حالة طارئة نشطة بالحوض.",
        en:tank.emergencyTitleEn?`Active emergency: ${tank.emergencyTitleEn}`:"An active tank emergency is in progress."
      });
    }
    return alerts;
  }

  if((tank.activeEmergencyCount??0)>0){
    alerts.push({
      level:"danger",page:"emergency",
      ar:tank.emergencyTitleAr?`حالة طارئة نشطة: ${tank.emergencyTitleAr}`:"حالة طارئة نشطة بالحوض.",
      en:tank.emergencyTitleEn?`Active emergency: ${tank.emergencyTitleEn}`:"An active tank emergency is in progress."
    });
  }

  if((tank.treatmentCount??0)>0){
    alerts.push({level:"danger",page:"diseases",ar:`يوجد ${tank.treatmentCount} كائن بحالة علاج/مرض مسجلة.`,en:`${tank.treatmentCount} livestock item(s) are in treatment.`});
  }else if((tank.activeQuarantineCount??0)>0){
    alerts.push({level:"danger",page:"diseases",ar:`يوجد ${tank.activeQuarantineCount} علاج أو حجر صحي نشط.`,en:`${tank.activeQuarantineCount} active treatment/quarantine case(s).`});
  }

  const chemistryAt=validTime(tank.lastChemistryAt);
  const chemistryDays=chemistryAt===null?999:Math.max(0,(now-chemistryAt)/86400000);
  if(chemistryDays>10){
    alerts.push({
      level:"warn",page:"chemistry",
      ar:chemistryAt===null?"لا يوجد فحص كيميائي حديث مسجل — يجب تحديث القياسات.":`آخر فحص كيميائي منذ ${Math.floor(chemistryDays)} يوم — يجب تحديث القياسات.`,
      en:chemistryAt===null?"No recent chemistry test is recorded — refresh the readings.":`Last chemistry test was ${Math.floor(chemistryDays)} days ago — refresh the readings.`
    });
  }

  const overdue=(tank.maintenanceTasks??[]).filter(x=>x.nextDue&&x.nextDue<today);
  const maintenance=Math.round(Number(tank.maintenance??100));
  if(overdue.length||maintenance<70){
    alerts.push({
      level:"warn",page:"maintenance",
      ar:overdue.length?`${overdue.length} مهمة صيانة متأخرة — صحة الصيانة ${maintenance}%.`:`صحة الصيانة منخفضة (${maintenance}%).`,
      en:overdue.length?`${overdue.length} overdue maintenance task(s) — maintenance health ${maintenance}%.`:`Maintenance health is low (${maintenance}%).`
    });
  }

  const doseAt=validTime(tank.nextDoseAt);
  if(doseAt!==null&&doseAt<=now){
    const organism=tank.doseOrganism||"الحالة المسجلة";
    alerts.push({level:"warn",page:"quarantine",ar:`موعد جرعة الحجر/العلاج لـ ${organism} مستحق الآن.`,en:`A quarantine/treatment dose for ${tank.doseOrganism||"the active case"} is due now.`});
  }

  if(!alerts.length&&tank.unstable){
    const reason=(tank.reasons??[])[0];
    if(reason==="equipment"||(tank.equipmentWarnings??0)>0)alerts.push({level:"warn",page:"alerts",ar:"هناك تجهيزات تحتاج انتباهاً أو صيانة.",en:"Equipment needs attention or service."});
    else if(tank.trend==="declining")alerts.push({level:"warn",page:"alerts",ar:"اتجاه صحة الحوض يتراجع ويحتاج مراجعة.",en:"Tank health is declining and needs review."});
    else alerts.push({level:"warn",page:"alerts",ar:`حالة الحوض تحتاج مراجعة${typeof tank.overall==="number"?` — الصحة ${tank.overall}%`:""}.`,en:`The tank needs review${typeof tank.overall==="number"?` — health ${tank.overall}%`:""}.`});
  }

  return alerts;
}

function parseTanks(value:PushStateRow["tanks"]):PushTankState[]{
  if(Array.isArray(value))return value;
  try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[];}catch{return [];}
}

async function run(request:NextRequest){
  if(!process.env.CRON_SECRET)return NextResponse.json({ok:false,error:"CRON_SECRET is not configured"},{status:503});
  if(!authorized(request))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});

  try{
    const rows=await query<PushStateRow>("SELECT workspace_key,language,tanks,updated_at FROM aqua_push_state ORDER BY updated_at DESC");
    const hourBucket=new Date().toISOString().slice(0,13);
    const dayBucket=new Date().toISOString().slice(0,10);
    const result:any[]=[];
    let checked=0;

    for(const row of rows.rows){
      const language=row.language==="en"?"en":"ar";
      for(const tank of parseTanks(row.tanks)){
        checked++;
        if(!tank?.id)continue;
        const alerts=alertsFor(tank);
        if(!alerts.length)continue;
        const primary=alerts.find(x=>x.level==="danger")??alerts[0];
        const jobName=tank.cyclingActive?`tank-cycle:${row.workspace_key}:${tank.id}:${dayBucket}`:`tank-watch:${row.workspace_key}:${tank.id}:${hourBucket}`;
        const prior=await query("SELECT 1 FROM aqua_job_runs WHERE job_name=$1 AND status='sent' LIMIT 1",[jobName]);
        if((prior.rowCount??0)>0){result.push({tankId:tank.id,status:"already-sent-this-hour"});continue;}

        const body=(language==="ar"?alerts.map(x=>x.ar):alerts.map(x=>x.en)).slice(0,3).join(" • ");
        const push=await sendWorkspacePush(row.workspace_key,{
          title:primary.level==="danger"?`🚨 Aqua Nexus • ${tank.name||"Tank"}`:`⚠ Aqua Nexus • ${tank.name||"Tank"}`,
          body,
          url:`/?aquaPage=${primary.page}&tankId=${encodeURIComponent(tank.id)}`,
          tag:`aqua-watch-${tank.id}`,
          renotify:true,
          data:{tankId:tank.id,level:primary.level,page:primary.page,reasons:alerts.map(x=>x.page)}
        });
        const status=push.configured&&push.sent>0?"sent":"not-delivered";
        await query("INSERT INTO aqua_job_runs(job_name,status,details) VALUES($1,$2,$3::jsonb)",[jobName,status,JSON.stringify({tankId:tank.id,alerts,push})]);
        result.push({tankId:tank.id,status,alerts:alerts.length,push});
      }
    }

    await query("DELETE FROM aqua_job_runs WHERE created_at < now() - interval '45 days'").catch(()=>{});
    return NextResponse.json({ok:true,checked,alerts:result.length,result});
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||"Tank watch failed"},{status:500});}
}

export async function GET(request:NextRequest){return run(request);}
export async function POST(request:NextRequest){return run(request);}