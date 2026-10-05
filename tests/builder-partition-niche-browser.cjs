const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3111';
const key = 'bath-designer-selections-v2';
(async () => {
  const browser = await chromium.launch({...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {channel:'chrome'}),headless:true});
  const context = await browser.newContext({hasTouch:true});
  await context.route('https://fonts.googleapis.com/**', route => route.abort());
  await context.route('https://fonts.gstatic.com/**', route => route.abort());
  let page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error' && /hydration|duplicate|unique.*key/i.test(m.text()))errors.push(m.text()); });
  const group = name => page.locator(`.choiceGroup:has(#builder-${name}-content)`);
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  async function seed(current,values={},imageHistoryOrder) {
    await page.evaluate(({key,current,values,imageHistoryOrder})=>localStorage.setItem(key,JSON.stringify({version:3,current,values,imageHistoryOrder,memo:'기존 메모',checks:{}})),{key,current,values,imageHistoryOrder});
    await page.goto(base+'/design?step='+(current+1),{waitUntil:'domcontentloaded'});
    await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();
    await page.waitForFunction(current=>document.querySelector('progress')?.value===current+1,current);
  }
  async function choose(name,label) {
    const section=group(name),toggle=section.locator('.builderSectionToggle');
    if(await toggle.isVisible() && await section.getAttribute('data-open')==='false')await toggle.click();
    await section.getByRole(['lighting','showerFaucet'].includes(name)?'checkbox':'radio',{name:label,exact:true}).click();
  }
  async function openPreview() {
    for(const selector of ['.builderPreviewPanel','.selectionHistory']) {
      const section=page.locator(selector),toggle=section.locator('>.builderDisclosureToggle');
      if(await section.count() && await toggle.isVisible() && await section.getAttribute('data-open')==='false')await toggle.click();
    }
  }
  const labels=()=>page.locator('.selectionHistoryStrip strong').allTextContents();
  async function noHero(){assert.equal(await page.locator('.selectedHeroImage').count(),0);}
  async function hero(label){await page.locator('.selectedHeroLabel').filter({hasText:label}).waitFor();assert.equal(await page.locator('.selectedHeroLabel').textContent(),label);}
  try {
    await page.goto(base+'/design',{waitUntil:'domcontentloaded'});
    await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();
    const image=require('../data/bathroom-builder-image-settings.generated.json')['niche:partition-niche'].builderImage;
    assert.equal((await context.request.get(base+image)).status(),200);
    for(const [width,height] of [[1920,1080],[1440,900],[430,932],[390,844],[375,812]]) {
      await page.setViewportSize({width,height});await seed(1);
      const section=group('niche'),toggle=section.locator('.builderSectionToggle');
      if(await toggle.isVisible()&&await section.getAttribute('data-open')==='false')await toggle.click();
      assert.deepEqual(await section.locator('[role=radio]').allTextContents(),['없음','샤워 샴푸박스','세면대 샴푸박스','파티션 샴푸박스']);
      await choose('niche','샤워 샴푸박스');await choose('niche','파티션 샴푸박스');await openPreview();await hero('파티션 샴푸박스');
      assert.deepEqual(await labels(),['파티션 샴푸박스']);
      const img=page.locator('.selectedHeroImage img');assert.equal(new URL(await img.getAttribute('src'),base).pathname,image);
      await page.waitForFunction(()=>document.querySelector('.selectedHeroImage img')?.naturalWidth>0);
      assert.equal(await page.locator('.imageDisclaimer').count(),0);
      const gap=await page.evaluate(()=>{const h=document.querySelector('.selectedGallery > .galleryHead').getBoundingClientRect();const i=document.querySelector('.selectedHeroImage').getBoundingClientRect();return i.top-h.bottom;});assert.ok(gap>=0&&gap<40);
      assert.equal((await saved()).values.niche,'partition-niche');
      await page.reload();await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();await openPreview();await noHero();
      assert.equal((await saved()).values.niche,'partition-niche');
      await page.getByRole('button',{name:'파티션 샴푸박스 이미지 크게 보기',exact:true}).click();await hero('파티션 샴푸박스');
      await seed(3,{wallTileSize:'other',wallTileSizeOther:'박판 타일',niche:'partition-niche'});
      const input=page.locator('#builder-wallTileSize-other');assert.equal(await input.getAttribute('placeholder'),'대형 타일, 모자이크 타일, 박판 타일, 포인트 타일 · · ·');assert.equal(await input.getAttribute('type'),'text');assert.equal(await input.inputValue(),'박판 타일');
      await input.fill('모자이크 포인트 타일');await page.reload();await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();assert.equal(await input.inputValue(),'모자이크 포인트 타일');
      assert.ok(!JSON.stringify((await saved()).values).includes('대형 타일, 모자이크 타일,'));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      console.log('PASS '+width+'×'+height+': niche single replacement, uploaded preview/history, no disclaimer/gap, refresh, placeholder/input persistence, overflow');
    }
    await page.setViewportSize({width:1440,height:900});await seed(15,{niche:'partition-niche',wallTileSize:'other',wallTileSizeOther:'박판 타일'});
    assert.ok((await page.locator('.finalCheck').textContent()).includes('파티션 샴푸박스'));
    await page.getByRole('link',{name:'욕실 리모델링 상담서 보기',exact:true}).click();await page.locator('.sheetStep').first().waitFor();assert.ok((await page.locator('.consultationSheet').textContent()).includes('파티션 샴푸박스'));
    await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'선택 내용 복사',exact:true}).click();assert.ok((await page.evaluate(()=>navigator.clipboard.readText())).includes('파티션 샴푸박스'));
    await page.emulateMedia({media:'print'});await page.pdf({path:require('node:path').join(require('node:os').tmpdir(),'bath-partition-niche.pdf'),format:'A4'});
    assert.deepEqual(errors,[]);console.log('PASS STEP16, consultation, clipboard/PDF, no runtime/hydration errors');
  } finally {await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
