import { builderBathroomSteps } from './bathroom-builder-options';
import type { BathroomStep, ChoiceGroup } from './bathroom-options';

export type BuilderMode = 'consumer' | 'professional';
type Audience = 'both' | 'professional';
export const builderModes = [
  { id: 'consumer', label: '일반 고객용', description: '디자인과 사용 방식 중심으로 간단하게 선택해요.' },
  { id: 'professional', label: '전문가용', description: '방수·배수·공법 등 기술 항목까지 확인해요.' },
] as const;
export const builderModeLabel = (mode: BuilderMode) => builderModes.find(item => item.id === mode)!.label;

// Presentation metadata only: stable step/group/choice IDs and stored values never change.
const stepPresentation: Record<string, { audience?: Audience; title?: string; question?: string }> = {
  demolition: { title: '현재 욕실 상태', question: '현재 욕실 상태에서 해당되는 항목을 선택해주세요.' },
  layout: { title: '구조와 샤워 공간' },
  waterproofing: { audience: 'professional' },
  drainage: { audience: 'professional' },
  ceiling: { title: '욕실 천장', question: '원하는 천장 형태를 선택해주세요.' },
};
const groupPresentation: Record<string, { audience?: Audience; title?: string; choiceDescriptions?: Record<string, string>; selectionHelp?: { ids: string[]; text: string } }> = {
  demolition: { audience: 'professional' },
  jendai: { title: '욕실 선반벽(젠다이)' },
  niche: { title: '매립 선반(샴푸박스)' },
  grout: { choiceDescriptions: {
    'grout-cement': '기본적인 줄눈 방식',
    'grout-epoxy': '오염 관리와 내구성을 고려한 방식',
    'grout-polyurea': '내오염성과 내구성을 중시하는 방식',
  } },
  faucet: { selectionHelp: { ids: ['concealed'], text: '매립 수전은 벽체와 배관 상태에 따라 시공 가능 여부가 달라질 수 있어요.' } },
  showerFaucet: { selectionHelp: { ids: ['concealed-shower'], text: '매립 수전은 벽체와 배관 상태에 따라 시공 가능 여부가 달라질 수 있어요.' } },
};
export const isVisibleForMode = (audience: Audience | undefined, mode: BuilderMode) => mode === 'professional' || audience !== 'professional';
export function getVisibleSections(step: BathroomStep, mode: BuilderMode): ChoiceGroup[] {
  return step.groups.filter(group => isVisibleForMode(groupPresentation[group.key]?.audience, mode)).map(group => ({
    ...group, title: mode === 'consumer' ? groupPresentation[group.key]?.title ?? group.title : group.title,
  }));
}
export function getVisibleSteps(mode: BuilderMode) {
  return builderBathroomSteps.flatMap((step, stepIndex) => {
    // Retain the legacy stable ID in the catalog; it is no longer a Builder screen.
    if (step.key === 'checklist') return [];
    const display = stepPresentation[step.key];
    return isVisibleForMode(display?.audience, mode) ? [{ ...step, stepIndex,
      title: mode === 'consumer' ? display?.title ?? step.title : step.title,
      question: mode === 'consumer' ? display?.question ?? step.question : step.question,
      groups: getVisibleSections(step, mode),
    }] : [];
  });
}
export function nearestVisibleStep(index: number, mode: BuilderMode): number {
  const visible = getVisibleSteps(mode);
  return (visible.find(step => step.stepIndex >= index) ?? visible[visible.length - 1]).stepIndex;
}
export function getConsumerGroupHelp(key: string) { return groupPresentation[key]; }
