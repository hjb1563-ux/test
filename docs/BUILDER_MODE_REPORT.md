# Builder 작성 모드 적용 보고

[Builder Mode]

- 추가 Field: `projectInfo.builderMode`
- Values: `consumer` / `professional`
- 신규 기본값: `consumer`
- Legacy 처리: 모드가 없고 유효한 선택값 또는 직접 입력이 있으면 `professional`, 선택값이 없으면 `consumer`. 저장 데이터와 내부 ID는 유지합니다.

[Project Info]

- 작성 방식 UI: 기본 정보 Card의 고객명 / 프로젝트명 아래에 Single-select Option Card 두 개 추가.
- 일반 고객용 설명: “디자인과 사용 방식 중심으로 간단하게 선택해요.”
- 전문가용 설명: “방수·배수·공법 등 기술 항목까지 확인해요.”
- 기존 Project Info 기능: 정상. 기존 3개 Card, 고객명/프로젝트명 Validation, 건물 유형, 거주 여부, 평수, 예정일, 예산, CTA 유지.

[Consumer]

- 총 Visible STEP: 14.
- 숨김 STEP: 방수 / 배수 & 구배.
- STEP01 숨김 Section: 시공 방식.
- STEP01 표시 제목: 현재 욕실 상태.
- STEP02 표시 제목: 구조와 샤워 공간.
- Display label 변경: 젠다이 → 욕실 선반벽(젠다이), 샴푸박스 → 매립 선반(샴푸박스), 천장 → 욕실 천장.
- 매립 수전: 선택 유지, “매립 수전은 벽체와 배관 상태에 따라 시공 가능 여부가 달라질 수 있어요.” 안내 추가.
- 줄눈: 시멘트 / 에폭시 / 폴리우레아에 짧은 보조 설명 추가.

[Professional]

- 총 STEP: 16.
- 기존 전체 항목: 유지. 별도 Builder나 상담서 페이지를 생성하지 않았습니다.

[Progress]

- Consumer: 01 / 14 ~ 14 / 14.
- Professional: 01 / 16 ~ 16 / 16.
- Internal ID 유지: 예. 내부 타일 STEP04는 Consumer 표시 STEP03과 분리합니다.
- 이전 / 다음 / 건너뛰기: Visible STEP 목록 기준.
- Compact Sub Step: Visible Section 기준. Consumer STEP01은 1 / 1, Professional은 1 / 2 ~ 2 / 2.

[Data]

- 공통 Selection State: 예.
- Consumer/Professional 별도 State: 없음.
- 숨긴 Expert 데이터 보존: 예. 모드만 변경하고 선택값 / 직접 입력 / 이미지 이력은 보존합니다.
- Option IDs: 기존 ID 그대로.
- Reset: 기존 Project Info 초기화 정책 유지, 모드도 `consumer`로 초기화.
- 새 Package: 없음.

[Counts]

- Consumer 미정 계산: Visible fields only. 시공 방식 / 방수 / 배수구 / 배수 위치 제외.
- Professional 미정 계산: 전체 fields.
- builderMode는 프로젝트 Metadata이며 선택 카테고리 수에 포함하지 않습니다.

[Current Selection]

- Consumer: Visible items only.
- Professional: 전체.
- 기존 모바일 Panel 디자인 유지.
- History: 숨긴 전문가 항목은 Consumer 화면에서 제외, 저장된 이력은 보존.

[Final Review]

- Consumer: Visible items only, 13개 선택 Category Card.
- Professional: 전체, 15개 선택 Category Card.
- 미결정 / 현장 확인 목록도 같은 필터 적용.

[Consultation]

- Consumer mode filter: 정상.
- Professional: 정상.
- 핵심 선택 요약: 동일 Mode Source.
- 요약 복사: 동일 Mode Source.
- 전체 복사: 동일 Mode Source.
- Print/PDF: 화면과 동일 Visible STEP / Section Source. 브라우저 인쇄 미디어에서 Consumer 숨김 항목 제외 / Professional 포함을 검증했습니다.
- 최종 상담서의 선택 완료 Count UI: 제거 상태 유지.
- 수정 버튼: Consumer 03 타일 → 내부 STEP04 URL → 표시 STEP03 / 14.
- 기존 상담서 수정 / 복귀 흐름 유지.

[Mode Switch]

- Consumer → Professional: Selection 유지, 전문 STEP 접근 가능.
- Professional → Consumer: Expert value 보존 + 숨김.
- 현재 STEP hidden 시: 가장 가까운 다음 Visible STEP으로 이동, 없으면 이전 Visible STEP.
- 방수 → Consumer 타일, 배수 → Consumer 환풍기 이동 확인.

