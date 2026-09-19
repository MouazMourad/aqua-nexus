"use client";
import { useMemo,useState } from "react";
import { ResponsiveContainer,LineChart,Line,XAxis,YAxis,Tooltip,CartesianGrid } from "recharts";
import type { ChemistryReading,Tank } from "@/domain/types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { chemistryCatalogForTank,profileLabel,resolvedAquariumProfile } from "@/domain/chemistryProfile";
import { chemistryHealth,parameterScore } from "@/domain/health";
import { chemistryGuidance } from "@/domain/chemistryGuidance";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { nowISO,uid } from "@/lib/appUtils";
import { buildDelimitedText,downloadDelimitedFile,field,numberField,parseDelimitedText } from "@/lib/tabularImport";

export function ChemistryPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank),cfg:any=chemistryCatalogForTank(tank),latest=tank.chemistry[0]?.values??{};
 const profile=resolvedAquariumProfile(tank),latestReading=tank.chemistry[0];
 const keys=Object.keys(cfg); const [selected,setSelected]=useState(keys[0]); const [open,setOpen]=useState(false);
 const [values,setValues]=useState<Record<string,number>>(()=>Object.fromEntries(keys.map(k=>[k,Number(latest[k]??cfg[k].def)])));
 const [notes,setNotes]=useState(""),[testKit,setTestKit]=useState(""),[confidence,setConfidence]=useState<"high"|"medium"|"low">("high"),[importNote,setImportNote]=useState("");
 const chart=useMemo(()=>tank.chemistry.slice(0,30).reverse().map(r=>({date:new Date(r.timestamp).toLocaleDateString(),value:r.values[selected]})),[tank.chemistry,selected]);
 const guidance=useMemo(()=>chemistryGuidance(tank),[tank]);
 const topProblems=guidance.problems.slice(0,6);
 const actionItems=topProblems.slice(0,5);

 function markChemistryDone(t:Tank){
  return t.maintenance.map(m=>/قياس النسب الكيميائية|Weekly chemistry/i.test(`${m.title} ${m.titleEn||""}`)?{...m,done:true,lastDone:new Date().toISOString().slice(0,10),nextDue:new Date(Date.now()+7*86400000).toISOString().slice(0,10)}:m);
 }

 function save(){
  patch(tank.id,t=>({...t,
   chemistry:[{timestamp:nowISO(),values,notes,source:"manual",testKit:testKit.trim()||undefined,confidence},...t.chemistry],
   maintenance:markChemistryDone(t),
   timeline:[{id:uid("ev"),timestamp:nowISO(),type:"chemistry",textAr:"تم تسجيل قراءة كيمياء جديدة.",textEn:"A new chemistry reading was recorded."},...t.timeline]
  }));
  setOpen(false);
 }

 function downloadTemplate(kind:"csv"|"txt"){
  const headers=["timestamp",...keys,"testKit","confidence","notes"];
  const example:Record<string,unknown>={timestamp:new Date().toISOString(),testKit:"",confidence:"high",notes:""};
  keys.forEach(k=>example[k]=cfg[k].def);
  const delimiter=kind==="txt"?"\t":",";
  const text=buildDelimitedText(headers,[example],delimiter);
  downloadDelimitedFile(`Aqua_Nexus_${tank.type}_Chemistry_Template.${kind}`,text,kind==="txt"?"text/plain;charset=utf-8":"text/csv;charset=utf-8");
 }

 async function importReadings(file?:File){
  if(!file)return;
  try{
   const {rows}=parseDelimitedText(await file.text());
   const readings:ChemistryReading[]=[];
   rows.forEach(row=>{
    const vals:Record<string,number|null>={};
    let hasValue=false;
    keys.forEach(k=>{const n=numberField(row,k);vals[k]=n;if(n!==null)hasValue=true;});
    if(!hasValue)return;
    const rawTimestamp=field(row,"timestamp");
    const parsed=rawTimestamp?new Date(rawTimestamp):new Date();
    readings.push({
     timestamp:Number.isNaN(parsed.getTime())?nowISO():parsed.toISOString(),
     values:vals,
     notes:field(row,"notes")||undefined,
     source:"import",
     testKit:field(row,"testKit")||undefined,
     confidence:(["high","medium","low"].includes(field(row,"confidence").toLowerCase())?field(row,"confidence").toLowerCase():"medium") as "high"|"medium"|"low",
     usingDefaults:false
    });
   });
   if(!readings.length){setImportNote(bi(lang,"لم أجد قراءات صالحة في الملف.","No valid chemistry readings were found in the file."));return;}
   readings.sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
   patch(tank.id,t=>({...t,
    chemistry:[...readings,...t.chemistry].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()),
    maintenance:markChemistryDone(t),
    timeline:[{id:uid("ev"),timestamp:nowISO(),type:"chemistry-import",textAr:`تم استيراد ${readings.length} قراءة كيميائية من ملف.`,textEn:`Imported ${readings.length} chemistry reading(s) from a file.`},...t.timeline]
   }));
   setImportNote(bi(lang,`تم استيراد ${readings.length} قراءة بنجاح.`,`${readings.length} reading(s) imported successfully.`));
  }catch{
   setImportNote(bi(lang,"تعذر قراءة الملف. استخدم قالب Aqua Nexus بصيغة CSV أو TXT.","Could not read the file. Use the Aqua Nexus CSV or TXT template."));
  }
 }

 return <section className="page-grid"><PageHeader eyebrow="WATER CHEMISTRY" title={tr(lang,"chemistry")} actions={<div className="actions">
  <button className="btn" onClick={()=>downloadTemplate("csv")}>↓ Excel / CSV</button>
  <button className="btn" onClick={()=>downloadTemplate("txt")}>↓ TXT</button>
  <label className="btn">↑ {bi(lang,"استيراد ملف","Import file")}<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e=>{importReadings(e.target.files?.[0]);e.currentTarget.value="";}}/></label>
  <button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(lang,"addReading")}</button>
 </div>}/>
 {importNote&&<div className="inline-alert info full-span">{importNote}</div>}
 <div className="card panel chemistry-health-summary"><div className="chemistry-health-head"><div><h3>{tr(lang,"chemistryHealth")}</h3><b className="big-number">{guidance.health}%</b></div><span className={`chemistry-health-band ${guidance.health>=80?"good":guidance.health>=60?"warn":"danger"}`}>{guidance.health>=80?bi(lang,"جيدة","Good"):guidance.health>=60?bi(lang,"تحتاج انتباه","Needs attention"):bi(lang,"تحتاج تدخل","Needs action")}</span></div><p className="note">{lang==="ar"?guidance.headlineAr:guidance.headlineEn}</p><div className="summary-strip"><div className="summary"><small>{bi(lang,"بروفايل الأهداف","Target profile")}</small><b>{profileLabel(profile,lang)}</b></div><div className="summary"><small>{bi(lang,"مصدر آخر قراءة","Latest source")}</small><b>{latestReading?.source??"—"}</b></div><div className="summary"><small>{bi(lang,"Test kit / Device","Test kit / Device")}</small><b>{latestReading?.testKit||"—"}</b></div><div className="summary"><small>{bi(lang,"ثقة القراءة","Reading confidence")}</small><b>{latestReading?.confidence??"—"}</b></div></div>{guidance.agePenalty>0&&<div className="inline-alert warn">{bi(lang,`هناك خصم ${guidance.agePenalty} نقطة لأن آخر قراءة أقدم من 7 أيام.`,`${guidance.agePenalty} points are deducted because the latest reading is older than 7 days.`)}</div>}</div>
 <div className="card panel"><label className="field"><span>{tr(lang,"parameter")}</span><select value={selected} onChange={e=>setSelected(e.target.value)}>{keys.map(k=><option key={k}>{k}</option>)}</select></label><div className="chart-box"><ResponsiveContainer width="100%" height={230}><LineChart data={chart}><CartesianGrid stroke="#15384a"/><XAxis dataKey="date" tick={{fill:"#7da5b4",fontSize:9}}/><YAxis tick={{fill:"#7da5b4",fontSize:9}}/><Tooltip/><Line type="monotone" dataKey="value" stroke="#42d7e7" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></div>
 {guidance.dataIssues.length>0&&<div className="inline-alert danger full-span chemistry-data-alert"><b>⚠️ {bi(lang,"تحقق من البيانات قبل تعديل الحوض","Check the data before changing the tank")}</b>{guidance.dataIssues.map(x=><p key={x.key}>{lang==="ar"?x.reasonAr:x.reasonEn}<br/><strong>{lang==="ar"?x.actionAr:x.actionEn}</strong></p>)}</div>}
 <section className="card panel full-span chemistry-guidance">
  <div className="chemistry-guidance-head"><div><small>AQUA NEXUS CHEMISTRY INTELLIGENCE</small><h2>{bi(lang,"ليش صحة الكيمياء نازلة؟","Why is chemistry health lower?")}</h2><p className="note">{bi(lang,"النتيجة ليست رقماً فقط؛ هذه العوامل هي التي تسحب التقييم إلى الأسفل مرتبة حسب الأولوية.","The score is not just a number; these are the parameters pulling it down, ordered by priority.")}</p></div><span>{topProblems.length} {bi(lang,"عامل يحتاج انتباه","need attention")}</span></div>
  {topProblems.length?<div className="chemistry-issue-grid">{topProblems.map(x=><button type="button" className={`chemistry-issue ${x.level}`} key={x.key} onClick={()=>setSelected(x.key)}><span className="chemistry-issue-score">{x.score===null?"—":x.score+"%"}</span><div><b>{x.titleAr}</b><p>{lang==="ar"?x.reasonAr:x.reasonEn}</p></div><span className="chemistry-issue-arrow">›</span></button>)}</div>:<div className="inline-alert good">✓ {bi(lang,"كل القراءات الحالية ضمن وضع جيد ولا يوجد عامل رئيسي يسحب التقييم للأسفل.","All current readings are in good condition and no major parameter is pulling the score down.")}</div>}
 </section>
 <section className="card panel full-span chemistry-actions">
  <div className="chemistry-guidance-head"><div><small>NEXT ACTIONS</small><h2>{bi(lang,"شو تعمل هلق؟","What should you do now?")}</h2><p className="note">{bi(lang,"ابدأ من الأعلى للأسفل. لا تعمل عدة تصحيحات كبيرة بنفس الوقت؛ صحح السبب، أعد القياس، ثم انتقل للخطوة التالية.","Work from top to bottom. Avoid several major corrections at once; fix the cause, retest, then move to the next step.")}</p></div></div>
  <div className="chemistry-action-list">{actionItems.map((x,i)=><div className={`chemistry-action-row ${x.level}`} key={x.key}><span className="chemistry-action-rank">{i+1}</span><div><b>{x.titleAr}</b><p>{lang==="ar"?x.actionAr:x.actionEn}</p></div><button className="btn" onClick={()=>setSelected(x.key)}>{bi(lang,"عرض الرسم","View trend")}</button></div>)}</div>
  {!actionItems.length&&<div className="inline-alert good">✓ {bi(lang,"لا يوجد إجراء تصحيحي رئيسي الآن. استمر بالمراقبة والقياسات الدورية.","No major corrective action is needed now. Continue monitoring and routine testing.")}</div>}
 </section>
  <div className="card panel full-span"><div className="table-wrap"><table><thead><tr><th>{tr(lang,"parameter")}</th><th>{tr(lang,"current")}</th><th>Ideal</th><th>Score</th></tr></thead><tbody>{keys.map(k=>{const m:any=cfg[k],s=parameterScore(latest[k],m);return <tr key={k}><td>{m.label}</td><td>{latest[k]??"—"}</td><td>{m.ideal[0]}–{m.ideal[1]}</td><td>{s===null?"—":`${s}%`}</td></tr>})}</tbody></table></div></div>
 <Modal open={open} title={tr(lang,"addReading")} onClose={()=>setOpen(false)}><div className="form-grid">{keys.map(k=><label className="field" key={k}><span>{cfg[k].label}</span><input type="number" step="any" value={values[k]} onChange={e=>setValues(v=>({...v,[k]:Number(e.target.value)}))}/></label>)}<label className="field"><span>Test kit / Device</span><input value={testKit} onChange={e=>setTestKit(e.target.value)}/></label><label className="field"><span>{bi(lang,"ثقة القراءة","Reading confidence")}</span><select value={confidence} onChange={e=>setConfidence(e.target.value as any)}><option value="high">{bi(lang,"مرتفعة","High")}</option><option value="medium">{bi(lang,"متوسطة","Medium")}</option><option value="low">{bi(lang,"منخفضة","Low")}</option></select></label><label className="field full-field"><span>{tr(lang,"notes")}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label></div><div className="modal-actions"><button className="btn" onClick={()=>setOpen(false)}>{tr(lang,"cancel")}</button><button className="btn primary" onClick={save}>{tr(lang,"save")}</button></div></Modal>
 </section>;
}
