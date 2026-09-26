"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import {useAquaStore} from "@/store/useAquaStore";
import "./cinematic.css";
const CinematicWorld=dynamic(()=>import("./CinematicWorld"),{ssr:false});
export default function CinematicPage(){
 const lang=useAquaStore(s=>s.language); const ar=lang==="ar";
 return <main className="cinematic-engine" dir={ar?"rtl":"ltr"}>
  <CinematicWorld/>
  <div className="cinematic-ui">
   <Link href="/about" className="cinematic-exit">{ar?"العودة":"Back"}</Link>
   <div className="cinematic-copy">
    <small>AQUA NEXUS · CINEMATIC ENGINE</small>
    <h1>{ar?"حين تتحول البيانات إلى حياة":"When data becomes life"}</h1>
    <p>{ar?"نموذج محرك WebGL ثلاثي الأبعاد مستقل — كاميرا، عمق، جسيمات، ماء وإضاءة في الزمن الحقيقي.":"An isolated real-time WebGL proof of concept — camera, depth, particles, water and light."}</p>
   </div>
   <div className="engine-badge">WEBGL · 3D · REAL TIME</div>
  </div>
 </main>
}