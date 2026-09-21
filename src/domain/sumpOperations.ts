import type { DimensionsCm,SumpChamber,Tank } from "./types";

export function fitChamberToSump(chamber:SumpChamber,dimensions:DimensionsCm):SumpChamber{
  const finite=(value:number,fallback:number)=>Number.isFinite(value)?value:fallback;
  const dimLength=Math.max(1,finite(dimensions.length,1)),dimWidth=Math.max(1,finite(dimensions.width,1)),dimHeight=Math.max(1,finite(dimensions.height,1));
  const length=Math.max(1,Math.min(finite(chamber.length,1),dimLength));
  const width=Math.max(1,Math.min(finite(chamber.width,1),dimWidth));
  const height=Math.max(1,Math.min(finite(chamber.height,1),dimHeight));
  return{
    ...chamber,
    x:Math.max(0,Math.min(finite(chamber.x,0),Math.max(0,dimLength-length))),
    y:Math.max(0,Math.min(finite(chamber.y,0),Math.max(0,dimWidth-width))),
    length,width,height,
    waterHeight:Math.max(0,Math.min(finite(chamber.waterHeight,0),height))
  };
}

export function sumpChamberContents(tank:Tank,chamber:SumpChamber){
  const equipment=tank.equipment.filter(e=>e.location===`sump:${chamber.id}`).map(e=>e.name);
  const filterMedia=(tank.filterMedia??[]).filter(m=>m.chamberId===chamber.id).map(m=>m.name);
  const manual=[...(chamber.items??[]),chamber.contents].filter((x):x is string=>Boolean(x?.trim()));
  return{equipment,filterMedia,manual};
}
