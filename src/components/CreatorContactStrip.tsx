"use client";

import { useAquaStore } from "@/store/useAquaStore";

const CONTACT={
 ar:{
  name:"محمد معاذ مراد",
  location:"سوريا، دمشق",
  phone:"٠٠٩٦٣٩٣٣٧٥٥٩٧٧",
  label:"للتواصل"
 },
 en:{
  name:"Mohammad Mouaz Mourad",
  location:"Syria, Damascus",
  phone:"+963 933 755 977",
  label:"Contact"
 },
 email:"Mouaz.mourad@gmail.com",
 tel:"+963933755977"
} as const;

export function CreatorContactStrip(){
 const lang=useAquaStore(s=>s.language);
 const c=lang==="ar"?CONTACT.ar:CONTACT.en;
 return <section className="creator-contact-strip" aria-label={lang==="ar"?"معلومات التواصل":"Contact information"}>
  <span className="creator-contact-label">{c.label}</span>
  <b>{c.name}</b>
  <span>⌖ {c.location}</span>
  <a href={`tel:${CONTACT.tel}`}>☎ {c.phone}</a>
  <a href={`mailto:${CONTACT.email}`}>✉ {CONTACT.email}</a>
 </section>;
}
