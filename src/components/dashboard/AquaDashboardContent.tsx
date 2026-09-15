"use client";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { AquariumScene } from "@/components/three/AquariumScene";
import { EquipmentPanel } from "@/components/panels/EquipmentPanel";
import { SystemOverview } from "@/components/panels/SystemOverview";
import { chemistryHealth,maintenanceHealth,tankHealth,bioload,tankHealthTrend,chemistryAgeDays } from "@/domain/health";
import { smartInsights,forecastTank } from "@/domain/smartInsights";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";

export function AquaDashboardContent({tank,onNavigate}:{tank:Tank;onNavigate:(p:AppPage)=>void}) {
 const lang=useAquaStore(s=>s.language);
 const ch=chemistryHealth(tank),mh=maintenanceHealth(tank),th=tankHealth(tank);
 const bio=bioload(tank),trend=tankHealthTrend(tank),insights=smartInsights(tank),forecast=forecastTank(tank);
 const today=new Date().toISOString().slice(0,10);
 const due=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today)).slice(0,5);
 const age=chemistryAgeDays(tank);
 const latest=tank.chemistry[0]?.values??{};
 const activeAcclimation=(tank.acclimationSessions??[]).find(s=>s.status!=="completed");

 const tickerItems=[
  tr(lang,"quickNote1"),
  tr(lang,"quickNote2"),
  tr(lang,"quickNote3"),
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

   <div className="dashboard-visual-row">
    <aside className="dashboard-equipment-column"><EquipmentPanel tank={tank}/></aside>

    <section className="card scene-card dashboard-scene-card">
      <div className="scene-toolbar">
        <div className="scene-badge">{tr(lang,"3dDigitalTwin")}</div>
        <div className="scene-badge">{tank.type==="marine"?tr(lang,"marine"):tr(lang,"freshwater")}</div>
      </div>
      <AquariumScene tank={tank}/>
    </section>
   </div>

   <div className="summary-strip dashboard-summary-strip">
    <div className="summary"><small>{tr(lang,"tankHealth")}</small><b>{th}%</b></div>
    <div className="summary"><small>{tr(lang,"healthTrend")}</small><b className={`trend-${trend}`}>{tr(lang,trend)}</b></div>
    <div className="summary"><small>{tr(lang,"chemistryHealth")}</small><b>{ch}%</b></div>
    <div className="summary"><small>{tr(lang,"maintenanceHealth")}</small><b>{mh}%</b></div>
    <div className="summary"><small>{tr(lang,"bioload")}</small><b>{Math.round(bio.ratio*100)}%</b></div>
   </div>

   <div className="dashboard-intelligence-grid">
    <section className="card panel dashboard-module">
      <h3>{tr(lang,"smartInsights")}</h3>
      {insights.map((x,i)=><div key={i} className={`inline-alert ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}
    </section>

    <section className="card panel dashboard-module">
      <h3>{tr(lang,"eventCorrelation")}</h3>
      <div className="note">{insights.find(x=>x.level==="info") ? (lang==="ar"?insights.find(x=>x.level==="info")!.ar:insights.find(x=>x.level==="info")!.en) : (lang==="ar"?"لا يوجد ارتباط حدثي واضح حتى الآن.":"No clear event correlation has been detected yet.")}</div>
    </section>

    {activeAcclimation&&<section className="card panel dashboard-module">
      <div className="module-head"><h3>{tr(lang,"activeAcclimation")}</h3><button className="btn glass-button" onClick={()=>onNavigate("acclimation")}>{tr(lang,"openAcclimation")}</button></div>
      <div className="mini-row"><b>{activeAcclimation.items.filter(x=>x.status!=="added"&&x.status!=="deferred").length} {tr(lang,"remaining")}</b><span>{activeAcclimation.status}</span></div>
    </section>}

    <section className="card panel dashboard-module forecast-module">
      <div className="module-head"><h3>{tr(lang,"forecast")}</h3><button className="btn glass-button" onClick={()=>onNavigate("alerts")}>{tr(lang,"openAlerts")}</button></div>
      <p className="forecast-text">{lang==="ar"?forecast.ar:forecast.en}</p>
    </section>
   </div>
 </div>;
}
