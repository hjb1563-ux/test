import { bathroomSteps, type BathroomStep, type Choice } from './bathroom-options';
import generatedImages from './bathroom-builder-image-settings.generated.json';

const imageSettings: Record<string, { builderImage: string | null; showBuilderImage: boolean }> = generatedImages;

// Builder and consultation options; shared guide data stays intact.
const textOnlyGroups = new Set(['drainPosition', 'ventilation', 'grout']);
const noBathtub: Choice = {
  id: 'none', name: '욕조 없음', sub: '', image: '',
  builderImage: null, showBuilderImage: false,
};

const sourceGroups = bathroomSteps.flatMap(step => step.groups);
const toiletGroups = bathroomSteps.find(step => step.key === 'toilet')!.groups;
const showerBooth = sourceGroups.find(group => group.key === 'showerBooth')!;
const partitionLabels: Record<string, string> = {
  'full-partition': '풀 파티션',
  'fixed-glass': '고정 유리형 샤워부스',
  'door-booth': '도어형 샤워부스',
};

const builderSteps: BathroomStep[] = bathroomSteps.filter(step => step.key !== 'toilet').map(source => {
  const step = source.key === 'basin' ? { ...source, title: '세면대 & 변기', question: '세면대와 변기 형태를 각각 골라보세요.', groups: [...source.groups, ...toiletGroups] } : source;
  return {
    ...step,
    title: step.key === 'lighting' ? '조명' : step.key === 'checklist' ? '최종 검토' : step.title,
    groups: step.groups.filter(group => !['floorTileSize', 'window', 'concealed', 'showerBooth'].includes(group.key)).map(group => {
      if (group.key === 'jendai') return { ...group, multiple: true, choices: ['none', 'keep', 'remove', 'new'].flatMap(id => group.choices.filter(choice => choice.id === id)) };
      if (group.key === 'showerFaucet') return { ...group, multiple: false, choices: group.choices.map(choice => ({
        ...choice, name: choice.id === 'shower' ? '일반 샤워&욕조 수전' : choice.id === 'concealed-shower' ? '매립 샤워&욕조 수전' : choice.name,
      })) };
      if (group.key === 'partition') {
        return { ...group, key: 'partitionShower', title: '파티션 & 샤워부스', multiple: false,
          choices: [...group.choices, ...showerBooth.choices.filter(choice => !['none', 'undecided'].includes(choice.id))]
            .map(choice => ({ ...choice, name: partitionLabels[choice.id] ?? choice.name })) };
      }
      if (group.key === 'accessory') return { ...group, multiple: false, choices: [] };
      if (group.key === 'sink' || group.key === 'toilet') return { ...group, choices: group.choices.map(choice => ({ ...choice, name: choice.id === 'undermount-basin' ? '언더볼' : choice.id === 'wall-hung' ? '벽걸이' : choice.name })) };
      if (group.key === 'wallTileSize') return { ...group, title: '벽 & 바닥 타일 크기' };
      if (group.key === 'bathtub') return { ...group, choices: [noBathtub, ...group.choices] };
      if (textOnlyGroups.has(group.key)) return {
        ...group,
        choices: group.choices.map(choice => ({ ...choice, showBuilderImage: false })),
      };
      return group;
    }),
  };
});

export const builderBathroomSteps: BathroomStep[] = builderSteps.map(step => ({
  ...step,
  groups: step.groups.map(group => ({
    ...group,
    choices: group.choices
      .filter(choice => !/^(undecided|notSure|unknown(?:-condition)?)$/i.test(choice.id) && !/모르겠/.test(choice.name))
      .map(choice => ({ ...choice, ...imageSettings[`${group.key}:${choice.id}`] })),
  })),
}));
