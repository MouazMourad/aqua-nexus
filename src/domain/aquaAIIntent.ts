export type AquaQuestionMode="status"|"why"|"action"|"how"|"when"|"list"|"count"|"trend"|"forecast"|"compare"|"canAdd"|"waterChange"|"dose"|"general";
export type AquaQuestionTopic="chemistry"|"livestock"|"equipment"|"maintenance"|"dosing"|"acclimation"|"emergency"|"rodi"|"feeding"|"water"|"general";
export type AquaQuestionParam="KH"|"Ca"|"Mg"|"NO3"|"PO4"|"pH"|"salinity"|"temperature"|"NH3"|"NO2"|"GH"|"TDS";

export interface AquaQuestionIntent{
 raw:string;
 normalized:string;
 mode:AquaQuestionMode;
 topics:AquaQuestionTopic[];
 params:AquaQuestionParam[];
 asksForReason:boolean;
 asksForAction:boolean;
 asksForRisk:boolean;
 asksAboutBioload:boolean;
 confidence:"low"|"medium"|"high";
}

function normalizeArabic(input:string){
 return (input||"")
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\u064B-\u065F\u0670]/g,"")
  .replace(/[أإآ]/g,"ا")
  .replace(/ى/g,"ي")
  .replace(/ة/g,"ه")
  .replace(/ؤ/g,"و")
  .replace(/ئ/g,"ي")
  .replace(/[^a-z0-9\u0600-\u06ff.%/+-]+/g," ")
  .replace(/\s+/g," ")
  .trim();
}

const PARAM_PATTERNS:Array<[AquaQuestionParam,RegExp[]]> = [
 ["KH",[/\bkh\b/i,/alkal/i,/قلو/i,/كربونات/i,/الكربونات/i]],
 ["Ca",[/\bca\b/i,/calcium/i,/كالسيوم/i]],
 ["Mg",[/\bmg\b/i,/magnesium/i,/مغنيسيوم/i,/مغنزيوم/i]],
 ["NO3",[/\bno3\b/i,/nitrate/i,/نترات/i,/نيترات/i]],
 ["PO4",[/\bpo4\b/i,/phosphate/i,/فوسفات/i]],
 ["pH",[/\bph\b/i,/حموض/i,/الحموضه/i,/الاس الهيدروجيني/i]],
 ["salinity",[/salin/i,/ملوح/i,/كثافه/i,/sg\b/i]],
 ["temperature",[/temp/i,/حرار/i,/سخونه/i,/برد/i]],
 ["NH3",[/\bnh3\b/i,/ammonia/i,/امونيا/i,/نشادر/i]],
 ["NO2",[/\bno2\b/i,/nitrite/i,/نتريت/i,/نيتريت/i]],
 ["GH",[/\bgh\b/i,/general hardness/i,/العسره العامه/i]],
 ["TDS",[/\btds\b/i,/total dissolved/i,/المواد الذائبه/i]]
];

function hasAny(s:string,patterns:(string|RegExp)[]){
 return patterns.some(p=>typeof p==="string"?s.includes(p):p.test(s));
}

