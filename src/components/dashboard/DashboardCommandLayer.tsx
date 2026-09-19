"use client";

import { useEffect,useMemo,useState } from "react";
import { createPortal } from "react-dom";
import type { AppPage } from "@/components/navigation/MainNav";
import { chemistryAgeDays,chemistryHealthAssessment,maintenanceHealth } from "@/domain/health";
import { healthTimeline,tankStateView } from "@/domain/tankIntelligence";
import { useAquaStore } from "@/store/useAquaStore";
import { nowISO,uid } from "@/lib/appUtils";
import { tankIntelligenceCore } from "@/domain/intelligenceCore";

type GoalKey="stability"|"chemistry"|"maintenance"|"confidence";
type RiskItem={key:string;page:AppPage;level:"danger"|"warn";ar:string;en:string};

const DAY=86400000;
const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n)));

function ageDays(ts?:string){
 if(!ts)return 999;
 const t=new Date(ts).getTime();
 return Number.isFinite(t)?Math.max(0,(Date.now()-t)/DAY):999;
}

export function DashboardCommandLayer(){
 const language=useAquaStore(s=>s.language);
 const selectedTankId=useAquaStore(s=>s.selectedTankId);
 const tanks=useAquaStore(s=>s.tanks);
 const selectTank=useAquaStore(s=>s.selectTank);
 const patchTank=useAquaStore(s=>s.patchTank);
 const tank=tanks.find(t=>t.id===selectedTankId)??tanks[0];
 const [page,setPage]=useState<AppPage>("dashboard");
 const [mount,setMount]=useState<HTMLElement|null>(null);
 const [goal,setGoal]=useState<GoalKey>("stability");
 const [compare,setCompare]=useState(50);
 const [noteOpen,setNoteOpen]=useState(false);
 const [quickNote,setQuickNote]=useState("");

 const navigate=(target:AppPage)=>{
  const button=document.querySelector<HTMLButtonElement>(`[data-aqua-page="${target}"]`);
  button?.click();
 };

 useEffect(()=>{
  const handler=(event:Event)=>{
   const detail=(event as CustomEvent<AppPage>).detail;
   if(detail)setPage(detail);
  };
  window.addEventListener("aqua:page",handler as EventListener);

  const params=new URLSearchParams(window.location.search);
  const deepTank=params.get("tankId");
  const deepPage=params.get("aquaPage") as AppPage|null;
  if(deepTank&&tanks.some(t=>t.id===deepTank))selectTank(deepTank);
  if(deepPage){
   setTimeout(()=>navigate(deepPage),180);
   params.delete("aquaPage");params.delete("tankId");
   const q=params.toString();
   window.history.replaceState({},"",`${window.location.pathname}${q?`?${q}`:""}${window.location.hash}`);
  }
  return()=>window.removeEventListener("aqua:page",handler as EventListener);
 },[]);

 useEffect(()=>{
  if(!tank||typeof window==="undefined")return;
  const key=`aqua-tank-goal:${tank.id}`;
  const saved=localStorage.getItem(key) as GoalKey|null;
  if(saved&&["stability","chemistry","maintenance","confidence"].includes(saved))setGoal(saved);
  else setGoal("stability");
 },[tank?.id]);

 useEffect(()=>{
  if(page!=="dashboard"){
   const old=document.getElementById("aqua-command-layer-mount");
   old?.remove();setMount(null);return;
  }
  let observer:MutationObserver|undefined;
  const attach=()=>{
   const dashboard=document.querySelector<HTMLElement>(".progressive-dashboard");
   if(!dashboard)return false;
   let node=document.getElementById("aqua-command-layer-mount");
   if(!node){
    node=document.createElement("div");node.id="aqua-command-layer-mount";
    const hero=dashboard.querySelector(".pd-hero");
    if(hero?.parentElement===dashboard)hero.insertAdjacentElement("afterend",node);else dashboard.prepend(node);
   }
   setMount(node);return true;
  };
  if(!attach()){
   observer=new MutationObserver(()=>{if(attach())observer?.disconnect();});
   observer.observe(document.body,{childList:true,subtree:true});
  }
  return()=>observer?.disconnect();
 },[page,tank?.id]);

 const data=useMemo(()=>{
  if(!tank)return null;
  const core=tankIntelligenceCore(tank);
  const state=core.state,chemistry=core.chemistry,chem=chemistry.score,maint=core.maintenance,chemAge=chemistryAgeDays(tank);
  const now=Date.now();
  const overdue=tank.maintenance.filter(x=>!x.done&&x.nextDue&&new Date(x.nextDue).getTime()<now);
  const equipment=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
  const treatment=tank.livestock.filter(x=>x.health==="treatment");
  const watch=tank.livestock.filter(x=>x.health==="watch");
  const activeEmergency=(tank.emergencySessions??[]).filter(x=>x.status==="active");
  const activeQuarantine=tank.quarantine.filter(x=>x.status==="active");

  const confidence=core.dataConfidence;

  const confidenceTip=chemAge>10
   ? {ar:"ابدأ بفحص كيميائي جديد؛ آخر فحص تجاوز 10 أيام.",en:"Start with a new chemistry test; the last one is over 10 days old."}
   : overdue.length
    ? {ar:"حدّث مهام الصيانة المتأخرة لرفع موثوقية التقييم.",en:"Update overdue maintenance tasks to improve confidence."}
    : (tank.healthSnapshots?.length??0)<3
     ? {ar:"كل قياس وحدث جديد يقوّي ذاكرة الحوض ودقة التحليل.",en:"Each new reading and event strengthens tank memory and analysis."}
     : {ar:"البيانات الحالية كافية لتقييم موثوق نسبياً.",en:"Current data supports a reasonably confident assessment."};

  // The dashboard alarm is the single safety surface: consume the shared
  // alert engine instead of maintaining a smaller, dashboard-only rule set.
  // Info-level follow-up stays in Today/Insights; the alarm is reserved for
  // conditions that need attention or action.
  const alertPageFallback:Record<string,AppPage>={
   chemistry:"chemistry",maintenance:"maintenance",equipment:"equipment",
   livestock:"livestock",inventory:"inventory",quarantine:"quarantine",
   emergency:"emergency",acclimation:"acclimation",system:"dashboard"
  };
  const risks:RiskItem[]=core.actions
   .filter((action):action is typeof action & {level:"danger"|"warn"}=>action.level==="danger"||action.level==="warn")
   .map(action=>({
    key:action.id,
    page:(action.page as AppPage|undefined)??alertPageFallback[action.domain]??"dashboard",
    level:action.level,
    ar:action.ar,
    en:action.en
   }));

  const today:{page:AppPage;ar:string;en:string;icon:string;priority:number}[]=[];
  const alarmPages=new Set(risks.map(x=>x.page));
  if(chemAge>7&&!alarmPages.has("chemistry"))today.push({page:"chemistry",icon:"⚗",ar:`تحديث فحص الكيمياء — آخر فحص منذ ${Math.floor(chemAge)} يوم`,en:`Refresh chemistry — last test ${Math.floor(chemAge)} days ago`,priority:1});
  if(overdue[0]&&!alarmPages.has("maintenance"))today.push({page:"maintenance",priority:2,icon:"✓",ar:`صيانة مستحقة: ${overdue[0].title}`,en:`Maintenance due: ${overdue[0].titleEn||overdue[0].title}`});
  if((treatment.length||watch.length)&&!alarmPages.has("livestock"))today.push({page:"diseases",priority:1,icon:"✚",ar:`متابعة ${treatment.length+watch.length} كائن تحت المراقبة/العلاج`,en:`Review ${treatment.length+watch.length} livestock item(s) under watch/treatment`});
  if(equipment.length&&!alarmPages.has("equipment"))today.push({page:"equipment",priority:2,icon:"⚙",ar:`فحص ${equipment.length} تجهيزات تحتاج انتباه`,en:`Check ${equipment.length} equipment item(s) needing attention`});
  if((tank.acclimationSessions??[]).some(x=>x.status!=="completed")&&!alarmPages.has("acclimation"))today.push({page:"acclimation",priority:3,icon:"⇄",ar:"متابعة جلسة الأقلمة النشطة",en:"Continue the active acclimation session"});

  today.sort((a,b)=>a.priority-b.priority);
  const history=healthTimeline(tank);
  const previous=history.at(-2),latest=history.at(-1);
  const change=previous&&latest?latest.score-previous.score:0;
  const latestEvent=previous&&latest?tank.timeline
   .filter(e=>{const t=new Date(e.timestamp).getTime();return t>=new Date(previous.timestamp).getTime()&&t<=new Date(latest.timestamp).getTime();})
   .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0]:undefined;

  const weekStart=now-7*DAY;
  const weekPoints=history.filter(x=>new Date(x.timestamp).getTime()>=weekStart);
  const weekDelta=weekPoints.length>=2?weekPoints.at(-1)!.score-weekPoints[0].score:0;
  const weekEvents=tank.timeline.filter(x=>new Date(x.timestamp).getTime()>=weekStart).length;
  const weekPhotos=tank.photos.filter(x=>new Date(x.timestamp).getTime()>=weekStart).length;
  const weekTests=tank.chemistry.filter(x=>new Date(x.timestamp).getTime()>=weekStart).length;
  const weekMaint=tank.maintenance.filter(x=>x.lastDone&&new Date(x.lastDone).getTime()>=weekStart).length;

  const recentInterventions=tank.timeline.filter(x=>{
   const t=new Date(x.timestamp).getTime();
   const text=`${x.type} ${x.textAr} ${x.textEn}`.toLowerCase();
   return now-t<=12*3600000&&/(dose|dosing|جرع|water change|تغيير ماء|equipment|معد|lighting|إضاءة|flow|تيار)/i.test(text);
  });
  const guards:{ar:string;en:string}[]=[];
  if(chemAge>10)guards.push({ar:"لا تعمل تعديل جرعات كبير قبل تحديث فحص الكيمياء.",en:"Avoid a major dosing adjustment until chemistry is refreshed."});
  if(recentInterventions.length>=2)guards.push({ar:"صار أكثر من تعديل مهم خلال 12 ساعة؛ الأفضل قياس النتيجة قبل تعديل إضافي.",en:"Multiple major changes were logged within 12 hours; measure the result before another change."});
  if(change<=-5)guards.push({ar:`الصحة هبطت ${Math.abs(change)} نقاط مؤخراً؛ غيّر عامل واحد كل مرة حتى نعرف السبب.`,en:`Health recently dropped ${Math.abs(change)} points; change one factor at a time so the cause stays traceable.`});

  const photos=[...tank.photos].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,2);
  const nearestScore=(ts:string)=>{
   if(!history.length)return null;
   const target=new Date(ts).getTime();
   const nearest=history.reduce((a,b)=>Math.abs(new Date(b.timestamp).getTime()-target)<Math.abs(new Date(a.timestamp).getTime()-target)?b:a,history[0]);
   return Math.abs(new Date(nearest.timestamp).getTime()-target)<=48*3600000?nearest.score:null;
  };

  return {state,chem,maint,chemAge,confidence,confidenceTip,risks,today,history,previous,latest,change,latestEvent,weekDelta,weekEvents,weekPhotos,weekTests,weekMaint,guards,photos,nearestScore};
 },[tank]);

 if(!tank||!data||page!=="dashboard"||!mount)return null;

 const goalDefs:Record<GoalKey,{ar:string;en:string;value:number}>={
  stability:{ar:"تثبيت صحة الحوض",en:"Stabilize tank health",value:data.state.score},
  chemistry:{ar:"تثبيت الكيمياء",en:"Stabilize chemistry",value:data.chem??0},
  maintenance:{ar:"رفع انتظام الصيانة",en:"Improve maintenance",value:data.maint},
  confidence:{ar:"رفع ثقة البيانات",en:"Improve data confidence",value:data.confidence}
 };
 const goalDef=goalDefs[goal];
 const saveGoal=(next:GoalKey)=>{setGoal(next);localStorage.setItem(`aqua-tank-goal:${tank.id}`,next);};
 const latestPhoto=data.photos[0],olderPhoto=data.photos[1];
 const quick=[
  {icon:"📷",ar:"صورة",en:"Photo",page:"journal" as AppPage},
  {icon:"🍤",ar:"تغذية",en:"Feeding",page:"feeding" as AppPage},
  {icon:"💧",ar:"تغيير ماء",en:"Water change",page:"waterchange" as AppPage},
  {icon:"💉",ar:"جرعة",en:"Dose",page:"dosing" as AppPage},
  {icon:"✓",ar:"صيانة",en:"Maintenance",page:"maintenance" as AppPage}
 ];

 const saveQuickNote=()=>{
  const text=quickNote.trim();if(!text)return;
  patchTank(tank.id,t=>({...t,timeline:[{id:uid("ev"),timestamp:nowISO(),type:"note",textAr:text,textEn:text},...t.timeline]}));
  setQuickNote("");setNoteOpen(false);
 };

 return createPortal(<>
  {data.risks.length>0&&<section className="aqua-danger-console card panel">
   <button className="danger-main" type="button" onClick={()=>navigate(data.risks[0].page)}>
    <span className="emergency-siren" aria-hidden="true"><i/><b/></span>
    <span><small>AQUA NEXUS ALERT</small><strong>{language==="ar"?"حالة تحتاج تدخل":"Action required"}</strong><em>{language==="ar"?"اضغط لفتح الصفحة المناسبة ومتابعة المشكلة":"Tap to open the relevant workflow"}</em></span>
   </button>
   <div className="danger-reasons">{data.risks.map(r=><button key={r.key} type="button" className={`danger-reason ${r.level}`} onClick={()=>navigate(r.page)}><span>{r.level==="danger"?"●":"◆"}</span><b>{language==="ar"?r.ar:r.en}</b><i>›</i></button>)}</div>
  </section>}

  <section className="aqua-command-center card panel">
   <div className="command-head"><div><small className="eyebrow-mini">AQUA NEXUS • TODAY</small><h3>{language==="ar"?"شو عليّ اليوم؟":"What needs attention today?"}</h3></div><span className={`confidence-pill ${data.confidence<60?"bad":data.confidence<80?"watch":"good"}`}>{language==="ar"?"ثقة التقييم":"Confidence"} <b>{data.confidence}%</b></span></div>
   <div className="today-actions">{data.today.length?data.today.slice(0,3).map((x,i)=><button key={i} onClick={()=>navigate(x.page)}><span>{x.icon}</span><b>{language==="ar"?x.ar:x.en}</b><i>›</i></button>):<div className="today-clear">✓ <b>{language==="ar"?"ما في إجراء ضروري اليوم":"No action is required today"}</b></div>}</div>
   <div className="command-grid">
    <article className="command-card"><small>{language==="ar"?"ثقة Aqua Nexus بالحالة":"State confidence"}</small><b className="command-big">{data.confidence}%</b><p>{language==="ar"?data.confidenceTip.ar:data.confidenceTip.en}</p><button className="text-btn" onClick={()=>navigate(data.chemAge>7?"chemistry":"maintenance")}>{language==="ar"?"حسّن الثقة":"Improve confidence"} ›</button></article>
    <article className="command-card"><small>{language==="ar"?"هدف الحوض الحالي":"Current tank goal"}</small><select value={goal} onChange={e=>saveGoal(e.target.value as GoalKey)}>{Object.entries(goalDefs).map(([key,x])=><option value={key} key={key}>{language==="ar"?x.ar:x.en}</option>)}</select><b className="command-big">{goalDef.value}%</b><div className="goal-track"><i style={{width:`${goalDef.value}%`}}/></div><p>{language==="ar"?"الهدف يبقى مثبتاً لهذا الحوض حتى تغيّره.":"This goal stays pinned to this tank until you change it."}</p></article>
    <article className="command-card"><small>{language==="ar"?"أثر آخر تغيير مسجل":"After the last recorded change"}</small><b className={`command-big ${data.change>0?"up":data.change<0?"down":""}`}>{data.change>0?`+${data.change}`:data.change} {language==="ar"?"نقطة":"pts"}</b><p>{data.latestEvent?(language==="ar"?data.latestEvent.textAr:data.latestEvent.textEn):(language==="ar"?"لا يوجد حدث حديث كافٍ للمقارنة.":"No recent event is available for comparison.")}</p><small>{language==="ar"?"هذا ارتباط زمني وليس إثبات سبب مباشر.":"This is a time association, not proof of causation."}</small></article>
   </div>

   <div className="quick-log"><b>{language==="ar"?"تسجيل سريع":"Quick log"}</b>{quick.map(x=><button key={x.page} onClick={()=>navigate(x.page)}><span>{x.icon}</span>{language==="ar"?x.ar:x.en}</button>)}<button onClick={()=>setNoteOpen(v=>!v)}><span>✎</span>{language==="ar"?"ملاحظة":"Note"}</button></div>
   {noteOpen&&<div className="quick-note"><input value={quickNote} onChange={e=>setQuickNote(e.target.value)} placeholder={language==="ar"?"اكتب ملاحظة سريعة عن الحوض…":"Write a quick tank note…"}/><button className="btn primary" onClick={saveQuickNote}>{language==="ar"?"حفظ":"Save"}</button><button className="btn" onClick={()=>setNoteOpen(false)}>×</button></div>}

   <details className="smart-followup"><summary>{language==="ar"?"متابعة ذكية إضافية":"More smart follow-up"}<span>＋</span></summary><div className="followup-grid">
    <article><small>{language==="ar"?"ملخص آخر 7 أيام":"Last 7 days"}</small><div className="weekly-kpis"><span><b>{data.weekDelta>0?`+${data.weekDelta}`:data.weekDelta}</b>{language==="ar"?"تغير الصحة":"health delta"}</span><span><b>{data.weekTests}</b>{language==="ar"?"فحوص":"tests"}</span><span><b>{data.weekMaint}</b>{language==="ar"?"صيانة":"maintenance"}</span><span><b>{data.weekPhotos}</b>{language==="ar"?"صور":"photos"}</span><span><b>{data.weekEvents}</b>{language==="ar"?"أحداث":"events"}</span></div></article>
    <article><small>{language==="ar"?"حارس الأخطاء":"Mistake Guard"}</small>{data.guards.length?data.guards.slice(0,3).map((g,i)=><p className="guard-line" key={i}>⚠ {language==="ar"?g.ar:g.en}</p>):<p className="guard-clear">✓ {language==="ar"?"ما في نمط خطر واضح من البيانات الحالية.":"No clear risky pattern in the current data."}</p>}</article>
   </div>
   {latestPhoto&&olderPhoto&&<article className="photo-compare"><div className="photo-compare-head"><div><small>{language==="ar"?"مقارنة الصور":"Before / After photos"}</small><b>{new Date(olderPhoto.timestamp).toLocaleDateString()} ↔ {new Date(latestPhoto.timestamp).toLocaleDateString()}</b></div><span>{data.nearestScore(olderPhoto.timestamp)??"N/A"}{data.nearestScore(olderPhoto.timestamp)!==null?"%":""} → {data.nearestScore(latestPhoto.timestamp)??"N/A"}{data.nearestScore(latestPhoto.timestamp)!==null?"%":""}</span></div><div className="photo-stage"><img src={olderPhoto.dataUrl} alt={olderPhoto.caption||"Older aquarium"}/><div className="photo-new" style={{clipPath:`inset(0 ${100-compare}% 0 0)`}}><img src={latestPhoto.dataUrl} alt={latestPhoto.caption||"Newer aquarium"}/></div><div className="photo-divider" style={{left:`${compare}%`}}/></div><input className="photo-slider" type="range" min="0" max="100" value={compare} onChange={e=>setCompare(Number(e.target.value))}/><div className="photo-notes"><span><b>{language==="ar"?"قبل":"Before"}</b>{olderPhoto.caption||"—"}</span><span><b>{language==="ar"?"بعد":"After"}</b>{latestPhoto.caption||"—"}</span></div></article>}
   </details>
  </section>

  <style jsx global>{`
   #aqua-command-layer-mount{display:grid;gap:10px}.aqua-danger-console{padding:12px!important;border-color:rgba(255,77,92,.38)!important;background:linear-gradient(110deg,rgba(56,10,18,.92),rgba(8,24,48,.94))!important;box-shadow:0 0 34px rgba(255,53,82,.13)}.danger-main{width:100%;border:0;background:transparent;color:inherit;display:flex;align-items:center;gap:13px;text-align:start;cursor:pointer;padding:2px}.danger-main>span:last-child{display:grid;gap:2px}.danger-main small{font-size:10px;letter-spacing:.14em;color:#ffb2ba}.danger-main strong{font-size:18px}.danger-main em{font-size:11px;font-style:normal;opacity:.7}.emergency-siren{position:relative;width:58px;height:58px;flex:0 0 58px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#ff354d 0 25%,#1a81ff 25% 50%,#ff354d 50% 75%,#1a81ff 75%);box-shadow:0 0 14px #ff354d,0 0 24px #1a81ff;animation:aquaSirenSpin 1s linear infinite}.emergency-siren:after{content:"";position:absolute;inset:9px;border-radius:50%;background:#07131f;border:2px solid rgba(255,255,255,.4)}.emergency-siren i,.emergency-siren b{position:absolute;z-index:2;width:8px;height:28px;border-radius:8px;top:15px}.emergency-siren i{left:16px;background:#ff3b51;box-shadow:0 0 12px #ff3b51}.emergency-siren b{right:16px;background:#278eff;box-shadow:0 0 12px #278eff}.danger-reasons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:10px}.danger-reason{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:inherit;border-radius:11px;padding:8px 10px;display:grid;grid-template-columns:18px 1fr 16px;gap:7px;align-items:center;text-align:start;cursor:pointer;font-size:12px}.danger-reason.danger span{color:#ff5c70}.danger-reason.warn span{color:#ffd25f}.danger-reason i{font-style:normal;font-size:18px;opacity:.7}@keyframes aquaSirenSpin{to{transform:rotate(360deg)}}
   .aqua-command-center{padding:14px!important;background:linear-gradient(145deg,rgba(8,31,45,.9),rgba(6,20,31,.94))!important}.command-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.command-head h3{margin:3px 0 0}.confidence-pill{font-size:11px;padding:7px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04)}.confidence-pill.good{color:#71e0a8}.confidence-pill.watch{color:#ffd06c}.confidence-pill.bad{color:#ff7583}.today-actions{display:grid;gap:6px;margin-top:11px}.today-actions button{border:1px solid rgba(86,220,255,.11);background:rgba(76,201,240,.045);color:inherit;border-radius:11px;padding:8px 10px;display:grid;grid-template-columns:28px 1fr 18px;gap:8px;align-items:center;text-align:start;cursor:pointer}.today-actions button i{font-style:normal;font-size:18px}.today-clear{padding:9px 10px;border-radius:11px;background:rgba(71,220,157,.07);color:#77e3ac}.command-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.command-card{border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:11px;background:rgba(255,255,255,.025);display:flex;flex-direction:column;gap:6px}.command-card small{opacity:.7}.command-card p{font-size:11px;line-height:1.45;margin:0;opacity:.74}.command-card select{width:100%;background:rgba(4,18,29,.9);color:inherit;border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:7px}.command-big{font-size:25px}.command-big.up{color:#6fe0a5}.command-big.down{color:#ff7180}.goal-track{height:6px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden}.goal-track i{display:block;height:100%;background:linear-gradient(90deg,#42c8f5,#54e5a9);border-radius:99px}.text-btn{align-self:flex-start;border:0;background:transparent;color:#68d8ff;padding:0;cursor:pointer;font-size:11px}.quick-log{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}.quick-log>b{font-size:12px;margin-inline-end:3px}.quick-log button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:inherit;border-radius:10px;padding:7px 9px;cursor:pointer;font-size:11px}.quick-log button span{margin-inline-end:4px}.quick-note{display:flex;gap:6px;margin-top:8px}.quick-note input{flex:1;min-width:0;background:rgba(2,14,23,.85);color:inherit;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 10px}.smart-followup{margin-top:10px;border-top:1px solid rgba(255,255,255,.06);padding-top:9px}.smart-followup summary{display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-weight:800;font-size:12px;list-style:none}.smart-followup[open] summary span{transform:rotate(45deg)}.followup-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.followup-grid>article,.photo-compare{border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px;background:rgba(255,255,255,.022)}.weekly-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-top:7px}.weekly-kpis span{display:flex;flex-direction:column;gap:2px;text-align:center;padding:6px;border-radius:9px;background:rgba(255,255,255,.03);font-size:9px}.weekly-kpis b{font-size:17px}.guard-line,.guard-clear{font-size:11px;line-height:1.45;margin:7px 0}.guard-line{color:#ffd277}.guard-clear{color:#74dea9}.photo-compare{margin-top:8px}.photo-compare-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.photo-compare-head div{display:grid}.photo-compare-head span{font-weight:900;color:#6fdcff}.photo-stage{position:relative;height:230px;overflow:hidden;border-radius:12px;background:#06101a}.photo-stage img{width:100%;height:100%;object-fit:cover;display:block}.photo-new{position:absolute;inset:0;overflow:hidden}.photo-new img{position:absolute;inset:0}.photo-divider{position:absolute;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 9px #6fe5ff;transform:translateX(-1px)}.photo-slider{width:100%;margin-top:7px}.photo-notes{display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:10px}.photo-notes span{display:grid;padding:6px;border-radius:8px;background:rgba(255,255,255,.03)}
   @media(max-width:760px){.danger-reasons{grid-template-columns:1fr}.command-grid{grid-template-columns:1fr}.followup-grid{grid-template-columns:1fr}.weekly-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.photo-stage{height:190px}.command-head{align-items:flex-start}.confidence-pill{white-space:nowrap}.emergency-siren{width:50px;height:50px;flex-basis:50px}.emergency-siren i,.emergency-siren b{top:11px}.quick-log{gap:5px}}
  `}</style>
 </>,mount);
}
