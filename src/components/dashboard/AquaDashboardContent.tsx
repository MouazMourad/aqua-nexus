"use client";

import { useEffect,useState } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { SafeAquariumScene } from "@/components/three/SafeAquariumScene";
import { EquipmentPanel } from "@/components/panels/EquipmentPanel";
import { TankHealthShareCard } from "@/components/dashboard/TankHealthShareCard";
import { TankJourney } from "@/components/dashboard/TankJourney";
import { bioload,chemistryAgeDays,chemistryHealthAssessment,maintenanceHealth } from "@/domain/health";
import { systemHealthTrend } from "@/domain/systemHealth";
import { tankIntelligenceCore } from "@/domain/intelligenceCore";
import { smartInsights } from "@/domain/smartInsights";
import { tankContextStats,tankForecast,tankStateView } from "@/domain/tankIntelligence";
import { biologicalMemory,proactivePredictions,tankMood } from "@/domain/tankLearning";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { maintenanceTaskDue } from "@/domain/maintenanceSchedule";

type ModuleId="chemistry"|"maintenance"|"bioload"|"forecast"|"intelligence"|"digitalTwin"|"equipment"|"predictions"|"memory"|"context"|"journey";
type SceneMode="tank"|"equipment"|"flow"|"empty";

const DEFAULT_ORDER:ModuleId[]=["chemistry","maintenance","bioload","forecast","intelligence","digitalTwin","equipment","predictions","memory","context","journey"];
const DEFAULT_HIDDEN:ModuleId[]=[];
const LAYOUT_KEY="aqua-dashboard-layout-v3";

