import type { Tank } from "./types";
import type { AquaAIAnswer,AquaAIPage } from "./aquaAIBrain";
import type { AquaAIQueryPlan } from "./aquaAIQueryPlan";
import { latestMeasuredChemistryReading } from "./chemistryDataQuality";

export function latestTankAnswer(tank:Tank,plan:AquaAIQueryPlan):AquaAIAnswer|undefined{
 if(plan.primary==="chemistry"){
  const row=latestMeasuredChemistryReading(tank);
  if(!row)return {titleAr:"آخر قراءة كيميائية",titleEn:"Latest chemistry reading",summaryAr:"ما في قراءة كيميائية مسجلة لسا.",summaryEn:"No chemistry reading has been logged yet.",detailsAr:[],detailsEn:[],evidenceAr:["سجل الكيمياء فارغ"],evidenceEn:["Chemistry log is empty"],confidence:"high",action:{page:"chemistry",ar:"سجّل قراءة جديدة",en:"Log a new reading"}};
  const entries=Object.entries(row.values).filter(([,v])=>typeof v==="number");
  return {titleAr:"آخر قراءة كيميائية",titleEn:"Latest chemistry reading",summaryAr:`آخر فحص مسجل بتاريخ ${new Date(row.timestamp).toLocaleString()}.`,summaryEn:`Latest test was logged on ${new Date(row.timestamp).toLocaleString()}.`,detailsAr:entries.map(([k,v])=>`${k}: ${v}`),detailsEn:entries.map(([k,v])=>`${k}: ${v}`),evidenceAr:["من آخر سجل كيمياء بالحوض"],evidenceEn:["From the latest tank chemistry log"],confidence:"high",action:{page:"chemistry",ar:"افتح سجل الكيمياء",en:"Open chemistry log"}};
 }
 if(plan.primary==="water"){
  const x=tank.waterChanges[0];
  if(!x)return {titleAr:"آخر تغيير ماء",titleEn:"Latest water change",summaryAr:"ما في تغيير ماء مسجل لسا.",summaryEn:"No water change has been logged yet.",detailsAr:[],detailsEn:[],evidenceAr:["سجل تغييرات الماء فارغ"],evidenceEn:["Water-change log is empty"],confidence:"high"};
  return {titleAr:"آخر تغيير ماء",titleEn:"Latest water change",summaryAr:`آخر تغيير ماء كان ${x.liters} لتر (${x.percent}%) بتاريخ ${new Date(x.timestamp).toLocaleString()}.`,summaryEn:`Latest water change was ${x.liters} L (${x.percent}%) on ${new Date(x.timestamp).toLocaleString()}.`,detailsAr:[x.salinity!==undefined?`الملوحة: ${x.salinity}`:"",x.temperature!==undefined?`الحرارة: ${x.temperature}`:"",x.notes||""].filter(Boolean),detailsEn:[x.salinity!==undefined?`Salinity: ${x.salinity}`:"",x.temperature!==undefined?`Temperature: ${x.temperature}`:"",x.notes||""].filter(Boolean),evidenceAr:["من سجل تغييرات الماء"],evidenceEn:["From water-change history"],confidence:"high",action:{page:"chemistry",ar:"افتح سجل الماء والكيمياء",en:"Open water/chemistry history"}};
 }
 if(plan.primary==="dosing"){
  const x=tank.dosing[0];
  if(!x)return {titleAr:"آخر جرعة",titleEn:"Latest dose",summaryAr:"ما في جرعة مسجلة لسا.",summaryEn:"No dose has been logged yet.",detailsAr:[],detailsEn:[],evidenceAr:["سجل الجرعات فارغ"],evidenceEn:["Dosing log is empty"],confidence:"high"};
  return {titleAr:"آخر جرعة",titleEn:"Latest dose",summaryAr:`آخر جرعة: ${x.parameter} — ${x.ml} ml بتاريخ ${new Date(x.timestamp).toLocaleString()}.`,summaryEn:`Latest dose: ${x.parameter} — ${x.ml} ml on ${new Date(x.timestamp).toLocaleString()}.`,detailsAr:[x.current!==undefined?`قبل الجرعة: ${x.current}`:"",x.target!==undefined?`الهدف: ${x.target}`:""].filter(Boolean),detailsEn:[x.current!==undefined?`Before dose: ${x.current}`:"",x.target!==undefined?`Target: ${x.target}`:""].filter(Boolean),evidenceAr:["من سجل الجرعات"],evidenceEn:["From dosing history"],confidence:"high",action:{page:"dosing",ar:"افتح الجرعات",en:"Open dosing"}};
 }
 if(plan.primary==="feeding"){
  const x=tank.feeding[0];
  if(!x)return {titleAr:"آخر تغذية",titleEn:"Latest feeding",summaryAr:"ما في تغذية مسجلة لسا.",summaryEn:"No feeding has been logged yet.",detailsAr:[],detailsEn:[],evidenceAr:["سجل التغذية فارغ"],evidenceEn:["Feeding log is empty"],confidence:"high"};
  return {titleAr:"آخر تغذية",titleEn:"Latest feeding",summaryAr:`آخر تغذية كانت ${x.food} بتاريخ ${new Date(x.timestamp).toLocaleString()}.`,summaryEn:`Latest feeding was ${x.food} on ${new Date(x.timestamp).toLocaleString()}.`,detailsAr:[x.amount?`الكمية: ${x.amount}`:"",x.notes||""].filter(Boolean),detailsEn:[x.amount?`Amount: ${x.amount}`:"",x.notes||""].filter(Boolean),evidenceAr:["من سجل التغذية"],evidenceEn:["From feeding history"],confidence:"high"};
 }
 if(plan.primary==="rodi"){
  const x=tank.rodi[0];
  if(!x)return {titleAr:"آخر قراءة RO/DI",titleEn:"Latest RO/DI reading",summaryAr:"ما في قراءة RO/DI مسجلة.",summaryEn:"No RO/DI reading is logged.",detailsAr:[],detailsEn:[],evidenceAr:["سجل RO/DI فارغ"],evidenceEn:["RO/DI log is empty"],confidence:"high"};
  return {titleAr:"آخر قراءة RO/DI",titleEn:"Latest RO/DI reading",summaryAr:`آخر قراءة بتاريخ ${new Date(x.timestamp).toLocaleString()}: TDS داخل ${x.tdsIn} وخارج ${x.tdsOut}.`,summaryEn:`Latest reading on ${new Date(x.timestamp).toLocaleString()}: TDS in ${x.tdsIn}, out ${x.tdsOut}.`,detailsAr:[`الإنتاج: ${x.liters} لتر`],detailsEn:[`Production: ${x.liters} L`],evidenceAr:["من سجل RO/DI"],evidenceEn:["From RO/DI history"],confidence:"high",action:{page:"rodi",ar:"افتح RO/DI",en:"Open RO/DI"}};
 }
 if(plan.primary==="maintenance"){
  const x=tank.maintenance.filter(t=>t.lastDone).sort((a,b)=>String(b.lastDone).localeCompare(String(a.lastDone)))[0];
  if(!x)return {titleAr:"آخر صيانة",titleEn:"Latest maintenance",summaryAr:"ما في تنفيذ صيانة سابق مسجل.",summaryEn:"No completed maintenance is logged.",detailsAr:[],detailsEn:[],evidenceAr:["لا يوجد lastDone"],evidenceEn:["No lastDone is recorded"],confidence:"high"};
  return {titleAr:"آخر صيانة",titleEn:"Latest maintenance",summaryAr:`آخر مهمة صيانة منفذة كانت «${x.title}» بتاريخ ${new Date(x.lastDone!).toLocaleDateString()}.`,summaryEn:`Latest completed maintenance was “${x.titleEn||x.title}” on ${new Date(x.lastDone!).toLocaleDateString()}.`,detailsAr:[x.nextDue?`الموعد القادم: ${new Date(x.nextDue).toLocaleDateString()}`:""],detailsEn:[x.nextDue?`Next due: ${new Date(x.nextDue).toLocaleDateString()}`:""],evidenceAr:["من سجل الصيانة"],evidenceEn:["From maintenance history"],confidence:"high",action:{page:"maintenance",ar:"افتح الصيانة",en:"Open maintenance"}};
 }
 if(plan.primary==="livestock"){
  const x=tank.livestock.filter(i=>i.addedAt).sort((a,b)=>String(b.addedAt).localeCompare(String(a.addedAt)))[0];
  if(!x)return undefined;
  return {titleAr:"آخر كائن مضاف",titleEn:"Latest livestock addition",summaryAr:`آخر إضافة كانت ${x.name} ×${x.quantity} بتاريخ ${new Date(x.addedAt!).toLocaleDateString()}.`,summaryEn:`Latest addition was ${x.nameEn||x.name} ×${x.quantity} on ${new Date(x.addedAt!).toLocaleDateString()}.`,detailsAr:[`الحالة: ${x.health}`],detailsEn:[`Status: ${x.health}`],evidenceAr:["من سجل الكائنات"],evidenceEn:["From livestock log"],confidence:"high",action:{page:"livestock",ar:"افتح الكائنات",en:"Open livestock"}};
 }
 if(plan.primary==="equipment"){
  const x=tank.equipment.filter(i=>i.lastServiceAt).sort((a,b)=>String(b.lastServiceAt).localeCompare(String(a.lastServiceAt)))[0];
  if(!x)return undefined;
  return {titleAr:"آخر صيانة جهاز",titleEn:"Latest equipment service",summaryAr:`آخر جهاز تمت صيانته هو ${x.name} بتاريخ ${new Date(x.lastServiceAt!).toLocaleDateString()}.`,summaryEn:`Latest serviced equipment was ${x.name} on ${new Date(x.lastServiceAt!).toLocaleDateString()}.`,detailsAr:[`الحالة الحالية: ${x.status}`],detailsEn:[`Current status: ${x.status}`],evidenceAr:["من سجل المعدات"],evidenceEn:["From equipment log"],confidence:"high",action:{page:"equipment",ar:"افتح المعدات",en:"Open equipment"}};
 }
 const x=tank.timeline[0];
 if(!x)return undefined;
 return {titleAr:"آخر حدث بالحوض",titleEn:"Latest tank event",summaryAr:`${x.textAr} — ${new Date(x.timestamp).toLocaleString()}.`,summaryEn:`${x.textEn} — ${new Date(x.timestamp).toLocaleString()}.`,detailsAr:[],detailsEn:[],evidenceAr:["من الخط الزمني"],evidenceEn:["From timeline"],confidence:"high",action:{page:"timeline" as AquaAIPage,ar:"افتح الخط الزمني",en:"Open timeline"}};
}
