"use client";
import { useEffect,useMemo,useState } from "react";
import type { JournalPhoto,Tank,VisionAssessmentRecord } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";
import { buildVisionTriage,captureConsistency,type VisionMetrics,type VisionSymptom } from "@/domain/visionIntelligence";
import { visionDiseaseCandidates } from "@/domain/visionDifferential";
import { askAquaVision } from "@/lib/aquaAIClient";
import { externalizePhoto,resolveFullPhoto,resolvePhotoPreview } from "@/lib/photoStorage";

type GrowthPhoto=JournalPhoto&{livestockId?:string;estimatedSizeCm?:number;colorIndex?:number;brightnessIndex?:number;captureScore?:number;clarityIndex?:number;greenDominancePercent?:number;palePixelPercent?:number};

type PreparedImage={dataUrl:string;metrics:VisionMetrics};

function StoredPhotoImage({photo,alt,className,style}:{photo:JournalPhoto;alt:string;className?:string;style?:React.CSSProperties}){
 const [src,setSrc]=useState(photo.dataUrl||"");
 useEffect(()=>{
  let active=true;
  setSrc(photo.dataUrl||"");
  void resolvePhotoPreview(photo).then(value=>{if(active&&value)setSrc(value)});
  return()=>{active=false};
 },[photo.id,photo.previewKey,photo.assetKey,photo.dataUrl]);
 if(!src)return <div className={className} style={{...style,display:"grid",placeItems:"center",background:"rgba(255,255,255,.04)",fontSize:18}} aria-label={alt}>▧</div>;
 return <img className={className} src={src} alt={alt} style={style}/>;
}

function readFile(file:File){
 return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
}

function loadImage(src:string){
 return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
}

