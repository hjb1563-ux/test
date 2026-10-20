const { run } = require('./helpers/browser-ui.cjs');
run('responsive', async (h) => {
    const { page, assert } = h;
    const values = { demolition: 'full-demolition', bathroomCondition: ['leak', 'other'], bathroomConditionOther: '누수 확인 '.repeat(40), jendai: ['new', 'toilet-ledger'], partitionShower: 'fixed-glass', niche: 'shower-niche', waterproofing: 'combined-waterproofing', wallTileSize: '600x600', tile: 'dark', tileSurface: 'matte', sink: 'other', sinkOther: '기타 세면대 '.repeat(25), toilet: 'other', toiletOther: '기타 변기 '.repeat(25), mirror: 'led-mirror', cabinet: 'standard-cabinet', ceiling: 'painted', ceilingPreference: 'premium', faucet: 'one-hole', showerFaucet: ['shower', 'rain', 'other'], showerFaucetOther: '샤워 선택 '.repeat(25), ventilationOther: '긴 환풍기 선택 '.repeat(25), lighting: ['light-recessed'], accessoryFinish: 'nickel', accessoryOther: '액세서리 선택 '.repeat(25), bathtub: 'none', grout: 'grout-epoxy', threshold: 'threshold-tile' };
    for (const [width, height] of [[1920, 1080], [1280, 720], ...h.sizes])
        for (const mode of ['consumer', 'professional']) {
            await page.setViewportSize({ width, height });
            for (const [display, index] of h.indices(mode).entries()) {
                await h.seed(index, values, mode);
                assert.equal(Number(await page.locator('progress').getAttribute('value')), display + 1);
                await h.noOverflow();
                if (width < 1200) {
                    assert.equal(await page.locator('.choiceGroup:visible').count(), 1);
                    for (const id of await page.locator('.choiceGroup').evaluateAll(es => es.map(e => e.querySelector('[id$="-content"]').id.slice(8, -8)))) {
                        await h.focus(id);
                        await h.noOverflow();
                    }
                }
                assert.equal(await page.getByRole('button', { name: '선택 완료', exact: true }).count(), 0);
            }
            const before = await h.saved();
            await h.report();
            await h.noOverflow();
            assert.equal(await page.locator('#consultation-waterproofing').count(), mode === 'professional' ? 1 : 0);
            assert.equal(await page.locator('.sheetStep').count(), mode === 'professional' ? 15 : 10);
            const text = await page.locator('.consultationSheet').textContent();
            assert.ok(text.includes('기타 세면대'));
            assert.ok(text.includes('테스트 메모'));
            assert.deepEqual((await h.saved()).values, before.values);
            assert.deepEqual((await h.saved()).imageHistoryOrder, before.imageHistoryOrder);
            if (width === 1440)
                await h.pdf(mode);
            console.log('PASS all visible steps / long text / report ' + width + ' ' + mode);
        }
}).catch(e => { console.error(e); process.exitCode = 1; });
