"use client";
import type { AppPage } from "@/components/navigation/MainNav";
import { ACADEMY_PAGE_LESSON,academyLesson } from "@/data/academy";
import { useAquaStore } from "@/store/useAquaStore";
import { openAcademyLesson } from "@/lib/academyNavigation";

export function AcademyShortcut({page}:{page:AppPage}){
 const lang=useAquaStore(s=>s.language),id=ACADEMY_PAGE_LESSON[page];
 if(!id)return null;
 const lesson=academyLesson(id);
 return <div className="academy-context-shortcut">
  <span>🎓</span>
  <div><small>{lang==="ar"?"افهم الفكرة، مو بس الزر":"Learn the concept, not just the control"}</small><b>{lang==="ar"?lesson.titleAr:lesson.titleEn}</b></div>
  <button className="btn" type="button" onClick={()=>openAcademyLesson(id)}>{lang==="ar"?"تعلّم":"Learn"} ↗</button>
  <style jsx>{`
   .academy-context-shortcut{margin:0 0 10px;padding:8px 10px;border:1px solid rgba(167,134,255,.2);border-radius:13px;background:linear-gradient(90deg,rgba(116,84,195,.08),rgba(68,190,216,.045));display:grid;grid-template-columns:30px 1fr auto;gap:9px;align-items:center}
   .academy-context-shortcut>span{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(160,128,255,.11)}
   .academy-context-shortcut div{display:grid;gap:1px}.academy-context-shortcut small{font-size:8px;opacity:.56}.academy-context-shortcut b{font-size:10px}
   .academy-context-shortcut .btn{padding:6px 9px;font-size:9px}
   @media(max-width:620px){.academy-context-shortcut{grid-template-columns:28px 1fr auto;padding:7px 8px}.academy-context-shortcut small{display:none}.academy-context-shortcut b{font-size:9px}}
  `}</style>
 </div>
}
