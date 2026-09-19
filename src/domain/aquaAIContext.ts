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
import { tankIntelligenceCore } from "./intelligenceCore";

export function buildAquaAIContext(tank:Tank){
 const vision=((tank as any).visionAssessments??[]).slice(0,5);
 const plans=((tank as any).aiActionPlans??[]).slice(0,5);
 const core=tankIntelligenceCore(tank);
 return {
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  tank:{id:tank.id,name:tank.name,type:tank.type,status:tank.status,ageMonths:tank.ageMonths,systemVolumeLiters:tank.systemVolumeLiters},
  state:core.state,
  mood:tankMood(tank),
  forecast:core.forecast,
  chemistry:{latest:tank.chemistry[0]??null,recent:tank.chemistry.slice(0,10),baselines:tankBaselines(tank),predictions:proactivePredictions(tank),nutrients:analyzeNutrients(tank),guidance:chemistryGuidance(tank)},
  systemHealth:core.health,
  intelligence:{dataConfidence:core.dataConfidence,critical:core.critical,actions:core.actions,guidanceActions:core.guidanceActions,impacts:core.impacts,recentEvents:(tank.intelligenceEvents??[]).slice(0,50),insights:core.insights,predictions:core.predictions,memory:core.memory},
  learnedSignals:learnedTankSignals(tank),
  biologicalMemory:core.memory,
  eventLinks:eventChemistryLinks(tank),
  livestock:tank.livestock,
  equipment:tank.equipment,
  energy:tankEnergy(tank),
  maintenance:tank.maintenance.slice(0,30),
  alerts:core.alerts,
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
