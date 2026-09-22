"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdvancedSection } from "@/components/ui/AdvancedSection";
import { uid,nowISO } from "@/lib/appUtils";
import { feedingIntelligence } from "@/domain/feedingIntelligence";
import { inventoryForConsumer } from "@/domain/inventoryIntelligence";
import { claimCriticalAction } from "@/lib/actionGuard";

export function FeedingPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[food,setFood]=useState(""),[amount,setAmount]=useState(""),[notes,setNotes]=useState(""),[inventoryItemId,setInventoryItemId]=useState(""),[used,setUsed]=useState(""),[showHistory,setShowHistory]=useState(false),[historyLimit,setHistoryLimit]=useState(100);
 const plan=useMemo(()=>feedingIntelligence(tank),[tank]);
 const feedingStock=useMemo(()=>inventoryForConsumer(tank,"feeding"),[tank]);
 const todayKey=new Date().toDateString();
 const todayFeedings=tank.feeding.filter(x=>new Date(x.timestamp).toDateString()===todayKey).length;
 const latest=tank.feeding[0];
 const selectedInventory=feedingStock.find(x=>x.id===inventoryItemId);
 const usedQty=Number(used);
 const canLog=Boolean(selectedInventory&&Number.isFinite(usedQty)&&usedQty>0&&usedQty<=selectedInventory.quantity);
 const livestockCount=tank.livestock.reduce((sum,x)=>sum+(Number(x.quantity)||0),0);
 const pressureLabel=plan.nutrientPressure==="high"
  ?bi(lang,"ضغط مغذيات مرتفع","High nutrient pressure")
  :plan.nutrientPressure==="watch"
   ?bi(lang,"راقب المغذيات","Watch nutrients")
   :bi(lang,"الوضع مستقر","Stable");
 const pressureAction=plan.nutrientPressure==="high"
  ?bi(lang,"خلي تسجيل اليوم دقيق، وتجنب الوجبات الإضافية غير الضرورية قبل مراجعة NO3/PO4.","Keep today's logging precise and avoid unnecessary extra feeding until NO3/PO4 are reviewed.")
  :plan.nutrientPressure==="watch"
   ?bi(lang,"كمل الروتين المعتاد لكن راقب الكمية واتجاه NO3/PO4.","Continue the normal routine, but watch the amount and the NO3/PO4 trend.")
   :bi(lang,"سجّل الوجبة الفعلية فقط؛ Aqua Nexus رح يربطها تلقائياً مع الحمل الحيوي والمغذيات.","Log only what was actually fed; Aqua Nexus will connect it automatically to livestock load and nutrients.");
 const add=()=>{
  const ts=nowISO(),q=Number(used),selected=feedingStock.find(x=>x.id===inventoryItemId);
  if(!selected){window.alert(bi(lang,"اختر مادة الطعام من المخزون قبل تسجيل التغذية.","Select the food item from inventory before logging feeding."));return}
  if(!Number.isFinite(q)||q<=0){window.alert(bi(lang,"أدخل الكمية المستهلكة من المخزون.","Enter the quantity consumed from inventory."));return}
  if(q>selected.quantity){window.alert(bi(lang,"الكمية المستخدمة أكبر من المخزون المتوفر.","Used quantity exceeds available stock."));return}
  if(!claimCriticalAction(`feeding:${tank.id}:${selected.id}`))return;
  patch(tank.id,t=>{
   const inv=t.inventory.find(x=>x.id===inventoryItemId);
   if(!inv)return t;
   const consume=Math.min(q,inv.quantity),remainingStock=Math.max(0,inv.quantity-consume);
   const foodName=lang==="ar"?inv.name:(inv.nameEn||inv.name);
   return {...t,
    inventory:t.inventory.map(x=>x.id===inventoryItemId?{...x,quantity:remainingStock}:x),
    feeding:[{id:uid("feed"),timestamp:ts,food:foodName,amount,notes,inventoryItemId:inv.id,inventoryQuantityUsed:consume,inventoryUnit:inv.unit},...t.feeding],
    timeline:[{id:uid("ev"),timestamp:ts,type:"feeding",textAr:`تم تسجيل تغذية: ${inv.name} ${amount} • خُصم ${consume} ${inv.unit} من المخزون • المتبقي ${remainingStock} ${inv.unit}`,textEn:`Feeding logged: ${inv.nameEn||inv.name} ${amount} • deducted ${consume} ${inv.unit} from inventory • remaining ${remainingStock} ${inv.unit}`},...t.timeline]
   };
  });
  setFood("");setAmount("");setNotes("");setInventoryItemId("");setUsed("");
 };
 return <section className="page-grid feeding-page"><PageHeader eyebrow="FEEDING INTELLIGENCE" title={tr(lang,"feeding")}/>

 <section className="card panel full-span feeding-command-card">
  <div className="module-head"><div><small className="eyebrow-mini">{bi(lang,"قرار التغذية الآن","FEEDING DECISION NOW")}</small><h3>{pressureLabel}</h3><p className="note">{pressureAction}</p></div><span className={`status ${plan.nutrientPressure==="high"?"danger":plan.nutrientPressure==="watch"?"warn":"good"}`}>{plan.nutrientPressure}</span></div>
  <div className="feeding-first-look">
   <div><small>{bi(lang,"اليوم","Today")}</small><b>{todayFeedings}</b><span>{bi(lang,"وجبات مسجلة","logged feedings")}</span></div>
   <div><small>{bi(lang,"آخر 7 أيام","Last 7 days")}</small><b>{plan.recent7d}</b><span>{bi(lang,"إجمالي مرات التغذية","total feedings")}</span></div>
   <div><small>{bi(lang,"الحمل الحيوي","Livestock load")}</small><b>{livestockCount}</b><span>{bi(lang,`${plan.fish} سمك • ${plan.inverts} لافقاريات • ${plan.corals} مرجان`,`${plan.fish} fish • ${plan.inverts} inverts • ${plan.corals} corals`)}</span></div>
  </div>
  {plan.suggestions.length>0&&<div className="feeding-guidance">{plan.suggestions.map((x,i)=><div className="inline-alert info" key={i}>{x}</div>)}</div>}
 </section>

 <section className="card panel full-span">
  <div className="module-head"><div><small className="eyebrow-mini">{bi(lang,"تسجيل سريع","QUICK LOG")}</small><h3>{bi(lang,"سجّل شو صار فعلياً","Log what actually happened")}</h3><p className="note">{bi(lang,"كل تغذية تُخصم مباشرة من المخزون. اختر مادة الطعام وسجّل الكمية المستهلكة؛ الملاحظات اختيارية.","Every feeding deducts directly from inventory. Select the food item and enter the consumed quantity; notes are optional.")}</p></div></div>
  <div className="feeding-guided-grid">
   <label className="field"><span>{tr(lang,"food")}</span><input value={selectedInventory?(lang==="ar"?selectedInventory.name:(selectedInventory.nameEn||selectedInventory.name)):""} readOnly placeholder={bi(lang,"اختَر الطعام من المخزون","Select food from inventory")}/></label>
   <label className="field"><span>{tr(lang,"feedAmount")}</span><input value={amount} onChange={e=>setAmount(e.target.value)} placeholder={bi(lang,"مثال: مكعب واحد / رشة صغيرة","e.g. 1 cube / small pinch")}/></label>
   <label className="field"><span>{bi(lang,"مادة الطعام من المخزون","Food item from inventory")}</span><select autoFocus value={inventoryItemId} onChange={e=>{const id=e.target.value;setInventoryItemId(id);const inv=feedingStock.find(x=>x.id===id);setFood(inv?(lang==="ar"?inv.name:(inv.nameEn||inv.name)):"");}}><option value="">{bi(lang,"اختر من المخزون","Select from inventory")}</option>{feedingStock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)} • {x.quantity} {x.unit}</option>)}</select>{selectedInventory&&<small>{bi(lang,`المتوفر: ${selectedInventory.quantity} ${selectedInventory.unit}`,`Available: ${selectedInventory.quantity} ${selectedInventory.unit}`)}</small>}</label>
   <label className="field"><span>{bi(lang,"الكمية التي ستُخصم","Quantity to deduct")}</span><input type="number" min="0" step="any" value={used} onChange={e=>setUsed(e.target.value)} disabled={!selectedInventory} placeholder={selectedInventory?selectedInventory.unit:bi(lang,"اختر المادة أولاً","Select item first")}/></label>
  </div>

  <AdvancedSection titleAr="ملاحظات التغذية" titleEn="Feeding notes" summaryAr="اختيارية؛ افتحها إذا بدك تسجل الشهية أو استجابة الكائنات." summaryEn="Optional; open when you want to record appetite or livestock response."><div className="form-grid" style={{paddingTop:10}}><label className="field full-field"><span>{tr(lang,"notes")}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={bi(lang,"ملاحظات اختيارية عن الشهية أو الاستجابة","Optional notes about appetite or response")}/></label></div></AdvancedSection>

  <div className="feeding-primary-action">
   <div><small>{bi(lang,"الإجراء الحالي","CURRENT ACTION")}</small><b>{!selectedInventory?bi(lang,"اختر مادة الطعام من المخزون","Select the food item from inventory"):!Number.isFinite(usedQty)||usedQty<=0?bi(lang,"أدخل الكمية المستهلكة","Enter the consumed quantity"):usedQty>selectedInventory.quantity?bi(lang,"الكمية أكبر من المخزون المتوفر","Quantity exceeds available inventory"):bi(lang,`سيُخصم ${usedQty} ${selectedInventory.unit} من المخزون عند الحفظ`,`${usedQty} ${selectedInventory.unit} will be deducted from inventory when saved`)}</b></div>
   <button className="btn primary" onClick={add} disabled={!canLog}>{tr(lang,"addFeeding")}</button>
  </div>
 </section>

 <section className="card panel full-span">
  <div className="module-head"><div><small className="eyebrow-mini">{bi(lang,"السجل","HISTORY")}</small><h3>{bi(lang,"آخر التغذيات","Recent feedings")}</h3><p className="note">{latest?bi(lang,`آخر تسجيل: ${latest.food} • ${latest.amount||"—"}`,`Latest: ${latest.food} • ${latest.amount||"—"}`):bi(lang,"لسا ما في تغذية مسجلة.","No feeding has been logged yet.")}</p></div>{tank.feeding.length>0&&<button className="btn" onClick={()=>setShowHistory(v=>!v)}>{showHistory?bi(lang,"إخفاء السجل","Hide history"):bi(lang,`عرض السجل (${tank.feeding.length})`,`Show history (${tank.feeding.length})`)}</button>}</div>
  {!showHistory&&latest&&<div className="feeding-latest"><div><b>{latest.food} • {latest.amount||"—"}</b><span>{new Date(latest.timestamp).toLocaleString()}</span></div><small>{latest.notes||bi(lang,"بدون ملاحظات","No notes")}</small></div>}
  {showHistory&&<><div className="history-list">{tank.feeding.slice(0,historyLimit).map(x=><div className="history-row" key={x.id}><b>{x.food} • {x.amount}</b><span>{new Date(x.timestamp).toLocaleString()}</span><small>{x.notes}</small></div>)}</div>{historyLimit<tank.feeding.length&&<button className="btn" onClick={()=>setHistoryLimit(n=>n+100)}>{bi(lang,`عرض 100 أقدم — باقي ${tank.feeding.length-historyLimit}`,`Show 100 older — ${tank.feeding.length-historyLimit} remaining`)}</button>}</>}
 </section>

 <style jsx>{`
  .feeding-command-card{display:grid;gap:12px;background:linear-gradient(135deg,rgba(12,44,59,.88),rgba(4,24,34,.94))}
  .feeding-first-look{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
  .feeding-first-look>div{display:grid;gap:3px;padding:11px 12px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:rgba(255,255,255,.025)}
  .feeding-first-look small{font-size:10px;opacity:.62;font-weight:800}.feeding-first-look b{font-size:18px;line-height:1.25}.feeding-first-look span{font-size:10px;opacity:.68}
  .feeding-guidance{display:grid;gap:8px}
  .feeding-guided-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .feeding-details{margin-top:12px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.02)}
  .feeding-primary-action{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px;padding:12px 14px;border:1px solid rgba(75,220,206,.18);border-radius:14px;background:rgba(75,220,206,.045)}
  .feeding-primary-action>div{display:grid;gap:3px;min-width:0}.feeding-primary-action small{font-size:9px;opacity:.6;font-weight:800}.feeding-primary-action b{font-size:13px;line-height:1.4}
  .feeding-latest{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.02)}
  .feeding-latest>div{display:grid;gap:3px}.feeding-latest span,.feeding-latest small{font-size:10px;opacity:.65}
  @media(max-width:620px){.feeding-first-look,.feeding-guided-grid{grid-template-columns:1fr}.feeding-primary-action,.feeding-latest{align-items:stretch;flex-direction:column}.feeding-primary-action .btn{width:100%}}
 `}</style>
 </section>;
}
