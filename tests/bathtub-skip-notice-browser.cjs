const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://127.0.0.1:3000', key = 'bath-designer-selections-v2';
const message = '선택한 구성에서는 욕조 선택 단계를 건너뜁니다.';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext(); const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await context.route('**/api/**', r => r.abort());
  await context.route('https://fonts.googleapis.com/**', r => r.abort());
  await context.route('https://fonts.gstatic.com/**', r => r.abort());
  const group = page.locator('#builder-partitionShower-content');
  const notice = page.locator('#builder-bathtub-skip-notice');
  async function open() {
    await page.goto(base + '/design?step=2'); await group.waitFor({ state: 'attached' });
    if (!await group.isVisible()) await page.locator('.mobileBuilderNav').getByRole('button', { name: '다음 항목 →', exact: true }).click();
    await group.waitFor();
  }
  try {
    fs.mkdirSync('tests/artifacts/bathtub-skip-notice', { recursive: true });
    for (const [width, height] of [[375,900],[390,900],[430,900],[768,1024],[1024,768],[1366,768],[1440,900],[1920,1080]]) for (const mode of ['consumer','professional']) {
      await page.setViewportSize({ width, height }); await page.goto(base);
      await page.evaluate(({ key, mode }) => localStorage.setItem(key, JSON.stringify({ version: 3, projectInfo: { builderMode: mode, projectName: 'Notice test' }, values: { bathtub: 'bath-standard' }, memo: 'preserved' })), { key, mode });
      await open(); assert.equal(await notice.count(), 0);
      for (const label of ['하프 파티션','풀 파티션','고정 유리형 샤워부스','도어형 샤워부스']) {
        const card = group.getByRole('radio', { name: label, exact: true });
        await card.focus(); await page.keyboard.press('Space');
        await notice.waitFor(); assert.equal(await notice.textContent(), message); assert.equal(await notice.count(), 1);
        assert.equal(await card.evaluate(el => document.activeElement === el), true);
        assert.equal(await notice.locator('svg').getAttribute('aria-hidden'), 'true');
        assert.equal(await notice.locator('..').getAttribute('role'), 'status');
        assert.equal(await notice.locator('..').getAttribute('aria-live'), 'polite');
        assert.ok(await notice.evaluate(el => { const a=el.getBoundingClientRect(),b=el.parentElement.previousElementSibling.getBoundingClientRect();return a.top-b.bottom>=12&&a.top-b.bottom<=16&&el.scrollWidth<=el.clientWidth; }));
        await card.press('Space'); await notice.waitFor({ state: 'detached' });
      }
      for (const label of ['없음','욕조 파티션']) {
        const card = group.getByRole('radio', { name: label, exact: true }); await card.click(); assert.equal(await notice.count(), 0); await card.click();
      }
      await group.getByRole('radio', { name: '하프 파티션', exact: true }).click();
      await page.reload(); await open(); await notice.waitFor();
      await page.goto(base + '/design?step=4'); await page.locator('progress').waitFor(); await open(); await notice.waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await notice.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/artifacts/bathtub-skip-notice/${width}-${mode}.png`, fullPage: true });
      assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).values.bathtub, key), 'bath-standard');
      console.log(`PASS notice ${width} ${mode}: four choices, clear/other choices, keyboard focus, status semantics, restore/return, spacing/overflow`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
