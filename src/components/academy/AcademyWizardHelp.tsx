"use client";
import { useState } from "react";
import type { Language } from "@/domain/types";
import type { AcademyLessonId } from "@/data/academy";
import { academyLesson } from "@/data/academy";

export function AcademyWizardHelp({lessonId,lang}:{lessonId:AcademyLessonId;lang:Language}){
 const [open,setOpen]=useState(false),lesson=academyLesson(lessonId);
 return <div className="academy-wizard-help">
  <button type="button" className="academy-wizard-help-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>🎓 {lang==="ar"?"شو يعني هاد؟":"What does this mean?"}</button>
  {open&&<div className="academy-wizard-help-body"><small>AQUA NEXUS ACADEMY</small><b>{lang==="ar"?lesson.titleAr:lesson.titleEn}</b><p>{lang==="ar"?lesson.introAr:lesson.introEn}</p><ul>{(lang==="ar"?lesson.pointsAr:lesson.pointsEn).slice(0,3).map((x,i)=><li key={i}>{x}</li>)}</ul><em>{lang==="ar"?"بعد إنشاء الحوض بتلاقي الدرس الكامل بصفحة Academy.":"After creating the tank, the full lesson stays available in Academy."}</em></div>}
  <style jsx>{`
   .academy-wizard-help{margin:10px 0;border:1px solid rgba(163,132,255,.18);border-radius:12px;background:rgba(119,83,194,.045);overflow:hidden}
   .academy-wizard-help-toggle{width:100%;border:0;background:transparent;color:#d9ceff;text-align:start;padding:8px 10px;font:inherit;font-size:9px;font-weight:850;cursor:pointer}
   .academy-wizard-help-body{border-top:1px solid rgba(255,255,255,.06);padding:10px;display:grid;gap:6px}.academy-wizard-help-body small{font-size:7px;letter-spacing:.09em;opacity:.5}.academy-wizard-help-body b{font-size:12px}.academy-wizard-help-body p,.academy-wizard-help-body li{font-size:9px;line-height:1.55;opacity:.8}.academy-wizard-help-body p{margin:0}.academy-wizard-help-body ul{margin:0;padding-inline-start:18px}.academy-wizard-help-body em{font-style:normal;font-size:8px;opacity:.55}
  `}</style>
 </div>
}
