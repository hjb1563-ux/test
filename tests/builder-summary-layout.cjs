const { run } = require('./helpers/browser-ui.cjs');
run('summary-layout', async (h) => {
    const { page, assert } = h;
    const rects = () => page.evaluate(() => { const rect = s => document.querySelector(s).getBoundingClientRect().toJSON(); return { preview: rect('.builderPreviewPanel'), image: document.querySelector('.selectedHeroImage') ? rect('.selectedHeroImage') : null, selection: rect('.builderSelectionScroll'), summary: rect('.builderSummaryPanel'), body: rect('.builderSummaryPanel>.builderDisclosureBody'), nav: rect('.mobileBuilderNav'), grid: rect('.designGrid'), height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth }; });
    const validate = (r, width, height) => { assert.equal(r.width, width); assert.equal(r.height, height); assert.ok(r.preview.bottom <= r.selection.top, 'preview cannot overlap choices'); if (r.image)
        assert.ok(r.image.bottom <= r.preview.bottom, 'image fits preview'); assert.ok(r.selection.bottom <= r.summary.top, 'choices cannot overlap summary'); assert.ok(r.summary.bottom <= r.nav.top, 'summary cannot overlap navigation'); assert.ok(r.selection.height >= 64); assert.ok(r.body.height >= 40); assert.ok(r.summary.height <= height * .30 + 1); assert.ok(r.grid.bottom <= r.nav.top); };
    for (const [width, height] of [[1100, 800], [1024, 768], [900, 700], [768, 1024], [430, 932], [390, 844], [375, 812], [1280, 720], [1440, 900], [1920, 1080]]) {
        await page.setViewportSize({ width, height });
        await h.seed(1, { jendai: ['new'], partitionShower: 'full-partition', niche: 'shower-niche' }, 'consumer', { projectInfo: { projectName: '검증 프로젝트', customerName: '홍길동' } });
        await h.choose('jendai', '젠다이 신설');
        await h.choose('jendai', '젠다이 신설');
        await h.preview('젠다이 신설', h.settings['jendai:new'].builderImage);
        if (width >= 768 && width < 1200) {
            const toggle = page.locator('.builderSummaryPanel>.builderDisclosureToggle');
            const before = await rects(), stored = await h.saved();
            await toggle.focus();
            await page.keyboard.press('Enter');
            assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
            const after = await rects();
            validate(after, width, height);
            assert.equal(after.preview.top, before.preview.top);
            assert.equal(after.preview.width, before.preview.width);
            assert.ok(after.preview.height <= before.preview.height, 'preview only shrinks when space is constrained');
            assert.ok(after.selection.height < before.selection.height);
            assert.deepEqual((await h.saved()).values, stored.values);
            const last = page.locator('.choiceGroup:visible .builderChoiceCard').last();
            await last.scrollIntoViewIfNeeded();
            const b = await last.boundingBox();
            assert.ok(b.y >= after.selection.top && b.y + b.height <= after.selection.bottom, 'entire final choice is reachable by internal scroll');
            await h.focus('partitionShower');
            await h.choose('partitionShower', '고정 유리형 샤워부스');
            validate(await rects(), width, height);
            assert.ok((await h.summary()).includes('고정 유리형 샤워부스'));
            await toggle.focus();
            await page.keyboard.press('Space');
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            console.log('PASS non-overlap ' + width + 'x' + height + ' ' + JSON.stringify({ summaryBottom: after.summary.bottom, navTop: after.nav.top, choiceHeight: after.selection.height }));
        }
        else if (width < 768) {
            assert.equal(await page.locator('.builderSummaryPanel').isVisible(), false);
            assert.equal(await h.nav().evaluate(e => getComputedStyle(e).position), 'static');
            await h.noOverflow();
        }
        else {
            const boxes = await Promise.all(['.options', '.builderPreviewPanel', '.builderSummaryPanel'].map(s => page.locator(s).boundingBox()));
            assert.ok(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x);
            assert.equal(await page.locator('.choiceGroup:visible').count(), 3);
        }
    }
    for (const [width,height] of [[1024,768],[900,700],[768,1024]]) {
        await page.setViewportSize({width,height});
        await h.seed(1,{jendai:['new']},'consumer');
        await page.goto(h.base+'/design?step=2&returnTo=consultation');
        await page.locator('.builderConsultationEdit').waitFor();
        await h.choose('jendai','젠다이 신설');await h.choose('jendai','젠다이 신설');
        await page.locator('.builderSummaryPanel>.builderDisclosureToggle').click();
        validate(await rects(),width,height);
        assert.equal(await page.getByRole('link',{name:'상담서로 돌아가기',exact:true}).isVisible(),true);
        console.log('PASS edit-context non-overlap '+width+'x'+height);
    }
    for (const total of [3, 5, 8]) {
        await page.setViewportSize({ width: 1024, height: 768 });
        const values = { faucet: 'one-hole', showerFaucet: total === 3 ? ['shower', 'rain'] : ['shower', 'rain', 'concealed-shower', 'other'], showerFaucetOther: '긴 기타 선택 내용 '.repeat(50) };
        if (total === 8)
            Object.assign(values, { wallTileSize: '600x600', tile: 'dark', tileSurface: 'matte' });
        await h.seed(8, values);
        await h.focus('showerFaucet');
        await page.locator('.builderSummaryPanel>.builderDisclosureToggle').click();
        const body = page.locator('.builderSummaryPanel>.builderDisclosureBody');
        assert.ok(await body.evaluate(e => e.scrollHeight > e.clientHeight));
        await body.evaluate(e => e.scrollTop = e.scrollHeight);
        assert.ok(await body.evaluate(e => e.scrollTop > 0));
        const before = await page.locator('.builderSummaryPanel>.builderDisclosureToggle small').textContent();
        await h.choose('showerFaucet', '해바라기 샤워 수전');
        assert.notEqual(await page.locator('.builderSummaryPanel>.builderDisclosureToggle small').textContent(), before);
        validate(await rects(), 1024, 768);
    }
}).catch(e => { console.error(e); process.exitCode = 1; });
