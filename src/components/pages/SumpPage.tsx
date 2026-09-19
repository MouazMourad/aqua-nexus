"use client";
import { useMemo,useState } from "react";
import type { FilterMediaItem,SumpChamber,Tank } from "@/domain/types";
import { AquariumScene } from "@/components/three/AquariumScene";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { today,uid,nowISO } from "@/lib/appUtils";
import { predictMediaLife } from "@/domain/mediaPredictor";
import { sumpIntelligence } from "@/domain/sumpIntelligence";

function makeChambers(count:number,L:number,W:number,H:number,fill:number,old:SumpChamber[]) {
 const each=L/Math.max(1,count);
 return Array.from({length:count},(_,i)=>old[i]??{id:uid("ch"),name:`حجرة ${i+1}`,nameEn:`Chamber ${i+1}`,x:i*each,y:0,length:each,width:W,height:H,waterHeight:H*fill/100,media:[]});
}
export function SumpPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[edit,setEdit]=useState<string|null>(null),c=tank.sump.chambers.find(x=>x.id===edit);
 const [draft,setDraft]=useState<any>(null);
 const [mediaOpen,setMediaOpen]=useState(false),[mediaName,setMediaName]=useState(""),[mediaKind,setMediaKind]=useState<FilterMediaItem["kind"]>("gfo"),[mediaAmount,setMediaAmount]=useState(100),[mediaLife,setMediaLife]=useState(30),[mediaChamber,setMediaChamber]=useState(tank.sump.chambers[0]?.id??"");
 const mediaPredictions=useMemo(()=>(tank.filterMedia??[]).map(item=>({item,p:predictMediaLife(tank,item)})),[tank]);
 const sumpAudit=useMemo(()=>sumpIntelligence(tank),[tank]);
 const setEnabled=(enabled:boolean)=>patch(tank.id,t=>({...t,sump:{...t.sump,enabled,chambers:enabled?(t.sump.chambers.length?t.sump.chambers:makeChambers(3,t.sump.dimensions.length,t.sump.dimensions.width,t.sump.dimensions.height,t.sump.operatingFillPercent,[])):[]}}));
 const config=(field:string,value:number)=>patch(tank.id,t=>({...t,sump:{...t.sump,dimensions:{...t.sump.dimensions,[field]:value}}}));
 const count=(n:number)=>patch(tank.id,t=>({...t,sump:{...t.sump,chambers:makeChambers(n,t.sump.dimensions.length,t.sump.dimensions.width,t.sump.dimensions.height,t.sump.operatingFillPercent,t.sump.chambers)}}));
 const open=(ch:SumpChamber)=>{setEdit(ch.id);setDraft({...ch})};
 const save=()=>{if(!edit||!draft)return;patch(tank.id,t=>({...t,sump:{...t.sump,chambers:t.sump.chambers.map(x=>x.id===edit?draft:x)}}));setEdit(null)};

 function addMedia(){
  const item:FilterMediaItem={id:uid("media"),name:mediaName.trim()||({gfo:"GFO",activatedCarbon:"Activated Carbon",other:"Filter Media"} as const)[mediaKind],kind:mediaKind,amountGrams:Math.max(1,mediaAmount),installedAt:today(),referenceLifeDays:Math.max(1,mediaLife),chamberId:mediaChamber||undefined};
  const ts=nowISO();
  patch(tank.id,t=>({...t,filterMedia:[item,...(t.filterMedia??[])],timeline:[{id:uid("ev"),timestamp:ts,type:"filter-media",textAr:`تم تركيب ميديا فلترة ${item.name} بكمية ${item.amountGrams} g.`,textEn:`Filter media ${item.name} installed (${item.amountGrams} g).`},...t.timeline]}));
  setMediaOpen(false);setMediaName("");
 }
 function replaceMedia(id:string){
  const item=(tank.filterMedia??[]).find(x=>x.id===id); if(!item)return;
  const ts=nowISO();
  patch(tank.id,t=>({...t,filterMedia:(t.filterMedia??[]).map(x=>x.id===id?{...x,installedAt:today()}:x),timeline:[{id:uid("ev"),timestamp:ts,type:"filter-media",textAr:`تم استبدال ميديا ${item.name}.`,textEn:`Filter media ${item.name} replaced.`},...t.timeline]}));
 }
 function removeMedia(id:string){patch(tank.id,t=>({...t,filterMedia:(t.filterMedia??[]).filter(x=>x.id!==id)}));}

 return <section className="page-grid"><PageHeader eyebrow="SUMP DIGITAL TWIN" title={tr(lang,"sump")}/>
 <div className="card panel"><div className="choice-row"><button className={`btn ${tank.sump.enabled?"primary":""}`} onClick={()=>setEnabled(true)}>{bi(lang,"يوجد سامب","Sump installed")}</button><button className={`btn ${!tank.sump.enabled?"primary":""}`} onClick={()=>setEnabled(false)}>{bi(lang,"بدون سامب","No sump")}</button></div>{tank.sump.enabled&&<div className="form-grid compact-fields"><label className="field"><span>L cm</span><input type="number" value={tank.sump.dimensions.length} onChange={e=>config("length",Number(e.target.value))}/></label><label className="field"><span>W cm</span><input type="number" value={tank.sump.dimensions.width} onChange={e=>config("width",Number(e.target.value))}/></label><label className="field"><span>H cm</span><input type="number" value={tank.sump.dimensions.height} onChange={e=>config("height",Number(e.target.value))}/></label><label className="field"><span>Fill %</span><input type="number" value={tank.sump.operatingFillPercent} onChange={e=>patch(tank.id,t=>({...t,sump:{...t.sump,operatingFillPercent:Number(e.target.value)}}))}/></label><label className="field"><span>{tr(lang,"chamberDesigner")}</span><input type="number" min="1" max="12" value={tank.sump.chambers.length} onChange={e=>count(Number(e.target.value))}/></label></div>}</div>
 <div className="card scene-card sump-scene-card"><AquariumScene tank={tank}/></div>
 {tank.sump.enabled&&<section className="card panel full-span"><div className="module-head"><div><small className="eyebrow-mini">SUMP SAFETY AUDIT</small><h3>{bi(lang,"سلامة السامب والحجم الاحتياطي","Sump safety & reserve volume")}</h3></div><span className={`status ${sumpAudit.issues.length?"warn":""}`}>{sumpAudit.issues.length?bi(lang,"يحتاج مراجعة","Review"):bi(lang,"جيد","Good")}</span></div><div className="summary-strip"><div className="summary"><small>{bi(lang,"الحجم الكلي","Gross")}</small><b>{sumpAudit.gross.toFixed(1)} L</b></div><div className="summary"><small>{bi(lang,"تشغيل تقريبي","Operating")}</small><b>{sumpAudit.operating.toFixed(1)} L</b></div><div className="summary"><small>Freeboard</small><b>{sumpAudit.freeboard.toFixed(1)} L</b></div><div className="summary"><small>{bi(lang,"رجوع متوقع عند فصل الكهرباء","Estimated drain-back")}</small><b>{sumpAudit.drainbackEstimate.toFixed(1)} L</b></div><div className="summary"><small>{bi(lang,"هامش الأمان","Safety margin")}</small><b>{sumpAudit.safetyMargin.toFixed(1)} L</b></div></div>{sumpAudit.issues.map((x,i)=><div className="inline-alert warn" key={i}>{x}</div>)}</section>}
 {tank.sump.enabled&&<div className="chamber-grid full-span">{tank.sump.chambers.map((x,i)=><button type="button" className="chamber-card clickable" key={x.id} onClick={()=>open(x)}><span className="chamber-number">{i+1}</span><h3>{lang==="ar"?x.name:(x.nameEn||x.name)}</h3><div className="chamber-stats"><span><small>Geometry</small><b>{x.length}×{x.width}×{x.height}</b></span><span><small>Water</small><b>{x.waterHeight} cm • {(x.length*x.width*Math.min(x.waterHeight,x.height)/1000).toFixed(1)} L</b></span><span><small>X/Y</small><b>{x.x}/{x.y}</b></span></div></button>)}</div>}

 <section className="card panel full-span">
  <div className="module-head"><div><h3>{bi(lang,"متنبئ عمر ميديا الفلترة","Filter Media Life Predictor")}</h3><p className="note">{bi(lang,"تقدير ديناميكي يعتمد على حجم النظام، كمية الميديا، عمرها وقراءات PO4 عند GFO. يبقى تقديراً وليس قياس تشبع مباشر.","Dynamic estimate using system volume, media amount, age and PO4 data for GFO. It is an estimate, not a direct saturation measurement.")}</p></div><button className="btn primary" onClick={()=>setMediaOpen(true)}>+ {bi(lang,"إضافة ميديا","Add media")}</button></div>
  {!mediaPredictions.length&&<div className="inline-alert info">{bi(lang,"لم تتم إضافة ميديا قابلة للمتابعة بعد.","No tracked filter media yet.")}</div>}
  <div className="equipment-grid">{mediaPredictions.map(({item,p})=>{
    const chamber=tank.sump.chambers.find(c=>c.id===item.chamberId);
    const cls=p.state==="replace"?"warn":p.state==="watch"?"warn":"good";
    return <article className="equipment-card" key={item.id}><div className="equipment-card-head"><span className="eq-big-icon">◈</span><span className={`status ${cls}`}>{p.state}</span></div><h3>{item.name}</h3><small>{item.amountGrams} g • {lang==="ar"?chamber?.name:(chamber?.nameEn||chamber?.name)||bi(lang,"غير محدد","Unassigned")}</small><div className="equipment-meta"><span><b>{bi(lang,"العمر الحالي","Age")}</b>{p.ageDays} d</span><span><b>{bi(lang,"العمر المتوقع","Estimated life")}</b>{p.estimatedLifeDays} d</span><span><b>{bi(lang,"المتبقي","Remaining")}</b>{p.remainingDays>0?`${p.remainingDays} d`:bi(lang,"استبدال الآن","Replace now")}</span><span><b>{bi(lang,"الثقة","Confidence")}</b>{p.confidence}</span></div><p className="note">{lang==="ar"?p.reasonAr:p.reasonEn}</p><div className="modal-actions"><button className="btn primary" onClick={()=>replaceMedia(item.id)}>{bi(lang,"تم الاستبدال اليوم","Replaced today")}</button><button className="btn danger" onClick={()=>removeMedia(item.id)}>×</button></div></article>
  })}</div>
 </section>

 <Modal open={!!c&&!!draft} title={tr(lang,"chamberDesigner")} onClose={()=>setEdit(null)}>{draft&&<div className="form-grid"><label className="field"><span>العربية</span><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="field"><span>English</span><input value={draft.nameEn??""} onChange={e=>setDraft({...draft,nameEn:e.target.value})}/></label>{["x","y","length","width","height","waterHeight"].map(k=><label className="field" key={k}><span>{k}</span><input type="number" step=".1" value={draft[k]} onChange={e=>setDraft({...draft,[k]:Number(e.target.value)})}/></label>)}</div>}<div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={save}>{tr(lang,"save")}</button></div></Modal>

 <Modal open={mediaOpen} title={bi(lang,"إضافة ميديا فلترة","Add filter media")} onClose={()=>setMediaOpen(false)}><div className="form-grid"><label className="field"><span>{tr(lang,"name")}</span><input value={mediaName} onChange={e=>setMediaName(e.target.value)} placeholder={mediaKind==="gfo"?"GFO":mediaKind==="activatedCarbon"?"Activated Carbon":"Media"}/></label><label className="field"><span>{tr(lang,"type")}</span><select value={mediaKind} onChange={e=>setMediaKind(e.target.value as FilterMediaItem["kind"])}><option value="gfo">GFO / phosphate media</option><option value="activatedCarbon">Activated Carbon</option><option value="other">Other</option></select></label><label className="field"><span>{bi(lang,"الكمية g","Amount g")}</span><input type="number" min="1" value={mediaAmount} onChange={e=>setMediaAmount(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"العمر المرجعي بالأيام","Reference life days")}</span><input type="number" min="1" value={mediaLife} onChange={e=>setMediaLife(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"الحجرة","Chamber")}</span><select value={mediaChamber} onChange={e=>setMediaChamber(e.target.value)}><option value="">—</option>{tank.sump.chambers.map(ch=><option value={ch.id} key={ch.id}>{lang==="ar"?ch.name:(ch.nameEn||ch.name)}</option>)}</select></label></div><div className="inline-alert info">{bi(lang,"لـ GFO سيعدل Aqua Nexus العمر المتوقع حسب PO4 واتجاه القراءات. للكربون النشط يبقى التقدير محافظاً لأنه لا يوجد قياس تشبع مباشر ضمن بيانات الحوض.","For GFO, Aqua Nexus adjusts estimated life using PO4 and its trend. Activated carbon remains a conservative estimate because there is no direct saturation measurement in tank data.")}</div><div className="modal-actions"><button className="btn" onClick={()=>setMediaOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={addMedia}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
