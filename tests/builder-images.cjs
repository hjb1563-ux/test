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
let storageFailure = false, confirmReset = false, printCalls = 0, clipboardText = '', clipboardFailure = false, navigatedTo = '';
const browserWindow = { matchMedia: () => ({ matches: false }), history: { replaceState: (_state, _title, url) => { navigatedTo = url; } }, scrollTo: () => {}, confirm: () => confirmReset, print: () => printCalls++, location: { assign: url => { navigatedTo = url; } } };
const browserNavigator = { clipboard: { writeText: async value => { if (clipboardFailure) throw new Error('Clipboard blocked'); clipboardText = value; } } };
const hooks = {
  useRef(initial) { const [ref] = hooks.useState(() => ({current: initial})); return ref; },
  useState(initial) {
    const index = cursor++;
    const scope = slots;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => {
      const next = typeof value === 'function' ? value(scope[index]) : value;
      if (!Object.is(next, scope[index])) { scope[index] = next; dirty = true; }
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
    if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => key }) };
    if (name === 'react') return { ...React, ...hooks, useLayoutEffect: hooks.useEffect };
    if (name === 'next/navigation') return { useSearchParams: () => params };
    if (name === 'next/link') return { default: props => React.createElement('a', props), __esModule: true };
    if (name === 'next/image') return { default: props => React.createElement('img', props), __esModule: true };
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    if (name.includes('guides/catalog')) return { guideBySlug: {} };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name));
    return require(name);
  };
  vm.runInNewContext(code, { exports: module.exports, module, require: localRequire, URLSearchParams, document: { getElementById: () => null }, window: browserWindow, navigator: browserNavigator, localStorage: { getItem: k => { if (storageFailure) throw new Error('Storage blocked'); return storage.get(k) ?? null; }, setItem: (k, v) => { if (storageFailure) throw new Error('Storage blocked'); storage.set(k, v); }, removeItem: k => storage.delete(k) } }, { filename });
  return module.exports;
}
function load(file) {
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts';
  if (!cache.has(file)) cache.set(file, evaluate(fs.readFileSync(file, 'utf8'), file));
  return cache.get(file);
}
const componentStores = new WeakMap();
function expand(node, identity = 'root', rootSlots = slots) {
  if (Array.isArray(node)) return node.flatMap((child, index) => expand(child, `${identity}/${child?.key ?? index}`, rootSlots));
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') {
    if (!componentStores.has(rootSlots)) componentStores.set(rootSlots, new Map());
    const stores = componentStores.get(rootSlots), key = `${identity}/${node.type.name}/${node.key ?? ''}`;
    if (!stores.has(key)) stores.set(key, []);
    const parentSlots = slots, parentCursor = cursor;
    slots = stores.get(key); cursor = 0;
    const result = node.type(node.props);
    slots = parentSlots; cursor = parentCursor;
    return expand(result, key, rootSlots);
  }
  return { type: node.type, props: node.props, children: expand(node.props?.children, `${identity}/${String(node.type)}`, rootSlots) };
}
function all(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(n => all(n, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...all(node.children, predicate)];
}
const text = node => typeof node === 'number' ? String(node) : typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.children) : '';
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
  const matches = all(tree, n => n.type === 'button' && text(n).includes(title));
  const button = matches.find(n => ['radio', 'checkbox'].includes(n.props.role)) ?? matches[0];
  assert.ok(button, `Missing button: ${title}`); button.props.onClick(); return render();
}
function sources(tree, source) { return all(tree, n => n.type === 'img' && n.props.src === source); }
function four(tree, source) {
  for (const cls of ['selectedHeroImage', 'selectionHistoryStrip']) {
    const area = all(tree, n => n.props.className === cls)[0];
    // There are multiple option groups; search every choice grid.
    const areas = cls === 'choiceGrid' ? all(tree, n => n.props.className === cls) : [area];
    assert.equal(areas.flatMap(a => sources(a, source)).length, 1, cls);
  }
  assert.equal(all(tree, n => n.props.className === 'summary').flatMap(a => all(a, n => n.type === 'img')).length, 0, 'Summary stays text only');
}
const selection = load(path.join(root, 'data/bathroom-selection'));
const consultation = load(path.join(root, 'data/bathroom-consultation'));
const stateKey = consultation.STORAGE;
const state = () => JSON.parse(storage.get(stateKey)).values;
const plain = value => JSON.parse(JSON.stringify(value));
const groupSection = (tree, key) => all(tree,n => n.props.className === 'choiceGroup' && all(n,c=>c.props.id === `builder-${key}-content`).length)[0];
function mount(current=0,values={},version=3,mode='professional') {
  storage.set(stateKey, JSON.stringify({current, values, version, projectInfo:{projectName:'회귀 검증',builderMode:mode}})); slots=[]; for(const k of [...params.keys()])params.delete(k); return render();
}
function choose(tree,key,label) {
  const option=all(groupSection(tree,key),n=>n.type==='button' && ['radio','checkbox'].includes(n.props.role) && text(all(n,c=>c.props.className==='builderChoiceLabel')[0]?.children?.[0])===label)[0];
  assert.ok(option,`${key}: ${label}`);option.props.onClick();return render();
}

