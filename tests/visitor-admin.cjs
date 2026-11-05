const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8').replace("import 'server-only';",''), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,f);
const { createVisitorAdmin, adminConfigured, createAdminGate } = require('../server/visitor-admin.ts');
const { createPrivateVisitorHandlers, signVisitor, VISITOR_COOKIE } = require('../server/visitors.ts');
const { createHomeVisitorLoader } = require('../data/home-visitors.ts');
const origin='https://admin-offline.example', id='11111111-1111-4111-8111-111111111111', token='offline.admin.token';
const env={NODE_ENV:'production',VISITOR_ADMIN_ENABLED:'true',VISITOR_ADMIN_ORIGIN:origin,VISITOR_ADMIN_USER_IDS:id,SUPABASE_URL:'https://istsrambmbzuemkgutgh.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_offline_test_only',SUPABASE_SECRET_KEY:'sb_secret_offline_test_only',VISITOR_COUNTER_ORIGIN:origin};
const snapshot={date:'2026-11-04',total:100,today:2,last7:12,last30:50,refreshedAt:'2026-11-04T03:00:00.000Z'};
const user={id,is_anonymous:false,email_confirmed_at:'2026-10-01T00:00:00Z'};
const request=(method='GET',cookie='__Host-bath-admin='+token,body,headers={})=>new Request(origin+'/api/admin/visitors',{method,headers:{Origin:origin,'X-Bath-Admin':'1','Content-Type':'application/json',Cookie:cookie,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
function fixture(change={}) {
  const calls=[];
  const h=createVisitorAdmin({env:{...env,...change.env},now:()=>new Date(snapshot.refreshedAt),loginGate:()=>true,readGate:()=>true,request:async(url,opts)=>{
    calls.push({url,opts});
    if(change.transport)return change.transport(url,opts);
    if(url.endsWith('/auth/v1/user'))return Response.json(change.user??user,{status:change.authStatus??200});
    if(url.includes('/auth/v1/token?'))return Response.json({access_token:token,refresh_token:'must_not_escape',expires_in:7200});
    if(url.endsWith('/auth/v1/logout'))return new Response(null,{status:204});
    return Response.json({...snapshot,privateField:'must_not_escape',...change.summary});
  }});return {h,calls};
}
test('configuration missing/disabled/malformed fails closed before network',async()=>{
 for(const patch of [{VISITOR_ADMIN_ENABLED:'false'},{VISITOR_ADMIN_USER_IDS:''},{VISITOR_ADMIN_USER_IDS:'email@example.invalid'},{VISITOR_ADMIN_ORIGIN:'http://admin.example'},{SUPABASE_URL:'https://other.supabase.co'},{SUPABASE_PUBLISHABLE_KEY:''}]){
  const f=fixture({env:patch});assert.equal(adminConfigured({...env,...patch}),false);assert.equal((await f.h.get(request())).status,503);assert.equal(f.calls.length,0);
 }
 assert.equal(adminConfigured({...env,NODE_ENV:'development',VISITOR_ADMIN_ORIGIN:'http://localhost:3000'}),true);
});
test('missing/duplicate/malformed cookie and forged bearer cannot query database',async()=>{
 for(const cookie of ['', '__Host-bath-admin=bad','__Host-bath-admin='+token+'; __Host-bath-admin='+token]) {const f=fixture();assert.equal((await f.h.get(request('GET',cookie))).status,401);assert.equal(f.calls.length,0);}
 const f=fixture({authStatus:401});assert.equal((await f.h.get(request())).status,401);assert.equal(f.calls.length,1);
});
test('verified allowlist only: regular/anonymous/unconfirmed/user_metadata administrator denied',async()=>{
 for(const u of [{...user,id:'22222222-2222-4222-8222-222222222222',user_metadata:{admin:true}},{...user,is_anonymous:true},{...user,email_confirmed_at:null},{...user,is_anonymous:undefined}]){
  const f=fixture({user:u});assert.equal((await f.h.get(request())).status,403);assert.equal(f.calls.length,1);
 }
});
test('admin summary verifies Auth before service RPC and projects only validated aggregates',async()=>{
 const f=fixture(),r=await f.h.get(request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{available:true,...snapshot});
 assert.ok(f.calls[0].url.endsWith('/auth/v1/user'));assert.equal(f.calls[0].opts.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
 assert.ok(f.calls[1].url.endsWith('/rpc/bath_visitor_summary?p_day=2026-11-04'));assert.equal(f.calls[1].opts.headers.apikey,env.SUPABASE_SECRET_KEY);assert.equal(f.calls[1].opts.headers.Authorization,undefined);
 assert.match(r.headers.get('cache-control'),/private, no-store/);assert.equal(r.headers.get('vary'),'Cookie');
});
test('invalid/missing/future/unsafe/contradictory statistics fail closed without made-up zero',async()=>{
 for(const summary of [{total:-1},{today:3.5},{last7:51},{total:Number.MAX_SAFE_INTEGER+1},{date:'2026-11-03'},{refreshedAt:'bad'},{refreshedAt:'2026-11-04T03:02:00Z'},{total:undefined}]) {const r=await fixture({summary}).h.get(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{available:false});}
});
test('upstream unavailable or malformed does not leak details',async()=>{
 for(const transport of [async()=>{throw Error('private secret')},async()=>new Response('not json'),async()=>new Response('private database error',{status:500})]) {const r=await fixture({transport}).h.get(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{available:false});}
});
test('same-origin request and CSRF header required for login/logout',async()=>{
 for(const headers of [{Origin:'https://evil.example'},{Origin:''},{'X-Bath-Admin':''},{'Sec-Fetch-Site':'cross-site'}]){
  const f=fixture();assert.equal((await f.h.login(request('POST','',{email:'offline@example.invalid',password:'test-only'},headers))).status,403);assert.equal((await f.h.logout(request('DELETE','',undefined,headers))).status,403);assert.equal(f.calls.length,0);
 }
});
test('login verifies authenticated user, HttpOnly Secure bounded cookie and no token response',async()=>{
 const f=fixture(),r=await f.h.login(request('POST','',{email:'offline@example.invalid',password:'test-only'}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{available:true});
 for(const attr of ['__Host-bath-admin=','HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=3600'])assert.ok(r.headers.get('set-cookie').includes(attr));
 assert.equal(f.calls.length,2);assert.ok(!r.headers.get('set-cookie').includes('must_not_escape'));
});
test('login failure and authenticated non-admin never issue application session',async()=>{
 for(const f of [fixture({user:{...user,id:'non-admin'}}),fixture({transport:async()=>Response.json({error:'private'},{status:400})})]) {const r=await f.h.login(request('POST','',{email:'offline@example.invalid',password:'wrong'}));assert.ok([401,403].includes(r.status));assert.equal(r.headers.get('set-cookie'),null);}
});
test('login rejects invalid/oversized bodies without Auth calls',async()=>{
 for(const body of [{email:'x',password:''},{email:'x',password:'a'.repeat(5000)},null]){const f=fixture();assert.equal((await f.h.login(request('POST','',body))).status,400);assert.equal(f.calls.length,0);}
});
test('logout revokes remote session and clears local cookie even during provider failure',async()=>{
 for(const f of [fixture(),fixture({transport:async()=>{throw Error('offline')}})]) {const r=await f.h.logout(request('DELETE'));assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);}
});
test('server allowlist removal is effective on next request',async()=>{
 const f=fixture({env:{VISITOR_ADMIN_USER_IDS:'22222222-2222-4222-8222-222222222222'}});assert.equal((await f.h.get(request())).status,403);assert.equal(f.calls.length,1);
});
test('public endpoint default 404 with no DB/Auth calls; independent explicit switch returns total only',async()=>{
 const f=fixture();assert.equal((await f.h.publicTotal(request())).status,404);assert.equal(f.calls.length,0);
 const p=fixture({env:{VISITOR_PUBLIC_TOTAL_ENABLED:'true',VISITOR_ADMIN_ENABLED:'false'}});const r=await p.h.publicTotal(request('GET',''));assert.equal(r.status,200);assert.deepEqual(await r.json(),{available:true,total:100});assert.equal(p.calls.length,1);
});
test('rate gate recovers, isolated injected gates reject before network',async()=>{
 let t=0;const gate=createAdminGate(2,()=>t);assert.equal(gate(),true);assert.equal(gate(),true);assert.equal(gate(),false);t=60000;assert.equal(gate(),true);
 let calls=0;const h=createVisitorAdmin({env,request:async()=>{calls++;throw Error()},loginGate:()=>false,readGate:()=>false});
 assert.equal((await h.login(request('POST','',{}))).status,429);assert.equal((await h.get(request())).status,429);assert.equal(calls,0);
});
test('public registration preserves cookie/dedup protocol without exposing counts',async()=>{
 const visitor='a'.repeat(64),now=()=>new Date(snapshot.refreshedAt),vEnv={...env,NODE_ENV:'production',VERCEL_ENV:'production',VISITOR_COUNTER_ENABLED:'true',VISITOR_COOKIE_SECRET:'offline_cookie_secret_for_test_only'};
 const h=createPrivateVisitorHandlers({env:vEnv,now,request:async()=>Response.json({date:snapshot.date,count:123})});
 const req=(method)=>new Request(origin+'/api/visitors',{method,headers:{Origin:origin,'X-Bath-Visit':'1',Cookie:VISITOR_COOKIE+'='+signVisitor(visitor,vEnv.VISITOR_COOKIE_SECRET,now())}});
 for(const method of ['GET','POST']){const r=await h[method==='GET'?'get':'post'](req(method));assert.equal(r.status,200);assert.deepEqual(await r.json(),{available:true,date:snapshot.date});}
 const methods=[],loader=createHomeVisitorLoader();await loader(async(_,o)=>{methods.push(o.method);return Response.json({available:true,date:snapshot.date})},{request:(_n,_o,fn)=>fn()});assert.deepEqual(methods,['GET','POST']);
});
