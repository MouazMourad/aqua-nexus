import type { Tank } from "./types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { chemistryCatalogForTank } from "./chemistryProfile";
import { chemistryAgeDays, chemistryHealth, parameterScore } from "./health";

export type ChemistryAdviceLevel = "good" | "info" | "warn" | "danger";

export interface ChemistryAdviceItem {
  key: string;
  level: ChemistryAdviceLevel;
  score: number | null;
  current: number | null;
  ideal: [number, number];
  safe: [number, number];
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  actionAr: string;
  actionEn: string;
  suspectedFormat?: { ar: string; en: string; normalized?: number };
}

function direction(value:number,min:number,max:number){
  if(value<min)return "low" as const;
  if(value>max)return "high" as const;
  return "ideal" as const;
}

function fmt(n:number){
  if(Math.abs(n)<0.1&&n!==0)return n.toFixed(3).replace(/0+$/,"").replace(/\.$/,"");
  if(Math.abs(n)<10)return n.toFixed(3).replace(/0+$/,"").replace(/\.$/,"");
  return String(Number(n.toFixed(2)));
}

function genericAction(tank:Tank,key:string,dir:"low"|"high"|"ideal"){
  if(dir==="ideal")return {ar:"القيمة ضمن المجال المثالي. حافظ على نفس الروتين وراقب الاتجاه مع القراءات القادمة.",en:"The value is in the ideal range. Keep the current routine and watch the trend over future readings."};
  if(key==="temperature")return dir==="low"
    ? {ar:"ارفع الحرارة تدريجياً وتأكد من دقة الترمومتر وعمل السخان. تجنب أي تعديل سريع.",en:"Raise temperature gradually and verify the thermometer and heater. Avoid rapid changes."}
    : {ar:"خفّض الحرارة تدريجياً، حسّن التهوية/التبريد وتأكد أن الإضاءة أو المعدات لا ترفع الحرارة.",en:"Lower temperature gradually, improve ventilation/cooling, and check whether lighting or equipment is adding heat."};
  if(key==="pH")return dir==="low"
    ? {ar:"حسّن تبادل الغازات والتهوية، وراجع KH قبل استخدام أي مادة لرفع pH. لا تطارد الرقم بتعديلات سريعة.",en:"Improve gas exchange/aeration and review KH before using pH-raising products. Avoid chasing the number with rapid corrections."}
    : {ar:"أعد القياس للتأكد، وراجع أي جرعات ترفع القلوية أو pH. تجنب خفضه كيميائياً بشكل مفاجئ.",en:"Retest to confirm and review alkalinity/pH-raising dosing. Avoid sudden chemical pH reduction."};
  if(key==="salinity")return dir==="low"
    ? {ar:"تأكد من معايرة جهاز الملوحة. صحّح الملوحة تدريجياً باستخدام ماء مالح مضبوط بدل القفز السريع بالقيمة.",en:"Verify salinity-meter calibration. Correct salinity gradually with properly mixed saltwater rather than making a rapid jump."}
    : {ar:"تأكد من معايرة القياس، ثم صحّح تدريجياً بماء RO/DI عند الحاجة مع تجنب التغيير السريع.",en:"Verify measurement calibration, then correct gradually with RO/DI water if needed, avoiding rapid changes."};
  if(key==="KH")return dir==="low"
    ? {ar:"أعد القياس للتأكيد، ثم ارفع KH تدريجياً فقط إذا بقي منخفضاً. راقب الاستهلاك اليومي وثبات الجرعة.",en:"Retest to confirm, then raise KH gradually only if it remains low. Track daily consumption and dosing stability."}
    : {ar:"أوقف أو خفّض أي جرعة قلوية مؤقتاً وراقب الانخفاض الطبيعي. لا تحاول خفض KH بسرعة.",en:"Pause or reduce alkalinity dosing temporarily and allow a natural decline. Do not force KH down quickly."};
  if(key==="Ca")return dir==="low"
    ? {ar:"أعد فحص Ca وKH معاً. إذا بقي الكالسيوم منخفضاً، صححه تدريجياً بجرعة محسوبة مع مراقبة KH.",en:"Retest Ca and KH together. If calcium remains low, correct it gradually with a measured dose while monitoring KH."}
    : {ar:"أوقف أو خفّض جرعات الكالسيوم أو All-for-Reef مؤقتاً إذا كانت مستخدمة، وأعد الفحص قبل أي تصحيح إضافي.",en:"Pause or reduce calcium or All-for-Reef dosing temporarily if used, and retest before making further corrections."};
  if(key==="Mg")return dir==="low"
    ? {ar:"أعد القياس للتأكد. إذا بقي منخفضاً استخدم تعويض مغنزيوم مناسب أو ماء تغيير مضبوط، وارفع القيمة تدريجياً.",en:"Retest to confirm. If still low, use an appropriate magnesium supplement or balanced water change and raise it gradually."}
    : {ar:"أوقف تعويض المغنزيوم مؤقتاً وأعد القياس. الأفضل عادة تركه ينخفض تدريجياً مع الاستهلاك وتغييرات الماء.",en:"Pause magnesium supplementation and retest. Usually it is best to let it decline gradually through consumption and water changes."};
  if(key==="NO3")return dir==="low"
    ? {ar:"لا تخفّض المغذيات أكثر. راقب التغذية والمرجان وتجنب الإفراط في التصفية أو الكربون العضوي.",en:"Do not strip nutrients further. Review feeding/coral response and avoid excessive filtration or carbon dosing."}
    : {ar:"ابدأ بإزالة مصادر الحمل العضوي: بقايا أو كائن ميت، نظف الفلاتر والجوارب، حسّن السكيمر وغيّر ماء مناسب. خفّضه تدريجياً.",en:"Remove organic sources first: debris or dead livestock, clean mechanical filters/socks, optimize skimming, and perform an appropriate water change. Reduce gradually."};
  if(key==="PO4")return dir==="low"
    ? {ar:"تجنب خفض الفوسفات أكثر. خفف أو أوقف مادة إزالة الفوسفات مؤقتاً وراقب استجابة المرجان.",en:"Avoid lowering phosphate further. Reduce or pause phosphate-removal media temporarily and watch coral response."}
    : {ar:"راجع مصدر الفوسفات، نظف الترسبات والفلاتر، وغيّر الماء عند الحاجة. استخدم مادة إزالة الفوسفات تدريجياً وليس دفعة قوية.",en:"Check phosphate sources, clean detritus/mechanical filters, and change water if needed. Use phosphate-removal media gradually rather than aggressively."};
  if(key==="NH3"||key==="NO2")return dir==="high"
    ? {ar:"هذه أولوية عالية: أعد الاختبار فوراً، ابحث عن كائن ميت أو خلل بالفلترة الحيوية، حسّن التهوية وغيّر جزءاً من الماء مع مراقبة متكررة.",en:"High priority: retest immediately, look for dead livestock or biofilter failure, improve aeration, and perform a partial water change with frequent monitoring."}
    : {ar:"القيمة ممتازة عند الصفر. حافظ على استقرار الفلترة الحيوية وتجنب زيادة الحمل بسرعة.",en:"Zero is ideal. Keep biological filtration stable and avoid rapid bioload increases."};
  if(key==="GH")return dir==="low"
    ? {ar:"راجع ماء المصدر ومتطلبات الكائنات قبل رفع GH، ثم صححه تدريجياً إذا كان منخفضاً فعلاً.",en:"Review source water and livestock requirements before raising GH, then correct gradually if truly low."}
    : {ar:"راجع ماء المصدر والأملاح المضافة. خفّض GH تدريجياً فقط إذا كان غير مناسب للكائنات الموجودة.",en:"Review source water and added minerals. Lower GH gradually only if it is unsuitable for current livestock."};
  if(key==="TDS")return dir==="low"
    ? {ar:"راجع ماء المصدر ومتطلبات الأنواع قبل إضافة أملاح أو معادن. لا ترفع TDS لمجرد الوصول لرقم.",en:"Review source water and species needs before adding minerals. Do not raise TDS just to hit a number."}
    : {ar:"راجع تراكم الأملاح وماء المصدر وجدول تغييرات الماء. خفّض TDS تدريجياً بتغييرات ماء مناسبة.",en:"Review mineral buildup, source water, and water-change schedule. Lower TDS gradually with appropriate water changes."};
  return tank.type==="marine"
    ? {ar:"أعد القياس للتأكد، ثم صحح القيمة تدريجياً مع تجنب أكثر من تعديل كبير بنفس الوقت.",en:"Retest to confirm, then correct gradually while avoiding multiple major changes at once."}
    : {ar:"أعد القياس للتأكد وراجع متطلبات الأنواع الموجودة قبل أي تعديل سريع.",en:"Retest to confirm and review livestock requirements before making rapid adjustments."};
}

