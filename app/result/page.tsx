'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SiteHeader from '../../components/SiteHeader';
import { builderBathroomSteps as steps } from '../../data/bathroom-builder-options';
import { normalizeBathroomValues } from '../../data/bathroom-selection';
import { STORAGE, readProject, normalizeProject, consultationRows, consultationText, type LocalProject } from '../../data/bathroom-consultation';

function Content() {
  const params = useSearchParams();
  const [project, setProject] = useState<LocalProject>(() => normalizeProject(null));
  const [ready, setReady] = useState(false);
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
        next = { ...metadata, values, specialNotes: params.has('specialNotes') ? (params.get('specialNotes') ?? '').slice(0, 500) : metadata.specialNotes };
      } catch { setStatus('링크의 선택 내용을 읽지 못해 이 기기에 저장된 상담서를 표시합니다.'); }
    }
    setProject(next); setReady(true);
  }, [params]);

  const rows = consultationRows(project.values);

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
    const text = consultationText(rows, project.specialNotes, project.memo);
    try { await navigator.clipboard.writeText(text); setCopyFallback(''); setStatus('선택 내용을 복사했어요. 업체에 붙여넣어 전달하세요.'); }
    catch { setCopyFallback(text); setStatus('클립보드에 접근할 수 없어요. 아래 내용을 선택해 직접 복사해주세요.'); }
  }

  function edit(step = steps.length) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ ...project, current: step - 1 }));
      window.location.assign(`/design?step=${step}`);
    } catch { setStatus('수정할 내용을 저장하지 못했어요. 먼저 선택 내용을 복사해 보관해주세요.'); }
  }

  if (!ready) return <main className="result">상담서를 불러오는 중입니다.</main>;
  return <main className="consultationPage">
    <div className="printHide"><SiteHeader /></div>
    <article className="result consultationSheet unifiedSheet">
      <header className="sheetHeading"><div className="eyebrow">BATHROOM / CONSULTATION</div><h1>욕실 리모델링 상담서</h1>
        <p>내가 선택한 욕실 구성과 업체에 전달할 내용을 한곳에 정리했어요.</p>
        <p className="sheetCompleted">선택 완료 <b>{rows.filter(row => !row.pending).length}</b><small>카테고리 기준</small></p>
      </header>
      <div className="resultActions printHide" role="group" aria-label="상담서 작업"><button className="button" onClick={copy}>선택 내용 복사</button><button className="secondary" onClick={() => window.print()}>인쇄 / PDF 저장</button><button className="secondary" onClick={() => edit()}>선택 수정</button></div>
      <p className="printHide consultationNote" role="status">{status}</p>
      {copyFallback && <label className="copyFallback printHide">복사할 상담 내용<textarea readOnly value={copyFallback} onFocus={event => event.currentTarget.select()} /></label>}
      <section className="sheetSelections"><h2>STEP별 선택 내용</h2>
        <div className="sheetColumns">{[0, 8].map(start => <div className="sheetColumn" key={start}>{steps.slice(0, -1).slice(start, start + 8).map((step, offset) => { const index = start + offset; return <section className="sheetStep" key={step.key}><header><h3><span>{String(index + 1).padStart(2, '0')}</span> {step.title}</h3><button className="printHide resumeLink" aria-label={`${step.title} 수정`} onClick={() => edit(index + 1)}>수정</button></header>
          <dl>{rows.filter(row => row.stepIndex === index).map(row => <div className={`sheetRow${row.pending ? ' sheetRow--pending' : ''}`} key={row.key}><dt>{row.title}</dt><dd><strong>{row.choices.length && !row.choices.some(choice => choice.requiresCustomText) ? row.choices.map(choice => choice.name).join(' · ') : row.label}</strong><div className="rowStatus">{row.pending && <span>{row.reason}</span>}</div>
          </dd></div>)}</dl></section>; })}</div>)}</div>
      </section>
      <section className="sheetMemo"><h2><label htmlFor="consultation-memo">업체에 전달할 메모</label> <small>선택 입력</small></h2><textarea id="consultation-memo" className="printHide" value={project.memo} placeholder="예: 청소가 쉬웠으면 좋겠어요. 아이와 함께 사용하는 욕실입니다." onChange={event => updateMetadata({ memo: event.target.value })} /><p className="printOnly memoPrint">{project.memo || '별도 메모 없음'}</p><small className="printHide" role="status">{saveStatus}</small></section>
      {project.specialNotes.trim() && <section className="sheetMemo"><h2>특이사항</h2><p className="memoPrint" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{project.specialNotes}</p></section>}
      <p className="sheetFootnote">이 상담서는 고객의 희망 사항을 정리한 자료입니다. 실제 시공 가능 여부와 세부 사양은 업체 실측 후 확인해주세요.</p>
      <Link href="/design" className="printHide resumeLink">내 욕실 만들기로 돌아가기</Link>
    </article>
  </main>;
}

export default function Result() { return <Suspense fallback={<main className="result">상담서를 불러오는 중입니다.</main>}><Content /></Suspense>; }
