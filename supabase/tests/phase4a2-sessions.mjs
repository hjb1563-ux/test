// Operator-only Node >=20. Default --check is GET-only. Never import into UI.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
const REF = 'istsrambmbzuemkgutgh', URL = `https://${REF}.supabase.co`;
const actors = ['CUSTOMER_A','CUSTOMER_B','BUSINESS_A','BUSINESS_B','GENERAL','PENDING'];
const emailActors = actors.slice(2);
const folder = resolve('tests/artifacts/phase4a2');
const stateFile = resolve(folder,'sessions.json');
const fixtureFile = resolve(folder,'fixture.json');
const outputFile = resolve(folder,'.env.sessions.local');
class SafetyError extends Error {}
function need(test, message) { if (!test) throw new SafetyError(message); }
function env(n) { need(process.env[n], `CONFIG missing ${n}`); return process.env[n]; }
function uuid(v) { need(typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v),'Invalid dedicated UUID v4'); }
function claims(t) { try { return JSON.parse(Buffer.from(t.split('.')[1],'base64url')); } catch { throw new SafetyError('Invalid token encoding'); } }
function atomic(file, data) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  writeFileSync(tmp,data,{flag:'wx',mode:0o600,flush:true}); renameSync(tmp,file);
}
let state, changed = false, lockHeld = false;
function save() { atomic(stateFile,JSON.stringify(state,null,2)); }
async function main() {
  const mode = process.argv[2] || '--check';
  need(['--check','--create','--refresh'].includes(mode),'Use --check, --create or --refresh');
  need(env('BATH_TEST_SUPABASE_URL') === URL,'Development URL mismatch');
  need(env('BATH_RLS_TEST_CONFIRM') === 'bath-designer-dev','Development confirmation mismatch');
  need(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0','TLS verification must remain enabled');
  const key=env('BATH_TEST_PUBLISHABLE_KEY'), admin=env('BATH_TEST_ADMIN_KEY');
  need(key.startsWith('sb_publishable_') || (claims(key).role==='anon' && claims(key).ref===REF),'Public/anon key required');
  need(admin.startsWith('sb_secret_') || (claims(admin).role==='service_role' && claims(admin).ref===REF),'Server admin key required');
  const management = env('BATH_TEST_MANAGEMENT_TOKEN');
  async function request(url, headers, method='GET', body) {
    let r, data;
    try {
      r=await fetch(url,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
      data=await r.json();
    } catch { throw new SafetyError('NETWORK/PROTOCOL: outcome unknown; inspect private state before retry'); }
    // Never echo response bodies, passwords, keys, tokens, or user emails.
    need(r.ok,`AUTH/API failure HTTP ${r.status}; not an RLS result`);
    return data;
  }
  const headers = (privileged=false, token) => ({apikey:privileged?admin:key,'Content-Type':'application/json',
    ...(token?{Authorization:`Bearer ${token}`} : privileged&&!admin.startsWith('sb_secret_')?{Authorization:`Bearer ${admin}`}:{})});
  const auth = (p,method='GET',body,privileged=false,token) => request(URL+'/auth/v1'+p,headers(privileged,token),method,body);
  const project = await request(`https://api.supabase.com/v1/projects/${REF}`,{Authorization:`Bearer ${management}`});
  need(project.id===REF && project.name==='bath-designer-dev' && project.database?.host===`db.${REF}.supabase.co` && project.status==='ACTIVE_HEALTHY','Unverified target project');
  const settings = await auth('/settings');
  need(settings.external?.anonymous_users===true,'Anonymous Auth disabled: enable in development Dashboard first');
  need(settings.external?.email===true,'Email Auth disabled');
  need(settings.mailer_autoconfirm===false,'Email confirmation setting changed; review before continuing');
  need(settings.disable_signup===false,'Signup disabled');
  for (const table of ['projects','businesses','business_members']) {
    const rows = await request(`${URL}/rest/v1/${table}?select=id&limit=1`,headers(true));
    need(Array.isArray(rows),'Admin Data API SELECT unavailable');
  }
  // User-owned addresses only. No synthetic addresses or automatic customer reuse.
  need(env('BATH_TEST_EMAILS_CONFIRM')==='owned-dedicated-test-addresses','Confirm dedicated, operator-controlled email addresses');
  const emails = emailActors.map(a=>env(`BATH_TEST_${a}_EMAIL`).trim().toLowerCase());
  need(emails.every(e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) && new Set(emails).size===4,'Four distinct controlled email addresses required');
  for (const a of emailActors) need(env(`BATH_TEST_${a}_PASSWORD`).length>=12,`Dedicated password too short for ${a}`);
  if (mode==='--check') {
    console.log('CHECK PASS: target, Auth settings, admin SELECT, distinct email inputs; no accounts or sessions created'); return;
  }
  need(env('BATH_TEST_SECRET_STORAGE_CONFIRM')==='private-acl-verified','Private directory ACL must be verified first');
  need(existsSync(folder),'Create and protect tests/artifacts/phase4a2 before storing secrets');
  const lock=openSync(resolve(folder,'preparation.lock'),'wx',0o600);closeSync(lock);lockHeld=true;
  if (mode==='--create') {
    need(env('BATH_TEST_ACCOUNT_CONFIRM')==='create-six-dedicated-users','Explicit account creation confirmation required');
    need(!existsSync(stateFile)&&!existsSync(fixtureFile)&&!existsSync(outputFile),'Existing state: do not recreate; inspect or use --refresh');
    const fd=openSync(stateFile,'wx',0o600);closeSync(fd);
    state={project_ref:REF,fixture_id:randomUUID(),created_at:new Date().toISOString(),users:{},pending:null,complete:false}; save();
  } else {
    state=JSON.parse(readFileSync(stateFile,'utf8'));
    need(state.project_ref===REF && state.complete===true && state.pending===null,'Incomplete/ambiguous state requires operator recovery, not recreation');
    uuid(state.fixture_id);
    need(actors.every(a=>state.users[a]?.id),'Missing account state');
    need(new Set(actors.map(a=>state.users[a].id)).size===6,'Duplicate user IDs');
  }
  async function rememberSession(a,s) {
    need(s?.user?.id && s.access_token && s.refresh_token,'Session response missing required fields');
    uuid(s.user.id);
    const record=state.users[a];
    need(!record.id || record.id===s.user.id,'Session user mismatch');
    record.id=s.user.id; record.access_token=s.access_token;record.refresh_token=s.refresh_token;
    save(); // Keep rotating tokens before performing subsequent validation calls.
  }
  async function validate(a) {
    const rec=state.users[a], c=claims(rec.access_token), anonymous=a.startsWith('CUSTOMER_');
    need(c.iss===`${URL}/auth/v1` && c.sub===rec.id && c.role==='authenticated','Invalid user token identity');
    need(c.exp>Date.now()/1000+60,'Expired/expiring token');need(c.is_anonymous===anonymous,'Unexpected token auth type');
    const user=await auth('/user','GET',undefined,false,rec.access_token);
    const data=await auth(`/admin/users/${rec.id}`,'GET',undefined,true);const trusted=data.user||data;
    need(user.id===rec.id && user.is_anonymous===anonymous && trusted.id===rec.id,'Auth user verification failed');
    need(trusted.app_metadata?.bath_rls_fixture===state.fixture_id,'Dedicated trusted account marker missing');
    if (!anonymous) {
      need(user.email?.toLowerCase()===env(`BATH_TEST_${a}_EMAIL`).trim().toLowerCase(),'Email identity mismatch');
      need(Boolean(user.email_confirmed_at),'Email identity is not confirmed');
    }
  }
  // signInAnonymously uses the same GoTrue signup request as the SDK. No JWT fabrication.
  async function signInAnonymously(actor) {
    return auth('/signup','POST',{data:{bath_rls_attempt:state.fixture_id,bath_rls_actor:actor}});
  }
  for (const a of actors) {
    const anonymous=a.startsWith('CUSTOMER_');
    if (mode==='--create') {
      state.users[a]={id:null};state.pending={actor:a,operation:anonymous?'anonymous-signup':'admin-create-email'};save();changed=true;
      if (anonymous) {
        await rememberSession(a,await signInAnonymously(a));
        // user_metadata above is a recovery hint only; admin app_metadata is authoritative.
        state.pending={actor:a,operation:'trusted-marker'};save();
        await auth(`/admin/users/${state.users[a].id}`,'PUT',{app_metadata:{bath_rls_fixture:state.fixture_id}},true);
      } else {
        const data=await auth('/admin/users','POST',{email:env(`BATH_TEST_${a}_EMAIL`).trim(),password:env(`BATH_TEST_${a}_PASSWORD`),email_confirm:true,app_metadata:{bath_rls_fixture:state.fixture_id}},true);
        const user=data.user||data;uuid(user.id);state.users[a].id=user.id;save();
      }
    } else {
      // Validate trusted identity BEFORE any refresh or password login.
      const data=await auth(`/admin/users/${state.users[a].id}`,'GET',undefined,true);const user=data.user||data;
      need(user.id===state.users[a].id && user.app_metadata?.bath_rls_fixture===state.fixture_id && user.is_anonymous===anonymous,'Existing dedicated identity mismatch');
    }
    if (!anonymous || mode==='--refresh') {
      state.pending={actor:a,operation:anonymous?'refresh-token':'password-login'};save();changed=true;
      const s=anonymous?await auth('/token?grant_type=refresh_token','POST',{refresh_token:state.users[a].refresh_token})
        :await auth('/token?grant_type=password','POST',{email:env(`BATH_TEST_${a}_EMAIL`).trim(),password:env(`BATH_TEST_${a}_PASSWORD`)});
      await rememberSession(a,s);
    }
    await validate(a);
    const ids=Object.values(state.users).map(u=>u.id).filter(Boolean);
    need(new Set(ids).size===ids.length,'Duplicate user IDs');
    state.pending=null;save();
  }
  need(new Set(actors.map(a=>state.users[a].id)).size===6,'Six distinct users required');
  // Revalidate every session before exporting; earlier tokens may have expired.
  for (const a of actors) await validate(a);
  let manifest;
  if (mode==='--create') {
    manifest={project_ref:REF,fixture_id:state.fixture_id,users:Object.fromEntries(actors.map(a=>[a,state.users[a].id])),businesses:{},members:{}};
    for (const n of ['A','B','SUSPENDED']) manifest.businesses[n]=randomUUID();
    for (const n of ['A','B','PENDING','ANONYMOUS','SUSPENDED','REVOKED']) manifest.members[n]=randomUUID();
    const ids=[manifest.fixture_id,...Object.values(manifest.users),...Object.values(manifest.businesses),...Object.values(manifest.members)];
    ids.forEach(uuid);need(new Set(ids).size===ids.length,'Manifest UUID collision');
    atomic(fixtureFile,JSON.stringify(manifest,null,2));
  } else {
    manifest=JSON.parse(readFileSync(fixtureFile,'utf8'));
    need(manifest.project_ref===REF && manifest.fixture_id===state.fixture_id && actors.every(a=>manifest.users[a]===state.users[a].id),'Manifest mismatch');
  }
  const exported={BATH_TEST_SUPABASE_URL:URL,BATH_RLS_TEST_CONFIRM:'bath-designer-dev',BATH_TEST_PUBLISHABLE_KEY:key,
    BATH_TEST_FIXTURE_FILE:'tests/artifacts/phase4a2/fixture.json',BATH_TEST_JOURNAL:`tests/artifacts/phase2-run-${randomUUID()}.json`,
    ...Object.fromEntries(actors.map(a=>[`BATH_TEST_${a}_TOKEN`,state.users[a].access_token]))};
  need(Object.values(exported).every(v=>!/[\r\n"']/.test(v)),'Unsafe export value');
  atomic(outputFile,Object.entries(exported).map(([k,v])=>`${k}="${v}"`).join('\n')+'\n');
  state.complete=true;save();
  console.log('SESSION PREPARATION PASS: 6 verified users; private manifest/session files written; no DB Fixture created');
}
main().catch(error=>{
  console.error(error instanceof SafetyError?error.message:'Local preparation error; details suppressed to protect credentials');
  if (changed) console.error('Partial remote Auth changes may exist. Preserve private sessions.json and pending operation; do not rerun --create or delete users automatically.');
  process.exitCode=1;
}).finally(()=>{ if (lockHeld) unlinkSync(resolve(folder,'preparation.lock')); });
