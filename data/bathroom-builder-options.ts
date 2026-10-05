import { bathroomSteps, type BathroomStep, type Choice } from './bathroom-options';
import generatedImages from './bathroom-builder-image-settings.generated.json';

const imageSettings: Record<string, { builderImage: string | null; showBuilderImage: boolean }> = generatedImages;

// Builder and consultation options; shared guide data stays intact.
const textOnlyGroups = new Set(['drainPosition']);
const textChoice = (id: string, name: string, requiresCustomText = false): Choice => ({
  id, name, sub: '', image: '', builderImage: null, showBuilderImage: false, requiresCustomText,
});
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
    title: step.key === 'ventilation' ? '환풍기' : step.key === 'lighting' ? '조명' : step.key === 'checklist' ? '최종 검토' : step.title,
    question: step.key === 'ventilation' ? '원하는 환풍기 제품명을 입력해주세요.' : step.question,
    groups: step.groups.filter(group => !['floorTileSize', 'window', 'concealed', 'showerBooth'].includes(group.key)).map(group => {
      if (group.key === 'bathroomCondition') return { ...group, choices: [
        textChoice('damaged-tile', '기존타일이 깨졌거나 들떠 있다'),
        ...group.choices.filter(choice => !['cracked', 'loose'].includes(choice.id)).map(choice => ({
          ...choice, name: choice.id === 'leak' ? '누수 이력이 있다' : choice.id === 'remove-bath' ? '욕조를 철거하고 싶다' : choice.name,
        })),
        textChoice('other', '기타', true),
      ] };
      if (group.key === 'niche') return { ...group, title: '샴푸박스', choices: [
        ...group.choices.map(choice => ({ ...choice, name: choice.name.replace('니치', '샴푸박스') })),
        textChoice('partition-niche', '파티션 샴푸박스'),
      ] };
      if (group.key === 'waterproofing') return { ...group, choices: group.choices.filter(choice => choice.id !== 'liquid-waterproofing') };
      if (group.key === 'cabinet') return { ...group, choices: group.choices.map(choice =>
        choice.id === 'led-cabinet' ? textChoice('standard-cabinet', '일반 거울장') : choice) };
      if (group.key === 'ventilation') return { ...group, title: '환풍기', multiple: false, choices: [] };
      if (group.key === 'faucet') return { ...group, choices: group.choices.map(choice => ({
        ...choice, name: choice.id === 'one-hole' ? '일반 세면 수전' : choice.name,
      })) };
      if (group.key === 'grout') return { ...group, choices: group.choices.map(choice =>
        choice.id === 'grout-elastic' ? textChoice('grout-polyurea', '폴리우레아 줄눈')
          : { ...choice, name: choice.id === 'grout-cement' ? '시멘트 줄눈(메지)' : choice.name }) };
      if (group.key === 'jendai') return { ...group, multiple: true, choices: ['none', 'keep', 'remove', 'new'].flatMap(id => group.choices.filter(choice => choice.id === id)) };
      if (group.key === 'showerFaucet') return { ...group, multiple: true, choices: [
        ...group.choices.filter(choice => choice.id === 'shower').map(choice => ({ ...choice, name: '일반 샤워&욕조 수전' })),
        ...group.choices.filter(choice => choice.id === 'concealed-shower').map(choice => ({ ...choice, name: '매립 샤워&욕조 수전' })),
        textChoice('rain', '해바라기 샤워 수전'),
        textChoice('other', '기타', true),
      ] };
      if (group.key === 'partition') {
        return { ...group, key: 'partitionShower', title: '파티션 & 샤워부스', multiple: false,
          choices: [...group.choices, ...showerBooth.choices.filter(choice => !['none', 'undecided'].includes(choice.id))]
            .map(choice => ({ ...choice, name: partitionLabels[choice.id] ?? choice.name })) };
      }
      if (group.key === 'accessoryFinish') return { ...group, choices: group.choices.map(choice => ({
        ...choice, name: choice.id === 'chrome' ? '크롬(유광)' : choice.id === 'nickel' ? '니켈(무광)' : choice.name,
      })) };
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
      .map(choice => choice.id === 'other' ? { ...choice, builderImage: null, showBuilderImage: false } : { ...choice, ...imageSettings[`${group.key}:${choice.id}`] }),
  })),
}));
