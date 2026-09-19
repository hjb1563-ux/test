# 새 욕실 대표 이미지 넣는 법

1. 사진 이름을 기존 선택지 이름과 최대한 비슷하게 만듭니다. 예: `하프 파티션.png`, `원피스 변기.png`, `LED 거울장.png`.
2. `public/images/bathroom-builder/inbox/`에 넣습니다.
3. 프로젝트 폴더에서 `npm run sync:builder-images`를 실행합니다.
4. `MATCHED` 결과와 STEP / 카테고리 / 옵션 / 최종 경로를 확인합니다.
5. `npm run dev`를 실행합니다. `dev`와 `build` 시작 전에도 자동 동기화합니다.
6. 해당 옵션을 선택하여 중앙, 지금까지 선택한 항목, 오른쪽 현재 선택의 사진을 확인합니다.

PNG, JPG, JPEG, WebP를 지원합니다. 원본 바이트와 확장자를 유지하여 복사하며, 크롭·리사이즈·압축·재인코딩하지 않습니다. 원본을 삭제하지 않습니다. `(1)`, `(2)`, `- 복사본`, `copy`, `final`, `최종`, 공백, 대소문자 차이는 매칭에서 무시합니다.

## 결과별 조치

| 결과 | 의미 / 조치 |
|---|---|
| MATCHED | 기존 선택지에 연결됨. COPIED=새 복사, REPLACED=교체, UNCHANGED=이미 같은 파일 |
| UNMATCHED | 맞는 옵션 없음. 기존 선택지 이름으로 변경하세요. 새 선택지를 만들지 않습니다. |
| AMBIGUOUS | 후보가 여러 개. 카테고리까지 넣어 명확히 바꾸세요. 예: 거울 → 일반 거울 / LED 거울 |
| DUPLICATE_TARGET | 같은 옵션으로 연결되는 원본이 여러 장. 사용할 파일 하나만 inbox에 남기세요. 내용이 같아도 자동 선택하지 않습니다. |
| OPTION_NOT_FOUND | Alias가 가리키는 옵션이 현재 카탈로그에 없음. 옵션을 다시 만들지 않습니다. |
| SKIPPED_NO_IMAGE | 원래 사진을 표시하지 않는 선택지. 표시 규칙 유지 |
| INVALID_FORMAT | 확장자와 실제 이미지 형식이 다름. 확장자만 바꾸지 말고 원본 형식을 확인하세요. |

위의 매칭 문제는 해당 파일만 건너뛰며 기존 연결과 빌드를 유지합니다. 파일 읽기/쓰기 오류, 손상된 JSON 등의 실행 오류는 실패 코드로 빌드를 중단합니다.

같은 옵션의 사진을 교체하려면 이전 원본을 inbox 밖으로 옮기고 새 원본 한 장을 넣으세요. 같은 canonical 파일의 내용이 달라지면 이전 파일을 `archive/`에 SHA-256 이름으로 먼저 보관합니다. 확장자가 바뀌면 새 확장자 경로를 사용하고 이전 형식 파일도 삭제하지 않습니다.

## 파일명 매칭 기준

정확한 Alias → 기존 화면 label → 정규화된 keyword 구문 → 동의어 Alias 순서입니다. 각 단계에서 후보가 여러 개면 즉시 AMBIGUOUS로 처리합니다. keyword도 전체 구문 일치만 허용하며 부분 문자열로 추측하지 않습니다. 따라서 `럭셔리 황금 욕조.png`는 UNMATCHED입니다.

`600×600`처럼 벽/바닥이 겹치는 이름은 `벽 타일 600x600.png`, `바닥 타일 600x600.png`로 구분합니다. 현재 바닥에는 300×300 옵션이 없으므로 그 사진을 300×600에 연결하지 않습니다. 기존 선택지 이름이 겹치면 명시적인 Alias가 필요합니다. 일반 사용 시 코드 수정 없이 현재 이름 또는 등록된 동의어를 사용하면 됩니다.

## 구현과 배포

- 실행: `scripts/sync-builder-images.mjs`
- Alias: `data/bathroom-builder-image-aliases.json`
- 자동 생성 연결표: `data/bathroom-builder-images.generated.json` (직접 수정하지 않음)
- 키: `groupKey:optionId`. 다른 그룹의 `none`, `600x600` 같은 중복 ID를 구분합니다.
- 실제 옵션 목록은 `data/bathroom-options.ts`를 읽습니다. 옵션 복제 목록을 만들지 않습니다.
- 카탈로그의 `builderImage`가 manifest의 최신 경로를 읽습니다. 미등록 옵션은 기존 경로를 유지합니다. UI 세 영역은 계속 이 값 하나를 공유합니다.
- `showBuilderImage`, 선택 로직, 기타 입력, localStorage, CSS, 결과 페이지는 변경하지 않습니다. localStorage는 기존 옵션 ID와 입력 내용을 유지합니다.
- inbox 원본과 archive는 Git 제외, inbox `.gitkeep`은 포함합니다. canonical 이미지와 manifest는 Git에 포함할 대상입니다. 별도의 commit/push는 필요하며 sync 자체가 Git 명령을 실행하지는 않습니다.
- Vercel처럼 inbox가 비어 있는 환경은 커밋된 manifest를 그대로 유지합니다. 배포 후 서버에서 업로드하는 기능은 아닙니다. 새 이미지 배포에는 canonical 이미지와 manifest의 커밋/배포가 필요합니다.
- 검증: `node tests/sync-builder-images.mjs`, `node tests/builder-images.cjs`, `npm run build`.

이번에 지정한 19개 파일의 실제 경로는 `BATHROOM_BUILDER_IMAGE_IMPORT_REPORT.md`에 기록했습니다. 이전 `BATHROOM_BUILDER_IMAGES.md`의 JPG 목록은 기본 경로 안내이며, 가져온 옵션의 최신 경로는 generated manifest가 우선합니다.
