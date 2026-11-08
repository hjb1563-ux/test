const assert=require('node:assert/strict'),path=require('node:path');
const {load}=require('./bathroom-style-draft.cjs');
const s=load(path.resolve('data/bathroom-selection.ts'));
const c=load(path.resolve('data/bathroom-consultation.ts')),m=load(path.resolve('data/bathroom-builder-mode.ts')),d=load(path.resolve('data/bathroom-style-draft.ts'));
const ids=['essential-01','essential-02','balanced-01','balanced-02','balanced-03','premium-01','premium-02'];
for(const mode of ['consumer','professional']){
 const expected=m.getVisibleSteps(mode).flatMap(s=>s.groups.map(g=>g.key));
 for(const id of ids){const v=d.styleDraftValues(id,mode),before=JSON.stringify(v),rows=c.consultationOutputRows(v,mode);assert.deepEqual(rows.map(r=>r.key),expected);assert.equal(new Set(rows.map(r=>r.key)).size,rows.length);for(const r of rows){assert.equal(r.status,r.key==='bathtub'&&s.isBathtubExcluded(v)?'excluded':v[r.key]&&(Array.isArray(v[r.key])?v[r.key].length:true)?'selected':'unselected');assert.ok(r.displayLabel);if(r.status==='unselected')assert.equal(r.displayLabel,'미선택');}assert.equal(JSON.stringify(v),before);const text=c.consultationText(rows,'','',c.normalizeProjectInfo({builderMode:mode}));for(const r of rows)assert.ok(text.includes(r.title+': '+r.displayLabel));assert.ok(!c.consultationSummaryText(c.normalizeProject({projectInfo:{builderMode:mode},values:v})).includes('미선택'));}
 console.log('PASS '+mode+': '+m.getVisibleSteps(mode).length+' STEP / '+expected.length+' groups, all seven examples, exact order, no duplicates, no stored placeholder values');
}
const row=(v,key)=>c.consultationOutputRows(v,'professional').find(r=>r.key===key);
for(const key of ['waterproofing','drainPosition']){assert.equal(row({},key).status,'unselected');assert.equal(row({[key]:'consult'},key).status,'undecided');assert.equal(row({[key]:'consult'},key).displayLabel,'미정');}
for(const [key,value]of [['bathtub','none'],['cabinet','none'],['partitionShower','none'],['jendai',['keep']],['drainPosition','keep']])assert.equal(row({[key]:value},key).status,'selected');
assert.equal(row({sink:'invalid'},'sink').status,'unselected');assert.equal(row({ventilationOther:'Fan model'},'ventilation').status,'selected');assert.equal(row({ventilationOther:' '},'ventilation').status,'unselected');
assert.equal(row({sink:'other'},'sink').status,'selected');assert.equal(row({sink:'other'},'sink').displayLabel,'기타 · 내용 미입력');
assert.equal(row({showerFaucet:['concealed-shower','rain']},'showerFaucet').displayLabel,'매립 샤워&욕조 수전 · 해바라기 샤워 수전');
console.log('PASS missing / explicit consult / none / keep / invalid / free text / incomplete custom / multiple states');
