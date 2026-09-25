import fs from "node:fs";

const path = "src/i18n/index.ts";
let text = fs.readFileSync(path, "utf8");

const marker = "export function eventTypeText(lang:Language,type:string){\n";
const guard = "const timelineLabels:Record<string,[string,string]>";

if (!text.includes(marker)) {
  throw new Error("eventTypeText function not found");
}

if (!text.includes(guard)) {
  const insert = `export function eventTypeText(lang:Language,type:string){
  const timelineLabels:Record<string,[string,string]>={
    recovery:["استعادة","Recovery"],
    chemistry:["كيمياء","Chemistry"],
    warning:["تنبيه","Warning"],
    setup:["إعداد","Setup"],
  };
  const timelineLabel=timelineLabels[type];
  if(timelineLabel)return lang==="ar"?timelineLabel[0]:timelineLabel[1];
`;
  text = text.replace(marker, insert);
  fs.writeFileSync(path, text, "utf8");
  console.log("Applied Timeline Arabic event-token localization.");
} else {
  console.log("Timeline event-token localization already present.");
}
