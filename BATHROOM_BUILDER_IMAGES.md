# 욕실 만들기 이미지 교체 방법

사진 파일만 추가하거나 덮어쓰면 됩니다. 코드를 수정할 필요가 없습니다.

1. 아래 목록에서 옵션의 파일 위치를 찾습니다.
2. 실제 JPG 사진을 해당 파일명으로 저장합니다. 확장자만 바꾸지 말고 JPG 형식으로 내보내세요.
3. 프로젝트의 해당 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.
4. 웹페이지를 새로고침합니다. 이전 사진이 남으면 **Ctrl + Shift + R**로 강력 새로고침합니다.

권장 크기: **1600 × 1000** 또는 **1200 × 750**. 다른 크기도 기존 카드 안에 잘라 맞춰 표시됩니다.

사진이 없으면 `public/images/bathroom-builder/fallback/placeholder.svg`가 표시됩니다. `.gitkeep`은 폴더 유지용입니다. 기존 `placeholder.jpg`는 새 시스템에서 사용하지 않습니다.

하나의 파일 교체가 왼쪽 선택 카드, 중앙 선택한 욕실 요소, 지금까지 선택한 항목, 오른쪽 현재 선택에 함께 반영됩니다. 선택은 ID로 저장되므로 저장된 선택도 최신 파일을 사용합니다. 메인과 가이드 이미지는 공유하지 않습니다. 배포된 사이트에는 변경한 사진 파일도 다시 배포해야 합니다.

## 기존 옵션과 요청 목록의 차이

기존 니치와 창문은 각각 `structure/niche/`, `tile/window/`를 사용합니다. 기존 샤워 옵션은 오버헤드가 아닌 **핸드 샤워**이므로 `faucet/shower/hand-shower.jpg`를 사용합니다. `overhead.jpg`는 현재 연결할 옵션 ID가 없어 사용하지 않습니다. 옵션 ID와 선택 기능을 유지하기 위해 새 옵션을 추가하거나 핸드 샤워를 다른 종류로 바꾸지 않았습니다.

현재 욕실 상태의 “현재 상태를 잘 모르겠어요”와 “아직 모르겠어요”는 `condition-unknown.jpg`를 함께 사용합니다. STEP 17은 최종 확인 단계라 별도의 사진이 없습니다.

## 폴더 구조

```text
public/images/bathroom-builder/
  demolition/
  structure/{jendai,partition,shower-booth,embedded,niche}/
  waterproofing/
  tile/{wall,floor,tone,finish,window}/
  basin/
  toilet/
  cabinet/
  bathtub/
  ceiling/
  faucet/{basin,shower}/
  drainage/
  ventilation/
  lighting/
  accessories/
  grout/
  threshold/
  fallback/placeholder.svg
```

## 전체 옵션별 파일 위치

### STEP 1 · 시공 방식

#### 덧방

화면 표시명: 덧방

옵션 ID: `demolition: overlay`

파일 위치: `public/images/bathroom-builder/demolition/overlay.jpg`

교체 방법: 새 사진의 이름을 `overlay.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 부분 철거 + 덧방

화면 표시명: 부분 철거 + 덧방

옵션 ID: `demolition: partial-demolition-overlay`

파일 위치: `public/images/bathroom-builder/demolition/partial-demolition-overlay.jpg`

교체 방법: 새 사진의 이름을 `partial-demolition-overlay.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 전체 철거

화면 표시명: 전체 철거

옵션 ID: `demolition: full-demolition`

파일 위치: `public/images/bathroom-builder/demolition/full-demolition.jpg`

교체 방법: 새 사진의 이름을 `full-demolition.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `demolition: undecided`

파일 위치: `public/images/bathroom-builder/demolition/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 1 · 현재 욕실 상태

#### 기존 타일이 깨져 있어요

화면 표시명: 기존 타일이 깨져 있어요

옵션 ID: `bathroomCondition: cracked`

파일 위치: `public/images/bathroom-builder/demolition/tile-cracked.jpg`

