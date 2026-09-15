"use client";
import type { Tank } from "@/domain/types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { parameterScore } from "@/domain/health";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
function alerts(tank:Tank,lang:"ar"|"en") {
 const a:{level:string;text:string}[]=[],latest=tank.chemistry[0]?.values??{},cfg:any=CHEMISTRY_CATALOG[tank.type];
 Object.entries(cfg).forEach(([k,m]:[string,any])=>{const s=parameterScore(latest[k],m);if(s!==null&&s<65)a.push({level:s<40?"danger":"warn",text:bi(lang,`قراءة ${k} خارج المجال المريح: ${latest[k]}`,`${k} is outside the comfortable range: ${latest[k]}`)})});
 tank.inventory.filter(x=>x.quantity<=x.minimum).forEach(x=>a.push({level:"warn",text:bi(lang,`المخزون منخفض: ${x.name}`,`Low stock: ${x.nameEn||x.name}`)}));
 const today=new Date().toISOString().slice(0,10);tank.maintenance.filter(x=>!x.done&&x.nextDue&&x.nextDue<today).forEach(x=>a.push({level:"warn",text:bi(lang,`مهمة صيانة متأخرة: ${x.title}`,`Overdue maintenance: ${x.titleEn||x.title}`)}));
 return a;
}
export function AlertsPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),a=alerts(tank,lang);
 return <section className="page-grid"><PageHeader eyebrow="ALERT ENGINE" title={`${tr(lang,"alerts")} (${a.length})`}/><div className="card panel full-span">{a.length?a.map((x,i)=><div className={`inline-alert ${x.level}`} key={i}>{x.text}</div>):<div className="inline-alert good">{bi(lang,"لا توجد تنبيهات حالياً.","No alerts right now.")}</div>}</div></section>;
}