export function parseAquaQuestion(raw:string):AquaQuestionIntent{
 const s=normalizeArabic(raw);
 const params=PARAM_PATTERNS.filter(([,patterns])=>patterns.some(p=>p.test(s))).map(([param])=>param);
 const topics:AquaQuestionTopic[]=[];
 const add=(t:AquaQuestionTopic)=>{if(!topics.includes(t))topics.push(t);};
 if(params.length||hasAny(s,["كيميا","كيمياء","قراءه","قراءه","chemistry","parameter"]))add("chemistry");
 if(hasAny(s,[/(?:^|\\s)(?:ال)?سمك(?:$|\\s)/,/(?:^|\\s)(?:ال)?اسماك(?:$|\\s)/,"مرجان","كائن","حلزون","قشريات","روبيان","جمبري","livestock","fish","coral","snail","shrimp","bioload","حمل حيوي"]))add("livestock");
 if(hasAny(s,["جهاز","معدات","مضخه","مضخة","سكيمر","سخان","اضاءه","اضاءة","فلتر","equipment","pump","skimmer","heater","light"]))add("equipment");
 if(hasAny(s,["صيانه","صيانة","تنظيف","موعد","مهمه","مهمة","maintenance","clean","service"]))add("maintenance");
 if(hasAny(s,["جرعه","جرعة","دوز","dosing","dose","all for reef","بيكربونات","مكمل"]))add("dosing");
 if(hasAny(s,["اقلمه","أقلمة","تاقلم","تأقلم","acclimation","شحنه","شحنة","تنقيط"]))add("acclimation");
 if(hasAny(s,["طوار","خطر","حرج","تسريب","انقطاع","emergency","leak","power outage"]))add("emergency");
 if(hasAny(s,["rodi","ro/di","ماء المصدر","مياه المصدر","فلتر المي","tds"]))add("rodi");
 if(hasAny(s,["اكل","أكل","تغذيه","تغذية","feeding","feed"]))add("feeding");
 if(hasAny(s,["تغيير مي","تغيير ماء","بدل مي","water change","change water"]))add("water");
 if(!topics.length)add("general");

 const asksForReason=hasAny(s,["ليش","لماذا","سبب","شو السبب","why","cause","reason"]);
 const asksForAction=hasAny(s,["شو اعمل","شو ساوي","ماذا افعل","الحل","حل","نصيحه","نصيحة","اقترح","اقتراح","what should i do","what do i do","solution","recommend","advice"]);
 const asksForRisk=hasAny(s,["خطر","خطير","حرج","safe","danger","risk","مناسب","امن","آمن"]);
 const asksAboutBioload=hasAny(s,["bioload","bio load","حمل حيوي","الحمل الحيوي","الحمل البيولوجي","البيولوجي عندي","قدره الحوض","قدرة الحوض"]);
 let mode:AquaQuestionMode="general";
 if(hasAny(s,["بقدر ضيف","فيني ضيف","اقدر اضيف","هل اضيف","can i add","safe to add","اضافه سمك","إضافة سمك","اضافه كائن","إضافة كائن"]))mode="canAdd";
 else if(hasAny(s,["تغيير مي","تغيير ماء","water change","change water"]))mode="waterChange";
 else if(hasAny(s,["جرعه","جرعة","dose","dosing"])&&asksForAction)mode="dose";
 else if(hasAny(s,["كيف اعمل","كيف اعملها","كيف ساوي","كيف اساوي","طريقة","طريقه","خطوات","how do i","how to","steps"]))mode="how";
 else if(hasAny(s,["ايمتى","امتى","متى","موعد","الجاية","الجايه","القادمة","القادمه","next due","when is","when should","when do"]))mode="when";
 else if(hasAny(s,["شو المهام","ما المهام","شو عندي","اعرض","عرض","list","show me","what tasks"]))mode="list";
 else if(hasAny(s,["كم عدد","قديش عدد","عدد","how many","count"]))mode="count";
 else if(hasAny(s,["توقع","forecast","predict","مستقبل","رايح","امتى يوصل","متى يصل"]))mode="forecast";
 else if(hasAny(s,["مقارنه","مقارنة","قبل","بعد","compare","versus","vs"]))mode="compare";
 else if(hasAny(s,["اتجاه","عم يرتفع","عم ينزل","عم يطلع","عم يهبط","trend","rising","falling"]))mode="trend";
 else if(asksForReason)mode="why";
 else if(asksForAction)mode="action";
 else if(hasAny(s,["الوضع","الحاله","الحالة","كيف الحوض","شو وضع","status","state","health"]))mode="status";

 let confidence:"low"|"medium"|"high"="low";
 const signals=params.length+topics.filter(x=>x!=="general").length+(mode!=="general"?1:0);
 if(signals>=3)confidence="high";else if(signals>=1)confidence="medium";
 return {raw,normalized:s,mode,topics,params,asksForReason,asksForAction,asksForRisk,asksAboutBioload,confidence};
}

export function resolveAquaFollowup(current:string,previous?:string){
 const clean=(current||"").trim();
 if(!clean||!previous?.trim())return clean;
 const n=normalizeArabic(clean);
 const short=n.split(" ").filter(Boolean).length<=5;
 const referential=hasAny(n,[
  "ليش","طيب ليش","شو الحل","شو ساوي","شو اعمل","وبعدين","بعدها","هلق شو","هاد","هالشي","هالقيمه","هالقيمة","هي","هو","طيب","then","why","what next","what do i do","this","that","it"
 ]);
 const parsed=parseAquaQuestion(clean);
 const standalone=parsed.params.length>0||parsed.topics.some(x=>x!=="general")||["canAdd","waterChange","forecast","compare","trend","dose","how","when","list","count"].includes(parsed.mode);
 if((short&&referential)||(!standalone&&referential))return previous+" | follow-up: "+clean;
 return clean;
}
