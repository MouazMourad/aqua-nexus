import type { Tank,TankRelocationEvent,TankVacationPeriod } from "./types";

export function activeVacation(tank:Tank):TankVacationPeriod|undefined{
  return [...(tank.lifecycle?.vacations??[])].reverse().find(x=>!x.endedAt);
}
export function activeRelocation(tank:Tank):TankRelocationEvent|undefined{
  return [...(tank.lifecycle?.relocations??[])].reverse().find(x=>x.status!=="completed");
}
export function isTankArchived(tank:Tank){return Boolean(tank.lifecycle?.archivedAt);}
export function archivedPageAllowed(page:string){
  return ["dashboard","tanks","timeline","reports","alerts","settings"].includes(page);
}
