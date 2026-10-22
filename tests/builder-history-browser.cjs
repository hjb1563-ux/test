const { run } = require('./helpers/browser-ui.cjs');
run('history', async (h) => {
    const { page, assert } = h;
    for (const [width, height] of h.sizes) {
        await page.setViewportSize({ width, height });
        await h.seed(8);
        await h.choose('showerFaucet', '일반 샤워&욕조 수전');
        await h.preview('일반 샤워&욕조 수전', h.settings['showerFaucet:shower'].builderImage);
        await h.choose('showerFaucet', '해바라기 샤워 수전');
        await h.preview('해바라기 샤워 수전', h.settings['showerFaucet:rain'].builderImage);
        assert.deepEqual((await h.saved()).values.showerFaucet, ['shower', 'rain']);
        assert.deepEqual((await h.saved()).imageHistoryOrder, ['showerFaucet:rain', 'showerFaucet:shower']);
        await h.choose('showerFaucet', '매립 샤워&욕조 수전');
        await h.preview('매립 샤워&욕조 수전', h.settings['showerFaucet:concealed-shower'].builderImage);
        await h.choose('showerFaucet', '매립 샤워&욕조 수전');
        if (width < 768)
            await h.preview('해바라기 샤워 수전', h.settings['showerFaucet:rain'].builderImage);
        else
            await h.emptyPreview();
        await h.choose('showerFaucet', '기타');
        await page.locator('#builder-showerFaucet-other').fill('특수 샤워 수전');
        if (width < 768)
            await h.preview('해바라기 샤워 수전', h.settings['showerFaucet:rain'].builderImage);
        else
            await h.emptyPreview();
        assert.ok((await h.summary()).includes('특수 샤워 수전'));
        await h.choose('showerFaucet', '기타');
        assert.ok(!(await h.summary()).includes('특수 샤워 수전'));
        assert.equal((await h.saved()).values.showerFaucetOther, '특수 샤워 수전');
        const before = await h.saved();
        await page.reload();
        await page.locator('progress').waitFor();
        assert.deepEqual((await h.saved()).imageHistoryOrder, before.imageHistoryOrder);
        assert.deepEqual((await h.saved()).values, before.values);
        if (width >= 768) {
            await h.emptyPreview();
            await h.openHistory();
            for (const [label, id] of [['일반 샤워&욕조 수전', 'shower'], ['해바라기 샤워 수전', 'rain']]) {
                const b = page.getByRole('button', { name: label + ' 이미지 크게 보기', exact: true });
                await b.focus();
                await b.press('Enter');
                await h.preview(label, h.settings['showerFaucet:' + id].builderImage);
                assert.equal(await b.getAttribute('aria-pressed'), 'true');
                assert.deepEqual((await h.saved()).values, before.values);
            }
        }
        await h.choose('showerFaucet', '해바라기 샤워 수전');
        await h.choose('showerFaucet', '일반 샤워&욕조 수전');
        assert.deepEqual((await h.saved()).values.showerFaucet, []);
        await h.emptyPreview();
        await h.seed(12, { accessoryOther: '수건걸이' });
        await h.choose('accessoryFinish', '니켈(무광)');
        await h.preview('니켈(무광)', h.settings['accessoryFinish:nickel'].builderImage);
        await h.choose('accessoryFinish', '크롬(유광)');
        assert.equal((await h.saved()).values.accessoryFinish, 'chrome');
        assert.equal((await h.saved()).values.accessoryOther, '수건걸이');
        await h.noOverflow();
        console.log('PASS history ' + width);
    }
    await h.seed(14, { showerFaucet: ['shower', 'rain', 'other'], showerFaucetOther: '벽부형 온도조절 샤워 수전', accessoryFinish: 'nickel' });
    await h.report();
    for (const s of ['일반 샤워&욕조 수전', '해바라기 샤워 수전', '벽부형 온도조절 샤워 수전', '니켈(무광)']) {
        assert.ok((await page.locator('.consultationSheet').textContent()).includes(s));
    }
    const copied = await h.copy();
    for (const s of ['일반 샤워&욕조 수전', '해바라기 샤워 수전', '벽부형 온도조절 샤워 수전']) assert.ok(copied.includes(s));
    assert.ok(!copied.includes('니켈(무광)'), 'overview does not repeat accessory finish');
    assert.equal((await h.saved()).values.accessoryFinish, 'nickel');
    await h.fullCopyContains(['일반 샤워&욕조 수전', '해바라기 샤워 수전', '벽부형 온도조절 샤워 수전', '니켈(무광)'], 'multi-details');
    // master 51944b9 already exposes these four actions; full-selection text is covered by consultation unit tests.
    assert.deepEqual(await page.locator('.resultActions button').allTextContents(), ['공사 개요만 복사', '상담서 전체 복사', '인쇄 / PDF 저장', '선택 수정']);
    await h.pdf('multi');
}).catch(e => { console.error(e); process.exitCode = 1; });
