"use client";

import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import "../about.css";

const copy={
 ar:{
  back:"العودة إلى Aqua Nexus",skip:"تخطي",hero:"عالمان. منظومة ذكية واحدة.",heroSub:"بحري • نهري • عقل واحد يفهم رحلة الحوض كاملة",freshwater:"نهري",marine:"بحري",
  brain:"عقل الحوض",brainSub:"البيانات لا تعيش في جزر منفصلة. Aqua Nexus يربط حالة الحوض، الكيمياء، الكائنات، الصيانة والقرارات في سياق واحد.",features:"ميزات قوية لكل هاوٍ",
  different:"بماذا يتميز Aqua Nexus؟",connected:"كل شيء مترابط",connectedSub:"حدث واحد يمكن أن ينعكس على الكيمياء والمخزون والصيانة والتنبيهات والسجل الزمني — حيث يجب، ومتى يجب.",
  safety:"الأمان والموثوقية",safetySub:"سلامة البيانات • النسخ والاستعادة • التحذيرات • قرارات أكثر أماناً",journey:"رحلة الحوض كاملة",journeySub:"من أول يوم… إلى سنوات من التاريخ والذاكرة.",
  quality:"تم اختباره والتحقق منه",qualitySub:"تجربة المستخدم • اختبارات شاملة من البداية للنهاية • اختبارات التراجع • سلامة البيانات • النسخ والاستعادة • تعدد الأجهزة • فحوص الإنتاج.",pass:"نجاح 100%",passSub:"آخر اختبارات الإغلاق المستهدفة",dev:"رحلة التطوير",
  creatorLabel:"المؤسس والمطوّر",creator:"صُمم Aqua Nexus من شغف حقيقي بعالم الأحواض، ليجعل إدارة الحوض أسهل وأذكى وأكثر أماناً للجميع.",finalTitle:"حوض أكثر صحة… رحلة أكثر متعة",final:"أكثر من مجرد متابعة للحوض… منظومة متكاملة لإدارته وفهمه.",contact:"تواصل مع المطوّر",
  featuresList:["كيمياء المياه","الكائنات والمرجان","عقل الحوض","الإقلمة","التذكيرات","التقارير","الصيانة","التغذية","الأمراض والعلاج","التجهيزات والمخزون"],
  differentiators:["عقل الحوض","محرك التأثير","سلامة الحوض","ذاكرة الحوض","مصدر واحد للحقيقة","بحري + نهري","رحلة الحوض الكاملة"],
  diffSubs:["عقل واحد يفهم الحوض كاملاً","كل إجراء له تأثير","قرارات أكثر أماناً","حوضك لا ينسى","تاريخ واحد مترابط","عالمان بذكاء واحد","من اليوم الأول إلى سنوات من التاريخ"],
  journeyList:["التجهيز","الدورة البيولوجية","إضافة الكائنات","النمو","الصيانة","المرض","التعافي","سنوات من التاريخ"],
  developmentList:["الفكرة","النموذج الأولي","الوحدات الأساسية","دمج عقل الحوض","طبقة الأمان وحماية البيانات","التكامل","اختبارات مكثفة وإصلاحات","الإصدار التجريبي"],
  connectedList:["الكيمياء","المخزون","الصيانة","التنبيهات","السجل الزمني"],
  qualityTags:["تجربة المستخدم","اختبارات E2E","اختبارات التراجع","سلامة البيانات","النسخ والاستعادة","تعدد الأجهزة","اختبار الإنتاج"]
 },
 en:{
  back:"Back to Aqua Nexus",skip:"Skip",hero:"Two worlds. One intelligent ecosystem.",heroSub:"Marine • Freshwater • One brain that understands the whole aquarium journey",freshwater:"FRESHWATER",marine:"MARINE",
  brain:"Tank Brain",brainSub:"Aquarium data should not live in isolated silos. Aqua Nexus connects health, chemistry, livestock, maintenance and decisions in one context.",features:"Powerful Features for Every Aquarist",
  different:"What Makes Aqua Nexus Different?",connected:"Everything is connected",connectedSub:"One event can flow into chemistry, inventory, maintenance, alerts and timeline — where it matters, when it matters.",
  safety:"Safety & Reliability",safetySub:"Data integrity • Backup & Restore • Warnings • Safer decisions",journey:"The Complete Aquarium Journey",journeySub:"From day one… to years of history and memory.",
  quality:"Tested & Validated",qualitySub:"UX, End-to-End, Regression, Data Integrity, Backup & Restore, cross-device and production validation.",pass:"100% PASS",passSub:"Latest targeted closure tests",dev:"The Development Journey",
  creatorLabel:"CREATOR / FOUNDER",creator:"Aqua Nexus was built out of a real passion for the aquarium hobby — to make it easier, smarter and safer for everyone.",finalTitle:"A Healthier Aquarium. A More Enjoyable Journey.",final:"Not just an aquarium tracker. An aquarium operating system.",contact:"Contact the creator",
  featuresList:["CHEMISTRY","LIVESTOCK & CORAL","TANK BRAIN","ACCLIMATION","REMINDERS","REPORTS","MAINTENANCE","FEEDING","DISEASES & TREATMENT","EQUIPMENT & INVENTORY"],
  differentiators:["TANK BRAIN","IMPACT ENGINE","AQUARIUM SAFETY","AQUARIUM MEMORY","ONE SOURCE OF TRUTH","MARINE + FRESHWATER","COMPLETE AQUARIUM JOURNEY"],
  diffSubs:["ONE BRAIN · WHOLE AQUARIUM","EVERY ACTION HAS CONSEQUENCES","SAFER DECISIONS","YOUR AQUARIUM NEVER FORGETS","ONE CONNECTED HISTORY","TWO WORLDS · ONE INTELLIGENCE","DAY ONE → YEAR TEN"],
  journeyList:["SETUP","CYCLING","LIVESTOCK","GROWTH","MAINTENANCE","DISEASE","RECOVERY","YEARS OF HISTORY"],
  developmentList:["IDEA","PROTOTYPE","CORE MODULES","TANK BRAIN","SAFETY & DATA PROTECTION","INTEGRATION","INTENSIVE TESTING & FIXES","BETA"],
  connectedList:["CHEMISTRY","INVENTORY","MAINTENANCE","ALERTS","TIMELINE"],
  qualityTags:["UX","E2E","REGRESSION","DATA INTEGRITY","BACKUP / RESTORE","CROSS-DEVICE","PRODUCTION"]
 }
} as const;
const sceneCount=10;

