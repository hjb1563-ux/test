export type BathroomStyleExample = {
  id: string; title: string; description: string;
  image: { src: string; alt: string; width: number; height: number } | null;
  spaces: string[]; tiles: string[]; fixtures: string[]; accessories: string[]; notes: string[];
};
export type BathroomStyle = {
  id: string; title: string; subtitle: string; description: string;
  examples: BathroomStyleExample[];
};

// Static references only; these records never supply project selections.
// Image paths retain the uploaded filenames. Audit: docs/BATHROOM_STYLE_IMAGE_INVENTORY.json.
const image = (folder: string, filename: string, width: number, height: number, alt: string, version?: string) => ({
  src: `/images/bathroom-styles/${folder}/${filename}${version ? `?v=${version}` : ''}`, width, height, alt,
});
const specificationNote = '타일의 정확한 규격·재질, 방수 공법과 배관 상태는 사진만으로 확정하지 않습니다.';

export const bathroomStyles: BathroomStyle[] = [
  {
    id: 'essential', title: '실속형', subtitle: '필수 구성 중심',
    description: '기존 구조를 최대한 활용하고 필요한 설비 중심으로 구성한 욕실',
    examples: [{
      id: 'essential-01', title: '실속형 01', description: '유리 파티션으로 샤워 공간을 구분한 일반 세면대 구성',
      image: image('essential', '실속형 욕실 사진1 (유리파티션).png', 1446, 1087, '유리 파티션, 벽걸이 세면대와 바닥 설치형 변기가 있는 실속형 욕실', '6dcc0f12b49c'),
      spaces: ['샤워 공간 유리 파티션', '세면대 뒤 선반벽(젠다이)'],
      tiles: ['밝은 회색 무늬 벽 타일', '회색 바닥 타일'],
      fixtures: ['벽걸이형 일반 세면대와 상판 설치형 세면 수전', '물탱크가 보이는 바닥 설치형 변기', '노출형 샤워 수전과 핸드 샤워', '거울장과 하부 간접조명', '천장 매립조명과 환기구'],
      accessories: ['샤워 선반', '출입문 옆 휴지걸이'],
      notes: ['기존 구조나 배관의 재사용 가능 여부는 현장 확인이 필요합니다.', specificationNote],
    }, {
      id: 'essential-02', title: '실속형 02', description: '일반 욕조와 벽걸이 세면대를 함께 배치한 구성',
      image: image('essential', '실속형 욕실 사진2 (욕조).png', 1449, 1085, '일반 욕조, 벽걸이 세면대, 물탱크형 변기와 거울장이 있는 실속형 욕실', '08a544e2a487'),
      spaces: ['일반 욕조', '세면대 뒤 선반벽(젠다이)'],
      tiles: ['밝은 회색 벽 타일', '짙은 회색 바닥 타일', '욕조 측면 타일 마감'],
      fixtures: ['벽걸이형 일반 세면대와 상판 설치형 세면 수전', '물탱크가 보이는 바닥 설치형 변기', '욕조 위 노출형 샤워 수전과 핸드 샤워', '거울장과 하부 간접조명', '천장 매립조명과 환기구'],
      accessories: ['샤워 선반', '출입문 옆 휴지걸이'],
      notes: ['사진에 유리 욕조 파티션은 보이지 않습니다.', specificationNote],
    }],
  },
  {
    id: 'balanced', title: '기본형', subtitle: '디자인과 실용성의 균형',
    description: '공간 활용과 디자인, 사용 편의성을 고르게 고려한 욕실',
    examples: [{
      id: 'balanced-01', title: '기본형 01', description: '타일 마감 풀 파티션으로 샤워 공간을 나눈 구성',
      image: image('balanced', '기본형 욕실 사진 1 (풀 파티션).png', 1445, 1089, '천장까지 이어지는 타일 파티션과 일반 세면대, 거울장을 갖춘 기본형 욕실', '20f0db9bddd5'),
      spaces: ['풀 파티션(천장까지 이어지는 타일 마감 벽체)', '세면대 뒤 선반벽(젠다이)'],
      tiles: ['밝은 회색 무늬 벽·바닥 타일', '파티션 타일 마감'],
      fixtures: ['벽걸이형 일반 세면대와 상판 설치형 세면 수전', '물탱크가 보이는 바닥 설치형 변기', '노출형 샤워 수전과 핸드 샤워', '거울장과 하부 간접조명', '천장 매립조명'],
      accessories: ['샤워 코너 선반'],
      notes: ['사진의 풀 파티션은 유리가 아닌 타일 마감 벽체입니다.', specificationNote],
    }, {
      id: 'balanced-02', title: '기본형 02', description: '하프 파티션 위 유리와 벽걸이 세면대를 갖춘 구성',
      image: image('balanced', '기본형 욕실 사진 2 (하프 파티션).png', 1448, 1086, '하프 벽체 위 유리 파티션, 벽걸이 세면대와 거울장이 있는 기본형 욕실', 'd1f2235539f7'),
      spaces: ['하프 파티션(낮은 타일 벽체와 상부 유리)', '세면대 뒤 선반벽(젠다이)'],
      tiles: ['밝은 회색 무늬 벽·바닥 타일', '파티션 타일 마감'],
      fixtures: ['벽걸이형 일반 세면대와 상판 설치형 세면 수전', '물탱크가 보이는 바닥 설치형 변기', '노출형 샤워 수전과 핸드 샤워', '거울장과 하부 간접조명', '천장 매립조명'],
      accessories: ['샤워 선반'],
      notes: ['사진에서 보이는 형태와 배치만 안내하며 실제 시공 가능 여부는 현장 확인이 필요합니다.', specificationNote],
    }, {
      id: 'balanced-03', title: '기본형 03', description: '일반 욕조와 선반벽, 거울장을 함께 배치한 구성',
      image: image('balanced', '기본형 욕실 사진 3(욕조).png', 1450, 1085, '일반 욕조와 벽걸이 세면대, 선반벽과 거울장을 갖춘 기본형 욕실', 'c80f3c3cebcd'),
      spaces: ['일반 욕조', '세면대 뒤 선반벽(젠다이)'],
      tiles: ['밝은 회색 무늬 벽·바닥 타일', '욕조 측면 타일 마감'],
      fixtures: ['벽걸이형 일반 세면대와 상판 설치형 세면 수전', '물탱크가 보이는 바닥 설치형 변기', '욕조 위 노출형 샤워 수전과 핸드 샤워', '거울장과 하부 간접조명', '천장 매립조명'],
      accessories: ['샤워 선반'],
      notes: ['사진에 유리 파티션이나 니치는 보이지 않습니다.', specificationNote],
    }],
  },
  {
    id: 'premium', title: '프리미엄', subtitle: '공간 디테일과 마감 중심',
    description: '고급스러운 마감과 설비 디테일을 강조한 욕실',
    examples: [{
      id: 'premium-01', title: '프리미엄 01', description: '풀 파티션과 언더볼 세면대, 조명 니치를 갖춘 구성',
      image: image('premium', '프리미엄 욕실1 (풀 파티션).png', 1448, 1086, '타일 풀 파티션, 언더볼 세면대, 해바라기 샤워와 조명 니치가 있는 프리미엄 욕실', 'cffb619db78d'),
      spaces: ['풀 파티션(천장까지 이어지는 타일 마감 벽체)', '세면대 뒤 선반벽(젠다이)', '샤워 공간 벽면 니치'],
      tiles: ['베이지색 무늬 벽·바닥 타일', '파티션과 세면 상판의 유사 색상 마감'],
      fixtures: ['언더볼 세면대와 벽면 설치형 세면 수전', '바닥 설치형 변기', '노출형 샤워 수전·해바라기 샤워·핸드 샤워', '세면대 하부 개방형 수납', '거울장과 하부 간접조명', '천장 매립조명과 니치 간접조명'],
      accessories: ['니치 수납 공간'],
      notes: ['사진상 파티션은 타일 마감 벽체이며, 욕조나 유리 파티션은 보이지 않습니다.', specificationNote],
    }, {
      id: 'premium-02', title: '프리미엄 02', description: '하프 파티션 위 유리와 탑볼 세면대, 간접조명을 갖춘 구성',
      image: image('premium', '프리미엄 욕실2 (하프 파티션).png', 1421, 1107, '하프 벽체 위 유리 파티션, 탑볼 세면대, 거울장과 조명 니치가 있는 프리미엄 욕실', '186be17fc707'),
      spaces: ['하프 파티션(낮은 타일 벽체와 상부 유리)', '세면대 뒤 선반벽(젠다이)', '샤워 공간 벽면 니치'],
      tiles: ['베이지색 무늬 벽·바닥 타일', '파티션과 세면 상판의 유사 색상 마감'],
      fixtures: ['탑볼 세면대와 벽면 설치형 세면 수전', '바닥 설치형 변기', '노출형 샤워 수전과 핸드 샤워', '세면대 하부 개방형 수납', '거울장과 하부 간접조명', '천장 매립조명과 니치 간접조명'],
      accessories: ['세면대 전면 수건걸이', '니치 수납 공간'],
      notes: [specificationNote],
    }],
  },
];
