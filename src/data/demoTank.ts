import type { Tank } from "@/domain/types";

const now = new Date().toISOString();
const daysAgoISO=(days:number)=>new Date(Date.now()-days*86400000).toISOString();
const daysAgoDate=(days:number)=>daysAgoISO(days).slice(0,10);
const daysFromNowDate=(days:number)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);

export const demoMarineTank: Tank = {
  id: "training-marine",
  name: "Marine Training Tank",
  isTraining: true,
  trainingStartedAt: now,
  type: "marine",
  status: "established",
  ageMonths: 30,
  display: { length: 120, width: 60, height: 70, displacementPercent: 20, grossLiters: 504, netLiters: 403.2 },
  sump: {
    enabled: true,
    dimensions: { length: 120, width: 50, height: 35 },
    operatingFillPercent: 83.3,
    chambers: [
      { id: "c1", name: "مدخل وفلترة ميكانيكية", nameEn: "Inlet / Mechanical", x: 0, y: 0, length: 30, width: 50, height: 35, waterHeight: 29.2, media: [], items:["filterSock"] },
      { id: "c2", name: "السكيمر", nameEn: "Skimmer", x: 30, y: 0, length: 25, width: 50, height: 35, waterHeight: 29.2, media: [], items:["skimmer"] },
      { id: "c3", name: "الريفوجيوم", nameEn: "Refugium", x: 55, y: 0, length: 30, width: 50, height: 35, waterHeight: 29.2, media: ["refugium","biological"], items:["refugium"] },
      { id: "c4", name: "التيرف", nameEn: "Turf Scrubber", x: 85, y: 0, length: 20, width: 50, height: 35, waterHeight: 29.2, media: ["turf"], items:["turf"] },
      { id: "c5", name: "مضخة الرجوع", nameEn: "Return Pump", x: 105, y: 0, length: 15, width: 50, height: 35, waterHeight: 29.2, media: [], items:["returnPump"] }
    ]
  },
  systemVolumeLiters: 578.2,
  equipment: [
    { id:"e1", name:"Maxspect L165", kind:"lighting", legacyKind:"Lighting", brand:"Maxspect", model:"L165", location:"display", status:"on", installedAt:"2026-01-01", lastServiceAt:"2026-08-01", serviceIntervalDays:180 },
    { id:"e2", name:"Jebao Wave Maker Left", kind:"waveMaker", legacyKind:"Wave Maker", brand:"Jebao", location:"display", status:"on", lastServiceAt:"2026-08-15", serviceIntervalDays:60 },
    { id:"e3", name:"Jebao Wave Maker Right", kind:"waveMaker", legacyKind:"Wave Maker", brand:"Jebao", location:"display", status:"on", lastServiceAt:"2026-08-15", serviceIntervalDays:60 },
    { id:"e4", name:"Protein Skimmer", kind:"skimmer", legacyKind:"Skimmer", location:"sump:c2", status:"on", lastServiceAt:"2026-09-01", serviceIntervalDays:30 },
    { id:"e5", name:"Refugium Light", kind:"refugiumLight", legacyKind:"Refugium Light", location:"sump:c3", status:"on" },
    { id:"e6", name:"Turf Scrubber", kind:"turfScrubber", legacyKind:"Turf Scrubber", location:"sump:c4", status:"on" },
    { id:"e7", name:"Return Pump", kind:"returnPump", legacyKind:"Return Pump", location:"sump:c5", status:"on", lastServiceAt:"2026-08-01", serviceIntervalDays:90 },
    { id:"e8", name:"Heater 300W", kind:"heater", legacyKind:"Heater", location:"sump:c5", status:"on" },
    { id:"e9", name:"Aqua Medic Ozone 30", kind:"ozone", legacyKind:"Ozone", brand:"Aqua Medic", model:"Ozone 30", location:"external", status:"on" }
  ],
  chemistry: [
   {timestamp:now,values:{temperature:25,pH:8.1,salinity:1.025,KH:8,Ca:430,Mg:1300,NO3:10,PO4:0.08,NH3:0}},
   {timestamp:daysAgoISO(3),values:{temperature:25.2,pH:8.15,salinity:1.025,KH:7.6,Ca:435,Mg:1270,NO3:16,PO4:0.12,NH3:0}},
   {timestamp:daysAgoISO(7),values:{temperature:25.4,pH:8.0,salinity:1.024,KH:6.4,Ca:455,Mg:1140,NO3:34,PO4:0.30,NH3:0}},
   {timestamp:daysAgoISO(11),values:{temperature:25.1,pH:8.0,salinity:1.023,KH:6.9,Ca:470,Mg:1190,NO3:28,PO4:0.22,NH3:0}}
  ],
  maintenance: [
    { id:"m1", title:"فحص السكيمر", titleEn:"Inspect skimmer", cadence:"weekly", done:true, lastDone:daysAgoDate(2), nextDue:daysFromNowDate(5) },
    { id:"m2", title:"تنظيف الجرابات", titleEn:"Clean filter socks", cadence:"weekly", done:true, lastDone:daysAgoDate(3), nextDue:daysFromNowDate(4) },
    { id:"m3", title:"فحص مضخة الرجوع", titleEn:"Inspect return pump", cadence:"monthly", done:true, lastDone:daysAgoDate(10), nextDue:daysFromNowDate(20) },
    { id:"m4", title:"حصاد التيرف", titleEn:"Harvest turf scrubber", cadence:"weekly", done:true, lastDone:daysAgoDate(4), nextDue:daysFromNowDate(3) },
    { id:"m5", title:"قياس النسب الكيميائية الأسبوعي", titleEn:"Weekly chemistry measurement", cadence:"weekly", done:true, lastDone:daysAgoDate(3), nextDue:daysFromNowDate(4) }
  ],
  livestock: [
    { id:"l1", libraryId:"clown", name:"سمكة المهرج", nameEn:"Clownfish", category:"fish", quantity:2, health:"good", load:1.2, addedAt:"2026-01-01" },
    { id:"l2", libraryId:"chromis", name:"كروميس أخضر", nameEn:"Green Chromis", category:"fish", quantity:2, health:"good", load:1, addedAt:"2026-02-01" },
    { id:"l3", libraryId:"torch", name:"مرجان تورش", nameEn:"Torch Coral", category:"coral", quantity:1, health:"good", load:.3, addedAt:"2026-03-01" }
  ],
  inventory: [
    { id:"i1", name:"ملح بحري", nameEn:"Marine Salt", category:"مياه", categoryEn:"Water", quantity:5, unit:"kg", minimum:2 },
    { id:"i2", name:"كربون نشط", nameEn:"Activated Carbon", category:"فلترة", categoryEn:"Filtration", quantity:500, unit:"g", minimum:200 }
  ],
  timeline: [
    {id:"t4",timestamp:now,type:"recovery",textAr:"استقر الحوض وعادت المؤشرات إلى المجال المثالي بعد المتابعة.",textEn:"The tank stabilized and returned to the ideal range after follow-up."},
    {id:"t3",timestamp:daysAgoISO(3),type:"chemistry",textAr:"انخفضت المغذيات وتحسن KH بعد تصحيح تدريجي.",textEn:"Nutrients fell and KH improved after gradual correction."},
    {id:"t2",timestamp:daysAgoISO(7),type:"warning",textAr:"ظهرت قراءة KH منخفضة مع ارتفاع NO3 وPO4؛ تم بدء خطة متابعة.",textEn:"Low KH with elevated NO3 and PO4 triggered a follow-up plan."},
    {id:"t1",timestamp:daysAgoISO(11),type:"setup",textAr:"بداية مسيرة الحوض التدريبي البحري.",textEn:"Marine training tank journey started."}
  ],
  photos: [],
  feeding: [],
  dosing: [],
  doserChannels: [
    { id:"dc1", name:"Channel 1", material:"KH", capacityMl:1000, currentMl:700, consumption:12, period:"daily", color:"#27c2dc" },
    { id:"dc2", name:"Channel 2", material:"Ca", capacityMl:1000, currentMl:760, consumption:10, period:"daily", color:"#62d48f" },
    { id:"dc3", name:"Channel 3", material:"Mg", capacityMl:1000, currentMl:900, consumption:8, period:"weekly", color:"#f6c85f" }
  ],
  quarantine: [],
  expenses: [],
  waterChanges: [],
  rodi: [],
  createdAt: "2026-01-01T00:00:00.000Z"
};