교체 방법: 새 사진의 이름을 `tile-cracked.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 기존 타일이 들떠 있어요

화면 표시명: 기존 타일이 들떠 있어요

옵션 ID: `bathroomCondition: loose`

파일 위치: `public/images/bathroom-builder/demolition/tile-hollow.jpg`

교체 방법: 새 사진의 이름을 `tile-hollow.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 누수 이력이 있어요

화면 표시명: 누수 이력이 있어요

옵션 ID: `bathroomCondition: leak`

파일 위치: `public/images/bathroom-builder/demolition/leak-history.jpg`

교체 방법: 새 사진의 이름을 `leak-history.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 욕조를 철거하고 싶어요

화면 표시명: 욕조를 철거하고 싶어요

옵션 ID: `bathroomCondition: remove-bath`

파일 위치: `public/images/bathroom-builder/demolition/remove-bathtub.jpg`

교체 방법: 새 사진의 이름을 `remove-bathtub.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 현재 상태를 잘 모르겠어요

화면 표시명: 현재 상태를 잘 모르겠어요

옵션 ID: `bathroomCondition: unknown-condition`

파일 위치: `public/images/bathroom-builder/demolition/condition-unknown.jpg`

교체 방법: 새 사진의 이름을 `condition-unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `bathroomCondition: undecided`

파일 위치: `public/images/bathroom-builder/demolition/condition-unknown.jpg`

교체 방법: 새 사진의 이름을 `condition-unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 2 · 젠다이

#### 없음

화면 표시명: 없음

옵션 ID: `jendai: none`

파일 위치: `public/images/bathroom-builder/structure/jendai/none.jpg`

교체 방법: 새 사진의 이름을 `none.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 기존 젠다이 유지

화면 표시명: 기존 젠다이 유지

옵션 ID: `jendai: keep`

파일 위치: `public/images/bathroom-builder/structure/jendai/keep.jpg`

교체 방법: 새 사진의 이름을 `keep.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 젠다이 신설

화면 표시명: 젠다이 신설

옵션 ID: `jendai: new`

파일 위치: `public/images/bathroom-builder/structure/jendai/new.jpg`

교체 방법: 새 사진의 이름을 `new.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 기존 젠다이 철거

화면 표시명: 기존 젠다이 철거

옵션 ID: `jendai: remove`

파일 위치: `public/images/bathroom-builder/structure/jendai/remove.jpg`

교체 방법: 새 사진의 이름을 `remove.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 세면대 젠다이

화면 표시명: 세면대 젠다이

옵션 ID: `jendai: sink-ledger`

파일 위치: `public/images/bathroom-builder/structure/jendai/basin-jendai.jpg`

교체 방법: 새 사진의 이름을 `basin-jendai.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 변기 젠다이

화면 표시명: 변기 젠다이

옵션 ID: `jendai: toilet-ledger`

파일 위치: `public/images/bathroom-builder/structure/jendai/toilet-jendai.jpg`

교체 방법: 새 사진의 이름을 `toilet-jendai.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 샤워공간 젠다이

화면 표시명: 샤워공간 젠다이

옵션 ID: `jendai: shower-ledger`

파일 위치: `public/images/bathroom-builder/structure/jendai/shower-jendai.jpg`

교체 방법: 새 사진의 이름을 `shower-jendai.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `jendai: undecided`

파일 위치: `public/images/bathroom-builder/structure/jendai/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 2 · 파티션

#### 없음

화면 표시명: 없음

옵션 ID: `partition: none`

파일 위치: `public/images/bathroom-builder/structure/partition/none.jpg`

교체 방법: 새 사진의 이름을 `none.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 하프 파티션

화면 표시명: 하프 파티션

옵션 ID: `partition: half-partition`

파일 위치: `public/images/bathroom-builder/structure/partition/half-partition.jpg`

교체 방법: 새 사진의 이름을 `half-partition.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 전체 파티션

화면 표시명: 전체 파티션

옵션 ID: `partition: full-partition`

파일 위치: `public/images/bathroom-builder/structure/partition/full-partition.jpg`

교체 방법: 새 사진의 이름을 `full-partition.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `partition: undecided`

파일 위치: `public/images/bathroom-builder/structure/partition/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 2 · 샤워부스

#### 없음

