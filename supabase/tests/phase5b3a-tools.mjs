// Server-side only. Imports are inert. Never import this module into browser code.
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,existsSync,openSync,closeSync,unlinkSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {authErrorCode} from './phase4b1-customers.mjs';
import {privateStorage} from './phase4c3-businesses.mjs';
export const REF='istsrambmbzuemkgutgh',URL_BASE=`https://${REF}.supabase.co`;
const ACTORS=['A','B'],folder=resolve('tests/artifacts/phase4a2');
const need=(v,m)=>{if(!v)throw Error(m);};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const hash=v=>createHash('sha256').update(v).digest('hex');
const clone=v=>JSON.parse(JSON.stringify(v));
export function runtimeGuard(env){need(env.NODE_ENV==='development'&&!env.VERCEL&&!env.VERCEL_ENV,'Local development only');need(env.BATH_TEST_SUPABASE_URL===URL_BASE&&env.BATH_RLS_TEST_CONFIRM==='bath-designer-dev','Wrong development target');need(env.NODE_TLS_REJECT_UNAUTHORIZED!=='0','TLS bypass forbidden');}
export function newTestPlan(){
 const run_id=randomUUID(),handoff={};const journal={kind:'browser-storage-test-v1',project_ref:REF,run_id,created_at:new Date().toISOString(),actors:{},events:[],stopped:false,cleanup_complete:false};
 for(const actor of ACTORS){const capability=randomBytes(32).toString('hex'),id=randomUUID(),nonce=randomUUID();
  journal.actors[actor]={id,nonce,marker:`BATH-STORAGE-TEST:${run_id}:${actor}`,cap_hash:hash(capability),profile_nonce:null,uid:null,auth:'planned',project:'planned'};
  handoff[actor]={runId:run_id,actor,projectId:id,marker:journal.actors[actor].marker,capability};
 }return {journal,handoff};
}
export function validateJournal(j){need(j?.kind==='browser-storage-test-v1'&&j.project_ref===REF&&uuid(j.run_id),'Invalid journal target');need(JSON.stringify(Object.keys(j.actors??{}).sort())==='["A","B"]','Exactly two actors required');
 const ids=[j.run_id];for(const a of ACTORS){const x=j.actors[a];need(uuid(x.id)&&uuid(x.nonce)&&x.marker===`BATH-STORAGE-TEST:${j.run_id}:${a}`&&/^[a-f0-9]{64}$/.test(x.cap_hash),'Invalid resource plan');ids.push(x.id,x.nonce);if(x.uid){need(uuid(x.uid),'Invalid Auth UID');ids.push(x.uid);}need(['planned','requested','created','marked','delete_requested','deleted'].includes(x.auth)&&['planned','requested','created','delete_requested','deleted'].includes(x.project),'Invalid lifecycle');}need(new Set(ids).size===ids.length,'Duplicate resource identity');need(Array.isArray(j.events),'Invalid events');return j;
}
export function createTestTool({journal,save,env,fetcher=globalThis.fetch}){
 validateJournal(journal);let queue=Promise.resolve(),checked=false;
 const serial=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 const durable=()=>save(clone(journal));
 const event=(actor,operation)=>{journal.events.push({actor,operation,at:new Date().toISOString(),outcome:'requested'});durable();return journal.events.at(-1);};
 const marker=x=>({bath_storage_test_run:journal.run_id,bath_storage_test_nonce:x.nonce});
 const adminHeaders=()=>{const key=env.BATH_TEST_ADMIN_KEY;need(/^sb_secret_[A-Za-z0-9_-]+$/.test(key??''),'Server secret key missing/unsupported');return {apikey:key,'Content-Type':'application/json',Prefer:'return=representation'};};
 async function http(path,method='GET',body,token,admin=false){
  const headers=admin?adminHeaders():{apikey:env.BATH_TEST_PUBLISHABLE_KEY,'Content-Type':'application/json',Prefer:'return=representation',...(token?{Authorization:`Bearer ${token}`}:{})};
  let r;try{r=await fetcher(URL_BASE+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(10000),...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();return {status:r.status,ok:r.ok,data:text?JSON.parse(text):null,headers:r.headers};}catch{throw Error('NETWORK_OR_PROTOCOL_UNKNOWN: inspect journal; no automatic recreation');}
 }
 const ok=r=>{need(r.ok,`HTTP_${r.status}: not a security-test PASS`);return r.data;};
 const userOf=r=>{const d=ok(r);return d.user??d;};
 const missing=r=>r.status===404&&authErrorCode(r.data,r.headers,r.status)==='user_not_found';
 async function trusted(x){const r=await http(`/auth/v1/admin/users/${x.uid}`,'GET',undefined,undefined,true);if(missing(r))return null;const u=userOf(r);need(u.id===x.uid&&u.is_anonymous===true&&Object.entries(marker(x)).every(([k,v])=>u.app_metadata?.[k]===v),'Auth identity/marker mismatch');return u;}
 async function rows(table,query){const data=ok(await http(`/rest/v1/${table}?select=*&${query}`,'GET',undefined,undefined,true));need(Array.isArray(data),'Malformed rows');return data;}
 async function project(x){const data=await rows('projects',`id=eq.${x.id}`);need(data.length<=1,'Duplicate UUID');if(data[0])need(data[0].owner_user_id===x.uid&&data[0].project_info?.projectName===x.marker,'Project owner/marker mismatch');return data[0]??null;}
 async function emptyReferences(x){const projects=await rows('projects',`owner_user_id=eq.${x.uid}`),members=await rows('business_members',`user_id=eq.${x.uid}`);need(projects.length===0&&members.length===0,'Residual references; refuse Auth CASCADE');}
 async function check(){runtimeGuard(env);need(/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.BATH_TEST_PUBLISHABLE_KEY??''),'Publishable key missing');adminHeaders();
  const r=await fetcher(`https://api.supabase.com/v1/projects/${REF}`,{headers:{Authorization:`Bearer ${env.BATH_TEST_MANAGEMENT_TOKEN??''}`},redirect:'error',signal:AbortSignal.timeout(10000)});const p=await r.json();need(r.ok&&p.id===REF&&p.name==='bath-designer-dev'&&p.status==='ACTIVE_HEALTHY'&&p.database?.host===`db.${REF}.supabase.co`,'Live project mismatch');
  const settings=ok(await http('/auth/v1/settings'));if(env.BATH_STORAGE_CLEANUP_CONFIRM!=='delete-only-journal-resources')need(settings.external?.anonymous_users===true&&settings.disable_signup===false,'Anonymous Auth unavailable');
  need(missing(await http(`/auth/v1/admin/users/${journal.run_id}`,'GET',undefined,undefined,true)),'Admin Auth unavailable or reserved UUID collision');
  for(const a of ACTORS){const x=journal.actors[a];if(x.auth==='planned')need((await rows('projects',`id=eq.${x.id}`)).length===0,'Reserved UUID already exists');}
  checked=true;return {project_ref:REF,anonymous:true};
 }
 function authorize(packet){runtimeGuard(env);need(checked,'GET precheck required');need(env.BATH_STORAGE_TEST_CONFIRM==='create-only-two-test-users-and-projects','Explicit remote approval missing');need(!journal.stopped,'Run stopped for cleanup');need(packet?.runId===journal.run_id&&ACTORS.includes(packet.actor),'Wrong run/actor');const x=journal.actors[packet.actor];need(typeof packet.capability==='string'&&hash(packet.capability)===x.cap_hash,'Invalid actor capability');need(uuid(packet.profileNonce),'Invalid dedicated profile nonce');if(x.profile_nonce)need(x.profile_nonce===packet.profileNonce,'Existing external profile/session forbidden');else{x.profile_nonce=packet.profileNonce;durable();}return x;}
 async function handle(packet){return serial(async()=>{
  const x=authorize(packet),actor=packet.actor;
  if(packet.operation==='attach')return {runId:journal.run_id,actor,projectId:x.id,marker:x.marker,publishableKey:env.BATH_TEST_PUBLISHABLE_KEY,projectRef:REF};
  if(packet.operation==='probe'){
   need(['cross-read','cross-update','cross-delete','stale-revision'].includes(packet.probe),'Unknown probe');
   need(x.auth==='marked'&&x.uid&&typeof packet.token==='string','Marked session required');
   const u=userOf(await http('/auth/v1/user','GET',undefined,packet.token));need(u.id===x.uid&&u.is_anonymous===true,'Actual session mismatch');
   const target=packet.probe==='stale-revision'?x:journal.actors[actor==='A'?'B':'A'];need(target.uid&&target.project==='created','Both project resources must exist');
   const before=await project(target);need(before,'Probe target absent');
   let method='GET',body,path=`/rest/v1/projects?id=eq.${target.id}&owner_user_id=eq.${target.uid}&select=*`;
   if(packet.probe==='cross-update'){method='PATCH';body={consultation_memo:'BATH-STORAGE-TEST denied probe'};}
   if(packet.probe==='cross-delete')method='DELETE';
   if(packet.probe==='stale-revision'){need(Number.isSafeInteger(Number(before.revision))&&Number(before.revision)>1,'Need prior successful UPDATE');method='PATCH';body={consultation_memo:'BATH-STORAGE-TEST stale probe'};path+=`&revision=eq.${BigInt(before.revision)-1n}`;}
   const e=event(actor,packet.probe);const r=await http(path,method,body,packet.token);const after=await project(target);
   const blocked=(r.ok&&Array.isArray(r.data)&&r.data.length===0)||(!r.ok&&r.status===403&&r.data?.code==='42501');
   if(!blocked||!isDeepStrictEqual(before,after)){journal.stopped=true;e.outcome='FAIL';durable();throw Error('Unexpected access or mutation; stop test');}
   const again=userOf(await http('/auth/v1/user','GET',undefined,packet.token));need(again.id===x.uid,'Session no longer valid');e.outcome='PASS';durable();return {pass:true,scenario:packet.probe,original_unchanged:true};
  }
  need(packet.operation==='request','Unknown operation');
  const path=new globalThis.URL(packet.path,URL_BASE);need(path.origin===URL_BASE&&!path.hash,'Remote path forbidden');
  const method=packet.method??'GET',body=packet.body,token=packet.token;
  if(path.pathname==='/auth/v1/signup'){
   need(method==='POST'&&x.auth==='planned'&&!x.uid,'Duplicate/unknown signup forbidden');
   x.auth='requested';const e=event(actor,'signup');
   const data=ok(await http('/auth/v1/signup','POST',{data:{bath_storage_test_nonce:x.nonce}}));need(uuid(data.user?.id)&&data.user.is_anonymous===true&&!ACTORS.some(a=>journal.actors[a].uid===data.user.id),'Invalid/duplicate Auth response');
   x.uid=data.user.id;x.auth='created';e.outcome='created';durable();
   need(typeof data.refresh_token==='string'&&typeof data.access_token==='string','Missing real session tokens');x.refresh_hash=hash(data.refresh_token);durable();
   ok(await http(`/auth/v1/admin/users/${x.uid}`,'PUT',{app_metadata:{...data.user.app_metadata,...marker(x)}},undefined,true));need(await trusted(x),'Auth disappeared');x.auth='marked';durable();return {status:200,data};
  }
  need(x.uid&&x.auth==='marked','Known marked user required');
  if(path.pathname==='/auth/v1/token'){
   need(method==='POST'&&path.search==='?grant_type=refresh_token'&&typeof body?.refresh_token==='string'&&hash(body.refresh_token)===x.refresh_hash&&!x.refresh_requested,'Invalid/unknown refresh');x.refresh_requested=true;
   const e=event(actor,'refresh'),r=await http('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:body.refresh_token});
   if(r.ok){need(r.data.user?.id===x.uid&&r.data.user.is_anonymous===true,'Refresh identity mismatch');x.refresh_hash=hash(r.data.refresh_token);x.refresh_requested=false;}e.outcome=`HTTP_${r.status}`;durable();return {status:r.status,data:r.data};
  }
  need(typeof token==='string'&&token.length>0,'Actual user token required');const u=userOf(await http('/auth/v1/user','GET',undefined,token));need(u.id===x.uid&&u.is_anonymous===true,'Actual session mismatch');
  if(path.pathname==='/auth/v1/user'){need(method==='GET','Invalid user operation');return {status:200,data:u};}
  need(path.pathname==='/rest/v1/projects'&&['GET','POST','PATCH'].includes(method),'Only customer project GET/INSERT/UPDATE allowed');
  const contentKeys=['project_info','builder_mode','selections','consultation_memo','special_notes','current_step','consultation_checks','image_history_order','content_modified_at','schema_version'];
  if(method!=='GET'){
   need(body&&Object.keys(body).every(k=>contentKeys.includes(k)||method==='POST'&&['id','owner_user_id'].includes(k)),'Immutable/unknown field');
   need(body.schema_version===3&&body.builder_mode==='consumer'&&body.project_info?.builderMode==='consumer'&&body.project_info?.projectName===x.marker,'Test marker/schema required');
   need(Buffer.byteLength(JSON.stringify(body))<=850000,'Request too large');
  }
  if(method==='POST'){
   need(!path.search&&body.id===x.id&&body.owner_user_id===x.uid&&x.project==='planned','Duplicate/wrong project INSERT');x.project='requested';
  }else{
   need([...path.searchParams.keys()].every(k=>['id','owner_user_id','revision','select'].includes(k)),'Unexpected query');
   need([...path.searchParams.keys()].length===new Set(path.searchParams.keys()).size&&path.searchParams.get('select')==='*','Unexpected selection/duplicate query');
   const id=path.searchParams.get('id');need(ACTORS.some(a=>id===`eq.${journal.actors[a].id}`),'Unregistered project');
   need(path.searchParams.get('owner_user_id')===`eq.${x.uid}`,'Owner filter required');
   if(method==='PATCH')need(id===`eq.${x.id}`&&/^eq\.[1-9][0-9]*$/.test(path.searchParams.get('revision')??'')&&x.project==='created','Revision-bound UPDATE required');
  }
  const e=event(actor,method==='POST'?'project-insert':method==='PATCH'?'project-update':'project-get');
  const r=await http(path.pathname+path.search,method,body,token);
  if(method==='POST'&&r.ok){need(Array.isArray(r.data)&&r.data.length===1&&r.data[0].id===x.id&&r.data[0].owner_user_id===x.uid,'Unexpected insert response');x.project='created';}
  e.outcome=`HTTP_${r.status}`;durable();return {status:r.status,data:r.data};
 });}
 async function cleanup(){return serial(async()=>{
  runtimeGuard(env);need(checked&&env.BATH_STORAGE_CLEANUP_CONFIRM==='delete-only-journal-resources','Separate cleanup approval required');journal.stopped=true;journal.cleanup_complete=false;durable();
  // Audit all identities/rows before the first delete. Never repair unmarked users here.
  for(const a of ACTORS){const x=journal.actors[a];if(!x.uid){need(x.auth==='planned','Unknown signup outcome; manual reconciliation');continue;}
   const u=await trusted(x);need(u||['delete_requested','deleted'].includes(x.auth),'Unexpected missing user');await project(x);
   const members=await rows('business_members',`user_id=eq.${x.uid}`);need(members.length===0,'Unexpected membership; stop');
   const projects=await rows('projects',`owner_user_id=eq.${x.uid}`);need(projects.every(p=>p.id===x.id&&p.project_info?.projectName===x.marker),'Unexpected owned project; stop');
  }
  for(const a of ACTORS){const x=journal.actors[a];if(!x.uid)continue;const row=await project(x);
   if(row){x.project='delete_requested';const e=event(a,'project-delete');const query=new URLSearchParams({id:`eq.${x.id}`,owner_user_id:`eq.${x.uid}`,'project_info->>projectName':`eq.${x.marker}`});ok(await http(`/rest/v1/projects?${query}`,'DELETE',undefined,undefined,true));need(!await project(x),'Project deletion failed');e.outcome='ABSENT_CONFIRMED';}
   x.project='deleted';durable();
  }
  for(const a of ACTORS){const x=journal.actors[a];if(!x.uid)continue;await emptyReferences(x);const u=await trusted(x);
   let e;if(u){x.auth='delete_requested';e=event(a,'auth-delete');ok(await http(`/auth/v1/admin/users/${x.uid}`,'DELETE',undefined,undefined,true));}
   need(!await trusted(x),'Auth deletion failed');await emptyReferences(x);x.auth='deleted';if(e)e.outcome='ABSENT_CONFIRMED';durable();
  }
  journal.cleanup_complete=true;durable();return {cleanup_complete:true,remaining:[]};
 });}
 const report=()=>({run_id:journal.run_id,project_ref:REF,cleanup_complete:journal.cleanup_complete,resources:ACTORS.map(actor=>({actor,project_id:journal.actors[actor].id,auth_uid:journal.actors[actor].uid,project_state:journal.actors[actor].project,auth_state:journal.actors[actor].auth}))});
 return {check,handle,cleanup,journal,report};
}
export function fileStore(file,{storageCheck=privateStorage}={}){
 need(dirname(resolve(file))===folder,'Journal must be in existing protected folder');storageCheck(folder);
 const inside=relative(resolve(process.cwd()),realpathSync(folder));need(!lstatSync(folder).isSymbolicLink()&&!inside.startsWith('..')&&!isAbsolute(inside),'Unsafe protected folder');
 if(existsSync(file))need(!lstatSync(file).isSymbolicLink(),'Journal symlink forbidden');
 if(existsSync(file))storageCheck(file);
 return value=>{validateJournal(value);const tmp=`${file}.${randomUUID()}.tmp`;writeFileSync(tmp,JSON.stringify(value,null,2),{flag:'wx',mode:0o600,flush:true});protectFile(tmp,storageCheck);renameSync(tmp,file);};
}
function protectFile(file,storageCheck=privateStorage){
 // Only newly generated journal/handoff artifacts; never modify credentials ACL.
 if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-Command',"$ErrorActionPreference='Stop'; $a=Get-Acl -LiteralPath $env:BATH_NEW_ARTIFACT; $a.SetAccessRuleProtection($true,$true); Set-Acl -LiteralPath $env:BATH_NEW_ARTIFACT -AclObject $a"],{windowsHide:true,env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,BATH_NEW_ARTIFACT:file},stdio:'ignore'});
 storageCheck(file);
}
async function main(){const mode=process.argv[2]??'--plan';
 if(mode==='--plan'){console.log('OFFLINE PLAN: bath-designer-dev only; maximum 2 anonymous users + 2 projects; no requests/files created');return;}
 need(['--init','--serve','--check','--cleanup'].includes(mode),'Unknown mode');
 const file=resolve(process.env.BATH_STORAGE_JOURNAL??resolve(folder,'phase5b3-journal.json'));
 const save=fileStore(file);
 if(mode==='--init'){
  const planLock=openSync(file+'.lock','wx');try{
  need(process.env.BATH_STORAGE_PLAN_CONFIRM==='write-local-test-plan'&&!existsSync(file),'Local plan confirmation required; never overwrite journal');
  const plan=newTestPlan();save(plan.journal);writeFileSync(file+'.handoff.json',JSON.stringify(plan.handoff,null,2),{flag:'wx',mode:0o600,flush:true});protectFile(file+'.handoff.json');console.log('Local journal and private actor handoff files created; no remote requests');return;
  }finally{closeSync(planLock);unlinkSync(file+'.lock');}
 }
 const fd=openSync(file+'.lock','wx');try{
  const tool=createTestTool({journal:JSON.parse(readFileSync(file,'utf8')),save,env:process.env});
  if(mode==='--cleanup'){try{await tool.check();await tool.cleanup();}finally{const reportFile=file+'.cleanup-report.json';if(existsSync(reportFile))need(!lstatSync(reportFile).isSymbolicLink(),'Report symlink forbidden');const tmp=reportFile+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(tool.report(),null,2),{flag:'wx',mode:0o600,flush:true});protectFile(tmp);renameSync(tmp,reportFile);}console.log(JSON.stringify(tool.report()));return;}
  if(mode==='--check'){console.log(JSON.stringify(await tool.check()));return;}
  runtimeGuard(process.env);need(process.env.BATH_STORAGE_TEST_CONFIRM==='create-only-two-test-users-and-projects','Explicit remote approval missing');await tool.check();
  const origin=process.env.BATH_STORAGE_BROWSER_ORIGIN??'http://localhost:3000';need(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin),'Loopback browser origin required');
  const server=createServer(async(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   if(req.headers.host!=='127.0.0.1:43183'||req.headers.origin!==origin||req.url!=='/storage-test'){res.writeHead(403).end();return;}
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','content-type');res.writeHead(204).end();return;}
   if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json')){res.writeHead(405).end();return;}
   try{let text='';for await(const c of req){text+=c;if(Buffer.byteLength(text)>1000000)throw Error('Body limit');}const result=await tool.handle(JSON.parse(text));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}
   catch{res.writeHead(409,{'Content-Type':'application/json'}).end(JSON.stringify({error:'TEST_BLOCKED: inspect private journal; no automatic retry'}));}
  });
  await new Promise((resolveDone,reject)=>{server.once('error',reject);server.listen(43183,'127.0.0.1',resolveDone);});console.log('Local test broker ready on loopback; no users created yet. Stop broker before cleanup.');
  await new Promise(resolveDone=>{const stop=()=>server.close(resolveDone);process.once('SIGINT',stop);process.once('SIGTERM',stop);});
 }finally{closeSync(fd);unlinkSync(file+'.lock');}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('TEST TOOL FAILED: inspect configuration/journal; no automatic retry; credentials suppressed');process.exitCode=1;});
