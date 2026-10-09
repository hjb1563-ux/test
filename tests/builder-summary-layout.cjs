// Uses an existing Playwright installation; adds no application dependency.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BUILDER_TEST_URL||'http://localhost:3000';
const key='bath-designer-selections-v2';
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'})});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function seed(step=2,values={jendai:['new'],partitionShower:'full-partition',niche:'shower-niche'}){
    await page.goto(base+'/design');await page.locator('.projectInfoForm,.progressHeading').first().waitFor();
    await page.evaluate(({key,step,values})=>localStorage.setItem(key,JSON.stringify({version:3,current:step-1,values,projectInfo:{projectName:'검증 프로젝트',customerName:'홍길동'}})),{key,step,values});
    await page.goto(base+'/design?step='+step);await page.locator('.builderCompactFlow').waitFor();
  }
  const toggle=()=>page.locator('.builderSummaryPanel>.builderDisclosureToggle');
  async function rects(){return page.evaluate(()=>{
    const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
    const body=document.querySelector('.builderSummaryPanel>.builderDisclosureBody');
    return {height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,
      question:rect('.stepHeading'),preview:rect('.builderPreviewPanel'),selection:rect('.builderSelectionScroll'),
      summary:rect('.builderSummaryPanel'),body:rect('.builderSummaryPanel>.builderDisclosureBody'),nav:rect('.mobileBuilderNav'),
      position:getComputedStyle(body).position};
  });}
  function noOverlap(r,width,height){
    assert.equal(r.height,height);assert.equal(r.width,width);
    assert.ok(r.preview.bottom<=r.selection.top);assert.ok(r.selection.bottom<=r.summary.top);
    assert.ok(r.summary.bottom<=r.nav.top);assert.ok(r.body.height>=40,'summary content must remain scrollable');
    assert.ok(r.summary.height<=height*.30+1);assert.equal(r.position,'static');
  }
  try{
    for(const [width,height]of [[1100,800],[1024,768],[900,700],[768,1024],[430,932],[390,844],[375,812]]){
      await page.setViewportSize({width,height});await seed();
      // Show a preview without changing the saved final selection.
      const choice=page.getByRole('checkbox',{name:'젠다이 신설',exact:true});await choice.click();await choice.click();
      await page.locator('.selectedHeroImage img').waitFor({state:'visible'});
      const before=await rects();const values=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).values,key);
      await toggle().focus();await page.keyboard.press('Enter');assert.equal(await toggle().getAttribute('aria-expanded'),'true');
      const after=await rects();noOverlap(after,width,height);
      assert.ok(after.selection.height<before.selection.height);assert.deepEqual(after.preview,before.preview);assert.deepEqual(after.question,before.question);
      const last=page.locator('.choiceGroup:visible .builderChoiceCard').last();await last.scrollIntoViewIfNeeded();
      const option=await last.boundingBox();assert.ok(option.y>=after.selection.y-1);assert.ok(option.y+option.height<=after.selection.bottom+1);
      await page.locator('.mobileBuilderNav .button').click();assert.equal(await toggle().getAttribute('aria-expanded'),'true');
      assert.equal(await page.locator('.choiceGroup:visible h2').textContent(),'파티션 & 샤워부스');
      await page.getByRole('radio',{name:'고정 유리형 샤워부스',exact:true}).click();
      assert.ok((await page.locator('.summary').innerText()).includes('고정 유리형 샤워부스'));
      assert.equal(await page.locator('.choiceGroup:visible h2').textContent(),'파티션 & 샤워부스');
      noOverlap(await rects(),width,height);
      await toggle().focus();await page.keyboard.press('Space');assert.equal(await toggle().getAttribute('aria-expanded'),'false');
      console.log('PASS '+width+'x'+height+': normal flow, shrink, preview stable, last option, keyboard, change, section');
    }
    // Three and five selections in the current STEP; eight across the project.
    for(const total of [3,5,8]){
      const values={faucet:'one-hole',showerFaucet:total===3?['shower','rain']:['shower','rain','concealed-shower','other'],showerFaucetOther:'긴 기타 선택 내용 '.repeat(50)};
      if(total===8)Object.assign(values,{wallTileSize:'600x600',tile:'dark',tileSurface:'matte'});
      await page.setViewportSize({width:390,height:844});await seed(9,values);await toggle().click();
      const body=page.locator('.builderSummaryPanel>.builderDisclosureBody');
      assert.ok(await body.evaluate(e=>e.scrollHeight>e.clientHeight));
      await body.evaluate(e=>e.scrollTop=e.scrollHeight);assert.ok(await body.evaluate(e=>e.scrollTop>0));
      await page.locator('.mobileBuilderNav .button').click();assert.equal(await toggle().getAttribute('aria-expanded'),'true');
      const before=await page.locator('.builderSummaryPanel>.builderDisclosureToggle small').textContent();
      await page.getByRole('checkbox',{name:'해바라기 샤워 수전',exact:true}).click();
      assert.notEqual(await page.locator('.builderSummaryPanel>.builderDisclosureToggle small').textContent(),before);
      assert.equal(await page.locator('.choiceGroup:visible h2').textContent(),'샤워 수전');
      noOverlap(await rects(),390,844);console.log('PASS selection fixture '+total+': count, long text, summary scroll');
    }
    for(const [width,height]of [[1280,720],[1440,900],[1920,1080]]){
      await page.setViewportSize({width,height});await seed();
      assert.equal(await page.locator('.choiceGroup:visible').count(),3);
      const panels=await Promise.all(['.options','.builderPreviewPanel','.builderSummaryPanel'].map(s=>page.locator(s).boundingBox()));
      assert.ok(panels[0].x<panels[1].x&&panels[1].x<panels[2].x);
      assert.equal(await toggle().isVisible(),false);console.log('PASS desktop '+width+'x'+height);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
