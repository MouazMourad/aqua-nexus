"use client";

import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { bi } from "@/i18n";
import { uid,nowISO } from "@/lib/appUtils";
import { inventoryForConsumer } from "@/domain/inventoryIntelligence";
import { consumeInventory,inventoryConsumptionMessage } from "@/domain/inventoryConsumption";

export function PlantCarePanel({tank}:{tank:Tank}){
  const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
  const fertilizerStock=useMemo(()=>inventoryForConsumer(tank,"fertilizer"),[tank]);
  const co2Stock=useMemo(()=>inventoryForConsumer(tank,"co2"),[tank]);
  const co2Equipment=useMemo(()=>tank.equipment.filter(e=>e.kind==="co2"),[tank.equipment]);
  const plantCount=tank.livestock.filter(x=>x.category==="plant").reduce((sum,x)=>sum+x.quantity,0);

  const [fertItemId,setFertItemId]=useState(""),[fertQty,setFertQty]=useState(""),[fertNotes,setFertNotes]=useState("");
  const [co2ItemId,setCo2ItemId]=useState(""),[co2Qty,setCo2Qty]=useState(""),[co2EquipmentId,setCo2EquipmentId]=useState(co2Equipment[0]?.id??""),[co2Notes,setCo2Notes]=useState("");

  if(tank.type!=="freshwater")return null;

  function logFertilizer(){
    const item=fertilizerStock.find(x=>x.id===fertItemId),q=Number(fertQty);
    if(!item){window.alert(bi(lang,"اختر السماد من المخزون أولاً.","Select fertilizer from inventory first."));return}
    const checked=consumeInventory(tank.inventory,[{inventoryItemId:item.id,quantity:q,role:"fertilizer"}]);
    if(!checked.ok){window.alert(inventoryConsumptionMessage(checked,lang));return}
    const ts=nowISO(),remaining=Math.max(0,item.quantity-q);
    patch(tank.id,t=>{
      const consumed=consumeInventory(t.inventory,[{inventoryItemId:item.id,quantity:q,role:"fertilizer"}]);
      if(!consumed.ok)return t;
      return {...t,
        inventory:consumed.inventory,
        plantCare:[{id:uid("plant"),timestamp:ts,kind:"fertilizer",inventoryUse:consumed.uses[0],notes:fertNotes||undefined},...(t.plantCare??[])],
        timeline:[{id:uid("ev"),timestamp:ts,type:"plant-fertilizer",textAr:"تم تسجيل تسميد النباتات: "+item.name+" — "+q+" "+item.unit+" • المتبقي "+remaining+" "+item.unit+".",textEn:"Plant fertilizer logged: "+(item.nameEn||item.name)+" — "+q+" "+item.unit+" • remaining "+remaining+" "+item.unit+"."},...t.timeline]
      };
    });
    setFertQty("");setFertNotes("");
  }

  function logCo2Refill(){
    const item=co2Stock.find(x=>x.id===co2ItemId),equipment=co2Equipment.find(x=>x.id===co2EquipmentId),q=Number(co2Qty);
    if(!equipment){window.alert(bi(lang,"أضف جهاز CO₂ أو اختره قبل تسجيل التعبئة.","Add or select a CO₂ device before logging a refill."));return}
    if(!item){window.alert(bi(lang,"اختر مادة CO₂ من المخزون أولاً.","Select the CO₂ stock item first."));return}
    const checked=consumeInventory(tank.inventory,[{inventoryItemId:item.id,quantity:q,role:"co2_refill"}]);
    if(!checked.ok){window.alert(inventoryConsumptionMessage(checked,lang));return}
    const ts=nowISO(),remaining=Math.max(0,item.quantity-q);
    patch(tank.id,t=>{
      const consumed=consumeInventory(t.inventory,[{inventoryItemId:item.id,quantity:q,role:"co2_refill"}]);
      if(!consumed.ok)return t;
      return {...t,
        inventory:consumed.inventory,
        equipment:t.equipment.map(e=>e.id===equipment.id?{...e,co2Mode:"injected",co2CylinderRemainingPercent:100}:e),
        plantCare:[{id:uid("plant"),timestamp:ts,kind:"co2_refill",inventoryUse:consumed.uses[0],equipmentId:equipment.id,notes:co2Notes||undefined},...(t.plantCare??[])],
        timeline:[{id:uid("ev"),timestamp:ts,type:"plant-co2-refill",textAr:"تم تسجيل تعبئة CO₂ للجهاز "+equipment.name+": استُخدم "+q+" "+item.unit+" من "+item.name+" • المتبقي بالمخزون "+remaining+" "+item.unit+".",textEn:"CO₂ refill logged for "+equipment.name+": used "+q+" "+item.unit+" of "+(item.nameEn||item.name)+" • inventory remaining "+remaining+" "+item.unit+"."},...t.timeline]
      };
    });
    setCo2Qty("");setCo2Notes("");
  }

  const recent=(tank.plantCare??[]).slice(0,6);
  return <section className="card panel full-span">
    <div className="module-head"><div><small className="eyebrow-mini">PLANT CARE</small><h3>{bi(lang,"رعاية النباتات والأسمدة وCO₂","Plant care, fertilizers & CO₂")}</h3><p className="note">{bi(lang,"أي تسميد أو تعبئة CO₂ تنسجل كحدث فعلي وتنخصم من المخزون مباشرة.","Every fertilizer dose or CO₂ refill is logged as an actual event and deducted from inventory immediately.")}</p></div><span className="status">{plantCount} 🌿</span></div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
      <div className="card" style={{padding:14}}>
        <h4>{bi(lang,"تسجيل تسميد","Log fertilizer")}</h4>
        {fertilizerStock.length===0?<div className="inline-alert info">{bi(lang,"أضف السماد أولاً إلى Inventory ضمن فئة Fertilizer.","Add fertilizer to Inventory under the Fertilizer category first.")}</div>:<div className="form-grid one-col">
          <label className="field"><span>{bi(lang,"السماد","Fertilizer")}</span><select value={fertItemId} onChange={e=>setFertItemId(e.target.value)}><option value="">{bi(lang,"اختر من المخزون","Select from inventory")}</option>{fertilizerStock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)} • {x.quantity} {x.unit}</option>)}</select></label>
          <label className="field"><span>{bi(lang,"الكمية المستخدمة","Amount used")}</span><input type="number" min="0" step="any" value={fertQty} onChange={e=>setFertQty(e.target.value)} placeholder={fertilizerStock.find(x=>x.id===fertItemId)?.unit||""}/></label>
          <label className="field"><span>{bi(lang,"ملاحظات اختيارية","Optional notes")}</span><input value={fertNotes} onChange={e=>setFertNotes(e.target.value)}/></label>
          <button className="btn primary" disabled={!fertItemId||!(Number(fertQty)>0)} onClick={logFertilizer}>{bi(lang,"تسجيل وخصم المخزون","Log & deduct stock")}</button>
        </div>}
      </div>

      <div className="card" style={{padding:14}}>
        <h4>CO₂</h4>
        {co2Equipment.length===0?<div className="inline-alert warn">{bi(lang,"ما في جهاز CO₂ مسجل. أضفه من صفحة Equipment إذا الحوض High-tech.","No CO₂ device is registered. Add it from Equipment for a high-tech planted tank.")}</div>:<div className="form-grid one-col">
          <label className="field"><span>{bi(lang,"جهاز CO₂","CO₂ device")}</span><select value={co2EquipmentId} onChange={e=>setCo2EquipmentId(e.target.value)}>{co2Equipment.map(e=><option key={e.id} value={e.id}>{e.name} • {e.co2CylinderRemainingPercent??0}%</option>)}</select></label>
          <label className="field"><span>{bi(lang,"مادة / تعبئة CO₂ من المخزون","CO₂ refill stock")}</span><select value={co2ItemId} onChange={e=>setCo2ItemId(e.target.value)}><option value="">{bi(lang,"اختر من المخزون","Select from inventory")}</option>{co2Stock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)} • {x.quantity} {x.unit}</option>)}</select></label>
          <label className="field"><span>{bi(lang,"الكمية المستخدمة بالتعبئة","Amount used for refill")}</span><input type="number" min="0" step="any" value={co2Qty} onChange={e=>setCo2Qty(e.target.value)} placeholder={co2Stock.find(x=>x.id===co2ItemId)?.unit||""}/></label>
          <label className="field"><span>{bi(lang,"ملاحظات اختيارية","Optional notes")}</span><input value={co2Notes} onChange={e=>setCo2Notes(e.target.value)}/></label>
          <button className="btn primary" disabled={!co2EquipmentId||!co2ItemId||!(Number(co2Qty)>0)} onClick={logCo2Refill}>{bi(lang,"تسجيل التعبئة وضبط الأسطوانة 100%","Log refill & set cylinder to 100%")}</button>
        </div>}
      </div>
    </div>

    {recent.length>0&&<div className="history-list" style={{marginTop:14}}>{recent.map(x=><div className="history-row" key={x.id}><b>{x.kind==="fertilizer"?bi(lang,"تسميد","Fertilizer"):bi(lang,"تعبئة CO₂","CO₂ refill")}{x.inventoryUse?" • "+x.inventoryUse.quantity+" "+x.inventoryUse.unit:""}</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>)}</div>}
  </section>;
}
