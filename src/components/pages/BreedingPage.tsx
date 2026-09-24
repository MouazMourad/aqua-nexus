"use client";
import {useMemo,useState} from "react";
import type {Tank} from "@/domain/types";
import {useAquaStore} from "@/store/useAquaStore";
import {PageHeader} from "@/components/ui/PageHeader";
import {bi} from "@/i18n";
import {uid,nowISO} from "@/lib/appUtils";

type Method="breeding"|"frag"|"cutting"|"division"|"runner";
export function BreedingPage({tank}:{tank:Tank}){
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const eligible=tank.livestock.filter(x=>x.category==="fish"||x.category==="coral"||x.category==="plant");
 const [parentId,setParentId]=useState(eligible[0]?.id??""),[method,setMethod]=useState<Method>("breeding"),[name,setName]=useState(""),[qty,setQty]=useState(1),[note,setNote]=useState("");
 const parent=tank.livestock.find(x=>x.id===parentId);
 const offspring=useMemo(()=>tank.livestock.filter(x=>x.parentLivestockId),[tank.livestock]);
 const allowed:Method[]=parent?.category==="coral"?["frag"]:parent?.category==="plant"?["cutting","division","runner"]:["breeding"];
 const selectedMethod=allowed.includes(method)?method:allowed[0]??"breeding";
 const add=()=>{if(!parent)return;const ts=nowISO(),id=uid("livestock"),childName=name.trim()||`${parent.name} • ${selectedMethod}`;patch(tank.id,t=>({...t,
   livestock:[...t.livestock,{...parent,id,name:childName,nameEn:parent.nameEn,quantity:Math.max(1,qty),health:"watch",addedAt:ts,parentLivestockId:parent.id,propagationMethod:selectedMethod,lifeEvents:[{id:uid("life"),timestamp:ts,type:selectedMethod,note:note||undefined}]}],
   timeline:[{id:uid("ev"),timestamp:ts,type:"propagation",textAr:`التكاثر • تم بدء ${selectedMethod} من ${parent.name} ومتابعته ككائن مستقل حتى الاستقرار.`,textEn:`Propagation • ${selectedMethod} started from ${parent.nameEn||parent.name} and is now tracked independently until stable.`},...t.timeline]
  }));setName("");setNote("")};
 return <section className="page-grid"><PageHeader eyebrow="PROPAGATION & BREEDING" title={bi(lang,"التكاثر","Propagation & Breeding")}/>
 <section className="card panel full-span"><h3>{bi(lang,"من الأصل إلى كائن مستقر","From parent to stable organism")}</h3><p className="note">{bi(lang,"السمك يتابع التكاثر والنسل، المرجان يتابع الـFrag، والنبات يتابع القص والتقسيم والمدادات. الناتج يبقى مربوطاً بالأصل وتراقب صحته ونموه ضمن نفس عقل الحوض.","Fish track breeding and offspring, coral tracks frags, and plants track cuttings, division and runners. Every result stays linked to its parent and its growth and health remain visible to Tank Brain.")}</p>
 <div className="form-grid"><label className="field"><span>{bi(lang,"الكائن الأصل","Parent organism")}</span><select value={parentId} onChange={e=>{setParentId(e.target.value);setMethod("breeding")}}>{eligible.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)} • {x.category}</option>)}</select></label>
 <label className="field"><span>{bi(lang,"طريقة التكاثر","Method")}</span><select value={selectedMethod} onChange={e=>setMethod(e.target.value as Method)}>{allowed.map(x=><option key={x} value={x}>{x==="breeding"?bi(lang,"تكاثر/نسل","Breeding / offspring"):x==="frag"?"Frag":x==="cutting"?bi(lang,"قص/عقلة","Cutting"):x==="division"?bi(lang,"تقسيم","Division"):bi(lang,"مدادة Runner","Runner")}</option>)}</select></label>
 <label className="field"><span>{bi(lang,"اسم الناتج (اختياري)","Result name (optional)")}</span><input value={name} onChange={e=>setName(e.target.value)}/></label><label className="field"><span>{bi(lang,"العدد","Quantity")}</span><input type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,Number(e.target.value)||1))}/></label><label className="field full-field"><span>{bi(lang,"ملاحظات البداية","Starting notes")}</span><input value={note} onChange={e=>setNote(e.target.value)}/></label></div>
 <button className="btn primary" disabled={!parent} onClick={add}>{bi(lang,"ابدأ المتابعة","Start tracking")}</button></section>
 <section className="card panel full-span"><h3>{bi(lang,"تحت المتابعة","Under follow-up")}</h3>{offspring.length?offspring.map(x=><div className="mini-row" key={x.id}><span><b>{lang==="ar"?x.name:(x.nameEn||x.name)}</b> • {x.propagationMethod} • {bi(lang,"من","from")} {tank.livestock.find(p=>p.id===x.parentLivestockId)?.name??"—"}</span><b>{x.health==="good"?bi(lang,"مستقر","Stable"):bi(lang,"تحت المراقبة","Monitoring")}</b></div>):<p className="note">{bi(lang,"لا توجد عمليات تكاثر قيد المتابعة بعد.","No propagation is being tracked yet.")}</p>}</section></section>;
}
