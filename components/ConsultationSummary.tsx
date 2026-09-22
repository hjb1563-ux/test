import type { ConsultationRow } from '../data/bathroom-consultation';
import { builderBathroomSteps } from '../data/bathroom-builder-options';

export function ConsultationCounts({ rows }: { rows: ConsultationRow[] }) {
  const pending = rows.filter(row => row.pending).length;
  return <div className="consultationCounts" aria-label="카테고리별 선택 현황"><span>선택 완료 <b>{rows.length - pending}</b></span><span>미결정 <b>{pending}</b></span><span>현장 확인 <b>{rows.filter(row => row.site).length}</b></span></div>;
}

export default function ConsultationSummary({ rows, onEdit }: { rows: ConsultationRow[]; onEdit?: (step: number) => void }) {
  const pending = rows.filter(row => row.pending);
  const site = rows.filter(row => row.site);
  return <div className="reviewSections">
    <div className="reviewCategoryGrid">{builderBathroomSteps.slice(0, 16).map((step, index) => <section className="reviewCategory" key={step.key}>
      <header><h2><span>{String(index + 1).padStart(2, '0')}</span>{step.title}</h2>{onEdit && <button type="button" aria-label={`${step.title} 수정`} onClick={() => onEdit(index)}>수정 →</button>}</header>
      <dl>{rows.filter(row => row.stepIndex === index).map(row => <div key={row.key} className={row.pending ? 'reviewPending' : undefined}><dt>{row.title}</dt><dd>{row.label}</dd></div>)}</dl>
    </section>)}</div>
    <div className="reviewFollowups">
      <section><h2>아직 결정하지 않은 항목 <small>{pending.length}</small></h2><ul>{pending.map(row => <li key={row.key}><b>{row.title}</b><span>{row.reason}</span></li>)}</ul>{!pending.length && <p>모든 항목을 선택했어요.</p>}</section>
      <section><h2>현장 확인이 필요한 항목 <small>{site.length}</small></h2><ul>{site.map(row => <li key={row.key}><b>{row.title}</b><span>{row.site}</span></li>)}</ul>{!site.length && <p>현장 확인 항목이 없습니다.</p>}</section>
    </div>
  </div>;
}
