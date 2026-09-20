import type { Tank } from "./types";
import { biologicalCycleStatus } from "./biologicalCycle";

export type CycleKnowledgeSeverity="info"|"warn"|"danger";

export interface CycleKnowledgeIssue{
  id:string;
  severity:CycleKnowledgeSeverity;
  ar:string;
  en:string;
  actionAr:string;
  actionEn:string;
}

export interface CycleKnowledgeAnswer{
  titleAr:string;
  titleEn:string;
  summaryAr:string;
  summaryEn:string;
  detailsAr:string[];
  detailsEn:string[];
  evidenceAr:string[];
  evidenceEn:string[];
  actionPage:"chemistry"|"maintenance"|"equipment"|"rodi";
}

const DAY=86400000;

function normalize(value:string){
  return (value||"").toLowerCase().normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g,"")
    .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/ؤ/g,"و").replace(/ئ/g,"ي")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g," ").replace(/\s+/g," ").trim();
}
function measuredReadings(tank:Tank){
  return tank.chemistry.filter(x=>!x.usingDefaults).slice().sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
}
function value(tank:Tank,key:string){
  const v=measuredReadings(tank)[0]?.values?.[key];
  return typeof v==="number"&&Number.isFinite(v)?v:null;
}
function trend(tank:Tank,key:string){
  const vals=measuredReadings(tank).slice(0,3).map(x=>x.values?.[key]).filter((x):x is number=>typeof x==="number"&&Number.isFinite(x));
  if(vals.length<2)return null;
  return vals[0]-vals[vals.length-1];
}
function coreEquipmentWarning(tank:Tank){
  return tank.equipment.some(x=>["warning","service"].includes(x.status)&&["returnPump","overflow","heater","filter"].includes(String(x.kind)));
}

