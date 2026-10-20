const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const { run } = require('./helpers/browser-ui.cjs');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { getVisibleSteps } = require('../data/bathroom-builder-mode.ts');

run('consultation-title-png', async h => {
  const { page, assert } = h, output = 'tests/artifacts/consultation-title-png';
  fs.mkdirSync(output, { recursive: true });
  const memo = '메모 첫 줄\n' + '선택한 내용은 그대로 유지합니다. '.repeat(40) + '\n내용 보존 검증 마지막 줄';
  for (const [width, height] of h.sizes) for (const mode of ['consumer', 'professional']) {
    await page.setViewportSize({ width, height });
    const steps = getVisibleSteps(mode), values = {};
    for (const step of steps) for (const group of step.groups) {
      const choice = group.choices.find(c => !c.requiresCustomText && !['none', 'undecided'].includes(c.id)) || group.choices[0];
      if (choice) values[group.key] = group.multiple ? [choice.id] : choice.id;
      else values[group.key + 'Other'] = '기존 직접 입력 내용 유지';
    }
    await h.seed(14, values, mode, { memo }); await h.report();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.sheetStep').count(), mode === 'consumer' ? 10 : 15);
    const before = await h.saved();
    const liveGeometry = () => page.locator('.consultationDocument').evaluate(root => {
      const bounds = root.getBoundingClientRect();
      return [...root.querySelectorAll('.sheetStep h3')].map(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, x: r.x - bounds.x, y: r.y - bounds.y, width: r.width, height: r.height }; });
    });
    const originalLayout = await liveGeometry();
    await page.screenshot({ path: path.join(output, `${mode}-${width}-screen.png`), fullPage: true });
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        const root = document.querySelector('body>div[aria-hidden=true] .consultationDocument');
        if (!root || window.__pngLayout) return;
        const box = root.getBoundingClientRect();
        window.__pngLayout = { width: box.width, height: box.height, titles: [...root.querySelectorAll('.sheetStep')].map(card => {
          const title = card.querySelector('h3'), header = card.querySelector('header'), dl = card.querySelector('dl');
          const t = title.getBoundingClientRect(), hd = header.getBoundingClientRect(), d = dl.getBoundingClientRect();
          return { text: title.textContent, x: hd.x - box.x, y: hd.y - box.y, headerWidth: hd.width, headerHeight: hd.height, titleWidth: t.width, titleHeight: t.height, lineHeight: parseFloat(getComputedStyle(title).lineHeight), titleBottom: t.bottom - box.y, headerBottom: hd.bottom - box.y, contentTop: d.top - box.y, overflow: title.scrollWidth > title.clientWidth, wordBreak: getComputedStyle(title).wordBreak };
        }) };
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const serialize = XMLSerializer.prototype.serializeToString;
      XMLSerializer.prototype.serializeToString = function (node) {
        const result = serialize.call(this, node);
        if (node.nodeName === 'svg' && result.includes('consultationDocument')) window.__pngText = node.textContent;
        return result;
      };
    });
    await page.getByRole('button', { name: '상담서 이미지 복사', exact: true }).click();
    await page.getByText('상담서 이미지가 복사되었습니다.', { exact: true }).waitFor({ timeout: 120000 });
    const png = await page.evaluate(async () => {
      const item = (await navigator.clipboard.read()).find(i => i.types.includes('image/png'));
      const blob = await item.getType('image/png'), bitmap = await createImageBitmap(blob);
      const layout = window.__pngLayout, ratio = bitmap.width / layout.width;
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = Math.ceil(layout.titles.length * 90 * ratio);
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f7f5ef'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      layout.titles.forEach((title, i) => ctx.drawImage(bitmap, 0, title.y * ratio, bitmap.width, 82 * ratio, 0, i * 90 * ratio, bitmap.width, 82 * ratio));
      const headings = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      return { width: bitmap.width, height: bitmap.height, bytes: [...new Uint8Array(await blob.arrayBuffer())], headings: [...new Uint8Array(await headings.arrayBuffer())], layout, text: window.__pngText };
    });
    fs.writeFileSync(path.join(output, `${mode}-${width}.png`), Buffer.from(png.bytes));
    fs.writeFileSync(path.join(output, `${mode}-${width}-headings.png`), Buffer.from(png.headings));
    fs.writeFileSync(path.join(output, `${mode}-${width}.json`), JSON.stringify({ width: png.width, height: png.height, layout: png.layout }, null, 2));
    assert.equal(png.layout.width, 800, 'capture width must not follow viewport');
    assert.equal(png.width, 1600, 'normal documents retain full 2x resolution');
    assert.equal(png.layout.titles.length, steps.length);
    assert.ok(png.width * png.height <= 24000000 && png.height <= 16384);
    for (const [i, title] of png.layout.titles.entries()) {
      assert.ok(title.text.endsWith(steps[i].title), title.text);
      assert.ok(title.titleWidth > 600, 'headings use the available card width');
      assert.ok(title.titleHeight <= title.lineHeight + 1, 'all current STEP titles fit one line');
      assert.ok(!title.overflow, 'heading must not clip horizontally');
      assert.ok(title.titleBottom <= title.headerBottom && title.headerBottom <= title.contentTop, 'heading and selection rows must not overlap');
      assert.equal(title.wordBreak, 'keep-all');
      assert.ok(png.text.includes(steps[i].title), 'export retains each title');
    }
    assert.ok(png.text.includes('내용 보존 검증 마지막 줄'));
    assert.deepEqual(await h.saved(), before, 'copy must not mutate stored content');
    assert.deepEqual(await liveGeometry(), originalLayout, 'capture-only styles must not affect the live sheet');
    assert.equal(await page.locator('.consultationImageCapture').count(), 0, 'offscreen clone is removed');
    const copied = await h.copy(); assert.ok(copied.includes('내용 보존 검증 마지막 줄'));
    if (width === 390 || width === 1440) await h.pdf(mode + '-' + width);
    console.log(`PASS ${mode} ${width}: actual PNG ${png.width}x${png.height}, ${steps.length} titles/rows, storage, live layout, copy and PDF`);
  }
}).catch(e => { console.error(e); process.exitCode = 1; });
