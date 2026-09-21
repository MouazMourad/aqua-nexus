"use client";

import type { AppPage } from "@/components/navigation/MainNav";

export type FeatureDiscoveryMode="smart"|"off";

export type FeatureDiscoveryState={
  mode:FeatureDiscoveryMode;
  learned:string[];
};

const KEY="aqua-nexus-feature-discovery-v1";
const EVENT="aqua-nexus-feature-discovery-change";

const DEFAULT_STATE:FeatureDiscoveryState={mode:"smart",learned:[]};

function safeState(raw:unknown):FeatureDiscoveryState{
  if(!raw||typeof raw!=="object")return DEFAULT_STATE;
  const x=raw as Partial<FeatureDiscoveryState>;
  return{
    mode:x.mode==="off"?"off":"smart",
    learned:Array.isArray(x.learned)?[...new Set(x.learned.filter((v):v is string=>typeof v==="string"))]:[]
  };
}

export function readFeatureDiscovery():FeatureDiscoveryState{
  if(typeof window==="undefined")return DEFAULT_STATE;
  try{return safeState(JSON.parse(localStorage.getItem(KEY)||"null"))}catch{return DEFAULT_STATE}
}

function write(next:FeatureDiscoveryState){
  if(typeof window==="undefined")return;
  localStorage.setItem(KEY,JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT,{detail:next}));
}

export function setFeatureDiscoveryMode(mode:FeatureDiscoveryMode){
  write({...readFeatureDiscovery(),mode});
}

export function markFeatureLearned(id:string){
  const current=readFeatureDiscovery();
  if(current.learned.includes(id))return;
  write({...current,learned:[...current.learned,id]});
}

const PAGE_FEATURES:Partial<Record<AppPage,string[]>>={
  equipment:["equipment-management"],
  lighting:["lighting-demo","lighting-placement"],
  chemistry:["chemistry-import"],
  acclimation:["acclimation"],
  alerts:["alerts-center"],
  journal:["visual-insight"],
  sump:["sump-model"]
};

export function markPageFeaturesLearned(page:AppPage){
  for(const id of PAGE_FEATURES[page]??[])markFeatureLearned(id);
}

export function resetFeatureDiscovery(){
  write({mode:"smart",learned:[]});
}

export function subscribeFeatureDiscovery(listener:(state:FeatureDiscoveryState)=>void){
  if(typeof window==="undefined")return()=>{};
  const handler=(event:Event)=>{
    const detail=(event as CustomEvent<FeatureDiscoveryState>).detail;
    listener(detail?safeState(detail):readFeatureDiscovery());
  };
  window.addEventListener(EVENT,handler);
  return()=>window.removeEventListener(EVENT,handler);
}
