import { dbConfigured,query } from "@/server/db";

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



export async function enforceRateLimitDistributed(key:string,limit:number,windowMs=60_000){
  if(!dbConfigured())return enforceRateLimit(key,limit,windowMs);
  try{
    const result=await query<{count:number;reset_at:string}>(`
      INSERT INTO aqua_rate_limits(bucket_key,count,reset_at)
      VALUES($1,1,now()+($3::text||' milliseconds')::interval)
      ON CONFLICT(bucket_key) DO UPDATE SET
        count=CASE WHEN aqua_rate_limits.reset_at<=now() THEN 1 ELSE aqua_rate_limits.count+1 END,
        reset_at=CASE WHEN aqua_rate_limits.reset_at<=now() THEN now()+($3::text||' milliseconds')::interval ELSE aqua_rate_limits.reset_at END
      RETURNING count,reset_at
    `,[key,limit,windowMs]);
    const row=result.rows[0],count=Number(row?.count||1),reset=new Date(row?.reset_at||Date.now()+windowMs).getTime();
    if(count>limit)return{ok:false as const,remaining:0,retryAfterSeconds:Math.max(1,Math.ceil((reset-Date.now())/1000))};
    return{ok:true as const,remaining:Math.max(0,limit-count),retryAfterSeconds:0};
  }catch{
    // A database limiter outage must not take the whole app down; keep a
    // per-instance limiter as a conservative secondary guard.
    return enforceRateLimit(key,limit,windowMs);
  }
}

export class RequestBodyTooLargeError extends Error{
  status=413;
  constructor(public maxBytes:number){super("Request body exceeds the server size limit.")}
}

export async function readRequestBytesLimited(request:Request,maxBytes:number){
  if(declaredBodyTooLarge(request,maxBytes))throw new RequestBodyTooLargeError(maxBytes);
  if(!request.body)return new Uint8Array();
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      if(value){total+=value.byteLength;if(total>maxBytes)throw new RequestBodyTooLargeError(maxBytes);chunks.push(value);}
    }
  }finally{try{reader.releaseLock()}catch{}}
  const merged=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength}
  return merged;
}

export async function readJsonBodyLimited<T=unknown>(request:Request,maxBytes:number):Promise<T>{
  const bytes=await readRequestBytesLimited(request,maxBytes);
  try{return JSON.parse(new TextDecoder().decode(bytes)) as T}
  catch{const error=new Error("Invalid JSON request body") as Error&{status?:number};error.status=400;throw error}
}

export async function readFormDataLimited(request:Request,maxBytes:number){
  const bytes=await readRequestBytesLimited(request,maxBytes);
  const copy=new Request("http://aqua.local/upload",{method:"POST",headers:request.headers,body:bytes});
  return await copy.formData();
}
