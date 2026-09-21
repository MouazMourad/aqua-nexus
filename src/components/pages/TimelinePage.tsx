"use client";
import { useEffect,useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { nowISO,uid } from "@/lib/appUtils";
import { historyArchiveStats,historyPage,unifiedTankHistory,type UnifiedHistoryRow } from "@/domain/historyPagination";
import { archiveOldTankHistory,readTankHistoryArchive,type TankHistoryArchive } from "@/lib/historyArchiveStorage";

const PAGE_SIZE=200;

export function TimelinePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[ar,setAr]=useState(""),[en,setEn]=useState(""),[search,setSearch]=useState(""),[type,setType]=useState("all");
 const [archive,setArchive]=useState<TankHistoryArchive|null>(null),[rows,setRows]=useState<UnifiedHistoryRow[]>([]),[nextCursor,setNextCursor]=useState<string|null>(null),[archiveNote,setArchiveNote]=useState("");
 useEffect(()=>{let cancelled=false;readTankHistoryArchive(tank.id).then(x=>{if(!cancelled)setArchive(x)});return()=>{cancelled=true}},[tank.id]);
 const allEvents=useMemo(()=>unifiedTankHistory(tank,archive),[tank,archive]);
 const types=useMemo(()=>[...new Set(allEvents.map(x=>x.type))].sort(),[allEvents]);
 const stats=useMemo(()=>historyArchiveStats(tank,archive),[tank,archive]);

 useEffect(()=>{
  const first=historyPage(tank,{archive,limit:PAGE_SIZE,type,search});
  setRows(first.rows);setNextCursor(first.nextCursor);
 },[tank,archive,type,search]);

 const loadMore=()=>{
  if(!nextCursor)return;
  const page=historyPage(tank,{archive,cursor:nextCursor,limit:PAGE_SIZE,type,search});
  setRows(current=>[...current,...page.rows]);setNextCursor(page.nextCursor);
 };
 const add=()=>{if(!(ar||en).trim())return;patch(tank.id,t=>({...t,timeline:[{id:uid("ev"),timestamp:nowISO(),type:"manual",textAr:ar||en,textEn:en||ar},...t.timeline]}));setOpen(false);setAr("");setEn("")};
 const archiveOld=async()=>{
  if(tank.isTraining)return;
  const cutoff=new Date();cutoff.setUTCFullYear(cutoff.getUTCFullYear()-2);
  const result=await archiveOldTankHistory(tank,cutoff.toISOString());
  if(!result.ok){setArchiveNote(bi(lang,"تعذر إنشاء الأرشيف المحلي؛ لم يتم حذف أي حدث من الحالة التشغيلية.","Local archive could not be created; no live history was removed."));return}
  if(!result.archivedTimeline&&!result.archivedEvents){setArchiveNote(bi(lang,"ما في أحداث أقدم من سنتين تحتاج أرشفة.","There are no events older than two years to archive."));return}
  const ts=nowISO();
  patch(tank.id,{...result.tank,timeline:[{id:uid("ev"),timestamp:ts,type:"history-archive",textAr:`تمت أرشفة ${result.archivedTimeline+result.archivedEvents} حدث قديم محلياً بعد التحقق من النسخة.`,textEn:`${result.archivedTimeline+result.archivedEvents} old history events were archived locally after verification.`},...result.tank.timeline]});
  setArchive(await readTankHistoryArchive(tank.id));
  setArchiveNote(bi(lang,"تم نقل التاريخ الأقدم من سنتين إلى الأرشيف المحلي مع بقائه ظاهراً وقابلاً للبحث والنسخ الاحتياطي.","History older than two years moved to the verified local archive while remaining searchable and backup-safe."));
 };

 return <section className="page-grid"><PageHeader eyebrow="TANK TIMELINE" title={tr(lang,"timeline")} actions={<><button className="btn" disabled={Boolean(tank.isTraining)} onClick={()=>void archiveOld()}>{bi(lang,"أرشفة القديم","Archive old history")}</button><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addEvent")}</button></>}/>
 <div className="card panel full-span"><div className="summary-strip"><div className="summary"><small>{bi(lang,"إجمالي السجل","Total history")}</small><b>{stats.total}</b></div><div className="summary"><small>{bi(lang,"بالأرشيف المحلي","Locally archived")}</small><b>{stats.archived}</b></div><div className="summary"><small>{bi(lang,"أقدم حدث","Oldest event")}</small><b>{stats.oldestAt?new Date(stats.oldestAt).toLocaleDateString():"—"}</b></div></div>{archiveNote&&<div className="inline-alert info" style={{marginTop:10}}>{archiveNote}</div>}</div>
 <div className="filter-bar full-span"><label className="field"><span>{bi(lang,"نوع الحدث","Event type")}</span><select value={type} onChange={e=>setType(e.target.value)}><option value="all">{tr(lang,"all")}</option>{types.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label className="field grow"><span>{tr(lang,"search")}</span><input value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 <div className="timeline full-span">{rows.length?rows.map(x=><article className="timeline-item" key={x.id}><span className="timeline-dot"/><div><small>{new Date(x.timestamp).toLocaleString()}</small><b>{lang==="ar"?x.textAr:x.textEn}</b><em>{x.type}{x.source==="intelligence"?" • Tank Brain":""}</em></div></article>):<div className="empty-state">{tr(lang,"timelineEmpty")}</div>}{nextCursor&&<button className="btn" onClick={loadMore}>{bi(lang,"عرض 200 حدث أقدم","Show 200 older events")}</button>}</div>
 <Modal open={open} title={tr(lang,"addEvent")} onClose={()=>setOpen(false)}><div className="form-grid"><label className="field"><span>العربية</span><textarea value={ar} onChange={e=>setAr(e.target.value)}/></label><label className="field"><span>English</span><textarea value={en} onChange={e=>setEn(e.target.value)}/></label></div><div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
