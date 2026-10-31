const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load}=require('./bathroom-style-draft.cjs');
const {styleDraftValues}=load(path.resolve('data/bathroom-style-draft.ts'));
const {bathroomStyles}=load(path.resolve('data/bathroom-style-examples.ts'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.env.BUILDER_TEST_URL||'http://localhost:3120'),key='bath-designer-selections-v2';
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});fs.mkdirSync('tests/artifacts/style-draft',{recursive:true});
 try{
 for(const [width,height]of [[375,812],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080]]){
  if(process.env.DRAFT_WIDTHS&&!process.env.DRAFT_WIDTHS.split(',').includes(String(width)))continue;
  const context=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<768,permissions:['clipboard-read','clipboard-write']});await context.route('**/api/**',r=>r.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let flows=0;
  const go=url=>page.goto(url,{waitUntil:'domcontentloaded'});
  for(const mode of ['consumer','professional'])for(const style of bathroomStyles)for(const example of style.examples){
   if(![390,1366].includes(width)&&example.id!=='premium-02')continue;
   await go(base+'/');
   await page.evaluate(({key,mode})=>{localStorage.clear();sessionStorage.clear();if(mode==='professional')localStorage.setItem(key,JSON.stringify({version:3,current:3,projectInfo:{builderMode:mode,projectName:'Existing project'},values:{tile:'white',waterproofing:'combined-waterproofing'},memo:'Preserve memo',specialNotes:'Preserve notes',checks:{tile:'keep'}}));},{key,mode});
   await go(base+'/design');
   if(mode==='professional')await page.getByRole('button',{name:'욕실 스타일 미리보기',exact:true}).click();
   const before=await page.evaluate(k=>localStorage.getItem(k),key);
   await page.locator('button[aria-haspopup="dialog"]').nth(bathroomStyles.indexOf(style)).click();
   const modal=page.getByRole('dialog');await modal.getByRole('button',{name:example.title+' 보기',exact:true}).click();
   const button=modal.getByRole('button',{name:'이 구성으로 상담서 만들기'});await button.scrollIntoViewIfNeeded();
   const box=await button.boundingBox();assert.ok(box.height>=44&&box.width>150);
   assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false);
   if(mode==='consumer'&&example.id==='premium-02')await page.screenshot({path:`tests/artifacts/style-draft/button-${width}.png`});
   await button.focus();await page.keyboard.press('Enter');await page.locator('[data-style-draft-notice]').waitFor();
   const url=page.url(),id=new URL(url).searchParams.get('styleDraft');assert.ok(id);
   let record=await page.evaluate(id=>JSON.parse(sessionStorage.getItem('bath-designer-style-draft-v1:'+id)),id);
   assert.equal(record.exampleId,example.id);assert.deepEqual(record.project.values,styleDraftValues(example.id,mode));
   assert.equal(record.project.memo,'');assert.equal(record.project.specialNotes,'');assert.equal(record.project.projectInfo.projectName,mode==='professional'?'Existing project':'');
   assert.ok((await page.locator('[data-style-draft-notice]').textContent()).includes(example.title));
   assert.equal(await page.locator('.sheetStep').count(),mode==='consumer'?10:15);
   assert.equal(await page.locator('[data-selection-key]').count(),mode==='consumer'?18:24);
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),before);
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-style-draft-notice]').waitFor();
   await page.locator('#consultation-memo').fill('Draft memo');
   await page.getByRole('button',{name:'타일 수정',exact:true}).click();await page.locator('progress').waitFor();
   assert.ok(page.url().includes('styleDraft='+id));
   // Change the size through the existing STEP and verify its return value.
   const nextSize=example.id==='premium-01'?'300x600':'600x1200';
   const size=page.locator('[aria-labelledby="builder-wallTileSize-title"]').getByRole('radio',{name:nextSize==='300x600'?/300×600/:/600×1200/});
   await size.click();
   await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).first().click();await page.locator('[data-style-draft-notice]').waitFor();
   assert.equal(await page.locator('#consultation-memo').inputValue(),'Draft memo');
   record=await page.evaluate(id=>JSON.parse(sessionStorage.getItem('bath-designer-style-draft-v1:'+id)),id);
   assert.equal(record.project.values.wallTileSize,nextSize);
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),before);
   if(width===1366&&example.id==='premium-02'){
    await page.getByRole('button',{name:'공사 개요만 복사',exact:true}).click();assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('예시 기반 상담서 초안'));
    await page.getByRole('button',{name:'상담서 전체 복사',exact:true}).click();await page.getByText('상담서 전체가 PNG 이미지로 복사되었습니다.',{exact:true}).waitFor({timeout:60000});
    const png=await page.evaluate(async()=>{const items=await navigator.clipboard.read();const blob=await items.find(i=>i.types.includes('image/png')).getType('image/png');const b=await createImageBitmap(blob);return {width:b.width,height:b.height};});assert.ok(png.width>0);assert.ok(png.height>1000);
    await page.screenshot({path:`tests/artifacts/style-draft/result-${mode}.png`,fullPage:true});await page.emulateMedia({media:'print'});const pdf=await page.pdf({path:`tests/artifacts/style-draft/${mode}.pdf`,format:'A4',printBackground:true});assert.ok(pdf.length>10000);await page.emulateMedia({media:'screen'});
   }
   await go(base+'/result?styleDraft=expired');await page.locator('p[role="alert"]').waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),before);flows++;
  }
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}x${height}: ${flows} mode/example flows, exact mappings, refresh/edit/return, storage preservation, expired draft`);
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
