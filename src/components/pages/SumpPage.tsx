"use client";
import { useState } from "react";
import type { SumpChamber,Tank } from "@/domain/types";
import { AquariumScene } from "@/components/three/AquariumScene";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid } from "@/lib/appUtils";

function makeChambers(count:number,L:number,W:number,H:number,fill:number,old:SumpChamber[]) {
 const each=L/Math.max(1,count);
 return Array.from({length:count},(_,i)=>old[i]??{id:uid("ch"),name:`حجرة ${i+1}`,nameEn:`Chamber ${i+1}`,x:i*each,y:0,length:each,width:W,height:H,waterHeight:H*fill/100,media:[]});
}
export function SumpPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[edit,setEdit]=useState<string|null>(null),c=tank.sump.chambers.find(x=>x.id===edit);
 const [draft,setDraft]=useState<any>(null);
 const setEnabled=(enabled:boolean)=>patch(tank.id,t=>({...t,sump:{...t.sump,enabled,chambers:enabled?(t.sump.chambers.length?t.sump.chambers:makeChambers(3,t.sump.dimensions.length,t.sump.dimensions.width,t.sump.dimensions.height,t.sump.operatingFillPercent,[])):[]}}));
 const config=(field:string,value:number)=>patch(tank.id,t=>({...t,sump:{...t.sump,dimensions:{...t.sump.dimensions,[field]:value}}}));
 const count=(n:number)=>patch(tank.id,t=>({...t,sump:{...t.sump,chambers:makeChambers(n,t.sump.dimensions.length,t.sump.dimensions.width,t.sump.dimensions.height,t.sump.operatingFillPercent,t.sump.chambers)}}));
 const open=(ch:SumpChamber)=>{setEdit(ch.id);setDraft({...ch})};
 const save=()=>{if(!edit||!draft)return;patch(tank.id,t=>({...t,sump:{...t.sump,chambers:t.sump.chambers.map(x=>x.id===edit?draft:x)}}));setEdit(null)};
 return <section className="page-grid"><PageHeader eyebrow="SUMP DIGITAL TWIN" title={tr(lang,"sump")}/>
 <div className="card panel"><div className="choice-row"><button className={`btn ${tank.sump.enabled?"primary":""}`} onClick={()=>setEnabled(true)}>{bi(lang,"يوجد سامب","Sump installed")}</button><button className={`btn ${!tank.sump.enabled?"primary":""}`} onClick={()=>setEnabled(false)}>{bi(lang,"بدون سامب","No sump")}</button></div>{tank.sump.enabled&&<div className="form-grid compact-fields"><label className="field"><span>L cm</span><input type="number" value={tank.sump.dimensions.length} onChange={e=>config("length",Number(e.target.value))}/></label><label className="field"><span>W cm</span><input type="number" value={tank.sump.dimensions.width} onChange={e=>config("width",Number(e.target.value))}/></label><label className="field"><span>H cm</span><input type="number" value={tank.sump.dimensions.height} onChange={e=>config("height",Number(e.target.value))}/></label><label className="field"><span>Fill %</span><input type="number" value={tank.sump.operatingFillPercent} onChange={e=>patch(tank.id,t=>({...t,sump:{...t.sump,operatingFillPercent:Number(e.target.value)}}))}/></label><label className="field"><span>{tr(lang,"chamberDesigner")}</span><input type="number" min="1" max="12" value={tank.sump.chambers.length} onChange={e=>count(Number(e.target.value))}/></label></div>}</div>
 <div className="card scene-card sump-scene-card"><AquariumScene tank={tank}/></div>
 {tank.sump.enabled&&<div className="chamber-grid full-span">{tank.sump.chambers.map((x,i)=><button type="button" className="chamber-card clickable" key={x.id} onClick={()=>open(x)}><span className="chamber-number">{i+1}</span><h3>{lang==="ar"?x.name:(x.nameEn||x.name)}</h3><div className="chamber-stats"><span><small>Geometry</small><b>{x.length}×{x.width}×{x.height}</b></span><span><small>Water</small><b>{x.waterHeight} cm</b></span><span><small>X/Y</small><b>{x.x}/{x.y}</b></span></div></button>)}</div>}
 <Modal open={!!c&&!!draft} title={tr(lang,"chamberDesigner")} onClose={()=>setEdit(null)}>{draft&&<div className="form-grid"><label className="field"><span>العربية</span><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="field"><span>English</span><input value={draft.nameEn??""} onChange={e=>setDraft({...draft,nameEn:e.target.value})}/></label>{["x","y","length","width","height","waterHeight"].map(k=><label className="field" key={k}><span>{k}</span><input type="number" step=".1" value={draft[k]} onChange={e=>setDraft({...draft,[k]:Number(e.target.value)})}/></label>)}</div>}<div className="modal-actions"><button className="btn" onClick={()=>setEdit(null)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={save}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
