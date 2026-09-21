'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '../../components/SiteHeader';
import BuilderOptionImage from '../../components/BuilderOptionImage';
import { ConsultationCounts } from '../../components/ConsultationSummary';
import { builderBathroomSteps as steps } from '../../data/bathroom-builder-options';
import { normalizeBathroomValues } from '../../data/bathroom-selection';
import { STORAGE, readProject, normalizeProject, consultationRows, consultationText, checkFingerprint, type LocalProject } from '../../data/bathroom-consultation';

function Content() {
  const params = useSearchParams();
  const [project, setProject] = useState<LocalProject>(() => normalizeProject(null));
  const [ready, setReady] = useState(false);
  const [contractor, setContractor] = useState(false);
  const [status, setStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  const [metadataKey, setMetadataKey] = useState(STORAGE);

  useEffect(() => {
    let saved = normalizeProject(null);
    try { saved = readProject(); } catch { setSaveStatus('저장된 내용을 불러오지 못했어요.'); }
    let next = saved;
    if (params.has('plan')) {
      try {
        const source = params.get('plan')!;
        let parsed: unknown;
        try { parsed = JSON.parse(source); } catch { parsed = JSON.parse(decodeURIComponent(source)); }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid plan');
        const values = normalizeBathroomValues(parsed, steps);
        const same = JSON.stringify(values) === JSON.stringify(saved.values);
        const key = same ? STORAGE : `bath-designer-report-v1:${JSON.stringify(values)}`;
        setMetadataKey(key);
        let metadata = same ? saved : normalizeProject(null);
        if (!same) { try { metadata = normalizeProject(JSON.parse(localStorage.getItem(key) ?? '{}')); } catch {} }
        next = { ...metadata, values, priorities: params.has('priorities') ? (params.get('priorities') ?? '').split('|').filter(Boolean).slice(0, 3) : metadata.priorities };
      } catch { setStatus('링크의 선택 내용을 읽지 못해 이 기기에 저장된 상담서를 표시합니다.'); }
    }
    setProject(next); setReady(true);
  }, [params]);

  const rows = consultationRows(project.values);
  const pending = rows.filter(row => row.pending);
  const site = rows.filter(row => row.site);

  function updateMetadata(patch: Partial<Pick<LocalProject, 'memo' | 'checks'>>) {
    const next = { ...project, ...patch };
    setProject(next);
    try {
      const base = metadataKey === STORAGE ? readProject() : next;
      localStorage.setItem(metadataKey, JSON.stringify({ ...base, ...patch }));
      setSaveStatus('자동 저장됨');
    } catch { setSaveStatus('자동 저장할 수 없어요. 복사 또는 인쇄로 보관해주세요.'); }
  }

  async function copy() {
    const text = consultationText(rows, project.priorities, project.memo);
    try { await navigator.clipboard.writeText(text); setCopyFallback(''); setStatus('선택 내용을 복사했어요. 업체에 붙여넣어 전달하세요.'); }
    catch { setCopyFallback(text); setStatus('클립보드에 접근할 수 없어요. 아래 내용을 선택해 직접 복사해주세요.'); }
  }

  function edit(step = 17) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ ...project, current: step - 1 }));
      window.location.assign(`/design?step=${step}`);
    } catch { setStatus('수정할 내용을 저장하지 못했어요. 먼저 선택 내용을 복사해 보관해주세요.'); }
  }

  if (!ready) return <main className="result">상담서를 불러오는 중입니다.</main>;
  return <main className="consultationPage">
    <div className="printHide"><SiteHeader /></div>
    <article className={`result consultationSheet${contractor ? ' contractorSheet' : ''}`}>
      <header className="sheetHeading"><div className="eyebrow">{contractor ? 'PROJECT / CLIENT SELECTION' : 'MY BATHROOM / CONSULTATION'}</div><h1>욕실 리모델링 상담서</h1>
        <p>{contractor ? '고객 희망 사항 · 상담 및 현장 확인용' : '내가 원하는 욕실과 업체에 물어볼 내용을 한곳에 정리했어요.'}</p>
        <ConsultationCounts rows={rows} />
        <p className="consultationNote">카테고리 기준 집계 · 현장 확인은 선택 완료·미결정 항목과 겹칠 수 있습니다.</p>
      </header>
      <div className="resultActions printHide"><button className="button" onClick={copy}>선택 내용 복사</button><button className="secondary" onClick={() => window.print()}>인쇄 / PDF 저장</button><button className="secondary" aria-pressed={contractor} onClick={() => setContractor(!contractor)}>{contractor ? '소비자용 보기' : '업체 전달용 보기'}</button><button className="secondary" onClick={() => edit()}>선택 수정</button></div>
      <p className="printHide consultationNote" role="status">{status}</p>
      {copyFallback && <label className="copyFallback printHide">복사할 상담 내용<textarea readOnly value={copyFallback} onFocus={event => event.currentTarget.select()} /></label>}
      <div className="sheetOverview">
        <section><h2>아직 결정하지 않은 항목 <small>{pending.length}</small></h2><p>상담하며 편하게 정해도 괜찮아요.</p>{pending.length ? <ul>{pending.map(row => <li key={row.key}><b>{row.title}</b><span>{row.reason}</span></li>)}</ul> : <p>모든 카테고리의 선택을 정리했어요.</p>}</section>
        <section><h2>현장에서 확인해주세요 <small>{site.length}</small></h2><p>업체 실측 후 최종 확인이 필요합니다.</p><ul>{site.map(row => <li key={row.key}><span aria-hidden="true">□</span><span>{row.site}</span></li>)}</ul></section>
      </div>
      <section className="sheetMemo"><h2><label htmlFor="consultation-memo">업체에 전달할 메모</label> <small>선택 입력</small></h2><textarea id="consultation-memo" className="printHide" value={project.memo} placeholder="예: 청소가 쉬웠으면 좋겠어요. 아이와 함께 사용하는 욕실입니다." onChange={event => updateMetadata({ memo: event.target.value })} /><p className="printOnly memoPrint">{project.memo || '별도 메모 없음'}</p><small className="printHide" role="status">{saveStatus}</small></section>
      {project.priorities.length > 0 && <p className="sheetPriorities"><b>중요하게 생각하는 것</b> {project.priorities.join(' · ')}</p>}
      <section className="sheetSelections"><h2>{contractor ? 'CLIENT SELECTION / 선택 사양' : 'STEP별 선택 내용'}</h2><p className="consultationNote">사진은 이해를 돕는 참고 이미지이며 실제 제품 모델이나 최종 시공 결과를 확정하지 않습니다.</p>
        {steps.slice(0, 16).map((step, index) => <section className="sheetStep" key={step.key}><header><h3><span>{String(index + 1).padStart(2, '0')}</span> {step.title}</h3><button className="printHide resumeLink" onClick={() => edit(index + 1)}>수정</button></header>
          <dl>{rows.filter(row => row.stepIndex === index).map(row => <div className="sheetRow" key={row.key}><dt>{row.title}</dt><dd><strong>{row.label}</strong><div className="rowStatus"><span>{row.pending ? `미결정 · ${row.reason}` : '선택 완료'}</span>{row.site && <span className="siteBadge">현장 확인 필요</span>}</div>{row.site && <p>{row.site}</p>}{!contractor && row.choices.some(choice => choice.showBuilderImage) && <div className="sheetImages">{row.choices.filter(choice => choice.showBuilderImage).map(choice => <figure key={choice.id}><BuilderOptionImage option={choice} alt={`${choice.name} 참고 이미지`} /><figcaption>{choice.name} · 참고 이미지</figcaption></figure>)}</div>}
            {contractor && <label className="fieldCheck"><input type="checkbox" checked={project.checks[row.key] === checkFingerprint(row)} onChange={event => updateMetadata({ checks: { ...project.checks, [row.key]: event.target.checked ? checkFingerprint(row) : '' } })} /> 현장 확인 기록</label>}
          </dd></div>)}</dl></section>)}
      </section>
      <p className="sheetFootnote">이 상담서는 고객의 희망 사항을 정리한 자료입니다. 실제 시공 가능 여부와 세부 사양은 업체 실측 후 확인해주세요. 현장 확인 기록은 이 브라우저에만 저장됩니다.</p>
      <Link href="/design" className="printHide resumeLink">내 욕실 만들기로 돌아가기</Link>
    </article>
  </main>;
}

export default function Result() { return <Suspense fallback={<main className="result">상담서를 불러오는 중입니다.</main>}><Content /></Suspense>; }
