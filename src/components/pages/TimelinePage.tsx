"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { nowISO,uid } from "@/lib/appUtils";
export function TimelinePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[open,setOpen]=useState(false),[ar,setAr]=useState(""),[en,setEn]=useState(""),[search,setSearch]=useState(""),[type,setType]=useState("all");
 const allEvents=useMemo(()=>[...tank.timeline,...(tank.intelligenceEvents??[]).map(e=>({id:`core-${e.id}`,timestamp:e.timestamp,type:`core:${e.domain}:${e.verb}`,textAr:e.textAr,textEn:e.textEn}))]
  .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())
  .filter((e,i,all)=>all.findIndex(x=>x.timestamp===e.timestamp&&x.textAr===e.textAr&&x.textEn===e.textEn)===i),[tank.timeline,tank.intelligenceEvents]);
 const types=useMemo(()=>[...new Set(allEvents.map(x=>x.type))].sort(),[allEvents]);
 const filtered=useMemo(()=>allEvents.filter(x=>(type==="all"||x.type===type)&&(!search||`${x.textAr} ${x.textEn} ${x.type}`.toLowerCase().includes(search.toLowerCase()))),[allEvents,type,search]);
 const add=()=>{if(!(ar||en).trim())return;patch(tank.id,t=>({...t,timeline:[{id:uid("ev"),timestamp:nowISO(),type:"manual",textAr:ar||en,textEn:en||ar},...t.timeline]}));setOpen(false);setAr("");setEn("")};
 return <section className="page-grid"><PageHeader eyebrow="TANK TIMELINE" title={tr(lang,"timeline")} actions={<button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addEvent")}</button>}/>
 <div className="filter-bar full-span"><label className="field"><span>{bi(lang,"نوع الحدث","Event type")}</span><select value={type} onChange={e=>setType(e.target.value)}><option value="all">{tr(lang,"all")}</option>{types.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label className="field grow"><span>{tr(lang,"search")}</span><input value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 <div className="timeline full-span">{filtered.length?filtered.map(x=><article className="timeline-item" key={x.id}><span className="timeline-dot"/><div><small>{new Date(x.timestamp).toLocaleString()}</small><b>{lang==="ar"?x.textAr:x.textEn}</b><em>{x.type}</em></div></article>):<div className="empty-state">{tr(lang,"timelineEmpty")}</div>}</div>
 <Modal open={open} title={tr(lang,"addEvent")} onClose={()=>setOpen(false)}><div className="form-grid"><label className="field"><span>العربية</span><textarea value={ar} onChange={e=>setAr(e.target.value)}/></label><label className="field"><span>English</span><textarea value={en} onChange={e=>setEn(e.target.value)}/></label></div><div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
