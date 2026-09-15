"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
export function WaterChangePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[liters,setLiters]=useState(Math.round(tank.systemVolumeLiters*.15)),[sal,setSal]=useState(1.025),[temp,setTemp]=useState(25),[notes,setNotes]=useState("");
 const pct=useMemo(()=>tank.systemVolumeLiters?liters/tank.systemVolumeLiters*100:0,[liters,tank.systemVolumeLiters]);
 const save=()=>patch(tank.id,t=>({...t,waterChanges:[{id:uid("wc"),timestamp:nowISO(),liters,percent:pct,salinity:t.type==="marine"?sal:undefined,temperature:temp,notes},...t.waterChanges],timeline:[{id:uid("ev"),timestamp:nowISO(),type:"waterchange",textAr:`تم تغيير ${liters} لتر من الماء.`,textEn:`A ${liters} L water change was logged.`},...t.timeline]}));
 return <section className="page-grid"><PageHeader eyebrow="WATER CHANGE MANAGER" title={tr(lang,"waterChange")}/>
 <div className="card panel"><div className="form-grid"><label className="field"><span>{tr(lang,"changeLiters")}</span><input type="number" value={liters} onChange={e=>setLiters(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"changePercent")}</span><input value={`${pct.toFixed(1)}%`} readOnly/></label>{tank.type==="marine"&&<label className="field"><span>{tr(lang,"replacementSalinity")}</span><input type="number" step=".001" value={sal} onChange={e=>setSal(Number(e.target.value))}/></label>}<label className="field"><span>{tr(lang,"temperature")}</span><input type="number" step=".1" value={temp} onChange={e=>setTemp(Number(e.target.value))}/></label><label className="field full-field"><span>{tr(lang,"notes")}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><button className="btn primary" onClick={save}>{tr(lang,"waterChangeLog")}</button></div>
 <div className="card panel"><div className="history-list">{tank.waterChanges.map(x=><div className="history-row" key={x.id}><b>{x.liters} L • {x.percent.toFixed(1)}%</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>)}</div></div>
 </section>;
}
