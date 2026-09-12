// Component-level regression checks; no browser or additional packages required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let slots = [], cursor = 0, effects = [], dirty = false;
const storage = new Map();
const params = new URLSearchParams();
const hooks = {
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => {
      const next = typeof value === 'function' ? value(slots[index]) : value;
      if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
    }];
  },
  useMemo(fn, deps) {
    const index = cursor++;
    if (!slots[index] || deps.some((v, i) => v !== slots[index].deps[i])) slots[index] = { value: fn(), deps };
    return slots[index].value;
  },
  useEffect(fn, deps) {
    const index = cursor++;
    if (!slots[index] || deps.some((v, i) => v !== slots[index][i])) { slots[index] = deps; effects.push(fn); }
  },
};
const cache = new Map();
function evaluate(source, filename) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = name => {
    if (name === 'react') return { ...React, ...hooks };
    if (name === 'next/navigation') return { useSearchParams: () => params };
    if (name === 'next/link') return { default: props => React.createElement('a', props), __esModule: true };
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    if (name.includes('guides/catalog')) return { guideBySlug: {} };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name));
    return require(name);
  };
  vm.runInNewContext(code, { exports: module.exports, module, require: localRequire, URLSearchParams, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } }, { filename });
  return module.exports;
}
function load(file) {
  if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts';
  if (!cache.has(file)) cache.set(file, evaluate(fs.readFileSync(file, 'utf8'), file));
  return cache.get(file);
}
function expand(node) {
  if (Array.isArray(node)) return node.flatMap(expand);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return { type: node.type, props: node.props, children: expand(node.props?.children) };
}
function all(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(n => all(n, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...all(node.children, predicate)];
}
const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.children) : '';
const Configurator = load(path.join(root, 'components/Configurator')).default;
const data = load(path.join(root, 'data/bathroom-options'));
const groups = data.bathroomSteps.flatMap(step => step.groups);
function render() {
  let tree, rounds = 0;
  do { dirty = false; cursor = 0; effects = []; tree = expand(Configurator()); effects.forEach(fn => fn()); assert.ok(++rounds < 20); } while (dirty);
  return tree;
}
function click(tree, title) {
  const button = all(tree, n => n.type === 'button' && text(n).includes(title))[0];
  assert.ok(button, `Missing button: ${title}`); button.props.onClick(); return render();
}
function sources(tree, source) { return all(tree, n => n.type === 'img' && n.props.src === source); }
function four(tree, source) {
  for (const cls of ['choiceGrid', 'selectedHeroImage', 'selectionHistoryStrip', 'summary']) {
    const area = all(tree, n => n.props.className === cls)[0];
    // There are multiple option groups; search every choice grid.
    const areas = cls === 'choiceGrid' ? all(tree, n => n.props.className === cls) : [area];
    assert.equal(areas.flatMap(a => sources(a, source)).length, 1, cls);
  }
}
const original = evaluate(execFileSync('git', ['show', 'HEAD:data/bathroom-options.ts'], { cwd: root, encoding: 'utf8' }), path.join(root, 'data/bathroom-options.ts'));
assert.equal(data.bathroomSteps.length, 17);
const structure = steps => JSON.stringify(steps.map(s => ({ key: s.key, groups: s.groups.map(g => ({ key: g.key, multiple: g.multiple, choices: g.choices.map(c => ({ id: c.id, image: c.image })) })) })));
assert.equal(structure(data.bathroomSteps), structure(original.bathroomSteps), 'IDs, multi-select flags and legacy images unchanged');
for (const group of groups) for (const choice of group.choices) {
  assert.match(choice.builderImage, /^\/images\/bathroom-builder\/.+\.jpg$/);
  assert.ok(fs.existsSync(path.dirname(path.join(root, 'public', choice.builderImage))));
  assert.ok(fs.readFileSync(path.join(root, 'BATHROOM_BUILDER_IMAGES.md'), 'utf8').includes('public' + choice.builderImage));
}
let tree = click(render(), '선택 완료');
tree = click(tree, '하프 파티션');
const half = groups.find(g => g.key === 'partition').choices.find(c => c.id === 'half-partition');
four(tree, half.builderImage); console.log('PASS 1: half-partition uses one source in all four surfaces');
tree = click(tree, '하프 파티션');
assert.equal(sources(tree, half.builderImage).length, 1); console.log('PASS 4: deselect removes all three selected images');
tree = click(tree, '선택 완료'); tree = click(tree, '선택 완료'); tree = click(tree, '선택 완료');
tree = click(tree, '탑볼 세면대');
const bowl = groups.find(g => g.key === 'sink').choices.find(c => c.id === 'top-bowl');
four(tree, bowl.builderImage); console.log('PASS 2: top-bowl uses one source in all four surfaces');
const before = bowl.builderImage;
try {
  bowl.builderImage = '/images/bathroom-builder/fallback/placeholder.svg';
  four(render(), bowl.builderImage); console.log('PASS 3: changed data source updates all four surfaces');
  const saved = storage.get('bath-designer-selections-v2');
  assert.equal(JSON.parse(saved).values.sink, 'top-bowl');
  assert.ok(!/builderImage|https?:|\/images\//.test(saved));
  slots = []; tree = render();
  for (let i = 0; i < 4; i++) tree = click(tree, '선택 완료');
  four(tree, bowl.builderImage); console.log('PASS 5: remount restores saved ID and resolves the latest source');
} finally { bowl.builderImage = before; }
const Image = load(path.join(root, 'components/BuilderOptionImage')).default;
const image = Image({ option: bowl }); let writes = 0, src = image.props.src;
const target = { getAttribute: () => src, set src(value) { src = value; writes++; } };
image.props.onError({ currentTarget: target }); image.props.onError({ currentTarget: target });
assert.equal(src, '/images/bathroom-builder/fallback/placeholder.svg'); assert.equal(writes, 1);
assert.ok(fs.readFileSync(path.join(root, 'public', src), 'utf8').includes('대표 이미지 준비 중'));
console.log('PASS 6: missing image switches to fallback once without looping');
tree = render(); for (let i = 0; i < 5; i++) tree = click(tree, '선택 완료');
tree = click(tree, '일반 샤워수전'); tree = click(tree, '핸드 샤워');
assert.deepEqual(JSON.parse(storage.get('bath-designer-selections-v2')).values.showerFaucet, ['shower', 'hand-shower']);
tree = click(tree, '일반 샤워수전');
assert.deepEqual(JSON.parse(storage.get('bath-designer-selections-v2')).values.showerFaucet, ['hand-shower']);
console.log('PASS: multi-select, deselect, navigation, all option paths and documentation');
