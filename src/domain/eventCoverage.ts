import type { Tank } from "./types";

export type EventCoverageMode="evented"|"derived"|"immutable"|"recovery-exempt";

/**
 * Compile-time contract for Tank memory coverage.
 * Adding a new Tank field without deciding how it participates in history
 * intentionally fails TypeScript until this manifest is updated.
 */
export const TANK_EVENT_COVERAGE={
  id:"immutable",
  name:"evented",
  isTraining:"immutable",
  trainingStartedAt:"recovery-exempt",
  type:"immutable",
  ecosystemProfile:"evented",
  plantedMode:"evented",
  substrateType:"evented",
  substrateStartedAt:"evented",
  status:"evented",
  ageMonths:"evented",
  display:"evented",
  sump:"evented",
  systemVolumeLiters:"derived",
  equipment:"evented",
  externalImports:"evented",
  deviceTelemetry:"evented",
  topOff:"evented",
  energySettings:"evented",
  lighting:"evented",
  chemistry:"evented",
  maintenance:"evented",
  livestock:"evented",
  livestockExits:"evented",
  inventory:"evented",
  timeline:"evented",
  intelligenceEvents:"derived",
  guidanceActions:"derived",
  healthSnapshots:"derived",
  photos:"evented",
  visionAssessments:"evented",
  feeding:"evented",
  dosing:"evented",
  doserChannels:"evented",
  filterMedia:"evented",
  quarantine:"evented",
  emergencySessions:"evented",
  expenses:"evented",
  waterChanges:"evented",
  rodi:"evented",
  rodiServiceEvents:"evented",
  plantCare:"evented",
  biologicalCycle:"evented",
  lifecycle:"evented",
  acclimationSessions:"evented",
  aiActionPlans:"evented",
  createdAt:"immutable"
} satisfies Record<keyof Tank,EventCoverageMode>;

export const eventedTankFields=Object.entries(TANK_EVENT_COVERAGE)
  .filter(([,mode])=>mode==="evented")
  .map(([field])=>field as keyof Tank);

export function eventCoverageMode(field:keyof Tank){return TANK_EVENT_COVERAGE[field];}
