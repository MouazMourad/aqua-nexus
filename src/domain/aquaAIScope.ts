import type { Tank } from "./types";
import type { AquaAIAnswer } from "./aquaAIBrain";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";

function norm(s:string){
  return (s||"").toLowerCase().normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g,"")
    .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/ؤ/g,"و").replace(/ئ/g,"ي")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g," ").replace(/\s+/g," ").trim();
}

const RAW_AQUARIUM_KEYWORDS=[
  "حوض","أحواض","اكواريوم","Aqua Nexus","سمك","أسماك","مرجان","روبيان","جمبري","حلزون",
  "نبات مائي","بحري","نهري","ريف","reef","aquarium","tank","fish","coral","shrimp","snail",
  "marine","freshwater","livestock","sump","فلتر","فلترة","مضخة","سكيمر","سخان","heater","wave",
  "overflow","return pump","filter","skimmer","rodi","ato","إضاءة","اضاءة","إنارة","انارة","ضوء","lighting","light","PAR","photoperiod","spectrum","ملوحة","salinity",
  "KH","alkalinity","calcium","كالسيوم","magnesium","مغنيسيوم","NO3","nitrate","نترات","PO4",
  "phosphate","فوسفات","NH3","NH4","ammonia","أمونيا","NO2","nitrite","نتريت","pH","TDS","GH",
  "كيمياء","كيميا","جرعة","جرعات","دوز","dosing","تغذية","feeding","أقلمة","acclimation","حجر صحي",
  "quarantine","مرض","أمراض","علاج","disease","treatment","صيانة","maintenance","دورة بيولوجية",
  "دورة النيتروجين","cycling","bacteria","بكتيريا","ميديا","water change","تغيير ماء","تغيير مي",
  "غيرت مي","بدلت مي","bioload","حمل حيوي","طحالب","algae","دياتوم","diatom","bubble","torch",
  "mushroom","zoa","anemone","كلون","تانغ","tang","goby","wrasse","chromis","nemo"
].map(norm);

const META_KEYWORDS=[
  "شو اسمك","اسمك شو","مين انت","من انت","مين حضرتك","who are you","what is your name",
  "hello","hi","hey","مرحبا","أهلا","السلام عليكم"
].map(norm);

const SHORT_ASCII=new Set(["kh","ph","gh"]);

function containsKeyword(q:string,k:string){
  if(SHORT_ASCII.has(k))return q.split(" ").includes(k);
  return k.length>=2&&q.includes(k);
}

export function isAquariumScopedQuestion(question:string,tank?:Tank){
  const q=norm(question);
  if(!q)return true;
  if(META_KEYWORDS.some(k=>containsKeyword(q,k)))return true;
  if(RAW_AQUARIUM_KEYWORDS.some(k=>containsKeyword(q,k)))return true;

  const libraryNames=(LIVESTOCK_LIBRARY as readonly any[])
    .flatMap(x=>[x.ar,x.en,x.id])
    .map((x:string)=>norm(x||""))
    .filter((x:string)=>x.length>=3);
  if(libraryNames.some((x:string)=>q.includes(x)))return true;

  if(tank){
    const named=[
      tank.name,
      ...tank.livestock.flatMap(x=>[x.name,x.nameEn||""]),
      ...tank.equipment.flatMap(x=>[x.name,x.brand||"",x.model||""])
    ].map(norm).filter(x=>x.length>=3);
    if(named.some(x=>q.includes(x)))return true;
  }
  return false;
}

function variant(question:string){
  let n=0;for(const ch of question)n=(n+ch.charCodeAt(0))%5;return n;
}

export function offTopicAquaAnswer(question:string):AquaAIAnswer{
  const repliesAr=[
    "أنا شاطر بالماء… بس كأس العالم خلّيه للي عنده ملعب مو حوض 😄. اسألني عن حوضك وبفوت بالتفاصيل.",
    "إذا الموضوع ما بينحط بمي، غالباً مو اختصاصي 😄. أنا Local Best AI تبع Aqua Nexus وحوضك هو عالمي.",
    "هون عندي زعانف أكتر من الأخبار 😄. خلينا بالحوض: كيمياء، كائنات، معدات، صيانة، أمراض أو دورة بيولوجية.",
    "برا الحوض بصير ذكائي ناشف شوي 😄. رجّعني للمي واسألني أي شي عن Aqua Nexus أو حوضك.",
    "أنا مستشار الحوض، مو موسوعة الكون 😄. عطيني سؤال عن السمك أو المرجان أو الكيمياء أو المعدات وأنا حاضر."
  ];
  const repliesEn=[
    "I’m better with water than world trivia 😄. Ask me about your tank and I’ll go deep.",
    "If it does not belong in water, it is probably outside my lane 😄. I’m Aqua Nexus’ tank specialist.",
    "I have more fins than headlines in here 😄. Let’s stick to aquarium chemistry, livestock, equipment, maintenance, disease or cycling.",
    "Outside the aquarium my intelligence gets a little dry 😄. Bring me back to the tank and I’m useful again.",
    "I’m your aquarium specialist, not the encyclopedia of everything 😄. Give me a tank question and I’m in."
  ];
  const i=variant(question);
  return{
    titleAr:"🐠 خلّينا بالحوض",titleEn:"🐠 Bring me back to the tank",
    summaryAr:repliesAr[i],summaryEn:repliesEn[i],
    detailsAr:["اختصاصي هو الحوض الحالي وبياناته داخل Aqua Nexus.","بقدر أساعدك بالكيمياء، الدورة البيولوجية، الكائنات، التغذية، الجرعات، المعدات، الصيانة، الأمراض والطوارئ."],
    detailsEn:["My scope is the current aquarium and its Aqua Nexus data.","I can help with chemistry, biological cycling, livestock, feeding, dosing, equipment, maintenance, disease and emergencies."],
    evidenceAr:["حارس نطاق Local Best AI"],evidenceEn:["Local Best AI scope guard"],
    confidence:"high",
    action:{page:"dashboard",ar:"اسألني عن الحوض 🐠",en:"Ask me about the tank 🐠"}
  };
}
