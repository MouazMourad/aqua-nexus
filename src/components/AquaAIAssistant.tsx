"use client";
import { FormEvent,useEffect,useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { useAquaStore } from "@/store/useAquaStore";
import { bioload,chemistryHealth,maintenanceHealth,tankHealth,tankHealthTrend } from "@/domain/health";
import { aquaAIAnswer,type AquaAIAnswer,type AquaAIPage } from "@/domain/aquaAIBrain";
import { tankMood } from "@/domain/tankLearning";
import { learnedTankSignals } from "@/domain/tankPatterns";
import { createActionPlan,evaluatePlanOutcome,type AquaActionPlan } from "@/domain/actionPlanEngine";
import { askAquaAI } from "@/lib/aquaAIClient";
import { uid,nowISO } from "@/lib/appUtils";

function FishMascot({state}:{state:"normal"|"alert"|"critical"}){
 return <span className={`aqua-fish aqua-fish-${state}`} aria-hidden="true"><i className="aqua-fish-tail"/><i className="aqua-fish-body"><i className="aqua-fish-core"/><i className="aqua-fish-eye"/><i className="aqua-fish-line l1"/><i className="aqua-fish-line l2"/></i><i className="aqua-fish-fin"/></span>;
}

type Exchange={id:string;question:string;answer:AquaAIAnswer;mode:"local"|"external";provider?:string};

export function AquaAIAssistant({tank,page,onNavigate}:{tank:Tank;page:AppPage;onNavigate?:(page:AppPage)=>void}){
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[q,setQ]=useState(""),[history,setHistory]=useState<Exchange[]>([]),[greeting,setGreeting]=useState(false),[planNote,setPlanNote]=useState(""),[busy,setBusy]=useState(false);
 const th=tankHealth(tank),ch=chemistryHealth(tank),mh=maintenanceHealth(tank),trend=tankHealthTrend(tank),bio=bioload(tank),mood=tankMood(tank);
 const warnings=tank.equipment.some(x=>x.status==="warning"||x.status==="service");
 const state:"normal"|"alert"|"critical"=(th<60||ch<55||bio.status==="danger")?"critical":(th<80||ch<75||mh<70||trend==="declining"||warnings)?"alert":"normal";
 const welcome=useMemo(()=>aquaAIAnswer("",tank,page),[tank,page]);
 const learned=useMemo(()=>learnedTankSignals(tank),[tank]);
 const activeExchange=history[history.length-1];
 const active=activeExchange?.answer??welcome;
 const activeQuestion=activeExchange?.question||(lang==="ar"?"تحليل الحوض":"Tank analysis");
 const plans:AquaActionPlan[]=((tank as any).aiActionPlans??[]);
 const currentPlan=plans.find(x=>x.status==="active");

 useEffect(()=>{setHistory([]);setQ("");setPlanNote("");setBusy(false)},[tank.id]);
 useEffect(()=>{if(typeof window==="undefined")return;const key="aqua-ai-session-greeting-v2";if(sessionStorage.getItem(key))return;const timer=window.setTimeout(()=>{setGreeting(true);sessionStorage.setItem(key,"1")},650);const hide=window.setTimeout(()=>setGreeting(false),9000);return()=>{window.clearTimeout(timer);window.clearTimeout(hide)}},[]);

 async function run(question:string){
  const clean=question.trim()||(lang==="ar"?"حلل حوضي":"Analyze my tank");
  const local=aquaAIAnswer(clean,tank,page),id=`ai-${Date.now()}`;
  setHistory(h=>[...h.slice(-4),{id,question:clean,answer:local,mode:"local",provider:"Aqua Nexus local intelligence"}]);
  setQ("");setBusy(true);
  try{
    const result=await askAquaAI({tank,question:clean,page,language:lang});
    let answer:AquaAIAnswer=local;
    if(result.mode==="local"&&result.answer?.titleAr)answer=result.answer as AquaAIAnswer;
    else if(result.mode==="external"){
      const text=typeof result.answer?.text==="string"?result.answer.text:JSON.stringify(result.answer?.text??result.answer);
      answer={...local,summaryAr:lang==="ar"?text:local.summaryAr,summaryEn:lang==="en"?text:local.summaryEn,evidenceAr:[...local.evidenceAr,`AI: ${result.model||result.provider}`],evidenceEn:[...local.evidenceEn,`AI: ${result.model||result.provider}`]};
    }
    setHistory(h=>h.map(x=>x.id===id?{...x,answer,mode:result.mode,provider:result.model||result.provider}:x));
  }catch{
    // The local tank-aware answer remains available if the backend/provider is offline.
  }finally{setBusy(false);}
 }
 function ask(e?:FormEvent){e?.preventDefault();void run(q);}
 function go(pageKey:AquaAIPage){setOpen(false);onNavigate?.(pageKey as AppPage);}
 function createPlan(){
  if(currentPlan){setPlanNote(lang==="ar"?"في خطة متابعة نشطة حالياً. خلصها أو قيّم نتيجتها قبل إنشاء خطة جديدة.":"An action plan is already active. Complete or review it before creating another.");return;}
  const plan=createActionPlan(tank,activeQuestion,active),ts=nowISO();
  patch(tank.id,t=>({...t,aiActionPlans:[plan,...((t as any).aiActionPlans??[])],timeline:[{id:uid("ev"),timestamp:ts,type:"ai-action-plan",textAr:`Aqua AI أنشأ خطة متابعة: ${plan.titleAr}`,textEn:`Aqua AI created an action plan: ${plan.titleEn}`},...t.timeline]} as any));
  setPlanNote(lang==="ar"?"تم إنشاء خطة متابعة وربطها بتاريخ الحوض.":"Follow-up plan created and linked to tank history.");
 }
 function toggleStep(planId:string,stepId:string){
  patch(tank.id,t=>({...t,aiActionPlans:((t as any).aiActionPlans??[]).map((p:AquaActionPlan)=>p.id!==planId?p:{...p,steps:p.steps.map(s=>s.id!==stepId?s:{...s,done:!s.done,completedAt:!s.done?nowISO():undefined})})} as any));
 }
 function reviewPlan(plan:AquaActionPlan){
  const result=evaluatePlanOutcome(tank,plan),ts=nowISO();
  patch(tank.id,t=>({...t,aiActionPlans:((t as any).aiActionPlans??[]).map((p:AquaActionPlan)=>p.id!==plan.id?p:{...p,status:"completed",completedAt:ts,outcomeScore:result.current,outcome:result.outcome}),timeline:[{id:uid("ev"),timestamp:ts,type:"ai-action-outcome",textAr:`تم تقييم خطة Aqua AI: الحالة ${result.outcome==="improved"?"تحسنت":result.outcome==="worse"?"تراجعت":"بقيت مستقرة"} (${plan.baselineScore}% → ${result.current}%).`,textEn:`Aqua AI plan reviewed: tank ${result.outcome} (${plan.baselineScore}% → ${result.current}%).`},...t.timeline]} as any));
  setPlanNote(lang==="ar"?`تم إغلاق الخطة وتسجيل النتيجة: ${plan.baselineScore}% → ${result.current}%.`:`Plan closed and outcome recorded: ${plan.baselineScore}% → ${result.current}%.`);
 }

 const quick=lang==="ar"?["حلل حوضي","شو متوقع خلال أسبوع؟","شو تعلمت من تاريخ الحوض؟",tank.type==="marine"?"ليش KH عم ينزل؟":"حلل النترات","حلل صورة كائن"]:["Analyze my tank","What do you expect this week?","What have you learned from this tank?",tank.type==="marine"?"Why is KH dropping?":"Analyze nitrate","Analyze an organism photo"];
 const statusText=lang==="ar"?`${mood.symbol} ${mood.ar}`:`${mood.symbol} ${mood.en}`;
 const confidenceLabel=(c:AquaAIAnswer["confidence"])=>lang==="ar"?(c==="high"?"ثقة مرتفعة":c==="medium"?"ثقة متوسطة":"ثقة أولية"):(c==="high"?"High confidence":c==="medium"?"Medium confidence":"Early confidence");
 const greetingText=lang==="ar"?`أنا Aqua AI. عم اقرأ حالة ${tank.name} وتاريخه، مو بس أرقام منفصلة. اسألني شو عم يصير، ليش، أو لوين رايح الحوض.`:`I’m Aqua AI. I read ${tank.name} as a connected system and history, not isolated numbers. Ask what is happening, why, or where the tank is heading.`;
 const title=lang==="ar"?active.titleAr:active.titleEn,summary=lang==="ar"?active.summaryAr:active.summaryEn,details=lang==="ar"?active.detailsAr:active.detailsEn,evidence=lang==="ar"?active.evidenceAr:active.evidenceEn,actionText=active.action?(lang==="ar"?active.action.ar:active.action.en):"";
 const sourceNote=activeExchange?.mode==="external"
  ? (lang==="ar"?`تم تعزيز التحليل بنموذج AI خارجي (${activeExchange.provider||"provider"}) فوق سياق Aqua Nexus المحلي.`:`Analysis was enhanced by an external AI model (${activeExchange.provider||"provider"}) on top of Aqua Nexus tank context.`)
  : (lang==="ar"?"التحليل من محرك Aqua Nexus المحلي. إذا تم ضبط مزود AI على الخادم، يتحول لنمط LLM/Vision تلقائياً مع بقاء التحليل المحلي كمرجع.":"Analysis comes from Aqua Nexus local reasoning. When a server AI provider is configured, LLM/Vision enhancement is used automatically while local reasoning remains the grounding layer.");

 return <div className={`aqua-ai-shell ${open?"open":""} state-${state}`} dir={lang==="ar"?"rtl":"ltr"}>
  {greeting&&!open&&<button type="button" className="aqua-ai-greeting" onClick={()=>{setGreeting(false);setOpen(true)}}><b>{lang==="ar"?"مرحباً، أنا Aqua AI":"Hello, I’m Aqua AI"}</b><span>{greetingText}</span></button>}
  {open&&<section className="aqua-ai-panel aqua-ai-panel-v2">
   <div className="aqua-ai-head"><div className="aqua-ai-head-brand"><FishMascot state={state}/><div><b>✦ Aqua AI</b><small>{activeExchange?.mode==="external"?(lang==="ar"?"Tank-aware + AI":"Tank-aware + AI"):(lang==="ar"?"عقل الحوض المحلي • Tank-aware":"Local tank intelligence • Tank-aware")}</small></div></div><button className="icon-btn" onClick={()=>setOpen(false)}>×</button></div>
   <div className={`aqua-ai-tank-status status-${state}`}><span>{lang==="ar"?"الحوض الحالي":"Current tank"}</span><b>{tank.name}</b><em>{statusText}</em></div>
   {history.length>0&&<div className="aqua-ai-history-strip">{history.slice(-3).map(x=><button key={x.id} type="button" onClick={()=>setHistory(h=>{const found=h.find(y=>y.id===x.id);return found?[...h.filter(y=>y.id!==x.id),found]:h})}>{x.question}</button>)}</div>}
   <div className="aqua-ai-answer aqua-ai-structured-answer">
    <div className="aqua-ai-answer-head"><div><small>{lang==="ar"?"تحليل الحوض":"TANK ANALYSIS"}</small><h3>{title}</h3></div><span className={`ai-confidence ${active.confidence}`}>{confidenceLabel(active.confidence)}</span></div>
    <p className="aqua-ai-summary">{summary}</p>
    <div className="aqua-ai-reasoning-list">{details.slice(0,6).map((x,i)=><div key={i}><i>{i+1}</i><span>{x}</span></div>)}</div>
    {learned.length>0&&<div className="aqua-ai-learned-block"><small>{lang==="ar"?"شو تعلّم Aqua Nexus عن هالحوض":"WHAT AQUA NEXUS LEARNED"}</small>{learned.slice(0,2).map(x=><div key={x.id} className={`learned-signal ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}</div>}
    <div className="aqua-ai-evidence"><small>{lang==="ar"?"مبني على بيانات الحوض":"Based on tank data"}</small><div>{evidence.map((x,i)=><span key={i}>{x}</span>)}</div></div>
    <div className="aqua-ai-local-note">{busy?(lang==="ar"?"عم جرّب تعزيز الجواب عبر بوابة AI على الخادم...":"Trying server AI enhancement..."):sourceNote}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>{active.action&&onNavigate&&<button className="btn primary aqua-ai-action" onClick={()=>go(active.action!.page)}>{actionText} →</button>}<button className="btn aqua-ai-action" onClick={createPlan}>{lang==="ar"?"+ خطة متابعة":"+ Follow-up plan"}</button></div>
   </div>

   {currentPlan&&<div className="aqua-ai-plan"><div className="module-head"><div><small>ACTION PLAN</small><b>{lang==="ar"?currentPlan.titleAr:currentPlan.titleEn}</b></div><span className="scene-badge">{currentPlan.steps.filter(x=>x.done).length}/{currentPlan.steps.length}</span></div>{currentPlan.steps.map((s,i)=><button type="button" key={s.id} className={`ai-plan-step ${s.done?"done":""}`} onClick={()=>toggleStep(currentPlan.id,s.id)}><i>{s.done?"✓":i+1}</i><span>{lang==="ar"?s.titleAr:s.titleEn}</span></button>)}<div className="note">{lang==="ar"?`خط الأساس عند إنشاء الخطة: ${currentPlan.baselineScore}% • مراجعة مقترحة بعد ${currentPlan.reviewAfterHours} ساعة.`:`Baseline at creation: ${currentPlan.baselineScore}% • suggested review after ${currentPlan.reviewAfterHours}h.`}</div><button className="btn good" disabled={!currentPlan.steps.every(x=>x.done)} onClick={()=>reviewPlan(currentPlan)}>{lang==="ar"?"قيّم النتيجة وأغلق الخطة":"Review outcome & close plan"}</button></div>}
   {planNote&&<div className="inline-alert info">{planNote}</div>}
   <div className="aqua-ai-quick">{quick.map(x=><button key={x} disabled={busy} onClick={()=>void run(x)}>{x}</button>)}</div>
   <form className="aqua-ai-form" onSubmit={ask}><input value={q} onChange={e=>setQ(e.target.value)} placeholder={lang==="ar"?"مثلاً: ليش الكالسيوم عم ينزل بسرعة؟":"Example: why is calcium dropping faster?"}/><button className="btn primary" type="submit" disabled={busy}>{busy?(lang==="ar"?"عم حلّل...":"Analyzing..."):(lang==="ar"?"حلّل":"Analyze")}</button></form>
  </section>}
  <button className="aqua-ai-fish-button" onClick={()=>{setGreeting(false);setOpen(v=>!v)}} aria-label="Aqua AI"><FishMascot state={state}/><span className="aqua-ai-fish-label">Aqua AI</span>{state!=="normal"&&<i className="aqua-ai-alert-dot"/>}</button>
 </div>;
}