export function biologicalCycleKnowledgeSnapshot(tank:Tank){
  const state=biologicalCycleStatus(tank);
  const nh3=value(tank,"NH3"),no2=value(tank,"NO2"),no3=value(tank,"NO3"),ph=value(tank,"pH"),temperature=value(tank,"temperature");
  const nh3Trend=trend(tank,"NH3");
  const issues:CycleKnowledgeIssue[]=[];

  if(!state.sourceAdded)issues.push({
    id:"no-source",severity:"warn",
    ar:"ما في مصدر أمونيا مسجل للدورة.",
    en:"No ammonia source is recorded for the cycle.",
    actionAr:"ابدأ Fishless Cycling وسجّل مصدر الأمونيا بدل استخدام أسماك كحمل تجريبي.",
    actionEn:"Start a fishless cycle and record the ammonia source instead of using fish as a test load."
  });

  if(state.sourceAdded&&state.day>=7&&!state.processingEvidence)issues.push({
    id:"no-processing",severity:"warn",
    ar:"مرّ أسبوع أو أكثر بدون دليل واضح أن المعالجة البيولوجية بدأت.",
    en:"A week or more has passed without clear evidence of biological processing.",
    actionAr:"أكد الاختبارات وافحص pH والحرارة واستمرار الفلترة والأكسجة ومصدر الماء والكلور قبل إضافة أي جرعات جديدة.",
    actionEn:"Confirm the tests, then check pH, temperature, continuous filtration/oxygenation and source-water treatment before adding more ammonia."
  });

  if(nh3!==null&&nh3>4)issues.push({
    id:"ammonia-too-high",severity:"danger",
    ar:"الأمونيا مرتفعة جداً للدورة ("+nh3+" ppm).",
    en:"Ammonia is very high for cycling ("+nh3+" ppm).",
    actionAr:"لا تضف أمونيا إضافية. أكد القراءة، وإذا بقيت عالية جداً خفّضها تدريجياً بماء مجهز بدون كلور مع بقاء الفلتر والميديا رطبة وشغالة.",
    actionEn:"Do not add more ammonia. Confirm the reading; if it remains excessive, reduce it gradually with properly conditioned water while keeping the biofilter wet and running."
  });

  if(state.sourceAdded&&state.day>=7&&nh3!==null&&nh3>0.02&&nh3Trend!==null&&Math.abs(nh3Trend)<0.05)issues.push({
    id:"ammonia-stalled",severity:"warn",
    ar:"الأمونيا شبه ثابتة عبر القراءات الأخيرة؛ ممكن تكون الدورة متوقفة أو القياس/البيئة بحاجة مراجعة.",
    en:"Ammonia is nearly flat across recent readings; the cycle may be stalled or the test/environment may need review.",
    actionAr:"راجع دقة الاختبار وpH والحرارة والأكسجة والتدفق وتأكد أن مياه التعويض أو التغيير ما فيها كلور أو كلورامين.",
    actionEn:"Review test accuracy, pH, temperature, oxygenation and flow, and verify that top-off/change water is free of chlorine/chloramine."
  });

  if(tank.type==="freshwater"&&no2!==null&&no2>0.05&&nh3!==null&&nh3<=0.02)issues.push({
    id:"nitrite-phase",severity:"info",
    ar:"الأمونيا انخفضت لكن NO2 ما زال موجود؛ هاي غالباً مرحلة النتريت الطبيعية.",
    en:"Ammonia is down but NO2 remains; this is commonly the normal nitrite phase.",
    actionAr:"استمر بالأكسجة والفلترة والفحص، ولا تضف أسماك حتى يصل NO2 للصفر العملي ويتأكد بقياس لاحق.",
    actionEn:"Keep filtration and oxygenation running, continue testing, and do not add fish until NO2 reaches practical zero and is confirmed."
  });

  if(ph!==null&&((tank.type==="marine"&&ph<7.8)||(tank.type==="freshwater"&&ph<6.5)))issues.push({
    id:"low-ph",severity:"warn",
    ar:"pH منخفض للدورة ("+ph+") وقد يبطئ نشاط البكتيريا الآزوتية.",
    en:"pH is low for cycling ("+ph+") and may slow nitrification.",
    actionAr:"أكد pH وKH، حسّن التهوية إذا لزم، وصحح السبب تدريجياً بدون مطاردة رقم سريع.",
    actionEn:"Confirm pH and KH, improve aeration if needed, and correct the cause gradually rather than chasing a number."
  });

  if(temperature!==null&&(temperature<20||temperature>31))issues.push({
    id:"temperature",severity:"warn",
    ar:"الحرارة الحالية ("+temperature+"°C) بعيدة عن المجال المريح عادةً للبكتيريا الآزوتية.",
    en:"Current temperature ("+temperature+"°C) is outside the range usually comfortable for nitrifying bacteria.",
    actionAr:"ثبّت الحرارة ضمن مجال مناسب لنوع الحوض وحافظ على أكسجة جيدة.",
    actionEn:"Stabilize temperature within an appropriate range for the tank type and maintain good oxygenation."
  });

  if(coreEquipmentWarning(tank))issues.push({
    id:"equipment-flow",severity:"danger",
    ar:"في تحذير على جهاز أساسي للدوران أو الفلترة أثناء الدورة.",
    en:"A core circulation or filtration device is in a warning state during cycling.",
    actionAr:"أولوية فورية: رجّع التدفق والأكسجة وحافظ على الميديا مغمورة أو رطبة قبل أي خطوة كيميائية.",
    actionEn:"Immediate priority: restore flow and oxygenation and keep media submerged or wet before making chemistry changes."
  });

  if(no3===0&&state.processingEvidence)issues.push({
    id:"zero-nitrate",severity:"info",
    ar:"NO3 صفر لا يعني لحاله إن الدورة فشلت.",
    en:"Zero NO3 alone does not prove the cycle failed.",
    actionAr:"اعتمد على تسلسل القراءات وإثبات معالجة الأمونيا، وبالنهري النتريت أيضاً، بدل شرط ظهور NO3 لوحده.",
    actionEn:"Use the full reading sequence and demonstrated ammonia processing, plus nitrite clearance in freshwater, rather than requiring nitrate to appear by itself."
  });

  return{
    state,
    readings:{NH3:nh3,NO2:no2,NO3:no3,pH:ph,temperature},
    trends:{NH3:nh3Trend,NO2:trend(tank,"NO2"),NO3:trend(tank,"NO3")},
    issues,
    principles:[
      "Readiness is evidence-based, not calendar-based.",
      "Most nitrifying bacteria live on wet oxygenated surfaces and filter media, not in the water column.",
      "A normal water change does not reset a healthy biofilter if media stays wet and dechlorinated water is used.",
      "Bottled bacteria or mature media can shorten cycling, but neither proves readiness without measured processing.",
      "During fishless cycling, more ammonia is not always better; avoid repeatedly increasing an already high reading.",
      "Continuous filtration, oxygenation and stable temperature and pH are core cycle conditions.",
      "Do not add livestock until the cycle readiness gate is complete."
    ],
    commonProblems:[
      "ammonia not falling or stalled cycle",
      "nitrite spike or prolonged nitrite phase",
      "zero nitrate despite apparent processing",
      "low pH or depleted alkalinity",
      "temperature outside a stable range",
      "chlorine or chloramine exposure",
      "filter or pump outage and low oxygen",
      "bio-media dried out or washed aggressively in chlorinated water",
      "excess ammonia dosing",
      "bottled bacteria used without a sustained ammonia source",
      "cloudy bacterial bloom",
      "brown diatoms and early algae",
      "water change mistaken for a cycle reset",
      "test-kit error or default values mistaken for measured evidence"
    ]
  };
}

