const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3000';
const key = 'bath-designer-selections-v2';
const sizes = [[1920,1080],[1440,900],[1280,720],[1100,800],[1024,768],[768,1024],[430,932],[390,844],[375,812]];
(async () => {
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  const context = await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage(), errors=[];
  page.on('pageerror', error => errors.push(error.message));
    await require('./helpers/font-response-cache.cjs').install(page.context(), errors);
  fs.mkdirSync('tests/artifacts/builder-mode', {recursive:true});
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  async function seed(mode, current=0, values={}) {
    // Seed from a page without Builder autosave to avoid racing the previous render.
    await page.goto(base+'/');
    await page.evaluate(({key,mode,current,values}) => localStorage.setItem(key, JSON.stringify({version:3,current,values,projectInfo:{projectName:'작성 모드 검증',customerName:'테스트 고객',...(mode ? {builderMode:mode} : {})}})), {key,mode,current,values});
    await page.goto(base+'/design'); await page.locator('.builderProgress').waitFor();
  }
  const nav = () => page.locator('.mobileBuilderNav:visible');
  const group = () => page.locator('.choiceGroup:visible');
  async function nextStep() {
    if (await nav().count()) {
      const skip = nav().getByRole('button',{name:'현재 STEP 전체 건너뛰기',exact:true});
      if (await skip.isVisible()) await skip.click();
      else await nav().locator('button.button:visible').click(); // Mobile single-section first step hides skip.
    }
    else await page.locator('.navButtons:visible').getByRole('button',{name:'다음',exact:true}).click();
  }
  async function switchMode(mode) {
    await page.getByRole('button',{name:'프로젝트 정보 수정',exact:true}).click();
    await page.getByRole('radio',{name:mode === 'consumer' ? /^일반 고객용/ : /^전문가용/}).click();
    await page.getByRole('button',{name:'프로젝트 정보 저장',exact:true}).click();
  }
  async function select(label, multiple=false) {
    await group().getByRole(multiple?'checkbox':'radio',{name:label,exact:true}).click();
  }
  try {
    await page.goto(base+'/design'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.locator('.projectInfoForm').waitFor();
    assert.equal(await page.getByRole('radio',{name:/^일반 고객용/}).getAttribute('aria-checked'),'true');
    await page.getByRole('button',{name:'욕실 만들기 시작'}).click();
    assert.equal(await page.locator('#project-info-validation').count(),1);
    await page.locator('#project-customer-name').fill('신규 고객');
    await page.getByRole('button',{name:'욕실 만들기 시작'}).click();
    assert.equal(await page.locator('progress').getAttribute('max'),'10');
    assert.equal(await page.locator('#builder-demolition-title').count(),1);
    assert.equal((await saved()).projectInfo.builderMode,'consumer');
    await select('누수 이력이 있다',true);
    assert.equal(await page.locator('progress').getAttribute('value'),'1');
    await page.reload(); await page.locator('.builderProgress').waitFor();
    assert.equal(await page.getByRole('checkbox',{name:'누수 이력이 있다',exact:true}).getAttribute('aria-checked'),'true');
    await seed(undefined,2,{waterproofing:'combined-waterproofing'});
    assert.equal(await page.locator('progress').getAttribute('max'),'15');
    assert.equal(await page.getByRole('radio',{name:'액방 + 도막',exact:true}).getAttribute('aria-checked'),'true');
    const technical = {demolition:'full-demolition',waterproofing:'combined-waterproofing',drain:'linear-drain',drainPosition:'move',wallTileSize:'600x600',tile:'white',tileSurface:'matte',sink:'undermount-basin',toilet:'two-piece',faucet:'concealed',showerFaucet:['rain'],ventilationOther:'힘펠 휴젠뜨',accessoryOther:'수건걸이'};
    for (const [width,height] of process.env.BUILDER_MODE_FLOWS_ONLY ? [] : sizes) {
      await page.setViewportSize({width,height});
      for (const mode of ['consumer','professional']) {
        await seed(mode,0,technical);
        assert.equal(await page.locator('progress').getAttribute('max'),mode==='consumer'?'10':'15');
        assert.equal(await page.locator('#builder-demolition-title').count(),1);
        if (width<1200) {
          assert.equal(await group().count(),1);
          assert.equal(await group().locator('.builderSectionPosition').textContent(),mode==='consumer'?'1 / 2':'1 / 1');
        }
        await nextStep();
        assert.ok((await page.locator('.stepMeta').textContent()).includes(mode==='consumer'?'구조와 샤워 공간':'구조 변경'));
        assert.equal(await page.locator('#builder-jendai-title').textContent(),mode==='consumer'?'욕실 선반벽(젠다이)':'젠다이');
        await nextStep();
        assert.ok((await page.locator('.stepMeta').textContent()).includes(mode==='consumer'?'03 / 10 타일':'03 / 15 방수'));
        if (mode==='consumer') {
          if(width<1200) await nav().getByRole('button',{name:'이전',exact:true}).click();
          else await page.locator('.navButtons:visible').getByRole('button',{name:'이전',exact:true}).click();
          assert.ok((await page.locator('.stepMeta').textContent()).includes('02 / 10'));
          await nextStep();
          await nextStep(); assert.ok((await page.locator('.stepMeta').textContent()).includes('04 / 10 세면대 & 변기'));
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
        await seed(mode,8,technical); await nextStep();
        assert.ok((await page.locator('.stepMeta').textContent()).includes(mode==='consumer'?'08 / 10 조명':'10 / 15 배수 & 구배'));
        await seed(mode,15,technical); assert.equal(await page.getByText('최종 검토',{exact:true}).count(),0);
        await page.locator('a:visible').filter({hasText:/상담서 보기/}).last().click();
        await page.locator('.sheetStep').first().waitFor();
        assert.equal(await page.locator('.sheetStep').count(),mode==='consumer'?4:15);
        assert.equal(await page.locator('#consultation-waterproofing').count(),mode==='consumer'?0:1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
        await page.screenshot({path:`tests/artifacts/builder-mode/${mode}-${width}-report.png`,fullPage:true});
      }
      console.log(`PASS responsive ${width}x${height}: both modes, navigation, compact sections, review/report, no horizontal overflow`);
    }
    await page.setViewportSize({width:390,height:844});
    await seed('professional',2,technical);
    const before = await saved();
    await switchMode('consumer');
    assert.ok((await page.locator('.stepMeta').textContent()).includes('03 / 10 타일'));
    assert.deepEqual((await saved()).values,before.values);
    assert.deepEqual((await saved()).imageHistoryOrder,before.imageHistoryOrder);
    assert.equal(await page.locator('.selectionHistoryStrip').getByText('액방 + 도막',{exact:true}).count(),0);
    await switchMode('professional');
    await page.goto(base+'/design?step=3'); await page.locator('#builder-waterproofing-title').waitFor();
    assert.equal(await page.getByRole('radio',{name:'액방 + 도막',exact:true}).getAttribute('aria-checked'),'true');
    await seed('professional',9,technical); await switchMode('consumer');
    assert.ok((await page.locator('.stepMeta').textContent()).includes('08 / 10 조명'));
    await seed('consumer',8,technical);
    assert.equal(await page.locator('.builderRestriction:visible').count(),1);
    await nav().getByRole('button',{name:'다음 항목 →',exact:true}).click();
    await select('매립 샤워&욕조 수전',true);
    assert.equal(await page.locator('progress').getAttribute('value'),'7');
    assert.equal(await page.locator('.builderRestriction:visible').count(),1);
    await seed('consumer',13,technical);
    assert.equal(await page.locator('.builderChoiceDescription').count(),3);
    await seed('consumer',15,technical);
    await page.locator('a:visible').filter({hasText:/상담서 보기/}).last().click(); await page.locator('.sheetStep').first().waitFor();
    for(const name of ['공사 개요만 복사']) {
      await page.getByRole('button',{name,exact:true}).click();
      const text=await page.evaluate(()=>navigator.clipboard.readText());
      assert.ok(text.includes('600×600')); assert.ok(!text.includes('액방 + 도막')); assert.ok(!text.includes('전체 철거')); assert.ok(!text.includes('라인 배수구'));
    }
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('#consultation-waterproofing').count(),0);
    assert.equal(await page.locator('#consultation-drainage').count(),0);
    await page.screenshot({path:'tests/artifacts/builder-mode/consumer-print.png',fullPage:true});
    await page.emulateMedia({media:'screen'});
    await page.getByRole('button',{name:'타일 수정',exact:true}).click(); await page.locator('.stepMeta').waitFor({state:'attached'});
    assert.ok(page.url().includes('step=4'));
    assert.ok((await page.locator('.stepMeta').textContent()).includes('03 / 10'));
    await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).click(); await page.locator('#consultation-tile').waitFor();
    assert.equal(await page.locator('.sheetStep').count(),4);
    await page.getByRole('link',{name:'내 욕실 만들기로 돌아가기',exact:true}).click(); await page.locator('.builderProgress').waitFor();
    await switchMode('professional');
    await page.goto(base+'/result'); await page.locator('#consultation-waterproofing').waitFor();
    for(const name of ['공사 개요만 복사']) {
      await page.getByRole('button',{name,exact:true}).click();
      const overviewText=await page.evaluate(()=>navigator.clipboard.readText());
      assert.ok(overviewText.includes('[공사 개요]'));
      assert.ok(!overviewText.includes('액방 + 도막'));
      assert.ok((await page.locator('#consultation-waterproofing').innerText()).includes('액방 + 도막'));
    }
    await page.emulateMedia({media:'print'}); assert.equal(await page.locator('#consultation-waterproofing:visible').count(),1);
    await page.screenshot({path:'tests/artifacts/builder-mode/professional-print.png',fullPage:true});
    await page.emulateMedia({media:'screen'});
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await seed('consumer',1,technical);
      await select('젠다이 신설',true);
      await page.locator('.selectedHeroImage img:visible, .builderSwipeGallery img:visible').first().waitFor();
      assert.equal(await page.locator('progress').getAttribute('value'),'2');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      if(width<1200) {
        assert.equal(await group().count(),1);
        const bounds=await page.evaluate(()=>({selection:document.querySelector('.builderSelectionScroll').getBoundingClientRect(),nav:document.querySelector('.mobileBuilderNav').getBoundingClientRect(),height:document.documentElement.scrollHeight,viewport:innerHeight}));
        assert.ok(bounds.selection.bottom<=bounds.nav.top);
        // Existing <=767px CSS uses natural page scrolling, not a fixed-height workspace.
        if (width >= 768) assert.equal(bounds.height,bounds.viewport);
        else assert.ok(bounds.height >= bounds.viewport);
      }
      await page.screenshot({path:`tests/artifacts/builder-mode/consumer-${width}-builder.png`,fullPage:true});
      await page.getByRole('button',{name:'프로젝트 정보 수정',exact:true}).click();
      // Existing form reveals schedule after selecting a building type.
      await page.locator('[aria-labelledby=project-site-heading] .projectOptions').first().getByRole('radio').first().click();
      assert.equal(await page.locator('.projectInfoSection').count(),3);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`tests/artifacts/builder-mode/${width}-project-info.png`,fullPage:true});
      console.log(`PASS builder/project form ${width}x${height}: preview, no auto advance, compact bounds, three cards, mode selector`);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS legacy, refresh, mode switching preserves selections/history, hidden-step relocation, embedded faucet, grout help, clipboard, print, consultation edit/return, no runtime errors');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
