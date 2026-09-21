"use client";
import type { AquaActionPlan } from "@/domain/actionPlanEngine";

export function AquaAIActionPlanCard({plan,lang,onToggle,onReview}:{plan:AquaActionPlan;lang:"ar"|"en";onToggle:(stepId:string)=>void;onReview:()=>void}){
 const done=plan.steps.filter(x=>x.done).length;
 return <div className="aqua-ai-plan">
  <div className="module-head"><div><small>ACTION PLAN</small><b>{lang==="ar"?plan.titleAr:plan.titleEn}</b></div><span className="scene-badge">{done}/{plan.steps.length}</span></div>
  {plan.steps.map((s,i)=><button type="button" key={s.id} className={`ai-plan-step ${s.done?"done":""}`} onClick={()=>onToggle(s.id)}><i>{s.done?"✓":i+1}</i><span>{lang==="ar"?s.titleAr:s.titleEn}</span></button>)}
  <div className="note">{lang==="ar"?`خط الأساس عند إنشاء الخطة: ${plan.baselineScore}% • مراجعة مقترحة بعد ${plan.reviewAfterHours} ساعة.`:`Baseline at creation: ${plan.baselineScore}% • suggested review after ${plan.reviewAfterHours}h.`}</div>
  <button className="btn good" disabled={!plan.steps.every(x=>x.done)} onClick={onReview}>{lang==="ar"?"قيّم النتيجة وأغلق الخطة":"Review outcome & close plan"}</button>
 </div>;
}
