"use client";
import { useMemo,useState } from "react";
import type { LivestockItem,Tank } from "@/domain/types";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { bioload } from "@/domain/health";
import { compatibilityCheck } from "@/domain/compatibility";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,categoryText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { uid,today,nowISO } from "@/lib/appUtils";

export function LivestockPage({tank,onLibrary}:{tank:Tank;onLibrary:()=>void}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[category,setCategory]=useState<LivestockItem["category"]>("fish"),[selected,setSelected]=useState(""),[custom,setCustom]=useState(""),[qty,setQty]=useState(1),[riskConfirmed,setRiskConfirmed]=useState(false);
 const b=bioload(tank);
 const library:any[]=LIVESTOCK_LIBRARY.filter((x:any)=>x.type===tank.type);
 const list=useMemo(()=>library.filter((x:any)=>{
   const c=String(x.cat).toLowerCase();
   const mapped=c==="fish"?"fish":c==="coral"?"coral":c==="invert"?"invert":c==="plant"?"plant":"other";
   return mapped===category;
 }),[category,tank.type]);
 const chosen:any=list.find(x=>x.id===selected);
 const check=selected && selected!=="__other__" && chosen ? compatibilityCheck(tank,chosen,qty) : null;

 function reset(){setSelected("");setCustom("");setQty(1);setRiskConfirmed(false)}
 function close(){setOpen(false);reset()}
 function add(){
  if(check?.blocked)return;
  if(check?.requiresConfirmation && !riskConfirmed)return;
  const name=selected==="__other__"?(custom||tr(lang,"otherEntry")):(chosen?.ar||custom);
  const nameEn=selected==="__other__"?(custom||"Other"):(chosen?.en||custom);
  const item:LivestockItem={id:uid("live"),libraryId:chosen?.id,name,nameEn,category,quantity:qty,health:"good",load:chosen?.load??1,addedAt:today()};
  patch(tank.id,t=>({...t,livestock:[...t.livestock,item],timeline:[{id:uid("ev"),timestamp:nowISO(),type:"livestock",textAr:`تمت إضافة ${qty} × ${name}.`,textEn:`Added ${qty} × ${nameEn}.`},...t.timeline]}));
  close();
 }
 const remove=(id:string)=>patch(tank.id,t=>({...t,livestock:t.livestock.filter(x=>x.id!==id)}));

 return <section className="page-grid">
  <PageHeader eyebrow="LIVESTOCK" title={tr(lang,"livestock")} actions={<><button className="btn" onClick={onLibrary}>{tr(lang,"library")}</button><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addLivestock")}</button></>}/>

  <div className="card panel">
   <h3>{tr(lang,"bioload")}</h3>
   <b className="big-number">{Math.round(b.ratio*100)}%</b>
   <span className={`status ${b.status==="high"||b.status==="danger"?"warn":""}`}>{tr(lang,b.status)}</span>
  </div>

  <div className="card panel full-span">
   <div className="table-wrap"><table><thead><tr><th>{tr(lang,"name")}</th><th>{tr(lang,"category")}</th><th>{tr(lang,"quantity")}</th><th>{tr(lang,"load")}</th><th></th></tr></thead>
   <tbody>{tank.livestock.map(x=><tr key={x.id}><td>{lang==="ar"?x.name:(x.nameEn||x.name)}</td><td>{categoryText(lang,x.category)}</td><td>{x.quantity}</td><td>{((x.load??1)*x.quantity).toFixed(1)}</td><td><button className="btn danger" onClick={()=>remove(x.id)}>×</button></td></tr>)}</tbody></table></div>
  </div>

  <Modal open={open} title={tr(lang,"addLivestock")} onClose={close}>
   <div className="form-grid">
    <label className="field"><span>{tr(lang,"category")}</span><select value={category} onChange={e=>{setCategory(e.target.value as LivestockItem["category"]);setSelected("");setRiskConfirmed(false)}}><option value="fish">{tr(lang,"fish")}</option><option value="coral">{tr(lang,"coral")}</option><option value="invert">{tr(lang,"invert")}</option><option value="plant">{tr(lang,"plant")}</option><option value="other">{tr(lang,"other")}</option></select></label>
    <label className="field"><span>{tr(lang,"selectOrganism")}</span><select value={selected} onChange={e=>{setSelected(e.target.value);setRiskConfirmed(false)}}><option value="">—</option>{list.map((x:any)=><option value={x.id} key={x.id}>{lang==="ar"?x.ar:x.en}</option>)}<option value="__other__">{tr(lang,"otherEntry")}</option></select></label>
    {selected==="__other__"&&<label className="field full-field"><span>{tr(lang,"name")}</span><input value={custom} onChange={e=>setCustom(e.target.value)}/></label>}
    <label className="field"><span>{tr(lang,"quantity")}</span><input type="number" min="1" value={qty} onChange={e=>{setQty(Number(e.target.value));setRiskConfirmed(false)}}/></label>
   </div>

   {check&&<div className={`compatibility-panel ${check.level}`}>
    <div className="compat-head">
      <h3>{tr(lang,"compatibilityReport")}</h3>
      <span className={`compat-badge ${check.level}`}>{tr(lang,check.level==="good"?"compatible":check.level==="warn"?"caution":"incompatible")}</span>
    </div>
    <div className="bioload-comparison">
      <div><small>{tr(lang,"currentBioload")}</small><b>{Math.round(check.currentRatio*100)}%</b></div>
      <div className="arrow">→</div>
      <div><small>{tr(lang,"projectedBioload")}</small><b className={`bio-${check.projectedStatus}`}>{Math.round(check.projectedRatio*100)}%</b></div>
    </div>
    {check.issues.length ? <div className="compat-issues">{check.issues.map((issue,i)=><div key={i} className={`inline-alert ${issue.level}`}>{lang==="ar"?issue.ar:issue.en}</div>)}</div> : <div className="inline-alert good">{tr(lang,"noConflict")}</div>}
    {check.blocked&&<div className="inline-alert danger"><b>{lang==="ar"?"لن يسمح Aqua Nexus بإضافة هذا الكائن لأن التعارض مصنف خطراً.":"Aqua Nexus will not add this organism because the detected incompatibility is classified as dangerous."}</b></div>}
    {check.requiresConfirmation&&!check.blocked&&<label className="risk-confirm"><input type="checkbox" checked={riskConfirmed} onChange={e=>setRiskConfirmed(e.target.checked)}/><span>{tr(lang,"confirmRisk")}</span></label>}
   </div>}

   {selected==="__other__"&&<div className="inline-alert warn">{lang==="ar"?"الإدخال اليدوي لا يمكن فحص توافقه تلقائياً قبل إضافته. استخدم المكتبة كلما كان النوع موجوداً فيها.":"Manual entries cannot be automatically compatibility-checked before adding. Use the library whenever the species is available."}</div>}

   <div className="modal-actions"><button className="btn" onClick={close}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add} disabled={!selected || !!check?.blocked || (!!check?.requiresConfirmation&&!riskConfirmed)}>{check?.blocked?(lang==="ar"?"غير مناسب للحوض":"Not suitable") : tr(lang,"save")}</button></div>
  </Modal>
 </section>;
}
