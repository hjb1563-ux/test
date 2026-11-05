const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8').replace("import 'server-only';",''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createVisitorPasswordHandlers}=require('../server/visitor-password.ts');
const origin='https://offline.example',id='11111111-1111-4111-8111-111111111111',hash='a'.repeat(64),token='offline.verified.token';
const env={NODE_ENV:'production',VISITOR_ADMIN_ENABLED:'true',VISITOR_ADMIN_ORIGIN:origin,VISITOR_ADMIN_USER_IDS:id,SUPABASE_URL:'https://istsrambmbzuemkgutgh.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_OFFLINE_ONLY',SUPABASE_SECRET_KEY:'sb_secret_OFFLINE_ONLY'};
const password='offline-test-password',body={tokenHash:hash,type:'recovery',password,confirmation:password};
const req=(data=body,headers={})=>new Request(origin+'/api/admin/password',{method:'POST',headers:{Origin:origin,'X-Bath-Admin':'1','Content-Type':'application/json',...headers},body:JSON.stringify(data)});
function fixture(change={}){const calls=[];const h=createVisitorPasswordHandlers({env:{...env,...change.env},passwordGate:()=>true,recoveryGate:()=>true,request:async(url,opts)=>{
 calls.push({url,opts});if(change.transport)return change.transport(url,opts);
 const user={id,is_anonymous:false,email_confirmed_at:'2026-11-01T00:00:00Z',email:'owner@example.invalid',...change.user};
 if(url.endsWith('/verify'))return Response.json({access_token:token,refresh_token:'must_not_escape',user:{id:change.sessionId??id}},{status:change.verifyStatus??200});
 if(url.endsWith('/user')&&opts.method==='PUT')return Response.json({id},{status:change.updateStatus??200});
 if(url.endsWith('/user')||url.includes('/admin/users/'))return Response.json(user);
 if(url.includes('/recover?'))return Response.json({});
 throw Error('unrecognized offline call');
 }});return{h,calls};}
