"use client";
import {useMemo} from "react";
import type {Tank} from "@/domain/types";
import {useAquaStore} from "@/store/useAquaStore";
import {PageHeader} from "@/components/ui/PageHeader";
import {bi} from "@/i18n";

const DAY=86400000;
const num=(v:unknown)=>Math.max(0,Number(v)||0);
export function TankConsumptionPage({tank}:{tank:Tank}){
 const lang=useAquaStore(s=>s.language),now=Date.now();
 const stats=useMemo(()=>{
  const within=(ts:string,d:number)=>now-new Date(ts).getTime()<=d*DAY;
  const dosing=tank.dosing.filter(x=>within(x.timestamp,30));
  const feeding=tank.feeding.filter(x=>within(x.timestamp,30));
  const plant=(tank.plantCare??[]).filter(x=>within(x.timestamp,30));
  const dose=new Map<string,number>();for(const x of dosing)dose.set(x.parameter,(dose.get(x.parameter)||0)+num(x.ml||x.amount));
  const stock=new Map<string,number>();
  for(const x of feeding)if(x.inventoryQuantityUsed)stock.set(`${x.food}|${x.inventoryUnit||"unit"}`,(stock.get(`${x.food}|${x.inventoryUnit||"unit"}`)||0)+num(x.inventoryQuantityUsed));
  for(const x of plant)if(x.inventoryUse){const k=`${x.inventoryUse.name||x.kind}|${x.inventoryUse.unit}`;stock.set(k,(stock.get(k)||0)+num(x.inventoryUse.quantity));}
  const chem=(key:string)=>tank.chemistry.map(x=>({ts:x.timestamp,v:Number(x.values[key])})).filter(x=>Number.isFinite(x.v)).sort((a,b)=>new Date(b.ts).getTime()-new Date(a.ts).getTime()).slice(0,8);
  const trend=(key:string)=>{const a=chem(key);if(a.length<2)return null;const newest=a[0],oldest=a[a.length-1],days=Math.max(1,(new Date(newest.ts).getTime()-new Date(oldest.ts).getTime())/DAY);return (newest.v-oldest.v)/days};
  const growth30=tank.livestock.flatMap(x=>(x.lifeEvents??[]).filter(e=>e.type==="growth"&&within(e.timestamp,30))).length;
  const remaining=[...stock.entries()].map(([k,used])=>{const [name,unit]=k.split("|"),inv=tank.inventory.find(i=>(i.name===name||i.nameEn===name)&&i.unit===unit);return{name,unit,used,daily:used/30,daysLeft:inv&&used>0?inv.quantity/(used/30):null}});
  return{dose:[...dose.entries()],stock:[...stock.entries()],remaining,feedingCount:feeding.length,growth30,kh:trend("KH"),ca:trend("Ca"),mg:trend("Mg"),no3:trend("NO3"),po4:trend("PO4")};
 },[tank,now]);
 const correlation=tank.type==="marine"
  ?stats.growth30&&stats.dose.length?bi(lang,"تم تسجيل نمو مع استخدام جرعات خلال آخر 30 يوم. عقل الحوض سيعاملها كعلاقة تستحق المراقبة، وليس كسبب مثبت أو أمراً لرفع الجرعة.","Growth and dosing were both logged in the last 30 days. Tank Brain treats this as a correlation to watch, not proof of causation or an instruction to increase dosing.")
  :stats.growth30&&(tank.plantCare??[]).length?bi(lang,"تم تسجيل نمو نباتي مع عناية/تسميد. راقب الكيمياء وCO₂ قبل أي تعديل؛ الارتباط لا يعني أن التسميد هو السبب وحده.","Plant growth and care/fertilization were both logged. Review chemistry and CO₂ before changing anything; correlation does not prove causation.")
  :bi(lang,"مع تراكم بيانات النمو والتغذية والجرعات سيظهر هنا الربط بين الطلب الحيوي واتجاهات الحوض.","As growth, feeding and dosing evidence accumulates, biological demand correlations will appear here.");
 return <section className="page-grid"><PageHeader eyebrow="TANK CONSUMPTION" title={bi(lang,"استهلاك الحوض","Tank Consumption")}/>
 <section className="card panel full-span"><h3>{bi(lang,"الاستهلاك المثبت • آخر 30 يوم","Evidence-backed consumption • last 30 days")}</h3><p className="note">{bi(lang,"لا نجمع وحدات مختلفة مع بعضها ولا نسمي تغير الكيمياء استهلاكاً إذا لم يكن لدينا دليل كافٍ.","Different units are never mixed, and chemistry drift is not labeled biological consumption without enough evidence.")}</p>
 <div className="feeding-first-look"><div><small>{bi(lang,"مرات التغذية","Feedings")}</small><b>{stats.feedingCount}</b></div><div><small>{bi(lang,"أحداث نمو","Growth events")}</small><b>{stats.growth30}</b></div><div><small>{bi(lang,"مواد جرعات","Dosing materials")}</small><b>{stats.dose.length}</b></div></div></section>
 <section className="card panel full-span"><h3>{bi(lang,"الجرعات","Dosing")}</h3>{stats.dose.length?stats.dose.map(([p,v])=><div className="mini-row" key={p}><b>{p}</b><span>{v.toFixed(1)} mL / 30d • {(v/30).toFixed(2)} mL/day</span></div>):<p className="note">{bi(lang,"لا توجد جرعات مسجلة.","No dosing history.")}</p>}</section>
 <section className="card panel full-span"><h3>{bi(lang,"التغذية والمواد المستهلكة","Feeding & consumed stock")}</h3>{stats.stock.length?stats.stock.map(([k,v])=>{const [n,u]=k.split("|");return <div className="mini-row" key={k}><b>{n}</b><span>{v.toFixed(2)} {u} / 30d</span></div>}):<p className="note">{bi(lang,"لا يوجد استهلاك مخزون مسجل بعد.","No inventory-backed consumption yet.")}</p>}</section>
 <section className="card panel full-span"><h3>{bi(lang,"اتجاه القياسات","Measured trends")}</h3>{[["KH",stats.kh],["Ca",stats.ca],["Mg",stats.mg],["NO3",stats.no3],["PO4",stats.po4]].filter(([,v])=>v!==null).map(([k,v])=><div className="mini-row" key={String(k)}><b>{k}</b><span>{Number(v).toFixed(3)} / day • {bi(lang,"اتجاه مرصود، ليس استهلاكاً مثبتاً","observed drift, not proven consumption")}</span></div>)}</section>
 <section className="card panel full-span"><h3>{bi(lang,"توقع نفاد المخزون","Stock runway")}</h3>{stats.remaining.filter(x=>x.daysLeft!==null).map(x=><div className="mini-row" key={x.name+x.unit}><b>{x.name}</b><span>≈ {Math.round(x.daysLeft!)} {bi(lang,"يوم","days")}</span></div>)}</section>
 <section className="card panel full-span"><div className="inline-alert info"><b>{bi(lang,"ربط عقل الحوض","Tank Brain correlation")}</b><p>{correlation}</p></div></section></section>;
}