import { describe,expect,it } from "vitest";
import { demoFreshwaterTank,demoMarineTank } from "@/data/demoTank";
import { parseAquaQuestion,resolveAquaFollowup } from "@/domain/aquaAIIntent";
import { buildAquaAIQueryPlan } from "@/domain/aquaAIQueryPlan";
import { aquaAIAnswer } from "@/domain/aquaAIBrain";
import { completeMaintenanceTask,maintenanceEffectiveState } from "@/domain/maintenanceSchedule";
import { systemAlerts } from "@/domain/alertEngine";
import { chemistryGuidance } from "@/domain/chemistryGuidance";
import { chemistryHealthAssessment } from "@/domain/health";
import { findNearDuplicateChemistryReading,latestParameterSample,measuredChemistryReadings,validateChemistryValue,validateDosingTarget,weeklyChemistryCoverage } from "@/domain/chemistryDataQuality";
import { rodiIntelligence } from "@/domain/rodiIntelligence";
import { sumpIntelligence } from "@/domain/sumpIntelligence";
import { stockingReadiness } from "@/domain/stockingReadiness";
import { auditTankCompatibility } from "@/domain/compatibility";
import { tankStateView } from "@/domain/tankIntelligence";
import { tankIntelligenceCore } from "@/domain/intelligenceCore";
import { systemHealthTrend } from "@/domain/systemHealth";
import { deriveGuidanceActions } from "@/domain/impactEngine";
import { deriveIntelligenceEvents,mergeIntelligenceEvents } from "@/domain/eventIntelligence";
import { coralTransferGate } from "@/domain/acclimationSafety";
import { allowedAcclimationCategories,livestockCategoryFromAcclimation,normalizeAcclimationCategory } from "@/domain/acclimationCategories";
import { correctiveDosingInventory,inventoryForConsumer,inventoryProfile,inventorySubcategoryOptions,routineDosingInventory } from "@/domain/inventoryIntelligence";
import { consumeInventory } from "@/domain/inventoryConsumption";
import { fitChamberToSump,sumpChamberContents } from "@/domain/sumpOperations";
import { validateBackupPayload,validateTankImportPayload } from "@/domain/backupValidation";
import { visionDiseaseCandidates } from "@/domain/visionDifferential";
import { buildVisionTriage } from "@/domain/visionIntelligence";
import { sanitizeVisionQuestion,validateVisionDataUrl } from "@/domain/visionRequestSafety";
import { biologicalCycleStatus,cycleRelevantMaintenanceTask,isCyclePageAllowed } from "@/domain/biologicalCycle";
import { biologicalCycleKnowledgeSnapshot } from "@/domain/biologicalCycleKnowledge";
import { isAquariumScopedQuestion } from "@/domain/aquaAIScope";
import { diseaseEntriesFor,diseaseGroupCounts } from "@/domain/diseaseCatalog";
import { doseStepExecutionGate,requiresPostDoseRetest } from "@/domain/dosingSafety";
import { waterChangeIntelligence } from "@/domain/waterChangeIntelligence";
import { biologicalMemory,eventChemistryLinks } from "@/domain/tankLearning";
import { repeatedResponsePatterns,tankLearningMaturity } from "@/domain/tankPatterns";
import { claimCriticalAction,releaseCriticalAction } from "@/lib/actionGuard";
import { deriveExtendedIntelligenceEvents } from "@/domain/extendedEventIntelligence";
import { buildTankBrainSnapshot } from "@/domain/tankBrainSnapshot";
import { buildTankAIContext } from "@/domain/aiContext";
import { validateAbsencePlan,validateAcclimationItemEntry,validateAcclimationWater,validateDoserChannelEntry,validateEquipmentEntry,validateExpenseEntry,validateGrowthMeasurement,validateInventoryEntry,validateLivestockEntry,validateRodiEntry,validateTreatmentSetup,validateWaterChangeEntry } from "@/domain/inputSanity";
import { photoNeedsExternalization } from "@/lib/photoStorage";
import { interventionDensityAlert,interventionGate } from "@/domain/interventionSafety";
import { createActionPlan,evaluatePlanOutcome } from "@/domain/actionPlanEngine";
import { activeRelocation,activeVacation,archivedPageAllowed,isTankArchived } from "@/domain/tankLifecycle";
import { TANK_EVENT_COVERAGE,eventedTankFields } from "@/domain/eventCoverage";
import { domainOutcomeLearning } from "@/domain/outcomeLearning";
import { historyPage } from "@/domain/historyPagination";
import { buildVacationTaskDrafts,vacationDays } from "@/domain/vacationPlan";
import { defaultLightingProgram,estimatedParAt,lightingCalibrationFactor,lightingGrid,lightingIntelligence,lightingPlacementRecommendations,lightingSchedule } from "@/domain/lightingIntelligence";
import { lightingCandidateToProgram,normalizeLightingImportCandidate } from "@/domain/lightingImport";
import { equipmentImportIntelligence,normalizeEquipmentImportCandidate,parseGenericEquipmentExport } from "@/domain/equipmentImport";
import { prepareEquipmentImportApplication } from "@/domain/equipmentImportApply";
import { addLocalCalendarDays,isMeaningfullyFutureTimestamp } from "@/domain/timeSafety";

const tank=structuredClone(demoMarineTank);

describe("Local Best AI routing regression",()=>{
  const cases=[
    ["الحمل البيولوجي عندي","bioload"],
    ["شو وضع الكيميا","chemistry"],
    ["كيف اعمل صيانة للسكيمر","maintenance"],
    ["ايمتى المهمة الجاية للصيانة","maintenance"],
    ["شو ناقصني معدات","equipment"],
    ["شو وضع ال RODI","rodi"],
    ["شو ناقص بالمخزون","inventory"],
    ["شو وضع الحجر","quarantine"],
    ["شو وضع السامب","sump"],
    ["قديش مصاريف الحوض","expenses"]
  ] as const;
  for(const [q,domain] of cases)it(q,()=>expect(buildAquaAIQueryPlan(parseAquaQuestion(q)).primary).toBe(domain));
});

describe("Local Best AI behavior regression",()=>{
  it("keeps identity separate from fish questions",()=>{
    const a=aquaAIAnswer("شو اسمك",tank,"dashboard");
    expect(a.titleAr).toContain("Local Best AI");
  });
  it("answers skimmer how-to with practical steps",()=>{
    const a=aquaAIAnswer("كيف اعمل صيانة للسكيمر",tank,"equipment");
    expect(a.detailsAr.length).toBeGreaterThan(3);
    expect(a.summaryAr).toMatch(/صيانة|سكيمر/);
  });
  it("answers next maintenance with timing rather than generic health",()=>{
    const a=aquaAIAnswer("ايمتى المهمة الجاية للصيانة؟",tank,"maintenance");
    expect(a.titleAr).toMatch(/موعد|صيانة/);
    expect(a.detailsAr.join(" ")).toMatch(/دورية|تنفيذ|موعد/);
  });
  it("routes what-if livestock simulations",()=>{
    const intent=parseAquaQuestion("لو ضفت ناسو تانغ شو بصير؟");
    expect(intent.mode).toBe("whatIf");
    const a=aquaAIAnswer("لو ضفت ناسو تانغ شو بصير؟",tank,"livestock");
    expect(a.titleAr).toMatch(/محاكاة|ناسو/);
    expect(a.detailsAr.join(" ")).toMatch(/الحمل|مانع|تنبيه/);
  });
  it("gives whole-system answer for broad status",()=>{
    const a=aquaAIAnswer("شو وضع الحوض بشكل عام",tank,"dashboard");
    expect(a.summaryAr).toMatch(/الصحة|الحوض|النظام/);
  });
  it("keeps off-topic questions outside the aquarium scope with a playful redirect",()=>{
    expect(isAquariumScopedQuestion("مين فاز بكأس العالم؟",tank)).toBe(false);
    const a=aquaAIAnswer("مين فاز بكأس العالم؟",tank,"dashboard");
    expect(a.titleAr).toMatch(/الحوض/);
    expect(a.summaryAr).toMatch(/😄/);
    expect(a.action?.page).toBe("dashboard");
  });
  it("still accepts aquarium questions and current livestock names",()=>{
    expect(isAquariumScopedQuestion("شو وضع السكيمر؟",tank)).toBe(true);
    const named=tank.livestock[0]?.name;
    if(named)expect(isAquariumScopedQuestion("شو وضع "+named+"؟",tank)).toBe(true);
  });
});


describe("Disease taxonomy regression",()=>{
  it("returns marine fish diseases when fish category is selected",()=>{
    const rows=diseaseEntriesFor("marine","fish","");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(x=>x.group==="fish")).toBe(true);
  });
  it("preserves non-fish disease categories instead of returning an empty catalog",()=>{
    const marine=diseaseGroupCounts("marine");
    expect(marine.crustacean).toBeGreaterThan(0);
    expect(marine.coral).toBeGreaterThan(0);
    const freshwater=diseaseGroupCounts("freshwater");
    expect(freshwater.plant).toBeGreaterThan(0);
  });
});

describe("Core system regression",()=>{
  it("recurring maintenance becomes due again on its next cycle",()=>{
    const done=completeMaintenanceTask({id:"m1",title:"Test",cadence:"weekly",done:false,nextDue:"2026-09-01"},"2026-09-01");
    expect(maintenanceEffectiveState(done,"2026-09-02").completed).toBe(true);
    expect(maintenanceEffectiveState(done,"2026-09-08").due).toBe(true);
    expect(maintenanceEffectiveState(done,"2026-09-08").completed).toBe(false);
  });
  it("unified alerts surface equipment failures",()=>{
    const t=structuredClone(demoMarineTank);
    t.equipment=[...t.equipment,{id:"broken-return",name:"Broken Return",kind:"returnPump",location:"external",status:"warning"}];
    const alerts=systemAlerts(t);
    expect(alerts.some(x=>x.domain==="equipment")).toBe(true);
  });
});


describe("Safety and data-integrity regression",()=>{
  it("treats low-confidence chemistry as a data issue",()=>{
    const t=structuredClone(demoMarineTank);
    t.chemistry[0]={...t.chemistry[0],confidence:"low"};
    const guide=chemistryGuidance(t);
    expect(guide.dataIssues.length).toBeGreaterThan(0);
    expect(guide.headlineEn).toMatch(/low confidence/i);
  });

  it("RODI cannot be good when membrane rejection is poor",()=>{
    const t=structuredClone(demoMarineTank);
    t.rodi=[{id:"r1",timestamp:new Date().toISOString(),tdsIn:10,tdsOut:1,liters:20,wasteLiters:60}];
    expect(rodiIntelligence(t).status).not.toBe("good");
  });

  it("uses measured sump drain-back when a power-off test is recorded",()=>{
    const t=structuredClone(demoMarineTank);
    t.sump.enabled=true;
    t.sump.measuredDrainbackLiters=42;
    const audit=sumpIntelligence(t);
    expect(audit.drainbackSource).toBe("measured");
    expect(audit.drainbackEstimate).toBe(42);
  });
});

describe("Cross-workflow catastrophe prevention",()=>{
  it("requires a fresh chemistry reading after a corrective dose",()=>{
    const t=structuredClone(demoMarineTank);
    const readingAt="2026-09-20T10:00:00.000Z";
    t.chemistry=[{timestamp:readingAt,values:{KH:6.8},confidence:"high",source:"manual"}];
    t.dosing=[{id:"dose-1",timestamp:"2026-09-20T10:05:00.000Z",lastExecutedAt:"2026-09-20T10:06:00.000Z",parameter:"KH",current:6.8,target:8,ml:10,amount:10,unit:"mL",calculatorMode:"product",status:"logged",sourceReadingTimestamp:readingAt}];
    expect(requiresPostDoseRetest(t,"KH",readingAt)).toBe(true);
    t.chemistry.unshift({timestamp:"2026-09-20T12:00:00.000Z",values:{KH:7.2},confidence:"high",source:"manual"});
    expect(requiresPostDoseRetest(t,"KH",t.chemistry[0].timestamp)).toBe(false);
  });
  it("classifies very large or compounded water changes as dangerous",()=>{
    const t=structuredClone(demoMarineTank);
    t.chemistry=[{timestamp:new Date().toISOString(),values:{salinity:1.025,temperature:25,NO3:35,PO4:.25},confidence:"high",source:"manual"}];
    expect(waterChangeIntelligence(t,60,1.025,25).risk).toBe("danger");
    expect(waterChangeIntelligence(t,40,1.020,21).risk).toBe("danger");
    expect(waterChangeIntelligence(t,15,1.025,25).risk).toBe("normal");
  });
  it("detects a likely accidental duplicate chemistry reading",()=>{
    const t=structuredClone(demoMarineTank);
    t.chemistry=[{timestamp:new Date().toISOString(),values:{KH:7.1,Ca:450},confidence:"high",source:"manual"}];
    expect(findNearDuplicateChemistryReading(t,{KH:7.1,Ca:450},10)).toBeTruthy();
    expect(findNearDuplicateChemistryReading(t,{KH:7.2,Ca:450},10)).toBeFalsy();
  });
  it("rejects immediate duplicate execution claims for the same critical action",()=>{
    const key="test-action-"+Date.now();
    releaseCriticalAction(key);
    expect(claimCriticalAction(key,2000)).toBe(true);
    expect(claimCriticalAction(key,2000)).toBe(false);
    releaseCriticalAction(key);
    expect(claimCriticalAction(key,2000)).toBe(true);
    releaseCriticalAction(key);
  });
});