// Migrated from the legacy image suite. The current catalog has 17 guide steps,
// 16 stable Builder records (including hidden checklist), and 10/15 visible screens.
// Removed UI is verified absent instead of simulating non-existent controls.
const {test,beforeEach}=require('node:test');
beforeEach(()=>{for(const k of [...params.keys()])params.delete(k);storage.clear();slots=[];storageFailure=false;clipboardFailure=false;confirmReset=false;clipboardText='';printCalls=0;navigatedTo='';});
const modes=load(path.join(root,'data/bathroom-builder-mode'));
const imageHistory=load(path.join(root,'data/bathroom-image-history'));
const Image=load(path.join(root,'components/BuilderOptionImage')).default;
const Result=load(path.join(root,'app/result/page')).default;
const original=evaluate(execFileSync('git',['show','51944b9:data/bathroom-options.ts'],{cwd:root,encoding:'utf8'}),path.join(root,'data/bathroom-options.ts'));
const getGroup=key=>groups.find(g=>g.key===key);
const indexOf=key=>builderSteps.findIndex(s=>s.groups.some(g=>g.key===key));
const saved=()=>JSON.parse(storage.get(stateKey));
const summary=tree=>all(tree,n=>n.props.className==='summary')[0];
const noImages=tree=>{assert.equal(all(tree,n=>n.props.className==='selectedHeroImage').length,0);assert.equal(all(tree,n=>n.props.className==='selectionHistoryStrip').flatMap(n=>all(n,x=>x.type==='img')).length,0);assert.equal(all(summary(tree),n=>n.type==='img').length,0)};
function imageInBoth(tree,src){for(const cls of ['selectedHeroImage','selectionHistoryStrip']){const area=all(tree,n=>n.props.className===cls)[0];assert.ok(area,cls);assert.equal(sources(area,src).length,1,cls)}assert.equal(all(summary(tree),n=>n.type==='img').length,0)}
function toggle(tree,key,id,mode='professional'){const g=modes.getVisibleSteps(mode).flatMap(s=>s.groups).find(g=>g.key===key);assert.ok(g,key);return choose(tree,key,g.choices.find(c=>c.id===id).name)}
function resultRender(){let tree,rounds=0;do{dirty=false;cursor=0;effects=[];tree=expand(Result());effects.forEach(f=>f());assert.ok(++rounds<20)}while(dirty);return tree}
function showResult(query=''){slots=[];params.forEach((_v,k)=>params.delete(k));new URLSearchParams(query).forEach((v,k)=>params.set(k,v));return resultRender()}
function openHistory(tree,src){const b=all(tree,n=>n.props.className==='historyPreviewButton'&&sources(n,src).length)[0];assert.ok(b,'saved image history');b.props.onClick();return render()}
function press(tree,label){const b=all(tree,n=>n.type==='button'&&text(n).trim()===label)[0];assert.ok(b,label);return b}

