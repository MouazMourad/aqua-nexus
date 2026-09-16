"use client";
import { useMemo,useState } from "react";
import type { JournalPhoto,Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { uid,nowISO } from "@/lib/appUtils";

type GrowthPhoto=JournalPhoto&{livestockId?:string;estimatedSizeCm?:number;colorIndex?:number;brightnessIndex?:number};

function analyzeImage(dataUrl:string):Promise<{colorIndex:number;brightnessIndex:number}>{
 return new Promise(resolve=>{
  const img=new Image();
  img.onload=()=>{
   const canvas=document.createElement("canvas");canvas.width=64;canvas.height=64;
   const ctx=canvas.getContext("2d"); if(!ctx){resolve({colorIndex:0,brightnessIndex:0});return;}
   ctx.drawImage(img,0,0,64,64);
   const data=ctx.getImageData(0,0,64,64).data;
   let sat=0,bright=0,count=0;
   for(let i=0;i<data.length;i+=4){if(data[i+3]<32)continue;const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);sat+=mx===0?0:(mx-mn)/mx;bright+=(r+g+b)/3;count++;}
   resolve({colorIndex:count?Math.round(sat/count*100):0,brightnessIndex:count?Math.round(bright/count*100):0});
  };
  img.onerror=()=>resolve({colorIndex:0,brightnessIndex:0});
  img.src=dataUrl;
 });
}

export function JournalPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const [caption,setCaption]=useState(""),[livestockId,setLivestockId]=useState(""),[sizeCm,setSizeCm]=useState(0);
 const photos=tank.photos as GrowthPhoto[];
 const trackedLivestock=tank.livestock.filter(x=>x.category==="coral"||x.category==="plant"||x.category==="other");
 const growth=useMemo(()=>{
  if(!livestockId)return null;
  const list=photos.filter(p=>p.livestockId===livestockId).slice().sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());
  if(list.length<2)return {count:list.length,growthPct:null as number|null,colorDelta:null as number|null,first:list[0],last:list[0]};
  const first=list[0],last=list[list.length-1];
  const growthPct=first.estimatedSizeCm&&last.estimatedSizeCm?((last.estimatedSizeCm-first.estimatedSizeCm)/first.estimatedSizeCm*100):null;
  const colorDelta=typeof first.colorIndex==="number"&&typeof last.colorIndex==="number"?last.colorIndex-first.colorIndex:null;
  return {count:list.length,growthPct,colorDelta,first,last};
 },[photos,livestockId]);

 function add(file?:File){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=async()=>{
   const dataUrl=String(reader.result);
   const visual=await analyzeImage(dataUrl);
   const ts=nowISO();
   const subject=tank.livestock.find(x=>x.id===livestockId);
   const photo:any={id:uid("ph"),timestamp:ts,caption,dataUrl,livestockId:livestockId||undefined,estimatedSizeCm:sizeCm>0?sizeCm:undefined,colorIndex:visual.colorIndex,brightnessIndex:visual.brightnessIndex};
   patch(tank.id,t=>({...t,photos:[photo,...t.photos],timeline:subject?[{id:uid("ev"),timestamp:ts,type:"growth-photo",textAr:`تمت إضافة صورة متابعة لـ ${subject.name}${sizeCm>0?` بحجم تقديري ${sizeCm} سم`:""}.`,textEn:`Growth photo added for ${subject.nameEn||subject.name}${sizeCm>0?` with estimated size ${sizeCm} cm`:""}.`},...t.timeline]:t.timeline}));
   setCaption("");setSizeCm(0);
  };
  reader.readAsDataURL(file);
 }

 return <section className="page-grid"><PageHeader eyebrow="PHOTO JOURNAL & GROWTH" title={tr(lang,"journal")}/>
 <div className="card panel full-span"><div className="journal-add" style={{flexWrap:"wrap"}}><label className="field grow"><span>{tr(lang,"photoCaption")}</span><input value={caption} onChange={e=>setCaption(e.target.value)}/></label><label className="field"><span>{bi(lang,"الكائن المتابع","Tracked organism")}</span><select value={livestockId} onChange={e=>setLivestockId(e.target.value)}><option value="">—</option>{trackedLivestock.map(x=><option key={x.id} value={x.id}>{lang==="ar"?x.name:(x.nameEn||x.name)}</option>)}</select></label><label className="field"><span>{bi(lang,"الحجم التقديري cm","Estimated size cm")}</span><input type="number" min="0" step=".1" value={sizeCm||""} onChange={e=>setSizeCm(Number(e.target.value))}/></label><label className="btn primary file-button">{tr(lang,"addPhoto")}<input type="file" accept="image/*" onChange={e=>add(e.target.files?.[0])}/></label></div><div className="inline-alert info" style={{marginTop:12}}>{bi(lang,"نسبة النمو تعتمد على الحجم الذي تدخله لنفس المستعمرة. مؤشر اللون يُحسب آلياً من الصورة كمؤشر بصري مقارن، وليس قياساً مخبرياً أو تشخيصاً مرضياً.","Growth percentage uses the size you enter for the same colony. Color index is calculated automatically from the image as a comparative visual metric, not a laboratory measurement or disease diagnosis.")}</div></div>

 {livestockId&&<div className="card panel full-span"><div className="module-head"><h3>{bi(lang,"سجل التطور الزمني","Growth Timeline")}</h3><span className="scene-badge">{growth?.count??0} {bi(lang,"صور","photos")}</span></div>{growth&&growth.count>=2?<div className="summary-strip"><div className="summary"><small>{bi(lang,"النمو منذ أول صورة","Growth since first photo")}</small><b>{growth.growthPct===null?"—":`${growth.growthPct>=0?"+":""}${growth.growthPct.toFixed(1)}%`}</b></div><div className="summary"><small>{bi(lang,"تغير مؤشر اللون","Color-index change")}</small><b>{growth.colorDelta===null?"—":`${growth.colorDelta>=0?"+":""}${growth.colorDelta}`}</b></div><div className="summary"><small>{bi(lang,"الفترة","Period")}</small><b>{growth.first&&growth.last?Math.max(0,Math.round((new Date(growth.last.timestamp).getTime()-new Date(growth.first.timestamp).getTime())/86400000)):0} d</b></div></div>:<div className="inline-alert info">{bi(lang,"أضف صورتين أو أكثر لنفس الكائن حتى يظهر اتجاه النمو وتغير اللون.","Add at least two photos of the same organism to show growth and color trend.")}</div>}</div>}

 <div className="photo-grid full-span">{photos.map(p=>{const subject=tank.livestock.find(x=>x.id===p.livestockId);return <article className="photo-card" key={p.id}><img src={p.dataUrl} alt={p.caption}/><div><b>{p.caption||subject&&(lang==="ar"?subject.name:(subject.nameEn||subject.name))||tr(lang,"journal")}</b><small>{new Date(p.timestamp).toLocaleString()}</small>{subject&&<small>{lang==="ar"?subject.name:(subject.nameEn||subject.name)}{p.estimatedSizeCm?` • ${p.estimatedSizeCm} cm`:""}</small>}<small>{typeof p.colorIndex==="number"?`${bi(lang,"مؤشر اللون","Color index")}: ${p.colorIndex}/100`:""}{typeof p.brightnessIndex==="number"?` • ${bi(lang,"الإضاءة","brightness")}: ${p.brightnessIndex}/100`:""}</small></div></article>})}</div>
 </section>;
}
