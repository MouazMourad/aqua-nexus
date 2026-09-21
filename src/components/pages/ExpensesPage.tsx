"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today } from "@/lib/appUtils";
import { tankEnergy } from "@/domain/equipmentIntelligence";
import { validateExpenseEntry } from "@/domain/inputSanity";
export function ExpensesPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[desc,setDesc]=useState(""),[amount,setAmount]=useState(0),[currency,setCurrency]=useState("USD"),[historyLimit,setHistoryLimit]=useState(100);
 const total=useMemo(()=>tank.expenses.filter(x=>x.currency===currency).reduce((s,x)=>s+x.amount,0),[tank.expenses,currency]);
 const month=today().slice(0,7),monthly=useMemo(()=>tank.expenses.filter(x=>x.currency===currency&&x.date.startsWith(month)).reduce((s,x)=>s+x.amount,0),[tank.expenses,currency,month]);
 const energy=tankEnergy(tank);
 const add=()=>{
  const check=validateExpenseEntry({amount,description:desc,currency});
  const danger=check.issues.find(x=>x.level==="danger");
  if(danger){window.alert(lang==="ar"?danger.ar:danger.en);return}
  patch(tank.id,t=>({...t,expenses:[{id:uid("ex"),date:today(),description:desc.trim(),amount,currency:currency.trim()},...t.expenses]}));
  setDesc("");setAmount(0);
 };
 return <section className="page-grid"><PageHeader eyebrow="EXPENSES" title={tr(lang,"expenses")}/>
 <div className="card panel"><div className="form-grid"><label className="field"><span>{tr(lang,"description")}</span><input value={desc} onChange={e=>setDesc(e.target.value)}/></label><label className="field"><span>{tr(lang,"amount")}</span><input type="number" min="0" max="1000000000" step="any" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"currency")}</span><input value={currency} onChange={e=>setCurrency(e.target.value)}/></label></div><button className="btn primary" onClick={add} disabled={!desc.trim()||amount<=0}>{tr(lang,"addExpense")}</button><div className="summary-strip" style={{marginTop:12}}><div className="summary"><small>{tr(lang,"totalExpenses")}</small><b>{total.toFixed(2)} {currency}</b></div><div className="summary"><small>{lang==="ar"?"هذا الشهر":"This month"}</small><b>{monthly.toFixed(2)} {currency}</b></div><div className="summary"><small>{lang==="ar"?"طاقة شهرية تقديرية":"Estimated monthly energy"}</small><b>{energy.monthlyKwh.toFixed(1)} kWh</b></div></div></div>
 <div className="card panel"><div className="history-list">{tank.expenses.slice(0,historyLimit).map(x=><div className="history-row" key={x.id}><b>{x.description}</b><span>{x.amount} {x.currency} • {x.date}</span></div>)}</div>{historyLimit<tank.expenses.length&&<button className="btn" onClick={()=>setHistoryLimit(n=>n+100)}>{lang==="ar"?`عرض 100 مصروف أقدم — باقي ${tank.expenses.length-historyLimit}`:`Show 100 older expenses — ${tank.expenses.length-historyLimit} remaining`}</button>}</div>
 </section>;
}
