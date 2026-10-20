const { run } = require('./helpers/browser-ui.cjs');
run('compact', async (h) => {
    const { page, assert } = h;
    for (const [width, height] of [[1920, 1080], [1440, 900], [1280, 720], [1100, 800], ...h.sizes]) {
        await page.setViewportSize({ width, height });
        await h.seed(1);
        await h.choose('jendai', '젠다이 신설');
        await h.preview('젠다이 신설', h.settings['jendai:new'].builderImage);
        const before = await h.saved();
        if (width < 1200) {
            assert.equal(await page.locator('.choiceGroup:visible').count(), 1);
            await h.focus('partitionShower');
            assert.equal((await h.saved()).current, 1);
            if (width >= 768)
                await h.emptyPreview();
            await h.choose('partitionShower', '하프 파티션');
            await h.choose('partitionShower', '풀 파티션');
            assert.equal((await h.saved()).values.partitionShower, 'full-partition');
            await h.focus('jendai');
            assert.deepEqual((await h.saved()).values.jendai, before.values.jendai);
            assert.equal(await h.group('jendai').getByRole('checkbox', { name: '젠다이 신설', exact: true }).getAttribute('aria-checked'), 'true');
        }
        else
            assert.equal(await page.locator('.choiceGroup:visible').count(), 3);
        await h.noOverflow();
        console.log('PASS compact ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const mode of ['consumer', 'professional'])
        for (const [i, index] of h.indices(mode).entries()) {
            await h.seed(index, {}, mode);
            const groups = await page.locator('.choiceGroup').count();
            for (let section = 0; section < groups; section++) {
                const active = page.locator('.choiceGroup:visible');
                assert.equal(await active.count(), 1);
                assert.equal(await active.locator('.builderSectionPosition').textContent(), (section + 1) + ' / ' + groups);
                assert.equal((await h.saved()).current, index);
                if (section < groups - 1)
                    await h.nav().locator('.button').click();
            }
            if (i < h.indices(mode).length - 1)
                await h.nextStep();
            else {
                await h.nav().getByRole('link', { name: /상담서 보기/ }).click();
                await page.locator('.consultationSheet').waitFor();
            }
        }
    await h.seed(8);
    await h.choose('showerFaucet', '일반 샤워&욕조 수전');
    await h.choose('showerFaucet', '해바라기 샤워 수전');
    await h.choose('showerFaucet', '기타');
    await page.locator('#builder-showerFaucet-other').fill('현장 확인 요청');
    await page.reload();
    await page.locator('progress').waitFor();
    await h.focus('showerFaucet');
    assert.equal(await page.locator('#builder-showerFaucet-other').inputValue(), '현장 확인 요청');
    assert.deepEqual((await h.saved()).values.showerFaucet, ['shower', 'rain', 'other']);
    await h.seed(1);
    await h.focus('partitionShower');
    await h.nav().getByRole('button', { name: '현재 STEP 전체 건너뛰기', exact: true }).click();
    assert.equal(await page.locator('progress').getAttribute('value'), '3');
    await page.setViewportSize({ width: 844, height: 390 });
    await h.seed(1);
    await h.choose('jendai', '젠다이 신설');
    await h.focus('partitionShower');
    await h.nav().locator('.button').scrollIntoViewIfNeeded();
    assert.equal(await h.nav().isVisible(), true);
    await h.noOverflow();
}).catch(e => { console.error(e); process.exitCode = 1; });
