"use client";
import { useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
export function FeedingPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[food,setFood]=useState(""),[amount,setAmount]=useState(""),[notes,setNotes]=useState("");
 const add=()=>patch(tank.id,t=>({...t,feeding:[{id:uid("feed"),timestamp:nowISO(),food,amount,notes},...t.feeding]}));
 return <section className="page-grid"><PageHeader eyebrow="FEEDING MANAGER" title={tr(lang,"feeding")}/>
 <div className="card panel"><div className="form-grid"><label className="field"><span>{tr(lang,"food")}</span><input value={food} onChange={e=>setFood(e.target.value)}/></label><label className="field"><span>{tr(lang,"feedAmount")}</span><input value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="field full-field"><span>{tr(lang,"notes")}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><button className="btn primary" onClick={add}>{tr(lang,"addFeeding")}</button></div>
 <div className="card panel"><div className="history-list">{tank.feeding.map(x=><div className="history-row" key={x.id}><b>{x.food} • {x.amount}</b><span>{new Date(x.timestamp).toLocaleString()}</span><small>{x.notes}</small></div>)}</div></div>
 </section>;
}
