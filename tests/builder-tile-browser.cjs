const { run } = require('./helpers/browser-ui.cjs');
const combos = require('../data/bathroom-builder-tile-images.generated.json');
run('tile', async (h) => {
    const { page, assert } = h;
    const labels = { white: '화이트', ivory: '아이보리', gray: '그레이', dark: '다크' };
    for (const [width, height] of h.sizes) {
        await page.setViewportSize({ width, height });
        for (const [size, moods] of Object.entries(combos)) {
            await h.seed(3);
            await h.choose('wallTileSize', size.replace('x', '×'));
            for (const [mood, url] of Object.entries(moods)) {
                await h.choose('tile', labels[mood]);
                await h.preview(labels[mood], url);
                assert.equal((await h.saved()).values.tile, mood);
            }
        }
        await h.seed(3);
        await h.choose('tile', '화이트');
        await h.preview('화이트', h.settings['tile:white'].builderImage);
        await h.choose('wallTileSize', '300×600');
        await h.preview(width < 768 ? '300×600' : '화이트', width < 768 ? undefined : combos['300x600'].white);
        assert.equal((await h.saved()).values.tile, 'white');
        if (width >= 768) {
            await h.openHistory();
            assert.equal(new URL(await page.getByRole('button', { name: '화이트 이미지 크게 보기', exact: true }).locator('img').getAttribute('src'), h.base).pathname, combos['300x600'].white);
        }
        await h.choose('wallTileSize', '600×600');
        assert.deepEqual((await h.saved()).imageHistoryOrder, ['wallTileSize:600x600', 'tile:white']);
        assert.ok(!JSON.stringify(await h.saved()).includes('/images/'));
        await h.choose('tile', '아이보리');
        await h.preview('아이보리', combos['600x600'].ivory);
        const before = await h.saved();
        await h.nextStep();
        if (width >= 768)
            await h.emptyPreview();
        assert.deepEqual((await h.saved()).values, before.values);
        assert.deepEqual((await h.saved()).imageHistoryOrder, before.imageHistoryOrder);
        await page.reload();
        await page.locator('progress').waitFor();
        assert.deepEqual((await h.saved()).values, before.values);
        await h.seed(3, { tile: 'white' });
        await h.choose('wallTileSize', '기타 타일');
        await h.emptyPreview();
        await h.focus('tile');
        if (width >= 768) {
            await h.openHistory();
            await page.getByRole('button', { name: '화이트 이미지 크게 보기', exact: true }).click();
        }
        await h.preview('화이트', h.settings['tile:white'].builderImage);
        await h.noOverflow();
        console.log('PASS tile ' + width + ' 12 combinations / both selection orders / source resolution / refresh');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const index of h.indices('professional')) {
        await h.seed(index);
        assert.ok(!(await page.locator('.designGrid').textContent()).includes('왜 선택하나요?'));
        assert.equal(await page.getByRole('button', { name: '가이드 보기', exact: true }).count(), 0, 'existing MVP keeps guide entry disabled');
    }
    assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname,'../config/features.ts'),'utf8'),/remodelingGuide:\s*false/,'MVP guide flag must remain OFF');
    assert.equal(await page.getByRole('dialog').count(),0);
    assert.equal((await h.context.request.get(h.base+'/guide')).status(),200);
    await page.goto(h.base+'/guide',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('.guideCardPro').count(),17,'all existing guide categories remain accessible by their direct route');
    const urls = new Set(Object.values(h.settings).filter(v => v.showBuilderImage).map(v => v.builderImage));
    for (const v of Object.values(combos))
        for (const u of Object.values(v))
            urls.add(u);
    for (const u of urls)
        assert.equal((await h.context.request.get(h.base + u)).status(), 200);
    for (const route of ['/', '/guide', '/guide/tile', '/guide/glossary'])
        assert.equal((await h.context.request.get(h.base + route)).status(), 200);
}).catch(e => { console.error(e); process.exitCode = 1; });
