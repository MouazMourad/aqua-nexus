"use client";
import { useMemo,useState } from "react";
import type { JournalPhoto,Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
import { askAquaVision } from "@/lib/aquaAIClient";
import { buildVisionTriage,captureConsistency,type VisionMetrics,type VisionSymptom } from "@/domain/visionIntelligence";

type GrowthPhoto=JournalPhoto&{livestockId?:string;estimatedSizeCm?:number;colorIndex?:number;brightnessIndex?:number;captureScore?:number};

function analyzeImage(dataUrl:string):Promise<VisionMetrics>{
 return new Promise(resolve=>{
  const img=new Image();
  img.onload=()=>{
   const canvas=document.createElement("canvas");canvas.width=64;canvas.height=64;
   const ctx=canvas.getContext("2d"); if(!ctx){resolve({colorIndex:0,brightnessIndex:0,captureScore:0});return;}
   ctx.drawImage(img,0,0,64,64);
   const data=ctx.getImageData(0,0,64,64).data;
   let sat=0,bright=0,brightSq=0,count=0;
   for(let i=0;i<data.length;i+=4){
    if(data[i+3]<32)continue;
    const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),v=(r+g+b)/3;
    sat+=mx===0?0:(mx-mn)/mx;bright+=v;brightSq+=v*v;count++;
   }
   const colorIndex=count?Math.round(sat/count*100):0;
   const brightnessIndex=count?Math.round(bright/count*100):0;
   const variance=count?Math.max(0,brightSq/count-Math.pow(bright/count,2)):0;
   const contrast=Math.min(100,Math.round(Math.sqrt(variance)*260));
   const exposurePenalty=Math.min(55,Math.abs(brightnessIndex-52)*1.15);
   const captureScore=Math.max(0,Math.min(100,Math.round(82-exposurePenalty+contrast*.18)));
   resolve({colorIndex,brightnessIndex,captureScore});
  };
  img.onerror=()=>resolve({colorIndex:0,brightnessIndex:0,captureScore:0});
  img.src=dataUrl;
 });
}

const symptomLabels:Record<VisionSymptom,{ar:string;en:string}>={
 whiteSpots:{ar:"بقع بيضاء",en:"White spots"},tissueLoss:{ar:"تراجع نسيج",en:"Tissue loss"},paleColor:{ar:"شحوب اللون",en:"Pale color"},darkColor:{ar:"اسمرار/غمقان",en:"Darkening"},closedPolyps:{ar:"انغلاق البوليب",en:"Closed polyps"},lesion:{ar:"جرح/آفة",en:"Lesion"},finDamage:{ar:"تضرر زعانف",en:"Fin damage"},rapidBreathing:{ar:"تنفس سريع",en:"Rapid breathing"},algaeFilm:{ar:"غشاء/طحالب",en:"Algae film"},unknown:{ar:"غير واضح",en:"Unclear"}
};