화면 표시명: 없음

옵션 ID: `showerBooth: none`

파일 위치: `public/images/bathroom-builder/structure/shower-booth/none.jpg`

교체 방법: 새 사진의 이름을 `none.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 고정 유리

화면 표시명: 고정 유리

옵션 ID: `showerBooth: fixed-glass`

파일 위치: `public/images/bathroom-builder/structure/shower-booth/fixed-glass.jpg`

교체 방법: 새 사진의 이름을 `fixed-glass.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 도어형

화면 표시명: 도어형

옵션 ID: `showerBooth: door-booth`

파일 위치: `public/images/bathroom-builder/structure/shower-booth/door.jpg`

교체 방법: 새 사진의 이름을 `door.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `showerBooth: undecided`

파일 위치: `public/images/bathroom-builder/structure/shower-booth/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 2 · 니치

#### 없음

화면 표시명: 없음

옵션 ID: `niche: none`

파일 위치: `public/images/bathroom-builder/structure/niche/none.jpg`

교체 방법: 새 사진의 이름을 `none.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 샤워 니치

화면 표시명: 샤워 니치

옵션 ID: `niche: shower-niche`

파일 위치: `public/images/bathroom-builder/structure/niche/shower-niche.jpg`

교체 방법: 새 사진의 이름을 `shower-niche.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 세면대 니치

화면 표시명: 세면대 니치

옵션 ID: `niche: sink-niche`

파일 위치: `public/images/bathroom-builder/structure/niche/sink-niche.jpg`

교체 방법: 새 사진의 이름을 `sink-niche.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 일반 벽면 니치

화면 표시명: 일반 벽면 니치

옵션 ID: `niche: wall-niche`

파일 위치: `public/images/bathroom-builder/structure/niche/wall-niche.jpg`

교체 방법: 새 사진의 이름을 `wall-niche.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `niche: undecided`

파일 위치: `public/images/bathroom-builder/structure/niche/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 2 · 매립 설비

#### 매립 세면 수전

화면 표시명: 매립 세면 수전

옵션 ID: `concealed: concealed-basin`

파일 위치: `public/images/bathroom-builder/structure/embedded/basin-faucet.jpg`

교체 방법: 새 사진의 이름을 `basin-faucet.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 매립 샤워 수전

화면 표시명: 매립 샤워 수전

옵션 ID: `concealed: concealed-shower`

파일 위치: `public/images/bathroom-builder/structure/embedded/shower-faucet.jpg`

교체 방법: 새 사진의 이름을 `shower-faucet.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 매립 욕조 수전

화면 표시명: 매립 욕조 수전

옵션 ID: `concealed: concealed-bath`

파일 위치: `public/images/bathroom-builder/structure/embedded/bathtub-faucet.jpg`

교체 방법: 새 사진의 이름을 `bathtub-faucet.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 매립 휴지걸이

화면 표시명: 매립 휴지걸이

옵션 ID: `concealed: concealed-paper`

파일 위치: `public/images/bathroom-builder/structure/embedded/toilet-paper-holder.jpg`

교체 방법: 새 사진의 이름을 `toilet-paper-holder.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 사용하지 않음

화면 표시명: 사용하지 않음

옵션 ID: `concealed: none`

파일 위치: `public/images/bathroom-builder/structure/embedded/none.jpg`

교체 방법: 새 사진의 이름을 `none.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `concealed: undecided`

파일 위치: `public/images/bathroom-builder/structure/embedded/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 3 · 방수 방식

#### 액방

화면 표시명: 액방

옵션 ID: `waterproofing: liquid-waterproofing`

파일 위치: `public/images/bathroom-builder/waterproofing/liquid.jpg`

교체 방법: 새 사진의 이름을 `liquid.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 도막 방수

화면 표시명: 도막 방수

옵션 ID: `waterproofing: coating-waterproofing`

파일 위치: `public/images/bathroom-builder/waterproofing/coating.jpg`

교체 방법: 새 사진의 이름을 `coating.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 액방 + 도막

화면 표시명: 액방 + 도막

옵션 ID: `waterproofing: combined-waterproofing`

파일 위치: `public/images/bathroom-builder/waterproofing/liquid-plus-coating.jpg`

교체 방법: 새 사진의 이름을 `liquid-plus-coating.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 업체와 상담 후 결정

