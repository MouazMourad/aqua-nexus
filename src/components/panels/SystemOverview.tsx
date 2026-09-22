import type { CSSProperties } from "react";
import type { Tank } from "@/domain/types";
import { chemistryHealth,maintenanceHealth,tankHealth } from "@/domain/health";
import { currentChemistryValues } from "@/domain/chemistryDataQuality";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";

function healthVisual(health:number){
  if(health < 45) return {rgb:"255,76,88", color:"#ff4c58", speed:.72, state:"danger"};
  if(health < 60) return {rgb:"255,91,82", color:"#ff5b52", speed:1.0, state:"danger"};
  if(health < 80) return {rgb:"255,168,66", color:"#ffa842", speed:1.65, state:"warning"};
  if(health < 90) return {rgb:"101,211,125", color:"#65d37d", speed:2.7, state:"good"};
  return {rgb:"76,225,157", color:"#4ce19d", speed:4.4, state:"excellent"};
}

export function SystemOverview({tank}:{tank:Tank}) {
  const lang=useAquaStore(s=>s.language),health=tankHealth(tank),chem=chemistryHealth(tank),maint=maintenanceHealth(tank),latest=currentChemistryValues(tank);
  const visual=healthVisual(health);
  const metrics=tank.type==="marine"
    ? [["temperature",latest.temperature,"°C"],["pH",latest.pH,""],["salinity",latest.salinity,"SG"],["KH",latest.KH,"dKH"]]
    : [["temperature",latest.temperature,"°C"],["pH",latest.pH,""],["GH",latest.GH,""],["NO3",latest.NO3,"ppm"]];

  const style={
    "--score":health,
    "--health-rgb":visual.rgb,
    "--health-color":visual.color,
    "--health-pulse-speed":`${visual.speed}s`
  } as CSSProperties;

  return <section className={`card panel system-health-card health-${visual.state}`} style={style}>
    <div className="health-card-glow"/>
    <h3>{tr(lang,"dashboard")}</h3>
    <div className="health-hero">
      <div className="health-score"><b>{health}%</b></div>
      <div className="health-bars">
        <div className="health-row"><span>{tr(lang,"chemistry")}</span><div className="track"><i style={{width:`${chem}%`}}/></div><b>{chem}%</b></div>
        <div className="health-row"><span>{tr(lang,"maintenance")}</span><div className="track"><i style={{width:`${maint}%`}}/></div><b>{maint}%</b></div>
      </div>
    </div>
    <div className="chem-grid" style={{marginTop:12}}>{metrics.map(([label,value,unit])=><div className="metric health-metric" key={String(label)}><small>{String(label)}</small><b>{value??"—"} {unit}</b></div>)}</div>
  </section>;
}
