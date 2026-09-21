"use client";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContextHint } from "@/components/ui/ContextHint";
import { localizedAlert,systemAlerts } from "@/domain/alertEngine";

export function AlertsPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),a=systemAlerts(tank);
 const danger=a.filter(x=>x.level==="danger").length,warn=a.filter(x=>x.level==="warn").length;
 const ordered=[...a].sort((x,y)=>({danger:0,warn:1,info:2,good:3}[x.level]??4)-({danger:0,warn:1,info:2,good:3}[y.level]??4));
 return <section className="page-grid">
  <PageHeader eyebrow="SYSTEM ALERT ENGINE" title={`${tr(lang,"alerts")} (${a.length})`}/>
  <div className="card panel full-span">
   <ContextHint id="alerts-priority" lang={lang} tone="safety" dismissible={false} ar="التنبيه يحدد أولوية المراجعة، مو أمر بتنفيذ علاج مباشر. ابدأ بالحرج وافتح السبب المرتبط قبل أي تدخل كبير." en="An alert sets review priority; it is not an instruction to apply treatment immediately. Start with danger signals and review the linked cause before a major intervention."/>
   <div className="summary-strip" style={{marginBottom:12}}><div className="summary"><small>{bi(lang,"حرج","Danger")}</small><b>{danger}</b></div><div className="summary"><small>{bi(lang,"تحذير","Warning")}</small><b>{warn}</b></div><div className="summary"><small>{bi(lang,"إجمالي الإشارات","Total signals")}</small><b>{a.length}</b></div></div>
   {a.length?<><div className={`inline-alert ${danger?"danger":warn?"warn":"info"}`}><b>{danger?bi(lang,"ابدأ بالتنبيهات الحرجة أولاً.","Start with danger alerts first."):warn?bi(lang,"ما في حالة حرجة؛ راجع التحذيرات التالية.","No critical alert; review the warnings below."):bi(lang,"لا يوجد خطر مباشر؛ الإشارات الحالية للمتابعة.","No immediate danger; current signals are for follow-up.")}</b></div>{ordered.map(x=><div className={`inline-alert ${x.level}`} key={x.id}><b>{localizedAlert(x,lang)}</b><small style={{display:"block",marginTop:4,opacity:.7}}>{x.domain.toUpperCase()}</small></div>)}</>:<div className="inline-alert good">{bi(lang,"لا توجد تنبيهات حالياً ضمن الكيمياء أو الصيانة أو التجهيزات أو التوافق أو المخزون أو الحالات النشطة.","No active alerts across chemistry, maintenance, equipment, compatibility, inventory or active cases.")}</div>}
  </div>
 </section>;
}
