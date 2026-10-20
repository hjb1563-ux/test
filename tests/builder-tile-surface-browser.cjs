const { run } = require('./helpers/browser-ui.cjs'), matrix = require('../data/bathroom-builder-tile-surface-images.generated.json');
run('tile-surface', async (h) => {
    const { page, assert } = h, labels = { white: '화이트', ivory: '아이보리', gray: '그레이', dark: '다크' }, surface = { matte: '무광', glossy: '유광' };
    for (const [width, height] of h.sizes) {
        await page.setViewportSize({ width, height });
        for (const [size, moods] of Object.entries(matrix))
            for (const [mood, surfaces] of Object.entries(moods)) {
                await h.seed(3);
                await h.choose('wallTileSize', size.replace('x', '×'));
                await h.choose('tile', labels[mood]);
                const g = await h.focus('tileSurface');
                for (const [id, url] of Object.entries(surfaces)) {
                    const thumb = g.getByRole('radio', { name: surface[id], exact: true }).locator('img');
                    assert.equal(new URL(await thumb.getAttribute('src'), h.base).pathname, new URL(url, h.base).pathname);
                    await h.choose('tileSurface', surface[id]);
                    await h.preview(surface[id], url);
                    assert.equal((await h.saved()).values.tileSurface, id);
                }
            }
        await h.seed(3, { wallTileSize: '600x600', tile: 'dark', tileSurface: 'matte' });
        await h.choose('wallTileSize', '300×600');
        await h.choose('tile', '화이트');
        const before = await h.saved();
        assert.deepEqual(before.imageHistoryOrder, ['tile:white', 'wallTileSize:300x600', 'tileSurface:matte']);
        await page.reload();
        await page.locator('progress').waitFor();
        assert.deepEqual((await h.saved()).values, before.values);
        assert.deepEqual((await h.saved()).imageHistoryOrder, before.imageHistoryOrder);
        await h.focus('tileSurface');
        if (width >= 768) {
            await h.emptyPreview();
            await h.openHistory();
            await page.getByRole('button', { name: '무광 이미지 크게 보기', exact: true }).click();
        }
        await h.preview('무광', matrix['300x600'].white.matte);
        for (const values of [{ tileSurface: 'matte' }, { wallTileSize: '600x600', tileSurface: 'matte' }, { tile: 'dark', tileSurface: 'matte' }, { wallTileSize: 'other', wallTileSizeOther: '임의 규격', tile: 'dark', tileSurface: 'matte' }]) {
            await h.seed(3, values);
            const g = await h.focus('tileSurface');
            assert.equal(new URL(await g.getByRole('radio', { name: '무광', exact: true }).locator('img').getAttribute('src'), h.base).pathname, h.settings['tileSurface:matte'].builderImage);
            if (width >= 768) {
                await h.openHistory();
                await page.getByRole('button', { name: '무광 이미지 크게 보기', exact: true }).click();
            }
            await h.preview('무광', h.settings['tileSurface:matte'].builderImage);
        }
        await h.seed(14, { wallTileSize: '600x600', tile: 'dark', tileSurface: 'matte' });
        await h.report();
        assert.ok((await page.locator('#consultation-tile').textContent()).includes('무광'));
        await page.getByRole('button', { name: '타일 수정', exact: true }).click();
        await page.locator('.builderConsultationEdit').waitFor();
        await h.choose('tileSurface', '유광');
        await h.preview('유광', matrix['600x600'].dark.glossy);
        await page.getByRole('link', { name: '상담서로 돌아가기', exact: true }).click();
        await page.locator('.consultationSheet').waitFor();
        assert.ok((await page.locator('#consultation-tile').textContent()).includes('유광'));
        await h.noOverflow();
        console.log('PASS surfaces ' + width + ' 24 sources / thumbnails / dependency changes / all fallbacks / edit return');
    }
}).catch(e => { console.error(e); process.exitCode = 1; });
