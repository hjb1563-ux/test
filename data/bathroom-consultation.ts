import { normalizeImageHistoryOrder } from './bathroom-image-history';
import { builderBathroomSteps as steps } from './bathroom-builder-options';
import { customTextKey, normalizeBathroomValues, selectedIds, selectionLabel, type BathroomValues } from './bathroom-selection';

export const STORAGE = 'bath-designer-selections-v2';
export const consultationEditUrl = (stepIndex: number) => `/design?step=${stepIndex + 1}&returnTo=consultation`;
export const phases = [
  { title: '기존 욕실과 기본 공사', start: 0, end: 2 },
  { title: '마감과 주요 욕실 기구', start: 3, end: 7 },
  { title: '설비와 디테일', start: 8, end: 14 },
  { title: '최종 검토', start: 15, end: 15 },
];
export const stepReasons = [
  '기존 타일과 누수 상태에 따라 공사 범위가 달라집니다. 원하는 방향을 고르고 실제 방식은 현장에서 확인하세요.',
  '선반과 공간 구분은 수납과 물튐에 영향을 줍니다. 원하는 공간 구성을 골라보세요.',
  '방수는 물이 새지 않도록 욕실의 바탕을 보호합니다. 기존 상태를 확인한 뒤 업체와 방식을 정해도 괜찮아요.',
  '타일 크기와 색, 표면은 욕실 분위기와 청소 방식에 영향을 줍니다. 마음에 드는 느낌부터 골라보세요.',
  '세면대와 변기 형태는 청소 편의와 공간 사용에 영향을 줍니다. 설치 조건은 업체와 확인하세요.',
  '욕실장과 거울은 필요한 수납량과 아침 준비 습관에 맞춰 고르면 좋아요.',
  '목욕과 샤워 중 자주 쓰는 방식을 떠올려보세요. 욕조 없이 공간을 넓게 쓸 수도 있어요.',
  '천장 형태는 공간의 높이감과 설비 점검 편의에 영향을 줍니다.',
  '수전은 매일 손이 닿는 설비입니다. 사용 편의와 관리 방식을 함께 생각해보세요.',
  '배수구 형태는 청소 방식과 바닥 마감에 영향을 줍니다. 배수 위치와 물이 흐르는 기울기는 현장 확인이 필요해요.',
  '원하는 환풍기 제품명이 있다면 입력해주세요. 설치 조건은 업체와 함께 확인하세요.',
  '조명 위치에 따라 거울을 볼 때의 밝기와 욕실 분위기가 달라집니다.',
  '자주 쓰는 물건의 위치와 금속 색상을 정리하면 사용하기 편한 욕실을 만들 수 있어요.',
  '줄눈은 타일 사이를 마감하는 부분입니다. 청소와 관리 방식을 함께 고려하세요.',
  '문턱 마감은 출입 편의와 물이 바깥으로 흐르는 것을 막는 데 영향을 줍니다.',
  '선택한 내용과 상담할 내용을 나누어 확인하세요. 미결정 항목이 있어도 상담서를 만들 수 있습니다.',
];

export function siteCheck(key: string, values: BathroomValues): string | undefined {
  const group = steps.flatMap(step => step.groups).find(group => group.key === key);
  const ids = selectedIds(values[key]).filter(id => group?.choices.some(choice => choice.id === id));
  const always: Record<string, string> = {
    demolition: '기존 타일 상태와 철거·덧방 범위',
    bathroomCondition: '기존 욕실 손상과 누수 이력',
    waterproofing: '기존 방수 상태와 필요한 방수 범위',
    drain: '배수구 연결과 바닥 구배',
    drainPosition: '배수 위치와 이동 가능 범위',
    threshold: '문턱 높이와 바깥 바닥의 단차',
  };
  if (always[key]) return always[key];
  const structural: Record<string, string> = { jendai: '젠다이와 배관 위치', partitionShower: '파티션·샤워부스 설치 공간과 고정 조건', niche: '샴푸박스 설치 벽체와 방수' };
  if (structural[key] && ids.some(id => !['none', 'consult'].includes(id))) return structural[key];
  if (['faucet', 'showerFaucet'].includes(key) && ids.some(id => id.includes('concealed'))) return '매립 수전 배관과 점검 공간';
  if (key === 'toilet' && ids.includes('wall-hung')) return '벽걸이 변기 지지 구조와 배관';
}

