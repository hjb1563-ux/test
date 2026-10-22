const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3000';
const key = 'bath-designer-selections-v2';
const emptyText = '옵션을 선택하면 시공 예시 이미지가 여기에 표시됩니다.';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
    await require('./helpers/font-response-cache.cjs').install(page.context(), errors);
  fs.mkdirSync('tests/artifacts/preview-sync', { recursive: true });
  const group = () => page.locator('.choiceGroup:visible');
  const next = () => page.locator('.mobileBuilderNav .button').click();
  const previous = () => page.locator('.mobileBuilderNav>.secondary').first().click();
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  async function seed(step, values = {}, imageHistoryOrder = [], extra = '') {
    await page.goto(base + '/design'); await page.locator('.projectInfoForm,.builderCompactFlow').first().waitFor();
    await page.evaluate(({ key, step, values, imageHistoryOrder }) => localStorage.setItem(key, JSON.stringify({ version: 3, current: step - 1, values, imageHistoryOrder, projectInfo: { projectName: 'Preview 테스트', builderMode: 'consumer' } })), { key, step, values, imageHistoryOrder });
    await page.goto(base + '/design?step=' + step + extra); await page.locator('.builderCompactFlow').waitFor();
  }
  async function empty() {
    assert.equal(await page.locator('.builderSwipeEmpty').textContent(), emptyText);
    assert.equal(await page.locator('.builderSwipeTrack').count(), 0);
    assert.equal(await page.locator('.builderSwipeCounter').count(), 0);
  }
  async function image(label, count) {
    await page.waitForFunction(label => document.querySelector('.builderSwipeLabel')?.textContent === label, label);
    assert.equal(await page.locator('.builderSwipeSlide').count(), count);
    assert.equal(await page.locator('.builderSwipeEmpty').count(), 0);
    const index = await page.locator('.builderSwipeTrack').evaluate(element => Math.round(element.scrollLeft / element.clientWidth));
    assert.equal(await page.locator('.builderSwipeSlide img').nth(index).getAttribute('alt'), label + ' 선택 이미지');
    if (count > 1) assert.equal(await page.locator('.builderSwipeCounter').textContent(), `${index + 1} / ${count}`);
    return index;
  }
  async function unchanged(before) {
    const after = await saved(); assert.deepEqual(after.values, before.values); assert.deepEqual(after.imageHistoryOrder, before.imageHistoryOrder);
  }
  async function settled() {
    await page.locator('.builderSwipeTrack').evaluate(element => new Promise(resolve => {
      let timer; const finish = () => { clearTimeout(timer); element.removeEventListener('scroll', moved); resolve(); };
      const moved = () => { clearTimeout(timer); timer = setTimeout(finish, 180); }; element.addEventListener('scroll', moved); moved();
    }));
  }
  try {
    for (const [width, height] of [[430, 932], [390, 844], [375, 812]]) {
      await page.setViewportSize({ width, height }); await seed(4); await empty();
      const emptyHeight = await page.locator('.builderSwipeEmpty').evaluate(element => element.offsetHeight);
      await group().getByRole('radio', { name: '600×600', exact: true }).click(); await image('600×600', 1);
      assert.equal(await page.locator('.builderSwipeTrack').evaluate(element => element.offsetHeight), emptyHeight);
      let before = await saved(); await next(); await empty(); await unchanged(before);
      await page.screenshot({ path: `tests/artifacts/preview-sync/empty-${width}.png`, fullPage: true, animations: 'disabled' });
      await group().getByRole('radio', { name: '화이트', exact: true }).click(); await image('화이트', 2);
      assert.equal(new URL(await page.locator('.builderSwipeSlide img').first().getAttribute('src'), base).pathname, require('../data/bathroom-builder-tile-images.generated.json')['600x600'].white);
      await next(); await empty();
      await group().getByRole('radio', { name: '무광', exact: true }).click(); await image('무광', 3);
      assert.equal(new URL(await page.locator('.builderSwipeSlide img').first().getAttribute('src'), base).pathname, require('../data/bathroom-builder-tile-surface-images.generated.json')['600x600'].white.matte);
      before = await saved(); await previous(); assert.equal(await image('화이트', 3), 1); await unchanged(before);
      await previous(); assert.equal(await image('600×600', 3), 2); await unchanged(before);
      await next(); assert.equal(await image('화이트', 3), 1);
      // Native swipe changes only the viewed slide.
      await page.locator('.builderSwipeTrack').scrollIntoViewIfNeeded();
      const box = await page.locator('.builderSwipeTrack').boundingBox(); const session = await context.newCDPSession(page);
      const x = Math.round(box.x + box.width * .85), y = Math.round(box.y + box.height * .5);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let move = 1; move <= 12; move++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - Math.round(box.width * .7 * move / 12), y }] }); await page.waitForTimeout(20); }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settled(); await session.detach();
      assert.notEqual(await page.locator('.builderSwipeLabel').textContent(), '화이트'); await unchanged(before);
      const viewedLabel = await page.locator('.builderSwipeLabel').textContent();
      await page.locator('.builderPreviewPanel>.builderDisclosureToggle').evaluate(button => button.click());
      assert.equal(await page.locator('.builderSwipeLabel').textContent(), viewedLabel);
      await group().getByRole('radio', { name: '다크', exact: true }).click(); assert.equal(await image('다크', 3), 0);
      await page.screenshot({ path: `tests/artifacts/preview-sync/restored-${width}.png`, fullPage: true, animations: 'disabled' });
      await next(); assert.equal(await image('무광', 3), 1);
      await next(); await empty();
      before = await saved(); await previous(); await image('무광', 3); await unchanged(before);
      await page.reload(); await page.locator('.builderCompactFlow').waitFor(); await image('600×600', 3);
      await seed(4, before.values, before.imageHistoryOrder, '&returnTo=consultation'); await image('600×600', 3);
      await page.locator('.builderConsultationEdit a').click(); await page.locator('.consultationSheet').waitFor();
      await seed(4); await group().getByRole('radio', { name: '기타 타일', exact: true }).click(); await page.locator('#builder-wallTileSize-other').fill('특수 타일'); await empty();
      await next(); await previous(); await empty(); assert.equal(await page.locator('#builder-wallTileSize-other').inputValue(), '특수 타일');
      await seed(9); await next();
      await group().getByRole('checkbox', { name: '일반 샤워&욕조 수전', exact: true }).click();
      await group().getByRole('checkbox', { name: '매립 샤워&욕조 수전', exact: true }).click(); await image('매립 샤워&욕조 수전', 2);
      before = await saved(); await previous(); await empty(); await next(); await image('매립 샤워&욕조 수전', 2); await unchanged(before);
      await group().getByRole('checkbox', { name: '매립 샤워&욕조 수전', exact: true }).click(); await image('일반 샤워&욕조 수전', 1);
      await previous(); await next(); await image('일반 샤워&욕조 수전', 1);
      await group().getByRole('checkbox', { name: '일반 샤워&욕조 수전', exact: true }).click(); await empty();
      assert.equal(await page.locator('.builderSummaryPanel').isVisible(), false); assert.equal(await page.locator('.selectionHistory').isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      console.log(`PASS ${width}x${height}: empty, forward/back restoration, stable IDs/order, resolver, touch, unrelated render, multi removal, text, refresh/edit, STEP`);
    }
    for (const [width, height] of [[768, 1024], [1024, 768], [1280, 720], [1440, 900], [1920, 1080]]) {
      await page.setViewportSize({ width, height }); await seed(4, { wallTileSize: '600x600', tile: 'white', tileSurface: 'matte' }, ['tileSurface:matte', 'tile:white', 'wallTileSize:600x600']);
      assert.equal(await page.locator('.builderSwipeGallery').isVisible(), false);
      assert.equal(await page.locator('.selectedHeroImage').count(), 0);
      assert.equal(await page.locator('.builderSummaryPanel').isVisible(), true);
      if (width < 1200) await page.locator('.selectionHistory>.builderDisclosureToggle').click();
      await page.locator('.historyPreviewButton').first().click(); assert.equal(await page.locator('.selectedHeroImage').isVisible(), true);
      if (width < 1200) { await next(); assert.equal(await page.locator('.selectedHeroImage').count(), 0); }
      else assert.equal(await page.locator('.designGrid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 3);
      console.log(`PASS ${width}x${height}: existing preview reset, history thumbnails, summary`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
