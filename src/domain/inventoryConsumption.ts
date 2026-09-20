import type { InventoryItem,InventoryUsage } from "./types";

export interface InventoryConsumptionRequest{
  inventoryItemId:string;
  quantity:number;
  expectedUnit?:string;
  role?:string;
}

export type InventoryConsumptionResult=
 | {ok:true;inventory:InventoryItem[];uses:InventoryUsage[]}
 | {ok:false;reason:"missing-item"|"invalid-quantity"|"unit-mismatch"|"insufficient-stock";inventoryItemId:string;required?:number;available?:number;expectedUnit?:string;actualUnit?:string};

export function consumeInventory(inventory:InventoryItem[],requests:InventoryConsumptionRequest[]):InventoryConsumptionResult{
  const grouped=new Map<string,InventoryConsumptionRequest>();
  for(const request of requests){
    if(!request.inventoryItemId)continue;
    if(!Number.isFinite(request.quantity)||request.quantity<=0)return{ok:false,reason:"invalid-quantity",inventoryItemId:request.inventoryItemId};
    const prev=grouped.get(request.inventoryItemId);
    grouped.set(request.inventoryItemId,{...request,quantity:(prev?.quantity??0)+request.quantity,role:request.role||prev?.role,expectedUnit:request.expectedUnit||prev?.expectedUnit});
  }
  const uses:InventoryUsage[]=[];
  for(const request of grouped.values()){
    const item=inventory.find(x=>x.id===request.inventoryItemId);
    if(!item)return{ok:false,reason:"missing-item",inventoryItemId:request.inventoryItemId};
    if(request.expectedUnit&&item.unit.toLowerCase()!==request.expectedUnit.toLowerCase())return{ok:false,reason:"unit-mismatch",inventoryItemId:item.id,expectedUnit:request.expectedUnit,actualUnit:item.unit};
    if(item.quantity<request.quantity)return{ok:false,reason:"insufficient-stock",inventoryItemId:item.id,required:request.quantity,available:item.quantity};
    uses.push({inventoryItemId:item.id,quantity:request.quantity,unit:item.unit,role:request.role,name:item.name});
  }
  const byId=new Map(uses.map(x=>[x.inventoryItemId,x.quantity]));
  return{ok:true,uses,inventory:inventory.map(item=>byId.has(item.id)?{...item,quantity:Math.max(0,item.quantity-(byId.get(item.id)??0))}:item)};
}

export function inventoryConsumptionMessage(result:Exclude<InventoryConsumptionResult,{ok:true}>,lang:"ar"|"en"){
  if(result.reason==="missing-item")return lang==="ar"?"مادة المخزون المحددة لم تعد موجودة.":"The selected inventory item no longer exists.";
  if(result.reason==="invalid-quantity")return lang==="ar"?"أدخل كمية استهلاك صحيحة أكبر من صفر.":"Enter a valid consumed quantity greater than zero.";
  if(result.reason==="unit-mismatch")return lang==="ar"?`وحدة المخزون ${result.actualUnit} لا تطابق الوحدة المطلوبة ${result.expectedUnit}.`:`Inventory unit ${result.actualUnit} does not match required unit ${result.expectedUnit}.`;
  return lang==="ar"?`المخزون غير كافٍ. المطلوب ${result.required} والمتوفر ${result.available}.`:`Insufficient stock. Required ${result.required}; available ${result.available}.`;
}
