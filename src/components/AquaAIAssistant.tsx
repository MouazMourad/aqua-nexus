"use client";
import { FormEvent,useEffect,useMemo,useRef,useState } from "react";
import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { useAquaStore } from "@/store/useAquaStore";
import { systemHealthTrend } from "@/domain/systemHealth";
import { tankIntelligenceCore } from "@/domain/intelligenceCore";
import { aquaAIAnswer,type AquaAIAnswer,type AquaAIPage } from "@/domain/aquaAIBrain";
import { parseAquaQuestion,resolveAquaFollowup,type AquaConversationTurn } from "@/domain/aquaAIIntent";
import { tankMood } from "@/domain/tankLearning";
import { learnedTankSignals } from "@/domain/tankPatterns";
import { domainOutcomeLearning } from "@/domain/outcomeLearning";
import { createActionPlan,evaluatePlanOutcome,type AquaActionPlan } from "@/domain/actionPlanEngine";
import { AquaAIActionPlanCard } from "@/components/ai/AquaAIActionPlanCard";
import { uid,nowISO } from "@/lib/appUtils";
import { askAquaAI } from "@/lib/aquaAIClient";

function FishMascot({state}:{state:"normal"|"alert"|"critical"}){
 return <span className={`aqua-fish aqua-fish-${state}`} aria-hidden="true">
  <svg className="aqua-ai-fish-svg" viewBox="0 0 120 72" fill="none">
   <path className="ai-tail" d="M28 36 6 18v36l22-18Z"/>
   <path className="ai-body" d="M25 36C39 13 75 9 103 30c5 4 5 8 0 12C75 63 39 59 25 36Z"/>
   <path className="ai-fin" d="M55 20 68 5l5 19M58 52l11 14 5-17"/>
   <circle className="ai-eye-ring" cx="91" cy="30" r="6"/><circle className="ai-eye" cx="91" cy="30" r="2.5"/>
   <path className="ai-circuit" d="M38 36h9l5-10 8 21 7-15 5 7h13"/>
   <circle className="ai-node" cx="38" cy="36" r="2"/><circle className="ai-node" cx="85" cy="39" r="2"/>
   <path className="ai-gill" d="M82 23c-5 7-5 18 0 25"/>
  </svg>
 </span>;
}

type InsightView={id:string;labelAr:string;labelEn:string;promptAr:string;promptEn:string};

