"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,categoryText,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today,nowISO } from "@/lib/appUtils";
import { stockingReadiness } from "@/domain/stockingReadiness";
export function LibraryPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[cat,setCat]=useState("all"),[search,setSearch]=useState("");
 const entries:any[]=LIVESTOCK_LIBRARY.filter((x:any)=>x.type===tank.type);
 const cats=[...new Set(entries.map(x=>x.cat))];
 const filtered=useMemo(()=>entries.filter(x=>(cat==="all"||x.cat===cat)&&(!search||`${x.ar} ${x.en}`.toLowerCase().includes(search.toLowerCase()))),[cat,search,tank.type]);
 const add=(x:any)=>{
  const readiness=stockingReadiness(tank,{candidate:x,quantity:1,candidateKnown:true});
  if(readiness.state==="not_now")return;
  if((readiness.state==="insufficient_evidence"||readiness.requiresConfirmation)&&!window.confirm(lang==="ar"?"الجاهزية غير مكتملة أو يوجد تنبيه. راجع السبب ثم أكد فقط إذا كنت تقصد تسجيل الإضافة رغم ذلك.":"Readiness is incomplete or cautioned. Review the reason and confirm only if you intend to record the addition anyway."))return;
  patch(tank.id,t=>({...t,livestock:[...t.livestock,{id:uid("live"),libraryId:x.id,name:x.ar,nameEn:x.en,category:String(x.cat).toLowerCase()==="fish"?"fish":String(x.cat).toLowerCase()==="coral"?"coral":String(x.cat).toLowerCase()==="invert"?"invert":String(x.cat).toLowerCase()==="plant"?"plant":"other",quantity:1,health:"good",load:x.load,addedAt:today()}],timeline:[{id:uid("ev"),timestamp:nowISO(),type:"livestock",textAr:`تمت إضافة 1 × ${x.ar} من المكتبة بعد فحص الجاهزية المركزي.`,textEn:`Added 1 × ${x.en} from the library after central readiness screening.`},...t.timeline]}));
 };
 return <section className="page-grid"><PageHeader eyebrow="LIVESTOCK LIBRARY" title={tr(lang,"library")}/>
 <div className="filter-bar full-span"><label className="field"><span>{tr(lang,"category")}</span><select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">{tr(lang,"all")}</option>{cats.map(c=><option key={c} value={c}>{categoryText(lang,c)}</option>)}</select></label><label className="field grow"><span>{tr(lang,"search")}</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={bi(lang,"الاسم العربي أو الإنكليزي","Arabic or English name")}/></label></div>
 <div className="library-grid full-span">{filtered.map(x=>{const readiness=stockingReadiness(tank,{candidate:x,quantity:1,candidateKnown:true}),check=readiness.compatibility;const note=readiness.state==="not_now"?(lang==="ar"?(readiness.blockersAr[0]||"غير مناسب الآن"):(readiness.blockersEn[0]||"Not suitable now")):readiness.state==="insufficient_evidence"?(lang==="ar"?(readiness.missingEvidenceAr[0]||"البيانات غير كافية"):(readiness.missingEvidenceEn[0]||"Insufficient evidence")):(check?.issues.length?check.issues.slice(0,3).map((i:any)=>lang==="ar"?i.ar:i.en).join(" • "):tr(lang,"noConflict"));return <article className="species-card" key={x.id}><div className="kpi-row"><h4>{lang==="ar"?x.ar:x.en}</h4><span className="status">{categoryText(lang,x.cat)}</span></div><div className="species-meta"><span>Min {x.min} L</span><span>Load {x.load}</span><span>{tr(lang,"care")}: {x.care}</span></div><div className={`inline-alert ${readiness.state==="not_now"?"danger":readiness.state==="insufficient_evidence"?"warn":check?.level??"good"}`}>{note}</div><button className="btn primary" onClick={()=>add(x)} disabled={readiness.state==="not_now"}>{readiness.state==="not_now"?(lang==="ar"?"غير مناسب حالياً":"Not suitable now"):`+ ${tr(lang,"addFromLibrary")}`}</button></article>})}</div>
 </section>;
}
