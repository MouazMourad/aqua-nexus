import type { Tank } from "./types";
import { tankStateView,tankForecast } from "./tankIntelligence";
import { tankMood,biologicalMemory,proactivePredictions,eventChemistryLinks } from "./tankLearning";
import { learnedTankSignals,tankBaselines } from "./tankPatterns";
import { analyzeNutrients } from "./nutrientEngine";
import { tankEnergy } from "./equipmentIntelligence";
import { chemistryGuidance } from "./chemistryGuidance";
import { systemHealth } from "./systemHealth";
import { unifiedInventory } from "./inventoryIntelligence";
import { feedingIntelligence } from "./feedingIntelligence";
import { rodiIntelligence } from "./rodiIntelligence";
import { sumpIntelligence } from "./sumpIntelligence";
import { systemAlerts } from "./alertEngine";

export function buildAquaAIContext(tank:Tank){
 const vision=((tank as any).visionAssessments??[]).slice(0,5);
 const plans=((tank as any).aiActionPlans??[]).slice(0,5);
 return {
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  tank:{id:tank.id,name:tank.name,type:tank.type,status:tank.status,ageMonths:tank.ageMonths,systemVolumeLiters:tank.systemVolumeLiters},
  state:tankStateView(tank),
  mood:tankMood(tank),
  forecast:tankForecast(tank),
  chemistry:{latest:tank.chemistry[0]??null,recent:tank.chemistry.slice(0,10),baselines:tankBaselines(tank),predictions:proactivePredictions(tank),nutrients:analyzeNutrients(tank),guidance:chemistryGuidance(tank)},
  systemHealth:systemHealth(tank),
  learnedSignals:learnedTankSignals(tank),
  biologicalMemory:biologicalMemory(tank),
  eventLinks:eventChemistryLinks(tank),
  livestock:tank.livestock,
  equipment:tank.equipment,
  energy:tankEnergy(tank),
  maintenance:tank.maintenance.slice(0,30),
  alerts:systemAlerts(tank),
  inventory:unifiedInventory(tank),
  feedingIntelligence:feedingIntelligence(tank),
  rodiIntelligence:rodiIntelligence(tank),
  sumpIntelligence:sumpIntelligence(tank),
  expenses:tank.expenses.slice(0,30),
  dosing:tank.dosing.slice(0,20),
  feeding:tank.feeding.slice(0,20),
  waterChanges:tank.waterChanges.slice(0,15),
  quarantine:tank.quarantine,
  emergencySessions:(tank.emergencySessions??[]).slice(0,10),
  visualAssessments:vision,
  aiActionPlans:plans,
  recentTimeline:tank.timeline.slice(0,30),
  safety:{visionDiagnosisMode:"probabilistic-only",causalityMode:"temporal-association-not-proof",medicationRule:"follow-product-label-and-quarantine-context"}
 };
}