export function AquaAIAssistant({tank,page,onNavigate}:{tank:Tank;page:AppPage;onNavigate?:(page:AppPage)=>void}){
 const lang=useAquaStore(s=>s.language),experience=useAquaStore(s=>s.aquariumExperience),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[editingOverlay,setEditingOverlay]=useState(false),[selected,setSelected]=useState<string|null>(null),[question,setQuestion]=useState(""),[askedQuestion,setAskedQuestion]=useState(""),[resolvedQuestion,setResolvedQuestion]=useState(""),[conversationContext,setConversationContext]=useState(""),[conversationHistory,setConversationHistory]=useState<AquaConversationTurn[]>([]),[stage,setStage]=useState(0),[scopeBlocked,setScopeBlocked]=useState(false),[greeting,setGreeting]=useState(false),[planNote,setPlanNote]=useState("");
 const [deepAI,setDeepAI]=useState<{status:"idle"|"loading"|"external"|"local"|"error";text?:string;provider?:string;model?:string}>({status:"idle"});
 const deepRequestRef=useRef(0);
 const core=useMemo(()=>tankIntelligenceCore(tank),[tank]);
 const health=core.health,trend=systemHealthTrend(tank),alerts=core.alerts,mood=tankMood(tank);
 const hasDanger=alerts.some(x=>x.level==="danger"),hasWarning=alerts.some(x=>x.level==="warn");
 const state:"normal"|"alert"|"critical"=(health.score<60||hasDanger)?"critical":(health.score<80||trend==="declining"||hasWarning)?"alert":"normal";
 const visualTone:"excellent"|"good"|"moderate"|"critical"=(health.score<60||hasDanger)?"critical":(health.score<80||trend==="declining"||hasWarning)?"moderate":health.score>=90?"excellent":"good";
 const learned=useMemo(()=>[...domainOutcomeLearning(tank),...learnedTankSignals(tank)].slice(0,8),[tank]);
 const plans:AquaActionPlan[]=((tank as any).aiActionPlans??[]),currentPlan=plans.find(x=>x.status==="active");
 const views:InsightView[]=[
  {id:"state",labelAr:"حالة الحوض الآن",labelEn:"Tank state now",promptAr:"حلل حالة الحوض الآن",promptEn:"Analyze the tank state now"},
  {id:"why",labelAr:"ليش هيك؟",labelEn:"Why this state?",promptAr:"ليش حالة الحوض هيك؟ حلل الأسباب",promptEn:"Why is the tank in this state? Analyze the reasons"},
  {id:"changed",labelAr:"شو تغيّر؟",labelEn:"What changed?",promptAr:"شو صار بعد الأحداث الأخيرة؟ وشو تعلمت من تاريخ الحوض؟",promptEn:"What changed after recent events and what did you learn from tank history?"},
  {id:"action",labelAr:"شو أعمل هلق؟",labelEn:"What should I do?",promptAr:"شو أعمل هلق بالحوض؟",promptEn:"What should I do with the tank now?"}
 ];
 const active=useMemo(()=>askedQuestion&&!scopeBlocked?aquaAIAnswer(resolvedQuestion||askedQuestion,tank,page):null,[askedQuestion,resolvedQuestion,scopeBlocked,tank,page]);

 useEffect(()=>{
  if(typeof document==="undefined")return;
  const syncEditingOverlay=()=>{
   const candidates=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],dialog[open],.modal-backdrop,.modal-overlay,.sheet-backdrop'));
   const active=candidates.some(el=>!el.closest(".aqua-ai-shell")&&getComputedStyle(el).display!=="none"&&getComputedStyle(el).visibility!=="hidden");
   setEditingOverlay(active);
  };
  syncEditingOverlay();
  const observer=new MutationObserver(syncEditingOverlay);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style","open","aria-hidden"]});
  return()=>observer.disconnect();
 },[]);

 useEffect(()=>{deepRequestRef.current+=1;setSelected(null);setQuestion("");setAskedQuestion("");setResolvedQuestion("");setConversationContext("");setConversationHistory([]);setStage(0);setScopeBlocked(false);setPlanNote("");setDeepAI({status:"idle"})},[tank.id]);
 useEffect(()=>{if(typeof window==="undefined")return;const key="tank-intelligence-session-greeting-v2";if(sessionStorage.getItem(key))return;const timer=window.setTimeout(()=>{setGreeting(true);sessionStorage.setItem(key,"1")},650);const hide=window.setTimeout(()=>setGreeting(false),8000);return()=>{window.clearTimeout(timer);window.clearTimeout(hide)}},[]);

 function go(pageKey:AquaAIPage){setOpen(false);onNavigate?.(pageKey as AppPage);}
 function outOfScope(q:string){
  const clean=(q||"").trim();
  if(!clean)return false;
  if(clean.includes("| follow-up:"))return false;
  const intent=parseAquaQuestion(clean);
  const namedTankEntity=[...tank.livestock.map(x=>x.name),...tank.livestock.map(x=>x.nameEn||""),...tank.equipment.map(x=>x.name),...tank.equipment.map(x=>x.brand||""),...tank.equipment.map(x=>x.model||"")].filter(Boolean).some(name=>clean.toLowerCase().includes(name.toLowerCase()));
  const fishWord=/(^|\\s)(?:ال)?سمك($|\\s)|(^|\\s)(?:ال)?اسماك($|\\s)/i.test(clean);
  const aquariumWords=fishWord||/(حوض|احواض|أحواض|مرجان|مشروم|تورش|هامر|بابل|انيمون|أنيمون|روبيان|جمبري|قشريات|حلزون|نجم بحر|قنفذ|كائن|كائنات|ملوح|حرار|كيميا|كيمياء|نيترات|نترات|فوسفات|كالسيوم|مغنيسيوم|مغنزيوم|قلوي|kh\b|ca\b|mg\b|no3\b|po4\b|nh3\b|no2\b|ph\b|salinity|reef|aquarium|tank|fish|coral|shrimp|snail|livestock|skimmer|pump|heater|filter|sump|acclimation|dosing|water change|rodi|ro\/di)/i.test(clean);
  const aquariumIntent=intent.params.length>0||intent.topics.some(x=>x!=="general")||intent.asksAboutBioload;
  if(namedTankEntity||aquariumWords||aquariumIntent)return false;
  const explicitOutside=/(مباراة|كرة قدم|دوري|سياسة|انتخابات|رئيس|وزير|حكومة|طقس|مطر|ثلج|رسالة رسمية|ايميل|إيميل|برمجة|كود|سيرة ذاتية|سيارة|موبايل|ايفون|آيفون|اندرويد|راتب|وظيفة|وظائف|بورصة|اسهم|أسهم|بيتكوين|عملة|دولار|يورو|ليرة|سعر الصرف|صرف العملة|وصفة طبخ|طبخ|فيلم|مسلسل|اغنية|أغنية|ترجم|ترجمة|رياضيات|معادلة|من هو|مين هو|عاصمة|تاريخ|football|match|league|politic|election|president|minister|government|weather|email|resume|code|programming|car\b|phone|iphone|android|salary|job\b|stocks?|bitcoin|currency|exchange rate|dollar|euro|recipe|movie|series|song|translate|capital of|who is)/i.test(clean);
  return explicitOutside;
 }
 function scopeReply(q:string){
  const seed=[...q].reduce((s,ch)=>s+ch.charCodeAt(0),0)%3;
  const ar=[
   {title:"😂 هون طلعتني برا الحوض!",text:"أنا Local Best AI، مخّي مبلّل شوي 😄 اختصاصي الحوض وبس: السمك، المرجان، الكيمياء، المعدات، الصيانة والأقلمة. سيارات وسياسة ومباريات وباقي الدنيا؟ لا دخلني فيهن… رجّعني للمي وبخدمك من عيوني 🐠"},
   {title:"🐠 أنا ساكن بالحوض يا معلم!",text:"ذكائي مربوط بـ Aqua Nexus وبيانات حوضك فقط. إذا السؤال عن الحوض أنا معك للآخر؛ إذا عن شي تاني، بعمل حالي سمكة وما سمعت السؤال 😄"},
   {title:"😄 برا المي ما إلي شغل!",text:"أنا اختصاصي أحواض حصراً: كائنات، كيمياء، فلترة، معدات، صيانة، أقلمة وتحليل حالة الحوض. أي موضوع تاني خلّيه للمساعد العام… وأنا برجع أراقب السمك 🫡🐟"}
  ];
  const en=[
   {title:"😂 You pulled me out of the tank!",text:"I’m Local Best AI — my brain lives in aquarium water 😄 I handle livestock, chemistry, equipment, maintenance and acclimation. Cars, politics, sports and the rest of the world? Not my tank 🐠"},
   {title:"🐠 I live in the aquarium!",text:"My intelligence is tied to Aqua Nexus and your tank data only. Ask me anything aquarium-related and I’m all in; anything else and I’ll pretend I’m a fish that didn’t hear it 😄"},
   {title:"😄 Outside the water, I’m off duty!",text:"I specialize in aquariums only: livestock, chemistry, filtration, equipment, maintenance, acclimation and tank analysis. For everything else, use the general assistant — I’ll get back to watching the fish 🐟"}
  ];
  return (lang==="ar"?ar:en)[seed];
 }
 async function requestDeepAI(resolved:string){
  const requestId=++deepRequestRef.current;
  setDeepAI({status:"loading"});
  try{
   const result=await askAquaAI({tank,question:resolved,page,language:lang});
   if(requestId!==deepRequestRef.current)return;
   if(result.mode==="external"&&result.answer?.text){
    setDeepAI({status:"external",text:String(result.answer.text),provider:result.provider,model:result.model});
   }else{
    setDeepAI({status:"local",provider:result.provider});
   }
  }catch{
   if(requestId===deepRequestRef.current)setDeepAI({status:"error"});
  }
 }
 function ask(prompt:string,id:string|null=null){const clean=prompt.trim();if(!clean)return;const resolved=resolveAquaFollowup(clean,conversationContext,conversationHistory);const parsed=parseAquaQuestion(resolved),blocked=outOfScope(resolved);setConversationHistory(h=>[...h.slice(-5),{question:clean,resolved,mode:parsed.mode,topics:parsed.topics,params:parsed.params}]);setSelected(id);setAskedQuestion(clean);setResolvedQuestion(resolved);setConversationContext(resolved);setQuestion("");setStage(1);setPlanNote("");setScopeBlocked(blocked);setDeepAI({status:"idle"});if(!blocked)void requestDeepAI(resolved);}
 function submit(e:FormEvent){e.preventDefault();ask(question,null);}
 function resetConversation(){deepRequestRef.current+=1;setSelected(null);setQuestion("");setAskedQuestion("");setResolvedQuestion("");setConversationContext("");setConversationHistory([]);setStage(0);setScopeBlocked(false);setPlanNote("");setDeepAI({status:"idle"});}
 function createPlan(){
  if(!active)return;
  if(currentPlan){setPlanNote(lang==="ar"?"في خطة متابعة نشطة حالياً. خلصها أو قيّم نتيجتها قبل إنشاء خطة جديدة.":"An action plan is already active. Complete or review it before creating another.");return;}
  const plan=createActionPlan(tank,askedQuestion,active),ts=nowISO();
  patch(tank.id,t=>({...t,aiActionPlans:[plan,...((t as any).aiActionPlans??[])],timeline:[{id:uid("ev"),timestamp:ts,type:"ai-action-plan",textAr:`Local Best AI أنشأ خطة متابعة: ${plan.titleAr}`,textEn:`Local Best AI created an action plan: ${plan.titleEn}`},...t.timeline]} as any));
  setPlanNote(lang==="ar"?"تم إنشاء خطة متابعة وربطها بتاريخ الحوض.":"Follow-up plan created and linked to tank history.");
 }
 function toggleStep(planId:string,stepId:string){patch(tank.id,t=>({...t,aiActionPlans:((t as any).aiActionPlans??[]).map((p:AquaActionPlan)=>p.id!==planId?p:{...p,steps:p.steps.map(s=>s.id!==stepId?s:{...s,done:!s.done,completedAt:!s.done?nowISO():undefined})})} as any));}
 function reviewPlan(plan:AquaActionPlan){
  const result=evaluatePlanOutcome(tank,plan),ts=nowISO();
  const stateAr=result.outcome==="improved"?"تحسنت":result.outcome==="worse"?"تراجعت":"بقيت مستقرة";
  patch(tank.id,t=>({...t,aiActionPlans:((t as any).aiActionPlans??[]).map((p:AquaActionPlan)=>p.id!==plan.id?p:{...p,status:"completed",completedAt:ts,outcomeScore:result.current,outcome:result.outcome,outcomeDetails:result.details,outcomeSummaryAr:result.summaryAr,outcomeSummaryEn:result.summaryEn}),timeline:[{id:uid("ev"),timestamp:ts,type:"ai-action-outcome",textAr:`تم تقييم خطة Local Best AI: ${stateAr}. ${result.summaryAr}`,textEn:`Local Best AI plan reviewed: ${result.outcome}. ${result.summaryEn}`},...t.timeline]} as any));
  setPlanNote(lang==="ar"?`تم إغلاق الخطة: ${stateAr}. ${result.summaryAr}`:`Plan closed: ${result.outcome}. ${result.summaryEn}`);
 }

 const statusText=lang==="ar"?`${mood.symbol} ${mood.ar}`:`${mood.symbol} ${mood.en}`;
 const confidenceLabel=(c:AquaAIAnswer["confidence"])=>lang==="ar"?(c==="high"?"ثقة مرتفعة":c==="medium"?"ثقة متوسطة":"ثقة أولية"):(c==="high"?"High confidence":c==="medium"?"Medium confidence":"Early confidence");
 const greetingText=lang==="ar"?`أنا جاهز أفهم ${tank.name} معك. اسألني عن حالته، شو تغيّر، ليش، أو شو تعمل بعدين.`:`I am ready to understand ${tank.name} with you. Ask about its state, what changed, why, or what to do next.`;
 const title=active?(lang==="ar"?active.titleAr:active.titleEn):"",summary=active?(lang==="ar"?active.summaryAr:active.summaryEn):"",details=active?(lang==="ar"?active.detailsAr:active.detailsEn):[],evidence=active?(lang==="ar"?active.evidenceAr:active.evidenceEn):[],actionText=active?.action?(lang==="ar"?active.action.ar:active.action.en):"";
 const nextCheck=actionText||(lang==="ar"?"استمر بالمراقبة وسجّل أي تغير جديد قبل تعديل أكثر من متغير بنفس الوقت.":"Keep monitoring and record any new change before altering multiple variables at once.");
 const scopeMessage=scopeBlocked?scopeReply(askedQuestion):null;
 const answerIntent=parseAquaQuestion(resolvedQuestion||askedQuestion||"");
 const autoStage=["how","when","latest","list","count","why"].includes(answerIntent.mode)?2:["action","dose","waterChange","canAdd","whatIf"].includes(answerIntent.mode)?3:1;
 const experienceStage=experience==="advanced"?4:experience==="intermediate"?2:1;
 const visibleStage=Math.max(stage,autoStage,experienceStage);
 const detailLimit=experience==="advanced"?8:experience==="intermediate"?5:3;
 const learnedLimit=experience==="advanced"?4:experience==="intermediate"?2:1;
 const detailLabel=lang==="ar"?(answerIntent.mode==="how"?"الخطوات العملية":answerIntent.mode==="when"?"المواعيد والتفاصيل":answerIntent.mode==="latest"?"آخر بيانات مسجلة":answerIntent.mode==="list"||answerIntent.mode==="count"?"التفاصيل":answerIntent.mode==="why"?"الأسباب وما ألاحظه":"التفاصيل والتحليل"):(answerIntent.mode==="how"?"PRACTICAL STEPS":answerIntent.mode==="when"?"TIMING & DETAILS":answerIntent.mode==="latest"?"LATEST LOGGED DATA":answerIntent.mode==="list"||answerIntent.mode==="count"?"DETAILS":answerIntent.mode==="why"?"WHY • WHAT I NOTICE":"DETAILS & ANALYSIS");

 return <div className={`aqua-ai-shell ${open?"open":""} state-${state}`} dir={lang==="ar"?"rtl":"ltr"}>
  {greeting&&!open&&<button type="button" className="aqua-ai-greeting" onClick={()=>{setGreeting(false);setOpen(true)}}><b>Local Best AI</b><span>{greetingText}</span></button>}
  {open&&<section className="aqua-ai-panel aqua-ai-panel-v2 conversational-ai">
   <div className="aqua-ai-head"><div className="aqua-ai-head-brand"><FishMascot state={state}/><div><b>✦ Local Best AI</b><small>{lang==="ar"?"Tank Intelligence • محلي • للحوض الحالي فقط":"Tank Intelligence • local • current tank only"}</small></div></div><button className="icon-btn" onClick={()=>setOpen(false)}>×</button></div>
   <div className={`aqua-ai-tank-status status-${state}`}><span>{lang==="ar"?"الحوض الحالي":"Current tank"}</span><b>{tank.name}</b><em>{statusText}</em></div>

   {!askedQuestion&&!scopeBlocked&&<div className="ai-conversation-home">
    <div className="ai-chat-bubble assistant"><small>Local Best AI</small><b>{lang==="ar"?`مرحباً 👋 شو بتحب تعرف عن ${tank.name} اليوم؟`:`Hello 👋 What would you like to know about ${tank.name} today?`}</b><span>{lang==="ar"?"ما رح أغرقك بكل البيانات. اختار سؤال وأنا بكشف التفاصيل خطوة بخطوة.":"I will not dump all the data at once. Choose a question and I will reveal the details step by step."}</span></div>
    <div className="aqua-ai-quick ai-choice-grid">{views.map(x=><button key={x.id} onClick={()=>ask(lang==="ar"?x.promptAr:x.promptEn,x.id)}>{lang==="ar"?x.labelAr:x.labelEn}</button>)}</div>
    <form className="ai-chat-input" onSubmit={submit}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder={lang==="ar"?"أو اكتب سؤالك عن الحوض...":"Or type your tank question..."}/><button className="btn primary" type="submit">{lang==="ar"?"إرسال":"Send"}</button></form>
   </div>}

   {(askedQuestion||scopeBlocked)&&<div className="ai-conversation-flow">
    <div className="ai-chat-bubble user"><span>{askedQuestion}</span></div>
    {scopeBlocked?<div className="ai-chat-bubble assistant ai-out-of-scope"><small>Local Best AI • AQUARIUM ONLY</small><b>{scopeMessage?.title}</b><span>{scopeMessage?.text}</span><div className="ai-scope-hints"><span>🐠 {lang==="ar"?"الكائنات":"Livestock"}</span><span>🧪 {lang==="ar"?"الكيمياء":"Chemistry"}</span><span>⚙️ {lang==="ar"?"المعدات":"Equipment"}</span><span>🧹 {lang==="ar"?"الصيانة":"Maintenance"}</span><span>💧 {lang==="ar"?"الأقلمة":"Acclimation"}</span></div></div>:active&&<>
      <div className="ai-chat-bubble assistant ai-summary-bubble"><div className="aqua-ai-answer-head"><div><small>{lang==="ar"?"الجواب المختصر":"SHORT ANSWER"}</small><h3>{title}</h3></div><span className={`ai-confidence ${active.confidence}`}>{confidenceLabel(active.confidence)}</span></div><p>{summary}</p></div>
      {visibleStage>=2&&<div className="ai-chat-bubble assistant"><small>{detailLabel}</small><div className="aqua-ai-reasoning-list">{details.slice(0,detailLimit).map((x,i)=><div key={i}><i>{i+1}</i><span>{x}</span></div>)}</div>{learned.length>0&&<div className="aqua-ai-learned-block"><small>{lang==="ar"?"من ذاكرة الحوض":"FROM TANK MEMORY"}</small>{learned.slice(0,learnedLimit).map(x=><div key={x.id} className={`learned-signal ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}</div>}</div>}{visibleStage>=2&&deepAI.status==="loading"&&<div className="ai-chat-bubble assistant ai-deep-synthesis"><small>{lang==="ar"?"تحليل أعمق":"DEEP AI SYNTHESIS"}</small><span>{lang==="ar"?"عم يراجع Tank Brain الكامل ويجمع العلاقات بين المجالات…":"Reviewing the full Tank Brain and synthesizing cross-domain relationships…"}</span></div>}
      {visibleStage>=2&&deepAI.status==="external"&&deepAI.text&&<div className="ai-chat-bubble assistant ai-deep-synthesis"><small>{lang==="ar"?"تحليل AI أعمق":"DEEP AI SYNTHESIS"}</small><div className="ai-deep-text">{deepAI.text}</div><div className="aqua-ai-local-note">{lang==="ar"?"طبقة الـAI هاي تشرح وتربط الأدلة، لكن حسابات الجرعات، بوابات السلامة، وحالة الحوض الحاكمة تبقى من Tank Brain المحلي المحدد بالقواعد.":"This AI layer explains and synthesizes evidence, while dosing calculations, safety gates and authoritative tank state remain controlled by the deterministic local Tank Brain."}</div><small>{deepAI.provider}{deepAI.model?` • ${deepAI.model}`:""}</small></div>}
      {visibleStage>=3&&<div className="ai-chat-bubble assistant"><small>{lang==="ar"?"شو أعمل هلق؟":"WHAT NEXT?"}</small><b>{nextCheck}</b>{active.action&&onNavigate&&<button className="btn primary aqua-ai-action" onClick={()=>go(active.action!.page)}>{actionText} →</button>}<button className="btn aqua-ai-action" onClick={createPlan}>{lang==="ar"?"+ اعمل خطة متابعة":"+ Create follow-up plan"}</button></div>}
      {visibleStage>=4&&<div className="ai-chat-bubble assistant"><small>{lang==="ar"?"على شو بنيت الجواب؟":"WHAT IS THIS BASED ON?"}</small><div className="aqua-ai-evidence"><div>{evidence.map((x,i)=><span key={i}>{x}</span>)}</div></div><div className="aqua-ai-local-note">{lang==="ar"?"التحليل مبني على منطق Aqua Nexus وبيانات الحوض الحالي محلياً، مو على شات عام.":"The analysis is based on Aqua Nexus logic and this tank's local data, not a general chatbot."}</div></div>}
     </>}

    {!scopeBlocked&&active&&<div className="ai-followups">{visibleStage<2&&<button className="btn" onClick={()=>setStage(2)}>{lang==="ar"?"ليش؟ أعطيني السبب":"Why? Show me the reason"}</button>}{visibleStage<3&&<button className="btn" onClick={()=>setStage(3)}>{lang==="ar"?"شو أعمل هلق؟":"What should I do now?"}</button>}{visibleStage<4&&<button className="btn" onClick={()=>setStage(4)}>{lang==="ar"?"متقدم: الأدلة والتفاصيل":"Advanced: evidence & details"}</button>}</div>}
    {!scopeBlocked&&active&&<form className="ai-chat-input ai-followup-input" onSubmit={submit}><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder={lang==="ar"?"اسأل متابعة… مثلاً: طيب ليش؟ شو الحل؟ وإذا ما زبط؟":"Ask a follow-up… e.g. Why? What should I do? What if that fails?"}/><button className="btn primary" type="submit">{lang==="ar"?"متابعة":"Follow up"}</button></form>}
    <button className="btn glass-button ai-new-question" onClick={resetConversation}>＋ {lang==="ar"?"سؤال جديد":"New question"}</button>
   </div>}

   {currentPlan&&visibleStage>=3&&<AquaAIActionPlanCard plan={currentPlan} lang={lang} onToggle={stepId=>toggleStep(currentPlan.id,stepId)} onReview={()=>reviewPlan(currentPlan)}/>}
   {planNote&&<div className="inline-alert info">{planNote}</div>}
  </section>}
  <button className={`aqua-ai-fish-button aqua-ai-swimmer tone-${visualTone} ${editingOverlay?"temporarily-hidden":""}`} onClick={()=>{setGreeting(false);setOpen(v=>!v)}} aria-label="Local Best AI"><FishMascot state={state}/><span className="aqua-ai-fish-label">Local Best AI</span>{state!=="normal"&&<i className="aqua-ai-alert-dot"/>}</button>
  <style jsx global>{`
   .aqua-ai-fish-svg{width:100%;height:100%;overflow:visible;display:block}
   .aqua-ai-fish-svg .ai-body{fill:color-mix(in srgb,var(--ai-fish,#54dfff) 15%,#061c2a);stroke:var(--ai-fish,#54dfff);stroke-width:2.4}
   .aqua-ai-fish-svg .ai-tail,.aqua-ai-fish-svg .ai-fin{fill:color-mix(in srgb,var(--ai-fish,#54dfff) 20%,transparent);stroke:var(--ai-fish,#54dfff);stroke-width:2.2;stroke-linejoin:round}
   .aqua-ai-fish-svg .ai-circuit,.aqua-ai-fish-svg .ai-gill{stroke:var(--ai-fish,#54dfff);stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}
   .aqua-ai-fish-svg .ai-eye-ring{fill:#071923;stroke:var(--ai-fish,#54dfff);stroke-width:2}.aqua-ai-fish-svg .ai-eye,.aqua-ai-fish-svg .ai-node{fill:var(--ai-fish,#54dfff)}
   .aqua-ai-swimmer .ai-circuit{animation:aquaPulse 1.35s ease-in-out infinite}.aqua-ai-swimmer .ai-tail{transform-origin:28px 36px;animation:aquaTail .55s ease-in-out infinite alternate}
   @keyframes aquaPulse{0%,100%{opacity:.45;filter:drop-shadow(0 0 1px var(--ai-fish))}50%{opacity:1;filter:drop-shadow(0 0 5px var(--ai-fish))}}
   @keyframes aquaTail{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
   .aqua-ai-swimmer{--ai-fish:#54dfff;--ai-glow:rgba(84,223,255,.48);transition:opacity .18s ease,transform .18s ease,visibility .18s ease}
   .aqua-ai-swimmer.tone-excellent{--ai-fish:#49ef9b;--ai-glow:rgba(73,239,155,.5)}
   .aqua-ai-swimmer.tone-good{--ai-fish:#54dfff;--ai-glow:rgba(84,223,255,.5)}
   .aqua-ai-swimmer.tone-moderate{--ai-fish:#ffc84f;--ai-glow:rgba(255,200,79,.5)}
   .aqua-ai-swimmer.tone-critical{--ai-fish:#ff5f6d;--ai-glow:rgba(255,95,109,.58)}
   .aqua-ai-swimmer .aqua-fish{filter:drop-shadow(0 0 9px var(--ai-glow));animation:aquaAISwim 3.2s ease-in-out infinite}
   .aqua-ai-swimmer .aqua-fish-body{border-color:var(--ai-fish)!important;box-shadow:inset 0 0 14px var(--ai-glow),0 0 10px var(--ai-glow)}
   .aqua-ai-swimmer .aqua-fish-tail,.aqua-ai-swimmer .aqua-fish-fin{border-color:var(--ai-fish)!important}
   .aqua-ai-swimmer .aqua-fish-core,.aqua-ai-swimmer .aqua-fish-line{background:var(--ai-fish)!important;box-shadow:0 0 7px var(--ai-glow)}
   .aqua-ai-swimmer.temporarily-hidden{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transform:translateY(12px) scale(.88)!important}
   @keyframes aquaAISwim{0%,100%{transform:translate3d(-3px,1px,0) rotate(-1.5deg)}25%{transform:translate3d(2px,-3px,0) rotate(1deg)}50%{transform:translate3d(5px,0,0) rotate(-.5deg)}75%{transform:translate3d(0,3px,0) rotate(1.2deg)}}
   @media(prefers-reduced-motion:reduce){.aqua-ai-swimmer .aqua-fish{animation:none}}

   .conversational-ai{display:flex;flex-direction:column;gap:10px}.ai-conversation-home,.ai-conversation-flow{display:grid;gap:10px}.ai-followup-input{margin-top:2px}.ai-chat-bubble{border:1px solid rgba(255,255,255,.08);border-radius:17px;padding:12px 13px;display:grid;gap:7px;line-height:1.5}.ai-chat-bubble.assistant{background:linear-gradient(145deg,rgba(45,184,226,.08),rgba(255,255,255,.025));margin-inline-end:24px}.ai-chat-bubble.user{background:rgba(255,255,255,.07);margin-inline-start:34px;justify-items:end}.ai-chat-bubble small{font-size:10px;letter-spacing:.08em;opacity:.62;font-weight:900}.ai-chat-bubble h3,.ai-chat-bubble p{margin:0}.ai-chat-bubble>span{opacity:.78}.ai-choice-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.ai-choice-grid button{min-height:46px;text-align:center}.ai-chat-input{display:grid;grid-template-columns:1fr auto;gap:7px}.ai-chat-input input{min-width:0;border:1px solid rgba(255,255,255,.1);background:rgba(2,15,24,.76);color:inherit;border-radius:13px;padding:11px 12px;outline:none}.ai-chat-input input:focus{border-color:rgba(66,211,255,.5);box-shadow:0 0 0 3px rgba(66,211,255,.08)}.ai-summary-bubble .aqua-ai-answer-head{align-items:flex-start}.ai-summary-bubble .aqua-ai-answer-head h3{font-size:17px}.ai-followups{display:flex;gap:7px;flex-wrap:wrap}.ai-followups .btn{flex:1 1 140px}.ai-new-question{justify-self:start}.conversational-ai .aqua-ai-action{margin-top:4px}.conversational-ai .aqua-ai-evidence{margin:0}.conversational-ai .aqua-ai-learned-block{margin-top:8px}.ai-deep-synthesis{border-color:rgba(129,108,255,.18)!important;background:linear-gradient(145deg,rgba(106,89,255,.09),rgba(45,184,226,.04))!important}.ai-deep-text{white-space:pre-wrap;font-size:12px;line-height:1.65;opacity:.9}
   @media(max-width:560px){.ai-chat-bubble.assistant{margin-inline-end:10px}.ai-chat-bubble.user{margin-inline-start:20px}.ai-choice-grid{grid-template-columns:1fr 1fr}.ai-chat-input{grid-template-columns:1fr}.ai-chat-input .btn{width:100%}.ai-followups{display:grid;grid-template-columns:1fr}.ai-followups .btn{width:100%}}
  `}</style>
 </div>;
}