export function JournalPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [caption,setCaption]=useState(""),[livestockId,setLivestockId]=useState(""),[sizeCm,setSizeCm]=useState(0);
 const [visionLivestockId,setVisionLivestockId]=useState(""),[visionSymptoms,setVisionSymptoms]=useState<VisionSymptom[]>([]),[visionNotes,setVisionNotes]=useState(""),[visionBusy,setVisionBusy]=useState(false);
 const photos=tank.photos as GrowthPhoto[];
 const assessments:any[]=((tank as any).visionAssessments??[]);
 const trackedLivestock=tank.livestock.filter(x=>x.category==="coral"||x.category==="plant"||x.category==="other");
 const visionLivestock=tank.livestock;
 const growth=useMemo(()=>{
  if(!livestockId)return null;
  const list=photos.filter(p=>p.livestockId===livestockId).slice().sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());
  if(list.length<2)return {count:list.length,growthPct:null as number|null,monthlyGrowthPct:null as number|null,colorDelta:null as number|null,consistency:null as any,first:list[0],last:list[0]};
  const first=list[0],last=list[list.length-1];
  const days=Math.max(1,(new Date(last.timestamp).getTime()-new Date(first.timestamp).getTime())/86400000);
  const growthPct=first.estimatedSizeCm&&last.estimatedSizeCm?((last.estimatedSizeCm-first.estimatedSizeCm)/first.estimatedSizeCm*100):null;
  const monthlyGrowthPct=growthPct===null?null:growthPct/days*30;
  const colorDelta=typeof first.colorIndex==="number"&&typeof last.colorIndex==="number"?last.colorIndex-first.colorIndex:null;
  const consistency=captureConsistency({colorIndex:last.colorIndex??0,brightnessIndex:last.brightnessIndex??0,captureScore:last.captureScore??50},{colorIndex:first.colorIndex??0,brightnessIndex:first.brightnessIndex??0,captureScore:first.captureScore??50});
  return {count:list.length,growthPct,monthlyGrowthPct,colorDelta,consistency,first,last};
 },[photos,livestockId]);

 function add(file?:File){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async()=>{
   const dataUrl=String(reader.result),visual=await analyzeImage(dataUrl),ts=nowISO(),subject=tank.livestock.find(x=>x.id===livestockId);
   const photo:any={id:uid("ph"),timestamp:ts,caption,dataUrl,livestockId:livestockId||undefined,estimatedSizeCm:sizeCm>0?sizeCm:undefined,...visual};
   patch(tank.id,t=>({...t,photos:[photo,...t.photos],timeline:subject?[{id:uid("ev"),timestamp:ts,type:"growth-photo",textAr:`تمت إضافة صورة متابعة لـ ${subject.name}${sizeCm>0?` بحجم تقديري ${sizeCm} سم`:""}.`,textEn:`Growth photo added for ${subject.nameEn||subject.name}${sizeCm>0?` with estimated size ${sizeCm} cm`:""}.`},...t.timeline]:t.timeline}));
   setCaption("");setSizeCm(0);
  };
  reader.readAsDataURL(file);
 }

 function toggleSymptom(s:VisionSymptom){setVisionSymptoms(v=>v.includes(s)?v.filter(x=>x!==s):[...v,s]);}
 function runVision(file?:File){
  if(!file)return;setVisionBusy(true);
  const reader=new FileReader();
  reader.onload=async()=>{
   const dataUrl=String(reader.result),metrics=await analyzeImage(dataUrl),ts=nowISO(),subject=tank.livestock.find(x=>x.id===visionLivestockId);
   const selectedSymptoms=visionSymptoms.length?visionSymptoms:["unknown" as VisionSymptom];
   const triage=buildVisionTriage(tank,{livestockId:visionLivestockId||undefined,symptoms:selectedSymptoms,notes:visionNotes,metrics});
   const photoId=uid("ph"),assessmentId=uid("vision");
   const photo:any={id:photoId,timestamp:ts,caption:`Visual Tank Insight${subject?` • ${subject.name}`:""}`,dataUrl,livestockId:visionLivestockId||undefined,...metrics};
   const assessment={id:assessmentId,timestamp:ts,photoId,livestockId:visionLivestockId||undefined,symptoms:selectedSymptoms,notes:visionNotes,metrics,triage,modelStatus:"local-preanalysis"};
   patch(tank.id,t=>({...t,photos:[photo,...t.photos],visionAssessments:[assessment,...((t as any).visionAssessments??[])],timeline:[{id:uid("ev"),timestamp:ts,type:"vision-assessment",textAr:`تم تسجيل Visual Tank Insight${subject?` لـ ${subject.name}`:""}: ${triage.summaryAr}`,textEn:`Visual Tank Insight logged${subject?` for ${subject.nameEn||subject.name}`:""}: ${triage.summaryEn}`},...t.timeline]} as any));

   try{
    const symptomText=selectedSymptoms.map(s=>lang==="ar"?symptomLabels[s].ar:symptomLabels[s].en).join(", ");
    const question=lang==="ar"
      ? `أنت جزء داخلي من Aqua Nexus مخصص فقط لفهم الحوض الحالي. فسّر هذه الصورة فقط ضمن سياق الحوض الحالي. ${subject?`الكائن المرتبط بالصورة: ${subject.name}.`:"الصورة للحوض الحالي ككل."} الأعراض المسجلة: ${symptomText}. ملاحظات المستخدم: ${visionNotes||"لا يوجد"}. أخرج فقط: 1) ماذا تلاحظ بصرياً، 2) ماذا قد يعني ذلك بالربط مع بيانات الحوض، 3) ما الفحص التالي الأكثر فائدة، 4) مستوى الثقة. لا تجب عن أسئلة عامة، لا تعط تشخيصاً قطعياً، ولا تقدّم علاجاً دوائياً كأنه مؤكد.`
      : `You are an internal Aqua Nexus component limited to understanding the current aquarium. Interpret only this image within the current tank context. ${subject?`Linked organism: ${subject.nameEn||subject.name}.`:"This is the current tank as a whole."} Logged symptoms: ${symptomText}. User notes: ${visionNotes||"none"}. Return only: 1) what you visually notice, 2) what it may mean when linked to tank data, 3) the most useful next check, 4) confidence level. Do not answer general questions, do not claim a definitive diagnosis, and do not present medication treatment as certain.`;
    const external=await askAquaVision({tank,imageDataUrl:dataUrl,question,language:lang});
    if(external.mode==="external"){
      const extTs=nowISO();
      patch(tank.id,t=>({...t,visionAssessments:((t as any).visionAssessments??[]).map((x:any)=>x.id===assessmentId?{...x,modelStatus:"external",externalVision:external.answer,externalProvider:external.model||external.provider}:x),timeline:[{id:uid("ev"),timestamp:extTs,type:"vision-model",textAr:`تم تعزيز Visual Tank Insight${subject?` لـ ${subject.name}`:""} بواسطة نموذج رؤية مخصص لسياق الحوض الحالي.`,textEn:`Visual Tank Insight${subject?` for ${subject.nameEn||subject.name}`:""} was enhanced by a vision model scoped to the current tank context.`},...t.timeline]} as any));
    }
   }catch{}

   setVisionSymptoms([]);setVisionNotes("");setVisionBusy(false);
  };
  reader.onerror=()=>setVisionBusy(false);reader.readAsDataURL(file);
 }

 const latest=assessments[0];
 const latestPossibilities=latest?(lang==="ar"?latest.triage.possibilitiesAr:latest.triage.possibilitiesEn):[];
 const latestNext=latest?(lang==="ar"?latest.triage.nextAr:latest.triage.nextEn):[];

 return <section className="page-grid"><PageHeader eyebrow="PHOTO JOURNAL • VISUAL INSIGHT • GROWTH" title={tr(lang,"journal")}/>

 <div className="card panel full-span">
  <div className="module-head"><div><h3>{bi(lang,"Visual Tank Insight","Visual Tank Insight")}</h3><p className="note">{bi(lang,"هاي الميزة مو شات ولا خبير عام. هي جزء من ذكاء Aqua Nexus الداخلي: تفسر صورة الحوض الحالي أو كائن مسجل فيه، وتربط الملاحظات البصرية مع بيانات نفس الحوض.","This is not a chatbot or general-purpose expert. It is part of Aqua Nexus internal intelligence: it interprets the current tank or a registered organism and links visual observations to that same tank's data.")}</p></div><span className="scene-badge">{assessments.length} {bi(lang,"تقييم","checks")}</span></div>
  <div className="form-grid"><label className="field"><span>{bi(lang,"نطاق الصورة","Image scope")}</span><select value={visionLivestockId} onChange={e=>setVisionLivestockId(e.target.value)}><option value="">{bi(lang,"الحوض كامل","Whole tank")}</option>{visionLivestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label><label className="field full-field"><span>{bi(lang,"ملاحظات السلوك/التطور","Behavior / progression notes")}</span><input value={visionNotes} onChange={e=>setVisionNotes(e.target.value)} placeholder={bi(lang,"من إمتى بلشت؟ في شهية؟ عم تنتشر؟","When did it start? appetite? spreading?")}/></label></div>
  <div className="vision-symptoms" style={{display:"flex",flexWrap:"wrap",gap:7,margin:"12px 0"}}>{(Object.keys(symptomLabels) as VisionSymptom[]).map(s=><button type="button" key={s} className={`btn ${visionSymptoms.includes(s)?"primary":""}`} onClick={()=>toggleSymptom(s)}>{lang==="ar"?symptomLabels[s].ar:symptomLabels[s].en}</button>)}</div>
  <label className="btn primary file-button">{visionBusy?bi(lang,"عم يتم التحليل...","Analyzing..."):bi(lang,"📷 Visual Tank Insight","📷 Visual Tank Insight")}<input type="file" accept="image/*" capture="environment" disabled={visionBusy} onChange={e=>runVision(e.target.files?.[0])}/></label>

  {latest&&<div className={`inline-alert ${latest.triage.level==="urgent"?"danger":latest.triage.level==="attention"?"warn":"good"}`} style={{marginTop:12}}>
    <div style={{display:"grid",gap:10}}>
      <div><small><b>{bi(lang,"1 • ماذا ألاحظ","1 • WHAT I NOTICE")}</b></small><div style={{marginTop:4}}>{lang==="ar"?latest.triage.summaryAr:latest.triage.summaryEn}</div></div>
      <div><small><b>{bi(lang,"2 • ماذا قد يعني ذلك","2 • POSSIBLE MEANING")}</b></small><div style={{marginTop:4}}>{latestPossibilities.slice(0,3).join(" • ")||bi(lang,"لا توجد دلالة كافية بعد.","Not enough signal yet.")}</div></div>
      <div><small><b>{bi(lang,"3 • ماذا تفحص الآن","3 • NEXT BEST CHECK")}</b></small><div style={{marginTop:4}}>{latestNext.slice(0,3).join(" • ")}</div></div>
      <div><small><b>{bi(lang,"4 • مستوى الثقة","4 • CONFIDENCE LEVEL")}</b></small><div style={{marginTop:4}}>{latest.triage.confidence} • Capture {latest.metrics.captureScore}/100{latest.modelStatus==="external"?` • Vision: ${latest.externalProvider||"connected"}`:""}</div></div>
      {latest.externalVision?.text&&<div className="aqua-ai-local-note">{String(latest.externalVision.text)}</div>}
    </div>
  </div>}
 </div>

 <div className="card panel full-span"><div className="module-head"><div><h3>{bi(lang,"Frag / Growth Tracker","Frag / Growth Tracker")}</h3><p className="note">{bi(lang,"ثبّت الزاوية والإضاءة والمسافة قدر الإمكان حتى تكون المقارنة الزمنية أصدق.","Keep angle, lighting and distance as consistent as possible for better time-series comparison.")}</p></div></div><div className="journal-add" style={{flexWrap:"wrap"}}><label className="field grow"><span>{tr(lang,"photoCaption")}</span><input value={caption} onChange={e=>setCaption(e.target.value)}/></label><label className="field"><span>{bi(lang,"الكائن المتابع","Tracked organism")}</span><select value={livestockId} onChange={e=>setLivestockId(e.target.value)}><option value="">—</option>{trackedLivestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label><label className="field"><span>{bi(lang,"الحجم التقديري cm","Estimated size cm")}</span><input type="number" min="0" step=".1" value={sizeCm||""} onChange={e=>setSizeCm(Number(e.target.value))}/></label><label className="btn primary file-button">{tr(lang,"addPhoto")}<input type="file" accept="image/*" capture="environment" onChange={e=>add(e.target.files?.[0])}/></label></div><div className="inline-alert info" style={{marginTop:12}}>{bi(lang,"النمو يعتمد على قياس الحجم المدخل. اللون والسطوع وجودة الالتقاط مؤشرات مقارنة من الصورة الكاملة وليست segmentation أو قياساً مخبرياً.","Growth uses your entered size. Color, brightness and capture quality are whole-image comparison signals, not object segmentation or laboratory measurements.")}</div></div>

 {livestockId&&<div className="card panel full-span"><div className="module-head"><h3>{bi(lang,"سجل التطور الزمني","Growth Timeline")}</h3><span className="scene-badge">{growth?.count??0} {bi(lang,"صور","photos")}</span></div>{growth&&growth.count>=2?<><div className="summary-strip"><div className="summary"><small>{bi(lang,"النمو منذ أول صورة","Growth since first photo")}</small><b>{growth.growthPct===null?"—":`${growth.growthPct>=0?"+":""}${growth.growthPct.toFixed(1)}%`}</b></div><div className="summary"><small>{bi(lang,"معدل تقريبي / 30 يوم","Approx / 30d")}</small><b>{growth.monthlyGrowthPct===null?"—":`${growth.monthlyGrowthPct>=0?"+":""}${growth.monthlyGrowthPct.toFixed(1)}%`}</b></div><div className="summary"><small>{bi(lang,"تغير مؤشر اللون","Color-index change")}</small><b>{growth.colorDelta===null?"—":`${growth.colorDelta>=0?"+":""}${growth.colorDelta}`}</b></div><div className="summary"><small>{bi(lang,"اتساق التصوير","Capture consistency")}</small><b>{growth.consistency?.score??"—"}%</b></div></div>{growth.consistency&&<div className="inline-alert info" style={{marginTop:10}}>{lang==="ar"?growth.consistency.noteAr:growth.consistency.noteEn}</div>}</>:<div className="inline-alert info">{bi(lang,"أضف صورتين أو أكثر لنفس الكائن حتى يظهر اتجاه النمو وتغير اللون.","Add at least two photos of the same organism to show growth and color trend.")}</div>}</div>}

 <div className="photo-grid full-span">{photos.map(p=>{const subject=tank.livestock.find(x=>x.id===p.livestockId);return <article className="photo-card" key={p.id}><img src={p.dataUrl} alt={p.caption}/><div><b>{p.caption||subject&&(lang==="ar"?subject.name:(subject.nameEn||subject.name))||tr(lang,"journal")}</b><small>{new Date(p.timestamp).toLocaleString()}</small>{subject&&<small>{lang==="ar"?subject.name:(subject.nameEn||subject.name)}{p.estimatedSizeCm?` • ${p.estimatedSizeCm} cm`:""}</small>}<small>{typeof p.colorIndex==="number"?`${bi(lang,"مؤشر اللون","Color index")}: ${p.colorIndex}/100`:""}{typeof p.brightnessIndex==="number"?` • ${bi(lang,"الإضاءة","brightness")}: ${p.brightnessIndex}/100`:""}{typeof p.captureScore==="number"?` • Capture ${p.captureScore}/100`:""}</small></div></article>})}</div>
 </section>;
}