화면 표시명: 업체와 상담 후 결정

옵션 ID: `waterproofing: consult`

파일 위치: `public/images/bathroom-builder/waterproofing/consult.jpg`

교체 방법: 새 사진의 이름을 `consult.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `waterproofing: undecided`

파일 위치: `public/images/bathroom-builder/waterproofing/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 4 · 벽 타일 크기

#### 300×600

화면 표시명: 300×600

옵션 ID: `wallTileSize: 300x600`

파일 위치: `public/images/bathroom-builder/tile/wall/300x600.jpg`

교체 방법: 새 사진의 이름을 `300x600.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 600×600

화면 표시명: 600×600

옵션 ID: `wallTileSize: 600x600`

파일 위치: `public/images/bathroom-builder/tile/wall/600x600.jpg`

교체 방법: 새 사진의 이름을 `600x600.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 600×1200

화면 표시명: 600×1200

옵션 ID: `wallTileSize: 600x1200`

파일 위치: `public/images/bathroom-builder/tile/wall/600x1200.jpg`

교체 방법: 새 사진의 이름을 `600x1200.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 기타 타일

화면 표시명: 기타 타일

옵션 ID: `wallTileSize: other`

파일 위치: `public/images/bathroom-builder/tile/wall/other.jpg`

교체 방법: 새 사진의 이름을 `other.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `wallTileSize: undecided`

파일 위치: `public/images/bathroom-builder/tile/wall/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 4 · 바닥 타일 크기

#### 300×600

화면 표시명: 300×600

옵션 ID: `floorTileSize: 300x600`

파일 위치: `public/images/bathroom-builder/tile/floor/300x600.jpg`

교체 방법: 새 사진의 이름을 `300x600.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 600×600

화면 표시명: 600×600

옵션 ID: `floorTileSize: 600x600`

파일 위치: `public/images/bathroom-builder/tile/floor/600x600.jpg`

교체 방법: 새 사진의 이름을 `600x600.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 600×1200

화면 표시명: 600×1200

옵션 ID: `floorTileSize: 600x1200`

파일 위치: `public/images/bathroom-builder/tile/floor/600x1200.jpg`

교체 방법: 새 사진의 이름을 `600x1200.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 기타 타일

화면 표시명: 기타 타일

옵션 ID: `floorTileSize: other`

파일 위치: `public/images/bathroom-builder/tile/floor/other.jpg`

교체 방법: 새 사진의 이름을 `other.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `floorTileSize: undecided`

파일 위치: `public/images/bathroom-builder/tile/floor/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 4 · 타일 분위기

#### 화이트

화면 표시명: 화이트

옵션 ID: `tile: white`

파일 위치: `public/images/bathroom-builder/tile/tone/white.jpg`

교체 방법: 새 사진의 이름을 `white.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아이보리

화면 표시명: 아이보리

옵션 ID: `tile: ivory`

파일 위치: `public/images/bathroom-builder/tile/tone/ivory.jpg`

교체 방법: 새 사진의 이름을 `ivory.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 그레이

화면 표시명: 그레이

옵션 ID: `tile: gray`

파일 위치: `public/images/bathroom-builder/tile/tone/gray.jpg`

교체 방법: 새 사진의 이름을 `gray.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 다크

화면 표시명: 다크

옵션 ID: `tile: dark`

파일 위치: `public/images/bathroom-builder/tile/tone/dark.jpg`

교체 방법: 새 사진의 이름을 `dark.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `tile: undecided`

파일 위치: `public/images/bathroom-builder/tile/tone/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 4 · 표면

#### 무광

화면 표시명: 무광

옵션 ID: `tileSurface: matte`

파일 위치: `public/images/bathroom-builder/tile/finish/matte.jpg`

교체 방법: 새 사진의 이름을 `matte.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 유광

화면 표시명: 유광

옵션 ID: `tileSurface: glossy`

파일 위치: `public/images/bathroom-builder/tile/finish/glossy.jpg`

