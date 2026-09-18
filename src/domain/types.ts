export type Language = "ar" | "en";
export type TankType = "marine" | "freshwater";
export type TankStatus = "new" | "cycling" | "established";

export type EquipmentKind =
  | "lighting" | "waveMaker" | "skimmer" | "returnPump" | "filterSock"
  | "rollerFilter" | "reactor" | "heater" | "doser" | "uv" | "ozone"
  | "ato" | "refugiumLight" | "turfScrubber" | "probe" | "overflow" | "other";

export interface DimensionsCm { length: number; width: number; height: number; }

export interface DisplayEquipmentPosition {
  xPct: number;
  yPct: number;
  zPct: number;
  rotationY?: number;
  flowStrength?: number;
  scale?: number;
}

export interface Equipment {
  id: string;
  name: string;
  kind: EquipmentKind;
  legacyKind?: string;
  brand?: string;
  model?: string;
  location: "display" | "external" | `sump:${string}`;
  installedAt?: string;
  lastServiceAt?: string;
  serviceIntervalDays?: number;
  futurePlan?: string;
  status: "on" | "off" | "service" | "warning";
  displayPosition?: DisplayEquipmentPosition;
  overflowPlumbingMode?: "combined" | "separate";
  overflowReturnPosition?: DisplayEquipmentPosition;
  powerWatts?: number;
  hoursPerDay?: number;
  /** Manufacturer-rated aquarium/system volume, when applicable (e.g. skimmer/filter). */
  ratedVolumeLiters?: number;
  /** Nominal water flow in liters/hour for pumps, wavemakers, filters, etc. */
  flowLph?: number;
}

export interface EnergySettings {
  pricePerKwh: number;
  currency: string;
}

export interface SumpChamber {
  id: string;
  name: string;
  nameEn?: string;
  x: number;
  y: number;
  length: number;
  width: number;
  height: number;
  waterHeight: number;
  media: ("biological" | "chemical" | "refugium" | "turf")[];
  items?: string[];
  contents?: string;
  notes?: string;
}

export interface Sump {
  enabled: boolean;
  dimensions: DimensionsCm;
  operatingFillPercent: number;
  chambers: SumpChamber[];
}

export interface ChemistryReading {
  timestamp: string;
  values: Record<string, number | null>;
  notes?: string;
  usingDefaults?: boolean;
}

export interface MaintenanceTask {
  id: string;
  title: string;
  titleEn?: string;
  cadence: "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "annual" | "once";
  done: boolean;
  nextDue?: string;
  lastDone?: string;
  manual?: boolean;
}

export interface LivestockItem {
  id: string;
  libraryId?: string;
  name: string;
  nameEn?: string;
  category: "fish" | "coral" | "invert" | "plant" | "other";
  quantity: number;
  health: "good" | "watch" | "treatment";
  load?: number;
  addedAt?: string;
}

export interface InventoryItem {
  id: string;
  presetId?: string;
  name: string;
  nameEn?: string;
  category?: string;
  categoryEn?: string;
  quantity: number;
  unit: string;
  minimum: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: string;
  textAr: string;
  textEn: string;
}

export interface HealthSnapshot {
  id: string;
  timestamp: string;
  score: number;
  chemistry: number;
  maintenance: number;
  state: "excellent" | "stable" | "watch" | "stressed" | "critical";
  reasonAr: string;
  reasonEn: string;
  relatedEventId?: string;
}

export interface JournalPhoto {
  id: string;
  timestamp: string;
  caption: string;
  dataUrl: string;
}

export interface FeedingLog {
  id: string;
  timestamp: string;
  food: string;
  amount: string;
  notes?: string;
}

export interface DosingLog {
  id: string;
  timestamp: string;
  parameter: string;
  current?: number;
  target?: number;
  ml: number;
  chamberMaterial?: string;
}

export interface DoserChannel {
  id: string;
  name: string;
  material: string;
  capacityMl: number;
  currentMl: number;
  consumption: number;
  period: "daily" | "weekly" | "monthly";
  color: string;
}

export interface FilterMediaItem {
  id: string;
  name: string;
  kind: "gfo" | "activatedCarbon" | "other";
  amountGrams: number;
  installedAt: string;
  referenceLifeDays: number;
  chamberId?: string;
  notes?: string;
}

