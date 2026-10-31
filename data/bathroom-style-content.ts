// Display-only copy confirmed by the user on 2026-10-31. This specification
// supersedes earlier photo-based labels; it never changes builder selections.
// Original example records, image mappings and project selections remain separate.
export type BathroomStyleContent = {
  tiles?: string[];
  basinsAndToilets?: string[];
  faucetsAndShowers?: string[];
  storageAndAccessories?: string[];
  features?: string[];
};

export const bathroomStyleCategories = [
  { key: 'tiles', title: '타일' },
  { key: 'basinsAndToilets', title: '세면대 · 변기' },
  { key: 'faucetsAndShowers', title: '수전 · 샤워' },
  { key: 'storageAndAccessories', title: '수납 · 액세서리' },
  { key: 'features', title: '이 욕실의 특징' },
] as const;

export const bathroomStyleNotice = '사진은 구성 참고용이며, 실제 시공 사양은 현장 확인이 필요합니다.';

export function bathroomStyleContentGroups(content: BathroomStyleContent = {}) {
  return bathroomStyleCategories.flatMap(category => {
    const items = content[category.key]?.filter(item => item.trim());
    return items?.length ? [{ ...category, items }] : [];
  });
}

type ProductCategory = Exclude<keyof BathroomStyleContent, 'features' | 'tiles'>;

export const bathroomStyleProducts = {
  'basin-wall': { category: 'basinsAndToilets', label: '일반 세면대' },
  'basin-undermount': { category: 'basinsAndToilets', label: '언더볼 세면대' },
  'basin-vessel': { category: 'basinsAndToilets', label: '탑볼 세면대' },
  'toilet-one-piece': { category: 'basinsAndToilets', label: '원피스 변기(일체형)' },
  'toilet-two-piece': { category: 'basinsAndToilets', label: '투피스 변기(물탱크 분리형)' },
  'toilet-integrated-bidet': { category: 'basinsAndToilets', label: '비데형 변기' },
  'faucet-standard': { category: 'faucetsAndShowers', label: '일반 세면 수전' },
  'faucet-concealed': { category: 'faucetsAndShowers', label: '매립 세면 수전' },
  'shower-standard': { category: 'faucetsAndShowers', label: '일반 샤워 수전' },
  'shower-concealed': { category: 'faucetsAndShowers', label: '매립 샤워 수전' },
  'shower-overhead': { category: 'faucetsAndShowers', label: '해바라기 샤워 수전' },
  'shower-hand': { category: 'faucetsAndShowers', label: '핸드 샤워' },
  'mirror-lit': { category: 'storageAndAccessories', label: '거울장(하부 간접 조명)' },
  'shelf-corner': { category: 'storageAndAccessories', label: '샤워 코너 선반' },
  'paper-holder': { category: 'storageAndAccessories', label: '휴지걸이' },
  'towel-holder': { category: 'storageAndAccessories', label: '수건걸이' },
  'paper-holder-spaced': { category: 'storageAndAccessories', label: '휴지 걸이' },
  'towel-holder-spaced': { category: 'storageAndAccessories', label: '수건 걸이' },
  'shampoo-niche': { category: 'storageAndAccessories', label: '샴푸박스(니치)' },
} as const satisfies Record<string, { category: ProductCategory; label: string }>;

export type BathroomStyleProductId = keyof typeof bathroomStyleProducts;

// These are independent preview-only product lists, in the user's exact order.
// Deliberate spacing variants have distinct IDs rather than normalizing copy.
export const bathroomStyleProductIds: Record<string, readonly BathroomStyleProductId[]> = {
  'essential-01': ['basin-wall', 'toilet-two-piece', 'faucet-standard', 'shower-standard', 'shower-hand', 'mirror-lit', 'shelf-corner', 'paper-holder', 'towel-holder'],
  'essential-02': ['basin-wall', 'toilet-two-piece', 'faucet-standard', 'shower-standard', 'shower-hand', 'mirror-lit', 'shelf-corner', 'paper-holder', 'towel-holder'],
  'balanced-01': ['basin-wall', 'toilet-two-piece', 'faucet-standard', 'shower-standard', 'shower-hand', 'mirror-lit', 'shelf-corner', 'paper-holder', 'towel-holder'],
  'balanced-02': ['basin-wall', 'toilet-two-piece', 'faucet-standard', 'shower-standard', 'shower-hand', 'mirror-lit', 'shelf-corner', 'paper-holder', 'towel-holder'],
  'balanced-03': ['basin-wall', 'toilet-two-piece', 'faucet-standard', 'shower-standard', 'shower-hand', 'mirror-lit', 'shelf-corner', 'paper-holder-spaced', 'towel-holder-spaced'],
  'premium-01': ['basin-undermount', 'toilet-integrated-bidet', 'faucet-concealed', 'shower-concealed', 'shower-overhead', 'shower-hand', 'mirror-lit', 'shampoo-niche', 'paper-holder', 'towel-holder'],
  'premium-02': ['basin-vessel', 'toilet-integrated-bidet', 'faucet-concealed', 'shower-concealed', 'shower-overhead', 'shower-hand', 'mirror-lit', 'shampoo-niche', 'paper-holder', 'towel-holder'],
};

const bathroomStyleTiles: Record<string, string[]> = {
  'essential-01': ['300x600', '아이보리 / 무광'],
  'essential-02': ['300x600', '그레이 / 유광'],
  'balanced-01': ['600x600', '아이보리 / 무광'],
  'balanced-02': ['600x600', '그레이 / 무광'],
  'balanced-03': ['600x600', '다크 / 무광'],
  'premium-01': ['600x1200', '다크 / 무광'],
  'premium-02': ['600x600', '화이트 / 유광'],
};

const bathroomStyleFeatures: Record<string, string[]> = {
  'essential-01': ['유리 파티션으로 구분한 샤워 공간', '세면대 뒤 선반벽(젠다이)'],
  'essential-02': ['일반 욕조', '세면대 뒤 선반벽(젠다이)'],
  'balanced-01': ['타일 풀(full) 파티션으로 샤워 공간 분리', '세면대 뒤 선반벽(젠다이)'],
  'balanced-02': ['타일 하프(half) 파티션으로 개방감 있는 샤워 공간 분리', '세면대 뒤 선반벽(젠다이)'],
  'balanced-03': ['일반 욕조', '세면대 뒤 선반 벽(젠다이)'],
  'premium-01': ['타일 풀(full) 파티션', '세면대 뒤 선반 벽(젠다이)'],
  'premium-02': ['타일 하프(half) 파티션으로 개방감 있는 샤워 공간 분리', '세면대 뒤 선반 벽(젠다이)'],
};

// Keep the existing renderer contract; these IDs never affect builder choices.
export const bathroomStyleContent: Partial<Record<string, BathroomStyleContent>> = Object.fromEntries(
  Object.entries(bathroomStyleProductIds).map(([exampleId, productIds]) => {
    const content: BathroomStyleContent = { tiles: bathroomStyleTiles[exampleId], features: bathroomStyleFeatures[exampleId] };
    for (const productId of productIds) {
      const product = bathroomStyleProducts[productId];
      (content[product.category] ??= []).push(product.label);
    }
    return [exampleId, content];
  }),
);
