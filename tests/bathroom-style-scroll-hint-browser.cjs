const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const engines=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'bath-cloudflare-browser-tests/node_modules/playwright-core'));
const engine=process.env.STYLE_HINT_ENGINE||'chromium',base=process.env.BUILDER_TEST_URL||'http://127.0.0.1:3281';
assert.equal(new URL(base).hostname,'127.0.0.1','isolated local server required');
assert.ok(['chromium','webkit'].includes(engine));
const output='tests/artifacts/style-scroll-hint';fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await engines[engine].launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
 const rows=[];
 try{
  for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[412,915],[667,375],[844,390],[1440,900]]){
   const mobile=width<1000;
   const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
   const errors=[],remote=[];const fonts=require('./helpers/font-response-cache.cjs')(errors);
   await context.route('**/*',async route=>{if(await fonts(route))return;if(new URL(route.request().url()).origin===base)return route.continue();remote.push(route.request().url());return route.abort();});
   const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('Unexpected dialog: '+d.message());d.dismiss();});
   const modal=page.getByRole('dialog'),body=modal.getByRole('region',{name:'욕실 구성 상세 내용',exact:true}),info=modal.locator('#style-example-information');
   const hint=()=>modal.getByRole('button',{name:'상세 구성 보기',exact:true}),close=()=>modal.getByRole('button',{name:'상세 정보 닫기',exact:true});
   const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   let expectedOuter;
   async function resize(size){await page.setViewportSize(size);await settle();expectedOuter=await page.evaluate(()=>scrollY);}
   async function state(){
    await settle();
    return modal.evaluate(dialog=>{
     const body=dialog.querySelector('[aria-label="욕실 구성 상세 내용"]'),detail=dialog.querySelector('#style-example-information'),title=detail.querySelector('h3');
     const button=dialog.querySelector('button[aria-controls="style-example-information"]');
     const bottom=Math.min(body.getBoundingClientRect().bottom,visualViewport?visualViewport.offsetTop+visualViewport.height:innerHeight);
     return {below:matchMedia('(max-width:767px)').matches&&title.getBoundingClientRect().top>=bottom&&body.scrollHeight>body.clientHeight,shown:!!button?.getClientRects().length,focused:button===document.activeElement,scrollTop:body.scrollTop};
    });
   }
   async function sync(){await page.waitForFunction(()=>{
    const dialog=document.querySelector('dialog[open]'),body=dialog?.querySelector('[aria-label="욕실 구성 상세 내용"]'),detail=dialog?.querySelector('#style-example-information');if(!body||!detail)return false;
    const button=dialog.querySelector('button[aria-controls="style-example-information"]'),bottom=Math.min(body.getBoundingClientRect().bottom,visualViewport?visualViewport.offsetTop+visualViewport.height:innerHeight);
    const below=matchMedia('(max-width:767px)').matches&&detail.querySelector('h3').getBoundingClientRect().top>=bottom&&body.scrollHeight>body.clientHeight;
    return !!button?.getClientRects().length===(below||button===document.activeElement);
   });}
   async function top(){await close().focus();await body.evaluate(e=>e.scrollTo({top:0,behavior:'instant'}));await sync();}
   async function wheel(delta){
    if(engine==='webkit'&&mobile){
     // Playwright cannot dispatch wheel input to mobile WebKit. Exercise its
     // real overflow scroller; physical iOS touch gestures remain a device check.
     await body.evaluate((e,amount)=>e.scrollBy({top:amount,behavior:'instant'}),delta);
    }else{const rect=await body.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.wheel(0,delta);}
    await settle();
   }
   await page.goto(base+'/design');await page.locator('#style-preview-title').waitFor();
   await page.evaluate(()=>window.scrollTo(0,60));const outer=await page.evaluate(()=>scrollY);expectedOuter=outer;
   await page.evaluate(()=>{window.externalScrollCalls=0;const scroll=window.scrollTo;window.scrollTo=function(...args){window.externalScrollCalls++;return scroll.apply(this,args);};});
   const trigger=page.locator('button[aria-haspopup="dialog"]').first();await trigger.click();await modal.waitFor();
   await modal.locator('[data-gallery-main] img').evaluate(e=>e.decode());await page.evaluate(()=>document.fonts.ready);await sync();
   // Native trigger scrolling can precede showModal (not the new hint action).
   // Compare internal navigation against the settled, open modal position.
   expectedOuter=await page.evaluate(()=>scrollY);
   const initial=await state();assert.equal(initial.shown,initial.below);
   assert.equal(await modal.evaluate(d=>[...d.querySelectorAll('*')].filter(e=>e.clientHeight>0&&e.scrollHeight>e.clientHeight+1&&/auto|scroll/.test(getComputedStyle(e).overflowY)).length),1,'one vertical scroller');
   assert.equal(await page.evaluate(()=>scrollY),expectedOuter);
   if(width<=767){
    // Simulates reduced available height / mobile browser chrome.
    await resize({width,height:Math.min(height,500)});await top();await hint().waitFor();
    const bounds=await hint().boundingBox(),b=await body.boundingBox(),d=await modal.boundingBox();
    assert.ok(bounds.height>=44);assert.ok(bounds.y>=b.y+b.height);assert.ok(bounds.y+bounds.height<=d.y+d.height);
    assert.equal(await hint().getAttribute('aria-controls'),'style-example-information');
    assert.equal(await hint().getAttribute('aria-live'),null,'no repeated live announcement');
    await body.evaluate(e=>{const original=e.scrollTo;e.scrollTo=function(options){window.hintScrollOptions=options;return original.call(this,options);};});
    await hint().focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.activeElement?.id==='style-example-information');
    await hint().waitFor({state:'hidden'});
    await page.waitForFunction(()=>{const e=document.getElementById('style-example-information'),b=e.closest('[aria-label="욕실 구성 상세 내용"]');return e.querySelector('h3').getBoundingClientRect().top>=b.getBoundingClientRect().top&&e.querySelector('h3').getBoundingClientRect().bottom<=b.getBoundingClientRect().bottom;});
    assert.equal(await page.evaluate(()=>window.hintScrollOptions.behavior),'smooth');assert.equal(await page.evaluate(()=>scrollY),expectedOuter);
    const header=await modal.locator('[class*=dialogHeader]').boundingBox(),title=await info.locator('h3').boundingBox();assert.ok(title.y>=header.y+header.height);
    await page.keyboard.press('Tab');assert.equal(await modal.getByRole('button',{name:'이 구성으로 상담서 만들기',exact:true}).evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Tab');assert.equal(await close().evaluate(e=>e===document.activeElement),true,'existing focus trap wraps');
    await top();await hint().waitFor();await wheel(700);await hint().waitFor({state:'hidden'});assert.equal(await close().evaluate(e=>e===document.activeElement),true,'manual scroll never moves focus');
    await wheel(-2000);await page.waitForFunction(()=>document.querySelector('[aria-label="욕실 구성 상세 내용"]').scrollTop===0);await hint().waitFor();
    // A focused hint stays mounted until blur instead of dropping keyboard focus.
    await hint().focus();await wheel(700);assert.equal(await hint().evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');await hint().waitFor({state:'hidden'});
    await top();await page.emulateMedia({reducedMotion:'reduce'});await hint().click();await hint().waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.hintScrollOptions.behavior),'instant');await page.emulateMedia({reducedMotion:'no-preference'});
    // Every composition item remains reachable without footer/header overlap.
    await close().focus();
    for(const item of await info.locator('li').all()){await item.scrollIntoViewIfNeeded();const r=await item.boundingBox(),viewport=await body.boundingBox();assert.ok(r.y>=viewport.y-1&&r.y+r.height<=viewport.y+viewport.height+1);}
    const cta=modal.getByRole('button',{name:'이 구성으로 상담서 만들기',exact:true});await cta.scrollIntoViewIfNeeded();const last=await cta.boundingBox(),viewport=await body.boundingBox();assert.ok(last.y+last.height<=viewport.y+viewport.height+1);assert.equal(await hint().count(),0);
    await top();const second=modal.locator('[data-gallery-thumbnail]').nth(1);const name=(await second.getAttribute('aria-label')).replace(/ 보기$/,'');await second.click();assert.equal(await info.locator('h3').textContent(),name);await top();await hint().waitFor();
    await modal.locator('[data-gallery-main]').tap();await modal.getByRole('button',{name:'확대 보기 닫기',exact:true}).waitFor();assert.equal(await hint().count(),0);assert.equal(await body.isVisible(),false);
    await page.keyboard.press('Escape');await close().waitFor();await sync();assert.equal(await modal.locator('[data-gallery-main]').evaluate(e=>e===document.activeElement),true);
    await resize({width,height:1400});await top();assert.equal(await hint().count(),0,'already visible details need no hint');
    await resize({width:767,height:480});await top();await hint().waitFor();await resize({width:768,height:480});await sync();assert.equal(await hint().count(),0,'desktop breakpoint');
    await resize({width,height});await top();
   }else assert.equal(await hint().count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(()=>scrollY),expectedOuter);assert.equal(await page.evaluate(()=>window.externalScrollCalls),0,'modal navigation never calls window.scrollTo');
   await page.screenshot({path:`${output}/${engine}-${width}.png`});
   await close().click();await modal.waitFor({state:'hidden'});assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
   await trigger.click();await modal.waitFor();await sync();assert.equal((await state()).shown,(await state()).below);await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
   if(width===320){
    await trigger.click();await modal.waitFor();const before=await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2'));await modal.getByRole('button',{name:'이 구성으로 상담서 만들기',exact:true}).click();
    try{await page.locator('.consultationSheet').waitFor();}catch(error){fs.writeFileSync(`${output}/${engine}-draft-error.json`,JSON.stringify({url:page.url(),text:(await page.locator('body').innerText()).slice(0,1800),errors},null,2));throw error;}
    assert.ok(new URL(page.url()).searchParams.get('styleDraft'));assert.equal(await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2')),before);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);rows.push({engine,width,height,initial,passed:true});await context.close();console.log('PASS '+engine+' '+width+'x'+height+': visibility, inner scroll, motion, focus, zoom, examples, resize, reopen and content access');
  }
  fs.writeFileSync(`${output}/${engine}-results.json`,JSON.stringify(rows,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