[Responsive]

| 화면 크기 | 결과 |
| --- | --- |
| 1920×1080 | 정상 |
| 1440×900 | 정상 |
| 1280×720 | 정상 |
| 1024×768 | 정상 |
| 768×1024 | 정상 |
| 430×932 | 정상 |
| 390×844 | 정상 |
| 375×812 | 정상 |

두 모드의 단계 이동 / Compact Section / 최종 검토 / 상담서를 확인했습니다. Builder의 미리보기 / 자동 넘김 없음 / Compact 영역과 하단 Navigation 경계, Project Info 3개 Card와 작성 방식 선택 UI, 가로 넘침 없음도 위 8개 크기에서 확인했습니다. 스크린샷은 `tests/artifacts/builder-mode/`에 있습니다.

[Regression]

- Project Info: 정상.
- Single Select: 정상.
- Multi Select: 정상.
- 기타 / 직접 입력: 정상.
- Preview: 정상.
- History: 정상.
- Current Selection: 정상.
- Sub Step: 정상.
- 자동 넘김: 없음.
- 상담서 수정 / 복귀: 정상.
- 기존 Legacy 옵션 정규화 / 이미지 조합 / Clipboard fallback / 수정 시각 정책: 기존 회귀 검사 통과.
- 회귀 테스트의 전문가 전체 단계 fixture에 모드를 명시하고, Metadata 추가 / 기존 상담서 Count 제거 상태에 맞게 오래된 기대값을 갱신했습니다. Form 제출 검사는 실제 저장 버튼을 사용하도록 수정했습니다.

[Build]

- `npm run build`: 성공. TypeScript 검사 / 최적화 컴파일 / 24개 정적 페이지 생성 완료.
- `npm run typecheck`: 성공.
- `node tests/builder-mode.cjs`: 성공.
- `node tests/project-info.cjs`: 성공.
- `node tests/consultation-enhancements.cjs`: 성공.
- `node tests/builder-structure.cjs`: 성공.
- `node tests/builder-mode-browser.cjs`: 8개 크기 양 모드의 이동 / Review / Report 검증 통과. 추가 흐름 및 Builder / Form 검증은 `BUILDER_MODE_FLOWS_ONLY=1` 실행에서 통과.
- Browser runtime errors: 없음.
- 개발 표시 아이콘이 테스트 클릭을 가로막는 경우가 있어 Production 서버에서 브라우저 검증을 수행했습니다.
- 로컬 개발 서버: `http://localhost:3000/design` 실행 중, HTTP 200 확인.

[변경 파일]

- `data/bathroom-builder-mode.ts`: 중앙 Visibility / 표시 문구 / Visible Navigation helper.
- `data/bathroom-consultation.ts`: 프로젝트 모드 저장 / Legacy 해석 / Summary와 복사 필터.
- `components/ProjectInfoForm.tsx`: 작성 방식 선택 UI.
- `components/ProjectIdentity.tsx`: 작성 모드 Metadata.
- `components/Configurator.tsx`: 공통 Builder의 단계 / Progress / Section / 선택 패널 / History 필터.
- `components/BuilderSelectionSections.tsx`: 모드 전달.
- `components/BuilderChoiceGroup.tsx`: Consumer 안내.
- `components/BuilderChoiceCard.tsx`: 줄눈 보조 설명.
- `components/ConsultationSummary.tsx`: 최종 검토 필터 / 표시 번호.
- `app/result/page.tsx`: 상담서 필터 / 번호 / 모드 Metadata / 링크 전달.
- `app/design.css`: 작성 방식 Card / 보조 설명 스타일.
- `tests/builder-mode.cjs`: 모드 데이터 회귀 검사.
- `tests/builder-mode-browser.cjs`: 브라우저 / 반응형 / 복사 / 인쇄 / 수정 복귀 검사.
- `tests/project-info.cjs`, `tests/consultation-enhancements.cjs`, `tests/builder-structure.cjs`: 기존 회귀 fixture와 기대값 갱신.
- `docs/BUILDER_MODE_REPORT.md`: 완료 보고.

작업 전에 존재한 `next-env.d.ts`의 개발 타입 경로 변경은 개발 서버 재시작 후 유지했습니다. 기존 사용자 선택 데이터는 테스트 브라우저의 별도 Context와 분리되어 있습니다.
