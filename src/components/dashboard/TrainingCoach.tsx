"use client";

import type { Tank } from "@/domain/types";
import type { AppPage } from "@/components/navigation/MainNav";
import { useAquaStore } from "@/store/useAquaStore";
import { healthTimeline,tankStateScore } from "@/domain/tankIntelligence";

type Mission={
 id:string;
 ar:string;
 en:string;
 detailAr:string;
 detailEn:string;
 page:AppPage;
 done:boolean;
};

export function TrainingCoach({tank,onNavigate}:{tank:Tank;onNavigate:(page:AppPage)=>void}){
 const lang=useAquaStore(s=>s.language);
 const resetTrainingTank=useAquaStore(s=>s.resetTrainingTank);
 if(!tank.isTraining)return null;

 const started=tank.trainingStartedAt?new Date(tank.trainingStartedAt):new Date(tank.createdAt);
 const startedMs=Number.isFinite(started.getTime())?started.getTime():Date.now();
 const startDate=new Date(startedMs).toISOString().slice(0,10);
 const chemistryDone=tank.chemistry.some(r=>new Date(r.timestamp).getTime()>startedMs+1000);
 const maintenanceDone=tank.maintenance.some(m=>Boolean(m.lastDone)&&String(m.lastDone)>=startDate);
 const waterChangeDone=tank.waterChanges.some(w=>new Date(w.timestamp).getTime()>startedMs+1000);
 const acclimationDone=(tank.acclimationSessions??[]).some(s=>new Date(s.startedAt).getTime()>startedMs+1000);

 const missions:Mission[]=[
  {id:"chemistry",ar:"سجّل فحص كيميائي جديد",en:"Log a new chemistry test",detailAr:"أدخل قراءة فعلية أو جرّب قيمة خارج المجال وشاهد كيف تتغير صحة الحوض.",detailEn:"Enter a realistic reading or test an out-of-range value and watch tank health react.",page:"chemistry",done:chemistryDone},
  {id:"maintenance",ar:"نفّذ مهمة صيانة",en:"Complete a maintenance task",detailAr:"ادخل على الصيانة وعلّم مهمة واحدة كمكتملة لتتدرب على المتابعة الدورية.",detailEn:"Open maintenance and complete one task to practice recurring care.",page:"maintenance",done:maintenanceDone},
  {id:"water",ar:"سجّل تغيير ماء",en:"Record a water change",detailAr:"سجّل تغيير ماء وتابع ظهوره ضمن تاريخ الحوض.",detailEn:"Record a water change and follow how it appears in the aquarium history.",page:"waterchange",done:waterChangeDone},
  {id:"acclimation",ar:"ابدأ جلسة أقلمة",en:"Start an acclimation session",detailAr:"أنشئ جلسة تدريبية وأضف كائناً لتتدرب على سير العمل قبل استخدامه على حوضك الحقيقي.",detailEn:"Create a practice session and add livestock before using the workflow on a real aquarium.",page:"acclimation",done:acclimationDone}
 ];

 const completed=missions.filter(m=>m.done).length;
 const progress=Math.round(completed/missions.length*100);
 const timeline=healthTimeline(tank);
 const scores=timeline.map(p=>p.score);
 const journeyLow=scores.length?Math.min(...scores):tankStateScore(tank);
 const current=tankStateScore(tank);
 const title=lang==="ar"?(tank.type==="marine"?"تدريب عملي — الحوض البحري":"تدريب عملي — الحوض النهري"):(tank.type==="marine"?"Hands-on Training — Marine":"Hands-on Training — Freshwater");

 return <section className="training-coach">
  <div className="training-coach-head">
   <div><small>TRAINING MODE</small><h2>{title}</h2><p>{lang==="ar"?"هاد الحوض إلك للتجربة. أي قرار أو قراءة بتعملها بتأثر عليه فعلياً، وبتقدر ترجع تبدأ من الصفر بأي وقت.":"This tank is yours to practice on. Your readings and actions really change it, and you can reset it anytime."}</p></div>
   <div className="training-score"><small>{lang==="ar"?"المسيرة":"Journey"}</small><b>{journeyLow}% → {current}%</b><span>{lang==="ar"?`${completed}/${missions.length} مهام تدريبية`:`${completed}/${missions.length} training missions`}</span></div>
  </div>

  <div className="training-progress" aria-label={lang==="ar"?"تقدم التدريب":"Training progress"}><i style={{width:`${progress}%`}}/></div>

  <div className="training-missions">
   {missions.map((m,index)=><button key={m.id} type="button" className={`training-mission ${m.done?"done":""}`} onClick={()=>onNavigate(m.page)}>
    <span className="training-mission-number">{m.done?"✓":index+1}</span>
    <span><b>{lang==="ar"?m.ar:m.en}</b><small>{lang==="ar"?m.detailAr:m.detailEn}</small></span>
    <strong>{m.done?(lang==="ar"?"مكتملة":"Done"):"→"}</strong>
   </button>)}
  </div>

  <div className="training-coach-foot">
   <span>{lang==="ar"?"جرّب بحرية — الحوض التدريبي منفصل عن أحواضك الحقيقية.":"Experiment freely — training data is separate from your real aquariums."}</span>
   <button className="btn" onClick={()=>{if(window.confirm(lang==="ar"?"إعادة الحوض التدريبي إلى حالته الأصلية ومسح تقدمك الحالي؟":"Reset this training tank and clear your current training progress?"))resetTrainingTank(tank.id)}}>↺ {lang==="ar"?"إعادة التدريب":"Reset training"}</button>
  </div>

  <style jsx>{`
   .training-coach{margin:14px clamp(12px,2.4vw,26px) 4px;padding:16px;border:1px solid rgba(80,226,213,.20);border-radius:20px;background:radial-gradient(circle at 90% 0%,rgba(77,222,211,.12),transparent 34%),linear-gradient(145deg,rgba(10,45,59,.88),rgba(4,24,34,.92));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
   .training-coach-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start}.training-coach-head small{font-size:9px;letter-spacing:.15em;color:#65e5d9;font-weight:900}.training-coach-head h2{margin:3px 0 5px;font-size:18px}.training-coach-head p{margin:0;max-width:720px;font-size:12px;line-height:1.6;opacity:.7}
   .training-score{min-width:150px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);text-align:center}.training-score b,.training-score span{display:block}.training-score b{font-size:22px;color:#65e5d9;margin:2px 0}.training-score span{font-size:10px;opacity:.6}
   .training-progress{height:7px;margin:13px 0;border-radius:999px;background:rgba(255,255,255,.055);overflow:hidden}.training-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#41cfc2,#72e8b6);transition:width .25s ease}
   .training-missions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.training-mission{border:1px solid rgba(255,255,255,.065);background:rgba(255,255,255,.025);color:inherit;border-radius:14px;padding:10px;display:grid;grid-template-columns:30px 1fr auto;gap:9px;align-items:center;text-align:start;cursor:pointer}.training-mission:hover{border-color:rgba(101,229,217,.3);background:rgba(101,229,217,.05)}.training-mission.done{border-color:rgba(94,218,153,.22);background:rgba(94,218,153,.05)}.training-mission-number{width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:rgba(101,229,217,.09);color:#65e5d9;font-weight:900}.training-mission.done .training-mission-number{color:#75e6b0;background:rgba(117,230,176,.10)}.training-mission b,.training-mission small{display:block}.training-mission b{font-size:12px}.training-mission small{margin-top:3px;font-size:10px;line-height:1.4;opacity:.58}.training-mission strong{font-size:10px;color:#75e6b0}
   .training-coach-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:10px;border-top:1px solid rgba(255,255,255,.055)}.training-coach-foot span{font-size:10px;opacity:.52}
   @media(max-width:720px){.training-coach{margin:10px 10px 2px;padding:12px}.training-coach-head{grid-template-columns:1fr}.training-score{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:8px;text-align:start}.training-score b{font-size:18px;margin:0}.training-score span{text-align:end}.training-missions{grid-template-columns:1fr}.training-coach-foot{align-items:flex-start;flex-direction:column}.training-coach-foot .btn{width:100%}}
  `}</style>
 </section>;
}
