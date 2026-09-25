"use client";

import Link from "next/link";
import { useAquaStore } from "@/store/useAquaStore";
import "../about.css";

const copy={
 ar:{
  back:"العودة إلى Aqua Nexus",hero:"عالمان. منظومة ذكية واحدة.",heroSub:"بحري • نهري • عقل واحد يفهم رحلة الحوض كاملة",brain:"عقل الحوض",brainSub:"البيانات لا تعيش في جزر منفصلة. Aqua Nexus يربط حالة الحوض، الكيمياء، الكائنات، الصيانة والقرارات في سياق واحد.",features:"الميزات الأساسية",different:"بماذا يتميز Aqua Nexus؟",connected:"كل شيء مترابط",connectedSub:"حدث واحد يمكن أن ينعكس على الكيمياء والمخزون والصيانة والتنبيهات والسجل الزمني — حيث يجب، ومتى يجب.",safety:"ذكاء يفهم قبل أن يقترح",safetySub:"فهم • ربط • تحذير • إجراء أكثر أماناً",journey:"رحلة الحوض كاملة",journeySub:"من أول يوم… إلى سنوات من التاريخ والذاكرة.",quality:"بُني واختُبر بجدية",qualitySub:"اختبارات تجربة المستخدم، End-to-End، Regression، سلامة البيانات، Backup & Restore، تعدد الأجهزة، وفحوص الإنتاج.",pass:"100% PASS",passSub:"آخر اختبارات الإغلاق المستهدفة",dev:"رحلة التطوير",creator:"صُمم ليجعل الحوض مفهوماً، مترابطاً، وأسهل في الإدارة — لا مجرد أرقام موزعة بين صفحات.",final:"أكثر من مجرد متابعة للحوض… منظومة متكاملة لإدارته وفهمه.",contact:"تواصل مع المطوّر"},
 en:{
  back:"Back to Aqua Nexus",hero:"Two worlds. One intelligent ecosystem.",heroSub:"Marine • Freshwater • One brain that understands the whole aquarium journey",brain:"Tank Brain",brainSub:"Aquarium data should not live in isolated silos. Aqua Nexus connects health, chemistry, livestock, maintenance and decisions in one context.",features:"Core Features",different:"What Makes Aqua Nexus Different?",connected:"Everything is connected",connectedSub:"One event can flow into chemistry, inventory, maintenance, alerts and timeline — where it matters, when it matters.",safety:"Intelligence that understands before it suggests",safetySub:"Understand • Correlate • Warn • Act more safely",journey:"The complete aquarium journey",journeySub:"From day one… to years of history and memory.",quality:"Built and tested seriously",qualitySub:"UX, End-to-End, Regression, Data Integrity, Backup & Restore, cross-device and production validation.",pass:"100% PASS",passSub:"Latest targeted closure tests",dev:"Development Journey",creator:"Built to make an aquarium understandable, connected and easier to manage — not just numbers scattered across screens.",final:"Not just an aquarium tracker. An aquarium operating system.",contact:"Contact the creator"}
} as const;

const features=["CHEMISTRY","LIVESTOCK","ACCLIMATION","MAINTENANCE","FEEDING","DISEASES & TREATMENT","EQUIPMENT","INVENTORY","TIMELINE","BACKUP & RESTORE"];
const differentiators=["TANK BRAIN","IMPACT ENGINE","AQUARIUM SAFETY","AQUARIUM MEMORY","ONE SOURCE OF TRUTH","MARINE + FRESHWATER","COMPLETE AQUARIUM JOURNEY"];
const journey=["SETUP","CYCLING","LIVESTOCK","GROWTH","MAINTENANCE","DISEASE","RECOVERY","YEARS OF HISTORY"];
const development=["IDEA","PROTOTYPE","CORE MODULES","TANK BRAIN","SAFETY","INTEGRATION","INTENSIVE TESTING","BETA"];

