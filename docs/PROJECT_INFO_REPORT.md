# 프로젝트 정보 작업 보고서

[프로젝트 정보 시작 화면]

- 추가 여부: 추가 완료. `/design`에서 기존 데이터에 유효한 프로젝트 정보가 없으면 표시합니다.
- 화면 위치: 16단계 밖의 시작 화면. STEP 번호와 progress를 표시하지 않습니다.
- 고객명 Label: 고객명 / 이름
- Placeholder: 예: 홍길동
- 프로젝트명 Label: 프로젝트명
- Placeholder: 예: 홍길동 고객님 욕실 리모델링
- Validation: 두 값이 모두 공백이면 “이름 또는 프로젝트명 중 하나를 입력해주세요.”를 form 아래에 표시합니다.
- 시작 버튼: 욕실 만들기 시작. form submit으로 Enter를 지원합니다.
- 고객명 최대 40자, 프로젝트명 최대 80자. label 연결 및 기존 muted 색상을 사용합니다.

[STEP 구조]

- 기존 STEP01~16: 번호, 순서, 선택 옵션 변경 없음.
- 총 STEP 표기: 16 유지. 프로젝트 정보는 카테고리 집계 및 이미지 History에 포함하지 않습니다.

[저장]

- projectInfo 구조: `{ customerName: string, projectName: string }`
- localStorage: 기존 `bath-designer-selections-v2` 객체 안에 추가. 기존 version 3 유지.
- 저장 시 trim. placeholder와 고객명으로 파생한 표시 이름은 저장하지 않습니다.
- Refresh: 프로젝트 정보와 저장된 단계 복원 검증 통과.
- Legacy data: 정보가 없으면 입력 화면을 표시하고 입력 후 기존 저장 단계로 복귀. 선택값, History, 메모 보존 검증 통과.

[프로젝트 정보 표시]

- Builder: progress 위에 작은 식별 정보와 수정 버튼.
- STEP16: 같은 식별 정보를 최종 검토 상단에 표시. 기존 Category Card 유지.
- 상담서: header 안에 프로젝트명과 고객명 표시. 정보 없는 기존 상담서도 안전하게 표시.
- Copy: 문서 제목 아래 프로젝트·고객명 포함. 컴포넌트 동작 검증 통과.
- Print/PDF: 인쇄되는 header에 포함하며 printHide 밖에 배치. 인쇄 버튼 호출 및 컴포넌트 구조 검증 통과. 실제 PDF 출력은 미검증.

[프로젝트 정보 수정]

- 수정 기능: Builder 상단 수정 버튼에서 기존 form 재사용. 저장 및 취소 제공.
- 수정 후 현재 STEP 유지: 검증 통과.
- 기존 Selection 유지: 선택값·History·메모·카테고리 집계 보존 검증 통과.
- 처음부터 다시 만들기: 기존 확인창 이후 선택값과 프로젝트 정보를 초기화하고 시작 화면으로 이동.

[Placeholder]

- 전체 확인한 편집 가능한 Text Input 수: 17개. 프로젝트 2개, 기타 입력 13개, 환풍기·액세서리 2개.
- 전체 확인한 편집 가능한 Textarea 수: 2개. STEP16 특이사항, 상담서 업체 메모.
- 추가로 상담서 복사 실패 시 표시하는 읽기 전용 textarea 1개는 입력 용도가 아니므로 placeholder를 추가하지 않았습니다.
- 새 Placeholder 추가: 고객명 “예: 홍길동”, 프로젝트명 “예: 홍길동 고객님 욕실 리모델링”.
- 기존 Placeholder 유지: STEP04 기타 타일, STEP13 액세서리 종류, 상담서 업체 메모 문구 그대로 유지.

| 변경 항목 | Placeholder |
| --- | --- |
| 기존 욕실 상태 기타 | 예: 천장에 곰팡이가 있어요 |
| 세면대 기타 | 예: 벽부형 세면대 |
| 변기 기타 | 예: 비데 일체형 변기 |
| 욕실장 기타 | 예: 슬라이딩 거울장 |
| 거울 기타 | 예: 타원형 거울 |
| 욕조 기타 | 예: 프리스탠딩 욕조 |
| 천장 기타 | 예: 알루미늄 천장 |
| 세면 수전 기타 | 예: 높은형 세면 수전 |
| 샤워 수전 기타 | 예: 온도조절 샤워 수전 |
| 배수구 기타 | 예: 벽면형 배수구 |
| 조명 기타 | 예: 거울 양옆 벽등 |
| 액세서리 마감 기타 | 예: 무광 블랙 |
| 환풍기 제품명 | 예: 힘펠 휴젠뜨 |
| 특이사항 | 예: 기존 누수 이력이 있어요. 매립 선반을 추가하고 싶어요. |

[기존 기능]

- Selection, Multi, 기타, Preview, History, STEP04 image: 기존 로직 및 옵션 데이터 변경 없음. 새 검사에서 History 보존과 빈 기타 입력 검증 통과.
- STEP 이동: 모든 16단계 컴포넌트 렌더 및 기존 저장 단계 복원 검증 통과.
- 상담서 수정/복귀: 기존 링크·쿼리 유지. 상담서에서 방수 수정 시 단계 쿼리와 프로젝트 정보 보존 검증 통과.
- 이미지 파일 검사: `node tests/builder-image-paths.mjs` 통과. 이미지 참조 137개, 누락 0개.
- Regression: 위 컴포넌트 검증 범위에서는 발견 없음. 전체 브라우저 회귀 검증은 미완료.
- 기존 `tests/builder-images.cjs`는 과거 “선택 완료” 버튼을 찾아 실패했습니다. 현재 UI의 “다음”과 새 시작 화면을 반영하지 않는 테스트라 수정하지 않았으며, 이 테스트를 통과했다고 보고하지 않습니다.

[Responsive]

- 1920×1080, 1440×900, 1280×720, 1024×768, 430×932, 390×844, 375×812: 모두 실제 브라우저 시각 검증 미실행.
- 구현: 최대 560px form, 화면 폭에 맞춘 너비·padding, 입력 너비 100%, 버튼 줄바꿈, 식별 정보 긴 문구 줄바꿈, 모바일 placeholder 크기 조정.
- 검증 제한: Playwright가 프로젝트에 설치되어 있지 않고 연결 가능한 CUA 브라우저가 없습니다. 실제 모바일 키보드, hydration, 이미지 미리보기 및 PDF 시각 검증은 남아 있습니다.

[Build]

- `npm.cmd run typecheck`: 성공.
- `npm.cmd run build`: 성공.
- `node tests/project-info.cjs`: 성공.
- `git diff --check`: 성공.
- 개발 서버 `/design` HTTP 응답: 200.

[변경 파일]

- components/Configurator.tsx
- components/ProjectInfoForm.tsx
- components/ProjectIdentity.tsx
- components/BuilderChoiceGroup.tsx
- data/bathroom-consultation.ts
- app/result/page.tsx
- app/design.css
- tests/project-info.cjs
- docs/PROJECT_INFO_REPORT.md

Next.js가 `next-env.d.ts`를 실행 환경에 따라 자동 갱신할 수 있습니다. 작업 시작 때부터 변경이 있던 자동 생성 파일로, 기능 구현을 위해 직접 수정하지 않았습니다.
