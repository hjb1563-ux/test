# Builder 대표 이미지 연결

1. `public/images/bathroom-builder/` 또는 하위 폴더에 선택지 이름으로 사진을 넣습니다.
2. `npm run sync:builder-images`를 실행합니다.
3. 리포트를 확인하고 `npm run dev`를 실행합니다. dev/build 전에도 자동 동기화됩니다.

PNG/JPG/JPEG/WebP를 재귀적으로 검사합니다. 파일을 이동·복사·삭제·리사이즈·재인코딩하지 않으며 한글 이름도 그대로 사용합니다. `archive`와 `placeholder`는 목록에는 포함하지만 대표사진 후보에서 제외합니다.

같은 선택지의 `천장 간접 조명.png`, `천장 간접 조명2.png`, `천장 간접 조명3.png`가 있으면 3을 선택합니다. `(1)` 같은 다운로드 접미사는 버전이 아닙니다. 공백·대소문자·확장자 차이를 무시하며 `600x1200`의 치수는 보존합니다.

명시적 경로, 정확한 선택지 이름과 카테고리, 이름과 버전, 기존 Alias/정규화 구문/동의어로 매칭합니다. 인식 가능한 카테고리 폴더와 다른 옵션에는 연결하지 않습니다. 동일 버전 후보의 내용이 같으면 기존 경로를 우선 유지합니다. 내용이 다르면 AMBIGUOUS로 보고하고 유효한 기존 연결만 유지합니다. 새 선택지는 만들지 않습니다.

파일이 있는 일반 옵션은 개별적으로 사진을 켭니다. 없음 옵션도 명확한 사진이 있으면 연결합니다. 기타·아직 모르겠어요·상담 후 결정은 항상 사진 없이 유지합니다. 실제 파일이 없는 옵션은 사진을 끄고 텍스트를 유지합니다.

- `UPDATED`: 대표사진 경로 교체
- `NEW IMAGE`: 기존 사진이 비활성 또는 파일이 없던 옵션의 새 연결
- `UNCHANGED`: 기존 연결 유지
- `DISABLED`: 실제 이미지가 없거나 텍스트 전용인 옵션
- `OLDER_VERSION`: 낮은 버전 파일, 자동 삭제하지 않음
- `UNMATCHED` / `OPTION_NOT_FOUND`: 해당 선택지 없음
- `AMBIGUOUS`: 후보 이름 또는 동일 버전 사진의 내용 충돌
- `INVALID_FORMAT`: 이미지 확장자와 파일 헤더 불일치

연결 정보는 `data/bathroom-builder-image-settings.generated.json`, 실행별 보고서는 `data/bathroom-builder-image-sync-report.json`입니다. Builder가 새 연결표를 읽고 중앙 Preview와 History는 동일한 이미지 Resolver를 사용합니다. 우측 Summary·STEP 16·상담서의 선택값은 그대로 유지됩니다. 홈페이지·가이드 자산은 이동하지 않습니다. localStorage에는 이미지 경로를 저장하지 않습니다.

선택된 inbox 파일은 `.gitignore`의 자동 관리 구간에서 예외 처리합니다. 실제 배포에는 이 파일들과 생성된 연결표를 함께 커밋해야 합니다. sync는 자동 커밋·푸시를 하지 않습니다. 환경변수 제외 규칙은 그대로 유지합니다.

검증: `node tests/sync-builder-images.mjs`, `node tests/builder-images.cjs`, `npm run build`.

## 현재 폴더와 타일 조합

Root는 `public/images/bathroom-builder/`입니다. `inbox/`는 미분류 원본·이전 버전 업로드를 보존하는 곳이고, 사용 중인 업로드는 `structure/jendai`, `structure/partition-shower-booth`, `tile/size`, `cabinet/bathroom-cabinet`, `faucet/{basin,shower}`, `ceiling`, `drainage`, `lighting`, `grout`에서 관리합니다. 기존 canonical 폴더와 fallback은 의존성 보존을 위해 유지합니다. 이동은 관리 작업이며 sync 자체는 파일을 이동하지 않습니다.

타일 조합은 `tile/mood/{300x600,600x600,600x1200}/`에서 관리합니다. 파일명을 바꾸지 않으며, `300+600각 타일 분위기 화이트 .png`, `600각 타일 분위기 아이보리.png`, `600+1200각 타일 분위기 다크.png`와 `300x600 화이트.png`, `300×600 화이트.png`, `300 600 화이트.png`를 인식합니다. 규격 폴더 안의 `화이트.png`도 지원합니다. 명확한 뒤쪽 버전 숫자만 버전으로 취급합니다. 같은 버전의 내용이 다르면 충돌을 보고하고 유효한 기존 연결을 보존합니다.

조합표는 `data/bathroom-builder-tile-images.generated.json`, Resolver는 `data/bathroom-builder-image-resolver.ts`입니다. 정확한 조합 → 기존 분위기 대표 이미지 → 기존 fallback 순서이며, localStorage에 조합 경로를 저장하지 않습니다. 분위기 선택 후 크기 변경 시 Preview와 기존 History 카드 이미지가 함께 갱신됩니다. 기타 선택과 STEP 이동 시 Preview Empty 정책을 유지합니다.

이동·미이동 판단, 원본 해시, 중복과 참조 Inventory는 `docs/BUILDER_IMAGE_INVENTORY.json`에 기록했습니다. 이미지 경로와 원본 검증은 `node tests/builder-image-paths.mjs`, 조합 매핑 검증은 `node tests/sync-builder-images.mjs`, UI 검증은 `tests/builder-tile-browser.cjs`를 사용합니다.

현재 실제 폴더 구조(기존 canonical/legacy 폴더 포함):

```text
public/images/bathroom-builder/
├─ accessories/
├─ basin/
├─ bathtub/
├─ cabinet/
│  └─ bathroom-cabinet/
├─ ceiling/
├─ demolition/
├─ drainage/
├─ fallback/
│  └─ placeholder.svg
├─ faucet/
│  ├─ basin/
│  └─ shower/
├─ grout/
├─ inbox/
├─ jendai/
├─ lighting/
├─ partition/
├─ structure/
│  ├─ embedded/
│  ├─ jendai/
│  ├─ niche/
│  ├─ partition/
│  ├─ partition-shower-booth/
│  └─ shower-booth/
├─ threshold/
├─ tile/
│  ├─ finish/
│  ├─ floor/
│  ├─ mood/
│  │  ├─ 300x600/
│  │  ├─ 600x1200/
│  │  └─ 600x600/
│  ├─ size/
│  ├─ tone/
│  ├─ wall/
│  └─ window/
├─ toilet/
├─ ventilation/
└─ waterproofing/
```
