const { run } = require('./helpers/browser-ui.cjs');
run('mobile-simplification', async (h) => {
    const { page, assert } = h;
    for (const [width, height] of h.sizes) {
        await page.setViewportSize({ width, height });
        await h.seed(0, {}, 'consumer');
        const mobile = width < 768;
        assert.equal(await page.locator('.choiceGroup:visible').count(), width < 1200 ? 1 : 2);
        if (mobile) {
            assert.equal(await page.locator('.builderSummaryPanel').isVisible(), false);
            assert.equal(await h.nav().evaluate(e => getComputedStyle(e).position), 'static');
            assert.equal(await page.locator('.builderSelectionScroll').evaluate(e => getComputedStyle(e).overflowY), 'visible');
            assert.equal(await page.locator('.builderSectionPosition:visible').textContent(), '1 / 2');
        }
        await h.choose('demolition', '올철거');
        assert.equal(await page.locator('progress').getAttribute('value'), '1');
        await h.focus('bathroomCondition');
        if (width < 1200)
            assert.equal(await page.locator('.builderSectionPosition:visible').textContent(), '2 / 2');
        await h.choose('bathroomCondition', '누수 이력이 있다');
        await h.choose('bathroomCondition', '기타');
        await page.locator('#builder-bathroomCondition-other').fill('모바일 기타 입력');
        assert.ok((await h.summary()).includes('모바일 기타 입력'));
        await h.nextStep();
        assert.equal(await page.locator('progress').getAttribute('value'), '2');
        await h.seed(3, {}, 'consumer');
        await h.choose('wallTileSize', '600×600');
        await h.focus('tile');
        await h.choose('tile', '다크');
        await h.focus('tileSurface');
        await h.choose('tileSurface', '무광');
        await h.preview('무광', require('../data/bathroom-builder-tile-surface-images.generated.json')['600x600'].dark.matte);
        const saved = await h.saved();
        await page.reload();
        await page.locator('progress').waitFor();
        assert.deepEqual((await h.saved()).values, saved.values);
        await h.noOverflow();
        await h.seed(14, {}, 'consumer');
        assert.equal(await page.locator('progress').getAttribute('value'), '10');
        if (width < 1200)
            await h.nav().getByRole('link', { name: /상담서 보기/ }).click();
        else
            await page.locator('.navButtons:visible').getByRole('link', { name: /상담서 보기/ }).click();
        await page.locator('.consultationSheet').waitFor();
        console.log('PASS simplified ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await h.seed(8, {}, 'consumer');
    await h.choose('showerFaucet', '일반 샤워&욕조 수전');
    await h.choose('showerFaucet', '해바라기 샤워 수전');
    await page.reload();
    await page.locator('progress').waitFor();
    await h.focus('showerFaucet');
    assert.equal(await h.group('showerFaucet').locator('[aria-checked=true]').count(), 2);
    await page.goto(h.base + '/design?step=9&returnTo=consultation');
    await page.locator('.builderConsultationEdit').waitFor();
    await page.getByRole('link', { name: '상담서로 돌아가기', exact: true }).click();
    await page.locator('.consultationSheet').waitFor();
    await h.seed(0, {}, 'consumer');
    await h.choose('bathroomCondition', '기타');
    await page.locator('#builder-bathroomCondition-other').fill('keyboard viewport');
    await page.setViewportSize({ width: 390, height: 500 });
    await h.nav().locator('.button').scrollIntoViewIfNeeded();
    assert.equal(await h.nav().locator('.button').isVisible(), true);
    await page.getByRole('button', { name: '프로젝트 정보 수정', exact: true }).click();
    await page.locator('.projectInfoForm').waitFor();
    await h.seed(0, {}, 'consumer');
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: '처음부터 다시 만들기', exact: true }).click();
    await page.locator('.projectInfoForm').waitFor();
    assert.deepEqual((await h.saved()).values, {});
}).catch(e => { console.error(e); process.exitCode = 1; });