export interface QuarantineCase {
  id: string;
  organism: string;
  reason: string;
  plan: string;
  start: string;
  status: "active" | "closed";
  quarantineVolumeLiters?: number;
  treatmentProduct?: string;
  labelDoseMlPer100L?: number;
  intervalHours?: number;
  totalDoses?: number;
  dosesGiven?: number;
  nextDoseAt?: string;
  lastDoseAt?: string;
  notes?: string;
}

export interface EmergencySession {
  id: string;
  scenarioId: string;
  titleAr: string;
  titleEn: string;
  startedAt: string;
  completedAt?: string;
  completedSteps: number[];
  status: "active" | "completed";
}

export interface ExpenseItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
}

export interface WaterChangeLog {
  id: string;
  timestamp: string;
  liters: number;
  percent: number;
  salinity?: number;
  temperature?: number;
  notes?: string;
}

export interface RODILog {
  id: string;
  timestamp: string;
  tdsIn: number;
  tdsOut: number;
  liters: number;
}

export interface AcclimationItem {
  id: string;
  libraryId?: string;
  name: string;
  nameEn?: string;
  category: "fish" | "coral" | "invert" | "plant" | "other";
  quantity: number;
  dripMinutes: number;
  intervalMinutes: number;
  placement: string;
  notes?: string;
  temperament?: "peaceful" | "semi" | "aggressive";
  sensitivity?: "normal" | "sensitive" | "hardy";
  subtype?: string;
  health: "unknown" | "good" | "fair" | "stressed" | "critical" | "watch";
  status: "waiting" | "acclimating" | "paused" | "ready" | "added" | "deferred" | "emergency";
  startedAt?: string;
  extraMinutes?: number;
  remainingMs?: number;
  endAt?: number | null;
  readyAt?: string;
  addedAt?: string;
  imageDataUrl?: string;
  emergency?: boolean;
}

export interface AcclimationEvent {
  id: string;
  timestamp: string;
  textAr: string;
  textEn: string;
}

export interface AcclimationSession {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "setup" | "floating" | "transfer" | "drip" | "release" | "completed";
  wizardStep?: number;
  categories?: ("fish" | "coral" | "invert" | "plant" | "other")[];
  tankSalinity?: number;
  bagSalinity?: number;
  temperature?: number;
  existingNotes?: string;
  coralDipEnabled?: boolean;
  coralDipMinutes?: number;
  floatConfirmed: boolean;
  floatStatus?: "waiting" | "running" | "paused" | "ready" | "done";
  floatStartedAt?: string;
  floatRemainingMs?: number;
  floatEndAt?: number | null;
  bucketStatus?: "waiting" | "running" | "paused" | "ready" | "done";
  bucketStartedAt?: string;
  bucketRemainingMs?: number;
  bucketEndAt?: number | null;
  dripStartedAt?: string;
  preflight?: Record<string, boolean>;
  items: AcclimationItem[];
  events: AcclimationEvent[];
}

export interface Tank {
  id: string;
  name: string;
  /** Built-in protected aquarium used only for learning/exploration. */
  isTraining?: boolean;
  /** Start of the current hands-on training run; reset with the training tank. */
  trainingStartedAt?: string;
  type: TankType;
  status: TankStatus;
  ageMonths?: number;
  display: DimensionsCm & {
    displacementPercent: number;
    grossLiters: number;
    netLiters: number;
  };
  sump: Sump;
  systemVolumeLiters: number;
  equipment: Equipment[];
  energySettings?: EnergySettings;
  chemistry: ChemistryReading[];
  maintenance: MaintenanceTask[];
  livestock: LivestockItem[];
  inventory: InventoryItem[];
  timeline: TimelineEvent[];
  healthSnapshots?: HealthSnapshot[];
  photos: JournalPhoto[];
  feeding: FeedingLog[];
  dosing: DosingLog[];
  doserChannels: DoserChannel[];
  filterMedia?: FilterMediaItem[];
  quarantine: QuarantineCase[];
  emergencySessions?: EmergencySession[];
  expenses: ExpenseItem[];
  waterChanges: WaterChangeLog[];
  rodi: RODILog[];
  acclimationSessions?: AcclimationSession[];
  createdAt: string;
}

export interface AquaState {
  language: Language;
  selectedTankId: string;
  tanks: Tank[];
}