test('invite/recovery verify official OTP, existing identity, then update password; never issue admin session',async()=>{
 for(const type of ['invite','recovery']){const f=fixture(),r=await f.h.setup(req({...body,type}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{available:true});assert.equal(r.headers.get('set-cookie'),null);assert.match(r.headers.get('cache-control'),/private, no-store/);assert.equal(f.calls.length,3);assert.deepEqual(JSON.parse(f.calls[0].opts.body),{token_hash:hash,type});assert.ok(f.calls[1].url.endsWith('/user'));assert.equal(f.calls[2].opts.method,'PUT');assert.deepEqual(JSON.parse(f.calls[2].opts.body),{password});assert.equal(f.calls[2].opts.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);assert.equal(f.calls[2].opts.headers.Authorization,'Bearer '+token);}
});
test('expired/replayed/invalid OTP rejected before identity or password update',async()=>{
 for(const verifyStatus of [400,401,403,422]){const f=fixture({verifyStatus}),r=await f.h.setup(req());assert.equal(r.status,401);assert.equal(f.calls.length,1);assert.deepEqual(await r.json(),{available:false});}
});
test('arbitrary JWT/admin cookie, unsupported type, redirect/user-ID injection and mismatched passwords rejected before Auth',async()=>{
 for(const data of [{...body,tokenHash:''},{...body,type:'magiclink'},{...body,accessToken:token},{...body,redirectTo:'https://evil.invalid'},{...body,userId:id},{...body,confirmation:'different'},{...body,password:'short',confirmation:'short'}]){const f=fixture();assert.equal((await f.h.setup(req(data))).status,400);assert.equal(f.calls.length,0);}
});
test('regular/anonymous/unconfirmed and different session user cannot update',async()=>{
 for(const change of [{user:{id:'22222222-2222-4222-8222-222222222222'}},{user:{is_anonymous:true}},{user:{email_confirmed_at:null}},{sessionId:'different'}]){const f=fixture(change);assert.equal((await f.h.setup(req())).status,403);assert.ok(!f.calls.some(c=>c.opts.method==='PUT'));}
});
test('same-origin CSRF, configured allowlist, JSON, payload bound enforced',async()=>{
 for(const headers of [{Origin:'https://evil.invalid'},{Origin:''},{'X-Bath-Admin':''},{'Sec-Fetch-Site':'cross-site'}]){const f=fixture();assert.equal((await f.h.setup(req(body,headers))).status,403);assert.equal(f.calls.length,0);}
 const f=fixture({env:{VISITOR_ADMIN_USER_IDS:''}});assert.equal((await f.h.setup(req())).status,503);assert.equal(f.calls.length,0);
 const large=fixture();assert.equal((await large.h.setup(req({...body,tokenHash:'a'.repeat(6000)}))).status,400);assert.equal(large.calls.length,0);
});
test('provider policy/network/JSON errors return generic failure without tokens or password',async()=>{
 for(const f of [fixture({updateStatus:422}),fixture({transport:async()=>{throw Error('private')} }),fixture({transport:async()=>new Response('private not json')})]){const r=await f.h.setup(req());assert.ok([400,503].includes(r.status));assert.deepEqual(await r.json(),{available:false});assert.equal(r.headers.get('set-cookie'),null);}
});
test('recovery only looks up configured UUID and sends fixed callback for matching existing account',async()=>{
 const f=fixture(),r=await f.h.recover(req({email:'owner@example.invalid'}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{available:true});assert.equal(f.calls.length,2);assert.ok(f.calls[0].url.endsWith('/admin/users/'+id));assert.equal(f.calls[0].opts.headers.apikey,env.SUPABASE_SECRET_KEY);const url=new URL(f.calls[1].url);assert.equal(url.pathname,'/auth/v1/recover');assert.equal(url.searchParams.get('redirect_to'),origin+'/admin/setup-password');const sent=JSON.parse(f.calls[1].opts.body);assert.equal(sent.email,'owner@example.invalid');assert.equal(sent.code_challenge_method,'s256');assert.match(sent.code_challenge,/^[A-Za-z0-9_-]{43}$/);assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
});
test('unmatched email has same success response but sends no email; no signup/invite/user mutation',async()=>{
 const f=fixture(),r=await f.h.recover(req({email:'unmatched@example.invalid'}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{available:true});assert.equal(f.calls.length,1);assert.equal(f.calls[0].opts.method,'GET');
});
test('rate gates deny before any request',async()=>{
 let calls=0;const h=createVisitorPasswordHandlers({env,passwordGate:()=>false,recoveryGate:()=>false,request:async()=>{calls++;throw Error();}});assert.equal((await h.setup(req())).status,429);assert.equal((await h.recover(req({email:'owner@example.invalid'}))).status,429);assert.equal(calls,0);
});
test('recovery provider errors do not reveal whether email matched',async()=>{
 const f=fixture({transport:async(url)=>url.includes('/admin/users/')?Response.json({id,is_anonymous:false,email_confirmed_at:'2026-11-01T00:00:00Z',email:'owner@example.invalid'}):Response.json({error:'private mail failure'},{status:429})});
 const r=await f.h.recover(req({email:'owner@example.invalid'}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{available:true});
});
test('setup feature never embeds or stores token/password in browser storage or query links',()=>{
 const s=fs.readFileSync('components/VisitorPasswordSetup.tsx','utf8');assert.ok(s.includes('window.location.hash'));assert.ok(s.includes('history.replaceState'));assert.doesNotMatch(s,/localStorage|sessionStorage|console\.(log|error)|document\.cookie/);assert.ok(s.includes("window.location.replace('/admin/login')"));
});

 test('PKCE default-email code requires matching signed verifier; same identity and no admin login',async()=>{
 const f=fixture();const recovery=await f.h.recover(req({email:'owner@example.invalid'}));const cookie=recovery.headers.get('set-cookie').split(';')[0];
 const verifier=cookie.split('=')[1].split('.')[0];const challenge=JSON.parse(f.calls[1].opts.body).code_challenge;
 assert.equal(require('node:crypto').createHash('sha256').update(verifier).digest('base64url'),challenge);
 const code='offline-code-for-recovery';let updates=0;
 const h=createVisitorPasswordHandlers({env,passwordGate:()=>true,request:async(url,opts)=>{
 if(url.endsWith('token?grant_type=pkce')){assert.deepEqual(JSON.parse(opts.body),{auth_code:code,code_verifier:verifier});return Response.json({access_token:token,user:{id}});}
 if(opts.method==='PUT'){updates++;assert.deepEqual(JSON.parse(opts.body),{password});return Response.json({id});}
 return Response.json({id,is_anonymous:false,email_confirmed_at:'2026-11-01'});
 }});
 const data={code,password,confirmation:password};assert.equal((await h.setup(req(data))).status,401);
 assert.equal((await h.setup(req(data,{Cookie:cookie+'tampered'}))).status,401);
 const response=await h.setup(req(data,{Cookie:cookie}));assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);assert.equal(updates,1);
 });
