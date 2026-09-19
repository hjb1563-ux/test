import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeFilename, loadOptions, matchFilename, syncImages } from '../scripts/sync-builder-images.mjs';

const options = await loadOptions();
const aliases = JSON.parse(await fs.readFile('data/bathroom-builder-image-aliases.json', 'utf8'));
for (const [name, target] of Object.entries(aliases.exact)) {
  for (const suffix of ['', '(1)', ' (2) - 복사본', ' (3) copy FINAL 최종']) {
    const result = matchFilename(`${name}${suffix}.png`, options, aliases);
    assert.equal(result.status, 'MATCHED', `${name}${suffix}`);
    assert.equal(result.option.key, target);
  }
}
assert.equal(Object.keys(aliases.exact).length, 19);
assert.equal(normalizeFilename('  SmC  평천장(1) - 복사본 copy final 최종.PNG'), normalizeFilename('smc 평천장'));
assert.equal(normalizeFilename('조적 욕조'.normalize('NFD') + '.png'), normalizeFilename('조적 욕조'));
assert.equal(matchFilename('럭셔리 황금 욕조.png', options, aliases).status, 'UNMATCHED');
assert.equal(matchFilename('거울.png', options, aliases).status, 'AMBIGUOUS');
assert.equal(matchFilename('600x600.png', options, aliases).status, 'AMBIGUOUS');
assert.equal(matchFilename('바닥 타일 600×600.png', options, aliases).option.key, 'floorTileSize:600x600');
assert.equal(matchFilename('LED 거울장.png', options.filter(o => o.key !== 'cabinet:led-cabinet'), aliases).status, 'OPTION_NOT_FOUND');
for (const name of ['기존 젠다이 유지', '기존 젠다이 철거']) assert.equal(matchFilename(name + '.png', options, aliases).status, 'SKIPPED_NO_IMAGE');
assert.equal(matchFilename('기타.png', options, aliases).status, 'AMBIGUOUS');
for (const name of ['원피스 변기', '투피스 변기', '탑볼 세면대', '언더볼', '하프 파티션', '풀 파티션', '조적 욕조', '매립 샤워 수전']) {
  assert.equal(matchFilename(name + '.webp', options, aliases).status, 'MATCHED', name);
}
console.log('PASS: 19 required names/suffixes, Unicode/case normalization, future labels/aliases, ambiguous/unknown/removed/image-free options');

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bath-image-import-'));
const inbox = path.join(root, 'public/images/bathroom-builder/inbox');
const manifestPath = path.join(root, 'data/bathroom-builder-images.generated.json');
const run = () => syncImages({ root, options, aliases });
try {
  await fs.mkdir(inbox, { recursive: true }); await fs.mkdir(path.dirname(manifestPath));
  await fs.writeFile(manifestPath, '{}\n');
  const png = await fs.readFile('public/images/bathroom-builder/bathtub/standard.png');
  await fs.writeFile(path.join(inbox, '일반 욕조(1).png'), png);
  let result = await run(); assert.equal(result[0].status, 'MATCHED');
  const target = path.join(root, 'public', result[0].url);
  assert.deepEqual(await fs.readFile(target), png);
  assert.deepEqual(await fs.readFile(path.join(inbox, '일반 욕조(1).png')), png);
  const stable = await fs.readFile(manifestPath, 'utf8');
  result = await run(); assert.equal(result[0].action, 'UNCHANGED');
  assert.equal(await fs.readFile(manifestPath, 'utf8'), stable);
  // Conflicting copies preserve the existing target/manifest, even when identical.
  await fs.writeFile(path.join(inbox, '일반 욕조(2).png'), png);
  result = await run(); assert.ok(result.every(r => r.status === 'DUPLICATE_TARGET' && r.identical));
  assert.equal(await fs.readFile(manifestPath, 'utf8'), stable);
  const replacement = await fs.readFile('public/images/bathroom-builder/bathtub/masonry.png');
  await fs.writeFile(path.join(inbox, '일반 욕조(2).png'), replacement);
  result = await run(); assert.ok(result.every(r => r.status === 'DUPLICATE_TARGET' && !r.identical));
  assert.deepEqual(await fs.readFile(target), png);
  await fs.unlink(path.join(inbox, '일반 욕조(1).png'));
  result = await run(); assert.equal(result[0].action, 'REPLACED');
  assert.deepEqual(await fs.readFile(path.join(root, result[0].archived)), png);
  assert.deepEqual(await fs.readFile(target), replacement);
  await fs.unlink(path.join(inbox, '일반 욕조(2).png'));
  // A checkout without ignored inbox originals keeps the generated mapping.
  assert.deepEqual(await run(), []);
  assert.equal(await fs.readFile(manifestPath, 'utf8'), stable);
  await fs.writeFile(path.join(inbox, '일반 욕조.jpg'), png);
  assert.equal((await run())[0].status, 'INVALID_FORMAT');
  assert.equal(await fs.readFile(manifestPath, 'utf8'), stable);
  await fs.unlink(path.join(inbox, '일반 욕조.jpg'));
  const jpg = await fs.readFile('public/images/bathroom-builder/structure/partition/half-partition.jpg');
  for (const extension of ['.jpg', '.jpeg']) {
    const file = path.join(inbox, '일반 욕조' + extension); await fs.writeFile(file, jpg);
    result = await run(); assert.equal(result[0].status, 'MATCHED'); assert.ok(result[0].url.endsWith(extension));
    assert.deepEqual(await fs.readFile(path.join(root, 'public', result[0].url)), jpg); await fs.unlink(file);
  }
  const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  await fs.writeFile(path.join(inbox, '일반 욕조.webp'), webp);
  result = await run(); assert.equal(result[0].status, 'MATCHED'); assert.ok(result[0].url.endsWith('.webp'));
  assert.deepEqual(await fs.readFile(path.join(root, 'public', result[0].url)), webp);
  assert.ok(await fs.stat(target)); // Previous format is not deleted.
  console.log('PASS: byte-preserving PNG/JPG/JPEG/WebP copies, idempotence, duplicates, archive before replacement, extension change, no-inbox build, format validation');
} finally {
  // This is only the dedicated mkdtemp test directory, never the workspace.
  assert.ok(root.startsWith(path.join(os.tmpdir(), 'bath-image-import-')));
  await fs.rm(root, { recursive: true, force: true });
}

const manifest = JSON.parse(await fs.readFile('data/bathroom-builder-images.generated.json', 'utf8'));
for (const [name, key] of Object.entries(aliases.exact)) {
  const entries = await fs.readdir('public/images/bathroom-builder/inbox');
  const source = entries.find(file => normalizeFilename(file) === normalizeFilename(name));
  assert.ok(manifest[key], key);
  if (source) assert.deepEqual(await fs.readFile(path.join('public/images/bathroom-builder/inbox', source)), await fs.readFile(path.join('public', manifest[key])));
  else assert.ok(await fs.stat(path.join('public', manifest[key])));
}
console.log('PASS: all 19 real imported images exist and are byte-identical to their inbox originals');
