const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3000';
const key = 'bath-designer-selections-v2';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ permissions: ['clipboard-read','clipboard-write'] });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.print = () => { window.printCount = (window.printCount || 0) + 1; }; });
  fs.mkdirSync('tests/artifacts/ceiling', { recursive: true });
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  let mobile;
  async function seed(step, mode, values = {}) {
    await page.goto(base + '/design'); await page.locator('.projectInfoForm,.builderCompactFlow').first().waitFor();
    await page.evaluate(({ key, step, mode, values }) => localStorage.setItem(key, JSON.stringify({ version: 3, current: step - 1, values, projectInfo: { projectName: '천장 검증', builderMode: mode }, imageHistoryOrder: [] })), { key, step, mode, values });
    await page.goto(base + '/design?step=' + step); await page.locator('.builderCompactFlow').waitFor();
  }
  async function changeMode(mode) {
    await page.locator('.projectIdentity button').click();
    await page.getByRole('radio', { name: mode === 'consumer' ? /일반 고객용/ : /전문가용/ }).click();
    await page.getByRole('button', { name: '프로젝트 정보 저장', exact: true }).click(); await page.locator('.builderCompactFlow').waitFor();
  }
  async function preview(name, pathPart) {
    if (mobile) await page.waitForFunction(name => document.querySelector('.builderSwipeLabel')?.textContent === name, name);
    const image = page.locator(mobile ? '.builderSwipeSlide img' : '.selectedHeroImage img').first();
    await image.waitFor();
    assert.ok(decodeURIComponent(await image.getAttribute('src')).includes(pathPart));
    await image.evaluate(async image => { if (!image.complete) await new Promise(resolve => image.addEventListener('load', resolve, { once: true })); });
    assert.ok(await image.evaluate(image => image.naturalWidth > 0));
  }
  async function report(mode, label) {
    await page.goto(base + '/result'); await page.locator('.sheetStep').first().waitFor();
    const card = page.locator('#consultation-ceiling');
    assert.ok((await card.textContent()).includes(label));
    assert.ok(!(await card.textContent()).includes(mode === 'consumer' ? '도장' : '고급용'));
    await page.getByRole('button', { name: '요약만 복사', exact: true }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText()); assert.ok(text.includes(label));
    assert.ok(!text.includes(mode === 'consumer' ? '도장' : '고급용'));
    assert.equal(await page.getByRole('button', { name: '선택 내용 복사', exact: true }).count(), 0);
    await page.getByRole('button', { name: '인쇄 / PDF 저장', exact: true }).click(); assert.equal(await page.evaluate(() => window.printCount), 1);
    if (page.viewportSize().width === 390) {
      await page.getByRole('button', { name: '상담서 이미지 복사', exact: true }).click();
      await page.getByText('상담서 이미지가 복사되었습니다.', { exact: true }).waitFor({ timeout: 60000 });
      assert.equal(await page.evaluate(async () => (await navigator.clipboard.read()).some(item => item.types.includes('image/png'))), true);
    }
  }
  try {
    for (const [width, height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[430,932],[390,844],[375,812]]) {
      mobile = width < 768; await page.setViewportSize({ width, height });
      for (const mode of ['consumer','professional']) {
        await seed(2, mode, { jendai: ['new'] });
        if (!mobile) { if (width < 1200) await page.locator('.selectionHistory>.builderDisclosureToggle').click(); await page.locator('.historyPreviewButton').first().click(); }
        await preview('젠다이 신설', '젠다이 신설6.png'); assert.deepEqual((await saved()).values.jendai, ['new']);
      }
      await seed(8, 'professional', { ceilingPreference: 'premium' });
      const group = page.locator('#builder-ceiling-content');
      assert.deepEqual(await group.locator('[role=radio] .builderChoiceLabel').allTextContents(), ['SMC 평천장','SMC 돔천장','이노솔','도장','기타']);
      await group.getByRole('radio', { name: '이노솔', exact: true }).click(); await preview('이노솔', '천장 이노솔 마감.png');
      await group.getByRole('radio', { name: '도장', exact: true }).click(); await preview('도장', '천장 도장 마감.png');
      assert.equal((await saved()).imageHistoryOrder.includes('ceiling:inosol'), false); assert.equal((await saved()).imageHistoryOrder[0], 'ceiling:painted');
      const nav = page.locator(width < 1200 ? '.mobileBuilderNav' : '.options .navButtons');
      await nav.locator('.button').click(); await nav.locator('button.secondary').first().click();
      assert.equal(await page.getByRole('radio', { name: '도장', exact: true }).getAttribute('aria-checked'), 'true');
      if (mobile) await preview('도장', '천장 도장 마감.png');
      await page.reload(); await page.locator('.builderCompactFlow').waitFor();
      if (mobile) await preview('도장', '천장 도장 마감.png');
      await changeMode('consumer');
      const preference = page.locator('#builder-ceilingPreference-content');
      assert.deepEqual(await preference.locator('[role=radio] .builderChoiceLabel').allTextContents(), ['일반용','고급용','자유로운 디자인']);
      assert.equal(await preference.getByRole('radio', { name: '고급용', exact: true }).getAttribute('aria-checked'), 'true');
      const historyBefore = (await saved()).imageHistoryOrder;
      for (const label of ['일반용','자유로운 디자인','고급용']) {
        await preference.getByRole('radio', { name: label, exact: true }).click();
        assert.deepEqual((await saved()).imageHistoryOrder, historyBefore);
        if (mobile) { assert.equal(await page.locator('.builderSwipeTrack').count(), 0); assert.equal(await page.locator('.builderSwipeEmpty').isVisible(), true); }
      }
      assert.equal((await saved()).values.ceiling, 'painted'); assert.equal((await saved()).values.ceilingPreference, 'premium');
      await nav.locator('.button').click(); await nav.locator('button.secondary').first().click();
      assert.equal(await preference.getByRole('radio', { name: '고급용', exact: true }).getAttribute('aria-checked'), 'true');
      await page.screenshot({ path: `tests/artifacts/ceiling/consumer-${width}.png`, fullPage: true, animations: 'disabled' });
      await report('consumer', '고급용');
      await page.goto(base + '/design?step=8'); await page.locator('.builderCompactFlow').waitFor(); await changeMode('professional');
      assert.equal(await page.getByRole('radio', { name: '도장', exact: true }).getAttribute('aria-checked'), 'true');
      if (!mobile) { if (width < 1200) await page.locator('.selectionHistory>.builderDisclosureToggle').click(); await page.locator('.historyPreviewButton').first().click(); }
      await preview('도장', '천장 도장 마감.png');
      await page.screenshot({ path: `tests/artifacts/ceiling/professional-${width}.png`, fullPage: true, animations: 'disabled' });
      await report('professional', '도장');
      for (const [id, label] of [['smc-flat','SMC 평천장'],['smc-dome','SMC 돔천장']]) {
        await seed(8, 'consumer', { ceiling: id });
        assert.equal(await page.locator('#builder-ceilingPreference-content [aria-checked=true]').count(), 0);
        await changeMode('professional'); assert.equal(await page.getByRole('radio', { name: label, exact: true }).getAttribute('aria-checked'), 'true');
        if (mobile) assert.equal(await page.locator('.builderSwipeLabel').textContent(), label);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      console.log(`PASS ${width}x${height}: jendai, new professional images, consumer no-image, mode preservation, report/copy/print, legacy, restore`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
