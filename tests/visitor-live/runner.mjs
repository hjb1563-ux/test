import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { REF, URL, LIMITS, dayAt, localContext, validateApproval, checkProject, checkAudit, runScenario } from './safety.mjs';
import { loadShared } from './load-shared.mjs';
import { artifactRoot, inside, assertProtected, atomicWrite, acquireLock, encryptRecovery, assertNoPreviousRuns } from './local-files.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const AUDIT_SQL=`select pg_catalog.jsonb_build_object(
 'day',(pg_catalog.clock_timestamp() at time zone 'Asia/Seoul')::date,
 'database',pg_catalog.current_database(),
 'days_rows',(select count(*) from bath_metrics.days),
 'visits_rows',(select count(*) from bath_metrics.visits),
 'total',(select coalesce(sum(total),0) from bath_metrics.days),
 'other_days',(select count(*) from bath_metrics.days where day<>(pg_catalog.clock_timestamp() at time zone 'Asia/Seoul')::date),
 'hashes',(select coalesce(pg_catalog.jsonb_agg(visitor_hash),'[]'::jsonb) from bath_metrics.visits),
 'migration',exists(select 1 from supabase_migrations.schema_migrations where version='20261018145227'),
 'rls',(select count(*)=2 and bool_and(c.relrowsecurity) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='bath_metrics' and c.relname in ('days','visits') and c.relkind='r'),
 'functions',(select count(*)=4 and bool_and(pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE') and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') and not pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
   and p.prosecdef=(n.nspname='bath_metrics') and p.proconfig=array['search_path=""']::text[]
   and p.provolatile=case when p.proname in ('today','bath_visitor_today') then 's'::"char" else 'v'::"char" end
   and pg_catalog.md5(p.prosrc)=case n.nspname||'.'||p.proname
    when 'bath_metrics.today' then '405108831fb836cc81fc5283b7eeb3c9'
    when 'bath_metrics.register' then '06bccaa27892aca4c8f1aab674b98fe4'
    when 'public.bath_visitor_today' then '39b57ae1f4a4113b87cc607f6c4e9ed6'
    when 'public.bath_visitor_register' then '1879a6afb347a971596e04d3aa1e75ba' end) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where (n.nspname='bath_metrics' and p.proname in ('today','register')) or (n.nspname='public' and p.proname in ('bath_visitor_today','bath_visitor_register')))
) as audit`;
export function sourceDigest() {
 const names=['server/visitors.ts','server/visitor-core.ts','server/visitor-rpc.ts','app/api/visitors/route.ts','app/api/visitors/visit/route.ts','.vercelignore','tests/visitor-live/runner.mjs','tests/visitor-live/safety.mjs','tests/visitor-live/local-files.mjs','tests/visitor-live/load-shared.mjs','supabase/migrations/20261018145227_home_visitor_counter.sql'];
 const h=createHash('sha256');for(const name of names)h.update(name+'\0').update(fs.readFileSync(path.join(repo,name)));return h.digest('hex');
}
function argumentsOf(argv) {
 const modes=argv.filter(a=>['--plan','--prepare','--check','--run','--inspect'].includes(a));if(modes.length>1)throw new Error('choose-one-mode');
 const mode=modes[0]??'--plan',out={mode,ref:REF};
 for(let i=0;i<argv.length;i++){const a=argv[i];if(a===mode)continue;const key={'--project-ref':'ref','--credentials':'credentials','--approval':'approval','--journal':'journal'}[a];if(!key||!argv[i+1]||argv[i+1].startsWith('--'))throw new Error('unknown-or-incomplete-option');if(out[key]!==undefined&&key!=='ref')throw new Error('duplicate-option');out[key]=argv[++i]}
 return out;
}
const safeSummary=j=>({status:['preparing','running','stopped','complete'].includes(j.status)?j.status:'invalid',attempts:Array.isArray(j.attempts)?j.attempts.length:0,confirmed:Array.isArray(j.attempts)?j.attempts.filter(a=>a.status==='confirmed').length:0,unknown:Array.isArray(j.attempts)?j.attempts.filter(a=>['unknown','intent'].includes(a.status)).length:0});
async function jsonRequest(url,options) {
 let r;try{r=await fetch(url,{...options,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)})}catch{throw new Error('read-network-failed')}
 if(!r.ok)throw new Error('read-access-denied-or-unavailable');try{return await r.json()}catch{throw new Error('read-response-invalid')}
}
function readers(credentials) {
 const token=credentials.BATH_TEST_MANAGEMENT_TOKEN,secret=credentials.BATH_TEST_ADMIN_KEY,pub=credentials.BATH_TEST_PUBLISHABLE_KEY;
 if(!token||!/^sb_secret_[A-Za-z0-9_-]+$/.test(secret||'')||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(pub||''))throw new Error('missing-supported-credentials');
 const lookupProject=()=>jsonRequest(`https://api.supabase.com/v1/projects/${REF}`,{method:'GET',headers:{Authorization:`Bearer ${token}`}});
 const audit=async()=>{
  // Dedicated read-only endpoint; no fallback to a writable query endpoint or grant changes.
  const rows=await jsonRequest(`https://api.supabase.com/v1/projects/${REF}/database/query/read-only`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:AUDIT_SQL})});
  if(!Array.isArray(rows)||rows.length!==1||!rows[0].audit)throw new Error('audit-response-invalid');return rows[0].audit;
 };
 const negativeRead=async day=>{
  let r;try{r=await fetch(`${URL}/rest/v1/rpc/bath_visitor_today?p_day=${day}`,{method:'GET',redirect:'error',signal:AbortSignal.timeout(5000),headers:{apikey:pub}})}catch{throw new Error('negative-read-network-failed')}
  let b;try{b=await r.json()}catch{throw new Error('negative-read-invalid')}
  if(![401,403].includes(r.status)||b.code!=='42501')throw new Error('public-access-unexpected');
 };
 return{lookupProject,audit,negativeRead,secret};
}
export async function main(argv=process.argv.slice(2),env=process.env) {
 const args=argumentsOf(argv);localContext(env,args.ref);
 const now=new Date(),digest=sourceDigest();
 const template={version:1,approved:false,operation:'visitor-live-A-B',projectRef:REF,runId:randomUUID(),day:dayAt(now),expiresAt:new Date(now.getTime()+3600000).toISOString(),sourcesSha256:digest,exclusiveWindowConfirmed:false,...LIMITS};
 if(args.mode==='--plan')return{mode:'plan',remoteRequests:0,approvalTemplate:template,scope:'A actual RPC / B shared internal path / C not executed'};
 if(args.mode==='--prepare'){
  const root=artifactRoot(repo),file=path.join(root,'approval.json');if(fs.existsSync(file))throw new Error('approval-file-already-exists');atomicWrite(file,JSON.stringify(template,null,2));return{mode:'prepare',remoteRequests:0,approvalFile:file,approved:false};
 }
 if(args.mode==='--inspect'){
  const root=artifactRoot(repo);if(!args.journal)throw new Error('journal-required');const file=inside(root,args.journal);assertProtected(file);return{mode:'inspect',remoteRequests:0,...safeSummary(JSON.parse(fs.readFileSync(file,'utf8')))};
 }
 let approval,root;
 if(args.mode==='--run'){
  if(env.BATH_VISITOR_LIVE_TEST_APPROVED!==REF||!args.approval)throw new Error('explicit-approval-required');
  root=artifactRoot(repo);const file=inside(root,args.approval);assertProtected(file);approval=JSON.parse(fs.readFileSync(file,'utf8'));validateApproval(approval,{env,ref:args.ref,now,sourcesSha256:digest});assertNoPreviousRuns(root);
 }
 const shared=loadShared(); // Validate server-only loading before any remote read.
 if(!args.credentials)throw new Error('credentials-required');assertProtected(path.resolve(args.credentials));const credentials=parseEnv(fs.readFileSync(args.credentials,'utf8'));
 const read=readers(credentials);await checkProject(await read.lookupProject());const baseline=await read.audit();checkAudit(baseline,dayAt(new Date()),[]);await read.negativeRead(baseline.day);
 const readRpc=shared.createVisitorRpc({secretKey:read.secret,cookieSecret:'unused-read-only'});const current=await readRpc('bath_visitor_today',baseline.day);if(current.count!==0)throw new Error('baseline-not-empty');
 if(args.mode==='--check')return{mode:'check',projectRef:REF,day:baseline.day,daysRows:0,visitsRows:0,count:0,registrationRequests:0};
 // Read-only preflight above does not grant permission to write. Revalidate after it.
 validateApproval(approval,{env,ref:args.ref,now:new Date(),sourcesSha256:sourceDigest()});
 const release=acquireLock(root);
 try{
  assertNoPreviousRuns(root);
  const ids={A:randomBytes(32).toString('hex'),B:randomBytes(32).toString('hex')},cookieSecret=randomBytes(32).toString('hex');
  const recovery=path.join(root,approval.runId+'.recovery.dpapi'),journal=path.join(root,approval.runId+'.journal.json');
  atomicWrite(recovery,encryptRecovery({runId:approval.runId,day:approval.day,ids,cookieSecret}));
  return await runScenario({approval,env,clock:()=>new Date(),sourcesSha256:digest,shared,ids,cookieSecret,secretKey:read.secret,lookupProject:read.lookupProject,audit:read.audit,request:fetch,writeJournal:async value=>atomicWrite(journal,JSON.stringify(value,null,2))});
 }finally{release()}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{const code=/^[a-z][a-z0-9-]{1,65}$/.test(error.message)?error.message:'cli-stopped';console.error(JSON.stringify({status:'stopped',code,automaticRetry:false}));process.exitCode=1});
}
