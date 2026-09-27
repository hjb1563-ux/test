// Run with an existing Playwright install; no application dependency is added.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3000';
const output = process.env.BUILDER_SCREENSHOTS || path.join(require('node:os').tmpdir(), 'bath-responsive');
const storageKey = 'bath-designer-selections-v2';
const dimensions = [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[430,932],[390,844],[375,812]];

(async () => {
  const { loadOptions } = await import('../scripts/sync-builder-images.mjs');
  const options = await loadOptions();
  const complete = {};
  for (const option of options) {
    if (!complete[option.groupKey] && !['other','undecided','consult'].includes(option.id) && !/모르겠|unknown/.test(option.id + option.name)) complete[option.groupKey] = option.id;
  }
  Object.assign(complete, { jendai:['new','toilet-ledger'],partition:'none',showerBooth:'fixed-glass',niche:'shower-niche',concealed:['concealed-basin','concealed-shower'],toilet:'wall-hung',lighting:['light-recessed','indirect','cabinet-indirect'],ventilation:['other'],ventilationOther:'긴 선택값과 현장 요청 '.repeat(18),accessory:['other'],accessoryOther:'긴 액세서리 선택값 '.repeat(18) });
  const layoutValues = { jendai:['new','toilet-ledger'],partition:'none',showerBooth:'fixed-glass',niche:'shower-niche',concealed:['concealed-basin','concealed-shower'] };
  const browser = await chromium.launch({ channel:process.env.BROWSER_CHANNEL || 'chrome', headless:true });
  await fs.mkdir(output, { recursive:true });
  const errors = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydration|hydrating|did not match/i.test(message.text())) errors.push(message.text()); });
  await page.goto(`${base}/design`);
  async function seed(current, values = {}, notes = '') {
    await page.evaluate(({storageKey,current,values,notes}) => localStorage.setItem(storageKey, JSON.stringify({current,values,specialNotes:notes,memo:'현장 메모 유지',checks:{}})), {storageKey,current,values,notes});
    await page.goto(`${base}/design?step=${current + 1}`);
    await page.locator('.progressHeading [role=status]').filter({hasText:'자동 저장됨'}).waitFor();
    await page.waitForFunction(current => document.querySelector('.progressHeading')?.textContent.includes(`STEP ${String(current + 1).padStart(2,'0')}`), current);
    await page.evaluate(() => document.fonts.ready);
  }
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  async function noOverflow(label) {
    const size = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(size.scroll <= size.client + 1, `${label}: horizontal overflow ${JSON.stringify(size)}`);
  }
  try {
    for (const [width,height] of dimensions) {
      await page.setViewportSize({width,height});
      for (const [step,values] of [[0,{}],[1,layoutValues],[16,complete]]) {
        await seed(step, values, step === 16 ? '특이사항을 그대로 보관합니다.' : '');
        await noOverflow(`${width}x${height} STEP ${step+1}`);
        assert.equal(await page.locator('.siteFooter').count(), 0);
        if (step < 16) {
          assert.equal(await page.locator('.summary img').count(), 0);
          if (width < 768) {
            const first = await page.locator('.builderChoiceCard:visible').first().boundingBox();
            assert.ok(first.y < height - 70, `first choice outside viewport: ${first.y}`);
            assert.ok(first.height >= 48);
            assert.equal(await page.locator('.choiceGroup[data-accordion=true][data-open=true]').count(), 1);
            assert.equal(await page.locator('.builderPreviewPanel .selectedGallery').isVisible(), false);
          } else if (width >= 1200) {
            const panels = await Promise.all(['.options','.builderPreviewPanel','.builderSummaryPanel'].map(s=>page.locator(s).boundingBox()));
            assert.ok(panels[0].x < panels[1].x && panels[1].x < panels[2].x);
            assert.ok(panels.every(p=>Math.abs(p.y-panels[0].y)<2));
            if (step === 0) assert.ok(panels[1].height < 240, 'empty preview must stay compact');
          }
        } else {
          assert.equal(await page.locator('.reviewResolved').count(), 1, 'fully selected fixture has zero pending');
          assert.ok((await page.locator('.reviewResolved').boundingBox()).height < 70);
          assert.ok(await page.locator('.reviewFollowups li').count() >= 10);
          assert.equal(await page.locator('.reviewCategory').count(), 16);
          if (width < 768) assert.equal(await page.locator('.reviewCategory dl:visible').count(),0);
        }
        await page.screenshot({path:path.join(output,`${width}x${height}-step${step+1}.png`),fullPage:true,animations:'disabled'});
      }
      console.log(`PASS ${width}x${height}: STEP 1/2/17, ordering, no overflow, footer, empty state`);
    }
    await page.setViewportSize({width:390,height:844});
    await seed(1);
    const group = key => page.locator(`.choiceGroup:has(#builder-${key}-toggle)`);
    await group('jendai').getByRole('checkbox',{name:'젠다이 신설',exact:true}).click();
    assert.equal(await group('jendai').getAttribute('data-open'),'true');
    await group('jendai').getByRole('checkbox',{name:'변기 젠다이',exact:true}).click();
    await page.locator('#builder-partition-toggle').click();
    await group('partition').getByRole('radio',{name:'하프 파티션',exact:true}).click();
    assert.equal(await group('showerBooth').getAttribute('data-open'),'true');
    assert.equal(await group('showerBooth').getByRole('radio',{name:'고정 유리',exact:true}).isDisabled(),true);
    const before = (await saved()).values;
    await page.locator('.builderPreviewPanel>.builderDisclosureToggle').click();
    await page.locator('.selectedHeroImage img').waitFor({state:'visible'});
    assert.equal(await page.locator('.selectionHistoryStrip').isVisible(), false);
    await page.locator('.selectionHistory>.builderDisclosureToggle').click();
    assert.ok(await page.locator('.selectionHistoryStrip img').count() >= 3);
    await page.screenshot({path:path.join(output,'mobile-preview-expanded.png'),fullPage:true,animations:'disabled'});
    await page.locator('.builderPreviewPanel>.builderDisclosureToggle').click();
    await page.locator('.builderSummaryPanel>.builderDisclosureToggle').click();
    await page.locator('.builderSummaryPanel>.builderDisclosureToggle').click();
    assert.deepEqual((await saved()).values,before);
    for (const [width,height] of [[1440,900],[768,1024],[375,812],[1280,720],[390,844]]) {
      await page.setViewportSize({width,height});
      await noOverflow('resize');
      assert.deepEqual((await saved()).values,before);
      assert.equal((await saved()).current,1);
      if(width>=1200) assert.equal(await page.locator('.builderSectionContent:visible').count(),5);
    }
    await page.reload();
    await page.locator('.progressHeading [role=status]').filter({hasText:'자동 저장됨'}).waitFor();
    assert.deepEqual((await saved()).values,before);
    assert.equal(await group('jendai').getAttribute('data-open'),'true');
    await page.locator('.mobileBuilderNav').getByRole('button',{name:'다음',exact:true}).click();
    await page.waitForFunction(()=>window.scrollY===0 && document.activeElement?.id==='builder-question');
    assert.equal((await saved()).current,2);
    await page.locator('.builderChoiceCard:visible').last().scrollIntoViewIfNeeded();
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    const last = await page.locator('.builderChoiceCard:visible').last().boundingBox();
    const nav = await page.locator('.mobileBuilderNav').boundingBox();
    assert.ok(last.y + last.height <= nav.y, 'last option clear of bottom bar');
    await seed(16,complete,'특이사항 유지');
    await page.locator('.reviewCategoryDetail>.builderDisclosureToggle').nth(3).click();
    assert.equal(await page.locator('.reviewCategory').nth(3).locator('dl').isVisible(),true);
    await page.getByLabel('특이사항',{exact:true}).fill('수정한 특이사항');
    await page.reload();
    await page.locator('.progressHeading [role=status]').filter({hasText:'자동 저장됨'}).waitFor();
    assert.equal(await page.getByLabel('특이사항',{exact:true}).inputValue(),'수정한 특이사항');
    assert.equal((await saved()).memo,'현장 메모 유지');
    await page.locator('.reviewCategory').nth(3).getByRole('button',{name:/수정/}).click();
    await page.waitForFunction(()=>window.scrollY===0 && document.activeElement?.id==='builder-question');
    assert.equal((await saved()).current,3);
    for (const width of [375,768,1280]) {
      await page.setViewportSize({width,height:844});
      for (let step=0;step<16;step++) {
        await seed(step,complete);
        await noOverflow(`all steps ${width} STEP ${step+1}`);
        if(width<768) {
          const toggles=page.locator('.builderSectionToggle');
          for(let i=0;i<await toggles.count();i++) {
            if(await toggles.nth(i).getAttribute('aria-expanded')==='false') await toggles.nth(i).click();
            await noOverflow(`expanded section ${width} STEP ${step+1}`);
          }
        }
      }
    }
    console.log('PASS all 16 selection steps at mobile/tablet/desktop widths, including expanded long text');
    for(const route of ['/','/guide','/result']) {
      await page.goto(base+route);
      await page.locator('.siteFooter').waitFor();
      if(route==='/result') { await page.locator('.sheetStep').nth(15).waitFor(); assert.equal(await page.locator('.sheetStep').count(),16); }
    }
    assert.deepEqual(errors,[]);
    console.log('PASS interactions: single advance, multi stays open, exclusivity, disclosures, resize, reload, navigation focus/scroll, bottom clearance, review details/notes, other routes, no hydration errors');
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
