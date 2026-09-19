"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { INVENTORY_PRESETS } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { uid } from "@/lib/appUtils";
import { unifiedInventory } from "@/domain/inventoryIntelligence";

export function InventoryPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[open,setOpen]=useState(false),[preset,setPreset]=useState(""),[custom,setCustom]=useState(""),[qty,setQty]=useState(0),[unit,setUnit]=useState("g"),[min,setMin]=useState(0);
 const presets:any[]=[...(INVENTORY_PRESETS as any).common,...(((INVENTORY_PRESETS as any)[tank.type])??[])],p=presets.find(x=>x.id===preset);
 const stock=useMemo(()=>unifiedInventory(tank),[tank]);
 const add=()=>{patch(tank.id,t=>({...t,inventory:[...t.inventory,{id:uid("inv"),presetId:preset||undefined,name:p?.ar||custom,nameEn:p?.en||custom,category:p?.catAr,categoryEn:p?.catEn,quantity:qty,unit:unit||p?.unit||"",minimum:min||p?.min||0}]}));setOpen(false)};
 const updateGeneral=(id:string,v:number)=>patch(tank.id,t=>({...t,inventory:t.inventory.map(x=>x.id===id?{...x,quantity:v}:x)}));
 const updateConsumable=(equipmentId:string,consumableId:string,v:number)=>patch(tank.id,t=>({...t,equipment:t.equipment.map(e=>e.id===equipmentId?{...e,consumables:(e.consumables??[]).map(c=>c.id===consumableId?{...c,quantityOnHand:v}:c)}:e)}));
 const remove=(id:string)=>patch(tank.id,t=>({...t,inventory:t.inventory.filter(x=>x.id!==id)}));
 return <section className="page-grid"><PageHeader eyebrow="UNIFIED INVENTORY" title={tr(lang,"inventory")} actions={<button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addStock")}</button>}/>
 <div className="card panel full-span"><div className="summary-strip"><div className="summary"><small>{bi(lang,"كل المواد","All stock")}</small><b>{stock.total}</b></div><div className="summary"><small>{bi(lang,"مواد المعدات","Equipment consumables")}</small><b>{stock.consumables.length}</b></div><div className="summary"><small>{bi(lang,"مخزون منخفض","Low stock")}</small><b>{stock.low.length}</b></div></div></div>
 <div className="card panel full-span"><div className="table-wrap"><table><thead><tr><th>{tr(lang,"name")}</th><th>{tr(lang,"category")}</th><th>{tr(lang,"available")}</th><th>{tr(lang,"minimum")}</th><th>{tr(lang,"status")}</th><th></th></tr></thead><tbody>{stock.rows.map(x=><tr key={x.id}><td>{lang==="ar"?x.name:(x.nameEn||x.name)}{x.source==="equipment-consumable"&&<small style={{display:"block"}}>⚙ {bi(lang,"مستهلك مرتبط بجهاز","Equipment consumable")}</small>}</td><td>{x.category}</td><td><input className="table-input" type="number" value={x.quantity} onChange={e=>x.source==="inventory"?updateGeneral(x.id,Number(e.target.value)):updateConsumable(x.equipmentId!,x.consumableId!,Number(e.target.value))}/> {x.unit}</td><td>{x.minimum}</td><td><span className={`status ${x.quantity<=x.minimum?"warn":""}`}>{x.quantity<=x.minimum?tr(lang,"low"):tr(lang,"good")}</span></td><td>{x.source==="inventory"&&<button className="btn danger" onClick={()=>remove(x.id)}>×</button>}</td></tr>)}</tbody></table></div></div>
 <Modal open={open} title={tr(lang,"addStock")} onClose={()=>setOpen(false)}><div className="form-grid"><label className="field"><span>{tr(lang,"name")}</span><select value={preset} onChange={e=>{const id=e.target.value;setPreset(id);const q=presets.find(x=>x.id===id);if(q){setUnit(q.unit||"");setMin(q.min||0)}}}><option value="">{tr(lang,"other")}</option>{presets.map(x=><option value={x.id} key={x.id}>{lang==="ar"?x.ar:x.en}</option>)}</select></label>{!preset&&<label className="field"><span>{tr(lang,"name")}</span><input value={custom} onChange={e=>setCustom(e.target.value)}/></label>}<label className="field"><span>{tr(lang,"quantity")}</span><input type="number" step="any" value={qty} onChange={e=>setQty(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"unit")}</span><input value={unit} onChange={e=>setUnit(e.target.value)}/></label><label className="field"><span>{tr(lang,"stockThreshold")}</span><input type="number" step="any" value={min} onChange={e=>setMin(Number(e.target.value))}/></label></div><div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
