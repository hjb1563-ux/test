const { run } = require('./helpers/browser-ui.cjs');
run('catalog', async (h) => {
    const { page, assert } = h;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await h.seed(0, { bathroomCondition: ['cracked', 'loose', 'other'], bathroomConditionOther: '천장에서 누수 흔적 있음' }, 'consumer');
    assert.deepEqual((await h.saved()).values.bathroomCondition, ['damaged-tile', 'other']);
    assert.equal(await h.group('bathroomCondition').getByRole('checkbox', { name: '기존타일이 깨졌거나 들떠 있다', exact: true }).getAttribute('aria-checked'), 'true');
    await page.locator('#builder-bathroomCondition-other').fill('곰팡이가 심함');
    await page.reload();
    await page.locator('#builder-bathroomCondition-other').waitFor();
    assert.equal(await page.locator('#builder-bathroomCondition-other').inputValue(), '곰팡이가 심함');
    const before = await h.saved();
    await page.getByRole('button', { name: '프로젝트 정보 수정', exact: true }).click();
    await page.getByRole('radio', { name: /^전문가용/ }).click();
    await page.getByRole('button', { name: '프로젝트 정보 저장', exact: true }).click();
    assert.equal(await h.group('bathroomCondition').count(), 0);
    assert.deepEqual((await h.saved()).values, before.values);
    await h.report();
    assert.ok(!(await page.locator('.consultationSheet').textContent()).includes('곰팡이가 심함'));
    await h.seed(2, { waterproofing: 'liquid-waterproofing' });
    assert.equal((await h.saved()).values.waterproofing, undefined);
    assert.equal(await h.group('waterproofing').getByRole('radio', { name: '액방', exact: true }).count(), 0);
    assert.equal(await h.group('waterproofing').getByRole('radio', { name: '액방 + 도막', exact: true }).count(), 1);
    await h.seed(5, { cabinet: 'led-cabinet', mirror: 'led-mirror' });
    assert.equal((await h.saved()).values.cabinet, undefined);
    assert.equal(await h.group('cabinet').getByRole('radio', { name: 'LED 거울장', exact: true }).count(), 0);
    await h.choose('cabinet', '일반 거울장');
    assert.equal((await h.saved()).values.mirror, 'led-mirror');
    await h.seed(13, { grout: 'grout-elastic' });
    assert.equal((await h.saved()).values.grout, undefined);
    await h.choose('grout', '폴리우레아 줄눈');
    await h.preview('폴리우레아 줄눈', h.settings['grout:grout-polyurea'].builderImage);
    for (const [width, height] of h.sizes) {
        await page.setViewportSize({ width, height });
        await h.seed(10, { ventilation: ['custom'], ventilationCustom: '힘펠 휴젠뜨' });
        const fan = page.locator('#builder-ventilation-other');
        assert.equal(await fan.inputValue(), '힘펠 휴젠뜨');
        assert.equal(await h.group('ventilation').locator('[role=radio],[role=checkbox],textarea').count(), 0);
        await fan.fill('   ');
        assert.equal(await page.locator('.summaryRow b').textContent(), '미정');
        await fan.fill('힘펠 제로크');
        await page.reload();
        await fan.waitFor();
        assert.equal(await fan.inputValue(), '힘펠 제로크');
        const box = await fan.boundingBox();
        assert.ok(box.width > 150 && box.height >= 44);
        await h.noOverflow();
        await h.seed(0);
        await h.choose('demolition', '전체 철거');
        await h.preview('전체 철거', h.settings['demolition:full-demolition'].builderImage);
        const saved = await h.saved();
        await h.nextStep();
        if (width >= 768) {
            await h.emptyPreview();
            await h.openHistory();
            const thumb = page.getByRole('button', { name: '전체 철거 이미지 크게 보기', exact: true });
            await thumb.focus();
            await thumb.press('Space');
            await h.preview('전체 철거', h.settings['demolition:full-demolition'].builderImage);
            const b = await thumb.boundingBox();
            assert.ok(b.width >= 44 && b.height >= 44);
            assert.deepEqual((await h.saved()).values, saved.values);
        }
        await h.choose('partitionShower', '하프 파티션');
        await h.preview('하프 파티션', h.settings['partitionShower:half-partition'].builderImage);
        await h.previousStep();
        assert.equal((await h.saved()).values.demolition, 'full-demolition');
        assert.equal((await h.saved()).values.partitionShower, 'half-partition');
        if (width >= 768)
            await h.emptyPreview();
        await h.noOverflow();
        console.log('PASS catalog ' + width);
    }
    const values = { demolition: 'full-demolition', bathroomCondition: ['damaged-tile', 'leak', 'remove-bath', 'other'], bathroomConditionOther: '곰팡이가 심함', faucet: 'one-hole', niche: 'shower-niche', cabinet: 'standard-cabinet', ventilationOther: '힘펠 휴젠뜨', grout: 'grout-polyurea' };
    for (const mode of ['consumer', 'professional']) {
        await h.seed(14, values, mode);
        await h.report();
        const text = await page.locator('.consultationSheet').textContent();
        assert.equal(text.includes('곰팡이가 심함'), mode === 'consumer');
        for (const label of ['샤워 샴푸박스', '일반 거울장', '폴리우레아 줄눈'])
            assert.ok(text.includes(label));
        assert.equal(text.includes('힘펠 휴젠뜨'), mode === 'professional');
        assert.ok(!/LED 거울장|탄성 줄눈|욕실 창문|매립 설비/.test(text));
        const copied = await h.copy();
        assert.ok(copied.includes('폴리우레아 줄눈'));
        assert.equal(copied.includes('곰팡이가 심함'), mode === 'consumer');
        await h.pdf(mode);
    }
    for (const value of Object.values(h.settings).filter(x => x.showBuilderImage))
        assert.equal((await h.context.request.get(h.base + value.builderImage)).status(), 200);
}).catch(e => { console.error(e); process.exitCode = 1; });