교체 방법: 새 사진의 이름을 `glossy.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `tileSurface: undecided`

파일 위치: `public/images/bathroom-builder/tile/finish/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 4 · 욕실 창문

#### 있음

화면 표시명: 있음

옵션 ID: `window: yes`

파일 위치: `public/images/bathroom-builder/tile/window/yes.jpg`

교체 방법: 새 사진의 이름을 `yes.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 없음

화면 표시명: 없음

옵션 ID: `window: no`

파일 위치: `public/images/bathroom-builder/tile/window/no.jpg`

교체 방법: 새 사진의 이름을 `no.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `window: undecided`

파일 위치: `public/images/bathroom-builder/tile/window/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 5 · 세면대

#### 일반 세면대

화면 표시명: 일반 세면대

옵션 ID: `sink: vanity-basin`

파일 위치: `public/images/bathroom-builder/basin/standard.jpg`

교체 방법: 새 사진의 이름을 `standard.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 탑볼 세면대

화면 표시명: 탑볼 세면대

옵션 ID: `sink: top-bowl`

파일 위치: `public/images/bathroom-builder/basin/top-bowl.jpg`

교체 방법: 새 사진의 이름을 `top-bowl.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 언더볼 세면대

화면 표시명: 언더볼 세면대

옵션 ID: `sink: undermount-basin`

파일 위치: `public/images/bathroom-builder/basin/undermount.jpg`

교체 방법: 새 사진의 이름을 `undermount.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `sink: undecided`

파일 위치: `public/images/bathroom-builder/basin/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 6 · 변기

#### 원피스

화면 표시명: 원피스

옵션 ID: `toilet: one-piece`

파일 위치: `public/images/bathroom-builder/toilet/one-piece.jpg`

교체 방법: 새 사진의 이름을 `one-piece.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 투피스

화면 표시명: 투피스

옵션 ID: `toilet: two-piece`

파일 위치: `public/images/bathroom-builder/toilet/two-piece.jpg`

교체 방법: 새 사진의 이름을 `two-piece.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 벽걸이형

화면 표시명: 벽걸이형

옵션 ID: `toilet: wall-hung`

파일 위치: `public/images/bathroom-builder/toilet/wall-hung.jpg`

교체 방법: 새 사진의 이름을 `wall-hung.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `toilet: undecided`

파일 위치: `public/images/bathroom-builder/toilet/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 7 · 욕실장

#### 슬라이딩 거울장

화면 표시명: 슬라이딩 거울장

옵션 ID: `cabinet: sliding-mirror`

파일 위치: `public/images/bathroom-builder/cabinet/sliding-mirror.jpg`

교체 방법: 새 사진의 이름을 `sliding-mirror.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### LED 거울장

화면 표시명: LED 거울장

옵션 ID: `cabinet: led-cabinet`

파일 위치: `public/images/bathroom-builder/cabinet/led-mirror-cabinet.jpg`

교체 방법: 새 사진의 이름을 `led-mirror-cabinet.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 욕실장 없음

화면 표시명: 욕실장 없음

옵션 ID: `cabinet: none`

파일 위치: `public/images/bathroom-builder/cabinet/no-cabinet.jpg`

교체 방법: 새 사진의 이름을 `no-cabinet.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `cabinet: undecided`

파일 위치: `public/images/bathroom-builder/cabinet/unknown-cabinet.jpg`

교체 방법: 새 사진의 이름을 `unknown-cabinet.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 7 · 거울

#### 일반 거울

화면 표시명: 일반 거울

옵션 ID: `mirror: mirror`

파일 위치: `public/images/bathroom-builder/cabinet/standard-mirror.jpg`

교체 방법: 새 사진의 이름을 `standard-mirror.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### LED 거울

화면 표시명: LED 거울

옵션 ID: `mirror: led-mirror`

파일 위치: `public/images/bathroom-builder/cabinet/led-mirror.jpg`

교체 방법: 새 사진의 이름을 `led-mirror.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 거울 없음

화면 표시명: 거울 없음

옵션 ID: `mirror: none`

파일 위치: `public/images/bathroom-builder/cabinet/no-mirror.jpg`

교체 방법: 새 사진의 이름을 `no-mirror.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `mirror: undecided`

