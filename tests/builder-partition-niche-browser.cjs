const { run } = require('./helpers/browser-ui.cjs');
run('partition-niche', async (h) => {
    const { page, assert } = h;
    for (const [width, height] of h.sizes) {
        await page.setViewportSize({ width, height });
        await h.seed(1);
        const g = await h.focus('niche');
        assert.deepEqual(await g.locator('[role=radio]').allTextContents(), ['없음', '샤워 샴푸박스', '세면대 샴푸박스', '파티션 샴푸박스']);
        await h.choose('niche', '샤워 샴푸박스');
        await h.choose('niche', '파티션 샴푸박스');
        assert.equal((await h.saved()).values.niche, 'partition-niche');
        assert.equal(await g.locator('[aria-checked=true]').count(), 1);
        await h.preview('파티션 샴푸박스', h.settings['niche:partition-niche'].builderImage);
        const before = await h.saved();
        await page.reload();
        await page.locator('progress').waitFor();
        assert.deepEqual((await h.saved()).values, before.values);
        await h.focus('niche');
        if (width >= 768) {
            await h.emptyPreview();
            await h.openHistory();
            await page.getByRole('button', { name: '파티션 샴푸박스 이미지 크게 보기', exact: true }).click();
            await h.preview('파티션 샴푸박스', h.settings['niche:partition-niche'].builderImage);
        }
        else
            await h.preview('파티션 샴푸박스', h.settings['niche:partition-niche'].builderImage);
        await h.choose('niche', '파티션 샴푸박스');
        assert.ok(!(await h.saved()).values.niche);
        await h.emptyPreview();
        await h.seed(3, { wallTileSize: 'other', wallTileSizeOther: '박판 타일', niche: 'partition-niche' });
        const input = page.locator('#builder-wallTileSize-other');
        assert.equal(await input.getAttribute('type'), 'text');
        assert.equal(await input.getAttribute('placeholder'), '대형 타일, 모자이크 타일, 박판 타일, 포인트 타일···');
        assert.equal(await input.inputValue(), '박판 타일');
        await input.fill('모자이크 포인트 타일');
        await page.reload();
        await input.waitFor();
        assert.equal(await input.inputValue(), '모자이크 포인트 타일');
        assert.ok(!JSON.stringify((await h.saved()).values).includes('대형 타일, 모자이크 타일,'));
        await h.noOverflow();
        await h.report();
        assert.ok((await page.locator('.consultationSheet').textContent()).includes('파티션 샴푸박스'));
        const copied = await h.copy();
        assert.ok(!copied.includes('파티션 샴푸박스'), 'overview does not repeat niche details');
        assert.ok(copied.includes('모자이크 포인트 타일'));
        assert.equal((await h.saved()).values.niche, 'partition-niche');
        assert.equal((await h.saved()).values.wallTileSizeOther, '모자이크 포인트 타일');
        await h.fullCopyContains(['파티션 샴푸박스', '모자이크 포인트 타일'], width);
        await h.pdf(width);
        console.log('PASS niche ' + width);
    }
}).catch(e => { console.error(e); process.exitCode = 1; });
