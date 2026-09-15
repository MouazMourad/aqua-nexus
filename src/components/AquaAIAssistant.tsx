"use client";
import { FormEvent,useEffect,useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { useAquaStore } from "@/store/useAquaStore";
import { chemistryHealth,maintenanceHealth,tankHealth,bioload,tankHealthTrend } from "@/domain/health";
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
 if(/طوار|emerg|خطر/.test(query)) return lang==="ar"?`في صفحة الطوارئ اختر الحالة ثم نفّذ الخطوات بالترتيب، ويمكنك إنشاء مهمة صيانة عاجلة مباشرة من الحالة.`:`Choose the emergency scenario, follow the steps in order, and create an urgent maintenance task directly from the scenario.`;
 const insight=smartInsights(tank)[0];
 return lang==="ar"?`ملخص ${tank.name}: صحة الحوض ${th}%، الكيمياء ${ch}%، الصيانة ${mh}%، الحمل الحيوي ${bio}%. ${insight?.ar||"لا توجد ملاحظة حرجة حالياً."} أنت الآن في واجهة ${page}.`:`${tank.name} summary: tank health ${th}%, chemistry ${ch}%, maintenance ${mh}%, bioload ${bio}%. ${insight?.en||"No critical insight right now."} Current section: ${page}.`;
}

function FishMascot({state}:{state:"normal"|"alert"|"critical"}){
 return <span className={`aqua-fish aqua-fish-${state}`} aria-hidden="true">
  <i className="aqua-fish-tail"/>
  <i className="aqua-fish-body">
   <i className="aqua-fish-core"/>
   <i className="aqua-fish-eye"/>
   <i className="aqua-fish-line l1"/>
   <i className="aqua-fish-line l2"/>
  </i>
  <i className="aqua-fish-fin"/>
 </span>;
}

export function AquaAIAssistant({tank,page}:{tank:Tank;page:AppPage}){
 const lang=useAquaStore(s=>s.language);
 const [open,setOpen]=useState(false),[q,setQ]=useState(""),[answer,setAnswer]=useState(""),[greeting,setGreeting]=useState(false);
 const th=tankHealth(tank),ch=chemistryHealth(tank),mh=maintenanceHealth(tank),trend=tankHealthTrend(tank),bio=bioload(tank);
 const warnings=tank.equipment.some(x=>x.status==="warning"||x.status==="service");
 const state:"normal"|"alert"|"critical"=(th<60||ch<55||bio.status==="danger")?"critical":(th<80||ch<75||mh<70||trend==="declining"||warnings)?"alert":"normal";
 const welcome=useMemo(()=>contextualAnswer("",tank,page,lang),[tank,page,lang]);

 useEffect(()=>{
  if(typeof window==="undefined")return;
  const key="aqua-ai-session-greeting";
  if(sessionStorage.getItem(key))return;
  const timer=window.setTimeout(()=>{setGreeting(true);sessionStorage.setItem(key,"1")},650);
  const hide=window.setTimeout(()=>setGreeting(false),8500);
  return()=>{window.clearTimeout(timer);window.clearTimeout(hide)};
 },[]);

 function ask(e?:FormEvent){e?.preventDefault();setAnswer(contextualAnswer(q||"summary",tank,page,lang));}
 const quick=lang==="ar"?["حلل حوضي","شو أهم شي هلا؟","راجع الكيمياء","اقترح إجراء"]:["Analyze my tank","What matters now?","Review chemistry","Suggest an action"];
 const statusText=lang==="ar"?(state==="critical"?"يحتاج تدخلاً سريعاً":state==="alert"?"يحتاج متابعة":"مستقر"):(state==="critical"?"Needs quick action":state==="alert"?"Needs attention":"Stable");
 const greetingText=lang==="ar"?"أنا هنا للمساعدة بعالم الأحواض. أستطيع تحليل حوضك، مراجعة الكيمياء والصيانة، ومساعدتك بأي سؤال متعلق بالأحواض.":"I’m here to help in the world of aquariums. I can analyze your tank, review chemistry and maintenance, and help with aquarium questions.";

 return <div className={`aqua-ai-shell ${open?"open":""} state-${state}`} dir={lang==="ar"?"rtl":"ltr"}>
  {greeting&&!open&&<button type="button" className="aqua-ai-greeting" onClick={()=>{setGreeting(false);setOpen(true)}}>
    <b>{lang==="ar"?"مرحباً، أنا Aqua AI":"Hello, I’m Aqua AI"}</b>
    <span>{greetingText}</span>
  </button>}

  {open&&<section className="aqua-ai-panel">
   <div className="aqua-ai-head">
    <div className="aqua-ai-head-brand"><FishMascot state={state}/><div><b>✦ Aqua AI</b><small>{lang==="ar"?"مساعدك الذكي في عالم الأحواض":"Your aquarium intelligence assistant"}</small></div></div>
    <button className="icon-btn" onClick={()=>setOpen(false)}>×</button>
   </div>
   <div className={`aqua-ai-tank-status status-${state}`}><span>{lang==="ar"?"الحوض الحالي":"Current tank"}</span><b>{tank.name}</b><em>{statusText}</em></div>
   <div className="aqua-ai-answer">{answer||welcome}</div>
   <div className="aqua-ai-quick">{quick.map(x=><button key={x} onClick={()=>{setQ(x);setAnswer(contextualAnswer(x,tank,page,lang))}}>{x}</button>)}</div>
   <form className="aqua-ai-form" onSubmit={ask}><input value={q} onChange={e=>setQ(e.target.value)} placeholder={lang==="ar"?"اسأل Aqua AI عن الأحواض...":"Ask Aqua AI about aquariums..."}/><button className="btn primary" type="submit">{lang==="ar"?"اسأل":"Ask"}</button></form>
  </section>}

  <button className="aqua-ai-fish-button" onClick={()=>{setGreeting(false);setOpen(v=>!v)}} aria-label="Aqua AI">
   <FishMascot state={state}/>
   <span className="aqua-ai-fish-label">Aqua AI</span>
   {state!=="normal"&&<i className="aqua-ai-alert-dot"/>}
  </button>
 </div>;
}
