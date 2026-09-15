"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today } from "@/lib/appUtils";
export function ExpensesPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[desc,setDesc]=useState(""),[amount,setAmount]=useState(0),[currency,setCurrency]=useState("USD");
 const total=useMemo(()=>tank.expenses.filter(x=>x.currency===currency).reduce((s,x)=>s+x.amount,0),[tank.expenses,currency]);
 const add=()=>patch(tank.id,t=>({...t,expenses:[{id:uid("ex"),date:today(),description:desc,amount,currency},...t.expenses]}));
 return <section className="page-grid"><PageHeader eyebrow="EXPENSES" title={tr(lang,"expenses")}/>
 <div className="card panel"><div className="form-grid"><label className="field"><span>{tr(lang,"description")}</span><input value={desc} onChange={e=>setDesc(e.target.value)}/></label><label className="field"><span>{tr(lang,"amount")}</span><input type="number" step="any" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"currency")}</span><input value={currency} onChange={e=>setCurrency(e.target.value)}/></label></div><button className="btn primary" onClick={add}>{tr(lang,"addExpense")}</button><div className="expense-total">{tr(lang,"totalExpenses")}: <b>{total.toFixed(2)} {currency}</b></div></div>
 <div className="card panel"><div className="history-list">{tank.expenses.map(x=><div className="history-row" key={x.id}><b>{x.description}</b><span>{x.amount} {x.currency} • {x.date}</span></div>)}</div></div>
 </section>;
}
