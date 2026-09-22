"use client";
import { useEffect,useMemo,useState } from "react";
import type { AppPage } from "@/components/navigation/MainNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdvancedSection } from "@/components/ui/AdvancedSection";
import { ACADEMY_LESSONS,ACADEMY_TERMS,academyLesson,type AcademyLessonId } from "@/data/academy";
import { useAquaStore } from "@/store/useAquaStore";
import { consumeAcademyFocus } from "@/lib/academyNavigation";
import { readAcademyProgress,resetAcademyProgress,setAcademyLastLesson,subscribeAcademyProgress,toggleAcademyLessonComplete,type AcademyProgress } from "@/lib/academyProgress";

const PAGE_LABELS:Partial<Record<AppPage,{ar:string;en:string}>>={
 dashboard:{ar:"لوحة القيادة",en:"Dashboard"},tanks:{ar:"الأحواض",en:"Tanks"},equipment:{ar:"التجهيزات",en:"Equipment"},
 lighting:{ar:"الإنارة",en:"Lighting"},sump:{ar:"السامب",en:"Sump"},livestock:{ar:"الكائنات",en:"Livestock"},
 acclimation:{ar:"الإقلمة",en:"Acclimation"},library:{ar:"مكتبة الكائنات",en:"Library"},chemistry:{ar:"الكيمياء",en:"Chemistry"},
 maintenance:{ar:"الصيانة",en:"Maintenance"},diseases:{ar:"الأمراض",en:"Diseases"},timeline:{ar:"الخط الزمني",en:"Timeline"},
 journal:{ar:"الملاحظات والصور",en:"Journal"},waterchange:{ar:"تغيير الماء",en:"Water Change"},feeding:{ar:"التغذية",en:"Feeding"},
 dosing:{ar:"الجرعات",en:"Dosing"},quarantine:{ar:"الحجر",en:"Quarantine"},emergency:{ar:"الطوارئ",en:"Emergency"},
 rodi:{ar:"RO/DI",en:"RO/DI"},alerts:{ar:"التنبيهات",en:"Alerts"},reports:{ar:"التقارير",en:"Reports"},settings:{ar:"الإعدادات",en:"Settings"}
};

