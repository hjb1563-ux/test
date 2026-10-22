const { run } = require('./helpers/browser-ui.cjs'), fs = require('node:fs');
run('consultation-capture', async (h) => {
    const { page, assert } = h;
    const values = { demolition: 'full-demolition', bathroomCondition: ['leak'], waterproofing: 'combined-waterproofing', drain: 'linear-drain', wallTileSize: '600x600', tile: 'white', tileSurface: 'matte', sink: 'top-bowl', toilet: 'two-piece', faucet: 'one-hole', showerFaucet: ['rain', 'concealed-shower'], ventilationOther: '힘펠 휴젠뜨', accessoryOther: '수건걸이' };
    const info = { projectName: '전체 문서 캡처 검증', customerName: '김검증', propertyType: '아파트', occupancyStatus: '살고 있다', areaPyeong: '34', constructionDate: '2026-12-31', budget: 10000000 };
    const memo = Array.from({ length: 32 }, (_, i) => (i + 1) + '. 업체 메모: 수납과 청소 편의를 확인해주세요.').join('\n') + '\n메모의 마지막 줄도 포함됩니다.';
    for (const [width, height] of [[1920, 1080], [1280, 720], ...h.sizes])
        for (const mode of ['consumer', 'professional']) {
            await page.setViewportSize({ width, height });
            await h.seed(14, values, mode, { projectInfo: info, memo, imageHistoryOrder: ['tile:white', 'faucet:one-hole'] });
            assert.equal(await page.locator('progress').getAttribute('value'), mode === 'consumer' ? '10' : '15');
            await h.previousStep();
            await h.nextStep();
            const link = page.locator('a:visible').filter({ hasText: /^상담서 보기/ });
            await link.last().click();
            await page.locator('.consultationSheet').waitFor();
            assert.equal(await page.locator('.sheetStep').count(), mode === 'consumer' ? 4 : 15);
            assert.equal(await page.locator('.consultationDocument .resultActions').count(), 0);
            assert.equal(await page.locator('.selectionWarning').count(), 0);
            const copied = await h.copy();
            for (const s of ['김검증', '아파트', '살고 있다', '34평', '2026.12.31', '10,000,000', '600×600', '메모의 마지막 줄도 포함됩니다.'])
                assert.ok(copied.includes(s), s);
            assert.ok(!copied.includes('작성 모드'));
            const before = await h.saved(), documentHeight = await page.locator('.consultationDocument').evaluate(e => e.scrollHeight);
            await page.getByRole('button', { name: '상담서 전체 복사', exact: true }).click();
            await page.getByText('상담서 전체가 PNG 이미지로 복사되었습니다.', { exact: true }).waitFor({ timeout: 60000 });
            const png = await page.evaluate(async () => { const item = (await navigator.clipboard.read()).find(i => i.types.includes('image/png')); if (!item)
                throw Error('PNG missing'); const blob = await item.getType('image/png'), bitmap = await createImageBitmap(blob); const result = { size: blob.size, width: bitmap.width, height: bitmap.height }; bitmap.close(); return result; });
            assert.ok(png.size > 20000);
            assert.ok(png.height > documentHeight);
            assert.ok(png.width <= 16384 && png.height <= 16384 && png.width * png.height <= 24000000);
            assert.equal(await page.locator('body>div[aria-hidden=true] .consultationDocument').count(), 0);
            assert.deepEqual((await h.saved()).values, before.values);
            assert.deepEqual((await h.saved()).imageHistoryOrder, before.imageHistoryOrder);
            assert.equal((await h.saved()).memo, memo);
            await h.noOverflow();
            if (width === 390)
                await h.pdf(mode);
            console.log('PASS PNG ' + width + ' ' + mode + ' ' + png.width + 'x' + png.height);
        }
    for (const mode of ['consumer', 'professional']) {
        await page.setViewportSize({ width: 390, height: 844 });
        await h.seed(15, values, mode, { projectInfo: info, memo });
        assert.equal((await h.saved()).current, 14);
        for (const index of h.indices(mode)) {
            await page.goto(h.base + '/design?step=' + (index + 1));
            await page.locator('progress').waitFor();
            assert.equal(await page.locator('.selectionWarning').count(), index === 8 ? 1 : 0);
        }
        await page.goto(h.base + '/design?step=9');
        await page.locator('progress').waitFor();
        await h.choose('faucet', '매립 세면 수전');
        assert.equal(await page.locator('.selectionWarning').count(), 0);
        await h.report();
        await page.locator('#consultation-special-notes').fill('상담서에서 특이사항 수정');
        await page.reload();
        await page.locator('.consultationSheet').waitFor();
        assert.equal(await page.locator('#consultation-special-notes').inputValue(), '상담서에서 특이사항 수정');
        await page.emulateMedia({ media: 'print' });
        assert.equal(await page.locator('.consultationActionsWrap:visible').count(), 0);
        assert.equal(await page.locator('.memoPrint').first().textContent(), memo);
        await page.emulateMedia({ media: 'screen' });
    }
    await page.evaluate(() => { window.originalClipboardItem = window.ClipboardItem; window.ClipboardItem = undefined; });
    try {
        await page.getByRole('button', { name: '상담서 전체 복사', exact: true }).click();
        await page.getByText('상담서 전체 이미지 복사에 실패했습니다.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: '상담서 전체 복사', exact: true }).isEnabled(), true);
    }
    finally {
        await page.evaluate(() => { window.ClipboardItem = window.originalClipboardItem; });
    }
}).catch(e => { console.error(e); process.exitCode = 1; });