describe("Realistic tank-story intelligence",()=>{
  it("connects livestock death, nutrient rise, overdue maintenance, water change and recovery without claiming causation",()=>{
    const t=structuredClone(demoMarineTank);
    t.timeline=[];t.chemistry=[];t.waterChanges=[];t.livestockExits=[];t.maintenance=[];
    t.chemistry=[
      {timestamp:"2026-09-05T12:00:00.000Z",values:{NO3:22,PO4:.12,KH:7.4},confidence:"high",source:"manual"},
      {timestamp:"2026-09-03T12:00:00.000Z",values:{NO3:35,PO4:.20,KH:7.4},confidence:"high",source:"manual"},
      {timestamp:"2026-09-01T12:00:00.000Z",values:{NO3:20,PO4:.12,KH:7.5},confidence:"high",source:"manual"}
    ];
    t.timeline=[
      {id:"wc",timestamp:"2026-09-04T12:00:00.000Z",type:"waterchange",textAr:"تم تغيير 20% من الماء",textEn:"20% water change completed"},
      {id:"death",timestamp:"2026-09-02T12:00:00.000Z",type:"livestock-death",textAr:"وفاة Candy Cane وإزالة الأنسجة الميتة",textEn:"Candy Cane death and dead tissue removed"}
    ];
    t.waterChanges=[{id:"wc1",timestamp:"2026-09-04T12:00:00.000Z",liters:100,percent:20}];
    t.livestockExits=[{id:"exit1",timestamp:"2026-09-02T12:00:00.000Z",livestockId:"candy",name:"Candy Cane",category:"coral",quantity:1,reason:"death",bodyRemoved:true}];
    t.maintenance=[{id:"socks",title:"تنظيف الجرابات",titleEn:"Clean filter socks",cadence:"weekly",done:false,nextDue:"2026-09-02"}];
    const links=eventChemistryLinks(t);
    const death=links.find(x=>x.event.id==="death");
    const wc=links.find(x=>x.event.id==="wc");
    expect(death?.chemistryChanges.some(x=>x.parameter==="NO3"&&x.delta>0)).toBe(true);
    expect(wc?.chemistryChanges.some(x=>x.parameter==="NO3"&&x.delta<0)).toBe(true);
    expect((wc?.en||"").toLowerCase()).toContain("after");
    expect(biologicalMemory(t).some(x=>x.event.id==="death"||x.event.id==="wc")).toBe(true);
    expect(maintenanceEffectiveState(t.maintenance[0],"2026-09-05").overdue).toBe(true);
  });

  it("raises Tank Brain maturity as tank-specific evidence accumulates across months",()=>{
    const t=structuredClone(demoMarineTank);
    const now=Date.now();
    t.chemistry=Array.from({length:40},(_,i)=>({timestamp:new Date(now-(39-i)*9*86400000).toISOString(),values:{KH:8-i*.01,NO3:15+(i%3)},confidence:"high" as const,source:"manual" as const}));
    t.timeline=Array.from({length:20},(_,i)=>({id:"hist-"+i,timestamp:new Date(now-(19-i)*15*86400000).toISOString(),type:"maintenance",textAr:"صيانة دورية",textEn:"Routine maintenance"}));
    const maturity=tankLearningMaturity(t);
    expect(maturity.measuredReadings).toBe(40);
    expect(maturity.observedDays).toBeGreaterThan(300);
    expect(maturity.score).toBeGreaterThanOrEqual(50);
    expect(maturity.level).not.toBe("early");
  });

  it("learns a repeated tank-specific maintenance response instead of presenting it as causation",()=>{
    const t=structuredClone(demoMarineTank);
    t.timeline=[
      {id:"m2",timestamp:"2026-08-20T12:00:00.000Z",type:"maintenance",textAr:"تنظيف الفلتر",textEn:"Filter cleaning"},
      {id:"m1",timestamp:"2026-08-10T12:00:00.000Z",type:"maintenance",textAr:"تنظيف الفلتر",textEn:"Filter cleaning"}
    ];
    t.chemistry=[
      {timestamp:"2026-08-22T12:00:00.000Z",values:{NO3:20},confidence:"high",source:"manual"},
      {timestamp:"2026-08-19T12:00:00.000Z",values:{NO3:30},confidence:"high",source:"manual"},
      {timestamp:"2026-08-12T12:00:00.000Z",values:{NO3:24},confidence:"high",source:"manual"},
      {timestamp:"2026-08-09T12:00:00.000Z",values:{NO3:34},confidence:"high",source:"manual"}
    ];
    const patterns=repeatedResponsePatterns(t);
    const p=patterns.find(x=>x.eventType==="maintenance"&&x.parameter==="NO3");
    expect(p).toBeTruthy();
    expect(p?.direction).toBe("down");
    expect((p?.en||"").toLowerCase()).toContain("not proof of causation");
  });
});

describe("Chemistry safety and measurement integrity",()=>{
  it("returns unknown rather than a fake chemistry score when no measurements exist",()=>{const t=structuredClone(demoMarineTank);t.chemistry=[];const a=chemistryHealthAssessment(t);expect(a.score).toBeNull();expect(a.level).toBe("unknown");});
  it("keeps parameters independent when a partial reading is logged",()=>{const t=structuredClone(demoMarineTank);t.chemistry=[{timestamp:"2026-09-19T08:00:00.000Z",values:{KH:7.5},confidence:"high",source:"manual"},{timestamp:"2026-09-18T08:00:00.000Z",values:{KH:7,Ca:500,Mg:1200,NO3:35,PO4:.25},confidence:"high",source:"manual"}];expect(latestParameterSample(t,"KH")?.value).toBe(7.5);expect(latestParameterSample(t,"Ca")?.timestamp).toBe("2026-09-18T08:00:00.000Z");});
  it("does not complete weekly chemistry from one partial parameter",()=>{const t=structuredClone(demoMarineTank);t.chemistry=[{timestamp:new Date().toISOString(),values:{KH:7.5},confidence:"high",source:"manual"}];expect(weeklyChemistryCoverage(t).complete).toBe(false);});
  it("blocks implausible values",()=>{const t=structuredClone(demoMarineTank);expect(validateChemistryValue(t,"salinity",1025)).toBeTruthy();expect(validateChemistryValue(t,"KH",-2)).toBeTruthy();});
  it("makes an out-of-safe-range parameter critical regardless of average",()=>{const t=structuredClone(demoMarineTank);t.chemistry=[{timestamp:new Date().toISOString(),values:{temperature:25,pH:8.1,salinity:1.025,KH:8,Ca:430,Mg:1300,NO3:10,PO4:.08,NH3:.5},confidence:"high",source:"manual"}];const a=chemistryHealthAssessment(t);expect(a.critical).toBe(true);expect(a.criticalKeys).toContain("NH3");});
  it("blocks dosing targets outside the safe profile range",()=>{const t=structuredClone(demoMarineTank);expect(validateDosingTarget(t,"KH",20).blocked).toBe(true);expect(validateDosingTarget(t,"KH",8).blocked).toBe(false);});
});


describe("Release-candidate safety consistency",()=>{
  it("uses one readiness decision for missing chemistry evidence",()=>{
    const t=structuredClone(demoMarineTank);t.chemistry=[];
    const r=stockingReadiness(t);
    expect(r.state).toBe("insufficient_evidence");
    expect(r.canProceed).toBe(false);
    expect(r.missingEvidenceAr.length).toBeGreaterThan(0);
  });
  it("blocks stocking when chemistry has a hard safety violation",()=>{
    const t=structuredClone(demoMarineTank);
    t.chemistry=[{timestamp:new Date().toISOString(),values:{salinity:1.025,pH:8.1,KH:8,Ca:430,Mg:1300,NO3:10,PO4:.08,NH3:.5},confidence:"high",source:"manual"}];
    const r=stockingReadiness(t);
    expect(r.state).toBe("not_now");
    expect(r.blockersAr.join(" ")).toMatch(/NH3|الكيمياء/);
  });
  it("never calls a chemically critical tank stable",()=>{
    const t=structuredClone(demoMarineTank);
    t.chemistry=[{timestamp:new Date().toISOString(),values:{salinity:1.025,pH:8.1,KH:8,Ca:430,Mg:1300,NO3:10,PO4:.08,NH3:.5},confidence:"high",source:"manual"}];
    expect(tankStateView(t).band).toBe("critical");
  });
  it("reports compatibility coverage for manually entered species",()=>{
    const t=structuredClone(demoMarineTank);
    t.livestock=[...t.livestock,{id:"manual-x",name:"Unknown species",category:"fish",quantity:1,health:"good",load:1}];
    const a=auditTankCompatibility(t);
    expect(a.verifiedCoverage).toBeLessThan(100);
    expect(a.knownCount).toBeLessThan(a.totalCount);
  });
  it("ignores snapshot bursts when calculating trend",()=>{
    const t=structuredClone(demoMarineTank);
    const now=Date.now();
    t.healthSnapshots=[
      {id:"n",timestamp:new Date(now).toISOString(),score:90,chemistry:90,maintenance:90,state:"excellent",reasonAr:"",reasonEn:""},
      {id:"p",timestamp:new Date(now-5*60000).toISOString(),score:70,chemistry:70,maintenance:70,state:"watch",reasonAr:"",reasonEn:""}
    ];
    expect(systemHealthTrend(t)).toBe("unknown");
  });
  it("keeps recurring overdue maintenance active even when an old done flag remains",()=>{
    const t=structuredClone(demoMarineTank);
    t.maintenance=[{id:"cycle",title:"Weekly service",titleEn:"Weekly service",cadence:"weekly",done:true,lastDone:"2020-01-01",nextDue:"2020-01-08"}];
    const actions=deriveGuidanceActions(t);
    expect(actions.some(x=>x.dedupeKey==="maintenance:overdue:cycle")).toBe(true);
  });
  it("records recurring overdue maintenance as an omission event",()=>{
    const before=structuredClone(demoMarineTank),after=structuredClone(demoMarineTank);
    before.maintenance=[];before.intelligenceEvents=[];
    after.maintenance=[{id:"cycle",title:"Weekly service",titleEn:"Weekly service",cadence:"weekly",done:true,lastDone:"2020-01-01",nextDue:"2020-01-08"}];
    after.intelligenceEvents=[];
    const events=deriveIntelligenceEvents(before,after);
    expect(events.some(x=>x.domain==="maintenance"&&x.kind==="omission"&&x.entityId==="cycle")).toBe(true);
  });
  it("uses separated snapshots for a meaningful trend",()=>{
    const t=structuredClone(demoMarineTank);
    const now=Date.now();
    t.healthSnapshots=[
      {id:"n",timestamp:new Date(now).toISOString(),score:90,chemistry:90,maintenance:90,state:"excellent",reasonAr:"",reasonEn:""},
      {id:"p",timestamp:new Date(now-24*3600000).toISOString(),score:80,chemistry:80,maintenance:80,state:"stable",reasonAr:"",reasonEn:""}
    ];
    expect(systemHealthTrend(t)).toBe("improving");
  });
});

describe("Aqua AI expert evaluation matrix",()=>{
 const routing=[
  ["شو المشاكل بالكيميا","chemistry"],["شو غلط بالقراءات","chemistry"],["chemistry issues","chemistry"],
  ["السكيمر كيف صيانته","maintenance"],["how should I service the skimmer","maintenance"],
  ["شو مهمة الصيانة التالية","maintenance"],["what maintenance is next","maintenance"],
  ["فيني نزل سمك هلا","livestock"],["can i add fish now","livestock"],
  ["ليش النيترات عم ترتفع","chemistry"],["شو اعمل لل PO4","chemistry"],
  ["قديش ضايل بالمخزون","inventory"],["شو اكل اليوم","feeding"],["ايمتى غير مي","water"]
 ] as const;
 for(const [q,d] of routing)it(`routes: ${q}`,()=>expect(buildAquaAIQueryPlan(parseAquaQuestion(q)).primary).toBe(d));

 it("keeps follow-up anchored to prior tank topic",()=>{
  const first="شو المشاكل بالكيميا";
  const resolved=resolveAquaFollowup("طيب ليش؟",first,[{question:first,resolved:first,mode:"status",topics:["chemistry"],params:[]}]);
  expect(resolved).toContain(first);expect(buildAquaAIQueryPlan(parseAquaQuestion(resolved)).primary).toBe("chemistry");
 });
 it("carries action follow-up without losing chemistry domain",()=>{
  const first="شو المشاكل بالكيميا";
  const second=resolveAquaFollowup("شو اعمل؟",first,[{question:first,resolved:first,topics:["chemistry"],params:[]}]);
  const i=parseAquaQuestion(second);expect(i.mode).toBe("action");expect(buildAquaAIQueryPlan(i).primary).toBe("chemistry");
 });
 it("exposes missing evidence instead of false readiness",()=>{
  const t=structuredClone(demoMarineTank);t.chemistry=[];t.livestock=[];
  const a=aquaAIAnswer("فيني ضيف سمك هلا؟",t,"livestock");
  expect(a.confidence).toBe("low");expect(a.missingEvidenceAr?.length).toBeGreaterThan(0);expect(a.summaryAr).toMatch(/ما في بيانات كافية|ناقص/);
 });
 it("separates facts from inferences in normal answers",()=>{
  const a=aquaAIAnswer("شو وضع الكيميا",tank,"chemistry");
  expect(a.factsAr?.length).toBeGreaterThan(0);expect(Array.isArray(a.inferencesAr)).toBe(true);
 });
});


