import type { IntelligenceEvent,Tank } from "./types";

const now=()=>new Date().toISOString();
const makeId=(domain:string,verb:string,source:string)=>`evt-${domain}-${verb}-${source}`;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const bucketSource=(id:string)=>`${id}:${Math.floor(Date.now()/60000)}`;
const changedKeys=(before:any,after:any,keys:string[])=>keys.filter(key=>!same(before?.[key],after?.[key]));
const snapshot=(value:any,keys:string[])=>JSON.stringify(Object.fromEntries(keys.map(key=>[key,value?.[key]??null])));

export function deriveExtendedIntelligenceEvents(before:Tank,after:Tank):IntelligenceEvent[]{
  const out:IntelligenceEvent[]=[];
  const push=(event:Omit<IntelligenceEvent,"id">)=>out.push({id:makeId(event.domain,event.verb,event.sourceId??String(Date.now())),...event});

  for(const row of after.plantCare??[]){
    if((before.plantCare??[]).some(x=>x.id===row.id))continue;
    const fertilizer=row.kind==="fertilizer";
    push({
      timestamp:row.timestamp,kind:"action",domain:"plantCare",verb:fertilizer?"fertilized":"co2_refilled",
      entityType:fertilizer?"fertilizer":"co2",entityId:row.equipmentId,confidence:100,sourceId:row.id,sourcePage:"livestock",
      textAr:fertilizer?"تم تسجيل تسميد للنباتات":"تم تسجيل تعبئة CO₂ للنظام المزروع",
      textEn:fertilizer?"Plant fertilization was logged":"A planted-system CO₂ refill was logged",
      metadata:{
        inventoryItemId:row.inventoryUse?.inventoryItemId??null,
        quantity:row.inventoryUse?.quantity??null,
        unit:row.inventoryUse?.unit??null,
        equipmentId:row.equipmentId??null,
        notes:row.notes??null
      }
    });
  }

  for(const row of after.rodiServiceEvents??[]){
    if((before.rodiServiceEvents??[]).some(x=>x.id===row.id))continue;
    push({
      timestamp:row.timestamp,kind:"action",domain:"rodi",verb:"service_completed",entityType:row.component,
      entityId:row.component,confidence:100,sourceId:row.id,sourcePage:"rodi",
      textAr:`تمت صيانة RO/DI: استبدال ${row.component}`,
      textEn:`RO/DI service completed: ${row.component} replaced`,
      metadata:{
        component:row.component,
        inventoryItemId:row.inventoryUse?.inventoryItemId??null,
        quantity:row.inventoryUse?.quantity??null,
        unit:row.inventoryUse?.unit??null,
        notes:row.notes??null
      }
    });
  }

  const beforeChannels=new Map(before.doserChannels.map(x=>[x.id,x]));
  for(const channel of after.doserChannels){
    const old=beforeChannels.get(channel.id);
    if(!old){
      push({
        timestamp:now(),kind:"fact",domain:"dosing",verb:"doser_channel_added",entityType:"doserChannel",entityId:channel.id,
        confidence:100,sourceId:`${channel.id}:added`,sourcePage:"dosing",
        textAr:`تمت إضافة قناة دوزر: ${channel.name}`,textEn:`Doser channel added: ${channel.name}`,
        metadata:{material:channel.material,capacityMl:channel.capacityMl,currentMl:channel.currentMl,consumption:channel.consumption,period:channel.period}
      });
    }else if(!same(old,channel)){
      const stamp=Date.now();
      push({
        timestamp:now(),kind:"observation",domain:"dosing",verb:"doser_channel_changed",entityType:"doserChannel",entityId:channel.id,
        confidence:100,sourceId:`${channel.id}:${stamp}`,sourcePage:"dosing",
        textAr:`تغير إعداد/مخزون قناة الدوزر ${channel.name}`,textEn:`Doser channel configuration/level changed for ${channel.name}`,
        metadata:{material:channel.material,capacityMl:channel.capacityMl,currentMl:channel.currentMl,consumption:channel.consumption,period:channel.period}
      });
    }
  }
  for(const old of before.doserChannels){
    if(after.doserChannels.some(x=>x.id===old.id))continue;
    push({
      timestamp:now(),kind:"action",domain:"dosing",verb:"doser_channel_removed",entityType:"doserChannel",entityId:old.id,
      confidence:100,sourceId:`${old.id}:removed:${Date.now()}`,sourcePage:"dosing",
      textAr:`تمت إزالة قناة الدوزر ${old.name}`,textEn:`Doser channel removed: ${old.name}`
    });
  }

  const beforeProfile={
    ecosystemProfile:before.ecosystemProfile,plantedMode:before.plantedMode,substrateType:before.substrateType,
    substrateStartedAt:before.substrateStartedAt,status:before.status,systemVolumeLiters:before.systemVolumeLiters
  };
  const afterProfile={
    ecosystemProfile:after.ecosystemProfile,plantedMode:after.plantedMode,substrateType:after.substrateType,
    substrateStartedAt:after.substrateStartedAt,status:after.status,systemVolumeLiters:after.systemVolumeLiters
  };
  if(!same(beforeProfile,afterProfile)){
    const changed=Object.keys(afterProfile).filter(key=>(beforeProfile as any)[key]!=(afterProfile as any)[key]);
    push({
      timestamp:now(),kind:"fact",domain:"system",verb:"tank_profile_changed",entityType:"tank",entityId:after.id,
      confidence:100,sourceId:`${after.id}:profile:${Date.now()}`,sourcePage:"settings",
      textAr:`تغيرت معلومات تشغيلية بالحوض: ${changed.join("، ")}`,
      textEn:`Tank operating profile changed: ${changed.join(", ")}`,
      metadata:{
        changed:changed.join(","),
        ecosystemProfile:after.ecosystemProfile??null,
        plantedMode:after.plantedMode??null,
        substrateType:after.substrateType??null,
        substrateStartedAt:after.substrateStartedAt??null,
        status:after.status,
        systemVolumeLiters:after.systemVolumeLiters
      }
    });
  }


  // Field-level operational memory. These events are coalesced per entity/minute
  // so live editors/sliders do not flood history, while the final meaningful
  // configuration remains visible to Tank Brain.
  const equipmentFields=["name","kind","brand","model","installedAt","lastServiceAt","serviceIntervalDays","futurePlan","displayPosition","overflowPlumbingMode","overflowReturnPosition","powerWatts","hoursPerDay","ratedVolumeLiters","flowLph","parAtTargetDepth","coverageLengthCm","coverageWidthCm","expectedLifeMinDays","expectedLifeMaxDays","criticality","redundancyGroup","spareAvailable","backupPlan","consumables","postActionCheckAt","co2Mode","co2CylinderRemainingPercent","co2DropChecker"];
  const beforeEquipment=new Map(before.equipment.map(x=>[x.id,x]));
  for(const device of after.equipment){
    const old=beforeEquipment.get(device.id); if(!old)continue;
    if(old.lastServiceAt!==device.lastServiceAt&&device.lastServiceAt){
      push({
        timestamp:now(),kind:"action",domain:"equipment",verb:"serviced",entityType:device.kind,entityId:device.id,confidence:100,
        sourceId:`${device.id}:service:${device.lastServiceAt}`,sourcePage:"equipment",
        textAr:`تم تسجيل صيانة للجهاز ${device.name}`,textEn:`Service recorded for ${device.name}`,
        metadata:{lastServiceAt:device.lastServiceAt,postActionCheckAt:device.postActionCheckAt??null}
      });
    }
    const changed=changedKeys(old,device,equipmentFields.filter(x=>x!=="lastServiceAt"&&x!=="postActionCheckAt"));
    if(changed.length)push({
      timestamp:now(),kind:"fact",domain:"equipment",verb:"configuration_changed",entityType:device.kind,entityId:device.id,confidence:100,
      sourceId:bucketSource(`${device.id}:config`),sourcePage:"equipment",
      textAr:`تغيرت إعدادات الجهاز ${device.name}: ${changed.join("، ")}`,
      textEn:`${device.name} configuration changed: ${changed.join(", ")}`,
      metadata:{changed:changed.join(","),snapshot:snapshot(device,changed)}
    });
  }

  const livestockFields=["name","nameEn","category","subtype","load","addedAt","notes","sizeCm","lastObservedAt","plantGrowth","plantColor","algaePresent","lastTrimmedAt"];
  const beforeLivestock=new Map(before.livestock.map(x=>[x.id,x]));
  for(const item of after.livestock){
    const old=beforeLivestock.get(item.id); if(!old)continue;
    const changed=changedKeys(old,item,livestockFields);
    if(changed.length)push({
      timestamp:item.lastObservedAt||now(),kind:"observation",domain:"livestock",verb:"observation_updated",entityType:item.category,entityId:item.id,confidence:90,
      sourceId:bucketSource(`${item.id}:observation`),sourcePage:"livestock",
      textAr:`تم تحديث ملاحظات/بيانات ${item.name}: ${changed.join("، ")}`,
      textEn:`${item.nameEn||item.name} observation/details updated: ${changed.join(", ")}`,
      metadata:{changed:changed.join(","),snapshot:snapshot(item,changed)}
    });
  }

  const maintenanceFields=["title","titleEn","cadence","nextDue","manual","intervalDays","checklist","checklistDone","sourceEquipmentId","sourceEquipmentName","autoGenerated"];
  const beforeMaintenance=new Map(before.maintenance.map(x=>[x.id,x]));
  for(const task of after.maintenance){
    const old=beforeMaintenance.get(task.id); if(!old)continue;
    const changed=changedKeys(old,task,maintenanceFields);
    if(changed.length)push({
      timestamp:now(),kind:"fact",domain:"maintenance",verb:"task_changed",entityType:"task",entityId:task.id,confidence:100,
      sourceId:bucketSource(`${task.id}:task`),sourcePage:"maintenance",
      textAr:`تغيرت تفاصيل مهمة الصيانة ${task.title}: ${changed.join("، ")}`,
      textEn:`Maintenance task ${task.titleEn||task.title} changed: ${changed.join(", ")}`,
      metadata:{changed:changed.join(","),snapshot:snapshot(task,changed)}
    });
  }

  const inventoryFields=["name","nameEn","category","categoryEn","inventoryCategory","inventorySubcategory","tankCompatibility","consumedBy","stockBehavior","dosingParameter","dosingCompoundId","unit","minimum"];
  const beforeInventory=new Map(before.inventory.map(x=>[x.id,x]));
  for(const item of after.inventory){
    const old=beforeInventory.get(item.id); if(!old)continue;
    const changed=changedKeys(old,item,inventoryFields);
    if(changed.length)push({
      timestamp:now(),kind:"fact",domain:"inventory",verb:"item_configuration_changed",entityType:"stock",entityId:item.id,confidence:100,
      sourceId:bucketSource(`${item.id}:config`),sourcePage:"inventory",
      textAr:`تغير تعريف المخزون ${item.name}: ${changed.join("، ")}`,
      textEn:`${item.nameEn||item.name} inventory definition changed: ${changed.join(", ")}`,
      metadata:{changed:changed.join(","),snapshot:snapshot(item,changed)}
    });
  }

  if(!same(before.energySettings,after.energySettings))push({
    timestamp:now(),kind:"fact",domain:"equipment",verb:"energy_settings_changed",entityType:"energy",entityId:after.id,confidence:100,
    sourceId:bucketSource(`${after.id}:energy`),sourcePage:"equipment",
    textAr:"تغيرت إعدادات تكلفة الطاقة للحوض",textEn:"Tank energy-cost settings changed",
    metadata:{pricePerKwh:after.energySettings?.pricePerKwh??null,currency:after.energySettings?.currency??null}
  });

  const sumpFields=["enabled","dimensions","operatingFillPercent","chambers"];
  const sumpChanged=changedKeys(before.sump,after.sump,sumpFields);
  if(sumpChanged.length)push({
    timestamp:now(),kind:"fact",domain:"sump",verb:"configuration_changed",entityType:"sump",entityId:after.id,confidence:100,
    sourceId:bucketSource(`${after.id}:sump-config`),sourcePage:"sump",
    textAr:`تغير إعداد السامب: ${sumpChanged.join("، ")}`,textEn:`Sump configuration changed: ${sumpChanged.join(", ")}`,
    metadata:{changed:sumpChanged.join(","),snapshot:snapshot(after.sump,sumpChanged)}
  });

  const beforeMedia=new Map((before.filterMedia??[]).map(x=>[x.id,x]));
  for(const media of after.filterMedia??[]){
    const old=beforeMedia.get(media.id); if(!old)continue;
    const changed=changedKeys(old,media,["name","kind","amountGrams","referenceLifeDays","chamberId","notes","inventoryItemId","inventoryQuantityPerReplacement","inventoryUnit"]);
    if(changed.length)push({
      timestamp:now(),kind:"fact",domain:"sump",verb:"media_configuration_changed",entityType:media.kind,entityId:media.id,confidence:100,
      sourceId:bucketSource(`${media.id}:config`),sourcePage:"sump",
      textAr:`تغيرت إعدادات ميديا الفلترة ${media.name}: ${changed.join("، ")}`,
      textEn:`${media.name} filter-media configuration changed: ${changed.join(", ")}`,
      metadata:{changed:changed.join(","),snapshot:snapshot(media,changed)}
    });
  }
  for(const old of before.filterMedia??[])if(!(after.filterMedia??[]).some(x=>x.id===old.id))push({
    timestamp:now(),kind:"action",domain:"sump",verb:"media_removed",entityType:old.kind,entityId:old.id,confidence:100,
    sourceId:`${old.id}:removed:${Date.now()}`,sourcePage:"sump",
    textAr:`تمت إزالة ميديا الفلترة ${old.name}`,textEn:`Filter media removed: ${old.name}`
  });

  if(!same(before.biologicalCycle,after.biologicalCycle))push({
    timestamp:after.biologicalCycle?.completedAt||after.biologicalCycle?.sourceAddedAt||after.biologicalCycle?.startedAt||now(),
    kind:after.biologicalCycle?.completedAt?"outcome":"fact",domain:"system",verb:"biological_cycle_changed",entityType:"cycle",entityId:after.id,confidence:100,
    sourceId:bucketSource(`${after.id}:cycle`),sourcePage:"dashboard",
    textAr:after.biologicalCycle?.completedAt?"تم تسجيل اكتمال الدورة البيولوجية":"تغيرت بيانات الدورة البيولوجية",
    textEn:after.biologicalCycle?.completedAt?"Biological cycle completion recorded":"Biological cycle data changed",
    metadata:{snapshot:JSON.stringify(after.biologicalCycle??null)}
  });

  const beforeCases=new Map(before.quarantine.map(x=>[x.id,x]));
  for(const item of after.quarantine){
    const old=beforeCases.get(item.id); if(!old)continue;
    const changed=changedKeys(old,item,["suspectedDiseaseId","symptoms","outcome","organism","reason","plan","quarantineVolumeLiters","treatmentProduct","labelDoseMlPer100L","intervalHours","totalDoses","nextDoseAt","notes","medicationInventoryItemId","medicationUnit","medicationQuantityPerDose","responseObservedAt"]);
    if(changed.length)push({
      timestamp:item.responseObservedAt||now(),kind:"observation",domain:"quarantine",verb:"case_updated",entityType:"case",entityId:item.id,confidence:100,
      sourceId:bucketSource(`${item.id}:case`),sourcePage:"quarantine",
      textAr:`تغيرت تفاصيل الحجر/العلاج لـ ${item.organism}: ${changed.join("، ")}`,
      textEn:`Quarantine/treatment details changed for ${item.organism}: ${changed.join(", ")}`,
      metadata:{changed:changed.join(","),snapshot:snapshot(item,changed)}
    });
  }

  const beforePhotos=new Map(before.photos.map(x=>[x.id,x]));
  for(const photo of after.photos){
    const old=beforePhotos.get(photo.id); if(!old)continue;
    const changed=changedKeys(old,photo,["caption","livestockId","estimatedSizeCm"]);
    if(changed.length)push({
      timestamp:now(),kind:"observation",domain:"journal",verb:"photo_metadata_changed",entityType:"photo",entityId:photo.id,confidence:90,
      sourceId:bucketSource(`${photo.id}:meta`),sourcePage:"journal",
      textAr:"تم تحديث بيانات ملاحظة/صورة في السجل",textEn:"Journal photo/observation metadata updated",
      metadata:{changed:changed.join(","),snapshot:snapshot(photo,changed)}
    });
  }


  const beforeVacations=new Map((before.lifecycle?.vacations??[]).map(x=>[x.id,x]));
  for(const row of after.lifecycle?.vacations??[]){
    const old=beforeVacations.get(row.id);
    if(!old)push({
      timestamp:row.startedAt,kind:"action",domain:"system",verb:"vacation_started",entityType:"vacation",entityId:row.id,confidence:100,
      sourceId:`${row.id}:start`,sourcePage:"settings",
      textAr:"بدأ وضع السفر/الغياب للحوض",textEn:"Tank vacation/away mode started",
      metadata:{plannedEndAt:row.plannedEndAt??null,notes:row.notes??null}
    });
    else if(!old.endedAt&&row.endedAt)push({
      timestamp:row.endedAt,kind:"outcome",domain:"system",verb:"vacation_ended",entityType:"vacation",entityId:row.id,confidence:100,
      sourceId:`${row.id}:end`,sourcePage:"settings",
      textAr:"انتهى وضع السفر/الغياب للحوض",textEn:"Tank vacation/away mode ended"
    });
  }

  const beforeMoves=new Map((before.lifecycle?.relocations??[]).map(x=>[x.id,x]));
  for(const row of after.lifecycle?.relocations??[]){
    const old=beforeMoves.get(row.id);
    if(!old)push({
      timestamp:row.startedAt,kind:"action",domain:"system",verb:"relocation_started",entityType:"relocation",entityId:row.id,confidence:100,
      sourceId:`${row.id}:start`,sourcePage:"settings",
      textAr:"بدأ نقل/ترحيل الحوض",textEn:"Tank relocation started",
      metadata:{from:row.from??null,to:row.to??null,notes:row.notes??null}
    });
    else if(old.status!==row.status&&row.status==="completed")push({
      timestamp:row.completedAt||now(),kind:"outcome",domain:"system",verb:"relocation_completed",entityType:"relocation",entityId:row.id,confidence:100,
      sourceId:`${row.id}:completed`,sourcePage:"settings",
      textAr:"اكتمل نقل الحوض",textEn:"Tank relocation completed",
      metadata:{from:row.from??null,to:row.to??null}
    });
  }

  const beforeRestarts=new Set((before.lifecycle?.restarts??[]).map(x=>x.id));
  for(const row of after.lifecycle?.restarts??[])if(!beforeRestarts.has(row.id))push({
    timestamp:row.timestamp,kind:"action",domain:"system",verb:"major_restart",entityType:"tank",entityId:after.id,confidence:100,
    sourceId:row.id,sourcePage:"settings",
    textAr:"تم تسجيل إعادة تشغيل كبرى للحوض وبدء دورة بيولوجية جديدة",textEn:"Major tank restart recorded and a new biological cycle started",
    metadata:{reason:row.reason??null,notes:row.notes??null}
  });

  if(before.lifecycle?.archivedAt!==after.lifecycle?.archivedAt){
    const archived=Boolean(after.lifecycle?.archivedAt);
    push({
      timestamp:after.lifecycle?.archivedAt||now(),kind:archived?"action":"outcome",domain:"system",verb:archived?"tank_archived":"tank_restored",entityType:"tank",entityId:after.id,confidence:100,
      sourceId:`${after.id}:${archived?"archive":"restore"}:${Date.now()}`,sourcePage:"settings",
      textAr:archived?"تمت أرشفة الحوض وإيقاف العمليات التشغيلية":"تمت إعادة الحوض من الأرشيف",
      textEn:archived?"Tank archived; operational workflows are disabled":"Tank restored from archive",
      metadata:{reason:after.lifecycle?.archiveReason??null}
    });
  }

  const beforeAcc=new Map((before.acclimationSessions??[]).map(x=>[x.id,x]));
  for(const session of after.acclimationSessions??[]){
    const old=beforeAcc.get(session.id);
    if(!old)continue;
    const oldItems=new Map(old.items.map(x=>[x.id,x]));
    for(const item of session.items){
      const previous=oldItems.get(item.id);
      if(!previous)continue;
      const statusChanged=previous.status!==item.status;
      const healthChanged=previous.health!==item.health;
      const emergencyChanged=Boolean(previous.emergency)!==Boolean(item.emergency);
      if(!statusChanged&&!healthChanged&&!emergencyChanged)continue;
      push({
        timestamp:item.addedAt||item.readyAt||now(),kind:item.status==="added"?"action":"observation",domain:"acclimation",
        verb:item.status==="added"?"item_transferred":item.emergency?"item_exception":"item_state_changed",
        entityType:item.category,entityId:item.id,value:item.status,confidence:100,
        sourceId:`${session.id}:${item.id}:${item.status}:${item.health}:${Boolean(item.emergency)}`,sourcePage:"acclimation",
        textAr:`${item.name}: حالة الإقلمة ${previous.status} ← ${item.status}${healthChanged?` • الصحة ${item.health}`:""}`,
        textEn:`${item.nameEn||item.name}: acclimation state ${previous.status} → ${item.status}${healthChanged?` • health ${item.health}`:""}`,
        metadata:{
          sessionId:session.id,category:item.category,health:item.health,emergency:Boolean(item.emergency),
          dripMinutes:item.dripMinutes,intervalMinutes:item.intervalMinutes,remainingMs:item.remainingMs??null,
          readyAt:item.readyAt??null,addedAt:item.addedAt??null
        }
      });
    }
  }


  // Coverage contract: meaningful Tank edits that are not naturally append-only
  // still become explicit memory events instead of silently changing the snapshot.
  const coreChanged:string[]=[];
  if(before.name!==after.name)coreChanged.push("name");
  if(before.ageMonths!==after.ageMonths)coreChanged.push("ageMonths");
  if(!same(before.display,after.display))coreChanged.push("display");
  if(coreChanged.length)push({
    timestamp:now(),kind:"fact",domain:"system",verb:"tank_identity_changed",entityType:"tank",entityId:after.id,confidence:100,
    sourceId:bucketSource(`${after.id}:identity`),sourcePage:"tanks",
    textAr:`تغيرت بيانات أساسية للحوض: ${coreChanged.join("، ")}`,
    textEn:`Core tank details changed: ${coreChanged.join(", ")}`,
    metadata:{changed:coreChanged.join(","),name:after.name,ageMonths:after.ageMonths??null,display:JSON.stringify(after.display)}
  });

  for(const old of before.maintenance)if(!after.maintenance.some(x=>x.id===old.id))push({
    timestamp:now(),kind:"action",domain:"maintenance",verb:"task_removed",entityType:"task",entityId:old.id,confidence:100,
    sourceId:`${old.id}:removed:${Date.now()}`,sourcePage:"maintenance",
    textAr:`تمت إزالة مهمة الصيانة ${old.title}`,textEn:`Maintenance task removed: ${old.titleEn||old.title}`
  });
  for(const old of before.inventory)if(!after.inventory.some(x=>x.id===old.id))push({
    timestamp:now(),kind:"action",domain:"inventory",verb:"item_removed",entityType:"stock",entityId:old.id,confidence:100,
    sourceId:`${old.id}:removed:${Date.now()}`,sourcePage:"inventory",
    textAr:`تمت إزالة مادة المخزون ${old.name}`,textEn:`Inventory item removed: ${old.nameEn||old.name}`
  });

  const beforeExpenses=new Map(before.expenses.map(x=>[x.id,x]));
  for(const row of after.expenses){
    const old=beforeExpenses.get(row.id); if(!old)continue;
    const changed=changedKeys(old,row,["description","amount","currency","date","category"]);
    if(changed.length)push({
      timestamp:now(),kind:"fact",domain:"expense",verb:"expense_changed",entityType:"expense",entityId:row.id,confidence:100,
      sourceId:bucketSource(`${row.id}:expense`),sourcePage:"expenses",
      textAr:`تم تعديل سجل مصروف: ${changed.join("، ")}`,textEn:`Expense record changed: ${changed.join(", ")}`,
      metadata:{changed:changed.join(","),snapshot:snapshot(row,changed)}
    });
  }
  for(const old of before.expenses)if(!after.expenses.some(x=>x.id===old.id))push({
    timestamp:now(),kind:"action",domain:"expense",verb:"expense_removed",entityType:"expense",entityId:old.id,confidence:100,
    sourceId:`${old.id}:removed:${Date.now()}`,sourcePage:"expenses",
    textAr:`تم حذف سجل المصروف ${old.description}`,textEn:`Expense record removed: ${old.description}`
  });

  for(const old of before.photos)if(!after.photos.some(x=>x.id===old.id))push({
    timestamp:now(),kind:"action",domain:"journal",verb:"photo_removed",entityType:"photo",entityId:old.id,confidence:100,
    sourceId:`${old.id}:removed:${Date.now()}`,sourcePage:"journal",
    textAr:"تمت إزالة صورة/ملاحظة من السجل",textEn:"A journal photo/observation was removed"
  });

  for(const old of before.quarantine)if(!after.quarantine.some(x=>x.id===old.id))push({
    timestamp:now(),kind:"action",domain:"quarantine",verb:"case_removed",entityType:"case",entityId:old.id,confidence:100,
    sourceId:`${old.id}:removed:${Date.now()}`,sourcePage:"quarantine",
    textAr:`تمت إزالة حالة الحجر/العلاج لـ ${old.organism}`,textEn:`Quarantine/treatment case removed for ${old.organism}`
  });

  const beforePlans=new Map((((before.aiActionPlans??[]) as any[])).map(x=>[String(x.id),x]));
  for(const plan of ((after.aiActionPlans??[]) as any[])){
    const old=beforePlans.get(String(plan.id));
    if(!old)push({
      timestamp:String(plan.createdAt||now()),kind:"action",domain:"system",verb:"ai_plan_created",entityType:"aiActionPlan",entityId:String(plan.id),confidence:100,
      sourceId:`${String(plan.id)}:created`,sourcePage:"dashboard",
      textAr:`تم إنشاء خطة متابعة Local Best AI: ${String(plan.titleAr||plan.titleEn||"")}`,
      textEn:`Local Best AI follow-up plan created: ${String(plan.titleEn||plan.titleAr||"")}`,
      metadata:{focus:(plan.focus as any)?.domain??null,reviewAfterHours:plan.reviewAfterHours??null}
    });
    else{
      const oldDone=Array.isArray((old as any).steps)?(old as any).steps.filter((x:any)=>x.done).length:0;
      const newDone=Array.isArray(plan.steps)?plan.steps.filter((x:any)=>x.done).length:0;
      if((old as any).status!==plan.status||oldDone!==newDone||String((old as any).outcome||"")!==String(plan.outcome||""))push({
        timestamp:String(plan.completedAt||now()),kind:plan.status==="completed"?"outcome":"observation",domain:"system",verb:plan.status==="completed"?"ai_plan_outcome":"ai_plan_progress",
        entityType:"aiActionPlan",entityId:String(plan.id),value:plan.outcome??newDone,confidence:100,
        sourceId:bucketSource(`${String(plan.id)}:progress`),sourcePage:"dashboard",
        textAr:plan.status==="completed"?`تم تقييم خطة Local Best AI: ${String(plan.outcome||"stable")}`:`تقدم تنفيذ خطة Local Best AI: ${newDone}/${Array.isArray(plan.steps)?plan.steps.length:0}`,
        textEn:plan.status==="completed"?`Local Best AI plan outcome: ${String(plan.outcome||"stable")}`:`Local Best AI plan progress: ${newDone}/${Array.isArray(plan.steps)?plan.steps.length:0}`,
        metadata:{outcome:plan.outcome??null,done:newDone,total:Array.isArray(plan.steps)?plan.steps.length:0,focus:(plan.focus as any)?.domain??null}
      });
    }
  }

  // Lifecycle edits after creation are meaningful too (planned return, notes,
  // destination or plan changes), not only start/end transitions.
  for(const row of after.lifecycle?.vacations??[]){
    const old=beforeVacations.get(row.id); if(!old)continue;
    const changed=changedKeys(old,row,["plannedEndAt","notes"]);
    if(changed.length)push({
      timestamp:now(),kind:"fact",domain:"system",verb:"vacation_changed",entityType:"vacation",entityId:row.id,confidence:100,
      sourceId:bucketSource(`${row.id}:vacation`),sourcePage:"settings",
      textAr:"تم تحديث خطة السفر/الغياب",textEn:"Vacation/away plan updated",
      metadata:{changed:changed.join(","),plannedEndAt:row.plannedEndAt??null,notes:row.notes??null}
    });
  }
  for(const row of after.lifecycle?.relocations??[]){
    const old=beforeMoves.get(row.id); if(!old)continue;
    const changed=changedKeys(old,row,["from","to","notes"]);
    if(changed.length)push({
      timestamp:now(),kind:"fact",domain:"system",verb:"relocation_changed",entityType:"relocation",entityId:row.id,confidence:100,
      sourceId:bucketSource(`${row.id}:relocation`),sourcePage:"settings",
      textAr:"تم تحديث تفاصيل نقل الحوض",textEn:"Tank relocation details updated",
      metadata:{changed:changed.join(","),from:row.from??null,to:row.to??null,notes:row.notes??null}
    });
  }

  return out;
}
