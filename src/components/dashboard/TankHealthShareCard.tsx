"use client";
import { useState } from "react";
import type { Tank } from "@/domain/types";
import { chemistryHealth,maintenanceHealth } from "@/domain/health";
import { systemHealth } from "@/domain/systemHealth";
import { tankMood } from "@/domain/tankLearning";
import { tankStateView } from "@/domain/tankIntelligence";
import { useAquaStore } from "@/store/useAquaStore";

function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
}

function drawCard(tank:Tank,lang:"ar"|"en"){
  const c=document.createElement("canvas");c.width=1080;c.height=1350;
  const ctx=c.getContext("2d");if(!ctx)return null;
  const state=tankStateView(tank),mood=tankMood(tank),system=systemHealth(tank),health=system.score,chem=chemistryHealth(tank),maint=maintenanceHealth(tank);
  const g=ctx.createLinearGradient(0,0,1080,1350);g.addColorStop(0,"#03121c");g.addColorStop(.55,"#062a37");g.addColorStop(1,"#041820");ctx.fillStyle=g;ctx.fillRect(0,0,1080,1350);
  ctx.fillStyle="rgba(70,225,210,.08)";ctx.beginPath();ctx.arc(890,190,260,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#dffcff";ctx.font="700 54px system-ui, sans-serif";ctx.textAlign=lang==="ar"?"right":"left";ctx.direction=lang==="ar"?"rtl":"ltr";ctx.fillText("Aqua Nexus",lang==="ar"?970:110,105);
  ctx.fillStyle="#74e2ee";ctx.font="600 28px system-ui, sans-serif";ctx.fillText(lang==="ar"?"بطاقة حالة الحوض":"Tank Health Card",lang==="ar"?970:110,155);
  ctx.fillStyle="#ffffff";ctx.font="800 58px system-ui, sans-serif";ctx.fillText(tank.name,lang==="ar"?970:110,265);
  ctx.fillStyle="#bfeaf0";ctx.font="500 26px system-ui, sans-serif";ctx.fillText(`${tank.type==="marine"?(lang==="ar"?"بحري":"Marine"):(lang==="ar"?"مياه عذبة":"Freshwater")} • ${tank.systemVolumeLiters.toFixed(0)} L`,lang==="ar"?970:110,310);
  roundRect(ctx,90,370,900,300,34);ctx.fillStyle="rgba(255,255,255,.055)";ctx.fill();ctx.strokeStyle="rgba(125,230,240,.18)";ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle="#ffffff";ctx.font="900 142px system-ui, sans-serif";ctx.textAlign="center";ctx.direction="ltr";ctx.fillText(`${state.score}%`,540,535);
  ctx.font="800 40px system-ui, sans-serif";ctx.fillStyle="#71e3cc";ctx.fillText(lang==="ar"?mood.ar:mood.en,540,600);
  ctx.font="500 24px system-ui, sans-serif";ctx.fillStyle="#b9dce0";ctx.fillText(lang==="ar"?mood.noteAr:mood.noteEn,540,642,800);
  const metrics=[
    [lang==="ar"?"صحة النظام":"System Health",health],
    [lang==="ar"?"الكيمياء":"Chemistry",chem],
    [lang==="ar"?"الصيانة":"Maintenance",maint]
  ] as const;
  metrics.forEach((m,i)=>{const x=90+i*310;roundRect(ctx,x,720,280,170,24);ctx.fillStyle="rgba(255,255,255,.045)";ctx.fill();ctx.textAlign="center";ctx.fillStyle="#bfeaf0";ctx.font="600 23px system-ui, sans-serif";ctx.fillText(m[0],x+140,775);ctx.fillStyle="#fff";ctx.font="900 56px system-ui, sans-serif";ctx.fillText(`${m[1]}%`,x+140,848);});
  ctx.textAlign=lang==="ar"?"right":"left";ctx.direction=lang==="ar"?"rtl":"ltr";ctx.fillStyle="#dffcff";ctx.font="700 28px system-ui, sans-serif";ctx.fillText(lang==="ar"?"حالة الحوض الآن":"Current tank state",lang==="ar"?970:110,970);
  ctx.font="500 24px system-ui, sans-serif";ctx.fillStyle="#a9cdd1";ctx.fillText(lang==="ar"?state.ar:state.en,lang==="ar"?970:110,1015);
  ctx.fillStyle="#7adccc";ctx.font="600 22px system-ui, sans-serif";ctx.fillText(lang==="ar"?"Aqua Nexus يفهم الحوض كنظام واحد، مو مجرد أرقام.":"Aqua Nexus understands the aquarium as one living system, not just numbers.",lang==="ar"?970:110,1110,860);
  ctx.fillStyle="#7e9ea4";ctx.font="500 19px system-ui, sans-serif";ctx.fillText(new Date().toLocaleString(),lang==="ar"?970:110,1240);
  return c;
}

async function canvasBlob(canvas:HTMLCanvasElement){return new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png",.94));}

export function TankHealthShareCard({tank}:{tank:Tank}){
  const lang=useAquaStore(s=>s.language);
  const [status,setStatus]=useState("");
  const state=tankStateView(tank),mood=tankMood(tank);
  const text=lang==="ar"?`${tank.name} — حالة الحوض ${state.score}% (${mood.ar}) عبر Aqua Nexus.`:`${tank.name} — tank state ${state.score}% (${mood.en}) via Aqua Nexus.`;

  async function shareImage(){
    const canvas=drawCard(tank,lang);if(!canvas)return;
    const blob=await canvasBlob(canvas);if(!blob)return;
    const file=new File([blob],`aqua-nexus-${tank.name.replace(/\s+/g,"-").toLowerCase()}.png`,{type:"image/png"});
    try{
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:"Aqua Nexus",text,files:[file]});setStatus(lang==="ar"?"تم فتح المشاركة":"Share opened");return;}
    }catch(e:any){if(e?.name==="AbortError")return;}
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);setStatus(lang==="ar"?"تم حفظ البطاقة للمشاركة":"Card saved for sharing");
  }
  function whatsapp(){window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer");}

  return <section className="card panel share-health-card">
    <div className="module-head"><div><small className="eyebrow-mini">SHAREABLE HEALTH CARD</small><h3>{lang==="ar"?"شارك بطاقة الحوض":"Share tank health card"}</h3></div><div className={`mood-orb mood-${mood.key}`}><b>{mood.symbol}</b></div></div>
    <p className="note">{lang==="ar"?"بطاقة مختصرة فيها حالة الحوض وصحته والكيمياء والصيانة بدون كشف سجلّك الكامل.":"A compact card with tank state, health, chemistry and maintenance without exposing your full log."}</p>
    <div className="share-card-actions"><button className="btn primary" onClick={shareImage}>{lang==="ar"?"مشاركة/حفظ البطاقة":"Share / save card"}</button><button className="btn" onClick={whatsapp}>{lang==="ar"?"مشاركة على واتساب":"Share on WhatsApp"}</button></div>
    {status&&<small className="share-status">{status}</small>}
  </section>;
}
