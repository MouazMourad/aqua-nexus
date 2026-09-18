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
import { deviceEnergy,equipmentProfile,tankEnergy } from "@/domain/equipmentIntelligence";

const kinds:EquipmentKind[]=["lighting","waveMaker","overflow","skimmer","returnPump","filterSock","rollerFilter","reactor","heater","doser","uv","ozone","ato","refugiumLight","turfScrubber","probe","other"];

export function EquipmentPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[details,setDetails]=useState<string|null>(null),[name,setName]=useState(""),[kind,setKind]=useState<EquipmentKind>("lighting"),[location,setLocation]=useState<string>("display"),[brand,setBrand]=useState(""),[model,setModel]=useState(""),[days,setDays]=useState(90),[power,setPower]=useState(0),[hours,setHours]=useState(0),[ratedVolume,setRatedVolume]=useState(0),[flowLph,setFlowLph]=useState(0);
 const visualDevices=tank.equipment;
 const e=tank.equipment.find(x=>x.id===details);
 const profile=e?equipmentProfile(e.kind):null;
 const price=tank.energySettings?.pricePerKwh??0;
 const currency=tank.energySettings?.currency||"USD";
 const energy=useMemo(()=>tankEnergy(tank),[tank.equipment,tank.energySettings?.pricePerKwh]);
 useEffect(()=>{if(open)setLocation(suggestedLocation(kind,tank.sump.chambers))},[kind,open,tank.sump.chambers]);

 function add(){
  const similar=tank.equipment.filter(x=>x.location==="display"&&x.kind===kind).length;
  const displayPosition=location==="display"?defaultDisplayPosition(kind,similar,similar+1):undefined;
  patch(tank.id,t=>({...t,equipment:[...t.equipment,{id:uid("eq"),name:name||kind,kind,brand,model,location:location as any,installedAt:today(),lastServiceAt:today(),serviceIntervalDays:days,status:"on",displayPosition,overflowPlumbingMode:kind==="overflow"?"combined":undefined,powerWatts:power>0?power:undefined,hoursPerDay:hours>0?Math.min(24,hours):undefined,ratedVolumeLiters:ratedVolume>0?ratedVolume:undefined,flowLph:flowLph>0?flowLph:undefined}]}));
  setOpen(false);setName("");setBrand("");setModel("");setPower(0);setHours(0);setRatedVolume(0);setFlowLph(0);
 }
 const service=(id:string)=>patch(tank.id,t=>({...t,equipment:t.equipment.map(x=>x.id===id?{...x,lastServiceAt:today(),status:"on"}:x)}));
 const remove=(id:string)=>patch(tank.id,t=>({...t,equipment:t.equipment.filter(x=>x.id!==id)}));
 function updateDevice(id:string, updater:(x:any)=>any){patch(tank.id,t=>({...t,equipment:t.equipment.map(x=>x.id===id?updater(x):x)}));}
 function setLocationLive(id:string,loc:string){updateDevice(id,x=>({...x,location:loc,displayPosition:loc==="display"?(x.displayPosition??defaultDisplayPosition(x.kind,0,1)):x.displayPosition}));}
 function posPatch(id:string,p:Partial<DisplayEquipmentPosition>){updateDevice(id,x=>({...x,displayPosition:{...defaultDisplayPosition(x.kind,0,1),...(x.displayPosition??{}),...p}}));}
 function returnPosPatch(id:string,p:Partial<DisplayEquipmentPosition>){
  updateDevice(id,x=>({...x,overflowReturnPosition:{...resolvedOverflowReturnPosition({...x,overflowPlumbingMode:"separate"},0,1),...(x.overflowReturnPosition??{}),...p}}));
 }
 function setEnergySettings(p:Partial<{pricePerKwh:number;currency:string}>){patch(tank.id,t=>({...t,energySettings:{pricePerKwh:t.energySettings?.pricePerKwh??0,currency:t.energySettings?.currency||"USD",...p}}));}

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

  <section className="card panel full-span">
    <div className="module-head"><div><h3>⚡ {bi(lang,"مراقبة الطاقة والتكلفة","Energy & Cost Monitor")}</h3><p className="note">{bi(lang,"الحساب يعتمد على الواط الفعلي وساعات التشغيل اليومية التي تدخلها لكل جهاز.","Calculation uses the actual watts and daily operating hours you enter for each device.")}</p></div><span className="scene-badge">{energy.configured}/{tank.equipment.length}</span></div>
    <div className="form-grid compact-fields">
      <label className="field"><span>{bi(lang,"سعر الكهرباء / kWh","Electricity price / kWh")}</span><input type="number" min="0" step="any" value={price||""} onChange={ev=>setEnergySettings({pricePerKwh:Number(ev.target.value)})}/></label>
      <label className="field"><span>{bi(lang,"العملة","Currency")}</span><input value={currency} onChange={ev=>setEnergySettings({currency:ev.target.value})}/></label>
    </div>
    <div className="summary-strip" style={{marginTop:14}}>
      <div className="summary"><small>{bi(lang,"استهلاك يومي","Daily use")}</small><b>{energy.dailyKwh.toFixed(2)} kWh</b></div>
      <div className="summary"><small>{bi(lang,"استهلاك شهري","Monthly use")}</small><b>{energy.monthlyKwh.toFixed(1)} kWh</b></div>
      <div className="summary"><small>{bi(lang,"تكلفة شهرية","Monthly cost")}</small><b>{price>0?`${energy.monthlyCost.toFixed(2)} ${currency}`:"—"}</b></div>
      <div className="summary"><small>{bi(lang,"أجهزة محسوبة","Configured devices")}</small><b>{energy.configured}/{tank.equipment.length}</b></div>
    </div>
    <div className="history-list" style={{marginTop:12}}>{energy.rows.filter(x=>x.monthlyKwh>0).map(x=><div className="history-row" key={x.equipment.id}><b>{x.equipment.name}</b><span>{x.monthlyKwh.toFixed(1)} kWh/{bi(lang,"شهر","mo")}{price>0?` • ${x.monthlyCost.toFixed(2)} ${currency}`:""}</span></div>)}</div>
    {!energy.configured&&<div className="inline-alert info" style={{marginTop:12}}>{bi(lang,"افتح كل تجهيزة وأدخل القدرة بالواط ومتوسط ساعات التشغيل باليوم. للمضخات المستمرة استخدم 24 ساعة؛ للسخان أدخل متوسط زمن التشغيل الفعلي وليس 24 ساعة تلقائياً.","Open each device and enter watts plus average operating hours/day. Use 24h for continuous pumps; for heaters use estimated actual ON-time rather than automatically assuming 24h.")}</div>}
  </section>

  <div className="equipment-grid full-span">{tank.equipment.map(x=>{const due=daysFrom(x.lastServiceAt,x.serviceIntervalDays??90),en=deviceEnergy(x,price);return <button type="button" className="equipment-card clickable" key={x.id} onClick={()=>setDetails(x.id)}><div className="equipment-card-head"><span className="eq-big-icon">⚙</span><span className="status">{x.status}</span></div><h3>{x.name}</h3><small>{x.brand} {x.model}</small><div className="equipment-meta"><span><b>{tr(lang,"location")}</b>{x.location}</span><span><b>{tr(lang,"due")}</b>{due}</span>{en.monthlyKwh>0&&<span><b>⚡</b>{en.monthlyKwh.toFixed(1)} kWh/mo</span>}</div></button>})}</div>

  <Modal open={open} title={tr(lang,"addEquipment")} onClose={()=>setOpen(false)}>
   <div className="form-grid">
    <label className="field"><span>{tr(lang,"name")}</span><input value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="field"><span>{tr(lang,"type")}</span><select value={kind} onChange={e=>setKind(e.target.value as EquipmentKind)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label>
    <label className="field"><span>{tr(lang,"location")}</span><select value={location} onChange={e=>setLocation(e.target.value)}><option value="display">{bi(lang,"الحوض الرئيسي","Display Tank")}</option><option value="external">{bi(lang,"خارجي","External")}</option>{tank.sump.chambers.map(c=><option key={c.id} value={`sump:${c.id}`}>{lang==="ar"?c.name:(c.nameEn||c.name)}</option>)}</select></label>
    <label className="field"><span>{tr(lang,"brandLabel")}</span><input value={brand} onChange={e=>setBrand(e.target.value)}/></label>
    <label className="field"><span>{tr(lang,"model")}</span><input value={model} onChange={e=>setModel(e.target.value)}/></label>
    <label className="field"><span>{tr(lang,"serviceInterval")}</span><input type="number" value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
    <label className="field"><span>{bi(lang,"القدرة W","Power W")}</span><input type="number" min="0" value={power||""} onChange={e=>setPower(Number(e.target.value))}/></label>
    <label className="field"><span>{bi(lang,"ساعات التشغيل / يوم","Hours / day")}</span><input type="number" min="0" max="24" step=".1" value={hours||""} onChange={e=>setHours(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"التدفق L/h","Flow L/h")}</span><input type="number" min="0" value={flowLph||""} onChange={e=>setFlowLph(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"الحجم المصنف L","Rated volume L")}</span><input type="number" min="0" value={ratedVolume||""} onChange={e=>setRatedVolume(Number(e.target.value))}/></label>
   </div>
   <div className="inline-alert info">{bi(lang,"الموقع المقترح يتغير تلقائياً حسب نوع الجهاز. أدخل Flow L/h للمضخات وRated Volume للأجهزة المصنفة بالحجم؛ Aqua Nexus يستخدمها لمقارنة التجهيزات بحجم الحوض والحمل الحيوي ضمن الصحة العامة.","The suggested location changes by device type. Enter Flow L/h for pumps and Rated Volume for volume-rated equipment; Aqua Nexus uses these to compare equipment against tank size and bioload in overall health.")}</div>
   <div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div>
  </Modal>

  <Modal open={!!e} title={e?.name??tr(lang,"equipment")} onClose={()=>setDetails(null)}>
   {e&&profile&&<>
    <div className="form-grid">
      <label className="field"><span>{tr(lang,"name")}</span><input value={e.name} onChange={ev=>updateDevice(e.id,x=>({...x,name:ev.target.value}))}/></label>
      <label className="field"><span>{tr(lang,"brandLabel")}</span><input value={e.brand??""} onChange={ev=>updateDevice(e.id,x=>({...x,brand:ev.target.value}))}/></label>
      <label className="field"><span>{tr(lang,"model")}</span><input value={e.model??""} onChange={ev=>updateDevice(e.id,x=>({...x,model:ev.target.value}))}/></label>
      <label className="field"><span>{tr(lang,"location")}</span><select value={e.location} onChange={ev=>setLocationLive(e.id,ev.target.value)}><option value="display">{bi(lang,"الحوض الرئيسي","Display Tank")}</option><option value="external">{bi(lang,"خارجي","External")}</option>{tank.sump.chambers.map(c=><option key={c.id} value={`sump:${c.id}`}>{lang==="ar"?c.name:(c.nameEn||c.name)}</option>)}</select></label>
      <label className="field"><span>{tr(lang,"status")}</span><select value={e.status} onChange={ev=>updateDevice(e.id,x=>({...x,status:ev.target.value}))}><option value="on">on</option><option value="off">off</option><option value="service">service</option><option value="warning">warning</option></select></label>
      <label className="field"><span>{tr(lang,"serviceInterval")}</span><input type="number" value={e.serviceIntervalDays??90} onChange={ev=>updateDevice(e.id,x=>({...x,serviceIntervalDays:Number(ev.target.value)}))}/></label>
      <label className="field"><span>{bi(lang,"القدرة W","Power W")}</span><input type="number" min="0" value={e.powerWatts??""} onChange={ev=>updateDevice(e.id,x=>({...x,powerWatts:Number(ev.target.value)}))}/></label>
      <label className="field"><span>{bi(lang,"متوسط التشغيل ساعة/يوم","Average hours/day")}</span><input type="number" min="0" max="24" step=".1" value={e.hoursPerDay??""} onChange={ev=>updateDevice(e.id,x=>({...x,hoursPerDay:Math.min(24,Number(ev.target.value))}))}/></label><label className="field"><span>{bi(lang,"التدفق L/h","Flow L/h")}</span><input type="number" min="0" value={e.flowLph??""} onChange={ev=>updateDevice(e.id,x=>({...x,flowLph:Number(ev.target.value)||undefined}))}/></label><label className="field"><span>{bi(lang,"الحجم المصنف L","Rated volume L")}</span><input type="number" min="0" value={e.ratedVolumeLiters??""} onChange={ev=>updateDevice(e.id,x=>({...x,ratedVolumeLiters:Number(ev.target.value)||undefined}))}/></label>
    </div>

    {(e.powerWatts||0)>0&&(e.hoursPerDay||0)>0&&(()=>{const en=deviceEnergy(e,price);return <div className="summary-strip" style={{marginTop:12}}><div className="summary"><small>{bi(lang,"يومياً","Daily")}</small><b>{en.dailyKwh.toFixed(2)} kWh</b></div><div className="summary"><small>{bi(lang,"شهرياً","Monthly")}</small><b>{en.monthlyKwh.toFixed(1)} kWh</b></div><div className="summary"><small>{bi(lang,"التكلفة","Cost")}</small><b>{price>0?`${en.monthlyCost.toFixed(2)} ${currency}`:"—"}</b></div></div>})()}

    <section className="card panel" style={{marginTop:14}}>
      <div className="module-head"><div><small className="eyebrow-mini">EQUIPMENT INTELLIGENCE</small><h3>{lang==="ar"?profile.titleAr:profile.titleEn}</h3></div></div>
      <h4>{bi(lang,"كيف بتشتغل؟","How it works")}</h4><p className="note">{lang==="ar"?profile.howAr:profile.howEn}</p>
      <div className="inline-alert info"><b>{bi(lang,"العمر الافتراضي التقريبي:","Approximate service life:")}</b> {lang==="ar"?profile.lifespanAr:profile.lifespanEn}</div>
      <div className="form-grid" style={{marginTop:12}}>
        <div><h4>{bi(lang,"نصائح تشغيل وصيانة","Operation & maintenance tips")}</h4><ul>{(lang==="ar"?profile.tipsAr:profile.tipsEn).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
        <div><h4>{bi(lang,"أشهر المشاكل","Common problems")}</h4><ul>{(lang==="ar"?profile.issuesAr:profile.issuesEn).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
      </div>
      <small className="note">{bi(lang,"العمر المذكور نطاق تقريبي وليس ضماناً؛ الموديل الحقيقي، جودة الكهرباء، الملوحة، الحرارة والصيانة ممكن تغيره بشكل كبير. تعليمات المصنع تبقى المرجع الأول.","Service-life ranges are approximate, not a warranty. Model, power quality, salinity, heat and maintenance can change them substantially; manufacturer guidance remains primary.")}</small>
    </section>

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