test('guide catalog is immutable; all current image paths exist and intentional text choices stay image-free',()=>{
 assert.equal(data.bathroomSteps.length,17);assert.equal(builderSteps.length,16);
 assert.equal(JSON.stringify(data.bathroomSteps),JSON.stringify(original.bathroomSteps));
 for(const g of groups)for(const c of g.choices){if(!c.showBuilderImage){assert.equal(Image({option:c}),null);continue}assert.match(c.builderImage,/^\/images\/bathroom-builder\/.+\.(png|jpe?g|webp)$/);assert.ok(fs.existsSync(path.join(root,'public',decodeURIComponent(c.builderImage))));const record=JSON.parse(fs.readFileSync(path.join(root,'data/bathroom-builder-image-settings.generated.json'),'utf8'))[g.key+':'+c.id];assert.equal(c.builderImage,record.builderImage)}
 for(const[key,ids]of Object.entries({niche:['wall-niche'],faucet:['tall'],showerFaucet:['bath','hand-shower']}))assert.ok(getGroup(key).choices.every(c=>!ids.includes(c.id)));
});

test('partition, basin, bathtub and cabinet share image sources in preview/history; cancel/reselect/reload resolve stored IDs',()=>{
 for(const[key,id]of [['partitionShower','half-partition'],['sink','top-bowl'],['bathtub','bath-standard'],['cabinet','sliding-mirror']]){const c=getGroup(key).choices.find(c=>c.id===id);let tree=mount(indexOf(key));tree=toggle(tree,key,id);imageInBoth(tree,c.builderImage);tree=toggle(tree,key,id);assert.equal(sources(tree,c.builderImage).length,0);tree=toggle(tree,key,id);imageInBoth(tree,c.builderImage);const raw=storage.get(stateKey),values=plain(state());assert.equal(values[key],id);assert.ok(!/builderImage|https?:|\/images\//.test(raw));slots=[];tree=render();assert.equal(all(tree,n=>n.props.className==='selectedHeroImage').length,0);assert.equal(sources(all(tree,n=>n.props.className==='selectionHistoryStrip')[0],c.builderImage).length,1);tree=openHistory(tree,c.builderImage);imageInBoth(tree,c.builderImage);assert.deepEqual(saved(),JSON.parse(raw))}
});

test('changing a source updates preview/history without altering the saved ID; fallback happens once',()=>{
 const c=getGroup('sink').choices.find(c=>c.id==='top-bowl'),before=c.builderImage;let tree=mount(indexOf('sink'));tree=toggle(tree,'sink',c.id);
 try{c.builderImage='/images/bathroom-builder/fallback/placeholder.svg';slots=[];tree=render();tree=openHistory(tree,c.builderImage);imageInBoth(tree,c.builderImage);slots=[];tree=render();assert.equal(all(tree,n=>n.props.className==='selectedHeroImage').length,0);tree=openHistory(tree,c.builderImage);imageInBoth(tree,c.builderImage);assert.equal(state().sink,c.id)}finally{c.builderImage=before}
 const image=Image({option:c});let src=image.props.src,writes=0;const target={getAttribute:()=>src,set src(v){src=v;writes++}};image.props.onError({currentTarget:target});image.props.onError({currentTarget:target});assert.equal(writes,1);assert.equal(src,'/images/bathroom-builder/fallback/placeholder.svg');assert.ok(fs.existsSync(path.join(root,'public',src)));
});

test('text-only condition and keep/remove ledger choices never create image cards; removed legacy fields cannot return',()=>{
 let tree=mount(0,{},3,'consumer');tree=toggle(tree,'bathroomCondition','leak','consumer');assert.ok(text(summary(tree)).includes(getGroup('bathroomCondition').choices.find(c=>c.id==='leak').name));noImages(tree);
 tree=mount(indexOf('jendai'));for(const id of ['keep','remove']){tree=toggle(tree,'jendai',id);assert.ok(text(summary(tree)).includes(getGroup('jendai').choices.find(c=>c.id===id).name));const choice=getGroup('jendai').choices.find(c=>c.id===id);if(choice.showBuilderImage)imageInBoth(tree,choice.builderImage);else noImages(tree)}
 const normalized=selection.normalizeBathroomValues({concealed:['concealed-shower'],window:'yes',partition:'half-partition',showerBooth:'fixed-glass'});for(const key of ['concealed','window','partition','showerBooth'])assert.equal(normalized[key],undefined);assert.equal(normalized.partitionShower,'half-partition');
});

test('all currently visible custom fields preserve per-category drafts, empty pending state, deselection and single/multiple behavior',()=>{
 let count=0;
 for(const mode of ['professional','consumer'])for(const step of modes.getVisibleSteps(mode))for(const g of step.groups){const other=g.choices.find(c=>c.requiresCustomText);if(!other)continue;count++;let tree=mount(step.stepIndex,{},3,mode);tree=toggle(tree,g.key,other.id,mode);let input=()=>all(tree,n=>n.props.id==='builder-'+g.key+'-other')[0];assert.ok(input());assert.equal(consultation.consultationRows(state(),mode).find(r=>r.key===g.key).pending,true);const draft='DRAFT_'+g.key;input().props.onChange({target:{value:draft}});tree=render();assert.equal(state()[g.key+'Other'],draft);assert.ok(text(summary(tree)).includes(draft));noImages(tree);const values=plain(state());tree=mount(step.stepIndex,values,3,mode);assert.equal(input().props.value,draft);tree=toggle(tree,g.key,other.id,mode);assert.ok(!text(summary(tree)).includes(draft));assert.equal(state()[g.key+'Other'],draft);tree=mount(step.stepIndex,values,3,mode);const regular=g.choices.find(c=>!c.requiresCustomText&&c.id!=='none');assert.ok(regular);tree=toggle(tree,g.key,regular.id,mode);if(g.multiple){assert.ok(state()[g.key].includes(other.id));assert.ok(text(summary(tree)).includes(draft))}else{assert.equal(state()[g.key],regular.id);assert.ok(!text(summary(tree)).includes(draft))}}
 assert.ok(count>=13);
 for(const key of ['ventilation','accessory']){let tree=mount(indexOf(key));const draft=key+'_TEXT';const input=all(tree,n=>n.props.id==='builder-'+key+'-other')[0];assert.ok(input);input.props.onChange({target:{value:draft}});tree=render();assert.equal(state()[key+'Other'],draft);assert.equal(state()[key],undefined);assert.ok(text(summary(tree)).includes(draft));noImages(tree);slots=[];tree=render();assert.equal(all(tree,n=>n.props.id==='builder-'+key+'-other')[0].props.value,draft)}
});

test('legacy invalid IDs and hidden drafts are excluded while active custom text and independent basin/toilet survive',()=>{
 for(const value of [null,[],42,'bad'])assert.equal(JSON.stringify(selection.normalizeBathroomValues(value)),'{}');
 const values=selection.normalizeBathroomValues({niche:'wall-niche',faucet:'tall',showerFaucet:['bath','hand-shower','shower'],sink:'other',sinkOther:'BASIN_TEXT',toilet:'other',toiletOther:'TOILET_TEXT'});assert.equal(values.niche,undefined);assert.equal(values.faucet,undefined);assert.deepEqual(plain(values.showerFaucet),['shower']);assert.equal(values.sinkOther,'BASIN_TEXT');assert.equal(values.toiletOther,'TOILET_TEXT');mount(4,values);let r=showResult();assert.ok(text(r).includes('BASIN_TEXT'));assert.ok(text(r).includes('TOILET_TEXT'));assert.ok(!/wall-niche|hand-shower/.test(text(r)));r=showResult('plan='+encodeURIComponent(JSON.stringify({sink:'vanity-basin',sinkOther:'HIDDEN_DRAFT'})));assert.ok(!text(r).includes('HIDDEN_DRAFT'));
});

test('all 10/15 screens use image-free accessible cards; empty navigation remains optional and removed unknown buttons stay absent',()=>{
 for(const mode of ['consumer','professional']){const steps=modes.getVisibleSteps(mode);assert.equal(steps.length,mode==='consumer'?10:15);let tree=mount(0,{},3,mode);for(let i=0;i<steps.length;i++){const step=steps[i];assert.equal(all(tree,n=>n.type==='progress')[0].props.value,i+1);const left=all(tree,n=>n.type==='section'&&String(n.props.className).split(' ').includes('options'))[0];assert.ok(left);const expectedThumbnails=step.groups.filter(g=>g.key==='tileSurface').flatMap(g=>g.choices).filter(c=>c.showBuilderImage&&c.builderImage);assert.equal(all(left,n=>n.type==='img').length,expectedThumbnails.length,'only catalog tile-surface thumbnails are permitted in option cards');const cards=all(left,n=>n.type==='button'&&String(n.props.className).includes('builderChoiceCard'));assert.equal(cards.length,step.groups.reduce((n,g)=>n+g.choices.length,0));for(const card of cards){assert.ok(['radio','checkbox'].includes(card.props.role));const images=all(card,n=>n.type==='img');assert.ok(images.every(img=>expectedThumbnails.some(c=>c.builderImage===img.props.src)),'no unrelated image in choice card');}assert.ok(!step.groups.some(g=>g.choices.some(c=>/^(undecided|unknown|notSure)/i.test(c.id))));if(i<steps.length-1)tree=click(tree,'다음');else assert.ok(all(tree,n=>n.type==='a'&&String(n.props.href?.pathname??n.props.href).startsWith('/result')).length)}
 for(const g of steps.flatMap(s=>s.groups)){const raw={[g.key]:g.multiple?['undecided']:'undecided'};const values=selection.normalizeBathroomValues(raw);assert.ok(!selection.selectedIds(values[g.key]).includes('undecided'));const row=consultation.consultationRows(values,mode).find(r=>r.key===g.key);assert.ok(row.pending);assert.equal(row.choices.length,0)}}
 const Card=load(path.join(root,'components/BuilderChoiceCard')).default;let clicked=0,focused=0,prevented=0;const current={},next={focus:()=>focused++,click:()=>clicked++,getAttribute:()=> 'false'};current.parentElement={querySelectorAll:()=>[current,next]};const radio=Card({label:'Keyboard test',selected:false,onSelect(){}});assert.equal(radio.type,'button');radio.props.onKeyDown({key:'ArrowRight',currentTarget:current,preventDefault:()=>prevented++});assert.equal(clicked,1);assert.equal(focused,1);assert.equal(prevented,1);
});

test('none/consult choices stay image-free and exclusive; multi-select showers keep independent choices and none removes bathtub images',()=>{
 let tree=mount(indexOf('bathtub'));tree=toggle(tree,'bathtub','bath-standard');tree=toggle(tree,'bathtub','none');assert.equal(state().bathtub,'none');noImages(tree);slots=[];tree=render();assert.equal(state().bathtub,'none');noImages(tree);tree=toggle(tree,'bathtub','bath-masonry');imageInBoth(tree,getGroup('bathtub').choices.find(c=>c.id==='bath-masonry').builderImage);
 tree=mount(indexOf('showerFaucet'));tree=toggle(tree,'showerFaucet','shower');tree=toggle(tree,'showerFaucet','concealed-shower');assert.deepEqual(plain(state().showerFaucet),['shower','concealed-shower']);tree=toggle(tree,'showerFaucet','shower');assert.deepEqual(plain(state().showerFaucet),['concealed-shower']);
 for(const mode of ['consumer','professional'])for(const step of modes.getVisibleSteps(mode))for(const g of step.groups)for(const c of g.choices.filter(c=>['none','consult'].includes(c.id))){tree=mount(step.stepIndex,{},3,mode);tree=toggle(tree,g.key,c.id,mode);noImages(tree);assert.ok(text(summary(tree)).includes(c.name));assert.equal(Image({option:c}),null)}
});

test('consultation metadata, memo isolation, copy success/fallback, print, edit, storage failures and reset are preserved',async()=>{
 let tree=mount(0,{demolition:'overlay'});let r=showResult();let memo=all(r,n=>n.props.id==='consultation-memo')[0];memo.props.onChange({target:{value:'OWN_MEMO'}});r=resultRender();assert.equal(saved().memo,'OWN_MEMO');r=showResult();assert.equal(all(r,n=>n.props.id==='consultation-memo')[0].props.value,'OWN_MEMO');
 await press(r,'공사 개요만 복사').props.onClick();r=resultRender();assert.ok(clipboardText.includes('OWN_MEMO'));assert.ok(clipboardText.includes(getGroup('demolition').choices.find(c=>c.id==='overlay').name));
 clipboardFailure=true;await press(r,'공사 개요만 복사').props.onClick();r=resultRender();assert.ok(all(r,n=>n.type==='textarea').some(n=>String(n.props.value).includes('OWN_MEMO')));clipboardFailure=false;
 press(r,'인쇄 / PDF 저장').props.onClick();assert.equal(printCalls,1);press(r,'선택 수정').props.onClick();assert.equal(navigatedTo,'/design?step=1&returnTo=consultation');
 const before=storage.get(stateKey);r=showResult('plan='+encodeURIComponent(JSON.stringify({sink:'other',sinkOther:'FOREIGN_100%'})));assert.equal(all(r,n=>n.props.id==='consultation-memo')[0].props.value,'');all(r,n=>n.props.id==='consultation-memo')[0].props.onChange({target:{value:'FOREIGN_MEMO'}});r=resultRender();assert.equal(storage.get(stateKey),before);r=showResult('plan='+encodeURIComponent(JSON.stringify({sink:'other',sinkOther:'FOREIGN_100%'})));assert.equal(all(r,n=>n.props.id==='consultation-memo')[0].props.value,'FOREIGN_MEMO');assert.ok(text(r).includes('FOREIGN_100%'));r=showResult('plan=%invalid');assert.ok(text(r).includes('링크의 선택 내용을 읽지 못해'));
 storageFailure=true;r=showResult();all(r,n=>n.props.id==='consultation-memo')[0].props.onChange({target:{value:'UNSAVED_MEMO'}});r=resultRender();assert.equal(all(r,n=>n.props.id==='consultation-memo')[0].props.value,'UNSAVED_MEMO');assert.ok(text(r).includes('저장'));storageFailure=false;
 tree=mount(2,{demolition:'overlay'});const beforeReset=storage.get(stateKey);confirmReset=false;all(tree,n=>n.props['aria-label']==='처음부터 다시 만들기')[0].props.onClick();tree=render();assert.equal(storage.get(stateKey),beforeReset);confirmReset=true;all(tree,n=>n.props['aria-label']==='처음부터 다시 만들기')[0].props.onClick();tree=render();assert.equal(JSON.stringify(state()),'{}');assert.equal(saved().memo,'');assert.ok(all(tree,n=>n.props.className==='projectInfoForm').length);assert.ok(all(tree,n=>n.props.role==='radio').some(n=>text(n).includes('일반 고객용')));
 const css=fs.readFileSync(path.join(root,'app/consultation.css'),'utf8');for(const rule of ['@page','@media print','break-inside:avoid-page','.sheetImages{display:none}'])assert.ok(css.includes(rule));
});
