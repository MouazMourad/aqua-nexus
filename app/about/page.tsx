"use client";

import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useAquaStore} from "@/store/useAquaStore";
import "../about.css";

const COPY={
 ar:{back:"العودة",skip:"تخطي الفيلم",question:"ماذا لو استطاعت التقنية أن تفهم الحياة؟",connected:"في الحوض… لا شيء يحدث وحده.",mind:"عقل يرى ما وراء الأرقام",mindLines:["لا يسجّل فقط.","يفهم.","يربط.","يتذكر.","يحذّر.","ويقترح الخطوة التالية."],different:"هذا هو Aqua Nexus.",safety:"النصيحة الصحيحة… في الوقت الخطأ، قد تصبح خطأ.",memory:"الحوض يتغير. Aqua Nexus يتذكر.",worlds:"ماء مختلف. حياة مختلفة. عقل واحد.",everywhere:"على مكتبك. في جيبك. بجانب حوضك.",goes:"Aqua Nexus يذهب معك.",built:"لم يُبنَ دفعة واحدة.",evolved:"تعلّم مع كل مشكلة حاولنا حلها.",trust:"قبل أن نطلب منك أن تثق به… حاولنا كسره.",tested:"اختُبر. طُوّر. وتحققنا منه.",used:"استُخدمت ضمن عمليات التطوير والاختبار والتحقق",human:"Aqua Nexus بدأ من سؤال بسيط…",human2:"كيف نجعل العناية بهذا العالم أسهل، أذكى وأكثر أماناً؟",creator:"مبتكر Aqua Nexus",tag:"تقنية تفهم الحياة.",start:"ابدأ رحلتك"},
 en:{back:"Back",skip:"Skip film",question:"What if technology could understand life?",connected:"In an aquarium… nothing happens alone.",mind:"An intelligence beyond the numbers",mindLines:["It doesn't just record.","It understands.","Connects.","Remembers.","Warns.","And suggests what comes next."],different:"This is Aqua Nexus.",safety:"The right advice… at the wrong time can become wrong.",memory:"The aquarium changes. Aqua Nexus remembers.",worlds:"Different water. Different life. One intelligence.",everywhere:"On your desk. In your pocket. Beside your aquarium.",goes:"Aqua Nexus goes with you.",built:"It wasn't built all at once.",evolved:"It evolved with every problem we tried to solve.",trust:"Before asking you to trust it… we tried to break it.",tested:"Tested. Refined. Verified.",used:"Used across development, testing and validation",human:"Aqua Nexus began with a simple question…",human2:"How can caring for this world become easier, smarter and safer?",creator:"Creator of Aqua Nexus",tag:"Technology that understands life.",start:"Start Exploring"}
} as const;

const stages=["IDEA","PROTOTYPE","CORE","TANK BRAIN","IMPACT ENGINE","SAFETY","TESTING","AQUA NEXUS"];
const tests=["E2E","REGRESSION","MOBILE","DESKTOP","ARABIC","ENGLISH","FRESHWATER","MARINE","DATA INTEGRITY","BACKUP","RESTORE"];
const tools=["Playwright","TestSprite","ChatGPT Work","Gemini","GitHub Actions","Vercel"];
const diffs=["TANK BRAIN","IMPACT ENGINE","AQUARIUM MEMORY","SAFETY LAYER","ONE SOURCE OF TRUTH","MARINE + FRESHWATER","COMPLETE JOURNEY"];