export function AquaDashboardContent({tank,onNavigate}:{tank:Tank;onNavigate:(p:AppPage)=>void}) {
 const lang=useAquaStore(s=>s.language);
 const core=tankIntelligenceCore(tank);
 const chemistry=core.chemistry,ch=chemistry.score,mh=core.maintenance,trend=systemHealthTrend(tank),bio=core.bioload;
 const system=core.health,th=system.score;
 const insights=core.insights,state=core.state,forecast=core.forecast,context=tankContextStats(tank);
 const mood=tankMood(tank),predictions=core.predictions,memory=core.memory;
 const today=new Date().toISOString().slice(0,10);
 const due=tank.maintenance.filter(x=>maintenanceTaskDue(x,today)).slice(0,5);
 const age=chemistryAgeDays(tank),latest=tank.chemistry[0]?.values??{};
 const activeAcclimation=(tank.acclimationSessions??[]).find(s=>s.status!=="completed");
 const equipmentWarnings=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");

 const fishItems=tank.livestock.filter(x=>x.category==="fish"),invertItems=tank.livestock.filter(x=>x.category==="invert");
 const reefCategory:"coral"|"plant"=tank.type==="marine"?"coral":"plant";
 const reefItems=tank.livestock.filter(x=>x.category===reefCategory);
 const fishCount=fishItems.reduce((s,x)=>s+x.quantity,0),invertCount=invertItems.reduce((s,x)=>s+x.quantity,0),reefCount=reefItems.reduce((s,x)=>s+x.quantity,0);

 const [expanded,setExpanded]=useState<ModuleId|null>(null);
 const [customizing,setCustomizing]=useState(false);
 const [sceneMode,setSceneMode]=useState<SceneMode>("tank");
 const [shareOpen,setShareOpen]=useState(false);
 const [order,setOrder]=useState<ModuleId[]>(DEFAULT_ORDER);
 const [hidden,setHidden]=useState<ModuleId[]>(DEFAULT_HIDDEN);

 useEffect(()=>{
  if(typeof window==="undefined")return;
  try{
   const raw=localStorage.getItem(`${LAYOUT_KEY}:${tank.id}`);
   if(!raw){setOrder(DEFAULT_ORDER);setHidden(DEFAULT_HIDDEN);return;}
   const saved=JSON.parse(raw) as {order?:ModuleId[];hidden?:ModuleId[]};
   const safe=(saved.order??[]).filter(x=>DEFAULT_ORDER.includes(x));
   setOrder([...safe,...DEFAULT_ORDER.filter(x=>!safe.includes(x))]);
   setHidden((saved.hidden??[]).filter(x=>DEFAULT_ORDER.includes(x)));
  }catch{setOrder(DEFAULT_ORDER);setHidden(DEFAULT_HIDDEN);}
 },[tank.id]);

 function persist(nextOrder:ModuleId[],nextHidden:ModuleId[]){
  setOrder(nextOrder);setHidden(nextHidden);
  if(typeof window!=="undefined")localStorage.setItem(`${LAYOUT_KEY}:${tank.id}`,JSON.stringify({order:nextOrder,hidden:nextHidden}));
 }
 function toggleModule(id:ModuleId){persist(order,hidden.includes(id)?hidden.filter(x=>x!==id):[...hidden,id]);}
 function moveModule(id:ModuleId,delta:-1|1){
  const index=order.indexOf(id),target=index+delta;
  if(index<0||target<0||target>=order.length)return;
  const next=[...order];[next[index],next[target]]=[next[target],next[index]];persist(next,hidden);
 }
 function resetLayout(){persist(DEFAULT_ORDER,DEFAULT_HIDDEN);setExpanded(null);}

 const bioLabel=lang==="ar"?(bio.status==="danger"?"مرتفع جداً":bio.status==="high"?"مرتفع":bio.status==="good"?"مناسب":"منخفض"):(bio.status==="danger"?"Very high":bio.status==="high"?"High":bio.status==="good"?"Good":"Low");
 const livestockSummary=`🐟 ${fishCount} • 🦐 ${invertCount} • ${tank.type==="marine"?"🪸":"🌿"} ${reefCount}`;
 const healthMark=(health:string)=>health==="good"?"🟢":health==="watch"?"🟡":"🔴";
 const journeyPoints=(tank.healthSnapshots?.length??0)+tank.chemistry.length;
 const journeyStart=new Date(tank.createdAt).toLocaleDateString(lang==="ar"?"ar-SY":"en-US",{year:"numeric",month:"short",day:"numeric"});

 const labels:Record<ModuleId,{icon:string;ar:string;en:string}>={
  chemistry:{icon:"⚗",ar:"الكيمياء",en:"Chemistry"},
  maintenance:{icon:"✓",ar:"الصيانة",en:"Maintenance"},
  bioload:{icon:"◌",ar:"الحمل الحيوي",en:"Bioload"},
  forecast:{icon:"↗",ar:"توقع 7 أيام",en:"7-day outlook"},
  intelligence:{icon:"✦",ar:"فهم الحوض",en:"Tank intelligence"},
  digitalTwin:{icon:"◫",ar:"المجسم الرقمي",en:"Digital twin"},
  equipment:{icon:"⚙",ar:"التجهيزات",en:"Equipment"},
  predictions:{icon:"⌁",ar:"التنبؤ الاستباقي",en:"Predictions"},
  memory:{icon:"◉",ar:"ذاكرة الحوض",en:"Tank memory"},
  context:{icon:"◎",ar:"سياق الحوض",en:"Tank context"},
  journey:{icon:"〽",ar:"مسار الحوض",en:"Tank Journey"}
 };

 const summary:Record<ModuleId,{value:string;note:string;level?:string}>={
  chemistry:{value:ch===null?"N/A":`${ch}%`,note:ch===null?(lang==="ar"?"لا توجد قياسات كافية":"Not enough measured data"):(lang==="ar"?`آخر فحص منذ ${Math.floor(age)} يوم • ثقة ${chemistry.dataConfidence}%`:`Last test ${Math.floor(age)}d ago • confidence ${chemistry.dataConfidence}%`),level:ch===null||chemistry.critical||age>7?"warn":"good"},
  maintenance:{value:`${mh}%`,note:lang==="ar"?(due.length?`${due.length} مهام مستحقة`:"لا مهام متأخرة"):(due.length?`${due.length} due task(s)`:"nothing overdue"),level:mh<70||due.length?"warn":"good"},
  bioload:{value:`${Math.round(bio.ratio*100)}%`,note:livestockSummary,level:bio.status==="danger"||bio.status==="high"?"warn":"good"},
  forecast:{value:forecast.projected7d===null?"N/A":`${forecast.projected7d}%`,note:lang==="ar"?forecast.ar:forecast.en,level:forecast.projected7d===null||forecast.direction==="declining"?"warn":"good"},
  intelligence:{value:state.score+"%",note:insights[0]?(lang==="ar"?insights[0].ar:insights[0].en):(lang==="ar"?"لا إشارة حرجة إضافية":"No extra critical signal"),level:state.band},
  digitalTwin:{value:"3D",note:lang==="ar"?"يفتح عند الطلب فقط":"Loads on demand"},
  equipment:{value:`${system.equipment}%`,note:lang==="ar"?(system.equipmentAudit.issues[0]?.ar||system.equipmentAudit.suggestions[0]?.ar||`${tank.equipment.length} تجهيزات مسجلة`):(system.equipmentAudit.issues[0]?.en||system.equipmentAudit.suggestions[0]?.en||`${tank.equipment.length} devices registered`),level:system.equipment<75?"warn":"good"},
  predictions:{value:String(predictions.length),note:lang==="ar"?"توقعات متاحة":"available forecasts"},
  memory:{value:String(memory.length),note:lang==="ar"?"روابط متعلمة من تاريخ الحوض":"learned history links"},
  context:{value:String(context.feedings7d),note:lang==="ar"?"تغذيات خلال 7 أيام":"feedings in 7 days"},
  journey:{value:tank.photos.length?`📷 ${tank.photos.length}`:`〽 ${journeyPoints}`,note:trend==="unknown"?(lang==="ar"?"تاريخ غير كافٍ لتحديد الاتجاه":"Not enough history for a trend"):(lang==="ar"?`من ${journeyStart} حتى اليوم`:`${journeyStart} → today`),level:trend==="declining"||trend==="unknown"?"warn":"good"}
 };

 const visibleOrder=order.filter(x=>!hidden.includes(x));
 const critical=core.actions.filter(x=>x.level==="warn"||x.level==="danger").length;
 const knownComponents=system.components.filter(x=>x.known);
 const activeActionCount=core.actions.length;
 const nextAction=core.actions[0];
 const actionPageAliases:Record<string,AppPage>={"water-change":"waterchange","waterChange":"waterchange"};
 const nextActionPage:AppPage=nextAction?((actionPageAliases[nextAction.page]??nextAction.page) as AppPage):"dashboard";
 const statePlain=lang==="ar"
  ?(state.band==="excellent"||state.band==="stable"?"الحوض مستقر":state.band==="watch"?"الحوض يحتاج متابعة":"الحوض يحتاج تدخل")
  :(state.band==="excellent"||state.band==="stable"?"Tank is stable":state.band==="watch"?"Tank needs attention":"Tank needs action");
 const riskPlain=lang==="ar"
  ?(critical?(String(critical)+" تنبيه يحتاج انتباه"):"لا يوجد خطر حرج الآن")
  :(critical?(String(critical)+" alert"+(critical===1?"":"s")+" need attention"):"No critical risk right now");
 const nextPlain=nextAction
  ?(lang==="ar"?nextAction.ar:nextAction.en)
  :(lang==="ar"?"لا يوجد إجراء عاجل الآن":"No urgent action right now");
 const componentState=(score:number,known:boolean)=>{
  if(!known)return {tone:"unknown",ar:"بيانات ناقصة",en:"Missing data"};
  if(score>=85)return {tone:"good",ar:"مستقر",en:"Stable"};
  if(score>=70)return {tone:"watch",ar:"يحتاج متابعة",en:"Watch"};
  return {tone:"danger",ar:"يحتاج تدخل",en:"Needs action"};
 };
 const sceneView:"display"|"system"=(sceneMode==="equipment"||sceneMode==="flow")?"system":"display";

 function detailsFor(id:ModuleId){
  if(id==="chemistry")return <div className="pd-detail"><div className={`inline-alert ${age>7?"warn":"good"}`}>{tr(lang,"chemistryFreshness")}: {Math.floor(age)} {lang==="ar"?"يوم":"days"}</div><div className="chem-mini-grid compact-chem-grid">{Object.entries(latest).slice(0,6).map(([k,v])=><span key={k}><small>{k}</small><b>{String(v)}</b></span>)}</div><button className="btn primary" onClick={()=>onNavigate("chemistry")}>{tr(lang,"openChemistry")}</button></div>;

  if(id==="maintenance")return <div className="pd-detail"><div className={`inline-alert ${mh<70?"warn":"good"}`}><b>{lang==="ar"?"صحة الصيانة":"Maintenance health"}: {mh}%</b></div>{due.length?due.slice(0,4).map(x=><div className="mini-row" key={x.id}><b>{lang==="ar"?x.title:(x.titleEn||x.title)}</b><span>{x.nextDue??"—"}</span></div>):<div className="inline-alert good">{tr(lang,"good")}</div>}<button className="btn primary" onClick={()=>onNavigate("maintenance")}>{tr(lang,"openMaintenance")}</button></div>;

  if(id==="bioload"){
   const groups=[
    {key:"fish",icon:"🐟",title:lang==="ar"?"الأسماك":"Fish",items:fishItems,count:fishCount},
    {key:"invert",icon:"🦐",title:lang==="ar"?"القشريات / اللافقاريات":"Invertebrates",items:invertItems,count:invertCount},
    {key:"reef",icon:tank.type==="marine"?"🪸":"🌿",title:lang==="ar"?(tank.type==="marine"?"المرجان":"النباتات"):(tank.type==="marine"?"Corals":"Plants"),items:reefItems,count:reefCount}
   ];
   return <div className="pd-detail"><div className={`inline-alert ${bio.status==="danger"||bio.status==="high"?"warn":"good"}`}><b>{lang==="ar"?"الحمل الحيوي التقريبي":"Estimated bioload"}: {Math.round(bio.ratio*100)}%</b> • {bioLabel}</div><div className="pd-livestock-groups">{groups.map(group=><section className="pd-livestock-group" key={group.key}><div className="pd-livestock-head"><b>{group.icon} {group.title}</b><span>{group.count}</span></div>{group.items.length?group.items.map(item=><div className="pd-livestock-row" key={item.id}><span>{healthMark(item.health)} {lang==="ar"?item.name:(item.nameEn||item.name)}</span><b>×{item.quantity}</b></div>):<small className="note">{lang==="ar"?"لا يوجد عناصر مسجلة":"No registered items"}</small>}</section>)}</div><p className="note">{lang==="ar"?`المؤشر تقريبي ويعتمد على الكائنات المسجلة وحجم النظام (${tank.systemVolumeLiters.toFixed(0)} لتر).`:`This estimate uses registered livestock and system volume (${tank.systemVolumeLiters.toFixed(0)} L).`}</p><button className="btn primary" onClick={()=>onNavigate("livestock")}>{lang==="ar"?"فتح الكائنات":"Open livestock"}</button></div>;
  }

  if(id==="forecast")return <div className="pd-detail"><div className="pd-forecast"><b>{forecast.current}%</b><span>→</span><b>{forecast.projected7d===null?"N/A":`${forecast.projected7d}%`}</b></div><p>{lang==="ar"?forecast.ar:forecast.en}</p><small>{lang==="ar"?"ثقة التوقع":"Forecast confidence"}: {forecast.confidence}</small></div>;

  if(id==="intelligence")return <div className="pd-detail">{state.drivers.slice(0,4).map((x,i)=><div key={`driver-${i}`} className={`inline-alert ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}{insights.slice(0,2).map((x,i)=><div key={`insight-${i}`} className={`inline-alert ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}<p className="note">{lang==="ar"?"للتفاعل خطوة بخطوة افتح Local Best AI من زر السمكة.":"For step-by-step interaction, open Local Best AI from the fish button."}</p></div>;

  if(id==="digitalTwin")return <div className="pd-detail pd-scene-detail"><div className="pd-scene-modes"><button className={`btn ${sceneMode==="tank"?"primary":""}`} onClick={()=>setSceneMode("tank")}>{lang==="ar"?"الحوض":"Tank"}</button><button className={`btn ${sceneMode==="equipment"?"primary":""}`} onClick={()=>setSceneMode("equipment")}>{lang==="ar"?"التجهيزات":"Equipment"}</button><button className={`btn ${sceneMode==="flow"?"primary":""}`} onClick={()=>setSceneMode("flow")}>{lang==="ar"?"اتجاه الماء":"Water flow"}</button><button className={`btn ${sceneMode==="empty"?"primary":""}`} onClick={()=>setSceneMode("empty")}>{lang==="ar"?"الحوض الفاضي":"Empty tank"}</button></div><div className="card scene-card dashboard-scene-card"><SafeAquariumScene tank={tank} view={sceneView} mode={sceneMode}/></div></div>;

  if(id==="equipment")return <div className="pd-detail">
   <div className={`inline-alert ${system.equipment<75?"warn":"good"}`}><b>{lang==="ar"?"كفاية التجهيزات":"Equipment adequacy"}: {system.equipment}%</b> • {lang==="ar"?`تغطية بيانات القياس ${system.equipmentAudit.sizingCoverage}%`:`Sizing-data coverage ${system.equipmentAudit.sizingCoverage}%`}</div>
   {system.equipmentAudit.issues.slice(0,4).map(x=><div className={`inline-alert ${x.level}`} key={x.id}><b>{lang==="ar"?x.ar:x.en}</b>{(x.recommendationAr||x.recommendationEn)&&<p>{lang==="ar"?x.recommendationAr:x.recommendationEn}</p>}</div>)}
   {system.equipmentAudit.suggestions.slice(0,3).map(x=><div className={`inline-alert ${x.level}`} key={x.id}><b>{lang==="ar"?x.ar:x.en}</b>{(x.recommendationAr||x.recommendationEn)&&<p>{lang==="ar"?x.recommendationAr:x.recommendationEn}</p>}</div>)}
   <EquipmentPanel tank={tank}/>
   <button className="btn primary" onClick={()=>onNavigate("equipment")}>{lang==="ar"?"فتح إدارة التجهيزات":"Open equipment management"}</button>
  </div>;

  if(id==="predictions")return <div className="pd-detail">{predictions.length?predictions.slice(0,4).map(x=><div key={x.id} className={`prediction-row ${x.level}`}><div className="prediction-days"><b>{x.days}</b><small>{lang==="ar"?"يوم":"days"}</small></div><div><b>{x.parameter}</b><p>{lang==="ar"?x.ar:x.en}</p></div></div>):<div className="note">{lang==="ar"?"لسه ما في تاريخ قياسات كافي لتنبؤ موثوق.":"Not enough history yet for a reliable forecast."}</div>}</div>;

  if(id==="memory")return <div className="pd-detail">{memory.length?memory.slice(0,5).map(x=><div className={`memory-row ${x.level}`} key={x.id}><span className="memory-arrow">{typeof x.scoreDelta==="number"?(x.scoreDelta>0?"↗":x.scoreDelta<0?"↘":"→"):"•"}</span><div><b>{lang==="ar"?x.event.textAr:x.event.textEn}</b><p>{lang==="ar"?x.ar:x.en}</p></div></div>):<div className="note">{lang==="ar"?"الذاكرة تحتاج أحداث وقياسات أكثر.":"Memory needs more events and readings."}</div>}</div>;

  if(id==="context")return <div className="pd-detail"><div className="context-kpis"><span><small>{lang==="ar"?"تغذية / 7 أيام":"Feedings / 7d"}</small><b>{context.feedings7d}</b></span><span><small>{lang==="ar"?"جرعات / 7 أيام":"Doses / 7d"}</small><b>{context.dosing7d}</b></span><span><small>{lang==="ar"?"تغيير ماء / 30 يوم":"Water changes / 30d"}</small><b>{context.waterChanges30d}</b></span><span><small>{lang==="ar"?"حجر نشط":"Active quarantine"}</small><b>{context.activeQuarantine}</b></span><span><small>{lang==="ar"?"مصاريف الشهر":"This month"}</small><b>{context.monthlySpend.toFixed(0)} {context.currency}</b></span></div></div>;

  return <div className="pd-detail pd-journey-detail"><TankJourney tank={tank}/></div>;
 }

 return <div className="dashboard-final progressive-dashboard">
  <section className={`card panel pd-hero state-${state.band}`}>
   <div className="pd-hero-main"><div><small className="eyebrow-mini">AQUA NEXUS • NOW</small><h2>{tank.name}</h2><div className="pd-mood-line"><span className={`mood-orb mood-${mood.key}`}><b>{mood.symbol}</b></span><div><b>{lang==="ar"?mood.ar:mood.en}</b><p>{lang==="ar"?mood.noteAr:mood.noteEn}</p></div></div></div><div className="pd-health-score"><small>{tr(lang,"tankHealth")}</small><b>{th}%</b><span className={`trend-${trend}`}>{tr(lang,trend)}</span></div></div>
   <div className="pd-first-look" aria-label={lang==="ar"?"ملخص الحوض الآن":"Tank summary now"}>
   <div className="pd-first-card"><small>{lang==="ar"?"كيف الحوض؟":"How is the tank?"}</small><b>{statePlain}</b><span>{th}% • {tr(lang,trend)}</span></div>
   <button type="button" className={"pd-first-card pd-first-action "+(critical?"warn":"good")} onClick={()=>critical&&onNavigate("alerts")} disabled={!critical}><small>{lang==="ar"?"في خطر؟":"Any risk?"}</small><b>{riskPlain}</b><span>{critical?(lang==="ar"?"اضغط لمراجعة التنبيهات":"Open alerts"):(lang==="ar"?"المحرك لم يرصد خطر حرج":"No critical signal detected")}</span></button>
   <button type="button" className="pd-first-card pd-first-action" onClick={()=>nextAction&&onNavigate(nextActionPage)} disabled={!nextAction}><small>{lang==="ar"?"شو أعمل هلا؟":"What should I do now?"}</small><b>{nextPlain}</b><span>{nextAction?(lang==="ar"?"اضغط لفتح الإجراء":"Open the action"):(lang==="ar"?"استمر بالمراقبة الروتينية":"Continue routine monitoring")}</span></button>
   </div>
   <div className="pd-intelligence-proof"><b>✦ {lang==="ar"?"محرك Aqua Nexus يربط بيانات الحوض ببعضها":"Aqua Nexus connects tank evidence across the system"}</b><span>{knownComponents.length}/{system.components.length} {lang==="ar"?"محاور صحة لديها أدلة":"health domains with evidence"}</span><span>{lang==="ar"?"ثقة القرار":"Decision confidence"} {core.dataConfidence}%</span><span>{activeActionCount} {lang==="ar"?"إجراء ذكي نشط":"active smart action(s)"}</span><span>{tank.intelligenceEvents?.length??0} {lang==="ar"?"حدث مترابط":"linked event(s)"}</span><span>{memory.length} {lang==="ar"?"رابط متعلّم":"learned link(s)"}</span></div>
   <div className="pd-system-health-strip">{system.components.map(x=>{const cs=componentState(x.score,x.known);return <span key={x.key} className={`state-${cs.tone}`}><small>{lang==="ar"?x.ar:x.en}</small><b>{lang==="ar"?cs.ar:cs.en}</b><em>{x.known?`${x.score}%`:"—"}</em></span>})}</div>
   <div className="pd-hero-footer"><span className={critical?"warn":"good"}>{critical?`⚠ ${critical} ${lang==="ar"?"إشارة تحتاج انتباه":"signal(s) need attention"}`:`✓ ${lang==="ar"?"لا يوجد تنبيه حرج":"No critical alert"}`}</span><div className="pd-hero-actions"><button className="btn glass-button pd-share-button" onClick={()=>setShareOpen(v=>!v)}>↗ {lang==="ar"?"مشاركة":"Share"}</button><div className="pd-customize-wrap"><small>ⓘ {lang==="ar"?"يمكنك إخفاء أو إظهار الصناديق وتغيير ترتيبها":"Hide, show or reorder dashboard cards"}</small><button className="btn glass-button" onClick={()=>setCustomizing(v=>!v)}>⚙ {lang==="ar"?"تعديل الواجهة":"Customize"}</button></div></div></div>
  </section>

  {shareOpen&&<section className="card panel pd-inline-share"><div className="module-head"><h3>↗ {lang==="ar"?"مشاركة حالة الحوض":"Share tank status"}</h3><button className="icon-btn" onClick={()=>setShareOpen(false)}>×</button></div><TankHealthShareCard tank={tank}/></section>}

  {activeAcclimation&&<div className="inline-alert info pd-active-alert"><b>{tr(lang,"activeAcclimation")}</b><button className="btn" onClick={()=>onNavigate("acclimation")}>{tr(lang,"openAcclimation")}</button></div>}
{system.compatibilityAudit.issues.length>0&&<div className={`inline-alert ${system.compatibilityAudit.level==="danger"?"danger":"warn"} pd-compatibility-alert`}><div><b>⚠ {lang==="ar"?"تعارض كائنات مستمر":"Persistent livestock compatibility alert"}</b><p>{lang==="ar"?system.compatibilityAudit.issues[0].ar:system.compatibilityAudit.issues[0].en}</p>{system.compatibilityAudit.issues.length>1&&<small>{lang==="ar"?`وفي ${system.compatibilityAudit.issues.length-1} ملاحظة توافق إضافية.`:`${system.compatibilityAudit.issues.length-1} additional compatibility issue(s).`}</small>}</div><button className="btn" onClick={()=>onNavigate("livestock")}>{lang==="ar"?"راجع الكائنات":"Review livestock"}</button></div>}


  {customizing&&<section className="card panel pd-customizer"><div className="module-head"><div><small className="eyebrow-mini">DASHBOARD LAYOUT</small><h3>{lang==="ar"?"اختار شو يظهر ورتّب صناديق التحليل":"Choose and arrange analysis cards"}</h3><p className="note">{lang==="ar"?"الحالة والخطر والإجراء المطلوب اليوم تبقى ظاهرة دائماً؛ التخصيص يغيّر طبقة التفاصيل فقط حتى ما تضيع المعلومة الأساسية.":"Tank state, risk and today’s action always stay visible. Customization changes only the deeper analysis layer."}</p></div><button className="btn" onClick={resetLayout}>{lang==="ar"?"إعادة الافتراضي":"Reset"}</button></div><div className="pd-custom-list">{order.map((id,i)=><div className="pd-custom-row" key={id}><label><input type="checkbox" checked={!hidden.includes(id)} onChange={()=>toggleModule(id)}/><span>{labels[id].icon} {lang==="ar"?labels[id].ar:labels[id].en}</span></label><div><button className="icon-btn" disabled={i===0} onClick={()=>moveModule(id,-1)}>↑</button><button className="icon-btn" disabled={i===order.length-1} onClick={()=>moveModule(id,1)}>↓</button></div></div>)}</div></section>}

  <div className="pd-module-grid">{visibleOrder.map(id=>{const isOpen=expanded===id,s=summary[id],l=labels[id];return <section className={`card panel pd-module ${isOpen?"is-open":""} ${id==="journey"&&isOpen?"journey-open":""}`} key={id}><button type="button" className="pd-module-button" onClick={()=>setExpanded(isOpen?null:id)}><span className="pd-module-icon">{l.icon}</span><span className="pd-module-copy"><small>{lang==="ar"?l.ar:l.en}</small><b>{s.value}</b><em>{s.note}</em></span><span className={`pd-module-state ${s.level??""}`}>{isOpen?"−":"+"}</span></button>{isOpen&&detailsFor(id)}</section>})}</div>

  <style jsx global>{`
   .progressive-dashboard{display:grid;gap:14px}.pd-hero{padding:18px 20px;background:linear-gradient(135deg,rgba(13,44,61,.94),rgba(4,20,31,.96));overflow:hidden;display:flex;flex-direction:column}.pd-hero-main{display:flex;justify-content:space-between;gap:18px;align-items:center;order:0}.pd-first-look{order:1}.pd-intelligence-proof{order:2}.pd-system-health-strip{order:3}.pd-hero-footer{order:4}.pd-hero h2{margin:3px 0 10px;font-size:clamp(20px,3vw,30px)}.pd-mood-line{display:flex;align-items:center;gap:10px}.pd-mood-line p{margin:3px 0 0;opacity:.74;max-width:680px}.pd-health-score{min-width:132px;text-align:center;padding:13px;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(255,255,255,.04)}.pd-health-score small,.pd-health-score span{display:block}.pd-health-score b{display:block;font-size:38px;line-height:1.05;margin:4px 0}.pd-first-look{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.pd-first-card{min-width:0;border:1px solid rgba(255,255,255,.075);border-radius:13px;padding:10px 11px;background:rgba(255,255,255,.025);color:inherit;text-align:start;display:grid;gap:3px}.pd-first-card small{font-size:10px;opacity:.58;font-weight:800}.pd-first-card b{font-size:14px;line-height:1.35}.pd-first-card span{font-size:10px;opacity:.64;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pd-first-action{cursor:pointer}.pd-first-action:not(:disabled):hover{border-color:rgba(83,218,255,.28);background:rgba(83,218,255,.055)}.pd-first-action.warn{border-color:rgba(255,210,122,.24)}.pd-first-action.good{border-color:rgba(117,230,176,.16)}.pd-first-action:disabled{cursor:default;opacity:1}.pd-intelligence-proof{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px;padding:9px 10px;border:1px solid rgba(78,214,255,.11);border-radius:12px;background:rgba(63,205,241,.035);font-size:10px}.pd-intelligence-proof b{color:#7fe4ff;font-size:11px}.pd-intelligence-proof span{padding-inline-start:8px;border-inline-start:1px solid rgba(255,255,255,.08);opacity:.72}.pd-system-health-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:8px}.pd-system-health-strip span{position:relative;padding:8px;border:1px solid rgba(255,255,255,.065);border-radius:10px;background:rgba(255,255,255,.025);text-align:center}.pd-system-health-strip span:before{content:"";position:absolute;inset-inline-start:0;top:9px;bottom:9px;width:2px;border-radius:4px;background:#67dda8}.pd-system-health-strip span.state-watch:before{background:#ffd16f}.pd-system-health-strip span.state-danger:before{background:#ff7480}.pd-system-health-strip span.state-unknown:before{background:#7b8c98}.pd-system-health-strip small,.pd-system-health-strip b,.pd-system-health-strip em{display:block}.pd-system-health-strip small{font-size:9px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pd-system-health-strip b{font-size:11px;margin-top:3px}.pd-system-health-strip em{font-style:normal;font-size:10px;opacity:.55;margin-top:1px}.pd-hero-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}.pd-hero-footer>span{font-size:13px;font-weight:800}.pd-hero-footer .good{color:#75e6b0}.pd-hero-footer .warn{color:#ffd27a}.pd-hero-actions{display:flex;gap:9px;align-items:flex-end}.pd-share-button{border-color:rgba(78,214,255,.24)}.pd-customize-wrap{display:flex;flex-direction:column;gap:4px;align-items:stretch}.pd-customize-wrap small{font-size:10px;opacity:.56;max-width:240px;line-height:1.25}.pd-inline-share{padding:14px}.pd-inline-share>.card{margin:0}.pd-now-actions{padding:14px}.pd-now-list{display:grid;gap:7px}.pd-now-action{width:100%;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:inherit;border-radius:13px;padding:10px 11px;display:grid;grid-template-columns:30px 1fr 20px;gap:9px;align-items:center;text-align:start;cursor:pointer}.pd-now-action.warn{border-color:rgba(255,210,122,.22)}.pd-now-action.danger{border-color:rgba(255,105,105,.28)}.pd-now-rank{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(64,210,255,.1);font-weight:900}.pd-now-action span:nth-child(2){display:grid;gap:2px}.pd-now-action small{opacity:.62}.pd-now-action i{font-style:normal;opacity:.65}.pd-active-alert{display:flex;align-items:center;justify-content:space-between;gap:8px}.pd-compatibility-alert{display:flex;align-items:center;justify-content:space-between;gap:10px}.pd-compatibility-alert p{margin:4px 0 0}.pd-compatibility-alert small{display:block;margin-top:3px;opacity:.72}.pd-module-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}.pd-module{padding:0!important;overflow:hidden;transition:.2s ease}.pd-module.is-open{grid-column:span 2;border-color:rgba(68,213,255,.28);box-shadow:0 16px 38px rgba(0,0,0,.18)}.pd-module.journey-open{grid-column:1/-1}.pd-module-button{width:100%;min-height:116px;border:0;background:transparent;color:inherit;padding:15px;display:grid;grid-template-columns:38px 1fr 28px;align-items:center;gap:10px;text-align:start;cursor:pointer}.pd-module-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:13px;background:rgba(64,210,255,.1);border:1px solid rgba(64,210,255,.15);font-size:19px}.pd-module-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.pd-module-copy small{font-size:12px;opacity:.68;font-weight:800}.pd-module-copy b{font-size:25px;line-height:1.15}.pd-module-copy em{font-style:normal;font-size:12px;line-height:1.35;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pd-module-state{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.06);font-weight:900}.pd-module-state.warn{color:#ffd27a}.pd-module-state.good{color:#75e6b0}.pd-detail{border-top:1px solid rgba(255,255,255,.07);padding:14px 15px 16px;display:grid;gap:10px}.pd-journey-detail{padding:14px}.pd-forecast{display:flex;align-items:center;justify-content:center;gap:16px;font-size:22px}.pd-forecast b{font-size:32px}.pd-livestock-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pd-livestock-group{border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px;background:rgba(255,255,255,.025)}.pd-livestock-head,.pd-livestock-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.pd-livestock-head{padding-bottom:8px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,.06)}.pd-livestock-head>span{min-width:27px;height:27px;display:grid;place-items:center;border-radius:9px;background:rgba(64,210,255,.1);font-weight:900}.pd-livestock-row{font-size:12px;padding:5px 0}.pd-livestock-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pd-scene-detail{padding:10px}.pd-scene-modes{display:flex;gap:7px;flex-wrap:wrap}.pd-scene-detail .dashboard-scene-card{margin:0}.pd-customizer{padding:15px}.pd-custom-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.pd-custom-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025)}.pd-custom-row label{display:flex;gap:8px;align-items:center;font-weight:750}.pd-custom-row>div{display:flex;gap:4px}.pd-custom-row .icon-btn{width:30px;height:30px}.pd-custom-row .icon-btn:disabled{opacity:.25}.progressive-dashboard .aquarium-scene-wrap{min-height:420px}.progressive-dashboard .context-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
   @media(max-width:900px){.pd-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pd-module.is-open{grid-column:1/-1}.pd-custom-list{grid-template-columns:1fr}.pd-livestock-groups{grid-template-columns:1fr}}
   @media(max-width:620px){.pd-first-look{grid-template-columns:1fr}.pd-first-card{padding:9px 10px}.pd-first-card b{font-size:13px}.progressive-dashboard{gap:10px}.pd-intelligence-proof{gap:5px;padding:8px}.pd-intelligence-proof b{width:100%}.pd-intelligence-proof span{padding-inline-start:6px}.pd-system-health-strip{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.pd-system-health-strip span{padding:6px}.pd-system-health-strip small{font-size:8px}.pd-system-health-strip b{font-size:13px}.pd-hero{padding:14px}.pd-hero-main{align-items:flex-start}.pd-mood-line p{font-size:12px}.pd-health-score{min-width:102px;padding:10px}.pd-health-score b{font-size:31px}.pd-hero-footer{align-items:stretch;flex-direction:column}.pd-hero-actions{width:100%;align-items:stretch}.pd-hero-actions>.btn,.pd-customize-wrap{flex:1}.pd-customize-wrap small{max-width:none}.pd-customize-wrap .btn{width:100%}.pd-module-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pd-module{border-radius:15px}.pd-module-button{min-height:104px;padding:11px;grid-template-columns:32px 1fr 23px;gap:7px}.pd-module-icon{width:32px;height:32px;border-radius:10px;font-size:16px}.pd-module-copy b{font-size:21px}.pd-module-copy em{font-size:11px}.pd-module.is-open{grid-column:1/-1}.pd-customizer{padding:11px}.progressive-dashboard .aquarium-scene-wrap{min-height:360px}}
  `}</style>
 </div>;
}
