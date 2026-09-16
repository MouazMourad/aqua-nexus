"use client";
import { useEffect,useState } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { SafeAquariumScene } from "@/components/three/SafeAquariumScene";
import { EquipmentPanel } from "@/components/panels/EquipmentPanel";
import { HealthTimelineChart } from "@/components/dashboard/HealthTimelineChart";
import { TankHealthShareCard } from "@/components/dashboard/TankHealthShareCard";
import { chemistryHealth,maintenanceHealth,tankHealth,tankHealthTrend,chemistryAgeDays } from "@/domain/health";
import { smartInsights } from "@/domain/smartInsights";
import { tankContextStats,tankForecast,tankStateView } from "@/domain/tankIntelligence";
import { biologicalMemory,proactivePredictions,tankMood } from "@/domain/tankLearning";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";

type ModuleId="chemistry"|"maintenance"|"forecast"|"intelligence"|"digitalTwin"|"equipment"|"predictions"|"memory"|"context"|"history"|"share";
type SceneMode="tank"|"equipment"|"flow"|"empty";
const DEFAULT_ORDER:ModuleId[]=["chemistry","maintenance","forecast","intelligence","digitalTwin","equipment","predictions","memory","context","history","share"];
const DEFAULT_HIDDEN:ModuleId[]=["predictions","memory","context","history","share"];

