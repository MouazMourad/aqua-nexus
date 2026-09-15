"use client";
import { FormEvent,useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { useAquaStore } from "@/store/useAquaStore";
import { chemistryHealth,maintenanceHealth,tankHealth,bioload } from "@/domain/health";
import { smartInsights } from "@/domain/smartInsights";

function contextualAnswer(q:string,tank:Tank,page:AppPage,lang:"ar"|"en"){
 const query=q.toLowerCase();
 const ch=chemistryHealth(tank),mh=maintenanceHealth(tank),th=tankHealth(tank),bio=Math.round(bioload(tank).ratio*100);
 const today=new Date().toISOString().slice(0,10);
 const due=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today));
 const warnings=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
 const latest=tank.chemistry[0]?.values??{};
 const latestText=Object.entries(latest).slice(0,5).map(([k,v])=>`${k}: ${v}`).join(" • ");
 if(/كيمي|chem|salin|kh|ph|nitrate|no3|po4/.test(query)) return lang==="ar"?`صحة الكيمياء ${ch}%. آخر القراءات: ${latestText||"لا توجد قراءات"}. ${ch<80?"الأولوية الآن إعادة القياس ومراجعة أي قيمة خارج المجال.":"الوضع الكيميائي جيد إجمالاً، استمر بالقياس الأسبوعي."}`:`Chemistry health is ${ch}%. Latest: ${latestText||"No readings"}. ${ch<80?"Re-test and review out-of-range values first.":"Chemistry is generally healthy; keep the weekly measurement routine."}`;
 if(/صيان|maint|task|مهمة/.test(query)) return lang==="ar"?`صحة الصيانة ${mh}%. لديك ${due.length} مهمة مستحقة حالياً. ${due.length?`الأقرب: ${due.slice(0,3).map(x=>x.title).join("، ")}`:"لا توجد مهام متأخرة."}`:`Maintenance health is ${mh}%. ${due.length} task(s) are due. ${due.length?`Priority: ${due.slice(0,3).map(x=>x.titleEn||x.title).join(", ")}`:"No overdue tasks."}`;
 if(/جهاز|معدات|equipment|pump|light|skimmer/.test(query)) return lang==="ar"?`لديك ${tank.equipment.length} جهازاً مسجلاً، و${warnings.length} يحتاج تحذير/صيانة. ${warnings.length?`راجع: ${warnings.map(x=>x.name).slice(0,4).join("، ")}`:"لا يوجد جهاز بحالة تحذير حالياً."}`:`${tank.equipment.length} devices are registered; ${warnings.length} need warning/service attention. ${warnings.length?`Review: ${warnings.map(x=>x.name).slice(0,4).join(", ")}`:"No device is currently flagged."}`;
 if(/حمل|سمك|مرجان|livestock|fish|coral|bioload/.test(query)) return lang==="ar"?`الحمل الحيوي التقريبي ${bio}%. راقب الزيادة تدريجياً مع NO3/PO4 وقدرة الفلترة.`:`Estimated bioload is ${bio}%. Increase livestock gradually and watch NO3/PO4 and filtration capacity.`;
 if(/طوار|emerg|خطر/.test(query)) return lang==="ar"?`في صفحة الطوارئ اختر الحالة ثم نفّذ الخطوات بالترتيب، وأصبح بإمكانك إنشاء مهمة صيانة عاجلة مباشرة من الحالة.`:`Choose the emergency scenario, follow the steps in order, and create an urgent maintenance task directly from the scenario.`;
 const insight=smartInsights(tank)[0];
 return lang==="ar"?`ملخص ${tank.name}: صحة الحوض ${th}%، الكيمياء ${ch}%، الصيانة ${mh}%، الحمل الحيوي ${bio}%. ${insight?.ar||"لا توجد ملاحظة حرجة حالياً."} أنت الآن في واجهة ${page}.`:`${tank.name} summary: tank health ${th}%, chemistry ${ch}%, maintenance ${mh}%, bioload ${bio}%. ${insight?.en||"No critical insight right now."} Current section: ${page}.`;
}

export function AquaAIAssistant({tank,page}:{tank:Tank;page:AppPage}){
 const lang=useAquaStore(s=>s.language);
 const [open,setOpen]=useState(false),[q,setQ]=useState(""),[answer,setAnswer]=useState("");
 const welcome=useMemo(()=>contextualAnswer("",tank,page,lang),[tank,page,lang]);
 function ask(e?:FormEvent){e?.preventDefault();setAnswer(contextualAnswer(q||"summary",tank,page,lang));}
 const quick=lang==="ar"?["شو أهم شي هلا؟","راجع الكيمياء","شو الصيانة المتأخرة؟","حالة المعدات؟"]:["What matters now?","Review chemistry","Due maintenance?","Equipment status?"];
 return <div className={`aqua-ai-shell ${open?"open":""}`} dir={lang==="ar"?"rtl":"ltr"}>
  {open&&<section className="aqua-ai-panel"><div className="aqua-ai-head"><div><b>✦ Aqua AI</b><small>{lang==="ar"?"مساعد ذكي سياقي • Beta":"Context-aware smart assistant • Beta"}</small></div><button className="icon-btn" onClick={()=>setOpen(false)}>×</button></div><div className="aqua-ai-answer">{answer||welcome}</div><div className="aqua-ai-quick">{quick.map(x=><button key={x} onClick={()=>{setQ(x);setAnswer(contextualAnswer(x,tank,page,lang))}}>{x}</button>)}</div><form className="aqua-ai-form" onSubmit={ask}><input value={q} onChange={e=>setQ(e.target.value)} placeholder={lang==="ar"?"اسأل عن الحوض...":"Ask about the tank..."}/><button className="btn primary" type="submit">{lang==="ar"?"اسأل":"Ask"}</button></form></section>}
  <button className="aqua-ai-fab" onClick={()=>setOpen(v=>!v)} aria-label="Aqua AI">✦ <span>AI</span></button>
 </div>;
}
