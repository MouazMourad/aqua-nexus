"use client";
import { FormEvent,useEffect,useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { useAquaStore } from "@/store/useAquaStore";
import { bioload,chemistryHealth,maintenanceHealth,tankHealth,tankHealthTrend } from "@/domain/health";
import { aquaAIAnswer,type AquaAIAnswer,type AquaAIPage } from "@/domain/aquaAIBrain";
import { tankMood } from "@/domain/tankLearning";

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

type Exchange={id:string;question:string;answer:AquaAIAnswer};

export function AquaAIAssistant({tank,page,onNavigate}:{tank:Tank;page:AppPage;onNavigate?:(page:AppPage)=>void}){
 const lang=useAquaStore(s=>s.language);
 const [open,setOpen]=useState(false),[q,setQ]=useState(""),[history,setHistory]=useState<Exchange[]>([]),[greeting,setGreeting]=useState(false);
 const th=tankHealth(tank),ch=chemistryHealth(tank),mh=maintenanceHealth(tank),trend=tankHealthTrend(tank),bio=bioload(tank),mood=tankMood(tank);
 const warnings=tank.equipment.some(x=>x.status==="warning"||x.status==="service");
 const state:"normal"|"alert"|"critical"=(th<60||ch<55||bio.status==="danger")?"critical":(th<80||ch<75||mh<70||trend==="declining"||warnings)?"alert":"normal";
 const welcome=useMemo(()=>aquaAIAnswer("",tank,page),[tank,page]);
 const active=history[history.length-1]?.answer??welcome;

 useEffect(()=>{setHistory([]);setQ("")},[tank.id]);
 useEffect(()=>{
  if(typeof window==="undefined")return;
  const key="aqua-ai-session-greeting-v2";
  if(sessionStorage.getItem(key))return;
  const timer=window.setTimeout(()=>{setGreeting(true);sessionStorage.setItem(key,"1")},650);
  const hide=window.setTimeout(()=>setGreeting(false),9000);
  return()=>{window.clearTimeout(timer);window.clearTimeout(hide)};
 },[]);

 function run(question:string){
  const clean=question.trim()|| (lang==="ar"?"حلل حوضي":"Analyze my tank");
  const answer=aquaAIAnswer(clean,tank,page);
  setHistory(h=>[...h.slice(-4),{id:`ai-${Date.now()}`,question:clean,answer}]);
  setQ("");
 }
 function ask(e?:FormEvent){e?.preventDefault();run(q);}
 function go(pageKey:AquaAIPage){setOpen(false);onNavigate?.(pageKey as AppPage);}

 const quick=lang==="ar"
  ?["حلل حوضي","شو متوقع خلال أسبوع؟","شو تعلمت من تاريخ الحوض؟",tank.type==="marine"?"ليش KH عم ينزل؟":"حلل النترات"]
  :["Analyze my tank","What do you expect this week?","What have you learned from this tank?",tank.type==="marine"?"Why is KH dropping?":"Analyze nitrate"];
 const statusText=lang==="ar"?`${mood.symbol} ${mood.ar}`:`${mood.symbol} ${mood.en}`;
 const confidenceLabel=(c:AquaAIAnswer["confidence"])=>lang==="ar"?(c==="high"?"ثقة مرتفعة":c==="medium"?"ثقة متوسطة":"ثقة أولية"):(c==="high"?"High confidence":c==="medium"?"Medium confidence":"Early confidence");
 const greetingText=lang==="ar"?`أنا Aqua AI. عم اقرأ حالة ${tank.name} وتاريخه، مو بس أرقام منفصلة. اسألني شو عم يصير، ليش، أو لوين رايح الحوض.`:`I’m Aqua AI. I read ${tank.name} as a connected system and history, not isolated numbers. Ask what is happening, why, or where the tank is heading.`;

 const title=lang==="ar"?active.titleAr:active.titleEn;
 const summary=lang==="ar"?active.summaryAr:active.summaryEn;
 const details=lang==="ar"?active.detailsAr:active.detailsEn;
 const evidence=lang==="ar"?active.evidenceAr:active.evidenceEn;
 const actionText=active.action?(lang==="ar"?active.action.ar:active.action.en):"";

 return <div className={`aqua-ai-shell ${open?"open":""} state-${state}`} dir={lang==="ar"?"rtl":"ltr"}>
  {greeting&&!open&&<button type="button" className="aqua-ai-greeting" onClick={()=>{setGreeting(false);setOpen(true)}}>
    <b>{lang==="ar"?"مرحباً، أنا Aqua AI":"Hello, I’m Aqua AI"}</b>
    <span>{greetingText}</span>
  </button>}

  {open&&<section className="aqua-ai-panel aqua-ai-panel-v2">
   <div className="aqua-ai-head">
    <div className="aqua-ai-head-brand"><FishMascot state={state}/><div><b>✦ Aqua AI</b><small>{lang==="ar"?"عقل الحوض المحلي • Tank-aware":"Local tank intelligence • Tank-aware"}</small></div></div>
    <button className="icon-btn" onClick={()=>setOpen(false)}>×</button>
   </div>

   <div className={`aqua-ai-tank-status status-${state}`}><span>{lang==="ar"?"الحوض الحالي":"Current tank"}</span><b>{tank.name}</b><em>{statusText}</em></div>

   {history.length>0&&<div className="aqua-ai-history-strip">{history.slice(-3).map(x=><button key={x.id} type="button" onClick={()=>setHistory(h=>{const found=h.find(y=>y.id===x.id);return found?[...h.filter(y=>y.id!==x.id),found]:h})}>{x.question}</button>)}</div>}

   <div className="aqua-ai-answer aqua-ai-structured-answer">
    <div className="aqua-ai-answer-head"><div><small>{lang==="ar"?"تحليل الحوض":"TANK ANALYSIS"}</small><h3>{title}</h3></div><span className={`ai-confidence ${active.confidence}`}>{confidenceLabel(active.confidence)}</span></div>
    <p className="aqua-ai-summary">{summary}</p>
    <div className="aqua-ai-reasoning-list">{details.slice(0,6).map((x,i)=><div key={i}><i>{i+1}</i><span>{x}</span></div>)}</div>
    <div className="aqua-ai-evidence"><small>{lang==="ar"?"مبني على بيانات الحوض":"Based on tank data"}</small><div>{evidence.map((x,i)=><span key={i}>{x}</span>)}</div></div>
    <div className="aqua-ai-local-note">{lang==="ar"?"هذا التحليل حالياً من محرك Aqua Nexus المحلي القائم على بيانات الحوض وقواعد الربط والتعلّم؛ مو نموذج LLM خارجي بعد.":"This analysis currently comes from Aqua Nexus' local tank-data reasoning engine; it is not yet an external LLM."}</div>
    {active.action&&<button className="btn primary aqua-ai-action" onClick={()=>go(active.action!.page)}>{actionText} →</button>}
   </div>

   <div className="aqua-ai-quick">{quick.map(x=><button key={x} onClick={()=>run(x)}>{x}</button>)}</div>
   <form className="aqua-ai-form" onSubmit={ask}><input value={q} onChange={e=>setQ(e.target.value)} placeholder={lang==="ar"?"مثلاً: ليش الكالسيوم عم ينزل بسرعة؟":"Example: why is calcium dropping faster?"}/><button className="btn primary" type="submit">{lang==="ar"?"حلّل":"Analyze"}</button></form>
  </section>}

  <button className="aqua-ai-fish-button" onClick={()=>{setGreeting(false);setOpen(v=>!v)}} aria-label="Aqua AI">
   <FishMascot state={state}/>
   <span className="aqua-ai-fish-label">Aqua AI</span>
   {state!=="normal"&&<i className="aqua-ai-alert-dot"/>}
  </button>
 </div>;
}
