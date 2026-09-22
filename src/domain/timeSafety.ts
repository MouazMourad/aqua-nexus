export const FUTURE_CLOCK_SKEW_MS=10*60*1000;

export function timestampMs(value:string|undefined|null){
  if(!value)return Number.NaN;
  return new Date(value).getTime();
}

export function isMeaningfullyFutureTimestamp(value:string|undefined|null,nowMs=Date.now(),skewMs=FUTURE_CLOCK_SKEW_MS){
  const ms=timestampMs(value);
  return Number.isFinite(ms)&&ms>nowMs+Math.max(0,skewMs);
}

export function isPlausibleOperationalTimestamp(value:string|undefined|null,nowMs=Date.now(),skewMs=FUTURE_CLOCK_SKEW_MS){
  const ms=timestampMs(value);
  return Number.isFinite(ms)&&ms<=nowMs+Math.max(0,skewMs);
}

/** User-calendar date; use UTC ISO timestamps for events and this for due-date semantics. */
export function localDateKey(date=new Date()){
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}

export function addLocalCalendarDays(dateKey:string,days:number){
  const [y,m,d]=dateKey.split("-").map(Number);
  if(!Number.isFinite(y)||!Number.isFinite(m)||!Number.isFinite(d))return localDateKey();
  const date=new Date(y,m-1,d,12,0,0,0);
  date.setDate(date.getDate()+Math.trunc(days));
  return localDateKey(date);
}
