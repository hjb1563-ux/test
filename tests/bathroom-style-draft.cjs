const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();
function load(file){if(!path.extname(file))file+='.ts';if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText)(n=>load(path.resolve(path.dirname(file),n)),m,m.exports);return m.exports;}
const draft=load(path.resolve('data/bathroom-style-draft.ts')),modes=load(path.resolve('data/bathroom-builder-mode.ts')),selection=load(path.resolve('data/bathroom-selection.ts'));
const ids=['essential-01','essential-02','balanced-01','balanced-02','balanced-03','premium-01','premium-02'];
const sizes=['300x600','300x600','600x600','600x600','600x600','600x1200','600x600'];
const colors=['ivory','gray','ivory','gray','dark','dark','white'];
for(const mode of ['consumer','professional'])for(let i=0;i<ids.length;i++){
 const v=draft.styleDraftValues(ids[i],mode),groups=modes.getVisibleSteps(mode).flatMap(s=>s.groups);
 assert.equal(v.wallTileSize,sizes[i]);assert.equal(v.tile,colors[i]);assert.equal(v.tileSurface,[1,6].includes(i)?'glossy':'matte');
 for(const [key,val]of Object.entries(v)){const g=groups.find(g=>g.key===key);assert.ok(g);for(const id of Array.isArray(val)?val:[val])assert.ok(g.choices.some(c=>c.id===id));}
 assert.deepEqual(selection.normalizeBathroomValues(v),v);
 for(const key of ['waterproofing','demolition','drainPosition','cabinet','mirror','accessory','jendai','niche'])assert.equal(v[key],undefined);
 assert.equal(v.toilet,i<5?'two-piece':undefined);
 assert.deepEqual(v.showerFaucet,i<5?['shower']:['concealed-shower','rain']);
 assert.equal(v.bathtub,[1,4].includes(i)?'bath-standard':undefined);
 assert.equal(v.partitionShower,({2:'full-partition',3:'half-partition',5:'full-partition',6:'half-partition'})[i]);
}
assert.throws(()=>draft.styleDraftValues('invalid','consumer'));
console.log('PASS 14 draft mappings: real visible choice IDs, exact tiles, no unsupported/default construction values, compatible selections');
module.exports={load};
