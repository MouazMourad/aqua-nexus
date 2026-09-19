"use client";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { localizedAlert,systemAlerts } from "@/domain/alertEngine";

export function AlertsPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),a=systemAlerts(tank);
 const danger=a.filter(x=>x.level==="danger").length,warn=a.filter(x=>x.level==="warn").length;
 return <section className="page-grid">
  <PageHeader eyebrow="SYSTEM ALERT ENGINE" title={`${tr(lang,"alerts")} (${a.length})`}/>
  <div className="card panel full-span">
   <div className="summary-strip" style={{marginBottom:12}}><div className="summary"><small>{bi(lang,"حرج","Danger")}</small><b>{danger}</b></div><div className="summary"><small>{bi(lang,"تحذير","Warning")}</small><b>{warn}</b></div><div className="summary"><small>{bi(lang,"إجمالي الإشارات","Total signals")}</small><b>{a.length}</b></div></div>
   {a.length?a.map(x=><div className={`inline-alert ${x.level}`} key={x.id}><b>{localizedAlert(x,lang)}</b><small style={{display:"block",marginTop:4,opacity:.7}}>{x.domain.toUpperCase()}</small></div>):<div className="inline-alert good">{bi(lang,"لا توجد تنبيهات حالياً ضمن الكيمياء أو الصيانة أو التجهيزات أو التوافق أو المخزون أو الحالات النشطة.","No active alerts across chemistry, maintenance, equipment, compatibility, inventory or active cases.")}</div>}
  </div>
 </section>;
}
