import type { IntelligenceEvent,Tank,TimelineEvent } from "./types";
import type { TankHistoryArchive } from "@/lib/historyArchiveStorage";

export interface UnifiedHistoryRow{
  id:string;timestamp:string;type:string;textAr:string;textEn:string;source:"timeline"|"intelligence";
}
export interface HistoryPage{
  rows:UnifiedHistoryRow[];
  nextCursor:string|null;
  total:number;
}

function normalizeTimeline(rows:TimelineEvent[]):UnifiedHistoryRow[]{
  return rows.map(x=>({id:`timeline:${x.id}`,timestamp:x.timestamp,type:x.type,textAr:x.textAr,textEn:x.textEn,source:"timeline"}));
}
function normalizeIntelligence(rows:IntelligenceEvent[]):UnifiedHistoryRow[]{
  return rows.map(x=>({id:`intel:${x.id}`,timestamp:x.timestamp,type:`core:${x.domain}:${x.verb}`,textAr:x.textAr,textEn:x.textEn,source:"intelligence"}));
}
function cursorOf(row:UnifiedHistoryRow){return `${new Date(row.timestamp).getTime()}|${row.id}`;}
function beforeCursor(row:UnifiedHistoryRow,cursor?:string|null){
  if(!cursor)return true;
  const [rawTs,...idParts]=cursor.split("|"),cursorTs=Number(rawTs),cursorId=idParts.join("|"),ts=new Date(row.timestamp).getTime();
  if(!Number.isFinite(cursorTs))return true;
  return ts<cursorTs||(ts===cursorTs&&row.id>cursorId);
}

export function unifiedTankHistory(tank:Tank,archive?:TankHistoryArchive|null){
  const rows=[
    ...normalizeTimeline(tank.timeline),
    ...normalizeIntelligence(tank.intelligenceEvents??[]),
    ...normalizeTimeline(archive?.timeline??[]),
    ...normalizeIntelligence(archive?.intelligenceEvents??[])
  ];
  const seen=new Set<string>();
  return rows
    .filter(x=>{const key=`${x.timestamp}\u0000${x.textAr}\u0000${x.textEn}`;if(seen.has(key))return false;seen.add(key);return true;})
    .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()||a.id.localeCompare(b.id));
}

export function historyPage(tank:Tank,opts:{archive?:TankHistoryArchive|null;cursor?:string|null;limit?:number;type?:string;search?:string}={}):HistoryPage{
  const limit=Math.max(1,Math.min(500,Math.round(opts.limit??200)));
  const search=(opts.search??"").trim().toLowerCase();
  const rows=unifiedTankHistory(tank,opts.archive)
    .filter(x=>beforeCursor(x,opts.cursor))
    .filter(x=>!opts.type||opts.type==="all"||x.type===opts.type)
    .filter(x=>!search||`${x.textAr} ${x.textEn} ${x.type}`.toLowerCase().includes(search));
  const page=rows.slice(0,limit),last=page[page.length-1];
  return{rows:page,nextCursor:rows.length>limit&&last?cursorOf(last):null,total:rows.length};
}

export function historyArchiveStats(tank:Tank,archive?:TankHistoryArchive|null){
  const all=unifiedTankHistory(tank,archive);
  return{
    total:all.length,
    archived:(archive?.timeline.length??0)+(archive?.intelligenceEvents.length??0),
    oldestAt:all.at(-1)?.timestamp??null,
    newestAt:all[0]?.timestamp??null
  };
}
