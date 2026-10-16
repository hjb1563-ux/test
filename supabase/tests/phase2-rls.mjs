// Node >=20; operator-only. Default is read-only preflight. Never import into UI.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const REF = 'istsrambmbzuemkgutgh', URL = `https://${REF}.supabase.co`;
const actors = ['CUSTOMER_A','CUSTOMER_B','BUSINESS_A','BUSINESS_B','GENERAL','PENDING'];
const env = n => { assert.ok(process.env[n], `CONFIG: missing ${n}`); return process.env[n]; };
const uuid = v => assert.match(v, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const claims = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
const equal = (a,b) => { try { assert.deepEqual(a,b); return true; } catch { return false; } };
const mode = process.argv[2] || '--preflight';
assert.ok(['--preflight','--run','--cleanup'].includes(mode));
assert.equal(env('BATH_TEST_SUPABASE_URL'), URL);
assert.equal(env('BATH_RLS_TEST_CONFIRM'), 'bath-designer-dev');
const key = env('BATH_TEST_PUBLISHABLE_KEY'), admin = env('BATH_TEST_ADMIN_KEY');
assert.ok(key.startsWith('sb_publishable_') || (claims(key).role === 'anon' && claims(key).ref === REF));
assert.ok(admin.startsWith('sb_secret_') || (claims(admin).role === 'service_role' && claims(admin).ref === REF));
const m = JSON.parse(readFileSync(env('BATH_TEST_FIXTURE_FILE'),'utf8'));
assert.equal(m.project_ref, REF); uuid(m.fixture_id);
assert.deepEqual(Object.keys(m.users).sort(), [...actors].sort());
const bs = ['A','B','SUSPENDED'].map(n => ({id:m.businesses[n], business_name:`BATH-RLS:${m.fixture_id}:${n}`, status:n === 'SUSPENDED' ? 'suspended' : 'approved'}));
const specs = [['A','A','BUSINESS_A','approved'],['B','B','BUSINESS_B','approved'],['PENDING','A','PENDING','pending'],['ANONYMOUS','A','CUSTOMER_A','approved'],['SUSPENDED','SUSPENDED','BUSINESS_A','approved'],['REVOKED','A','BUSINESS_B','revoked']];
const ms = specs.map(([n,b,u,status]) => ({id:m.members[n],business_id:m.businesses[b],user_id:m.users[u],role:'member',status}));
const allIds = [m.fixture_id,...Object.values(m.users),...bs.map(x=>x.id),...ms.map(x=>x.id)];
allIds.forEach(uuid); assert.equal(new Set(allIds).size, allIds.length);
const tokens = {};
async function http(url, headers, method='GET', body) {
  let r;
  try { r = await fetch(url,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),...(body === undefined ? {} : {body:JSON.stringify(body)})}); }
  catch { throw Error('NETWORK: unknown request outcome; consult journal'); }
  let data;
  try { const t = await r.text(); data = t ? JSON.parse(t) : null; }
  catch { throw Error('PROTOCOL: invalid JSON response'); }
  return {ok:r.ok,status:r.status,data};
}
async function api(actor,path,method='GET',body) {
  return http(URL+path,{apikey:actor === 'ADMIN' ? admin : key,'Content-Type':'application/json',Prefer:'return=representation',
    ...(actor === 'ADMIN' ? (admin.startsWith('sb_secret_') ? {} : {Authorization:`Bearer ${admin}`}) : actor === 'ANON' ? {} : {Authorization:`Bearer ${tokens[actor]}`})},method,body);
}
function ok(r,context) { assert.ok(r.ok,`${context}: HTTP ${r.status}, code ${r.data?.code || 'unknown'}; NOT a security pass`); return r.data; }
const path = (t,id) => `/rest/v1/${t}${id ? `?id=eq.${id}` : ''}`;
async function rows(a,t,id) { const r = ok(await api(a,path(t,id)),`${a} SELECT ${t}`); assert.ok(Array.isArray(r)); return r; }
async function one(t,id) { const r = await rows('ADMIN',t,id); assert.ok(r.length <= 1); return r[0] || null; }
async function session(a) {
  const c = claims(tokens[a]), anonymous = a.startsWith('CUSTOMER_');
  assert.equal(c.iss,`${URL}/auth/v1`); assert.equal(c.sub,m.users[a]); assert.equal(c.role,'authenticated');
  assert.ok(c.exp > Date.now()/1000+60,'AUTH: expired/expiring session'); assert.equal(c.is_anonymous,anonymous);
  const u = ok(await api(a,'/auth/v1/user'),`AUTH ${a}`);
  assert.equal(u.id,m.users[a]); assert.equal(u.is_anonymous,anonymous);
}
// Exact HTTPS origins with redirects disabled + live control-plane identity + live
// Auth/Data API checks. No trust in variable names, custom URLs or local links.
const target = ok(await http(`https://api.supabase.com/v1/projects/${REF}`,{Authorization:`Bearer ${env('BATH_TEST_MANAGEMENT_TOKEN')}`}), 'TARGET verification');
assert.equal(target.id,REF); assert.equal(target.name,'bath-designer-dev');
assert.equal(target.database?.host,`db.${REF}.supabase.co`); assert.equal(target.status,'ACTIVE_HEALTHY');
for (const a of actors) {
  const data = ok(await api('ADMIN',`/auth/v1/admin/users/${m.users[a]}`),'FIXTURE Auth');
  const u = data.user || data;
  assert.equal(u.id,m.users[a]); assert.equal(u.app_metadata?.bath_rls_fixture,m.fixture_id,'FIXTURE: dedicated account attestation required');
  assert.equal(u.is_anonymous,a.startsWith('CUSTOMER_'));
  if (mode !== '--cleanup') { tokens[a] = env(`BATH_TEST_${a}_TOKEN`); await session(a); }
}
for (const b of bs) {
  const actual = await one('businesses',b.id); assert.ok(actual,'FIXTURE: missing business');
  for (const k of Object.keys(b)) assert.equal(actual[k],b[k]);
}
if (mode !== '--cleanup') {
  const actual = ok(await api('ADMIN',`/rest/v1/business_members?user_id=in.(${Object.values(m.users).join(',')})`),'FIXTURE memberships');
  const pick = r => Object.fromEntries(Object.keys(ms[0]).map(k=>[k,r[k]]));
  const sort = r => r.sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(sort(actual.map(pick)),sort([...ms]),'FIXTURE: unexpected membership graph');
  const existing = ok(await api('ADMIN',`/rest/v1/projects?select=id&owner_user_id=in.(${Object.values(m.users).join(',')})`),'FIXTURE projects');
  assert.deepEqual(existing,[],'FIXTURE: accounts must have no existing projects; clean the previous journal first');
}
await rows('ADMIN','projects',randomUUID());
if (mode === '--preflight') { console.log('PREFLIGHT PASS (no writes)'); process.exit(0); }

