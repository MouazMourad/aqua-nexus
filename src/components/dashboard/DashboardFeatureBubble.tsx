"use client";

import { useEffect,useState } from "react";
import type { AppPage } from "@/components/navigation/MainNav";
import { useAquaStore } from "@/store/useAquaStore";

type FeatureTip={
  page:AppPage;
  icon:string;
  ar:string;
  en:string;
};

const BUBBLE_RISE_MS=20000;
const BUBBLE_CYCLE_MS=30000;

const FEATURE_TIPS:FeatureTip[]=[
  {page:"equipment",icon:"⇧",ar:"الاستيراد الذكي بيقرأ Screenshot أو ملف من جهازك، وبعد مراجعتك يوزّع الكيمياء والتجهيزات والجرعات وATO والتنبيهات على صفحاتها ويربطها بعقل الحوض.",en:"Smart Import reads a controller screenshot or export, then routes reviewed chemistry, equipment, dosing, ATO and alerts into their real modules and Tank Brain."},
  {page:"lighting",icon:"☀",ar:"صفحة الإنارة فيها محاكاة يوم كامل بسرعة ×10؛ لون وإضاءة الحوض 3D يتغيروا مع البرنامج الزمني.",en:"Lighting can simulate a full day at 10× speed while the 3D tank changes brightness and color with the schedule."},
  {page:"lighting",icon:"↕",ar:"خريطة التموضع تقسم عمق الحوض لمناطق وتبين مكان المرجان أو النبات وبعده عن سطح الماء ومدى مناسبة الضوء.",en:"The placement map divides tank depth into zones and shows coral/plant depth, surface distance and light suitability."},
  {page:"chemistry",icon:"⚗",ar:"عندك تاريخ فحوص قديم؟ الكيمياء تستورد CSV أو TXT وتفحص القيم والتكرار قبل ما تدخلها للرسوم والتحليل.",en:"Have old test history? Chemistry imports CSV/TXT and validates values and duplicates before adding them to trends and analysis."},
  {page:"dashboard",icon:"✦",ar:"Tank Brain ما بيقرأ صفحة لحالها؛ بيربط الكيمياء والمعدات والصيانة والكائنات والأحداث ليبني حالة الحوض والإجراء التالي.",en:"Tank Brain does not read modules in isolation; it connects chemistry, equipment, maintenance, livestock and events into tank state and next actions."},
  {page:"acclimation",icon:"⇄",ar:"الإقلمة تدعم أكثر من عداد بنفس الوقت وتفصل خطوات السمك واللافقاريات والمرجان والنبات، مع الحالات المتعبة والـDip.",en:"Acclimation supports parallel timers and category-specific workflows for fish, inverts, corals and plants, including stressed arrivals and coral dip."},
  {page:"equipment",icon:"⚙",ar:"تقدر تحدد مكان الجهاز باللمس على مخطط الحوض، وتتابع العمر والأعطال والاحتياط وقطع الاستهلاك والطاقة.",en:"Place equipment by touch and track lifecycle, failures, redundancy, consumables and energy use."},
  {page:"alerts",icon:"△",ar:"مركز التنبيهات يجمع إشارات الكيمياء والمعدات والصيانة والتوافق، بدل ما تدور على المشكلة صفحة صفحة.",en:"Alerts combines chemistry, equipment, maintenance and compatibility signals so you do not have to hunt module by module."},
  {page:"journal",icon:"▧",ar:"Visual Tank Insight يربط الصورة بالحوض والكائن والسجل بدل ما تكون الصورة مجرد مرفق منفصل.",en:"Visual Tank Insight connects photos with the tank, livestock and history instead of treating images as isolated attachments."},
  {page:"dashboard",icon:"⌕",ar:"من أعلى البرنامج في بحث شامل وتسجيل سريع؛ بتوصل لـKH أو جهاز أو كائن أو مهمة بدون ما تحفظ مكانها.",en:"Global search and Quick Log at the top can jump to a parameter, device, livestock item or task without memorizing where it lives."},
  {page:"dashboard",icon:"⚙",ar:"لوحة القيادة قابلة للتخصيص: أخفِ أو أظهر ورتّب صناديق التحليل بدون ما تختفي حالة الحوض والخطر والخطوة التالية.",en:"The dashboard is customizable: hide, show and reorder analysis cards while tank state, risk and next action remain visible."},
  {page:"sump",icon:"▤",ar:"مخطط السامب يعتمد الأبعاد الحقيقية ومواقع الحجر والمعدات، مو رسم ثابت؛ وبيظهر ضمن المجسم الرقمي للنظام.",en:"The sump model uses real chamber dimensions, positions and equipment rather than a fixed diagram, and feeds the system digital twin."}
];

