import { DEV_PROJECT_REF } from './customer-project-sync';
import { AUTH_LOCK, browserCloudLocks, boundedCloudFetch, type CloudLocks } from './customer-cloud-locks';
export type BrowserStorage = Pick<Storage, 'getItem'|'setItem'>;
type AuthRecord = {userId: string|null; accessToken?: string; refreshToken?: string; expiresAt?: number; creationAttempted: boolean};
const validId=(v: unknown): v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function createAnonymousSessionProvider(options: {
  enabled?: boolean; url: string; publishableKey: string; storage: BrowserStorage; request: typeof fetch;
  expectedOwner: ()=>string|null; locks?:CloudLocks; signal?:()=>AbortSignal|undefined;
}) {
  const key=`bath-designer-auth:${DEV_PROJECT_REF}`;
  let flight: Promise<{userId:string;anonymous:boolean;expiresAt:number;accessToken:string}>|undefined;
  let signal:AbortSignal|undefined;
  let expectedAuthRaw:string|null=null;
  function store(r: AuthRecord){signal?.throwIfAborted();if(options.storage.getItem(key)!==expectedAuthRaw)throw Error('auth-storage-changed');const raw=JSON.stringify(r);options.storage.setItem(key,raw);if(options.storage.getItem(key)!==raw)throw Error('auth-storage-failed');expectedAuthRaw=raw;}
  async function call(path: string, method: string, body?: unknown, token?: string) {
    let r;
    try {r=await boundedCloudFetch(options.request,options.url+'/auth/v1/'+path,{method,redirect:'error',cache:'no-store',headers:{apikey:options.publishableKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})},signal);}
    catch {throw Error('auth-network-failure');}
    if(!r.ok)throw Error('auth-request-failed');return r.json();
  }
  async function obtain(){
    if(options.enabled!==true)throw Error('cloud-save-disabled');
    if(options.url!==`https://${DEV_PROJECT_REF}.supabase.co`||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(options.publishableKey))throw Error('invalid-public-client-config');
    const raw=options.storage.getItem(key);expectedAuthRaw=raw;let record: AuthRecord;
    try {record=raw?JSON.parse(raw):{userId:null,creationAttempted:false};}
    catch {throw Error('auth-storage-corrupt');}
    if(!record||typeof record.creationAttempted!=='boolean'||record.userId!==null&&!validId(record.userId))throw Error('auth-storage-corrupt');
    const expected=options.expectedOwner();
    if(expected&&record.userId!==expected)throw Error('session-owner-mismatch');
    if(!record.accessToken||!record.refreshToken){
      if(expected||record.userId||record.creationAttempted)throw Error('anonymous-session-lost');
      record.creationAttempted=true;store(record); // Before signup: uncertain response must not create a second user.
      const data=await call('signup','POST',{data:{}});
      if(!validId(data.user?.id)||data.user?.is_anonymous!==true)throw Error('invalid-anonymous-user');
      record={userId:data.user.id,creationAttempted:true,accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:data.expires_at?data.expires_at*1000:Date.now()+data.expires_in*1000};store(record);
    } else if(!Number.isFinite(record.expiresAt)||record.expiresAt!<=Date.now()+60000){
      const data=await call('token?grant_type=refresh_token','POST',{refresh_token:record.refreshToken});
      if(data.user?.id!==record.userId||data.user?.is_anonymous!==true)throw Error('session-owner-mismatch');
      record={...record,accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:data.expires_at?data.expires_at*1000:Date.now()+data.expires_in*1000};store(record);
    }
    if(!record.accessToken||!record.refreshToken||!Number.isFinite(record.expiresAt)||record.expiresAt!<=Date.now()+60000)throw Error('session-expired');
    const user=await call('user','GET',undefined,record.accessToken);
    if(user.id!==record.userId||user.is_anonymous!==true||expected&&user.id!==expected)throw Error('session-owner-mismatch');
    signal?.throwIfAborted();if(options.storage.getItem(key)!==expectedAuthRaw)throw Error('auth-storage-changed');
    const latestOwner=options.expectedOwner();if(latestOwner&&latestOwner!==user.id)throw Error('session-owner-mismatch');
    return {userId:record.userId!,anonymous:true,expiresAt:record.expiresAt!,accessToken:record.accessToken};
  }
  return ()=>{
    if(options.enabled!==true)return Promise.reject(Error('cloud-save-disabled'));
    if(!flight)flight=(options.locks??browserCloudLocks).run(AUTH_LOCK,async acquired=>{
      const parent=options.signal?.();signal=parent?AbortSignal.any([acquired,parent]):acquired;
      try{signal.throwIfAborted();return await obtain();}finally{signal=undefined;}
    }).finally(()=>{flight=undefined;});return flight;
  };
}
