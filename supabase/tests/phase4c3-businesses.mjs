// Operator-only. --plan offline; --check GET-only; --run probes; --cleanup tracked rows.
import {readFileSync,writeFileSync,renameSync,existsSync,openSync,closeSync,unlinkSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {authErrorCode} from './phase4b1-customers.mjs'; // Import-safe; does not run customer suite.
import {REF,NAME,URL,ACTORS,need,uuid,SafetyError,createManifest,validateManifest,rowsFor,newJournal,validateJournal} from './phase4c3-model.mjs';
function claims(t){try{return JSON.parse(Buffer.from(t.split('.')[1],'base64url'));}catch{throw new SafetyError('Invalid JWT');}}
export function privateStorage(folder){
 need(existsSync(folder),'Private folder missing');
 if(process.platform==='win32'){
  const command="$ErrorActionPreference='Stop'; $p=$env:BATH_PRIVATE_DIR; $a=Get-Acl -LiteralPath $p; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; if(-not $a.AreAccessRulesProtected){exit 2}; foreach($r in $a.Access){if($r.AccessControlType -eq 'Allow' -and $r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin @($sid,'S-1-5-18')){exit 3}}; Write-Output 'PRIVATE_ACL_OK'";
  const result=execFileSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,BATH_PRIVATE_DIR:folder}});
  need(result.trim()==='PRIVATE_ACL_OK','Private ACL check failed');
 }else throw new SafetyError('Non-Windows private ACL verifier must be implemented before real execution');
}
function atomic(file,value){const tmp=`${file}.${randomUUID()}.tmp`;writeFileSync(tmp,JSON.stringify(value,null,2),{flag:'wx',mode:0o600,flush:true});renameSync(tmp,file);}
export async function runBusinesses({mode='--plan',env=process.env,fetcher=globalThis.fetch,log=console.log,storageCheck=privateStorage}={}){
 need(['--plan','--check','--run','--cleanup'].includes(mode),'Invalid business mode');
 const get=n=>{need(env[n],`Missing ${n}`);return env[n];};
 const folder=resolve('tests/artifacts/phase4a2');
 if(mode==='--plan'){
  const report={project_ref:REF,users:'4 confirmed Email + 1 anonymous; externally provisioned',businesses:3,memberships:6,
   projects:1,project_purpose:'one disposable foreign customer seed; no customer CRUD suite',fixture_transport:'Direct PostgreSQL verify-full AND backend ssl=true required',auth_cleanup:'external provisioner responsibility; retained here'};
  if(env.BATH_BUSINESS_USERS_FILE){
   need(get('BATH_BUSINESS_PLAN_CONFIRM')==='write-local-business-plan','Local plan approval required');
   need(get('BATH_TEST_SECRET_STORAGE_CONFIRM')==='private-acl-verified','Private ACL confirmation required');storageCheck(folder);
   const input=resolve(env.BATH_BUSINESS_USERS_FILE);need(dirname(input)===folder,'User ID input outside private folder');
   const m=createManifest(JSON.parse(readFileSync(input,'utf8')));
   need(!readdirSync(folder).some(n=>/^business-journal-.*\.json$/.test(n)&&JSON.parse(readFileSync(resolve(folder,n),'utf8')).cleanup_complete!==true),'Previous incomplete business journal');
   const manifestFile=resolve(folder,`business-fixture-${m.fixture_id}.json`),journalFile=resolve(folder,`business-journal-${m.fixture_id}.json`);
   // Persist journal first; no remote resource creation occurs in this path.
   writeFileSync(journalFile,JSON.stringify(newJournal(m),null,2),{flag:'wx',mode:0o600,flush:true});
   writeFileSync(manifestFile,JSON.stringify(m,null,2),{flag:'wx',mode:0o600,flush:true});
   report.manifest_file=manifestFile;report.journal_file=journalFile;
  }
  log(JSON.stringify(report));return {success:true};
 }
 need(get('BATH_TEST_SUPABASE_URL')===URL&&get('BATH_RLS_TEST_CONFIRM')===NAME,'Development target mismatch');
 need(env.NODE_TLS_REJECT_UNAUTHORIZED!=='0','TLS bypass forbidden');
 const key=get('BATH_TEST_PUBLISHABLE_KEY'),admin=get('BATH_TEST_ADMIN_KEY'),management=get('BATH_TEST_MANAGEMENT_TOKEN');
 need(key.startsWith('sb_publishable_')||(claims(key).role==='anon'&&claims(key).ref===REF),'Invalid public key');
 need(admin.startsWith('sb_secret_')||(claims(admin).role==='service_role'&&claims(admin).ref===REF),'Invalid admin key');
 const manifestFile=resolve(get('BATH_BUSINESS_MANIFEST')),journalFile=resolve(get('BATH_BUSINESS_JOURNAL'));
 need(dirname(manifestFile)===folder&&dirname(journalFile)===folder,'Business files outside private folder');storageCheck(folder);
 const m=validateManifest(JSON.parse(readFileSync(manifestFile,'utf8'))),j=validateJournal(JSON.parse(readFileSync(journalFile,'utf8')),m),baseline=rowsFor(m),tokens={};
 if(mode!=='--cleanup')need(j.fixture_outcome==='COMMITTED'&&!j.cleanup_complete,'Fixture transaction not confirmed; reconcile or cleanup first');
 const save=()=>atomic(journalFile,j);
 async function http(url,headers,method='GET',body){
  try{const r=await fetcher(url,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
   const text=await r.text(),data=text?JSON.parse(text):null;
   return {ok:r.ok,status:r.status,data,authCode:!r.ok&&url.startsWith(URL+'/auth/v1/')?authErrorCode(data,r.headers,r.status):undefined};
  }catch(e){if(e instanceof SafetyError)throw e;throw new SafetyError('NETWORK_OR_PROTOCOL: inspect business journal; no automatic retry');}
 }
 const headers=a=>({apikey:a==='ADMIN'?admin:key,'Content-Type':'application/json',Prefer:'return=representation',
  ...(tokens[a]?{Authorization:`Bearer ${tokens[a]}`}:(a==='ADMIN'&&!admin.startsWith('sb_secret_'))?{Authorization:`Bearer ${admin}`}:{})});
 const api=(a,p,method='GET',body)=>http(URL+p,headers(a),method,body);
 const ok=(r,label)=>{need(r.ok,`${label}: HTTP ${r.status}; not an RLS pass`);return r.data;};
 const path=(t,id)=>`/rest/v1/${t}?id=eq.${id}`;
 const one=async(t,id)=>{const r=ok(await api('ADMIN',path(t,id)),'Admin observe');need(Array.isArray(r)&&r.length<=1,'Invalid row response');return r[0]??null;};
 const target=ok(await http(`https://api.supabase.com/v1/projects/${REF}`,{Authorization:`Bearer ${management}`}), 'Management');
 need(target.id===REF&&target.name===NAME&&target.status==='ACTIVE_HEALTHY'&&target.database?.host===`db.${REF}.supabase.co`,'Live development identity mismatch');
 async function trusted(a){const d=ok(await api('ADMIN',`/auth/v1/admin/users/${m.users[a]}`),'Admin Auth'),u=d.user||d;
  need(u.id===m.users[a]&&u.app_metadata?.bath_business_rls_fixture===m.fixture_id&&u.is_anonymous===(a==='ANONYMOUS'),'Dedicated Auth identity/marker mismatch');
  if(a!=='ANONYMOUS')need(Boolean(u.email_confirmed_at),'Unconfirmed Email user');
 }
 async function session(a){const c=claims(tokens[a]);
  need(c.iss===`${URL}/auth/v1`&&c.sub===m.users[a]&&c.role==='authenticated'&&c.is_anonymous===(a==='ANONYMOUS'),'Session identity mismatch');
  need(c.exp>Date.now()/1000+60,'AUTH: expired/expiring session');const u=ok(await api(a,'/auth/v1/user'),'Real Auth session');
  need(u.id===m.users[a]&&u.is_anonymous===(a==='ANONYMOUS'),'Live session mismatch');
  if(a!=='ANONYMOUS')need(Boolean(u.email_confirmed_at),'Unconfirmed live Email');
 }
 for(const a of ACTORS)await trusted(a);
 function expectedRow(e,row){need(row&&Object.entries(e.body).every(([k,v])=>isDeepStrictEqual(row[k],v)),'Fixture identity/value drift');}
 async function graphAudit(){
  const businessIDs=j.entries.filter(e=>e.table==='businesses').map(e=>e.body.id);
  const graph=ok(await api('ADMIN',`/rest/v1/business_members?business_id=in.(${businessIDs.join(',')})`),'Membership graph');need(Array.isArray(graph),'Invalid graph');
  const userGraph=ok(await api('ADMIN',`/rest/v1/business_members?user_id=in.(${Object.values(m.users).join(',')})`),'User membership graph');need(Array.isArray(userGraph),'Invalid user graph');
  for(const row of [...graph,...userGraph]){
   const e=j.entries.find(e=>e.table==='business_members'&&e.body.id===row.id);need(e,'Foreign membership: no CASCADE cleanup');expectedRow(e,row);
  }
  const projects=ok(await api('ADMIN',`/rest/v1/projects?owner_user_id=in.(${Object.values(m.users).join(',')})`),'Dedicated user projects');need(Array.isArray(projects),'Invalid project graph');
  for(const row of projects){need(row.id===m.project_id,'Unexpected project: no cleanup cascade');expectedRow(j.entries.find(e=>e.table==='projects'),row);}
 }
 async function fixtureCheck(){for(const e of j.entries.filter(e=>e.source==='fixture'))expectedRow(e,await one(e.table,e.body.id));await graphAudit();}
 if(mode!=='--cleanup'){
  const settings=ok(await api('ANON','/auth/v1/settings'),'Auth settings');need(settings.external?.email===true&&settings.external?.anonymous_users===true,'Auth provider unavailable');
  for(const a of ACTORS){tokens[a]=get(`BATH_TEST_${a}_TOKEN`);await session(a);}
  await fixtureCheck();
 }
 if(mode==='--check'){log('CHECK PASS: business target, five real sessions, exact fixture graph; GET only');return {success:true};}
 need(get('BATH_TEST_SECRET_STORAGE_CONFIRM')==='private-acl-verified','Private ACL confirmation required');
 need(get('BATH_BUSINESS_EXECUTION_CONFIRM')===(mode==='--run'?'run-business-tests':'cleanup-business-fixture'),'Separate business execution approval required');
 if(mode==='--run')need(!j.started&&!j.cleanup_complete,'Already started/cleaned: cleanup only, never rerun');
 const lock=resolve(folder,`business-${m.fixture_id}.lock`);const fd=openSync(lock,'wx',0o600);closeSync(fd);
 let failed=false;
 const result=(name,details={})=>{j.results.push({name,result:'PASS',...details});save();};
 async function track(table,body){uuid(body.id);need(!j.entries.some(e=>e.body.id===body.id)&&!Object.values(m.users).includes(body.id),'Duplicate probe UUID');
  const collision=ok(await api('ADMIN',path(table,body.id)+'&select=id'),'Probe collision');need(Array.isArray(collision)&&collision.length===0,'Probe collision');
  j.entries.push({table,body,source:'probe'});save();
 }
 async function observe(a,table,id,allow,name){await session(a);const before=await one(table,id),r=ok(await api(a,path(table,id)),'Business SELECT');
  need(Array.isArray(r)&&r.length===(allow?1:0),'SECURITY: unexpected SELECT access');if(allow)need(isDeepStrictEqual(r[0],before),'SELECT content mismatch');
  need(isDeepStrictEqual(await one(table,id),before),'SELECT original changed');await session(a);result(name,{actor:a,unchanged:true});
 }
 async function denied(a,table,id,method,body,name,layer='GRANT'){
  if(a!=='ANON')await session(a);const before=await one(table,id);
  j.pending={actor:a,table,id,method,name};save();
  const r=await api(a,method==='POST'?`/rest/v1/${table}`:path(table,id),method,body);
  need(isDeepStrictEqual(await one(table,id),before),'SECURITY: denied request changed original');
  if(r.ok)need(layer==='RLS'&&method!=='POST'&&Array.isArray(r.data)&&r.data.length===0,'SECURITY: unexpected write/access success');
  else {need(a==='ANON'||r.status!==401,'AUTH: 401 is not RLS denial');need(r.data?.code==='42501','Unexpected SQL/API error');
   need(layer==='RLS'?/row-level security/i.test(r.data.message||''):/permission denied for (table|column|schema)/i.test(r.data.message||''),'Unexpected denial layer');}
  if(a!=='ANON')await session(a);j.pending=null;result(name,{actor:a,status:r.status,layer,unchanged:true});
 }
 async function cleanup(){
  j.cleanup_errors=[];
  try{
   // Pre-audit ALL rows and inbound graph before deleting anything.
   for(const a of ACTORS)await trusted(a);
   for(const e of j.entries){const row=await one(e.table,e.body.id);if(row)expectedRow(e,row);}
   await graphAudit();
   const rank={projects:0,business_members:1,businesses:2};
   for(const e of [...j.entries].sort((a,b)=>rank[a.table]-rank[b.table])){
    j.pending_cleanup={table:e.table,id:e.body.id};save();
    const row=await one(e.table,e.body.id);
    if(row){expectedRow(e,row);if(e.table==='businesses'){
      await graphAudit();const inbound=ok(await api('ADMIN',`/rest/v1/business_members?select=id&business_id=eq.${e.body.id}`),'No CASCADE check');
      need(Array.isArray(inbound)&&inbound.length===0,'Membership remains: refuse business CASCADE');
     }
     ok(await api('ADMIN',path(e.table,e.body.id),'DELETE'),'Cleanup DELETE');}
    need(await one(e.table,e.body.id)===null,'Cleanup row remains');e.cleaned=true;j.pending_cleanup=null;save();
   }
   await graphAudit();j.cleanup_complete=true;j.auth_retained=true;j.pending=null;
  }catch(e){j.cleanup_complete=false;j.cleanup_errors.push(e instanceof SafetyError?e.message:'CLEANUP_LOCAL_FAILURE');}
  save();return j.cleanup_complete;
 }
 try{
  if(mode==='--run'){
   j.started=true;save();
   for(const [a,b,k] of [['BUSINESS_A','A','A'],['BUSINESS_B','B','B']]){
    await observe(a,'businesses',m.businesses[b],true,`${a}_OWN_BUSINESS`);await observe(a,'business_members',m.members[k],true,`${a}_OWN_MEMBER`);
   }
   await observe('BUSINESS_A','businesses',m.businesses.B,false,'A_CANNOT_READ_B');await observe('BUSINESS_B','businesses',m.businesses.A,false,'B_CANNOT_READ_A');
   await observe('BUSINESS_A','business_members',m.members.B,false,'A_CANNOT_READ_B_MEMBER');await observe('BUSINESS_B','business_members',m.members.A,false,'B_CANNOT_READ_A_MEMBER');
   await observe('BUSINESS_A','business_members',m.members.ANONYMOUS,false,'A_CANNOT_READ_OTHER_APPROVED_MEMBER_IN_A');
   await observe('PENDING','business_members',m.members.PENDING,false,'PENDING_MEMBER_HIDDEN');await observe('PENDING','businesses',m.businesses.A,false,'PENDING_BUSINESS_HIDDEN');
   await observe('BUSINESS_B','business_members',m.members.REVOKED,false,'REVOKED_MEMBER_HIDDEN');
   await observe('BUSINESS_A','businesses',m.businesses.SUSPENDED,false,'SUSPENDED_BUSINESS_HIDDEN');await observe('BUSINESS_A','business_members',m.members.SUSPENDED,true,'SUSPENDED_APPROVED_SELF_MEMBER_VISIBLE');
   for(const a of ['GENERAL','PENDING','ANONYMOUS']){
    for(const id of Object.values(m.businesses))await observe(a,'businesses',id,false,`${a}_BUSINESS_DENIED`);
    for(const id of Object.values(m.members))await observe(a,'business_members',id,false,`${a}_MEMBERSHIP_DENIED`);
   }
   for(const a of ACTORS){
    const business={id:randomUUID(),business_name:`BATH-BUSINESS-RLS:${m.fixture_id}:PROBE`,status:'approved'};
    await track('businesses',business);await denied(a,'businesses',business.id,'POST',business,`${a}_BUSINESS_INSERT`);
    const member={id:randomUUID(),business_id:m.businesses.B,user_id:m.users[a],role:'admin',status:'approved'};
    await track('business_members',member);await denied(a,'business_members',member.id,'POST',member,`${a}_MEMBER_INSERT`);
    await denied(a,'businesses',m.businesses.A,'PATCH',{status:'approved',business_name:'forged'},`${a}_BUSINESS_UPDATE`);
    await denied(a,'businesses',m.businesses.A,'DELETE',undefined,`${a}_BUSINESS_DELETE`);
    for(const patch of [{business_id:m.businesses.B},{user_id:m.users.BUSINESS_B},{role:'owner'},{role:'admin'},{status:'approved'}])
     await denied(a,'business_members',m.members.A,'PATCH',patch,`${a}_MEMBER_FORGERY`);
    await denied(a,'business_members',m.members.A,'DELETE',undefined,`${a}_MEMBER_DELETE`);
   }
   await denied('PENDING','business_members',m.members.PENDING,'PATCH',{status:'approved'},'PENDING_SELF_APPROVAL');
   await denied('BUSINESS_A','businesses',m.businesses.SUSPENDED,'PATCH',{status:'approved'},'SUSPENDED_SELF_APPROVAL_DENIED');
   await denied('BUSINESS_B','business_members',m.members.B,'PATCH',{role:'admin'},'B_SELF_ROLE_ESCALATION');
   for(const table of ['businesses','business_members']){
    const id=table==='businesses'?m.businesses.A:m.members.A;
    for(const method of ['GET','PATCH','DELETE'])await denied('ANON',table,id,method,method==='PATCH'?(table==='businesses'?{status:'approved'}:{role:'admin'}):undefined,`ANON_${table}_${method}`);
    const body=table==='businesses'?{id:randomUUID(),business_name:`BATH-BUSINESS-RLS:${m.fixture_id}:PROBE`,status:'approved'}:{id:randomUUID(),business_id:m.businesses.A,user_id:m.users.ANONYMOUS,role:'admin',status:'approved'};
    await track(table,body);await denied('ANON',table,body.id,'POST',body,`ANON_${table}_POST`);
   }
   for(const a of ['BUSINESS_A','BUSINESS_B']){
    await observe(a,'projects',m.project_id,false,`${a}_FOREIGN_CUSTOMER_SELECT`);
    await denied(a,'projects',m.project_id,'PATCH',{consultation_memo:'forged'},`${a}_FOREIGN_CUSTOMER_UPDATE`,'RLS');
    await denied(a,'projects',m.project_id,'DELETE',undefined,`${a}_FOREIGN_CUSTOMER_DELETE`,'RLS');
   }
   j.scenarios_passed=true;save();
  }
 }catch(e){failed=true;j.failure=e instanceof SafetyError?e.message:'LOCAL_FAILURE';save();}
 finally{try{if(!(await cleanup()))failed=true;}finally{j.finished=true;save();unlinkSync(lock);}}
 need(!failed,'BUSINESS_TEST_FAILED: inspect private journal; no automatic rerun');
 log(mode==='--cleanup'?'CLEANUP PASS: tracked DB rows absent; external Auth retained':'PASS: business scenarios and tracked DB cleanup; external Auth retained');
 return {success:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runBusinesses({mode:process.argv[2]||'--plan'}).catch(e=>{console.error(e instanceof SafetyError?e.message:'LOCAL_OR_CONFIG_FAILURE');process.exitCode=1;});
