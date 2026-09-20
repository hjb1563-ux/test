'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, RotateCcw, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import BuilderChoiceGroup from './BuilderChoiceGroup';
import { customTextKey, normalizeBathroomValues, selectionLabel, toggleSelection, type BathroomValues } from '../data/bathroom-selection';
import BuilderOptionImage from './BuilderOptionImage';
import SelectedOptionGallery from './SelectedOptionGallery';
import DesignVisualStyles from './DesignVisualStyles';
import { defaultBathroomValues } from '../data/bathroom-options';
import { builderBathroomSteps as bathroomSteps } from '../data/bathroom-builder-options';
import { guideBySlug } from '../data/guides/catalog';

type Values = BathroomValues;
const STORAGE = 'bath-designer-selections-v2';
const prioritiesList = ['디자인', '청소 편의', '수납', '공간감', '관리 편의', '물튐 방지', '반신욕', '샤워 편의', '아이와 사용', '오래 사용하기', '호텔 같은 분위기', '밝은 분위기'];

function querySelections(params: URLSearchParams): Values {
  const selected: Values = {};
  bathroomSteps.forEach((step) => step.groups.forEach((group) => {
    const query = params.get(group.key);
    if (!query) return;
    const choice = group.choices.find((item) => item.id === query || item.name === query);
    if (choice) selected[group.key] = group.multiple ? [choice.id] : choice.id;
  }));
  return selected;
}