describe("Inventory data-integrity regression",()=>{
  it("keeps feeding stock isolated from dosing stock",()=>{
    const t=structuredClone(demoMarineTank);
    t.inventory=[
      {id:"food",name:"Mysis",inventoryCategory:"feeding",inventorySubcategory:"frozen_food",tankCompatibility:"marine",consumedBy:["feeding"],stockBehavior:"consumable",quantity:20,unit:"cube",minimum:2},
      {id:"afr",name:"All For Reef",inventoryCategory:"dosing",inventorySubcategory:"balanced_reef",tankCompatibility:"marine",consumedBy:["dosing"],stockBehavior:"consumable",quantity:500,unit:"mL",minimum:50}
    ];
    expect(inventoryForConsumer(t,"feeding").map(x=>x.id)).toEqual(["food"]);
  });
  it("keeps All For Reef out of corrective KH/Ca/Mg inventory",()=>{
    const t=structuredClone(demoMarineTank);
    t.inventory=[
      {id:"afr",presetId:"allForReef",name:"All For Reef",quantity:500,unit:"mL",minimum:50},
      {id:"bicarb",name:"Sodium bicarbonate",inventoryCategory:"dosing",inventorySubcategory:"alkalinity",tankCompatibility:"marine",consumedBy:["dosing"],stockBehavior:"consumable",dosingParameter:"KH",dosingCompoundId:"nahco3",quantity:200,unit:"g",minimum:20}
    ];
    expect(correctiveDosingInventory(t,"KH","dry","nahco3").map(x=>x.id)).toEqual(["bicarb"]);
    expect(routineDosingInventory(t).map(x=>x.id)).toContain("afr");
  });
  it("classifies medication for quarantine and not general dosing",()=>{
    const med={id:"med",name:"Cupramine copper medication",quantity:100,unit:"mL",minimum:10};
    const profile=inventoryProfile(med);
    expect(profile.category).toBe("medication");
    expect(profile.consumedBy).toContain("quarantine");
  });
  it("classifies phosphate remover as filter media rather than fertilizer",()=>{
    const profile=inventoryProfile({id:"po4",name:"Phosphate Remover",quantity:100,unit:"g",minimum:10});
    expect(profile.category).toBe("filter_media");
  });
});



describe("AI Vision safety and differential regression",()=>{
  it("accepts compact supported image data and rejects unsupported or oversized payloads",()=>{
    expect(validateVisionDataUrl("data:image/jpeg;base64,AA==",1024).ok).toBe(true);
    expect(validateVisionDataUrl("data:image/heic;base64,AA==",1024).ok).toBe(false);
    const oversized="data:image/jpeg;base64,"+"A".repeat(5000);
    expect(validateVisionDataUrl(oversized,100).ok).toBe(false);
  });
  it("sanitizes excessively long Vision questions",()=>{
    expect(sanitizeVisionQuestion("x".repeat(5000),120).length).toBe(120);
  });
  it("escalates rapid breathing and tissue loss while keeping confidence bounded",()=>{
    const fish=structuredClone(demoMarineTank);
    fish.livestock=[{id:"fish-v",name:"Fish",category:"fish",quantity:1,health:"watch",load:1}];
    const result=buildVisionTriage(fish,{livestockId:"fish-v",symptoms:["rapidBreathing"],metrics:{colorIndex:40,brightnessIndex:50,captureScore:80,clarityIndex:75}});
    expect(result.level).toBe("urgent");
    expect(result.confidenceScore).toBeLessThanOrEqual(88);
    expect(result.nextEn.join(" ")).toMatch(/ammonia|surface agitation/i);
  });
  it("uses prior comparable captures as evidence without turning them into a diagnosis",()=>{
    const coral=structuredClone(demoMarineTank);
    coral.livestock=[{id:"coral-v",name:"Coral",category:"coral",quantity:1,health:"watch",load:1}];
    const result=buildVisionTriage(coral,{livestockId:"coral-v",symptoms:["paleColor"],metrics:{colorIndex:35,brightnessIndex:54,captureScore:82,clarityIndex:72,blueDominancePercent:30},previousMetrics:{colorIndex:45,brightnessIndex:52,captureScore:80,clarityIndex:70,blueDominancePercent:29}});
    expect(result.comparisonEn).toBeTruthy();
    expect(result.summaryEn.toLowerCase()).not.toMatch(/confirmed diagnosis|definitive diagnosis/);
  });
  it("maps marine fish white spots to marine disease references only",()=>{
    const t=structuredClone(demoMarineTank);
    t.livestock=[{id:"fish1",name:"Test fish",category:"fish",quantity:1,health:"watch",load:1}];
    const ids=visionDiseaseCandidates(t,"fish1",["whiteSpots","rapidBreathing"]).map(x=>x.id);
    expect(ids).toContain("m_ich");
    expect(ids.some(x=>x.startsWith("f_"))).toBe(false);
  });
  it("maps coral tissue loss to coral references without claiming a diagnosis",()=>{
    const t=structuredClone(demoMarineTank);
    t.livestock=[{id:"coral1",name:"Test coral",category:"coral",quantity:1,health:"watch",load:1}];
    const candidates=visionDiseaseCandidates(t,"coral1",["tissueLoss"]);
    expect(candidates.some(x=>x.id==="c_tissue"||x.id==="c_brownjelly"||x.id==="c_rtn")).toBe(true);
    expect(candidates.every(x=>x.score>0)).toBe(true);
  });
});

describe("Biological cycling gate",()=>{
  it("does not treat elapsed time alone as cycle readiness",()=>{
    const t=structuredClone(demoMarineTank);
    t.isTraining=false;t.status="cycling";t.createdAt=new Date(Date.now()-35*86400000).toISOString();
    t.biologicalCycle={startedAt:t.createdAt};
    t.chemistry=[];
    const state=biologicalCycleStatus(t);
    expect(state.active).toBe(true);
    expect(state.day).toBeGreaterThanOrEqual(35);
    expect(state.ready).toBe(false);
  });
  it("unlocks only after source evidence and two spaced clear marine readings",()=>{
    const t=structuredClone(demoMarineTank);
    t.isTraining=false;t.status="cycling";
    const now=Date.now();
    t.createdAt=new Date(now-4*86400000).toISOString();
    t.biologicalCycle={startedAt:t.createdAt,sourceAddedAt:new Date(now-3*86400000).toISOString(),method:"fishless"};
    t.chemistry=[
      {timestamp:new Date(now-1*3600000).toISOString(),usingDefaults:false,values:{NH3:0,NO3:8}},
      {timestamp:new Date(now-14*3600000).toISOString(),usingDefaults:false,values:{NH3:0,NO3:6}},
      {timestamp:new Date(now-30*3600000).toISOString(),usingDefaults:false,values:{NH3:1.0,NO3:0}}
    ];
    const state=biologicalCycleStatus(t);
    expect(state.processingEvidence).toBe(true);
    expect(state.twoConsecutiveClear).toBe(true);
    expect(state.ready).toBe(true);
  });
  it("requires nitrite clearance for freshwater confirmation",()=>{
    const t=structuredClone(demoFreshwaterTank);
    t.isTraining=false;t.status="cycling";
    const now=Date.now();
    t.biologicalCycle={startedAt:new Date(now-3*86400000).toISOString(),sourceAddedAt:new Date(now-2*86400000).toISOString()};
    t.chemistry=[
      {timestamp:new Date(now-1*3600000).toISOString(),usingDefaults:false,values:{NH3:0,NO2:.10,NO3:15}},
      {timestamp:new Date(now-14*3600000).toISOString(),usingDefaults:false,values:{NH3:0,NO2:0,NO3:12}},
      {timestamp:new Date(now-30*3600000).toISOString(),usingDefaults:false,values:{NH3:.5,NO2:.3,NO3:2}}
    ];
    expect(biologicalCycleStatus(t).ready).toBe(false);
  });
  it("locks stocking and non-cycle workflow pages during cycling",()=>{
    const t=structuredClone(demoMarineTank);
    t.isTraining=false;t.status="cycling";t.biologicalCycle={startedAt:new Date().toISOString()};
    expect(stockingReadiness(t).state).toBe("not_now");
    expect(isCyclePageAllowed("chemistry")).toBe(true);
    expect(isCyclePageAllowed("emergency")).toBe(true);
    expect(isCyclePageAllowed("livestock")).toBe(false);
    expect(isCyclePageAllowed("feeding")).toBe(false);
    expect(isCyclePageAllowed("dosing")).toBe(false);
  });
  it("keeps only cycle-related maintenance tasks in cycle-only mode",()=>{
    expect(cycleRelevantMaintenanceTask({id:"c",title:"فحص كيمياء الدورة البيولوجية",cadence:"weekly",done:false,sourceDomain:"system",sourceId:"cycle:chemistry"})).toBe(true);
    expect(cycleRelevantMaintenanceTask({id:"x",title:"Clean display glass",cadence:"weekly",done:false})).toBe(false);
  });
  it("keeps Local Best AI from recommending dosing while cycling",()=>{
    const t=structuredClone(demoMarineTank);
    t.isTraining=false;t.status="cycling";t.biologicalCycle={startedAt:new Date().toISOString()};
    const answer=aquaAIAnswer("قديش جرعة KH حط هلا؟",t,"dashboard");
    expect(answer.titleEn).toMatch(/Biological cycle/i);
    expect(answer.action?.page).not.toBe("dosing");
  });
  it("explains a stalled ammonia cycle from tank-specific evidence",()=>{
    const t=structuredClone(demoFreshwaterTank);
    const now=Date.now();
    t.isTraining=false;t.status="cycling";
    t.biologicalCycle={startedAt:new Date(now-10*86400000).toISOString(),sourceAddedAt:new Date(now-9*86400000).toISOString(),method:"fishless"};
    t.chemistry=[
      {timestamp:new Date(now-2*3600000).toISOString(),usingDefaults:false,values:{NH3:1.1,NO2:0,pH:6.3,temperature:25}},
      {timestamp:new Date(now-30*3600000).toISOString(),usingDefaults:false,values:{NH3:1.12,NO2:0,pH:6.3,temperature:25}}
    ];
    const snapshot=biologicalCycleKnowledgeSnapshot(t);
    expect(snapshot.issues.map(x=>x.id)).toContain("ammonia-stalled");
    expect(snapshot.issues.map(x=>x.id)).toContain("low-ph");
    const answer=aquaAIAnswer("ليش الأمونيا ما عم تنزل بالدورة؟",t,"chemistry");
    expect(answer.titleAr).toMatch(/الأمونيا/);
    expect(answer.detailsAr.join(" ")).toMatch(/pH|أكسج|اختبار/);
    expect(answer.action?.page).toBe("chemistry");
  });
  it("knows that a normal water change does not reset the biofilter",()=>{
    const t=structuredClone(demoMarineTank);
    t.isTraining=false;t.status="cycling";t.biologicalCycle={startedAt:new Date().toISOString(),sourceAddedAt:new Date().toISOString()};
    const answer=aquaAIAnswer("غيرت مي، رجعت الدورة البيولوجية من الأول؟",t,"maintenance");
    expect(answer.summaryAr).toMatch(/عادة|لا/);
    expect(answer.detailsAr.join(" ")).toMatch(/الميديا|الكلور|الفلتر/);
  });
  it("treats bottled bacteria as acceleration, not proof of readiness",()=>{
    const t=structuredClone(demoMarineTank);
    t.isTraining=false;t.status="cycling";t.biologicalCycle={startedAt:new Date().toISOString(),bacteriaSeededAt:new Date().toISOString()};
    const answer=aquaAIAnswer("حطيت بكتيريا جاهزة، يعني الدورة خلصت؟",t,"maintenance");
    expect(answer.summaryAr).toMatch(/ما بيعتبرو|ما.*إثبات|إثبات/);
    expect(answer.detailsAr.join(" ")).toMatch(/أمونيا|القياس/);
  });
});

