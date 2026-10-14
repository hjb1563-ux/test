const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BUILDER_TEST_URL||'http://localhost:3000', key='bath-designer-selections-v2';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 fs.mkdirSync('tests/artifacts/mobile-simplification',{recursive:true});
 const group=()=>page.locator('.choiceGroup:visible'),nav=()=>page.locator('.mobileBuilderNav');
 async function seed(step=1,mode='consumer',values={}){await page.goto(base+'/design');await page.locator('.projectInfoForm,.builderCompactFlow').first().waitFor();await page.evaluate(({key,step,mode,values})=>localStorage.setItem(key,JSON.stringify({version:3,current:step-1,values,projectInfo:{projectName:'홍길동 고객님 욕실',customerName:'홍길동',builderMode:mode}})),{key,step,mode,values});await page.goto(base+'/design?step='+step);await page.locator('.builderCompactFlow').waitFor();}
 async function layout(){return page.evaluate(()=>{const cs=s=>getComputedStyle(document.querySelector(s));return {overflow:document.documentElement.scrollWidth>innerWidth,selectionOverflow:cs('.builderSelectionScroll').overflowY,nav:cs('.mobileBuilderNav').position,summaryOverflow:cs('.builderSummaryPanel>.builderDisclosureBody').overflowY,columns:cs('.designGrid').gridTemplateColumns,mainHeight:cs('.builderCompactFlow').height};});}
 async function next(){await nav().locator('.button').click();}
 async function screenshot(name){await page.screenshot({path:'tests/artifacts/mobile-simplification/'+name+'.png',fullPage:true,animations:'disabled'});}
 try {
  for(const [width,height] of [[430,932],[390,844],[375,812]]){
   await page.setViewportSize({width,height});await seed();
   const l=await layout();assert.equal(l.overflow,false);assert.equal(l.selectionOverflow,'visible');assert.equal(l.nav,'static');assert.equal(l.summaryOverflow,'visible');
   for(const selector of ['.builderSummaryPanel','.builderPhase','.progressHeading small','.builderProgress>.resumeLink','.builderSectionPosition','.projectIdentity small','.mobileBuilderNav>span','.builderCompactSkip','.mobileBuilderNav>.secondary:first-child'])assert.equal(await page.locator(selector).first().isVisible(),false,selector);
   assert.equal(await group().count(),1);assert.equal(await group().getByRole('checkbox').count(),4);
   await screenshot('step01-'+width+'x'+height);
   for(let n=0;n<3;n++)await group().getByRole('checkbox').nth(n).click();
   assert.equal(await page.locator('.builderSummaryPanel').isVisible(),false);
   await group().getByRole('checkbox').nth(3).click();await page.locator('.builderCustomText input').fill('모바일 기타 입력');assert.ok((await page.locator('.summary').textContent()).includes('모바일 기타 입력'));
   await next();await page.waitForFunction(()=>document.querySelector('progress').value===2);assert.equal(await group().locator('.builderSectionPosition').textContent(),'1 / 3');
   await group().getByRole('checkbox').nth(3).click();assert.equal(await group().locator('.builderSectionPosition').textContent(),'1 / 3');assert.equal(await page.locator('.builderSwipeGallery').isVisible(),true);
   await next();assert.equal(await group().locator('.builderSectionPosition').textContent(),'2 / 3');assert.equal(await page.locator('.selectedHeroImage').count(),0);assert.equal(await page.locator('.selectionHistory>.builderDisclosureToggle').isVisible(),false);
   await nav().locator('.secondary').first().click();assert.equal(await group().getByRole('checkbox').nth(3).getAttribute('aria-checked'),'true');
   await seed(4);assert.equal(await page.locator('progress').getAttribute('max'),'13');assert.equal(await page.locator('.builderSwipeEmpty').isVisible(),true);
   await group().getByRole('radio').first().click();assert.equal(await page.locator('.builderSwipeGallery').isVisible(),true);assert.equal(await group().locator('.builderSectionPosition').textContent(),'1 / 3');await next();await group().getByRole('radio').first().click();await screenshot('tile-'+width+'x'+height);
   await next();assert.equal(await page.locator('.selectedHeroImage').count(),0);await group().getByRole('radio').first().click();assert.ok((await page.locator('.builderSwipeSlide img').first().getAttribute('src')).includes('tile'));
   await seed(3,'professional');assert.equal(await page.locator('progress').getAttribute('max'),'15');assert.equal((await layout()).selectionOverflow,'visible');await group().getByRole('radio').first().click();await screenshot('professional-'+width+'x'+height);
   await seed(16);assert.equal(await page.locator('progress').getAttribute('value'),'13');assert.ok((await nav().locator('.button').textContent()).includes('상담서 보기'));await nav().locator('.button').click();await page.locator('.consultationSheet').waitFor();
   console.log('PASS mobile '+width+'x'+height);
  }
  for(const [width,height] of [[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080]]){
   await page.setViewportSize({width,height});await seed(2);const l=await layout();assert.equal(l.overflow,false);
   if(width<1200){assert.equal(l.nav,'sticky');assert.equal(l.selectionOverflow,'auto');assert.equal(await group().count(),1);}else{assert.equal(l.columns.split(' ').length,3);assert.equal(await group().count(),3);assert.equal(await page.locator('.builderSummaryPanel').isVisible(),true);}
   await screenshot('regression-'+width+'x'+height);console.log('PASS tablet/desktop '+width+'x'+height);
  }
  await page.setViewportSize({width:390,height:844});await seed(9,'consumer');await next();await group().getByRole('checkbox').nth(0).click();await group().getByRole('checkbox').nth(1).click();assert.equal(await group().locator('[aria-checked=true]').count(),2);await page.reload();await page.locator('.builderCompactFlow').waitFor();await next();assert.equal(await group().locator('[aria-checked=true]').count(),2);
  await page.goto(base+'/design?step=4&returnTo=consultation');await page.locator('.builderCompactFlow').waitFor();await group().getByRole('radio').first().click();await page.locator('.builderConsultationEdit a').click();await page.locator('.consultationSheet').waitFor();
  await seed(2);await group().getByRole('checkbox').nth(3).click();await next();
  assert.equal(await page.locator('.builderSwipeTrack').count(),0);assert.equal(await page.locator('.builderSwipeEmpty').isVisible(),true);
  await next();assert.equal(await page.locator('.selectedHeroImage').count(),0);
  await nav().locator('.builderCompactSkip').click();assert.equal(await page.locator('progress').getAttribute('value'),'3');
  await seed();await group().getByRole('checkbox').nth(3).click();await page.locator('.builderCustomText input').fill('keyboard viewport');await page.setViewportSize({width:390,height:500});assert.equal((await layout()).nav,'static');await nav().locator('.button').scrollIntoViewIfNeeded();assert.equal(await nav().locator('.button').isVisible(),true);
  await page.locator('.projectIdentity button').click();await page.locator('.projectInfoForm').waitFor();await page.goBack().catch(()=>{});await seed();
  page.once('dialog',d=>d.accept());await page.locator('.designHeader button').click();await page.locator('.projectInfoForm').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS selection, preview resolver, history, other input, storage, skip, project edit, reset, short viewport, consultation return, runtime');
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
