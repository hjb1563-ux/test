const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://127.0.0.1:3218', key = 'bath-designer-selections-v2';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Regression tests require an isolated local server');
const sizes = [[375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900]];
const indices = mode => mode === 'consumer' ? [0, 1, 3, 4, 5, 6, 8, 11, 13, 14] : Array.from({ length: 15 }, (_, i) => i);
const settings = require('../../data/bathroom-builder-image-settings.generated.json');
async function run(name, fn) {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], hasTouch: true });
    const page = await context.newPage(), errors = [], external = [];
    page.setDefaultTimeout(12000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
        if (m.type() === 'error' && !/fonts.googleapis.com|fonts.gstatic.com|favicon.ico/.test(m.location().url || ''))
            errors.push(m.text());
    });
    page.on('response', r => {
        if (r.status() >= 400 && new URL(r.url()).origin === new URL(base).origin && !r.url().endsWith('/favicon.ico'))
            errors.push(r.status() + ' ' + new URL(r.url()).pathname);
    });
    await context.route('**/*', r => {
        const u = new URL(r.request().url());
        if (u.origin === new URL(base).origin || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(u.hostname))
            return r.continue();
        external.push(u.hostname);
        return r.abort();
    });
    const h = { page, context, key, base, sizes, indices, settings, assert, errors };
    h.saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
    h.group = k => page.locator('.choiceGroup:has(#builder-' + k + '-content)');
    h.nav = () => page.locator('.mobileBuilderNav:visible');
    h.seed = async (current = 0, values = {}, mode = 'professional', extra = {}) => {
        await page.goto(base + '/', { waitUntil: "domcontentloaded" });
        await page.evaluate(({ key, current, values, mode, extra }) => localStorage.setItem(key, JSON.stringify({ version: 3, current, values, imageHistoryOrder: [], memo: '테스트 메모', specialNotes: '테스트 특이사항', ...extra, projectInfo: { projectName: 'UI 회귀 테스트', builderMode: mode, ...extra.projectInfo } })), { key, current, values, mode, extra });
        await page.goto(base + '/design?step=' + (current + 1), { waitUntil: "domcontentloaded" });
        await page.locator('progress').waitFor();
        assert.equal(await page.locator('progress').getAttribute('max'), mode === 'consumer' ? '10' : '15');
    };
    h.focus = async (k) => {
        const historyToggle = page.locator('.selectionHistory[data-open=true]>.builderDisclosureToggle:visible');
        if (await historyToggle.count())
            await historyToggle.click();
        const section = h.group(k);
        assert.equal(await section.count(), 1, k + ' exists');
        if (await page.evaluate(() => innerWidth >= 1200))
            return section;
        const wanted = await page.locator('.choiceGroup').evaluateAll((els, k) => els.findIndex(e => e.querySelector('#builder-' + k + '-content')), k);
        for (let n = 0; n < 12 && !await section.isVisible(); n++) {
            const active = await page.locator('.choiceGroup').evaluateAll(els => els.findIndex(e => e.getAttribute('data-compact-active') === 'true'));
            if (active < wanted)
                await h.nav().locator('.button').click();
            else
                await h.nav().locator('button.secondary').first().click();
        }
        assert.equal(await section.isVisible(), true, k + ' is reachable by section navigation');
        return section;
    };
    h.choose = async (k, label) => { const g = await h.focus(k); const option = g.getByRole('radio', { name: label, exact: true }).or(g.getByRole('checkbox', { name: label, exact: true })); await option.click(); return option; };
    h.nextStep = async () => {
        const before = Number(await page.locator('progress').getAttribute('value'));
        if (await page.evaluate(() => innerWidth >= 1200))
            await page.locator('.navButtons:visible').getByRole('button', { name: '다음', exact: true }).click();
        else {
            for (let n = 0; n < 12 && Number(await page.locator('progress').getAttribute('value')) === before; n++)
                await h.nav().locator('.button').click();
        }
        assert.equal(Number(await page.locator('progress').getAttribute('value')), before + 1);
    };
    h.previousStep = async () => {
        const before = Number(await page.locator('progress').getAttribute('value'));
        if (await page.evaluate(() => innerWidth >= 1200))
            await page.locator('.navButtons:visible').getByRole('button', { name: '이전', exact: true }).click();
        else
            for (let n = 0; n < 12 && Number(await page.locator('progress').getAttribute('value')) === before; n++)
                await h.nav().locator('button.secondary').first().click();
        assert.equal(Number(await page.locator('progress').getAttribute('value')), before - 1);
    };
    h.openHistory = async () => {
        for (const selector of ['.builderPreviewPanel', '.selectionHistory']) {
            const s = page.locator(selector), t = s.locator('> .builderDisclosureToggle');
            if (await t.isVisible() && await s.getAttribute('data-open') === 'false')
                await t.click();
        }
    };
    h.preview = async (label, source) => {
        if (await page.evaluate(() => innerWidth < 768)) {
            await page.locator('.builderSwipeFrame:visible').waitFor();
            assert.equal(await page.locator('.builderSwipeLabel').innerText(), label);
            const img = await page.locator('.builderSwipeTrack').evaluate(async (e) => {
                const i = Math.round(e.scrollLeft / e.clientWidth), img = e.children[i].querySelector('img');
                if (!img.complete)
                    await new Promise((resolve, reject) => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', reject, { once: true }); });
                return { src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 };
            });
            if (source)
                assert.equal(new URL(img.src, base).pathname, new URL(source, base).pathname);
            assert.equal(img.loaded, true);
        }
        else {
            const img = page.locator('.selectedHeroImage img');
            await img.waitFor();
            assert.equal(await page.locator('.selectedHeroLabel').textContent(), label);
            await img.evaluate(async (e) => {
                if (!e.complete)
                    await new Promise((resolve, reject) => { e.addEventListener('load', resolve, { once: true }); e.addEventListener('error', reject, { once: true }); });
            });
            assert.ok(await img.evaluate(e => e.naturalWidth > 0 && getComputedStyle(e).objectFit === 'contain'));
            if (source)
                assert.equal(new URL(await img.getAttribute('src'), base).pathname, new URL(source, base).pathname);
        }
    };
    h.emptyPreview = async () => {
        if (await page.evaluate(() => innerWidth < 768))
            assert.equal(await page.locator('.builderSwipeFrame:visible').count(), 0);
        else
            assert.equal(await page.locator('.selectedHeroImage').count(), 0);
    };
    h.noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    h.report = async () => { await page.goto(base + '/result', { waitUntil: "domcontentloaded" }); await page.locator('.consultationSheet').waitFor(); };
    h.summary = () => page.locator('.summary').textContent();
    h.copy = async () => { await page.getByRole('button', { name: '요약만 복사', exact: true }).click(); return page.evaluate(() => navigator.clipboard.readText()); };
    h.pdf = async (suffix) => { fs.mkdirSync('tests/artifacts/ui-blockers-20261020/pdf', { recursive: true }); await page.emulateMedia({ media: 'print' }); assert.equal(await page.locator('.consultationSheet:visible').count(), 1); const bytes = await page.pdf({ path: path.join('tests/artifacts/ui-blockers-20261020/pdf', name + '-' + suffix + '.pdf'), format: 'A4', printBackground: true }); assert.ok(bytes.length > 10000); await page.emulateMedia({ media: 'screen' }); };
    try {
        await page.goto(base + '/', { waitUntil: "domcontentloaded" });
        await fn(h);
        assert.deepEqual(errors, [], 'no console/runtime/resource errors');
        assert.deepEqual(external, [], 'no Supabase or unexpected external requests');
        console.log('PASS ' + name);
    }
    finally {
        await context.close();
        await browser.close();
    }
}
module.exports = { run, sizes, indices };
