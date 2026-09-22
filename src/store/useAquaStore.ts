"use client";

import { create } from "zustand";
import { createJSONStorage,persist } from "zustand/middleware";
import type { AquaState, AquariumExperienceLevel, ChemistryReading, Equipment, HealthSnapshot, Language, Tank } from "@/domain/types";
import { demoMarineTank, demoFreshwaterTank } from "@/data/demoTank";
import { liters, round1 } from "@/lib/units";
import { defaultDisplayPosition } from "@/lib/displayLayout";
import { chemistryHealthAssessment, maintenanceHealth } from "@/domain/health";
import { tankStateScore,tankStateView } from "@/domain/tankIntelligence";
import { tankIntelligenceCore } from "@/domain/intelligenceCore";
import { deriveIntelligenceEvents,mergeIntelligenceEvents,reconcileGuidanceActions } from "@/domain/eventIntelligence";
import { deriveExtendedIntelligenceEvents } from "@/domain/extendedEventIntelligence";
import { recordCloudDeleteTombstone } from "@/lib/cloudTombstones";
import { aquaStateStorage } from "@/lib/aquaStateStorage";
import { clearTankHistoryArchive } from "@/lib/historyArchiveStorage";
import { clearLongTermHistory } from "@/lib/longTermHistory";
import { CHEMISTRY_EVIDENCE_VERSION,HEALTH_MODEL_VERSION,TANK_BRAIN_VERSION } from "@/domain/version";

interface AquaStore extends AquaState {
  setLanguage: (language: Language) => void;
  setAquariumExperience: (level:AquariumExperienceLevel) => void;
  selectTank: (tankId: string) => void;
  addTank: (tank: Tank) => void;
  deleteTank: (tankId: string) => void;
  patchTank: (tankId: string, updater: Partial<Tank> | ((tank: Tank) => Tank)) => void;
  addChemistryReading: (tankId: string, reading: ChemistryReading) => void;
  replaceData: (data: Pick<AquaState, "language"|"aquariumExperience"|"selectedTankId"|"tanks">) => void;
  replaceTankSnapshot: (tankId:string, tank:Tank) => void;
  resetDemo: () => void;
  resetTrainingTank: (tankId: string) => void;
}

type ChangeReason={ar:string;en:string;eventId?:string;timestamp?:string};

function recalcTank(tank: Tank): Tank {
  const gross = liters(tank.display.length, tank.display.width, tank.display.height);
  const net = gross * (1 - tank.display.displacementPercent / 100);
  const sumpGross = tank.sump.enabled ? liters(tank.sump.dimensions.length,tank.sump.dimensions.width,tank.sump.dimensions.height) : 0;
  const sumpNet = sumpGross * tank.sump.operatingFillPercent / 100;
  return {
    ...tank,
    display:{...tank.display,grossLiters:round1(gross),netLiters:round1(net)},
    systemVolumeLiters:round1(net+sumpNet)
  };
}

function normalize(tank: Tank): Tank {
  const createdAt=tank.createdAt ?? new Date().toISOString();
  const cycling=tank.status==="new"||tank.status==="cycling";
  const biologicalCycle=cycling
    ? {...(tank.biologicalCycle??{startedAt:createdAt}),startedAt:tank.biologicalCycle?.startedAt??createdAt}
    : tank.biologicalCycle;
  return recalcTank({
    ...tank,
    createdAt,
    biologicalCycle,
    equipment:(tank.equipment ?? []).map((e,i)=>{
      const visualKind=["lighting","waveMaker","overflow"].includes(e.kind);
      const migrateLegacy=visualKind && e.location==="external" && !e.displayPosition;
      const location=(migrateLegacy?"display":e.location) as Equipment["location"];
      const peers=(tank.equipment??[]).filter(x=>x.kind===e.kind && (["display","external"].includes(x.location))).length;
      return {...e,location,displayPosition:location==="display"?(e.displayPosition??defaultDisplayPosition(e.kind,i,Math.max(1,peers))):e.displayPosition};
    }),
    chemistry:tank.chemistry ?? [],
    maintenance:tank.maintenance ?? [],
    livestock:tank.livestock ?? [],
    livestockExits:tank.livestockExits ?? [],
    inventory:tank.inventory ?? [],
    timeline:tank.timeline ?? [],
    intelligenceEvents:tank.intelligenceEvents ?? [],
    guidanceActions:tank.guidanceActions ?? [],
    healthSnapshots:tank.healthSnapshots ?? [],
    photos:tank.photos ?? [],
    visionAssessments:tank.visionAssessments ?? [],
    feeding:tank.feeding ?? [],
    dosing:tank.dosing ?? [],
    doserChannels:tank.doserChannels ?? [],
    filterMedia:tank.filterMedia ?? [],
    quarantine:tank.quarantine ?? [],
    emergencySessions:tank.emergencySessions ?? [],
    expenses:tank.expenses ?? [],
    waterChanges:tank.waterChanges ?? [],
    rodi:tank.rodi ?? [],
    rodiServiceEvents:tank.rodiServiceEvents ?? [],
    plantCare:tank.plantCare ?? [],
    acclimationSessions:tank.acclimationSessions ?? []
  });
}

