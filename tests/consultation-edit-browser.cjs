const { run } = require('./helpers/browser-ui.cjs');
run('consultation-edit', async (h) => {
    const { page, assert } = h;
    const edit = async (title, index) => { await page.getByRole('button', { name: title + ' 수정', exact: true }).click(); await page.locator('.builderConsultationEdit').waitFor(); assert.equal((await h.saved()).current, index); assert.ok(page.url().includes('returnTo=consultation')); if (await page.evaluate(() => innerWidth >= 768))
        await h.emptyPreview(); };
    const back = async () => { await page.getByRole('link', { name: '상담서로 돌아가기', exact: true }).click(); await page.locator('.consultationSheet').waitFor(); assert.equal(new URL(page.url()).pathname, '/result'); };
    for (const [width, height] of h.sizes) {
        await page.setViewportSize({ width, height });
        await h.seed(2, { waterproofing: 'coating-waterproofing', showerFaucet: 'rain' });
        await h.report();
        await edit('방수', 2);
        assert.equal(await h.group('waterproofing').getByRole('radio', { name: '도막 방수', exact: true }).getAttribute('aria-checked'), 'true');
        const r = await page.getByRole('link', { name: '상담서로 돌아가기', exact: true }).boundingBox();
        assert.ok(r.height >= 44 && r.x >= 0 && r.x + r.width <= width);
        await h.choose('waterproofing', '액방 + 도막');
        const history = (await h.saved()).imageHistoryOrder;
        await h.nextStep();
        assert.ok(page.url().includes('step=4'));
        await page.reload();
        await page.locator('.builderConsultationEdit').waitFor();
        assert.equal(await page.locator('progress').getAttribute('value'), '4');
        await h.previousStep();
        await back();
        assert.ok((await page.locator('#consultation-waterproofing').textContent()).includes('액방 + 도막'));
        assert.deepEqual((await h.saved()).imageHistoryOrder, history);
        assert.equal((await h.saved()).memo, '테스트 메모');
        await edit('수전 & 샤워', 8);
        assert.deepEqual((await h.saved()).values.showerFaucet, ['rain']);
        await h.choose('showerFaucet', '일반 샤워&욕조 수전');
        await h.preview('일반 샤워&욕조 수전', h.settings['showerFaucet:shower'].builderImage);
        await h.choose('showerFaucet', '기타');
        await page.locator('#builder-showerFaucet-other').fill('벽부형 샤워 수전');
        if (width < 768)
            await h.preview('일반 샤워&욕조 수전', h.settings['showerFaucet:shower'].builderImage);
        else
            await h.emptyPreview();
        await back();
        assert.ok((await page.locator('#consultation-faucet').textContent()).includes('벽부형 샤워 수전'));
        await edit('줄눈', 13);
        await h.choose('grout', '에폭시 줄눈');
        await back();
        assert.ok((await page.locator('#consultation-grout').textContent()).includes('에폭시 줄눈'));
        await edit('줄눈', 13);
        await h.choose('grout', '에폭시 줄눈');
        await back();
        assert.ok((await page.locator('#consultation-grout').textContent()).includes('미정'));
        await h.noOverflow();
        console.log('PASS edit ' + width);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await h.seed(14);
    await h.report();
    const ids = await page.locator('.sheetStep').evaluateAll(es => es.map(e => ({ id: e.id, title: e.querySelector('h3').textContent.replace(/^\s*\d+\s*/, '').trim() })));
    assert.equal(ids.length, 15);
    for (let i = 0; i < ids.length; i++) {
        await edit(ids[i].title, i);
        await back();
    }
    await edit('방수', 2);
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: '처음부터 다시 만들기', exact: true }).click();
    await page.locator('.projectInfoForm').waitFor();
    assert.equal(await page.locator('.builderConsultationEdit').count(), 0);
    await page.reload();
    await page.locator('.projectInfoForm').waitFor();
    await page.waitForFunction(key=>Array.isArray(JSON.parse(localStorage.getItem(key)).values.showerFaucet),h.key);
    assert.deepEqual((await h.saved()).values, { showerFaucet: [] });
    await h.seed(8, { showerFaucet: 'rain' });
    await h.report();
    assert.ok((await h.copy()).includes('해바라기 샤워 수전'));
    await h.pdf('shower');
}).catch(e => { console.error(e); process.exitCode = 1; });
