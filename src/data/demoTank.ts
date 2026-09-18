import type { Tank } from "@/domain/types";

const now = new Date().toISOString();

export const demoMarineTank: Tank = {
  id: "training-marine",
  name: "Marine Training Tank",
  isTraining: true,
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
  chemistry: [{
    timestamp: now,
    values: { temperature:25,pH:8.1,salinity:1.025,KH:8,Ca:430,Mg:1300,NO3:10,PO4:0.08,NH3:0 }
  }],
  maintenance: [
    { id:"m1", title:"فحص السكيمر", titleEn:"Inspect skimmer", cadence:"weekly", done:true, lastDone:"2026-09-12", nextDue:"2026-09-19" },
    { id:"m2", title:"تنظيف الجرابات", titleEn:"Clean filter socks", cadence:"weekly", done:true, lastDone:"2026-09-12", nextDue:"2026-09-19" },
    { id:"m3", title:"فحص مضخة الرجوع", titleEn:"Inspect return pump", cadence:"monthly", done:true, lastDone:"2026-09-01", nextDue:"2026-10-01" },
    { id:"m4", title:"حصاد التيرف", titleEn:"Harvest turf scrubber", cadence:"weekly", done:true, lastDone:"2026-09-18", nextDue:"2026-09-25" },
    { id:"m5", title:"تنظيف واجهة الحوض", titleEn:"Clean display glass", cadence:"weekly", done:true, lastDone:"2026-09-12", nextDue:"2026-09-19" }
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
    { id:"t1", timestamp:now, type:"system", textAr:"تم تشغيل النسخة الجديدة من Aqua Nexus 3D.", textEn:"Aqua Nexus 3D new build started." }
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
  chemistry:[{timestamp:now,values:{temperature:25,pH:7.2,GH:8,KH:5,NH3:0,NO2:0,NO3:15,TDS:200}}],
  livestock:[],
  inventory:[],
  timeline:[],
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
