'use client';

import { useState } from 'react';
import { hasProjectInfo, normalizeProjectInfo, type ProjectInfo } from '../data/bathroom-consultation';

export default function ProjectInfoForm({ initial, editing, onSave, onCancel }: { initial: ProjectInfo; editing?: boolean; onSave: (info: ProjectInfo) => void; onCancel?: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  return <section className="projectInfoForm">
    <div className="eyebrow">BATHROOM / PROJECT</div>
    <h1>프로젝트 정보</h1>
    <p>이 욕실 상담서를 구분할 정보를 입력해주세요.</p>
    <form onSubmit={event => { event.preventDefault(); const info = normalizeProjectInfo(draft); if (!hasProjectInfo(info)) { setInvalid(true); return; } onSave(info); }}>
      <label htmlFor="project-customer-name">고객명 / 이름</label>
      <input id="project-customer-name" type="text" autoComplete="name" maxLength={40} placeholder="예: 홍길동" value={draft.customerName} aria-describedby={invalid ? 'project-info-validation' : undefined} onChange={event => { setDraft({ ...draft, customerName: event.target.value }); setInvalid(false); }} />
      <label htmlFor="project-name">프로젝트명</label>
      <input id="project-name" type="text" maxLength={80} placeholder="예: 홍길동 고객님 욕실 리모델링" value={draft.projectName} aria-describedby={invalid ? 'project-info-validation' : undefined} onChange={event => { setDraft({ ...draft, projectName: event.target.value }); setInvalid(false); }} />
      {invalid && <p id="project-info-validation" role="status">이름 또는 프로젝트명 중 하나를 입력해주세요.</p>}
      <div className="navButtons">{onCancel && <button type="button" className="secondary" onClick={onCancel}>취소</button>}<button type="submit" className="button">{editing ? '프로젝트 정보 저장' : '욕실 만들기 시작'}</button></div>
    </form>
  </section>;
}
