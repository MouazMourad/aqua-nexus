"use client";
import {useMemo,useState} from "react";
import type {LivestockItem,Tank} from "@/domain/types";
import {useAquaStore} from "@/store/useAquaStore";
import {PageHeader} from "@/components/ui/PageHeader";
import {bi} from "@/i18n";
import {uid,nowISO} from "@/lib/appUtils";

export function LifeJourneyPage({tank}:{tank:Tank}){
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [selected,setSelected]=useState(tank.livestock[0]?.id??""),[type,setType]=useState<NonNullable<LivestockItem["lifeEvents"]>[number]["type"]>("observation"),[note,setNote]=useState(""),[size,setSize]=useState("");
 const item=tank.livestock.find(x=>x.id===selected);
 const events=useMemo(()=>[...(item?.lifeEvents??[])].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)),[item]);
 const add=()=>{if(!item)return;const ts=nowISO(),n=Number(size);patch(tank.id,t=>({...t,
   livestock:t.livestock.map(x=>x.id===item.id?{...x,sizeCm:Number.isFinite(n)&&n>0?n:x.sizeCm,lifeEvents:[{id:uid("life"),timestamp:ts,type,note:note.trim()||undefined,sizeCm:Number.isFinite(n)&&n>0?n:undefined},...(x.lifeEvents??[])]}:x),
   timeline:[{id:uid("ev"),timestamp:ts,type:"livestock-life",textAr:`حياة الكائنات • ${item.name}: ${type}${note?` • ${note}`:""}`,textEn:`Life Journey • ${item.nameEn||item.name}: ${type}${note?` • ${note}`:""}`},...t.timeline]
  }));setNote("");setSize("")};
 return <section className="page-grid"><PageHeader eyebrow="LIFE JOURNEY" title={bi(lang,"حياة الكائنات","Life Journey")}/>
 <section className="card panel full-span"><div className="module-head"><div><h3>{bi(lang,"كل كائن له قصة، وليس مجرد صف في قائمة","Every organism has a story, not just a row")}</h3><p className="note">{bi(lang,"الأسماك والمرجان والنبات والقشريات تستخدم نفس Livestock كمصدر وحيد. النمو، الصحة، التكاثر، Frag أو قص/تقسيم النبات تصبح ذاكرة يفهمها عقل الحوض.","Fish, coral, plants and invertebrates use Livestock as the single source of truth. Growth, health, breeding, fragging and plant propagation become Tank Brain memory.")}</p></div></div>
 <div className="form-grid"><label className="field"><span>{bi(lang,"الكائن","Organism")}</span><select value={selected} onChange={e=>setSelected(e.target.value)}>{tank.livestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label>
 <label className="field"><span>{bi(lang,"الحدث","Event")}</span><select value={type} onChange={e=>setType(e.target.value as any)}><option value="observation">{bi(lang,"ملاحظة","Observation")}</option><option value="growth">{bi(lang,"نمو","Growth")}</option><option value="health">{bi(lang,"تغير صحي","Health change")}</option><option value="transfer">{bi(lang,"نقل","Transfer")}</option></select></label>
 <label className="field"><span>{bi(lang,"الحجم الحالي cm (اختياري)","Current size cm (optional)")}</span><input type="number" min="0" step=".1" value={size} onChange={e=>setSize(e.target.value)}/></label>
 <label className="field full-field"><span>{bi(lang,"ملاحظة","Note")}</span><input value={note} onChange={e=>setNote(e.target.value)}/></label></div>
 <button className="btn primary" disabled={!item} onClick={add}>{bi(lang,"حفظ في ذاكرة الحوض","Save to Tank Memory")}</button>
 {item&&(item.category==="coral"||item.category==="plant"||item.category==="fish")&&<div className="inline-alert info" style={{marginTop:12}}>{item.category==="coral"?bi(lang,"إذا صار المرجان مستقراً ونموه مناسباً، يمكن بدء Frag ومتابعة القطعة الجديدة من قسم التكاثر.","When the coral is stable and growing well, a frag can be started and followed in Propagation & Breeding."):item.category==="plant"?bi(lang,"عندما يصبح نمو النبات مناسباً، يمكن أخذ قصاصة/تقسيم/مدادة ومتابعتها من قسم التكاثر.","When plant growth is suitable, a cutting, division or runner can be followed in Propagation & Breeding."):bi(lang,"عند ظهور سلوك تكاثر أو نسل جديد، تبدأ المتابعة من قسم التكاثر.","When breeding behavior or offspring appears, follow it in Propagation & Breeding.")}</div>}</section>
 <section className="card panel full-span"><h3>{bi(lang,"رحلة الكائن","Organism journey")}</h3>{!item?<p className="note">{bi(lang,"أضف كائنات أولاً.","Add livestock first.")}</p>:events.length?events.map(e=><div className="mini-row" key={e.id}><span><b>{e.type}</b> • {new Date(e.timestamp).toLocaleDateString(lang==="ar"?"ar-SY":"en-US")} {e.note&&<>• {e.note}</>}</span><b>{e.sizeCm?e.sizeCm+" cm":""}</b></div>):<p className="note">{bi(lang,"لسا ما في أحداث مسجلة لهذا الكائن.","No life events recorded yet.")}</p>}</section></section>
}