function fingerprint(values:any[]){
  return JSON.stringify(values);
}

function changeReason(before:Tank,after:Tank):ChangeReason|null{
  const latest=after.timeline[0];
  if(latest&&latest.id!==before.timeline[0]?.id){
    return {ar:latest.textAr,en:latest.textEn,eventId:latest.id,timestamp:latest.timestamp};
  }
  if(after.chemistry.length!==before.chemistry.length)return {ar:"تم تسجيل فحص كيميائي جديد.",en:"A new chemistry test was logged."};
  if(fingerprint(after.maintenance.map(x=>[x.id,x.done,x.nextDue,x.lastDone]))!==fingerprint(before.maintenance.map(x=>[x.id,x.done,x.nextDue,x.lastDone])))return {ar:"تغيرت حالة خطة الصيانة.",en:"The maintenance plan status changed."};
  if(fingerprint(after.equipment.map(x=>[x.id,x.status,x.location]))!==fingerprint(before.equipment.map(x=>[x.id,x.status,x.location])))return {ar:"تغيرت حالة أو إعدادات المعدات.",en:"Equipment status or configuration changed."};
  if(fingerprint(after.livestock.map(x=>[x.id,x.quantity,x.health]))!==fingerprint(before.livestock.map(x=>[x.id,x.quantity,x.health]))||after.livestockExits?.length!==before.livestockExits?.length)return {ar:"تغيرت كائنات الحوض أو حالتها.",en:"Tank livestock or livestock health changed."};
  if(fingerprint((after.filterMedia??[]).map(x=>[x.id,x.kind,x.amountGrams,x.installedAt]))!==fingerprint((before.filterMedia??[]).map(x=>[x.id,x.kind,x.amountGrams,x.installedAt])))return {ar:"تغيرت ميديا الفلترة أو تم استبدالها.",en:"Filter media configuration or replacement changed."};
  if(after.waterChanges.length!==before.waterChanges.length)return {ar:"تم تسجيل تغيير ماء.",en:"A water change was logged."};
  if(after.dosing.length!==before.dosing.length)return {ar:"تم تسجيل جرعة جديدة.",en:"A dosing event was logged."};
  if(after.feeding.length!==before.feeding.length)return {ar:"تم تسجيل تغذية.",en:"A feeding event was logged."};
  if((after.plantCare?.length??0)!==(before.plantCare?.length??0))return {ar:"تم تسجيل إجراء رعاية للنباتات.",en:"A plant-care action was logged."};
  if((after.rodiServiceEvents?.length??0)!==(before.rodiServiceEvents?.length??0))return {ar:"تم تسجيل صيانة لنظام RO/DI.",en:"RO/DI service was logged."};
  if(fingerprint(after.doserChannels.map(x=>[x.id,x.material,x.capacityMl,x.currentMl,x.consumption,x.period]))!==fingerprint(before.doserChannels.map(x=>[x.id,x.material,x.capacityMl,x.currentMl,x.consumption,x.period])))return {ar:"تغير إعداد أو مستوى إحدى قنوات الدوزر.",en:"A doser channel configuration or level changed."};
  if(before.ecosystemProfile!==after.ecosystemProfile||before.plantedMode!==after.plantedMode||before.substrateType!==after.substrateType||before.substrateStartedAt!==after.substrateStartedAt||before.systemVolumeLiters!==after.systemVolumeLiters)return {ar:"تغيرت معلومات تشغيلية أساسية للحوض.",en:"Core tank operating information changed."};
  if(fingerprint(after.quarantine.map(x=>[x.id,x.status,x.reason,x.dosesGiven,x.nextDoseAt]))!==fingerprint(before.quarantine.map(x=>[x.id,x.status,x.reason,x.dosesGiven,x.nextDoseAt])))return {ar:"تغيرت حالة الحجر أو العلاج.",en:"Quarantine or treatment status changed."};
  if(fingerprint((after.emergencySessions??[]).map(x=>[x.id,x.status,x.completedSteps.length]))!==fingerprint((before.emergencySessions??[]).map(x=>[x.id,x.status,x.completedSteps.length])))return {ar:"تغيرت حالة بروتوكول طوارئ.",en:"Emergency protocol status changed."};
  if(fingerprint((after.acclimationSessions??[]).map(x=>[x.id,x.status,x.completedAt]))!==fingerprint((before.acclimationSessions??[]).map(x=>[x.id,x.status,x.completedAt])))return {ar:"تغيرت حالة جلسة الإقلمة.",en:"Acclimation session status changed."};
  const beforeScore=tankStateScore(before),afterScore=tankStateScore(after);
  if(beforeScore!==afterScore)return {ar:"تغيرت حالة الحوض المحسوبة.",en:"The calculated tank state changed."};
  return null;
}