describe("AI Vision request safety",()=>{
  it("accepts supported small image data URLs",()=>{
    expect(validateVisionDataUrl("data:image/jpeg;base64,aGVsbG8=").ok).toBe(true);
  });
  it("rejects unsupported image types and malformed payloads",()=>{
    expect(validateVisionDataUrl("data:image/svg+xml;base64,aGVsbG8=").ok).toBe(false);
    expect(validateVisionDataUrl("data:image/png;base64,%%%").ok).toBe(false);
  });
  it("enforces the configured decoded image size limit",()=>{
    const payload="A".repeat(1400);
    expect(validateVisionDataUrl("data:image/png;base64,"+payload,100).ok).toBe(false);
  });
  it("caps external Vision questions before provider calls",()=>{
    expect(sanitizeVisionQuestion("x".repeat(3000)).length).toBe(2400);
  });
});

describe("Backup and taxonomy hardening",()=>{
  it("accepts a structurally valid backup and preserves the selected tank",()=>{
    const source=structuredClone(demoMarineTank);
    const result=validateBackupPayload({language:"en",selectedTankId:source.id,tanks:[source]});
    expect(result.ok).toBe(true);
    if(result.ok)expect(result.data.selectedTankId).toBe(source.id);
  });
  it("rejects malformed tank data before replacing local state",()=>{
    const bad={...structuredClone(demoMarineTank),systemVolumeLiters:-5};
    expect(validateBackupPayload({language:"ar",selectedTankId:bad.id,tanks:[bad]}).ok).toBe(false);
    expect(validateTankImportPayload({tanks:[bad]}).ok).toBe(false);
  });
  it("rejects duplicate tank ids in a backup",()=>{
    const a=structuredClone(demoMarineTank),b=structuredClone(demoMarineTank);
    expect(validateBackupPayload({language:"ar",selectedTankId:a.id,tanks:[a,b]}).ok).toBe(false);
  });
  it("offers standardized fertilizer and dosing subcategories",()=>{
    expect(inventorySubcategoryOptions("fertilizer").map(x=>x.value)).toContain("potassium");
    expect(inventorySubcategoryOptions("dosing").map(x=>x.value)).toContain("balanced_reef");
  });

  it("rejects a backup created by a newer unsupported schema",()=>{
    const source=structuredClone(demoMarineTank);
    expect(validateBackupPayload({schemaVersion:999,language:"en",selectedTankId:source.id,tanks:[source]}).ok).toBe(false);
  });
  it("rejects nested corrupted inventory before restore",()=>{
    const source=structuredClone(demoMarineTank);
    source.inventory=[{id:"bad-stock",name:"Bad stock",quantity:-5,unit:"g",minimum:0} as any];
    const result=validateBackupPayload({schemaVersion:10,language:"en",selectedTankId:source.id,tanks:[source]});
    expect(result.ok).toBe(false);
  });
});

describe("Operations consumables regression",()=>{
  it("consumes multiple inventory requests atomically without going negative",()=>{
    const inventory=[
      {id:"a",name:"Conditioner",quantity:100,unit:"mL",minimum:10},
      {id:"b",name:"Aquarium Salt",quantity:500,unit:"g",minimum:50}
    ];
    const result=consumeInventory(inventory,[
      {inventoryItemId:"a",quantity:5,role:"conditioner"},
      {inventoryItemId:"b",quantity:20,role:"freshwater_salt"}
    ]);
    expect(result.ok).toBe(true);
    if(result.ok){
      expect(result.inventory.find(x=>x.id==="a")?.quantity).toBe(95);
      expect(result.inventory.find(x=>x.id==="b")?.quantity).toBe(480);
      expect(result.uses).toHaveLength(2);
    }
  });
  it("blocks inventory consumption when any requested item is insufficient",()=>{
    const inventory=[{id:"x",name:"DI Resin",quantity:2,unit:"L",minimum:0}];
    const result=consumeInventory(inventory,[{inventoryItemId:"x",quantity:3,role:"rodi_di"}]);
    expect(result.ok).toBe(false);
    expect(inventory[0].quantity).toBe(2);
  });
  it("keeps sump chambers inside resized sump dimensions",()=>{
    const fitted=fitChamberToSump({id:"c",name:"C",x:80,y:30,length:40,width:30,height:50,waterHeight:45,media:[]},{length:90,width:40,height:35});
    expect(fitted.x+fitted.length).toBeLessThanOrEqual(90);
    expect(fitted.y+fitted.width).toBeLessThanOrEqual(40);
    expect(fitted.height).toBe(35);
    expect(fitted.waterHeight).toBeLessThanOrEqual(35);
  });
  it("shows real sump equipment and tracked media in chamber contents",()=>{
    const t=structuredClone(demoMarineTank);
    t.sump.enabled=true;
    t.sump.chambers=[{id:"c1",name:"Skimmer",x:0,y:0,length:30,width:30,height:35,waterHeight:25,media:[],items:["Probe rack"]}];
    t.equipment=[{id:"eq1",name:"Protein Skimmer",kind:"skimmer",location:"sump:c1",status:"on"}];
    t.filterMedia=[{id:"fm1",name:"GFO",kind:"gfo",amountGrams:100,installedAt:"2026-09-20",referenceLifeDays:30,chamberId:"c1"}];
    const contents=sumpChamberContents(t,t.sump.chambers[0]);
    expect(contents.equipment).toContain("Protein Skimmer");
    expect(contents.filterMedia).toContain("GFO");
    expect(contents.manual).toContain("Probe rack");
  });
  it("recognizes legacy water prep and RODI stock by purpose",()=>{
    expect(inventoryProfile({id:"c",name:"Water Conditioner",quantity:100,unit:"mL",minimum:10}).subcategory).toBe("conditioner");
    expect(inventoryProfile({id:"s",name:"Sediment Filter 5 micron",quantity:2,unit:"pc",minimum:1}).subcategory).toBe("sediment_filter");
    expect(inventoryProfile({id:"d",name:"DI Resin",quantity:2,unit:"L",minimum:.2}).subcategory).toBe("di_resin");
  });
});

describe("Tank-aware acclimation categories",()=>{
  it("never exposes freshwater plants as a marine acclimation category",()=>{
    expect(allowedAcclimationCategories("marine")).toEqual(["fish","invert","coral","macroalgae"]);
    expect(allowedAcclimationCategories("freshwater")).toEqual(["fish","invert","plant"]);
  });
  it("maps known marine library plants to macroalgae but rejects arbitrary marine plants",()=>{
    expect(normalizeAcclimationCategory("marine","plant","plant")).toBe("macroalgae");
    expect(normalizeAcclimationCategory("marine","plant","")).toBeNull();
    expect(normalizeAcclimationCategory("marine","macroalgae","")).toBe("macroalgae");
  });
  it("rejects coral and macroalgae in freshwater acclimation",()=>{
    expect(normalizeAcclimationCategory("freshwater","coral","coral")).toBeNull();
    expect(normalizeAcclimationCategory("freshwater","macroalgae","")).toBeNull();
  });
  it("preserves macroalgae identity after transfer to livestock",()=>{
    expect(livestockCategoryFromAcclimation("macroalgae")).toEqual({category:"plant",subtype:"macroalgae"});
  });
});

describe("Acclimation coral dip safety",()=>{
  const baseSession:any={
    id:"acs-test",startedAt:new Date().toISOString(),status:"release",floatConfirmed:true,
    coralDipEnabled:true,coralDipMinutes:10,coralDipRuns:[],coralDipSkippedItemIds:[],items:[],events:[]
  };
  const coral:any={id:"coral-1",name:"Test Coral",category:"coral",quantity:1,health:"good",dripMinutes:20,intervalMinutes:5,placement:"",status:"ready"};
  it("blocks coral transfer until a dip is recorded and rinsed",()=>{
    expect(coralTransferGate(baseSession,coral).allowed).toBe(false);
    const running={...baseSession,coralDipRuns:[{id:"dip-1",batchId:"coral-1",itemIds:[coral.id],productName:"Dip",inventoryItemId:"inv-1",quantityUsed:10,unit:"mL",durationMinutes:10,status:"running",startedAt:new Date().toISOString(),endAt:Date.now()+600000}]};
    expect(coralTransferGate(running,coral).allowed).toBe(false);
    const rinseNeeded={...running,coralDipRuns:[{...running.coralDipRuns[0],status:"ready_to_rinse",endAt:null}]};
    expect(coralTransferGate(rinseNeeded,coral).allowed).toBe(false);
    const rinsed={...rinseNeeded,coralDipRuns:[{...rinseNeeded.coralDipRuns[0],status:"rinsed",rinsedAt:new Date().toISOString()}]};
    expect(coralTransferGate(rinsed,coral).allowed).toBe(true);
  });
  it("allows an explicitly logged distress exception without pretending dip completed",()=>{
    const skipped={...baseSession,coralDipSkippedItemIds:[coral.id]};
    const gate=coralTransferGate(skipped,coral);
    expect(gate.allowed).toBe(true);
    expect(gate.reasonEn).toMatch(/explicitly skipped/i);
  });
  it("surfaces a finished dip as a central rinse action",()=>{
    const t=structuredClone(demoMarineTank);
    t.acclimationSessions=[{...baseSession,items:[coral],coralDipRuns:[{id:"dip-rinse",batchId:"coral-1",itemIds:[coral.id],productName:"Dip",inventoryItemId:"inv-dip",quantityUsed:10,unit:"mL",durationMinutes:10,status:"ready_to_rinse",startedAt:new Date(Date.now()-600000).toISOString(),completedAt:new Date().toISOString()}]}];
    const actions=deriveGuidanceActions(t);
    expect(actions.some(x=>x.dedupeKey==="acclimation:coral-dip:dip-rinse:rinse"&&x.status==="ready")).toBe(true);
  });
  it("blocks the next dip preparation when linked inventory is insufficient",()=>{
    const t=structuredClone(demoMarineTank);
    t.inventory=[{id:"inv-dip",name:"Coral Dip",quantity:5,unit:"mL",minimum:0}];
    t.acclimationSessions=[{...baseSession,items:[coral],coralDipInventoryItemId:"inv-dip",coralDipQuantityPerPrep:10}];
    const actions=deriveGuidanceActions(t);
    expect(actions.some(x=>x.dedupeKey==="acclimation:coral-dip:stock:acs-test"&&x.status==="blocked")).toBe(true);
  });
  it("records dip start and rinse as acclimation intelligence events",()=>{
    const before=structuredClone(demoMarineTank),running=structuredClone(demoMarineTank);
    const run:any={id:"dip-event",batchId:"coral-1",itemIds:[coral.id],productName:"Dip",inventoryItemId:"inv-dip",quantityUsed:10,unit:"mL",durationMinutes:10,status:"running",startedAt:new Date().toISOString(),endAt:Date.now()+600000};
    before.acclimationSessions=[{...baseSession,items:[coral],coralDipRuns:[]}];
    running.acclimationSessions=[{...baseSession,items:[coral],coralDipRuns:[run]}];
    const startEvents=deriveIntelligenceEvents(before,running);
    expect(startEvents.some(x=>x.domain==="acclimation"&&x.verb==="coral_dip_started"&&x.entityId==="dip-event")).toBe(true);
    const rinsed=structuredClone(running);
    rinsed.acclimationSessions![0].coralDipRuns![0]={...run,status:"rinsed",endAt:null,rinsedAt:new Date().toISOString()};
    const rinseEvents=deriveIntelligenceEvents(running,rinsed);
    expect(rinseEvents.some(x=>x.domain==="acclimation"&&x.verb==="coral_dip_rinsed"&&x.entityId==="dip-event")).toBe(true);
  });
});



