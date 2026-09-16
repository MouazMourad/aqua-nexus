"use client";
import { useState } from "react";
import type { MaintenanceTask,Tank } from "@/domain/types";
import { maintenanceHealth } from "@/domain/health";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { today,uid,nowISO } from "@/lib/appUtils";

const cadences:MaintenanceTask["cadence"][]=["daily","weekly","monthly","quarterly","semiannual","annual"];
const days:Record<string,number>={daily:1,weekly:7,monthly:30,quarterly:90,semiannual:182,annual:365,once:3650};

function addDateDays(dateOnly:string,offset:number){
 const [y,m,d]=dateOnly.split("-").map(Number);const date=new Date(Date.UTC(y,m-1,d+offset));return date.toISOString().slice(0,10);
}

export function MaintenancePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[title,setTitle]=useState(""),[titleEn,setTitleEn]=useState(""),[cadence,setCadence]=useState<MaintenanceTask["cadence"]>("weekly");
 const [departure,setDeparture]=useState(()=>addDateDays(today(),1)),[daysAway,setDaysAway]=useState(7),[caretaker,setCaretaker]=useState(""),[travelGenerated,setTravelGenerated]=useState(false);
 const hasChem=tank.maintenance.some(x=>/قياس النسب الكيميائية|Weekly chemistry/i.test(`${x.title} ${x.titleEn||""}`));
 const tasks=hasChem?tank.maintenance:[...tank.maintenance,{id:"virtual-chem",title:"قياس النسب الكيميائية الأسبوعي",titleEn:"Weekly chemistry measurement",cadence:"weekly" as const,done:false,nextDue:new Date(Date.now()+7*86400000).toISOString().slice(0,10)}];
 const recurring=tasks.filter(x=>x.cadence!=="once");
 const completed=recurring.filter(x=>x.done).length;
 const pending=recurring.length-completed;

 const done=(id:string)=>{
  if(id==="virtual-chem"){
    patch(tank.id,t=>({...t,maintenance:[...t.maintenance,{id:uid("task"),title:"قياس النسب الكيميائية الأسبوعي",titleEn:"Weekly chemistry measurement",cadence:"weekly",done:true,lastDone:today(),nextDue:new Date(Date.now()+7*86400000).toISOString().slice(0,10)}]}));
    return;
  }
  patch(tank.id,t=>({...t,maintenance:t.maintenance.map(x=>x.id===id?{...x,done:true,lastDone:today(),nextDue:new Date(Date.now()+days[x.cadence]*86400000).toISOString().slice(0,10)}:x)}));
 };
 const add=()=>{patch(tank.id,t=>({...t,maintenance:[...t.maintenance,{id:uid("task"),title:title||bi(lang,"مهمة جديدة","New Task"),titleEn:titleEn||title,cadence,done:false,nextDue:today(),manual:true}]}));setOpen(false)};

 function generateTravelPlan(){
  const span=Math.max(1,Math.min(60,Math.round(daysAway||1)));
  const who=caretaker.trim();
  const prefix="[TRAVEL]";
  const preDate=addDateDays(departure,-1);
  const generated:MaintenanceTask[]=[];
  const addTask=(ar:string,en:string,due:string)=>generated.push({id:uid("travel"),title:`${prefix} ${ar}`,titleEn:`${prefix} ${en}`,cadence:"once",done:false,nextDue:due,manual:true});
  addTask("فحص كيمياء كامل وتسجيل القيم الأساسية قبل السفر","Run a full chemistry test and save baseline values before travel",preDate);
  addTask("فحص مضخة الرجوع والسخان والويف ميكر والـATO والتأكد من عدم وجود إنذارات","Inspect return pump, heater, wave makers and ATO; confirm there are no warnings",preDate);
  addTask("تعبئة خزان ATO وخزانات الدوزر وتجهيز حصص الطعام بدون زيادة","Refill ATO/doser reservoirs and prepare pre-portioned food without overfeeding",preDate);
  if(tank.type==="marine")addTask("تأكد من الملوحة وثبات حرارة ماء التعويض وعدم ترك خلطات غير موثقة","Confirm salinity and top-off setup; do not leave undocumented mixes",preDate);
  const interval=span<=14?1:2;
  for(let d=0;d<span;d+=interval){
    const due=addDateDays(departure,d);
    const day=d+1;
    addTask(`سفر يوم ${day}: نظرة بصرية على الكائنات + الحرارة + مستوى الماء + عمل المضخات${who?` — المسؤول: ${who}`:""}`,`Travel day ${day}: visual livestock check + temperature + water level + pump operation${who?` — caretaker: ${who}`:""}`,due);
    if(d%7===6||day===span)addTask(`سفر يوم ${day}: مراجعة التنبيهات وعدم تعديل الجرعات أو المعدات بدون سبب واضح`,`Travel day ${day}: review alerts; avoid changing dosing or equipment without a clear reason`,due);
  }
  if(span>=7)addTask("فحص كيمياء مختصر أثناء الغياب إذا كان الشخص المسؤول قادر عليه","Run a limited chemistry check during absence if the caretaker can do it safely",addDateDays(departure,Math.min(7,span-1)));
  addTask("بعد العودة: فحص كيمياء كامل ومقارنة الحالة مع خط الأساس قبل السفر","After return: run a full chemistry test and compare with the pre-travel baseline",addDateDays(departure,span));
  patch(tank.id,t=>{
    const keep=t.maintenance.filter(x=>!x.title.startsWith(prefix)&&!(x.titleEn||"").startsWith(prefix));
    return {...t,maintenance:[...generated,...keep],timeline:[{id:uid("ev"),timestamp:nowISO(),type:"travel",textAr:`تم إنشاء خطة غياب لمدة ${span} يوم تبدأ ${departure}${who?` والمسؤول ${who}`:""}.`,textEn:`A ${span}-day travel plan was generated starting ${departure}${who?` with ${who} as caretaker`:""}.`},...t.timeline]};
  });
  setTravelGenerated(true);window.setTimeout(()=>setTravelGenerated(false),2600);
 }

 return <section className="page-grid maintenance-page">
  <PageHeader eyebrow="MAINTENANCE" title={tr(lang,"maintenance")} actions={<><button className="btn print-maintenance-btn" onClick={()=>window.print()}>🖨 {tr(lang,"printMaintenance")}</button><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addTask")}</button></>}/>

  <div className="maintenance-print-header print-only full-span">
    <h1>Aqua Nexus — {tr(lang,"maintenancePlan")}</h1>
    <div className="print-meta"><span><b>{tr(lang,"name")}:</b> {tank.name}</span><span><b>{tr(lang,"systemVolume")}:</b> {tank.systemVolumeLiters} L</span><span><b>{tr(lang,"generatedOn")}:</b> {new Date().toLocaleDateString()}</span><span><b>{tr(lang,"maintenanceHealth")}:</b> {maintenanceHealth(tank)}%</span></div>
  </div>

  <div className="card panel maintenance-health-card">
    <h3>{tr(lang,"maintenanceHealth")}</h3><b className="big-number">{maintenanceHealth(tank)}%</b>
    <div className="print-maint-summary"><span>{tr(lang,"totalTasks")}: <b>{recurring.length}</b></span><span>{tr(lang,"doneTasks")}: <b>{completed}</b></span><span>{tr(lang,"pendingTasks")}: <b>{pending}</b></span></div>
  </div>

  <div className="card panel travel-mode-card">
    <small className="eyebrow-mini">TRAVEL / ABSENCE MODE</small><h3>{bi(lang,"وضع السفر والغياب","Travel & absence mode")}</h3>
    <p className="note">{bi(lang,"Aqua Nexus يولّد خطة مبسطة للشخص يلي رح يراقب الحوض، مع مهام قبل السفر وأثناء الغياب وبعد الرجعة.","Aqua Nexus generates a simplified caretaker plan with tasks before, during and after your absence.")}</p>
    <div className="form-grid">
      <label className="field"><span>{bi(lang,"تاريخ المغادرة","Departure date")}</span><input type="date" value={departure} onChange={e=>setDeparture(e.target.value)}/></label>
      <label className="field"><span>{bi(lang,"مدة الغياب بالأيام","Days away")}</span><input type="number" min="1" max="60" value={daysAway} onChange={e=>setDaysAway(Number(e.target.value))}/></label>
      <label className="field"><span>{bi(lang,"اسم الشخص المسؤول (اختياري)","Caretaker name (optional)")}</span><input value={caretaker} onChange={e=>setCaretaker(e.target.value)}/></label>
    </div>
    <div className="travel-actions"><button className="btn primary" onClick={generateTravelPlan}>{bi(lang,"توليد خطة السفر","Generate travel plan")}</button>{travelGenerated&&<span className="status">✓ {bi(lang,"تمت إضافة الخطة للصيانة","Plan added to maintenance")}</span>}</div>
    <div className="inline-alert info">{bi(lang,"الخطة تتعمد تبسيط التعليمات للشخص المسؤول وتجنب تغييرات كبيرة بالجرعات أو المعدات خلال غيابك.","The plan deliberately keeps caretaker instructions simple and avoids major dosing/equipment changes while you are away.")}</div>
  </div>

  <div className="card panel full-span maintenance-plan-card">
   {cadences.map(c=><div className="maintenance-group" key={c}><h3>{tr(lang,c)}</h3><div className="task-list">{tasks.filter(x=>x.cadence===c).map(x=><div className="task-row printable-task" key={x.id}><span className={`check-dot ${x.done?"done":""}`}>{x.done?"✓":""}</span><div><b>{(lang==="ar"?x.title:(x.titleEn||x.title)).replace("[TRAVEL] ","")}</b><small>{tr(lang,"due")}: {x.nextDue??"—"} {x.lastDone?` • ${tr(lang,"lastDone")}: ${x.lastDone}`:""}</small></div><span className={`task-print-status ${x.done?"done":"pending"}`}>{x.done?tr(lang,"completed"):tr(lang,"pendingTasks")}</span><button className="btn good no-print" onClick={()=>done(x.id)}>✓</button></div>)}</div></div>)}
   {tasks.filter(x=>x.cadence==="once").length>0&&<div className="maintenance-group"><h3>{bi(lang,"مهام لمرة واحدة / سفر / علاج","One-time / travel / treatment")}</h3><div className="task-list">{tasks.filter(x=>x.cadence==="once").map(x=><div className="task-row printable-task" key={x.id}><span className={`check-dot ${x.done?"done":""}`}>{x.done?"✓":""}</span><div><b>{(lang==="ar"?x.title:(x.titleEn||x.title)).replace("[TRAVEL] ","")}</b><small>{tr(lang,"due")}: {x.nextDue??"—"}</small></div><span className={`task-print-status ${x.done?"done":"pending"}`}>{x.done?tr(lang,"completed"):tr(lang,"pendingTasks")}</span><button className="btn good no-print" onClick={()=>done(x.id)}>✓</button></div>)}</div></div>}
  </div>

  <Modal open={open} title={tr(lang,"addTask")} onClose={()=>setOpen(false)}>
   <div className="form-grid"><label className="field"><span>العربية</span><input value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="field"><span>English</span><input value={titleEn} onChange={e=>setTitleEn(e.target.value)}/></label><label className="field"><span>{tr(lang,"cadence")}</span><select value={cadence} onChange={e=>setCadence(e.target.value as MaintenanceTask["cadence"])}>{cadences.map(c=><option key={c} value={c}>{tr(lang,c)}</option>)}</select></label></div>
   <div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div>
  </Modal>
 </section>;
}