export default function Configurator() {
  const params = useSearchParams();
  const guideValues = useMemo(() => querySelections(params), [params]);
  const [current, setCurrent] = useState(0);
  const [values, setValues] = useState<Values>(defaultBathroomValues);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const step = bathroomSteps[current];
  const guide = guideBySlug[step.guide];
  const selectedItems = step.groups.flatMap((group) => { const value = values[group.key]; const ids = Array.isArray(value) ? value : value ? [value] : []; return ids.map((id) => ({ title: group.title, choice: group.choices.find((choice) => choice.id === id)! })).filter((item) => item.choice); });

  useEffect(() => {
    let saved: { values?: unknown; priorities?: unknown } = {};
    try { const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed; } catch {}
    setValues(normalizeBathroomValues({ ...normalizeBathroomValues(saved.values, bathroomSteps), ...guideValues }, bathroomSteps));
    setPriorities(Array.isArray(saved.priorities) ? saved.priorities.filter((item): item is string => typeof item === 'string') : []);
    setHydrated(true);
  }, [guideValues]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE, JSON.stringify({ values, priorities })); } catch {}
  }, [values, priorities, hydrated]);

  useEffect(() => {
    setValues((old) => {
      const concealed = Array.isArray(old.concealed) ? old.concealed : [];
      const next = { ...old };
      if (concealed.includes('concealed-basin') && !next.faucet) next.faucet = 'concealed';
      if (concealed.includes('concealed-shower') && !next.showerFaucet) next.showerFaucet = ['concealed-shower'];
      return next;
    });
  }, [values.concealed]);

  function update(key: string, id: string, multiple?: boolean) {
    setValues(old => toggleSelection(old, key, id, multiple));
  }

  const warning = values.sink === 'top-bowl' && values.faucet === 'one-hole'
    ? '볼 세면대와 낮은 수전의 높이 조합을 확인하세요.'
    : values.partition === 'full-partition' && values.showerBooth && values.showerBooth !== 'none'
        ? '샤워부스와 전체 파티션을 함께 사용할 계획인지 확인해보세요.' : '';

  if (step.key === 'checklist') return <main className="design">
    <DesignVisualStyles />
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>나의 욕실 정리</span></header>
    <div className="progress"><div style={{ width: '100%' }} /></div>
    <div className="designGrid finalGrid">
      <section className="options finalCheck">
        <div className="stepMeta">STEP 17 / 17 <span>시공 전 최종 체크</span></div>
        <h1>원하는 욕실이 맞는지 마지막으로 확인해보세요.</h1>
        {bathroomSteps.slice(0, 16).map((item, index) => <div className="checkRow" key={item.key}><div><span>{String(index + 1).padStart(2, '0')} {item.title}</span><b>{item.groups.map((group) => selectionLabel(values, group)).filter((item) => item !== '미정').join(' · ') || '미정 — 업체와 상담할 항목'}</b></div><button className="secondary" onClick={() => setCurrent(index)}>수정</button></div>)}
        <h2>내 우선순위 (최대 3개)</h2>
        <div className="priorityList">{prioritiesList.map((item) => <button key={item} className={priorities.includes(item) ? 'on' : ''} onClick={() => setPriorities((old) => old.includes(item) ? old.filter((value) => value !== item) : old.length < 3 ? [...old, item] : old)}>{item}</button>)}</div>
        <Link className="button" href={{ pathname: '/result', query: { plan: encodeURIComponent(JSON.stringify(values)), priorities: priorities.join('|') } }}>상담 준비서 보기 <ArrowRight size={17} /></Link>
      </section>
      <aside className="live"><SelectedOptionGallery items={bathroomSteps.slice(0,16).flatMap((item)=>item.groups.flatMap((group)=>{const value=values[group.key];const ids=Array.isArray(value)?value:value?[value]:[];return ids.map(id=>({title:item.title,choice:group.choices.find(choice=>choice.id===id)!})).filter(item=>item.choice)}))} /></aside>
    </div>
  </main>;

  return <main className="design">
    <DesignVisualStyles />
    <header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>내 욕실 만들기</span><button onClick={() => { localStorage.removeItem(STORAGE); setValues({}); setPriorities([]); setCurrent(0); }}><RotateCcw size={15} /> 처음부터</button></header>
    <div className="progress"><div style={{ width: `${((current + 1) / bathroomSteps.length) * 100}%` }} /></div>
    <div className="designGrid">
      <section className="options">
        <div className="stepMeta">STEP {String(current + 1).padStart(2, '0')} / 17 <span>{step.title}</span></div>
        <div className="stepHeading"><h1>{step.question}</h1><button className="guideButton" onClick={() => setGuideOpen(true)}><BookOpen size={15} /> 가이드 보기</button></div>
        <p className="stepIntro">모르는 항목은 ‘아직 모르겠어요’로 남겨도 괜찮습니다.</p>
        {step.groups.map(group => <BuilderChoiceGroup key={group.key} group={group} values={values} onSelect={update} onCustomText={(key, text) => setValues(old => ({ ...old, [customTextKey(key)]: text }))} />)}
        {warning && <div className="selectionWarning"><AlertTriangle size={16} /><div>{warning}<small>확인이 필요한 조합입니다. 실제 시공 가능 여부는 현장에서 확인하세요.</small></div></div>}
        <div className="navButtons"><button className="secondary" disabled={current === 0} onClick={() => setCurrent((index) => index - 1)}><ArrowLeft size={17} /> 이전</button><button className="secondary" onClick={() => setCurrent((index) => Math.min(16, index + 1))}>건너뛰기</button><button className="button" onClick={() => setCurrent((index) => Math.min(16, index + 1))}>선택 완료 <ArrowRight size={17} /></button></div>
      </section>
      <aside className="live"><SelectedOptionGallery items={selectedItems} empty="이 단계에서 선택한 항목이 사진과 함께 표시됩니다." /><section className="summary"><h2>현재 선택</h2>{bathroomSteps.slice(0, current + 1).flatMap((item) => item.groups.map((group) => { const value=values[group.key]; const first=group.choices.find(choice=>choice.id===(Array.isArray(value)?value[0]:value)); return <div className="summaryRow" key={group.key}>{first?.showBuilderImage&&<BuilderOptionImage option={first} />}<div><span>{group.title}</span><b style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{selectionLabel(values, group)}</b></div></div> }))}</section></aside>
    </div>
    {guideOpen && <div className="guideDrawer" role="dialog" aria-modal="true"><div><button className="drawerClose" onClick={() => setGuideOpen(false)} aria-label="가이드 닫기"><X size={18} /></button><span>GUIDE</span><h2>{guide?.title}</h2><p>{guide?.oneLine}</p>{guide?.options.slice(0, 3).map((option) => <article key={option.id}><b>{option.title}</b><p>{option.shortDescription}</p></article>)}<Link className="button" href={`/guide/${step.guide}`}>전체 가이드 보기</Link></div></div>}
  </main>;
}
