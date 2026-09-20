import { describe,expect,it } from "vitest";
import { demoMarineTank } from "@/data/demoTank";
import { parseAquaQuestion,resolveAquaFollowup } from "@/domain/aquaAIIntent";
import { buildAquaAIQueryPlan } from "@/domain/aquaAIQueryPlan";
import { aquaAIAnswer } from "@/domain/aquaAIBrain";
import { completeMaintenanceTask,maintenanceEffectiveState } from "@/domain/maintenanceSchedule";
import { systemAlerts } from "@/domain/alertEngine";
import { chemistryGuidance } from "@/domain/chemistryGuidance";
import { chemistryHealthAssessment } from "@/domain/health";
import { latestParameterSample,validateChemistryValue,validateDosingTarget,weeklyChemistryCoverage } from "@/domain/chemistryDataQuality";
import { rodiIntelligence } from "@/domain/rodiIntelligence";
import { sumpIntelligence } from "@/domain/sumpIntelligence";
import { stockingReadiness } from "@/domain/stockingReadiness";
import { auditTankCompatibility } from "@/domain/compatibility";
import { tankStateView } from "@/domain/tankIntelligence";
import { systemHealthTrend } from "@/domain/systemHealth";
import { deriveGuidanceActions } from "@/domain/impactEngine";
import { deriveIntelligenceEvents } from "@/domain/eventIntelligence";
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

