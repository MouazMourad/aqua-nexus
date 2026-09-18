"use client";

import { useEffect,useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { Modal } from "@/components/ui/Modal";
import { useAquaStore } from "@/store/useAquaStore";

type Difficulty="beginner"|"intermediate"|"advanced";
type Choice={ar:string;en:string;points:number;healthDelta:number;feedbackAr:string;feedbackEn:string};
type Scenario={id:string;difficulty:Difficulty;titleAr:string;titleEn:string;promptAr:string;promptEn:string;maxPoints:number;choices:Choice[]};

const SCENARIOS:Record<Tank["type"],Scenario[]>={
 marine:[
  {id:"m1",difficulty:"beginner",titleAr:"المغذيات ترتفع",titleEn:"Nutrients are rising",promptAr:"NO3 = 35 ppm و PO4 = 0.25، والكائنات تبدو مستقرة. شو أول تصرف أفضل؟",promptEn:"NO3 is 35 ppm and PO4 is 0.25 while livestock looks stable. What is the best first move?",maxPoints:120,choices:[
   {ar:"أكد القياسات وفتش عن مصدر عضوي أو صيانة متأخرة قبل أي تصحيح كبير",en:"Confirm the readings and inspect for organic buildup or overdue maintenance before a major correction",points:120,healthDelta:3,feedbackAr:"ممتاز. التشخيص قبل التصحيح يمنع مطاردة الأرقام.",feedbackEn:"Excellent. Diagnose first instead of chasing numbers."},
   {ar:"غيّر 70% من الماء فوراً",en:"Immediately change 70% of the water",points:35,healthDelta:-5,feedbackAr:"تغيير كبير قد يسبب تقلبات غير لازمة إذا ما كانت الحالة طارئة.",feedbackEn:"A very large change can create unnecessary instability when this is not an emergency."},
   {ar:"زد التغذية حتى ما تتوتر الأسماك",en:"Increase feeding so the fish do not get stressed",points:0,healthDelta:-12,feedbackAr:"هاد غالباً يزيد الحمل العضوي والمغذيات.",feedbackEn:"That usually increases organics and nutrients."}
  ]},
  {id:"m2",difficulty:"beginner",titleAr:"KH عم ينخفض",titleEn:"KH is dropping",promptAr:"KH نزل من 8.0 إلى 6.5 خلال أسبوع. شو المنهج الصح؟",promptEn:"KH fell from 8.0 to 6.5 over one week. What is the right approach?",maxPoints:120,choices:[
   {ar:"أعد الفحص، راجع الاستهلاك والجرعات، وصحح تدريجياً",en:"Retest, review consumption/dosing, and correct gradually",points:120,healthDelta:4,feedbackAr:"صح. الثبات أهم من القفزة السريعة نحو رقم مثالي.",feedbackEn:"Correct. Stability matters more than a rapid jump to an ideal number."},
   {ar:"ارفع KH دفعة واحدة إلى 10",en:"Raise KH to 10 in one dose",points:10,healthDelta:-14,feedbackAr:"التصحيح السريع ممكن يكون أخطر من الانخفاض نفسه.",feedbackEn:"A rapid correction can be more harmful than the low value itself."},
   {ar:"اتركه أسبوعين بدون إعادة فحص",en:"Leave it for two weeks without retesting",points:25,healthDelta:-7,feedbackAr:"بدك تأكيد للترند قبل ما يزداد الانحراف.",feedbackEn:"You need to confirm the trend before the deviation grows."}
  ]},
  {id:"m3",difficulty:"intermediate",titleAr:"الملوحة نزلت",titleEn:"Salinity dropped",promptAr:"الملوحة صارت 1.020 بعد مشكلة ATO. شو الأولوية؟",promptEn:"Salinity dropped to 1.020 after an ATO issue. What is the priority?",maxPoints:160,choices:[
   {ar:"أكد القياس بجهاز معاير، أصلح سبب الـATO، وارفع الملوحة تدريجياً",en:"Confirm with a calibrated instrument, fix the ATO cause, and raise salinity gradually",points:160,healthDelta:5,feedbackAr:"ممتاز: تأكيد السبب + تصحيح تدريجي.",feedbackEn:"Excellent: confirm the cause and correct gradually."},
   {ar:"أضف ملح جاف مباشرة للحوض",en:"Add dry salt directly to the display",points:0,healthDelta:-18,feedbackAr:"إضافة الملح الجاف للحوض مباشرة ممكن تؤذي الكائنات وتعمل مناطق شديدة التركيز.",feedbackEn:"Adding dry salt directly can create dangerous local concentration spikes."},
   {ar:"ركز فقط على الرقم واترك مشكلة ATO لبعدين",en:"Focus only on the number and deal with the ATO later",points:45,healthDelta:-8,feedbackAr:"إذا ما عالجت السبب، المشكلة رح تتكرر.",feedbackEn:"If you do not fix the cause, the problem will repeat."}
  ]},
  {id:"m4",difficulty:"intermediate",titleAr:"مرجان مات وNO3 ارتفع",titleEn:"A coral died and NO3 rose",promptAr:"لقيت مرجان ميت وNO3 ارتفع بسرعة. شو أفضل ترتيب؟",promptEn:"You find a dead coral and NO3 has risen quickly. What is the best order of action?",maxPoints:160,choices:[
   {ar:"أزل النسيج الميت، نظف الفلترة الميكانيكية، أكد القياسات وراقب الاتجاه",en:"Remove dead tissue, clean mechanical filtration, confirm readings, and monitor the trend",points:160,healthDelta:6,feedbackAr:"صح. إزالة المصدر العضوي أولاً تعالج السبب مو بس الرقم.",feedbackEn:"Correct. Removing the organic source addresses the cause, not just the number."},
   {ar:"أضف عدة مواد خافضة للنيترات والفوسفات مع بعض",en:"Add several nitrate/phosphate reducers at once",points:25,healthDelta:-12,feedbackAr:"تكديس تدخلات متعددة بيصعب معرفة السبب وقد يعمل تقلبات.",feedbackEn:"Stacking multiple interventions hides the cause and can destabilize the system."},
   {ar:"ما تعمل شي لأن النيترات مو قاتل فوراً",en:"Do nothing because nitrate is not immediately lethal",points:40,healthDelta:-7,feedbackAr:"وجود كائن ميت مصدر عضوي لازم ينشال فوراً.",feedbackEn:"A dead organism is an active organic source and should be removed."}
  ]},
  {id:"m5",difficulty:"advanced",titleAr:"توقف مضخة الرجوع",titleEn:"Return pump failure",promptAr:"مضخة الرجوع توقفت فجأة. شو أول أولوية تشغيلية؟",promptEn:"The return pump suddenly stops. What is the first operational priority?",maxPoints:220,choices:[
   {ar:"وفر أكسجة/حركة سطح بديلة وافصل المضخة بأمان قبل فحصها",en:"Provide alternate aeration/surface movement and disconnect the pump safely before inspection",points:220,healthDelta:8,feedbackAr:"ممتاز. دعم الحياة أولاً ثم فحص العطل بأمان.",feedbackEn:"Excellent. Life support first, then safe troubleshooting."},
   {ar:"فك المضخة وهي موصولة حتى ما يضيع وقت",en:"Open the pump while it is still powered to save time",points:0,healthDelta:-25,feedbackAr:"هاد خطر كهربائي ومائي وما بصير.",feedbackEn:"That creates an electrical/water safety hazard."},
   {ar:"انتظر ساعة وشوف إذا رجعت لحالها",en:"Wait an hour to see if it restarts",points:20,healthDelta:-15,feedbackAr:"الدوران والأكسجة ممكن يتدهوروا بسرعة.",feedbackEn:"Circulation and oxygen can deteriorate quickly."}
  ]},
  {id:"m6",difficulty:"advanced",titleAr:"أمونيا بعد إضافة كائنات",titleEn:"Ammonia after livestock addition",promptAr:"بعد إضافة كائنات جديدة ظهر NH3 واضح. شو خطة الأولوية الأفضل؟",promptEn:"After adding new livestock, measurable NH3 appears. What is the best priority plan?",maxPoints:220,choices:[
   {ar:"أكد الفحص، زِد الأكسجة، أوقف/خفف التغذية، ابحث عن السبب واعمل تغيير ماء مناسب",en:"Confirm the test, increase aeration, pause/reduce feeding, find the cause, and perform an appropriate water change",points:220,healthDelta:9,feedbackAr:"ممتاز. هاي استجابة مرتبة حسب الخطر والسبب.",feedbackEn:"Excellent. That response prioritizes risk and root cause."},
   {ar:"ضيف سمك جديد لتنشط البكتيريا",en:"Add more fish to stimulate bacteria",points:0,healthDelta:-25,feedbackAr:"هاد يزيد الحمل والمشكلة.",feedbackEn:"That increases bioload and makes the problem worse."},
   {ar:"غير كل الميديا البيولوجية دفعة واحدة",en:"Replace all biological media at once",points:15,healthDelta:-22,feedbackAr:"هيك ممكن تخسر جزء كبير من البكتيريا النافعة.",feedbackEn:"That can remove much of the beneficial biological filtration."}
  ]}
 ],
 freshwater:[
  {id:"f1",difficulty:"beginner",titleAr:"NO3 عم يرتفع",titleEn:"NO3 is rising",promptAr:"NO3 وصل 35 ppm والحوض مستقر. شو أول خطوة أفضل؟",promptEn:"NO3 reached 35 ppm while the tank is stable. What is the best first step?",maxPoints:120,choices:[
   {ar:"أكد القياس وراجع التغذية والفلترة والصيانة ثم خطط لتغيير ماء مناسب",en:"Confirm the reading, review feeding/filtration/maintenance, then plan an appropriate water change",points:120,healthDelta:3,feedbackAr:"ممتاز. بلشت بالسبب قبل مطاردة الرقم.",feedbackEn:"Excellent. You started with the cause before chasing the number."},
   {ar:"نظف كل الفلتر والبيوميديا بماء الحنفية",en:"Clean all filter media under tap water",points:0,healthDelta:-18,feedbackAr:"هيك ممكن تضرب البكتيريا النافعة.",feedbackEn:"That can damage the beneficial bacteria."},
   {ar:"زِد الأكل لتقوية السمك",en:"Increase feeding to strengthen the fish",points:15,healthDelta:-10,feedbackAr:"هاد غالباً يزيد النترات أكثر.",feedbackEn:"That usually increases nitrate further."}
  ]},
  {id:"f2",difficulty:"beginner",titleAr:"حرارة مرتفعة",titleEn:"High temperature",promptAr:"الحرارة صارت 29.5°C والأسماك تتنفس أسرع. شو الأولوية؟",promptEn:"Temperature reached 29.5°C and fish are breathing faster. What is the priority?",maxPoints:120,choices:[
   {ar:"أكد الحرارة، زِد حركة السطح والأكسجة، وافحص السخان",en:"Confirm temperature, increase surface movement/aeration, and inspect the heater",points:120,healthDelta:5,feedbackAr:"صح. الأكسجة والسلامة أولاً مع تصحيح تدريجي.",feedbackEn:"Correct. Oxygenation and safety come first, with gradual correction."},
   {ar:"حط ثلج كثير مباشرة بالحوض",en:"Add a large amount of ice directly to the tank",points:0,healthDelta:-20,feedbackAr:"الهبوط السريع بالحرارة ممكن يعمل صدمة.",feedbackEn:"A rapid temperature drop can cause shock."},
   {ar:"اطفِ الفلتر لحتى ما يسخن الماء أكتر",en:"Turn off the filter so it does not warm the water",points:20,healthDelta:-12,feedbackAr:"إيقاف الدوران ممكن يزيد مشكلة الأكسجة.",feedbackEn:"Stopping circulation can worsen oxygen problems."}
  ]},
  {id:"f3",difficulty:"intermediate",titleAr:"أمونيا ونتريت",titleEn:"Ammonia and nitrite",promptAr:"NH3 وNO2 ظهروا بعد زيادة مفاجئة بالأسماك. شو أفضل تصرف؟",promptEn:"NH3 and NO2 appear after a sudden livestock increase. What is the best response?",maxPoints:160,choices:[
   {ar:"أكد الاختبار، زِد الأكسجة، خفف التغذية، راجع الحمل والفلتر واعمل تغيير ماء مناسب",en:"Confirm the test, increase aeration, reduce feeding, review bioload/filter, and perform an appropriate water change",points:160,healthDelta:6,feedbackAr:"ممتاز. عم تتعامل مع الخطر والسبب مع بعض.",feedbackEn:"Excellent. You are addressing both the immediate risk and the cause."},
   {ar:"بدل كل البيوميديا بواحدة جديدة",en:"Replace all biological media with new media",points:10,healthDelta:-20,feedbackAr:"هاد ممكن يزيد انهيار الدورة.",feedbackEn:"That can further destabilize the biological cycle."},
   {ar:"زِد الأسماك لأن الحوض كبير",en:"Add more fish because the tank is large",points:0,healthDelta:-22,feedbackAr:"الحجم ما بيعوض خلل الدورة البيولوجية.",feedbackEn:"Tank size does not compensate for biological-cycle failure."}
  ]},
  {id:"f4",difficulty:"intermediate",titleAr:"فلتر متراجع الأداء",titleEn:"Filter performance dropped",promptAr:"التدفق ضعُف والماء بدأ يتعكر. شو المنهج الأفضل؟",promptEn:"Flow has dropped and the water is becoming cloudy. What is the best approach?",maxPoints:160,choices:[
   {ar:"حافظ على الأكسجة، افحص الانسداد ونظف ميكانيكياً بدون تخريب البيوميديا",en:"Maintain aeration, inspect blockage, and clean mechanical sections without stripping biological media",points:160,healthDelta:6,feedbackAr:"صح. بتحل الانسداد وتحافظ على الاستقرار البيولوجي.",feedbackEn:"Correct. You restore flow while preserving biological stability."},
   {ar:"اغسل كل الوسائط بالماء الساخن",en:"Wash all media in hot water",points:0,healthDelta:-22,feedbackAr:"هاد يدمر القسم البيولوجي تقريباً.",feedbackEn:"That can destroy much of the biological filtration."},
   {ar:"سكر الفلتر يوم كامل",en:"Leave the filter off for a full day",points:20,healthDelta:-14,feedbackAr:"الركود ونقص الأكسجة ممكن يزيدوا الوضع سوءاً.",feedbackEn:"Stagnation and low oxygen can worsen the situation."}
  ]},
  {id:"f5",difficulty:"advanced",titleAr:"مرض أم مشكلة ماء؟",titleEn:"Disease or water problem?",promptAr:"عدة أسماك عم تتنفس بسرعة بنفس الوقت. شو أول فحص؟",promptEn:"Several fish begin breathing rapidly at the same time. What should you check first?",maxPoints:220,choices:[
   {ar:"الأكسجة والحرارة والأمونيا/النتريت قبل افتراض مرض معدٍ",en:"Check oxygenation, temperature, ammonia, and nitrite before assuming an infectious disease",points:220,healthDelta:8,feedbackAr:"ممتاز. الأعراض الجماعية المفاجئة ممكن تكون بيئية.",feedbackEn:"Excellent. Sudden group symptoms can be environmental."},
   {ar:"حط أدوية متعددة بالحوض مباشرة",en:"Add several medications to the display immediately",points:0,healthDelta:-24,feedbackAr:"العلاج العشوائي ممكن يخفي السبب ويعمل ضرر إضافي.",feedbackEn:"Blind medication can hide the cause and create additional harm."},
   {ar:"طعم أكتر لتقوية المناعة",en:"Feed more to boost immunity",points:15,healthDelta:-12,feedbackAr:"قبل أي شي لازم تستبعد مشكلة ماء أو أكسجة.",feedbackEn:"Water quality and oxygen problems need to be ruled out first."}
  ]},
  {id:"f6",difficulty:"advanced",titleAr:"انقطاع كهرباء",titleEn:"Power outage",promptAr:"الكهرباء انقطعت وما بتعرف قديش رح تطول. شو الأولوية؟",promptEn:"Power is out and you do not know how long it will last. What is the priority?",maxPoints:220,choices:[
   {ar:"أمّن أكسجة/حركة سطح ببطارية أو يدوياً، قلل التغذية وراقب الحرارة",en:"Provide battery/manual aeration or surface movement, reduce feeding, and monitor temperature",points:220,healthDelta:9,feedbackAr:"ممتاز. الأكسجين أولاً ثم الحرارة واستعادة الدوران بأمان.",feedbackEn:"Excellent. Oxygen first, then temperature and safe circulation recovery."},
   {ar:"ضيف جرعة بكتيريا كبيرة",en:"Add a large bacteria dose",points:20,healthDelta:-10,feedbackAr:"المشكلة الأساسية هون دعم الحياة، مو إضافة مواد.",feedbackEn:"The main issue is life support, not adding products."},
   {ar:"غطي الحوض بإحكام كامل",en:"Seal the aquarium completely",points:0,healthDelta:-20,feedbackAr:"الإغلاق الكامل ممكن يزيد مشكلة تبادل الغازات.",feedbackEn:"Sealing the aquarium can worsen gas exchange."}
  ]}
 ]
};

const diffLabel={beginner:{ar:"مبتدئ",en:"Beginner"},intermediate:{ar:"متوسط",en:"Intermediate"},advanced:{ar:"متقدم",en:"Advanced"}};

function rank(score:number){
 if(score>=900)return{ar:"خبير أنظمة مائية",en:"Master System Keeper"};
 if(score>=800)return{ar:"هاوي متقدم",en:"Advanced Aquarist"};
 if(score>=650)return{ar:"هاوي ماهر",en:"Skilled Aquarist"};
 if(score>=400)return{ar:"ممارس جيد",en:"Aquarium Keeper"};
 return{ar:"مبتدئ",en:"Beginner Keeper"};
}

export function TrainingChallenge({tank,open,onClose}:{tank:Tank;open:boolean;onClose:()=>void}){
 const lang=useAquaStore(s=>s.language);
 const scenarios=SCENARIOS[tank.type];
 const maxScore=useMemo(()=>scenarios.reduce((s,x)=>s+x.maxPoints,0),[scenarios]);
 const key=`aqua-challenge-best:${tank.type}`;
 const [index,setIndex]=useState(0),[score,setScore]=useState(0),[health,setHealth]=useState(92),[selected,setSelected]=useState<number|null>(null),[finished,setFinished]=useState(false),[best,setBest]=useState(0),[shareNote,setShareNote]=useState("");

 useEffect(()=>{if(typeof window!=="undefined")setBest(Number(localStorage.getItem(key)||0)||0)},[key]);
 useEffect(()=>{if(open){setIndex(0);setScore(0);setHealth(92);setSelected(null);setFinished(false);setShareNote("");}},[open]);

 const scenario=scenarios[index];
 const currentDifficulty=scenario?.difficulty??"beginner";

 function choose(choiceIndex:number){
  if(selected!==null||finished)return;
  const choice=scenario.choices[choiceIndex];
  setSelected(choiceIndex);
  setScore(v=>v+choice.points);
  setHealth(v=>Math.max(20,Math.min(100,v+choice.healthDelta)));
 }

 function next(){
  if(index>=scenarios.length-1){
   const finalScore=score;
   setFinished(true);
   if(finalScore>best){
    setBest(finalScore);
    if(typeof window!=="undefined")localStorage.setItem(key,String(finalScore));
   }
   return;
  }
  setIndex(v=>v+1);setSelected(null);
 }

 async function shareResult(){
  const r=rank(score);
  const text=lang==="ar"
   ?`Aqua Nexus Challenge — ${tank.type==="marine"?"Marine":"Freshwater"}\nالنتيجة: ${score}/${maxScore}\nصحة الحوض النهائية: ${health}%\nالرتبة: ${r.ar}\nبتقدر تتغلب على نتيجتي؟`
   :`Aqua Nexus Challenge — ${tank.type==="marine"?"Marine":"Freshwater"}\nScore: ${score}/${maxScore}\nFinal tank health: ${health}%\nRank: ${r.en}\nCan you beat my score?`;
  try{
   if(navigator.share)await navigator.share({title:"Aqua Nexus Challenge",text,url:window.location.href});
   else{await navigator.clipboard.writeText(`${text}\n${window.location.href}`);setShareNote(lang==="ar"?"تم نسخ النتيجة للمشاركة.":"Result copied for sharing.");}
  }catch{}
 }

 if(!open)return null;
 const resultRank=rank(score);
 const progress=finished?100:Math.round((index/scenarios.length)*100);

 return <Modal open={open} title={lang==="ar"?"Aqua Nexus Challenge Mode":"Aqua Nexus Challenge Mode"} onClose={onClose}>
  <div className="challenge-shell">
   {!finished?<>
    <div className="challenge-top">
     <div><small>{lang==="ar"?"المستوى":"LEVEL"} {index+1}/{scenarios.length}</small><b>{lang==="ar"?diffLabel[currentDifficulty].ar:diffLabel[currentDifficulty].en}</b></div>
     <div className="challenge-live"><span>{lang==="ar"?"النقاط":"Score"} <b>{score}</b></span><span>{lang==="ar"?"صحة الحوض":"Tank Health"} <b>{health}%</b></span></div>
    </div>
    <div className="challenge-progress"><i style={{width:`${progress}%`}}/></div>
    <section className="challenge-case">
     <small>{lang==="ar"?scenario.titleAr:scenario.titleEn}</small>
     <h2>{lang==="ar"?scenario.promptAr:scenario.promptEn}</h2>
     <div className="challenge-choices">
      {scenario.choices.map((choice,i)=>{
       const active=selected===i;
       return <button type="button" key={i} disabled={selected!==null} className={`challenge-choice ${active?"selected":""} ${active?(choice.points===scenario.maxPoints?"correct":choice.points===0?"bad":"partial"):""}`} onClick={()=>choose(i)}>
        <span>{String.fromCharCode(65+i)}</span><b>{lang==="ar"?choice.ar:choice.en}</b>{active&&<em>+{choice.points}</em>}
       </button>
      })}
     </div>
     {selected!==null&&<div className={`challenge-feedback ${scenario.choices[selected].points===scenario.maxPoints?"good":scenario.choices[selected].points===0?"danger":"warn"}`}>
      <b>{scenario.choices[selected].points===scenario.maxPoints?(lang==="ar"?"قرار ممتاز":"Excellent decision"):(lang==="ar"?"شوف أثر القرار":"See the consequence")}</b>
      <span>{lang==="ar"?scenario.choices[selected].feedbackAr:scenario.choices[selected].feedbackEn}</span>
      <small>{lang==="ar"?"تأثير الصحة":"Health impact"}: {scenario.choices[selected].healthDelta>0?"+":""}{scenario.choices[selected].healthDelta}</small>
     </div>}
    </section>
    <div className="challenge-footer">
     <span>{lang==="ar"?`أفضل نتيجة سابقة: ${best || "—"}`:`Personal best: ${best || "—"}`}</span>
     <button className="btn primary" disabled={selected===null} onClick={next}>{index===scenarios.length-1?(lang==="ar"?"عرض النتيجة":"See result"):(lang==="ar"?"المرحلة التالية":"Next stage")} →</button>
    </div>
   </>:<>
    <section className="challenge-result">
     <div className="challenge-trophy">🏆</div>
     <small>AQUA NEXUS CHALLENGE</small>
     <h2>{lang==="ar"?resultRank.ar:resultRank.en}</h2>
     <div className="challenge-final-score">{score}<span>/ {maxScore}</span></div>
     <div className="challenge-result-grid">
      <div><small>{lang==="ar"?"صحة الحوض النهائية":"Final tank health"}</small><b>{health}%</b></div>
      <div><small>{lang==="ar"?"أفضل نتيجة":"Personal best"}</small><b>{Math.max(best,score)}</b></div>
      <div><small>{lang==="ar"?"نوع التحدي":"Challenge"}</small><b>{tank.type==="marine"?"Marine":"Freshwater"}</b></div>
     </div>
     <p>{lang==="ar"?"شارك نتيجتك وخلي غيرك يحاول يتغلب عليها.":"Share your result and challenge someone else to beat it."}</p>
     <div className="challenge-result-actions"><button className="btn primary" onClick={shareResult}>↗ {lang==="ar"?"شارك النتيجة":"Share result"}</button><button className="btn" onClick={()=>{setIndex(0);setScore(0);setHealth(92);setSelected(null);setFinished(false);}} >↺ {lang==="ar"?"أعد التحدي":"Retry"}</button></div>
     {shareNote&&<small className="share-note">{shareNote}</small>}
    </section>
   </>}
  </div>
  <style jsx>{`
   .challenge-shell{display:grid;gap:12px;min-width:min(760px,78vw);max-width:820px}.challenge-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.challenge-top>div:first-child small,.challenge-top>div:first-child b{display:block}.challenge-top small{font-size:9px;letter-spacing:.12em;opacity:.55}.challenge-top>div:first-child b{margin-top:2px;color:#65e5d9}.challenge-live{display:flex;gap:8px;flex-wrap:wrap}.challenge-live span{padding:6px 9px;border-radius:999px;background:rgba(255,255,255,.04);font-size:10px}.challenge-live b{color:#65e5d9}
   .challenge-progress{height:6px;border-radius:999px;background:rgba(255,255,255,.05);overflow:hidden}.challenge-progress i{display:block;height:100%;background:linear-gradient(90deg,#45d3c5,#70e5b0);transition:width .25s ease}
   .challenge-case{padding:14px;border-radius:16px;border:1px solid rgba(101,229,217,.14);background:rgba(255,255,255,.025)}.challenge-case>small{color:#65e5d9;font-weight:900}.challenge-case h2{font-size:18px;line-height:1.55;margin:5px 0 14px}.challenge-choices{display:grid;gap:8px}.challenge-choice{display:grid;grid-template-columns:32px 1fr auto;gap:9px;align-items:center;width:100%;padding:10px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.025);color:inherit;border-radius:13px;text-align:start;cursor:pointer}.challenge-choice:not(:disabled):hover{border-color:rgba(101,229,217,.3);background:rgba(101,229,217,.05)}.challenge-choice>span{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:rgba(101,229,217,.08);color:#65e5d9;font-weight:900}.challenge-choice b{font-size:12px;line-height:1.45}.challenge-choice em{font-size:10px;font-style:normal;font-weight:900}.challenge-choice.correct{border-color:rgba(117,230,176,.4);background:rgba(117,230,176,.08)}.challenge-choice.bad{border-color:rgba(255,95,109,.38);background:rgba(255,95,109,.07)}.challenge-choice.partial{border-color:rgba(255,200,90,.38);background:rgba(255,200,90,.07)}
   .challenge-feedback{margin-top:10px;padding:10px 11px;border-radius:12px;display:grid;gap:3px;font-size:11px}.challenge-feedback.good{background:rgba(117,230,176,.08);border:1px solid rgba(117,230,176,.22)}.challenge-feedback.warn{background:rgba(255,200,90,.08);border:1px solid rgba(255,200,90,.22)}.challenge-feedback.danger{background:rgba(255,95,109,.08);border:1px solid rgba(255,95,109,.22)}.challenge-feedback span{opacity:.78;line-height:1.5}.challenge-feedback small{opacity:.58}
   .challenge-footer{display:flex;justify-content:space-between;align-items:center;gap:12px}.challenge-footer>span{font-size:10px;opacity:.5}
   .challenge-result{text-align:center;padding:8px 4px 2px}.challenge-trophy{font-size:48px}.challenge-result>small{letter-spacing:.15em;color:#65e5d9;font-weight:900}.challenge-result h2{font-size:22px;margin:4px 0}.challenge-final-score{font-size:48px;font-weight:950;color:#65e5d9;line-height:1}.challenge-final-score span{font-size:16px;opacity:.5}.challenge-result-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:16px 0}.challenge-result-grid>div{padding:10px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}.challenge-result-grid small,.challenge-result-grid b{display:block}.challenge-result-grid small{font-size:9px;opacity:.55}.challenge-result-grid b{font-size:16px;margin-top:3px}.challenge-result p{font-size:11px;opacity:.65}.challenge-result-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.share-note{display:block;margin-top:8px;color:#75e6b0}
   @media(max-width:760px){.challenge-shell{min-width:0;width:100%}.challenge-top{align-items:flex-start;flex-direction:column}.challenge-case h2{font-size:16px}.challenge-choice{grid-template-columns:30px 1fr auto}.challenge-result-grid{grid-template-columns:1fr}.challenge-footer{align-items:stretch;flex-direction:column-reverse}.challenge-footer .btn{width:100%}}
  `}</style>
 </Modal>;
}
