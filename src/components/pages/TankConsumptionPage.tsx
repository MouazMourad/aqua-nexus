"use client";
import {useMemo} from "react";
import type {Tank} from "@/domain/types";
import {useAquaStore} from "@/store/useAquaStore";
import {PageHeader} from "@/components/ui/PageHeader";
import {bi} from "@/i18n";

const DAY=86400000;
export function TankConsumptionPage({tank}:{tank:Tank}){
 const lang=useAquaStore(s=>s.language),now=Date.now();
 const days=(ts:string)=>Math.max(1,(now-new Date(ts).getTime())/DAY);
 const stats=useMemo(()=>{
  const dosing=tank.dosing.filter(x=>days(x.timestamp)<=30);
  const feeding=tank.feeding.filter(x=>days(x.timestamp)<=30);
  const doseMl=dosing.reduce((s,x)=>s+Math.max(0,Number(x.ml||x.amount||0)),0);
  const feedStock=feeding.reduce((s,x)=>s+Math.max(0,Number(x.inventoryQuantityUsed||0)),0);
  const byParam=new Map<string,number>();for(const x of dosing)byParam.set(x.parameter,(byParam.get(x.parameter)||0)+Math.max(0,Number(x.ml||x.amount||0)));
  const kh=tank.chemistry.map(x=>({ts:x.timestamp,v:Number(x.values.KH)})).filter(x=>Number.isFinite(x.v)).slice(0,8);
  let khDaily:null|number=null;if(kh.length>=2){const newest=kh[0],oldest=kh[kh.length-1],d=Math.max(1,(new Date(newest.ts).getTime()-new Date(oldest.ts).getTime())/DAY);khDaily=(oldest.v-newest.v)/d;}
  return{doseMl,feedStock,feedingCount:feeding.length,byParam:[...byParam.entries()],khDaily};
 },[tank,now]);
 return <section className="page-grid"><PageHeader eyebrow="TANK CONSUMPTION" title={bi(lang,"استهلاك الحوض","Tank Consumption")}/>
 <section className="card panel full-span"><div className="module-head"><div><h3>{bi(lang,"ميزانية الحوض الحية","The aquarium's living budget")}</h3><p className="note">{bi(lang,"هذه الصفحة لا تفترض استهلاكاً غير مقاس. تجمع الجرعات والتغذية والمخزون والاتجاهات الفعلية، ليستخدمها عقل الحوض والذكاء في فهم تغير الاحتياج مع الوقت.","This page never invents unmeasured consumption. It combines actual dosing, feeding, inventory usage and measured trends so Tank Brain can learn changing demand.")}</p></div></div>
 <div className="feeding-first-look"><div><small>{bi(lang,"جرعات 30 يوم","30d dosing")}</small><b>{stats.doseMl.toFixed(1)} mL</b><span>{(stats.doseMl/30).toFixed(1)} mL/day</span></div><div><small>{bi(lang,"تغذية 30 يوم","30d feeding")}</small><b>{stats.feedingCount}</b><span>{stats.feedStock.toFixed(1)} {bi(lang,"وحدة مخزون مستخدمة","stock units used")}</span></div><div><small>KH</small><b>{stats.khDaily===null?"—":Math.abs(stats.khDaily).toFixed(2)}</b><span>{bi(lang,"تغير/يوم من القياسات المسجلة","change/day from logged measurements")}</span></div></div></section>
 <section className="card panel full-span"><h3>{bi(lang,"الاستهلاك حسب المادة","Consumption by material")}</h3>{stats.byParam.length?stats.byParam.map(([p,v])=><div className="mini-row" key={p}><b>{p}</b><span>{v.toFixed(1)} mL / 30d • {(v/30).toFixed(2)} mL/day</span></div>):<p className="note">{bi(lang,"لا توجد جرعات كافية بعد. الصفحة ستتعلم تلقائياً من الاستخدام الحقيقي.","No dosing history yet. This module learns automatically from real usage.")}</p>}</section>
 <section className="card panel full-span"><div className="inline-alert info">{tank.type==="marine"?bi(lang,"البحري: يركز التحليل على استهلاك KH/Ca/Mg والجرعات والتغذية وربطها بالنمو والكيميا.","Marine: analysis focuses on KH/Ca/Mg demand, dosing and feeding in relation to growth and chemistry."):bi(lang,"النهري: يركز التحليل على التسميد وCO₂ والتغذية ونمو النباتات وربطها بالكيميا.","Freshwater: analysis focuses on fertilizer, CO₂, feeding and plant growth in relation to chemistry.")}</div></section></section>
}