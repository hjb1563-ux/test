'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, CircleHelp, RotateCcw } from 'lucide-react';
import BathroomPreview from './BathroomPreview';
import DesignVisualStyles from './DesignVisualStyles';
import { bathroomSteps, defaultBathroomValues, selectedChoice } from '../data/bathroom-options';

export default function Configurator() {
  const [current, setCurrent] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(defaultBathroomValues);
  const step = bathroomSteps[current];
  const selections = useMemo(() => Object.fromEntries(bathroomSteps.map(item => [item.key, selectedChoice(values, item.key)])), [values]);
  const budget = 260 + Object.entries(values).reduce((sum, [key, value]) => sum + (bathroomSteps.find(item => item.key === key)?.choices.find(choice => choice.name === value)?.impact ?? 0), 0);
  return <main className="design"><DesignVisualStyles /><header className="designHeader"><Link href="/" className="brand">BATH <i>DESIGNER</i></Link><span>나의 욕실 설계</span><button onClick={() => { setValues(defaultBathroomValues); setCurrent(0); }}><RotateCcw size={15} /> 처음부터</button></header><div className="progress"><div style={{ width: `${((current + 1) / bathroomSteps.length) * 100}%` }} /></div><div className="designGrid"><section className="options"><div className="stepMeta">STEP {String(current + 1).padStart(2, '0')} / {bathroomSteps.length} <span>{step.title}</span></div><h1>{step.question}<button className="help" aria-label="도움말"><CircleHelp size={17} /></button></h1><p className="stepIntro">옵션을 고르면 미리보기와 예상 예산에 바로 반영됩니다.</p><div className="choiceGrid">{step.choices.map(choice => <button key={choice.id} onClick={() => setValues(previous => ({ ...previous, [step.key]: choice.name }))} className={`choice ${values[step.key] === choice.name ? 'selected' : ''}`}><img src={choice.image} alt="" /><div className="choiceCopy"><span className="check"><Check size={14} /></span><strong>{choice.name}</strong><small>{choice.sub}</small><em>{choice.impact === 0 ? '기본 구성' : `약 +${choice.impact}만원`}</em>{values[step.key] === choice.name && <mark>✓ 선택됨</mark>}</div></button>)}</div><div className="notice">실제 시공 전에는 현장 실측과 상태 확인이 필요합니다.</div><div className="navButtons"><button className="secondary" disabled={current === 0} onClick={() => setCurrent(index => index - 1)}><ArrowLeft size={17} /> 이전</button>{current < bathroomSteps.length - 1 ? <button className="button" onClick={() => setCurrent(index => index + 1)}>다음 <ArrowRight size={17} /></button> : <Link href={{ pathname: '/result', query: values }} className="button">설계안 완성 <ArrowRight size={17} /></Link>}</div></section><aside className="live"><BathroomPreview selections={selections} /></aside><aside className="summary"><h2>현재 선택</h2>{bathroomSteps.slice(0, current + 1).map(item => <div className="summaryRow" key={item.key}><span>{item.title}</span><b>{values[item.key]}</b></div>)}<div className="budget"><span>예상 예산 범위</span><strong>{budget}~{budget + 70}만원</strong><small>현장 상태와 제품 사양에 따라 달라질 수 있어요.</small></div></aside></div></main>;
}