파일 위치: `public/images/bathroom-builder/cabinet/unknown-mirror.jpg`

교체 방법: 새 사진의 이름을 `unknown-mirror.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 8 · 욕조 종류

#### 일반 욕조

화면 표시명: 일반 욕조

옵션 ID: `bathtub: bath-standard`

파일 위치: `public/images/bathroom-builder/bathtub/standard.jpg`

교체 방법: 새 사진의 이름을 `standard.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 조적 욕조

화면 표시명: 조적 욕조

옵션 ID: `bathtub: bath-masonry`

파일 위치: `public/images/bathroom-builder/bathtub/masonry.jpg`

교체 방법: 새 사진의 이름을 `masonry.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 반신욕 욕조

화면 표시명: 반신욕 욕조

옵션 ID: `bathtub: bath-half-body`

파일 위치: `public/images/bathroom-builder/bathtub/half-bath.jpg`

교체 방법: 새 사진의 이름을 `half-bath.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `bathtub: undecided`

파일 위치: `public/images/bathroom-builder/bathtub/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 9 · 천장

#### SMC 평천장

화면 표시명: SMC 평천장

옵션 ID: `ceiling: smc-flat`

파일 위치: `public/images/bathroom-builder/ceiling/smc-flat.jpg`

교체 방법: 새 사진의 이름을 `smc-flat.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### SMC 돔천장

화면 표시명: SMC 돔천장

옵션 ID: `ceiling: smc-dome`

파일 위치: `public/images/bathroom-builder/ceiling/smc-dome.jpg`

교체 방법: 새 사진의 이름을 `smc-dome.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `ceiling: undecided`

파일 위치: `public/images/bathroom-builder/ceiling/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 10 · 세면 수전

#### 일반 수전

화면 표시명: 일반 수전

옵션 ID: `faucet: one-hole`

파일 위치: `public/images/bathroom-builder/faucet/basin/standard.jpg`

교체 방법: 새 사진의 이름을 `standard.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 매립 세면 수전

화면 표시명: 매립 세면 수전

옵션 ID: `faucet: concealed`

파일 위치: `public/images/bathroom-builder/faucet/basin/concealed.jpg`

교체 방법: 새 사진의 이름을 `concealed.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 볼 세면대용 높은 수전

화면 표시명: 볼 세면대용 높은 수전

옵션 ID: `faucet: tall`

파일 위치: `public/images/bathroom-builder/faucet/basin/tall-top-bowl.jpg`

교체 방법: 새 사진의 이름을 `tall-top-bowl.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `faucet: undecided`

파일 위치: `public/images/bathroom-builder/faucet/basin/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 10 · 샤워 수전

#### 일반 샤워수전

화면 표시명: 일반 샤워수전

옵션 ID: `showerFaucet: shower`

파일 위치: `public/images/bathroom-builder/faucet/shower/standard.jpg`

교체 방법: 새 사진의 이름을 `standard.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 욕조 겸용

화면 표시명: 욕조 겸용

옵션 ID: `showerFaucet: bath`

파일 위치: `public/images/bathroom-builder/faucet/shower/bathtub-combination.jpg`

교체 방법: 새 사진의 이름을 `bathtub-combination.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 핸드 샤워

화면 표시명: 핸드 샤워

옵션 ID: `showerFaucet: hand-shower`

파일 위치: `public/images/bathroom-builder/faucet/shower/hand-shower.jpg`

교체 방법: 새 사진의 이름을 `hand-shower.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 매립 샤워

화면 표시명: 매립 샤워

옵션 ID: `showerFaucet: concealed-shower`

파일 위치: `public/images/bathroom-builder/faucet/shower/concealed.jpg`

교체 방법: 새 사진의 이름을 `concealed.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `showerFaucet: undecided`

파일 위치: `public/images/bathroom-builder/faucet/shower/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 11 · 배수구

#### 일반 사각 배수구

화면 표시명: 일반 사각 배수구

옵션 ID: `drain: square-drain`

파일 위치: `public/images/bathroom-builder/drainage/square-drain.jpg`

교체 방법: 새 사진의 이름을 `square-drain.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 타일 삽입형 배수구

