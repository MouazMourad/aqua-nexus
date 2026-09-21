import type { JournalPhoto,Tank } from "./types";

function tail<T>(rows:T[]|undefined,limit:number){return (rows??[]).slice(0,limit);}
function photoMeta(photo:JournalPhoto){
  const {dataUrl,...meta}=photo;
  return {...meta,hasStoredPreview:Boolean(photo.previewKey)||Boolean(dataUrl),embeddedPreviewBytes:dataUrl?.length??0};
}

/**
 * Canonical, bounded Tank Brain snapshot.
 *
 * This is the contract between the unified tank state and any reasoning layer.
 * It intentionally includes every Tank domain while keeping large binary/media
 * payloads out of the reasoning context. Pages may present only a subset, but
 * no meaningful tank datum should be invisible to the brain because of where
 * it was entered.
 */
export function buildTankBrainSnapshot(tank:Tank){
  const extended=tank as Tank & {aiActionPlans?:unknown[]};
  const activeAcclimation=(tank.acclimationSessions??[]).filter(x=>x.status!=="completed");
  const recentAcclimation=(tank.acclimationSessions??[]).filter(x=>x.status==="completed").slice(0,8);
  return {
    schema:"aqua-nexus-tank-brain/v1",
    generatedAt:new Date().toISOString(),
    identity:{
      id:tank.id,name:tank.name,type:tank.type,status:tank.status,ageMonths:tank.ageMonths,
      ecosystemProfile:tank.ecosystemProfile,plantedMode:tank.plantedMode,
      substrateType:tank.substrateType,substrateStartedAt:tank.substrateStartedAt,
      createdAt:tank.createdAt,isTraining:Boolean(tank.isTraining),trainingStartedAt:tank.trainingStartedAt
    },
    geometry:{display:tank.display,sump:tank.sump,systemVolumeLiters:tank.systemVolumeLiters},
    equipment:{
      items:tank.equipment,
      energySettings:tank.energySettings,
      doserChannels:tank.doserChannels,
      filterMedia:tank.filterMedia??[]
    },
    chemistry:{count:tank.chemistry.length,recent:tail(tank.chemistry,40)},
    maintenance:{count:tank.maintenance.length,items:tail(tank.maintenance,120)},
    livestock:{
      current:tank.livestock,
      exits:tail(tank.livestockExits,80),
      quarantine:tank.quarantine,
      emergencySessions:tail(tank.emergencySessions,20)
    },
    inventory:{count:tank.inventory.length,items:tank.inventory},
    operations:{
      feeding:tail(tank.feeding,60),
      dosing:tail(tank.dosing,60),
      waterChanges:tail(tank.waterChanges,60),
      rodiBatches:tail(tank.rodi,60),
      rodiServiceEvents:tail(tank.rodiServiceEvents,60),
      plantCare:tail(tank.plantCare,60),
      expenses:tail(tank.expenses,60)
    },
    biologicalCycle:tank.biologicalCycle??null,
    lifecycle:tank.lifecycle??null,
    acclimation:{
      active:activeAcclimation,
      recentCompleted:recentAcclimation,
      totalSessions:(tank.acclimationSessions??[]).length
    },
    intelligence:{
      events:tail(tank.intelligenceEvents,250),
      guidance:tail(tank.guidanceActions,120),
      healthSnapshots:tail(tank.healthSnapshots,120),
      timeline:tail(tank.timeline,120),
      aiActionPlans:tail(extended.aiActionPlans,40)
    },
    vision:{
      photos:tail(tank.photos,40).map(photoMeta),
      assessments:tail(tank.visionAssessments,30)
    },
    coverage:{
      chemistry:tank.chemistry.length,
      maintenance:tank.maintenance.length,
      livestock:tank.livestock.length,
      equipment:tank.equipment.length,
      inventory:tank.inventory.length,
      timeline:tank.timeline.length,
      intelligenceEvents:tank.intelligenceEvents?.length??0,
      photos:tank.photos.length,
      feeding:tank.feeding.length,
      dosing:tank.dosing.length,
      waterChanges:tank.waterChanges.length,
      rodi:tank.rodi.length,
      rodiServiceEvents:tank.rodiServiceEvents?.length??0,
      plantCare:tank.plantCare?.length??0,
      acclimationSessions:tank.acclimationSessions?.length??0,
      aiActionPlans:extended.aiActionPlans?.length??0,
      vacations:tank.lifecycle?.vacations?.length??0,
      relocations:tank.lifecycle?.relocations?.length??0,
      restarts:tank.lifecycle?.restarts?.length??0
    }
  };
}

export type TankBrainSnapshot=ReturnType<typeof buildTankBrainSnapshot>;