export default function AboutPage(){
 const lang=useAquaStore(s=>s.language); const t=copy[lang]; const rtl=lang==="ar";
 return <main className="cinema-about" dir={rtl?"rtl":"ltr"}>
  <Link href="/" className="cinema-back">← {t.back}</Link>
  <section className="cinema-scene hero-scene">
   <div className="water-world freshwater"><span>🌿</span><small>FRESHWATER</small></div>
   <div className="aqua-mark"><div className="aqua-orb">AN</div><h1>AQUA NEXUS</h1><h2>{t.hero}</h2><p>{t.heroSub}</p></div>
   <div className="water-world marine"><span>🪸</span><small>MARINE</small></div>
   <div className="wave wave-a"/><div className="wave wave-b"/>
  </section>

  <section className="cinema-scene brain-scene"><div className="brain-core"><span>🧠</span><h2>{t.brain}</h2><p>{t.brainSub}</p></div><div className="data-ring">pH · KH · GH · NO₃ · PO₄ · Ca · Mg · SALINITY</div></section>

  <section className="cinema-scene impact-scene"><p className="scene-kicker">{t.features}</p><div className="impact-stack">{features.map((x,i)=><div className="impact-word" style={{"--i":i} as React.CSSProperties} key={x}>{x}</div>)}</div></section>

  <section className="cinema-scene difference-scene"><p className="scene-kicker">{t.different}</p><div className="difference-grid">{differentiators.map((x,i)=><article key={x} style={{"--i":i} as React.CSSProperties}><b>{x}</b><span>{i===0?"ONE BRAIN · WHOLE AQUARIUM":i===1?"EVERY ACTION HAS CONSEQUENCES":i===2?"SAFER DECISIONS":i===3?"YOUR AQUARIUM NEVER FORGETS":i===4?"ONE CONNECTED HISTORY":i===5?"TWO WORLDS · ONE INTELLIGENCE":"DAY ONE → YEAR TEN"}</span></article>)}</div></section>

  <section className="cinema-scene connected-scene"><div className="pulse-node">AQUA NEXUS</div><div className="orbit orbit-1">CHEMISTRY</div><div className="orbit orbit-2">INVENTORY</div><div className="orbit orbit-3">MAINTENANCE</div><div className="orbit orbit-4">ALERTS</div><div className="orbit orbit-5">TIMELINE</div><div className="scene-copy"><h2>{t.connected}</h2><p>{t.connectedSub}</p></div></section>

  <section className="cinema-scene safety-scene"><div className="shield">🛡️</div><h2>{t.safety}</h2><p>{t.safetySub}</p></section>

  <section className="cinema-scene journey-scene"><h2>{t.journey}</h2><p>{t.journeySub}</p><div className="journey-line">{journey.map(x=><span key={x}>{x}</span>)}</div></section>

  <section className="cinema-scene quality-scene"><h2>{t.quality}</h2><p>{t.qualitySub}</p><div className="quality-tags"><span>UX</span><span>E2E</span><span>REGRESSION</span><span>DATA INTEGRITY</span><span>BACKUP / RESTORE</span><span>CROSS-DEVICE</span><span>PRODUCTION</span></div><div className="pass-badge"><strong>{t.pass}</strong><small>{t.passSub}</small></div></section>

  <section className="cinema-scene development-scene"><h2>{t.dev}</h2><div className="development-flow">{development.map(x=><span key={x}>{x}</span>)}</div></section>

  <section className="cinema-scene creator-scene"><div className="creator-glow"/><small>CREATOR / FOUNDER</small><h2>Mouaz Mourad</h2><p>{t.creator}</p><a className="creator-contact" href="mailto:mouaz.mourad@gmail.com">{t.contact}</a></section>

  <section className="cinema-scene finale-scene"><div className="final-worlds"><span>🌿</span><span>🪸</span></div><h1>AQUA NEXUS</h1><h2>Marine • Freshwater • One Intelligent Ecosystem</h2><p>{t.final}</p><Link href="/" className="final-button">{t.back}</Link></section>
 </main>
}
