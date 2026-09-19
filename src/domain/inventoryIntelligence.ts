import type { Tank } from "./types";

export interface UnifiedStockRow{
  id:string;
  source:"inventory"|"equipment-consumable";
  name:string;
  nameEn?:string;
  category:string;
  quantity:number;
  minimum:number;
  unit:string;
  equipmentId?:string;
  consumableId?:string;
}

export function unifiedInventory(tank:Tank){
  const general:UnifiedStockRow[]=tank.inventory.map(x=>({
    id:x.id,source:"inventory",name:x.name,nameEn:x.nameEn,category:x.category||"General",
    quantity:x.quantity,minimum:x.minimum,unit:x.unit
  }));
  const consumables:UnifiedStockRow[]=tank.equipment.flatMap(e=>(e.consumables??[]).map(c=>({
    id:`${e.id}:${c.id}`,source:"equipment-consumable" as const,name:c.name,nameEn:c.nameEn,
    category:e.name,quantity:c.quantityOnHand??0,minimum:c.minimumOnHand??0,unit:c.unit??"pc",
    equipmentId:e.id,consumableId:c.id
  })));
  const rows=[...general,...consumables];
  const low=rows.filter(x=>x.quantity<=x.minimum);
  return {rows,general,consumables,low,total:rows.length};
}
