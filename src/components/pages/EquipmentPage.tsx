"use client";
import { useEffect,useMemo,useState } from "react";
import type { DisplayEquipmentPosition,EquipmentKind,Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AquariumScene } from "@/components/three/AquariumScene";
import { defaultDisplayPosition,resolvedOverflowReturnPosition,suggestedLocation } from "@/lib/displayLayout";
import { today,uid,daysFrom } from "@/lib/appUtils";

const kinds:EquipmentKind[]=["lighting","waveMaker","overflow","skimmer","returnPump","filterSock","rollerFilter","reactor","heater","doser","uv","ozone","ato","refugiumLight","turfScrubber","probe","other"];

export function EquipmentPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[details,setDetails]=useState<string|null>(null),[name,setName]=useState(""),[kind,setKind]=useState<EquipmentKind>("lighting"),[location,setLocation]=useState<string>("display"),[brand,setBrand]=useState(""),[model,setModel]=useState(""),[days,setDays]=useState(90);
 const visualDevices=tank.equipment;
 const e=tank.equipment.find(x=>x.id===details);
 useEffect(()=>{if(open)setLocation(suggestedLocation(kind,tank.sump.chambers))},[kind,open,tank.sump.chambers]);

 function add(){
  const similar=tank.equipment.filter(x=>x.location==="display"&&x.kind===kind).length;
  const displayPosition=location==="display"?defaultDisplayPosition(kind,similar,similar+1):undefined;
  patch(tank.id,t=>({...t,equipment:[...t.equipment,{id:uid("eq"),name:name||kind,kind,brand,model,location:location as any,installedAt:today(),lastServiceAt:today(),serviceIntervalDays:days,status:"on",displayPosition,overflowPlumbingMode:kind==="overflow"?"combined":undefined}]}));
  setOpen(false);setName("");setBrand("");setModel("");
 }
 const service=(id:string)=>patch(tank.id,t=>({...t,equipment:t.equipment.map(x=>x.id===id?{...x,lastServiceAt:today(),status:"on"}:x)}));
 const remove=(id:string)=>patch(tank.id,t=>({...t,equipment:t.equipment.filter(x=>x.id!==id)}));
 function updateDevice(id:string, updater:(x:any)=>any){patch(tank.id,t=>({...t,equipment:t.equipment.map(x=>x.id===id?updater(x):x)}));}
 function setLocationLive(id:string,loc:string){updateDevice(id,x=>({...x,location:loc,displayPosition:loc==="display"?(x.displayPosition??defaultDisplayPosition(x.kind,0,1)):x.displayPosition}));}
 function posPatch(id:string,p:Partial<DisplayEquipmentPosition>){updateDevice(id,x=>({...x,displayPosition:{...defaultDisplayPosition(x.kind,0,1),...(x.displayPosition??{}),...p}}));}
 function returnPosPatch(id:string,p:Partial<DisplayEquipmentPosition>){
  updateDevice(id,x=>({...x,overflowReturnPosition:{...resolvedOverflowReturnPosition({...x,overflowPlumbingMode:"separate"},0,1),...(x.overflowReturnPosition??{}),...p}}));
 }

 return <section className="page-grid">
  <PageHeader eyebrow="EQUIPMENT" title={tr(lang,"equipment")} actions={<button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addEquipment")}</button>}/>
  <section className="card panel full-span display-layout-workspace">
    <div className="module-head"><div><h3>{bi(lang,"المجسم الحي للنظام والتجهيزات","Live System & Equipment Layout")}</h3><p className="note">{bi(lang,"الحوض والسامب والتجهيزات الخارجية تظهر معاً. أي إضافة أو تعديل يتحدث فوراً.","Display, sump and external devices are shown together. Every change updates immediately.")}</p></div></div>
    <div className="display-layout-grid">
      <div className="display-layout-scene equipment-system-scene"><AquariumScene tank={tank} view="system"/></div>
      <div className="display-layout-device-list">
        {visualDevices.map(x=><button type="button" className={`layout-device-btn ${x.id===details?"active":""}`} key={x.id} onClick={()=>setDetails(x.id)}><span>{x.kind==="lighting"?"▰":x.kind==="waveMaker"?"◉":x.kind==="overflow"?"▥":"⚙"}</span><div><b>{x.name}</b><small>{x.kind} • {x.location}</small></div></button>)}
      </div>
    </div>
  </section>

  <div className="equipment-grid full-span">{tank.equipment.map(x=>{const due=daysFrom(x.lastServiceAt,x.serviceIntervalDays??90);return <button type="button" className="equipment-card clickable" key={x.id} onClick={()=>setDetails(x.id)}><div className="equipment-card-head"><span className="eq-big-icon">⚙</span><span className="status">{x.status}</span></div><h3>{x.name}</h3><small>{x.brand} {x.model}</small><div className="equipment-meta"><span><b>{tr(lang,"location")}</b>{x.location}</span><span><b>{tr(lang,"due")}</b>{due}</span></div></button>})}</div>

  <Modal open={open} title={tr(lang,"addEquipment")} onClose={()=>setOpen(false)}>
   <div className="form-grid">
    <label className="field"><span>{tr(lang,"name")}</span><input value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="field"><span>{tr(lang,"type")}</span><select value={kind} onChange={e=>setKind(e.target.value as EquipmentKind)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label>
    <label className="field"><span>{tr(lang,"location")}</span><select value={location} onChange={e=>setLocation(e.target.value)}><option value="display">{bi(lang,"الحوض الرئيسي","Display Tank")}</option><option value="external">{bi(lang,"خارجي","External")}</option>{tank.sump.chambers.map(c=><option key={c.id} value={`sump:${c.id}`}>{lang==="ar"?c.name:(c.nameEn||c.name)}</option>)}</select></label>
    <label className="field"><span>{tr(lang,"brandLabel")}</span><input value={brand} onChange={e=>setBrand(e.target.value)}/></label>
    <label className="field"><span>{tr(lang,"model")}</span><input value={model} onChange={e=>setModel(e.target.value)}/></label>
    <label className="field"><span>{tr(lang,"serviceInterval")}</span><input type="number" value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
   </div>
   <div className="inline-alert info">{bi(lang,"الموقع المقترح يتغير تلقائياً حسب نوع الجهاز ويمكنك تعديله قبل الحفظ.","A suggested location is selected by device type and can be changed before saving.")}</div>
   <div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div>
  </Modal>

  <Modal open={!!e} title={e?.name??tr(lang,"equipment")} onClose={()=>setDetails(null)}>
   {e&&<>
    <div className="form-grid">
      <label className="field"><span>{tr(lang,"name")}</span><input value={e.name} onChange={ev=>updateDevice(e.id,x=>({...x,name:ev.target.value}))}/></label>
      <label className="field"><span>{tr(lang,"brandLabel")}</span><input value={e.brand??""} onChange={ev=>updateDevice(e.id,x=>({...x,brand:ev.target.value}))}/></label>
      <label className="field"><span>{tr(lang,"model")}</span><input value={e.model??""} onChange={ev=>updateDevice(e.id,x=>({...x,model:ev.target.value}))}/></label>
      <label className="field"><span>{tr(lang,"location")}</span><select value={e.location} onChange={ev=>setLocationLive(e.id,ev.target.value)}><option value="display">{bi(lang,"الحوض الرئيسي","Display Tank")}</option><option value="external">{bi(lang,"خارجي","External")}</option>{tank.sump.chambers.map(c=><option key={c.id} value={`sump:${c.id}`}>{lang==="ar"?c.name:(c.nameEn||c.name)}</option>)}</select></label>
      <label className="field"><span>{tr(lang,"status")}</span><select value={e.status} onChange={ev=>updateDevice(e.id,x=>({...x,status:ev.target.value}))}><option value="on">on</option><option value="off">off</option><option value="service">service</option><option value="warning">warning</option></select></label>
      <label className="field"><span>{tr(lang,"serviceInterval")}</span><input type="number" value={e.serviceIntervalDays??90} onChange={ev=>updateDevice(e.id,x=>({...x,serviceIntervalDays:Number(ev.target.value)}))}/></label>
    </div>
    {e.location==="display"&&<div className="display-position-editor">
      <h4>{e.kind==="overflow"?bi(lang,"موضع الأوفر فلو / نزول الماء","Overflow / Drain Position"):bi(lang,"موضع الجهاز على المجسم","Position on 3D Model")}</h4>
      <label className="range-field"><span>{e.kind==="overflow"?bi(lang,"نزول X","Drain X"):"X"} {Math.round(e.displayPosition?.xPct??defaultDisplayPosition(e.kind).xPct)}%</span><input type="range" min="2" max="98" value={e.displayPosition?.xPct??defaultDisplayPosition(e.kind).xPct} onChange={ev=>posPatch(e.id,{xPct:Number(ev.target.value)})}/></label>
      <label className="range-field"><span>{e.kind==="lighting"?bi(lang,"الارتفاع","Height"):e.kind==="overflow"?bi(lang,"نزول Y","Drain Y"):"Y"} {Math.round(e.displayPosition?.yPct??defaultDisplayPosition(e.kind).yPct)}%</span><input type="range" min={e.kind==="lighting"?102:5} max={e.kind==="lighting"?145:95} value={e.displayPosition?.yPct??defaultDisplayPosition(e.kind).yPct} onChange={ev=>posPatch(e.id,{yPct:Number(ev.target.value)})}/></label>
      <label className="range-field"><span>{e.kind==="overflow"?bi(lang,"نزول Z","Drain Z"):"Z"} {Math.round(e.displayPosition?.zPct??defaultDisplayPosition(e.kind).zPct)}%</span><input type="range" min="2" max="98" value={e.displayPosition?.zPct??defaultDisplayPosition(e.kind).zPct} onChange={ev=>posPatch(e.id,{zPct:Number(ev.target.value)})}/></label>
      <label className="range-field"><span>{bi(lang,"الدوران","Rotation")} {Math.round(e.displayPosition?.rotationY??defaultDisplayPosition(e.kind).rotationY??0)}°</span><input type="range" min="0" max="359" value={e.displayPosition?.rotationY??defaultDisplayPosition(e.kind).rotationY??0} onChange={ev=>posPatch(e.id,{rotationY:Number(ev.target.value)})}/></label>
      <label className="range-field"><span>{bi(lang,"الحجم","Scale")} {(e.displayPosition?.scale??1).toFixed(2)}</span><input type="range" min="0.55" max="1.65" step=".05" value={e.displayPosition?.scale??1} onChange={ev=>posPatch(e.id,{scale:Number(ev.target.value)})}/></label>
      {e.kind==="waveMaker"&&<label className="range-field"><span>{bi(lang,"قوة حركة الماء","Flow Strength")} {Math.round(e.displayPosition?.flowStrength??100)}%</span><input type="range" min="20" max="160" value={e.displayPosition?.flowStrength??100} onChange={ev=>posPatch(e.id,{flowStrength:Number(ev.target.value)})}/></label>}

      {e.kind==="overflow"&&<div className="overflow-plumbing-editor">
        <h4>{bi(lang,"توصيل الأوفر فلو","Overflow Plumbing")}</h4>
        <label className="field">
          <span>{bi(lang,"طريقة الصاعد والنازل","Drain / Return Arrangement")}</span>
          <select value={e.overflowPlumbingMode??"combined"} onChange={ev=>updateDevice(e.id,x=>({...x,overflowPlumbingMode:ev.target.value}))}>
            <option value="combined">{bi(lang,"الصاعد والنازل ضمن نفس الأوفر فلو","Drain + Return inside same overflow")}</option>
            <option value="separate">{bi(lang,"النازل بالأوفر فلو والصاعد بمكان منفصل","Drain in overflow + separate return outlet")}</option>
          </select>
        </label>

        {(e.overflowPlumbingMode??"combined")==="combined"
          ? <div className="inline-alert good">{bi(lang,"الصاعد يتحرك تلقائياً مع الأوفر فلو، ويظهر بجانب خط النزول داخل نفس التجميعة.","The return moves automatically with the overflow and stays beside the drain in the same assembly.")}</div>
          : <div className="return-position-editor">
              <h4>{bi(lang,"موضع الصاعد إلى الحوض","Return Outlet Position")}</h4>
              <label className="range-field"><span>{bi(lang,"صاعد X","Return X")} {Math.round(resolvedOverflowReturnPosition(e).xPct)}%</span><input type="range" min="2" max="98" value={resolvedOverflowReturnPosition(e).xPct} onChange={ev=>returnPosPatch(e.id,{xPct:Number(ev.target.value)})}/></label>
              <label className="range-field"><span>{bi(lang,"صاعد Y","Return Y")} {Math.round(resolvedOverflowReturnPosition(e).yPct)}%</span><input type="range" min="8" max="94" value={resolvedOverflowReturnPosition(e).yPct} onChange={ev=>returnPosPatch(e.id,{yPct:Number(ev.target.value)})}/></label>
              <label className="range-field"><span>{bi(lang,"صاعد Z","Return Z")} {Math.round(resolvedOverflowReturnPosition(e).zPct)}%</span><input type="range" min="2" max="98" value={resolvedOverflowReturnPosition(e).zPct} onChange={ev=>returnPosPatch(e.id,{zPct:Number(ev.target.value)})}/></label>
              <label className="range-field"><span>{bi(lang,"اتجاه الصاعد","Return Direction")} {Math.round(resolvedOverflowReturnPosition(e).rotationY??0)}°</span><input type="range" min="0" max="359" value={resolvedOverflowReturnPosition(e).rotationY??0} onChange={ev=>returnPosPatch(e.id,{rotationY:Number(ev.target.value)})}/></label>
            </div>
        }
      </div>}

      <div className="inline-alert info">{bi(lang,"أي تعديل يظهر فوراً على المجسم ومسار حركة الماء.","Every adjustment updates the 3D model and water path immediately.")}</div>
    </div>}
    <div className="modal-actions"><button className="btn danger" onClick={()=>{remove(e.id);setDetails(null)}}>{tr(lang,"delete")}</button><button className="btn good" onClick={()=>service(e.id)}>{tr(lang,"serviceDone")}</button></div>
   </>}
  </Modal>
 </section>;
}
