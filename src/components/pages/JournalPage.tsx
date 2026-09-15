"use client";
import { useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
export function JournalPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),[caption,setCaption]=useState("");
 function add(file?:File){if(!file)return;const reader=new FileReader();reader.onload=()=>{patch(tank.id,t=>({...t,photos:[{id:uid("ph"),timestamp:nowISO(),caption,dataUrl:String(reader.result)},...t.photos]}));setCaption("")};reader.readAsDataURL(file)}
 return <section className="page-grid"><PageHeader eyebrow="PHOTO JOURNAL" title={tr(lang,"journal")}/>
 <div className="card panel full-span"><div className="journal-add"><label className="field grow"><span>{tr(lang,"photoCaption")}</span><input value={caption} onChange={e=>setCaption(e.target.value)}/></label><label className="btn primary file-button">{tr(lang,"addPhoto")}<input type="file" accept="image/*" onChange={e=>add(e.target.files?.[0])}/></label></div></div>
 <div className="photo-grid full-span">{tank.photos.map(p=><article className="photo-card" key={p.id}><img src={p.dataUrl} alt={p.caption}/><div><b>{p.caption||tr(lang,"journal")}</b><small>{new Date(p.timestamp).toLocaleString()}</small></div></article>)}</div>
 </section>;
}
