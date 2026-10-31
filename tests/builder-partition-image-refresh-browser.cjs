const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const settings=require('../data/bathroom-builder-image-settings.generated.json');
const base=process.env.BUILDER_TEST_URL||'http://127.0.0.1:3000';
const key='bath-designer-selections-v2';
const cases=[['full-partition','풀 파티션'],['half-partition','하프 파티션'],['bathtub-partition','욕조 파티션']];
(async()=>{
 fs.mkdirSync('tests/artifacts/partition-image-refresh',{recursive:true});
 const browser=await chromium.launch({channel:'chrome'});
 try{
  for(const mode of ['consumer','professional'])for(const width of [390,1366]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:true,reducedMotion:'reduce'});
   await context.route('**/api/**',r=>r.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/');
   await page.evaluate(({key,mode})=>localStorage.setItem(key,JSON.stringify({version:3,current:1,values:{tile:'ivory'},memo:'기존 메모',projectInfo:{projectName:'파티션 사진 확인',builderMode:mode}})),{key,mode});
   await page.goto(base+'/design?step=2');
   await page.locator('.progressHeading').getByText('자동 저장됨').waitFor({state:'attached'});
   const group=page.locator('.choiceGroup:has(#builder-partitionShower-content)');
   if(!await group.isVisible())await page.locator('.mobileBuilderNav:visible').getByRole('button',{name:'다음 항목 →',exact:true}).click();
   for(const[id,name]of cases){
    const image=settings['partitionShower:'+id].builderImage;
    assert.ok(decodeURIComponent(image).includes('/structure/partition/'));
    const response=await context.request.get(base+image);assert.equal(response.status(),200);
    assert.ok((await response.body()).equals(fs.readFileSync('public'+decodeURIComponent(image))));
    await group.getByRole('radio',{name,exact:true}).tap();
    await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).values.partitionShower===id,{key,id});
    const toggle=page.locator('.builderPreviewPanel>.builderDisclosureToggle');
    if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
    let hero;
    if(width<1200){
     await page.waitForFunction(name=>document.querySelector('.builderSwipeLabel')?.textContent===name,name);
     const index=await page.locator('.builderSwipeTrack').evaluate(e=>Math.round(e.scrollLeft/e.clientWidth));
     hero=page.locator('.builderSwipeSlide img').nth(index);
    }else hero=page.locator('.selectedHeroImage img');
    await hero.waitFor();await hero.evaluate(e=>e.decode());
    assert.equal(new URL(await hero.getAttribute('src'),base).pathname,image);
    const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.equal(saved.values.tile,'ivory');assert.equal(saved.memo,'기존 메모');
    assert.ok(saved.imageHistoryOrder.includes('partitionShower:'+id));
    assert.ok((await page.locator('.selectionHistoryStrip').textContent()).includes(name));
    await page.screenshot({path:`tests/artifacts/partition-image-refresh/${mode}-${width}-${id}.png`,fullPage:true,animations:'disabled'});
   }
   await page.reload();await page.locator('.progressHeading').getByText('자동 저장됨').waitFor({state:'attached'});
   assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).values.partitionShower,key),'bathtub-partition');
   assert.deepEqual(errors,[]);console.log('PASS',mode,width,'three original images, card selection, hero/history, HTTP bytes, saved values/reload');await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
