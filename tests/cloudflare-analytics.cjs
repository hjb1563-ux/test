const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const analytics=require('../data/cloudflare-analytics.ts');
// Synthetic unit fixture only; never put this value in configuration or send it.
const fixtureToken='a'.repeat(32),env={NODE_ENV:'production',VERCEL_ENV:'production',CLOUDFLARE_WEB_ANALYTICS_TOKEN:fixtureToken};
test('only explicit Vercel Production with a public site-token shape enables analytics',()=>{
 assert.equal(analytics.cloudflareSiteToken(env),fixtureToken);
 for(const patch of [{VERCEL_ENV:'preview'},{VERCEL_ENV:'development'},{VERCEL_ENV:undefined},{NODE_ENV:'development'},{CLOUDFLARE_WEB_ANALYTICS_TOKEN:undefined},{CLOUDFLARE_WEB_ANALYTICS_TOKEN:''},{CLOUDFLARE_WEB_ANALYTICS_TOKEN:'sb_secret_never_accept_api_secrets'},{CLOUDFLARE_WEB_ANALYTICS_TOKEN:'<script>'}])assert.equal(analytics.cloudflareSiteToken({...env,...patch}),null);
});
test('exact HTTPS Production hostname and known public paths only; admin/referrer fail closed',()=>{
 for(const path of ['/','/design','/result?plan=PRIVATE&specialNotes=PRIVATE#PRIVATE','/guide/tile'])assert.equal(analytics.analyticsLocationAllowed('https://test-beta-ten-79.vercel.app'+path),true);
 for(const url of ['http://test-beta-ten-79.vercel.app','http://localhost:3000','https://127.0.0.1','https://test-preview.vercel.app','https://test-beta-ten-79.vercel.app.evil.invalid','https://test-beta-ten-79.vercel.app:444/','https://test-beta-ten-79.vercel.app/admin','https://test-beta-ten-79.vercel.app/admin/login','https://test-beta-ten-79.vercel.app/admin/setup-password','https://test-beta-ten-79.vercel.app/api/admin/visitors','https://test-beta-ten-79.vercel.app/guide/private-customer','invalid'])assert.equal(analytics.analyticsLocationAllowed(url),false);
 assert.equal(analytics.analyticsLocationAllowed('https://test-beta-ten-79.vercel.app/','https://test-beta-ten-79.vercel.app/admin/login?token=PRIVATE'),false);
});

function componentFixture(href,referrer='',spa=false){
 let allowed=false,effect;const exports={};const jsx=(type,props)=>({type,props});
 const code=ts.transpileModule(fs.readFileSync('components/CloudflareAnalytics.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>name==='react'?{useState:()=>[allowed,value=>{allowed=value}],useEffect:fn=>{effect=fn}}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='next/script'?{default:'script'}:analytics,window:{location:{href}},document:{referrer}});
 const render=()=>exports.default({token:fixtureToken,spa});return {render,effect:()=>effect()};
}
test('one lazy official script with public token only, no customer data payload',()=>{
 const h=componentFixture('https://test-beta-ten-79.vercel.app/result?plan=PRIVATE&specialNotes=PRIVATE');assert.equal(h.render(),null);h.effect();const node=h.render();
 assert.equal(node.props.id,'bath-cloudflare-web-analytics');assert.equal(node.props.src,analytics.CLOUDFLARE_BEACON_SRC);assert.equal(node.props.strategy,'lazyOnload');assert.equal(node.props.type,'module');assert.equal(node.props.referrerPolicy,'origin');
 assert.equal(node.props['data-cf-beacon'],JSON.stringify({token:fixtureToken,spa:false}));assert.ok(!JSON.stringify(node).includes('PRIVATE'));
 for(let i=0;i<3;i++){h.effect();assert.equal(h.render().props.id,node.props.id);}
});
test('localhost and admin documents render no beacon; guides retain official SPA behavior',()=>{
 for(const url of ['http://localhost:3000/','https://test-beta-ten-79.vercel.app/admin/login']){const h=componentFixture(url);h.render();h.effect();assert.equal(h.render(),null);}
 const h=componentFixture('https://test-beta-ten-79.vercel.app/guide/tile','',true);h.render();h.effect();assert.equal(JSON.parse(h.render().props['data-cf-beacon']).spa,true);
});
test('separate root documents prevent beacon surviving a move into excluded URLs',()=>{
 assert.equal(fs.existsSync('app/layout.tsx'),false);
 for(const group of ['public','untracked'])assert.ok(fs.existsSync(`app/(${group})/layout.tsx`));
 assert.ok(!fs.readFileSync('app/(untracked)/layout.tsx','utf8').includes('<SiteDocument analytics'));
 assert.ok(fs.readFileSync('app/(untracked)/[...path]/page.tsx','utf8').includes('notFound()'));
 assert.ok(fs.readFileSync('app/(public)/layout.tsx','utf8').includes('analytics spa'));
 const component=fs.readFileSync('components/CloudflareAnalytics.tsx','utf8');assert.doesNotMatch(component,/sendBeacon|fetch\(|localStorage|sessionStorage|\.cookie|querySelector|useSearchParams/);
});
test('page relocation preserves feature code byte-for-byte except relative import depth',()=>{
 const {execFileSync}=require('node:child_process');
 for(const [oldPath,newPath]of [['app/page.tsx','app/(public)/page.tsx'],['app/design/page.tsx','app/(public)/design/page.tsx'],['app/result/page.tsx','app/(public)/result/page.tsx'],['app/guide/page.tsx','app/(public)/guide/page.tsx'],['app/guide/[slug]/page.tsx','app/(public)/guide/[slug]/page.tsx'],['app/guide/glossary/page.tsx','app/(public)/guide/glossary/page.tsx']]){
  const old=execFileSync('git',['show','e0b5496:'+oldPath],{encoding:'utf8'}).replace(/\r\n/g,'\n').replace(/from (['"])(\.\.\/[^'"]+)\1/g,(_,q,p)=>'from '+q+'../'+p+q);
  assert.equal(fs.readFileSync(newPath,'utf8').replace(/\r\n/g,'\n'),old,newPath);
 }
});
