"use client";
import { useEffect,useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { useAquaStore } from "@/store/useAquaStore";
import { bioload,chemistryHealth,maintenanceHealth,tankHealth,tankHealthTrend } from "@/domain/health";
import { aquaAIAnswer,type AquaAIAnswer,type AquaAIPage } from "@/domain/aquaAIBrain";
import { tankMood } from "@/domain/tankLearning";
import { learnedTankSignals } from "@/domain/tankPatterns";
import { createActionPlan,evaluatePlanOutcome,type AquaActionPlan } from "@/domain/actionPlanEngine";
import { uid,nowISO } from "@/lib/appUtils";

function FishMascot({state}:{state:"normal"|"alert"|"critical"}){
 return <span className={`aqua-fish aqua-fish-${state}`} aria-hidden="true"><i className="aqua-fish-tail"/><i className="aqua-fish-body"><i className="aqua-fish-core"/><i className="aqua-fish-eye"/><i className="aqua-fish-line l1"/><i className="aqua-fish-line l2"/></i><i className="aqua-fish-fin"/></span>;
}

type InsightView={id:string;labelAr:string;labelEn:string;promptAr:string;promptEn:string};

export function AquaAIAssistant({tank,page,onNavigate}:{tank:Tank;page:AppPage;onNavigate?:(page:AppPage)=>void}){
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[selected,setSelected]=useState("state"),[greeting,setGreeting]=useState(false),[planNote,setPlanNote]=useState("");
 const th=tankHealth(tank),ch=chemistryHealth(tank),mh=maintenanceHealth(tank),trend=tankHealthTrend(tank),bio=bioload(tank),mood=tankMood(tank);
 const warnings=tank.equipment.some(x=>x.status==="warning"||x.status==="service");
 const state:"normal"|"alert"|"critical"=(th<60||ch<55||bio.status==="danger")?"critical":(th<80||ch<75||mh<70||trend==="declining"||warnings)?"alert":"normal";
 const learned=useMemo(()=>learnedTankSignals(tank),[tank]);
 const plans:AquaActionPlan[]=((tank as any).aiActionPlans??[]),currentPlan=plans.find(x=>x.status==="active");
 const views:InsightView[]=[
  {id:"state",labelAr:"حالة الحوض",labelEn:"Tank state",promptAr:"حلل حوضي",promptEn:"Analyze my tank"},
  {id:"forecast",labelAr:"توقع 7 أيام",labelEn:"7-day outlook",promptAr:"شو متوقع خلال أسبوع؟",promptEn:"What do you expect this week?"},
  {id:"memory",labelAr:"ذاكرة الحوض",labelEn:"Tank memory",promptAr:"شو تعلمت من تاريخ الحوض؟",promptEn:"What have you learned from this tank?"},
  {id:"parameter",labelAr:tank.type==="marine"?"اتجاه KH":"اتجاه NO3",labelEn:tank.type==="marine"?"KH trend":"NO3 trend",promptAr:tank.type==="marine"?"ليش KH عم ينزل؟":"حلل النترات",promptEn:tank.type==="marine"?"Why is KH dropping?":"Analyze nitrate"}
 ];
 const view=views.find(x=>x.id===selected)??views[0];
 const active=useMemo(()=>aquaAIAnswer(lang==="ar"?view.promptAr:view.promptEn,tank,page),[lang,page,tank,view.promptAr,view.promptEn]);
 const activeQuestion=lang==="ar"?view.promptAr:view.promptEn;

 useEffect(()=>{setSelected("state");setPlanNote("")},[tank.id]);
 useEffect(()=>{if(typeof window==="undefined")return;const key="tank-intelligence-session-greeting-v1";if(sessionStorage.getItem(key))return;const timer=window.setTimeout(()=>{setGreeting(true);sessionStorage.setItem(key,"1")},650);const hide=window.setTimeout(()=>setGreeting(false),8500);return()=>{window.clearTimeout(timer);window.clearTimeout(hide)}},[]);

 function go(pageKey:AquaAIPage){setOpen(false);onNavigate?.(pageKey as AppPage);}
 function createPlan(){
  if(currentPlan){setPlanNote(lang==="ar"?"في خطة متابعة نشطة حالياً. خلصها أو قيّم نتيجتها قبل إنشاء خطة جديدة.":"An action plan is already active. Complete or review it before creating another.");return;}
  const plan=createActionPlan(tank,activeQuestion,active),ts=nowISO();
  patch(tank.id,t=>({...t,aiActionPlans:[plan,...((t as any).aiActionPlans??[])],timeline:[{id:uid("ev"),timestamp:ts,type:"ai-action-plan",textAr:`Local Best AI أنشأ خطة متابعة: ${plan.titleAr}`,textEn:`Local Best AI created an action plan: ${plan.titleEn}`},...t.timeline]} as any));
  setPlanNote(lang==="ar"?"تم إنشاء خطة متابعة وربطها بتاريخ الحوض.":"Follow-up plan created and linked to tank history.");
 }
 function toggleStep(planId:string,stepId:string){patch(tank.id,t=>({...t,aiActionPlans:((t as any).aiActionPlans??[]).map((p:AquaActionPlan)=>p.id!==planId?p:{...p,steps:p.steps.map(s=>s.id!==stepId?s:{...s,done:!s.done,completedAt:!s.done?nowISO():undefined})})} as any));}
 function reviewPlan(plan:AquaActionPlan){
  const result=evaluatePlanOutcome(tank,plan),ts=nowISO();
  patch(tank.id,t=>({...t,aiActionPlans:((t as any).aiActionPlans??[]).map((p:AquaActionPlan)=>p.id!==plan.id?p:{...p,status:"completed",completedAt:ts,outcomeScore:result.current,outcome:result.outcome}),timeline:[{id:uid("ev"),timestamp:ts,type:"ai-action-outcome",textAr:`تم تقييم خطة Local Best AI: الحالة ${result.outcome==="improved"?"تحسنت":result.outcome==="worse"?"تراجعت":"بقيت مستقرة"} (${plan.baselineScore}% → ${result.current}%).`,textEn:`Local Best AI plan reviewed: tank ${result.outcome} (${plan.baselineScore}% → ${result.current}%).`},...t.timeline]} as any));
  setPlanNote(lang==="ar"?`تم إغلاق الخطة وتسجيل النتيجة: ${plan.baselineScore}% → ${result.current}%.`:`Plan closed and outcome recorded: ${plan.baselineScore}% → ${result.current}%.`);
 }

 const statusText=lang==="ar"?`${mood.symbol} ${mood.ar}`:`${mood.symbol} ${mood.en}`;
 const confidenceLabel=(c:AquaAIAnswer["confidence"])=>lang==="ar"?(c==="high"?"ثقة مرتفعة":c==="medium"?"ثقة متوسطة":"ثقة أولية"):(c==="high"?"High confidence":c==="medium"?"Medium confidence":"Early confidence");
 const greetingText=lang==="ar"?`Local Best AI عم يقرأ حالة ${tank.name} وتاريخه واتجاهاته محلياً. افتحه لتعرف شو ملاحظ، شو ممكن يعني، وشو الفحص التالي.`:`Local Best AI reads ${tank.name}'s state, history and trends locally. Open it to see what it notices, what it may mean, and what to check next.`;
 const title=lang==="ar"?active.titleAr:active.titleEn,summary=lang==="ar"?active.summaryAr:active.summaryEn,details=lang==="ar"?active.detailsAr:active.detailsEn,evidence=lang==="ar"?active.evidenceAr:active.evidenceEn,actionText=active.action?(lang==="ar"?active.action.ar:active.action.en):"";
 const nextCheck=actionText||(lang==="ar"?"استمر بالمراقبة وسجّل أي تغير جديد قبل تعديل أكثر من متغير بنفس الوقت.":"Keep monitoring and record any new change before altering multiple variables at once.");

 return <div className={`aqua-ai-shell ${open?"open":""} state-${state}`} dir={lang==="ar"?"rtl":"ltr"}>
  {greeting&&!open&&<button type="button" className="aqua-ai-greeting" onClick={()=>{setGreeting(false);setOpen(true)}}><b>Local Best AI</b><span>{greetingText}</span></button>}
  {open&&<section className="aqua-ai-panel aqua-ai-panel-v2">
   <div className="aqua-ai-head"><div className="aqua-ai-head-brand"><FishMascot state={state}/><div><b>✦ Local Best AI</b><small>{lang==="ar"?"Tank Intelligence • محلي • خاص بالحوض الحالي":"Tank Intelligence • local • current tank only"}</small></div></div><button className="icon-btn" onClick={()=>setOpen(false)}>×</button></div>
   <div className={`aqua-ai-tank-status status-${state}`}><span>{lang==="ar"?"الحوض الحالي":"Current tank"}</span><b>{tank.name}</b><em>{statusText}</em></div>
   <div className="aqua-ai-quick">{views.map(x=><button key={x.id} className={selected===x.id?"active":""} onClick={()=>setSelected(x.id)}>{lang==="ar"?x.labelAr:x.labelEn}</button>)}</div>
   <div className="aqua-ai-answer aqua-ai-structured-answer">
    <div className="aqua-ai-answer-head"><div><small>{lang==="ar"?"فهم الحوض":"TANK UNDERSTANDING"}</small><h3>{title}</h3></div><span className={`ai-confidence ${active.confidence}`}>{confidenceLabel(active.confidence)}</span></div>
    <div className="aqua-ai-learned-block"><small>{lang==="ar"?"1 • ماذا ألاحظ":"1 • WHAT I NOTICE"}</small><div className="learned-signal info">{summary}</div></div>
    <div className="aqua-ai-learned-block"><small>{lang==="ar"?"2 • ماذا قد يعني ذلك":"2 • POSSIBLE MEANING"}</small><div className="aqua-ai-reasoning-list">{details.slice(0,5).map((x,i)=><div key={i}><i>{i+1}</i><span>{x}</span></div>)}</div></div>
    <div className="aqua-ai-learned-block"><small>{lang==="ar"?"3 • ماذا تفحص الآن":"3 • NEXT BEST CHECK"}</small><div className="learned-signal info">{nextCheck}</div></div>
    <div className="aqua-ai-learned-block"><small>{lang==="ar"?"4 • مستوى الثقة":"4 • CONFIDENCE LEVEL"}</small><div className={`learned-signal ${active.confidence==="high"?"good":active.confidence==="medium"?"info":"warn"}`}>{confidenceLabel(active.confidence)}</div></div>
    {learned.length>0&&<div className="aqua-ai-learned-block"><small>{lang==="ar"?"ذاكرة الحوض":"TANK MEMORY"}</small>{learned.slice(0,2).map(x=><div key={x.id} className={`learned-signal ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}</div>}
    <div className="aqua-ai-evidence"><small>{lang==="ar"?"مبني على بيانات الحوض الحالي":"Based on current tank data"}</small><div>{evidence.map((x,i)=><span key={i}>{x}</span>)}</div></div>
    <div className="aqua-ai-local-note">{lang==="ar"?"Local Best AI يعمل من منطق Aqua Nexus وبيانات الحوض محلياً، مو شات عام ولا بيعتمد على خدمة AI خارجية حتى يعطي فهم الحوض الأساسي.":"Local Best AI uses Aqua Nexus logic and tank data locally. It is not a general chatbot and does not depend on an external AI service for core tank understanding."}</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>{active.action&&onNavigate&&<button className="btn primary aqua-ai-action" onClick={()=>go(active.action!.page)}>{actionText} →</button>}<button className="btn aqua-ai-action" onClick={createPlan}>{lang==="ar"?"+ خطة متابعة":"+ Follow-up plan"}</button></div>
   </div>
   {currentPlan&&<div className="aqua-ai-plan"><div className="module-head"><div><small>ACTION PLAN</small><b>{lang==="ar"?currentPlan.titleAr:currentPlan.titleEn}</b></div><span className="scene-badge">{currentPlan.steps.filter(x=>x.done).length}/{currentPlan.steps.length}</span></div>{currentPlan.steps.map((s,i)=><button type="button" key={s.id} className={`ai-plan-step ${s.done?"done":""}`} onClick={()=>toggleStep(currentPlan.id,s.id)}><i>{s.done?"✓":i+1}</i><span>{lang==="ar"?s.titleAr:s.titleEn}</span></button>)}<div className="note">{lang==="ar"?`خط الأساس عند إنشاء الخطة: ${currentPlan.baselineScore}% • مراجعة مقترحة بعد ${currentPlan.reviewAfterHours} ساعة.`:`Baseline at creation: ${currentPlan.baselineScore}% • suggested review after ${currentPlan.reviewAfterHours}h.`}</div><button className="btn good" disabled={!currentPlan.steps.every(x=>x.done)} onClick={()=>reviewPlan(currentPlan)}>{lang==="ar"?"قيّم النتيجة وأغلق الخطة":"Review outcome & close plan"}</button></div>}
   {planNote&&<div className="inline-alert info">{planNote}</div>}
  </section>}
  <button className="aqua-ai-fish-button" onClick={()=>{setGreeting(false);setOpen(v=>!v)}} aria-label="Local Best AI"><FishMascot state={state}/><span className="aqua-ai-fish-label">Local Best AI</span>{state!=="normal"&&<i className="aqua-ai-alert-dot"/>}</button>
 </div>;
}
