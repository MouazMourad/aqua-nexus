"use client";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,statusText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
export function TanksPage({tanks,selectedTankId,onSelect}:{tanks:Tank[];selectedTankId:string;onSelect:(id:string)=>void}) {
 const lang=useAquaStore(s=>s.language);
 return <section className="page-grid"><PageHeader eyebrow="TANK MANAGEMENT" title={tr(lang,"tanks")}/>
 <div className="tank-cards">{tanks.map(t=><button type="button" className={`tank-card ${t.id===selectedTankId?"selected":""}`} key={t.id} onClick={()=>onSelect(t.id)}>
 <div className="tank-type-badge">{t.type==="marine"?tr(lang,"marine"):tr(lang,"freshwater")}</div><h3>{t.name}</h3>
 <div className="tank-card-stats"><span><small>{tr(lang,"systemVolume")}</small><b>{t.systemVolumeLiters} L</b></span><span><small>{tr(lang,"status")}</small><b>{statusText(lang,t.status)}</b></span><span><small>{tr(lang,"equipment")}</small><b>{t.equipment.length}</b></span></div>
 <div className="tank-dim-line">{t.display.length} × {t.display.width} × {t.display.height} cm</div></button>)}</div></section>;
}
