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
  blocked: boolean;
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

function displayName(entry:any,lang:"ar"|"en"){
  return lang==="ar"?(entry?.ar||entry?.en||entry?.id||""):(entry?.en||entry?.ar||entry?.id||"");
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

  if(candidate?.type && candidate.type!==tank.type){
    issues.push({level:"danger",ar:"هذا الكائن غير مناسب لنوع الحوض الحالي.",en:"This organism is not suitable for the current aquarium type."});
  }

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
  const candidateCategory=mappedCategory(candidate?.cat);
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

  // Reverse compatibility matters too: adding a coral/invert/plant into a tank that already
  // contains an unsafe fish must be evaluated from the existing animal's perspective.
  if(candidateCategory==="coral"){
    const unsafe=currentEntries.filter(({catalog})=>catalog&&(catalog.reefSafe===false||catalog.reefSafe==="caution"||tags(catalog).includes("coralRisk")));
    const hard=unsafe.find(({catalog})=>catalog?.reefSafe===false);
    if(unsafe.length){
      issues.push({
        level:hard?"danger":"warn",
        ar:`يوجد حالياً ${displayName((hard||unsafe[0]).catalog,"ar")} وقد لا يكون آمناً مع المرجان الجديد.`,
        en:`${displayName((hard||unsafe[0]).catalog,"en")} is already in the tank and may not be safe with the new coral.`
      });
    }
  }

  if(candidateCategory==="invert"){
    const unsafe=currentEntries.filter(({catalog})=>catalog&&(catalog.invertSafe===false||catalog.invertSafe==="caution"||tags(catalog).includes("shrimpRisk")));
    const hard=unsafe.find(({catalog})=>catalog?.invertSafe===false);
    if(unsafe.length){
      issues.push({
        level:hard?"danger":"warn",
        ar:`يوجد حالياً ${displayName((hard||unsafe[0]).catalog,"ar")} وقد يشكل خطراً على اللافقاري الجديد.`,
        en:`${displayName((hard||unsafe[0]).catalog,"en")} is already in the tank and may threaten the new invertebrate.`
      });
    }
  }

  if(tank.type==="freshwater"&&candidateCategory==="plant"){
    const unsafe=currentEntries.filter(({catalog})=>catalog&&(catalog.plantSafe===false||catalog.plantSafe==="caution"));
    const hard=unsafe.find(({catalog})=>catalog?.plantSafe===false);
    if(unsafe.length){
      issues.push({
        level:hard?"danger":"warn",
        ar:`يوجد حالياً ${displayName((hard||unsafe[0]).catalog,"ar")} وقد يضر بالنبات الجديد.`,
        en:`${displayName((hard||unsafe[0]).catalog,"en")} is already in the tank and may damage the new plant.`
      });
    }
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
      ar:`يوجد كائن مفترس حالياً (${displayName(existingPredator.catalog,"ar")}) قد يهدد هذا الكائن.`,
      en:`An existing predator (${displayName(existingPredator.catalog,"en")}) may threaten this organism.`
    });
  }

  const incompatibleWith=new Set<string>(Array.isArray(candidate?.incompatibleWith)?candidate.incompatibleWith:[]);
  for(const {catalog} of currentEntries){
    if(!catalog)continue;
    const reverse=new Set<string>(Array.isArray(catalog.incompatibleWith)?catalog.incompatibleWith:[]);
    if(incompatibleWith.has(catalog.id)||reverse.has(candidate?.id)){
      issues.push({
        level:"danger",
        ar:`تعارض مباشر معروف بين ${candidate.ar||candidate.en} و${catalog.ar||catalog.en}.`,
        en:`A direct known incompatibility exists between ${candidate.en||candidate.ar} and ${catalog.en||catalog.ar}.`
      });
    }
  }

  const aggressiveCandidate=candidateTags.some(x=>["aggressive","semiAggressive","territorial","finNipper"].includes(x));
  const aggressiveExisting=currentEntries.some(({catalog})=>catalog && tags(catalog).some((x:string)=>["aggressive","semiAggressive","territorial","finNipper"].includes(x)));
  if(candidateCategory==="fish" && aggressiveCandidate && aggressiveExisting){
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
  const blocked=level==="danger";

  return {
    level,
    issues,
    currentRatio:current.ratio,
    projectedRatio,
    projectedStatus,
    requiresConfirmation:level==="warn",
    blocked
  };
}


export interface TankCompatibilityAudit {
  score:number;
  level:CompatibilityLevel;
  issues:CompatibilityIssue[];
  dangerCount:number;
  warningCount:number;
}

function pushUniqueIssue(list:CompatibilityIssue[],issue:CompatibilityIssue){
  if(!list.some(x=>x.level===issue.level&&x.ar===issue.ar))list.push(issue);
}

