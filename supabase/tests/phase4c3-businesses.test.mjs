// Entirely offline: fake HTTPS + fake psql, isolated ignored files, no inherited secrets.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {REF,URL,ACTORS,createManifest,rowsFor,newJournal,validateManifest} from './phase4c3-model.mjs';
import {runBusinesses} from './phase4c3-businesses.mjs';
import {runFixture} from './phase4c3-fixture.mjs';
const original=process.cwd();mkdirSync('tests/artifacts',{recursive:true});const root=mkdtempSync(resolve('tests/artifacts/phase4c3-offline-'));
function setup(fault,partial=false){
 const cwd=mkdtempSync(resolve(root,'case-')),folder=resolve(cwd,'tests/artifacts/phase4a2');mkdirSync(folder,{recursive:true});
 const m=createManifest(Object.fromEntries(ACTORS.map(a=>[a,randomUUID()]))),r=rowsFor(m),j=newJournal(m);
 j.fixture_outcome=partial?'UNKNOWN_OR_FAILED':'COMMITTED';
 const mf=resolve(folder,'manifest.json'),jf=resolve(folder,'journal.json');writeFileSync(mf,JSON.stringify(m));writeFileSync(jf,JSON.stringify(j));
 const env={BATH_TEST_SUPABASE_URL:URL,BATH_RLS_TEST_CONFIRM:'bath-designer-dev',BATH_TEST_PUBLISHABLE_KEY:'sb_publishable_OFFLINE',BATH_TEST_ADMIN_KEY:'sb_secret_OFFLINE',BATH_TEST_MANAGEMENT_TOKEN:'MANAGEMENT_OFFLINE',
  BATH_BUSINESS_MANIFEST:mf,BATH_BUSINESS_JOURNAL:jf,BATH_TEST_SECRET_STORAGE_CONFIRM:'private-acl-verified',BATH_BUSINESS_EXECUTION_CONFIRM:'run-business-tests'};
 const users=new Map(ACTORS.map(a=>[m.users[a],{id:m.users[a],is_anonymous:a==='ANONYMOUS',email_confirmed_at:a==='ANONYMOUS'?null:'confirmed',app_metadata:{bath_business_rls_fixture:m.fixture_id}}]));
 for(const a of ACTORS){const c={iss:URL+'/auth/v1',sub:m.users[a],role:'authenticated',is_anonymous:a==='ANONYMOUS',exp:Date.now()/1000+3600};env[`BATH_TEST_${a}_TOKEN`]='e30.'+Buffer.from(JSON.stringify(c)).toString('base64url')+'.MOCK';}
 const db={businesses:new Map(),business_members:new Map(),projects:new Map()};
 for(const b of r.businesses)db.businesses.set(b.id,{...b,created_at:'created',updated_at:'updated'});
 for(const member of r.members)db.business_members.set(member.id,{...member,created_at:'created'});
 db.projects.set(r.project.id,{...r.project,revision:1,consultation_memo:'',created_at:'created',updated_at:'updated'});
 if(partial){db.projects.clear();for(const id of [...db.business_members.keys()].slice(1))db.business_members.delete(id);db.businesses.delete(m.businesses.SUSPENDED);}
 const calls=[],logs=[];let transportFault=fault;
 const response=(data,status=200,headers)=>new Response(JSON.stringify(data),{status,headers});
 const grant=anon=>response({code:'42501',message:'permission denied for table'},anon?401:403);
 function filtered(table,u){return [...db[table].values()].filter(row=>{
  for(const key of ['id','user_id','business_id','owner_user_id']){const value=u.searchParams.get(key);if(!value)continue;
   if(value.startsWith('eq.')&&row[key]!==value.slice(3))return false;
   if(value.startsWith('in.(')&&!value.slice(4,-1).split(',').includes(row[key]))return false;
  }return true;
 });}
 const fetcher=async(uri,o={})=>{
  const u=new globalThis.URL(uri),method=o.method||'GET',body=o.body?JSON.parse(o.body):undefined;
  assert.ok([new globalThis.URL(URL).host,'api.supabase.com'].includes(u.host));assert.equal(o.redirect,'error');calls.push({path:u.pathname,method,admin:o.headers?.apikey==='sb_secret_OFFLINE'});
  if(u.hostname==='api.supabase.com')return response({id:REF,name:transportFault==='target'?'production':'bath-designer-dev',status:'ACTIVE_HEALTHY',database:{host:`db.${REF}.supabase.co`}});
  const admin=o.headers.apikey==='sb_secret_OFFLINE',token=o.headers.Authorization?.slice(7),c=token?JSON.parse(Buffer.from(token.split('.')[1],'base64url')):null,user=users.get(c?.sub);
  if(u.pathname==='/auth/v1/settings')return response({external:{email:true,anonymous_users:true}});
  if(u.pathname.startsWith('/auth/v1/admin/users/')){assert.equal(method,'GET');const user=users.get(u.pathname.split('/').at(-1));return user?response(user):response({code:404},404,{'X-SB-Error-Code':'user_not_found'});}
  if(u.pathname==='/auth/v1/user')return user?response(user):response({code:'bad_jwt'},401);
  assert.ok(u.pathname.startsWith('/rest/v1/'));const table=u.pathname.split('/').at(-1);assert.ok(table in db);
  let rows=filtered(table,u);const id=u.searchParams.get('id')?.slice(3);
  if(admin){
   assert.ok(['GET','DELETE'].includes(method),'No admin INSERT/UPDATE permitted');
   if(method==='DELETE'){
    const journal=JSON.parse(readFileSync(jf,'utf8'));assert.equal(journal.pending_cleanup.id,id,'Delete journal must precede request');
    if(transportFault==='cleanup')return response({code:'unavailable'},500);
    if(transportFault==='cleanup-network')throw Error('PRIVATE_NO_LOG');
    if(transportFault==='project-cleanup'&&table==='projects')return response({code:'unavailable'},500);
    if(transportFault==='member-sticks'&&table==='business_members')return response([]);
    // Model FK cascade to detect a dangerous parent delete in tests.
    if(table==='businesses')for(const [key,row] of db.business_members)if(row.business_id===id)db.business_members.delete(key);
    db[table].delete(id);return response([]);
   }
   if(u.searchParams.get('select')==='id')rows=rows.map(row=>({id:row.id}));return response(structuredClone(rows));
  }
  if(method==='GET'){
   if(transportFault==='network'||transportFault==='interrupted')throw Error('PRIVATE_NO_LOG');
   if(!user)return grant(true);
   if(transportFault==='leak')return response(structuredClone(rows));
   if(transportFault==='auth-error')return response({code:'bad_jwt'},401);
   if(transportFault==='unrelated-error')return response({code:'PGRST500'},500);
   if(table==='business_members')rows=rows.filter(row=>!user.is_anonymous&&row.user_id===user.id&&row.status==='approved');
   if(table==='businesses')rows=rows.filter(row=>!user.is_anonymous&&row.status==='approved'&&[...db.business_members.values()].some(member=>member.business_id===row.id&&member.user_id===user.id&&member.status==='approved'));
   if(table==='projects')rows=rows.filter(row=>row.owner_user_id===user.id);
   return response(structuredClone(rows));
  }
  const journal=JSON.parse(readFileSync(jf,'utf8'));assert.equal(journal.pending.method,method);assert.equal(journal.pending.table,table);
  if(method==='POST')assert.ok(journal.entries.some(e=>e.body.id===body.id),'Probe must be journaled before write');
  if(transportFault==='success-empty')return response([]);
  if(transportFault==='silent-change'&&method==='PATCH'&&rows[0]){rows[0].status='pending';return grant(!user);}
  if(transportFault==='insert-allowed'&&method==='POST'){db[table].set(body.id,{...body,created_at:'probe',updated_at:'probe'});return response([body],201);}
  if(!user)return grant(true);
  if(table==='projects')return response([]);
  return grant(false);
 };
 const invoke=async(mode='--run',extra={})=>{
  process.chdir(cwd);let result,error;
  try{result=await runBusinesses({mode,env:{...env,...extra},fetcher,storageCheck:()=>{},log:v=>logs.push(v)});}catch(e){error=e;}finally{process.chdir(original);}
  for(const secret of ['sb_secret_OFFLINE','MANAGEMENT_OFFLINE','PRIVATE_NO_LOG','access_token','refresh_token'])assert.ok(![...logs,readFileSync(jf,'utf8'),error?.message||''].join('\n').includes(secret));
  return {result,error,journal:JSON.parse(readFileSync(jf,'utf8'))};
 };
 return {cwd,folder,m,r,j,env,db,users,calls,logs,mf,jf,fetcher,invoke,clearFault(){transportFault=null;}};
}
test('--plan has no credentials, files or network requirements',async()=>{let output;await runBusinesses({mode:'--plan',env:{},fetcher:()=>assert.fail(),log:v=>output=JSON.parse(v)});assert.equal(output.memberships,6);assert.equal(output.projects,1);});
test('explicit offline plan persists all ten baseline targets before any remote creation',async()=>{
 const s=setup();const input=resolve(s.folder,'users.json');writeFileSync(input,JSON.stringify(s.m.users));let report;
 process.chdir(s.cwd);
 try{await runBusinesses({mode:'--plan',env:{BATH_BUSINESS_USERS_FILE:input,BATH_BUSINESS_PLAN_CONFIRM:'write-local-business-plan',BATH_TEST_SECRET_STORAGE_CONFIRM:'private-acl-verified'},fetcher:()=>assert.fail('No network in plan'),storageCheck:()=>{},log:v=>report=JSON.parse(v)});}finally{process.chdir(original);}
 const j=JSON.parse(readFileSync(report.journal_file)),m=validateManifest(JSON.parse(readFileSync(report.manifest_file)));
 assert.deepEqual(m.users,s.m.users);assert.equal(j.entries.length,10);assert.equal(j.started,false);assert.equal(j.fixture_attempted,undefined);
});
test('model validates five unique actual users and exact 3/6 relation including suspended self',()=>{
 const s=setup();assert.equal(s.r.businesses.length,3);assert.equal(s.r.members.length,6);assert.equal(s.r.members.filter(r=>r.user_id===s.m.users.GENERAL).length,0);
 assert.throws(()=>validateManifest({...s.m,users:{...s.m.users,GENERAL:s.m.users.BUSINESS_A}}));
});
test('--check GET only; journal unchanged; no customer suite/auth creation',async()=>{const s=setup(),before=readFileSync(s.jf,'utf8'),r=await s.invoke('--check');assert.ok(!r.error,r.error?.message);assert.equal(readFileSync(s.jf,'utf8'),before);assert.ok(s.calls.every(c=>c.method==='GET'));});
test('full approved/pending/revoked/suspended/general/anonymous/forgery suite and cleanup',async()=>{
 const s=setup(),r=await s.invoke();assert.ok(!r.error,r.error?.message);assert.equal(r.journal.scenarios_passed,true);assert.equal(r.journal.cleanup_complete,true);
 for(const table of Object.values(s.db))assert.equal(table.size,0);assert.equal(s.users.size,5);assert.equal(r.journal.auth_retained,true);
 assert.ok(r.journal.results.some(x=>x.name==='SUSPENDED_APPROVED_SELF_MEMBER_VISIBLE'));
 assert.ok(r.journal.results.some(x=>x.name==='A_CANNOT_READ_OTHER_APPROVED_MEMBER_IN_A'));
 assert.ok(r.journal.results.some(x=>x.name==='BUSINESS_B_FOREIGN_CUSTOMER_DELETE'));
 assert.ok(s.calls.every(c=>!c.path.includes('signup')&&!c.path.includes('/auth/v1/token')));
});
for(const fault of ['target','leak','network','interrupted','auth-error','unrelated-error','success-empty','silent-change','insert-allowed','cleanup','cleanup-network'])test(`fail closed: ${fault}`,async()=>{
 const s=setup(fault),r=await s.invoke();
 // cleanup faults require a scenario failure to leave rows; baseline always remains until finally anyway.
 assert.ok(r.error,`must fail ${fault}`);assert.equal(s.users.size,5);
 if(fault==='target')assert.ok(s.calls.every(c=>c.method==='GET'));
 if(['cleanup','cleanup-network','silent-change'].includes(fault))assert.equal(r.journal.cleanup_complete,false);
 else if(fault!=='target')assert.equal(r.journal.cleanup_complete,true);
});
test('partial Fixture generation cleanup removes present subset only',async()=>{const s=setup(null,true),r=await s.invoke('--cleanup',{BATH_BUSINESS_EXECUTION_CONFIRM:'cleanup-business-fixture'});assert.ok(!r.error,r.error?.message);for(const table of Object.values(s.db))assert.equal(table.size,0);});

