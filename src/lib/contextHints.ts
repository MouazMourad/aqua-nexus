"use client";

export type ContextHintState={dismissed:string[]};

const KEY="aqua-nexus-context-hints-v1";
const EVENT="aqua-nexus-context-hints-change";
const EMPTY:ContextHintState={dismissed:[]};

function safe(raw:unknown):ContextHintState{
  if(!raw||typeof raw!=="object")return EMPTY;
  const values=(raw as Partial<ContextHintState>).dismissed;
  return{dismissed:Array.isArray(values)?[...new Set(values.filter((x):x is string=>typeof x==="string"))]:[]};
}

export function readContextHints():ContextHintState{
  if(typeof window==="undefined")return EMPTY;
  try{return safe(JSON.parse(localStorage.getItem(KEY)||"null"))}catch{return EMPTY}
}

function write(state:ContextHintState){
  if(typeof window==="undefined")return;
  localStorage.setItem(KEY,JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT,{detail:state}));
}

export function dismissContextHint(id:string){
  const state=readContextHints();
  if(state.dismissed.includes(id))return;
  write({dismissed:[...state.dismissed,id]});
}

export function resetContextHints(){write(EMPTY)}

export function subscribeContextHints(listener:(state:ContextHintState)=>void){
  if(typeof window==="undefined")return()=>{};
  const handler=(event:Event)=>{
    const detail=(event as CustomEvent<ContextHintState>).detail;
    listener(detail?safe(detail):readContextHints());
  };
  window.addEventListener(EVENT,handler);
  return()=>window.removeEventListener(EVENT,handler);
}
