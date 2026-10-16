// Operator-only Node >=20. HTTPS only. Default --check never writes remotely.
import { randomUUID } from 'node:crypto';
import { readFileSync,writeFileSync,renameSync,existsSync,readdirSync,openSync,closeSync,unlinkSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
const REF='istsrambmbzuemkgutgh', URL=`https://${REF}.supabase.co`;
const actors=['A','B'];
class SafetyError extends Error {}
const need=(v,m)=>{if(!v)throw new SafetyError(m);};
const uuid=v=>need(typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v),'Invalid UUID');
function claims(t){try{return JSON.parse(Buffer.from(t.split('.')[1],'base64url'));}catch{throw new SafetyError('Invalid JWT encoding');}}
export function authErrorCode(data,headers,status){
  // Fetch Headers lookup is case-insensitive. Never use message text as an error code.
  let body=data?.code;
  const header=new Headers(headers).get('x-sb-error-code')??undefined;
  // Legacy GoTrue serializes HTTP status as numeric body.code, not an Auth error code.
  if(typeof body==='number'){need(Number.isInteger(body)&&body===status,'Conflicting Auth HTTP status');body=undefined;}
  for(const value of [body,header])if(value!==undefined)need(typeof value==='string'&&/^[a-z][a-z0-9_]*$/.test(value),'Malformed Auth error code');
  need(body===undefined||header===undefined||body===header,'Conflicting Auth error codes');
  return body??header;
}
const missingAuthUser=r=>r.status===404&&!r.ok&&r.authCode==='user_not_found';
export async function runCustomers({mode='--check',env=process.env,fetcher=globalThis.fetch,log=console.log}={}) {
  need(['--check','--run','--cleanup'].includes(mode),'Invalid mode');
  const required=n=>{need(env[n],`Missing ${n}`);return env[n];};
  need(required('BATH_TEST_SUPABASE_URL')===URL&&required('BATH_RLS_TEST_CONFIRM')==='bath-designer-dev','Development target mismatch');
  need(env.NODE_TLS_REJECT_UNAUTHORIZED!=='0','TLS verification disabled');
  const key=required('BATH_TEST_PUBLISHABLE_KEY'),admin=required('BATH_TEST_ADMIN_KEY'),management=required('BATH_TEST_MANAGEMENT_TOKEN');
  need(key.startsWith('sb_publishable_')||(claims(key).role==='anon'&&claims(key).ref===REF),'Invalid public key');
  need(admin.startsWith('sb_secret_')||(claims(admin).role==='service_role'&&claims(admin).ref===REF),'Invalid admin key');
  const headers=(actor,token)=>({apikey:actor==='ADMIN'?admin:key,'Content-Type':'application/json',Prefer:'return=representation',
    ...(token?{Authorization:`Bearer ${token}`}:(actor==='ADMIN'&&!admin.startsWith('sb_secret_'))?{Authorization:`Bearer ${admin}`}:{})});
  async function http(url,h,method='GET',body){
    try {const r=await fetcher(url,{method,headers:h,redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
      const text=await r.text(),data=text?JSON.parse(text):null;
      const authCode=!r.ok&&url.startsWith(URL+'/auth/v1/')?authErrorCode(data,r.headers,r.status):undefined;
      return {ok:r.ok,status:r.status,data,authCode};
    } catch(error) {if(error instanceof SafetyError)throw error;throw new SafetyError('NETWORK_OR_PROTOCOL: outcome unknown; inspect journal, do not recreate');}
  }
  const tokens={};
  const api=(a,p,method='GET',body)=>http(URL+p,headers(a,tokens[a]),method,body);
  const ok=(r,label)=>{need(r.ok,`${label}: HTTP ${r.status}; AUTH/API failure, not RLS pass`);return r.data;};
  const target=ok(await http(`https://api.supabase.com/v1/projects/${REF}`,{Authorization:`Bearer ${management}`}), 'Management');
  need(target.id===REF&&target.name==='bath-designer-dev'&&target.status==='ACTIVE_HEALTHY'&&target.database?.host===`db.${REF}.supabase.co`,'Live development target mismatch');
  const settings=ok(await api('ANON','/auth/v1/settings'),'Auth settings');
  if(mode!=='--cleanup')need(settings.external?.anonymous_users===true&&settings.disable_signup===false,'Anonymous signup unavailable');
  const path=id=>`/rest/v1/projects?id=eq.${id}`;
  const probe=randomUUID();
  const pre=ok(await api('ADMIN',path(probe)+'&select=id'),'Admin SELECT');
  need(Array.isArray(pre)&&pre.length===0,'UUID collision; stop without reading existing data');
  const authProbe=await api('ADMIN',`/auth/v1/admin/users/${probe}`);
  need(missingAuthUser(authProbe),'Admin Auth unavailable or UUID collision');
  if(mode==='--check'){log('CHECK PASS: HTTPS target, Anonymous Auth, admin SELECT; no accounts/projects created');return {success:true};}
  need(required('BATH_TEST_SECRET_STORAGE_CONFIRM')==='private-acl-verified','Verify private ACL first');
  const folder=resolve('tests/artifacts/phase4a2');need(existsSync(folder),'Private directory missing');
  if(mode==='--run')need(required('BATH_CUSTOMER_RLS_CONFIRM')==='create-two-anonymous-users-and-test','Separate test execution approval required');
  const lock=resolve(folder,'customer-rls.lock');const fd=openSync(lock,'wx',0o600);closeSync(fd);
  let journal,file,failed=false;
  const save=()=>{const temp=`${file}.${randomUUID()}.tmp`;writeFileSync(temp,JSON.stringify(journal,null,2),{flag:'wx',mode:0o600,flush:true});renameSync(temp,file);};
  const marker=()=>`BATH-CUSTOMER-RLS:${journal.run_id}`;
  const passed=(actor,scenario,details={})=>{journal.results??=[];journal.results.push({actor,scenario,result:'PASS',...details});save();};
  async function one(id){const rows=ok(await api('ADMIN',path(id)),'Admin observe');need(Array.isArray(rows)&&rows.length<=1,'Invalid row response');return rows[0]??null;}
  async function session(a){
    const c=claims(tokens[a]);need(c.iss===`${URL}/auth/v1`&&c.sub===journal.users[a]?.id&&c.role==='authenticated'&&c.is_anonymous===true,'Invalid anonymous session identity');
    need(c.exp>Date.now()/1000+60,'AUTH: expired/expiring token');
    const u=ok(await api(a,'/auth/v1/user'),'Auth session');need(u.id===c.sub&&u.is_anonymous===true,'Auth user mismatch');
  }
  async function adminUser(id,allowMissing=false){const r=await api('ADMIN',`/auth/v1/admin/users/${id}`);if(allowMissing&&missingAuthUser(r))return null;const d=ok(r,'Admin Auth');return d.user||d;}
  async function attest(a){const u=await adminUser(journal.users[a].id);need(u?.is_anonymous===true&&u.app_metadata?.bath_customer_rls_run===journal.run_id,'Dedicated trusted user marker missing');return u;}
  async function track(body){uuid(body.id);need(!journal.projects.some(p=>p.id===body.id)&&!Object.values(journal.users).some(u=>u.id===body.id),'Duplicate target UUID');
    const collision=ok(await api('ADMIN',path(body.id)+'&select=id'),'Collision check');need(Array.isArray(collision)&&collision.length===0,'UUID collision');
    journal.projects.push({id:body.id,intended:body,cleaned:false});save();}
  async function denied(a,id,method,body,layer='RLS'){
    if(a!=='ANON')await session(a);
    const before=await one(id),r=await api(a,method==='POST'?'/rest/v1/projects':path(id),method,body);
    journal.observations.push({actor:a,id,method,status:r.status,code:typeof r.data?.code==='string'?r.data.code:undefined});save();
    need(isDeepStrictEqual(await one(id),before),'SECURITY: denied request changed row');
    if(r.ok)need(layer==='RLS'&&method!=='POST'&&Array.isArray(r.data)&&r.data.length===0,'SECURITY: unexpected access/success');
    else {
      need(a==='ANON'||r.status!==401,'AUTH: unauthorized session, not RLS denial');
      need(r.data?.code==='42501','Unexpected API error, not RLS denial');
      const message=r.data.message||'';
      need(layer==='RLS'?/row-level security/i.test(message):/permission denied for (table|column|schema)/i.test(message),'Unexpected denial layer');
    }
    if(a!=='ANON')await session(a);
    passed(a,`BLOCK_${method}`,{id,layer,unchanged:true,status:r.status});
  }
  async function cleanup(){
    const errors=[];
    for(const p of [...journal.projects].reverse())try{
      uuid(p.id);need(p.intended.id===p.id&&p.intended.project_info?.projectName===marker()&&Object.values(journal.users).some(u=>u.id===p.intended.owner_user_id),'Unsafe cleanup journal');
      const row=await one(p.id);
      if(row){need(row.project_info?.projectName===marker()&&row.owner_user_id===p.intended.owner_user_id,'Cleanup ownership/marker drift; manual review');
        const actor=actors.find(a=>journal.users[a]?.id===row.owner_user_id);need(actor,'Unknown cleanup owner');await attest(actor);
        ok(await api('ADMIN',path(p.id),'DELETE'),'Cleanup project');}
      need(await one(p.id)===null,'Cleanup project remains');p.cleaned=true;delete p.error;
    }catch{p.error='PROJECT_CLEANUP_FAILED';errors.push(p.id);}finally{save();}
    // Never delete an Auth user while unexpected or failed project cleanup could cascade.
    if(!errors.length)for(const a of actors)if(journal.users[a])try{
      const rec=journal.users[a];uuid(rec.id);const u=await adminUser(rec.id,rec.delete_requested===true||rec.cleaned===true);
      if(u){await attest(a);
        const rows=ok(await api('ADMIN',`/rest/v1/projects?select=id&owner_user_id=eq.${rec.id}`),'Cleanup residual check');
        need(Array.isArray(rows)&&rows.length===0,'Unexpected residual projects; no Auth cascade');
        rec.delete_requested=true;save();
        ok(await api('ADMIN',`/auth/v1/admin/users/${rec.id}`,'DELETE'),'Cleanup Auth');need(await adminUser(rec.id,true)===null,'Auth user remains');
      }
      rec.cleaned=true;delete rec.error;
    }catch{journal.users[a].error='AUTH_CLEANUP_FAILED';errors.push(journal.users[a].id);}finally{save();}
    if(journal.pending_signup)errors.push('UNKNOWN_SIGNUP_OUTCOME');
    journal.cleanup_errors=errors;journal.cleanup_complete=errors.length===0;save();return !errors.length;
  }
  try {
    if(mode==='--cleanup'){
      file=resolve(required('BATH_CUSTOMER_RLS_JOURNAL'));need(dirname(file)===folder,'Journal outside private directory');
      const candidate=JSON.parse(readFileSync(file,'utf8'));need(candidate.project_ref===REF&&candidate.kind==='customer-rls-v1','Wrong journal');uuid(candidate.run_id);
      need(Array.isArray(candidate.projects)&&candidate.users&&Object.keys(candidate.users).every(a=>actors.includes(a)),'Invalid journal shape');
      const ids=Object.values(candidate.users).map(u=>u.id);ids.forEach(uuid);need(new Set(ids).size===ids.length,'Duplicate journal users');
      const projectIds=candidate.projects.map(p=>p.id);projectIds.forEach(uuid);need(new Set(projectIds).size===projectIds.length,'Duplicate journal projects');
      for(const p of candidate.projects)need(p.intended?.id===p.id&&ids.includes(p.intended.owner_user_id)&&p.intended.project_info?.projectName===`BATH-CUSTOMER-RLS:${candidate.run_id}`,'Unsafe cleanup journal');
      journal=candidate;
    } else {
      for(const name of readdirSync(folder).filter(n=>/^customer-rls-.*\.json$/.test(n))){const old=JSON.parse(readFileSync(resolve(folder,name),'utf8'));need(old.cleanup_complete===true,'Previous incomplete journal: cleanup/manual recovery first');}
      const run_id=randomUUID();file=resolve(folder,`customer-rls-${run_id}.json`);
      const fd=openSync(file,'wx',0o600);closeSync(fd);
      journal={kind:'customer-rls-v1',project_ref:REF,run_id,created_at:new Date().toISOString(),plan:{actors,scope:'new dedicated users and tracked project UUIDs only',cleanup:'tracked projects first; then attested users after zero residual rows'},users:{},projects:[],observations:[],pending_signup:null,cleanup_complete:false};save();
      log(`JOURNAL ${file}`);
      for(const a of actors){
        journal.pending_signup={actor:a,at:new Date().toISOString()};save();
        // Same genuine Auth signup endpoint used by signInAnonymously; no admin-created session/JWT.
        const s=ok(await api('ANON','/auth/v1/signup','POST',{data:{bath_customer_rls_run:journal.run_id}}),'Anonymous signup');
        uuid(s.user?.id);need(!Object.values(journal.users).some(u=>u.id===s.user.id),'Duplicate Auth user ID');
        journal.users[a]={id:s.user.id,cleaned:false};journal.pending_signup=null;save();
        need(s.access_token&&s.user.is_anonymous===true,'Anonymous session missing');tokens[a]=s.access_token;
        ok(await api('ADMIN',`/auth/v1/admin/users/${s.user.id}`,'PUT',{app_metadata:{bath_customer_rls_run:journal.run_id}}),'Dedicated marker');
        await attest(a);await session(a);
        passed(a,'ANONYMOUS_SESSION',{is_anonymous:true,distinct_uid:true});
      }
      const bodies={};
      for(const a of actors){
        const body={id:randomUUID(),owner_user_id:journal.users[a].id,project_info:{builderMode:'consumer',projectName:marker()},selections:{},schema_version:3};
        bodies[a]=body;await track(body);await session(a);
        const inserted=ok(await api(a,'/rest/v1/projects','POST',body),'Own INSERT');need(Array.isArray(inserted)&&inserted.length===1&&inserted[0].id===body.id&&inserted[0].owner_user_id===body.owner_user_id,'Own INSERT mismatch');
        const own=ok(await api(a,path(body.id)),'Own SELECT');need(Array.isArray(own)&&own.length===1&&own[0].id===body.id,'Own SELECT mismatch');
        passed(a,'OWN_INSERT_SELECT',{id:body.id});
        const updated=ok(await api(a,path(body.id)+`&revision=eq.${own[0].revision}`,'PATCH',{consultation_memo:`${marker()}:updated`}), 'Own UPDATE');
        need(Array.isArray(updated)&&updated.length===1&&updated[0].revision===own[0].revision+1&&updated[0].consultation_memo===`${marker()}:updated`,'Revision/update mismatch');
        const beforeStale=await one(body.id);
        need(beforeStale?.revision===updated[0].revision&&beforeStale.consultation_memo===updated[0].consultation_memo,'Persisted UPDATE mismatch');
        passed(a,'OWN_UPDATE_REVISION',{before:own[0].revision,after:updated[0].revision});
        await session(a);
        journal.pending_request={actor:a,id:body.id,method:'PATCH',scenario:'STALE_REVISION'};save();
        const stale=ok(await api(a,path(body.id)+`&revision=eq.${own[0].revision}`,'PATCH',{consultation_memo:'stale-write-must-not-apply'}),'Stale revision request');
        need(Array.isArray(stale)&&stale.length===0,'SECURITY: stale revision unexpectedly updated project');
        need(isDeepStrictEqual(await one(body.id),beforeStale),'SECURITY: stale revision changed project');await session(a);
        journal.pending_request=null;passed(a,'STALE_REVISION_BLOCKED',{unchanged:true});
        await denied(a,body.id,'PATCH',{owner_user_id:journal.users[a==='A'?'B':'A'].id},'GRANT');
      }
      await denied('A',bodies.B.id,'GET');await denied('B',bodies.A.id,'GET');
      await denied('B',bodies.A.id,'PATCH',{consultation_memo:'blocked-probe'});await denied('B',bodies.A.id,'DELETE');
      for(const a of actors){const b={...bodies[a],id:randomUUID(),owner_user_id:journal.users[a==='A'?'B':'A'].id};await track(b);await denied(a,b.id,'POST',b);}
      for(const method of ['GET','PATCH','DELETE'])await denied('ANON',bodies.A.id,method,method==='PATCH'?{consultation_memo:'blocked-probe'}:undefined,'GRANT');
      const anon={...bodies.A,id:randomUUID()};await track(anon);await denied('ANON',anon.id,'POST',anon,'GRANT');
      for(const a of actors){await session(a);const r=ok(await api(a,path(bodies[a].id),'DELETE'),'Own DELETE');need(Array.isArray(r)&&r.length===1&&r[0].id===bodies[a].id,'Own DELETE mismatch');need(await one(bodies[a].id)===null,'Own DELETE remains');passed(a,'OWN_DELETE');}
      journal.scenarios_passed=true;save();
    }
  } catch(error){failed=true;if(journal){journal.failure=error instanceof SafetyError?error.message:'LOCAL_STATE_FAILURE';save();}}
  finally {
    try {if(journal&&!(await cleanup()))failed=true;}finally{unlinkSync(lock);}
  }
  need(journal&&!failed,'CUSTOMER_RLS_FAILED: inspect private journal; no automatic retry');
  log(mode==='--cleanup'?'CLEANUP PASS':'PASS: customer A/B scenarios AND cleanup');return {success:true,journal:file};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  runCustomers({mode:process.argv[2]||'--check'}).catch(e=>{console.error(e instanceof SafetyError?e.message:'LOCAL_OR_CONFIG_FAILURE');process.exitCode=1;});
}
