const globalForSafety=globalThis as typeof globalThis & {
  aquaRateBuckets?:Map<string,{count:number;resetAt:number}>;
};
const buckets=globalForSafety.aquaRateBuckets??new Map<string,{count:number;resetAt:number}>();
globalForSafety.aquaRateBuckets=buckets;

export function declaredBodyTooLarge(request:Request,maxBytes:number){
  const raw=request.headers.get("content-length");
  if(!raw)return false;
  const size=Number(raw);
  return Number.isFinite(size)&&size>maxBytes;
}

export function enforceRateLimit(key:string,limit:number,windowMs=60_000){
  const now=Date.now();
  const current=buckets.get(key);
  if(!current||current.resetAt<=now){
    buckets.set(key,{count:1,resetAt:now+windowMs});
    return {ok:true as const,remaining:Math.max(0,limit-1),retryAfterSeconds:0};
  }
  current.count+=1;
  if(current.count>limit)return {ok:false as const,remaining:0,retryAfterSeconds:Math.max(1,Math.ceil((current.resetAt-now)/1000))};
  return {ok:true as const,remaining:Math.max(0,limit-current.count),retryAfterSeconds:0};
}

export function sanitizeAIQuestion(value:unknown,max=2400){
  return String(value??"").replace(/\u0000/g,"").trim().slice(0,max);
}

export function publicApiError(error:unknown,fallback:string){
  const e=error as {status?:number;message?:string};
  const status=Number(e?.status)||500;
  if(status>=400&&status<500)return{status,message:e?.message||fallback};
  return{status:500,message:fallback};
}