mkdirSync(resolve('tests/artifacts'),{recursive:true});
const file = resolve(env('BATH_TEST_JOURNAL'));
assert.equal(dirname(file),resolve('tests/artifacts'),'Journal must be inside ignored tests/artifacts');
let journal;
if (mode === '--cleanup') {
  journal = JSON.parse(readFileSync(file,'utf8'));
  assert.equal(journal.project_ref,REF); assert.equal(journal.fixture_id,m.fixture_id); uuid(journal.run_id);
} else {
  const fd = openSync(file,'wx',0o600); closeSync(fd);
  journal = {project_ref:REF,fixture_id:m.fixture_id,run_id:randomUUID(),entries:[],complete:false};
}
const save = () => {
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary,JSON.stringify(journal,null,2),{mode:0o600,flush:true,flag:'wx'});
  renameSync(temporary,file); // Keep the previous complete journal if interrupted during write.
};
save();
async function track(t,body) {
  uuid(body.id); assert.equal(await one(t,body.id),null,'Generated ID collision');
  journal.entries.push({table:t,id:body.id,action:'delete',intended:body}); save();
}
async function snapshot(t,id) {
  const before = await one(t,id); assert.ok(before,'FIXTURE: target missing');
  journal.entries.push({table:t,id,action:'restore',before}); save();
}
async function blocked(a,t,id,method,body,layer='RLS') {
  if (a !== 'ANON') await session(a);
  const before = await one(t,id);
  // POST goes to the collection; all other requests have a single UUID filter.
  const r = await api(a,path(t,method === 'POST' ? undefined : id),method,body);
  journal.observations ??= [];
  journal.observations.push({actor:a,table:t,id,method,status:r.status,code:r.data?.code,
    returned_ids:Array.isArray(r.data) ? r.data.map(x=>x.id) : []}); save();
  assert.deepEqual(await one(t,id),before,`SECURITY: unexpected ${method} changed ${t}/${id}`);
  let category;
  if (r.ok) {
    assert.equal(layer,'RLS','Expected GRANT rejection, not silent row filtering');
    assert.ok(Array.isArray(r.data) && r.data.length === 0,'SECURITY: unexpected access');
    category = method === 'GET' ? 'EMPTY_SELECT' : 'ZERO_AFFECTED_UNCHANGED';
    assert.notEqual(method,'POST','SECURITY: INSERT request unexpectedly succeeded');
  } else {
    assert.equal(r.data?.code,'42501',`AUTH/PROTOCOL/FIXTURE: HTTP ${r.status}, code ${r.data?.code}; not a denial pass`);
    const message = r.data.message || '';
    category = /row-level security/i.test(message) ? 'RLS' : /permission denied for (table|column|schema)/i.test(message) ? 'GRANT' : 'UNCLASSIFIED';
    assert.equal(category,layer,'Unexpected denial layer');
  }
  if (a !== 'ANON') await session(a);
  console.log(`PASS ${a} ${method} ${t}: ${category}`);
}
async function insertProbe(a,t,body,layer) { await track(t,body); await blocked(a,t,body.id,'POST',body,layer); }
async function cleanup() {
  const errors = [];
  for (const e of [...journal.entries].reverse()) {
    try {
      uuid(e.id); assert.ok(['projects','businesses','business_members'].includes(e.table));
      const current = await one(e.table,e.id);
      if (e.action === 'delete') {
        assert.equal(e.intended.id,e.id); assert.ok(!allIds.includes(e.id),'Never delete baseline fixture');
        if (e.table === 'projects') {
          assert.equal(e.intended.project_info?.projectName,`BATH-RLS:${journal.run_id}`);
          assert.ok(Object.values(m.users).includes(e.intended.owner_user_id));
          if (current) assert.equal(current.project_info?.projectName,e.intended.project_info.projectName);
        } else if (e.table === 'businesses') {
          assert.equal(e.intended.business_name,`BATH-RLS:${journal.run_id}`);
          if (current) assert.equal(current.business_name,e.intended.business_name);
        } else {
          assert.ok(bs.some(b=>b.id === e.intended.business_id)); assert.ok(Object.values(m.users).includes(e.intended.user_id));
          if (current) for (const k of ['business_id','user_id']) assert.equal(current[k],e.intended[k]);
        }
        if (current) ok(await api('ADMIN',path(e.table,e.id),'DELETE'),'CLEANUP delete');
        assert.equal(await one(e.table,e.id),null,'CLEANUP: row remains');
      } else {
        assert.equal(e.action,'restore');
        // Retrying an already completed cleanup must tolerate its deleted run project.
        if (!current && e.table === 'projects' && journal.entries.some(x=>x.table === 'projects' && x.id === e.id && x.action === 'delete' && x.intended.project_info?.projectName === `BATH-RLS:${journal.run_id}`)) {
          e.cleaned = true; delete e.error; save(); continue;
        }
        assert.ok(current,'CLEANUP: deleted fixture needs manual recreation');
        assert.equal(e.before.id,e.id);
        let fields, identityFields;
        if (e.table === 'business_members') {
          const baseline = ms.find(r=>r.id === e.id); assert.ok(baseline);
          for (const k of Object.keys(baseline)) assert.equal(e.before[k],baseline[k]);
          identityFields = ['id','business_id','user_id','created_at'];
          fields = ['role','status'];
        } else {
          assert.equal(e.table,'projects');
          assert.ok(journal.entries.some(x=>x.action === 'delete' && x.table === 'projects' && x.id === e.id));
          // Revision/updated_at are trigger-managed and intentionally never rewound.
          identityFields = ['id','owner_user_id','created_at'];
          fields = ['project_info','builder_mode','selections','consultation_memo','special_notes','current_step','consultation_checks','image_history_order','content_modified_at','schema_version'];
        }
        // Identity drift requires manual review, never broader UPDATE privileges.
        for (const k of identityFields) assert.deepEqual(current[k],e.before[k],`CLEANUP identity drift ${k}; manual recovery required`);
        const patch = Object.fromEntries(fields.filter(k=>!equal(current[k],e.before[k])).map(k=>[k,e.before[k]]));
        if (Object.keys(patch).length) ok(await api('ADMIN',path(e.table,e.id),'PATCH',patch),'CLEANUP restore');
        const restored = await one(e.table,e.id);
        for (const k of fields) assert.deepEqual(restored?.[k],e.before[k],`CLEANUP restore ${k}`);
        for (const k of identityFields) assert.deepEqual(restored?.[k],e.before[k],`CLEANUP identity drift ${k}; manual recovery required`);
      }
      e.cleaned = true; delete e.error;
    } catch (error) { e.error = error.message; errors.push({table:e.table,id:e.id,run_id:journal.run_id,reason:error.message}); }
    save();
  }
  journal.complete = errors.length === 0; save();
  if (errors.length) { console.error('CLEANUP_FAILED: manual action required',JSON.stringify(errors)); process.exitCode = 1; }
  return errors.length === 0;
}
let failed = false;
try {
  if (mode === '--run') {
    const project = () => ({id:randomUUID(),owner_user_id:m.users.CUSTOMER_A,project_info:{builderMode:'consumer',projectName:`BATH-RLS:${journal.run_id}`},selections:{waterproofing:'combined-waterproofing',showerFaucet:['rain'],accessoryOther:'선반'}});
    const p = project(); await track('projects',p);
    const inserted = ok(await api('CUSTOMER_A',path('projects'),'POST',p),'Positive INSERT');
    assert.equal(inserted.length,1); assert.equal(inserted[0].owner_user_id,m.users.CUSTOMER_A);
    assert.equal((await rows('CUSTOMER_A','projects',p.id)).length,1); // Original #1
    const own = (await rows('CUSTOMER_A','projects',p.id))[0];
    const updated = ok(await api('CUSTOMER_A',`${path('projects',p.id)}&revision=eq.${own.revision}`,'PATCH',{builder_mode:'professional',project_info:{...p.project_info,builderMode:'professional'}}),'Positive UPDATE');
    assert.equal(updated.length,1); assert.equal(updated[0].revision,own.revision+1); assert.deepEqual(updated[0].selections,p.selections);
    assert.equal((await rows('CUSTOMER_A','projects',p.id))[0].builder_mode,'professional');
    await snapshot('projects',p.id);
    await blocked('CUSTOMER_B','projects',p.id,'GET'); // #2
    await blocked('CUSTOMER_B','projects',p.id,'PATCH',{consultation_memo:'attack'}); // #3
    await blocked('CUSTOMER_B','projects',p.id,'DELETE'); // #4: only THIS run's disposable row
    for (const a of ['CUSTOMER_A','CUSTOMER_B']) await blocked(a,'projects',p.id,'PATCH',{owner_user_id:m.users.CUSTOMER_B},'GRANT'); // #5
    await insertProbe('CUSTOMER_B','projects',project(),'RLS');
    for (const [method,body] of [['GET'],['PATCH',{consultation_memo:'anon'}],['DELETE']]) await blocked('ANON','projects',p.id,method,body,'GRANT');
    for (const a of ['BUSINESS_A','BUSINESS_B']) {
      assert.equal((await rows(a,'businesses',m.businesses[a.at(-1)])).length,1); // #6
      assert.equal((await rows(a,'business_members',m.members[a.at(-1)])).length,1);
    }
    await blocked('BUSINESS_B','businesses',m.businesses.A,'GET'); // #7
    await blocked('BUSINESS_B','business_members',m.members.A,'GET');
    await blocked('BUSINESS_A','businesses',m.businesses.SUSPENDED,'GET');
    await blocked('BUSINESS_B','business_members',m.members.REVOKED,'GET');
    for (const a of ['CUSTOMER_A','CUSTOMER_B','GENERAL','PENDING']) {
      assert.equal((await rows(a,'businesses')).length,0); // #9
      assert.equal((await rows(a,'business_members')).length,0);
      await insertProbe(a,'businesses',{id:randomUUID(),business_name:`BATH-RLS:${journal.run_id}`,status:'approved'},'GRANT');
      await insertProbe(a,'business_members',{id:randomUUID(),business_id:m.businesses.B,user_id:m.users[a],role:'admin',status:'approved'},'GRANT'); // #8
    }
    await snapshot('business_members',m.members.A);
    await blocked('BUSINESS_A','business_members',m.members.A,'PATCH',{role:'admin'},'GRANT');
    await snapshot('business_members',m.members.PENDING);
    await blocked('PENDING','business_members',m.members.PENDING,'PATCH',{status:'approved'},'GRANT');
    // Positive DELETE on a separate run-owned row; the attack row remains restorable.
    const d = project(); await track('projects',d);
    ok(await api('CUSTOMER_A',path('projects'),'POST',d),'Positive delete setup');
    ok(await api('CUSTOMER_A',path('projects',d.id),'DELETE'),'Positive DELETE');
    assert.equal((await rows('CUSTOMER_A','projects',d.id)).length,0); assert.equal(await one('projects',d.id),null);
  }
} catch (error) { failed = true; process.exitCode = 1; console.error('FAIL:',error.message); }
finally { const clean = await cleanup(); if (!failed && clean) console.log(mode === '--cleanup' ? 'CLEANUP PASS' : 'PASS: RLS suite AND cleanup'); }
