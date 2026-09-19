import { describe,expect,it } from "vitest";
import { demoMarineTank } from "@/data/demoTank";
import { parseAquaQuestion } from "@/domain/aquaAIIntent";
import { buildAquaAIQueryPlan } from "@/domain/aquaAIQueryPlan";
import { aquaAIAnswer } from "@/domain/aquaAIBrain";
import { completeMaintenanceTask,maintenanceEffectiveState } from "@/domain/maintenanceSchedule";
import { systemAlerts } from "@/domain/alertEngine";
import { chemistryGuidance } from "@/domain/chemistryGuidance";
import { chemistryHealthAssessment } from "@/domain/health";
import { latestParameterSample,validateChemistryValue,validateDosingTarget,weeklyChemistryCoverage } from "@/domain/chemistryDataQuality";
import { rodiIntelligence } from "@/domain/rodiIntelligence";
import { sumpIntelligence } from "@/domain/sumpIntelligence";

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
