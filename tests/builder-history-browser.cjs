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
    await page.goto(base+'/design',{waitUntil:'domcontentloaded'});
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
    for(const [width,height] of (process.env.BUILDER_DIMENSIONS ? JSON.parse(process.env.BUILDER_DIMENSIONS) : [[1920,1080],[1440,900],[1280,720],[1024,768],[430,932],[390,844],[375,812]])) {
      await page.close();
      page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if(m.type()==='error' && /hydration|duplicate|unique.*key/i.test(m.text()))errors.push(m.text()); });
      await page.goto(base+'/design',{waitUntil:'domcontentloaded'});
      await page.setViewportSize({width,height}); await seed(0);
      const nav=()=>page.locator(width<768?'.mobileBuilderNav':'.navButtons');
      async function next(){await nav().getByRole('button',{name:'다음',exact:true}).click();await noHero();}
      await choose('demolition','전체 철거');await openPreview();await hero('전체 철거');await next();
      await choose('partitionShower','하프 파티션');await next();await next();
      await choose('wallTileSize','600×600');await choose('tile','화이트');await choose('tileSurface','무광');await openPreview();
      assert.deepEqual(await labels(),['무광','화이트','600×600','하프 파티션','전체 철거']);
      await page.locator('.selectionHistoryStrip').evaluate(el=>el.scrollLeft=el.scrollWidth);
      await choose('wallTileSize','600×1200');await openPreview();
      assert.deepEqual(await labels(),['600×1200','무광','화이트','하프 파티션','전체 철거']);
      assert.equal(await page.locator('.selectionHistoryStrip').evaluate(el=>el.scrollLeft),0);
      for(let i=0;i<3;i++)await nav().getByRole('button',{name:'이전',exact:true}).click();
      await choose('demolition','덧방');await openPreview();assert.equal((await labels())[0],'덧방');
      const before=await labels();await page.reload();await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();await openPreview();await noHero();assert.deepEqual(await labels(),before);
      await page.getByRole('button',{name:'600×1200 이미지 크게 보기',exact:true}).tap();await hero('600×1200');
      assert.equal(await page.locator('.historyPreviewButton[aria-pressed=true]').count(),1);
      assert.deepEqual(await labels(),before);
      await seed(11);await choose('lighting','천장 매립 조명');await choose('lighting','욕실장 간접 조명');await choose('lighting','천장 간접 조명');await openPreview();
      assert.deepEqual(await labels(),['천장 간접 조명','욕실장 간접 조명','천장 매립 조명']);
      await choose('lighting','욕실장 간접 조명');await noHero();assert.deepEqual(await labels(),['천장 간접 조명','천장 매립 조명']);
      await choose('lighting','기타');await noHero();assert.equal((await labels()).length,2);
      await seed(4);await choose('sink','탑볼 세면대');await choose('toilet','기타');await noHero();await openPreview();
      assert.deepEqual(await labels(),['탑볼 세면대']);await page.getByRole('button',{name:'탑볼 세면대 이미지 크게 보기',exact:true}).tap();await hero('탑볼 세면대');
      await choose('sink','기타');await noHero();assert.equal((await labels()).length,0);
      await seed(8,{showerFaucet:'shower'});await openPreview();await noHero();
      const showerToggle=group('showerFaucet').locator('.builderSectionToggle');if(await showerToggle.isVisible()&&await group('showerFaucet').getAttribute('data-open')==='false')await showerToggle.click();
      assert.deepEqual((await saved()).values.showerFaucet,['shower']);
      assert.equal(await group('showerFaucet').getByRole('checkbox',{name:'일반 샤워&욕조 수전',exact:true}).getAttribute('aria-checked'),'true');
      assert.ok((await group('showerFaucet').textContent()).includes('복수 선택'));
      await choose('showerFaucet','해바라기 샤워 수전');await hero('해바라기 샤워 수전');
      assert.deepEqual((await saved()).values.showerFaucet,['shower','rain']);
      assert.deepEqual(await labels(),['해바라기 샤워 수전','일반 샤워&욕조 수전']);
      assert.ok((await page.locator('.builderSummaryCounts').textContent()).includes('선택 1 · 미정 24'));
      await choose('showerFaucet','매립 샤워&욕조 수전');await hero('매립 샤워&욕조 수전');
      assert.deepEqual(await labels(),['매립 샤워&욕조 수전','해바라기 샤워 수전','일반 샤워&욕조 수전']);
      const uploaded=page.locator('.selectedHeroImage img');assert.ok(decodeURIComponent(await uploaded.getAttribute('src')).includes('매립 샤워&욕조 수전 .png'));
      await uploaded.evaluate(async img=>{if(!img.complete)await new Promise(r=>img.addEventListener('load',r,{once:true}));});assert.ok(await uploaded.evaluate(img=>img.naturalWidth>0));
      await choose('showerFaucet','매립 샤워&욕조 수전');await noHero();
      await choose('showerFaucet','기타');await noHero();await page.locator('#builder-showerFaucet-other').fill('특수 샤워 수전');
      assert.deepEqual((await saved()).values.showerFaucet,['shower','rain','other']);
      await choose('showerFaucet','기타');assert.equal(await page.locator('#builder-showerFaucet-other').count(),0);assert.ok(!(await page.locator('.summary').textContent()).includes('특수 샤워 수전'));
      await page.reload();await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();await openPreview();await noHero();
      assert.deepEqual((await saved()).values.showerFaucet,['shower','rain']);
      await choose('showerFaucet','해바라기 샤워 수전');await noHero();assert.deepEqual(await labels(),['일반 샤워&욕조 수전']);
      await choose('showerFaucet','일반 샤워&욕조 수전');await noHero();assert.deepEqual((await saved()).values.showerFaucet,[]);
      assert.ok((await page.locator('.summary').textContent()).includes('미정'));
      await seed(12,{accessoryFinish:'chrome',accessoryOther:'수건걸이'});await choose('accessoryFinish','니켈(무광)');await openPreview();await hero('니켈(무광)');
      await choose('accessoryFinish','크롬(유광)');await hero('크롬(유광)');assert.equal((await saved()).values.accessoryFinish,'chrome');assert.equal((await saved()).values.accessoryOther,'수건걸이');
      for(const [id,label]of [['chrome','크롬(유광)'],['nickel','니켈(무광)']]){await seed(12,{accessoryFinish:id});assert.equal(await group('accessoryFinish').getByRole('radio',{name:label,exact:true}).getAttribute('aria-checked'),'true');}
      await seed(8);assert.deepEqual(await group('showerFaucet').locator('[role=checkbox]').allTextContents(),['일반 샤워&욕조 수전','매립 샤워&욕조 수전','해바라기 샤워 수전','기타']);
      await choose('faucet','일반 세면 수전');await choose('showerFaucet','일반 샤워&욕조 수전');await choose('showerFaucet','기타');await noHero();await choose('showerFaucet','일반 샤워&욕조 수전');await noHero();
      await page.locator('#builder-showerFaucet-other').fill('벽부형 온도조절 샤워 수전');await noHero();await openPreview();assert.deepEqual(await labels(),['일반 세면 수전']);
      await page.reload();await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();await openPreview();await noHero();assert.equal(await page.locator('#builder-showerFaucet-other').inputValue(),'벽부형 온도조절 샤워 수전');
      assert.ok((await page.locator('.summary').textContent()).includes('기타 · 벽부형 온도조절 샤워 수전'));
      assert.equal((await saved()).memo,'기존 메모');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      console.log(`PASS ${width}×${height}: latest order, scroll, replace, multi, empty preview, manual thumbnail, refresh, shower other, overflow`);
    }
    await page.setViewportSize({width:1440,height:900});
    await seed(15,{showerFaucet:['shower','rain','other'],showerFaucetOther:'벽부형 온도조절 샤워 수전',accessoryFinish:'nickel'});
    for(const label of ['일반 샤워&욕조 수전','해바라기 샤워 수전','니켈(무광)'])assert.ok((await page.locator('.finalCheck').textContent()).includes(label));
    assert.ok((await page.locator('.finalCheck').textContent()).includes('벽부형 온도조절 샤워 수전'));
    await page.getByRole('link',{name:'욕실 리모델링 상담서 보기',exact:true}).click();
    await page.locator('.sheetStep').first().waitFor();
    assert.ok((await page.locator('.consultationSheet').textContent()).includes('벽부형 온도조절 샤워 수전'));
    await context.grantPermissions(['clipboard-read','clipboard-write']);await page.getByRole('button',{name:'선택 내용 복사',exact:true}).click();
    const copy=await page.evaluate(()=>navigator.clipboard.readText());for(const label of ['일반 샤워&욕조 수전','해바라기 샤워 수전','기타 · 벽부형 온도조절 샤워 수전','니켈(무광)'])assert.ok(copy.includes(label));
    await page.emulateMedia({media:'print'});assert.ok((await page.locator('.consultationSheet').textContent()).includes('벽부형 온도조절 샤워 수전'));
    await page.pdf({path:require('node:path').join(require('node:os').tmpdir(),'bath-history-consultation.pdf'),format:'A4'});
    assert.deepEqual(errors,[]);console.log('PASS STEP16, consultation, clipboard, print/PDF, no runtime/hydration/key errors');
  } catch(e) { console.error(e); throw e; } finally {await Promise.race([browser.close(),new Promise(r=>setTimeout(r,3000))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
