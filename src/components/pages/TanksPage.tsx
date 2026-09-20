"use client";
import { useRef,useState } from "react";
import type { Tank,TankStatus,TankType } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,statusText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { biologicalCycleStatus } from "@/domain/biologicalCycle";
import { nowISO,uid } from "@/lib/appUtils";

function SwipeTankCard({tank,selected,onSelect,onEdit,onDelete}:{tank:Tank;selected:boolean;onSelect:()=>void;onEdit:()=>void;onDelete:()=>void}){
 const lang=useAquaStore(s=>s.language);
 const startX=useRef<number|null>(null),moved=useRef(false);
 const [offset,setOffset]=useState(0);
 function down(e:React.PointerEvent<HTMLDivElement>){startX.current=e.clientX;moved.current=false;e.currentTarget.setPointerCapture?.(e.pointerId)}
 function move(e:React.PointerEvent<HTMLDivElement>){if(startX.current===null)return;const dx=e.clientX-startX.current;if(Math.abs(dx)>5)moved.current=true;setOffset(Math.max(-104,Math.min(104,dx)))}
 function up(){
  const dx=offset;startX.current=null;setOffset(0);
  if(dx>=72){if(!tank.isTraining)onDelete();return}
  if(dx<=-72){onEdit();return}
  if(!moved.current)onSelect();
 }
 return <div className="tank-swipe-shell">
  <div className="tank-swipe-action tank-swipe-delete" aria-hidden="true"><b>{tank.isTraining?"🔒":"🗑"}</b><span>{tank.isTraining?(lang==="ar"?"محمي":"Protected"):(lang==="ar"?"حذف":"Delete")}</span></div>
  <div className="tank-swipe-action tank-swipe-edit" aria-hidden="true"><b>✎</b><span>{lang==="ar"?"تعديل":"Edit"}</span></div>
  <div className={`tank-card tank-swipe-card ${selected?"selected":""}`} style={{transform:`translateX(${offset}px)`}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{startX.current=null;setOffset(0)}}>
   <div className="tank-type-badge">{tank.isTraining?`${lang==="ar"?"تدريب":"Training"} • `:""}{tank.type==="marine"?tr(lang,"marine"):tr(lang,"freshwater")}</div><h3>{tank.isTraining?(lang==="ar"?(tank.type==="marine"?"حوض التدريب البحري":"حوض التدريب النهري"):(tank.type==="marine"?"Marine Training Tank":"Freshwater Training Tank")):tank.name}</h3>
   <div className="tank-card-stats"><span><small>{tr(lang,"systemVolume")}</small><b>{tank.systemVolumeLiters} L</b></span><span><small>{tr(lang,"status")}</small><b>{statusText(lang,tank.status)}</b></span><span><small>{tr(lang,"equipment")}</small><b>{tank.equipment.length}</b></span></div>
   <div className="tank-dim-line">{tank.display.length} × {tank.display.width} × {tank.display.height} cm</div>
   <div className="tank-swipe-hint">{tank.isTraining?(lang==="ar"?"← تعديل   •   🔒 حوض تدريبي محمي":"← Edit   •   🔒 Protected training tank"):(lang==="ar"?"← تعديل   •   حذف →":"← Edit   •   Delete →")}</div>
  </div>
 </div>
}

