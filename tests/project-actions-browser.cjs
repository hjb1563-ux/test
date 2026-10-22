const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3000';
const key = 'bath-designer-selections-v2';
(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await require('./helpers/font-response-cache.cjs').install(page.context(), errors);
    await page.addInitScript(() => { window.print = () => { window.printCount = (window.printCount || 0) + 1; }; });
    fs.mkdirSync('tests/artifacts/project-actions', { recursive: true });
    const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    async function fresh() {
        await page.goto(base + '/design');
        await page.locator('.projectInfoForm,.builderCompactFlow').first().waitFor();
        await page.evaluate(key => localStorage.removeItem(key), key);
        await page.reload();
        await page.locator('.projectInfoForm').waitFor();
    }
    async function start(customer, project) {
        await fresh();
        await page.locator('#project-customer-name').fill(customer);
        await page.locator('#project-name').fill(project);
        await page.getByRole('button', { name: '욕실 만들기 시작', exact: true }).click();
        await page.locator('.builderCompactFlow').waitFor();
        assert.equal((await saved()).projectInfo.customerName, customer);
        assert.equal((await saved()).projectInfo.projectName, project);
    }
    try {
        for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 720], [430, 932], [390, 844], [375, 812]]) {
            await page.setViewportSize({ width, height });
            await fresh();
            assert.equal(await page.locator('#project-basic-help').textContent(), '고객명 또는 프로젝트명 중 편한 항목 하나만 입력해주세요.');
            assert.equal(await page.locator('#project-basic-help').evaluate(element => getComputedStyle(element).wordBreak), 'keep-all');
            assert.equal(await page.locator('#project-customer-name').getAttribute('placeholder'), '예: 홍길동 또는 원하는 가명');
            assert.equal(await page.locator('#project-customer-name').inputValue(), '');
            assert.equal(await page.locator('#project-name').getAttribute('placeholder'), '예: 홍길동 고객님 욕실 리모델링');
            assert.equal(await page.locator('.projectSectionOptional').count(), 0);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await page.screenshot({ path: `tests/artifacts/project-actions/form-${width}.png`, fullPage: true });
            await page.getByRole('button', { name: '욕실 만들기 시작', exact: true }).click();
            assert.equal(await page.locator('#project-info-validation').textContent(), '고객명 또는 프로젝트명 중 하나를 입력해주세요.');
            assert.equal(await page.locator('progress').count(), 0);
            await page.locator('#project-customer-name').fill('고객A');
            await page.locator('#project-customer-name').press('Enter');
            assert.equal(await page.locator('.projectInfoForm').isVisible(), true);
            await page.getByRole('button', { name: '욕실 만들기 시작', exact: true }).click();
            await page.locator('progress').waitFor();
            assert.equal((await saved()).projectInfo.customerName, '고객A');
            assert.equal((await saved()).projectInfo.projectName, '');
            assert.equal(await page.locator('progress').getAttribute('max'), '10');
            const values = { wallTileSize: '600x600', tile: 'dark', tileSurface: 'matte', showerFaucet: ['rain'] };
            await page.evaluate(({ key, values }) => localStorage.setItem(key, JSON.stringify({ version: 3, current: 3, values, imageHistoryOrder: ['showerFaucet:rain', 'tileSurface:matte', 'tile:dark', 'wallTileSize:600x600'], memo: '메모 유지', projectInfo: { customerName: '고객A', projectName: '욕실 프로젝트', builderMode: 'consumer' } })), { key, values });
            await page.goto(base + '/result');
            await page.locator('.consultationSheet').waitFor();
            const actions = page.locator('.consultationActionsWrap .resultActions');
            assert.deepEqual(await actions.getByRole('button').allTextContents(), ['공사 개요만 복사', '상담서 전체 복사', '인쇄 / PDF 저장', '선택 수정']);
            assert.equal(await page.getByRole('button', { name: '선택 내용 복사', exact: true }).count(), 0);
            const before = await saved();
            await page.getByRole('button', { name: '공사 개요만 복사', exact: true }).click();
            const text = await page.evaluate(() => navigator.clipboard.readText());
            assert.ok(text.includes('고객A'));
            assert.ok(text.includes('메모 유지'));
            assert.ok(!text.includes('작성 모드'));
            await page.getByRole('button', { name: '인쇄 / PDF 저장', exact: true }).click();
            assert.equal(await page.evaluate(() => window.printCount), 1);
            assert.deepEqual((await saved()).values, before.values);
            assert.deepEqual((await saved()).imageHistoryOrder, before.imageHistoryOrder);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            const rectangles = await actions.getByRole('button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
            for (const rect of rectangles)
                assert.ok(rect.width > 0 && rect.left >= 0 && rect.right <= width);
            await page.screenshot({ path: `tests/artifacts/project-actions/actions-${width}.png`, fullPage: true });
            if (width === 390) {
                await page.getByRole('button', { name: '상담서 전체 복사', exact: true }).click();
                await page.getByText('상담서 전체가 PNG 이미지로 복사되었습니다.', { exact: true }).waitFor({ timeout: 60000 });
                const png = await page.evaluate(async () => {
                    const items = await navigator.clipboard.read();
                    const item = items.find(item => item.types.includes('image/png'));
                    const blob = await item.getType('image/png');
                    const bitmap = await createImageBitmap(blob);
                    const dimensions = { width: bitmap.width, height: bitmap.height, size: blob.size };
                    bitmap.close();
                    return dimensions;
                });
                assert.ok(png.size > 10000 && png.height > height);
                console.log('PASS actual PNG clipboard', png);
            }
            await page.getByRole('button', { name: '선택 수정', exact: true }).click();
            await page.locator('.builderCompactFlow').waitFor();
            assert.deepEqual((await saved()).values, before.values);
            assert.deepEqual((await saved()).imageHistoryOrder, before.imageHistoryOrder);
            console.log(`PASS ${width}x${height}: helper, placeholder, validation, Enter, actions, summary/print/edit, wrap, data`);
        }
        await start('홍길동', '');
        await start('', '안양 욕실 리모델링');
        await start('홍길동', '욕실 프로젝트');
        await fresh();
        await page.getByRole('radio', { name: /전문가용/ }).click();
        await page.locator('#project-name').fill('전문가 프로젝트');
        await page.getByRole('button', { name: '욕실 만들기 시작', exact: true }).click();
        await page.locator('progress').waitFor();
        assert.equal(await page.locator('progress').getAttribute('max'), '15');
        assert.deepEqual(errors, []);
        console.log('PASS name-only, alias, project-only, both, empty, consumer/professional');
    }
    finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
