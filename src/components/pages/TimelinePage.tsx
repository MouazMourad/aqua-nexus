"use client";
import { useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { nowISO,uid } from "@/lib/appUtils";
export function TimelinePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[open,setOpen]=useState(false),[ar,setAr]=useState(""),[en,setEn]=useState("");
 const add=()=>{patch(tank.id,t=>({...t,timeline:[{id:uid("ev"),timestamp:nowISO(),type:"manual",textAr:ar||en,textEn:en||ar},...t.timeline]}));setOpen(false)};
 return <section className="page-grid"><PageHeader eyebrow="TANK TIMELINE" title={tr(lang,"timeline")} actions={<button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addEvent")}</button>}/>
 <div className="timeline full-span">{tank.timeline.length?tank.timeline.map(x=><article className="timeline-item" key={x.id}><span className="timeline-dot"/><div><small>{new Date(x.timestamp).toLocaleString()}</small><b>{lang==="ar"?x.textAr:x.textEn}</b><em>{x.type}</em></div></article>):<div className="empty-state">{tr(lang,"timelineEmpty")}</div>}</div>
 <Modal open={open} title={tr(lang,"addEvent")} onClose={()=>setOpen(false)}><div className="form-grid"><label className="field"><span>العربية</span><textarea value={ar} onChange={e=>setAr(e.target.value)}/></label><label className="field"><span>English</span><textarea value={en} onChange={e=>setEn(e.target.value)}/></label></div><div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
