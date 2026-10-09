[Compact Sub Step]
적용 breakpoint: <1200px. >=1200px는 기존 Desktop 전체 Section 표시.
STEP 내부 Section 방식: 상위 Configurator의 sectionPosition UI 상태로 현재 Section 하나만 표시.
예 STEP02: 1 젠다이 → 2 파티션 & 샤워부스 → 3 샴푸박스.
다른 Section의 Header를 세로로 나열하지 않습니다.

[자동 이동]
Single-select 자동 이동: 없음.
Multi-select 자동 이동: 없음.
사용자 직접 이동: 예. 하단 버튼으로만 이동.
선택 처리 함수는 Section 위치를 변경하지 않습니다.

[Navigation]
첫 Section 왼쪽 버튼: 이전 STEP. STEP01 첫 Section에서는 disabled.
중간 Section 왼쪽 버튼: 이전 항목.
중간 Section 오른쪽 버튼: 다음 항목 →.
마지막 Section 오른쪽 버튼: STEP NN으로 →.
다음 버튼 중복: 없음. Compact에서 기존 Desktop Navigation은 숨김.
건너뛰기: 기존 실제 역할인 현재 STEP 전체 이동 유지.

[Progress]
전체: STEP 02 / 16.
내부: 현재 Section Header의 1 / 3.
STEP progress와 Section progress 분리: 정상. Section 이동은 currentStep와 progress bar를 변경하지 않음.
하단 2 / 16: STEP 기준 유지.

[미선택]
미선택 상태에서 다음 항목: 가능.
처리: 기존 미정 Logic 유지, 강제 선택/검증 추가 없음.
15개 선택 STEP의 모든 Section을 미선택 상태로 이동하는 테스트 통과.

[Preview]
Option 선택 시: 기존 Resolver로 즉시 변경.
자동 이동: 없음.
Section 변경 시: activePreview만 reset. 이전 Section으로 돌아가도 Empty를 사용하며 선택값은 유지.
STEP 변경 시: Empty 유지.
History: 삭제/초기화 없음, 기존 최신순/썸네일 기능 유지.
Option 선택 시 자동 Scroll: 없음.
Section 전환 시: 선택 패널 내부 scroll 위치만 맨 위로 정리, page scroll/scrollIntoView 호출 없음.
높이/contain/center: 이전 Responsive 구현 유지, 낮은 높이에서는 Preview 축소와 안전한 scroll.

[State]
Section UI state: Configurator의 {step,index}, 저장하지 않음.
Selection data: 기존 단일 values 공유, 복제 없음.
localStorage 영향: 기존 schema/저장 함수 그대로. Section 이동만으로 선택값을 수정하지 않음.
Refresh: 현재 STEP의 첫 Section부터 시작, 선택값/기타 내용 복원.
Window resize: CSS media query만 사용, Desktop에서도 동일 선택값 유지.

[Responsive]
1920×1080: 통과, 기존 3-column/전체 Section
1440×900: 통과, 기존 3-column/전체 Section
1280×720: 통과, 기존 3-column/전체 Section
1100×800: 통과, 현재 Section 하나
1024×768: 통과, 현재 Section 하나
900×700: 통과, 현재 Section 하나
768×1024: 통과, 현재 Section 하나
430×932: 통과, 현재 Section 하나
390×844: 통과, 현재 Section 하나
375×812: 통과, 현재 Section 하나
844×390: 가로 화면 Section 이동과 Navigation 접근 확인.
요청된 10개 크기에서 가로 overflow 없음. Compact 일반 높이에서 페이지 높이=viewport 확인.
옵션이 많으면 기존 선택 패널 내부 scroll 사용.
Screenshot: C:/Users/User/AppData/Local/Temp/bath-substep-review/
Chrome/Playwright 검증. 실제 iPhone Safari/모바일 가상 Keyboard 기기 검증은 수행하지 않음.

[기존 기능]
Single: 정상, 파티션 변경 후 같은 Section 유지
Multi: 정상, 젠다이/STEP09 선택 후 같은 Section 유지
기타: 정상, 입력 후 Refresh 복원
미정: 정상
Preview: 정상, Section/STEP reset 확인
History: 정상, 최신순/Thumbnail click/Section 이동 시 보존
STEP04: 정상, 600×600 → 다크 → 무광, 최종 600각 다크 무광 파일 확인
STEP09: 정상, 일반 + 해바라기 선택 유지, 최신 이미지 표시
STEP Navigation: 정상, 마지막 Section에서만 다음 STEP 이동
상담서 수정/복귀: 정상
Project info/자동 저장/초기화: 기존 처리 유지
Keyboard: 실제 하단 button focus 후 Enter로 Section 이동 확인
Resize: Desktop 전체 표시와 Compact 복귀 시 Section/선택값 유지 확인
Runtime pageerror: 없음

[Regression]
Wide Desktop: 전체 Section과 3-column 유지, 새 Section Progress/선택 요약은 Compact에서만 표시
Homepage: 변경 없음
상담서: 기능 변경 없음
Guide: 변경 없음
기존 사용자 변경: 보존
새 Package: 설치 없음

[Build]
npm run build: 성공, exit 0.
TypeScript/Next.js compile: 성공.
프로덕션 브라우저 회귀 테스트: 성공, exit 0.
Git diff --check: 통과.

[변경 파일]
- components/Configurator.tsx
- components/BuilderSelectionSections.tsx
- components/BuilderChoiceGroup.tsx
- app/builder-responsive.css
- tests/builder-compact-browser.cjs
- docs/BUILDER_SUBSTEP_REPORT.md

[검증 실행]
기존 Playwright 설치를 PLAYWRIGHT_MODULE로 지정.
BROWSER_EXECUTABLE: Chrome 실행 파일.
BUILDER_TEST_URL: 실행 중인 서버 URL.
node tests/builder-compact-browser.cjs
