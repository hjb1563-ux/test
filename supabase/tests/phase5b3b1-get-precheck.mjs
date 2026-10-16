// GET-only preflight. Never creates a persistent run, Auth user, or project.
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve} from 'node:path';
import {createTestTool,newTestPlan,REF,URL_BASE} from './phase5b3a-tools.mjs';
import {privateStorage} from './phase4c3-businesses.mjs';
const need=(v,m)=>{if(!v)throw Error(m);};
let stage='private-folder';
async function main(){
 const folder=resolve('tests/artifacts/phase4a2');privateStorage(folder);
 stage='credentials-read';const credentials=parseEnv(readFileSync(resolve(folder,'credentials.env.local'),'utf8'));
 const local=parseEnv(readFileSync('.env.local','utf8'));
 const key=local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;need(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key??''),'Local publishable key missing/invalid');
 need(!Object.entries(local).some(([n,v])=>n.startsWith('NEXT_PUBLIC_')&&(/ADMIN|SECRET|SERVICE_ROLE|MANAGEMENT/.test(n)||v.startsWith('sb_secret_'))),'Unsafe public configuration');
 need(/CUSTOMER_CLOUD_SAVE_ENABLED\s*=\s*false/.test(readFileSync('data/customer-project-sync.ts','utf8')),'Feature Flag must remain OFF');
 need(local.NEXT_PUBLIC_BATH_STORAGE_TEST_MODE!=='prepared','Prepared mode must remain OFF');
 const env={...process.env,...credentials,NODE_ENV:'development',BATH_TEST_PUBLISHABLE_KEY:key};
 delete env.BATH_STORAGE_TEST_CONFIRM;delete env.BATH_STORAGE_CLEANUP_CONFIRM;
 const methods=[];
 const getOnly=async(url,options={})=>{
  need((options.method??'GET')==='GET'&&options.body===undefined,'Only GET permitted');
  const u=new URL(url);need(u.origin===URL_BASE||u.origin==='https://api.supabase.com'&&u.pathname.startsWith(`/v1/projects/${REF}`),'Unexpected GET target');methods.push('GET');
  return fetch(url,{...options,method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});
 };
 const management=async(path)=>{const r=await getOnly(`https://api.supabase.com/v1/projects/${REF}${path}`,{headers:{Authorization:`Bearer ${env.BATH_TEST_MANAGEMENT_TOKEN}`}});need(r.ok,`Management GET failed (${r.status})`);return r.json();};
 const tool=createTestTool({journal:newTestPlan().journal,save:()=>{throw Error('Persistent journal write forbidden in GET preflight');},env,fetcher:getOnly});
 stage='tool-GET-check';await tool.check();
 stage='project-GET';
 const project=await management('');
 // Direct gateway positive/negative GET checks require no API-key-secret listing permission.
 stage='public-key-gateway-GET';const valid=await getOnly(URL_BASE+'/auth/v1/settings',{headers:{apikey:key}});
 const invalid=await getOnly(URL_BASE+'/auth/v1/settings',{headers:{apikey:'sb_publishable_GET_PREFLIGHT_INVALID_KEY_NOT_REAL'}});
 need(valid.status===200&&[401,403].includes(invalid.status),'Gateway key validation inconclusive');
 const keyMatches=true;
 stage='metadata-GET';const coreOnly=process.argv.includes('--get-core-only');
 const context=coreOnly?{}:await management('/database/context');
 const tables=[];function walk(v){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}
  const name=v.name??v.table_name;if(['projects','businesses','business_members','public.projects','public.businesses','public.business_members'].includes(name))tables.push({table:name,fields:Object.keys(v),rls:v.rls_enabled??v.rlsEnabled??v.row_security??v.relrowsecurity??null});
  Object.values(v).forEach(walk);
 }walk(context);
 console.log(JSON.stringify({project:{name:project.name,ref:project.id,status:project.status,region:project.region},localPublishableKeyAcceptedByProject:keyMatches,gatewayStatuses:{valid:valid.status,invalid:invalid.status},keyListMembership:'not checked: reveal permission denied in prior GET (403)',protectedPublishableKeyMatchesLocal:credentials.BATH_TEST_PUBLISHABLE_KEY===key,anonymousAuthAndAdminGet:'PASS',featureFlag:false,preparedMode:false,metadataAccess:coreOnly?'skipped; metadata GET previously denied (403), current RLS not reverified':'GET completed',metadataTables:tables,metadataTopLevelKeys:Object.keys(context),requests:{count:methods.length,methods:[...new Set(methods)]},persistentJournalWrittenByThisCheck:false}));
}
main().catch(e=>{const safe=['Local publishable key missing/invalid','Feature Flag must remain OFF','Prepared mode must remain OFF','Local key does not match development project','Unsafe public configuration','Live project mismatch','Anonymous Auth unavailable','Development target mismatch','Wrong development target','Server secret key missing/unsupported','Admin Auth unavailable or reserved UUID collision'];console.error(JSON.stringify({stage,error:safe.includes(e.message)||/^HTTP_\d{3}:/.test(e.message)||/^Management GET failed \(\d{3}\)$/.test(e.message)?e.message:'GET failed; response bodies suppressed',code:e.code??e.cause?.code??null}));process.exitCode=1;});
