import type { AquariumExperienceLevel,Language,Tank } from "@/domain/types";
import { CURRENT_BACKUP_SCHEMA } from "@/domain/backupValidation";
import { hydrateTankHistoryArchiveStrict } from "@/lib/historyArchiveStorage";
import { hydrateLongTermHistoryStrict } from "@/lib/longTermHistory";
import { hydrateTankPhotosForBackupStrict } from "@/lib/photoStorage";

export interface RecoveryBackupEnvelope{
  app:"Aqua Nexus";
  schemaVersion:number;
  exportedAt:string;
  language:Language;
  aquariumExperience:AquariumExperienceLevel;
  selectedTankId:string;
  recovery:{
    completeness:"complete";
    photoAssets:number;
    historyHydrated:true;
  };
  tanks:Tank[];
}

export async function buildCompleteRecoveryBackup(input:{
  tanks:Tank[];
  language:Language;
  aquariumExperience:AquariumExperienceLevel;
  selectedTankId:string;
}):Promise<RecoveryBackupEnvelope>{
  const withHistory:Tank[]=[];
  for(const tank of input.tanks){
    const legacy=await hydrateTankHistoryArchiveStrict(tank);
    const complete=await hydrateLongTermHistoryStrict(legacy);
    withHistory.push(complete);
  }
  const photos=await hydrateTankPhotosForBackupStrict(withHistory);
  return{
    app:"Aqua Nexus",
    schemaVersion:CURRENT_BACKUP_SCHEMA,
    exportedAt:new Date().toISOString(),
    language:input.language,
    aquariumExperience:input.aquariumExperience,
    selectedTankId:input.selectedTankId,
    recovery:{completeness:"complete",photoAssets:photos.audit.complete,historyHydrated:true},
    tanks:photos.tanks
  };
}