export function DashboardFeatureBubble(){
  const lang=useAquaStore(s=>s.language);
  const [index,setIndex]=useState(0);
  const [cycle,setCycle]=useState(0);
  useEffect(()=>{
    const timer=window.setInterval(()=>{
      setIndex(i=>(i+1)%FEATURE_TIPS.length);
      setCycle(c=>c+1);
    },BUBBLE_CYCLE_MS);
    return()=>window.clearInterval(timer);
  },[]);

  const tip=FEATURE_TIPS[index];
  const names:Partial<Record<AppPage,{ar:string;en:string}>>={
    dashboard:{ar:"لوحة القيادة",en:"Dashboard"},equipment:{ar:"التجهيزات",en:"Equipment"},lighting:{ar:"الإنارة",en:"Lighting"},
    chemistry:{ar:"الكيمياء",en:"Chemistry"},acclimation:{ar:"الإقلمة",en:"Acclimation"},alerts:{ar:"التنبيهات",en:"Alerts"},
    journal:{ar:"الصور والسجل",en:"Journal"},sump:{ar:"السامب",en:"Sump"}
  };
  const label=names[tip.page]?.[lang==="ar"?"ar":"en"]??tip.page;

  return <div className="feature-bubble-lane" aria-hidden="true">
    <div className="feature-bubble" key={cycle}>
      <div className="feature-bubble-body">
        <span className="feature-bubble-icon">{tip.icon}</span>
        <span>
          <b>Aqua Nexus {lang==="ar"?"فيه ميزة يمكن ما انتبهتلها":"feature you may have missed"}</b>
          <small>{lang==="ar"?tip.ar:tip.en}</small>
          <em>{lang==="ar"?`افتح ${label} • وللتفاصيل اضغط زر ؟ أعلى الصفحة`:`Open ${label} • for details use the ? button at the top`}</em>
        </span>
      </div>
    </div>
    <style jsx>{`
      .feature-bubble-lane{position:fixed;inset:0;z-index:2600;pointer-events:none;overflow:hidden}
      .feature-bubble{position:absolute;inset-inline-end:clamp(12px,4vw,58px);bottom:-190px;width:min(360px,calc(100vw - 28px));pointer-events:none;animation:aquaBubbleRise 20s linear forwards;filter:drop-shadow(0 14px 28px rgba(0,0,0,.28))}
      .feature-bubble:before,.feature-bubble:after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(149,235,255,.28);background:radial-gradient(circle at 30% 28%,rgba(255,255,255,.22),rgba(91,212,239,.06) 48%,rgba(22,105,137,.035) 72%,transparent 73%);pointer-events:none}
      .feature-bubble:before{width:36px;height:36px;inset-inline-start:-18px;top:-24px}.feature-bubble:after{width:18px;height:18px;inset-inline-end:18px;bottom:-19px}
      .feature-bubble-body{width:100%;border:1px solid rgba(134,228,248,.28);border-radius:32px 32px 32px 18px;background:linear-gradient(135deg,rgba(17,75,98,.66),rgba(5,31,46,.54));backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px);color:inherit;padding:13px 15px;display:grid;grid-template-columns:38px 1fr;gap:9px;text-align:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.09)}
      .feature-bubble-icon{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(142,230,250,.24);background:rgba(104,218,244,.08);font-size:18px}
      .feature-bubble-body>span:last-child{display:grid;gap:3px;min-width:0}.feature-bubble-body b{font-size:10px;color:#bceefa}.feature-bubble-body small{font-size:9px;line-height:1.48;color:#eafaff}.feature-bubble-body em{font-style:normal;font-size:7.5px;color:#91c9d6}
      @keyframes aquaBubbleRise{
        0%{transform:translate3d(0,0,0) scale(.88);opacity:0}
        7%{opacity:.94}
        42%{transform:translate3d(-10px,-52vh,0) scale(1)}
        82%{opacity:.9}
        94%{transform:translate3d(8px,-112vh,0) scale(1.04);opacity:.82}
        98%{transform:translate3d(8px,-118vh,0) scale(1.08);opacity:.76}
        100%{transform:translate3d(8px,-122vh,0) scale(1.52);opacity:0}
      }
      @media(max-width:620px){.feature-bubble{inset-inline-end:10px;width:min(330px,calc(100vw - 20px))}.feature-bubble-body{padding:11px 12px;grid-template-columns:32px 1fr}.feature-bubble-icon{width:32px;height:32px}.feature-bubble-body small{font-size:8.5px}}
      @media(prefers-reduced-motion:reduce){.feature-bubble{animation:aquaBubbleFade 20s ease forwards}@keyframes aquaBubbleFade{0%,100%{opacity:0}10%,88%{opacity:.95}}}
    `}</style>
  </div>;
}