export default function AboutPage(){
 const lang=useAquaStore(s=>s.language); const t=COPY[lang]; const rtl=lang==="ar";
 const root=useRef<HTMLElement>(null); const [active,setActive]=useState(0); const [auto,setAuto]=useState(true);
 useEffect(()=>{const r=root.current;if(!r)return;const scenes=[...r.querySelectorAll<HTMLElement>(".film-scene")];const o=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)setActive(scenes.indexOf(e.target as HTMLElement))}),{root:r,threshold:.6});scenes.forEach(s=>o.observe(s));return()=>o.disconnect()},[]);
 const jump=(i:number)=>{setAuto(false);root.current?.querySelectorAll<HTMLElement>(".film-scene")[i]?.scrollIntoView({behavior:"smooth"})};
 useEffect(()=>{if(!auto||active>=11)return;const delay=active===0?9000:6500;const id=setTimeout(()=>root.current?.querySelectorAll<HTMLElement>(".film-scene")[active+1]?.scrollIntoView({behavior:"smooth"}),delay);return()=>clearTimeout(id)},[active,auto]);
 return <main ref={root} className="aqua-film" dir={rtl?"rtl":"ltr"} lang={lang}>
  <div className="film-chrome"><Link href="/" className="film-exit">← {t.back}</Link><button onClick={()=>jump(11)}>{t.skip}</button></div>
  <nav className="film-progress" aria-label="Film scenes">{Array.from({length:12},(_,i)=><button key={i} className={active===i?"on":""} onClick={()=>jump(i)} aria-label={"Scene "+(i+1)}/>)}</nav>

  <section className="film-scene birth">
   <div className="digital-fish"><i/><i/><i/><i/><i/><span className="fish-eye"/></div><div className="data-trail"/>
   <div className="life-growth"><b>⌇</b><b>⌇</b><b>⌇</b><em>✦</em></div>
   <h1>{t.question}</h1>
  </section>

  <section className="film-scene chemistry">
   <div className="drop-world"><span>pH</span><span>KH</span><span>NO₃</span><span>PO₄</span><span>26°</span><div className="ripple-core"/></div>
   <div className="living-chain"><i>🌿</i><b>→</b><i>◌</i><b>→</b><i>𓆟</i><b>→</b><i>◈</i></div><h2>{t.connected}</h2>
  </section>

  <section className="film-scene intelligence">
   <div className="mind-organism"><div className="neural n1"/><div className="neural n2"/><div className="neural n3"/><div className="mind-water"/></div>
   <div className="mind-streams">{["CHEMISTRY","LIVESTOCK","FEEDING","MAINTENANCE","INVENTORY","HEALTH"].map(x=><span key={x}>{x}</span>)}</div>
   <p className="eyebrow">TANK BRAIN · IMPACT ENGINE</p><h2>{t.mind}</h2><div className="mind-copy">{t.mindLines.map(x=><b key={x}>{x}</b>)}</div>
  </section>

  <section className="film-scene nexus">
   <div className="nexus-core"><img src="/aqua-nexus-icon-192.png" alt="Aqua Nexus"/></div>
   <div className="nexus-orbit">{diffs.map((x,i)=><span key={x} style={{"--n":i} as React.CSSProperties}>{x}</span>)}</div><h2>{t.different}</h2>
  </section>

  <section className="film-scene safety">
   <div className="dose"><span className="hand">⌁</span><i className="frozen-drop"/></div><div className="future"><span>KH ↑</span><span>STRESS</span><span>RISK</span></div>
   <div className="rewind">↶</div><h2>{t.safety}</h2>
  </section>

  <section className="film-scene memory">
   <div className="memory-thread"/><div className="memory-fish">𓆟</div><div className="years">{["DAY 1","MONTH 3","YEAR 1","YEAR 3"].map(x=><span key={x}>{x}</span>)}</div>
   <div className="memory-world"><i>·</i><i>♧</i><i>♣</i><i>✦</i></div><h2>{t.memory}</h2>
  </section>

  <section className="film-scene dualworld">
   <div className="fresh-world"><span>🌿</span><i>𓆟</i></div><div className="portal"/><div className="reef-world"><span>◈</span><i>𓆝</i></div><h2>{t.worlds}</h2>
  </section>

  <section className="film-scene devices">
   <div className="device-stage"><div className="screen desktop"><img src="/aqua-nexus-icon-192.png" alt=""/></div><div className="screen tablet"><img src="/aqua-nexus-icon-192.png" alt=""/></div><div className="screen phone"><img src="/aqua-nexus-icon-192.png" alt=""/></div></div>
   <h2>{t.everywhere}</h2><p>{t.goes}</p>
  </section>

  <section className="film-scene evolution">
   <div className="sketch-line"/><div className="stage-flow">{stages.map((x,i)=><span key={x} style={{"--n":i} as React.CSSProperties}>{x}</span>)}</div><h2>{t.built}</h2><p>{t.evolved}</p>
  </section>

  <section className="film-scene lab">
   <div className="lab-object"><img src="/aqua-nexus-icon-192.png" alt="Aqua Nexus"/><div className="scanner"/></div><div className="test-storm">{tests.map((x,i)=><span key={x} style={{"--n":i} as React.CSSProperties}>{x} ✓</span>)}</div>
   <h2>{t.trust}</h2><p>{t.used}</p><div className="tool-line">{tools.map(x=><span key={x}>{x}</span>)}</div><strong className="verified">{t.tested}</strong>
  </section>

  <section className="film-scene human">
   <div className="quiet-tank"><span>𓆟</span><i/></div><p>{t.human}</p><h2>{t.human2}</h2><div className="signature"><strong>Mouaz Mourad</strong><small>{t.creator}</small></div>
  </section>

  <section className="film-scene end">
   <div className="return-fish">𓆟</div><div className="contact-trail"><a href="https://wa.me/963933755977" target="_blank" rel="noreferrer">WhatsApp · 00963933755977</a><a href="mailto:mouaz.mourad@gmail.com">mouaz.mourad@gmail.com</a><a href="https://github.com/MouazMourad" target="_blank" rel="noreferrer">GitHub · MouazMourad</a></div>
   <div className="brand-lockup"><img src="/aqua-nexus-icon-192.png" alt="Aqua Nexus"/><h1>AQUA NEXUS</h1><p>{t.tag}</p><Link href="/">{t.start} →</Link></div>
  </section>
 </main>
}