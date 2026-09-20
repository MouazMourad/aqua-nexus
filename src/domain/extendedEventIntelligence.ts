import type { IntelligenceEvent,Tank } from "./types";

const now=()=>new Date().toISOString();
const makeId=(domain:string,verb:string,source:string)=>`evt-${domain}-${verb}-${source}`;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

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

  return out;
}