export default function AboutPage(){
 const lang=useAquaStore(s=>s.language); const t=copy[lang]; const rtl=lang==="ar";
 const root=useRef<HTMLElement>(null); const [active,setActive]=useState(0); const [auto,setAuto]=useState(true);
 useEffect(()=>{const el=root.current;if(!el)return;const sections=[...el.querySelectorAll<HTMLElement>(".cinema-scene")];const obs=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)setActive(sections.indexOf(e.target as HTMLElement))}),{root:el,threshold:.65});sections.forEach(s=>obs.observe(s));return()=>obs.disconnect()},[]);
 useEffect(()=>{if(!auto||active>=sceneCount-1)return;const id=setTimeout(()=>{const el=root.current?.querySelectorAll<HTMLElement>(".cinema-scene")[active+1];el?.scrollIntoView({behavior:"smooth",block:"start"})},active===0?5200:active===2||active===3?6500:5600);return()=>clearTimeout(id)},[active,auto]);
 const jump=(i:number)=>{setAuto(false);root.current?.querySelectorAll<HTMLElement>(".cinema-scene")[i]?.scrollIntoView({behavior:"smooth",block:"start"})};
 return <main ref={root} className="cinema-about" dir={rtl?"rtl":"ltr"} lang={lang}>
  <Link href="/" className="cinema-back">← {t.back}</Link><button className="cinema-skip" onClick={()=>jump(sceneCount-1)}>{t.skip} ›</button>
  <div className="cinema-progress" aria-hidden="true">{Array.from({length:sceneCount},(_,i)=><button key={i} className={i===active?"on":""} onClick={()=>jump(i)}/>)}</div>
  <section className="cinema-scene hero-scene"><div className="water-world freshwater"><span>🌿</span><small>{t.freshwater}</small></div><div className="aqua-mark"><div className="aqua-orb">AN</div><h1>AQUA NEXUS</h1><h2>{t.hero}</h2><p>{t.heroSub}</p></div><div className="water-world marine"><span>🪸</span><small>{t.marine}</small></div><div className="wave wave-a"/><div className="wave wave-b"/><div className="bubbles"/></section>
  <section className="cinema-scene brain-scene"><div className="brain-halo"/><div className="brain-core"><span>🧠</span><h2>{t.brain}</h2><p>{t.brainSub}</p></div><div className="data-ring">pH · KH · GH · NO₃ · PO₄ · Ca · Mg · {rtl?"الملوحة":"SALINITY"}</div></section>
  <section className="cinema-scene impact-scene"><p className="scene-kicker">{t.features}</p><div className="impact-stack">{t.featuresList.map((x,i)=><div className="impact-word" style={{"--i":i} as React.CSSProperties} key={x}>{x}</div>)}</div></section>
  <section className="cinema-scene difference-scene"><p className="scene-kicker">{t.different}</p><div className="difference-grid">{t.differentiators.map((x,i)=><article key={x} style={{"--i":i} as React.CSSProperties}><b>{x}</b><span>{t.diffSubs[i]}</span></article>)}</div></section>
  <section className="cinema-scene connected-scene"><div className="connection-lines"/><div className="pulse-node">AQUA NEXUS</div>{t.connectedList.map((x,i)=><div key={x} className={`orbit orbit-${i+1}`}>{x}</div>)}<div className="scene-copy"><h2>{t.connected}</h2><p>{t.connectedSub}</p></div></section>
  <section className="cinema-scene safety-scene"><div className="shield-rings"/><div className="shield">🛡️</div><h2>{t.safety}</h2><p>{t.safetySub}</p></section>
  <section className="cinema-scene journey-scene"><h2>{t.journey}</h2><p>{t.journeySub}</p><div className="journey-line">{t.journeyList.map((x,i)=><span style={{"--i":i} as React.CSSProperties} key={x}>{x}</span>)}</div></section>
  <section className="cinema-scene quality-scene"><div className="scanline"/><h2>{t.quality}</h2><p>{t.qualitySub}</p><div className="quality-tags">{t.qualityTags.map(x=><span key={x}>{x}</span>)}</div><div className="pass-badge"><strong>{t.pass}</strong><small>{t.passSub}</small></div></section>
  <section className="cinema-scene development-scene"><h2>{t.dev}</h2><div className="development-flow">{t.developmentList.map((x,i)=><span style={{"--i":i} as React.CSSProperties} key={x}>{x}</span>)}</div></section>
  <section className="cinema-scene creator-scene"><div className="creator-glow"/><small>{t.creatorLabel}</small><h2>Mouaz Mourad</h2><p>{t.creator}</p><a className="creator-contact" href="mailto:mouaz.mourad@gmail.com">{t.contact}</a></section>
  <section className="cinema-scene finale-scene"><div className="final-rays"/><div className="final-worlds"><span>🌿</span><span>🪸</span></div><h1>AQUA NEXUS</h1><h2>{t.finalTitle}</h2><p>{t.final}</p><Link href="/" className="final-button">{t.back}</Link></section>
 </main>
}