describe("Full audit hardening regressions",()=>{
  it("exposes previously isolated domains in the canonical Tank Brain",()=>{
    const t=structuredClone(demoFreshwaterTank);
    t.plantedMode="highTech";
    t.substrateType="nutrient";
    t.rodiServiceEvents=[{id:"rs1",timestamp:"2026-09-20T10:00:00Z",component:"di"}];
    t.plantCare=[{id:"pc1",timestamp:"2026-09-20T11:00:00Z",kind:"fertilizer"}];
    t.doserChannels=[{id:"dc1",name:"Channel 1",material:"KH",capacityMl:1000,currentMl:700,consumption:10,period:"daily",color:"#fff"}];
    (t as any).aiActionPlans=[{id:"plan-1",status:"active"}];
    const brain=buildTankBrainSnapshot(t);
    expect(brain.identity.plantedMode).toBe("highTech");
    expect(brain.identity.substrateType).toBe("nutrient");
    expect(brain.operations.rodiServiceEvents).toHaveLength(1);
    expect(brain.operations.plantCare).toHaveLength(1);
    expect(brain.equipment.doserChannels).toHaveLength(1);
    expect(brain.intelligence.aiActionPlans).toHaveLength(1);
    expect(brain.coverage.aiActionPlans).toBe(1);
  });

  it("turns plant care and RODI service into first-class intelligence events",()=>{
    const before=structuredClone(demoFreshwaterTank),after=structuredClone(demoFreshwaterTank);
    after.plantCare=[{id:"pc-event",timestamp:"2026-09-20T11:00:00Z",kind:"fertilizer",notes:"test"}];
    after.rodiServiceEvents=[{id:"rodi-service-event",timestamp:"2026-09-20T12:00:00Z",component:"di"}];
    const events=deriveExtendedIntelligenceEvents(before,after);
    expect(events.some(x=>x.domain==="plantCare"&&x.verb==="fertilized")).toBe(true);
    expect(events.some(x=>x.domain==="rodi"&&x.verb==="service_completed")).toBe(true);
  });

  it("captures detailed acclimation item state changes in Tank Brain memory",()=>{
    const before=structuredClone(demoMarineTank),after=structuredClone(demoMarineTank);
    const item:any={id:"a1",name:"Sensitive Shrimp",category:"invert",quantity:1,health:"fair",dripMinutes:45,intervalMinutes:15,placement:"",status:"acclimating",remainingMs:600000};
    const session:any={id:"s1",startedAt:"2026-09-20T10:00:00Z",status:"drip",floatConfirmed:true,items:[item],events:[]};
    before.acclimationSessions=[session];
    after.acclimationSessions=[{...session,items:[{...item,status:"emergency",health:"stressed",emergency:true,remainingMs:180000}]}];
    const events=deriveExtendedIntelligenceEvents(before,after);
    expect(events.some(x=>x.domain==="acclimation"&&x.verb==="item_exception"&&x.entityId==="a1")).toBe(true);
  });

  it("uses a cross-domain evidence plan for chemistry cause questions",()=>{
    const plan=buildAquaAIQueryPlan(parseAquaQuestion("ليش NO3 ارتفع؟"));
    expect(plan.primary).toBe("chemistry");
    expect(plan.crossDomain).toBe(true);
    expect(plan.allowedSources).toContain("maintenance");
    expect(plan.allowedSources).toContain("equipment");
    expect(plan.allowedSources).toContain("livestock");
  });

  it("blocks implausible RODI data before it can enter tank history",()=>{
    expect(validateRodiEntry({tdsIn:150,tdsOut:3,liters:20,wasteLiters:60,productionMinutes:60,sourcePressurePsi:60}).ok).toBe(true);
    expect(validateRodiEntry({tdsIn:150,tdsOut:9000,liters:20,wasteLiters:60,productionMinutes:60,sourcePressurePsi:60}).ok).toBe(false);
    expect(validateRodiEntry({tdsIn:150,tdsOut:200,liters:20,wasteLiters:60,productionMinutes:60,sourcePressurePsi:60}).ok).toBe(false);
  });


  it("records field-level equipment, livestock and sump configuration changes",()=>{
    const before=structuredClone(demoMarineTank),after=structuredClone(demoMarineTank);
    after.equipment[0]={...after.equipment[0],powerWatts:(after.equipment[0].powerWatts??20)+5,backupPlan:"spare pump ready"};
    after.livestock[0]={...after.livestock[0],notes:"feeding response improved",sizeCm:12};
    after.sump={...after.sump,operatingFillPercent:Math.max(1,after.sump.operatingFillPercent-3)};
    const events=deriveExtendedIntelligenceEvents(before,after);
    expect(events.some(x=>x.domain==="equipment"&&x.verb==="configuration_changed")).toBe(true);
    expect(events.some(x=>x.domain==="livestock"&&x.verb==="observation_updated")).toBe(true);
    expect(events.some(x=>x.domain==="sump"&&x.verb==="configuration_changed")).toBe(true);
  });

  it("replaces coalesced event snapshots instead of silently dropping later edits",()=>{
    const oldEvent:any={id:"evt-equipment-configuration_changed-eq1:123",timestamp:"2026-09-21T01:00:00Z",kind:"fact",domain:"equipment",verb:"configuration_changed",entityId:"eq1",textAr:"قديم",textEn:"old"};
    const newEvent:any={...oldEvent,timestamp:"2026-09-21T01:00:20Z",textAr:"جديد",textEn:"new"};
    const merged=mergeIntelligenceEvents([oldEvent],[newEvent]);
    expect(merged).toHaveLength(1);
    expect(merged[0].textEn).toBe("new");
  });

  it("applies sanity checks across operational numeric domains",()=>{
    expect(validateEquipmentEntry({serviceIntervalDays:90,powerWatts:50,hoursPerDay:24,ratedVolumeLiters:500,flowLph:5000,parAtTargetDepth:250,coverageLengthCm:120,coverageWidthCm:60}).ok).toBe(true);
    expect(validateEquipmentEntry({serviceIntervalDays:0,powerWatts:-1,hoursPerDay:30,ratedVolumeLiters:500,flowLph:5000,parAtTargetDepth:250,coverageLengthCm:120,coverageWidthCm:60}).ok).toBe(false);
    expect(validateInventoryEntry({quantity:50,minimum:10,unit:"mL",name:"Supplement"}).ok).toBe(true);
    expect(validateInventoryEntry({quantity:-2,minimum:0,unit:"mL",name:"Supplement"}).ok).toBe(false);
    expect(validateExpenseEntry({amount:12,description:"Salt",currency:"USD"}).ok).toBe(true);
    expect(validateExpenseEntry({amount:-1,description:"Salt",currency:"USD"}).ok).toBe(false);
    expect(validateWaterChangeEntry({liters:50,systemVolumeLiters:500,salinity:1.025,temperature:25}).ok).toBe(true);
    expect(validateWaterChangeEntry({liters:600,systemVolumeLiters:500,salinity:1.025,temperature:25}).ok).toBe(false);
    expect(validateDoserChannelEntry({capacityMl:1000,currentMl:500,consumption:10}).ok).toBe(true);
    expect(validateDoserChannelEntry({capacityMl:500,currentMl:900,consumption:10}).ok).toBe(false);
  });

  it("evaluates AI plans from the target domain instead of only whole-tank score",()=>{
    const baseline=structuredClone(demoMarineTank);
    baseline.chemistry=[{timestamp:"2026-09-21T00:00:00Z",values:{KH:6},source:"manual",confidence:"high"}];
    const answer=aquaAIAnswer("KH منخفض شو اعمل؟",baseline,"chemistry");
    const plan=createActionPlan(baseline,"KH منخفض شو اعمل؟",answer);
    expect(plan.focus?.domain).toBe("chemistry");
    const after=structuredClone(baseline);
    after.chemistry=[{timestamp:"2026-09-21T12:00:00Z",values:{KH:7.8},source:"manual",confidence:"high"}];
    const result=evaluatePlanOutcome(after,plan);
    expect(result.usedDomainMetrics).toBe(true);
    expect(result.details.some(x=>x.key==="chem:KH"&&x.result==="improved")).toBe(true);
    expect(result.outcome).toBe("improved");
  });


  it("keeps Tank Brain bounded with multi-year operational history",()=>{
    const t=structuredClone(demoMarineTank);
    const base=Date.now();
    t.chemistry=Array.from({length:6000},(_,i)=>({timestamp:new Date(base-i*86400000).toISOString(),values:{KH:8-(i%5)*.1,NO3:10+(i%7)}}));
    t.timeline=Array.from({length:12000},(_,i)=>({id:`long-${i}`,timestamp:new Date(base-i*3600000).toISOString(),type:"history",textAr:`حدث ${i}`,textEn:`Event ${i}`}));
    t.feeding=Array.from({length:5000},(_,i)=>({id:`feed-${i}`,timestamp:new Date(base-i*86400000).toISOString(),food:"Food",amount:"1"}));
    t.waterChanges=Array.from({length:3000},(_,i)=>({id:`wc-${i}`,timestamp:new Date(base-i*7*86400000).toISOString(),liters:50,percent:10}));
    const brain=buildTankBrainSnapshot(t);
    expect(brain.chemistry.recent.length).toBeLessThanOrEqual(40);
    expect(brain.operations.feeding.length).toBeLessThanOrEqual(60);
    expect(brain.operations.waterChanges.length).toBeLessThanOrEqual(60);
    expect(brain.intelligence.timeline.length).toBeLessThanOrEqual(120);
    expect(JSON.stringify(brain).length).toBeLessThan(1_500_000);
  });

  it("rejects unsafe treatment and acclimation numeric inputs",()=>{
    expect(validateTreatmentSetup({volumeLiters:40,labelDoseMlPer100L:5,intervalHours:24,totalDoses:4}).ok).toBe(true);
    expect(validateTreatmentSetup({volumeLiters:40,labelDoseMlPer100L:5000,intervalHours:0,totalDoses:4}).ok).toBe(false);
    expect(validateAcclimationItemEntry({quantity:2,dripMinutes:45,intervalMinutes:15}).ok).toBe(true);
    expect(validateAcclimationItemEntry({quantity:2,dripMinutes:900,intervalMinutes:15}).ok).toBe(false);
    expect(validateAcclimationWater({salinity:1.025,temperature:25,dipMinutes:10,dipQuantity:5}).ok).toBe(true);
    expect(validateAcclimationWater({salinity:1.25,temperature:90,dipMinutes:500,dipQuantity:5}).ok).toBe(false);
  });

  it("externalizes even legacy thumbnail payloads once a full asset already exists",()=>{
    const legacy:any={id:"photo-old",timestamp:"2026-09-20T12:00:00Z",caption:"legacy",dataUrl:"data:image/jpeg;base64,AAAA",assetKey:"photo:old:full",fullResolutionStored:true};
    const compact:any={...legacy,dataUrl:"",previewKey:"photo:old:preview"};
    expect(photoNeedsExternalization(legacy)).toBe(true);
    expect(photoNeedsExternalization(compact)).toBe(false);
  });

  it("moves large photo payloads out of persisted tank state",()=>{
    const large:any={id:"p1",timestamp:"2026-09-20T12:00:00Z",caption:"test",dataUrl:"data:image/jpeg;base64,"+"A".repeat(150000)};
    const small:any={...large,id:"p2",dataUrl:"data:image/jpeg;base64,"+"A".repeat(1000)};
    expect(photoNeedsExternalization(large)).toBe(true);
    expect(photoNeedsExternalization(small)).toBe(true);
  });
});



describe("Tank lifecycle completion",()=>{
  it("puts vacation, relocation and archive state into Tank Brain and events",()=>{
    const before=structuredClone(demoMarineTank),after=structuredClone(demoMarineTank),now=new Date().toISOString();
    after.lifecycle={
      vacations:[{id:"vac-1",startedAt:now,plannedEndAt:"2026-10-01"}],
      relocations:[{id:"move-1",startedAt:now,status:"in_progress",from:"Old room",to:"New room"}],
      restarts:[{id:"restart-1",timestamp:now,reason:"full rebuild"}],
      archivedAt:now,archiveReason:"retired"
    };
    const brain=buildTankBrainSnapshot(after);
    const events=deriveExtendedIntelligenceEvents(before,after);
    expect(brain.lifecycle?.archivedAt).toBe(now);
    expect(events.some(x=>x.verb==="vacation_started")).toBe(true);
    expect(events.some(x=>x.verb==="relocation_started")).toBe(true);
    expect(events.some(x=>x.verb==="major_restart")).toBe(true);
    expect(events.some(x=>x.verb==="tank_archived")).toBe(true);
  });
  it("locks operational work for archived tanks but leaves recovery/reporting available",()=>{
    const t=structuredClone(demoMarineTank);t.lifecycle={archivedAt:new Date().toISOString()};
    expect(isTankArchived(t)).toBe(true);
    expect(archivedPageAllowed("dosing")).toBe(false);
    expect(archivedPageAllowed("reports")).toBe(true);
    expect(archivedPageAllowed("settings")).toBe(true);
    expect(interventionGate(t,"correctiveDosing").blocked).toBe(true);
  });
  it("treats relocation as a real safety state",()=>{
    const t=structuredClone(demoMarineTank),now=new Date().toISOString();
    t.lifecycle={vacations:[{id:"vac",startedAt:now}],relocations:[{id:"move",startedAt:now,status:"in_progress"}]};
    expect(activeVacation(t)?.id).toBe("vac");
    expect(activeRelocation(t)?.id).toBe("move");
    expect(interventionGate(t,"livestockAddition").blocked).toBe(true);
    expect(interventionGate(t,"correctiveDosing").level).toBe("danger");
  });
});

