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
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
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
const builderSteps = load(path.join(root, 'data/bathroom-builder-options')).builderBathroomSteps;
const groups = builderSteps.flatMap(step => step.groups);
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
  for (const cls of ['selectedHeroImage', 'selectionHistoryStrip', 'summary']) {
    const area = all(tree, n => n.props.className === cls)[0];
    // There are multiple option groups; search every choice grid.
    const areas = cls === 'choiceGrid' ? all(tree, n => n.props.className === cls) : [area];
    assert.equal(areas.flatMap(a => sources(a, source)).length, 1, cls);
  }
}
const original = evaluate(execFileSync('git', ['show', 'HEAD:data/bathroom-options.ts'], { cwd: root, encoding: 'utf8' }), path.join(root, 'data/bathroom-options.ts'));
assert.equal(data.bathroomSteps.length, 17);
const removed = { niche: ['wall-niche'], faucet: ['tall'], showerFaucet: ['bath', 'hand-shower'] };
const structure = steps => JSON.stringify(steps.map(s => ({ key: s.key, groups: s.groups.map(g => ({ key: g.key, multiple: g.multiple, choices: g.choices.filter(c => c.id !== 'other' && !(g.key === 'drainPosition' && c.id === 'consult') && !removed[g.key]?.includes(c.id)).map(c => ({ id: c.id, name: c.name, image: c.image })) })) })));
assert.equal(structure(data.bathroomSteps), structure(original.bathroomSteps), 'Unrelated options, names, multi-select flags and legacy images unchanged');
for (const [key, ids] of Object.entries(removed)) assert.ok(groups.find(g => g.key === key).choices.every(c => !ids.includes(c.id)));
for (const group of groups) for (const choice of group.choices) {
  if (!choice.showBuilderImage) { assert.equal(load(path.join(root, 'components/BuilderOptionImage')).default({ option: choice }), null); continue; }
  assert.match(choice.builderImage, /^\/images\/bathroom-builder\/.+\.(png|jpe?g|webp)$/);
  assert.ok(fs.existsSync(path.dirname(path.join(root, 'public', decodeURIComponent(choice.builderImage)))));
  const current = require('../data/bathroom-builder-image-settings.generated.json')[group.key + ':' + choice.id];
  assert.equal(choice.builderImage, current.builderImage);
  assert.ok(fs.existsSync(path.join(root, 'public', decodeURIComponent(choice.builderImage))));
}
let tree = click(render(), '선택 완료');
tree = click(tree, '하프 파티션');
const half = groups.find(g => g.key === 'partition').choices.find(c => c.id === 'half-partition');
four(tree, half.builderImage); console.log('PASS 1: half-partition uses one source in all three result surfaces');
tree = click(tree, '하프 파티션');
assert.equal(sources(tree, half.builderImage).length, 0); console.log('PASS 4: deselect removes all three selected images');
tree = click(tree, '선택 완료'); tree = click(tree, '선택 완료'); tree = click(tree, '선택 완료');
tree = click(tree, '탑볼 세면대');
const bowl = groups.find(g => g.key === 'sink').choices.find(c => c.id === 'top-bowl');
four(tree, bowl.builderImage); console.log('PASS 2: top-bowl uses one source in all three result surfaces');
const before = bowl.builderImage;
try {
  bowl.builderImage = '/images/bathroom-builder/fallback/placeholder.svg';
  four(render(), bowl.builderImage); console.log('PASS 3: changed data source updates all three result surfaces');
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
tree = click(tree, '일반 샤워수전'); tree = click(tree, '매립 샤워');
assert.deepEqual(JSON.parse(storage.get('bath-designer-selections-v2')).values.showerFaucet, ['shower', 'concealed-shower']);
tree = click(tree, '일반 샤워수전');
assert.deepEqual(JSON.parse(storage.get('bath-designer-selections-v2')).values.showerFaucet, ['concealed-shower']);
console.log('PASS: multi-select, deselect, navigation, all option paths and documentation');

const stateKey = 'bath-designer-selections-v2';
const state = () => JSON.parse(storage.get(stateKey)).values;
function start(stepIndex = 0, values = {}) {
  params.delete('plan'); storage.set(stateKey, JSON.stringify({ values, priorities: [] })); slots = [];
  let tree = render(); for (let i = 0; i < stepIndex; i++) tree = click(tree, '선택 완료'); return tree;
}
const region = (tree, cls) => all(tree, n => n.props.className === cls)[0];
function noSelectedImages(tree) {
  assert.equal(all(region(tree, 'selectedGallery selectedGallery--current'), n => n.type === 'img' || n.type === 'article').length, 0);
  assert.equal(all(region(tree, 'summary'), n => n.type === 'img').length, 0);
}

for (const [key, id] of [['bathtub', 'bath-standard'], ['cabinet', 'led-cabinet']]) {
  const group = groups.find(g => g.key === key);
  const option = group.choices.find(c => c.id === id);
  const index = builderSteps.findIndex(s => s.groups.includes(group));
  assert.ok(option.builderImage.endsWith('.png'));
  tree = click(start(index), option.name);
  four(tree, option.builderImage);
  tree = click(tree, option.name);
  assert.equal(sources(tree, option.builderImage).length, 0);
  tree = click(tree, option.name); four(tree, option.builderImage);
  const saved = state(); tree = start(index, saved); four(tree, option.builderImage);
  assert.ok(!JSON.stringify(saved).includes('/images/'));
}
const withoutBuilderImage = steps => JSON.stringify(steps, (key, value) => key === 'builderImage' ? undefined : value);
assert.equal(withoutBuilderImage(data.bathroomSteps), withoutBuilderImage(original.bathroomSteps));
console.log('PASS: imported bathtub/LED cabinet PNGs on all three surfaces, deselect/reselect/storage restore; all option data except image paths unchanged');
tree = click(start(), '누수 이력이 있어요');
assert.ok(all(tree, n => n.type === 'button' && text(n).includes('누수 이력'))[0].props['aria-checked']);
assert.ok(text(region(tree, 'summary')).includes('누수 이력이 있어요'));
noSelectedImages(tree);
tree = click(start(1), '기존 젠다이 유지'); noSelectedImages(tree);
tree = click(tree, '기존 젠다이 철거'); noSelectedImages(tree);
assert.ok(text(region(tree, 'summary')).includes('기존 젠다이 철거'));
console.log('PASS: bathroom condition and keep/remove jendai remain selected as text without images/cards');
tree = click(start(1), '매립 세면 수전'); tree = click(tree, '사용하지 않음');
assert.deepEqual(state().concealed, ['none']);
assert.ok(all(tree, n => n.type === 'button' && text(n) === '사용하지 않음')[0].props.className.includes('selected'));
tree = click(tree, '사용하지 않음'); assert.deepEqual(state().concealed, []);
tree = click(tree, '사용하지 않음'); tree = click(tree, '매립 샤워 수전');
assert.deepEqual(state().concealed, ['concealed-shower']);
tree = click(tree, '사용하지 않음'); assert.deepEqual(state().concealed, ['none']);
console.log('PASS: unused selection highlight, exclusive toggle and deselect');

const customGroups = ['sink','toilet','cabinet','mirror','bathtub','ceiling','faucet','drain','ventilation','lighting','accessoryFinish','accessory','wallTileSize'];
for (const key of customGroups) {
  const group = groups.find(g => g.key === key);
  const stepIndex = builderSteps.findIndex(s => s.groups.includes(group));
  const other = group.choices.find(c => c.id === 'other');
  assert.ok(other.requiresCustomText); assert.equal(other.showBuilderImage, false);
  tree = start(stepIndex);
  const section = all(tree, n => n.props.className === 'choiceGroup' && text(n.children[0]).startsWith(group.title))[0];
  const otherButton = all(section, n => n.type === 'button' && text(n).startsWith(other.name))[0];
  otherButton.props.onClick(); tree = render();
  const input = all(tree, n => n.type === 'input' && n.props.id === `builder-${key}-other`)[0];
  assert.ok(input); assert.ok(text(region(tree, 'summary')).includes('내용 미입력'));
  const draft = key === 'sink' ? '벽걸이 세면대' : `${group.title} 직접 입력`;
  input.props.onChange({ target: { value: draft } }); tree = render();
  assert.equal(state()[`${key}Other`], draft); assert.ok(text(region(tree, 'summary')).includes(draft)); noSelectedImages(tree);
  const saved = state(); tree = start(stepIndex, saved);
  assert.equal(all(tree, n => n.type === 'input')[0].props.value, draft);
  const activeSection = all(tree, n => n.props.className === 'choiceGroup' && text(n.children[0]).startsWith(group.title))[0];
  all(activeSection, n => n.type === 'button' && text(n).startsWith(other.name))[0].props.onClick(); tree = render();
  assert.ok(!text(region(tree, 'summary')).includes(draft)); assert.equal(state()[`${key}Other`], draft);
  tree = start(stepIndex, saved);
  const regular = group.choices.find(c => c.id !== 'other' && c.id !== 'undecided' && c.id !== 'none');
  const sectionAgain = all(tree, n => n.props.className === 'choiceGroup' && text(n.children[0]).startsWith(group.title))[0];
  all(sectionAgain, n => n.type === 'button' && text(n).startsWith(regular.name))[0].props.onClick(); tree = render();
  if (group.multiple) { assert.ok(state()[key].includes('other')); assert.ok(text(region(tree, 'summary')).includes(draft)); }
  else { assert.equal(state()[key], regular.id); assert.ok(!text(region(tree, 'summary')).includes(draft)); }
}
console.log('PASS: all 13 other inputs, per-category drafts, optional empty input, storage restore, deselect and single/multiple selection');

tree = click(start(10), '업체와 상담 후 결정'); noSelectedImages(tree);
assert.ok(text(region(tree, 'summary')).includes('업체와 상담 후 결정'));
const stale = { niche: 'wall-niche', faucet: 'tall', showerFaucet: ['bath', 'hand-shower', 'shower'], sink: 'other', sinkOther: '벽걸이 세면대', toilet: 'other', toiletOther: '작은 변기' };
tree = start(4, stale);
assert.equal(state().niche, undefined); assert.equal(state().faucet, undefined); assert.deepEqual(state().showerFaucet, ['shower']);
assert.equal(state().sinkOther, '벽걸이 세면대'); assert.equal(state().toiletOther, '작은 변기');
const normalize = load(path.join(root, 'data/bathroom-selection')).normalizeBathroomValues;
for (const invalid of [null, [], 42, 'bad']) assert.equal(JSON.stringify(normalize(invalid)), '{}');
assert.equal(JSON.stringify(normalize({ niche: 'general-wall-niche', showerFaucet: [null, {}] })), '{}');
const noImage = groups.find(g => g.key === 'jendai').choices.find(c => c.id === 'keep');
assert.equal(Image({ option: noImage }), null);
console.log('PASS: consultation text, no fallback for intentional text options, removed/malformed stored IDs ignored');

const Result = load(path.join(root, 'app/result/page')).default;
params.set('plan', encodeURIComponent(JSON.stringify(stale)));
let resultTree = expand(Result());
assert.ok(text(resultTree).includes('기타 · 벽걸이 세면대')); assert.ok(text(resultTree).includes('기타 · 작은 변기'));
assert.ok(!text(resultTree).includes('wall-niche')); assert.ok(!text(resultTree).includes('hand-shower'));
params.set('plan', encodeURIComponent(JSON.stringify({ sink: 'vanity-basin', sinkOther: 'HIDDEN_DRAFT' })));
assert.ok(!text(expand(Result())).includes('HIDDEN_DRAFT'));
console.log('PASS: result summary uses active custom text and omits drafts/removed IDs');

tree = start();
for (let index = 0; index < 17; index++) {
  const left = all(tree, n => n.type === 'section' && String(n.props.className).split(' ').includes('options'))[0];
  assert.equal(all(left, n => n.type === 'img' || n.type === 'Image').length, 0);
  assert.equal(all(left, n => n.props.className === 'choice' || n.props.className === 'choiceCopy' || n.props.className === 'undecidedButton').length, 0);
  const buttons = all(left, n => n.type === 'button' && String(n.props.className).includes('builderChoiceCard'));
  assert.equal(buttons.length, builderSteps[index].groups.reduce((n, g) => n + g.choices.length, 0));
  for (const button of buttons) assert.ok(['radio', 'checkbox'].includes(button.props.role));
  if (index < 16) tree = click(tree, '선택 완료');
}
for (const group of groups) {
  const undecided = group.choices.find(c => c.id === 'undecided');
  assert.equal(undecided.showBuilderImage, false);
  assert.equal(Image({ option: undecided }), null);
  const index = builderSteps.findIndex(s => s.groups.includes(group));
  const first = group.choices.find(c => c.id !== 'undecided' && c.id !== 'none');
  tree = start(index, { [group.key]: group.multiple ? [first.id] : first.id });
  let section = all(tree, n => n.props.className === 'choiceGroup' && text(n.children[0]).startsWith(group.title))[0];
  all(section, n => n.type === 'button' && text(n) === '아직 모르겠어요')[0].props.onClick(); tree = render();
  assert.equal(JSON.stringify(state()[group.key]), JSON.stringify(group.multiple ? ['undecided'] : 'undecided'));
  noSelectedImages(tree);
  assert.ok(text(region(tree, 'summary')).includes('아직 모르겠어요'));
  section = all(tree, n => n.props.className === 'choiceGroup' && text(n.children[0]).startsWith(group.title))[0];
  const selectedButton = all(section, n => n.type === 'button' && text(n) === '아직 모르겠어요')[0];
  assert.equal(selectedButton.props['aria-checked'], true);
  assert.ok(selectedButton.props.className.includes('selected'));
  tree = start(index, state());
  section = all(tree, n => n.props.className === 'choiceGroup' && text(n.children[0]).startsWith(group.title))[0];
  all(section, n => n.type === 'button' && text(n) === first.name)[0].props.onClick(); render();
  assert.equal(JSON.stringify(state()[group.key]), JSON.stringify(group.multiple ? [first.id] : first.id));
}
const Card = load(path.join(root, 'components/BuilderChoiceCard')).default;
let clicked = 0, focused = 0, prevented = 0;
const current = {};
const next = { focus: () => focused++, click: () => clicked++, getAttribute: () => 'false' };
current.parentElement = { querySelectorAll: () => [current, next] };
const radio = Card({ label: 'Keyboard test', selected: false, onSelect() {} });
assert.equal(radio.type, 'button'); // Native buttons activate with both Space and Enter.
radio.props.onKeyDown({ key: 'ArrowRight', currentTarget: current, preventDefault: () => prevented++ });
assert.equal(clicked, 1); assert.equal(focused, 1); assert.equal(prevented, 1);
console.log('PASS: all 17 steps have image-free text cards; every undecided option is exclusive, restored and image-free; radio arrow-key navigation');

// Builder-only option changes: exercise the real click handlers and storage effects.
tree = click(start(7), '일반 욕조');
tree = click(tree, '욕조 없음');
assert.equal(state().bathtub, 'none');
assert.equal(all(tree, n => n.type === 'button' && text(n) === '욕조 없음')[0].props['aria-checked'], true);
assert.equal(all(tree, n => n.type === 'button' && text(n) === '일반 욕조')[0].props['aria-checked'], false);
noSelectedImages(tree);
assert.ok(text(region(tree, 'summary')).includes('욕조 없음'));
tree = start(7, state());
assert.equal(state().bathtub, 'none'); noSelectedImages(tree);
assert.ok(text(region(tree, 'summary')).includes('욕조 없음'));
tree = click(tree, '조적 욕조');
assert.equal(state().bathtub, 'bath-masonry');
four(tree, groups.find(g => g.key === 'bathtub').choices.find(c => c.id === 'bath-masonry').builderImage);

tree = start(3, { floorTileSize: '600x600', wallTileSize: '300x600', sink: 'other', sinkOther: '보존할 입력' });
assert.ok(text(tree).includes('벽 & 바닥 타일 크기'));
assert.equal(all(tree, n => n.props.id === 'builder-floorTileSize-title').length, 0);
assert.equal(state().floorTileSize, undefined);
assert.equal(state().wallTileSize, '300x600');
assert.equal(state().sinkOther, '보존할 입력');
const wall = groups.find(g => g.key === 'wallTileSize');
assert.equal(JSON.stringify(wall.choices, (k,v) => ['builderImage','showBuilderImage'].includes(k) ? undefined : v), JSON.stringify(data.bathroomSteps[3].groups.find(g => g.key === 'wallTileSize').choices, (k,v) => ['builderImage','showBuilderImage'].includes(k) ? undefined : v));

for (const key of ['window', 'drainPosition', 'ventilation', 'accessory', 'grout']) {
  const group = groups.find(g => g.key === key);
  const stepIndex = builderSteps.findIndex(s => s.groups.includes(group));
  const originalGroup = data.bathroomSteps.flatMap(s => s.groups).find(g => g.key === key);
  for (const choice of group.choices) {
    assert.equal(choice.showBuilderImage, false);
    assert.equal(choice.builderImage, null);
    tree = click(start(stepIndex), choice.name);
    noSelectedImages(tree);
    assert.ok(text(region(tree, 'summary')).includes(choice.name));
    const row = all(region(tree, 'summary'), n => n.props.className === 'summaryRow' && text(n).startsWith(group.title))[0];
    assert.equal(all(row, n => n.type === 'div').length, 2, 'Only the row and text wrapper; no empty thumbnail wrapper');
    const saved = state();
    tree = start(stepIndex, saved);
    assert.equal(JSON.stringify(state()), JSON.stringify(saved));
    noSelectedImages(tree);
    assert.equal(all(tree, n => n.type === 'button' && text(n) === choice.name)[0].props['aria-checked'], true);
  }
  if (group.multiple) {
    const choices = group.choices.filter(c => c.id !== 'other' && c.id !== 'undecided').slice(0, 3);
    tree = start(stepIndex);
    for (const choice of choices) tree = click(tree, choice.name);
    assert.equal(JSON.stringify(state()[key]), JSON.stringify(choices.map(c => c.id)));
    noSelectedImages(tree);
    for (const choice of choices) assert.ok(text(region(tree, 'summary')).includes(choice.name));
    tree = start(stepIndex, state()); noSelectedImages(tree);
    assert.equal(JSON.stringify(state()[key]), JSON.stringify(choices.map(c => c.id)));
  }
}

for (const key of ['drain', 'accessoryFinish', 'bathtub']) {
  const group = groups.find(g => g.key === key);
  const stepIndex = builderSteps.findIndex(s => s.groups.includes(group));
  for (const choice of group.choices.filter(c => c.showBuilderImage)) {
    tree = click(start(stepIndex), choice.name); four(tree, choice.builderImage);
  }
}
// Shared options used by other routes remain byte-for-byte equivalent.
assert.equal(JSON.stringify(data.bathroomSteps), JSON.stringify(original.bathroomSteps));
console.log('PASS: no bathtub single-select/restore; merged tile label and legacy floor values; all five text-only groups and multi-select restore; drain/finish/bathtub images retained; shared route data unchanged');

// Every live photo uses the same source on all three surfaces, including replacements.
for (const group of groups) for (const choice of group.choices.filter(c => c.showBuilderImage)) {
  const index = builderSteps.findIndex(s => s.groups.includes(group));
  tree = start(index);
  const selectedGroup = all(tree, n => n.props.className === 'choiceGroup' && text(n.children[0]).startsWith(group.title))[0];
  all(selectedGroup, n => n.type === 'button' && text(n) === choice.name)[0].props.onClick(); tree = render();
  four(tree, choice.builderImage);
  tree = start(index, state()); four(tree, choice.builderImage);
  const restoredGroup = all(tree, n => n.props.className === 'choiceGroup' && text(n.children[0]).startsWith(group.title))[0];
  all(restoredGroup, n => n.type === 'button' && text(n) === choice.name)[0].props.onClick(); tree = render();
  assert.equal(sources(tree, choice.builderImage).length, 0);
}
// Exercise an image-enabled 'none' without adding a real option or fixture photo.
const noBath = groups.find(g => g.key === 'bathtub').choices.find(c => c.id === 'none');
const oldNoBath = { ...noBath };
try {
  noBath.showBuilderImage = true; noBath.builderImage = '/images/bathroom-builder/bathtub/standard.png';
  tree = click(start(7), noBath.name); four(tree, noBath.builderImage);
} finally { Object.assign(noBath, oldNoBath); }
console.log('PASS: all real image choices share current paths across hero/history/summary, storage remount and deselect; image-enabled none renders');
