[Responsive Strategy]
Wide Desktop breakpoint: >=1200px (기존 기준 유지)
Compact breakpoint: <1200px
Desktop 3-column 변경 여부: 변경 없음. 1440px에서 기존 CSS와 주요 패널 geometry 일치 확인.
CSS로만 전환하며 Selection, IDs, Resolver, 저장 상태는 공유합니다.

[Compact Layout]
전체 height 방식: 100dvh. 600px 미만 높이에서는 안전한 페이지 scroll 허용.
Header: 48px, 프로젝트명/고객명/수정/초기화 유지.
Progress: STEP 01 / 16, 자동 저장, progress bar, 현재 Phase만 표시.
Question: 원문 유지, 20px, keep-all.
Preview: 질문 아래 항상 표시.
Selection: 남은 Grid 높이, 내부 세로 scroll. 안내 문구는 선택 영역 내 유지.
Bottom Navigation: 약 69px + safe area, 이전/단계/건너뛰기/다음.

[Preview]
기존 Mobile Preview height: 이미지 영역 height:auto + aspect-ratio:4/3. 선택 패널 뒤 접힌 Preview.
변경 Preview height: 기본 clamp(180px,34dvh,320px).
휴대폰에서는 viewport 잔여 공간을 반영해 최소 160px, 최대 34dvh.
검증값: 430×932=282px, 390×844=194px, 375×812=162px.
700px 이하 높이: clamp(100px,23dvh,160px).
Empty Preview: 이미지 없이 약 110px.
Image object-fit: contain / center 유지.
STEP 변경 reset: 유지, 직접 테스트 통과.

[Selection Panel]
내부 Scroll: overflow-y:auto, native/thin scrollbar, touch scrolling.
max/flex height: Grid minmax(0,1fr), min-height:0, align-self:stretch.
짧은 Option 2-column: 타일 크기/분위기/표면, 세면대/변기.
긴 Option 1-column: 시공 방식, 현재 욕실 상태, 샤워 수전 등.
Touch target: Option 48px 이상, Navigation 48px, Trigger 44px 이상.
Label: 14px, keep-all.

[STEP 내부 Section]
사용 방식: 기존 Accordion 재사용.
한 번에 기본 Open Section 수: 첫 Section 하나. Section UI state 저장 없음.
Single-select 동작: 선택 후 그대로 유지, 자동 다음 Section 전환 제거.
Multi-select 동작: 선택 후 닫지 않음.
Section summary: 기존 selectionLabel 공유, 선택값 + Section 번호/총수 표시.

[History]
Desktop: 기존 유지.
Compact 표현 방식: Preview 상단 Trigger, 내부 horizontal thumbnail popover.
최신순: 유지 및 검증.
Thumbnail click: 유지 및 검증.
선택 해제 시 History 제거: 검증.

[Current Summary]
Desktop: 기존 유지.
Compact 표현 방식: Selection 아래 Trigger, 위로 열리는 내부 scroll panel.
Data source: 기존 values / consultationRows / selectionLabel 동일.

[Bottom Navigation]
Sticky/Fixed: Compact sticky, Flex layout의 마지막 행.
Height: 약 69px + safe area.
Safe area: env(safe-area-inset-bottom).
이전: 기존 로직, 첫 STEP disabled.
건너뛰기: 기존 로직으로 다음 STEP 이동.
다음: 기존 로직.
Selection과 Navigation 겹침 없음, geometry 검사 통과.

[Page Scroll]
STEP01 Page scroll 필요 여부: 430×932,390×844,375×812 모두 없음.
선택 후에도 질문/Preview/시공 방식 3개 Option/다음 버튼 동시 접근 검증.
옵션 많은 STEP: Selection 내부 scroll, Preview와 하단 Navigation 유지.
낮은 높이/가로 화면: 콘텐츠 접근을 위해 안전한 페이지 scroll 허용.

[Responsive Test]
1920×1080: 통과, 3-column
1440×900: 통과, 3-column, 기존 CSS geometry 비교 일치
1280×720: 통과, 3-column
1100×800: 통과, Compact
1024×768: 통과, Compact
900×700: 통과, Compact
768×1024: 통과, Compact
430×932: 통과, Compact, STEP01 Option 3개 동시 표시
390×844: 통과, Compact, STEP01 Option 3개 동시 표시
375×812: 통과, Compact, STEP01 Option 3개 동시 표시
844×390: 가로 화면 접근성/안전한 scroll 확인
전 크기 horizontal overflow 없음.
Chrome/Playwright로 검증. 실제 iOS Safari 기기 검증은 수행하지 않음.
Screenshot: C:/Users/User/AppData/Local/Temp/bath-responsive-review/

[기존 기능]
Single: 정상
Multi: 정상, 욕실 상태 두 항목 선택 유지
기타: 정상, 입력 후 새로고침 복원
localStorage: 정상
미정: 기존 선택 없음 처리와 summary 유지
Preview: 정상, 즉시 갱신 / 이미지 없는 선택 Empty
History: 정상, 최신순/클릭/선택 해제 검증
STEP04 연동 이미지: 정상, 600×600 + 다크 + 무광 파일 확인
STEP09 Multi: 정상, 일반 + 해바라기 선택 유지
STEP 이동: 정상, Preview reset 확인
상담서 수정/복귀: 정상
프로젝트 수정/초기화: 기존 처리 코드 유지
프로덕션 회귀 테스트 pageerror: 없음

[Regression]
Homepage: 변경 없음
상담서: 기능 변경 없음
Guide: 변경 없음
Wide Desktop Builder: 기존 배치 유지
새 Package: 없음
작업 전 next-env.d.ts 사용자 변경: 보존

[Build]
npm run build: 성공 (exit 0)
TypeScript: 성공
프로덕션 브라우저 회귀 테스트: 성공
Git diff --check: 통과

[변경 파일]
- app/builder-responsive.css
- components/Configurator.tsx
- components/BuilderChoiceGroup.tsx
- components/BuilderSelectionSections.tsx
- tests/builder-compact-browser.cjs
- docs/BUILDER_RESPONSIVE_REPORT.md

[테스트 실행]
기존 Playwright 설치 경로를 PLAYWRIGHT_MODULE에 지정합니다.
BROWSER_EXECUTABLE: 설치된 Chrome 경로
BUILDER_TEST_URL: 실행 중인 서버 주소
node tests/builder-compact-browser.cjs