function currentEvidence(tank:Tank){
  const snap=biologicalCycleKnowledgeSnapshot(tank);
  const latest=snap.state.latestMeasured;
  return{
    ar:[
      "اليوم "+snap.state.day+" من الدورة",
      "تقدم الدورة "+snap.state.progress+"%",
      latest?"آخر قراءة مقاسة: "+new Date(latest.timestamp).toLocaleString():"لا توجد قراءة مقاسة حديثة"
    ],
    en:[
      "Cycle day "+snap.state.day,
      "Cycle progress "+snap.state.progress+"%",
      latest?"Latest measured reading: "+new Date(latest.timestamp).toLocaleString():"No recent measured reading"
    ]
  };
}

export function answerBiologicalCycleQuestion(tank:Tank,question:string):CycleKnowledgeAnswer{
  const q=normalize(question),snap=biologicalCycleKnowledgeSnapshot(tank),evidence=currentEvidence(tank);
  let titleAr="فهم الدورة البيولوجية",titleEn="Biological cycle guidance";
  let summaryAr=snap.state.nextAr,summaryEn=snap.state.nextEn;
  let detailsAr=[
    "الدورة البيولوجية تبني مستعمرة بكتيريا على الميديا والأسطح لمعالجة مخلفات النيتروجين.",
    "الوقت لحاله ما بيثبت النجاح؛ لازم نشوف معالجة فعلية بالقياسات.",
    "التدفق والأكسجة وpH والحرارة عوامل أساسية للدورة."
  ];
  let detailsEn=[
    "Biological cycling builds nitrifying communities on media and wet surfaces to process nitrogen waste.",
    "Elapsed time alone never proves success; measured processing is required.",
    "Flow, oxygenation, pH and temperature are core cycle conditions."
  ];
  let actionPage:CycleKnowledgeAnswer["actionPage"]="chemistry";

  if(/امونيا|ammonia|nh3|nh4/.test(q)){
    titleAr="مشكلة الأمونيا أثناء الدورة";titleEn="Ammonia during cycling";
    summaryAr=snap.readings.NH3===null?"ما في قراءة أمونيا مقاسة حديثة؛ أول خطوة هي القياس.":"قراءة الأمونيا الحالية "+snap.readings.NH3+" ppm ولازم نفسرها ضمن اتجاه الدورة، مو كرقم منفصل.";
    summaryEn=snap.readings.NH3===null?"There is no recent measured ammonia reading; testing is the first step.":"Current ammonia is "+snap.readings.NH3+" ppm and should be interpreted as part of the cycle trend, not in isolation.";
    detailsAr=[
      "نزول الأمونيا مع الوقت دليل إن أول جزء من الدورة عم يشتغل.",
      "إذا بقيت ثابتة أيام، راجع الاختبار وpH والحرارة والأكسجة والكلور قبل إضافة جرعة جديدة.",
      "إذا كانت عالية جداً، لا ترفعها أكثر؛ الجرعة المفرطة ممكن تبطئ الدورة."
    ];
    detailsEn=[
      "Falling ammonia over time is evidence that the first nitrification stage is working.",
      "If it stays flat for days, check the test, pH, temperature, oxygenation and chlorine exposure before adding more.",
      "If ammonia is already very high, do not keep raising it; excessive dosing can slow the cycle."
    ];
  }else if(/نتريت|nitrite|no2/.test(q)){
    titleAr="مرحلة النتريت";titleEn="Nitrite phase";
    summaryAr=tank.type==="freshwater"?"ارتفاع NO2 بعد نزول الأمونيا غالباً مرحلة طبيعية، لكن الحوض ما بيكون جاهز قبل ما ينزل للصفر العملي ويتأكد بقياس لاحق.":"بالبحري NO2 أقل سمّية من النهري، لذلك ما نعتمد عليه وحده كشرط جاهزية، لكن اتجاهه بيفيد لفهم تقدم الدورة.";
    summaryEn=tank.type==="freshwater"?"NO2 rising after ammonia falls is often a normal stage, but the tank is not ready until nitrite reaches practical zero and is confirmed.":"In marine systems NO2 is much less toxic than in freshwater, so it is not used alone as a readiness gate, though its trend can help show progression.";
    detailsAr=["مرحلة النتريت الطويلة مو فشل تلقائياً.","حافظ على الفلترة والأكسجة بدل تغيير عدة أشياء مع بعض.","إذا بقي NO2 بلا تغير فترة طويلة، راجع pH والحرارة والكلور ودقة الاختبار."];
    detailsEn=["A prolonged nitrite phase is not automatically a failure.","Keep filtration and oxygenation stable rather than changing many variables at once.","If NO2 shows no movement for a prolonged period, review pH, temperature, chlorine exposure and test accuracy."];
  }else if(/نترات|nitrate|no3/.test(q)){
    titleAr="قراءة النترات أثناء الدورة";titleEn="Nitrate during cycling";
    summaryAr="ظهور NO3 ممكن يدعم دليل التقدم، لكن عدم ظهوره ما بيثبت فشل الدورة لحاله.";
    summaryEn="Rising NO3 can support evidence of progress, but zero nitrate alone does not prove the cycle failed.";
    detailsAr=["النباتات أو تغيير الماء أو التصدير ممكن يخفض NO3.","الأهم إثبات معالجة NH3/NH4، وبالنهري NO2 أيضاً.","أكد اختبار NO3 إذا النتيجة ما بتركب مع بقية التسلسل."];
    detailsEn=["Plants, water changes or export can reduce NO3.","The key evidence is NH3/NH4 processing and, in freshwater, NO2 clearance too.","Confirm the NO3 test if it conflicts with the rest of the sequence."];
  }else if(/تغيير مي|تغيير ماء|water change|بدلت مي|reset|من الاول/.test(q)){
    titleAr="هل تغيير الماء بيرجع الدورة من الأول؟";titleEn="Does a water change reset the cycle?";
    summaryAr="عادةً لا. أغلب البكتيريا النافعة موجودة على الميديا والأسطح، مو معلقة بالماء.";
    summaryEn="Usually no. Most nitrifying bacteria live on media and surfaces rather than free in the water.";
    detailsAr=["تغيير ماء بماء مجهز بدون كلور ما بيمسح الدورة.","الخطر الحقيقي هو غسل الميديا بماء مكلور أو تركها تنشف أو توقف الفلترة والأكسجة مدة طويلة.","ممكن تعمل تغيير ماء أثناء الدورة إذا في سبب واضح مثل أمونيا مبالغ فيها، وبعدها تكمل القياس."];
    detailsEn=["A normal change with properly conditioned water does not erase the cycle.","The bigger risks are chlorinated media washing, drying media, or prolonged filtration and oxygen loss.","A water change during cycling can be appropriate for a clear reason such as excessive ammonia; then continue testing."];
    actionPage="maintenance";
  }else if(/بكتيريا|bacteria|seeded|ميديا ناضج|ميديا قديم/.test(q)){
    titleAr="البكتيريا الجاهزة والميديا الناضجة";titleEn="Bottled bacteria and mature media";
    summaryAr="ممكن يسرّعوا الدورة بشكل كبير، بس ما بيعتبرو إثبات جاهزية لحالهم.";
    summaryEn="They can shorten cycling substantially, but they do not prove readiness by themselves.";
    detailsAr=["البكتيريا بدها مصدر أمونيا وأكسجين وتدفق.","الميديا الناضجة فعالة إذا بقيت رطبة ومؤكسجة وما تعرضت لكلور.","الفيصل بالنهاية هو القياس: معالجة الأمونيا، وبالنهري النتريت أيضاً."];
    detailsEn=["Bacteria still need an ammonia source, oxygen and flow.","Mature media is useful if kept wet, oxygenated and protected from chlorine.","The final proof remains measured processing: ammonia, and in freshwater nitrite too."];
    actionPage="maintenance";
  }else if(/كلور|chlorine|chloramine/.test(q)){
    titleAr="الكلور وتأثيره على الدورة";titleEn="Chlorine and chloramine during cycling";
    summaryAr="الكلور والكلورامين ممكن يضروا البكتيريا النافعة، لذلك أي ماء حنفية لازم يكون معالج بشكل صحيح.";
    summaryEn="Chlorine and chloramine can damage nitrifying bacteria, so tap water must be properly treated.";
    detailsAr=["لا تغسل الميديا البيولوجية بماء حنفية مكلور.","إذا صار تعرض واضح، رجّع ماء آمن وفلترة وأكسجة ثم راقب NH3 وNO2 بدل افتراض انهيار كامل.","RO/DI الجيد يقلل الخطر إذا جودته موثقة."];
    detailsEn=["Do not rinse biological media in chlorinated tap water.","After a known exposure, restore safe water, flow and oxygen, then monitor NH3 and NO2 rather than assuming total cycle loss.","Properly functioning RO/DI reduces this risk when quality is verified."];
    actionPage="rodi";
  }else if(/فلتر|مضخه|مضخة|كهربا|power|filter|oxygen|اكسج|أكسج/.test(q)){
    titleAr="الفلترة والأكسجة أثناء الدورة";titleEn="Filtration and oxygen during cycling";
    summaryAr="البكتيريا النافعة بدها تدفق وأكسجين مستمرين؛ هاد جزء أساسي من الدورة.";
    summaryEn="Nitrifying bacteria need continuous flow and oxygen; this is a core part of cycling.";
    detailsAr=["انقطاع قصير مو معناه تلقائياً إن الدورة ماتت.","كل ما طال توقف الفلتر أو نشفت الميديا بيزيد احتمال خسارة جزء من المستعمرة.","بعد أي انقطاع مهم رجّع التدفق وراقب الأمونيا والنتريت بدل افتراض النتيجة."];
    detailsEn=["A short outage does not automatically mean the cycle is lost.","The longer filtration stops or media dries, the greater the risk of losing part of the colony.","After a meaningful outage, restore flow and monitor ammonia and nitrite rather than assuming the outcome."];
    actionPage="equipment";
  }else if(/عكر|غيم|cloudy|bloom|بكتيري/.test(q)){
    titleAr="عكارة أو Bacterial Bloom";titleEn="Cloudy water or bacterial bloom";
    summaryAr="العكارة البكتيرية شائعة بالحوض الجديد وما بتعني لحالها إن الدورة فشلت.";
    summaryEn="A bacterial bloom is common in new tanks and does not by itself mean cycling failed.";
    detailsAr=["ركز على الأكسجة لأن الـBloom ممكن يستهلك أكسجين.","لا تنظف أو تبدل كل الميديا دفعة وحدة بسبب العكارة.","تابع NH3 وNO2 وNO3 وخلي التدخل مبني على القياسات."];
    detailsEn=["Prioritize oxygenation because a bloom can consume oxygen.","Do not replace or sterilize all media just because the water is cloudy.","Track NH3, NO2 and NO3 and let measured evidence drive intervention."];
    actionPage="equipment";
  }else if(/دياتوم|طحالب بن|algae|diatom/.test(q)){
    titleAr="الدياتوم والطحالب بالحوض الجديد";titleEn="Diatoms and early algae";
    summaryAr="الدياتوم والطحالب المبكرة غالباً جزء من نضج الحوض، مو دليل إن الدورة فشلت أو اكتملت.";
    summaryEn="Early diatoms and algae are commonly part of tank maturation, not proof that the cycle failed or finished.";
    detailsAr=["قيمها منفصلة عن جاهزية إضافة الكائنات.","لا تعقم النظام بسببها.","الحكم على الدورة يبقى من معالجة النيتروجين والقياسات."];
    detailsEn=["Evaluate them separately from livestock readiness.","Do not sterilize the system because of them.","Cycle readiness still depends on nitrogen processing and measured tests."];
  }else if(/قديش|كم يوم|مدة|جاهز|خلصت|متى|how long|ready|finish|done/.test(q)){
    titleAr="متى بتكون الدورة جاهزة؟";titleEn="When is the cycle ready?";
    summaryAr=snap.state.ready?"شروط الجاهزية الحالية متحققة حسب القراءات المسجلة، وبقي إنهاء Cycling Mode بعد مراجعتها.":"ما منحدد الجاهزية بعدد أيام ثابت؛ منثبتها بالقياسات.";
    summaryEn=snap.state.ready?"Current readiness criteria are satisfied by the recorded measurements; review them and complete Cycling Mode.":"Readiness is not defined by a fixed number of days; it is proven by measured processing.";
    detailsAr=snap.state.blockersAr.concat(["اليوم الحالي: "+snap.state.day+".","التقدم الحالي: "+snap.state.progress+"%."]);
    detailsEn=snap.state.blockersEn.concat(["Current day: "+snap.state.day+".","Current progress: "+snap.state.progress+"%."]);
    actionPage=snap.state.ready?"maintenance":"chemistry";
  }

  const relevantIssues=snap.issues.slice(0,4);
  return{
    titleAr,titleEn,summaryAr,summaryEn,
    detailsAr:detailsAr.concat(relevantIssues.map(x=>"ملاحظة من بيانات حوضك: "+x.ar+" "+x.actionAr)),
    detailsEn:detailsEn.concat(relevantIssues.map(x=>"Tank-specific note: "+x.en+" "+x.actionEn)),
    evidenceAr:evidence.ar,
    evidenceEn:evidence.en,
    actionPage
  };
}
