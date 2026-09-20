"use client";

import { useState } from "react";
import type { BiologicalCycleState,Tank } from "@/domain/types";
import { biologicalCycleStatus } from "@/domain/biologicalCycle";
import { useAquaStore } from "@/store/useAquaStore";
import { bi } from "@/i18n";
import { nowISO,uid } from "@/lib/appUtils";
import type { AppPage } from "@/components/navigation/MainNav";

export function BiologicalCyclePanel({tank,onNavigate}:{tank:Tank;onNavigate?:(page:AppPage)=>void}){
  const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
  const state=biologicalCycleStatus(tank);
  const [method,setMethod]=useState<NonNullable<BiologicalCycleState["method"]>>(tank.biologicalCycle?.method??"fishless");
  if(!state.active)return null;

  const methodText={
    fishless:bi(lang,"دورة بدون أسماك / مصدر أمونيا","Fishless / ammonia source"),
    seeded_media:bi(lang,"ميديا بيولوجية ناضجة","Seeded mature media"),
    bottled_bacteria:bi(lang,"بكتيريا جاهزة","Bottled bacteria"),
    other:bi(lang,"طريقة أخرى","Other")
  };

  function recordSource(){
    const ts=nowISO();
    patch(tank.id,t=>({...t,
      status:"cycling",
      biologicalCycle:{...(t.biologicalCycle??{startedAt:t.createdAt||ts}),startedAt:t.biologicalCycle?.startedAt??t.createdAt??ts,method,sourceAddedAt:t.biologicalCycle?.sourceAddedAt??ts},
      timeline:[{id:uid("ev"),timestamp:ts,type:"cycle-source",textAr:`تم تسجيل بدء مصدر الأمونيا للدورة البيولوجية — ${methodText[method]}.`,textEn:`Biological-cycle ammonia source recorded — ${methodText[method]}.`},...t.timeline]
    }));
  }

  function recordBacteria(){
    const ts=nowISO();
    patch(tank.id,t=>({...t,
      biologicalCycle:{...(t.biologicalCycle??{startedAt:t.createdAt||ts}),startedAt:t.biologicalCycle?.startedAt??t.createdAt??ts,bacteriaSeededAt:t.biologicalCycle?.bacteriaSeededAt??ts,method},
      timeline:[{id:uid("ev"),timestamp:ts,type:"cycle-bacteria",textAr:"تم تسجيل إضافة بكتيريا/ميديا بيولوجية للدورة. هذا دعم للدورة وليس إثبات اكتمال.",textEn:"Bacteria/seeded media was recorded for cycling. This supports the cycle but does not prove completion."},...t.timeline]
    }));
  }

  function completeCycle(){
    if(!state.ready)return;
    const ts=nowISO();
    const confirmations=[state.latestMeasured?.timestamp,state.previousMeasured?.timestamp].filter(Boolean) as string[];
    patch(tank.id,t=>({...t,
      status:"established",
      biologicalCycle:{...(t.biologicalCycle??{startedAt:state.startedAt}),startedAt:state.startedAt,completedAt:ts,completionReadingTimestamps:confirmations},
      timeline:[{id:uid("ev"),timestamp:ts,type:"cycle-complete",textAr:`اكتملت الدورة البيولوجية في اليوم ${state.day} بعد تحقق قراءتي التأكيد. تم فتح بقية وظائف Aqua Nexus.`,textEn:`Biological cycle completed on day ${state.day} after two qualifying confirmation readings. The rest of Aqua Nexus is now unlocked.`},...t.timeline]
    }));
  }

  const checks=[
    {done:true,ar:"بدأ عد الدورة تلقائياً",en:"Cycle day counter started automatically"},
    {done:state.sourceAdded,ar:"تم تسجيل مصدر الأمونيا",en:"Ammonia source recorded"},
    {done:state.processingEvidence,ar:"ظهر دليل أن دورة النيتروجين عم تعالج الحمل",en:"Measured nitrogen-processing evidence is present"},
    {done:state.firstClear,ar:tank.type==="freshwater"?"أول قراءة نظيفة: NH3/NH4 وNO2 صفر عملياً":"أول قراءة نظيفة: NH3 صفر عملياً",en:tank.type==="freshwater"?"First clear reading: practical-zero NH3/NH4 and NO2":"First clear reading: practical-zero NH3"},
    {done:state.twoConsecutiveClear&&state.latestAgeHours!==null&&state.latestAgeHours<=48,ar:"قراءة تأكيد ثانية بفاصل ≥12 ساعة وآخر فحص حديث",en:"Second clear confirmation ≥12h apart and latest test is current"}
  ];

  const value=(n:number|null,unit="ppm")=>n===null?"—":`${n} ${unit}`;

  return <section className="card panel full-span cycle-panel">
    <div className="module-head">
      <div><small className="eyebrow-mini">BIOLOGICAL CYCLING MODE</small><h3>{bi(lang,`الدورة البيولوجية — اليوم ${state.day}`,`Biological cycle — day ${state.day}`)}</h3><p className="note">{bi(lang,"خلال هالفترة Aqua Nexus يوقف العمليات غير المرتبطة بالدورة. الوقت وحده ما بيعلن الحوض جاهز؛ الجاهزية لازم تثبتها القياسات.","During this period Aqua Nexus locks non-cycle workflows. Time alone never declares the tank ready; measured evidence must prove readiness.")}</p></div>
      <span className={`status ${state.ready?"good":"warn"}`}>{state.ready?bi(lang,"جاهز للإنهاء","READY TO COMPLETE"):`${state.progress}%`}</span>
    </div>

    <div className="summary-strip">
      <div className="summary"><small>NH3/NH4</small><b>{value(state.latestAmmonia)}</b></div>
      {tank.type==="freshwater"&&<div className="summary"><small>NO2</small><b>{value(state.latestNitrite)}</b></div>}
      <div className="summary"><small>NO3</small><b>{value(state.latestNitrate)}</b></div>
      <div className="summary"><small>{bi(lang,"فاصل التأكيد","Confirmation gap")}</small><b>{state.confirmationGapHours===null?"—":`${state.confirmationGapHours} h`}</b></div>
    </div>

    <div className={`inline-alert ${state.ready?"good":"warn"}`} style={{marginTop:12}}>
      <b>{bi(lang,"الخطوة التالية:","Next step:")}</b> {lang==="ar"?state.nextAr:state.nextEn}
      {onNavigate&&<button className="btn" style={{marginInlineStart:8}} onClick={()=>onNavigate(state.actionPage)}>{state.actionPage==="chemistry"?bi(lang,"فتح الكيمياء","Open chemistry"):state.actionPage==="equipment"?bi(lang,"فتح المعدات","Open equipment"):bi(lang,"متابعة الدورة","Cycle actions")}</button>}
    </div>

    <div className="cycle-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:12}}>
      <div className="card" style={{padding:14}}>
        <h4>{bi(lang,"إعداد الدورة","Cycle setup")}</h4>
        <label className="field"><span>{bi(lang,"طريقة بدء الدورة","Cycle start method")}</span><select value={method} onChange={e=>setMethod(e.target.value as NonNullable<BiologicalCycleState["method"]>)} disabled={state.sourceAdded}><option value="fishless">{methodText.fishless}</option><option value="seeded_media">{methodText.seeded_media}</option><option value="bottled_bacteria">{methodText.bottled_bacteria}</option><option value="other">{methodText.other}</option></select></label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
          <button className="btn primary" disabled={state.sourceAdded} onClick={recordSource}>{state.sourceAdded?bi(lang,"✓ مصدر الأمونيا مسجل","✓ Ammonia source recorded"):bi(lang,"تسجيل إضافة مصدر الأمونيا","Record ammonia source")}</button>
          <button className="btn" disabled={state.bacteriaSeeded} onClick={recordBacteria}>{state.bacteriaSeeded?bi(lang,"✓ البكتيريا/الميديا مسجلة","✓ Bacteria/media recorded"):bi(lang,"سجل بكتيريا/ميديا ناضجة","Record bacteria/seeded media")}</button>
        </div>
        <p className="note">{bi(lang,"لا تضف أسماك لاستخدامها كمصدر أمونيا. الدورة هون مبنية على Fishless Cycling والمتابعة بالاختبارات.","Do not use fish as an ammonia source. This workflow is built around fishless cycling and measured testing.")}</p>
      </div>

      <div className="card" style={{padding:14}}>
        <h4>{bi(lang,"شروط فتح الحوض","Unlock criteria")}</h4>
        <div className="task-list">{checks.map((x,i)=><div className="task-row" key={i}><span className={`check-dot ${x.done?"done":""}`}>{x.done?"✓":""}</span><div><b>{lang==="ar"?x.ar:x.en}</b>{i===4&&state.confirmationGapHours!==null&&<small>{state.confirmationGapHours} h</small>}</div></div>)}</div>
      </div>
    </div>

    {state.blockersAr.length>0&&!state.ready&&<div style={{display:"grid",gap:6,marginTop:12}}>{(lang==="ar"?state.blockersAr:state.blockersEn).map((x,i)=><div className="inline-alert info" key={i}>{x}</div>)}</div>}

    <div className="modal-actions" style={{marginTop:14}}>
      <button className="btn primary" disabled={!state.ready} onClick={completeCycle}>{state.ready?bi(lang,"✓ إنهاء الدورة وفتح البرنامج","✓ Complete cycle & unlock Aqua Nexus"):bi(lang,"🔒 البرنامج مقفول حتى تحقق شروط الجاهزية","🔒 Locked until readiness criteria are met")}</button>
    </div>
  </section>;
}