describe("Whole-tank intervention safety",()=>{
  it("blocks a new livestock addition when intervention density is dangerous",()=>{
    const now=new Date().toISOString(),t=structuredClone(demoMarineTank);
    t.intelligenceEvents=[
      {id:"stock-e1",timestamp:now,kind:"action",domain:"waterChange",verb:"water_changed",confidence:100,sourcePage:"waterchange",textAr:"تغيير ماء",textEn:"Water change"},
      {id:"stock-e2",timestamp:now,kind:"action",domain:"sump",verb:"media_replaced",confidence:100,sourcePage:"sump",textAr:"ميديا",textEn:"Media"},
      {id:"stock-e3",timestamp:now,kind:"action",domain:"equipment",verb:"installed",confidence:100,sourcePage:"equipment",textAr:"جهاز",textEn:"Equipment"}
    ];
    const readiness=stockingReadiness(t,{candidateKnown:false,candidateLabelAr:"نوع يدوي",candidateLabelEn:"manual species"});
    expect(readiness.state).toBe("not_now");
    expect(readiness.blockersEn.some(x=>/major interventions|rapid-change risk/i.test(x))).toBe(true);
  });
  it("warns before stacking a second major intervention",()=>{
    const t=structuredClone(demoMarineTank);
    t.intelligenceEvents=[{id:"e1",timestamp:new Date().toISOString(),kind:"action",domain:"waterChange",verb:"water_changed",value:20,unit:"%",confidence:100,sourcePage:"waterchange",textAr:"تغيير ماء",textEn:"Water change"}];
    const gate=interventionGate(t,"correctiveDosing");
    expect(gate.level).toBe("warn");
    expect(gate.recent).toHaveLength(1);
  });
  it("escalates several different recent interventions",()=>{
    const now=new Date().toISOString(),t=structuredClone(demoMarineTank);
    t.intelligenceEvents=[
      {id:"e1",timestamp:now,kind:"action",domain:"waterChange",verb:"water_changed",value:20,unit:"%",confidence:100,sourcePage:"waterchange",textAr:"تغيير ماء",textEn:"Water change"},
      {id:"e2",timestamp:now,kind:"action",domain:"sump",verb:"media_replaced",confidence:100,sourcePage:"sump",textAr:"ميديا",textEn:"Media"},
      {id:"e3",timestamp:now,kind:"action",domain:"livestock",verb:"added",confidence:100,sourcePage:"livestock",textAr:"كائن",textEn:"Livestock"}
    ];
    const gate=interventionGate(t,"correctiveDosing");
    expect(gate.level).toBe("danger");
    expect(interventionDensityAlert(t)?.level).toBe("danger");
  });
  it("does not hard-block documented emergency work",()=>{
    const now=new Date().toISOString(),t=structuredClone(demoMarineTank);
    t.intelligenceEvents=[{id:"e1",timestamp:now,kind:"action",domain:"waterChange",verb:"water_changed",confidence:100,sourcePage:"waterchange",textAr:"تغيير ماء",textEn:"Water change"}];
    t.emergencySessions=[{id:"em1",protocolId:"x",titleAr:"طوارئ",titleEn:"Emergency",startedAt:now,status:"active",completedSteps:[]} as any];
    const gate=interventionGate(t,"correctiveDosing");
    expect(gate.blocked).toBe(false);
    expect(gate.en).toMatch(/emergency/i);
  });
});


describe("Recovery torture checks",()=>{
  it("rejects malformed lifecycle recovery payloads",()=>{
    const bad:any={app:"Aqua Nexus",schemaVersion:2,exportedAt:new Date().toISOString(),language:"ar",selectedTankId:demoMarineTank.id,tanks:[{...structuredClone(demoMarineTank),lifecycle:{vacations:[{id:"v1",startedAt:"not-a-date"}]}}]};
    const result=validateBackupPayload(bad);
    expect(result.ok).toBe(false);
  });
  it("rejects malformed AI action-plan recovery data",()=>{
    const bad:any={app:"Aqua Nexus",schemaVersion:2,exportedAt:new Date().toISOString(),language:"ar",selectedTankId:demoMarineTank.id,tanks:[{...structuredClone(demoMarineTank),aiActionPlans:[{id:"p1",createdAt:"bad",steps:"not-an-array"}]}]};
    const result=validateBackupPayload(bad);
    expect(result.ok).toBe(false);
  });
});

describe("Final hardening contracts",()=>{
  it("keeps every Tank field under an explicit event-coverage policy",()=>{
    const modes=Object.values(TANK_EVENT_COVERAGE);
    expect(modes.length).toBeGreaterThan(35);
    expect(modes.every(x=>["evented","derived","immutable","recovery-exempt"].includes(x))).toBe(true);
    expect(eventedTankFields).toContain("display");
    expect(eventedTankFields).toContain("aiActionPlans");
    expect(eventedTankFields).toContain("lifecycle");
  });


  it("runtime coverage checkpoint catches evented-field changes even without relying on a specialized event",()=>{
    const before=structuredClone(demoMarineTank) as any,after=structuredClone(demoMarineTank) as any;
    after.visionAssessments=[{id:"vision-contract",timestamp:new Date().toISOString(),photoId:"photo-x",symptoms:[],metrics:{colorIndex:50,brightnessIndex:50,captureScore:50},triage:{level:"monitor",confidence:"low",summaryAr:"اختبار",summaryEn:"test",engine:"local-best"},modelStatus:"local-best",engine:"local-best",external:{status:"not_requested"},diseaseCandidateIds:[]}];
    after.feeding=[{id:"feed-contract",timestamp:new Date().toISOString(),food:"Test",amount:"small",notes:"contract"},...before.feeding];
    const events=deriveExtendedIntelligenceEvents(before,after);
    const checkpoint=events.find(x=>x.verb==="coverage_checkpoint");
    expect(checkpoint).toBeTruthy();
    expect(String(checkpoint?.metadata?.changedFields)).toContain("visionAssessments");
    expect(String(checkpoint?.metadata?.changedFields)).toContain("feeding");
  });

  it("records core edits, removals and AI-plan progress as explicit memory",()=>{
    const before=structuredClone(demoMarineTank) as any,after=structuredClone(demoMarineTank) as any;
    after.name="Renamed Reef";
    after.ageMonths=(after.ageMonths??1)+1;
    after.display={...after.display,length:after.display.length+1};
    after.maintenance=after.maintenance.slice(1);
    after.inventory=after.inventory.slice(1);
    after.aiActionPlans=[{id:"plan-hardening",createdAt:new Date().toISOString(),sourceQuestion:"test",titleAr:"خطة",titleEn:"Plan",status:"active",baselineScore:70,reviewAfterHours:24,steps:[{id:"s1",titleAr:"x",titleEn:"x",done:false}],focus:{domain:"chemistry",metrics:[]}}];
    const events=deriveExtendedIntelligenceEvents(before,after);
    expect(events.some(x=>x.verb==="tank_identity_changed")).toBe(true);
    expect(events.some(x=>x.verb==="task_removed")).toBe(before.maintenance.length>0);
    expect(events.some(x=>x.verb==="item_removed")).toBe(before.inventory.length>0);
    expect(events.some(x=>x.verb==="ai_plan_created")).toBe(true);
  });

  it("rejects NaN, impossible livestock size and invalid absence duration at save boundaries",()=>{
    expect(validateLivestockEntry({quantity:Number.NaN}).ok).toBe(false);
    expect(validateLivestockEntry({quantity:2,sizeCm:1001}).ok).toBe(false);
    expect(validateLivestockEntry({quantity:2,sizeCm:12}).ok).toBe(true);
    expect(validateGrowthMeasurement({sizeCm:Number.POSITIVE_INFINITY}).ok).toBe(false);
    expect(validateAbsencePlan({daysAway:0}).ok).toBe(false);
    expect(validateAbsencePlan({daysAway:365}).ok).toBe(true);
  });

  it("learns repeated outcomes inside the target domain without overriding safety",()=>{
    const t=structuredClone(demoMarineTank) as any;
    t.aiActionPlans=[
      {id:"p1",createdAt:"2026-01-01T00:00:00Z",sourceQuestion:"KH",titleAr:"",titleEn:"",status:"completed",baselineScore:70,reviewAfterHours:24,steps:[],focus:{domain:"chemistry",metrics:[]},outcome:"improved"},
      {id:"p2",createdAt:"2026-02-01T00:00:00Z",sourceQuestion:"KH",titleAr:"",titleEn:"",status:"completed",baselineScore:70,reviewAfterHours:24,steps:[],focus:{domain:"chemistry",metrics:[]},outcome:"improved"},
      {id:"p3",createdAt:"2026-03-01T00:00:00Z",sourceQuestion:"KH",titleAr:"",titleEn:"",status:"completed",baselineScore:70,reviewAfterHours:24,steps:[],focus:{domain:"chemistry",metrics:[]},outcome:"stable"}
    ];
    const learned=domainOutcomeLearning(t);
    expect(learned[0]?.domain).toBe("chemistry");
    expect(learned[0]?.samples).toBe(3);
    expect(learned[0]?.ar).toMatch(/قواعد الأمان|تاريخ هذا الحوض/);
  });

  it("paginates tens of thousands of history rows with stable cursors and no duplicates",()=>{
    const t=structuredClone(demoMarineTank) as any,base=Date.now();
    t.timeline=Array.from({length:10_000},(_,i)=>({id:`stress-t-${i}`,timestamp:new Date(base-i*60000).toISOString(),type:"stress",textAr:`حدث ${i}`,textEn:`Event ${i}`}));
    t.intelligenceEvents=Array.from({length:10_000},(_,i)=>({id:`stress-i-${i}`,timestamp:new Date(base-i*60000-30000).toISOString(),kind:"fact",domain:"system",verb:"stress",confidence:100,sourcePage:"timeline",textAr:`ذاكرة ${i}`,textEn:`Memory ${i}`}));
    const first=historyPage(t,{limit:200});
    const second=historyPage(t,{limit:200,cursor:first.nextCursor});
    expect(first.rows).toHaveLength(200);
    expect(second.rows).toHaveLength(200);
    expect(first.nextCursor).toBeTruthy();
    expect(new Set([...first.rows,...second.rows].map(x=>x.id)).size).toBe(400);
  });

  it("builds one lifecycle-aware vacation plan with pre-trip, caretaker and return checks",()=>{
    expect(vacationDays("2026-09-21","2026-09-28")).toBe(7);
    const tasks=buildVacationTaskDrafts({departure:"2026-09-21",daysAway:7,caretaker:"Caregiver",tankType:"marine"});
    expect(tasks.some(x=>/قبل السفر|before travel/i.test(`${x.title} ${x.titleEn}`))).toBe(true);
    expect(tasks.some(x=>/Caregiver/.test(`${x.title} ${x.titleEn}`))).toBe(true);
    expect(tasks.some(x=>/بعد العودة|After return/i.test(`${x.title} ${x.titleEn}`))).toBe(true);
  });

  it("rejects recovery payloads that would reintroduce unsafe numeric data",()=>{
    const poisoned=structuredClone(demoMarineTank) as any;
    poisoned.chemistry=[{timestamp:new Date().toISOString(),values:{salinity:1025},source:"manual",confidence:"high"}];
    let result=validateBackupPayload({app:"Aqua Nexus",schemaVersion:10,language:"ar",selectedTankId:poisoned.id,tanks:[poisoned]});
    expect(result.ok).toBe(false);

    const badDoser=structuredClone(demoMarineTank) as any;
    badDoser.doserChannels=[{id:"d1",name:"Bad",material:"x",capacityMl:100,currentMl:500,consumption:1,period:"daily"}];
    result=validateBackupPayload({app:"Aqua Nexus",schemaVersion:10,language:"ar",selectedTankId:badDoser.id,tanks:[badDoser]});
    expect(result.ok).toBe(false);

    const badVacation=structuredClone(demoMarineTank) as any;
    badVacation.lifecycle={vacations:[{id:"v1",startedAt:"2026-09-21T00:00:00Z",plannedEndAt:"2026-09-20"}]};
    result=validateBackupPayload({app:"Aqua Nexus",schemaVersion:10,language:"ar",selectedTankId:badVacation.id,tanks:[badVacation]});
    expect(result.ok).toBe(false);
  });
});

