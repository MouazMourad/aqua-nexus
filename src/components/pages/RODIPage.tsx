"use client";
import { useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
export function RODIPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[tin,setTin]=useState(150),[tout,setTout]=useState(0),[liters,setLiters]=useState(20);
 const add=()=>patch(tank.id,t=>({...t,rodi:[{id:uid("ro"),timestamp:nowISO(),tdsIn:tin,tdsOut:tout,liters},...t.rodi]}));
 return <section className="page-grid"><PageHeader eyebrow="RO/DI" title={tr(lang,"rodi")}/>
 <div className="card panel"><div className="form-grid"><label className="field"><span>{tr(lang,"tdsIn")}</span><input type="number" value={tin} onChange={e=>setTin(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"tdsOut")}</span><input type="number" value={tout} onChange={e=>setTout(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"producedLiters")}</span><input type="number" value={liters} onChange={e=>setLiters(Number(e.target.value))}/></label></div><button className="btn primary" onClick={add}>{tr(lang,"logBatch")}</button></div>
 <div className="card panel"><div className="history-list">{tank.rodi.map(x=><div className="history-row" key={x.id}><b>{x.liters} L • TDS {x.tdsIn} → {x.tdsOut}</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>)}</div></div>
 </section>;
}
