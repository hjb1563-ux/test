const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8').replace("import 'server-only';",''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createVisitorHandlers,visitorCounterEnabled,seoulDate,signVisitor,VISITOR_COOKIE}=require('../server/visitors.ts');
const {loadHomeVisitors,createHomeVisitorLoader}=require('../data/home-visitors.ts');
const origin='https://bath.example.com';
const env={NODE_ENV:'production',VERCEL_ENV:'production',VISITOR_COUNTER_ENABLED:'true',VISITOR_COUNTER_ORIGIN:origin,SUPABASE_URL:'https://istsrambmbzuemkgutgh.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_mock_not_a_real_key',VISITOR_COOKIE_SECRET:'offline-cookie-secret-not-for-deployment'};
const idA='a'.repeat(64),idB='b'.repeat(64);
const cookie=id=>`${VISITOR_COOKIE}=${signVisitor(id,env.VISITOR_COOKIE_SECRET,new Date('2026-10-20T02:00:00Z'))}`;
function store(){const seen=new Map(),calls=[];return {calls,request:async(url,opts)=>{calls.push({url,opts});const day=opts.method==='GET'?new URL(url).searchParams.get('p_day'):JSON.parse(opts.body).p_day;if(!seen.has(day))seen.set(day,new Set());if(opts.method==='POST')seen.get(day).add(JSON.parse(opts.body).p_hash);return Response.json({date:day,count:seen.get(day).size});}};}
const req=(method='GET',id)=>new Request(origin+(method==='POST'?'/api/visitors/visit':'/api/visitors'),{method,headers:{Origin:origin,'X-Bath-Visit':'1',...(id?{Cookie:cookie(id)}:{})}});
const now=()=>new Date('2026-10-20T02:00:00Z');
test('development, preview, disabled, missing secret and wrong DB fail closed without DB calls',async()=>{
 for(const change of [{NODE_ENV:'development'},{VERCEL_ENV:'preview'},{VISITOR_COUNTER_ENABLED:'false'},{SUPABASE_SECRET_KEY:''},{VISITOR_COOKIE_SECRET:'short'},{SUPABASE_URL:'https://other.supabase.co'},{VISITOR_COUNTER_ORIGIN:'http://localhost:3000'}]){
  const db=store(),e={...env,...change};assert.equal(visitorCounterEnabled(e),false);const h=createVisitorHandlers({env:e,request:db.request,now});assert.notEqual((await h.get(req())).status,200);assert.notEqual((await h.post(req('POST',idA))).status,200);assert.equal(db.calls.length,0);
 }
});
test('bootstrap only reads, sets protected cookie, and no-cookie POST never increments',async()=>{
 const db=store(),h=createVisitorHandlers({env,request:db.request,now,randomId:()=>idA});const r=await h.get(req());assert.equal((await r.json()).count,0);const c=r.headers.get('set-cookie');for(const value of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(c.includes(value));assert.equal((await h.post(req('POST'))).status,428);assert.equal(db.calls.length,1);assert.equal(db.calls[0].opts.method,'GET');
});
test('first visit, refresh, repeated tab and other browser use daily idempotent storage',async()=>{
 const db=store(),h=createVisitorHandlers({env,request:db.request,now});for(let i=0;i<3;i++)assert.equal((await (await h.post(req('POST',idA))).json()).count,1);assert.equal((await (await h.post(req('POST',idB))).json()).count,2);assert.equal((await (await h.get(req())).json()).count,2);assert.ok(db.calls.every(x=>!String(x.opts.body).includes(idA)));assert.ok(db.calls.every(x=>!('Authorization' in x.opts.headers)));
});
test('Seoul midnight resets dedup key; handler recreation preserves durable store',async()=>{
 assert.equal(seoulDate(new Date('2026-10-20T14:59:59.999Z')),'2026-10-20');assert.equal(seoulDate(new Date('2026-10-20T15:00:00Z')),'2026-10-21');const db=store();for(const instant of ['2026-10-20T14:59:59Z','2026-10-20T15:00:00Z']){const h=createVisitorHandlers({env,request:db.request,now:()=>new Date(instant)});assert.equal((await (await h.post(req('POST',idA))).json()).count,1);}assert.notEqual(JSON.parse(db.calls[0].opts.body).p_hash,JSON.parse(db.calls[1].opts.body).p_hash);
});
test('concurrent duplicate requests count once in atomic storage mock',async()=>{
 const db=store(),h=createVisitorHandlers({env,request:db.request,now});const results=await Promise.all(Array.from({length:20},()=>h.post(req('POST',idA))));for(const r of results)assert.equal((await r.json()).count,1);
});
test('forged cookies, cross-origin, bodies, missing header and bots are rejected',async()=>{
 const db=store(),h=createVisitorHandlers({env,request:db.request,now});const bads=[new Request(origin+'/api/visitors/visit',{method:'POST',headers:{Origin:'https://evil.example','X-Bath-Visit':'1',Cookie:cookie(idA)}}),new Request(origin+'/api/visitors/visit',{method:'POST',body:'count=999',headers:{Origin:origin,'X-Bath-Visit':'1',Cookie:cookie(idA)}}),new Request(origin+'/api/visitors/visit',{method:'POST',headers:{Origin:origin,Cookie:cookie(idA)}}),new Request(origin+'/api/visitors/visit',{method:'POST',headers:{Origin:origin,'X-Bath-Visit':'1',Cookie:cookie(idA).slice(0,-1)+'0','User-Agent':'Googlebot'}})];for(const r of bads)assert.notEqual((await h.post(r)).status,200);assert.equal(db.calls.length,0);
 const forged=new Request(origin+'/api/visitors/visit',{method:'POST',headers:{Origin:origin,'X-Bath-Visit':'1',Cookie:cookie(idA).slice(0,-1)+'z'}});assert.equal((await h.post(forged)).status,428);
});
test('network, invalid response and rate limit expose no made-up count or secrets',async()=>{
 for(const request of [async()=>{throw Error('private response');},async()=>Response.json({date:'wrong',count:100}),async()=>new Response('',{status:429})]){const h=createVisitorHandlers({env,request,now});const r=await h.post(req('POST',idA));assert.ok([429,503].includes(r.status));assert.deepEqual(await r.json(),{available:false});assert.ok(r.headers.get('cache-control').includes('no-store'));}
});
test('client Web Lock serializes cookie bootstrap across tabs and strict effects',async()=>{
 const db=store(),h=createVisitorHandlers({env,request:db.request,now,randomId:()=>idA});let browserCookie=null,tail=Promise.resolve(),active=0,max=0;
 const locks={request:(_name,_opts,fn)=>{const work=tail.then(async()=>{active++;max=Math.max(max,active);try{return await fn();}finally{active--;}});tail=work.catch(()=>{});return work;}};
 const browser=async(path,opts)=>{const r=new Request(origin+path,{...opts,headers:{...opts.headers,Origin:origin,...(browserCookie?{Cookie:browserCookie}:{})}});const response=opts.method==='GET'?await h.get(r):await h.post(r);if(response.headers.has('set-cookie'))browserCookie=response.headers.get('set-cookie').split(';')[0];return response;};
 const results=await Promise.all(Array.from({length:4},()=>loadHomeVisitors(browser,locks)));assert.equal(max,1);for(const r of results)assert.equal(r.count,1);
});
test('missing locks and API failures return neutral unavailable, never zero',async()=>{
 let calls=0;assert.equal(await loadHomeVisitors(async()=>{calls++;}),null);assert.equal(calls,0);const locks={request:(_n,_o,fn)=>fn()};assert.equal(await loadHomeVisitors(async()=>new Response('',{status:503}),locks),null);
});
test('Next.js empty POST stream is accepted; chunked input is rejected without DB writes',async()=>{
 const db=store(),h=createVisitorHandlers({env,request:db.request,now});
 const make=stream=>new Request(origin+'/api/visitors/visit',{method:'POST',duplex:'half',body:stream,headers:{Origin:origin,'X-Bath-Visit':'1',Cookie:cookie(idA)}});
 const empty=make(new ReadableStream({start(c){c.close();}}));assert.equal((await h.post(empty)).status,200);
 const before=db.calls.length,bad=make(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));c.close();}}));assert.equal((await h.post(bad)).status,400);assert.equal(db.calls.length,before);
});
test('successful page registration polls GET only until a new Seoul day',async()=>{
 const load=createHomeVisitorLoader(),methods=[],locks={request:(_n,_o,fn)=>fn()};let date='2026-10-20',count=1;
 const browser=async(_path,opts)=>{methods.push(opts.method);return Response.json({available:true,date,count});};
 await load(browser,locks);count=8;assert.equal((await load(browser,locks)).count,8);assert.deepEqual(methods,['GET','POST','GET']);
 date='2026-10-21';await load(browser,locks);assert.deepEqual(methods,['GET','POST','GET','GET','POST']);
});
