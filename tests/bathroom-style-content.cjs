const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const read=p=>{const c={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c);return c.exports};
const {bathroomStyles}=read('data/bathroom-style-examples.ts');
const {bathroomStyleContent:content,bathroomStyleContentGroups:groups,bathroomStyleNotice:notice,bathroomStyleProducts:products,bathroomStyleProductIds:assignments}=read('data/bathroom-style-content.ts');
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/bathroom-style-user-spec-20261031.json','utf8'));
const examples=bathroomStyles.flatMap(s=>s.examples);
assert.equal(fixture.length,7);
assert.deepEqual(Object.keys(content).sort(),fixture.map(e=>e.id).sort());
assert.deepEqual(Array.from(examples,e=>e.id).sort(),fixture.map(e=>e.id).sort());
for(const spec of fixture){
 const actual=JSON.parse(JSON.stringify(groups(content[spec.id])));
 assert.equal(examples.find(e=>e.id===spec.id).title,spec.title);
 assert.deepEqual(actual,spec.categories,spec.id+' must match the user specification character for character, including item order');
 assert.equal(actual.length,5);
 assert.deepEqual(actual.map(c=>c.items.length),[2,2,spec.id.startsWith('premium')?4:3,4,2]);
 const items=actual.flatMap(c=>c.items);assert.equal(items.length,new Set(items).size);
 assert.equal(assignments[spec.id].length,new Set(assignments[spec.id]).size);
 for(const productId of assignments[spec.id])assert.ok(products[productId],productId);
}
for(let a=0;a<fixture.length;a++)for(let b=a+1;b<fixture.length;b++)for(const category of fixture[a].categories)assert.notEqual(content[fixture[a].id][category.key],content[fixture[b].id][category.key],'independent example arrays');
assert.equal(groups().length,0);
assert.equal(groups({tiles:[],basinsAndToilets:['fixture'],features:[' ']}).length,1);
assert.equal(notice,'사진은 구성 참고용이며, 실제 시공 사양은 현장 확인이 필요합니다.');
console.log('PASS exact user fixture: 7 IDs, five category names/order, all text/spacing/parentheses and item order, 2/2/3-or-4/4/2 counts, independent arrays, no duplicates/empty cards');
