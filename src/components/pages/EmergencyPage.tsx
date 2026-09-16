"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { EMERGENCY_SCENARIOS } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { today,uid,nowISO } from "@/lib/appUtils";

export function EmergencyPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const entries=Object.entries(EMERGENCY_SCENARIOS as any).filter(([,x]:any)=>!x.types||x.types.includes(tank.type));
 const [selected,setSelected]=useState(entries[0]?.[0]??"");
 const e:any=(EMERGENCY_SCENARIOS as any)[selected];
 const sessions=tank.emergencySessions??[];
 const active=sessions.find(x=>x.status==="active"&&x.scenarioId===selected);
 const activeAny=sessions.find(x=>x.status==="active");
 const steps:string[]=e?(lang==="ar"?e.stepsAr:e.stepsEn):[];
 const completed=active?.completedSteps??[];
 const progress=steps.length?Math.round(completed.length/steps.length*100):0;

 function startProtocol(){
  if(!e||active)return;
  const sessionId=uid("em");
  const ts=nowISO();
  const titleAr=`طوارئ: ${e.ar}`;
  const titleEn=`Emergency: ${e.en}`;
  patch(tank.id,t=>({...t,
   emergencySessions:[{id:sessionId,scenarioId:selected,titleAr:e.ar,titleEn:e.en,startedAt:ts,completedSteps:[],status:"active"},...(t.emergencySessions??[])],
   maintenance:[{id:uid("task"),title:titleAr,titleEn,cadence:"once",done:false,nextDue:today(),manual:true},...t.maintenance],
   timeline:[{id:uid("ev"),timestamp:ts,type:"emergency",textAr:`تم بدء بروتوكول طوارئ: ${e.ar}.`,textEn:`Emergency protocol started: ${e.en}.`},...t.timeline]
  }));
 }

 function toggleStep(index:number){
  if(!active)return;
  patch(tank.id,t=>({...t,emergencySessions:(t.emergencySessions??[]).map(s=>{
   if(s.id!==active.id)return s;
   const has=s.completedSteps.includes(index);
   const completedSteps=has?s.completedSteps.filter(x=>x!==index):[...s.completedSteps,index].sort((a,b)=>a-b);
   return {...s,completedSteps};
  })}));
 }

 function completeProtocol(){
  if(!active||completed.length<steps.length)return;
  const ts=nowISO();
  patch(tank.id,t=>({...t,
   emergencySessions:(t.emergencySessions??[]).map(s=>s.id===active.id?{...s,status:"completed",completedAt:ts}:s),
   maintenance:t.maintenance.map(task=>task.title===`طوارئ: ${e.ar}`||task.titleEn===`Emergency: ${e.en}`?{...task,done:true,lastDone:today()}:task),
   timeline:[{id:uid("ev"),timestamp:ts,type:"emergency",textAr:`اكتمل بروتوكول الطوارئ: ${e.ar}.`,textEn:`Emergency protocol completed: ${e.en}.`},...t.timeline]
  }));
 }

 const lastCompleted=useMemo(()=>sessions.find(x=>x.status==="completed"&&x.scenarioId===selected),[sessions,selected]);

 return <section className="page-grid"><PageHeader eyebrow="EMERGENCY RESPONSE" title={tr(lang,"emergency")}/>
 <div className="card panel">
  {activeAny&&<div className="inline-alert warn" style={{marginBottom:12}}>{bi(lang,`يوجد بروتوكول طوارئ نشط: ${activeAny.titleAr}`,`Active emergency protocol: ${activeAny.titleEn}`)}</div>}
  <div className="emergency-list">{entries.map(([k,x]:any)=><button type="button" className={`emergency-card ${selected===k?"selected":""}`} key={k} onClick={()=>setSelected(k)}><b>{lang==="ar"?x.ar:x.en}</b><span className={`status ${x.priority==="critical"?"warn":""}`}>{x.priority}</span><small>{lang==="ar"?x.summaryAr:x.summaryEn}</small></button>)}</div>
 </div>
 <div className="card panel emergency-detail">{e&&<>
  <div className="kpi-row"><h3>{lang==="ar"?e.ar:e.en}</h3><span className="status warn">{e.priority}</span></div>
  <p className="note">{lang==="ar"?e.summaryAr:e.summaryEn}</p>
  {!active&&<div className="emergency-actions"><button className="btn primary" onClick={startProtocol}>{bi(lang,"بدء بروتوكول الطوارئ","Start emergency protocol")}</button>{lastCompleted&&<span className="status">{bi(lang,"تم تنفيذ هذا البروتوكول سابقاً","Previously completed")}</span>}</div>}
  {active&&<>
   <div className="summary-strip" style={{margin:"12px 0"}}><div className="summary"><small>{bi(lang,"التقدم","Progress")}</small><b>{progress}%</b></div><div className="summary"><small>{bi(lang,"الخطوات المكتملة","Completed")}</small><b>{completed.length}/{steps.length}</b></div><div className="summary"><small>{bi(lang,"بدأ","Started")}</small><b>{new Date(active.startedAt).toLocaleTimeString()}</b></div></div>
   <div className="response-steps">{steps.map((s,i)=><button type="button" key={i} className={`task-row ${completed.includes(i)?"done":""}`} onClick={()=>toggleStep(i)} style={{width:"100%",textAlign:lang==="ar"?"right":"left"}}><span className={`check-dot ${completed.includes(i)?"done":""}`}>{completed.includes(i)?"✓":i+1}</span><div><b>{s}</b></div></button>)}</div>
   <div className="inline-alert warn" style={{marginTop:12}}><b>{tr(lang,"avoid")}:</b> {lang==="ar"?e.avoidAr:e.avoidEn}</div>
   <div className="emergency-actions"><button className="btn good" onClick={completeProtocol} disabled={completed.length<steps.length}>✓ {bi(lang,"إنهاء البروتوكول وتسجيل التعافي","Complete protocol & log recovery")}</button></div>
  </>}
  {!active&&<><ol className="response-steps">{steps.map((s:string,i:number)=><li key={i}>{s}</li>)}</ol><div className="inline-alert warn"><b>{tr(lang,"avoid")}:</b> {lang==="ar"?e.avoidAr:e.avoidEn}</div></>}
 </>}</div>
 </section>;
}
