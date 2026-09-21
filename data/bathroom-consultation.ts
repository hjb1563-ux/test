import { builderBathroomSteps as steps } from './bathroom-builder-options';
import { customTextKey, normalizeBathroomValues, selectedIds, selectionLabel, type BathroomValues } from './bathroom-selection';

export const STORAGE = 'bath-designer-selections-v2';
export const phases = [
  { title: '기존 욕실과 기본 공사', start: 0, end: 2 },
  { title: '마감과 주요 욕실 기구', start: 3, end: 8 },
  { title: '설비와 디테일', start: 9, end: 15 },
  { title: '최종 검토', start: 16, end: 16 },
];
export const stepReasons = [
  '기존 타일과 누수 상태에 따라 공사 범위가 달라집니다. 원하는 방향을 고르고 실제 방식은 현장에서 확인하세요.',
  '선반과 공간 구분은 수납과 물튐에 영향을 줍니다. 벽 안에 넣는 설비는 공간과 배관 확인이 필요해요.',
  '방수는 물이 새지 않도록 욕실의 바탕을 보호합니다. 기존 상태를 확인한 뒤 업체와 방식을 정해도 괜찮아요.',
  '타일 크기와 색, 표면은 욕실 분위기와 청소 방식에 영향을 줍니다. 마음에 드는 느낌부터 골라보세요.',
  '세면대 형태에 따라 물튐과 청소, 수납 방식이 달라집니다.',
  '변기 형태는 청소 편의와 공간 사용에 영향을 줍니다. 설치 조건은 업체와 확인하세요.',
  '욕실장과 거울은 필요한 수납량과 아침 준비 습관에 맞춰 고르면 좋아요.',
  '목욕과 샤워 중 자주 쓰는 방식을 떠올려보세요. 욕조 없이 공간을 넓게 쓸 수도 있어요.',
  '천장 형태는 공간의 높이감과 설비 점검 편의에 영향을 줍니다.',
  '수전은 매일 손이 닿는 설비입니다. 사용 편의와 관리 방식을 함께 생각해보세요.',
  '배수구 형태는 청소 방식과 바닥 마감에 영향을 줍니다. 배수 위치와 물이 흐르는 기울기는 현장 확인이 필요해요.',
  '환기와 건조는 습기 관리에 도움이 됩니다. 평소 욕실을 쓰는 방식에 맞춰 골라보세요.',
  '조명 위치에 따라 거울을 볼 때의 밝기와 욕실 분위기가 달라집니다.',
  '자주 쓰는 물건의 위치와 금속 색상을 정리하면 사용하기 편한 욕실을 만들 수 있어요.',
  '줄눈은 타일 사이를 마감하는 부분입니다. 청소와 관리 방식을 함께 고려하세요.',
  '문턱 마감은 출입 편의와 물이 바깥으로 흐르는 것을 막는 데 영향을 줍니다.',
  '선택한 내용과 상담할 내용을 나누어 확인하세요. 미결정 항목이 있어도 상담서를 만들 수 있습니다.',
];

export function siteCheck(key: string, values: BathroomValues): string | undefined {
  const ids = selectedIds(values[key]);
  const always: Record<string, string> = {
    demolition: '기존 타일 상태와 철거·덧방 범위',
    bathroomCondition: '기존 욕실 손상과 누수 이력',
    waterproofing: '기존 방수 상태와 필요한 방수 범위',
    drain: '배수구 연결과 바닥 구배',
    drainPosition: '배수 위치와 이동 가능 범위',
    threshold: '문턱 높이와 바깥 바닥의 단차',
  };
  if (always[key]) return always[key];
  const structural: Record<string, string> = { jendai: '젠다이와 배관 위치', partition: '파티션 설치 공간과 고정 조건', showerBooth: '샤워부스 치수와 출입 공간', niche: '니치 설치 벽체와 방수', concealed: '매립 설비 공간과 점검 방법' };
  if (structural[key] && ids.some(id => !['none', 'undecided', 'consult'].includes(id))) return structural[key];
  if (['faucet', 'showerFaucet'].includes(key) && ids.some(id => id.includes('concealed'))) return '매립 수전 배관과 점검 공간';
  if (key === 'toilet' && ids.includes('wall-hung')) return '벽걸이 변기 지지 구조와 배관';
}

