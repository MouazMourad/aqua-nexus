"use client";
import { useMemo,useState } from "react";
import type { DoserChannel,Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";

const colors=["#27c2dc","#62d48f","#f6c85f","#c877ff","#ff7e79","#4b8bff"];

export function DosingPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [param,setParam]=useState("KH"),[cur,setCur]=useState(7),[target,setTarget]=useState(8),[factor,setFactor]=useState(10);
 const ml=useMemo(()=>Math.max(0,(target-cur)*factor*(tank.systemVolumeLiters/100)),[cur,target,factor,tank.systemVolumeLiters]);

 function setCount(n:number){
  patch(tank.id,t=>{
   const channels=[...t.doserChannels];
   while(channels.length<n) channels.push({id:uid("dc"),name:`Channel ${channels.length+1}`,material:"",capacityMl:1000,currentMl:1000,consumption:0,period:"daily",color:colors[channels.length%colors.length]});
   return {...t,doserChannels:channels.slice(0,n)};
  });
 }
 function updateChannel(id:string,p:Partial<DoserChannel>){patch(tank.id,t=>({...t,doserChannels:t.doserChannels.map(x=>x.id===id?{...x,...p}:x)}))}
 function log(){
  patch(tank.id,t=>{
   const channels=t.doserChannels.map(ch=>ch.material.toLowerCase()===param.toLowerCase()?{...ch,currentMl:Math.max(0,ch.currentMl-ml)}:ch);
   return {...t,doserChannels:channels,dosing:[{id:uid("dose"),timestamp:nowISO(),parameter:param,current:cur,target,ml},...t.dosing],maintenance:[...t.maintenance,{id:uid("task"),title:`متابعة جرعة ${param}`,titleEn:`Follow up ${param} dose`,cadence:"once",done:false,nextDue:new Date(Date.now()+86400000).toISOString().slice(0,10),manual:true}]};
  });
 }
 function projectedDays(ch:DoserChannel){
  const daily=ch.period==="daily"?ch.consumption:ch.period==="weekly"?ch.consumption/7:ch.consumption/30;
  return daily>0?Math.floor(ch.currentMl/daily):null;
 }

 return <section className="page-grid"><PageHeader eyebrow="DOSING" title={tr(lang,"dosing")}/>
 <div className="card panel full-span">
  <div className="module-head"><h3>{tr(lang,"doserManager")}</h3><label className="field compact"><span>{tr(lang,"channels")}</span><input type="number" min="0" max="12" value={tank.doserChannels.length} onChange={e=>setCount(Number(e.target.value))}/></label></div>
  <div className="doser-editor-grid">{tank.doserChannels.map((ch,i)=>{const pct=Math.max(0,Math.min(100,ch.currentMl/ch.capacityMl*100)),days=projectedDays(ch);return <article className="doser-editor-card" key={ch.id}>
   <div className="doser-tank"><div className="doser-liquid animated-liquid" style={{height:`${pct}%`,background:ch.color}}/><div className="doser-info"><b>{ch.material||`Channel ${i+1}`}</b><span>{Math.round(ch.currentMl)} / {ch.capacityMl} mL</span><small>{pct.toFixed(0)}%</small></div></div>
   <div className="form-grid one-col">
    <label className="field"><span>{tr(lang,"liquid")}</span><input value={ch.material} onChange={e=>updateChannel(ch.id,{material:e.target.value})}/></label>
    <label className="field"><span>{tr(lang,"capacity")} mL</span><input type="number" value={ch.capacityMl} onChange={e=>updateChannel(ch.id,{capacityMl:Number(e.target.value)})}/></label>
    <label className="field"><span>{tr(lang,"remaining")} mL</span><input type="number" value={ch.currentMl} onChange={e=>updateChannel(ch.id,{currentMl:Number(e.target.value)})}/></label>
    <label className="field"><span>{tr(lang,"consumption")}</span><input type="number" step="any" value={ch.consumption} onChange={e=>updateChannel(ch.id,{consumption:Number(e.target.value)})}/></label>
    <label className="field"><span>{tr(lang,"period")}</span><select value={ch.period} onChange={e=>updateChannel(ch.id,{period:e.target.value as any})}><option value="daily">{tr(lang,"daily")}</option><option value="weekly">{tr(lang,"weekly")}</option><option value="monthly">{tr(lang,"monthly")}</option></select></label>
   </div>
   <div className="inline-alert info">{days===null?"—":`${days} ${lang==="ar"?"يوم متوقع حتى النفاد":"estimated days remaining"}`}</div>
  </article>})}</div>
 </div>

 <div className="card panel"><h3>{tr(lang,"addDose")}</h3><div className="form-grid"><label className="field"><span>{tr(lang,"parameter")}</span><input value={param} onChange={e=>setParam(e.target.value)}/></label><label className="field"><span>{tr(lang,"current")}</span><input type="number" step="any" value={cur} onChange={e=>setCur(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"target")}</span><input type="number" step="any" value={target} onChange={e=>setTarget(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"doseFactor")}</span><input type="number" step="any" value={factor} onChange={e=>setFactor(Number(e.target.value))}/></label></div><div className="dose-result">{tr(lang,"calculatedDose")}: <b>{ml.toFixed(1)} mL</b></div><button className="btn primary" onClick={log}>{tr(lang,"addDose")}</button></div>

 <div className="card panel"><h3>{tr(lang,"timeline")}</h3><div className="history-list">{tank.dosing.slice(0,20).map(x=><div className="history-row" key={x.id}><b>{x.parameter}: {x.ml.toFixed(1)} mL</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>)}</div></div>
 </section>;
}
