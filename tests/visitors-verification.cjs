const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8').replace("import 'server-only';",''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createVisitorHandlers,signVisitor,readVisitor,VISITOR_COOKIE}=require('../server/visitors.ts');
const {createHomeVisitorLoader}=require('../data/home-visitors.ts');
const origin='https://visitor-offline.example';
const env={NODE_ENV:'production',VERCEL_ENV:'production',VISITOR_COUNTER_ENABLED:'true',VISITOR_COUNTER_ORIGIN:origin,SUPABASE_URL:'https://istsrambmbzuemkgutgh.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_offline_mock_only',VISITOR_COOKIE_SECRET:'offline_cookie_secret_not_for_deployment'};
const id='a'.repeat(64),cookie=`${VISITOR_COOKIE}=${signVisitor(id,env.VISITOR_COOKIE_SECRET,new Date('2026-10-20T02:00:00Z'))}`,now=()=>new Date('2026-10-20T02:00:00Z');
const req=(method,headers={})=>new Request(origin+(method==='GET'?'/api/visitors':'/api/visitors/visit'),{method,headers:{Origin:origin,'X-Bath-Visit':'1',Cookie:cookie,...headers}});
test('valid-hex HMAC tamper, wrong signing key and malformed cookies stop before RPC',async()=>{
 let calls=0;const h=createVisitorHandlers({env,now,request:async()=>{calls++;return Response.json({date:'2026-10-20',count:0})}});const value=signVisitor(id,env.VISITOR_COOKIE_SECRET,new Date('2026-10-20T02:00:00Z')),changed=value.slice(0,-1)+(value.endsWith('0')?'1':'0');
 for(const bad of [`${VISITOR_COOKIE}=${changed}`,`${VISITOR_COOKIE}=${signVisitor(id,'different-key')}`,`${VISITOR_COOKIE}=bad`,`${VISITOR_COOKIE}=${value.toUpperCase()}`])assert.equal((await h.post(req('POST',{Cookie:bad}))).status,428);
 assert.equal(calls,0);assert.equal(readVisitor(cookie,env.VISITOR_COOKIE_SECRET,new Date('2026-10-20T02:00:00Z')),id);
});
test('cookie bootstrap replaces invalid cookie and has host-only secure 30-day attributes',async()=>{
 const h=createVisitorHandlers({env,now,randomId:()=>id,request:async()=>Response.json({date:'2026-10-20',count:0})});const r=await h.get(req('GET',{Cookie:'invalid'})),set=r.headers.get('set-cookie');for(const part of ['Max-Age=2592000','HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(set.includes(part));assert.ok(!set.includes('Domain='));assert.equal(readVisitor(set.split(';')[0],env.VISITOR_COOKIE_SECRET,new Date('2026-10-20T02:00:00Z')),id);assert.ok(!JSON.stringify(await r.json()).includes(id));
});
test('expired signed cookie replay is rejected by server',async()=>{
 const h=createVisitorHandlers({env,now:()=>new Date('2026-12-20T02:00:00Z'),request:async()=>Response.json({date:'2026-12-20',count:1})});assert.equal((await h.post(req('POST'))).status,428);
});
test('origin, URL, missing origin and Sec-Fetch-Site checks cannot reach upstream',async()=>{
 let calls=0;const h=createVisitorHandlers({env,now,request:async()=>{calls++;throw Error('must not call')}});
 for(const headers of [{Origin:'https://evil.example'},{Origin:''},{'Sec-Fetch-Site':'cross-site'},{'X-Bath-Visit':''}])assert.equal((await h.post(req('POST',headers))).status,403);
 assert.equal((await h.post(new Request('https://different.example/api/visitors/visit',{method:'POST',headers:{Origin:origin,'X-Bath-Visit':'1',Cookie:cookie}}))).status,403);
 assert.equal((await h.get(req('GET',{Origin:'https://evil.example'}))).status,503);assert.equal(calls,0);
});
test('upstream 400/401/403/404/500/503 and malformed responses fail closed for GET and POST',async()=>{
 const upstreams=[...[400,401,403,404,500,503].map(status=>async()=>Response.json({message:'private-upstream-detail'},{status})),async()=>new Response('not-json'),async()=>Response.json({date:'2026-10-20',count:-1}),async()=>Response.json({date:'2026-10-20',count:1.5}),async()=>Response.json({date:'2026-10-20',count:Number.MAX_SAFE_INTEGER+1}),async()=>Response.json({count:0}),async()=>{throw Object.assign(Error('private-network-detail'),{code:'ECONNRESET'})}];
 for(const request of upstreams){const h=createVisitorHandlers({env,now,request});for(const method of ['GET','POST']){const r=await(method==='GET'?h.get(req(method)):h.post(req(method)));assert.equal(r.status,503);assert.deepEqual(await r.json(),{available:false});assert.equal(r.headers.get('set-cookie'),null)}}
});
test('request retains server apikey, default TLS configuration, redirect refusal and no-store',async()=>{
 const h=createVisitorHandlers({env,now,request:async(url,o)=>{assert.equal(new URL(url).origin,env.SUPABASE_URL);assert.equal(o.headers.apikey,env.SUPABASE_SECRET_KEY);assert.equal(o.headers.Authorization,undefined);assert.equal(o.redirect,'error');assert.equal(o.cache,'no-store');assert.ok(o.signal instanceof AbortSignal);return Response.json({date:'2026-10-20',count:1})}});assert.equal((await h.get(req('GET'))).status,200);assert.equal((await h.post(req('POST'))).status,200);
});
test('real 5-second AbortSignal deadline returns neutral unavailable',{timeout:8000},async()=>{
 const start=Date.now(),h=createVisitorHandlers({env,now,request:async(_url,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(o.signal.reason),{once:true}))});const keeper=setInterval(()=>{},500);try{const r=await h.post(req('POST'));assert.equal(r.status,503);assert.deepEqual(await r.json(),{available:false});assert.ok(Date.now()-start>=4500&&Date.now()-start<7500)}finally{clearInterval(keeper)}
});
test('failed client POST is not marked registered; next attempt can retry and lock failure makes no requests',async()=>{
 const loader=createHomeVisitorLoader(),locks={request:(_n,_o,fn)=>fn()};let fail=true,methods=[];const request=async(_url,o)=>{methods.push(o.method);return fail&&o.method==='POST'?new Response('',{status:503}):Response.json({available:true,date:'2026-10-20',count:1})};assert.equal(await loader(request,locks),null);fail=false;assert.equal((await loader(request,locks)).count,1);assert.deepEqual(methods,['GET','POST','GET','POST']);let calls=0;assert.equal(await createHomeVisitorLoader()(async()=>{calls++},{request:async()=>{throw Error('lock failed')}}),null);assert.equal(calls,0);
});

test('lost POST response after mock commit is not reported as success and same-cookie retry stays deduplicated',async()=>{
 const seen=new Set();let drop=true;
 const h=createVisitorHandlers({env,now,request:async(_url,o)=>{const hash=JSON.parse(o.body).p_hash;seen.add(hash);if(drop){drop=false;throw Error('response lost after mock commit')}return Response.json({date:'2026-10-20',count:seen.size})}});
 const lost=await h.post(req('POST'));assert.equal(lost.status,503);assert.deepEqual(await lost.json(),{available:false});const retry=await h.post(req('POST'));assert.equal(retry.status,200);assert.equal((await retry.json()).count,1);assert.equal(seen.size,1);
});
