"use client";
import { useMemo,useState } from "react";
import type { InventoryCategory,InventoryConsumer,InventoryItem,Tank } from "@/domain/types";
import { INVENTORY_PRESETS } from "@/data/legacyCatalogs";
import { DOSING_PRESETS } from "@/domain/dosingCalculator";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { uid } from "@/lib/appUtils";
import { inventoryCategoryLabel,inventoryProfile,inventorySubcategoryLabel,inventorySubcategoryOptions,unifiedInventory } from "@/domain/inventoryIntelligence";

const consumersByCategory:Record<InventoryCategory,InventoryConsumer[]>={
 feeding:["feeding"],fertilizer:["fertilizer"],co2:["co2"],dosing:["dosing"],supplement:["dosing"],
 filter_media:["sump"],coral_treatment:["acclimation"],medication:["quarantine"],water_prep:["waterChange"],
 equipment:["equipment"],testing:["testing"],rodi:["rodi"],other:[]
};
const presetDoseParam:Record<string,"KH"|"Ca"|"Mg"|undefined>={khBuffer:"KH",calcium:"Ca",magnesium:"Mg"};

export function InventoryPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[preset,setPreset]=useState(""),[custom,setCustom]=useState(""),[qty,setQty]=useState(0),[unit,setUnit]=useState("g"),[min,setMin]=useState(0);
 const [category,setCategory]=useState<InventoryCategory>("other"),[subcategory,setSubcategory]=useState("other"),[customSubcategory,setCustomSubcategory]=useState(""),[compatibility,setCompatibility]=useState<"marine"|"freshwater"|"both">(tank.type),[dosingParameter,setDosingParameter]=useState<"KH"|"Ca"|"Mg">("KH"),[dosingCompoundId,setDosingCompoundId]=useState("");
 const presets:any[]=[...(INVENTORY_PRESETS as any).common,...(((INVENTORY_PRESETS as any)[tank.type])??[])],p=presets.find(x=>x.id===preset);
 const stock=useMemo(()=>unifiedInventory(tank),[tank]);

 const reset=()=>{setPreset("");setCustom("");setQty(0);setUnit("g");setMin(0);setCategory("other");setSubcategory("other");setCustomSubcategory("");setCompatibility(tank.type);setDosingParameter("KH");setDosingCompoundId("")};
 const choosePreset=(id:string)=>{
  setPreset(id);
  const q=presets.find(x=>x.id===id);if(!q)return;
  setUnit(q.unit||"");setMin(q.min||0);
  const preview:InventoryItem={id:"preview",presetId:q.id,name:q.ar,nameEn:q.en,category:q.catAr,categoryEn:q.catEn,quantity:0,unit:q.unit||"",minimum:q.min||0};
  const prof=inventoryProfile(preview);
  setCategory(prof.category);setSubcategory(prof.subcategory);setCompatibility(prof.tankCompatibility);
  const dp=presetDoseParam[q.id];if(dp)setDosingParameter(dp);
 };
 const add=()=>{
  const name=p?.ar||custom.trim(),nameEn=p?.en||custom.trim();if(!name)return;
  const base:InventoryItem={id:uid("inv"),presetId:preset||undefined,name,nameEn,category:p?.catAr,categoryEn:p?.catEn,quantity:Math.max(0,qty),unit:unit||p?.unit||"",minimum:Math.max(0,min||p?.min||0)};
  const inferred=inventoryProfile(base),finalCategory=preset?inferred.category:category;
  const finalSubcategory=preset?inferred.subcategory:(subcategory==="other"?(customSubcategory.trim()||"other"):(subcategory||inventorySubcategoryOptions(finalCategory)[0]?.value||"other"));
  const doseParam=preset?presetDoseParam[preset]:(finalCategory==="dosing"?dosingParameter:undefined);
  patch(tank.id,t=>({...t,inventory:[...t.inventory,{
   ...base,
   inventoryCategory:finalCategory,
   inventorySubcategory:finalSubcategory,
   tankCompatibility:preset?inferred.tankCompatibility:compatibility,
   consumedBy:preset?inferred.consumedBy:consumersByCategory[finalCategory],
   stockBehavior:finalCategory==="equipment"?"asset":"consumable",
   dosingParameter:doseParam,
   dosingCompoundId:!preset&&finalCategory==="dosing"&&dosingCompoundId?dosingCompoundId:undefined
  }]}));
  setOpen(false);reset();
 };
 const updateGeneral=(id:string,v:number)=>patch(tank.id,t=>({...t,inventory:t.inventory.map(x=>x.id===id?{...x,quantity:Math.max(0,v)}:x)}));
 const updateConsumable=(equipmentId:string,consumableId:string,v:number)=>patch(tank.id,t=>({...t,equipment:t.equipment.map(e=>e.id===equipmentId?{...e,consumables:(e.consumables??[]).map(c=>c.id===consumableId?{...c,quantityOnHand:Math.max(0,v)}:c)}:e)}));
 const remove=(id:string)=>patch(tank.id,t=>({...t,inventory:t.inventory.filter(x=>x.id!==id)}));

 return <section className="page-grid"><PageHeader eyebrow="UNIFIED INVENTORY" title={tr(lang,"inventory")} actions={<button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addStock")}</button>}/>
 {stock.total===0&&<div className="inline-alert info full-span"><div><b>📦 {bi(lang,"المخزون مو مجرد قائمة كميات؛ كل مادة مرتبطة بوظيفتها.","Inventory is not just a quantity list; every item is linked to its purpose.")}</b><p>{bi(lang,"صنّف المادة مرة واحدة، وبعدها كل صفحة تشوف فقط المواد المناسبة إلها وتخصم منها بأمان.","Classify an item once; each module will then see only compatible stock and deduct from it safely.")}</p><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addStock")}</button></div></div>}
 <div className="card panel full-span"><div className="summary-strip"><div className="summary"><small>{bi(lang,"كل المواد","All stock")}</small><b>{stock.total}</b></div><div className="summary"><small>{bi(lang,"مواد المعدات","Equipment consumables")}</small><b>{stock.consumables.length}</b></div><div className="summary"><small>{bi(lang,"مخزون منخفض","Low stock")}</small><b>{stock.low.length}</b></div></div></div>
 <div className="card panel full-span"><div className="table-wrap"><table><thead><tr><th>{tr(lang,"name")}</th><th>{tr(lang,"category")}</th><th>{bi(lang,"النوع الفرعي","Subtype")}</th><th>{tr(lang,"available")}</th><th>{tr(lang,"minimum")}</th><th>{tr(lang,"status")}</th><th></th></tr></thead><tbody>{stock.rows.map(x=><tr key={x.id}><td>{lang==="ar"?x.name:(x.nameEn||x.name)}{x.source==="equipment-consumable"&&<small style={{display:"block"}}>⚙ {bi(lang,"مستهلك مرتبط بجهاز","Equipment consumable")}</small>}</td><td>{inventoryCategoryLabel(x.inventoryCategory||"other",lang)}</td><td>{x.subcategory?inventorySubcategoryLabel(x.inventoryCategory||"other",x.subcategory,lang):"—"}</td><td><input className="table-input" type="number" value={x.quantity} onChange={e=>x.source==="inventory"?updateGeneral(x.id,Number(e.target.value)):updateConsumable(x.equipmentId!,x.consumableId!,Number(e.target.value))}/> {x.unit}</td><td>{x.minimum}</td><td><span className={`status ${x.quantity<=x.minimum?"warn":""}`}>{x.quantity<=x.minimum?tr(lang,"low"):tr(lang,"good")}</span></td><td>{x.source==="inventory"&&<button className="btn danger" onClick={()=>remove(x.id)}>×</button>}</td></tr>)}</tbody></table></div></div>

 <Modal open={open} title={tr(lang,"addStock")} onClose={()=>{setOpen(false);reset()}}>
  <div className="form-grid">
   <label className="field"><span>{bi(lang,"مادة جاهزة","Preset")}</span><select value={preset} onChange={e=>choosePreset(e.target.value)}><option value="">{tr(lang,"other")}</option>{presets.map(x=><option value={x.id} key={x.id}>{lang==="ar"?x.ar:x.en}</option>)}</select></label>
   {!preset&&<><label className="field"><span>{tr(lang,"name")}</span><input value={custom} onChange={e=>setCustom(e.target.value)}/></label>
   <label className="field"><span>{tr(lang,"category")}</span><select value={category} onChange={e=>{const next=e.target.value as InventoryCategory;setCategory(next);setSubcategory(inventorySubcategoryOptions(next)[0]?.value||"other");setCustomSubcategory("");setDosingCompoundId("")}}><option value="feeding">{bi(lang,"تغذية","Feeding")}</option><option value="fertilizer">{bi(lang,"أسمدة","Fertilizer")}</option><option value="co2">CO₂</option><option value="dosing">{bi(lang,"جرعات كيميائية","Dosing")}</option><option value="supplement">{bi(lang,"متممات","Supplements")}</option><option value="filter_media">{bi(lang,"ميديا فلترة","Filter Media")}</option><option value="coral_treatment">{bi(lang,"علاج المرجان","Coral Treatment")}</option><option value="medication">{bi(lang,"أدوية / علاج","Medication / Treatment")}</option><option value="water_prep">{bi(lang,"تحضير الماء","Water Prep")}</option><option value="equipment">{bi(lang,"تجهيزات","Equipment")}</option><option value="testing">{bi(lang,"فحوص","Testing")}</option><option value="rodi">RO/DI</option><option value="other">{bi(lang,"أخرى","Other")}</option></select></label>
   <label className="field"><span>{bi(lang,"النوع الفرعي","Subcategory")}</span><select value={subcategory} onChange={e=>{setSubcategory(e.target.value);if(e.target.value!=="other")setCustomSubcategory("")}}>{inventorySubcategoryOptions(category).map(x=><option key={x.value} value={x.value}>{lang==="ar"?x.ar:x.en}</option>)}</select></label>{subcategory==="other"&&<label className="field"><span>{bi(lang,"نوع مخصص (اختياري)","Custom subtype (optional)")}</span><input value={customSubcategory} onChange={e=>setCustomSubcategory(e.target.value)} placeholder={bi(lang,"اكتب نوعاً واضحاً عند الحاجة","Enter a clear custom subtype if needed")}/></label>}
   <label className="field"><span>{bi(lang,"متوافق مع","Tank compatibility")}</span><select value={compatibility} onChange={e=>setCompatibility(e.target.value as "marine"|"freshwater"|"both")}><option value="marine">{bi(lang,"بحري","Marine")}</option><option value="freshwater">{bi(lang,"نهري","Freshwater")}</option><option value="both">{bi(lang,"الاثنين","Both")}</option></select></label>
   {category==="dosing"&&<><label className="field"><span>{bi(lang,"عنصر التصحيح","Correction parameter")}</span><select value={dosingParameter} onChange={e=>setDosingParameter(e.target.value as "KH"|"Ca"|"Mg")}><option>KH</option><option>Ca</option><option>Mg</option></select></label><label className="field"><span>{bi(lang,"المادة الدقيقة للحاسبة (اختياري)","Exact calculator compound (optional)")}</span><select value={dosingCompoundId} onChange={e=>setDosingCompoundId(e.target.value)}><option value="">{bi(lang,"منتج تجاري / غير محدد","Commercial / unspecified")}</option>{DOSING_PRESETS.filter(x=>x.parameter===dosingParameter).map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.ar:x.en} — {x.formula}</option>)}</select></label></>}
   </>}
   <label className="field"><span>{tr(lang,"quantity")}</span><input type="number" min="0" step="any" value={qty} onChange={e=>setQty(Number(e.target.value))}/></label>
   <label className="field"><span>{tr(lang,"unit")}</span><input value={unit} onChange={e=>setUnit(e.target.value)}/></label>
   <label className="field"><span>{tr(lang,"stockThreshold")}</span><input type="number" min="0" step="any" value={min} onChange={e=>setMin(Number(e.target.value))}/></label>
  </div>
  <div className="modal-actions"><button className="btn" onClick={()=>{setOpen(false);reset()}}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div>
 </Modal>
 </section>;
}
