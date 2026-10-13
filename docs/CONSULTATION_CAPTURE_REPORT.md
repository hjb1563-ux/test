# 상담서 이미지 복사 및 Builder 종료 흐름 변경

[Final Review 제거]

| 항목 | Consumer | Professional |
| --- | --- | --- |
| 변경 전 | 14 STEP | 16 STEP |
| 변경 후 | 13 STEP | 15 STEP |
| 삭제 화면 | 최종 검토 | 최종 검토 |
| 마지막 STEP | 욕실 문틀 하부 / 문턱 | 욕실 문틀 하부 / 문턱 |
| 마지막 CTA | 상담서 보기 → | 상담서 보기 → |

- Final Review 의존 Logic: Builder의 최종 검토 렌더링 분기와 import 제거. `getVisibleSteps()`에서 기존 `checklist` 키를 제외해 Progress / 이전·다음 / Compact Sub Step / Resume에 공통 반영.
- 내부 Stable STEP / Selection ID: 그대로 유지. 기존 catalog의 `checklist` ID는 저장 데이터 호환을 위해 남아 있으나 화면에 접근할 수 없습니다.
- 자동 저장: 기존 Builder 저장 effect 유지. Final Review에서만 제공하던 특이사항 입력은 상담서로 이동했습니다. 기존 특이사항은 보존하며, 상담서 수정·새로고침도 검증했습니다.
- Legacy currentStep: 이전 Final Review 내부 index 15 및 `step=16` URL은 현재 모드의 마지막 visible STEP(index 14)으로 안전하게 clamp합니다.
- Progress phase의 “최종 검토” 문구 제거.

[상담서 이미지 복사]

