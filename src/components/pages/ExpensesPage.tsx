"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today } from "@/lib/appUtils";
import { tankEnergy } from "@/domain/equipmentIntelligence";
export function ExpensesPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[desc,setDesc]=useState(""),[amount,setAmount]=useState(0),[currency,setCurrency]=useState("USD");
 const total=useMemo(()=>tank.expenses.filter(x=>x.currency===currency).reduce((s,x)=>s+x.amount,0),[tank.expenses,currency]);
 const month=today().slice(0,7),monthly=useMemo(()=>tank.expenses.filter(x=>x.currency===currency&&x.date.startsWith(month)).reduce((s,x)=>s+x.amount,0),[tank.expenses,currency,month]);
 const energy=tankEnergy(tank);
 const add=()=>patch(tank.id,t=>({...t,expenses:[{id:uid("ex"),date:today(),description:desc,amount,currency},...t.expenses]}));
 return <section className="page-grid"><PageHeader eyebrow="EXPENSES" title={tr(lang,"expenses")}/>
 <div className="card panel"><div className="form-grid"><label className="field"><span>{tr(lang,"description")}</span><input value={desc} onChange={e=>setDesc(e.target.value)}/></label><label className="field"><span>{tr(lang,"amount")}</span><input type="number" step="any" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"currency")}</span><input value={currency} onChange={e=>setCurrency(e.target.value)}/></label></div><button className="btn primary" onClick={add} disabled={!desc.trim()||amount<=0}>{tr(lang,"addExpense")}</button><div className="summary-strip" style={{marginTop:12}}><div className="summary"><small>{tr(lang,"totalExpenses")}</small><b>{total.toFixed(2)} {currency}</b></div><div className="summary"><small>{lang==="ar"?"هذا الشهر":"This month"}</small><b>{monthly.toFixed(2)} {currency}</b></div><div className="summary"><small>{lang==="ar"?"طاقة شهرية تقديرية":"Estimated monthly energy"}</small><b>{energy.monthlyKwh.toFixed(1)} kWh</b></div></div></div>
 <div className="card panel"><div className="history-list">{tank.expenses.map(x=><div className="history-row" key={x.id}><b>{x.description}</b><span>{x.amount} {x.currency} • {x.date}</span></div>)}</div></div>
 </section>;
}
