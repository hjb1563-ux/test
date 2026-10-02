const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3100';
const output = path.join(require('node:os').tmpdir(), 'bath-catalog-preview');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const externalFailures = new Set();
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const url = message.location().url;
    // Existing external fonts and the absent favicon are outside this Builder change.
    if (url?.startsWith('https://fonts.googleapis.com/') || url === base + '/favicon.ico') { externalFailures.add(url); return; }
    errors.push(`${message.text()} ${url}`);
  });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const key = 'bath-designer-selections-v2';
  const group = name => page.locator(`.choiceGroup:has(#builder-${name}-content)`);
  const saved = () => page.evaluate(key => localStorage.getItem(key), key);
  async function seed(current, values = {}) {
    await page.evaluate(({ key, current, values }) => localStorage.setItem(key, JSON.stringify({ version: 3, current, values })), { key, current, values });
    await page.goto(base + '/design');
    const mappings = JSON.parse(await fs.readFile(path.join(__dirname, '../data/bathroom-builder-image-settings.generated.json'), 'utf8'));
    for (const setting of Object.values(mappings)) if (setting.showBuilderImage) {
      const response = await context.request.get(base + setting.builderImage);
      assert.equal(response.status(), 200, setting.builderImage);
    }
    await page.waitForFunction(current => document.querySelector('progress')?.value === current + 1, current);
    await page.locator('.progressHeading').getByText('자동 저장됨').waitFor();
  }
  async function overflow() { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  async function previewOpen() {
    for (const selector of ['.builderPreviewPanel', '.selectionHistory']) {
      const section = page.locator(selector), toggle = section.locator('> .builderDisclosureToggle');
      if (await toggle.isVisible() && await section.getAttribute('data-open') === 'false') await toggle.click();
    }
  }
  async function hero(label) {
    await page.locator('.selectedHeroLabel').filter({ hasText: label }).waitFor();
    assert.equal(await page.locator('.selectedHeroLabel').innerText(), label);
    await page.locator('.selectedHeroImage img').evaluate(async img => { if (!img.complete) await new Promise(resolve => img.addEventListener('load', resolve, { once: true })); });
    assert.ok(await page.locator('.selectedHeroImage img').evaluate(img => img.naturalWidth > 0 && getComputedStyle(img).objectFit === 'contain' && !img.src.includes('placeholder')));
  }
  try {
    await fs.mkdir(output, { recursive: true });
    await page.goto(base + '/design');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await seed(0, { bathroomCondition: ['cracked', 'loose', 'other'], bathroomConditionOther: '천장에서 누수 흔적 있음' });
    assert.deepEqual(JSON.parse(await saved()).values.bathroomCondition, ['damaged-tile', 'other']);
    assert.equal(await group('bathroomCondition').getByRole('checkbox', { name: '기존타일이 깨졌거나 들떠 있다', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('#builder-bathroomCondition-other').inputValue(), '천장에서 누수 흔적 있음');
    await page.locator('#builder-bathroomCondition-other').fill('곰팡이가 심함'); await page.reload();
    assert.equal(await page.locator('#builder-bathroomCondition-other').inputValue(), '곰팡이가 심함');
    assert.equal(await group('bathroomCondition').getByRole('checkbox', { name: '누수 이력이 있다', exact: true }).count(), 1);
    assert.equal(await group('bathroomCondition').getByRole('checkbox', { name: '욕조를 철거하고 싶다', exact: true }).count(), 1);
    await seed(8, { faucet: 'one-hole' });
    assert.equal(await group('faucet').getByRole('radio', { name: '일반 세면 수전', exact: true }).getAttribute('aria-checked'), 'true');
    await page.getByRole('button', { name: '일반 세면 수전 이미지 크게 보기', exact: true }).click(); await hero('일반 세면 수전');
    await seed(1, { niche: 'shower-niche' });
    assert.equal(await page.locator('.selectedHeroImage').count(), 0);
    await page.getByRole('button', { name: '샤워 샴푸박스 이미지 크게 보기', exact: true }).click(); await hero('샤워 샴푸박스');
    assert.ok(!(await group('niche').innerText()).includes('니치'));
    await group('niche').getByRole('radio', { name: '세면대 샴푸박스', exact: true }).click(); await hero('세면대 샴푸박스');
    await seed(2, { waterproofing: 'liquid-waterproofing' }); assert.equal(JSON.parse(await saved()).values.waterproofing, undefined);
    assert.equal(await group('waterproofing').getByRole('radio', { name: '액방', exact: true }).count(), 0);
    assert.equal(await group('waterproofing').getByRole('radio', { name: '액방 + 도막', exact: true }).count(), 1);
    await seed(5, { cabinet: 'led-cabinet', mirror: 'led-mirror' }); assert.equal(JSON.parse(await saved()).values.cabinet, undefined);
    assert.equal(await group('cabinet').getByRole('radio', { name: 'LED 거울장', exact: true }).count(), 0);
    await group('cabinet').getByRole('radio', { name: '일반 거울장', exact: true }).click();
    assert.equal(JSON.parse(await saved()).values.mirror, 'led-mirror');
    await seed(10, { ventilation: ['fan', 'strong-fan', 'dehumidify', 'dry', 'heater', 'other'], ventilationOther: '힘펠 휴젠뜨' });
    assert.equal(JSON.parse(await saved()).values.ventilation, undefined);
    assert.equal(await group('ventilation').getByRole('checkbox').count(), 0);
    assert.equal(await group('ventilation').getByRole('radio').count(), 0);
    assert.equal(await group('ventilation').locator('h2').innerText(), '환풍기');
    assert.ok(!(await group('ventilation').innerText()).includes('복수 선택'));
    assert.ok(!(await group('ventilation').innerText()).includes('기타'));
    const fanInput = page.locator('#builder-ventilation-other'); assert.equal(await fanInput.inputValue(), '힘펠 휴젠뜨');
    await fanInput.fill('   '); assert.equal(await page.locator('.summaryRow b').innerText(), '미정');
    await fanInput.fill('힘펠 제로크'); await page.reload(); assert.equal(await fanInput.inputValue(), '힘펠 제로크');
    assert.equal(await page.locator('.selectedGallery img').count(), 0);
    await seed(13, { grout: 'grout-elastic' }); assert.equal(JSON.parse(await saved()).values.grout, undefined);
    await group('grout').getByRole('radio', { name: '폴리우레아 줄눈', exact: true }).click(); await hero('폴리우레아 줄눈');
    assert.ok(decodeURIComponent(await page.locator('.selectedHeroImage img').getAttribute('src')).endsWith('폴리우레아 줄눈.png'));

    const images = { demolition: 'full-demolition', partitionShower: 'half-partition', wallTileSize: '600x600', grout: 'grout-polyurea' };
    for (const [width, height] of [[1920, 1080], [1440, 900], [1024, 768], [430, 932], [390, 844], [375, 812]]) {
      await page.setViewportSize({ width, height }); await seed(13, images); await previewOpen();
      assert.equal(await page.locator('.selectedHeroImage').count(), 0);
      assert.equal(await page.locator('.historyPreviewButton[aria-pressed=true]').count(), 0);
      const initial = await saved();
      for (const [label, keyboard] of [['600×600', 'Enter'], ['하프 파티션', 'Space'], ['폴리우레아 줄눈', null]]) {
        const thumbnail = page.getByRole('button', { name: `${label} 이미지 크게 보기`, exact: true });
        if (keyboard) { await thumbnail.focus(); await thumbnail.press(keyboard); } else await thumbnail.tap();
        await hero(label); assert.equal(await saved(), initial);
        assert.equal(await thumbnail.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.historyPreviewButton[aria-pressed=true]').count(), 1);
        const box = await thumbnail.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44);
      }
      await overflow(); await page.screenshot({ path: path.join(output, `preview-${width}.png`), fullPage: true });
      await group('grout').getByRole('radio', { name: '폴리우레아 줄눈', exact: true }).click(); await hero('600×600');
      await group('grout').getByRole('radio', { name: '에폭시 줄눈', exact: true }).click(); await hero('에폭시 줄눈');
      await seed(13); await previewOpen(); assert.equal(await page.locator('.selectedHeroImage').count(), 0);
      // Navigation clears only the representative photo, including when returning to a selected step.
      await seed(0);
      await group('demolition').getByRole('radio', { name: '전체 철거', exact: true }).click(); await previewOpen(); await hero('전체 철거');
      const nav = page.locator(width <= 767 ? '.mobileBuilderNav' : '.navButtons');
      await nav.getByRole('button', { name: '다음', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('progress').value === 2); await previewOpen();
      assert.equal(await page.locator('.selectedHeroImage').count(), 0);
      assert.equal(await page.getByRole('button', { name: '전체 철거 이미지 크게 보기', exact: true }).count(), 1);
      const beforeHistory = await saved();
      await page.getByRole('button', { name: '전체 철거 이미지 크게 보기', exact: true }).tap(); await hero('전체 철거');
      assert.equal(await saved(), beforeHistory);
      const partition = group('partitionShower');
      if (await partition.getAttribute('data-open') === 'false' && await partition.locator('.builderSectionToggle').isVisible()) await partition.locator('.builderSectionToggle').click();
      await partition.getByRole('radio', { name: '하프 파티션', exact: true }).click(); await hero('하프 파티션');
      await nav.getByRole('button', { name: '이전', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('progress').value === 1); await previewOpen();
      assert.equal(await page.locator('.selectedHeroImage').count(), 0);
      assert.equal(JSON.parse(await saved()).values.demolition, 'full-demolition');
      assert.equal(JSON.parse(await saved()).values.partitionShower, 'half-partition');
      await page.getByRole('button', { name: '전체 철거 이미지 크게 보기', exact: true }).tap();
      await page.reload(); await previewOpen(); assert.equal(await page.locator('.selectedHeroImage').count(), 0);
      assert.equal(await page.locator('.historyPreviewButton').count(), 2);
      await seed(10, { ventilation: ['custom'], ventilationCustom: '힘펠 휴젠뜨', ...images });
      assert.equal(await fanInput.inputValue(), '힘펠 휴젠뜨');
      await fanInput.fill(''); assert.equal(await page.locator('.summaryRow b').textContent(), '미정');
      await fanInput.fill('   '); assert.equal(await page.locator('.summaryRow b').textContent(), '미정');
      await fanInput.fill('힘펠 제로크'); await page.reload(); assert.equal(await fanInput.inputValue(), '힘펠 제로크');
      assert.equal(await page.locator('.builderSummaryPanel > .builderDisclosureToggle small').textContent(), '1개');
      const fanBox = await fanInput.boundingBox(); assert.ok(fanBox.width > 150 && fanBox.height >= 44);
      assert.equal(await group('ventilation').locator('textarea,[role=radio],[role=checkbox]').count(), 0);
      await overflow(); await page.screenshot({ path: path.join(output, `fan-${width}.png`), fullPage: true });
      console.log(`PASS ${width}px: cross-step thumbnail, keyboard/touch, active state, selection isolation, fallback, no overflow`);
    }
    const values = { ...images, bathroomCondition: ['damaged-tile', 'leak', 'remove-bath', 'other'], bathroomConditionOther: '곰팡이가 심함', faucet: 'one-hole', niche: 'shower-niche', cabinet: 'standard-cabinet', ventilation: ['other'], ventilationOther: '힘펠 휴젠뜨' };
    await page.setViewportSize({ width: 1440, height: 1000 }); await seed(15, values);
    assert.ok((await page.locator('.consultationCounts').innerText()).includes('미결정'));
    assert.ok((await page.locator('.consultationCounts').innerText()).includes('현장 확인'));
    await page.getByRole('button', { name: '줄눈 수정', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('progress').value === 14);
    assert.equal(await page.locator('.selectedHeroImage').count(), 0);
    await page.getByRole('button', { name: '폴리우레아 줄눈 이미지 크게 보기', exact: true }).click();
    await page.locator('.navButtons').getByRole('button', { name: '다음', exact: true }).click();
    assert.equal(await page.locator('.selectedHeroImage').count(), 0);
    await page.locator('.navButtons').getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: '줄눈 수정', exact: true }).click();
    assert.equal(await page.locator('.selectedHeroImage').count(), 0);
    await seed(15, values);
    await page.locator('#builder-special-notes').fill('기존 특이사항 유지 확인');
    await page.getByRole('link', { name: '욕실 리모델링 상담서 보기', exact: true }).click();
    await page.locator('.sheetStep').first().waitFor();
    assert.equal(await page.locator('.consultationCounts, .sheetOverview, .fieldCheck, .recordModeToggle').count(), 0);
    assert.equal(await page.locator('.sheetCompleted').count(), 1);
    assert.ok(!/미결정|아직 결정하지 않은 항목|니치|LED 거울장|탄성 줄눈|현장 확인|현장에서 확인/.test(await page.locator('.consultationSheet').innerText()));
    for (const label of ['곰팡이가 심함', '샤워 샴푸박스', '일반 거울장', '힘펠 휴젠뜨', '폴리우레아 줄눈', '미정', '기존타일이 깨졌거나 들떠 있다']) assert.ok((await page.locator('.consultationSheet').innerText()).includes(label), label);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: '선택 내용 복사', exact: true }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(!/미결정|아직 결정하지 않은 항목|니치|현장 확인|현장에서 확인/.test(copied));
    assert.ok(copied.includes('환풍기: 힘펠 휴젠뜨'));
    for (const label of ['기존타일이 깨졌거나 들떠 있다', '누수 이력이 있다', '욕조를 철거하고 싶다', '일반 세면 수전', '기존 특이사항 유지 확인']) assert.ok(copied.includes(label));
    for (const label of ['곰팡이가 심함', '샴푸박스: 샤워 샴푸박스', '힘펠 휴젠뜨', '폴리우레아 줄눈', '변기: 미정']) assert.ok(copied.includes(label));
    await page.screenshot({ path: path.join(output, 'consultation.png'), fullPage: true });
    await page.emulateMedia({ media: 'print' });
    assert.ok(!/미결정|아직 결정하지 않은 항목/.test(await page.locator('.consultationSheet').innerText()));
    await page.pdf({ path: path.join(output, 'consultation.pdf'), format: 'A4', printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 390, height: 844 }); await overflow();
    await page.screenshot({ path: path.join(output, 'consultation-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS catalog, legacy storage, custom text refresh, review/report/copy/print and runtime/image checks');
    console.log(output);
    if (externalFailures.size) console.log('Existing external resource limitations:', [...externalFailures]);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