export function auditTankCompatibility(tank:Tank):TankCompatibilityAudit {
  const issues:CompatibilityIssue[]=[];
  const rows=tank.livestock.map(item=>({item,catalog:catalogById(item.libraryId)}));
  const hasCorals=tank.livestock.some(x=>x.category==="coral");
  const hasInverts=tank.livestock.some(x=>x.category==="invert");
  const hasPlants=tank.livestock.some(x=>x.category==="plant");

  for(const {item,catalog} of rows){
    if(!catalog)continue;
    const nameAr=displayName(catalog,"ar")||item.name;
    const nameEn=displayName(catalog,"en")||item.nameEn||item.name;

    if(Number(catalog.min||0)>tank.systemVolumeLiters){
      pushUniqueIssue(issues,{
        level:"danger",
        ar:`${nameAr}: حجم النظام ${tank.systemVolumeLiters.toFixed(0)} لتر أقل من الحد المقترح ${catalog.min} لتر.`,
        en:`${nameEn}: system volume ${tank.systemVolumeLiters.toFixed(0)} L is below the suggested minimum of ${catalog.min} L.`
      });
    }

    if(catalog.schoolMin){
      const total=tank.livestock.filter(x=>x.libraryId===catalog.id).reduce((s,x)=>s+x.quantity,0);
      if(total<catalog.schoolMin){
        pushUniqueIssue(issues,{
          level:"warn",
          ar:`${nameAr}: العدد الحالي ${total} بينما هذا النوع يفضل مجموعة لا تقل عن ${catalog.schoolMin}.`,
          en:`${nameEn}: current group size is ${total}, while this species prefers at least ${catalog.schoolMin}.`
        });
      }
    }

    const t=tags(catalog);
    if(hasCorals&&(catalog.reefSafe===false||catalog.reefSafe==="caution"||t.includes("coralRisk"))){
      pushUniqueIssue(issues,{
        level:catalog.reefSafe===false?"danger":"warn",
        ar:`${nameAr} قد يعض أو يزعج المرجان الموجود.`,
        en:`${nameEn} may nip or disturb existing corals.`
      });
    }
    if(hasInverts&&(catalog.invertSafe===false||catalog.invertSafe==="caution"||t.includes("shrimpRisk"))){
      pushUniqueIssue(issues,{
        level:catalog.invertSafe===false?"danger":"warn",
        ar:`${nameAr} قد يشكل خطراً على القشريات أو اللافقاريات الموجودة.`,
        en:`${nameEn} may threaten existing crustaceans or invertebrates.`
      });
    }
    if(tank.type==="freshwater"&&hasPlants&&(catalog.plantSafe===false||catalog.plantSafe==="caution")){
      pushUniqueIssue(issues,{
        level:catalog.plantSafe===false?"danger":"warn",
        ar:`${nameAr} قد يضر بالنباتات الموجودة.`,
        en:`${nameEn} may damage existing plants.`
      });
    }
  }

  for(let i=0;i<rows.length;i++){
    const a=rows[i].catalog;if(!a)continue;
    for(let j=i+1;j<rows.length;j++){
      const b=rows[j].catalog;if(!b)continue;
      const aBad=new Set<string>(Array.isArray(a.incompatibleWith)?a.incompatibleWith:[]);
      const bBad=new Set<string>(Array.isArray(b.incompatibleWith)?b.incompatibleWith:[]);
      if(aBad.has(b.id)||bBad.has(a.id)){
        pushUniqueIssue(issues,{
          level:"danger",
          ar:`تعارض مباشر معروف بين ${displayName(a,"ar")} و${displayName(b,"ar")}.`,
          en:`A direct known incompatibility exists between ${displayName(a,"en")} and ${displayName(b,"en")}.`
        });
      }
      const at=tags(a),bt=tags(b);
      if(at.includes("predator")&&isSmallPrey(b)){
        pushUniqueIssue(issues,{level:"danger",ar:`${displayName(a,"ar")} مفترس وقد يهدد ${displayName(b,"ar")}.`,en:`${displayName(a,"en")} is predatory and may threaten ${displayName(b,"en")}.`});
      }
      if(bt.includes("predator")&&isSmallPrey(a)){
        pushUniqueIssue(issues,{level:"danger",ar:`${displayName(b,"ar")} مفترس وقد يهدد ${displayName(a,"ar")}.`,en:`${displayName(b,"en")} is predatory and may threaten ${displayName(a,"en")}.`});
      }
      const aAgg=at.some(x=>["aggressive","semiAggressive","territorial","finNipper"].includes(x));
      const bAgg=bt.some(x=>["aggressive","semiAggressive","territorial","finNipper"].includes(x));
      if(mappedCategory(a.cat)==="fish"&&mappedCategory(b.cat)==="fish"&&aAgg&&bAgg){
        pushUniqueIssue(issues,{
          level:"warn",
          ar:`احتمال نزاع أو عدوانية بين ${displayName(a,"ar")} و${displayName(b,"ar")}.`,
          en:`Possible territorial/aggression conflict between ${displayName(a,"en")} and ${displayName(b,"en")}.`
        });
      }
    }
  }

  const dangerCount=issues.filter(x=>x.level==="danger").length;
  const warningCount=issues.filter(x=>x.level==="warn").length;
  const score=Math.max(0,Math.round(100-dangerCount*25-warningCount*8));
  const level:CompatibilityLevel=dangerCount?"danger":warningCount?"warn":"good";
  return {score,level,issues,dangerCount,warningCount};
}