- Button: 상담서 이미지 복사.
- Capture Root: `consultationCaptureRef`를 연결한 `article.consultationDocument`.
- Library: `html-to-image@1.11.13` 하나만 추가. React peer dependency가 없는 DOM 기반 라이브러리이며 현재 Next.js / React 환경에서 Build 및 실제 PNG 복사를 검증했습니다. [공식 문서](https://github.com/bubkoo/html-to-image)와 설치된 패키지 API를 확인했습니다.
- 전체 Scroll Height: 포함. 문서 전체 높이를 측정하고 긴 메모도 텍스트로 펼칩니다.
- Capture 제외: Action Buttons / 웹사이트 Navigation / 상태 Feedback / Category 수정 버튼 / Builder 이동 링크 / 입력 textarea / 저장 상태.
- Action Buttons는 Capture Root 밖에 있습니다. 문서 내부 제외 UI는 `data-capture-ignore="true"`로 지정합니다.
- 실제 화면 Flicker: 없음. 화면 밖의 별도 복제본만 변경·캡처하고 완료 또는 실패 시 제거합니다.
- 해상도: 기본 pixelRatio 2, 최대 변 길이 16,384px 및 24MP 예산 안에서 조정.
- Clipboard MIME: `image/png`.
- 성공 Feedback: “상담서 이미지가 복사되었습니다.”
- 실패 처리: “상담서 이미지 복사에 실패했습니다.” 표시. 미지원 API에서 crash 없이 버튼 복구.
- Loading: “복사 중...” 및 disabled 처리, ref로 중복 클릭 방지.
- 메모 마지막 줄 / 특이사항 / 마지막 STEP / 문서 하단 안내: PNG에 포함 확인.
- 실제 이미지 Clipboard에서 읽은 PNG를 `tests/artifacts/consultation-capture/`에 저장해 시각 검증했습니다.

[요약만 복사]

- 작성 모드: 제외.
- Project Metadata: 프로젝트명 / 고객명 / 건물 유형 / 거주 여부 / 평수 / 시공 예정일 / 예산 유지.
- 핵심 선택 요약: 유지.
- Memo: 기존 정책 유지.
- 상담서 화면 작성 모드: 유지.
- 전체 선택 내용 복사의 작성 모드: 유지.

[Warning]

- 기존 문구: 볼 세면대와 낮은 수전의 높이 조합을 확인하세요.
- 변경 문구: 탑볼 세면대와 낮은 수전의 높이 조합을 확인하세요
- Stable Step 조건: `step.key === 'faucet'`(수전 & 샤워).
- 기존 조합 조건: `sink === 'top-bowl' && faucet === 'one-hole'` 유지.
- Consumer: STEP08 / 13에서 정상.
- Professional: STEP09 / 15에서 정상.
- 다른 STEP 노출: 0건. 타일 / 욕조 / 천장 / 조명 / 액세서리 / 줄눈 / 문턱 검증.
- 매립 세면 수전으로 변경하면 해당 Warning 해제.
- 상담서에 새 Warning을 추가하지 않았습니다.

[Navigation]

- Consumer 마지막: STEP13 문턱 → 상담서.
- Professional 마지막: STEP15 문턱 → 상담서.
- 줄눈 → 문턱 이동과 문턱 → 이전 이동 정상.
- 상담서 수정 → Builder: Consumer 타일 수정 / Professional 방수 수정 / 두 모드 문턱 수정 정상.
- 상담서로 돌아가기: 정상.
- Final Review 경유: 없음.
- 상담서의 일반 “선택 수정”: 현재 모드 첫 Builder STEP으로 진입.
- 마지막 Section CTA만 상담서로 이동하며 이전 Section은 “다음 항목 →” 처리 유지.

[기존 기능]

- Project Info: 정상.
- Selection / Single / Multi / 기타 입력: 정상.
- Preview / History / Current Selection / Sub Step: 정상.
- Auto advance: 없음.
- localStorage: 정상. Selection / 이미지 이력 / Memo 보존 및 새로고침 확인.
- Print/PDF: 기존 `window.print()` 유지. 두 모드 인쇄 미디어에서 Action 숨김 / 전체 Memo / 특이사항 표시 확인.
- Consumer hidden Professional fields: 기존 필터 유지.
- STEP04 타일 이미지 조합 / STEP09 샤워 수전 Multi-select: 기존 회귀 검사 통과.
- consumer / professional 공통 Builder 및 공통 Selection State 유지.
- 홈페이지 / 가이드 / Project Info UI는 이번 작업에서 변경하지 않았습니다.

[Responsive]

| 화면 크기 | 결과 | Consumer PNG | Professional PNG |
| --- | --- | --- | --- |
| 1920×1080 | 정상 | 2880×5250 | 2880×5556 |
| 1440×900 | 정상 | 2880×5250 | 2880×5556 |
| 1280×720 | 정상 | 2560×5250 | 2560×5556 |
| 1024×768 | 정상 | 2048×5250 | 2048×5556 |
| 768×1024 | 정상 | 1536×5250 | 1536×5556 |
| 430×932 | 정상 | 860×6806 | 860×7466 |
| 390×844 | 정상 | 780×6848 | 780×7508 |
| 375×812 | 정상 | 750×6848 | 750×7508 |

8개 크기에서 두 모드의 13/15 STEP / 마지막 CTA / 뒤로 이동 / 상담서 Action wrap / 가로 넘침 없음 / 실제 이미지 Clipboard 복사를 확인했습니다. 캡처는 viewport 높이보다 긴 문서와 32줄 이상 메모로 검증했습니다. 기존 Builder·프로젝트 정보 화면의 Preview / Compact 영역 / 자동 넘김 없음도 8개 크기에서 회귀 검증했습니다.

[Build]

- `npm run build`: 성공. TypeScript / 최적화 컴파일 / 정적 페이지 생성 완료.
- `npm run typecheck`: 성공.
- `node tests/builder-mode.cjs`: 성공.
- `node tests/project-info.cjs`: 성공.
- `node tests/consultation-enhancements.cjs`: 성공.
- `node tests/builder-structure.cjs`: 성공.
- `node tests/consultation-capture-browser.cjs`: 8개 화면 크기 × 두 모드의 실제 PNG / 마지막 CTA / 요약 복사 검증 통과. 후속 특이사항 새로고침 수정 이후 `CAPTURE_FLOWS_ONLY=1`로 수정 / 복귀 / Legacy / 인쇄 / 미지원 Clipboard 검증 통과.
- `node tests/builder-mode-browser.cjs`: `BUILDER_MODE_FLOWS_ONLY=1`로 기존 모드 전환 / 데이터 보존 / 8개 크기 Builder·Form 회귀 검사 통과.
- Browser runtime errors: 없음.
- `git diff --check`: 통과.

[변경 파일]

이번 요청에 따른 변경 파일만 표시합니다. 이전 작성 모드 작업의 기존 변경은 보존했습니다.

- `data/bathroom-builder-mode.ts`: Final Review visible flow 제외.
- `data/bathroom-consultation.ts`: 최종 검토 phase 제거, 요약 복사에서 작성 모드 제외.
- `components/Configurator.tsx`: 최종 검토 화면 제거, 마지막 CTA, Warning 문구·Stable key scope.
- `app/result/page.tsx`: Capture Ref / PNG 복사 버튼·Feedback / Capture 제외 / 특이사항 입력 이동 / 선택 수정 진입점.
- `data/consultation-image.ts`: 전체 문서 DOM → PNG → Clipboard 처리.
- `app/consultation.css`: Capture Root 및 Action 영역의 반응형 스타일.
- `package.json`, `package-lock.json`: 캡처 라이브러리 1개.
- `tests/consultation-capture-browser.cjs`: 신규 기능 / Responsive / 실제 Clipboard 검사.
- `tests/builder-mode.cjs`, `tests/builder-mode-browser.cjs`: 변경된 13/15 STEP 및 요약 복사 기대값.
- `tests/project-info.cjs`, `tests/consultation-enhancements.cjs`, `tests/builder-structure.cjs`: 최종 검토 제거에 따른 종료 흐름 / Ref / 인쇄 영역 회귀 기대값.
- `docs/CONSULTATION_CAPTURE_REPORT.md`: 완료 보고.

검증 브라우저는 별도 Context를 사용해 사용자의 실제 브라우저 저장 데이터와 분리했습니다. 실제 PNG Clipboard 검증 중 시스템 클립보드에는 테스트 문서가 복사됩니다.