export const demoFreshwaterTank: Tank = {
  ...demoMarineTank,
  id:"training-freshwater",
  name:"Freshwater Training Tank",
  isTraining:true,
  type:"freshwater",
  display:{ length:100,width:50,height:60,displacementPercent:15,grossLiters:300,netLiters:255 },
  systemVolumeLiters:330,
  sump:{...demoMarineTank.sump,enabled:false,chambers:[]},
  equipment: demoMarineTank.equipment.filter(e=>["lighting","heater","returnPump"].includes(e.kind)).map((e,i)=>({...e,id:`fw-e${i}`,location:"external"})),
  chemistry:[
   {timestamp:now,values:{temperature:25,pH:7.2,GH:8,KH:5,NH3:0,NO2:0,NO3:12,TDS:200}},
   {timestamp:daysAgoISO(3),values:{temperature:25.1,pH:7.25,GH:8,KH:5,NH3:0,NO2:0,NO3:18,TDS:215}},
   {timestamp:daysAgoISO(6),values:{temperature:26.2,pH:7.8,GH:13,KH:9,NH3:0.03,NO2:0.08,NO3:36,TDS:410}},
   {timestamp:daysAgoISO(10),values:{temperature:25.5,pH:7.6,GH:11,KH:8,NH3:0.01,NO2:0.02,NO3:28,TDS:340}}
  ],
  maintenance:[
   {id:"fw-m1",title:"فحص الفلتر والدوران",titleEn:"Inspect filter and circulation",cadence:"weekly",done:true,lastDone:daysAgoDate(2),nextDue:daysFromNowDate(5)},
   {id:"fw-m2",title:"تنظيف واجهة الحوض",titleEn:"Clean display glass",cadence:"weekly",done:true,lastDone:daysAgoDate(3),nextDue:daysFromNowDate(4)},
   {id:"fw-m3",title:"فحص السخان",titleEn:"Inspect heater",cadence:"monthly",done:true,lastDone:daysAgoDate(8),nextDue:daysFromNowDate(22)},
   {id:"fw-m4",title:"قياس النسب الكيميائية الأسبوعي",titleEn:"Weekly chemistry measurement",cadence:"weekly",done:true,lastDone:daysAgoDate(3),nextDue:daysFromNowDate(4)}
  ],
  livestock:[
   {id:"fw-l1",libraryId:"neonTetra",name:"نيون تترا",nameEn:"Neon Tetra",category:"fish",quantity:8,health:"good",load:.35,addedAt:daysAgoDate(45)},
   {id:"fw-l2",libraryId:"cherryShrimp",name:"جمبري شيري",nameEn:"Cherry Shrimp",category:"invert",quantity:6,health:"good",load:.15,addedAt:daysAgoDate(30)}
  ],
  inventory:[],
  timeline:[
   {id:"fw-t4",timestamp:now,type:"recovery",textAr:"استقرت الدورة البيولوجية وعادت الأمونيا والنتريت إلى الصفر.",textEn:"The biological cycle stabilized and ammonia/nitrite returned to zero."},
   {id:"fw-t3",timestamp:daysAgoISO(3),type:"chemistry",textAr:"تحسنت القيم بعد تغيير ماء ومراجعة الفلترة.",textEn:"Parameters improved after a water change and filtration review."},
   {id:"fw-t2",timestamp:daysAgoISO(6),type:"warning",textAr:"ارتفاع أمونيا ونتريت كشف ضغطاً على الدورة البيولوجية.",textEn:"Ammonia and nitrite rise revealed stress on the biological cycle."},
   {id:"fw-t1",timestamp:daysAgoISO(10),type:"setup",textAr:"بداية مسيرة الحوض التدريبي النهري.",textEn:"Freshwater training tank journey started."}
  ],
  photos:[],
  feeding:[],
  dosing:[],
  doserChannels:[],
  quarantine:[],
  expenses:[],
  waterChanges:[],
  rodi:[],
  createdAt:"2026-01-01T00:00:00.000Z"
};