export function consultationRows(values: BathroomValues) {
  return steps.flatMap((step, stepIndex) => step.groups.map(group => {
    const choices = group.choices.filter(choice => selectedIds(values[group.key]).includes(choice.id));
    const reasons = choices.flatMap(choice => {
      const custom = values[customTextKey(group.key)];
      if (choice.requiresCustomText && !(typeof custom === 'string' && custom.trim())) return ['기타 내용 미입력'];
      return [];
    });
    const custom = values[customTextKey(group.key)];
    const hasText = ['accessory', 'ventilation'].includes(group.key) && typeof custom === 'string' && !!custom.trim();
    if (!choices.length && !hasText) reasons.push('미정');
    return { key: group.key, title: group.title, stepTitle: step.title, stepIndex, label: selectionLabel(values, group), choices, pending: reasons.length > 0, reason: Array.from(new Set(reasons)).join(' · '), site: siteCheck(group.key, values) };
  }));
}
export type ConsultationRow = ReturnType<typeof consultationRows>[number];

export type ProjectInfo = { customerName: string; projectName: string };
export function normalizeProjectInfo(input: unknown): ProjectInfo {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return { customerName: typeof raw.customerName === 'string' ? raw.customerName.trim().slice(0, 40) : '', projectName: typeof raw.projectName === 'string' ? raw.projectName.trim().slice(0, 80) : '' };
}
export const hasProjectInfo = (info: ProjectInfo) => !!(info.customerName.trim() || info.projectName.trim());
export const projectLabel = (info: ProjectInfo) => info.projectName || (info.customerName ? `${info.customerName}님의 욕실` : '');
export type LocalProject = { version: 3; projectInfo: ProjectInfo; lastModifiedAt: string | null; values: BathroomValues; specialNotes: string; current: number; memo: string; checks: Record<string, string>; imageHistoryOrder: string[] };
export function normalizeProject(input: unknown): LocalProject {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const current = typeof raw.current === 'number' && Number.isInteger(raw.current) ? raw.current : 0;
  return {
    version: 3,
    projectInfo: normalizeProjectInfo(raw.projectInfo),
    lastModifiedAt: typeof raw.lastModifiedAt === 'string' && Number.isFinite(Date.parse(raw.lastModifiedAt)) ? raw.lastModifiedAt : null,
    values: normalizeBathroomValues(raw.values, steps),
    imageHistoryOrder: normalizeImageHistoryOrder(raw.imageHistoryOrder, normalizeBathroomValues(raw.values, steps)),
    specialNotes: typeof raw.specialNotes === 'string' ? raw.specialNotes.slice(0, 500) : '',
    current: Math.max(0, Math.min(steps.length - 1, raw.version === 3 || current < 5 ? current : current - 1)),
    memo: typeof raw.memo === 'string' ? raw.memo : '',
    checks: raw.checks && typeof raw.checks === 'object' && !Array.isArray(raw.checks) ? Object.fromEntries(Object.entries(raw.checks).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && steps.some(step => step.groups.some(group => group.key === entry[0])))) : {},
  };
}
export function readProject(): LocalProject {
  return normalizeProject(JSON.parse(localStorage.getItem(STORAGE) ?? '{}'));
}

// Navigation and image feedback are not consultation content changes.
export function updateProjectContent(before: LocalProject, patch: Partial<LocalProject>, now = () => new Date().toISOString()): LocalProject {
  const next = { ...before, ...patch };
  const content = (project: LocalProject) => [
    Object.entries(normalizeBathroomValues(project.values, steps)).sort(([a], [b]) => a.localeCompare(b)),
    normalizeProjectInfo(project.projectInfo), project.specialNotes, project.memo,
  ];
  return { ...next, lastModifiedAt: JSON.stringify(content(before)) === JSON.stringify(content(next)) ? before.lastModifiedAt : now() };
}

export function formatLastModified(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === name)?.value;
  return `${part('year')}.${part('month')}.${part('day')} ${part('hour')}:${part('minute')}`;
}