export function AquaDashboardContent({tank,onNavigate}:{tank:Tank;onNavigate:(p:AppPage)=>void}) {
 const lang=useAquaStore(s=>s.language);
 const ch=chemistryHealth(tank),mh=maintenanceHealth(tank),th=tankHealth(tank),trend=tankHealthTrend(tank);
 const insights=smartInsights(tank),state=tankStateView(tank),forecast=tankForecast(tank),context=tankContextStats(tank);
 const mood=tankMood(tank),predictions=proactivePredictions(tank),memory=biologicalMemory(tank);
 const today=new Date().toISOString().slice(0,10);
 const due=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today)).slice(0,5);
 const age=chemistryAgeDays(tank),latest=tank.chemistry[0]?.values??{};
 const activeAcclimation=(tank.acclimationSessions??[]).find(s=>s.status!=="completed");
 const equipmentWarnings=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
 const [expanded,setExpanded]=useState<ModuleId|null>(null),[customizing,setCustomizing]=useState(false),[sceneMode,setSceneMode]=useState<SceneMode>("tank");
 const [order,setOrder]=useState<ModuleId[]>(DEFAULT_ORDER),[hidden,setHidden]=useState<ModuleId[]>(DEFAULT_HIDDEN);

 useEffect(()=>{
  if(typeof window==="undefined")return;
  try{
   const raw=localStorage.getItem(`aqua-dashboard-layout-v2:${tank.id}`);
   if(!raw){setOrder(DEFAULT_ORDER);setHidden(DEFAULT_HIDDEN);return;}
   const saved=JSON.parse(raw) as {order?:ModuleId[];hidden?:ModuleId[]};
   const safe=(saved.order??[]).filter(x=>DEFAULT_ORDER.includes(x));
   setOrder([...safe,...DEFAULT_ORDER.filter(x=>!safe.includes(x))]);
   setHidden((saved.hidden??[]).filter(x=>DEFAULT_ORDER.includes(x)));
  }catch{setOrder(DEFAULT_ORDER);setHidden(DEFAULT_HIDDEN);}
 },[tank.id]);

 function persist(nextOrder:ModuleId[],nextHidden:ModuleId[]){
  setOrder(nextOrder);setHidden(nextHidden);
  if(typeof window!=="undefined")localStorage.setItem(`aqua-dashboard-layout-v2:${tank.id}`,JSON.stringify({order:nextOrder,hidden:nextHidden}));
 }
 function toggleModule(id:ModuleId){persist(order,hidden.includes(id)?hidden.filter(x=>x!==id):[...hidden,id]);}
 function moveModule(id:ModuleId,delta:-1|1){
  const index=order.indexOf(id),target=index+delta;
  if(index<0||target<0||target>=order.length)return;
  const next=[...order];[next[index],next[target]]=[next[target],next[index]];persist(next,hidden);
 }
 function resetLayout(){persist(DEFAULT_ORDER,DEFAULT_HIDDEN);setExpanded(null);}

 const labels:Record<ModuleId,{icon:string;ar:string;en:string}>={
  chemistry:{icon:"⚗",ar:"الكيمياء",en:"Chemistry"},maintenance:{icon:"✓",ar:"الصيانة",en:"Maintenance"},forecast:{icon:"↗",ar:"توقع 7 أيام",en:"7-day outlook"},intelligence:{icon:"✦",ar:"فهم الحوض",en:"Tank intelligence"},digitalTwin:{icon:"◫",ar:"المجسم الرقمي",en:"Digital twin"},equipment:{icon:"⚙",ar:"التجهيزات",en:"Equipment"},predictions:{icon:"⌁",ar:"التنبؤ الاستباقي",en:"Predictions"},memory:{icon:"◉",ar:"ذاكرة الحوض",en:"Tank memory"},context:{icon:"◎",ar:"سياق الحوض",en:"Tank context"},history:{icon:"▥",ar:"تاريخ الصحة",en:"Health history"},share:{icon:"↗",ar:"مشاركة",en:"Share"}
 };
 const summary:Record<ModuleId,{value:string;note:string;level?:string}>={
  chemistry:{value:`${ch}%`,note:lang==="ar"?`آخر فحص منذ ${Math.floor(age)} يوم`:`Last test ${Math.floor(age)}d ago`,level:age>7?"warn":"good"},
  maintenance:{value:due.length?String(due.length):"✓",note:lang==="ar"?(due.length?"مهام مستحقة":"لا مهام متأخرة"):(due.length?"due tasks":"nothing overdue"),level:due.length?"warn":"good"},
  forecast:{value:`${forecast.projected7d}%`,note:lang==="ar"?forecast.ar:forecast.en,level:forecast.direction==="down"?"warn":"good"},
  intelligence:{value:state.score+"%",note:insights[0]?(lang==="ar"?insights[0].ar:insights[0].en):(lang==="ar"?"لا إشارة حرجة إضافية":"No extra critical signal"),level:state.band},
  digitalTwin:{value:"3D",note:lang==="ar"?"المجسم لا يُحمّل إلا عند الطلب":"Loads only when requested"},
  equipment:{value:equipmentWarnings.length?String(equipmentWarnings.length):"✓",note:lang==="ar"?(equipmentWarnings.length?"تجهيزات تحتاج انتباه":`${tank.equipment.length} تجهيزات مسجلة`):(equipmentWarnings.length?"devices need attention":`${tank.equipment.length} devices registered`),level:equipmentWarnings.length?"warn":"good"},
  predictions:{value:String(predictions.length),note:lang==="ar"?"توقعات متاحة":"available forecasts"},
  memory:{value:String(memory.length),note:lang==="ar"?"روابط متعلمة من تاريخ الحوض":"learned history links"},
  context:{value:String(context.feedings7d),note:lang==="ar"?"تغذيات خلال 7 أيام":"feedings in 7 days"},
  history:{value:trend==="declining"?"↘":trend==="improving"?"↗":"→",note:tr(lang,trend)},
  share:{value:"↗",note:lang==="ar"?"بطاقة حالة مختصرة":"compact status card"}
 };
 const visibleOrder=order.filter(x=>!hidden.includes(x));
 const critical=state.drivers.filter(x=>x.level==="warn"||x.level==="bad").length+equipmentWarnings.length;
 const sceneView: "display"|"system"=(sceneMode==="equipment"||sceneMode==="flow")?"system":"display";

 function detailsFor(id:ModuleId){
  if(id==="chemistry")return <div className="pd-detail"><div className={`inline-alert ${age>7?"warn":"good"}`}>{tr(lang,"chemistryFreshness")}: {Math.floor(age)} {lang==="ar"?"يوم":"days"}</div><div className="chem-mini-grid compact-chem-grid">{Object.entries(latest).slice(0,6).map(([k,v])=><span key={k}><small>{k}</small><b>{String(v)}</b></span>)}</div><button className="btn primary" onClick={()=>onNavigate("chemistry")}>{tr(lang,"openChemistry")}</button></div>;
  if(id==="maintenance")return <div className="pd-detail">{due.length?due.slice(0,4).map(x=><div className="mini-row" key={x.id}><b>{lang==="ar"?x.title:(x.titleEn||x.title)}</b><span>{x.nextDue??"—"}</span></div>):<div className="inline-alert good">{tr(lang,"good")}</div>}<button className="btn primary" onClick={()=>onNavigate("maintenance")}>{tr(lang,"openMaintenance")}</button></div>;
  if(id==="forecast")return <div className="pd-detail"><div className="pd-forecast"><b>{forecast.current}%</b><span>→</span><b>{forecast.projected7d}%</b></div><p>{lang==="ar"?forecast.ar:forecast.en}</p><small>{lang==="ar"?"ثقة التوقع":"Forecast confidence"}: {forecast.confidence}</small></div>;
  if(id==="intelligence")return <div className="pd-detail">{insights.slice(0,4).map((x,i)=><div key={i} className={`inline-alert ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}<p className="note">{lang==="ar"?"للتفاعل خطوة بخطوة افتح Local Best AI من زر السمكة.":"For step-by-step interaction, open Local Best AI from the fish button."}</p></div>;
  if(id==="digitalTwin")return <div className="pd-detail pd-scene-detail"><div className="pd-scene-modes"><button className={`btn ${sceneMode==="tank"?"primary":""}`} onClick={()=>setSceneMode("tank")}>{lang==="ar"?"الحوض":"Tank"}</button><button className={`btn ${sceneMode==="equipment"?"primary":""}`} onClick={()=>setSceneMode("equipment")}>{lang==="ar"?"التجهيزات":"Equipment"}</button><button className={`btn ${sceneMode==="flow"?"primary":""}`} onClick={()=>setSceneMode("flow")}>{lang==="ar"?"اتجاه الماء":"Water flow"}</button><button className={`btn ${sceneMode==="empty"?"primary":""}`} onClick={()=>setSceneMode("empty")}>{lang==="ar"?"الحوض الفاضي":"Empty tank"}</button></div><div className="card scene-card dashboard-scene-card"><SafeAquariumScene tank={tank} view={sceneView} mode={sceneMode}/></div></div>;
  if(id==="equipment")return <div className="pd-detail"><EquipmentPanel tank={tank}/><button className="btn primary" onClick={()=>onNavigate("equipment")}>{lang==="ar"?"فتح إدارة التجهيزات":"Open equipment management"}</button></div>;
  if(id==="predictions")return <div className="pd-detail">{predictions.length?predictions.slice(0,4).map(x=><div key={x.id} className={`prediction-row ${x.level}`}><div className="prediction-days"><b>{x.days}</b><small>{lang==="ar"?"يوم":"days"}</small></div><div><b>{x.parameter}</b><p>{lang==="ar"?x.ar:x.en}</p></div></div>):<div className="note">{lang==="ar"?"لسه ما في تاريخ قياسات كافي لتنبؤ موثوق.":"Not enough history yet for a reliable forecast."}</div>}</div>;
  if(id==="memory")return <div className="pd-detail">{memory.length?memory.slice(0,5).map(x=><div className={`memory-row ${x.level}`} key={x.id}><span className="memory-arrow">{typeof x.scoreDelta==="number"?(x.scoreDelta>0?"↗":x.scoreDelta<0?"↘":"→"):"•"}</span><div><b>{lang==="ar"?x.event.textAr:x.event.textEn}</b><p>{lang==="ar"?x.ar:x.en}</p></div></div>):<div className="note">{lang==="ar"?"الذاكرة تحتاج أحداث وقياسات أكثر.":"Memory needs more events and readings."}</div>}</div>;
  if(id==="context")return <div className="pd-detail"><div className="context-kpis"><span><small>{lang==="ar"?"تغذية / 7 أيام":"Feedings / 7d"}</small><b>{context.feedings7d}</b></span><span><small>{lang==="ar"?"جرعات / 7 أيام":"Doses / 7d"}</small><b>{context.dosing7d}</b></span><span><small>{lang==="ar"?"تغيير ماء / 30 يوم":"Water changes / 30d"}</small><b>{context.waterChanges30d}</b></span><span><small>{lang==="ar"?"حجر نشط":"Active quarantine"}</small><b>{context.activeQuarantine}</b></span></div></div>;
  if(id==="history")return <div className="pd-detail"><HealthTimelineChart tank={tank}/></div>;
  return <div className="pd-detail"><TankHealthShareCard tank={tank}/></div>;
 }

 return <div className="dashboard-final progressive-dashboard">
  <section className={`card panel pd-hero state-${state.band}`}>
   <div className="pd-hero-main"><div><small className="eyebrow-mini">AQUA NEXUS • NOW</small><h2>{tank.name}</h2><div className="pd-mood-line"><span className={`mood-orb mood-${mood.key}`}><b>{mood.symbol}</b></span><div><b>{lang==="ar"?mood.ar:mood.en}</b><p>{lang==="ar"?mood.noteAr:mood.noteEn}</p></div></div></div><div className="pd-health-score"><small>{tr(lang,"tankHealth")}</small><b>{th}%</b><span className={`trend-${trend}`}>{tr(lang,trend)}</span></div></div>
   <div className="pd-hero-footer"><span className={critical?"warn":"good"}>{critical?`⚠ ${critical} ${lang==="ar"?"إشارة تحتاج انتباه":"signal(s) need attention"}`:`✓ ${lang==="ar"?"لا يوجد تنبيه حرج":"No critical alert"}`}</span><button className="btn glass-button" onClick={()=>setCustomizing(v=>!v)}>⚙ {lang==="ar"?"تخصيص الواجهة":"Customize"}</button></div>
  </section>

  {activeAcclimation&&<div className="inline-alert info pd-active-alert"><b>{tr(lang,"activeAcclimation")}</b><button className="btn" onClick={()=>onNavigate("acclimation")}>{tr(lang,"openAcclimation")}</button></div>}

  {customizing&&<section className="card panel pd-customizer"><div className="module-head"><div><small className="eyebrow-mini">DASHBOARD LAYOUT</small><h3>{lang==="ar"?"اختار شو يظهر ورتّب الصناديق":"Choose what appears and arrange it"}</h3></div><button className="btn" onClick={resetLayout}>{lang==="ar"?"إعادة الافتراضي":"Reset"}</button></div><div className="pd-custom-list">{order.map((id,i)=><div className="pd-custom-row" key={id}><label><input type="checkbox" checked={!hidden.includes(id)} onChange={()=>toggleModule(id)}/><span>{labels[id].icon} {lang==="ar"?labels[id].ar:labels[id].en}</span></label><div><button className="icon-btn" disabled={i===0} onClick={()=>moveModule(id,-1)}>↑</button><button className="icon-btn" disabled={i===order.length-1} onClick={()=>moveModule(id,1)}>↓</button></div></div>)}</div></section>}

  <div className="pd-module-grid">{visibleOrder.map(id=>{const isOpen=expanded===id,s=summary[id],l=labels[id];return <section className={`card panel pd-module ${isOpen?"is-open":""}`} key={id}><button type="button" className="pd-module-button" onClick={()=>setExpanded(isOpen?null:id)}><span className="pd-module-icon">{l.icon}</span><span className="pd-module-copy"><small>{lang==="ar"?l.ar:l.en}</small><b>{s.value}</b><em>{s.note}</em></span><span className={`pd-module-state ${s.level??""}`}>{isOpen?"−":"+"}</span></button>{isOpen&&detailsFor(id)}</section>})}</div>

  <style jsx global>{`
   .progressive-dashboard{display:grid;gap:14px}.pd-hero{padding:18px 20px;background:linear-gradient(135deg,rgba(13,44,61,.94),rgba(4,20,31,.96));overflow:hidden}.pd-hero-main{display:flex;justify-content:space-between;gap:18px;align-items:center}.pd-hero h2{margin:3px 0 10px;font-size:clamp(20px,3vw,30px)}.pd-mood-line{display:flex;align-items:center;gap:10px}.pd-mood-line p{margin:3px 0 0;opacity:.74;max-width:680px}.pd-health-score{min-width:132px;text-align:center;padding:13px;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(255,255,255,.04)}.pd-health-score small,.pd-health-score span{display:block}.pd-health-score b{display:block;font-size:38px;line-height:1.05;margin:4px 0}.pd-hero-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}.pd-hero-footer>span{font-size:13px;font-weight:800}.pd-hero-footer .good{color:#75e6b0}.pd-hero-footer .warn{color:#ffd27a}.pd-active-alert{display:flex;align-items:center;justify-content:space-between;gap:8px}.pd-module-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}.pd-module{padding:0!important;overflow:hidden;transition:.2s ease}.pd-module.is-open{grid-column:span 2;border-color:rgba(68,213,255,.28);box-shadow:0 16px 38px rgba(0,0,0,.18)}.pd-module-button{width:100%;min-height:116px;border:0;background:transparent;color:inherit;padding:15px;display:grid;grid-template-columns:38px 1fr 28px;align-items:center;gap:10px;text-align:start;cursor:pointer}.pd-module-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:13px;background:rgba(64,210,255,.1);border:1px solid rgba(64,210,255,.15);font-size:19px}.pd-module-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.pd-module-copy small{font-size:12px;opacity:.68;font-weight:800}.pd-module-copy b{font-size:25px;line-height:1.15}.pd-module-copy em{font-style:normal;font-size:12px;line-height:1.35;opacity:.68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pd-module-state{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.06);font-weight:900}.pd-module-state.warn{color:#ffd27a}.pd-module-state.good{color:#75e6b0}.pd-detail{border-top:1px solid rgba(255,255,255,.07);padding:14px 15px 16px;display:grid;gap:10px}.pd-forecast{display:flex;align-items:center;justify-content:center;gap:16px;font-size:22px}.pd-forecast b{font-size:32px}.pd-scene-detail{padding:10px}.pd-scene-modes{display:flex;gap:7px;flex-wrap:wrap}.pd-scene-detail .dashboard-scene-card{margin:0}.pd-customizer{padding:15px}.pd-custom-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.pd-custom-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025)}.pd-custom-row label{display:flex;gap:8px;align-items:center;font-weight:750}.pd-custom-row>div{display:flex;gap:4px}.pd-custom-row .icon-btn{width:30px;height:30px}.pd-custom-row .icon-btn:disabled{opacity:.25}.progressive-dashboard .aquarium-scene-wrap{min-height:420px}.progressive-dashboard .context-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
   @media(max-width:900px){.pd-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pd-module.is-open{grid-column:1/-1}.pd-custom-list{grid-template-columns:1fr}}
   @media(max-width:620px){.progressive-dashboard{gap:10px}.pd-hero{padding:14px}.pd-hero-main{align-items:flex-start}.pd-mood-line p{font-size:12px}.pd-health-score{min-width:102px;padding:10px}.pd-health-score b{font-size:31px}.pd-hero-footer{align-items:stretch;flex-direction:column}.pd-module-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pd-module{border-radius:15px}.pd-module-button{min-height:104px;padding:11px;grid-template-columns:32px 1fr 23px;gap:7px}.pd-module-icon{width:32px;height:32px;border-radius:10px;font-size:16px}.pd-module-copy b{font-size:21px}.pd-module-copy em{font-size:11px}.pd-module.is-open{grid-column:1/-1}.pd-customizer{padding:11px}.progressive-dashboard .aquarium-scene-wrap{min-height:360px}}
  `}</style>
 </div>;
}
