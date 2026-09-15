"use client";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tankHealth,chemistryHealth,maintenanceHealth,chemistryAgeDays } from "@/domain/health";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { downloadText,today } from "@/lib/appUtils";

export function ReportsPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),state=useAquaStore();
 const recurring=tank.maintenance.filter(x=>x.cadence!=="once"),now=today();
 const overdue=recurring.filter(x=>!x.done&&x.nextDue&&x.nextDue<now);
 const upcoming=recurring.filter(x=>!x.done&&(!x.nextDue||x.nextDue>=now));
 const chemAge=Math.floor(chemistryAgeDays(tank));
 function backup(){downloadText(`Aqua_Nexus_Backup_${today()}.json`,JSON.stringify({language:state.language,selectedTankId:state.selectedTankId,tanks:state.tanks},null,2))}
 function csv(){const rows=[["Section","Name","Value"],["Tank","Name",tank.name],["Tank","System Volume",tank.systemVolumeLiters],["Health","Tank",tankHealth(tank)],["Health","Chemistry",chemistryHealth(tank)],["Health","Maintenance",maintenanceHealth(tank)],["Chemistry","Age Days",chemAge],...recurring.map(x=>["Maintenance",lang==="ar"?x.title:(x.titleEn||x.title),`${x.cadence} / ${x.nextDue??""}`]),...tank.livestock.map(x=>["Livestock",x.name,x.quantity]),...tank.inventory.map(x=>["Inventory",x.name,`${x.quantity} ${x.unit}`])];downloadText(`Aqua_Nexus_${tank.name}_${today()}.csv`,rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),"text/csv")}
 return <section className="page-grid"><PageHeader eyebrow="REPORTING" title={tr(lang,"reports")} actions={<button className="btn primary" onClick={()=>window.print()}>{tr(lang,"print")} / PDF</button>}/>
 <article className="report-action card panel"><h3>{tr(lang,"backup")}</h3><button className="btn" onClick={backup}>JSON</button> <button className="btn" onClick={csv}>CSV</button></article>
 <article className="card panel"><h3>{tr(lang,"chemistryFreshness")}</h3><b className="big-number">{chemAge}d</b><div className={`inline-alert ${chemAge>7?"warn":"good"}`}>{chemAge>7?tr(lang,"chemistryOverdue"):tr(lang,"good")}</div></article>

 <article className="card panel full-span report-preview"><h2>{tr(lang,"reportSummary")}</h2><div className="report-kpis"><span>{tr(lang,"tankHealth")} <b>{tankHealth(tank)}%</b></span><span>{tr(lang,"chemistryHealth")} <b>{chemistryHealth(tank)}%</b></span><span>{tr(lang,"maintenanceHealth")} <b>{maintenanceHealth(tank)}%</b></span><span>{tr(lang,"systemVolume")} <b>{tank.systemVolumeLiters} L</b></span></div></article>

 <article className="card panel full-span"><h2>{tr(lang,"maintenanceReport")}</h2>
  <div className="maintenance-report-grid"><div><h3>{tr(lang,"overdue")} ({overdue.length})</h3>{overdue.map(x=><div className="mini-row" key={x.id}><b>{lang==="ar"?x.title:(x.titleEn||x.title)}</b><span>{x.nextDue}</span></div>)}</div>
  <div><h3>{tr(lang,"upcoming")} ({upcoming.length})</h3>{upcoming.map(x=><div className="mini-row" key={x.id}><b>{lang==="ar"?x.title:(x.titleEn||x.title)}</b><span>{x.nextDue??"—"}</span></div>)}</div></div>
 </article>
 </section>;
}
