"use client";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { chemistryAgeDays } from "@/domain/health";
import { maintenanceEffectiveState } from "@/domain/maintenanceSchedule";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { downloadText,today } from "@/lib/appUtils";
import { unifiedInventory } from "@/domain/inventoryIntelligence";
import { tankIntelligenceCore } from "@/domain/intelligenceCore";

export function ReportsPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),state=useAquaStore();
 const recurring=tank.maintenance.filter(x=>x.cadence!=="once"),now=today();
 const core=tankIntelligenceCore(tank),sys=core.health,alerts=core.alerts,stock=unifiedInventory(tank);
 const overdue=recurring.filter(x=>maintenanceEffectiveState(x,now).overdue);
 const upcoming=recurring.filter(x=>!maintenanceEffectiveState(x,now).completed&&!maintenanceEffectiveState(x,now).overdue);
 const chemAge=Math.floor(chemistryAgeDays(tank));
 function backup(){downloadText(`Aqua_Nexus_Backup_${today()}.json`,JSON.stringify({language:state.language,selectedTankId:state.selectedTankId,tanks:state.tanks},null,2))}
 function csv(){const rows=[["Section","Name","Value"],["Tank","Name",tank.name],["Tank","System Volume",tank.systemVolumeLiters],["Health","System",sys.score],["Health","Chemistry",sys.chemistry],["Health","Maintenance",sys.maintenance],["Health","Bioload",sys.bioload],["Health","Equipment",sys.equipment],["Health","Compatibility",sys.compatibility],["Health","Livestock",sys.livestock],["Chemistry","Age Days",chemAge],...recurring.map(x=>["Maintenance",lang==="ar"?x.title:(x.titleEn||x.title),`${x.cadence} / ${x.nextDue??""}`]),...tank.livestock.map(x=>["Livestock",x.name,x.quantity]),...stock.rows.map(x=>["Inventory",x.name,`${x.quantity} ${x.unit} / min ${x.minimum}`]),...alerts.map(x=>["Alert",x.domain,lang==="ar"?x.ar:x.en])];downloadText(`Aqua_Nexus_${tank.name}_${today()}.csv`,rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),"text/csv")}
 return <section className="page-grid"><PageHeader eyebrow="REPORTING" title={tr(lang,"reports")} actions={<button className="btn primary" onClick={()=>window.print()}>{tr(lang,"print")} / PDF</button>}/>
 <article className="report-action card panel"><h3>{tr(lang,"backup")}</h3><button className="btn" onClick={backup}>JSON</button> <button className="btn" onClick={csv}>CSV</button></article>
 <article className="card panel"><h3>{tr(lang,"chemistryFreshness")}</h3><b className="big-number">{chemAge}d</b><div className={`inline-alert ${chemAge>7?"warn":"good"}`}>{chemAge>7?tr(lang,"chemistryOverdue"):tr(lang,"good")}</div></article>

 <article className="card panel full-span report-preview"><h2>{tr(lang,"reportSummary")}</h2><div className="report-kpis"><span>{tr(lang,"tankHealth")} <b>{sys.score}%</b></span><span>{tr(lang,"chemistryHealth")} <b>{sys.chemistry}%</b></span><span>{tr(lang,"maintenanceHealth")} <b>{sys.maintenance}%</b></span><span>{lang==="ar"?"التجهيزات":"Equipment"} <b>{sys.equipment}%</b></span><span>{lang==="ar"?"التوافق":"Compatibility"} <b>{sys.compatibility}%</b></span><span>{tr(lang,"systemVolume")} <b>{tank.systemVolumeLiters} L</b></span></div></article>

 <article className="card panel full-span"><h2>{lang==="ar"?"ملخص صحة النظام":"System health breakdown"}</h2><div className="summary-strip">{sys.components.map(x=><div className="summary" key={x.key}><small>{lang==="ar"?x.ar:x.en} • {x.weight}%</small><b>{x.score}%</b></div>)}</div></article>
 <article className="card panel full-span"><h2>{lang==="ar"?"أهم التنبيهات":"Top alerts"} ({alerts.length})</h2>{alerts.length?alerts.slice(0,10).map(x=><div className={`inline-alert ${x.level}`} key={x.id}><b>{lang==="ar"?x.ar:x.en}</b><small style={{display:"block"}}>{x.domain}</small></div>):<div className="inline-alert good">{lang==="ar"?"لا يوجد تنبيه حالي":"No active alert"}</div>}</article>
 <article className="card panel full-span"><h2>{lang==="ar"?"التجهيزات والتوافق":"Equipment & compatibility"}</h2><div className="maintenance-report-grid"><div><h3>{lang==="ar"?"مشاكل التجهيزات":"Equipment issues"} ({sys.equipmentAudit.issues.length})</h3>{sys.equipmentAudit.issues.slice(0,8).map(x=><div className="mini-row" key={x.id}><b>{lang==="ar"?x.ar:x.en}</b></div>)}</div><div><h3>{lang==="ar"?"تعارضات الكائنات":"Compatibility issues"} ({sys.compatibilityAudit.issues.length})</h3>{sys.compatibilityAudit.issues.slice(0,8).map((x,i)=><div className="mini-row" key={i}><b>{lang==="ar"?x.ar:x.en}</b></div>)}</div></div></article>
 <article className="card panel full-span"><h2>{lang==="ar"?"المخزون":"Inventory"} • {lang==="ar"?"منخفض":"Low"} {stock.low.length}</h2>{stock.low.slice(0,10).map(x=><div className="mini-row" key={x.id}><b>{lang==="ar"?x.name:(x.nameEn||x.name)}</b><span>{x.quantity} {x.unit} / min {x.minimum}</span></div>)}</article>
 <article className="card panel full-span"><h2>{tr(lang,"maintenanceReport")}</h2>
  <div className="maintenance-report-grid"><div><h3>{tr(lang,"overdue")} ({overdue.length})</h3>{overdue.map(x=><div className="mini-row" key={x.id}><b>{lang==="ar"?x.title:(x.titleEn||x.title)}</b><span>{x.nextDue}</span></div>)}</div>
  <div><h3>{tr(lang,"upcoming")} ({upcoming.length})</h3>{upcoming.map(x=><div className="mini-row" key={x.id}><b>{lang==="ar"?x.title:(x.titleEn||x.title)}</b><span>{x.nextDue??"—"}</span></div>)}</div></div>
 </article>
 </section>;
}
