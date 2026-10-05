import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeFilename, loadOptions, matchFilename, matchTileCombination, syncImages } from '../scripts/sync-builder-images.mjs';
const options = await loadOptions();
const aliases = JSON.parse(await fs.readFile('data/bathroom-builder-image-aliases.json', 'utf8'));
for (const [name, target] of Object.entries(aliases.exact)) {
  for (const suffix of ['', '(1)', '2', '3 (2)']) {
    const found = matchFilename(`${name}${suffix}.PNG`, options, aliases);
    assert.equal(found.status, 'MATCHED', name); assert.equal(found.option.key, target);
  }
}
assert.equal(normalizeFilename('  SmC 평천장 (1).PNG'), normalizeFilename('smc평천장'));
assert.equal(matchFilename('거울2.png', options, aliases).status, 'AMBIGUOUS');
assert.equal(matchFilename('럭셔리 욕조2.png', options, aliases).status, 'UNMATCHED');
assert.equal(matchFilename('600x1200.png', options, aliases).option.key, 'wallTileSize:600x1200');
assert.equal(matchFilename('600x1200.png', options, aliases).version, 1);
assert.equal(matchFilename('바닥 타일 600x600.png', options, aliases).status, 'OPTION_NOT_FOUND');
assert.equal(matchFilename('강한 환기2.png', options, aliases).status, 'UNMATCHED');
assert.equal(matchFilename('욕조 없음.png', options, aliases).status, 'MATCHED');
for(const name of ['300x600 화이트.png','300X600 화이트.png','300×600 화이트.png','300 600 화이트.png','300+600각 타일 분위기 화이트 .png'])assert.equal(matchTileCombination(name,options).combination,'300x600:white');
assert.equal(matchTileCombination('600각 타일 분위기 아이보리.png',options).combination,'600x600:ivory');
assert.equal(matchTileCombination('600x1200 다크3.png',options).version,3);
assert.equal(matchTileCombination('tile/mood/600x600/화이트.png',options).combination,'600x600:white');
assert.equal(matchTileCombination('accessories/300x600 화이트.png',options),null);
assert.equal(matchFilename('accessories/화이트.png',options,aliases).status,'UNMATCHED');
assert.equal(matchTileCombination('tile/mood/600x600/300x600 화이트.png',options).status,'AMBIGUOUS');
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'bath-image-sync-'));
const imageDir = path.join(fixture, 'public/images/bathroom-builder');
const generated = path.join(fixture, 'data/bathroom-builder-image-settings.generated.json');
const getSettings = async () => JSON.parse(await fs.readFile(generated, 'utf8'));
const run = () => syncImages({ root: fixture, options, aliases });
try {
  await fs.mkdir(path.join(imageDir, 'nested'), {recursive:true}); await fs.mkdir(path.join(fixture, 'data'));
  const png = await fs.readFile('public/images/bathroom-builder/bathtub/standard.png');
  const different = await fs.readFile('public/images/bathroom-builder/bathtub/masonry.png');
  const add = (name, bytes = png) => fs.writeFile(path.join(imageDir, name), bytes);
  await add('천장 간접 조명.png'); await add('nested/천장 간접 조명2.png'); await add('nested/천장 간접 조명3.png');
  await add('폴리우레아 줄눈.png'); await add('에폭시 줄눈2.png'); await add('욕조 없음.png');
  await add('600x1200.png'); await add('아직 모르겠어요.png'); await add('기타.png'); await add('업체와 상담 후 결정.png'); await add('거울2.png');
  let report = await run(), settings = await getSettings();
  assert.equal(decodeURIComponent(settings['lighting:indirect'].builderImage), '/images/bathroom-builder/nested/천장 간접 조명3.png');
  assert.equal(report.files.filter(f => f.status === 'OLDER_VERSION').length, 2);
  for (const key of ['grout:grout-polyurea', 'grout:grout-epoxy', 'bathtub:none']) assert.equal(settings[key].showBuilderImage, true);
  assert.equal(settings['ventilation:other'], undefined);
  assert.equal(settings['ventilation:strong-fan'], undefined);
  for (const o of options.filter(o => o.id === 'undecided' || o.id === 'other' || /상담.*결정/.test(o.name))) assert.equal(settings[o.key].showBuilderImage, false);
  assert.equal(report.files.find(f => f.file === '거울2.png').status, 'AMBIGUOUS');
  const stable = await fs.readFile(generated, 'utf8');
  await run(); assert.equal(await fs.readFile(generated, 'utf8'), stable);
  // Differing copies at the same version never silently replace the selected photo.
  await add('천장 간접 조명3 (1).png', different); report = await run();
  assert.equal(report.ambiguous, 3); assert.equal(await fs.readFile(generated, 'utf8'), stable);
  // A removed path is replaced with the latest remaining unambiguous version.
  await fs.unlink(path.join(imageDir, '천장 간접 조명3 (1).png'));
  await fs.unlink(path.join(imageDir, 'nested/천장 간접 조명3.png'));
  await run(); settings = await getSettings(); assert.ok(decodeURIComponent(settings['lighting:indirect'].builderImage).endsWith('조명2.png'));
  await fs.unlink(path.join(imageDir, '폴리우레아 줄눈.png')); await run(); assert.equal((await getSettings())['grout:grout-polyurea'].showBuilderImage, false);
  await add('폴리우레아 줄눈.jpg'); report = await run(); assert.equal(report.files.find(f => f.file === '폴리우레아 줄눈.jpg').status, 'INVALID_FORMAT');
  await add('샤워 니치.png'); await run();
  await add('샤워 샴푸박스.png', different); await run();
  assert.ok(decodeURIComponent((await getSettings())['niche:shower-niche'].builderImage).endsWith('샤워 샴푸박스.png'));
  await add('샤워 니치2.png'); await run();
  assert.ok(decodeURIComponent((await getSettings())['niche:shower-niche'].builderImage).endsWith('샤워 니치2.png'));
  await fs.mkdir(path.join(imageDir, 'inbox'));
  await add('inbox/벽 타일 600x600.png', different); await run();
  assert.ok(decodeURIComponent((await getSettings())['wallTileSize:600x600'].builderImage).endsWith('inbox/벽 타일 600x600.png'));
  await add('벽 타일 600x6002.png'); await run();
  assert.ok(decodeURIComponent((await getSettings())['wallTileSize:600x600'].builderImage).endsWith('벽 타일 600x6002.png'));
  assert.deepEqual(await fs.readFile(path.join(imageDir, '천장 간접 조명.png')), png);
  await add('300x600 화이트.png');await add('300x600 화이트2.png');await add('300x600 화이트3.png');
  await run();let combos=JSON.parse(await fs.readFile(path.join(fixture,'data/bathroom-builder-tile-images.generated.json'),'utf8'));
  assert.ok(decodeURIComponent(combos['300x600'].white).endsWith('화이트3.png'));
  await add('300x600 화이트3 (1).png',different);report=await run();
  assert.ok(report.files.find(f=>f.file==='300x600 화이트3 (1).png').status==='AMBIGUOUS');
  combos=JSON.parse(await fs.readFile(path.join(fixture,'data/bathroom-builder-tile-images.generated.json'),'utf8'));assert.ok(decodeURIComponent(combos['300x600'].white).endsWith('화이트3.png'));
  assert.equal(report.tileCombinations,1);
  console.log('PASS: recursive scan, versions, dimensions, new per-option images, none images, protected choices, ambiguity, deleted paths, idempotence, format validation and original preservation');
} finally {
  assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir()) + path.sep + 'bath-image-sync-'));
  await fs.rm(fixture, {recursive:true, force:true});
}
const current = JSON.parse(await fs.readFile('data/bathroom-builder-image-settings.generated.json','utf8'));
for (const setting of Object.values(current)) if (setting.showBuilderImage) assert.ok(await fs.stat(path.join('public', decodeURIComponent(setting.builderImage))));
console.log('PASS: every enabled real Builder image exists');
