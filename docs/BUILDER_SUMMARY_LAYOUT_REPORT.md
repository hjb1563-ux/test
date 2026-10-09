[겹침 원인]
원인: position:absolute로 펼침 내용이 Grid 높이 계산에서 제외됨.
수정 전 구조: Trigger만 44px 공간을 차지하고, body는 bottom:48px/z-index:6으로 Option 위에 표시.
수정 후 구조: Summary 자체가 일반 흐름의 Grid item. 펼침 시 선택 영역과 남은 높이를 분배.
기존 Grid architecture를 유지하여 JSX/선택 Logic 변경 없이 수정.

[Current Selection]
Position: wrapper relative, 펼침 body static. absolute/fixed/sticky overlay 없음.
접힘 높이: 44px.
펼침 최대 높이: Header 포함 30dvh. 실제 높이는 남은 viewport 공간에 맞게 제한.
내부 Scroll: body flex:1 / min-height:0 / overflow-y:auto. 내용이 넘을 때만 scroll.
z-index 의존: 없음. 기존 body z-index/absolute inset/overlay shadow 제거.
열기/닫기: 기존 BuilderDisclosure와 aria-expanded/aria-controls 유지, Enter/Space 테스트 통과.

[Selection Area]
flex: 내부 column flex 유지. 외부는 기존 Grid의 가변 행으로 남은 공간 사용.
min-height:0.
overflow:overflow-y:auto.
Current Selection 펼침 시: 높이 자동 감소. 열린 상태에서는 선택 행 최소 64px, Summary 행 최소 88px.
화면 높이가 충분하면 두 행이 .5fr:1fr 비율로 분배되며 Summary는 30dvh 이하.
마지막 Option을 내부 scroll로 완전히 노출할 수 있음을 전 Compact 크기에서 검증.
body/main에 overflow:hidden 추가 없음.

[Bottom Navigation]
Position: 기존 sticky / flex-shrink:0 유지.
Current Selection과 겹침: 없음.
Safe Area: 기존 env(safe-area-inset-bottom) 유지.
건너뛰기/다음 항목/이전 항목 버튼 접근 유지.

[Preview]
겹침: 없음.
크기 변화: 펼침 전후 geometry 동일 검증.
Question 위치: 펼침 전후 동일 검증.
Preview/History Resolver와 선택 데이터 변경 없음.

[Responsive]
1100×800: 통과
1024×768: 통과
900×700: 통과
768×1024: 통과
430×932: 통과
390×844: 통과
375×812: 통과
각 크기에서 접힘/펼침, 선택 영역 축소, Summary 내용 접근, 마지막 Option 접근, Preview 유지, Navigation 분리, viewport 높이 및 가로 overflow 검사.
3개/5개 현재 STEP 선택과 8개 프로젝트 선택 fixture, 긴 기타 텍스트의 Summary 내부 scroll 검증.
Count는 기존처럼 현재 STEP 기준이며 범위를 바꾸지 않음.
Screenshot: C:/Users/User/AppData/Local/Temp/bath-summary-review/
검증 환경: Chrome/Playwright. 실제 iOS Safari 기기 테스트는 수행하지 않음.

[기존 기능]
Sub Step: 정상, Section 하나씩 표시 유지
자동 넘김: 없음
Single-select: 정상, 펼침 중 변경값 즉시 반영
Multi-select: 정상
Current Selection count: 정상, 기존 계산 유지
Preview: 정상
History: 정상
건너뛰기: 정상
STEP 이동: 정상
Section 이동: 펼침 상태 및 Summary 데이터 유지
기타/localStorage/상담서 수정 및 복귀: 기존 회귀 테스트 통과
Runtime pageerror: 없음

[Wide Desktop]
기존 Layout: 변경 없음.
1280×720 / 1440×900 / 1920×1080 검증 통과.
1440px에서 작업 전 CSS와 주요 패널 geometry 비교 일치.
Homepage/상담서/Guide 수정 없음.

[Build]
npm run build: 성공, exit 0.
TypeScript/Next.js compile: 성공.
builder-summary-layout.cjs: 성공, exit 0.
builder-compact-browser.cjs: 성공, exit 0.
Git diff --check: 통과.

[변경 파일]
- app/builder-responsive.css
- tests/builder-summary-layout.cjs
- docs/BUILDER_SUMMARY_LAYOUT_REPORT.md
이번 작업은 CSS Layout fix이며 기존 다른 변경 사항을 보존.
새 Package 설치 없음.