describe("Lighting Intelligence regression",()=>{
  it("normalizes a vision lighting import into the same editable program model",()=>{
    const raw={
      confidence:82,vendorDetected:"Maxspect",programName:"AB+ Screenshot",
      fixture:{brand:"Maxspect",model:"L165",powerWatts:65},
      channels:[
        {key:"uv",name:"UV",spectrum:"uv"},
        {key:"blue",name:"Royal Blue",spectrum:"royalBlue"}
      ],
      points:[
        {minute:540,values:{uv:0,blue:0}},
        {minute:900,values:{uv:35,blue:70}},
        {minute:1320,values:{uv:0,blue:0}}
      ],
      warnings:["One graph point was visually approximated"],evidence:["Visible channel labels and time axis"]
    };
    const normalized=normalizeLightingImportCandidate(raw,"image");
    expect(normalized.ok).toBe(true);
    if(!normalized.ok)return;
    const program=lightingCandidateToProgram(normalized.candidate,"Imported");
    expect(program.channels).toHaveLength(2);
    expect(program.points).toHaveLength(3);
    expect(program.points[1].values[program.channels[1].id]).toBe(70);
    expect(normalized.candidate.confidence).toBe(82);
  });
  it("rejects unusable AI lighting extraction instead of inventing a schedule",()=>{
    const normalized=normalizeLightingImportCandidate({confidence:20,channels:[{key:"blue",name:"Blue"}],points:[{minute:600,values:{blue:50}}]},"image");
    expect(normalized.ok).toBe(false);
  });

  function litTank(){
    const t=structuredClone(demoMarineTank);
    const fixture=t.equipment.find(x=>x.kind==="lighting")??{id:"light-test",name:"Test Light",kind:"lighting" as const,location:"display" as const,status:"on" as const};
    if(!t.equipment.some(x=>x.id===fixture.id))t.equipment.push(fixture as any);
    Object.assign(fixture,{location:"display",status:"on",parAtTargetDepth:260,mountingHeightCm:20,parReferenceDepthCm:t.display.height*.5,coverageLengthCm:t.display.length*.72,coverageWidthCm:t.display.width*.9,displayPosition:{xPct:50,yPct:116,zPct:50,scale:1}});
    t.lighting={activeProgram:defaultLightingProgram(t),mapDepthPct:50,calibrationPoints:[]};
    return t;
  }
  it("builds a real schedule and PAR field from tank geometry and fixtures",()=>{
    const t=litTank(),schedule=lightingSchedule(t.lighting!.activeProgram!);
    expect(schedule.photoperiodMinutes).toBeGreaterThan(0);
    expect(schedule.peakPercent).toBeGreaterThan(0);
    const grid=lightingGrid(t,{minute:schedule.peakMinute,depthPct:50,cols:9,rows:5});
    expect(grid.cells).toHaveLength(45);
    expect(grid.max).toBeGreaterThan(grid.min);
    expect(estimatedParAt(t,50,50,50,schedule.peakMinute)).toBeGreaterThan(0);
  });
  it("uses measured PAR points to calibrate the estimate instead of pretending estimates are measurements",()=>{
    const t=litTank(),program=t.lighting!.activeProgram!,peak=lightingSchedule(program).peakMinute;
    const raw=estimatedParAt(t,50,50,50,peak);
    t.lighting!.calibrationPoints=[{id:"cal-1",timestamp:new Date().toISOString(),xPct:50,zPct:50,depthPct:50,measuredPar:raw*1.5,minute:peak}];
    expect(lightingCalibrationFactor(t)).toBeGreaterThan(1.4);
    expect(lightingCalibrationFactor(t)).toBeLessThan(1.6);
  });
  it("exposes lighting to Tank Brain and Local Best AI",()=>{
    const t=litTank(),intel=lightingIntelligence(t);
    expect(intel.fixtures).toBeGreaterThan(0);
    const answer=aquaAIAnswer("شو وضع الإنارة والـ PAR بالحوض؟",t,"lighting");
    expect(answer.action?.page).toBe("lighting");
    expect(answer.detailsAr.join(" ")).toMatch(/PAR|الإنارة|البرنامج/);
  });
  it("separates marine coral and freshwater plant placement guidance",()=>{
    const marine=litTank();
    marine.livestock.push({id:"coral-sps",name:"Acropora Test",category:"coral",quantity:1,health:"good"} as any);
    const coral=lightingPlacementRecommendations(marine).find(x=>x.livestockId==="coral-sps");
    expect(coral?.zone).toBe("top");
    expect(coral?.parMin).toBeGreaterThanOrEqual(180);

    const freshwater=structuredClone(demoFreshwaterTank);
    freshwater.livestock.push({id:"plant-low",name:"Anubias Nana",category:"plant",quantity:1,health:"good"} as any);
    const plant=lightingPlacementRecommendations(freshwater).find(x=>x.livestockId==="plant-low");
    expect(plant?.zone).toBe("shade");
    expect(plant?.parMax).toBeLessThanOrEqual(60);

    marine.livestock.push({id:"coral-depth",name:"Acropora Depth",category:"coral",quantity:1,health:"good",lightingDepthCm:marine.display.height*.2,lightingXPct:50,lightingZPct:50,lightingExposure:"open"} as any);
    const placed=lightingPlacementRecommendations(marine).find(x=>x.livestockId==="coral-depth");
    expect(placed?.placementStatus).toBe("within");
    expect(placed?.actualZone).toBe("top");
    expect(placed?.estimatedPeakParAtActualDepth).toBeGreaterThan(0);
    expect(placed?.actualXPct).toBe(50);
    expect(placed?.actualZPct).toBe(50);

    freshwater.livestock.push({id:"plant-carpet",name:"Monte Carlo Carpet",category:"plant",quantity:1,health:"good"} as any);
    const carpet=lightingPlacementRecommendations(freshwater).find(x=>x.livestockId==="plant-carpet");
    expect(carpet?.zone).toBe("bottom");
  });
  it("applies X/Z position and local hardscape shade to per-livestock PAR",()=>{
    const t=litTank();
    t.livestock.push({id:"shade-open",name:"Torch Open",category:"coral",quantity:1,health:"good",lightingDepthCm:30,lightingXPct:50,lightingZPct:50,lightingExposure:"open"} as any);
    t.livestock.push({id:"shade-covered",name:"Torch Shade",category:"coral",quantity:1,health:"good",lightingDepthCm:30,lightingXPct:50,lightingZPct:50,lightingExposure:"shade"} as any);
    const rows=lightingPlacementRecommendations(t);
    const open=rows.find(x=>x.livestockId==="shade-open")!;
    const shade=rows.find(x=>x.livestockId==="shade-covered")!;
    expect(open.estimatedPeakParAtActualDepth).toBeGreaterThan(0);
    expect(shade.estimatedPeakParAtActualDepth).toBeLessThan((open.estimatedPeakParAtActualDepth??0)*.6);
    expect(shade.exposureFactor).toBe(.45);
  });
  it("feeds real livestock light placement into Tank Brain and Local Best AI",()=>{
    const t=litTank();
    t.livestock.push({id:"brain-coral",name:"Torch Brain Link",category:"coral",quantity:1,health:"good",lightingDepthCm:t.display.height*.95,lightingXPct:4,lightingZPct:4,lightingExposure:"shade"} as any);
    const light=lightingIntelligence(t);
    expect(light.issues.some(x=>x.id==="photosynthetic-placement")).toBe(true);
    const core=tankIntelligenceCore(t);
    expect(core.lighting.placementRecommendations.some(x=>x.livestockId==="brain-coral")).toBe(true);
    expect(core.actions.some(x=>x.domain==="lighting")).toBe(true);
    const answer=aquaAIAnswer("وين Torch Brain Link وقديش واصله ضو؟",t,"lighting");
    const joined=answer.detailsAr.join(" ");
    expect(joined).toContain("Torch Brain Link");
    expect(joined).toMatch(/X|PAR|ظل/);
  });
  it("uses fixture wattage when no measured reference PAR exists",()=>{
    const t=litTank();
    const light=t.equipment.find(x=>x.kind==="lighting")!;
    delete light.parAtTargetDepth;
    light.powerWatts=120;
    const peak=lightingSchedule(t.lighting!.activeProgram!).peakMinute;
    expect(estimatedParAt(t,50,50,50,peak)).toBeGreaterThan(20);
    light.powerWatts=0;
    expect(lightingIntelligence(t).issues.some(x=>x.id==="fixture-power-missing")).toBe(true);
  });
  it("keeps Lighting accessible during cycling and covered by the Tank event contract",()=>{
    expect(isCyclePageAllowed("lighting")).toBe(true);
    expect(TANK_EVENT_COVERAGE.lighting).toBe("evented");
  });
  it("rejects impossible photosynthetic depth in recovery backups",()=>{
    const t=litTank() as any;
    t.livestock.push({id:"bad-depth",name:"Coral",category:"coral",quantity:1,health:"good",lightingDepthCm:t.display.height+5});
    const result=validateBackupPayload({app:"Aqua Nexus",schemaVersion:15,language:"ar",selectedTankId:t.id,tanks:[t]});
    expect(result.ok).toBe(false);
  });
  it("rejects invalid livestock X/Z or exposure in recovery backups",()=>{
    const t=litTank() as any;
    t.livestock.push({id:"bad-xyz",name:"Coral",category:"coral",quantity:1,health:"good",lightingDepthCm:20,lightingXPct:120,lightingZPct:50,lightingExposure:"hidden"});
    const result=validateBackupPayload({app:"Aqua Nexus",schemaVersion:15,language:"ar",selectedTankId:t.id,tanks:[t]});
    expect(result.ok).toBe(false);
  });
  it("rejects corrupt lighting values in recovery backups",()=>{
    const t=litTank() as any;
    t.lighting.activeProgram.points[0].values[t.lighting.activeProgram.channels[0].id]=999;
    const result=validateBackupPayload({app:"Aqua Nexus",schemaVersion:14,language:"ar",selectedTankId:t.id,tanks:[t]});
    expect(result.ok).toBe(false);
  });
});

