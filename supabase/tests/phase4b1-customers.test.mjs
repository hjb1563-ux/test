// Fully mocked HTTPS. Never inherits credentials or contacts Supabase.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {runCustomers,authErrorCode} from './phase4b1-customers.mjs';
const ref='istsrambmbzuemkgutgh',url=`https://${ref}.supabase.co`,original=process.cwd();
mkdirSync('tests/artifacts',{recursive:true});
const root=mkdtempSync(resolve('tests/artifacts/phase4b1-offline-'));
function mock(fault){
 const users=new Map(),rows=new Map(),calls=[];let signup=0;
 const response=(d,status=200,headers)=>new Response(JSON.stringify(d),{status,headers});
 const denied=(layer='GRANT')=>response({code:'42501',message:layer==='RLS'?'new row violates row-level security policy':'permission denied for table projects'},403);
 const fetcher=async(uri,o={})=>{
  const u=new URL(uri),method=o.method||'GET',body=o.body?JSON.parse(o.body):null;
  calls.push({host:u.host,path:u.pathname,method});
  assert.ok([new URL(url).host,'api.supabase.com'].includes(u.host));assert.equal(o.redirect,'error');
  if(u.host==='api.supabase.com')return response({id:ref,name:fault==='target'?'production':'bath-designer-dev',status:'ACTIVE_HEALTHY',database:{host:`db.${ref}.supabase.co`}});
  const admin=o.headers.apikey==='sb_secret_OFFLINE';
  const token=o.headers.Authorization?.slice(7),c=token?JSON.parse(Buffer.from(token.split('.')[1],'base64url')):null;
  const actor=c?.sub;
  if(u.pathname==='/auth/v1/settings')return response({external:{anonymous_users:fault!=='disabled'},disable_signup:false});
  if(u.pathname==='/auth/v1/signup'){
   const journal=JSON.parse(readFileSync(resolve('tests/artifacts/phase4a2',readdirSync('tests/artifacts/phase4a2').find(n=>n.endsWith('.json'))),'utf8'));
   assert.ok(journal.pending_signup);assert.ok(journal.plan.cleanup);
   signup++;if(fault==='unknown-signup')throw Error('PRIVATE_SECRET_DO_NOT_PRINT');
   const id=fault==='duplicate'&&users.size?[...users.keys()][0]:randomUUID();
   const user={id,is_anonymous:true,user_metadata:body.data,app_metadata:{}};users.set(id,user);
   const payload={iss:url+'/auth/v1',sub:id,role:'authenticated',is_anonymous:fault!=='not-anonymous',exp:fault==='expired'?0:Date.now()/1000+3600};
   return response({user,access_token:'e30.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.OFFLINE',refresh_token:'DO_NOT_STORE'});
  }
  if(u.pathname==='/auth/v1/user')return users.has(actor)?response(users.get(actor)):response({code:'bad_jwt'},401);
  if(u.pathname.startsWith('/auth/v1/admin/users/')){
   assert.ok(admin);const id=u.pathname.split('/').at(-1),user=users.get(id);
   if(!user){
    if(fault==='header-only')return response({msg:'User not found'},404,{'X-Sb-ErRoR-CoDe':'user_not_found'});
    if(fault==='legacy-numeric')return response({code:404,msg:'User not found'},404,{'X-Sb-ErRoR-CoDe':'user_not_found'});
    if(fault==='legacy-wrong-status')return response({code:401},404,{'x-sb-error-code':'user_not_found'});
    if(fault==='legacy-no-header')return response({code:404,msg:'User not found'},404);
    if(fault==='both-codes')return response({code:'user_not_found'},404,{'X-SB-ERROR-CODE':'user_not_found'});
    if(fault==='wrong-404')return response({code:'route_not_found'},404);
    if(fault==='missing-code')return response({msg:'User not found'},404);
    if(fault==='conflict')return response({code:'user_not_found'},404,{'x-sb-error-code':'bad_jwt'});
    if(fault==='header-401')return response({},401,{'x-sb-error-code':'user_not_found'});
    if(fault==='header-403')return response({},403,{'x-sb-error-code':'user_not_found'});
    if(fault==='auth-network')throw Error('PRIVATE_SECRET_DO_NOT_PRINT');
    return response({code:'user_not_found'},404);
   }
   if(method==='PUT')user.app_metadata=body.app_metadata;
   if(method==='DELETE')users.delete(id);
   return response(user);
  }
  assert.equal(u.pathname,'/rest/v1/projects');
  const id=u.searchParams.get('id')?.slice(3),owner=u.searchParams.get('owner_user_id')?.slice(3);
  if(admin){
   if(method==='DELETE'){if(fault==='cleanup')return response({code:'failed'},500);rows.delete(id);return response([]);}
   let result=owner?[...rows.values()].filter(r=>r.owner_user_id===owner):rows.has(id)?[rows.get(id)]:[];
   if(u.searchParams.get('select')==='id')result=result.map(r=>({id:r.id}));return response(structuredClone(result));
  }
  if(!actor)return denied();
  if(method==='POST'){
   const journal=JSON.parse(readFileSync(resolve('tests/artifacts/phase4a2',readdirSync('tests/artifacts/phase4a2').find(n=>n.endsWith('.json'))),'utf8'));
   assert.ok(journal.projects.some(p=>p.id===body.id),'Write must be journaled first');
   if(body.owner_user_id!==actor)return fault==='false-insert'?response([]):denied('RLS');
   const row={...body,revision:1,created_at:'original',updated_at:'original',consultation_memo:''};rows.set(row.id,row);return response(structuredClone([row]),201);
  }
  const row=rows.get(id),own=row?.owner_user_id===actor;
  if(method==='PATCH'&&body.owner_user_id){if(fault==='owner-drift'&&row){row.owner_user_id=body.owner_user_id;return response([row]);}return denied();}
  if(!own){
   if(fault==='auth-denial')return response({code:'bad_jwt'},401);
   if(['leak','cleanup'].includes(fault)&&method==='GET')return response(row?[row]:[]);
   if(fault==='silent-write'&&method==='PATCH'&&row)row.consultation_memo='compromised';
   if(fault==='protocol')return response({code:'PGRST999'},500);
   return response([]);
  }
  if(method==='PATCH'){
   const expected=u.searchParams.get('revision')?.slice(3);
   if(expected!==undefined&&Number(expected)!==row.revision&&fault!=='stale-revision')return response([]);
   row.consultation_memo=body.consultation_memo;row.revision++;row.updated_at='trigger-managed';
  }
  if(method==='DELETE')rows.delete(id);
  return response(row?structuredClone([row]):[]);
 };
 return {fetcher,users,rows,calls,clearFault(){fault=null;},get signup(){return signup;}};
}
async function exercise(fault,mode='--run'){
 const cwd=mkdtempSync(resolve(root,'case-'));mkdirSync(resolve(cwd,'tests/artifacts/phase4a2'),{recursive:true});process.chdir(cwd);
 const m=mock(fault),logs=[];
 const env={BATH_TEST_SUPABASE_URL:url,BATH_RLS_TEST_CONFIRM:'bath-designer-dev',BATH_TEST_PUBLISHABLE_KEY:'sb_publishable_OFFLINE',BATH_TEST_ADMIN_KEY:'sb_secret_OFFLINE',BATH_TEST_MANAGEMENT_TOKEN:'MANAGEMENT_OFFLINE',BATH_TEST_SECRET_STORAGE_CONFIRM:'private-acl-verified',BATH_CUSTOMER_RLS_CONFIRM:'create-two-anonymous-users-and-test'};
 let error,result;
 try{result=await runCustomers({mode,env,fetcher:m.fetcher,log:v=>logs.push(v)});}catch(e){error=e;}
 finally{process.chdir(original);}
 const folder=resolve(cwd,'tests/artifacts/phase4a2'),files=readdirSync(folder).filter(n=>n.endsWith('.json'));
 const journals=files.map(n=>readFileSync(resolve(folder,n),'utf8'));
 for(const secret of ['PRIVATE_SECRET_DO_NOT_PRINT','sb_secret_OFFLINE','MANAGEMENT_OFFLINE','access_token','refresh_token'])assert.ok(![...logs,...journals,error?.message||''].join('\n').includes(secret));
 return {m,error,result,env,cwd,journalFile:files[0]?resolve(folder,files[0]):null,journal:journals[0]?JSON.parse(journals[0]):null};
}
test('check is GET-only and creates no users/journal',async()=>{const r=await exercise(null,'--check');assert.ok(!r.error);assert.equal(r.journal,null);assert.ok(r.m.calls.every(c=>c.method==='GET'));assert.equal(r.m.signup,0);});
test('both anonymous customers complete scenarios and full cleanup',async()=>{const r=await exercise();assert.ok(!r.error,r.error?.message);assert.equal(r.m.signup,2);assert.equal(r.m.users.size,0);assert.equal(r.m.rows.size,0);assert.equal(r.journal.scenarios_passed,true);assert.equal(r.journal.cleanup_complete,true);assert.equal(r.journal.projects.length,5);});
for(const fault of ['target','disabled','expired','not-anonymous','duplicate','leak','silent-write','false-insert','auth-denial','protocol','unknown-signup','cleanup','owner-drift','stale-revision'])test(`fail closed: ${fault}`,async()=>{
 const r=await exercise(fault);assert.ok(r.error,`fault must fail: ${fault}`);
 if(['target','disabled'].includes(fault))assert.equal(r.m.signup,0);
 if(['leak','silent-write','false-insert','auth-denial','protocol'].includes(fault)){assert.equal(r.m.rows.size,0);assert.equal(r.journal.cleanup_complete,true);assert.notEqual(r.journal.scenarios_passed,true);}
 if(fault==='unknown-signup')assert.equal(r.journal.cleanup_complete,false);
 if(fault==='cleanup'){
  assert.equal(r.journal.cleanup_complete,false);
 }
 if(fault==='owner-drift'){assert.equal(r.journal.cleanup_complete,false);assert.equal(r.m.users.size,2);assert.ok(r.m.rows.size>0);}
});
test('cleanup retry needs no user tokens and removes only tracked test data',async()=>{
 const r=await exercise('cleanup');assert.ok(r.error);assert.ok(r.m.rows.size>0);r.m.clearFault();
 process.chdir(r.cwd);
 try{await runCustomers({mode:'--cleanup',env:{...r.env,BATH_CUSTOMER_RLS_JOURNAL:r.journalFile},fetcher:r.m.fetcher,log:()=>{}});}
 finally{process.chdir(original);}
 assert.equal(r.m.rows.size,0);assert.equal(r.m.users.size,0);
 assert.equal(JSON.parse(readFileSync(r.journalFile,'utf8')).cleanup_complete,true);
});
for(const fault of ['header-only','both-codes','legacy-numeric'])test(`Auth compatibility: ${fault} across check/run/cleanup`,async()=>{
 const check=await exercise(fault,'--check');assert.ok(!check.error);assert.ok(check.m.calls.every(c=>c.method==='GET'));
 const run=await exercise(fault);assert.ok(!run.error,run.error?.message);assert.equal(run.m.users.size,0);assert.equal(run.m.rows.size,0);
});
test('Auth body-only compatibility',async()=>{const r=await exercise(null,'--check');assert.ok(!r.error);});
for(const fault of ['wrong-404','missing-code','conflict','header-401','header-403','auth-network','legacy-wrong-status','legacy-no-header'])test(`reject Auth response: ${fault}`,async()=>{
 const r=await exercise(fault,'--check');assert.ok(r.error);assert.equal(r.m.signup,0);assert.equal(r.journal,null);assert.ok(r.m.calls.every(c=>c.method==='GET'));
});
test('Auth normalization rejects malformed or conflicting codes in either direction',()=>{
 assert.equal(authErrorCode({code:'user_not_found'},new Headers()),'user_not_found');
 assert.equal(authErrorCode({},new Headers({'X-SB-ERROR-CODE':'user_not_found'})),'user_not_found');
 assert.equal(authErrorCode({},new Headers()),undefined);
 for(const [body,header] of [[{code:'bad_jwt'},'user_not_found'],[{code:null},'user_not_found'],[{code:404},'user_not_found'],[{code:''},undefined],[{},'user_not_found, bad_jwt']]){
  assert.throws(()=>authErrorCode(body,new Headers(header===undefined?{}:{'x-sb-error-code':header})));
 }
});