for(const fault of ['project-cleanup','member-sticks'])test(`cleanup barrier and resume: ${fault}`,async()=>{
 const s=setup(fault),extra={BATH_BUSINESS_EXECUTION_CONFIRM:'cleanup-business-fixture'};
 const first=await s.invoke('--cleanup',extra);assert.ok(first.error);assert.equal(first.journal.cleanup_complete,false);
 assert.equal(s.db.businesses.size,3);assert.equal(s.users.size,5);assert.ok(!s.calls.some(c=>c.method==='DELETE'&&c.path.endsWith('/businesses')));
 if(fault==='project-cleanup')assert.equal(s.db.business_members.size,6);
 s.clearFault();assert.ok(!(await s.invoke('--cleanup',extra)).error);for(const table of Object.values(s.db))assert.equal(table.size,0);
});
test('duplicate cleanup and failed cleanup retry are safe without JWTs',async()=>{
 const s=setup('cleanup');const first=await s.invoke();assert.ok(first.error);s.clearFault();
 const extra={BATH_BUSINESS_EXECUTION_CONFIRM:'cleanup-business-fixture',...Object.fromEntries(ACTORS.map(a=>[`BATH_TEST_${a}_TOKEN`,undefined]))};
 assert.ok(!(await s.invoke('--cleanup',extra)).error);assert.ok(!(await s.invoke('--cleanup',extra)).error);assert.equal(s.users.size,5);
});
test('hard interruption prevents rerun; cleanup recovers durable journal',async()=>{
 const s=setup();const journal=JSON.parse(readFileSync(s.jf));journal.started=true;journal.pending={table:'business_members',id:s.m.members.A,method:'PATCH'};writeFileSync(s.jf,JSON.stringify(journal));
 assert.ok((await s.invoke()).error);assert.ok(!(await s.invoke('--cleanup',{BATH_BUSINESS_EXECUTION_CONFIRM:'cleanup-business-fixture'})).error);
});
test('foreign inbound member prevents every cleanup deletion and Auth remains',async()=>{
 const s=setup();const row={id:randomUUID(),business_id:s.m.businesses.A,user_id:randomUUID(),role:'member',status:'approved'};s.db.business_members.set(row.id,row);
 const r=await s.invoke('--cleanup',{BATH_BUSINESS_EXECUTION_CONFIRM:'cleanup-business-fixture'});assert.ok(r.error);assert.equal(s.db.businesses.size,3);assert.ok(!s.calls.some(c=>c.method==='DELETE'));assert.equal(s.users.size,5);
});
test('manifest project mismatch rejected before network',async()=>{const s=setup();writeFileSync(s.mf,JSON.stringify({...s.m,project_ref:'production'}));assert.ok((await s.invoke()).error);assert.equal(s.calls.length,0);});
test('unexpected manifest fields including credentials rejected before use',async()=>{const s=setup();writeFileSync(s.mf,JSON.stringify({...s.m,unrecognized:'not-a-manifest-field'}));assert.ok((await s.invoke()).error);assert.equal(s.calls.length,0);});
test('expired session rejected before writes; real /user identity required',async()=>{const s=setup();const c={iss:URL+'/auth/v1',sub:s.m.users.BUSINESS_A,role:'authenticated',is_anonymous:false,exp:0};const r=await s.invoke('--check',{BATH_TEST_BUSINESS_A_TOKEN:'e30.'+Buffer.from(JSON.stringify(c)).toString('base64url')+'.MOCK'});assert.ok(r.error);assert.ok(s.calls.every(c=>c.method==='GET'));});
test('missing trusted marker is not authorized for cleanup',async()=>{const s=setup();s.users.get(s.m.users.BUSINESS_A).app_metadata={};assert.ok((await s.invoke('--cleanup',{BATH_BUSINESS_EXECUTION_CONFIRM:'cleanup-business-fixture'})).error);assert.ok(s.calls.every(c=>c.method==='GET'));});
test('journal identity tampering rejected before network/deletion',async()=>{const s=setup();const j=JSON.parse(readFileSync(s.jf));j.entries[0].body.business_name='customer business';writeFileSync(s.jf,JSON.stringify(j));assert.ok((await s.invoke('--cleanup',{BATH_BUSINESS_EXECUTION_CONFIRM:'cleanup-business-fixture'})).error);assert.equal(s.calls.length,0);});
test('additional forged baseline cleanup entry cannot delete another project',async()=>{const s=setup();const j=JSON.parse(readFileSync(s.jf));j.entries.push({table:'projects',source:'fixture',body:{id:randomUUID()}});writeFileSync(s.jf,JSON.stringify(j));assert.ok((await s.invoke('--cleanup',{BATH_BUSINESS_EXECUTION_CONFIRM:'cleanup-business-fixture'})).error);assert.equal(s.calls.length,0);});
test('unknown/partial fixture result cannot start a run',async()=>{const s=setup(null,true);const r=await s.invoke();assert.ok(r.error);assert.equal(s.calls.length,0);});
test('Direct transport blocks Session Pooler and records failed/unknown fixture attempt before spawn',async()=>{
 const s=setup();const client=resolve(s.folder,'fake-psql'),ca=resolve(s.folder,'fake-ca.crt'),pass=resolve(s.folder,'fake-pgpass.conf'),config=resolve(s.folder,'db.json');
 writeFileSync(s.jf,JSON.stringify(newJournal(s.m)));
 for(const p of [client,ca,pass])writeFileSync(p,'OFFLINE_ONLY');
 const c={project_ref:REF,project_name:'bath-designer-dev',mode:'session',dashboard_confirmed:true,host:'aws-0-ap-northeast-2.pooler.supabase.com',port:5432,database:'postgres',user:`postgres.${REF}`,psql_path:client,ca_file:ca,pgpass_file:pass};
 writeFileSync(config,JSON.stringify(c));let spawned=0;
 const invoke=async(mode,spawn)=>{process.chdir(s.cwd);try{return await runFixture({mode,env:{...s.env,BATH_TEST_DB_CONFIG:config,BATH_BUSINESS_FIXTURE_CONFIRM:'create-business-fixture'},fetcher:s.fetcher,storageCheck:()=>{},spawn,log:()=>{}});}finally{process.chdir(original);}};
 await assert.rejects(invoke('--run',()=>{spawned++;}));assert.equal(spawned,0);
 Object.assign(c,{mode:'direct',host:`db.${REF}.supabase.co`,user:'postgres'});writeFileSync(config,JSON.stringify(c));
 await invoke('--check',(_exe,args,o)=>{spawned++;assert.equal(o.env.PGSSLMODE,'verify-full');assert.equal(o.env.BATH_TEST_ADMIN_KEY,undefined);assert.equal(o.env.BATH_TEST_MANAGEMENT_TOKEN,undefined);if(args.includes('--version'))return {status:0,stdout:'psql (PostgreSQL) 17.11'};assert.ok(args.includes('begin read only;'));return {status:0,stdout:'on\n'};});
 await assert.rejects(invoke('--run',(_exe,args)=>{if(args.includes('--version'))return {status:0,stdout:'psql (PostgreSQL) 17.11'};assert.equal(JSON.parse(readFileSync(s.jf)).fixture_attempted,true);return {status:3,stdout:'',stderr:'PRIVATE_NO_LOG'};}));
 assert.equal(JSON.parse(readFileSync(s.jf)).fixture_outcome,'UNKNOWN_OR_FAILED');
 await assert.rejects(invoke('--run',()=>({status:0,stdout:'psql (PostgreSQL) 17.11'})));
});
test('fixture SQL retains both backend TLS guards and a single transaction; no grants/schema changes',()=>{
 const sql=readFileSync(new globalThis.URL('./phase4c3-fixture.sql',import.meta.url),'utf8');
 assert.ok(sql.includes('\\ir phase4a4-connection-check.sql'));assert.ok(sql.includes('pg_stat_ssl where pid=pg_backend_pid() and ssl'));
 assert.ok(sql.includes("HOST'='db.istsrambmbzuemkgutgh.supabase.co'"));assert.ok(sql.indexOf('begin;')<sql.indexOf('insert into public.businesses'));
 assert.ok(sql.includes('pg_advisory_xact_lock'));assert.doesNotMatch(sql,/\b(grant|revoke|alter|drop|truncate|create\s+table)\b/i);
});
