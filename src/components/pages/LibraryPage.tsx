"use client";
import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,categoryText,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,today } from "@/lib/appUtils";
export function LibraryPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[cat,setCat]=useState("all"),[search,setSearch]=useState("");
 const entries:any[]=LIVESTOCK_LIBRARY.filter((x:any)=>x.type===tank.type);
 const cats=[...new Set(entries.map(x=>x.cat))];
 const filtered=useMemo(()=>entries.filter(x=>(cat==="all"||x.cat===cat)&&(!search||`${x.ar} ${x.en}`.toLowerCase().includes(search.toLowerCase()))),[cat,search,tank.type]);
 const issues=(x:any)=>{const a:string[]=[];if(tank.systemVolumeLiters<x.min)a.push(tr(lang,"volumeTooSmall"));if(x.needsMature&&tank.status!=="established")a.push(tr(lang,"matureRequired"));return a};
 const add=(x:any)=>patch(tank.id,t=>({...t,livestock:[...t.livestock,{id:uid("live"),libraryId:x.id,name:x.ar,nameEn:x.en,category:String(x.cat).toLowerCase()==="fish"?"fish":String(x.cat).toLowerCase()==="coral"?"coral":String(x.cat).toLowerCase()==="invert"?"invert":String(x.cat).toLowerCase()==="plant"?"plant":"other",quantity:1,health:"good",load:x.load,addedAt:today()}]}));
 return <section className="page-grid"><PageHeader eyebrow="LIVESTOCK LIBRARY" title={tr(lang,"library")}/>
 <div className="filter-bar full-span"><label className="field"><span>{tr(lang,"category")}</span><select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">{tr(lang,"all")}</option>{cats.map(c=><option key={c} value={c}>{categoryText(lang,c)}</option>)}</select></label><label className="field grow"><span>{tr(lang,"search")}</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={bi(lang,"الاسم العربي أو الإنكليزي","Arabic or English name")}/></label></div>
 <div className="library-grid full-span">{filtered.map(x=>{const warn=issues(x);return <article className="species-card" key={x.id}><div className="kpi-row"><h4>{lang==="ar"?x.ar:x.en}</h4><span className="status">{categoryText(lang,x.cat)}</span></div><div className="species-meta"><span>Min {x.min} L</span><span>Load {x.load}</span><span>{tr(lang,"care")}: {x.care}</span></div><div className={`inline-alert ${warn.length?"warn":"good"}`}>{warn.length?warn.join(" • "):tr(lang,"noConflict")}</div><button className="btn primary" onClick={()=>add(x)}>+ {tr(lang,"addFromLibrary")}</button></article>})}</div>
 </section>;
}
