const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output='tests/artifacts/bathroom-style-magnifier';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'chrome'});
 const results=[];
 try{
 for(const deviceScaleFactor of [1,1.25,2]){
  const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor});
  await context.route('**/api/**',r=>r.abort());const page=await context.newPage();
  await page.goto((process.env.BUILDER_TEST_URL||'http://localhost:3120')+"/design");
  const card=page.locator('button[aria-haspopup="dialog"]').nth(1);await card.click();
  const modal=page.getByRole('dialog'),main=modal.locator('[data-gallery-main]'),lens=main.locator('[data-magnifier]');
  await main.locator('img').evaluate(e=>e.decode());
  const check=async()=>{
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const r=await main.locator('img').boundingBox();
   await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await lens.waitFor();
   await page.waitForFunction(()=>{const p=document.querySelector('[data-magnifier]').style.backgroundPosition.split(' ').map(parseFloat);const e=document.querySelector('[data-gallery-main] img'),r=e.getBoundingClientRect(),s=Math.min(r.width/e.naturalWidth,r.height/e.naturalHeight);return Math.abs(p[0]-(90-e.naturalWidth*s*.7))<.1&&Math.abs(p[1]-(90-e.naturalHeight*s*.7))<.1});
  };
  await check();
  await modal.locator('[class*="dialogBody"]').evaluate(e=>e.scrollTop=80);await check();
  await page.setViewportSize({width:1024,height:768});await check();
  await page.setViewportSize({width:1440,height:900});await check();
  // Touch input on a fine-hover primary pointer must use the preserved touch viewer.
  assert.ok(await page.evaluate(()=>matchMedia('(hover:hover) and (pointer:fine)').matches));
  await main.dispatchEvent('pointerdown',{pointerType:'touch'});
  await main.dispatchEvent('click',{detail:1});
  await page.getByRole('button',{name:'확대 보기 닫기'}).waitFor();
  assert.equal(await page.locator('[data-magnifier]:not([hidden])').count(),0);
  await page.getByRole('button',{name:'확대 보기 닫기'}).click();
  await page.mouse.move(0,0);
  for(let n=0;n<12;n++)await modal.locator('[data-gallery-thumbnail]').nth((n+1)%3).click();
  assert.equal(await modal.locator('img').count(),4);assert.equal(await main.getAttribute('data-example-title'),await modal.locator('h3').textContent());
  await page.mouse.move(0,0);await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});await card.click();
  assert.equal(await main.getAttribute('data-example-title'),'기본형 01');
  await lens.waitFor({state:'hidden'});
  results.push({deviceScaleFactor,scrollAndResizeCoordinates:true,syntheticHybridTouch:true,rapidSwitches:12,reopenReset:true});await context.close();
 }
 fs.writeFileSync(`${output}/input-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
