"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import type { DisplayEquipmentPosition,EquipmentKind,Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AquariumScene } from "@/components/three/AquariumScene";
import { defaultDisplayPosition,resolvedOverflowReturnPosition,suggestedLocation } from "@/lib/displayLayout";
import { today,uid,daysFrom } from "@/lib/appUtils";
import { deviceEnergy,equipmentProfile,tankEnergy } from "@/domain/equipmentIntelligence";
import { equipmentAdequacy } from "@/domain/equipmentAdequacy";
import { createDefaultConsumables,equipmentLife,equipmentReliability,syncEquipmentSystem } from "@/domain/equipmentLifecycle";

const kinds:EquipmentKind[]=["lighting","waveMaker","overflow","skimmer","returnPump","filterSock","rollerFilter","reactor","heater","doser","uv","ozone","ato","refugiumLight","turfScrubber","probe","co2","other"];

export function EquipmentPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[details,setDetails]=useState<string|null>(null),[name,setName]=useState(""),[kind,setKind]=useState<EquipmentKind>("lighting"),[location,setLocation]=useState<string>("display"),[brand,setBrand]=useState(""),[model,setModel]=useState(""),[days,setDays]=useState(90),[power,setPower]=useState(0),[hours,setHours]=useState(0),[ratedVolume,setRatedVolume]=useState(0),[flowLph,setFlowLph]=useState(0),[par,setPar]=useState(0),[coverageLength,setCoverageLength]=useState(0),[coverageWidth,setCoverageWidth]=useState(0),[failureNote,setFailureNote]=useState(""),[advancedPosition,setAdvancedPosition]=useState(false),[positionPreview,setPositionPreview]=useState<{id:string;position:DisplayEquipmentPosition}|null>(null);
 const positionPreviewRef=useRef<{id:string;position:DisplayEquipmentPosition}|null>(null);
 const visualDevices=tank.equipment;
 const e=tank.equipment.find(x=>x.id===details);
 const activeDisplayPosition=e?(positionPreview?.id===e.id?positionPreview.position:(e.displayPosition??defaultDisplayPosition(e.kind,0,1))):undefined;
 const sceneTank=useMemo<Tank>(()=>positionPreview?{...tank,equipment:tank.equipment.map(x=>x.id===positionPreview.id?{...x,displayPosition:positionPreview.position}:x)}:tank,[tank,positionPreview]);
 const profile=e?equipmentProfile(e.kind):null;
 const price=tank.energySettings?.pricePerKwh??0;
 const currency=tank.energySettings?.currency||"USD";
 const energy=useMemo(()=>tankEnergy(tank),[tank.equipment,tank.energySettings?.pricePerKwh]);
 const adequacy=useMemo(()=>equipmentAdequacy(tank),[tank]);
 const reliability=useMemo(()=>equipmentReliability(tank),[tank]);
 useEffect(()=>{if(open)setLocation(suggestedLocation(kind,tank.sump.chambers))},[kind,open,tank.sump.chambers]);
 useEffect(()=>{const synced=syncEquipmentSystem(tank);if(JSON.stringify(synced.equipment)!==JSON.stringify(tank.equipment)||JSON.stringify(synced.maintenance)!==JSON.stringify(tank.maintenance))patch(tank.id,t=>({...t,...synced}));},[tank.id,tank.equipment.length]);

 function add(){
  const similar=tank.equipment.filter(x=>x.location==="display"&&x.kind===kind).length;
  const displayPosition=location==="display"?defaultDisplayPosition(kind,similar,similar+1):undefined;
  patch(tank.id,t=>({...t,equipment:[...t.equipment,{id:uid("eq"),name:name||kind,kind,brand,model,location:location as any,installedAt:today(),lastServiceAt:today(),serviceIntervalDays:days,status:"on",displayPosition,overflowPlumbingMode:kind==="overflow"?"combined":undefined,powerWatts:power>0?power:undefined,hoursPerDay:hours>0?Math.min(24,hours):undefined,ratedVolumeLiters:ratedVolume>0?ratedVolume:undefined,flowLph:flowLph>0?flowLph:undefined,parAtTargetDepth:par>0?par:undefined,coverageLengthCm:coverageLength>0?coverageLength:undefined,coverageWidthCm:coverageWidth>0?coverageWidth:undefined,consumables:createDefaultConsumables(kind)}]}));
  setOpen(false);setName("");setBrand("");setModel("");setPower(0);setHours(0);setRatedVolume(0);setFlowLph(0);setPar(0);setCoverageLength(0);setCoverageWidth(0);
 }
 const service=(id:string)=>patch(tank.id,t=>{const nextEquipment=t.equipment.map(x=>x.id===id?{...x,lastServiceAt:today(),status:"on" as const,postActionCheckAt:new Date(Date.now()+24*3600000).toISOString()}:x);const synced=syncEquipmentSystem({...t,equipment:nextEquipment});const eq=nextEquipment.find(x=>x.id===id);return {...t,...synced,timeline:[{id:uid("ev"),timestamp:new Date().toISOString(),type:"equipment-service",textAr:`تم تسجيل صيانة ${eq?.name||"الجهاز"}؛ فحص ما بعد الإجراء خلال 24 ساعة.`,textEn:`Service logged for ${eq?.name||"equipment"}; post-action check due within 24 hours.`},...t.timeline]};});
 const remove=(id:string)=>patch(tank.id,t=>{const removed=t.equipment.find(x=>x.id===id),nextEquipment=t.equipment.filter(x=>x.id!==id);const synced=syncEquipmentSystem({...t,equipment:nextEquipment}),ts=new Date().toISOString();return {...t,...synced,timeline:removed?[{id:uid("ev"),timestamp:ts,type:"equipment-removed",textAr:`تمت إزالة الجهاز ${removed.name} من النظام.`,textEn:`Removed equipment ${removed.name} from the system.`},...t.timeline]:t.timeline};});
 function updateDevice(id:string, updater:(x:any)=>any){patch(tank.id,t=>({...t,equipment:t.equipment.map(x=>x.id===id?updater(x):x)}));}
 function setLocationLive(id:string,loc:string){updateDevice(id,x=>({...x,location:loc,displayPosition:loc==="display"?(x.displayPosition??defaultDisplayPosition(x.kind,0,1)):x.displayPosition}));}
 function posPatch(id:string,p:Partial<DisplayEquipmentPosition>){updateDevice(id,x=>({...x,displayPosition:{...defaultDisplayPosition(x.kind,0,1),...(x.displayPosition??{}),...p}}));}
 function setTouchPreview(next:{id:string;position:DisplayEquipmentPosition}|null){
  positionPreviewRef.current=next;
  setPositionPreview(next);
 }
 function touchPosition(id:string,kind:EquipmentKind,plane:"top"|"front",ev:any){
  const rect=(ev.currentTarget as HTMLElement).getBoundingClientRect();
  const px=Math.max(0,Math.min(1,(ev.clientX-rect.left)/Math.max(1,rect.width)));
  const py=Math.max(0,Math.min(1,(ev.clientY-rect.top)/Math.max(1,rect.height)));
  const device=tank.equipment.find(x=>x.id===id);
  const current=positionPreviewRef.current?.id===id?positionPreviewRef.current.position:{...defaultDisplayPosition(kind,0,1),...(device?.displayPosition??{})};
  const next=plane==="top"
   ?{...current,xPct:2+px*96,zPct:2+py*96}
   :{...current,xPct:2+px*96,yPct:kind==="lighting"?145-py*43:95-py*90};
  setTouchPreview({id,position:next});
 }
 function commitTouchPosition(id:string){
  const preview=positionPreviewRef.current;
  if(preview?.id!==id)return;
  updateDevice(id,x=>({...x,displayPosition:preview.position}));
  setTouchPreview(null);
 }
 function returnPosPatch(id:string,p:Partial<DisplayEquipmentPosition>){
  updateDevice(id,x=>({...x,overflowReturnPosition:{...resolvedOverflowReturnPosition({...x,overflowPlumbingMode:"separate"},0,1),...(x.overflowReturnPosition??{}),...p}}));
 }
 function setEnergySettings(p:Partial<{pricePerKwh:number;currency:string}>){patch(tank.id,t=>({...t,energySettings:{pricePerKwh:t.energySettings?.pricePerKwh??0,currency:t.energySettings?.currency||"USD",...p}}));}
 function logFailure(id:string){const note=failureNote.trim()||bi(lang,"عطل مسجل بدون ملاحظات","Failure logged without notes");patch(tank.id,t=>({...t,equipment:t.equipment.map(x=>x.id===id?{...x,status:"warning" as const,failures:[...(x.failures??[]),{id:uid("fail"),timestamp:new Date().toISOString(),note}],postActionCheckAt:new Date(Date.now()+24*3600000).toISOString()}:x),timeline:[{id:uid("ev"),timestamp:new Date().toISOString(),type:"equipment-failure",textAr:`تم تسجيل عطل على ${t.equipment.find(x=>x.id===id)?.name||"جهاز"}: ${note}`,textEn:`Equipment failure logged: ${note}`},...t.timeline]}));setFailureNote("");}

 return <section className="page-grid">
  <PageHeader eyebrow="EQUIPMENT" title={tr(lang,"equipment")} actions={<button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addEquipment")}</button>}/>
  {tank.equipment.length===0&&<div className="inline-alert info full-span"><div><b>⚙ {bi(lang,"ابدأ بالمعدات الموجودة فعلياً عندك، مو بالمواصفات المثالية.","Start with the equipment you actually have, not an ideal setup.")}</b><p>{bi(lang,"ضيف الأجهزة الأساسية أولاً. الاسم والنوع والموقع كافيين كبداية؛ Flow وRated Volume وPAR والطاقة معلومات إضافية بتحسن دقة التقييم لما تعرفها.","Add the main devices first. Name, type and location are enough to begin; flow, rated volume, PAR and power are optional details that improve the assessment when you know them.")}</p><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addEquipment")}</button></div></div>}
  <section className="card panel full-span">
   <div className="module-head"><div><small className="eyebrow-mini">SYSTEM EQUIPMENT HEALTH</small><h3>{bi(lang,"كفاية تجهيزات الحوض","Aquarium Equipment Adequacy")}</h3><p className="note">{lang==="ar"?adequacy.basisAr:adequacy.basisEn}</p></div><span className={`status ${adequacy.level==="danger"?"danger":adequacy.level==="warn"?"warn":""}`}>{adequacy.score}%</span></div>
   <div className="form-grid compact-fields"><label className="field"><span>{bi(lang,"بروفايل الحوض","Aquarium profile")}</span><select value={tank.ecosystemProfile??"auto"} onChange={ev=>patch(tank.id,t=>({...t,ecosystemProfile:ev.target.value==="auto"?undefined:ev.target.value as any}))}><option value="auto">{bi(lang,"تلقائي","Auto detect")}</option>{tank.type==="marine"?<><option value="reef">Reef</option><option value="fishOnly">Fish-only</option></>:<><option value="planted">Planted</option><option value="fishOnly">{bi(lang,"أسماك فقط","Fish-only")}</option></>}</select></label><div className="inline-alert info">{bi(lang,`البروفايل الحالي: ${adequacy.profile}. إذا الحوض Reef اختاره صراحةً حتى تصبح الإنارة وحركة الماء متطلبات فعلية.`,`Current profile: ${adequacy.profile}. Explicitly choose Reef when appropriate so lighting and circulation become required.`)}</div></div>
   <div className="summary-strip" style={{marginTop:12}}><div className="summary"><small>{bi(lang,"وجود الأساسيات","Core presence")}</small><b>{adequacy.presenceScore}%</b></div><div className="summary"><small>{bi(lang,"القدرة والحجم","Sizing / capacity")}</small><b>{adequacy.capacityScore}%</b></div><div className="summary"><small>{bi(lang,"حالة الأجهزة","Device condition")}</small><b>{adequacy.statusScore}%</b></div><div className="summary"><small>{bi(lang,"العمر والاحتياط","Lifecycle & redundancy")}</small><b>{adequacy.reliabilityScore}%</b></div><div className="summary"><small>{bi(lang,"ثقة بيانات القياس","Sizing data confidence")}</small><b>{adequacy.dataConfidence}%</b></div></div>
   {adequacy.headroom.length>0&&<div className="history-list" style={{marginTop:12}}>{adequacy.headroom.map(x=><div className="history-row" key={x.key}><b>{lang==="ar"?x.ar:x.en}</b><span className={`status ${x.level==="warn"?"warn":""}`}>{x.valuePct>=0?"+":""}{x.valuePct}%</span></div>)}</div>}
   <div style={{display:"grid",gap:8,marginTop:12}}>{adequacy.issues.map(x=><div className={`inline-alert ${x.level}`} key={x.id}><b>{lang==="ar"?x.ar:x.en}</b>{(x.recommendationAr||x.recommendationEn)&&<p>{lang==="ar"?x.recommendationAr:x.recommendationEn}</p>}</div>)}{adequacy.suggestions.map(x=><div className={`inline-alert ${x.level}`} key={x.id}><b>💡 {lang==="ar"?x.ar:x.en}</b>{(x.recommendationAr||x.recommendationEn)&&<p>{lang==="ar"?x.recommendationAr:x.recommendationEn}</p>}</div>)}{!adequacy.issues.length&&!adequacy.suggestions.length&&<div className="inline-alert good">✓ {bi(lang,"التجهيزات الحالية مكتملة ومقاسة بشكل كافٍ للبروفايل المسجل.","Current equipment is complete and sufficiently measured for the registered profile.")}</div>}</div>
  </section>
  <section className="card panel full-span">
   <div className="module-head"><div><small className="eyebrow-mini">LIFECYCLE • RESILIENCE • SPARES</small><h3>{bi(lang,"العمر الافتراضي والاحتياط وقطع الاستهلاك","Lifecycle, redundancy & consumables")}</h3><p className="note">{bi(lang,"ما عاد وجود الجهاز وحده كافي. Aqua Nexus يتابع عمره، تكرار أعطاله، نقطة الفشل الواحدة، توفر البديل، وقطع الاستهلاك.","Presence alone is not enough. Aqua Nexus tracks lifecycle, repeated failures, single points of failure, backup readiness and consumables.")}</p></div><span className="status">{reliability.score}%</span></div>
   <div className="summary-strip"><div className="summary"><small>{bi(lang,"العمر/الأعطال","Lifecycle")}</small><b>{reliability.lifecycleScore}%</b></div><div className="summary"><small>{bi(lang,"الازدواجية والاحتياط","Redundancy")}</small><b>{reliability.redundancyScore}%</b></div><div className="summary"><small>{bi(lang,"قطع الاستهلاك","Consumables")}</small><b>{reliability.consumablesScore}%</b></div><div className="summary"><small>{bi(lang,"مهام صيانة آلية","Auto maintenance")}</small><b>{tank.maintenance.filter(x=>x.autoGenerated).length}</b></div></div>
  </section>
  <section className="card panel full-span display-layout-workspace">
    <div className="module-head"><div><h3>{bi(lang,"المجسم الحي للنظام والتجهيزات","Live System & Equipment Layout")}</h3><p className="note">{bi(lang,"الحوض والسامب والتجهيزات الخارجية تظهر معاً. أي إضافة أو تعديل يتحدث فوراً.","Display, sump and external devices are shown together. Every change updates immediately.")}</p></div></div>
    <div className="display-layout-grid">
      <div className="display-layout-scene equipment-system-scene"><AquariumScene tank={sceneTank} view="system"/></div>
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

  <div className="equipment-grid full-span">{tank.equipment.map(x=>{const due=daysFrom(x.lastServiceAt,x.serviceIntervalDays??90),en=deviceEnergy(x,price),life=equipmentLife(x);return <button type="button" className="equipment-card clickable" key={x.id} onClick={()=>setDetails(x.id)}><div className="equipment-card-head"><span className="eq-big-icon">⚙</span><span className="status">{x.status}</span></div><h3>{x.name}</h3><small>{x.brand} {x.model}</small><div className="equipment-meta"><span><b>{tr(lang,"location")}</b>{x.location}</span><span><b>{tr(lang,"due")}</b>{due}</span><span><b>{bi(lang,"العمر","Life")}</b>{life.usedPercent}% • {life.status}</span><span><b>{bi(lang,"الأهمية","Criticality")}</b>{x.criticality??"—"}</span>{en.monthlyKwh>0&&<span><b>⚡</b>{en.monthlyKwh.toFixed(1)} kWh/mo</span>}</div></button>})}</div>

  <Modal open={open} title={tr(lang,"addEquipment")} onClose={()=>setOpen(false)}>
   <div className="form-grid">
    <label className="field"><span>{tr(lang,"name")}</span><input value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="field"><span>{tr(lang,"type")}</span><select value={kind} onChange={e=>setKind(e.target.value as EquipmentKind)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label>
    <label className="field"><span>{tr(lang,"location")}</span><select value={location} onChange={e=>setLocation(e.target.value)}><option value="display">{bi(lang,"الحوض الرئيسي","Display Tank")}</option><option value="external">{bi(lang,"خارجي","External")}</option>{tank.sump.chambers.map(c=><option key={c.id} value={`sump:${c.id}`}>{lang==="ar"?c.name:(c.nameEn||c.name)}</option>)}</select></label>
    <label className="field"><span>{tr(lang,"brandLabel")}</span><input value={brand} onChange={e=>setBrand(e.target.value)}/></label>
    <label className="field"><span>{tr(lang,"model")}</span><input value={model} onChange={e=>setModel(e.target.value)}/></label>
    <label className="field"><span>{tr(lang,"serviceInterval")}</span><input type="number" value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
    <label className="field"><span>{bi(lang,"القدرة W","Power W")}</span><input type="number" min="0" value={power||""} onChange={e=>setPower(Number(e.target.value))}/></label>
    <label className="field"><span>{bi(lang,"ساعات التشغيل / يوم","Hours / day")}</span><input type="number" min="0" max="24" step=".1" value={hours||""} onChange={e=>setHours(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"التدفق L/h","Flow L/h")}</span><input type="number" min="0" value={flowLph||""} onChange={e=>setFlowLph(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"الحجم المصنف L","Rated volume L")}</span><input type="number" min="0" value={ratedVolume||""} onChange={e=>setRatedVolume(Number(e.target.value))}/></label>{kind==="lighting"&&<><label className="field"><span>PAR {bi(lang,"عند عمق الكائنات","at livestock depth")}</span><input type="number" min="0" value={par||""} onChange={e=>setPar(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"تغطية الطول cm","Coverage length cm")}</span><input type="number" min="0" value={coverageLength||""} onChange={e=>setCoverageLength(Number(e.target.value))}/></label><label className="field"><span>{bi(lang,"تغطية العرض cm","Coverage width cm")}</span><input type="number" min="0" value={coverageWidth||""} onChange={e=>setCoverageWidth(Number(e.target.value))}/></label></>}
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
      <label className="field"><span>{bi(lang,"متوسط التشغيل ساعة/يوم","Average hours/day")}</span><input type="number" min="0" max="24" step=".1" value={e.hoursPerDay??""} onChange={ev=>updateDevice(e.id,x=>({...x,hoursPerDay:Math.min(24,Number(ev.target.value))}))}/></label><label className="field"><span>{bi(lang,"التدفق L/h","Flow L/h")}</span><input type="number" min="0" value={e.flowLph??""} onChange={ev=>updateDevice(e.id,x=>({...x,flowLph:Number(ev.target.value)||undefined}))}/></label><label className="field"><span>{bi(lang,"الحجم المصنف L","Rated volume L")}</span><input type="number" min="0" value={e.ratedVolumeLiters??""} onChange={ev=>updateDevice(e.id,x=>({...x,ratedVolumeLiters:Number(ev.target.value)||undefined}))}/></label>{e.kind==="co2"&&<><label className="field"><span>{bi(lang,"نمط CO₂","CO₂ mode")}</span><select value={e.co2Mode??"injected"} onChange={ev=>updateDevice(e.id,x=>({...x,co2Mode:ev.target.value as any}))}><option value="injected">{bi(lang,"حقن CO₂","Injected CO₂")}</option><option value="lowTech">Low-tech</option></select></label><label className="field"><span>{bi(lang,"المتبقي بالأسطوانة %","Cylinder remaining %")}</span><input type="number" min="0" max="100" value={e.co2CylinderRemainingPercent??""} onChange={ev=>updateDevice(e.id,x=>({...x,co2CylinderRemainingPercent:Number(ev.target.value)}))}/></label><label className="field"><span>Drop checker</span><select value={e.co2DropChecker??"unknown"} onChange={ev=>updateDevice(e.id,x=>({...x,co2DropChecker:ev.target.value as any}))}><option value="unknown">—</option><option value="blue">Blue</option><option value="green">Green</option><option value="yellow">Yellow</option></select></label></>}{e.kind==="lighting"&&<><label className="field"><span>PAR {bi(lang,"عند عمق الكائنات","at livestock depth")}</span><input type="number" min="0" value={e.parAtTargetDepth??""} onChange={ev=>updateDevice(e.id,x=>({...x,parAtTargetDepth:Number(ev.target.value)||undefined}))}/></label><label className="field"><span>{bi(lang,"تغطية الطول cm","Coverage length cm")}</span><input type="number" min="0" value={e.coverageLengthCm??""} onChange={ev=>updateDevice(e.id,x=>({...x,coverageLengthCm:Number(ev.target.value)||undefined}))}/></label><label className="field"><span>{bi(lang,"تغطية العرض cm","Coverage width cm")}</span><input type="number" min="0" value={e.coverageWidthCm??""} onChange={ev=>updateDevice(e.id,x=>({...x,coverageWidthCm:Number(ev.target.value)||undefined}))}/></label></>}<label className="field"><span>{bi(lang,"العمر المتوقع الأدنى / سنة","Expected life min / years")}</span><input type="number" min="0" step=".5" value={((e.expectedLifeMinDays??0)/365)||""} onChange={ev=>updateDevice(e.id,x=>({...x,expectedLifeMinDays:Math.round(Number(ev.target.value)*365)||undefined}))}/></label><label className="field"><span>{bi(lang,"العمر المتوقع الأعلى / سنة","Expected life max / years")}</span><input type="number" min="0" step=".5" value={((e.expectedLifeMaxDays??0)/365)||""} onChange={ev=>updateDevice(e.id,x=>({...x,expectedLifeMaxDays:Math.round(Number(ev.target.value)*365)||undefined}))}/></label><label className="field"><span>{bi(lang,"الأهمية","Criticality")}</span><select value={e.criticality??"normal"} onChange={ev=>updateDevice(e.id,x=>({...x,criticality:ev.target.value}))}><option value="critical">{bi(lang,"حرج","Critical")}</option><option value="important">{bi(lang,"مهم","Important")}</option><option value="normal">{bi(lang,"عادي","Normal")}</option></select></label><label className="field"><span>{bi(lang,"مجموعة الازدواجية","Redundancy group")}</span><input value={e.redundancyGroup??""} onChange={ev=>updateDevice(e.id,x=>({...x,redundancyGroup:ev.target.value}))}/></label><label className="field"><span>{bi(lang,"خطة Backup","Backup plan")}</span><input value={e.backupPlan??""} onChange={ev=>updateDevice(e.id,x=>({...x,backupPlan:ev.target.value}))}/></label><label className="field"><span>{bi(lang,"قطعة/جهاز احتياطي متوفر","Spare available")}</span><select value={e.spareAvailable?"yes":"no"} onChange={ev=>updateDevice(e.id,x=>({...x,spareAvailable:ev.target.value==="yes"}))}><option value="no">{bi(lang,"لا","No")}</option><option value="yes">{bi(lang,"نعم","Yes")}</option></select></label>
    </div>

    {(()=>{const life=equipmentLife(e);return <div className="summary-strip" style={{marginTop:12}}><div className="summary"><small>{bi(lang,"العمر المستهلك","Life used")}</small><b>{life.usedPercent}%</b></div><div className="summary"><small>{bi(lang,"الأعطال المسجلة","Failures")}</small><b>{life.failures}</b></div><div className="summary"><small>{bi(lang,"نافذة الاستبدال","Replacement window")}</small><b>{Math.round(life.minDays/365)}–{Math.round(life.maxDays/365)}y</b></div><div className="summary"><small>{bi(lang,"المتابعة","Follow-up")}</small><b>{e.postActionCheckAt?new Date(e.postActionCheckAt).toLocaleDateString():"—"}</b></div></div>})()}
    {(e.powerWatts||0)>0&&(e.hoursPerDay||0)>0&&(()=>{const en=deviceEnergy(e,price);return <div className="summary-strip" style={{marginTop:12}}><div className="summary"><small>{bi(lang,"يومياً","Daily")}</small><b>{en.dailyKwh.toFixed(2)} kWh</b></div><div className="summary"><small>{bi(lang,"شهرياً","Monthly")}</small><b>{en.monthlyKwh.toFixed(1)} kWh</b></div><div className="summary"><small>{bi(lang,"التكلفة","Cost")}</small><b>{price>0?`${en.monthlyCost.toFixed(2)} ${currency}`:"—"}</b></div></div>})()}

    <section className="card panel" style={{marginTop:14}}>
      <div className="module-head"><div><small className="eyebrow-mini">CONSUMABLES & SPARES</small><h3>{bi(lang,"قطع الاستهلاك والمخزون","Consumables & spare stock")}</h3></div></div>
      {(e.consumables??[]).length?(e.consumables??[]).map(c=><div className="history-row" key={c.id}><div><b>{lang==="ar"?c.name:(c.nameEn||c.name)}</b><small>{bi(lang,"عمر مرجعي","Reference life")}: {c.lifeDays??"—"} {bi(lang,"يوم","days")}</small></div><label className="field" style={{maxWidth:120}}><span>{bi(lang,"المخزون","Stock")} ({c.unit??"pc"})</span><input type="number" min="0" value={c.quantityOnHand??0} onChange={ev=>updateDevice(e.id,x=>({...x,consumables:(x.consumables??[]).map((z:any)=>z.id===c.id?{...z,quantityOnHand:Number(ev.target.value)}:z)}))}/></label><button className="btn" onClick={()=>updateDevice(e.id,x=>({...x,consumables:(x.consumables??[]).map((z:any)=>z.id===c.id?{...z,installedAt:today()}:z)}))}>{bi(lang,"تم الاستبدال","Replaced")}</button></div>):<div className="inline-alert info">{bi(lang,"ما في قطع استهلاك افتراضية لهالنوع.","No default consumables for this equipment type.")}</div>}
    </section>
    <section className="card panel" style={{marginTop:14}}>
      <div className="module-head"><div><small className="eyebrow-mini">FAILURE HISTORY</small><h3>{bi(lang,"سجل الأعطال والمتابعة","Failure history & follow-up")}</h3></div></div>
      <div className="form-grid"><label className="field"><span>{bi(lang,"ملاحظة العطل","Failure note")}</span><input value={failureNote} onChange={ev=>setFailureNote(ev.target.value)} placeholder={bi(lang,"مثال: صوت مرتفع وانخفاض التدفق","e.g. noise and reduced flow")}/></label><button className="btn danger" type="button" onClick={()=>logFailure(e.id)}>{bi(lang,"سجل عطل","Log failure")}</button></div>
      {(e.failures??[]).slice().reverse().slice(0,5).map(f=><div className="history-row" key={f.id}><b>{new Date(f.timestamp).toLocaleDateString()}</b><span>{f.note}</span></div>)}
    </section>
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
      <div className="module-head"><div><h4>{e.kind==="overflow"?bi(lang,"موضع الأوفر فلو / نزول الماء","Overflow / Drain Position"):bi(lang,"حرّك الجهاز باللمس","Place device by touch")}</h4><p className="note">{bi(lang,"اسحب بإصبعك أو اضغط بالمكان المطلوب. الأرقام تنحفظ بالخلف تلقائياً، والضبط الرقمي موجود ضمن Advanced.","Drag or tap where you want the device. Coordinates are stored automatically; numeric fine tuning stays under Advanced.")}</p></div><button className="btn" onClick={()=>setAdvancedPosition(v=>!v)}>{advancedPosition?bi(lang,"إخفاء Advanced","Hide Advanced"):bi(lang,"Advanced","Advanced")}</button></div>
      <div className="touch-position-grid">
        <div><small>{bi(lang,"من الأعلى — يمين/يسار + أمام/خلف","Top view — left/right + front/back")}</small><div className="touch-position-pad" onPointerDown={ev=>{touchPosition(e.id,e.kind,"top",ev);try{(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId)}catch{}}} onPointerMove={ev=>{if(positionPreviewRef.current?.id===e.id)touchPosition(e.id,e.kind,"top",ev)}} onPointerUp={()=>commitTouchPosition(e.id)} onPointerCancel={()=>setTouchPreview(null)}>
          <span className="touch-grid-line v one"/><span className="touch-grid-line v two"/><span className="touch-grid-line h one"/><span className="touch-grid-line h two"/>
          <i className="touch-device-dot" style={{left:`${activeDisplayPosition?.xPct??defaultDisplayPosition(e.kind).xPct}%`,top:`${activeDisplayPosition?.zPct??defaultDisplayPosition(e.kind).zPct}%`}}>⚙</i>
        </div></div>
        <div><small>{bi(lang,"من الأمام — يمين/يسار + ارتفاع","Front view — left/right + height")}</small><div className="touch-position-pad front" onPointerDown={ev=>{touchPosition(e.id,e.kind,"front",ev);try{(ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId)}catch{}}} onPointerMove={ev=>{if(positionPreviewRef.current?.id===e.id)touchPosition(e.id,e.kind,"front",ev)}} onPointerUp={()=>commitTouchPosition(e.id)} onPointerCancel={()=>setTouchPreview(null)}>
          <span className="touch-grid-line v one"/><span className="touch-grid-line v two"/><span className="touch-grid-line h one"/><span className="touch-grid-line h two"/>
          <i className="touch-device-dot" style={{left:`${activeDisplayPosition?.xPct??defaultDisplayPosition(e.kind).xPct}%`,top:`${e.kind==="lighting"?Math.max(0,Math.min(100,(145-(activeDisplayPosition?.yPct??defaultDisplayPosition(e.kind).yPct))/43*100)):Math.max(0,Math.min(100,(95-(activeDisplayPosition?.yPct??defaultDisplayPosition(e.kind).yPct))/90*100))}%`}}>⚙</i>
        </div></div>
      </div>
      <div className="touch-rotation-row"><span>{bi(lang,"اتجاه الجهاز","Device direction")} <b>{Math.round(e.displayPosition?.rotationY??defaultDisplayPosition(e.kind).rotationY??0)}°</b></span><button className="btn" onClick={()=>posPatch(e.id,{rotationY:((e.displayPosition?.rotationY??0)-15+360)%360})}>↶ 15°</button><button className="btn" onClick={()=>posPatch(e.id,{rotationY:((e.displayPosition?.rotationY??0)+15)%360})}>15° ↷</button></div>
      {advancedPosition&&<div className="advanced-position-panel">
        <label className="range-field"><span>X {Math.round(e.displayPosition?.xPct??defaultDisplayPosition(e.kind).xPct)}%</span><input type="range" min="2" max="98" value={e.displayPosition?.xPct??defaultDisplayPosition(e.kind).xPct} onChange={ev=>posPatch(e.id,{xPct:Number(ev.target.value)})}/></label>
        <label className="range-field"><span>{e.kind==="lighting"?bi(lang,"الارتفاع","Height"):"Y"} {Math.round(e.displayPosition?.yPct??defaultDisplayPosition(e.kind).yPct)}%</span><input type="range" min={e.kind==="lighting"?102:5} max={e.kind==="lighting"?145:95} value={e.displayPosition?.yPct??defaultDisplayPosition(e.kind).yPct} onChange={ev=>posPatch(e.id,{yPct:Number(ev.target.value)})}/></label>
        <label className="range-field"><span>Z {Math.round(e.displayPosition?.zPct??defaultDisplayPosition(e.kind).zPct)}%</span><input type="range" min="2" max="98" value={e.displayPosition?.zPct??defaultDisplayPosition(e.kind).zPct} onChange={ev=>posPatch(e.id,{zPct:Number(ev.target.value)})}/></label>
        <label className="range-field"><span>{bi(lang,"الدوران","Rotation")} {Math.round(e.displayPosition?.rotationY??defaultDisplayPosition(e.kind).rotationY??0)}°</span><input type="range" min="0" max="359" value={e.displayPosition?.rotationY??defaultDisplayPosition(e.kind).rotationY??0} onChange={ev=>posPatch(e.id,{rotationY:Number(ev.target.value)})}/></label>
        <label className="range-field"><span>{bi(lang,"الحجم","Scale")} {(e.displayPosition?.scale??1).toFixed(2)}</span><input type="range" min="0.55" max="1.65" step=".05" value={e.displayPosition?.scale??1} onChange={ev=>posPatch(e.id,{scale:Number(ev.target.value)})}/></label>
        {e.kind==="waveMaker"&&<label className="range-field"><span>{bi(lang,"قوة حركة الماء","Flow Strength")} {Math.round(e.displayPosition?.flowStrength??100)}%</span><input type="range" min="20" max="160" value={e.displayPosition?.flowStrength??100} onChange={ev=>posPatch(e.id,{flowStrength:Number(ev.target.value)})}/></label>}
      </div>}
      {e.kind==="overflow"&&<div className="overflow-plumbing-editor">
        <h4>{bi(lang,"توصيل الأوفر فلو","Overflow Plumbing")}</h4>
        <label className="field"><span>{bi(lang,"طريقة الصاعد والنازل","Drain / Return Arrangement")}</span><select value={e.overflowPlumbingMode??"combined"} onChange={ev=>updateDevice(e.id,x=>({...x,overflowPlumbingMode:ev.target.value}))}><option value="combined">{bi(lang,"الصاعد والنازل ضمن نفس الأوفر فلو","Drain + Return inside same overflow")}</option><option value="separate">{bi(lang,"النازل بالأوفر فلو والصاعد بمكان منفصل","Drain in overflow + separate return outlet")}</option></select></label>
        {(e.overflowPlumbingMode??"combined")==="combined"?<div className="inline-alert good">{bi(lang,"الصاعد يتحرك تلقائياً مع الأوفر فلو.","The return follows the overflow automatically.")}</div>:<div className="return-position-editor"><h4>{bi(lang,"موضع الصاعد — Advanced","Return outlet — Advanced")}</h4><label className="range-field"><span>X {Math.round(resolvedOverflowReturnPosition(e).xPct)}%</span><input type="range" min="2" max="98" value={resolvedOverflowReturnPosition(e).xPct} onChange={ev=>returnPosPatch(e.id,{xPct:Number(ev.target.value)})}/></label><label className="range-field"><span>Y {Math.round(resolvedOverflowReturnPosition(e).yPct)}%</span><input type="range" min="8" max="94" value={resolvedOverflowReturnPosition(e).yPct} onChange={ev=>returnPosPatch(e.id,{yPct:Number(ev.target.value)})}/></label><label className="range-field"><span>Z {Math.round(resolvedOverflowReturnPosition(e).zPct)}%</span><input type="range" min="2" max="98" value={resolvedOverflowReturnPosition(e).zPct} onChange={ev=>returnPosPatch(e.id,{zPct:Number(ev.target.value)})}/></label></div>}
      </div>}
      <div className="inline-alert info">{bi(lang,"أثناء السحب يتحدث المجسم كمعاينة محلية، وعند رفع إصبعك يحفظ Aqua Nexus الموضع مرة واحدة فقط. هيك منمنع عشرات عمليات الحفظ والتحليل أثناء الحركة، وAdvanced يبقى للضبط الدقيق.","Dragging updates a local live preview; Aqua Nexus commits the position once when you release. This avoids repeated persistence and intelligence recalculation during movement, while Advanced remains available for fine tuning.")}</div>
    </div>}
    <div className="modal-actions"><button className="btn danger" onClick={()=>{remove(e.id);setDetails(null)}}>{tr(lang,"delete")}</button><button className="btn good" onClick={()=>service(e.id)}>{tr(lang,"serviceDone")}</button></div><style jsx>{`
      .touch-position-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.touch-position-grid>div{display:grid;gap:6px}.touch-position-grid small{opacity:.68}
      .touch-position-pad{position:relative;height:180px;border:1px solid rgba(94,225,216,.24);border-radius:16px;background:linear-gradient(180deg,rgba(48,180,210,.08),rgba(4,25,36,.35));overflow:hidden;touch-action:none;user-select:none}
      .touch-position-pad.front{background:linear-gradient(180deg,rgba(55,195,225,.06),rgba(4,25,36,.38))}
      .touch-grid-line{position:absolute;background:rgba(255,255,255,.055);pointer-events:none}.touch-grid-line.v{top:0;bottom:0;width:1px}.touch-grid-line.h{left:0;right:0;height:1px}.touch-grid-line.one.v{left:33.33%}.touch-grid-line.two.v{left:66.66%}.touch-grid-line.one.h{top:33.33%}.touch-grid-line.two.h{top:66.66%}
      .touch-device-dot{position:absolute;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(36,213,205,.18);border:2px solid rgba(100,235,225,.7);box-shadow:0 0 18px rgba(52,220,210,.24);font-style:normal;pointer-events:none}
      .touch-rotation-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.touch-rotation-row>span{margin-inline-end:auto}.advanced-position-panel{display:grid;gap:8px;margin-top:10px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025)}
      @media(max-width:620px){.touch-position-grid{grid-template-columns:1fr}.touch-position-pad{height:150px}}
    `}</style>
   </>}
  </Modal>
 </section>;
}
