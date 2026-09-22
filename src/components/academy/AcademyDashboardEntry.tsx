"use client";
import { useEffect,useState } from "react";
import type { Language } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { ACADEMY_LESSONS } from "@/data/academy";
import { readAcademyProgress,subscribeAcademyProgress,type AcademyProgress } from "@/lib/academyProgress";

export function AcademyDashboardEntry({lang,onNavigate}:{lang:Language;onNavigate:(p:AppPage)=>void}){
 const [progress,setProgress]=useState<AcademyProgress>({completed:[]});
 useEffect(()=>{setProgress(readAcademyProgress());return subscribeAcademyProgress(setProgress)},[]);
 const pct=Math.round(progress.completed.length/ACADEMY_LESSONS.length*100);
 return <section className="academy-dashboard-entry">
  <div className="academy-dashboard-mark">🎓</div>
  <div className="academy-dashboard-copy"><small>AQUA NEXUS ACADEMY</small><h3>{lang==="ar"?"تعلّم الحوض وافهم ليش البرنامج بيطلب هالمعلومة":"Learn the aquarium and why Aqua Nexus asks for each piece of data"}</h3><p>{lang==="ar"?"دورة قصيرة + قاموس مصطلحات + ربط مباشر بين العلم وكل صفحة داخل البرنامج.":"Short course + glossary + direct links between aquarium science and each Aqua Nexus page."}</p></div>
  <div className="academy-dashboard-progress"><b>{progress.completed.length}/{ACADEMY_LESSONS.length}</b><span>{lang==="ar"?"درس مكتمل":"lessons complete"}</span><i><em style={{width:`${pct}%`}}/></i></div>
  <button className="btn primary" type="button" onClick={()=>onNavigate("academy")}>{lang==="ar"?"فتح Academy":"Open Academy"} ↗</button>
  <style jsx>{`
   .academy-dashboard-entry{border:1px solid rgba(171,136,255,.3);border-radius:20px;padding:15px 16px;background:radial-gradient(circle at 8% 20%,rgba(154,111,255,.15),transparent 28%),linear-gradient(135deg,rgba(50,31,86,.55),rgba(6,35,48,.78));display:grid;grid-template-columns:48px minmax(0,1fr) 140px auto;gap:13px;align-items:center;box-shadow:0 14px 36px rgba(0,0,0,.13)}
   .academy-dashboard-mark{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;font-size:23px;background:rgba(171,136,255,.12);border:1px solid rgba(171,136,255,.18)}
   .academy-dashboard-copy small{font-size:8px;letter-spacing:.1em;color:#cdbdff;font-weight:900}.academy-dashboard-copy h3{font-size:14px;margin:3px 0}.academy-dashboard-copy p{font-size:9px;margin:0;opacity:.64;line-height:1.5}
   .academy-dashboard-progress{display:grid;gap:2px}.academy-dashboard-progress b{font-size:20px}.academy-dashboard-progress span{font-size:8px;opacity:.55}.academy-dashboard-progress i{height:5px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:4px}.academy-dashboard-progress em{display:block;height:100%;background:linear-gradient(90deg,#9c7cff,#5ed6e6);border-radius:inherit}
   @media(max-width:800px){.academy-dashboard-entry{grid-template-columns:40px 1fr auto}.academy-dashboard-mark{width:40px;height:40px}.academy-dashboard-progress{grid-column:2/-1;grid-template-columns:auto 1fr;align-items:center}.academy-dashboard-progress i{grid-column:1/-1}.academy-dashboard-entry>.btn{grid-column:2/-1}}
  `}</style>
 </section>
}
