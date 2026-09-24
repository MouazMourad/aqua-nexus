import type { ChemistryReading,Tank } from "./types";
import { chemistryCatalogForTank,resolvedAquariumProfile } from "./chemistryProfile";
import { isPlausibleOperationalTimestamp } from "./timeSafety";

const DAY=86400000;
export interface ParameterSample{key:string;value:number;timestamp:string;ageDays:number;confidence:"high"|"medium"|"low";source:"manual"|"import"|"device";testKit?:string;}
export interface ChemistryValidationIssue{key:string;value:number;ar:string;en:string;}

const PLAUSIBILITY:Record<string,[number,number]>={temperature:[-2,50],pH:[3,12],salinity:[0.99,1.05],KH:[0,30],Ca:[0,1000],Mg:[0,3000],NO3:[0,1000],PO4:[0,50],NH3:[0,50],NO2:[0,50],GH:[0,50],TDS:[0,10000]};

export function validateChemistryValue(tank:Tank,key:string,value:number):ChemistryValidationIssue|undefined{
 if(!Number.isFinite(value))return {key,value,ar:`${key}: القيمة ليست رقماً صالحاً.`,en:`${key}: value is not a valid number.`};
 if(key==="salinity"&&value>2)return {key,value,ar:`Salinity ${value}: تبدو بصيغة SG خاطئة (مثلاً 1025 بدل 1.025). صححها قبل الحفظ.`,en:`Salinity ${value}: this looks like incorrectly formatted SG (for example 1025 instead of 1.025). Correct it before saving.`};
 const range=PLAUSIBILITY[key];
 if(range&&(value<range[0]||value>range[1]))return {key,value,ar:`${key}: القيمة ${value} خارج المجال المنطقي للإدخال (${range[0]}–${range[1]}).`,en:`${key}: ${value} is outside the plausible input range (${range[0]}–${range[1]}).`};
 const cfg:any=chemistryCatalogForTank(tank);
 if(!cfg[key])return {key,value,ar:`${key}: البارامتر غير معروف لهذا النوع من الأحواض.`,en:`${key}: parameter is not defined for this aquarium type.`};
 return undefined;
}

export function validateChemistryValues(tank:Tank,values:Record<string,number|null|undefined>){
 const issues:ChemistryValidationIssue[]=[];
 for(const [key,value] of Object.entries(values)){if(typeof value!=="number")continue;const issue=validateChemistryValue(tank,key,value);if(issue)issues.push(issue);}
 return issues;
}

export function findNearDuplicateChemistryReading(tank:Tank,values:Record<string,number|null>,withinMinutes=10){
 const keys=Object.keys(values).filter(k=>typeof values[k]==="number").sort();
 if(!keys.length)return undefined;
 const cutoff=Date.now()-Math.max(1,withinMinutes)*60000;
 return tank.chemistry.find(reading=>{
  if(reading.usingDefaults||!isPlausibleOperationalTimestamp(reading.timestamp))return false;
  const time=new Date(reading.timestamp).getTime();
  if(!Number.isFinite(time)||time<cutoff)return false;
  const priorKeys=Object.keys(reading.values??{}).filter(k=>typeof reading.values[k]==="number").sort();
  if(priorKeys.length!==keys.length||priorKeys.some((k,i)=>k!==keys[i]))return false;
  return keys.every(k=>{
   const a=Number(values[k]),b=Number(reading.values[k]);
   return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9;
  });
 });
}

export function isExactChemistryDuplicate(existing:ChemistryReading[],candidate:ChemistryReading){
 const at=new Date(candidate.timestamp).getTime();
 if(!Number.isFinite(at))return false;
 const keys=Object.keys(candidate.values??{}).filter(k=>typeof candidate.values[k]==="number").sort();
 return existing.some(reading=>{
  const bt=new Date(reading.timestamp).getTime();
  if(!Number.isFinite(bt)||Math.abs(at-bt)>60000)return false;
  const priorKeys=Object.keys(reading.values??{}).filter(k=>typeof reading.values[k]==="number").sort();
  return priorKeys.length===keys.length&&priorKeys.every((k,i)=>k===keys[i])&&keys.every(k=>Number(reading.values[k])===Number(candidate.values[k]));
 });
}

export function measuredChemistryReadings(tank:Tank){
 return tank.chemistry
  .filter(r=>!r.usingDefaults&&isPlausibleOperationalTimestamp(r.timestamp))
  .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
}
export function latestMeasuredChemistryReading(tank:Tank){return measuredChemistryReadings(tank)[0];}
export function previousMeasuredChemistryReading(tank:Tank){return measuredChemistryReadings(tank)[1];}

export function latestParameterSample(tank:Tank,key:string):ParameterSample|undefined{
 let best:ChemistryReading|undefined;
 // Reference/default values are never measurement evidence. This single gate
 // protects health, dosing, freshness, AI context and any caller using the
 // canonical latest-parameter helper.
 for(const r of measuredChemistryReadings(tank)){
  const v=r.values?.[key];
  if(typeof v!=="number"||!Number.isFinite(v))continue;
  if(!best||new Date(r.timestamp).getTime()>new Date(best.timestamp).getTime())best=r;
 }
 if(!best)return undefined;
 return {key,value:best.values[key] as number,timestamp:best.timestamp,ageDays:Math.max(0,(Date.now()-new Date(best.timestamp).getTime())/DAY),confidence:best.confidence??"medium",source:best.source??"manual",testKit:best.testKit};
}