function withHealthSnapshot(before:Tank,after:Tank):Tank{
  const reason=changeReason(before,after);
  if(!reason)return after;
  const score=tankStateScore(after);
  const timestamp=reason.timestamp??new Date().toISOString();
  const last=after.healthSnapshots?.[0];
  if(last&&last.score===score&&last.reasonAr===reason.ar&&Math.abs(new Date(timestamp).getTime()-new Date(last.timestamp).getTime())<2000)return after;
  const snapshot:HealthSnapshot={
    id:`hs-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    timestamp,
    score,
    chemistry:chemistryHealthAssessment(after).score,
    maintenance:maintenanceHealth(after),
    state:tankStateView(after).band,
    reasonAr:reason.ar,
    reasonEn:reason.en,
    relatedEventId:reason.eventId,
    tankBrainVersion:TANK_BRAIN_VERSION,
    healthModelVersion:HEALTH_MODEL_VERSION,
    chemistryEvidenceVersion:CHEMISTRY_EVIDENCE_VERSION
  };
  return {...after,healthSnapshots:[snapshot,...(after.healthSnapshots??[])].slice(0,365)};
}

const TRAINING_IDS=new Set([demoMarineTank.id,demoFreshwaterTank.id,"reef-01","fresh-01"]);

function freshTrainingTank(source:Tank):Tank{
  const copy=JSON.parse(JSON.stringify(source)) as Tank;
  if(copy.chemistry[0])copy.chemistry[0]={...copy.chemistry[0],timestamp:new Date().toISOString(),usingDefaults:false};
  copy.healthSnapshots=[];
  return normalize(copy);
}

function canonicalTrainingTanks():Tank[]{
  return [freshTrainingTank(demoMarineTank),freshTrainingTank(demoFreshwaterTank)];
}

function withCanonicalTraining(tanks:Tank[]):Tank[]{
  const canonical=canonicalTrainingTanks();
  const persistedTraining=tanks.filter(t=>t.isTraining||TRAINING_IDS.has(t.id));
  const protectedTraining=canonical.map(base=>{
    const existing=persistedTraining.find(t=>t.id===base.id);
    return existing?normalize({...existing,isTraining:true,trainingStartedAt:existing.trainingStartedAt??base.trainingStartedAt}):base;
  });
  const real=tanks.filter(t=>!t.isTraining&&!TRAINING_IDS.has(t.id)).map(normalize);
  return [...protectedTraining,...real];
}

export const useAquaStore = create<AquaStore>()(
  persist(
    (set) => ({
      language:"ar",
      aquariumExperience:"beginner",
      selectedTankId:demoMarineTank.id,
      tanks:canonicalTrainingTanks(),

      setLanguage:(language)=>set({language}),
      setAquariumExperience:(aquariumExperience)=>set({aquariumExperience}),
      selectTank:(selectedTankId)=>set({selectedTankId}),

      addTank:(tank)=>set((state)=>({
        tanks:[...state.tanks,normalize({...tank,isTraining:false})],
        selectedTankId:tank.id
      })),

      deleteTank:(tankId)=>set((state)=>{
        const target=state.tanks.find(t=>t.id===tankId);
        if(target?.isTraining)return state;
        recordCloudDeleteTombstone(tankId);
        void clearTankHistoryArchive(tankId);
        void clearLongTermHistory(tankId);
        const tanks=state.tanks.filter(t=>t.id!==tankId);
        const real=tanks.filter(t=>!t.isTraining);
        return {
          ...state,
          tanks,
          selectedTankId: state.selectedTankId===tankId ? (real[0]?.id ?? tanks[0]?.id ?? demoMarineTank.id) : state.selectedTankId
        };
      }),

      patchTank:(tankId,updater)=>set((state)=>({
        tanks:state.tanks.map(t=>{
          if(t.id!==tankId)return t;
          const nextRaw=typeof updater==="function" ? updater(t) : {...t,...updater};
          let next=normalize(nextRaw);
          const events=[...deriveIntelligenceEvents(t,next),...deriveExtendedIntelligenceEvents(t,next)];
          if(events.length)next={...next,intelligenceEvents:mergeIntelligenceEvents(t.intelligenceEvents,events)};
          const core=tankIntelligenceCore(next);
          next={...next,guidanceActions:reconcileGuidanceActions(t.guidanceActions,core.guidanceActions,next.intelligenceEvents)};
          return withHealthSnapshot(t,next);
        })
      })),

      addChemistryReading:(tankId,reading)=>set((state)=>({
        tanks:state.tanks.map(t=>{
          if(t.id!==tankId)return t;
          let next=normalize({...t,chemistry:[reading,...(t.chemistry??[])]});
          const events=[...deriveIntelligenceEvents(t,next),...deriveExtendedIntelligenceEvents(t,next)];
          next={...next,intelligenceEvents:mergeIntelligenceEvents(t.intelligenceEvents,events)};
          const core=tankIntelligenceCore(next);
          next={...next,guidanceActions:reconcileGuidanceActions(t.guidanceActions,core.guidanceActions,next.intelligenceEvents)};
          return withHealthSnapshot(t,next);
        })
      })),

      replaceTankSnapshot:(tankId,tank)=>set((state)=>({
        ...state,
        tanks:state.tanks.map(existing=>existing.id===tankId?normalize({...tank,id:tankId,isTraining:false}):existing)
      })),

      replaceData:(data)=>set((state)=>{
        const tanks=withCanonicalTraining(data.tanks);
        const requested=tanks.find(t=>t.id===data.selectedTankId);
        const firstReal=tanks.find(t=>!t.isTraining);
        return {
          ...state,
          language:data.language,
          aquariumExperience:data.aquariumExperience,
          selectedTankId:requested?.id ?? firstReal?.id ?? demoMarineTank.id,
          tanks
        };
      }),

      resetDemo:()=>set((state)=>{
        const real=state.tanks.filter(t=>!t.isTraining&&!TRAINING_IDS.has(t.id)).map(normalize);
        const tanks=[...canonicalTrainingTanks(),...real];
        const selectedExists=real.some(t=>t.id===state.selectedTankId);
        return {...state,tanks,selectedTankId:selectedExists?state.selectedTankId:demoMarineTank.id};
      }),

      resetTrainingTank:(tankId)=>set((state)=>{
        const source=tankId===demoFreshwaterTank.id?demoFreshwaterTank:demoMarineTank;
        const fresh=freshTrainingTank(source);
        const exists=state.tanks.some(t=>t.id===fresh.id);
        const tanks=exists?state.tanks.map(t=>t.id===fresh.id?fresh:t):[fresh,...state.tanks];
        return {...state,tanks,selectedTankId:fresh.id};
      })
    }),
    {
      name:"aqua-nexus-3d-v1",
      version:9,
      storage:createJSONStorage(()=>aquaStateStorage),
      migrate:(persisted:any,fromVersion:number)=>{
        const p=persisted??{};
        // Release migrations are non-destructive. Preserve real tanks and add/
        // normalize protected training tanks around them.
        if(typeof window!=="undefined"&&fromVersion<9){
          try{
            const key="aqua-nexus-pre-v9-backup";
            if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p));
          }catch{}
        }
        const tanks=withCanonicalTraining(Array.isArray(p.tanks)?p.tanks:[]);
        const requested=tanks.find(t=>t.id===p.selectedTankId);
        const firstReal=tanks.find(t=>!t.isTraining);
        return {...p,aquariumExperience:["beginner","intermediate","advanced"].includes(p.aquariumExperience)?p.aquariumExperience:"beginner",tanks,selectedTankId:requested?.id??firstReal?.id??demoMarineTank.id};
      },
      merge:(persisted:any,current)=>{
        const p=persisted??{};
        const tanks=withCanonicalTraining(p.tanks??current.tanks);
        const requested=tanks.find(t=>t.id===p.selectedTankId);
        const firstReal=tanks.find(t=>!t.isTraining);
        return {...current,...p,aquariumExperience:["beginner","intermediate","advanced"].includes(p.aquariumExperience)?p.aquariumExperience:"beginner",tanks,selectedTankId:requested?.id??firstReal?.id??demoMarineTank.id};
      }
    }
  )
);
