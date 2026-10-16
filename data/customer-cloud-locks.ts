import { DEV_PROJECT_REF } from './customer-project-sync';
export const AUTH_LOCK=`bath-designer:${DEV_PROJECT_REF}:auth`;
// Shared binding key also serializes UUID allocation/reset before an ID exists.
export const PROJECT_LOCK=`bath-designer:${DEV_PROJECT_REF}:project-binding`;
export interface CloudLocks { run<T>(name:string,work:(signal:AbortSignal)=>Promise<T>):Promise<T> }
export function createBrowserCloudLocks(manager?:LockManager,waitMs=5000,workMs=15000):CloudLocks {
  return {async run<T>(name:string,work:(signal:AbortSignal)=>Promise<T>){
    if(!manager?.request)throw Error('cloud-lock-unavailable');
    const wait=new AbortController(),timer=setTimeout(()=>wait.abort(),waitMs);
    try{return await manager.request(name,{mode:'exclusive',signal:wait.signal},async lock=>{
      clearTimeout(timer);if(!lock)throw Error('cloud-lock-failed');
      const operation=new AbortController(),deadline=setTimeout(()=>operation.abort(),workMs);
      try{operation.signal.throwIfAborted();return await work(operation.signal);}finally{clearTimeout(deadline);}
    });}finally{clearTimeout(timer);}
  }};
}
// Resolve only when called; OFF paths never inspect browser globals.
export const browserCloudLocks:CloudLocks={run:(name,work)=>createBrowserCloudLocks(typeof navigator==='undefined'?undefined:navigator.locks).run(name,work)};
export async function boundedCloudFetch(request:typeof fetch,url:string,options:RequestInit,outer?:AbortSignal){
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
  const stop=()=>abort.abort();outer?.addEventListener('abort',stop,{once:true});
  try{if(outer?.aborted)abort.abort();abort.signal.throwIfAborted();const response=await request(url,{...options,signal:abort.signal});
    const text=await response.text();abort.signal.throwIfAborted();return {ok:response.ok,status:response.status,json:()=>JSON.parse(text)};
  }finally{clearTimeout(timeout);outer?.removeEventListener('abort',stop);}
}
