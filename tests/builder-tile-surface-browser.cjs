const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const matrix = require('../data/bathroom-builder-tile-surface-images.generated.json');
const moods = require('../data/bathroom-builder-tile-images.generated.json');
const settings = require('../data/bathroom-builder-image-settings.generated.json');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3111';
const key = 'bath-designer-selections-v2';
const labels = {white:'화이트',ivory:'아이보리',gray:'그레이',dark:'다크',matte:'무광',glossy:'유광'};
(async () => {
 const browser = await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context = await browser.newContext({hasTouch:true});
 const errors=[],imageErrors=[];
 const output=path.join(require('node:os').tmpdir(),'bath-surface-ui');await fs.mkdir(output,{recursive:true});
 let page;
 const group = name => page.locator(`.choiceGroup:has(#builder-${name}-content)`);
 async function openGroup(name){const section=group(name),toggle=section.locator('.builderSectionToggle');if(await toggle.isVisible()&&await section.getAttribute('data-open')==='false')await toggle.click();return section;}
 async function choose(name,label){const section=await openGroup(name),radio=section.getByRole('radio',{name:label,exact:true});if(await radio.getAttribute('aria-checked')!=='true')await radio.click();}
 async function seed(current=3,values={}){await page.evaluate(({key,current,values})=>localStorage.setItem(key,JSON.stringify({version:3,current,values,imageHistoryOrder:[],memo:'업체 메모 유지',specialNotes:'현장 특이사항',checks:{}})),{key,current,values});await page.goto(base+'/design?step='+(current+1),{waitUntil:'domcontentloaded'});await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();await page.waitForFunction(n=>document.querySelector('progress')?.value===n,current+1);}
 async function openPreview(){for(const selector of ['.builderPreviewPanel','.selectionHistory']){const section=page.locator(selector);if(!await section.count())continue;const toggle=section.locator('>.builderDisclosureToggle');if(await toggle.isVisible()&&await section.getAttribute('data-open')==='false')await toggle.click();}}
 async function src(locator,url){await locator.waitFor();assert.equal(new URL(await locator.getAttribute('src'),base).pathname,url);await locator.evaluate(async img=>{if(!img.complete)await new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});});});assert.ok(await locator.evaluate(img=>img.naturalWidth>0));}
 const historyImage = surface => page.getByRole('button',{name:labels[surface]+' 이미지 크게 보기',exact:true}).locator('img');
 async function hero(url){await openPreview();await src(page.locator('.selectedHeroImage img'),url);}
 async function optionImages(size,mood){const section=await openGroup('tileSurface');for(const surface of ['matte','glossy'])await src(section.getByRole('radio',{name:labels[surface],exact:true}).locator('img'),matrix[size][mood][surface]);}
 try {
  const urls=Object.values(matrix).flatMap(Object.values).flatMap(Object.values);assert.equal(urls.length,24);
  for(const url of urls)assert.equal((await context.request.get(base+url)).status(),200);
  for(const [width,height]of [[1920,1080],[1440,900],[1280,720],[430,932],[390,844],[375,812]]){
   if(page)await page.close();page=await context.newPage();page.setDefaultTimeout(12000);await page.setViewportSize({width,height});
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/hydration|duplicate|unique.*key/i.test(m.text()))errors.push(m.text());});page.on('response',r=>{if(r.url().includes('/images/')&&r.status()>=400)imageErrors.push(r.url());});
   await page.goto(base+'/design');await seed();
   for(const [size,byMood]of Object.entries(matrix)){
    await choose('wallTileSize',size.replace('x','×'));
    for(const [mood,surfaces]of Object.entries(byMood)){
     await choose('tile',labels[mood]);await optionImages(size,mood);
     for(const [surface,url]of Object.entries(surfaces)){
      await choose('tileSurface',labels[surface]);await hero(url);await src(historyImage(surface),url);
      assert.equal(await historyImage(surface).count(),1);
      await src(page.getByRole('button',{name:labels[mood]+' 이미지 크게 보기',exact:true}).locator('img'),moods[size][mood]);
     }
    }
   }
   await seed();await choose('tile','다크');await choose('wallTileSize','600×600');await optionImages('600x600','dark');await choose('tileSurface','무광');await hero(matrix['600x600'].dark.matte);
   assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)).imageHistoryOrder[0],'tileSurface:matte');
   await choose('wallTileSize','300×600');await openPreview();await src(historyImage('matte'),matrix['300x600'].dark.matte);
   await choose('tile','화이트');await openPreview();await src(historyImage('matte'),matrix['300x600'].white.matte);
   await page.getByRole('button',{name:'무광 이미지 크게 보기',exact:true}).tap();await hero(matrix['300x600'].white.matte);
   let saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(saved.values.tileSurface,'matte');assert.equal(saved.values.tile,'white');assert.equal(saved.values.wallTileSize,'300x600');assert.deepEqual(saved.imageHistoryOrder,['tile:white','wallTileSize:300x600','tileSurface:matte']);assert.ok(!JSON.stringify(saved).includes('/images/'));
   await page.screenshot({path:path.join(output,width+'-surface.png'),fullPage:true,animations:'disabled'});
   await page.reload();await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();assert.equal(await page.locator('.selectedHeroImage').count(),0);await openPreview();await src(historyImage('matte'),matrix['300x600'].white.matte);await optionImages('300x600','white');
   await page.locator(width<768?'.mobileBuilderNav':'.navButtons').getByRole('button',{name:'다음',exact:true}).click();assert.equal(await page.locator('.selectedHeroImage').count(),0);await openPreview();await page.getByRole('button',{name:'무광 이미지 크게 보기',exact:true}).tap();await hero(matrix['300x600'].white.matte);
   for(const values of [{tileSurface:'matte'},{wallTileSize:'600x600',tileSurface:'matte'},{tile:'dark',tileSurface:'matte'},{wallTileSize:'other',wallTileSizeOther:'임의 규격',tile:'dark',tileSurface:'matte'}]){
    await seed(3,values);await openGroup('tileSurface');await src(group('tileSurface').getByRole('radio',{name:'무광',exact:true}).locator('img'),settings['tileSurface:matte'].builderImage);await openPreview();await page.getByRole('button',{name:'무광 이미지 크게 보기',exact:true}).tap();await hero(settings['tileSurface:matte'].builderImage);
   }
   await seed();await choose('wallTileSize','기타 타일');assert.equal(await page.locator('.selectedHeroImage').count(),0);
   await seed(15,{wallTileSize:'600x600',tile:'dark',tileSurface:'matte'});assert.ok((await page.locator('.finalCheck').textContent()).includes('무광'));
   await page.goto(base+'/result');await page.locator('.sheetStep').first().waitFor();assert.ok((await page.locator('body').textContent()).includes('다크'));assert.ok((await page.locator('body').textContent()).includes('무광'));
   await page.getByRole('button',{name:'타일 수정',exact:true}).click();await page.locator('.builderConsultationEdit').waitFor();await choose('tileSurface','유광');await hero(matrix['600x600'].dark.glossy);await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).click();await page.locator('.sheetStep').first().waitFor();assert.ok((await page.locator('body').textContent()).includes('유광'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log('PASS '+width+'×'+height+': all 24 combinations, both option thumbnails, preview/history, size/mood changes, ordering, refresh, fallbacks, STEP16 and consultation edit/return');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(imageErrors,[]);console.log('PASS: no broken images, runtime/hydration/duplicate errors; screenshots: '+output);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