export function AcademyPage({onNavigate}:{onNavigate:(page:AppPage)=>void}){
 const lang=useAquaStore(s=>s.language),experience=useAquaStore(s=>s.aquariumExperience);
 const [progress,setProgress]=useState<AcademyProgress>({completed:[]});
 const [selected,setSelected]=useState<AcademyLessonId>("aquarium-system");
 const [tab,setTab]=useState<"course"|"glossary">("course");
 const [query,setQuery]=useState("");

 useEffect(()=>{
  const p=readAcademyProgress(),focus=consumeAcademyFocus();
  setProgress(p);setSelected(focus??p.lastLessonId??ACADEMY_LESSONS.find(x=>!p.completed.includes(x.id))?.id??"aquarium-system");
  return subscribeAcademyProgress(setProgress);
 },[]);

 const lesson=academyLesson(selected);
 const completed=progress.completed.includes(selected);
 const percent=Math.round(progress.completed.length/ACADEMY_LESSONS.length*100);
 const filteredTerms=useMemo(()=>{
  const q=query.trim().toLowerCase();
  if(!q)return ACADEMY_TERMS;
  const exact=ACADEMY_TERMS.filter(x=>x.term.toLowerCase()===q);
  if(exact.length)return exact;
  return ACADEMY_TERMS.filter(x=>`${x.term} ${x.ar} ${x.en}`.toLowerCase().includes(q));
 },[query]);

 function choose(id:AcademyLessonId){setSelected(id);setTab("course");setAcademyLastLesson(id)}
 function next(){
  const i=ACADEMY_LESSONS.findIndex(x=>x.id===selected),n=ACADEMY_LESSONS[Math.min(ACADEMY_LESSONS.length-1,i+1)];
  if(n)choose(n.id);
 }

 return <section className="academy-page page-grid">
  <PageHeader eyebrow="AQUA NEXUS ACADEMY" title={lang==="ar"?"تعلم الحوض وافهم Aqua Nexus":"Learn the aquarium and understand Aqua Nexus"} actions={<div className="academy-head-actions"><button className={`btn ${tab==="course"?"primary":""}`} onClick={()=>setTab("course")}>{lang==="ar"?"الدورة":"Course"}</button><button className={`btn ${tab==="glossary"?"primary":""}`} onClick={()=>setTab("glossary")}>{lang==="ar"?"قاموس المصطلحات":"Glossary"}</button></div>}/>

  <section className="academy-hero full-span">
   <div><small>{lang==="ar"?"تعليم مبني داخل المنتج":"EDUCATION BUILT INTO THE PRODUCT"}</small><h2>{lang==="ar"?"مو المطلوب تحفظ البرنامج؛ المطلوب تفهم الحوض":"Do not memorize the app; understand the aquarium"}</h2><p>{lang==="ar"?"كل درس يشرح المبدأ، ليش مهم، وين موجود داخل Aqua Nexus، وكيف يستخدمه Tank Brain. تعليمات الأمان ما تختفي حتى لو خلصت الدرس.":"Each lesson explains the principle, why it matters, where it lives in Aqua Nexus and how Tank Brain uses it. Safety guidance never disappears just because a lesson is complete."}</p></div>
   <div className="academy-progress"><b>{progress.completed.length}/{ACADEMY_LESSONS.length}</b><span>{lang==="ar"?`مكتمل • ${percent}%`:`complete • ${percent}%`}</span><i><em style={{width:`${percent}%`}}/></i></div>
  </section>

  {tab==="course"?<>
   <nav className="academy-course-nav" aria-label={lang==="ar"?"دروس Academy":"Academy lessons"}>
    {ACADEMY_LESSONS.map((x,i)=><button type="button" key={x.id} className={`academy-lesson-nav ${selected===x.id?"active":""}`} onClick={()=>choose(x.id)}>
      <span className="academy-nav-number">{progress.completed.includes(x.id)?"✓":i+1}</span><span><b>{x.icon} {lang==="ar"?x.titleAr:x.titleEn}</b><small>{progress.completed.includes(x.id)?(lang==="ar"?"مكتمل":"Completed"):(lang==="ar"?"درس قصير":"Short lesson")}</small></span>
    </button>)}
   </nav>

   <article className="academy-lesson">
    <div className="academy-lesson-head"><span>{lesson.icon}</span><div><small>{lang==="ar"?`الدرس ${ACADEMY_LESSONS.findIndex(x=>x.id===selected)+1} من ${ACADEMY_LESSONS.length}`:`Lesson ${ACADEMY_LESSONS.findIndex(x=>x.id===selected)+1} of ${ACADEMY_LESSONS.length}`}</small><h2>{lang==="ar"?lesson.titleAr:lesson.titleEn}</h2><p>{lang==="ar"?lesson.introAr:lesson.introEn}</p></div></div>

    <section className="academy-core"><h3>{lang==="ar"?"الفكرة الأساسية":"Core idea"}</h3>{(lang==="ar"?lesson.pointsAr:lesson.pointsEn).map((x,i)=><div className="academy-point" key={i}><i>{i+1}</i><span>{x}</span></div>)}</section>

    <AdvancedSection titleAr="للمستخدم المتقدم" titleEn="For advanced keepers" summaryAr={experience==="advanced"?"مفتوح افتراضياً لأن خبرتك مضبوطة على متقدم.":"تفاصيل أعمق بدون ما تزاحم الفكرة الأساسية."} summaryEn={experience==="advanced"?"Open by default because your aquarium experience is Advanced.":"Deeper detail without crowding the core lesson."}>
     <div className="academy-advanced">{(lang==="ar"?lesson.advancedAr:lesson.advancedEn).map((x,i)=><div key={i}><b>◆</b><span>{x}</span></div>)}</div>
    </AdvancedSection>

    <section className="academy-brain-use"><span>✦</span><div><small>TANK BRAIN CONNECTION</small><h3>{lang==="ar"?"شو بيعمل Aqua Nexus بهالمعلومة؟":"How Aqua Nexus uses this concept"}</h3><p>{lang==="ar"?lesson.brainAr:lesson.brainEn}</p></div></section>

    <section className="academy-in-app"><div><small>AQUA NEXUS CONNECTION</small><h3>{lang==="ar"?"وين بتلاقي هالفكرة بالبرنامج؟":"Where does this live in Aqua Nexus?"}</h3><p>{lang==="ar"?lesson.pageNoteAr:lesson.pageNoteEn}</p></div><div className="academy-page-links">{lesson.pages.map(p=>{const label=PAGE_LABELS[p]??{ar:p,en:p};return <button className="btn" key={p} onClick={()=>onNavigate(p)}>{lang==="ar"?label.ar:label.en} ↗</button>})}</div></section>

    {selected==="tank-brain-ai"&&<section className="academy-brain-flow">
     <h3>{lang==="ar"?"مسار القرار داخل Aqua Nexus":"Aqua Nexus decision flow"}</h3>
     <div>{[
      ["1","Input",lang==="ar"?"قياس، حدث، صورة أو استيراد مع المصدر.":"Reading, event, image or import with provenance."],
      ["2","Validation",lang==="ar"?"فحص منطق القيمة وجودة البيانات.":"Plausibility and data-quality checks."],
      ["3","Context + History",lang==="ar"?"ربط الحوض والكائنات والصيانة والتغذية والتجهيزات.":"Connect tank, livestock, maintenance, feeding and equipment."],
      ["4","Confidence + Risk",lang==="ar"?"تقدير قوة الدليل والخطر وسرعة التغير.":"Assess evidence strength, risk and rate of change."],
      ["5","Next Action",lang==="ar"?"اقتراح خطوة آمنة قابلة للتنفيذ.":"Suggest a safe actionable next step."],
      ["6","AI Explanation",lang==="ar"?"شرح النتيجة ضمن بيانات الحوض وقواعد الأمان.":"Explain within tank data and safety constraints."]
     ].map(x=><div key={x[0]}><i>{x[0]}</i><b>{x[1]}</b><span>{x[2]}</span></div>)}</div>
    </section>}

    <div className="academy-lesson-actions">
     <button className={`btn ${completed?"good":"primary"}`} onClick={()=>toggleAcademyLessonComplete(selected)}>{completed?(lang==="ar"?"✓ مكتمل — تراجع":"✓ Completed — undo"):(lang==="ar"?"✓ فهمت الدرس":"✓ Mark understood")}</button>
     {selected!==ACADEMY_LESSONS[ACADEMY_LESSONS.length-1].id&&<button className="btn" onClick={next}>{lang==="ar"?"الدرس التالي":"Next lesson"} →</button>}
    </div>
   </article>
  </>:<>
   <section className="academy-glossary full-span">
    <div className="module-head"><div><small className="eyebrow-mini">QUICK GLOSSARY</small><h2>{lang==="ar"?"قاموس المصطلحات":"Aquarium glossary"}</h2><p className="note">{lang==="ar"?"ابحث عن المصطلح، اقرأ معناه بسرعة، وإذا بدك السياق الكامل افتح الدرس المرتبط.":"Search a term, read the quick meaning, then open its lesson for full context."}</p></div><label className="academy-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={lang==="ar"?"KH، PAR، Cycling، TDS…":"KH, PAR, Cycling, TDS…"} /></label></div>
    <div className="academy-term-grid">{filteredTerms.map(x=><button type="button" className="academy-term" key={x.term} onClick={()=>choose(x.lesson)}><b>{x.term}</b><span>{lang==="ar"?x.ar:x.en}</span><small>{lang==="ar"?"فتح الدرس المرتبط":"Open related lesson"} ↗</small></button>)}</div>
    {!filteredTerms.length&&<div className="empty-state">{lang==="ar"?"ما لقيت مصطلح مطابق.":"No matching term."}</div>}
   </section>
  </>}

  <section className="academy-footer full-span"><div><b>{lang==="ar"?"التقدم تعليمي فقط":"Progress is educational only"}</b><span>{lang==="ar"?"إكمال أو إعادة درس ما بيغير أي بيانات بالحوض ولا قرارات Tank Brain.":"Completing or resetting lessons never changes tank data or Tank Brain decisions."}</span></div><button className="btn" onClick={()=>{if(window.confirm(lang==="ar"?"إعادة تقدم Academy للصفر؟ بيانات الحوض لن تتأثر.":"Reset Academy progress? Tank data will not be affected."))resetAcademyProgress()}}>{lang==="ar"?"إعادة التقدم":"Reset progress"}</button></section>

  <style jsx>{`
   .academy-page{grid-template-columns:280px minmax(0,1fr)}.academy-page>.page-header,.academy-page>.full-span{grid-column:1/-1}.academy-head-actions{display:flex;gap:6px}
   .academy-hero{border:1px solid rgba(171,136,255,.26);border-radius:20px;padding:18px;background:radial-gradient(circle at 8% 30%,rgba(147,103,255,.16),transparent 30%),linear-gradient(135deg,rgba(50,31,86,.48),rgba(4,31,43,.84));display:grid;grid-template-columns:1fr 180px;gap:20px;align-items:center}.academy-hero small{font-size:8px;letter-spacing:.12em;color:#cdbdff;font-weight:900}.academy-hero h2{margin:4px 0 8px;font-size:22px}.academy-hero p{margin:0;max-width:850px;opacity:.7;line-height:1.65}
   .academy-progress{display:grid;gap:3px}.academy-progress b{font-size:30px}.academy-progress span{font-size:9px;opacity:.58}.academy-progress i{height:7px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin-top:5px}.academy-progress em{display:block;height:100%;background:linear-gradient(90deg,#9c7cff,#5ed6e6)}
   .academy-course-nav{display:grid;gap:6px;align-content:start;position:sticky;top:100px}.academy-lesson-nav{border:1px solid rgba(255,255,255,.065);border-radius:13px;background:rgba(255,255,255,.02);color:inherit;padding:9px;display:grid;grid-template-columns:28px 1fr;gap:8px;text-align:start;cursor:pointer}.academy-lesson-nav.active{border-color:rgba(164,128,255,.4);background:rgba(135,93,225,.09)}.academy-nav-number{width:28px;height:28px;border-radius:9px;background:rgba(165,130,255,.1);display:grid;place-items:center;font-weight:900;font-size:9px}.academy-lesson-nav>span:last-child{display:grid;gap:2px}.academy-lesson-nav b{font-size:10px}.academy-lesson-nav small{font-size:8px;opacity:.5}
   .academy-lesson{border:1px solid rgba(255,255,255,.075);border-radius:20px;background:rgba(6,29,41,.75);padding:18px;display:grid;gap:15px}.academy-lesson-head{display:grid;grid-template-columns:54px 1fr;gap:12px}.academy-lesson-head>span{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:25px;background:rgba(159,125,255,.1);border:1px solid rgba(159,125,255,.15)}.academy-lesson-head small{font-size:8px;opacity:.5}.academy-lesson-head h2{margin:2px 0 6px;font-size:24px}.academy-lesson-head p{margin:0;line-height:1.7;opacity:.76}
   .academy-core{display:grid;gap:7px}.academy-core h3,.academy-in-app h3,.academy-brain-flow h3{margin:0 0 3px}.academy-point{border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:9px 10px;display:grid;grid-template-columns:26px 1fr;gap:8px;align-items:center;background:rgba(255,255,255,.018)}.academy-point i{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:rgba(78,211,220,.08);font-style:normal;font-weight:900;color:#83e0e8}.academy-point span{font-size:10px;line-height:1.55}
   .academy-advanced{display:grid;gap:8px;padding-top:10px}.academy-advanced>div{display:grid;grid-template-columns:20px 1fr;gap:8px}.academy-advanced b{color:#c5adff}.academy-advanced span{font-size:10px;line-height:1.6}
   .academy-brain-use{border:1px solid rgba(94,214,245,.18);border-radius:14px;padding:12px;background:linear-gradient(90deg,rgba(65,190,226,.055),rgba(126,89,211,.045));display:grid;grid-template-columns:38px 1fr;gap:10px;align-items:start}.academy-brain-use>span{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(88,213,244,.1);color:#80e8ff;font-size:19px}.academy-brain-use small{font-size:7px;letter-spacing:.1em;color:#78dfee;font-weight:900}.academy-brain-use h3{margin:2px 0 4px;font-size:12px}.academy-brain-use p{margin:0;font-size:9px;line-height:1.65;opacity:.76}\n   .academy-in-app{border:1px solid rgba(83,218,255,.14);border-radius:14px;padding:12px;background:rgba(69,192,220,.035);display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.academy-in-app small{font-size:7px;letter-spacing:.1em;color:#75ddeb;font-weight:900}.academy-in-app p{margin:4px 0 0;font-size:9px;opacity:.65}.academy-page-links{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
   .academy-brain-flow{border:1px solid rgba(174,135,255,.18);border-radius:15px;padding:12px;background:rgba(126,89,211,.045)}.academy-brain-flow>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}.academy-brain-flow>div>div{border:1px solid rgba(255,255,255,.06);border-radius:11px;padding:9px;display:grid;grid-template-columns:23px 1fr;gap:4px 7px}.academy-brain-flow i{grid-row:1/3;width:23px;height:23px;border-radius:7px;display:grid;place-items:center;background:rgba(170,135,255,.12);font-style:normal;font-weight:900}.academy-brain-flow b{font-size:9px}.academy-brain-flow span{font-size:8px;line-height:1.45;opacity:.62}
   .academy-lesson-actions{display:flex;gap:7px;justify-content:flex-end;padding-top:5px;border-top:1px solid rgba(255,255,255,.06)}
   .academy-glossary{border:1px solid rgba(255,255,255,.075);border-radius:20px;background:rgba(6,29,41,.75);padding:16px}.academy-search{display:grid;grid-template-columns:auto minmax(150px,260px);gap:7px;align-items:center;border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:7px 9px}.academy-search input{border:0;background:transparent;color:inherit;outline:0}.academy-term-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.academy-term{border:1px solid rgba(255,255,255,.065);border-radius:12px;background:rgba(255,255,255,.018);color:inherit;text-align:start;padding:10px;display:grid;gap:4px;cursor:pointer}.academy-term:hover{border-color:rgba(164,128,255,.3)}.academy-term b{font-size:11px;color:#d7c9ff}.academy-term span{font-size:9px;line-height:1.55;opacity:.72}.academy-term small{font-size:8px;color:#82dce7;margin-top:3px}
   .academy-footer{border-top:1px solid rgba(255,255,255,.07);padding:12px 2px;display:flex;justify-content:space-between;gap:12px;align-items:center}.academy-footer div{display:grid;gap:2px}.academy-footer b{font-size:10px}.academy-footer span{font-size:8px;opacity:.55}
   @media(max-width:900px){.academy-page{grid-template-columns:1fr}.academy-course-nav{position:static;display:flex;overflow:auto;padding-bottom:3px}.academy-lesson-nav{min-width:220px}.academy-term-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.academy-brain-flow>div{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:620px){.academy-hero{grid-template-columns:1fr}.academy-hero h2{font-size:19px}.academy-lesson{padding:13px}.academy-lesson-head{grid-template-columns:42px 1fr}.academy-lesson-head>span{width:42px;height:42px;font-size:20px}.academy-lesson-head h2{font-size:20px}.academy-in-app{grid-template-columns:1fr}.academy-page-links{justify-content:flex-start}.academy-term-grid{grid-template-columns:1fr}.academy-brain-flow>div{grid-template-columns:1fr}.academy-glossary .module-head{align-items:stretch;flex-direction:column}.academy-search{grid-template-columns:auto 1fr}.academy-footer{align-items:flex-start;flex-direction:column}.academy-lesson-actions{justify-content:stretch}.academy-lesson-actions .btn{flex:1}}
  `}</style>
 </section>
}
