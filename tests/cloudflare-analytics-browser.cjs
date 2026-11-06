const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const local=process.env.BUILDER_TEST_URL||'http://127.0.0.1:3257';
assert.equal(new URL(local).hostname,'127.0.0.1','Isolated server required');
const enabled=process.env.ANALYTICS_TEST_ENABLED==='1';
const origin='https://test-beta-ten-79.vercel.app';

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const mobile=process.env.ANALYTICS_TEST_MOBILE==='1';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
  const nextStep=async()=>{
   const desktop=page.locator('.navButtons:visible');
   if(await desktop.count())return desktop.getByRole('button',{name:'다음',exact:true}).click();
   const nav=page.locator('.mobileBuilderNav:visible'),skip=nav.getByRole('button',{name:'현재 STEP 전체 건너뛰기',exact:true});
   if(await skip.isVisible())return skip.click();
   return nav.locator('button.button').click();
  };
  const beacons=[],scriptRequests=[],errors=[];page.on('pageerror',e=>errors.push(e.name));
  // Only a pre-fetched official public script may run; every beacon is local.
  const vendor=enabled?fs.readFileSync(process.env.CLOUDFLARE_BEACON_TEST_FILE,'utf8'):'';
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname==='static.cloudflareinsights.com'){
    scriptRequests.push(u.pathname);assert.equal(u.pathname,'/beacon.min.js');return route.fulfill({contentType:'text/javascript',body:vendor});
   }
   if(u.hostname==='cloudflareinsights.com'||u.pathname.includes('/cdn-cgi/rum')){
    const body=req.postData()||'';if(req.method()==='POST')beacons.push({body,referer:req.headers().referer||''});
    return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'}});
   }
   if(u.origin===origin){
    const response=await route.fetch({url:local+u.pathname+u.search});
    // A test-only Next Link fixture exercises the public -> excluded root
    // transition. No administrator link is added to the shipping website.
    if(u.pathname==='/'&&u.searchParams.has('admin-link-fixture'))return route.fulfill({response,body:(await response.text()).replaceAll('/design','/admin/login')});
    return route.fulfill({response});
   }
   if(u.origin===local)return route.continue();
   // Fonts/other third parties cannot create traffic during this test.
   if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
   return route.abort();
  });
  await context.addInitScript(()=>{window.__analyticsDocumentId=crypto.randomUUID();});
  await page.goto(local+'/');await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('script[data-cf-beacon]').count(),0,'Even enabled builds must not track localhost');
  await page.goto(origin+'/');await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('script[data-cf-beacon]').count(),enabled?1:0);
  const homeDocument=await page.evaluate(()=>window.__analyticsDocumentId);
  await page.getByRole('link',{name:'내 욕실 만들기',exact:false}).first().click();
  await page.waitForURL(origin+'/design');await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>window.__analyticsDocumentId),homeDocument,'Public sections retain Next.js client navigation');
  await page.getByRole('button',{name:'프로젝트 정보 입력하기',exact:true}).click();
  await page.locator('#project-name').fill('PRIVATE_ANALYTICS_TEST');
  await page.getByRole('button',{name:'욕실 만들기 시작',exact:true}).click();await page.locator('progress').waitFor();
  await page.locator('.choiceGroup:visible [role="radio"], .choiceGroup:visible [role="checkbox"]').first().click();
  const beforeStepRequests=scriptRequests.length;
  await nextStep();
  await page.waitForTimeout(400);
  assert.equal(scriptRequests.length,beforeStepRequests,'No extra script per STEP');
  const countViews=items=>new Set(items.map(item=>{try{const p=JSON.parse(item.body);return p.location?.endsWith('/design')?p.pageloadId:null}catch{return null}}).filter(Boolean)).size;
  assert.ok(countViews(beacons)<=1,'STEP must not create a new page load ID');
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bath-designer-selections-v2')));
  const selected=(await saved()).values;
  await page.locator('a[href="/"]').first().click();await page.waitForURL(origin+'/');
  await page.goBack();await page.waitForURL(origin+'/design');await page.locator('progress').waitFor();
  assert.deepEqual((await saved()).values,selected,'Back preserves selections');
  await page.goForward();await page.waitForURL(origin+'/');
  await page.goBack();await page.waitForURL(origin+'/design');await page.locator('progress').waitFor();
  assert.deepEqual((await saved()).values,selected,'Forward/back restores selections');
  await page.reload();await page.locator('progress').waitFor();assert.deepEqual((await saved()).values,selected,'Refresh preserves selections');
  const builderDocument=await page.evaluate(()=>window.__analyticsDocumentId);
  const reportLink=()=>page.locator('a[href^="/result"]:visible').first();
  for(let n=0;n<32&&!await reportLink().count();n++)await nextStep();
  assert.equal(await reportLink().count(),1);await reportLink().click();await page.locator('.consultationSheet').waitFor();
  assert.equal(await page.evaluate(()=>window.__analyticsDocumentId),builderDocument,'Consultation is a client navigation');
  assert.deepEqual((await saved()).values,selected,'Consultation preserves selection storage');
  await page.goBack();await page.waitForURL(origin+'/design');await page.locator('progress').waitFor();assert.deepEqual((await saved()).values,selected);
  await page.goForward();await page.locator('.consultationSheet').waitFor();await page.reload();await page.locator('.consultationSheet').waitFor();assert.deepEqual((await saved()).values,selected);
  await page.goto(origin+'/result?plan='+encodeURIComponent(JSON.stringify({sink:'other',sinkOther:'PRIVATE_ANALYTICS_TEST'}))+'&specialNotes=PRIVATE_ANALYTICS_TEST');
  await page.locator('.consultationSheet').waitFor();await page.waitForLoadState('networkidle');
  assert.notEqual(await page.evaluate(()=>window.__analyticsDocumentId),builderDocument);
  assert.ok((await page.locator('body').innerText()).includes('PRIVATE_ANALYTICS_TEST'));
  for(const item of beacons)assert.ok(!item.body.includes('PRIVATE_ANALYTICS_TEST')&&!item.referer.includes('PRIVATE_ANALYTICS_TEST'),'Private URL/form content must not leave');
  await page.goto(origin+'/guide');await page.waitForLoadState('networkidle');
  const guideDocument=await page.evaluate(()=>window.__analyticsDocumentId),guideScriptRequests=scriptRequests.length;
  await page.locator('a[href="/guide/tile"]').first().click();await page.waitForURL(origin+'/guide/tile');await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>window.__analyticsDocumentId),guideDocument,'Guide navigation retains its SPA document');
  assert.equal(scriptRequests.length,guideScriptRequests,'One script across guide SPA navigation');
  await page.goto(origin+'/?admin-link-fixture=1');await page.waitForLoadState('networkidle');
  const publicDocument=await page.evaluate(()=>window.__analyticsDocumentId),scriptsBeforeAdmin=scriptRequests.length;
  await page.locator('a[href="/admin/login"]:visible').first().click();await page.waitForURL(origin+'/admin/login');await page.waitForLoadState('networkidle');
  assert.notEqual(await page.evaluate(()=>window.__analyticsDocumentId),publicDocument,'Excluded root must unload the public beacon');
  assert.equal(await page.evaluate(()=>typeof window.__cfBeacon),'undefined');
  assert.equal(scriptRequests.length,scriptsBeforeAdmin);assert.equal(await page.locator('script[data-cf-beacon]').count(),0);
  for(const path of ['/admin','/admin/login','/admin/setup-password','/api/admin/visitors']){
   const before=scriptRequests.length,response=await page.goto(origin+path);await page.waitForLoadState('networkidle');
   assert.equal(response.status(),404);assert.equal(await page.locator('script[data-cf-beacon]').count(),0);assert.equal(scriptRequests.length,before);
  }
  // Confirm the pre-existing unit failure is a fixture assumption, not an
  // uncaught browser error: reset intentionally removes the persisted key.
  await page.goto(origin+'/design');await page.locator('progress').waitFor();
  const rawBeforeReset=await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2'));
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'처음부터 다시 만들기',exact:true}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2')),rawBeforeReset);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'처음부터 다시 만들기',exact:true}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2')),null);
  await page.getByRole('button',{name:'프로젝트 정보 입력하기',exact:true}).click();
  assert.equal(await page.locator('#project-name').inputValue(),'');
  for(const item of beacons){assert.ok(!item.body.includes('/admin'));assert.ok(!item.referer.includes('/admin'));}
  if(enabled){
   assert.ok(beacons.length>0,'Official script must produce intercepted metrics');assert.ok(scriptRequests.length>=3);
   const locations=new Set(beacons.map(item=>JSON.parse(item.body).location));
   for(const path of ['/','/design','/result','/guide','/guide/tile'])assert.ok(locations.has(origin+path),'Expected clean measured path: '+path);
   for(const item of beacons)assert.ok(!item.body.includes('PRIVATE_ANALYTICS_TEST')&&!item.referer.includes('PRIVATE_ANALYTICS_TEST'));
  }
  else {assert.equal(beacons.length,0);assert.equal(scriptRequests.length,0);}
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({mode:enabled?'simulated-production-offline':process.env.ANALYTICS_TEST_BUILD_KIND==='preview'?'simulated-preview-disabled':'no-token-disabled',device:mobile?'mobile':'desktop',homeBuilderReport:true,publicClientNavigation:true,historyAndRefreshPreserveState:true,adminBoundaryUnloadsBeacon:true,stepNoExtraPageview:true,privateMarkerNotTransmitted:true,interceptedBeacons:beacons.length,realCloudflareWrites:0}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.name+': '+error.message);process.exitCode=1;});
