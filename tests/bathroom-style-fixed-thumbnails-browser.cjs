const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const before=process.argv.includes('--before');
const output='tests/artifacts/bathroom-style-fixed-thumbnails';
const load=p=>{const c={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c);return c.exports};
const {bathroomStyles}=load('data/bathroom-style-examples.ts');
const {bathroomStyleContent,bathroomStyleContentGroups,bathroomStyleNotice}=load('data/bathroom-style-content.ts');
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'chrome'});const results=[];
 try{
 for(const[width,height]of before?[[390,844],[1366,768]]:[[375,812],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<768});await context.route('**/api/**',r=>r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto((process.env.BUILDER_TEST_URL||'http://localhost:3120')+"/design");
  const cards=page.locator('button[aria-haspopup="dialog"]');
  for(let type=0;type<3;type++){
   const style=bathroomStyles[type];await cards.nth(type).click();const modal=page.getByRole('dialog'),thumbs=modal.locator('[data-gallery-thumbnail]');
   await modal.waitFor();await modal.locator('[data-gallery-main] img').evaluate(e=>e.decode());
   const mainBox=await modal.locator('[data-gallery-main] img').boundingBox();
   if(before){
    results.push({width,height,type,thumbnailCount:await thumbs.count(),mainBox});
    await page.screenshot({path:`${output}/before-${width}-${style.id}.png`});
   }else{
    const expectedOrder=Array.from(style.examples,e=>e.title+' 보기');
    const initialBoxes=await thumbs.evaluateAll(es=>es.map(e=>({w:e.offsetWidth,h:e.offsetHeight,x:e.offsetLeft,y:e.offsetTop})));
    assert.equal(await thumbs.count(),style.examples.length);
    assert.equal(await thumbs.first().getAttribute('aria-pressed'),'true');
    for(let index=0;index<style.examples.length;index++){
     const example=style.examples[index];
     await thumbs.nth(index).focus();await page.keyboard.press(index%2?'Space':'Enter');
     assert.ok(await thumbs.nth(index).evaluate(e=>e===document.activeElement));
     assert.deepEqual(await thumbs.evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),expectedOrder);
     assert.deepEqual(await thumbs.evaluateAll(es=>es.map(e=>({w:e.offsetWidth,h:e.offsetHeight,x:e.offsetLeft,y:e.offsetTop}))),initialBoxes,'selection must not alter item size/order/layout');
     assert.equal(await thumbs.filter({has:page.locator('[data-thumbnail-check]')}).count(),1);
     assert.equal(await modal.locator('[data-gallery-thumbnail][aria-pressed="true"]').count(),1);
     assert.equal(await thumbs.nth(index).getAttribute('aria-pressed'),'true');
     const main=modal.locator('[data-gallery-main]');
     assert.equal(await main.getAttribute('data-example-title'),example.title);
     assert.equal(await main.locator('img').getAttribute('src'),example.image.src);
     assert.equal(await modal.locator('h3').textContent(),example.title);
     const groups=bathroomStyleContentGroups(bathroomStyleContent[example.id]);
     const info=modal.locator('#style-example-detail > [class*="information"]');
     assert.deepEqual(await info.locator('h4').allTextContents(),Array.from(groups,g=>g.title));
     for(let n=0;n<groups.length;n++)assert.deepEqual(await info.locator('section').nth(n).locator('li').allTextContents(),Array.from(groups[n].items));
     assert.equal(await info.locator('[data-style-notice]').textContent(),bathroomStyleNotice);
     assert.equal(await modal.locator('img').count(),style.examples.length+1);
     assert.equal(await modal.locator('img').evaluateAll((es,src)=>es.filter(e=>e.getAttribute('src')===src).length,example.image.src),2,'only one main plus one small selected thumbnail');
     assert.equal(await main.locator('img').evaluate(e=>getComputedStyle(e).objectFit),'contain');
     const decoration=await thumbs.nth(index).evaluate(e=>({border:getComputedStyle(e).borderWidth,font:getComputedStyle(e.querySelector('[data-thumbnail-name]')).fontWeight}));
     assert.equal(decoration.border,'2px');assert.equal(decoration.font,'600');
     await thumbs.nth(index).click();assert.equal(await main.getAttribute('data-example-title'),example.title);
     if(width>=768){await thumbs.nth((index+1)%style.examples.length).hover();assert.equal(await main.getAttribute('data-example-title'),example.title);}
     if(width<768){await thumbs.nth(index).tap();assert.equal(await main.getAttribute('data-example-title'),example.title);}
    }
    await modal.locator('[class*="dialogBody"]').evaluate(e=>e.scrollTop=0);
    if(width<768)await thumbs.last().scrollIntoViewIfNeeded();
    assert.ok(await thumbs.last().isVisible());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false);
    assert.equal(await thumbs.locator('[data-magnifier]').count(),0);
    results.push({width,height,type,thumbnailCount:await thumbs.count(),mainBox,selectedCount:1});
    await page.screenshot({path:`${output}/after-${width}-${style.id}.png`});
   }
   await page.mouse.move(0,0);await page.getByRole('button',{name:'상세 정보 닫기'}).click();await modal.waitFor({state:'hidden'});
   assert.ok(await cards.nth(type).evaluate(e=>e===document.activeElement));
  }
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.getItem('bath-designer-selections-v2')),null);
  if(!before){await page.getByRole('button',{name:'프로젝트 정보 입력하기',exact:true}).click();await page.locator('#project-name').waitFor();}
  await context.close();
 }
 fs.writeFileSync(`${output}/${before?'before':'after'}.json`,JSON.stringify(results,null,2));console.log('PASS',before?'before capture':'fixed 2/3/2 thumbnails, stable geometry/order, one selection, exact photos/content, keyboard/touch/hover, no overflow',results.length);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
