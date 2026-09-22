"use client";
import { useEffect,useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdvancedSection } from "@/components/ui/AdvancedSection";
import { ContextHint } from "@/components/ui/ContextHint";
import { nowISO,uid } from "@/lib/appUtils";
import { historyArchiveStats,historyPage,unifiedTankHistory,type UnifiedHistoryRow } from "@/domain/historyPagination";
import { readTankHistoryArchive,type TankHistoryArchive } from "@/lib/historyArchiveStorage";
import { archiveHistoricalDomains,historicalDomains,longTermHistoryStats,readHistoricalPage,type HistoricalDomain,type HistoricalRecord } from "@/lib/longTermHistory";

const PAGE_SIZE=200;

export function TimelinePage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[ar,setAr]=useState(""),[en,setEn]=useState(""),[search,setSearch]=useState(""),[type,setType]=useState("all");
 const [archive,setArchive]=useState<TankHistoryArchive|null>(null),[rows,setRows]=useState<UnifiedHistoryRow[]>([]),[nextCursor,setNextCursor]=useState<string|null>(null),[archiveNote,setArchiveNote]=useState("");
 const [longStats,setLongStats]=useState<{total:number;byDomain:Partial<Record<HistoricalDomain,number>>}>({total:0,byDomain:{}});
 const [archiveDomain,setArchiveDomain]=useState<HistoricalDomain>("chemistry"),[archivedRows,setArchivedRows]=useState<HistoricalRecord[]>([]),[archiveCursor,setArchiveCursor]=useState<{timestampMs:number;id:string}|null>(null);
 useEffect(()=>{let cancelled=false;readTankHistoryArchive(tank.id).then(x=>{if(!cancelled)setArchive(x)});longTermHistoryStats(tank.id).then(x=>{if(!cancelled)setLongStats(x)}).catch(()=>{});return()=>{cancelled=true}},[tank.id]);
 useEffect(()=>{let cancelled=false;readHistoricalPage(tank.id,archiveDomain,{limit:100}).then(page=>{if(cancelled)return;setArchivedRows(page.rows);setArchiveCursor(page.nextCursor)}).catch(()=>{if(!cancelled){setArchivedRows([]);setArchiveCursor(null)}});return()=>{cancelled=true}},[tank.id,archiveDomain]);
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
  const result=await archiveHistoricalDomains(tank,cutoff.toISOString());
  if(!result.ok){setArchiveNote(bi(lang,"تعذر إنشاء الأرشيف طويل الأمد؛ لم يتم حذف أي سجل من الحالة التشغيلية.","Long-term archive could not be created; no live record was removed."));return}
  if(!result.archived){setArchiveNote(bi(lang,"ما في سجلات مؤهلة أقدم من سنتين تحتاج أرشفة.","There are no eligible records older than two years to archive."));return}
  const ts=nowISO();
  patch(tank.id,{...result.tank,timeline:[{id:uid("ev"),timestamp:ts,type:"history-archive",textAr:`تمت أرشفة ${result.archived} سجل قديم عبر عدة مجالات بعد التحقق من التخزين.`,textEn:`${result.archived} old records across multiple domains were archived after storage verification.`},...result.tank.timeline]});
  const stats=await longTermHistoryStats(tank.id);setLongStats(stats);
  const page=await readHistoricalPage(tank.id,archiveDomain,{limit:100});setArchivedRows(page.rows);setArchiveCursor(page.nextCursor);
  setArchiveNote(bi(lang,"تم نقل السجلات الأقدم من سنتين إلى مخزن تاريخي مفهرس. تبقى ضمن Full Recovery Backup ويمكن تصفحها أدناه.","Records older than two years moved to the indexed historical store. They remain part of Full Recovery Backup and can be browsed below."));
 };
 const loadArchived=async()=>{
  if(!archiveCursor)return;
  const page=await readHistoricalPage(tank.id,archiveDomain,{limit:100,cursor:archiveCursor});
  setArchivedRows(x=>[...x,...page.rows]);setArchiveCursor(page.nextCursor);
 };
 const historyText=(row:HistoricalRecord)=>{
  const p=row.payload as any;
  if(archiveDomain==="chemistry")return Object.entries(p?.values??{}).map(([k,v])=>`${k} ${v}`).join(" • ");
  if(archiveDomain==="feeding")return `${p?.food??""} ${p?.amount??""}`;
  if(archiveDomain==="waterChanges")return `${p?.liters??"—"} L • ${p?.percent??"—"}%`;
  if(archiveDomain==="dosing")return `${p?.parameter??p?.material??"Dose"} • ${p?.amount??p?.ml??"—"}`;
  if(archiveDomain==="expenses")return `${p?.description??"Expense"} • ${p?.amount??"—"} ${p?.currency??""}`;
  if(archiveDomain==="timeline"||archiveDomain==="intelligenceEvents")return lang==="ar"?(p?.textAr??p?.verb??""):(p?.textEn??p?.verb??"");
  return String(p?.name??p?.organism??p?.kind??p?.type??p?.reason??p?.status??row.id);
 };

 return <section className="page-grid"><PageHeader eyebrow="TANK TIMELINE" title={tr(lang,"timeline")} actions={<button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addEvent")}</button>}/>
 <div className="card panel full-span"><div className="summary-strip"><div className="summary"><small>{bi(lang,"السجل التشغيلي الظاهر","Visible operational history")}</small><b>{stats.total}</b></div><div className="summary"><small>{bi(lang,"الأرشيف طويل الأمد","Long-term archive")}</small><b>{longStats.total}</b></div><div className="summary"><small>{bi(lang,"أقدم حدث ظاهر","Oldest visible event")}</small><b>{stats.oldestAt?new Date(stats.oldestAt).toLocaleDateString():"—"}</b></div></div>{archiveNote&&<div className="inline-alert info" style={{marginTop:10}}>{archiveNote}</div>}</div>
 <div className="filter-bar full-span"><label className="field"><span>{bi(lang,"نوع الحدث","Event type")}</span><select value={type} onChange={e=>setType(e.target.value)}><option value="all">{tr(lang,"all")}</option>{types.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label className="field grow"><span>{tr(lang,"search")}</span><input value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
 <div className="full-span"><AdvancedSection titleAr="الأرشيف طويل الأمد" titleEn="Long-term archive" summaryAr="للبحث بتاريخ السنوات وأرشفة السجلات القديمة؛ السجل التشغيلي الحالي يبقى ظاهر مباشرة." summaryEn="For years of history and archiving old records; current operational history stays immediately visible." defaultOpen={false}>
  <div style={{display:"grid",gap:10,paddingTop:10}}>
   <ContextHint id="timeline-archive" lang={lang} ar="الأرشفة ما بتحذف تاريخ الحوض؛ بتنقل السجلات القديمة لمخزن مفهرس حتى تظل الواجهة سريعة." en="Archiving does not delete tank history; it moves older records into indexed storage so the interface stays fast."/>
   <button className="btn" disabled={Boolean(tank.isTraining)} onClick={()=>void archiveOld()}>{bi(lang,"أرشفة السجلات القديمة","Archive old history")}</button>
   <section className="card panel full-span"><div className="module-head"><div><small className="eyebrow-mini">LONG-TERM HISTORY</small><h3>{bi(lang,"الأرشيف التاريخي المفهرس","Indexed historical archive")}</h3><p className="note">{bi(lang,"يتم تحميل 100 سجل فقط كل مرة مباشرة من IndexedDB، وليس تحميل تاريخ السنوات كله إلى الذاكرة.","Only 100 records are loaded per page directly from IndexedDB; years of history are not loaded into memory at once.")}</p></div><span className="scene-badge">{longStats.total}</span></div><label className="field"><span>{bi(lang,"المجال","Domain")}</span><select data-testid="history-domain" value={archiveDomain} onChange={e=>setArchiveDomain(e.target.value as HistoricalDomain)}>{historicalDomains.map(d=><option key={d} value={d}>{d} ({longStats.byDomain[d]??0})</option>)}</select></label>{archivedRows.length?<div className="history-list" data-testid="archived-history-list">{archivedRows.map(row=><div className="history-row" key={row.key}><div><b>{historyText(row)||row.id}</b><small>{new Date(row.timestamp).toLocaleString()} • {row.domain}</small></div></div>)}</div>:<div className="empty-state">{bi(lang,"لا يوجد أرشيف بهذا المجال بعد.","No archived records in this domain yet.")}</div>}{archiveCursor&&<button className="btn" onClick={()=>void loadArchived()}>{bi(lang,"تحميل 100 سجل أقدم","Load 100 older records")}</button>}</section>
  </div>
 </AdvancedSection></div>
 <div className="timeline full-span">{rows.length?rows.map(x=><article className="timeline-item" key={x.id}><span className="timeline-dot"/><div><small>{new Date(x.timestamp).toLocaleString()}</small><b>{lang==="ar"?x.textAr:x.textEn}</b><em>{x.type}{x.source==="intelligence"?" • Tank Brain":""}</em></div></article>):<div className="empty-state">{tr(lang,"timelineEmpty")}</div>}{nextCursor&&<button className="btn" onClick={loadMore}>{bi(lang,"عرض 200 حدث أقدم","Show 200 older events")}</button>}</div>
 <Modal open={open} title={tr(lang,"addEvent")} onClose={()=>setOpen(false)}>
  <div className="form-grid"><label className="field full-field"><span>{lang==="ar"?"وصف الحدث":"Event description"}</span><textarea value={lang==="ar"?ar:en} onChange={e=>lang==="ar"?setAr(e.target.value):setEn(e.target.value)}/></label></div>
  <AdvancedSection titleAr="الوصف باللغة الثانية" titleEn="Second-language description" summaryAr="اختياري؛ يفيد إذا بدلت لغة البرنامج لاحقاً." summaryEn="Optional; useful if you switch the app language later."><div className="form-grid" style={{paddingTop:10}}><label className="field full-field"><span>{lang==="ar"?"English":"العربية"}</span><textarea value={lang==="ar"?en:ar} onChange={e=>lang==="ar"?setEn(e.target.value):setAr(e.target.value)}/></label></div></AdvancedSection>
  <div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
