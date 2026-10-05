const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BUILDER_TEST_URL||'http://localhost:3111';const key='bath-designer-selections-v2';
const combos=require('../data/bathroom-builder-tile-images.generated.json');const settings=require('../data/bathroom-builder-image-settings.generated.json');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({hasTouch:true});await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());
 const errors=[];const imageErrors=[];let page;
 const group=name=>page.locator('.choiceGroup:has(#builder-'+name+'-content)');
 async function seed(index,values={}){await page.evaluate(({key,index,values})=>localStorage.setItem(key,JSON.stringify({version:3,current:index,values,memo:'메모 보존',checks:{},specialNotes:'특이사항'})),{key,index,values});await page.goto(base+'/design?step='+(index+1),{waitUntil:'domcontentloaded'});await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();await page.waitForFunction(index=>document.querySelector('progress')?.value===index+1,index);}
 async function choose(name,label){const section=group(name),toggle=section.locator('.builderSectionToggle');if(await toggle.isVisible()&&await section.getAttribute('data-open')==='false')await toggle.click();await section.getByRole('radio',{name:label,exact:true}).click();}
 async function openPreview(){for(const selector of ['.builderPreviewPanel','.selectionHistory']){const section=page.locator(selector),toggle=section.locator('>.builderDisclosureToggle');if(await section.count()&&await toggle.isVisible()&&await section.getAttribute('data-open')==='false')await toggle.click();}}
 async function hero(url){await openPreview();const img=page.locator('.selectedHeroImage img');await img.waitFor();assert.equal(new URL(await img.getAttribute('src'),base).pathname,url);await img.evaluate(async img=>{if(!img.complete)await new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});});assert.ok(await img.evaluate(img=>img.naturalWidth>0));}
 async function noHero(){assert.equal(await page.locator('.selectedHeroImage').count(),0);}
 try{
  const allPaths=[...Object.values(settings).filter(s=>s.showBuilderImage).map(s=>s.builderImage),...Object.values(combos).flatMap(Object.values),'/images/bathroom-builder/fallback/placeholder.svg'];
  for(const url of allPaths)assert.equal((await context.request.get(base+url)).status(),200,url);
  const output=path.join(require('node:os').tmpdir(),'bath-tile-ui');await fs.mkdir(output,{recursive:true});
  for(const [width,height]of [[1920,1080],[1440,900],[1280,720],[430,932],[390,844],[375,812]]){
   if(page)await page.close();page=await context.newPage();page.setDefaultTimeout(12000);await page.setViewportSize({width,height});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/hydration|duplicate|unique.*key/i.test(m.text()))errors.push(m.text());});page.on('response',r=>{if(r.url().includes('/images/bathroom-builder/')&&r.status()>=400)imageErrors.push(r.url());});await page.goto(base+'/design',{waitUntil:'domcontentloaded'});
   for(const [size,moods]of Object.entries(combos)){await seed(3);await choose('wallTileSize',size.replace('x','×'));for(const [mood,url]of Object.entries(moods)){const label={white:'화이트',ivory:'아이보리',gray:'그레이',dark:'다크'}[mood];await choose('tile',label);await hero(url);assert.equal(await page.locator('.selectedHeroLabel').textContent(),label);assert.equal(new URL(await page.getByRole('button',{name:label+' 이미지 크게 보기',exact:true}).locator('img').getAttribute('src'),base).pathname,url);assert.equal(await page.getByRole('button',{name:label+' 이미지 크게 보기',exact:true}).count(),1);}}
   await seed(3);await choose('tile','화이트');await hero(settings['tile:white'].builderImage);await choose('wallTileSize','300×600');await hero(combos['300x600'].white);await choose('wallTileSize','600×600');await hero(combos['600x600'].white);
   const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(saved.values.tile,'white');assert.equal(saved.values.wallTileSize,'600x600');assert.deepEqual(saved.imageHistoryOrder,['wallTileSize:600x600','tile:white']);assert.ok(!JSON.stringify(saved).includes('/images/'));
   await page.screenshot({path:path.join(output,width+'-tile.png'),fullPage:true});await choose('tile','아이보리');await hero(combos['600x600'].ivory);const order=await page.locator('.selectionHistoryStrip strong').allTextContents();
   await page.locator(width<768?'.mobileBuilderNav':'.navButtons').getByRole('button',{name:'다음',exact:true}).click();await noHero();await openPreview();assert.deepEqual(await page.locator('.selectionHistoryStrip strong').allTextContents(),order);await page.getByRole('button',{name:'아이보리 이미지 크게 보기',exact:true}).tap();await hero(combos['600x600'].ivory);
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();await noHero();
   await seed(3,{tile:'white'});await choose('wallTileSize','기타 타일');await noHero();await openPreview();await page.getByRole('button',{name:'화이트 이미지 크게 보기',exact:true}).tap();await hero(settings['tile:white'].builderImage);
   for(let index=0;index<15;index++){await seed(index);assert.ok(!(await page.locator('.designGrid').textContent()).includes('왜 선택하나요?'));assert.equal(await page.getByRole('button',{name:'가이드 보기',exact:true}).count(),1);}
   await page.getByRole('button',{name:'가이드 보기',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('link',{name:'전체 가이드 보기',exact:true}).count(),1);await page.getByRole('button',{name:'가이드 닫기',exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log('PASS '+width+'×'+height+': all 12 combinations, both selection orders, dynamic size/mood preview and history, other/default, step/reset/refresh, all 15 explanations removed and guide retained');
  }
  for(const route of ['/','/guide','/guide/tile','/guide/glossary'])assert.equal((await context.request.get(base+route)).status(),200);
  assert.deepEqual(errors,[]);assert.deepEqual(imageErrors,[]);console.log('PASS '+allPaths.length+' Builder/combo/fallback image URLs, homepage/guide routes, no image/runtime/hydration errors');
 }catch(e){console.error(e);throw e;}finally{await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
