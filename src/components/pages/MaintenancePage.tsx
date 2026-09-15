"use client";
import { useState } from "react";
import type { MaintenanceTask,Tank } from "@/domain/types";
import { maintenanceHealth } from "@/domain/health";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { today,uid } from "@/lib/appUtils";

const cadences:MaintenanceTask["cadence"][]=["daily","weekly","monthly","quarterly","semiannual","annual"];
const days:Record<string,number>={daily:1,weekly:7,monthly:30,quarterly:90,semiannual:182,annual:365,once:3650};

export function MaintenancePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[title,setTitle]=useState(""),[titleEn,setTitleEn]=useState(""),[cadence,setCadence]=useState<MaintenanceTask["cadence"]>("weekly");
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

 return <section className="page-grid maintenance-page">
  <PageHeader eyebrow="MAINTENANCE" title={tr(lang,"maintenance")} actions={<><button className="btn print-maintenance-btn" onClick={()=>window.print()}>🖨 {tr(lang,"printMaintenance")}</button><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addTask")}</button></>}/>

  <div className="maintenance-print-header print-only full-span">
    <h1>Aqua Nexus — {tr(lang,"maintenancePlan")}</h1>
    <div className="print-meta">
      <span><b>{tr(lang,"name")}:</b> {tank.name}</span>
      <span><b>{tr(lang,"systemVolume")}:</b> {tank.systemVolumeLiters} L</span>
      <span><b>{tr(lang,"generatedOn")}:</b> {new Date().toLocaleDateString()}</span>
      <span><b>{tr(lang,"maintenanceHealth")}:</b> {maintenanceHealth(tank)}%</span>
    </div>
  </div>

  <div className="card panel maintenance-health-card">
    <h3>{tr(lang,"maintenanceHealth")}</h3><b className="big-number">{maintenanceHealth(tank)}%</b>
    <div className="print-maint-summary">
      <span>{tr(lang,"totalTasks")}: <b>{recurring.length}</b></span>
      <span>{tr(lang,"doneTasks")}: <b>{completed}</b></span>
      <span>{tr(lang,"pendingTasks")}: <b>{pending}</b></span>
    </div>
  </div>

  <div className="card panel full-span maintenance-plan-card">
   {cadences.map(c=><div className="maintenance-group" key={c}>
    <h3>{tr(lang,c)}</h3>
    <div className="task-list">
      {tasks.filter(x=>x.cadence===c).map(x=><div className="task-row printable-task" key={x.id}>
       <span className={`check-dot ${x.done?"done":""}`}>{x.done?"✓":""}</span>
       <div><b>{lang==="ar"?x.title:(x.titleEn||x.title)}</b><small>{tr(lang,"due")}: {x.nextDue??"—"} {x.lastDone?` • ${tr(lang,"lastDone")}: ${x.lastDone}`:""}</small></div>
       <span className={`task-print-status ${x.done?"done":"pending"}`}>{x.done?tr(lang,"completed"):tr(lang,"pendingTasks")}</span>
       <button className="btn good no-print" onClick={()=>done(x.id)}>✓</button>
      </div>)}
    </div>
   </div>)}
  </div>

  <Modal open={open} title={tr(lang,"addTask")} onClose={()=>setOpen(false)}>
   <div className="form-grid"><label className="field"><span>العربية</span><input value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="field"><span>English</span><input value={titleEn} onChange={e=>setTitleEn(e.target.value)}/></label><label className="field"><span>{tr(lang,"cadence")}</span><select value={cadence} onChange={e=>setCadence(e.target.value as MaintenanceTask["cadence"])}>{cadences.map(c=><option key={c} value={c}>{tr(lang,c)}</option>)}</select></label></div>
   <div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div>
  </Modal>
 </section>;
}
