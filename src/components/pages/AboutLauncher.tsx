"use client";
import Link from "next/link";
import { useAquaStore } from "@/store/useAquaStore";
import { bi } from "@/i18n";

export function AboutLauncher(){
 const lang=useAquaStore(s=>s.language);
 return <div className="card panel full-span" style={{overflow:"hidden",position:"relative",background:"linear-gradient(135deg,rgba(5,30,52,.98),rgba(7,69,83,.92))",color:"white"}}>
  <div aria-hidden="true" style={{position:"absolute",inset:"auto -15% -65% -15%",height:180,borderRadius:"50%",borderTop:"2px solid rgba(104,235,255,.35)",boxShadow:"0 -20px 70px rgba(42,200,255,.12)"}}/>
  <div className="module-head" style={{position:"relative"}}><div><small className="eyebrow-mini" style={{color:"#8ceeff"}}>AQUA NEXUS</small><h3 style={{color:"white"}}>🌊 {bi(lang,"حول Aqua Nexus","About Aqua Nexus")}</h3><p className="note" style={{color:"#ccecf4"}}>{bi(lang,"ادخل التجربة السينمائية واكتشف قصة Aqua Nexus، ميزاته، ما يميزه، رحلة تطويره واختباره.","Enter the cinematic experience and discover Aqua Nexus, its features, differentiators, development journey and testing story.")}</p></div><span className="scene-badge">MARINE • FRESHWATER</span></div>
  <Link href="/about" className="btn primary" style={{position:"relative",display:"inline-flex",textDecoration:"none",marginTop:12}}>{bi(lang,"تشغيل التجربة السينمائية","Launch cinematic experience")} ✨</Link>
 </div>
}
