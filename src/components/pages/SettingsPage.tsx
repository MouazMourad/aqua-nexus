"use client";
import { useRef,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { downloadText,today } from "@/lib/appUtils";
export function SettingsPage({tank}:{tank:Tank}) {
 const state=useAquaStore(),patch=useAquaStore(s=>s.patchTank),del=useAquaStore(s=>s.deleteTank),replace=useAquaStore(s=>s.replaceData),[name,setName]=useState(tank.name),file=useRef<HTMLInputElement>(null),lang=state.language;
 const exportBackup=()=>downloadText(`Aqua_Nexus_Backup_${today()}.json`,JSON.stringify({language:state.language,selectedTankId:state.selectedTankId,tanks:state.tanks},null,2));
 function importFile(f?:File){if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(String(r.result));if(Array.isArray(d.tanks))replace({language:d.language==="en"?"en":"ar",selectedTankId:d.selectedTankId||d.tanks[0]?.id||"",tanks:d.tanks})}catch{alert("Invalid backup")}};r.readAsText(f)}
 return <section className="page-grid"><PageHeader eyebrow="SETTINGS" title={tr(lang,"settings")}/>
 <div className="card panel"><label className="field"><span>{tr(lang,"language")}</span><select value={lang} onChange={e=>state.setLanguage(e.target.value as any)}><option value="ar">{tr(lang,"arabic")}</option><option value="en">{tr(lang,"english")}</option></select></label><label className="field"><span>{tr(lang,"name")}</span><input value={name} onChange={e=>setName(e.target.value)}/></label><button className="btn primary" onClick={()=>patch(tank.id,{name})}>{tr(lang,"save")}</button><div className="inline-alert good">{tr(lang,"actualTranslationNote")}</div></div>
 <div className="card panel"><h3>{tr(lang,"dataSync")}</h3><p className="note">{tr(lang,"localStorageNote")}</p><button className="btn" onClick={exportBackup}>{tr(lang,"export")} JSON</button> <button className="btn" onClick={()=>file.current?.click()}>{tr(lang,"import")}</button><input ref={file} type="file" accept=".json" hidden onChange={e=>importFile(e.target.files?.[0])}/><hr/><button className="btn danger" onClick={()=>{if(confirm(tr(lang,"confirmDeleteTank")))del(tank.id)}}>{tr(lang,"deleteTank")}</button></div>
 </section>;
}
