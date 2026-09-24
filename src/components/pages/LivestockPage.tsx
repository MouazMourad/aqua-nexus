"use client";
import { useMemo,useState } from "react";
import type { LivestockItem,Tank } from "@/domain/types";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { bioload,livestockBioloadContribution } from "@/domain/health";
import { auditTankCompatibility } from "@/domain/compatibility";
import { stockingReadiness } from "@/domain/stockingReadiness";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi,categoryText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { AdvancedSection } from "@/components/ui/AdvancedSection";
import { ContextHint } from "@/components/ui/ContextHint";
import { uid,today,nowISO } from "@/lib/appUtils";
import { PlantCarePanel } from "@/components/plant/PlantCarePanel";
import { validateLivestockEntry } from "@/domain/inputSanity";

type EntryCategory=LivestockItem["category"]|"macroalgae";

export function LivestockPage({tank,onLibrary}:{tank:Tank;onLibrary:()=>void}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [open,setOpen]=useState(false),[alreadyPresent,setAlreadyPresent]=useState(true),[category,setCategory]=useState<EntryCategory>("fish"),[selected,setSelected]=useState(""),[custom,setCustom]=useState(""),[qty,setQty]=useState(1),[riskConfirmed,setRiskConfirmed]=useState(false),[editId,setEditId]=useState<string|null>(null),[editQty,setEditQty]=useState(1),[editHealth,setEditHealth]=useState<LivestockItem["health"]>("good"),[editSize,setEditSize]=useState(0),[editNotes,setEditNotes]=useState(""),[removeId,setRemoveId]=useState<string|null>(null),[exitReason,setExitReason]=useState<"death"|"sold"|"transferred"|"returned"|"removed"|"unknown">("removed"),[bodyRemoved,setBodyRemoved]=useState(true),[exitSymptoms,setExitSymptoms]=useState(""),[exitNotes,setExitNotes]=useState("");
 const b=bioload(tank);
 const audit=useMemo(()=>auditTankCompatibility(tank),[tank]);
 const library:any[]=LIVESTOCK_LIBRARY.filter((x:any)=>x.type===tank.type);
 const list=useMemo(()=>library.filter((x:any)=>{
   const c=String(x.cat).toLowerCase();
   const mapped:EntryCategory=c==="fish"?"fish":c==="coral"?"coral":c==="invert"?"invert":c==="plant"?(tank.type==="marine"?"macroalgae":"plant"):"other";
   return mapped===category;
 }),[category,tank.type]);
 const chosen:any=list.find(x=>x.id===selected);
 const readiness=selected?stockingReadiness(tank,{candidate:selected==="__other__"?undefined:chosen,quantity:qty,candidateKnown:selected==="__other__"?false:Boolean(chosen),candidateLabelAr:custom||tr(lang,"otherEntry"),candidateLabelEn:custom||"Manual species"}):null;
 const check=readiness?.compatibility??null;
 const readinessNeedsConfirm=Boolean(readiness&&(readiness.state==="insufficient_evidence"||readiness.requiresConfirmation));

 function reset(){setSelected("");setCustom("");setQty(1);setRiskConfirmed(false)}
 function close(){setOpen(false);reset()}
 function add(){
  const sanity=validateLivestockEntry({quantity:qty});
  if(!sanity.ok){window.alert(lang==="ar"?sanity.issues[0]?.ar:sanity.issues[0]?.en);return}
  if(!alreadyPresent&&readiness?.state==="not_now")return;
  if(!alreadyPresent&&readinessNeedsConfirm&&!riskConfirmed)return;
  const name=selected==="__other__"?(custom||tr(lang,"otherEntry")):(chosen?.ar||custom);
  const nameEn=selected==="__other__"?(custom||"Other"):(chosen?.en||custom);
  const item:LivestockItem={id:uid("live"),libraryId:chosen?.id,name,nameEn,category:category==="macroalgae"?"plant":category,subtype:category==="macroalgae"?"macroalgae":undefined,quantity:qty,health:"good",load:chosen?.load??1,addedAt:today()};
  patch(tank.id,t=>({...t,livestock:[...t.livestock,item],timeline:[{id:uid("ev"),timestamp:nowISO(),type:"livestock",textAr:`تمت إضافة ${qty} × ${name}.`,textEn:`Added ${qty} × ${nameEn}.`},...t.timeline]}));
  close();
 }
 const remove=(id:string)=>{setRemoveId(id);setExitReason("removed");setBodyRemoved(true);setExitSymptoms("");setExitNotes("")};
 const confirmRemove=()=>{if(!removeId)return;const activeTreatment=tank.quarantine.some(q=>q.status==="active"&&q.livestockId===removeId);if(activeTreatment&&exitReason!=="death"){window.alert(bi(lang,"لا يمكن إخراج هذا الكائن وهو مرتبط بحالة حجر/علاج نشطة. أغلق حالة العلاج أولاً أو سجّل الوفاة إذا كان الكائن قد مات.","This livestock cannot leave the tank while linked to an active quarantine/treatment case. Close the treatment case first, or record a death if the organism died."));return}patch(tank.id,t=>{const item=t.livestock.find(x=>x.id===removeId),ts=nowISO();if(!item)return t;const exit={id:uid("exit"),timestamp:ts,livestockId:item.id,name:item.name,nameEn:item.nameEn,category:item.category,quantity:item.quantity,reason:exitReason,bodyRemoved:exitReason==="death"?bodyRemoved:undefined,symptoms:exitSymptoms||undefined,notes:exitNotes||undefined};const reasonAr=exitReason==="death"?"وفاة":exitReason==="sold"?"بيع":exitReason==="transferred"?"نقل":exitReason==="returned"?"إرجاع":"إزالة";const reasonEn=exitReason==="death"?"death":exitReason==="sold"?"sold":exitReason==="transferred"?"transferred":exitReason==="returned"?"returned":"removed";const chambers=t.sump.chambers.map(ch=>ch.refugium?{...ch,refugium:{...ch.refugium,livestockIds:ch.refugium.livestockIds.filter(id=>id!==removeId)}}:ch);const livestock=t.livestock.filter(x=>x.id!==removeId).map(x=>({...x,parentLivestockId:x.parentLivestockId===removeId?undefined:x.parentLivestockId,lifeEvents:(x.lifeEvents??[]).map(e=>e.childLivestockId===removeId?{...e,childLivestockId:undefined}:e)}));const quarantine=t.quarantine.map(q=>q.livestockId===removeId&&q.status==="active"?{...q,status:"closed" as const,nextDoseAt:undefined,outcome:exitReason==="death"?"worse" as const:"stable" as const}:q);const photos=t.photos.map(p=>p.livestockId===removeId?{...p,livestockId:undefined}:p);const visionAssessments=(t.visionAssessments??[]).map(v=>v.livestockId===removeId?{...v,livestockId:undefined}:v);return {...t,livestock,quarantine,photos,visionAssessments,sump:{...t.sump,chambers},livestockExits:[exit,...(t.livestockExits??[])],timeline:[{id:uid("ev"),timestamp:ts,type:`livestock-${exitReason}`,textAr:`${reasonAr}: ${item.quantity} × ${item.name}.`,textEn:`${item.quantity} × ${item.nameEn||item.name} ${reasonEn}.`},...t.timeline]};});setRemoveId(null)};
 const startEdit=(x:LivestockItem)=>{setEditId(x.id);setEditQty(x.quantity);setEditHealth(x.health);setEditSize(x.sizeCm??0);setEditNotes(x.notes??"")};
 const saveEdit=()=>{if(!editId)return;const sanity=validateLivestockEntry({quantity:editQty,sizeCm:editSize});if(!sanity.ok){window.alert(lang==="ar"?sanity.issues[0]?.ar:sanity.issues[0]?.en);return}const current=tank.livestock.find(x=>x.id===editId),ts=nowISO();const hasActiveTreatment=Boolean(current&&tank.quarantine.some(q=>q.status==="active"&&q.livestockId===current.id));const createTreatmentCase=editHealth==="treatment"&&current?.health!=="treatment"&&!hasActiveTreatment&&window.confirm(lang==="ar"?"حوّلت الكائن إلى Treatment. هل تريد إنشاء حالة حجر/علاج مرتبطة حتى ما تضيع المتابعة؟":"You marked this livestock as Treatment. Create a linked quarantine/treatment case so follow-up is not lost?");patch(tank.id,t=>({...t,livestock:t.livestock.map(x=>x.id===editId?{...x,quantity:Math.max(1,editQty),health:editHealth,sizeCm:editSize>0?editSize:undefined,notes:editNotes,lastObservedAt:ts}:x),quarantine:createTreatmentCase&&current?[{id:uid("q"),livestockId:current.id,organism:current.name,reason:lang==="ar"?"تم تحويل حالة الكائن إلى Treatment من صفحة الكائنات.":"Livestock was marked Treatment from the livestock page.",plan:"",start:today(),status:"active" as const},...t.quarantine]:t.quarantine,timeline:[{id:uid("ev"),timestamp:ts,type:"livestock-observation",textAr:createTreatmentCase?"تم تحديث حالة الكائن وإنشاء حالة علاج مرتبطة.":"تم تحديث حالة كائن وملاحظاته.",textEn:createTreatmentCase?"Livestock status was updated and a linked treatment case was created.":"Livestock status/observation was updated."},...t.timeline]}));setEditId(null)};

 return <section className="page-grid">
  <PageHeader eyebrow="LIVESTOCK" title={tr(lang,"livestock")} actions={<><button className="btn" onClick={onLibrary}>{tr(lang,"library")}</button><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addLivestock")}</button></>}/>

  {tank.livestock.length===0&&<div className="inline-alert info full-span"><div><b>🐠 {lang==="ar"?"ابدأ بإضافة الكائنات الموجودة فعلياً بحوضك.":"Start by adding the livestock that is actually in your tank."}</b><p>{lang==="ar"?"استخدم المكتبة إذا لقيت النوع، لأنها بتعطي البرنامج معلومات أدق عن الحمل الحيوي والتوافق. وإذا النوع مو موجود، فيك تضيفه يدوياً بدون ما تتوقف.":"Use the library when your species is available because it gives Aqua Nexus better bioload and compatibility context. If it is not listed, you can still add it manually."}</p><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addLivestock")}</button></div></div>}
  <div className="card panel">
   <h3>{tr(lang,"bioload")}</h3>
   <b className="big-number">{Math.round(b.ratio*100)}%</b>
   <span className={`status ${b.status==="high"||b.status==="danger"?"warn":""}`}>{tr(lang,b.status)}</span>
  </div>

  <div className="card panel full-span">
   <div className="module-head"><div><small className="eyebrow-mini">SYSTEM COMPATIBILITY</small><h3>{lang==="ar"?"توافق الكائنات الحالية":"Current livestock compatibility"}</h3><p className="note">{lang==="ar"?`التغطية الموثقة ${audit.verifiedCoverage}% (${audit.knownCount}/${audit.totalCount||0} كائنات معروفة للمكتبة).`:`Verified coverage ${audit.verifiedCoverage}% (${audit.knownCount}/${audit.totalCount||0} library-known livestock).`}</p></div><span className={`status ${audit.level==="danger"?"danger":audit.level==="warn"?"warn":""}`}>{audit.totalCount&&audit.knownCount===0?"N/A":`${audit.score}%`}</span></div>
   {audit.issues.length?<div className="compat-issues">{audit.issues.map((x,i)=><div key={i} className={`inline-alert ${x.level}`}>{lang==="ar"?x.ar:x.en}</div>)}</div>:<div className="inline-alert good">✓ {lang==="ar"?"ما في تعارض معروف ضمن الكائنات المسجلة حالياً.":"No known conflict is detected among currently registered livestock."}</div>}
   <p className="note">{lang==="ar"?"هالفحص مستمر على كل الموجود بالحوض، مو بس وقت إضافة كائن جديد، ونتيجته تدخل بالصحة العامة وبـ Local Best AI.":"This audit continuously checks existing livestock, not only new additions, and feeds overall health and Local Best AI."}</p>
  </div>

  <div className="card panel full-span">
   <div className="table-wrap"><table><thead><tr><th>{tr(lang,"name")}</th><th>{tr(lang,"category")}</th><th>{tr(lang,"quantity")}</th><th>{lang==="ar"?"الصحة":"Health"}</th><th>{tr(lang,"load")}</th><th></th></tr></thead>
   <tbody>{tank.livestock.map(x=><tr key={x.id}><td>{lang==="ar"?x.name:(x.nameEn||x.name)}{x.sizeCm&&<small style={{display:"block"}}>{x.sizeCm} cm</small>}</td><td>{x.subtype==="macroalgae"?bi(lang,"ماكرو ألجي","Macroalgae"):categoryText(lang,x.category)}</td><td>{x.quantity}</td><td><span className={`status ${x.health!=="good"?"warn":""}`}>{x.health}</span></td><td>{livestockBioloadContribution(x).toFixed(1)}</td><td><button className="btn" onClick={()=>startEdit(x)}>✎</button> <button className="btn danger" onClick={()=>remove(x.id)}>×</button></td></tr>)}</tbody></table></div>
  </div>

  <PlantCarePanel tank={tank}/>

  <Modal open={!!editId} title={lang==="ar"?"تحديث حالة الكائن":"Update livestock"} onClose={()=>setEditId(null)}>
  {editId&&(()=>{const item=tank.livestock.find(x=>x.id===editId);return item?<div className="inline-alert info"><div><b>🐾 {lang==="ar"?item.name:(item.nameEn||item.name)}</b><p>{categoryText(lang,item.category)} • {item.quantity} ×</p></div></div>:null})()}
  <div className="form-grid"><label className="field"><span>{tr(lang,"quantity")}</span><input type="number" min="1" value={editQty} onChange={e=>setEditQty(Number(e.target.value))}/></label><label className="field"><span>{lang==="ar"?"الصحة":"Health"}</span><select value={editHealth} onChange={e=>setEditHealth(e.target.value as LivestockItem["health"])}><option value="good">{lang==="ar"?"جيدة":"Good"}</option><option value="watch">{lang==="ar"?"مراقبة":"Watch"}</option><option value="treatment">{lang==="ar"?"علاج":"Treatment"}</option></select></label></div>
  <AdvancedSection titleAr="متابعة النمو والملاحظات" titleEn="Growth & observation details" summaryAr="الحجم والملاحظات اختيارية، لكنها تفيد المقارنة مع الصور والنمو عبر الزمن." summaryEn="Size and notes are optional, but useful for photo and growth comparisons over time."><div style={{display:"grid",gap:9,paddingTop:10}}><ContextHint id="livestock-size-tracking" lang={lang} ar="الحجم التقريبي ما لازم يكون دقيق للمليمتر؛ الهدف يكون عندك خط أساس تقارن معه النمو لاحقاً." en="Estimated size does not need millimeter precision; it provides a baseline for later growth comparison."/><div className="form-grid"><label className="field"><span>{lang==="ar"?"الحجم التقريبي cm":"Estimated size cm"}</span><input type="number" min="0" step=".1" value={editSize||""} onChange={e=>setEditSize(Number(e.target.value))}/></label><label className="field full-field"><span>{tr(lang,"notes")}</span><textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)}/></label></div></div></AdvancedSection><div className="modal-actions"><button className="btn" onClick={()=>setEditId(null)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={saveEdit}>{tr(lang,"save")}</button></div></Modal>

  <Modal open={!!removeId} title={lang==="ar"?"سبب خروج الكائن":"Livestock exit reason"} onClose={()=>setRemoveId(null)}><div className="form-grid"><label className="field"><span>{lang==="ar"?"شو صار؟":"What happened?"}</span><select value={exitReason} onChange={e=>setExitReason(e.target.value as any)}><option value="removed">{lang==="ar"?"إزالة من السجل":"Removed"}</option><option value="death">{lang==="ar"?"وفاة":"Death"}</option><option value="sold">{lang==="ar"?"بيع":"Sold"}</option><option value="transferred">{lang==="ar"?"نقل لحوض آخر":"Transferred"}</option><option value="returned">{lang==="ar"?"إرجاع":"Returned"}</option><option value="unknown">{lang==="ar"?"غير معروف":"Unknown"}</option></select></label>{exitReason==="death"&&<><label className="field"><span>{lang==="ar"?"تمت إزالة الجسم من الحوض؟":"Body removed from tank?"}</span><select value={bodyRemoved?"yes":"no"} onChange={e=>setBodyRemoved(e.target.value==="yes")}><option value="yes">{lang==="ar"?"نعم":"Yes"}</option><option value="no">{lang==="ar"?"لا / غير موجود":"No / not found"}</option></select></label><label className="field full-field"><span>{lang==="ar"?"أعراض قبل الوفاة إن وجدت":"Symptoms before death, if known"}</span><textarea value={exitSymptoms} onChange={e=>setExitSymptoms(e.target.value)}/></label></>}<label className="field full-field"><span>{tr(lang,"notes")}</span><textarea value={exitNotes} onChange={e=>setExitNotes(e.target.value)}/></label></div><div className="modal-actions"><button className="btn" onClick={()=>setRemoveId(null)}>{tr(lang,"cancel")}</button><button className="btn danger" onClick={confirmRemove}>{lang==="ar"?"تأكيد":"Confirm"}</button></div></Modal>

  <Modal open={open} title={tr(lang,"addLivestock")} onClose={close}>
   <label className="risk-confirm"><input type="checkbox" checked={alreadyPresent} onChange={e=>setAlreadyPresent(e.target.checked)}/><span>{bi(lang,"هذا الكائن موجود فعلياً بالحوض — سجّل الواقع حتى لو كانت جاهزية إضافة كائن جديد غير مكتملة","This livestock is already in the tank — record reality even if new-addition readiness is incomplete")}</span></label><div className="form-grid">
    <label className="field"><span>{tr(lang,"category")}</span><select value={category} onChange={e=>{setCategory(e.target.value as EntryCategory);setSelected("");setRiskConfirmed(false)}}><option value="fish">{tr(lang,"fish")}</option>{tank.type==="marine"&&<option value="coral">{tr(lang,"coral")}</option>}<option value="invert">{tr(lang,"invert")}</option>{tank.type==="marine"?<option value="macroalgae">{bi(lang,"ماكرو ألجي","Macroalgae")}</option>:<option value="plant">{tr(lang,"plant")}</option>}<option value="other">{tr(lang,"other")}</option></select></label>
    <label className="field"><span>{tr(lang,"selectOrganism")}</span><select value={selected} onChange={e=>{setSelected(e.target.value);setRiskConfirmed(false)}}><option value="">—</option>{list.map((x:any)=><option value={x.id} key={x.id}>{lang==="ar"?x.ar:x.en}</option>)}<option value="__other__">{tr(lang,"otherEntry")}</option></select></label>
    {selected==="__other__"&&<label className="field full-field"><span>{tr(lang,"name")}</span><input value={custom} onChange={e=>setCustom(e.target.value)}/></label>}
    <label className="field"><span>{tr(lang,"quantity")}</span><input type="number" min="1" value={qty} onChange={e=>{setQty(Number(e.target.value));setRiskConfirmed(false)}}/></label>
   </div>

   {readiness&&<div className={`compatibility-panel ${readiness.state==="not_now"?"danger":readiness.state==="insufficient_evidence"?"warn":"good"}`}>
    <div className="compat-head"><h3>{lang==="ar"?"جاهزية الإضافة":"Addition readiness"}</h3><span className={`compat-badge ${readiness.state==="not_now"?"danger":readiness.state==="insufficient_evidence"?"warn":"good"}`}>{lang==="ar"?(readiness.state==="ready"?"جاهز مبدئياً":readiness.state==="not_now"?"ليس الآن":"بيانات غير كافية"):(readiness.state==="ready"?"Provisionally ready":readiness.state==="not_now"?"Not now":"Insufficient evidence")}</span></div>
    {readiness.blockersAr.map((x,i)=><div className="inline-alert danger" key={`block-${i}`}>{lang==="ar"?x:readiness.blockersEn[i]}</div>)}
    {readiness.missingEvidenceAr.map((x,i)=><div className="inline-alert warn" key={`missing-${i}`}>{lang==="ar"?`معلومة ناقصة: ${x}`:`Missing evidence: ${readiness.missingEvidenceEn[i]}`}</div>)}
    {readiness.cautionsAr.map((x,i)=><div className="inline-alert warn" key={`caution-${i}`}>{lang==="ar"?x:readiness.cautionsEn[i]}</div>)}
   </div>}

   {check&&<div className={`compatibility-panel ${check.level}`}>
    <div className="compat-head">
      <h3>{tr(lang,"compatibilityReport")}</h3>
      <span className={`compat-badge ${check.level}`}>{tr(lang,check.level==="good"?"compatible":check.level==="warn"?"caution":"incompatible")}</span>
    </div>
    <div className="bioload-comparison">
      <div><small>{tr(lang,"currentBioload")}</small><b>{Math.round(check.currentRatio*100)}%</b></div>
      <div className="arrow">→</div>
      <div><small>{tr(lang,"projectedBioload")}</small><b className={`bio-${check.projectedStatus}`}>{Math.round(check.projectedRatio*100)}%</b></div>
    </div>
    {check.issues.length ? <div className="compat-issues">{check.issues.map((issue,i)=><div key={i} className={`inline-alert ${issue.level}`}>{lang==="ar"?issue.ar:issue.en}</div>)}</div> : <div className="inline-alert good">{tr(lang,"noConflict")}</div>}
    {check.blocked&&<div className="inline-alert danger"><b>{lang==="ar"?"لن يسمح Aqua Nexus بإضافة هذا الكائن لأن التعارض مصنف خطراً.":"Aqua Nexus will not add this organism because the detected incompatibility is classified as dangerous."}</b></div>}
    {readinessNeedsConfirm&&readiness?.state!=="not_now"&&<label className="risk-confirm"><input type="checkbox" checked={riskConfirmed} onChange={e=>setRiskConfirmed(e.target.checked)}/><span>{lang==="ar"?"أفهم أن الجاهزية غير مكتملة أو يوجد تنبيه، وأريد تسجيل الإضافة مع هذه الملاحظة.":"I understand readiness is incomplete or cautioned and want to record the addition with this warning."}</span></label>}
   </div>}

   {selected==="__other__"&&<div className="inline-alert warn">{lang==="ar"?"النوع اليدوي يبقى مسجلاً، لكن Aqua Nexus ما رح يدّعي أن توافقه موثّق. سيظهر ضمن Coverage غير المكتملة حتى يتم ربطه بنوع معروف.":"The manual species can still be recorded, but Aqua Nexus will not claim verified compatibility. It remains outside verified coverage until linked to a known species."}</div>}

   <div className="modal-actions"><button className="btn" onClick={close}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={add} disabled={!selected || (!alreadyPresent&&(readiness?.state==="not_now" || (readinessNeedsConfirm&&!riskConfirmed)))}>{!alreadyPresent&&readiness?.state==="not_now"?(lang==="ar"?"ليس مناسباً الآن":"Not suitable now") : tr(lang,"save")}</button></div>
  </Modal>
 </section>;
}