export function TanksPage({tanks,selectedTankId,onSelect}:{tanks:Tank[];selectedTankId:string;onSelect:(id:string)=>void}) {
 const lang=useAquaStore(s=>s.language),deleteTank=useAquaStore(s=>s.deleteTank),patchTank=useAquaStore(s=>s.patchTank);
 const [deleteTarget,setDeleteTarget]=useState<Tank|null>(null),[editTarget,setEditTarget]=useState<Tank|null>(null);
 const [name,setName]=useState(""),[type,setType]=useState<TankType>("marine"),[status,setStatus]=useState<TankStatus>("established"),[ageMonths,setAgeMonths]=useState(0);
 const [l,setL]=useState(120),[w,setW]=useState(60),[h,setH]=useState(60),[loss,setLoss]=useState(15);
 const [hasSump,setHasSump]=useState(true),[sl,setSl]=useState(100),[sw,setSw]=useState(40),[sh,setSh]=useState(35),[fill,setFill]=useState(75);
 const typeLocked=Boolean(editTarget&&(editTarget.livestock.length>0||editTarget.chemistry.length>0||(editTarget.acclimationSessions??[]).length>0));
 const editCycle=editTarget?biologicalCycleStatus(editTarget):null;

 function openEdit(t:Tank){
  setEditTarget(t);setName(t.name);setType(t.type);setStatus(t.status);setAgeMonths(t.ageMonths??0);
  setL(t.display.length);setW(t.display.width);setH(t.display.height);setLoss(t.display.displacementPercent);
  setHasSump(t.sump.enabled);setSl(t.sump.dimensions.length);setSw(t.sump.dimensions.width);setSh(t.sump.dimensions.height);setFill(t.sump.operatingFillPercent);
 }
 function saveEdit(){
  if(!editTarget)return;
  const setupCheck=validateTankSetupEntry({length:l,width:w,height:h,displacementPercent:loss,ageMonths,sumpEnabled:hasSump,sumpLength:sl,sumpWidth:sw,sumpHeight:sh,sumpFillPercent:fill});
  if(!setupCheck.ok){const issue=setupCheck.issues[0];window.alert(lang==="ar"?issue.ar:issue.en);return;}
  if(editCycle?.active&&status==="established"&&!editCycle.ready){
   window.alert(lang==="ar"?"ما فيك تحول الحوض إلى Established قبل ما تحقق شروط الدورة البيولوجية. كمّل القراءات من Dashboard/Chemistry أولاً.":"You cannot mark the tank Established before biological-cycle readiness is proven. Complete the measured cycle checks first.");
   return;
  }
  const ts=nowISO(),wantsCycle=status==="new"||status==="cycling";
  patchTank(editTarget.id,t=>{
   const displayGross=l*w*h/1000;
   const displayNet=displayGross*(1-loss/100);
   const sumpGross=hasSump?sl*sw*sh/1000:0;
   const nextVolume=Math.round((displayNet+sumpGross*(fill/100))*10)/10;
   const previousVolume=t.systemVolumeLiters;
   const volumeChanged=Math.abs(nextVolume-previousVolume)>=0.1;
   const volumeEvent=volumeChanged?{
    id:uid("ev"),timestamp:ts,type:"tank-volume-changed",
    textAr:`تم تعديل حجم النظام من ${previousVolume.toFixed(1)} L إلى ${nextVolume.toFixed(1)} L. الحسابات الجديدة تعتمد الحجم الجديد من هذا التاريخ فقط.`,
    textEn:`System volume changed from ${previousVolume.toFixed(1)} L to ${nextVolume.toFixed(1)} L. New calculations use the new volume from this timestamp onward.`
   }:null;
   return {
    ...t,name:name.trim()||t.name,type,status:wantsCycle?"cycling":status,ageMonths,
    biologicalCycle:wantsCycle
     ?(editCycle?.active?{...(t.biologicalCycle??{startedAt:t.createdAt||ts}),startedAt:t.biologicalCycle?.startedAt??t.createdAt??ts}:{startedAt:ts,method:"fishless"})
     :(editCycle?.active&&editCycle.ready?{...(t.biologicalCycle??{startedAt:t.createdAt}),completedAt:t.biologicalCycle?.completedAt??ts,completionReadingTimestamps:[editCycle.latestMeasured?.timestamp,editCycle.previousMeasured?.timestamp].filter(Boolean) as string[]}:t.biologicalCycle),
    display:{...t.display,length:l,width:w,height:h,displacementPercent:loss},
    sump:{...t.sump,enabled:hasSump,dimensions:{length:sl,width:sw,height:sh},operatingFillPercent:fill},
    equipment:hasSump?t.equipment:t.equipment.map(eq=>eq.location.startsWith("sump:")?{...eq,location:"external" as const}:eq),
    timeline:volumeEvent?[volumeEvent,...t.timeline]:t.timeline
   };
  });
  setEditTarget(null);
 }
 function confirmDelete(){
  if(!deleteTarget||deleteTarget.isTraining){setDeleteTarget(null);return;}
  const id=deleteTarget.id;deleteTank(id);setDeleteTarget(null);
  if(id===selectedTankId){const remaining=tanks.find(t=>t.id!==id);if(remaining)onSelect(remaining.id)}
 }

 return <section className="page-grid"><PageHeader eyebrow="TANK MANAGEMENT" title={tr(lang,"tanks")}/>
  <div className="tank-cards">{tanks.map(t=><SwipeTankCard key={t.id} tank={t} selected={t.id===selectedTankId} onSelect={()=>onSelect(t.id)} onEdit={()=>openEdit(t)} onDelete={()=>setDeleteTarget(t)}/>)}</div>

  <Modal open={!!deleteTarget} title={lang==="ar"?"حذف الحوض نهائياً":"Delete tank permanently"} onClose={()=>setDeleteTarget(null)}>
   <div className="tank-delete-warning">
    <b>⚠️ {lang==="ar"?"تحذير":"Warning"}</b>
    <p>{lang==="ar"?`سيتم حذف الحوض «${deleteTarget?.name??""}» وجميع بياناته المسجلة نهائياً. لا يمكن التراجع عن هذه العملية.`:`The tank “${deleteTarget?.name??""}” and all of its saved data will be permanently deleted. This cannot be undone.`}</p>
   </div>
   <div className="modal-actions"><button className="btn" onClick={()=>setDeleteTarget(null)}>{lang==="ar"?"إلغاء":"Cancel"}</button><button className="btn tank-delete-confirm" onClick={confirmDelete}>{lang==="ar"?"حذف نهائي":"Delete permanently"}</button></div>
  </Modal>

  <Modal open={!!editTarget} title={lang==="ar"?"تعديل معلومات الحوض":"Edit tank setup"} onClose={()=>setEditTarget(null)}>
   <div className="tank-edit-wizard">
    <div className="tank-edit-section"><h4>{lang==="ar"?"معلومات الحوض":"Tank information"}</h4><div className="form-grid">
     <label className="field"><span>{lang==="ar"?"اسم الحوض":"Tank name"}</span><input value={name} onChange={e=>setName(e.target.value)}/></label>
     <label className="field"><span>{lang==="ar"?"النوع":"Type"}</span><select value={type} disabled={typeLocked} onChange={e=>setType(e.target.value as TankType)}><option value="marine">{tr(lang,"marine")}</option><option value="freshwater">{tr(lang,"freshwater")}</option></select></label>
     <label className="field"><span>{lang==="ar"?"الحالة":"Status"}</span><select value={status} onChange={e=>setStatus(e.target.value as TankStatus)}><option value="new">{statusText(lang,"new")}</option><option value="cycling">{statusText(lang,"cycling")}</option><option value="established" disabled={Boolean(editCycle?.active&&!editCycle.ready)}>{statusText(lang,"established")}</option></select>{editCycle?.active&&!editCycle.ready&&<small>{lang==="ar"?`🔒 Established مقفول — الدورة يوم ${editCycle.day} ولسا شروط الجاهزية ناقصة.`:`🔒 Established is locked — cycle day ${editCycle.day} is not ready yet.`}</small>}</label>
     <label className="field"><span>{lang==="ar"?"عمر الحوض / شهر":"Age / months"}</span><input type="number" min="0" value={ageMonths} onChange={e=>setAgeMonths(Number(e.target.value))}/></label>
    </div>{typeLocked&&<div className="inline-alert warn">{lang==="ar"?"نوع الحوض مقفول لأن فيه بيانات/كائنات فعلية. لتجنب خلط Marine وFreshwater أنشئ حوضاً جديداً بدل تحويل هذا الحوض.":"Tank type is locked because real data/livestock exists. Create a new tank instead of converting this one between Marine and Freshwater."}</div>}</div>
    <div className="tank-edit-section"><h4>{lang==="ar"?"أبعاد الحوض":"Display dimensions"}</h4><div className="form-grid">
     <label className="field"><span>L cm</span><input type="number" min="1" value={l} onChange={e=>setL(Number(e.target.value))}/></label><label className="field"><span>W cm</span><input type="number" min="1" value={w} onChange={e=>setW(Number(e.target.value))}/></label><label className="field"><span>H cm</span><input type="number" min="1" value={h} onChange={e=>setH(Number(e.target.value))}/></label><label className="field"><span>{lang==="ar"?"نسبة الإزاحة %":"Displacement %"}</span><input type="number" min="0" max="90" value={loss} onChange={e=>setLoss(Number(e.target.value))}/></label>
    </div></div>
    <div className="tank-edit-section"><div className="tank-edit-section-head"><h4>{lang==="ar"?"السامب":"Sump"}</h4><label className="tank-switch"><input type="checkbox" checked={hasSump} onChange={e=>setHasSump(e.target.checked)}/><span>{hasSump?(lang==="ar"?"مفعّل":"Enabled"):(lang==="ar"?"بدون سامب":"No sump")}</span></label></div>
     {hasSump&&<div className="form-grid"><label className="field"><span>Sump L</span><input type="number" min="1" value={sl} onChange={e=>setSl(Number(e.target.value))}/></label><label className="field"><span>Sump W</span><input type="number" min="1" value={sw} onChange={e=>setSw(Number(e.target.value))}/></label><label className="field"><span>Sump H</span><input type="number" min="1" value={sh} onChange={e=>setSh(Number(e.target.value))}/></label><label className="field"><span>Fill %</span><input type="number" min="1" max="100" value={fill} onChange={e=>setFill(Number(e.target.value))}/></label></div>}
    </div>
   </div>
   <div className="modal-actions"><button className="btn" onClick={()=>setEditTarget(null)}>{lang==="ar"?"إلغاء":"Cancel"}</button><button className="btn primary" onClick={saveEdit}>{lang==="ar"?"حفظ التعديلات":"Save changes"}</button></div>
  </Modal>
 </section>;
}