export function latestParameterSamples(tank:Tank){const cfg:any=chemistryCatalogForTank(tank);return Object.fromEntries(Object.keys(cfg).map(key=>[key,latestParameterSample(tank,key)])) as Record<string,ParameterSample|undefined>;}
export function currentChemistryValues(tank:Tank){const samples=latestParameterSamples(tank),values:Record<string,number|null>={};for(const [key,s] of Object.entries(samples))if(s)values[key]=s.value;return values;}

export function parameterFreshnessDays(tank:Tank,key:string){
 if(key==="temperature")return 1;if(key==="pH")return 2;if(key==="salinity")return 3;
 if(key==="NH3"||key==="NO2")return tank.status==="established"?3:1;
 if(key==="KH")return tank.type==="marine"?3:7;if(key==="Ca"||key==="Mg")return 7;if(key==="NO3"||key==="PO4")return 7;if(key==="GH"||key==="TDS")return 14;return 7;
}

export function requiredWeeklyChemistryKeys(tank:Tank){
 const profile=resolvedAquariumProfile(tank);let keys:string[];
 if(profile==="marine-reef")keys=["salinity","pH","KH","Ca","Mg","NO3","PO4"];
 else if(profile==="marine-fish")keys=["salinity","pH","KH","NO3"];
 else if(profile==="freshwater-planted")keys=["temperature","pH","GH","KH","NO3","TDS"];
 else keys=["temperature","pH","GH","KH","NO3"];
 if(tank.status!=="established"){const cfg:any=chemistryCatalogForTank(tank);if(cfg.NH3&&!keys.includes("NH3"))keys.push("NH3");if(cfg.NO2&&!keys.includes("NO2"))keys.push("NO2");}
 return keys;
}

export function weeklyChemistryCoverage(tank:Tank,extra:ChemistryReading[]=[]){
 const required=requiredWeeklyChemistryKeys(tank),cutoff=Date.now()-7*DAY,readings=[...extra,...tank.chemistry],measured=new Set<string>();
 for(const r of readings){if(r.usingDefaults||!isPlausibleOperationalTimestamp(r.timestamp)||new Date(r.timestamp).getTime()<cutoff)continue;for(const key of required){const v=r.values?.[key];if(typeof v==="number"&&Number.isFinite(v))measured.add(key);}}
 const missing=required.filter(k=>!measured.has(k));return {required,measured:[...measured],missing,complete:missing.length===0};
}

function confidenceFactor(v:ParameterSample["confidence"]){return v==="high"?1:v==="medium"?.75:.25;}
export function chemistryDataConfidence(tank:Tank){
 const cfg:any=chemistryCatalogForTank(tank);let totalWeight=0,coverageWeight=0,confidenceWeight=0,freshWeight=0;const staleKeys:string[]=[],missingKeys:string[]=[],lowConfidenceKeys:string[]=[];
 for(const [key,meta] of Object.entries(cfg) as [string,any][]){const weight=Number(meta.weight||1);totalWeight+=weight;const sample=latestParameterSample(tank,key);if(!sample){missingKeys.push(key);continue;}coverageWeight+=weight;const maxAge=parameterFreshnessDays(tank,key),freshness=sample.ageDays<=maxAge?1:sample.ageDays<=maxAge*2?.5:.1;if(sample.ageDays>maxAge)staleKeys.push(key);if(sample.confidence==="low")lowConfidenceKeys.push(key);freshWeight+=weight*freshness;confidenceWeight+=weight*freshness*confidenceFactor(sample.confidence);}
 if(!totalWeight)return {score:0,coverage:0,freshness:0,staleKeys,missingKeys,lowConfidenceKeys};
 return {score:Math.round(confidenceWeight/totalWeight*100),coverage:Math.round(coverageWeight/totalWeight*100),freshness:Math.round(freshWeight/Math.max(.0001,coverageWeight)*100),staleKeys,missingKeys,lowConfidenceKeys};
}

export function validateDosingTarget(tank:Tank,key:string,target:number){
 const cfg:any=chemistryCatalogForTank(tank),meta=cfg[key];
 if(!meta||!Number.isFinite(target))return {blocked:true,level:"danger" as const,ar:"الهدف غير صالح.",en:"Target is invalid."};
 const [idealMin,idealMax]=meta.ideal,[safeMin,safeMax]=meta.safe;
 if(target<safeMin||target>safeMax)return {blocked:true,level:"danger" as const,ar:`الهدف ${target} خارج المجال الآمن ${safeMin}–${safeMax}. لن يسمح Aqua Nexus بإنشاء جرعة لهذا الهدف.`,en:`Target ${target} is outside the safe range ${safeMin}–${safeMax}. Aqua Nexus will not create a corrective dose for this target.`};
 if(target<idealMin||target>idealMax)return {blocked:false,level:"warn" as const,ar:`الهدف ${target} ضمن المجال الآمن لكنه خارج المجال المثالي ${idealMin}–${idealMax}. راجع سبب اختيار الهدف قبل التنفيذ.`,en:`Target ${target} is within the safe range but outside the ideal range ${idealMin}–${idealMax}. Review why this target was chosen before dosing.`};
 return {blocked:false,level:"good" as const,ar:`الهدف ضمن المجال المثالي ${idealMin}–${idealMax}.`,en:`Target is within the ideal range ${idealMin}–${idealMax}.`};
}