function visualMetrics(img:HTMLImageElement):VisionMetrics{
 const size=160,canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 if(!ctx)return {colorIndex:0,brightnessIndex:0,captureScore:0};
 ctx.drawImage(img,0,0,size,size);
 const px=ctx.getImageData(0,0,size,size).data;
 const lum=new Float32Array(size*size);
 let sat=0,bright=0,brightSq=0,count=0,glare=0,shadow=0,pale=0,green=0,hot=0,red=0,blue=0;
 for(let i=0,p=0;i<px.length;i+=4,p++){
  if(px[i+3]<32)continue;
  const r=px[i]/255,g=px[i+1]/255,b=px[i+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  const s=mx===0?0:(mx-mn)/mx,l=.2126*r+.7152*g+.0722*b;
  lum[p]=l;sat+=s;bright+=l;brightSq+=l*l;count++;
  if(l>.93&&s<.16)glare++;
  if(l<.12)shadow++;
  if(l>.68&&s<.24)pale++;
  if(g>r*1.12&&g>b*1.08&&s>.24)green++;
  if(l>.88&&s<.30)hot++;
  if(r>g*1.24&&r>b*1.18&&s>.25)red++;
  if(b>r*1.15&&b>g*1.05&&s>.28)blue++;
 }
 if(!count)return {colorIndex:0,brightnessIndex:0,captureScore:0};
 let edgeSum=0,edgeCount=0,strongEdges=0;
 for(let y=1;y<size;y++)for(let x=1;x<size;x++){
  const p=y*size+x,d=Math.abs(lum[p]-lum[p-1])+Math.abs(lum[p]-lum[p-size]);
  edgeSum+=d;edgeCount++;if(d>.16)strongEdges++;
 }
 const colorIndex=Math.round(sat/count*100),brightnessIndex=Math.round(bright/count*100);
 const variance=Math.max(0,brightSq/count-Math.pow(bright/count,2));
 const contrastIndex=Math.min(100,Math.round(Math.sqrt(variance)*300));
 const sharpnessIndex=Math.min(100,Math.round(edgeSum/Math.max(1,edgeCount)*240));
 const edgeDensity=Math.min(100,Math.round(strongEdges/Math.max(1,edgeCount)*100));
 const glarePercent=Number((glare/count*100).toFixed(1)),shadowPercent=Number((shadow/count*100).toFixed(1));
 const palePixelPercent=Number((pale/count*100).toFixed(1)),greenDominancePercent=Number((green/count*100).toFixed(1));
 const brightSpotPercent=Number((hot/count*100).toFixed(1)),redDominancePercent=Number((red/count*100).toFixed(1)),blueDominancePercent=Number((blue/count*100).toFixed(1));
 const exposurePenalty=Math.min(36,Math.abs(brightnessIndex-50)*.85),glarePenalty=Math.min(22,glarePercent*1.5),blurPenalty=Math.max(0,35-sharpnessIndex)*.6;
 const captureScore=Math.max(0,Math.min(100,Math.round(90-exposurePenalty-glarePenalty-blurPenalty+Math.min(8,contrastIndex*.08))));
 const clarityIndex=Math.max(0,Math.min(100,Math.round(sharpnessIndex*.46+contrastIndex*.34+Math.max(0,100-glarePercent*5)*.20)));
 return {colorIndex,brightnessIndex,captureScore,contrastIndex,sharpnessIndex,clarityIndex,glarePercent,shadowPercent,palePixelPercent,greenDominancePercent,brightSpotPercent,redDominancePercent,blueDominancePercent,edgeDensity};
}

async function prepareImage(file:File):Promise<PreparedImage>{
 const original=await readFile(file),img=await loadImage(original),metrics=visualMetrics(img);
 const maxSide=1280,scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
 const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image conversion failed");
 ctx.drawImage(img,0,0,canvas.width,canvas.height);
 return {dataUrl:canvas.toDataURL("image/jpeg",.84),metrics};
}

const symptomLabels:Record<VisionSymptom,{ar:string;en:string}>={
 whiteSpots:{ar:"بقع بيضاء",en:"White spots"},tissueLoss:{ar:"تراجع نسيج",en:"Tissue loss"},paleColor:{ar:"شحوب اللون",en:"Pale color"},darkColor:{ar:"اسمرار/غمقان",en:"Darkening"},closedPolyps:{ar:"انغلاق البوليب",en:"Closed polyps"},lesion:{ar:"جرح/آفة",en:"Lesion"},finDamage:{ar:"تضرر زعانف",en:"Fin damage"},rapidBreathing:{ar:"تنفس سريع",en:"Rapid breathing"},algaeFilm:{ar:"غشاء/طحالب",en:"Algae film"},unknown:{ar:"غير واضح",en:"Unclear"}
};

export function JournalPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [caption,setCaption]=useState(""),[livestockId,setLivestockId]=useState(""),[sizeCm,setSizeCm]=useState(0);
 const [visionLivestockId,setVisionLivestockId]=useState(""),[visionSymptoms,setVisionSymptoms]=useState<VisionSymptom[]>([]),[visionNotes,setVisionNotes]=useState(""),[visionBusy,setVisionBusy]=useState(false),[visionError,setVisionError]=useState(""),[deepVisionBusyId,setDeepVisionBusyId]=useState<string|null>(null),[deepVisionError,setDeepVisionError]=useState("");
 const [photoLimit,setPhotoLimit]=useState(60);
 const photos=tank.photos as GrowthPhoto[];
 const assessments:VisionAssessmentRecord[]=tank.visionAssessments??[];
 const trackedLivestock=tank.livestock.filter(x=>x.category==="coral"||x.category==="plant"||x.category==="other");
 const visionLivestock=tank.livestock;

 const growth=useMemo(()=>{
  if(!livestockId)return null;
  const list=photos.filter(p=>p.livestockId===livestockId).slice().sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());
  if(list.length<2)return {count:list.length,growthPct:null as number|null,monthlyGrowthPct:null as number|null,colorDelta:null as number|null,consistency:null as any};
  const first=list[0],last=list[list.length-1],days=Math.max(1,(new Date(last.timestamp).getTime()-new Date(first.timestamp).getTime())/86400000);
  const growthPct=first.estimatedSizeCm&&last.estimatedSizeCm?((last.estimatedSizeCm-first.estimatedSizeCm)/first.estimatedSizeCm*100):null;
  const monthlyGrowthPct=growthPct===null?null:growthPct/days*30;
  const colorDelta=typeof first.colorIndex==="number"&&typeof last.colorIndex==="number"?last.colorIndex-first.colorIndex:null;
  const consistency=captureConsistency({colorIndex:last.colorIndex??0,brightnessIndex:last.brightnessIndex??0,captureScore:last.captureScore??50,clarityIndex:last.clarityIndex},{colorIndex:first.colorIndex??0,brightnessIndex:first.brightnessIndex??0,captureScore:first.captureScore??50,clarityIndex:first.clarityIndex});
  return {count:list.length,growthPct,monthlyGrowthPct,colorDelta,consistency};
 },[photos,livestockId]);

 async function add(file?:File){
  if(!file)return;
  try{
   const prepared=await prepareImage(file),ts=nowISO(),subject=tank.livestock.find(x=>x.id===livestockId);
   const photo:any={id:uid("ph"),timestamp:ts,caption,dataUrl:prepared.dataUrl,livestockId:livestockId||undefined,estimatedSizeCm:sizeCm>0?sizeCm:undefined,...prepared.metrics};
   const storedPhoto=await externalizePhoto(photo);
   patch(tank.id,t=>({...t,photos:[storedPhoto,...t.photos],timeline:subject?[{id:uid("ev"),timestamp:ts,type:"growth-photo",textAr:`تمت إضافة صورة متابعة لـ ${subject.name}${sizeCm>0?` بحجم تقديري ${sizeCm} سم`:""}.`,textEn:`Growth photo added for ${subject.nameEn||subject.name}${sizeCm>0?` with estimated size ${sizeCm} cm`:""}.`},...t.timeline]:t.timeline}));
   setCaption("");setSizeCm(0);
  }catch{}
 }

 function toggleSymptom(s:VisionSymptom){setVisionSymptoms(v=>v.includes(s)?v.filter(x=>x!==s):[...v,s]);}
 async function runVision(file?:File){
  if(!file)return;setVisionBusy(true);setVisionError("");setDeepVisionError("");
  try{
   const prepared=await prepareImage(file),ts=nowISO(),subject=tank.livestock.find(x=>x.id===visionLivestockId);
   const selectedSymptoms=visionSymptoms.length?visionSymptoms:["unknown" as VisionSymptom];
   const previous=assessments.find(x=>(x.livestockId||"")===(visionLivestockId||"")&&x.metrics);
   const triage=buildVisionTriage(tank,{livestockId:visionLivestockId||undefined,symptoms:selectedSymptoms,notes:visionNotes,metrics:prepared.metrics,previousMetrics:previous?.metrics,previousTimestamp:previous?.timestamp});
   const candidates=visionDiseaseCandidates(tank,visionLivestockId||undefined,selectedSymptoms);
   const photoId=uid("ph"),assessmentId=uid("vision");
   const photo:any={id:photoId,timestamp:ts,caption:`Local Best Visual Insight${subject?` • ${subject.name}`:" • Whole Tank"}`,dataUrl:prepared.dataUrl,livestockId:visionLivestockId||undefined,...prepared.metrics};
   const storedPhoto=await externalizePhoto(photo);
   const assessment:VisionAssessmentRecord={id:assessmentId,timestamp:ts,photoId,livestockId:visionLivestockId||undefined,symptoms:selectedSymptoms,notes:visionNotes,metrics:prepared.metrics,triage,modelStatus:"local-best",engine:triage.engine,external:{status:"not_requested"},diseaseCandidateIds:candidates.map(x=>x.id)};
   patch(tank.id,t=>({...t,photos:[storedPhoto,...t.photos],visionAssessments:[assessment,...(t.visionAssessments??[])],timeline:[{id:uid("ev"),timestamp:ts,type:"vision-assessment",textAr:`Local Best Visual Insight${subject?` لـ ${subject.name}`:" للحوض كامل"}: ${triage.summaryAr}`,textEn:`Local Best Visual Insight${subject?` for ${subject.nameEn||subject.name}`:" for the whole tank"}: ${triage.summaryEn}`},...t.timeline]}));
   setVisionSymptoms([]);setVisionNotes("");
  }catch{
   setVisionError(lang==="ar"?"ما قدرنا نحلل الصورة محلياً. جرّب صورة JPG/PNG/WEBP أو التقط صورة جديدة.":"Local image analysis failed. Try JPG/PNG/WEBP or capture a new photo.");
  }finally{setVisionBusy(false);}
 }

 async function runDeepVision(assessment:VisionAssessmentRecord){
  const photo=photos.find(x=>x.id===assessment.photoId),subject=tank.livestock.find(x=>x.id===assessment.livestockId);
  if(!photo){setDeepVisionError(bi(lang,"الصورة المرتبطة بالتحليل غير موجودة.","The image linked to this assessment is missing."));return}
  setDeepVisionBusyId(assessment.id);setDeepVisionError("");
  try{
   const candidates=visionDiseaseCandidates(tank,assessment.livestockId,assessment.symptoms as VisionSymptom[]);
   const symptomText=(assessment.symptoms as VisionSymptom[]).map(s=>lang==="ar"?symptomLabels[s]?.ar:symptomLabels[s]?.en).filter(Boolean).join(", ");
   const localSummary=lang==="ar"?assessment.triage.summaryAr:assessment.triage.summaryEn;
   const candidateText=candidates.map(x=>lang==="ar"?x.ar:x.en).join(", ");
   const question=[
    subject?`Subject: ${lang==="ar"?subject.name:(subject.nameEn||subject.name)} • category ${subject.category}`:"Scope: whole tank",
    `Reported symptoms: ${symptomText||"none"}`,
    assessment.notes?`User notes: ${assessment.notes}`:"",
    `Local Aqua Nexus triage: ${localSummary}`,
    candidateText?`Symptom-linked library references (not diagnoses): ${candidateText}`:""
   ].filter(Boolean).join("\n");
   const fullImage=await resolveFullPhoto(photo);
   const result=await askAquaVision({tank,imageDataUrl:fullImage,question,language:lang});
   const ts=nowISO();
   if(result.mode!=="external"||!result.answer?.text){
    const message=result.answer?.messageAr&&lang==="ar"?result.answer.messageAr:result.answer?.messageEn||bi(lang,"ما في مزود AI Vision خارجي مربوط حالياً.","No external AI Vision provider is configured.");
    patch(tank.id,t=>({...t,visionAssessments:(t.visionAssessments??[]).map(x=>x.id===assessment.id?{...x,external:{status:"unavailable",provider:result.provider,error:String(message),analyzedAt:ts}}:x)}));
    setDeepVisionError(String(message));return;
   }
   patch(tank.id,t=>({...t,
    visionAssessments:(t.visionAssessments??[]).map(x=>x.id===assessment.id?{...x,external:{status:"completed",provider:result.provider,model:result.model,text:String(result.answer.text),analyzedAt:ts}}:x),
    timeline:[{id:uid("ev"),timestamp:ts,type:"vision-second-opinion",textAr:`تمت إضافة رأي AI Vision ثانٍ${subject?` لـ ${subject.name}`:" للحوض"} بدون اعتماد تشخيص نهائي تلقائي.`,textEn:`AI Vision second opinion added${subject?` for ${subject.nameEn||subject.name}`:" for the tank"} without auto-confirming a diagnosis.`},...t.timeline]
   }));
  }catch(error){
   const message=error instanceof Error?error.message:String(error);
   const ts=nowISO();
   patch(tank.id,t=>({...t,visionAssessments:(t.visionAssessments??[]).map(x=>x.id===assessment.id?{...x,external:{status:"error",error:message,analyzedAt:ts}}:x)}));
   setDeepVisionError(bi(lang,"فشل AI Vision الخارجي. التحليل المحلي محفوظ وما ضاع.","External AI Vision failed. The local assessment is still saved."));
  }finally{setDeepVisionBusyId(null);}
 }

 function markVisionWatch(assessment:VisionAssessmentRecord){
  if(!assessment.livestockId)return;
  const subject=tank.livestock.find(x=>x.id===assessment.livestockId);if(!subject)return;
  const ts=nowISO();
  patch(tank.id,t=>({...t,livestock:t.livestock.map(x=>x.id===subject.id?{...x,health:x.health==="treatment"?"treatment":"watch",lastObservedAt:ts}:x),timeline:[{id:uid("ev"),timestamp:ts,type:"vision-watch",textAr:`تم وضع ${subject.name} تحت المراقبة من نتيجة Visual Insight.`,textEn:`${subject.nameEn||subject.name} was marked for monitoring from Visual Insight.`},...t.timeline]}));
 }

 function createVisionFollowUp(assessment:VisionAssessmentRecord){
  if(assessment.followUpTaskId)return;
  const subject=tank.livestock.find(x=>x.id===assessment.livestockId),taskId=uid("task"),ts=nowISO();
  const due=new Date(Date.now()+(assessment.triage.level==="urgent"?12:24)*3600000).toISOString().slice(0,10);
  patch(tank.id,t=>({...t,
   maintenance:[...t.maintenance,{id:taskId,title:`متابعة بصرية${subject?` — ${subject.name}`:" للحوض"}`,titleEn:`Visual follow-up${subject?` — ${subject.nameEn||subject.name}`:" for tank"}`,cadence:"once",done:false,nextDue:due,manual:true,sourceDomain:"journal",sourceId:`vision:${assessment.id}`}],
   visionAssessments:(t.visionAssessments??[]).map(x=>x.id===assessment.id?{...x,followUpTaskId:taskId}:x),
   timeline:[{id:uid("ev"),timestamp:ts,type:"vision-follow-up",textAr:"تم إنشاء مهمة متابعة بصرية من نتيجة الصورة.",textEn:"A visual follow-up task was created from the image assessment."},...t.timeline]
  }));
 }

 function createVisionQuarantine(assessment:VisionAssessmentRecord){
  if(!assessment.livestockId||assessment.quarantineCaseId)return;
  const subject=tank.livestock.find(x=>x.id===assessment.livestockId);if(!subject)return;
  const caseId=uid("q"),ts=nowISO(),symptoms=(assessment.symptoms as VisionSymptom[]).map(s=>lang==="ar"?symptomLabels[s]?.ar:symptomLabels[s]?.en).filter(Boolean).join(", ");
  patch(tank.id,t=>({...t,
   livestock:t.livestock.map(x=>x.id===subject.id?{...x,health:x.health==="treatment"?"treatment":"watch",lastObservedAt:ts}:x),
   quarantine:[{id:caseId,livestockId:subject.id,organism:subject.name,reason:bi(lang,"متابعة حالة مشتبهة من Visual Insight بدون تشخيص دوائي تلقائي.","Visual Insight follow-up without automatic medication diagnosis."),symptoms,plan:bi(lang,"اعزل/راقب حسب الحاجة، ثبّت جودة الماء، راجع الفحوصات الحديثة واختر العلاج فقط بعد ترجيح السبب.","Quarantine/observe as appropriate, stabilize water quality, review current tests, and choose treatment only after the cause is reasonably supported."),start:ts.slice(0,10),status:"active"},...t.quarantine],
   visionAssessments:(t.visionAssessments??[]).map(x=>x.id===assessment.id?{...x,quarantineCaseId:caseId}:x),
   timeline:[{id:uid("ev"),timestamp:ts,type:"vision-quarantine",textAr:`تم إنشاء حالة متابعة/حجر مرتبطة بـ ${subject.name} من Visual Insight.`,textEn:`A linked quarantine/follow-up case was created for ${subject.nameEn||subject.name} from Visual Insight.`},...t.timeline]
  }));
 }

 const latest=assessments[0],latestObservations=latest?(lang==="ar"?latest.triage.observationsAr:latest.triage.observationsEn):[],latestPossibilities=latest?(lang==="ar"?latest.triage.possibilitiesAr:latest.triage.possibilitiesEn):[],latestNext=latest?(lang==="ar"?latest.triage.nextAr:latest.triage.nextEn):[];
 const latestCandidates=latest?visionDiseaseCandidates(tank,latest.livestockId,latest.symptoms as VisionSymptom[]):[];
 const confidenceText=latest?`${latest.triage.confidence==="medium"?(lang==="ar"?"متوسطة":"Medium"):(lang==="ar"?"أولية":"Early")} • ${latest.triage.confidenceScore??"—"}/100`:"";
 const assessmentHistory=assessments.slice(0,8);

 return <section className="page-grid"><PageHeader eyebrow="PHOTO JOURNAL • LOCAL BEST AI • GROWTH" title={tr(lang,"journal")}/>

 <div className="card panel full-span">
  <div className="module-head"><div><h3>{bi(lang,"Local Best Visual Insight","Local Best Visual Insight")}</h3><p className="note">{bi(lang,"الطبقة الأولى محلية على جهازك ولا ترسل الصورة للخارج. بعد ظهور النتيجة فيك تطلب AI Vision Second Opinion بشكل صريح؛ فقط عندها، وإذا في مزود خارجي مربوط، بتنرسل الصورة وسياق الحوض للمزود.","The first layer runs locally on your device and does not send the image externally. After the result appears, you can explicitly request an AI Vision second opinion; only then, and only if an external provider is configured, the image and tank context are sent to that provider.")}</p></div><span className="scene-badge">LOCAL BEST AI</span></div>
  <div className="form-grid"><label className="field"><span>{bi(lang,"نطاق الصورة","Image scope")}</span><select value={visionLivestockId} onChange={e=>setVisionLivestockId(e.target.value)}><option value="">{bi(lang,"الحوض كامل","Whole tank")}</option>{visionLivestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label><label className="field full-field"><span>{bi(lang,"ملاحظات السلوك/التطور","Behavior / progression notes")}</span><input value={visionNotes} onChange={e=>setVisionNotes(e.target.value)} placeholder={bi(lang,"من إمتى بلشت؟ في شهية؟ عم تنتشر؟","When did it start? appetite? spreading?")}/></label></div>
  <div className="vision-symptoms" style={{display:"flex",flexWrap:"wrap",gap:7,margin:"12px 0"}}>{(Object.keys(symptomLabels) as VisionSymptom[]).map(s=><button type="button" key={s} className={`btn ${visionSymptoms.includes(s)?"primary":""}`} onClick={()=>toggleSymptom(s)}>{lang==="ar"?symptomLabels[s].ar:symptomLabels[s].en}</button>)}</div>
  <label className="btn primary file-button">{visionBusy?bi(lang,"عم يتم التحليل محلياً...","Analyzing locally..."):bi(lang,"📷 حلل الصورة محلياً","📷 Analyze locally")}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" disabled={visionBusy} onChange={e=>void runVision(e.target.files?.[0])}/></label>
  {visionError&&<div className="inline-alert warn" style={{marginTop:10}}>{visionError}</div>}

  {latest&&<div className={`inline-alert ${latest.triage.level==="urgent"?"danger":latest.triage.level==="attention"?"warn":"good"}`} style={{marginTop:12}}>
   <div style={{display:"grid",gap:10}}>
    <div><small><b>{bi(lang,"1 • ماذا ألاحظ","1 • WHAT I NOTICE")}</b></small><div style={{marginTop:4}}>{latestObservations.slice(0,4).join(" • ")|| (lang==="ar"?latest.triage.summaryAr:latest.triage.summaryEn)}</div></div>
    <div><small><b>{bi(lang,"2 • ماذا قد يعني ذلك","2 • POSSIBLE MEANING")}</b></small><div style={{marginTop:4}}>{latestPossibilities.slice(0,3).join(" • ")}</div></div>
    <div><small><b>{bi(lang,"3 • ماذا تفحص الآن","3 • NEXT BEST CHECK")}</b></small><div style={{marginTop:4}}>{latestNext.slice(0,3).join(" • ")}</div></div>
    <div><small><b>{bi(lang,"4 • مستوى الثقة","4 • CONFIDENCE LEVEL")}</b></small><div style={{marginTop:4}}>{confidenceText} • Capture {latest.metrics.captureScore}/100 • Clarity {latest.metrics.clarityIndex??"—"}/100</div></div>
    {latestCandidates.length>0&&<div><small><b>{bi(lang,"5 • مراجع محتملة من مكتبة الأمراض","5 • SYMPTOM-LINKED LIBRARY REFERENCES")}</b></small><div style={{display:"grid",gap:6,marginTop:6}}>{latestCandidates.map(x=><div key={x.id} className="aqua-ai-local-note"><b>{lang==="ar"?x.ar:x.en}{x.urgent?" ⚠️":""}</b><div>{lang==="ar"?x.symptomsAr:x.symptomsEn}</div></div>)}</div><div className="note">{bi(lang,"هاي مراجع مطابقة للأعراض وليست تشخيصات مؤكدة.","These are symptom-linked references, not confirmed diagnoses.")}</div></div>}
    {latest.triage.comparisonAr&&<div className="aqua-ai-local-note">{lang==="ar"?latest.triage.comparisonAr:latest.triage.comparisonEn}</div>}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
     <button className="btn primary" disabled={deepVisionBusyId===latest.id} onClick={()=>void runDeepVision(latest)}>{deepVisionBusyId===latest.id?bi(lang,"عم يراجع AI Vision...","AI Vision reviewing..."):bi(lang,"✦ AI Vision رأي ثانٍ","✦ AI Vision second opinion")}</button>
     {latest.livestockId&&<button className="btn" onClick={()=>markVisionWatch(latest)}>{bi(lang,"👁 وضع تحت المراقبة","👁 Mark as watch")}</button>}
     <button className="btn" disabled={Boolean(latest.followUpTaskId)} onClick={()=>createVisionFollowUp(latest)}>{latest.followUpTaskId?bi(lang,"✓ متابعة منشأة","✓ Follow-up created"):bi(lang,"＋ متابعة 12–24 ساعة","＋ 12–24h follow-up")}</button>
     {latest.livestockId&&<button className="btn" disabled={Boolean(latest.quarantineCaseId)} onClick={()=>createVisionQuarantine(latest)}>{latest.quarantineCaseId?bi(lang,"✓ حالة حجر منشأة","✓ Quarantine case created"):bi(lang,"＋ متابعة/حجر مرتبط","＋ Linked quarantine/follow-up")}</button>}
    </div>
    {deepVisionError&&<div className="inline-alert warn">{deepVisionError}</div>}
    {latest.external?.status==="completed"&&latest.external.text&&<div className="aqua-ai-local-note" style={{display:"grid",gap:6}}><small><b>EXTERNAL AI VISION SECOND OPINION</b></small><div style={{whiteSpace:"pre-wrap"}}>{latest.external.text}</div><small>{latest.external.provider}{latest.external.model?` • ${latest.external.model}`:""} • {bi(lang,"رأي ثانٍ وليس تشخيصاً تلقائياً","second opinion, not an automatic diagnosis")}</small></div>}
    {latest.external?.status==="unavailable"&&<div className="inline-alert info">{latest.external.error||bi(lang,"ما في مزود AI Vision خارجي مربوط حالياً.","No external AI Vision provider is configured.")}</div>}
   </div>
   <div className="summary-strip" style={{marginTop:10}}>
    <div className="summary"><small>{bi(lang,"الوضوح","Clarity")}</small><b>{latest.metrics.clarityIndex??"—"}</b></div>
    <div className="summary"><small>{bi(lang,"التشبع","Saturation")}</small><b>{latest.metrics.colorIndex??"—"}</b></div>
    <div className="summary"><small>{bi(lang,"مناطق خضراء","Green regions")}</small><b>{latest.metrics.greenDominancePercent??"—"}%</b></div>
    <div className="summary"><small>{bi(lang,"مناطق فاتحة","Pale regions")}</small><b>{latest.metrics.palePixelPercent??"—"}%</b></div>
   </div>
   <div className="note" style={{marginTop:8}}>{bi(lang,"المؤشرات البصرية محلية واحتمالية وليست تشخيص مرض أو قياس مخبري. قوة النظام الأساسية هي المقارنة الزمنية والربط مع سياق نفس الحوض.","Visual signals are local and probabilistic, not a disease diagnosis or laboratory measurement. The strongest value is time-series comparison and fusion with this tank's context.")}</div>
  </div>}
 </div>

 {assessmentHistory.length>0&&<div className="card panel full-span">
  <div className="module-head"><div><h3>{bi(lang,"سجل Visual Insight","Visual Insight history")}</h3><p className="note">{bi(lang,"كل تحليل محفوظ مع الصورة والسياق والإجراءات الناتجة عنه حتى تقدر تراجع تطور الحالة زمنياً.","Each assessment stays linked to its image, context and resulting actions so progression remains auditable over time.")}</p></div><span className="scene-badge">{assessments.length}</span></div>
  <div className="history-list">{assessmentHistory.map(a=>{const subject=tank.livestock.find(x=>x.id===a.livestockId),candidate=visionDiseaseCandidates(tank,a.livestockId,a.symptoms as VisionSymptom[])[0];return <div className="history-row" key={a.id} style={{alignItems:"flex-start",gap:10}}>
   <div style={{flex:1,display:"grid",gap:4}}><b>{subject?(lang==="ar"?subject.name:(subject.nameEn||subject.name)):bi(lang,"الحوض كامل","Whole tank")} • {a.triage.level}</b><small>{new Date(a.timestamp).toLocaleString()} • {bi(lang,"ثقة","confidence")} {a.triage.confidenceScore}/100 • Capture {a.metrics.captureScore}/100</small><span>{lang==="ar"?a.triage.summaryAr:a.triage.summaryEn}</span>{candidate&&<small>{bi(lang,"أقرب مرجع أعراض:","Top symptom reference:")} {lang==="ar"?candidate.ar:candidate.en}</small>}</div>
   <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}><button className="btn" disabled={deepVisionBusyId===a.id} onClick={()=>void runDeepVision(a)}>{a.external?.status==="completed"?bi(lang,"إعادة الرأي الثاني","Repeat second opinion"):bi(lang,"AI رأي ثانٍ","AI second opinion")}</button>{a.livestockId&&<button className="btn" onClick={()=>markVisionWatch(a)}>👁</button>}<button className="btn" disabled={Boolean(a.followUpTaskId)} onClick={()=>createVisionFollowUp(a)}>{a.followUpTaskId?"✓":"＋24h"}</button>{a.livestockId&&<button className="btn" disabled={Boolean(a.quarantineCaseId)} onClick={()=>createVisionQuarantine(a)}>{a.quarantineCaseId?"✓ Q":"＋ Q"}</button>}</div>
  </div>})}</div>
 </div>}

 <div className="card panel full-span"><div className="module-head"><div><h3>{bi(lang,"بروتوكول تصوير ثابت","Consistent capture protocol")}</h3><p className="note">{bi(lang,"لحتى مقارنة اللون والنمو يكون إلها معنى: نفس الكائن، نفس الزاوية والمسافة، نفس برنامج الإضاءة تقريباً، نظف الزجاج، وتجنب انعكاس الفلاش. اعتبر أول صورة واضحة Reference للمقارنات التالية.","For meaningful color/growth comparison: use the same subject, angle and distance, similar light schedule, clean glass, and avoid flash reflections. Treat the first clear capture as the reference.")}</p></div><span className="scene-badge">{photos.length?bi(lang,"Reference موجود","Reference available"):bi(lang,"بانتظار أول صورة","Awaiting first capture")}</span></div>{photos[photos.length-1]&&<div className="inline-alert info"><b>{bi(lang,"مرجع أقدم صورة محفوظة:","Oldest saved reference:")}</b> {new Date(photos[photos.length-1].timestamp).toLocaleString()} • Capture {photos[photos.length-1].captureScore??"—"}/100</div>}</div>

 <div className="card panel full-span"><div className="module-head"><div><h3>{bi(lang,"Frag / Growth Tracker","Frag / Growth Tracker")}</h3><p className="note">{bi(lang,"ثبّت الزاوية والإضاءة والمسافة قدر الإمكان حتى تكون المقارنة الزمنية أصدق.","Keep angle, lighting and distance as consistent as possible for better time-series comparison.")}</p></div></div><div className="journal-add" style={{flexWrap:"wrap"}}><label className="field grow"><span>{tr(lang,"photoCaption")}</span><input value={caption} onChange={e=>setCaption(e.target.value)}/></label><label className="field"><span>{bi(lang,"الكائن المتابع","Tracked organism")}</span><select value={livestockId} onChange={e=>setLivestockId(e.target.value)}><option value="">—</option>{trackedLivestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label><label className="field"><span>{bi(lang,"الحجم التقديري cm","Estimated size cm")}</span><input type="number" min="0" step=".1" value={sizeCm||""} onChange={e=>setSizeCm(Number(e.target.value))}/></label><label className="btn primary file-button">{tr(lang,"addPhoto")}<input type="file" accept="image/*" capture="environment" onChange={e=>void add(e.target.files?.[0])}/></label></div><div className="inline-alert info" style={{marginTop:12}}>{bi(lang,"صور النمو تنضغط محلياً لتقليل التخزين. النمو يعتمد على الحجم المدخل، بينما اللون والوضوح مؤشرات مقارنة من الصورة وليست segmentation أو قياساً مخبرياً.","Growth photos are compressed locally to reduce storage. Growth uses entered size, while color/clarity are comparative image signals, not segmentation or laboratory measurements.")}</div></div>

 {livestockId&&<div className="card panel full-span"><div className="module-head"><h3>{bi(lang,"سجل التطور الزمني","Growth Timeline")}</h3><span className="scene-badge">{growth?.count??0} {bi(lang,"صور","photos")}</span></div>{growth&&growth.count>=2?<><div className="summary-strip"><div className="summary"><small>{bi(lang,"النمو منذ أول صورة","Growth since first photo")}</small><b>{growth.growthPct===null?"—":`${growth.growthPct>=0?"+":""}${growth.growthPct.toFixed(1)}%`}</b></div><div className="summary"><small>{bi(lang,"معدل تقريبي / 30 يوم","Approx / 30d")}</small><b>{growth.monthlyGrowthPct===null?"—":`${growth.monthlyGrowthPct>=0?"+":""}${growth.monthlyGrowthPct.toFixed(1)}%`}</b></div><div className="summary"><small>{bi(lang,"تغير مؤشر اللون","Color-index change")}</small><b>{growth.colorDelta===null?"—":`${growth.colorDelta>=0?"+":""}${growth.colorDelta}`}</b></div><div className="summary"><small>{bi(lang,"اتساق التصوير","Capture consistency")}</small><b>{growth.consistency?.score??"—"}%</b></div></div>{growth.consistency&&<div className="inline-alert info" style={{marginTop:10}}>{lang==="ar"?growth.consistency.noteAr:growth.consistency.noteEn}</div>}</>:<div className="inline-alert info">{bi(lang,"أضف صورتين أو أكثر لنفس الكائن حتى يظهر اتجاه النمو وتغير اللون.","Add at least two photos of the same organism to show growth and color trend.")}</div>}</div>}

 {assessments.length>0&&<div className="card panel full-span">
  <div className="module-head"><div><h3>{bi(lang,"سجل Visual Insight","Visual Insight history")}</h3><p className="note">{bi(lang,"كل تحليل محفوظ مع الصورة والكائن والنتيجة والإجراءات المرتبطة حتى تقدر تراجع تطور الحالة.","Every assessment stays linked to its photo, organism, result and follow-up actions so you can review progression.")}</p></div><span className="scene-badge">{assessments.length}</span></div>
  <div className="history-list">{assessments.slice(0,12).map(a=>{const subject=tank.livestock.find(x=>x.id===a.livestockId),photo=photos.find(x=>x.id===a.photoId);return <div className="history-row" key={a.id} style={{alignItems:"flex-start",gap:12}}>
   {photo&&<StoredPhotoImage photo={photo} alt={photo.caption||"Visual assessment"} style={{width:72,height:72,objectFit:"cover",borderRadius:10,flex:"0 0 auto"}}/>}
   <div style={{display:"grid",gap:5,flex:1,minWidth:0}}>
    <b>{subject?(lang==="ar"?subject.name:(subject.nameEn||subject.name)):bi(lang,"الحوض كامل","Whole tank")} • {a.triage.level==="urgent"?bi(lang,"عاجل","Urgent"):a.triage.level==="attention"?bi(lang,"متابعة","Attention"):bi(lang,"مراقبة","Monitor")}</b>
    <small>{new Date(a.timestamp).toLocaleString()} • {bi(lang,"ثقة","Confidence")} {a.triage.confidenceScore}/100 • Capture {a.metrics.captureScore}/100</small>
    <span>{lang==="ar"?a.triage.summaryAr:a.triage.summaryEn}</span>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
     <button className="btn" disabled={deepVisionBusyId===a.id} onClick={()=>void runDeepVision(a)}>{deepVisionBusyId===a.id?bi(lang,"عم يراجع...","Reviewing..."):a.external?.status==="completed"?bi(lang,"إعادة الرأي الثاني","Repeat second opinion"):bi(lang,"AI Vision رأي ثانٍ","AI Vision second opinion")}</button>
     {a.livestockId&&<button className="btn" onClick={()=>markVisionWatch(a)}>{bi(lang,"مراقبة","Watch")}</button>}
     <button className="btn" disabled={Boolean(a.followUpTaskId)} onClick={()=>createVisionFollowUp(a)}>{a.followUpTaskId?bi(lang,"✓ متابعة","✓ Follow-up"):bi(lang,"＋ متابعة","＋ Follow-up")}</button>
     {a.livestockId&&<button className="btn" disabled={Boolean(a.quarantineCaseId)} onClick={()=>createVisionQuarantine(a)}>{a.quarantineCaseId?bi(lang,"✓ حجر/متابعة","✓ Quarantine"):bi(lang,"＋ حجر/متابعة","＋ Quarantine")}</button>}
    </div>
    {a.external?.status==="completed"&&a.external.text&&<div className="aqua-ai-local-note" style={{whiteSpace:"pre-wrap"}}>{a.external.text}</div>}
   </div>
  </div>})}</div>
 </div>}

 <div className="photo-grid full-span">{photos.slice(0,photoLimit).map(p=>{const subject=tank.livestock.find(x=>x.id===p.livestockId);return <article className="photo-card" key={p.id}><StoredPhotoImage photo={p} alt={p.caption||tr(lang,"journal")}/><div><b>{p.caption||subject&&(lang==="ar"?subject.name:(subject.nameEn||subject.name))||tr(lang,"journal")}</b><small>{new Date(p.timestamp).toLocaleString()}</small>{subject&&<small>{lang==="ar"?subject.name:(subject.nameEn||subject.name)}{p.estimatedSizeCm?` • ${p.estimatedSizeCm} cm`:""}</small>}<small>{typeof p.colorIndex==="number"?`${bi(lang,"مؤشر اللون","Color index")}: ${p.colorIndex}/100`:""}{typeof p.brightnessIndex==="number"?` • ${bi(lang,"الإضاءة","brightness")}: ${p.brightnessIndex}/100`:""}{typeof p.captureScore==="number"?` • Capture ${p.captureScore}/100`:""}</small></div></article>})}</div>{photoLimit<photos.length&&<div className="full-span" style={{display:"flex",justifyContent:"center"}}><button className="btn" onClick={()=>setPhotoLimit(n=>n+60)}>{bi(lang,`عرض 60 صورة أقدم — باقي ${photos.length-photoLimit}`,`Show 60 older photos — ${photos.length-photoLimit} remaining`)}</button></div>}
 </section>;
}
