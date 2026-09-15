import type { LivestockItem, Tank } from "./types";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { bioload } from "./health";

export type CompatibilityLevel = "good" | "warn" | "danger";

export interface CompatibilityIssue {
  level: CompatibilityLevel;
  ar: string;
  en: string;
}

export interface CompatibilityResult {
  level: CompatibilityLevel;
  issues: CompatibilityIssue[];
  currentRatio: number;
  projectedRatio: number;
  projectedStatus: "low" | "good" | "high" | "danger";
  requiresConfirmation: boolean;
}

function catalogById(id?: string) {
  if (!id) return undefined;
  return (LIVESTOCK_LIBRARY as readonly any[]).find((x:any)=>x.id===id);
}

function mappedCategory(cat:string) {
  const c=String(cat||"").toLowerCase();
  if(c==="fish") return "fish";
  if(c==="coral") return "coral";
  if(c==="invert") return "invert";
  if(c==="plant") return "plant";
  return "other";
}

function tags(entry:any): string[] {
  return Array.isArray(entry?.tags) ? entry.tags : [];
}

function isSmallPrey(entry:any) {
  const t=tags(entry);
  return t.includes("smallFish") || t.includes("shrimp") || mappedCategory(entry?.cat)==="invert";
}

export function compatibilityCheck(
  tank: Tank,
  candidate: any,
  quantity: number
): CompatibilityResult {
  const issues:CompatibilityIssue[]=[];
  const current=bioload(tank);
  const loadPer=Number(candidate?.load ?? 1);
  const capacity=Math.max(1,tank.systemVolumeLiters/35);
  const projectedLoad=current.load + loadPer*Math.max(1,quantity);
  const projectedRatio=projectedLoad/capacity;
  const projectedStatus = projectedRatio < .55 ? "low" : projectedRatio < .85 ? "good" : projectedRatio < 1.15 ? "high" : "danger";

  if(Number(candidate?.min||0)>tank.systemVolumeLiters){
    issues.push({
      level:"danger",
      ar:`حجم النظام ${tank.systemVolumeLiters.toFixed(0)} لتر أقل من الحد المقترح ${candidate.min} لتر.`,
      en:`System volume ${tank.systemVolumeLiters.toFixed(0)} L is below the suggested minimum of ${candidate.min} L.`
    });
  }

  if(candidate?.needsMature && tank.status!=="established"){
    issues.push({
      level:"danger",
      ar:"هذا الكائن يحتاج عادةً إلى حوض مستقر وناضج.",
      en:"This organism generally requires a mature, established tank."
    });
  }

  if(candidate?.schoolMin){
    const existingSame=tank.livestock
      .filter(x=>x.libraryId===candidate.id)
      .reduce((s,x)=>s+x.quantity,0);
    const total=existingSame+quantity;
    if(total<candidate.schoolMin){
      issues.push({
        level:"warn",
        ar:`هذا النوع يفضل مجموعة لا تقل عن ${candidate.schoolMin}. العدد بعد الإضافة سيكون ${total}.`,
        en:`This species prefers a group of at least ${candidate.schoolMin}. The total after adding will be ${total}.`
      });
    }
  }

  const currentEntries=tank.livestock.map((x:LivestockItem)=>({
    item:x,
    catalog:catalogById(x.libraryId)
  }));

  const candidateTags=tags(candidate);
  const hasCorals=tank.livestock.some(x=>x.category==="coral");
  const hasInverts=tank.livestock.some(x=>x.category==="invert");
  const hasPlants=tank.livestock.some(x=>x.category==="plant");

  if(hasCorals && (candidate?.reefSafe===false || candidate?.reefSafe==="caution" || candidateTags.includes("coralRisk"))){
    issues.push({
      level:candidate?.reefSafe===false?"danger":"warn",
      ar:"قد يعض أو يزعج المرجان الموجود في الحوض.",
      en:"May nip or disturb corals already in the tank."
    });
  }

  if(hasInverts && (candidate?.invertSafe===false || candidate?.invertSafe==="caution" || candidateTags.includes("shrimpRisk"))){
    issues.push({
      level:candidate?.invertSafe===false?"danger":"warn",
      ar:candidateTags.includes("shrimpRisk")?"قد يشكل خطراً على الجمبري أو اللافقاريات الصغيرة.":"قد يشكل خطراً على اللافقاريات الموجودة.",
      en:candidateTags.includes("shrimpRisk")?"May threaten shrimp or small invertebrates.":"May threaten existing invertebrates."
    });
  }

  if(tank.type==="freshwater" && hasPlants && (candidate?.plantSafe===false || candidate?.plantSafe==="caution")){
    issues.push({
      level:candidate?.plantSafe===false?"danger":"warn",
      ar:"قد يضر بالنباتات الموجودة في الحوض.",
      en:"May damage plants already in the aquarium."
    });
  }

  if(candidateTags.includes("predator")){
    const prey=currentEntries.filter(({catalog,item})=>catalog ? isSmallPrey(catalog) : item.category==="invert");
    if(prey.length){
      issues.push({
        level:"danger",
        ar:"هذا الكائن مفترس وقد يهدد كائنات أصغر موجودة حالياً.",
        en:"This is a predator and may threaten smaller livestock already present."
      });
    }
  }

  const existingPredator=currentEntries.find(({catalog})=>catalog && tags(catalog).includes("predator"));
  if(existingPredator && isSmallPrey(candidate)){
    issues.push({
      level:"danger",
      ar:"يوجد كائن مفترس حالياً قد يهدد هذا الكائن.",
      en:"An existing predator may threaten this organism."
    });
  }

  const aggressiveCandidate=candidateTags.some(x=>["aggressive","semiAggressive","territorial","finNipper"].includes(x));
  const aggressiveExisting=currentEntries.some(({catalog})=>catalog && tags(catalog).some((x:string)=>["aggressive","semiAggressive","territorial","finNipper"].includes(x)));
  if(mappedCategory(candidate?.cat)==="fish" && aggressiveCandidate && aggressiveExisting){
    issues.push({
      level:"warn",
      ar:"يوجد احتمال عدوانية أو نزاع إقليمي مع الأسماك الحالية.",
      en:"There is a possible territorial/aggression conflict with current fish."
    });
  }

  if(projectedStatus==="high"){
    issues.push({
      level:"warn",
      ar:`الحمل البيولوجي المتوقع سيصل إلى ${Math.round(projectedRatio*100)}% من القدرة التقديرية.`,
      en:`Projected bioload will reach ${Math.round(projectedRatio*100)}% of estimated capacity.`
    });
  }
  if(projectedStatus==="danger"){
    issues.push({
      level:"danger",
      ar:`الحمل البيولوجي المتوقع سيصل إلى ${Math.round(projectedRatio*100)}%، وهو مستوى خطر.`,
      en:`Projected bioload will reach ${Math.round(projectedRatio*100)}%, a dangerous level.`
    });
  }

  let level:CompatibilityLevel="good";
  if(issues.some(x=>x.level==="danger")) level="danger";
  else if(issues.some(x=>x.level==="warn")) level="warn";

  return {
    level,
    issues,
    currentRatio:current.ratio,
    projectedRatio,
    projectedStatus,
    requiresConfirmation:level==="danger"
  };
}
