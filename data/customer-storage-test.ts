import {CUSTOMER_CLOUD_SAVE_ENABLED,DEV_PROJECT_REF} from './customer-project-sync';
import {STORAGE,normalizeProject} from './bathroom-consultation';
type Handoff={runId:string;actor:'A'|'B';projectId:string;marker:string;capability:string};
type Context=Handoff&{profileNonce:string;publishableKey:string};
let context:Context|undefined;
export function requireLocalTestBoundary(env:{nodeEnv?:string;vercel?:string;mode?:string;hostname:string;projectRef:string;flag:boolean;approved:boolean}){
 if(env.nodeEnv!=='development'||env.vercel||env.mode!=='prepared'||!['localhost','127.0.0.1'].includes(env.hostname)||env.projectRef!==DEV_PROJECT_REF||!env.flag||!env.approved)throw Error('local-test-not-approved');
}
function boundary(approved:boolean){requireLocalTestBoundary({nodeEnv:process.env.NODE_ENV,vercel:process.env.NEXT_PUBLIC_VERCEL_ENV,mode:process.env.NEXT_PUBLIC_BATH_STORAGE_TEST_MODE,hostname:window.location.hostname,projectRef:DEV_PROJECT_REF,flag:CUSTOMER_CLOUD_SAVE_ENABLED,approved});}
async function broker(packet:unknown,signal?:AbortSignal|null){
 const deadline=AbortSignal.timeout(15000);
 const r=await fetch('http://127.0.0.1:43183/storage-test',{method:'POST',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(packet),signal:signal?AbortSignal.any([deadline,signal]):deadline});
 if(!r.ok)throw Error('local-test-broker-blocked');return r.json();
}
export async function armCustomerStorageTest(handoff:Handoff,confirmation:string){
 boundary(confirmation==='dedicated-profile-create-only-two-test-users-and-projects');
 if(context)throw Error('already-armed');
 const local=normalizeProject(JSON.parse(localStorage.getItem(STORAGE)??'{}'));
 if(local.projectInfo.builderMode!=='consumer'||local.projectInfo.projectName!==handoff.marker)throw Error('prepare-test-marker-in-dedicated-profile-first');
 if(handoff.marker!==`BATH-STORAGE-TEST:${handoff.runId}:${handoff.actor}`||!['A','B'].includes(handoff.actor))throw Error('invalid-handoff');
 const profileKey='bath-storage-test-profile-v1',old=localStorage.getItem(profileKey);
 let profile:{runId:string;actor:string;profileNonce:string};
 if(old){profile=JSON.parse(old);if(profile.runId!==handoff.runId||profile.actor!==handoff.actor)throw Error('different-run-profile');}
 else{
  if(localStorage.getItem(`bath-designer-auth:${DEV_PROJECT_REF}`)||localStorage.getItem('bath-designer-customer-cloud-v1'))throw Error('existing-session-profile-forbidden');
  profile={runId:handoff.runId,actor:handoff.actor,profileNonce:crypto.randomUUID()};localStorage.setItem(profileKey,JSON.stringify(profile));
 }
 const result=await broker({...handoff,profileNonce:profile.profileNonce,operation:'attach'});
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!key||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)||result.publishableKey!==key||result.projectRef!==DEV_PROJECT_REF||result.projectId!==handoff.projectId||result.marker!==handoff.marker)throw Error('test-target-key-mismatch');
 context={...handoff,profileNonce:profile.profileNonce,publishableKey:key};return {actor:handoff.actor,projectId:handoff.projectId,armed:true};
}
export function customerTestContext(){if(!context)return null;boundary(true);return context;}
export async function probeCustomerStorageTest(probe:'cross-read'|'cross-update'|'cross-delete'|'stale-revision'){
 const c=customerTestContext();if(!c)throw Error('explicit-test-arm-required');
 const auth=JSON.parse(localStorage.getItem(`bath-designer-auth:${DEV_PROJECT_REF}`)??'null');
 if(!auth?.accessToken||auth.expiresAt<=Date.now()+60000)throw Error('valid-existing-session-required');
 return broker({...c,operation:'probe',probe,token:auth.accessToken});
}
export const journaledCustomerFetch:typeof fetch=async(input,init)=>{
 const c=customerTestContext();if(!c)throw Error('explicit-test-arm-required');
 const u=new URL(String(input));if(u.origin!==`https://${DEV_PROJECT_REF}.supabase.co`)throw Error('unexpected-target');
 if(init?.signal?.aborted)throw Error('aborted-before-request');
 const headers=new Headers(init?.headers);if(headers.get('apikey')!==c.publishableKey)throw Error('public-key-mismatch');
 const r=await broker({...c,operation:'request',path:u.pathname+u.search,method:init?.method??'GET',body:typeof init?.body==='string'?JSON.parse(init.body):undefined,token:headers.get('Authorization')?.replace(/^Bearer /,'')},init?.signal);
 return new Response(JSON.stringify(r.data),{status:r.status,headers:{'Content-Type':'application/json'}});
};
declare global {interface Window {BathStorageTest?:{arm:typeof armCustomerStorageTest;probe:typeof probeCustomerStorageTest;start?:()=>void;inspect?:()=>Promise<unknown>;review?: (row:import('./customer-project-sync').ProjectRow)=>Promise<void>}}}
// No UI or network. Explicit developer entry exists only in a prepared dev build.
if(typeof window!=='undefined'&&typeof process!=='undefined'&&process.env.NODE_ENV==='development'&&process.env.NEXT_PUBLIC_BATH_STORAGE_TEST_MODE==='prepared'&&['localhost','127.0.0.1'].includes(window.location.hostname))window.BathStorageTest={arm:armCustomerStorageTest,probe:probeCustomerStorageTest};