화면 표시명: 타일 삽입형 배수구

옵션 ID: `drain: tile-drain`

파일 위치: `public/images/bathroom-builder/drainage/tile-insert-drain.jpg`

교체 방법: 새 사진의 이름을 `tile-insert-drain.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 라인 배수구

화면 표시명: 라인 배수구

옵션 ID: `drain: linear-drain`

파일 위치: `public/images/bathroom-builder/drainage/linear-drain.jpg`

교체 방법: 새 사진의 이름을 `linear-drain.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 트렌치 드레인

화면 표시명: 트렌치 드레인

옵션 ID: `drain: trench-drain`

파일 위치: `public/images/bathroom-builder/drainage/trench-drain.jpg`

교체 방법: 새 사진의 이름을 `trench-drain.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `drain: undecided`

파일 위치: `public/images/bathroom-builder/drainage/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 11 · 배수 위치

#### 현재 위치 유지

화면 표시명: 현재 위치 유지

옵션 ID: `drainPosition: keep`

파일 위치: `public/images/bathroom-builder/drainage/keep-position.jpg`

교체 방법: 새 사진의 이름을 `keep-position.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 변경 예정

화면 표시명: 변경 예정

옵션 ID: `drainPosition: move`

파일 위치: `public/images/bathroom-builder/drainage/change-position.jpg`

교체 방법: 새 사진의 이름을 `change-position.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `drainPosition: undecided`

파일 위치: `public/images/bathroom-builder/drainage/unknown-position.jpg`

교체 방법: 새 사진의 이름을 `unknown-position.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 12 · 환기 & 건조

#### 기본 환기

화면 표시명: 기본 환기

옵션 ID: `ventilation: fan`

파일 위치: `public/images/bathroom-builder/ventilation/basic.jpg`

교체 방법: 새 사진의 이름을 `basic.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 강한 환기

화면 표시명: 강한 환기

옵션 ID: `ventilation: strong-fan`

파일 위치: `public/images/bathroom-builder/ventilation/strong.jpg`

교체 방법: 새 사진의 이름을 `strong.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 제습 기능

화면 표시명: 제습 기능

옵션 ID: `ventilation: dehumidify`

파일 위치: `public/images/bathroom-builder/ventilation/dehumidify.jpg`

교체 방법: 새 사진의 이름을 `dehumidify.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 건조 기능

화면 표시명: 건조 기능

옵션 ID: `ventilation: dry`

파일 위치: `public/images/bathroom-builder/ventilation/dry.jpg`

교체 방법: 새 사진의 이름을 `dry.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 온풍 기능

화면 표시명: 온풍 기능

옵션 ID: `ventilation: heater`

파일 위치: `public/images/bathroom-builder/ventilation/heating.jpg`

교체 방법: 새 사진의 이름을 `heating.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `ventilation: undecided`

파일 위치: `public/images/bathroom-builder/ventilation/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 13 · 조명

#### 천장 매립 조명

화면 표시명: 천장 매립 조명

옵션 ID: `lighting: light-recessed`

파일 위치: `public/images/bathroom-builder/lighting/recessed-ceiling.jpg`

교체 방법: 새 사진의 이름을 `recessed-ceiling.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 천장 간접 조명

화면 표시명: 천장 간접 조명

옵션 ID: `lighting: indirect`

파일 위치: `public/images/bathroom-builder/lighting/indirect-ceiling.jpg`

교체 방법: 새 사진의 이름을 `indirect-ceiling.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 욕실장 간접 조명

화면 표시명: 욕실장 간접 조명

옵션 ID: `lighting: cabinet-indirect`

파일 위치: `public/images/bathroom-builder/lighting/indirect-cabinet.jpg`

교체 방법: 새 사진의 이름을 `indirect-cabinet.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `lighting: undecided`

파일 위치: `public/images/bathroom-builder/lighting/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 14 · 액세서리 마감

#### 크롬

화면 표시명: 크롬

옵션 ID: `accessoryFinish: chrome`

파일 위치: `public/images/bathroom-builder/accessories/chrome.jpg`

교체 방법: 새 사진의 이름을 `chrome.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 니켈

