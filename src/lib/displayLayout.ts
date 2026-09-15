import type { DisplayEquipmentPosition, Equipment, EquipmentKind } from "@/domain/types";

export function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v));}

export function defaultDisplayPosition(kind:EquipmentKind,index=0,total=1):DisplayEquipmentPosition {
  if(kind==="lighting"){
    const x = total<=1 ? 50 : 16 + (68 * index / Math.max(1,total-1));
    return {xPct:x,yPct:116,zPct:50,rotationY:0,scale:1};
  }
  if(kind==="waveMaker"){
    const right=index%2===1;
    return {xPct:right?94:6,yPct:58-(Math.floor(index/2)*11),zPct:48,rotationY:right?180:0,flowStrength:100,scale:1};
  }
  if(kind==="overflow") return {xPct:92,yPct:76,zPct:12,rotationY:180,scale:1};
  if(kind==="heater") return {xPct:86,yPct:38,zPct:15,rotationY:0,scale:1};
  if(kind==="probe") return {xPct:78,yPct:72,zPct:12,rotationY:0,scale:1};
  if(kind==="ato") return {xPct:70,yPct:78,zPct:12,rotationY:0,scale:1};
  return {xPct:50,yPct:45,zPct:50,rotationY:0,scale:1};
}

export function resolvedPosition(e:Equipment,index=0,total=1):DisplayEquipmentPosition {
  return {...defaultDisplayPosition(e.kind,index,total),...(e.displayPosition??{})};
}

export function displayScenePosition(
  e:Equipment,
  width:number,
  depth:number,
  height:number,
  displayBottom:number,
  index=0,
  total=1
):[number,number,number] {
  const p=resolvedPosition(e,index,total);
  const x=-width/2 + clamp(p.xPct,0,100)/100*width;
  const y=displayBottom + clamp(p.yPct,0,100)/100*height;
  const z=-depth/2 + clamp(p.zPct,0,100)/100*depth;
  return [x,y,z];
}

export function suggestedLocation(kind:EquipmentKind, sumpChambers:{id:string}[]) {
  if(["lighting","waveMaker","overflow"].includes(kind)) return "display" as const;
  if(kind==="returnPump" && sumpChambers.length) return `sump:${sumpChambers[sumpChambers.length-1].id}` as const;
  if(["filterSock","rollerFilter"].includes(kind) && sumpChambers.length) return `sump:${sumpChambers[0].id}` as const;
  if(["skimmer","reactor","refugiumLight","turfScrubber","heater","probe"].includes(kind) && sumpChambers.length) {
    return `sump:${sumpChambers[Math.min(1,sumpChambers.length-1)].id}` as const;
  }
  return "external" as const;
}


export function overflowPlumbingMode(e:Equipment):"combined"|"separate" {
  return e.overflowPlumbingMode ?? "combined";
}

export function resolvedOverflowReturnPosition(
  e:Equipment,
  index=0,
  total=1
):DisplayEquipmentPosition {
  const base=resolvedPosition(e,index,total);
  if(overflowPlumbingMode(e)==="combined"){
    const side=base.xPct>=50 ? -1 : 1;
    return {
      xPct:clamp(base.xPct + side*6,2,98),
      yPct:clamp(base.yPct-4,8,94),
      zPct:clamp(base.zPct+7,3,97),
      rotationY:base.xPct>=50?180:0,
      scale:.82
    };
  }
  return {
    xPct:base.xPct>=50?82:18,
    yPct:78,
    zPct:18,
    rotationY:base.xPct>=50?180:0,
    scale:.82,
    ...(e.overflowReturnPosition??{})
  };
}

export function overflowReturnScenePosition(
  e:Equipment,
  width:number,
  depth:number,
  height:number,
  displayBottom:number,
  index=0,
  total=1
):[number,number,number] {
  const p=resolvedOverflowReturnPosition(e,index,total);
  const x=-width/2 + clamp(p.xPct,0,100)/100*width;
  const y=displayBottom + clamp(p.yPct,0,100)/100*height;
  const z=-depth/2 + clamp(p.zPct,0,100)/100*depth;
  return [x,y,z];
}
