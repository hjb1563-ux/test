const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://127.0.0.1:3000';
const key = 'bath-designer-selections-v2';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext(); const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await context.route('https://fonts.googleapis.com/**', r => r.abort());
  await context.route('https://fonts.gstatic.com/**', r => r.abort());
  async function open(step) { await page.goto(base + '/design?step=' + step); await page.locator('.stepMeta').waitFor({ state: 'attached' }); }
  async function seed(mode, partitionShower) {
    await page.goto(base);
    await page.evaluate(({ key, mode, partitionShower }) => localStorage.setItem(key, JSON.stringify({ version: 3, current: 5, projectInfo: { projectName: 'Skip test', builderMode: mode }, values: { partitionShower, bathtub: 'bath-standard' }, memo: 'preserve' })), { key, mode, partitionShower });
  }
  try {
    for (const mode of ['consumer', 'professional']) {
      for (const id of ['half-partition', 'full-partition', 'fixed-glass', 'door-booth']) {
        await page.setViewportSize({ width: 1440, height: 900 }); await seed(mode, id);
        await open(6); // stable index 5: furniture; bathtub is stable index 6
        const expectedBefore = mode === 'consumer' ? '05' : '06';
        const expectedAfter = mode === 'consumer' ? '07' : '08';
        assert.ok((await page.locator('.stepMeta').innerText()).includes('STEP ' + expectedBefore));
        await page.locator('.navButtons').getByRole('button', { name: '다음', exact: true }).click();
        assert.ok((await page.locator('.stepMeta').innerText()).includes('STEP ' + expectedAfter));
        await page.locator('.navButtons').getByRole('button', { name: '이전', exact: true }).click();
        assert.ok((await page.locator('.stepMeta').innerText()).includes('STEP ' + expectedBefore));
        await open(7); assert.equal(await page.locator('#builder-bathtub-content').count(), 0);
        await page.goto(base + '/result');
        const bath = page.locator('[data-selection-key="bathtub"]');
        await bath.waitFor(); assert.equal(await bath.getAttribute('data-selection-status'), 'excluded');
        assert.ok(!(await bath.innerText()).includes('일반 욕조')); assert.ok(!(await bath.innerText()).includes('상담 시 확인 필요'));
        await page.reload(); await bath.waitFor(); assert.equal(await bath.getAttribute('data-selection-status'), 'excluded');
        await open(2);
        await page.locator('#builder-partitionShower-content').getByRole('radio', { name: { 'half-partition': '하프 파티션', 'full-partition': '풀 파티션', 'fixed-glass': '고정 유리형 샤워부스', 'door-booth': '도어형 샤워부스' }[id], exact: true }).click();
        await page.waitForFunction(key => !JSON.parse(localStorage.getItem(key)).values.partitionShower, key);
        await open(7); assert.ok(await page.locator('#builder-bathtub-content').isVisible());
        assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).values.bathtub, key), 'bath-standard');
      }
    }
    for (const [width, height] of [[375,900],[390,900],[430,900],[1366,768],[1440,900]]) {
      await page.setViewportSize({ width, height }); await seed('consumer', 'half-partition'); await open(6);
      const nav = width < 768 ? page.locator('.mobileBuilderNav') : page.locator('.navButtons');
      await nav.getByRole('button', { name: width < 768 ? '현재 STEP 전체 건너뛰기' : '다음', exact: true }).click();
      assert.ok((await page.locator('.stepMeta').innerText()).includes('STEP 07'));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await nav.getByRole('button', { name: '이전', exact: true }).click();
      assert.ok((await page.locator('.stepMeta').innerText()).includes('STEP 05'));
      await open(15);
      await nav.getByRole('link', { name: /상담서 보기/ }).click();
      await page.locator('[data-selection-key="bathtub"]').waitFor();
      assert.equal(await page.locator('[data-selection-key="bathtub"]').getAttribute('data-selection-status'), 'excluded');
    }
    assert.deepEqual(errors, []);
    console.log('PASS browser: 4 IDs x 2 modes, next/previous/direct, result/refresh, deselection/restoration, five viewports, no runtime errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