화면 표시명: 니켈

옵션 ID: `accessoryFinish: nickel`

파일 위치: `public/images/bathroom-builder/accessories/nickel.jpg`

교체 방법: 새 사진의 이름을 `nickel.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `accessoryFinish: undecided`

파일 위치: `public/images/bathroom-builder/accessories/unknown-finish.jpg`

교체 방법: 새 사진의 이름을 `unknown-finish.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 14 · 액세서리 종류

#### 휴지걸이

화면 표시명: 휴지걸이

옵션 ID: `accessory: paper-holder`

파일 위치: `public/images/bathroom-builder/accessories/toilet-paper-holder.jpg`

교체 방법: 새 사진의 이름을 `toilet-paper-holder.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 수건걸이

화면 표시명: 수건걸이

옵션 ID: `accessory: towel-bar`

파일 위치: `public/images/bathroom-builder/accessories/towel-bar.jpg`

교체 방법: 새 사진의 이름을 `towel-bar.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 비누걸이

화면 표시명: 비누걸이

옵션 ID: `accessory: soap-holder`

파일 위치: `public/images/bathroom-builder/accessories/soap-holder.jpg`

교체 방법: 새 사진의 이름을 `soap-holder.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 컵

화면 표시명: 컵

옵션 ID: `accessory: cup`

파일 위치: `public/images/bathroom-builder/accessories/cup-holder.jpg`

교체 방법: 새 사진의 이름을 `cup-holder.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 코너 선반

화면 표시명: 코너 선반

옵션 ID: `accessory: corner-shelf`

파일 위치: `public/images/bathroom-builder/accessories/corner-shelf.jpg`

교체 방법: 새 사진의 이름을 `corner-shelf.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 일자 선반

화면 표시명: 일자 선반

옵션 ID: `accessory: straight-shelf`

파일 위치: `public/images/bathroom-builder/accessories/straight-shelf.jpg`

교체 방법: 새 사진의 이름을 `straight-shelf.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `accessory: undecided`

파일 위치: `public/images/bathroom-builder/accessories/unknown-accessory.jpg`

교체 방법: 새 사진의 이름을 `unknown-accessory.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 15 · 줄눈

#### 시멘트 줄눈

화면 표시명: 시멘트 줄눈

옵션 ID: `grout: grout-cement`

파일 위치: `public/images/bathroom-builder/grout/cement.jpg`

교체 방법: 새 사진의 이름을 `cement.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 에폭시 줄눈

화면 표시명: 에폭시 줄눈

옵션 ID: `grout: grout-epoxy`

파일 위치: `public/images/bathroom-builder/grout/epoxy.jpg`

교체 방법: 새 사진의 이름을 `epoxy.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 탄성 줄눈

화면 표시명: 탄성 줄눈

옵션 ID: `grout: grout-elastic`

파일 위치: `public/images/bathroom-builder/grout/elastic.jpg`

교체 방법: 새 사진의 이름을 `elastic.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `grout: undecided`

파일 위치: `public/images/bathroom-builder/grout/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

### STEP 16 · 문턱 마감

#### 타일 마감

화면 표시명: 타일 마감

옵션 ID: `threshold: threshold-tile`

파일 위치: `public/images/bathroom-builder/threshold/tile.jpg`

교체 방법: 새 사진의 이름을 `tile.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 인조대리석 마감

화면 표시명: 인조대리석 마감

옵션 ID: `threshold: threshold-artificial-stone`

파일 위치: `public/images/bathroom-builder/threshold/artificial-stone.jpg`

교체 방법: 새 사진의 이름을 `artificial-stone.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.

#### 아직 모르겠어요

화면 표시명: 아직 모르겠어요

옵션 ID: `threshold: undecided`

파일 위치: `public/images/bathroom-builder/threshold/unknown.jpg`

교체 방법: 새 사진의 이름을 `unknown.jpg`로 변경한 뒤 위 폴더에 붙여넣습니다. 기존 파일이 있으면 덮어씁니다.
