"use client";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { SafeAquariumScene } from "@/components/three/SafeAquariumScene";
import { EquipmentPanel } from "@/components/panels/EquipmentPanel";
import { SystemOverview } from "@/components/panels/SystemOverview";
import { HealthTimelineChart } from "@/components/dashboard/HealthTimelineChart";
import { chemistryHealth,maintenanceHealth,tankHealth,bioload,tankHealthTrend,chemistryAgeDays } from "@/domain/health";
import { smartInsights } from "@/domain/smartInsights";
import { eventCorrelations,tankContextStats,tankForecast,tankStateView } from "@/domain/tankIntelligence";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";

export function AquaDashboardContent({tank,onNavigate}:{tank:Tank;onNavigate:(p:AppPage)=>void}) {
 const lang=useAquaStore(s=>s.language);
 const ch=chemistryHealth(tank),mh=maintenanceHealth(tank),th=tankHealth(tank);
 const bio=bioload(tank),trend=tankHealthTrend(tank),insights=smartInsights(tank);
 const state=tankStateView(tank),forecast=tankForecast(tank),correlations=eventCorrelations(tank),context=tankContextStats(tank);
 const today=new Date().toISOString().slice(0,10);
 const due=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today)).slice(0,5);
 const age=chemistryAgeDays(tank);
 const latest=tank.chemistry[0]?.values??{};
 const activeAcclimation=(tank.acclimationSessions??[]).find(s=>s.status!=="completed");

 const tickerItems=[
  tr(lang,"quickNote1"),
  tr(lang,"quickNote2"),
  tr(lang,"quickNote3"),
  `${lang==="ar"?"حالة الحوض":"Tank state"}: ${state.score}% • ${lang==="ar"?state.ar:state.en}`,
  `${tr(lang,"tankHealth")}: ${th}%`,
  `${tr(lang,"chemistryHealth")}: ${ch}%`,
  `${tr(lang,"maintenanceHealth")}: ${mh}%`,
  `${tr(lang,"bioload")}: ${Math.round(bio.ratio*100)}%`
 ];

 const TickerGroup=({hidden=false}:{hidden?:boolean})=>
  <div className="ticker-group" aria-hidden={hidden||undefined}>
   {tickerItems.map((text,i)=><span className="ticker-item" key={`${hidden?"b":"a"}-${i}`}><i>◆</i>{text}</span>)}
  </div>;

 return <div className="dashboard-final">
   <div className="guidance-strip news-ticker">
    <div className="ticker-track">
      <TickerGroup/>
      <TickerGroup hidden/>
    </div>
   </div>

   <div className="dashboard-health-row">
    <SystemOverview tank={tank}/>

    <section className="card panel dashboard-module maintenance-focus">
      <div className="module-head"><h3>{tr(lang,"dueTasks")}</h3><button className="btn glass-button" onClick={()=>onNavigate("maintenance")}>{tr(lang,"openMaintenance")}</button></div>
      <div className="dashboard-health-kpi"><small>{tr(lang,"maintenanceHealth")}</small><b>{mh}%</b></div>
      {due.length?due.slice(0,3).map(x=><div className="mini-row" key={x.id}><b>{lang==="ar"?x.title:(x.titleEn||x.title)}</b><span>{x.nextDue??"—"}</span></div>):<div className="inline-alert good">{tr(lang,"good")}</div>}
    </section>

    <section className="card panel dashboard-module chemistry-focus">
      <div className="module-head"><h3>{tr(lang,"chemistryAnalysis")}</h3><button className="btn glass-button" onClick={()=>onNavigate("chemistry")}>{tr(lang,"openChemistry")}</button></div>
      <div className="dashboard-health-kpi"><small>{tr(lang,"chemistryHealth")}</small><b>{ch}%</b></div>
      <div className={`inline-alert ${age>7?"warn":"good"}`}>{tr(lang,"chemistryFreshness")}: {Math.floor(age)} days {age>7?`• ${tr(lang,"chemistryOverdue")}`:""}</div>
      <div className="chem-mini-grid compact-chem-grid">{Object.entries(latest).slice(0,4).map(([k,v])=><span key={k}><small>{k}</small><b>{String(v)}</b></span>)}</div>
    </section>
   </div>

   <div className="tank-mirror-grid">
    <section className={`card panel tank-state-card state-${state.band}`}>
      <div className="module-head"><div><small className="eyebrow-mini">AQUA NEXUS STATE</small><h3>{lang==="ar"?"شو حاسس الحوض هلق؟":"How is the tank feeling now?"}</h3></div><b className="tank-state-score">{state.score}%</b></div>
      <div className="tank-state-word">{lang==="ar"?state.ar:state.en}</div>
      <div className="state-driver-list">{state.drivers.map((x,i)=><div key={i} className={`inline-alert ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}</div>
    </section>

    <section className={`card panel forecast-hero ${forecast.direction}`}>
      <small className="eyebrow-mini">7 DAY OUTLOOK</small>
      <h3>{lang==="ar"?"لو ضل الحوض ماشي هيك، لوين رايح؟":"Where is the tank heading?"}</h3>
      <div className="forecast-numbers"><b>{forecast.current}%</b><span>→</span><b>{forecast.projected7d}%</b></div>
      <p>{lang==="ar"?forecast.ar:forecast.en}</p>
      <small>{lang==="ar"?"ثقة التوقع":"Forecast confidence"}: {forecast.confidence==="high"?(lang==="ar"?"مرتفعة":"High"):forecast.confidence==="medium"?(lang==="ar"?"متوسطة":"Medium"):(lang==="ar"?"أولية":"Low")}</small>
    </section>

    <section className="card panel tank-context-card">
      <small className="eyebrow-mini">LIVE CONTEXT</small>
      <h3>{lang==="ar"?"سياق الحوض نفسه":"This tank's live context"}</h3>
      <div className="context-kpis">
        <span><small>{lang==="ar"?"تغذية / 7 أيام":"Feedings / 7d"}</small><b>{context.feedings7d}</b></span>
        <span><small>{lang==="ar"?"جرعات / 7 أيام":"Doses / 7d"}</small><b>{context.dosing7d}</b></span>
        <span><small>{lang==="ar"?"تغيير ماء / 30 يوم":"Water changes / 30d"}</small><b>{context.waterChanges30d}</b></span>
        <span><small>{lang==="ar"?"حجر نشط":"Active quarantine"}</small><b>{context.activeQuarantine}</b></span>
        <span><small>{lang==="ar"?"مصاريف الشهر":"This month"}</small><b>{context.monthlySpend.toFixed(0)} {context.currency}</b></span>
      </div>
    </section>
   </div>

   <HealthTimelineChart tank={tank}/>

   <div className="dashboard-intelligence-grid intelligence-priority-grid">
    <section className="card panel dashboard-module">
      <h3>{tr(lang,"smartInsights")}</h3>
      {insights.map((x,i)=><div key={i} className={`inline-alert ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}
    </section>

    <section className="card panel dashboard-module">
      <h3>{tr(lang,"eventCorrelation")}</h3>
      {correlations.length?correlations.slice(0,4).map(point=><div className="correlation-row" key={point.id}>
        <span className={point.delta<0?"delta-down":"delta-up"}>{point.delta>0?`+${point.delta}`:point.delta}</span>
        <div><b>{lang==="ar"?point.reasonAr:point.reasonEn}</b><small>{new Date(point.timestamp).toLocaleDateString()} • {point.score}%</small></div>
      </div>):<div className="note">{lang==="ar"?"ما في تغير كبير مرتبط بحدث حتى الآن. مع كل استخدام رح تصير الصورة أغنى.":"No major event-linked movement yet. The picture becomes richer as the tank history grows."}</div>}
    </section>

    {activeAcclimation&&<section className="card panel dashboard-module">
      <div className="module-head"><h3>{tr(lang,"activeAcclimation")}</h3><button className="btn glass-button" onClick={()=>onNavigate("acclimation")}>{tr(lang,"openAcclimation")}</button></div>
      <div className="mini-row"><b>{activeAcclimation.items.filter(x=>x.status!=="added"&&x.status!=="deferred").length} {tr(lang,"remaining")}</b><span>{activeAcclimation.status}</span></div>
    </section>}
   </div>

   <div className="dashboard-visual-row">
    <aside className="dashboard-equipment-column"><EquipmentPanel tank={tank}/></aside>

    <section className="card scene-card dashboard-scene-card">
      <div className="scene-toolbar">
        <div className="scene-badge">{tr(lang,"3dDigitalTwin")}</div>
        <div className="scene-badge">{tank.type==="marine"?tr(lang,"marine"):tr(lang,"freshwater")}</div>
        <div className={`scene-badge state-badge state-${state.band}`}>{lang==="ar"?state.ar:state.en} • {state.score}%</div>
      </div>
      <SafeAquariumScene tank={tank}/>
    </section>
   </div>

   <div className="summary-strip dashboard-summary-strip">
    <div className="summary"><small>{lang==="ar"?"حالة الحوض":"Tank State"}</small><b>{state.score}%</b></div>
    <div className="summary"><small>{tr(lang,"tankHealth")}</small><b>{th}%</b></div>
    <div className="summary"><small>{tr(lang,"healthTrend")}</small><b className={`trend-${trend}`}>{tr(lang,trend)}</b></div>
    <div className="summary"><small>{tr(lang,"chemistryHealth")}</small><b>{ch}%</b></div>
    <div className="summary"><small>{tr(lang,"maintenanceHealth")}</small><b>{mh}%</b></div>
    <div className="summary"><small>{tr(lang,"bioload")}</small><b>{Math.round(bio.ratio*100)}%</b></div>
   </div>
 </div>;
}
