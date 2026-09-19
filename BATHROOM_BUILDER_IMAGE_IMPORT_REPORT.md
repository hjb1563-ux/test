# 욕실 대표 이미지 Import 결과

요청서에 우선 지정된 19개를 처리했습니다. Downloads에서 확인된 원본 파일명에는 `(1)`이 없었으며, 동일한 normalization 규칙으로 연결했습니다. 다른 첨부 사진까지 임의로 확대 연결하지 않았습니다.

## 이미지 Import

| 항목 | 결과 |
|---|---:|
| 읽은 파일 | 19 |
| 매칭 성공 | 19 |
| 매칭 실패 | 0 |
| 중복 | 0 |
| 애매한 매칭 | 0 |
| OPTION_NOT_FOUND | 0 |
| 형식 오류 | 0 |

원본과 canonical 파일의 바이트 일치를 19개 모두 검증했습니다. 크롭·리사이즈·압축·재인코딩하지 않았습니다.

## 생성

- Inbox: `public/images/bathroom-builder/inbox/`
- Sync script: `scripts/sync-builder-images.mjs`
- Alias map: `data/bathroom-builder-image-aliases.json`
- Image manifest: `data/bathroom-builder-images.generated.json`
- 사용법: `BATHROOM_BUILDER_IMAGE_IMPORT.md`
- 실행: `npm run sync:builder-images`. `predev`, `prebuild`에서도 자동 실행합니다.

## 이번 이미지

아래 경로의 공통 접두사는 `/images/bathroom-builder/`입니다. 옵션 이름은 기존 화면 표기를 그대로 유지했습니다.

| 실제 파일 | STEP | 카테고리 | 기존 옵션 | 최종 builderImage (공통 접두사 뒤) |
|---|---|---|---|---|
| 문턱 인조대리석 마감.png | 16 | 문턱 마감 | 인조대리석 마감 | `threshold/artificial-stone.png` |
| 문턱 타일 마감.png | 16 | 문턱 마감 | 타일 마감 | `threshold/tile.png` |
| 니켈 액세서리.png | 14 | 액세서리 마감 | 니켈 | `accessories/nickel.png` |
| 크롬 액세서리.png | 14 | 액세서리 마감 | 크롬 | `accessories/chrome.png` |
| 천장 간접 조명.png | 13 | 조명 | 천장 간접 조명 | `lighting/indirect-ceiling.png` |
| 트렌치 드레인 배수구.png | 11 | 배수구 | 트렌치 드레인 | `drainage/trench-drain.png` |
| 라인 배수구.png | 11 | 배수구 | 라인 배수구 | `drainage/linear-drain.png` |
| 타일 삽입형 배수구.png | 11 | 배수구 | 타일 삽입형 배수구 | `drainage/tile-insert-drain.png` |
| 일반 사각 배수구.png | 11 | 배수구 | 일반 사각 배수구 | `drainage/square-drain.png` |
| smc 돔천장.png | 09 | 천장 | SMC 돔천장 | `ceiling/smc-dome.png` |
| smc 평천장.png | 09 | 천장 | SMC 평천장 | `ceiling/smc-flat.png` |
| 반신욕 욕조.png | 08 | 욕조 종류 | 반신욕 욕조 | `bathtub/half-bath.png` |
| 조적 욕조.png | 08 | 욕조 종류 | 조적 욕조 | `bathtub/masonry.png` |
| 일반 욕조.png | 08 | 욕조 종류 | 일반 욕조 | `bathtub/standard.png` |
| LED 거울.png | 07 | 거울 | LED 거울 | `cabinet/led-mirror.png` |
| 일반 거울.png | 07 | 거울 | 일반 거울 | `cabinet/standard-mirror.png` |
| LED 거울장.png | 07 | 욕실장 | LED 거울장 | `cabinet/led-mirror-cabinet.png` |
| 슬라이딩 거울장.png | 07 | 욕실장 | 슬라이딩 거울장 | `cabinet/sliding-mirror.png` |
| 벽걸이형 변기.png | 06 | 변기 | 벽걸이형 | `toilet/wall-hung.png` |

## 기능 및 검증

- 중앙 이미지 / 지금까지 선택 / 현재 선택: 카탈로그의 동일한 `builderImage`를 읽습니다.
- 일반 욕조 및 LED 거울장: 세 영역에 새 PNG가 표시되고 취소하면 제거, 재선택 및 저장 상태 복원 시 다시 같은 이미지가 표시되는 컴포넌트 테스트 통과.
- 17개 STEP 전체의 왼쪽 카드에 이미지가 없음을 검증했습니다.
- 옵션 데이터에서 `builderImage`를 제외한 모든 값이 작업 전과 동일함을 검증했습니다.
- Single/Multi 선택, 기타 입력, 아직 모르겠어요, 이미지 없는 옵션, localStorage 복원, 결과 페이지 회귀 테스트 통과.
- 19개 이름과 suffix 변형, Unicode/대소문자, 미래 파일명, 중복 내용/다른 내용 충돌, 애매한 이름, 없는 옵션, 파일 형식 오류 테스트 통과.
- 반복 실행 시 UNCHANGED, 교체 전 archive 보관, 확장자 변경, inbox 없는 환경의 manifest 보존 테스트 통과.
- 실제 브라우저 화면 검증은 연결된 브라우저가 없어 미실시. 컴포넌트 검증과 실제 화면 검증은 구분합니다.
- 로컬 `/design` 및 19개 이미지 URL 모두 HTTP 200. PNG MIME과 응답 바이트가 원본과 일치함을 확인했습니다.

## Git

- Inbox 원본: Git 제외. `.gitkeep`만 포함 대상.
- archive: Git 제외.
- canonical 이미지 19개와 generated manifest: Git 제외되지 않으며 커밋 대상.
- 이번 작업에서 commit / push / 외부 배포는 실행하지 않았습니다.
- 메인, 가이드, Header/Footer/Navigation, UI/CSS, 선택 로직, 결과 페이지, 보안 설정을 수정하지 않았습니다.
- 기존 자동 생성 `AGENTS.md`, `CLAUDE.md`는 유지했습니다. `next-env.d.ts`의 경로는 dev/build 실행 시 Next가 갱신합니다.

## Build

`npm run build`: 성공. Next.js 16.3.5 webpack 컴파일, TypeScript, 24개 정적 페이지 생성 통과.

`git diff --check`: 통과.