export function consultationRows(values: BathroomValues) {
  return steps.flatMap((step, stepIndex) => step.groups.map(group => {
    const choices = group.choices.filter(choice => selectedIds(values[group.key]).includes(choice.id));
    const reasons = choices.flatMap(choice => {
      if (choice.id === 'consult') return ['상담 후 결정'];
      if (choice.id === 'undecided' || /모르겠/.test(choice.name)) return ['아직 모르겠어요'];
      const custom = values[customTextKey(group.key)];
      if (choice.requiresCustomText && !(typeof custom === 'string' && custom.trim())) return ['기타 내용 미입력'];
      return [];
    });
    if (!choices.length) reasons.push('선택하지 않음');
    return { key: group.key, title: group.title, stepTitle: step.title, stepIndex, label: selectionLabel(values, group), choices, pending: reasons.length > 0, reason: Array.from(new Set(reasons)).join(' · '), site: siteCheck(group.key, values) };
  }));
}
export type ConsultationRow = ReturnType<typeof consultationRows>[number];

export type LocalProject = { values: BathroomValues; priorities: string[]; current: number; memo: string; checks: Record<string, string> };
export function normalizeProject(input: unknown): LocalProject {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  return {
    values: normalizeBathroomValues(raw.values, steps),
    priorities: Array.isArray(raw.priorities) ? raw.priorities.filter((v): v is string => typeof v === 'string').slice(0, 3) : [],
    current: typeof raw.current === 'number' && Number.isInteger(raw.current) ? Math.max(0, Math.min(16, raw.current)) : 0,
    memo: typeof raw.memo === 'string' ? raw.memo : '',
    checks: raw.checks && typeof raw.checks === 'object' && !Array.isArray(raw.checks) ? Object.fromEntries(Object.entries(raw.checks).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {},
  };
}
export function readProject(): LocalProject {
  return normalizeProject(JSON.parse(localStorage.getItem(STORAGE) ?? '{}'));
}
// Store the selection fingerprint: changing a choice invalidates its old field check.
export const checkFingerprint = (row: ConsultationRow) => JSON.stringify([row.label, row.site]);
export function consultationText(rows: ConsultationRow[], priorities: string[], memo: string) {
  const pending = rows.filter(row => row.pending);
  const site = rows.filter(row => row.site);
  return ['[욕실 리모델링 상담 내용]', `선택 완료 ${rows.length - pending.length} · 미결정 ${pending.length} · 현장 확인 ${site.length}`, '집계 기준: 선택 카테고리 수',
    ...steps.slice(0, 16).map((step, index) => `\n${String(index + 1).padStart(2, '0')} ${step.title}\n${rows.filter(row => row.stepIndex === index).map(row => `${row.title}: ${row.label}${row.pending ? ` [미결정: ${row.reason}]` : ''}${row.site ? ' [현장 확인 필요]' : ''}`).join('\n')}`),
    '\n아직 결정하지 않은 항목', ...pending.map(row => `${row.title}: ${row.reason} (${row.label})`), ...(pending.length ? [] : ['없음']),
    '\n현장에서 확인해주세요', ...site.map(row => `□ ${row.title}: ${row.site}`),
    '\n업체 실측 후 최종 확인이 필요합니다. 선택 내용은 상담을 위한 희망 사항입니다.',
    `\n우선순위: ${priorities.join(' · ') || '미입력'}`, `\n업체에 전달할 메모\n${memo.trim() || '미입력'}`,
  ].join('\n');
}
