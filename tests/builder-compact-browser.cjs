// Uses an existing Playwright install; no application dependency is added.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3000';
const key = 'bath-designer-selections-v2';
(async () => {
  const browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'})});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  async function seed(step=2) {
    await page.goto(base+'/design');
    await page.locator('.projectInfoForm,.progressHeading').first().waitFor();
    await page.evaluate(({key,step})=>localStorage.setItem(key,JSON.stringify({version:3,current:step-1,values:{},projectInfo:{projectName:'테스트 욕실',customerName:'홍길동'}})),{key,step});
    await page.goto(base+'/design?step='+step);await page.locator('.builderCompactFlow').waitFor();
  }
  const nav=()=>page.locator('.mobileBuilderNav');
  const currentGroup=()=>page.locator('.choiceGroup:visible');
  const title=()=>currentGroup().locator('h2').textContent();
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  const next=()=>nav().getByRole('button',{name:'다음 항목 →',exact:true}).click();
  async function choose(label,multi=false){await currentGroup().getByRole(multi?'checkbox':'radio',{name:label,exact:true}).click();}
  async function layout(width,height) {
    const r=await page.evaluate(()=>{
      const rect=s=>document.querySelector(s).getBoundingClientRect();
      return {height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth,
        preview:rect('.builderPreviewPanel').bottom,selection:rect('.builderSelectionScroll').top,
        bottom:rect('.builderSelectionScroll').bottom,nav:rect('.mobileBuilderNav').top,
        columns:getComputedStyle(document.querySelector('.designGrid')).gridTemplateColumns.split(' ').length};
    });
    assert.equal(r.overflow,false);
    if(width<1200){assert.equal(r.height,height);assert.ok(r.preview<=r.selection);assert.ok(r.bottom<r.nav);assert.equal(await currentGroup().count(),1);}
    else {assert.equal(r.columns,3);assert.equal(await currentGroup().count(),3);}
  }
  try {
    for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[1100,800],[1024,768],[900,700],[768,1024],[430,932],[390,844],[375,812]]) {
      await page.setViewportSize({width,height});await seed();
      await page.getByRole('checkbox',{name:'젠다이 신설',exact:true}).click();
      await page.locator('.selectedHeroImage img').waitFor({state:'visible'});
      await layout(width,height);
      if(width<1200) {
        assert.equal(await title(),'젠다이');assert.equal(await nav().locator('.button:visible').count(),1);
        assert.equal(await page.locator('.navButtons:visible').count(),0);
        const values=(await saved()).values,history=await page.locator('.selectionHistoryStrip strong').allTextContents();
        await next();assert.equal(await title(),'파티션 & 샤워부스');assert.equal((await saved()).current,1);
        assert.equal(await page.locator('progress').getAttribute('value'),'2');assert.equal(await page.locator('.selectedHeroImage').count(),0);
        assert.deepEqual(await page.locator('.selectionHistoryStrip strong').allTextContents(),history);
        await nav().getByRole('button',{name:'이전 항목',exact:true}).click();assert.equal(await title(),'젠다이');
        assert.deepEqual((await saved()).values,values);assert.equal(await page.getByRole('checkbox',{name:'젠다이 신설',exact:true}).getAttribute('aria-checked'),'true');
        await next();await choose('하프 파티션');assert.equal(await title(),'파티션 & 샤워부스');
        await choose('풀 파티션');assert.equal(await title(),'파티션 & 샤워부스');assert.equal(await page.locator('.selectedHeroLabel').textContent(),'풀 파티션');
        await next();assert.equal(await title(),'샴푸박스');
        await nav().getByRole('button',{name:'STEP 03으로 →',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('progress').value===3);assert.equal(await page.locator('.selectedHeroImage').count(),0);
      }
      console.log('PASS '+width+'x'+height);
    }
    await page.setViewportSize({width:390,height:844});await seed(4);
    await choose('600×600');assert.equal(await title(),'벽 & 바닥 타일 크기');await next();
    await choose('다크');assert.equal(await title(),'타일 분위기');await next();
    await choose('무광');assert.equal(await title(),'표면');
    assert.ok(decodeURIComponent(await page.locator('.selectedHeroImage img').getAttribute('src')).includes('600각 다크 무광'));
    await seed(9);await next();await choose('일반 샤워&욕조 수전',true);await choose('해바라기 샤워 수전',true);
    assert.equal(await title(),'샤워 수전');assert.equal(await currentGroup().locator('[aria-checked=true]').count(),2);
    assert.equal(await page.locator('.selectedHeroLabel').textContent(),'해바라기 샤워 수전');
    await page.locator('.selectionHistory>.builderDisclosureToggle').click();
    assert.deepEqual(await page.locator('.selectionHistoryStrip strong').allTextContents(),['해바라기 샤워 수전','일반 샤워&욕조 수전']);
    await page.getByRole('button',{name:'일반 샤워&욕조 수전 이미지 크게 보기',exact:true}).click();
    assert.equal(await page.locator('.selectedHeroLabel').textContent(),'일반 샤워&욕조 수전');
    await page.locator('.selectionHistory>.builderDisclosureToggle').click();
    await choose('기타',true);assert.equal(await page.locator('.selectedHeroImage').count(),0);
    await page.locator('#builder-showerFaucet-other').fill('현장 확인 요청');await page.reload();await page.locator('.builderCompactFlow').waitFor();
    assert.equal(await title(),'세면 수전');await next();assert.equal(await page.locator('#builder-showerFaucet-other').inputValue(),'현장 확인 요청');
    assert.deepEqual((await saved()).values.showerFaucet,['shower','rain','other']);
    await page.locator('.builderSummaryPanel>.builderDisclosureToggle').click();
    assert.ok((await page.locator('.summary').innerText()).includes('현장 확인 요청'));
    await page.locator('.builderSummaryPanel>.builderDisclosureToggle').click();
    // Every STEP uses section position without changing STEP progress until its boundary.
    for(let step=1;step<=15;step++) {
      await seed(step);const count=await page.locator('.choiceGroup').count();
      for(let section=0;section<count;section++) {
        assert.equal(await currentGroup().count(),1);assert.equal((await saved()).current,step-1);
        assert.equal(await currentGroup().locator('.builderSectionPosition').textContent(),(section+1)+' / '+count);
        if(section<count-1)await next();
      }
      await nav().getByRole('button',{name:'STEP '+String(step+1).padStart(2,'0')+'으로 →',exact:true}).click();
      await page.waitForFunction(n=>document.querySelector('progress').value===n,step+1);
    }
    await seed(2);await next();await nav().getByRole('button',{name:'현재 STEP 전체 건너뛰기',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('progress').value===3);assert.equal((await saved()).current,2);
    await page.goto(base+'/design?step=2&returnTo=consultation');await page.locator('.builderConsultationEdit a').click();await page.locator('.consultationSheet').waitFor();
    await page.setViewportSize({width:844,height:390});await seed();await choose('젠다이 신설',true);await next();assert.equal(await title(),'파티션 & 샤워부스');
    assert.ok(await nav().isVisible());
    assert.deepEqual(errors,[]);
    console.log('PASS manual sections, no auto advance, STEP boundaries, pending, back retention, preview resets, resolver, multi, history, storage, skip, consultation, landscape, runtime errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