describe("Unified equipment import regression",()=>{
  it("parses a generic CSV into canonical device, chemistry, telemetry, top-off and alert candidates",()=>{
    const csv=[
      "timestamp,device,kind,brand,model,power_watts,metric,value,unit,topoff_liters,alert,severity",
      "2026-09-20T12:00:00Z,Main Probe,probe,Neptune,Apex Probe,5,pH,8.15,,4.5,,",
      "2026-09-20T12:05:00Z,Return Pump,returnPump,Generic,RP-1,55,flow,4200,L/h,,Flow low,warning"
    ].join("\n");
    const candidate=parseGenericEquipmentExport(csv,"apex.csv","neptune-apex");
    expect(candidate).toBeTruthy();
    expect(candidate!.devices.length).toBeGreaterThan(0);
    expect(candidate!.measurements.some(x=>x.parameter==="pH"&&x.destination==="chemistry")).toBe(true);
    expect(candidate!.measurements.some(x=>x.parameter==="flow"&&x.destination==="telemetry")).toBe(true);
    expect(candidate!.topOff.some(x=>x.liters===4.5)).toBe(true);
    expect(candidate!.alerts.some(x=>x.level==="warn")).toBe(true);
  });

  it("normalizes AI screenshot extraction without inventing unsupported rows",()=>{
    const result=normalizeEquipmentImportCandidate({
      confidence:87,vendorDetected:"HYDROS",
      devices:[{name:"WaveEngine",kind:"waveMaker",brand:"HYDROS",model:"WaveEngine",powerWatts:30}],
      measurements:[{timestamp:"2026-09-20T10:00:00Z",parameter:"temperature",value:25.4,unit:"C",deviceName:"WaveEngine"}],
      doses:[],topOff:[],alerts:[],
      warnings:["One device label was partially obscured"],evidence:["Visible device card and temperature row"]
    },"image");
    expect(result.ok).toBe(true);
    if(!result.ok)return;
    expect(result.candidate.devices[0].kind).toBe("waveMaker");
    expect(result.candidate.measurements[0].destination).toBe("chemistry");
    expect(result.candidate.confidence).toBe(87);
  });

  it("applies reviewed imports into canonical domains and Tank Brain sees device alerts",()=>{
    const t=structuredClone(demoMarineTank);
    const normalized=normalizeEquipmentImportCandidate({
      confidence:92,vendorDetected:"Neptune Apex",
      devices:[{sourceRecordId:"pump-1",name:"Return Pump Import",kind:"returnPump",brand:"Neptune",model:"COR",powerWatts:65,flowLph:4500,status:"on"}],
      measurements:[
        {sourceRecordId:"ph-1",timestamp:new Date().toISOString(),parameter:"pH",value:8.18,deviceName:"Apex pH"},
        {sourceRecordId:"watts-1",timestamp:new Date().toISOString(),parameter:"powerWatts",value:63,unit:"W",deviceName:"Return Pump Import"}
      ],
      doses:[{sourceRecordId:"dose-1",timestamp:new Date().toISOString(),parameter:"KH",ml:6,material:"Alkalinity",deviceName:"DOS"}],
      topOff:[{sourceRecordId:"ato-1",timestamp:new Date().toISOString(),liters:5.2,deviceName:"ATK"}],
      alerts:[{sourceRecordId:"alert-1",timestamp:new Date().toISOString(),level:"danger",message:"Return pump offline",deviceName:"Return Pump Import"}],
      warnings:[],evidence:["fixture"]
    },"structured");
    expect(normalized.ok).toBe(true);if(!normalized.ok)return;
    const app=prepareEquipmentImportApplication(t,normalized.candidate,{
      importId:"import-test",importedAt:new Date().toISOString(),vendor:"neptune-apex",sourceName:"apex-export.json",sourceType:"json",fingerprint:"abc",analysisMode:"structured-file"
    });
    expect(app.blockedIssues).toHaveLength(0);
    expect(app.tank.equipment.some(x=>x.name==="Return Pump Import"&&x.sourceSystem==="neptune-apex")).toBe(true);
    expect(app.tank.chemistry.some(x=>x.source==="device"&&x.sourceSystem==="neptune-apex"&&x.values.pH===8.18)).toBe(true);
    expect(app.tank.deviceTelemetry?.some(x=>x.metric==="powerWatts"&&x.value===63)).toBe(true);
    expect(app.tank.dosing.some(x=>x.sourceSystem==="neptune-apex"&&x.ml===6)).toBe(true);
    expect(app.tank.topOff?.some(x=>x.liters===5.2)).toBe(true);
    expect(app.tank.deviceAlerts?.some(x=>x.level==="danger"&&x.message.includes("offline"))).toBe(true);

    const brain=buildTankBrainSnapshot(app.tank);
    expect(brain.equipment.deviceAlerts.some(x=>x.level==="danger"&&x.message.includes("offline"))).toBe(true);
    expect(brain.equipment.telemetry.some(x=>x.metric==="powerWatts"&&x.value===63)).toBe(true);
    expect(brain.equipment.topOff.some(x=>x.liters===5.2)).toBe(true);
    expect(brain.equipment.imports.some(x=>x.id==="import-test")).toBe(true);
    expect(brain.coverage.deviceAlerts).toBeGreaterThanOrEqual(1);

    const imported=equipmentImportIntelligence(app.tank);
    expect(imported.dangerAlerts).toBe(1);
    const alerts=systemAlerts(app.tank);
    expect(alerts.some(x=>x.id==="device-import-device-alert-danger"&&x.level==="danger")).toBe(true);

    const context=buildTankAIContext(app.tank);
    expect(context.equipment.deviceData.dangerAlerts).toBe(1);
    expect(context.brain.equipment.deviceAlerts.length).toBeGreaterThan(0);
    expect(context.operations.alerts.some(x=>x.id==="device-import-device-alert-danger")).toBe(true);

    const core=tankIntelligenceCore(app.tank);
    expect(core.deviceData.dangerAlerts).toBe(1);
    expect(core.actions.some(x=>x.domain==="equipment")).toBe(true);
    expect(core.critical).toBe(true);

    const answer=aquaAIAnswer("شو وضع بيانات جهاز Apex والتنبيهات؟",app.tank,"equipment");
    expect(answer.action?.page).toBe("equipment");
    expect(answer.detailsAr.join(" ")).toMatch(/Apex|تنبيه|Telemetry|تعويض/);
  });

  it("blocks implausible imported chemistry instead of silently writing it",()=>{
    const t=structuredClone(demoMarineTank);
    const normalized=normalizeEquipmentImportCandidate({
      confidence:90,devices:[],
      measurements:[{timestamp:new Date().toISOString(),parameter:"salinity",value:1025}],
      doses:[],topOff:[],alerts:[],warnings:[],evidence:[]
    },"structured");
    expect(normalized.ok).toBe(true);if(!normalized.ok)return;
    normalized.candidate.measurements[0].destination="chemistry";
    const app=prepareEquipmentImportApplication(t,normalized.candidate,{
      importId:"bad-chem",importedAt:new Date().toISOString(),vendor:"generic",sourceName:"bad.csv",sourceType:"csv",fingerprint:"bad",analysisMode:"structured-file"
    });
    expect(app.blockedIssues.length).toBeGreaterThan(0);
    expect(app.tank.chemistry.some(x=>x.sourceImportId==="bad-chem")).toBe(false);
  });

  it("marks all new equipment import fields as evented and validates them in recovery backup",()=>{
    expect(TANK_EVENT_COVERAGE.externalImports).toBe("evented");
    expect(TANK_EVENT_COVERAGE.deviceTelemetry).toBe("evented");
    expect(TANK_EVENT_COVERAGE.topOff).toBe("evented");
    expect(TANK_EVENT_COVERAGE.deviceAlerts).toBe("evented");
    const t=structuredClone(demoMarineTank) as any;
    t.externalImports=[{id:"i",importedAt:new Date().toISOString(),vendor:"generic",sourceName:"x.csv",sourceType:"csv",fingerprint:"x",analysisMode:"structured-file",confidence:100,status:"applied",counts:{equipment:0,chemistry:0,dosing:0,topOff:0,telemetry:0,alerts:0}}];
    t.deviceTelemetry=[{id:"tele",timestamp:new Date().toISOString(),metric:"flow",value:1200}];
    t.topOff=[{id:"ato",timestamp:new Date().toISOString(),liters:4}];
    t.deviceAlerts=[{id:"al",timestamp:new Date().toISOString(),level:"warn",message:"Test alert"}];
    const result=validateBackupPayload({app:"Aqua Nexus",schemaVersion:17,language:"ar",selectedTankId:t.id,tanks:[t]});
    expect(result.ok).toBe(true);
  });
});



describe("RC.2 chemistry evidence and versioning closure",()=>{
  it("never treats reference defaults as the latest measured parameter",()=>{
    const t=structuredClone(demoMarineTank);
    t.chemistry=[
      {timestamp:new Date().toISOString(),values:{KH:8.3,Ca:440},usingDefaults:true},
      {timestamp:new Date(Date.now()-3600000).toISOString(),values:{KH:7.4},source:"manual",confidence:"high",usingDefaults:false}
    ];
    expect(latestParameterSample(t,"KH")?.value).toBe(7.4);
    expect(latestParameterSample(t,"Ca")).toBeUndefined();
  });

  it("never completes weekly chemistry from reference defaults",()=>{
    const t=structuredClone(demoMarineTank);
    const values=Object.fromEntries(weeklyChemistryCoverage(t).required.map(key=>[key,key==="salinity"?1.025:8])) as Record<string,number>;
    t.chemistry=[{timestamp:new Date().toISOString(),values,usingDefaults:true}];
    const coverage=weeklyChemistryCoverage(t);
    expect(coverage.measured).toHaveLength(0);
    expect(coverage.complete).toBe(false);
  });

  it("separates measured chemistry from references in Tank Brain and AI context",()=>{
    const t=structuredClone(demoMarineTank);
    t.chemistry=[
      {timestamp:new Date().toISOString(),values:{KH:8},usingDefaults:true},
      {timestamp:new Date(Date.now()-3600000).toISOString(),values:{KH:7.5},usingDefaults:false,source:"manual",confidence:"high"}
    ];
    const brain=buildTankBrainSnapshot(t);
    const ai=buildTankAIContext(t);
    expect(brain.schema).toBe("aqua-nexus-tank-brain/v2");
    expect(brain.productVersion).toBe("0.3.0-rc.3");
    expect(brain.chemistry.count).toBe(1);
    expect(brain.chemistry.referenceDefaults).toHaveLength(1);
    expect(ai.schema).toBe("aqua-nexus-ai-context/v2");
    expect(ai.chemistry.latest.KH).toBe(7.5);
    expect(ai.chemistry.readingCount).toBe(1);
    expect(ai.chemistry.referenceDefaults).toHaveLength(1);
    expect(ai.modelVersions.health).toBe("2.0.0");
    expect(ai.modelVersions.tankBrain).toBe("1.1.0");
    expect(ai.modelVersions.chemistryEvidence).toBe("1.1.0");
  });
});


describe("RC.3 safety and data-integrity hardening",()=>{
  it("sorts measured chemistry by timestamp and ignores defaults and future rows",()=>{
    const t=structuredClone(demoMarineTank);
    const now=Date.now();
    t.chemistry=[
      {timestamp:new Date(now+86400000).toISOString(),values:{KH:99},usingDefaults:false,source:"manual",confidence:"high"},
      {timestamp:new Date(now-7200000).toISOString(),values:{KH:7.1},usingDefaults:false,source:"manual",confidence:"high"},
      {timestamp:new Date(now-3600000).toISOString(),values:{KH:7.6},usingDefaults:false,source:"manual",confidence:"high"},
      {timestamp:new Date(now-1000).toISOString(),values:{KH:8.3},usingDefaults:true}
    ];
    const rows=measuredChemistryReadings(t);
    expect(rows).toHaveLength(2);
    expect(rows[0].values.KH).toBe(7.6);
    expect(latestParameterSample(t,"KH")?.value).toBe(7.6);
  });

  it("blocks multi-step dosing until a real post-dose retest exists",()=>{
    const t=structuredClone(demoMarineTank);
    const executedAt=new Date(Date.now()-3600000).toISOString();
    t.systemVolumeLiters=500;
    t.chemistry=[{timestamp:new Date(Date.now()-7200000).toISOString(),values:{KH:7},usingDefaults:false,source:"manual",confidence:"high"}];
    const dose={id:"dose-plan",timestamp:new Date(Date.now()-10800000).toISOString(),parameter:"KH",current:7,target:9,ml:100,amount:100,unit:"mL",material:"test",steps:2,perStep:50,stepIndex:1,status:"in_progress" as const,calculatorMode:"product" as const,sourceReadingTimestamp:t.chemistry[0].timestamp,systemVolumeLiters:500,lastExecutedAt:executedAt};
    expect(doseStepExecutionGate(t,dose,2).code).toBe("missing_retest");
    t.chemistry.unshift({timestamp:new Date().toISOString(),values:{KH:8.1},usingDefaults:false,source:"manual",confidence:"high"});
    const gate=doseStepExecutionGate(t,dose,2);
    expect(gate.ok).toBe(true);
    expect(gate.amount).toBeLessThanOrEqual(50);
    expect(gate.sampleValue).toBe(8.1);
  });

  it("stops a plan when the retest response would require a larger-than-original next step",()=>{
    const t=structuredClone(demoMarineTank);
    const executedAt=new Date(Date.now()-3600000).toISOString();
    t.systemVolumeLiters=500;
    t.chemistry=[{timestamp:new Date().toISOString(),values:{KH:7.8},usingDefaults:false,source:"manual",confidence:"high"}];
    const dose={id:"dose-plan",timestamp:new Date(Date.now()-10800000).toISOString(),parameter:"KH",current:7,target:9,ml:100,amount:100,unit:"mL",material:"test",steps:2,perStep:50,stepIndex:1,status:"in_progress" as const,calculatorMode:"product" as const,systemVolumeLiters:500,lastExecutedAt:executedAt};
    expect(doseStepExecutionGate(t,dose,2).code).toBe("unexpected_response");
  });

  it("invalidates continuation when system volume changed after a dose plan",()=>{
    const t=structuredClone(demoMarineTank);
    const executedAt=new Date(Date.now()-3600000).toISOString();
    t.systemVolumeLiters=550;
    t.chemistry=[{timestamp:new Date().toISOString(),values:{KH:7.5},usingDefaults:false,source:"manual",confidence:"high"}];
    const dose={id:"dose-plan",timestamp:new Date(Date.now()-10800000).toISOString(),parameter:"KH",current:7,target:9,ml:100,amount:100,unit:"mL",material:"test",steps:2,perStep:50,stepIndex:1,status:"in_progress" as const,calculatorMode:"product" as const,systemVolumeLiters:500,lastExecutedAt:executedAt};
    expect(doseStepExecutionGate(t,dose,2).code).toBe("volume_changed");
  });

  it("rejects far-future timestamps in recovery backup validation",()=>{
    const t=structuredClone(demoMarineTank);
    t.chemistry=[{timestamp:new Date(Date.now()+86400000).toISOString(),values:{KH:8},usingDefaults:false,source:"manual",confidence:"high"}];
    const result=validateBackupPayload({app:"Aqua Nexus",schemaVersion:17,language:"ar",selectedTankId:t.id,tanks:[t]});
    expect(result.ok).toBe(false);
  });

  it("blocks future device/import records before they enter hot tank state",()=>{
    const t=structuredClone(demoMarineTank);
    const normalized=normalizeEquipmentImportCandidate({
      confidence:90,
      measurements:[{timestamp:new Date(Date.now()+86400000).toISOString(),parameter:"KH",value:8,destination:"chemistry"}]
    },"structured");
    expect(normalized.ok).toBe(true);
    if(!normalized.ok)return;
    const applied=prepareEquipmentImportApplication(t,normalized.candidate,{importId:"future-import",importedAt:new Date().toISOString(),vendor:"generic",sourceName:"future.csv",sourceType:"csv",fingerprint:"future",analysisMode:"structured-file"});
    expect(applied.importRecord.counts.chemistry).toBe(0);
    expect(applied.blockedIssues.length).toBeGreaterThan(0);
  });

  it("keeps calendar-day arithmetic independent from UTC timestamp slicing",()=>{
    expect(addLocalCalendarDays("2026-03-28",1)).toBe("2026-03-29");
    expect(addLocalCalendarDays("2026-12-31",1)).toBe("2027-01-01");
    expect(isMeaningfullyFutureTimestamp(new Date(Date.now()+86400000).toISOString())).toBe(true);
  });
});