export function chemistryGuidance(tank:Tank){
  const cfg:any=chemistryCatalogForTank(tank);
  const latest=tank.chemistry[0]?.values??{};
  const items:ChemistryAdviceItem[]=[];

  Object.entries(cfg).forEach(([key,meta]:[string,any])=>{
    const raw=latest[key];
    const value=typeof raw==="number"&&!Number.isNaN(raw)?raw:null;
    const score=parameterScore(value,meta);
    const ideal:[number,number]=[meta.ideal[0],meta.ideal[1]];
    const safe:[number,number]=[meta.safe[0],meta.safe[1]];
    let suspectedFormat:ChemistryAdviceItem["suspectedFormat"];

    if(key==="salinity"&&value!==null&&value>2){
      const normalized=value>=1000?value/10000:value>=100?value/1000:value/100;
      if(normalized>=0.95&&normalized<=1.1){
        suspectedFormat={
          normalized,
          ar:"قيمة الملوحة المدخلة "+value+" تبدو بصيغة غير صحيحة للـSG. الاحتمال الأقرب أنها "+fmt(normalized)+".",
          en:"The entered salinity value "+value+" looks incorrectly formatted for SG. It most likely represents "+fmt(normalized)+"."
        };
      }
    }

    if(value===null){
      items.push({key,level:"info",score:null,current:null,ideal,safe,titleAr:meta.label,titleEn:meta.label,reasonAr:"لا توجد قراءة حالية لهذا العامل.",reasonEn:"No current reading is available for this parameter.",actionAr:"سجّل قراءة قبل اتخاذ قرار مبني على هذا العامل.",actionEn:"Record a reading before making a decision based on this parameter."});
      return;
    }

    const dir=direction(value,ideal[0],ideal[1]);
    const action=genericAction(tank,key,dir);
    let level:ChemistryAdviceLevel="good";
    if(score!==null&&score<=35)level="danger";
    else if(score!==null&&score<80)level="warn";
    else if(score!==null&&score<100)level="info";

    const reasonAr=dir==="ideal"
      ? meta.label+" ضمن المثالي ("+fmt(ideal[0])+"–"+fmt(ideal[1])+")."
      : dir==="low"
        ? meta.label+" منخفض: "+fmt(value)+" مقابل المثالي "+fmt(ideal[0])+"–"+fmt(ideal[1])+"."
        : meta.label+" مرتفع: "+fmt(value)+" مقابل المثالي "+fmt(ideal[0])+"–"+fmt(ideal[1])+".";
    const reasonEn=dir==="ideal"
      ? meta.label+" is in the ideal range ("+fmt(ideal[0])+"–"+fmt(ideal[1])+")."
      : dir==="low"
        ? meta.label+" is low: "+fmt(value)+" vs ideal "+fmt(ideal[0])+"–"+fmt(ideal[1])+"."
        : meta.label+" is high: "+fmt(value)+" vs ideal "+fmt(ideal[0])+"–"+fmt(ideal[1])+".";

    items.push({
      key,level,score,current:value,ideal,safe,titleAr:meta.label,titleEn:meta.label,
      reasonAr:suspectedFormat?reasonAr+" "+suspectedFormat.ar:reasonAr,
      reasonEn:suspectedFormat?reasonEn+" "+suspectedFormat.en:reasonEn,
      actionAr:suspectedFormat?"صحح تنسيق القراءة أولاً ثم أعد تقييم الكيمياء قبل أي تعديل فعلي في الحوض.":action.ar,
      actionEn:suspectedFormat?"Correct the recorded value format first, then reassess chemistry before making a real tank adjustment.":action.en,
      suspectedFormat
    });
  });

  const severity={danger:0,warn:1,info:2,good:3};
  items.sort((a,b)=>{
    const lv=severity[a.level]-severity[b.level];
    if(lv!==0)return lv;
    return (a.score??101)-(b.score??101);
  });

  const problems=items.filter(x=>x.level==="danger"||x.level==="warn"||x.suspectedFormat);
  const dataIssues=items.filter(x=>Boolean(x.suspectedFormat));
  const age=chemistryAgeDays(tank);
  const health=chemistryHealth(tank);
  const agePenalty=age>7?Math.min(30,Math.round((age-7)*3)):0;

  return {
    health,ageDays:age,agePenalty,problems,dataIssues,all:items,
    headlineAr:problems.length?"صحة الكيمياء "+health+"% لأن "+problems.length+" عامل/عوامل تحتاج انتباه.":"صحة الكيمياء "+health+"% والقيم الحالية ضمن وضع جيد.",
    headlineEn:problems.length?"Chemistry health is "+health+"% because "+problems.length+" parameter(s) need attention.":"Chemistry health is "+health+"% and current values are in good condition."
  };
}
