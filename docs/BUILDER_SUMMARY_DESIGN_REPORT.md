[Current Selection Design]
Container Background: #FFFDF8, Warm White.
Header Background: #E7DFD2, Light Warm Stone. 기존 Section Header #F1ECE3보다 한 단계 진함.
Body Background: #FFFDF8.
Border: 1px #C7BAAA, 기존 Option #DED7CC보다 명확한 Warm Stone.
Top Accent: 2px #A9826D, Muted Terracotta.
Shadow: 0 -2px 10px rgba(48,54,49,.06).
Radius: Container 12px, 내부 Header/Body 모서리 10px.
본문 Row는 투명 배경과 #E9E3DA divider로 읽기 전용 문서처럼 표시.
Radio/Checkbox/Row hover/active styling 추가 없음.

[Typography]
Header Title: 14px / 600 / #303631.
Count: 12px / 500 / #716B63. 별도 강한 Badge 없음.
Summary Label: 13px / #716B63.
Summary Value: 14px / 500 / #303631.
미정: 기존 inline muted color와 font-weight:400 유지. 실제 computed style 확인.
Chevron 크기/회전 동작 유지.

[Spacing]
Selection → Current Selection: 기존 8px Grid gap 유지.
Header height: 기존 클릭 영역 44px 유지. 접힌 Panel 전체 높이는 border 포함 약 47px.
Body padding: 12px 14px.
Summary Row padding: 10px 0, 값 위 margin 3px.

[구분감]
선택 Option과 구분: 개선. Stone Header, 명확한 외곽선, 2px Accent, 큰 Radius, 미세한 Shadow.
Bottom Navigation과 구분: 개선. Summary는 밝은 Neutral 읽기 영역, 기존 Navigation 외형은 그대로.
색상 외에도 Border/Accent/Typography/Divider로 경계를 표현.
접힘/펼침 Screenshot을 요청된 Compact 7개 크기에서 확인.

[기존 기능]
펼침/접힘: 정상, Enter/Space 포함
선택값 반영: 정상
Count: 정상, 기존 현재 STEP 기준 계산 유지
Sub Step: 정상
자동 넘김: 없음
Preview: 정상
Bottom Navigation: 정상
History/Multi-select/기타/localStorage/미정/STEP 이동/상담서 수정 및 복귀: 기존 회귀 테스트 통과
Normal flow, Grid/Flex 높이 계산, 최대 30dvh, 내부 scroll 규칙: 변경 없음
position/absolute/fixed/z-index 변경 없음
Option Card styling 변경 없음
새 state/data/package 추가 없음

[Responsive]
1100×800: 통과
1024×768: 통과
900×700: 통과
768×1024: 통과
430×932: 통과
390×844: 통과
375×812: 통과
각 크기에서 접힘/펼침, 선택 영역 축소, 마지막 Option 접근, Preview 유지, Navigation 겹침 없음 검증.
3개/5개 현재 STEP 선택 및 8개 프로젝트 선택 fixture 검증.
Screenshot: C:/Users/User/AppData/Local/Temp/bath-summary-style-review/
Chrome/Playwright 검증. 실제 iOS Safari 기기 검증은 수행하지 않음.

[Wide Desktop]
변경: 없음.
1280×720 / 1440×900 / 1920×1080 기존 3-column 검증 통과.
1440px에서 작업 전 CSS와 geometry/background/border/radius/shadow 비교 일치.
Homepage/상담서/Guide 변경 없음.

[Build]
npm run build: 성공, exit 0.
TypeScript/Next.js compile: 성공.
builder-summary-layout.cjs: 성공, exit 0.
builder-compact-browser.cjs: 성공, exit 0.
Git diff --check: 통과.

[변경 파일]
- app/builder-responsive.css
- docs/BUILDER_SUMMARY_DESIGN_REPORT.md
이번 작업에서는 Compact Summary scope 내 Styling만 추가. 기존 변경 사항 보존.
