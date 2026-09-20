import type { DimensionsCm,SumpChamber,Tank } from "./types";

export function fitChamberToSump(chamber:SumpChamber,dimensions:DimensionsCm):SumpChamber{
  const length=Math.max(1,Math.min(chamber.length,Math.max(1,dimensions.length)));
  const width=Math.max(1,Math.min(chamber.width,Math.max(1,dimensions.width)));
  const height=Math.max(1,Math.min(chamber.height,Math.max(1,dimensions.height)));
  return{
    ...chamber,
    x:Math.max(0,Math.min(chamber.x,Math.max(0,dimensions.length-length))),
    y:Math.max(0,Math.min(chamber.y,Math.max(0,dimensions.width-width))),
    length,width,height,
    waterHeight:Math.max(0,Math.min(chamber.waterHeight,height))
  };
}

export function sumpChamberContents(tank:Tank,chamber:SumpChamber){
  const equipment=tank.equipment.filter(e=>e.location===`sump:${chamber.id}`).map(e=>e.name);
  const filterMedia=(tank.filterMedia??[]).filter(m=>m.chamberId===chamber.id).map(m=>m.name);
  const manual=[...(chamber.items??[]),chamber.contents].filter((x):x is string=>Boolean(x?.trim()));
  return{equipment,filterMedia,manual};
}
