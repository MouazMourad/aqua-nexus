"use client";
import { useMemo,useState } from "react";
import { ResponsiveContainer,LineChart,Line,XAxis,YAxis,Tooltip,CartesianGrid } from "recharts";
import type { Tank } from "@/domain/types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { chemistryHealth,parameterScore } from "@/domain/health";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { nowISO,uid } from "@/lib/appUtils";

export function ChemistryPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),cfg:any=CHEMISTRY_CATALOG[tank.type],latest=tank.chemistry[0]?.values??{};
 const keys=Object.keys(cfg); const [selected,setSelected]=useState(keys[0]); const [open,setOpen]=useState(false);
 const [values,setValues]=useState<Record<string,number>>(()=>Object.fromEntries(keys.map(k=>[k,Number(latest[k]??cfg[k].def)])));
 const [notes,setNotes]=useState("");
 const chart=useMemo(()=>tank.chemistry.slice(0,30).reverse().map(r=>({date:new Date(r.timestamp).toLocaleDateString(),value:r.values[selected]})),[tank.chemistry,selected]);
 function save(){patch(tank.id,t=>({...t,
 chemistry:[{timestamp:nowISO(),values,notes},...t.chemistry],
 maintenance:t.maintenance.map(m=>/قياس النسب الكيميائية|Weekly chemistry/i.test(`${m.title} ${m.titleEn||""}`)?{...m,done:true,lastDone:new Date().toISOString().slice(0,10),nextDue:new Date(Date.now()+7*86400000).toISOString().slice(0,10)}:m),
 timeline:[{id:uid("ev"),timestamp:nowISO(),type:"chemistry",textAr:"تم تسجيل قراءة كيمياء جديدة.",textEn:"A new chemistry reading was recorded."},...t.timeline]
}));setOpen(false);}
 return <section className="page-grid"><PageHeader eyebrow="WATER CHEMISTRY" title={tr(lang,"chemistry")} actions={<button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addReading")}</button>}/>
 <div className="card panel"><h3>{tr(lang,"chemistryHealth")}</h3><b className="big-number">{chemistryHealth(tank)}%</b></div>
 <div className="card panel"><label className="field"><span>{tr(lang,"parameter")}</span><select value={selected} onChange={e=>setSelected(e.target.value)}>{keys.map(k=><option key={k}>{k}</option>)}</select></label><div className="chart-box"><ResponsiveContainer width="100%" height={230}><LineChart data={chart}><CartesianGrid stroke="#15384a"/><XAxis dataKey="date" tick={{fill:"#7da5b4",fontSize:9}}/><YAxis tick={{fill:"#7da5b4",fontSize:9}}/><Tooltip/><Line type="monotone" dataKey="value" stroke="#42d7e7" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></div>
 <div className="card panel full-span"><div className="table-wrap"><table><thead><tr><th>{tr(lang,"parameter")}</th><th>{tr(lang,"current")}</th><th>Ideal</th><th>Score</th></tr></thead><tbody>{keys.map(k=>{const m:any=cfg[k],s=parameterScore(latest[k],m);return <tr key={k}><td>{m.label}</td><td>{latest[k]??"—"}</td><td>{m.ideal[0]}–{m.ideal[1]}</td><td>{s===null?"—":`${s}%`}</td></tr>})}</tbody></table></div></div>
 <Modal open={open} title={tr(lang,"addReading")} onClose={()=>setOpen(false)}><div className="form-grid">{keys.map(k=><label className="field" key={k}><span>{cfg[k].label}</span><input type="number" step="any" value={values[k]} onChange={e=>setValues(v=>({...v,[k]:Number(e.target.value)}))}/></label>)}<label className="field full-field"><span>{tr(lang,"notes")}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={save}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
