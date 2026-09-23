"use client";
import { useMemo,useRef,useState } from "react";
import type { FilterMediaItem,SumpChamber,Tank } from "@/domain/types";
import { AquariumScene } from "@/components/three/AquariumScene";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdvancedSection } from "@/components/ui/AdvancedSection";
import { ContextHint } from "@/components/ui/ContextHint";
import { today,uid,nowISO } from "@/lib/appUtils";
import { predictMediaLife } from "@/domain/mediaPredictor";
import { sumpIntelligence } from "@/domain/sumpIntelligence";
import { inventoryForConsumer,inventoryProfile } from "@/domain/inventoryIntelligence";
import { consumeInventory,inventoryConsumptionMessage } from "@/domain/inventoryConsumption";
import { fitChamberToSump,sumpChamberContents } from "@/domain/sumpOperations";
import { sanitizeNonNegative,sanitizeSumpDimension,sanitizeSumpFill,validateFilterMediaEntry } from "@/domain/inputSanity";

function cleanNumber(value:number,digits=1){return Number(Number(value||0).toFixed(digits));}
function mediaLabel(lang:"ar"|"en",value:string){
 const ar:any={biological:"بيولوجية",chemical:"كيميائية",refugium:"ريفيوجيوم",turf:"Turf algae"};
 const en:any={biological:"Biological",chemical:"Chemical",refugium:"Refugium",turf:"Turf algae"};
 return (lang==="ar"?ar:en)[value]||value;
}
function makeChambers(count:number,L:number,W:number,H:number,fill:number,old:SumpChamber[]) {
 const each=L/Math.max(1,count);
 return Array.from({length:count},(_,i)=>old[i]??{id:uid("ch"),name:`حجرة ${i+1}`,nameEn:`Chamber ${i+1}`,x:i*each,y:0,length:each,width:W,height:H,waterHeight:H*fill/100,media:[]});
}
export function SumpPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[edit,setEdit]=useState<string|null>(null),c=tank.sump.chambers.find(x=>x.id===edit);
 const [draft,setDraft]=useState<any>(null);
 const [drag,setDrag]=useState<{id:string;mode:"move"|"resize";startX:number;startY:number;orig:SumpChamber;preview:SumpChamber}|null>(null);
 const dragRef=useRef<{id:string;mode:"move"|"resize";startX:number;startY:number;orig:SumpChamber;preview:SumpChamber}|null>(null);
 const [dimensionPolicy,setDimensionPolicy]=useState<"scale"|"keep">("scale");
 const [mediaOpen,setMediaOpen]=useState(false),[mediaName,setMediaName]=useState(""),[mediaKind,setMediaKind]=useState<FilterMediaItem["kind"]>("gfo"),[mediaAmount,setMediaAmount]=useState(100),[mediaLife,setMediaLife]=useState(30),[mediaChamber,setMediaChamber]=useState(tank.sump.chambers[0]?.id??""),[mediaInventoryId,setMediaInventoryId]=useState("");
 const mediaPredictions=useMemo(()=>(tank.filterMedia??[]).map(item=>({item,p:predictMediaLife(tank,item)})),[tank]);
 const filterMediaStock=useMemo(()=>inventoryForConsumer(tank,"sump").filter(i=>inventoryProfile(i).category==="filter_media"),[tank]);
 const sumpAudit=useMemo(()=>sumpIntelligence(tank),[tank]);
 const previewTank=useMemo<Tank>(()=>drag?{...tank,sump:{...tank.sump,chambers:tank.sump.chambers.map(ch=>ch.id===drag.id?drag.preview:ch)}}:tank,[tank,drag]);
 const setEnabled=(enabled:boolean)=>patch(tank.id,t=>({...t,sump:{...t.sump,enabled,chambers:enabled?(t.sump.chambers.length?t.sump.chambers:makeChambers(3,t.sump.dimensions.length,t.sump.dimensions.width,t.sump.dimensions.height,t.sump.operatingFillPercent,[])):[]}}));
 const config=(field:"length"|"width"|"height",value:number)=>patch(tank.id,t=>{
  const old=Number(t.sump.dimensions[field])||1,safe=sanitizeSumpDimension(value,old,field==="length"?2000:1000),ratio=safe/old;
  const dimensions={...t.sump.dimensions,[field]:safe};
  const transformed=dimensionPolicy==="scale"?t.sump.chambers.map(ch=>{
   if(field==="length")return {...ch,x:ch.x*ratio,length:ch.length*ratio};
   if(field==="width")return {...ch,y:ch.y*ratio,width:ch.width*ratio};
   return {...ch,height:ch.height*ratio,waterHeight:ch.waterHeight*ratio};
  }):t.sump.chambers;
  const chambers=transformed.map(ch=>fitChamberToSump(ch,dimensions));
  return {...t,sump:{...t.sump,dimensions,chambers}};
 });
 const count=(n:number)=>{const safe=Number.isFinite(n)?Math.max(1,Math.min(12,Math.round(n))):tank.sump.chambers.length||1;patch(tank.id,t=>({...t,sump:{...t.sump,chambers:makeChambers(safe,t.sump.dimensions.length,t.sump.dimensions.width,t.sump.dimensions.height,t.sump.operatingFillPercent,t.sump.chambers)}}))};
 const open=(ch:SumpChamber)=>{setEdit(ch.id);setDraft({...ch,equipmentIds:tank.equipment.filter(eq=>eq.location===`sump:${ch.id}`).map(eq=>eq.id)})};
 const save=()=>{if(!edit||!draft)return;patch(tank.id,t=>{
  const selectedIds=new Set<string>(draft.equipmentIds??[]);
  return {...t,
   sump:{...t.sump,chambers:t.sump.chambers.map(x=>x.id===edit?fitChamberToSump(draft,t.sump.dimensions):x)},
   equipment:t.equipment.map(eq=>{
    if(selectedIds.has(eq.id))return {...eq,location:`sump:${edit}` as const};
    if(eq.location===`sump:${edit}`)return {...eq,location:"external" as const};
    return eq;
   })
  };
 });setEdit(null)};
 const patchChamber=(id:string,p:Partial<SumpChamber>)=>patch(tank.id,t=>({...t,sump:{...t.sump,chambers:t.sump.chambers.map(ch=>ch.id===id?{...ch,...p}:ch)}}));
 const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
 const syncDrag=(next:{id:string;mode:"move"|"resize";startX:number;startY:number;orig:SumpChamber;preview:SumpChamber}|null)=>{dragRef.current=next;setDrag(next)};
 const beginDrag=(ev:any,ch:SumpChamber,mode:"move"|"resize")=>{ev.stopPropagation();syncDrag({id:ch.id,mode,startX:ev.clientX,startY:ev.clientY,orig:{...ch},preview:{...ch}});try{(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId)}catch{}};
 const moveDrag=(ev:any)=>{
  const current=dragRef.current;
  if(!current)return;
  const rect=(ev.currentTarget as HTMLElement).getBoundingClientRect();
  const dx=(ev.clientX-current.startX)/Math.max(1,rect.width)*tank.sump.dimensions.length;
  const dy=(ev.clientY-current.startY)/Math.max(1,rect.height)*tank.sump.dimensions.width;
  const preview=current.mode==="move"
   ?{...current.orig,x:clamp(current.orig.x+dx,0,Math.max(0,tank.sump.dimensions.length-current.orig.length)),y:clamp(current.orig.y+dy,0,Math.max(0,tank.sump.dimensions.width-current.orig.width))}
   :{...current.orig,length:clamp(current.orig.length+dx,5,Math.max(5,tank.sump.dimensions.length-current.orig.x)),width:clamp(current.orig.width+dy,5,Math.max(5,tank.sump.dimensions.width-current.orig.y))};
  syncDrag({...current,preview});
 };
 const endDrag=()=>{const current=dragRef.current;if(current)patchChamber(current.id,current.preview);syncDrag(null)};

 function addMedia(){
  const selected=mediaInventoryId?filterMediaStock.find(x=>x.id===mediaInventoryId):undefined;
  const mediaCheck=validateFilterMediaEntry({amountGrams:mediaAmount,referenceLifeDays:mediaLife});
  const mediaDanger=mediaCheck.issues.find(x=>x.level==="danger");
  if(mediaDanger){window.alert(lang==="ar"?mediaDanger.ar:mediaDanger.en);return}
  const amount=Math.max(1,mediaAmount);
  if(mediaInventoryId&&!selected){window.alert(bi(lang,"مادة الميديا المحددة لم تعد متاحة بالمخزون.","The selected filter media is no longer available in inventory."));return}
  if(selected&&selected.unit.toLowerCase()!=="g"){window.alert(bi(lang,"متنبئ الميديا الحالي يسجل الكمية بالغرام. اختر مخزون بوحدة g.","The media predictor currently tracks amount in grams. Select inventory measured in g."));return}
  const use=selected?consumeInventory(tank.inventory,[{inventoryItemId:selected.id,quantity:amount,expectedUnit:"g",role:"filter_media_install"}]):null;
  if(use&&!use.ok){window.alert(inventoryConsumptionMessage(use,lang));return}
  const item:FilterMediaItem={id:uid("media"),name:mediaName.trim()||(selected?(lang==="ar"?selected.name:(selected.nameEn||selected.name)):({gfo:"GFO",activatedCarbon:"Activated Carbon",other:"Filter Media"} as const)[mediaKind]),kind:mediaKind,amountGrams:amount,installedAt:today(),referenceLifeDays:Math.max(1,mediaLife),chamberId:mediaChamber||undefined,inventoryItemId:selected?.id,inventoryQuantityPerReplacement:selected?amount:undefined,inventoryUnit:selected?.unit};
  const ts=nowISO();
  patch(tank.id,t=>({...t,inventory:use?.ok?use.inventory:t.inventory,filterMedia:[item,...(t.filterMedia??[])],timeline:[{id:uid("ev"),timestamp:ts,type:"filter-media",textAr:`تم تركيب ميديا فلترة ${item.name} بكمية ${item.amountGrams} g${selected?` وخصمها من المخزون`:""}.`,textEn:`Filter media ${item.name} installed (${item.amountGrams} g)${selected?" and deducted from inventory":""}.`},...t.timeline]}));
  setMediaOpen(false);setMediaName("");setMediaInventoryId("");
 }
 function replaceMedia(id:string){
  const item=(tank.filterMedia??[]).find(x=>x.id===id); if(!item)return;
  const linked=item.inventoryItemId?tank.inventory.find(x=>x.id===item.inventoryItemId):undefined;
  if(item.inventoryItemId&&!linked){window.alert(bi(lang,"مادة المخزون المرتبطة بهذه الميديا غير موجودة. حدّث الربط قبل تسجيل الاستبدال.","The inventory item linked to this media is missing. Update the link before logging replacement."));return}
  const q=item.inventoryQuantityPerReplacement??item.amountGrams;
  const use=linked?consumeInventory(tank.inventory,[{inventoryItemId:linked.id,quantity:q,expectedUnit:item.inventoryUnit||"g",role:"filter_media_replace"}]):null;
  if(use&&!use.ok){window.alert(inventoryConsumptionMessage(use,lang));return}
  const ts=nowISO();
  patch(tank.id,t=>({...t,inventory:use?.ok?use.inventory:t.inventory,filterMedia:(t.filterMedia??[]).map(x=>x.id===id?{...x,installedAt:today()}:x),timeline:[{id:uid("ev"),timestamp:ts,type:"filter-media",textAr:`تم استبدال ميديا ${item.name}${linked?` وخصم ${q} ${linked.unit} من المخزون`:""}.`,textEn:`Filter media ${item.name} replaced${linked?` and ${q} ${linked.unit} deducted from inventory`:""}.`},...t.timeline]}));
 }
 function removeMedia(id:string){patch(tank.id,t=>({...t,filterMedia:(t.filterMedia??[]).filter(x=>x.id!==id)}));}


 return <section className="page-grid sump-page"><PageHeader eyebrow="SUMP DIGITAL TWIN" title={tr(lang,"sump")}/>
 <div className="card panel"><div className="choice-row"><button className={`btn ${tank.sump.enabled?"primary":""}`} onClick={()=>setEnabled(true)}>{bi(lang,"يوجد سامب","Sump installed")}</button><button className={`btn ${!tank.sump.enabled?"primary":""}`} onClick={()=>setEnabled(false)}>{bi(lang,"بدون سامب","No sump")}</button></div>{tank.sump.enabled&&<div className="form-grid compact-fields"><label className="field"><span>{bi(lang,"عند تغيير أبعاد السامب","When sump dimensions change")}</span><select value={dimensionPolicy} onChange={e=>setDimensionPolicy(e.target.value as "scale"|"keep")}><option value="scale">{bi(lang,"كبّر/صغّر الحجرات بنفس النسبة","Scale chambers proportionally")}</option><option value="keep">{bi(lang,"حافظ على قياسات الحجرات كما هي","Keep exact chamber dimensions")}</option></select></label><label className="field"><span>L cm</span><input type="number" value={tank.sump.dimensions.length} onChange={e=>config("length",Number(e.target.value))}/></label><label className="field"><span>W cm</span><input type="number" value={tank.sump.dimensions.width} onChange={e=>config("width",Number(e.target.value))}/></label><label className="field"><span>H cm</span><input type="number" value={tank.sump.dimensions.height} onChange={e=>config("height",Number(e.target.value))}/></label><label className="field"><span>Fill %</span><input type="number" value={tank.sump.operatingFillPercent} onChange={e=>patch(tank.id,t=>({...t,sump:{...t.sump,operatingFillPercent:sanitizeSumpFill(Number(e.target.value),t.sump.operatingFillPercent)}}))}/></label><label className="field"><span>{tr(lang,"chamberDesigner")}</span><input type="number" min="1" max="12" value={tank.sump.chambers.length} onChange={e=>count(Number(e.target.value))}/></label></div>}</div>
 <div className="card scene-card sump-scene-card"><AquariumScene tank={previewTank}/></div>
 {tank.sump.enabled&&<section className="card panel full-span"><div className="module-head"><div><small className="eyebrow-mini">SUMP SAFETY AUDIT</small><h3>{bi(lang,"سلامة السامب والحجم الاحتياطي","Sump safety & reserve volume")}</h3></div><span className={`status ${sumpAudit.issues.length?"warn":""}`}>{sumpAudit.issues.length?bi(lang,"يحتاج مراجعة","Review"):bi(lang,"جيد","Good")}</span></div><div className="summary-strip"><div className="summary"><small>{bi(lang,"الحجم الكلي","Gross")}</small><b>{sumpAudit.gross.toFixed(1)} L</b></div><div className="summary"><small>{bi(lang,"تشغيل تقريبي","Operating")}</small><b>{sumpAudit.operating.toFixed(1)} L</b></div><div className="summary"><small>Freeboard</small><b>{sumpAudit.freeboard.toFixed(1)} L</b></div><div className="summary"><small>{sumpAudit.drainbackSource==="measured"?bi(lang,"رجوع مقاس عند فصل الكهرباء","Measured power-off drain-back"):bi(lang,"رجوع متوقع عند فصل الكهرباء","Estimated drain-back")}</small><b>{sumpAudit.drainbackEstimate.toFixed(1)} L</b></div><div className="summary"><small>{bi(lang,"هامش الأمان","Safety margin")}</small><b>{sumpAudit.safetyMargin.toFixed(1)} L</b></div></div><div className="form-grid" style={{marginTop:12}}><label className="field"><span>{bi(lang,"نتيجة اختبار فصل الكهرباء الفعلية L","Measured power-off drain-back L")}</span><input type="number" min="0" step=".1" value={tank.sump.measuredDrainbackLiters??""} placeholder={sumpAudit.estimatedDrainback.toFixed(1)} onChange={e=>{const raw=e.target.value;patch(tank.id,t=>({...t,sump:{...t.sump,measuredDrainbackLiters:raw===""?undefined:sanitizeNonNegative(Number(raw),t.sump.measuredDrainbackLiters??0,100000)}}))}}/></label><div className="inline-alert info">{bi(lang,"اعمل اختبار فصل كهرباء مراقَب مرة واحدة وسجّل كمية الماء التي رجعت فعلياً للسامب. بعدها Safety Margin يعتمد على القياس بدل التقدير.","Run one supervised power-off test and record the actual water that drains back. Safety Margin will then use the measurement instead of the estimate.")}</div></div>{sumpAudit.issues.map((x,i)=><div className="inline-alert warn" key={i}>{x}</div>)}</section>}
 {tank.sump.enabled&&<div className="full-span"><AdvancedSection titleAr="تحرير هندسة السامب" titleEn="Advanced sump geometry" summaryAr="المخطط باللمس والـFront View للضبط الهندسي؛ بطاقات الحجرات والمجسم يضلوا ظاهرين." summaryEn="Touch plan and front view for geometry editing; chamber cards and the 3D model remain visible."><div style={{paddingTop:10}}><ContextHint id="sump-geometry-edit" lang={lang} ar="بالاستخدام اليومي ما بتحتاج تغيّر X/Y أو شكل الحجرات. افتح هالقسم فقط عند تصميم السامب أو تعديل تقسيمه الحقيقي." en="Daily use does not require changing X/Y or chamber geometry. Open this only when designing or physically changing the sump layout."/><section className="card panel full-span"><div className="module-head"><div><small className="eyebrow-mini">GEOMETRY VIEWS</small><h3>{bi(lang,"مخطط السامب الحقيقي","Real sump geometry")}</h3></div></div><h4>{bi(lang,"Top view — تعديل باللمس","Top view — touch editing")}</h4><p className="note">{bi(lang,"اسحب الحجرة لتحريكها، واسحب المقبض من الزاوية لتغيير الطول والعرض. المخطط والمجسم يتحدثان كمعاينة أثناء السحب، ويحفظ Aqua Nexus التغيير مرة واحدة عند رفع إصبعك.","Drag a chamber to move it; drag the corner handle to resize it. The plan and 3D model preview the drag live, then Aqua Nexus commits the change once when you release.")}</p><div className="sump-touch-plan" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} style={{aspectRatio:`${Math.max(1,tank.sump.dimensions.length)}/${Math.max(1,tank.sump.dimensions.width)}`}}>{tank.sump.chambers.map((ch,i)=>{const view=drag?.id===ch.id?drag.preview:ch;return <div key={ch.id} className={`sump-touch-chamber ${drag?.id===ch.id?"dragging":""}`} onPointerDown={ev=>beginDrag(ev,ch,"move")} onDoubleClick={()=>open(view)} title={lang==="ar"?view.name:(view.nameEn||view.name)} style={{left:`${view.x/tank.sump.dimensions.length*100}%`,top:`${view.y/tank.sump.dimensions.width*100}%`,width:`${view.length/tank.sump.dimensions.length*100}%`,height:`${view.width/tank.sump.dimensions.width*100}%`}}><span>{i+1} • {lang==="ar"?view.name:(view.nameEn||view.name)}</span><small>{view.length.toFixed(0)}×{view.width.toFixed(0)} cm</small><button type="button" className="sump-resize-handle" aria-label="Resize chamber" onPointerDown={ev=>beginDrag(ev,ch,"resize")}>↘</button></div>})}</div><h4 style={{marginTop:14}}>{bi(lang,"Front / elevation","Front / elevation")}</h4><div style={{display:"flex",alignItems:"end",gap:3,height:190,borderBottom:"1px solid rgba(255,255,255,.15)",padding:"8px 0"}}>{tank.sump.chambers.slice().sort((a,b)=>a.x-b.x).map((ch,i)=><div key={ch.id} style={{position:"relative",height:`${Math.min(100,ch.height/tank.sump.dimensions.height*100)}%`,width:`${Math.max(5,ch.length/tank.sump.dimensions.length*100)}%`,border:"1px solid rgba(100,220,255,.45)",display:"flex",alignItems:"end"}}><div style={{height:`${Math.min(100,ch.waterHeight/ch.height*100)}%`,width:"100%",background:"rgba(60,180,220,.16)",padding:4,fontSize:10}}>{i+1} • {ch.waterHeight}cm</div></div>)}</div></section></div></AdvancedSection></div>}
 {tank.sump.enabled&&<div className="chamber-grid sump-chamber-grid full-span">{tank.sump.chambers.map((x,i)=>{
  const chamberVolume=x.length*x.width*Math.min(x.waterHeight,x.height)/1000;
  const liveContents=sumpChamberContents(tank,x);
  const contentParts=[...(x.media??[]).map(m=>mediaLabel(lang,m)),...liveContents.equipment,...liveContents.filterMedia,...liveContents.manual].filter(Boolean);
  return <button type="button" className="chamber-card clickable sump-chamber-card" key={x.id} onClick={()=>open(x)}><span className="chamber-number">{i+1}</span><h3>{lang==="ar"?x.name:(x.nameEn||x.name)}</h3><div className="chamber-stats"><span><small>{bi(lang,"الأبعاد","Geometry")}</small><b>{cleanNumber(x.length)} × {cleanNumber(x.width)} × {cleanNumber(x.height)} cm</b></span><span><small>{bi(lang,"ماء التشغيل","Operating water")}</small><b>{cleanNumber(x.waterHeight)} cm • {cleanNumber(chamberVolume)} L</b></span><span><small>{bi(lang,"الموقع","Position")}</small><b>X {cleanNumber(x.x)} • Y {cleanNumber(x.y)}</b></span><span><small>{bi(lang,"المحتويات","Contents")}</small><b>{contentParts.length?contentParts.join(" • "):bi(lang,"فارغة / غير محددة","Empty / not assigned")}</b></span></div>{x.notes&&<p className="chamber-note">{x.notes}</p>}</button>;
 })}</div>}

 <div className="full-span"><AdvancedSection titleAr="ميديا الفلترة وعمرها" titleEn="Filter media lifecycle" summaryAr="متابعة GFO والكربون والميديا اختيارية وتظهر عند الحاجة، بدون ما تزاحم مخطط السامب الأساسي." summaryEn="GFO, carbon and media lifecycle tracking is optional and stays out of the primary sump view."><div style={{paddingTop:10}}><section className="card panel full-span sump-media-section">
  <div className="module-head"><div><h3>{bi(lang,"متنبئ عمر ميديا الفلترة","Filter Media Life Predictor")}</h3><p className="note">{bi(lang,"تقدير ديناميكي يعتمد على حجم النظام، كمية الميديا، عمرها وقراءات PO4 عند GFO. يبقى تقديراً وليس قياس تشبع مباشر.","Dynamic estimate using system volume, media amount, age and PO4 data for GFO. It is an estimate, not a direct saturation measurement.")}</p></div><button className="btn primary" onClick={()=>setMediaOpen(true)}>+ {bi(lang,"إضافة ميديا","Add media")}</button></div>
  {!mediaPredictions.length&&<div className="inline-alert info">{bi(lang,"لم تتم إضافة ميديا قابلة للمتابعة بعد.","No tracked filter media yet.")}</div>}
  <div className="equipment-grid">{mediaPredictions.map(({item,p})=>{
    const chamber=tank.sump.chambers.find(c=>c.id===item.chamberId);
    const cls=p.state==="replace"?"warn":p.state==="watch"?"warn":"good";
    return <article className="equipment-card" key={item.id}><div className="equipment-card-head"><span className="eq-big-icon">◈</span><span className={`status ${cls}`}>{p.state}</span></div><h3>{item.name}</h3><small>{item.amountGrams} g • {lang==="ar"?chamber?.name:(chamber?.nameEn||chamber?.name)||bi(lang,"غير محدد","Unassigned")}</small><div className="equipment-meta"><span><b>{bi(lang,"العمر الحالي","Age")}</b>{p.ageDays} d</span><span><b>{bi(lang,"العمر المتوقع","Estimated life")}</b>{p.estimatedLifeDays} d</span><span><b>{bi(lang,"المتبقي","Remaining")}</b>{p.remainingDays>0?`${p.remainingDays} d`:bi(lang,"استبدال الآن","Replace now")}</span><span><b>{bi(lang,"الثقة","Confidence")}</b>{p.confidence}</span></div><p className="note">{lang==="ar"?p.reasonAr:p.reasonEn}</p><div className="modal-actions"><button className="btn primary" onClick={()=>replaceMedia(item.id)}>{bi(lang,"تم الاستبدال اليوم","Replaced today")}</button><button className="btn danger" onClick={()=>removeMedia(item.id)}>×</button></div></article>
  })}</div>
 </section></div></AdvancedSection></div>

 <Modal open={!!c&&!!draft} title={tr(lang,"chamberDesigner")} onClose={()=>setEdit(null)}>{draft&&<><div className="form-grid"><label className="field"><span>{bi(lang,"اسم الحجرة","Chamber name")}</span><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="field"><span>English</span><input value={draft.nameEn??""} onChange={e=>setDraft({...draft,nameEn:e.target.value})}/></label><label className="field"><span>{bi(lang,"الطول cm","Length cm")}</span><input type="number" step=".1" min="1" value={draft.length} onChange={e=>setDraft({...draft,length:Number(e.target.value)})}/></label><label className="field"><span>{bi(lang,"العرض cm","Width cm")}</span><input type="number" step=".1" min="1" value={draft.width} onChange={e=>setDraft({...draft,width:Number(e.target.value)})}/></label><label className="field"><span>{bi(lang,"الارتفاع cm","Height cm")}</span><input type="number" step=".1" min="1" value={draft.height} onChange={e=>setDraft({...draft,height:Number(e.target.value)})}/></label><label className="field"><span>{bi(lang,"ارتفاع الماء cm","Water height cm")}</span><input type="number" step=".1" min="0" value={draft.waterHeight} onChange={e=>setDraft({...draft,waterHeight:Number(e.target.value)})}/></label></div><div className="field full-field"><span>${bi(lang,"التجهيزات الموجودة في هذه الحجرة","Equipment in this chamber")}</span><div style={{display:"grid",gap:7,marginTop:7}}>{tank.equipment.length?tank.equipment.map(eq=>{const checked=(draft.equipmentIds??[]).includes(eq.id);const assigned=eq.location.startsWith("sump:")&&eq.location!==`sump:${edit}`;const other=assigned?tank.sump.chambers.find(ch=>eq.location===`sump:${ch.id}`):undefined;return <label key={eq.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",border:"1px solid rgba(255,255,255,.09)",borderRadius:10}}><input type="checkbox" checked={checked} onChange={e=>setDraft({...draft,equipmentIds:e.target.checked?[...(draft.equipmentIds??[]),eq.id]:(draft.equipmentIds??[]).filter((id:string)=>id!==eq.id)})}/><span><b>{eq.name}</b>{other&&<small style={{display:"block",opacity:.65}}>{bi(lang,`حالياً في ${other.name}`,`Currently in ${other.nameEn||other.name}`)}</small>}</span></label>}):<div className="inline-alert info">{bi(lang,"لا توجد تجهيزات مسجلة بالحوض بعد. أضفها من صفحة التجهيزات أولاً.","No equipment is registered yet. Add equipment from the Equipment page first.")}</div>}</div><p className="note">{bi(lang,"اختيار التجهيزة هنا يربط نفس التجهيزة المسجلة بالحوض بهذه الحجرة؛ ما بينشئ نسخة ثانية منها.","Selecting equipment here links the existing tank equipment to this chamber; it does not create a duplicate.")}</p></div><AdvancedSection titleAr="الإحداثيات الدقيقة" titleEn="Precise coordinates" summaryAr="استخدم X/Y فقط للضبط الهندسي؛ بالسلوك الطبيعي حرّك الحجرة باللمس." summaryEn="Use X/Y only for precise geometry; normally move chambers by touch."><div className="form-grid" style={{marginTop:10}}><label className="field"><span>X cm</span><input type="number" step=".1" value={draft.x} onChange={e=>setDraft({...draft,x:Number(e.target.value)})}/></label><label className="field"><span>Y cm</span><input type="number" step=".1" value={draft.y} onChange={e=>setDraft({...draft,y:Number(e.target.value)})}/></label></div><p className="note">{bi(lang,"بالاستخدام العادي ما بتحتاج X/Y؛ حرّك الحجرة باللمس من المخطط. استخدمها فقط للضبط الهندسي الدقيق.","Normally you do not need X/Y; move the chamber by touch in the plan. Use these only for precise geometry.")}</p></AdvancedSection></>}<div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={save}>{tr(lang,"save")}</button></div></Modal>

 <style jsx>{`
  .sump-touch-plan{position:relative;width:100%;min-height:180px;border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,rgba(45,186,220,.06),rgba(4,25,36,.3));touch-action:none;user-select:none}
  .sump-touch-chamber{position:absolute;border:1px solid rgba(100,220,255,.55);background:rgba(60,180,220,.11);display:grid;place-items:center;align-content:center;gap:3px;font-size:12px;cursor:grab;touch-action:none;min-width:34px;min-height:34px}
  .sump-touch-chamber.dragging{cursor:grabbing;border-color:rgba(122,238,230,.9);background:rgba(60,200,220,.18);box-shadow:0 0 18px rgba(60,200,220,.14)}
  .sump-touch-chamber small{font-size:9px;opacity:.65}.sump-resize-handle{position:absolute;right:2px;bottom:2px;width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(3,25,35,.85);color:inherit;cursor:nwse-resize;touch-action:none}
  .sump-advanced{margin-top:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.02)}.sump-advanced summary{cursor:pointer;font-weight:800}
  .sump-chamber-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;min-width:0}
  .sump-chamber-card{min-width:0;overflow:hidden;text-align:start}
  .sump-chamber-card h3{margin-inline-end:44px}
  .sump-chamber-card .chamber-stats{min-width:0}
  .sump-chamber-card .chamber-stats span{min-width:0}
  .sump-chamber-card .chamber-stats b{display:block;min-width:0;overflow-wrap:anywhere;word-break:break-word;font-variant-numeric:tabular-nums}
  .chamber-note{margin:10px 0 0;font-size:11px;opacity:.7;white-space:normal;overflow-wrap:anywhere}
  @media(max-width:620px){
   .sump-chamber-grid{grid-template-columns:1fr!important}
   .sump-chamber-card{width:100%}
   .sump-media-section .module-head{display:flex;flex-direction:column;align-items:stretch;gap:10px}
   .sump-media-section .module-head>.btn{width:100%}
   .sump-media-section .equipment-grid{grid-template-columns:1fr}
   .sump-touch-plan{min-height:150px}
  }
 `}</style>
 <Modal open={mediaOpen} title={bi(lang,"إضافة ميديا فلترة","Add filter media")} onClose={()=>setMediaOpen(false)}><div className="form-grid"><label className="field"><span>{bi(lang,"المادة من المخزون","Inventory media")}</span><select value={mediaInventoryId} onChange={e=>{const id=e.target.value;setMediaInventoryId(id);const inv=filterMediaStock.find(x=>x.id===id);if(inv&&!mediaName.trim())setMediaName(lang==="ar"?inv.name:(inv.nameEn||inv.name));}}><option value="">{bi(lang,"بدون ربط بالمخزون","Not linked to inventory")}</option>{filterMediaStock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)} • {x.quantity} {x.unit}</option>)}</select></label><label className="field"><span>{tr(lang,"name")}</span><input value={mediaName} onChange={e=>setMediaName(e.target.value)} placeholder={mediaKind==="gfo"?"GFO":mediaKind==="activatedCarbon"?"Activated Carbon":"Media"}/></label><label className="field"><span>{tr(lang,"type")}</span><select value={mediaKind} onChange={e=>setMediaKind(e.target.value as FilterMediaItem["kind"])}><option value="gfo">GFO / phosphate media</option><option value="activatedCarbon">Activated Carbon</option><option value="other">Other</option></select></label><label className="field"><span>{bi(lang,"الكمية g","Amount g")}</span><input type="number" min="1" max="100000" value={mediaAmount} onChange={e=>setMediaAmount(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"العمر المرجعي بالأيام","Reference life days")}</span><input type="number" min="1" max="3650" value={mediaLife} onChange={e=>setMediaLife(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"الحجرة","Chamber")}</span><select value={mediaChamber} onChange={e=>setMediaChamber(e.target.value)}><option value="">—</option>{tank.sump.chambers.map(ch=><option value={ch.id} key={ch.id}>{lang==="ar"?ch.name:(ch.nameEn||ch.name)}</option>)}</select></label></div><div className="inline-alert info">{bi(lang,"لـ GFO سيعدل Aqua Nexus العمر المتوقع حسب PO4 واتجاه القراءات. للكربون النشط يبقى التقدير محافظاً لأنه لا يوجد قياس تشبع مباشر ضمن بيانات الحوض.","For GFO, Aqua Nexus adjusts estimated life using PO4 and its trend. Activated carbon remains a conservative estimate because there is no direct saturation measurement in tank data.")}</div><div className="modal-actions"><button className="btn" onClick={()=>setMediaOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={addMedia}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
