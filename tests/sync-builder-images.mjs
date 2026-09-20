import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeFilename, loadOptions, matchFilename, syncImages } from '../scripts/sync-builder-images.mjs';
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
assert.equal(matchFilename('강한 환기2.png', options, aliases).status, 'MATCHED');
assert.equal(matchFilename('욕조 없음.png', options, aliases).status, 'MATCHED');
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
  await add('강한 환기.png'); await add('건조 기능2.png'); await add('욕조 없음.png');
  await add('600x1200.png'); await add('아직 모르겠어요.png'); await add('기타.png'); await add('업체와 상담 후 결정.png'); await add('거울2.png');
  let report = await run(), settings = await getSettings();
  assert.equal(decodeURIComponent(settings['lighting:indirect'].builderImage), '/images/bathroom-builder/nested/천장 간접 조명3.png');
  assert.equal(report.files.filter(f => f.status === 'OLDER_VERSION').length, 2);
  for (const key of ['ventilation:strong-fan', 'ventilation:dry', 'bathtub:none']) assert.equal(settings[key].showBuilderImage, true);
  assert.equal(settings['ventilation:dehumidify'].showBuilderImage, false);
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
  await fs.unlink(path.join(imageDir, '강한 환기.png')); await run(); assert.equal((await getSettings())['ventilation:strong-fan'].showBuilderImage, false);
  await add('강한 환기.jpg'); report = await run(); assert.equal(report.files.find(f => f.file === '강한 환기.jpg').status, 'INVALID_FORMAT');
  assert.deepEqual(await fs.readFile(path.join(imageDir, '천장 간접 조명.png')), png);
  console.log('PASS: recursive scan, versions, dimensions, new per-option images, none images, protected choices, ambiguity, deleted paths, idempotence, format validation and original preservation');
} finally {
  assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir()) + path.sep + 'bath-image-sync-'));
  await fs.rm(fixture, {recursive:true, force:true});
}
const current = JSON.parse(await fs.readFile('data/bathroom-builder-image-settings.generated.json','utf8'));
for (const setting of Object.values(current)) if (setting.showBuilderImage) assert.ok(await fs.stat(path.join('public', decodeURIComponent(setting.builderImage))));
console.log('PASS: every enabled real Builder image exists');