const summaryGroups = [
  { id: 'condition', title: '현재 욕실 상태', keys: ['bathroomCondition'] },
  { id: 'construction', title: '공사 방식 / 구조', keys: ['demolition', 'jendai', 'partitionShower', 'niche', 'waterproofing'] },
  { id: 'tile', title: '타일', keys: ['wallTileSize', 'tile', 'tileSurface'] },
  { id: 'fixtures', title: '주요 위생도기', keys: ['sink', 'toilet', 'cabinet', 'mirror'] },
  { id: 'water', title: '수전 / 샤워 / 욕조', keys: ['faucet', 'showerFaucet', 'bathtub'] },
  { id: 'details', title: '마감 / 디테일', keys: ['ceiling', 'drain', 'drainPosition', 'ventilation', 'lighting', 'accessoryFinish', 'accessory', 'grout', 'threshold'] },
];

export function generateConsultationSummary(values: BathroomValues) {
  const normalized = normalizeBathroomValues(values, steps);
  const groups = steps.flatMap(step => step.groups);
  return summaryGroups.flatMap(summary => {
    const items = summary.keys.flatMap(key => {
      const group = groups.find(item => item.key === key);
      if (!group) return [];
      const draft = normalized[customTextKey(key)];
      const custom = typeof draft === 'string' ? draft.trim() : '';
      if (['accessory', 'ventilation'].includes(key)) return custom ? [custom] : [];
      return selectedIds(normalized[key]).flatMap(id => {
        const choice = group.choices.find(item => item.id === id);
        if (!choice) return [];
        if (choice.requiresCustomText) return custom ? [custom] : [];
        // Short config labels need their category to remain understandable in a summary.
        if (key === 'sink' && choice.id === 'undermount-basin') return ['언더볼 세면대'];
        if (key === 'toilet') return [`${choice.name} 변기`];
        if (choice.name === '없음') return [`${group.title} 없음`];
        return [choice.name];
      });
    });
    const meaningful = items.filter(item => item.trim() && item !== '미정');
    return meaningful.length ? [{ id: summary.id, title: summary.title, items: meaningful, text: meaningful.join(' · ') }] : [];
  });
}

export function consultationSummaryText(project: LocalProject): string {
  const info = project.projectInfo;
  const identity = [info.projectName ? `프로젝트명: ${info.projectName}` : '', info.customerName ? `고객명: ${info.customerName}` : ''].filter(Boolean).join(' · ');
  const summary = generateConsultationSummary(project.values);
  return [identity, ...summary.map(group => `${group.title}: ${group.text}`), ...(project.memo.trim() ? [`\n[업체에 전달할 메모]\n${project.memo.trim()}`] : [])].filter(Boolean).join('\n');
}
// Store the selection fingerprint: changing a choice invalidates its old field check.
export const checkFingerprint = (row: ConsultationRow) => JSON.stringify([row.label, row.site]);
export function consultationText(rows: ConsultationRow[], specialNotes: string, memo: string, projectInfo: ProjectInfo = normalizeProjectInfo(null), lastModifiedAt: string | null = null) {
  const pending = rows.filter(row => row.pending);
  return ['[욕실 리모델링 상담서]', ...(projectInfo.projectName ? [`프로젝트명: ${projectInfo.projectName}`] : []), ...(projectInfo.customerName ? [`고객명: ${projectInfo.customerName}`] : []), ...(formatLastModified(lastModifiedAt) ? [`마지막 수정: ${formatLastModified(lastModifiedAt)}`] : []), `선택 완료 ${rows.length - pending.length}`, '집계 기준: 선택 카테고리 수',
    ...steps.slice(0, -1).map((step, index) => `\n${String(index + 1).padStart(2, '0')} ${step.title}\n${rows.filter(row => row.stepIndex === index).map(row => `${row.title}: ${row.label}`).join('\n')}`),
    '\n업체 실측 후 최종 확인이 필요합니다. 선택 내용은 상담을 위한 희망 사항입니다.',
    ...(specialNotes.trim() ? [`\n[특이사항]\n${specialNotes.trim()}`] : []),
    ...(memo.trim() ? [`\n[업체에 전달할 메모]\n${memo.trim()}`] : []),
  ].join('\n');
}
