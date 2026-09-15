"use client";
import { useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today } from "@/lib/appUtils";
export function QuarantinePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[organism,setOrganism]=useState(""),[reason,setReason]=useState(""),[plan,setPlan]=useState("");
 const add=()=>patch(tank.id,t=>({...t,quarantine:[{id:uid("q"),organism,reason,plan,start:today(),status:"active"},...t.quarantine]}));
 const close=(id:string)=>patch(tank.id,t=>({...t,quarantine:t.quarantine.map(x=>x.id===id?{...x,status:"closed"}:x)}));
 return <section className="page-grid"><PageHeader eyebrow="QUARANTINE" title={tr(lang,"quarantine")}/>
 <div className="card panel"><div className="form-grid"><label className="field"><span>{tr(lang,"organism")}</span><input value={organism} onChange={e=>setOrganism(e.target.value)}/></label><label className="field"><span>{tr(lang,"reason")}</span><input value={reason} onChange={e=>setReason(e.target.value)}/></label><label className="field full-field"><span>{tr(lang,"plan")}</span><textarea value={plan} onChange={e=>setPlan(e.target.value)}/></label></div><button className="btn primary" onClick={add}>{tr(lang,"addCase")}</button></div>
 <div className="card panel"><div className="history-list">{tank.quarantine.map(x=><div className="case-row" key={x.id}><div><b>{x.organism}</b><span>{x.reason}</span><small>{x.plan}</small></div><span className={`status ${x.status==="active"?"warn":""}`}>{tr(lang,x.status==="active"?"active":"completed")}</span>{x.status==="active"&&<button className="btn good" onClick={()=>close(x.id)}>✓</button>}</div>)}</div></div>
 </section>;
}
