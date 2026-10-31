const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const {createHash} = require('node:crypto');
const source = fs.readFileSync('data/bathroom-style-examples.ts', 'utf8');
const moduleContext = {exports:{}};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, moduleContext);
const styles = moduleContext.exports.bathroomStyles;
assert.deepEqual(Array.from(styles, style => style.examples.length), [2,3,2]);
const examples = styles.flatMap(style => style.examples);
assert.equal(examples.length, 7);
assert.equal(new Set(examples.map(example => example.id)).size, 7);
const photos = examples.filter(example => example.image);
assert.equal(new Set(photos.map(example => example.image.src)).size, photos.length);
assert.equal(photos.length, 7);
const inventory = JSON.parse(fs.readFileSync('docs/BATHROOM_STYLE_IMAGE_INVENTORY.json', 'utf8'));
assert.equal(inventory.length, 7);
for (const style of styles) style.examples.forEach((example,index) => {
  assert.equal(example.title, `${style.title} ${String(index+1).padStart(2,'0')}`);
  for (const field of ['id','title','description']) assert.ok(example[field]);
  for (const field of ['spaces','tiles','fixtures','accessories','notes']) assert.ok(Array.isArray(example[field]));
  if (example.image) {
    assert.ok(example.image.alt);
    assert.ok(fs.existsSync('public' + example.image.src.split('?')[0]));
    const record = inventory.find(record => record.id === example.id);
    assert.equal('public' + example.image.src.split('?')[0], record.destination);
    const bytes = fs.readFileSync(record.destination);
    assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), example.image.width);
    assert.equal(bytes.readUInt32BE(20), example.image.height);
    assert.equal(bytes.length, record.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(), record.sha256);
    assert.equal(fs.existsSync(record.source), false, 'imported uploads moved out of inbox');
    for (const field of ['spaces','tiles','fixtures','accessories']) assert.ok(example[field].length > 0);
  } else {
    for (const field of ['spaces','tiles','fixtures','accessories']) assert.equal(example[field].length, 0, 'missing photos must not inherit another example specifications');
  }
});
assert.ok(styles[0].examples[1].spaces.includes('일반 욕조'));
assert.ok(styles[1].examples[2].spaces.includes('일반 욕조'));
assert.ok(styles[2].examples[0].fixtures.some(item => item.includes('언더볼')));
assert.ok(styles[2].examples[1].fixtures.some(item => item.includes('탑볼')));
assert.ok(styles[2].examples.every(example => !example.spaces.some(item => item.includes('욕조'))));
console.log('PASS styles 2/3/2, seven unique photos/IDs, PNG dimensions and original hashes, import paths, independent bathtub/partition/basin specifications');
