import type { Tank } from "./types";

export function rodiIntelligence(tank:Tank){
  const latest=tank.rodi[0];
  if(!latest)return {status:"unknown" as const,rejection:null as number|null,efficiency:null as number|null,trend:"unknown" as const,notes:["لا توجد دفعة RO/DI مسجلة بعد."]};
  const rejection=latest.tdsIn>0?Math.max(0,Math.min(100,(1-latest.tdsOut/latest.tdsIn)*100)):null;
  const efficiency=latest.wasteLiters!==undefined&&(latest.liters+latest.wasteLiters)>0?latest.liters/(latest.liters+latest.wasteLiters)*100:null;
  const prev=tank.rodi[1];
  const trend=prev?latest.tdsOut>prev.tdsOut?"worse":latest.tdsOut<prev.tdsOut?"better":"stable":"unknown";
  const status=latest.tdsOut<=1?"good":latest.tdsOut<=5?"watch":"danger";
  const notes:string[]=[];
  if(latest.tdsOut>1)notes.push("TDS الخارج لم يعد صفراً/قريباً من الصفر؛ راجع DI resin والممبرين وترتيب الفلاتر.");
  if(rejection!==null&&rejection<95)notes.push("نسبة رفض الممبرين أقل من 95% تقريباً؛ افحص ضغط المصدر والممبرين وTDS قبل/بعد RO.");
  if(efficiency!==null&&efficiency<20)notes.push("كفاءة الماء المنتج منخفضة مقارنة بماء الرفض؛ راجع الضغط والـrestrictor وحرارة الماء.");
  if(!notes.length)notes.push("جودة الماء الحالية جيدة حسب آخر تسجيل.");
  return {status,rejection,efficiency,trend,notes};
}
