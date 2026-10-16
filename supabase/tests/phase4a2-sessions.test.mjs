// Offline only: every fetch is replaced; child env does not inherit real secrets.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const script=resolve('supabase/tests/phase4a2-sessions.mjs');
mkdirSync('tests/artifacts',{recursive:true});
const root=mkdtempSync(resolve('tests/artifacts/phase4a2-offline-'));
const preload=resolve(root,'mock.mjs');
writeFileSync(preload,String.raw`
import { randomUUID } from 'node:crypto';
import { existsSync,readFileSync,writeFileSync } from 'node:fs';
const ref='istsrambmbzuemkgutgh',url='https://'+ref+'.supabase.co',fault=process.env.FAULT;
const users={};let mutations=0;const methods=[];
const privateFile='tests/artifacts/phase4a2/sessions.json';
if(existsSync(privateFile)) {const s=JSON.parse(readFileSync(privateFile));for(const [a,u] of Object.entries(s.users))users[u.id]={id:u.id,is_anonymous:a.startsWith('CUSTOMER_'),email:process.env['BATH_TEST_'+a+'_EMAIL'],email_confirmed_at:'2026-10-16',app_metadata:{bath_rls_fixture:s.fixture_id}};}
process.on('exit',()=>writeFileSync('calls.json',JSON.stringify({mutations,methods})));
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
function session(u) {return {user:u,access_token:'e30.'+Buffer.from(JSON.stringify({iss:url+'/auth/v1',sub:u.id,role:'authenticated',is_anonymous:u.is_anonymous,exp:fault==='expired'?0:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.mock',refresh_token:'PRIVATE_REFRESH_'+u.id};}
globalThis.fetch=async (uri,opts={})=>{
 const p=new URL(uri).pathname,method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):{};methods.push(method);if(method!=='GET')mutations++;
 if(new URL(uri).hostname==='api.supabase.com')return response({id:ref,name:fault==='target'?'production':'bath-designer-dev',status:'ACTIVE_HEALTHY',database:{host:'db.'+ref+'.supabase.co'}});
 if(p==='/auth/v1/settings')return response({external:{anonymous_users:fault!=='disabled',email:true},mailer_autoconfirm:false,disable_signup:false});
 if(p.startsWith('/rest/v1/'))return response([]);
 if(p==='/auth/v1/signup'){if(fault==='network')throw Error('PRIVATE_DO_NOT_LOG');const id=fault==='duplicate'&&Object.keys(users).length?Object.keys(users)[0]:randomUUID();const u={id,is_anonymous:true,app_metadata:{}};users[id]=u;return response(session(u));}
 if(p==='/auth/v1/admin/users'&&method==='POST'){const u={id:randomUUID(),email:body.email,email_confirmed_at:'2026-10-16',is_anonymous:false,app_metadata:body.app_metadata};users[u.id]=u;return response(u);}
 if(p.startsWith('/auth/v1/admin/users/')) {const u=users[p.split('/').at(-1)];if(method==='PUT')u.app_metadata=body.app_metadata;return response(u);}
 if(p==='/auth/v1/token'){const u=body.email?Object.values(users).find(u=>u.email===body.email):users[body.refresh_token.slice('PRIVATE_REFRESH_'.length)];return response(session(u));}
 if(p==='/auth/v1/user'){const c=JSON.parse(Buffer.from(opts.headers.Authorization.slice(7).split('.')[1],'base64url'));const u=users[c.sub];return response(fault==='unconfirmed'&&!u.is_anonymous?{...u,email_confirmed_at:null}:u);}
 throw Error('Unexpected mocked request');
};
`);
const actors=['BUSINESS_A','BUSINESS_B','GENERAL','PENDING'];
function run(fault,mode,cwd) {
  const env={SystemRoot:process.env.SystemRoot,FAULT:fault,BATH_TEST_SUPABASE_URL:'https://istsrambmbzuemkgutgh.supabase.co',BATH_RLS_TEST_CONFIRM:'bath-designer-dev',BATH_TEST_PUBLISHABLE_KEY:'sb_publishable_mock',BATH_TEST_ADMIN_KEY:'sb_secret_PRIVATE_ADMIN',BATH_TEST_MANAGEMENT_TOKEN:'PRIVATE_MANAGEMENT',BATH_TEST_EMAILS_CONFIRM:'owned-dedicated-test-addresses',BATH_TEST_ACCOUNT_CONFIRM:'create-six-dedicated-users',BATH_TEST_SECRET_STORAGE_CONFIRM:'private-acl-verified'};
  for(const a of actors) {env[`BATH_TEST_${a}_EMAIL`]=`${a.toLowerCase()}@offline.invalid`;env[`BATH_TEST_${a}_PASSWORD`]='PRIVATE_PASSWORD_123';}
  if(fault==='emails')env.BATH_TEST_GENERAL_EMAIL=env.BATH_TEST_PENDING_EMAIL;
  const r=spawnSync(process.execPath,['--import',pathToFileURL(preload).href,script,mode],{cwd,env,encoding:'utf8'});
  assert.ok(!r.error,`Offline child launch failed: ${r.error?.code}`);
  assert.ok(r.stdout!==null && r.stderr!==null,'Offline child did not start');
  assert.ok(!`${r.stdout}${r.stderr}`.includes('PRIVATE_'),'Secret leaked to output');
  assert.ok(existsSync(resolve(cwd,'calls.json')),`Mock preload did not initialize: ${r.stderr}`);
  return {...r,calls:JSON.parse(readFileSync(resolve(cwd,'calls.json')))};
}
for(const fault of ['none','target','disabled','emails','duplicate','expired','unconfirmed','network']) {
  const cwd=resolve(root,fault);mkdirSync(resolve(cwd,'tests/artifacts/phase4a2'),{recursive:true});
  const check=run(fault,'--check',cwd);
  assert.equal(check.calls.mutations,0,'--check must be GET-only');
  if(['target','disabled','emails'].includes(fault))assert.notEqual(check.status,0);
  const create=run(fault,'--create',cwd);
  if(fault==='none') {
    assert.equal(create.status,0,create.stderr);
    const m=JSON.parse(readFileSync(resolve(cwd,'tests/artifacts/phase4a2/fixture.json')));
    assert.equal(new Set(Object.values(m.users)).size,6);
    const exported=readFileSync(resolve(cwd,'tests/artifacts/phase4a2/.env.sessions.local'),'utf8');
    assert.equal(exported.trim().split('\n').length,11);
    const names=exported.trim().split('\n').map(line=>line.split('=')[0]);
    assert.deepEqual([...names,'BATH_TEST_ADMIN_KEY','BATH_TEST_MANAGEMENT_TOKEN'].sort(),[
      'BATH_TEST_SUPABASE_URL','BATH_RLS_TEST_CONFIRM','BATH_TEST_PUBLISHABLE_KEY','BATH_TEST_ADMIN_KEY','BATH_TEST_MANAGEMENT_TOKEN',
      'BATH_TEST_FIXTURE_FILE','BATH_TEST_JOURNAL',...['CUSTOMER_A','CUSTOMER_B',...actors].map(a=>`BATH_TEST_${a}_TOKEN`)].sort());
    for(const secret of ['PRIVATE_PASSWORD','PRIVATE_ADMIN','PRIVATE_MANAGEMENT'])assert.ok(!exported.includes(secret));
    const again=run(fault,'--create',cwd);assert.notEqual(again.status,0);assert.equal(again.calls.mutations,0);
    const refresh=run(fault,'--refresh',cwd);assert.equal(refresh.status,0,refresh.stderr);
  } else {
    assert.notEqual(create.status,0,`Must reject ${fault}`);
    if(['target','disabled','emails'].includes(fault))assert.equal(create.calls.mutations,0);
    else {const partial=JSON.parse(readFileSync(resolve(cwd,'tests/artifacts/phase4a2/sessions.json')));assert.equal(partial.complete,false);assert.ok(partial.pending);}
  }
  console.log(`PASS offline sessions: ${fault}`);
}
