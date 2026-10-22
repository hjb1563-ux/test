const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDER_TEST_URL || 'http://localhost:3000';
const key = 'bath-designer-selections-v2';
(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await require('./helpers/font-response-cache.cjs').install(page.context(), errors);
    fs.mkdirSync('tests/artifacts/project-sections', { recursive: true });
    const field = id => page.locator('#project-' + id), start = () => page.locator('.projectInfoForm .button');
    const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    async function fresh() { await page.goto(base + '/design'); await page.locator('.projectInfoForm,.builderCompactFlow').first().waitFor(); await page.evaluate(key => localStorage.removeItem(key), key); await page.reload(); await field('customer-name').waitFor(); }
    async function schedule() { assert.equal(await field('date-0').isVisible(), true); assert.equal(await field('date-1').isVisible(), true); assert.equal(await field('date-2').isVisible(), true); assert.equal(await field('budget').isVisible(), true); }
    async function screen(name) { await page.screenshot({ path: 'tests/artifacts/project-sections/' + name + '.png', fullPage: true, animations: 'disabled' }); }
    try {
        for (const [width, height] of [[375, 812], [390, 844], [430, 932], [768, 1024], [1280, 720], [1440, 900], [1920, 1080]]) {
            await page.setViewportSize({ width, height });
            await fresh();
            assert.equal(await page.locator('.projectInfoSection').count(), 1);
            assert.equal(await field('customer-name').isVisible(), true);
            assert.equal(await field('name').isVisible(), true);
            assert.equal(await page.getByRole('radiogroup', { name: '입력할 이름 종류', exact: true }).count(), 0);
            assert.equal(await page.getByRole('radio', { name: /일반 고객용/ }).getAttribute('aria-checked'), 'true');
            const consumerCard = page.getByRole('radio', { name: /^일반 고객용/ });
            assert.equal(await consumerCard.locator('strong').textContent(), '일반 고객용');
            assert.equal(await consumerCard.locator('[class*=modeSubtitle]').textContent(), '셀프·반셀프 인테리어 준비 포함');
            const typography = await consumerCard.evaluate(e => { const t = e.querySelector('strong'), s = e.querySelector('[class*=modeSubtitle]'); return { size: getComputedStyle(t).fontSize, weight: getComputedStyle(t).fontWeight, subtitle: getComputedStyle(s).fontWeight, sameRow: Math.abs(t.getBoundingClientRect().top - s.getBoundingClientRect().top) < 8 }; });
            assert.equal(typography.size, '14px');
            assert.equal(typography.weight, '500');
            assert.equal(typography.subtitle, '400');
            assert.equal(typography.sameRow, true);
            const description = page.locator('.projectModeOptions small').first();
            assert.equal(await description.textContent(), '원하는 욕실 디자인과 선택 사항을간단하게 정리해요.');
            if (width < 768) {
                const metrics = await description.evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); return { lines: new Set(Array.from(range.getClientRects()).filter(r => r.width > 0).map(r => Math.round(r.top))).size, overflow: element.scrollWidth > element.clientWidth, font: parseFloat(getComputedStyle(element).fontSize), direction: getComputedStyle(element.closest('[role=radiogroup]')).flexDirection }; });
                assert.equal(metrics.lines, 2);
                assert.equal(metrics.overflow, false);
                assert.ok(metrics.font >= 12);
                assert.equal(metrics.direction, 'column');
            }
            await screen('initial-' + width);
            await start().click();
            assert.equal(await page.locator('#project-info-validation').isVisible(), true);
            assert.equal(await page.locator('progress').count(), 0);
            await field('customer-name').fill('고객A');
            assert.equal(await field('customer-name').evaluate(element => element === document.activeElement), true);
            assert.equal(await page.locator('.projectInfoSection').count(), 2);
            assert.equal(await field('area').isVisible(), true);
            assert.equal(await page.getByRole('radiogroup', { name: '건물 유형', exact: true }).isVisible(), true);
            assert.equal(await page.getByRole('radiogroup', { name: '거주 여부', exact: true }).isVisible(), true);
            assert.equal(await field('date-0').count(), 0);
            assert.equal(await page.getByRole('button', { name: /건너뛰기/ }).count(), 1);
            await screen('site-' + width);
            await page.getByRole('radio', { name: '아파트', exact: true }).click();
            await schedule();
            assert.equal(await page.locator('.projectInfoSection').count(), 3);
            await field('date-0').fill('2026');
            await field('date-1').fill('2');
            await field('date-2').fill('30');
            assert.equal(await page.locator('#project-date-message').isVisible(), true);
            await schedule();
            await field('date-1').fill('11');
            await field('date-2').fill('10');
            await field('budget').fill('10000000');
            assert.equal(await field('budget').inputValue(), '10,000,000');
            await page.getByRole('radio', { name: '살고 있다', exact: true }).click();
            await field('area').fill('24');
            await field('name').fill('상담 프로젝트');
            await field('area').fill('');
            await field('customer-name').fill('');
            await schedule();
            assert.equal(await field('budget').inputValue(), '10,000,000');
            await field('customer-name').fill('고객A');
            await field('area').fill('24');
            await page.getByRole('radio', { name: '빌라', exact: true }).click();
            assert.equal(await page.getByRole('radio', { name: '살고 있다', exact: true }).getAttribute('aria-checked'), 'true');
            await field('name').press('Enter');
            assert.equal(await page.locator('.projectInfoForm').isVisible(), true);
            assert.equal(await page.getByRole('button', { name: /건너뛰기/ }).count(), 0);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            await screen('complete-' + width);
            await start().click();
            await page.locator('progress').waitFor();
            let project = await saved();
            assert.equal(project.projectInfo.budget, 10000000);
            assert.equal(project.projectInfo.constructionDate, '2026-11-10');
            assert.equal(await page.locator('progress').getAttribute('max'), '10');
            await page.evaluate(key => { const p = JSON.parse(localStorage.getItem(key)); p.values = { tile: 'dark', wallTileSize: '600x600', showerFaucet: ['rain'] }; p.imageHistoryOrder = ['showerFaucet:rain', 'tile:dark', 'wallTileSize:600x600']; p.current = 3; localStorage.setItem(key, JSON.stringify(p)); }, key);
            await page.reload();
            await page.locator('.builderCompactFlow').waitFor();
            const before = await saved();
            await page.locator('.projectIdentity button').click();
            await schedule();
            assert.equal(await field('name').inputValue(), '상담 프로젝트');
            await page.getByRole('radio', { name: '상가', exact: true }).click();
            assert.equal(await page.getByRole('radiogroup', { name: '거주 여부', exact: true }).count(), 0);
            await start().click();
            await page.locator('.builderCompactFlow').waitFor();
            project = await saved();
            assert.equal(project.projectInfo.occupancyStatus, null);
            assert.deepEqual(project.values, before.values);
            assert.deepEqual(project.imageHistoryOrder, before.imageHistoryOrder);
            await page.goto(base + '/result');
            await page.locator('.sheetProjectIdentity').waitFor();
            const metadata = await page.locator('.sheetProjectIdentity').textContent();
            for (const value of ['고객A', '상담 프로젝트', '상가', '24', '2026.11.10', '10,000,000'])
                assert.ok(metadata.includes(value), value);
            await fresh();
            await field('name').fill('이름 없이 프로젝트');
            await start().click();
            await page.locator('progress').waitFor();
            assert.equal((await saved()).projectInfo.customerName, '');
            await fresh();
            await field('customer-name').fill('바로 시작');
            await start().click();
            await page.locator('progress').waitFor();
            project = await saved();
            for (const prop of ['propertyType', 'occupancyStatus', 'constructionDate', 'budget'])
                assert.equal(project.projectInfo[prop], null);
            await fresh();
            await field('name').fill('건너뛰기');
            await page.getByRole('button', { name: '현장 정보 건너뛰기', exact: true }).click();
            await schedule();
            await start().click();
            await page.locator('progress').waitFor();
            project = await saved();
            for (const prop of ['propertyType', 'occupancyStatus', 'constructionDate', 'budget'])
                assert.equal(project.projectInfo[prop], null);
            assert.equal(project.projectInfo.areaPyeong, '');
            for (const trigger of ['occupancy', 'area']) {
                await fresh();
                await field('customer-name').fill('현장');
                if (trigger === 'occupancy')
                    await page.getByRole('radio', { name: '이사갈 곳이다', exact: true }).click();
                else {
                    await field('area').fill('0');
                    assert.equal(await field('budget').count(), 0);
                    await field('area').fill('24');
                }
                await schedule();
            }
            await fresh();
            await field('name').fill('전문가');
            await page.getByRole('radio', { name: /전문가용/ }).click();
            await start().click();
            await page.locator('progress').waitFor();
            assert.equal(await page.locator('progress').getAttribute('max'), '15');
            console.log('PASS ' + width + 'x' + height + ': sections, two identity fields, inline mode label and two-line description, skip, date/budget, retention/edit/storage/report, 10/15 steps');
        }
        assert.deepEqual(errors, []);
    }
    finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
