const { run } = require('./helpers/browser-ui.cjs');
run('structure', async (h) => {
    const { page, assert } = h;
    await page.setViewportSize({ width: 1440, height: 900 });
    await h.seed(1);
    assert.equal(await page.locator('.choiceGroup').count(), 3);
    assert.equal(await h.group('jendai').getByRole('checkbox').count(), 4);
    assert.equal(await h.group('partitionShower').getByRole('radio').count(), 5);
    await h.choose('partitionShower', '하프 파티션');
    await h.choose('partitionShower', '도어형 샤워부스');
    assert.equal((await h.saved()).values.partitionShower, 'door-booth');
    assert.equal(await h.group('partitionShower').locator('[aria-checked=true]').count(), 1);
    await h.seed(4);
    await h.choose('sink', '탑볼 세면대');
    await h.choose('toilet', '원피스');
    assert.equal((await h.saved()).values.sink, 'top-bowl');
    assert.equal((await h.saved()).values.toilet, 'one-piece');
    await h.choose('sink', '기타');
    await page.locator('#builder-sink-other').fill('낮은 세면대');
    await h.choose('toilet', '기타');
    await page.locator('#builder-toilet-other').fill('원하는 변기');
    await page.reload();
    await page.locator('progress').waitFor();
    assert.equal(await page.locator('#builder-sink-other').inputValue(), '낮은 세면대');
    assert.equal(await page.locator('#builder-toilet-other').inputValue(), '원하는 변기');
    await h.seed(12, { accessoryOther: '수건걸이' });
    const input = page.locator('#builder-accessory-other');
    assert.equal(await input.getAttribute('type'), 'text');
    assert.equal(await h.group('accessory').locator('[role=radio],[role=checkbox],textarea').count(), 0);
    await input.fill('휴지걸이, 수건걸이, 코너 선반');
    await page.reload();
    assert.equal(await input.inputValue(), '휴지걸이, 수건걸이, 코너 선반');
    await h.seed(16, { partition: 'half-partition', showerBooth: 'door-booth', jendai: ['new', 'sink-ledger'], concealed: ['concealed-basin'], window: 'yes', sink: 'top-bowl', toilet: 'one-piece', accessoryOther: '수건걸이' }, 'professional', { version: 2 });
    assert.equal((await h.saved()).current, 14);
    assert.equal((await h.saved()).values.partitionShower, 'half-partition');
    assert.equal((await h.saved()).values.window, undefined);
    assert.equal((await h.saved()).values.concealed, undefined);
    assert.equal(await page.getByText('최종 검토', { exact: true }).count(), 0);
    await h.report();
    assert.equal(await page.locator('.sheetStep').count(), 15);
    assert.ok(!(await page.locator('.sheetSelections').textContent()).includes('욕실 창문'));
    await h.pdf('legacy');
    for (const [width, height] of h.sizes)
        for (const mode of ['consumer', 'professional']) {
            await page.setViewportSize({ width, height });
            await h.seed(0, {}, mode);
            for (let i = 0; i < h.indices(mode).length; i++) {
                assert.equal(await page.locator('.builderChoiceCard[aria-checked=true]').count(), 0);
                await h.noOverflow();
                if (i < h.indices(mode).length - 1)
                    await h.nextStep();
            }
            assert.equal(await page.locator('progress').getAttribute('value'), mode === 'consumer' ? '10' : '15');
            await h.report();
            assert.equal(await page.locator('.sheetStep').count(), mode === 'consumer' ? 0 : 15);
            if (mode === 'professional')
                assert.equal(await page.locator('.sheetRow--pending').count(), 24);
            console.log('PASS optional empty navigation ' + width + ' ' + mode);
        }
    await page.setViewportSize({ width: 390, height: 844 });
    await h.seed(4);
    await h.choose('sink', '일반 세면대');
    assert.equal(await h.group('toilet').isVisible(), false, 'selection must not auto-advance');
    await h.focus('toilet');
    await h.choose('toilet', '원피스');
    assert.equal((await h.saved()).values.sink, 'vanity-basin');
    await h.report();
    await page.getByRole('button', { name: '세면대 & 변기 수정', exact: true }).click();
    await page.locator('progress').waitFor();
    assert.equal((await h.saved()).values.toilet, 'one-piece');
    await page.goto(h.base + '/guide');
    assert.equal(await page.locator('.guideCardPro').count(), 17);
}).catch(e => { console.error(e); process.exitCode = 1; });
