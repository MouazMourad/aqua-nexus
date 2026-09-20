const locks=new Map<string,number>();

export function claimCriticalAction(key:string,ttlMs=1800){
  const now=Date.now(),until=locks.get(key)??0;
  if(until>now)return false;
  locks.set(key,now+Math.max(500,ttlMs));
  if(locks.size>200){
    for(const [k,t] of locks)if(t<=now)locks.delete(k);
  }
  return true;
}

export function releaseCriticalAction(key:string){
  locks.delete(key);
}
