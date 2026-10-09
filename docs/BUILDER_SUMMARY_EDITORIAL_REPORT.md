[Design Direction]
참고 방향: Warm Minimal / Scandinavian / Editorial.
밝은 Surface, 얇은 Neutral Border, 작은 보조 제목과 문서형 Row를 사용.
기존 갈색 외곽선/2px 상단 강조선/그림자는 제거.
사용자가 제시한 참고 브랜드: [Audo Copenhagen](https://audocph.com/), [FRAMA](https://framacph.com/), [Muuto](https://www.muuto.com/), [Ferm Living](https://fermliving.com/).
참고 방향은 요청의 디자인 원칙을 해석한 것이며 브랜드 UI 복제 없음.

[Colors]
Container: var(--surface) = #FAF8F3.
Header: 기존 --surface 60% + --surface-muted 40% color-mix, 약 #F3EFE8.
Body: var(--surface) = #FAF8F3.
Border: var(--border) = #D9D2C7.
Primary Text: var(--foreground) = #20211F.
Muted Text: var(--muted) = #6D6962.
Accent: var(--accent) = #A65335, Keyboard focus에만 사용.
Accent Tint: 기존 --accent-soft = #F1E5DC. 이번 Panel에는 사용하지 않음.
기존 editorial.css Theme Token 재사용. Root/Global Token 변경 없음.

[Current Selection Header]
Height: 기존 44px touch target 유지. 기존 높이 계산을 보존하기 위해 권장 48px로 확대하지 않음.
Padding: 0 14px.
Title Font: 14px / 600 / Charcoal / letter-spacing:-.01em.
Count: 12px / 500 / Muted. 0개도 동일 muted text, Pill 없음.
Chevron: 기존 Lucide 18px, 회전/동작 유지, Muted color.
375px에서 한 줄 유지, 겹침 없음.

[Container]
Border: 1px Neutral Hairline.
Radius: 10px, 내부 모서리 9px.
Shadow: 없음.
Spacing: 기존 8px Grid gap 유지. 기존 높이 배분/Option/Navigation 위치를 보존하기 위해 Gap 확대 없음.

[Open State]
Header 변화: 기존 Soft Stone 유지, 아래 1px divider만 추가.
Divider: var(--border).
Accent 사용: Focus outline에만 작은 범위 사용. 전체 색상 변경/갈색 outline/Accent line 없음.
Hover: hover:hover + pointer:fine 환경에서만 미세한 Stone 변화.
Transition: background-color/border-color 160ms, reduced-motion에서는 제거.

[Summary]
본문 제목: 12px / 500 / Muted, 과도한 자간 없음.
Label: 12px / 400 / Muted.
Value: 14px / 500 / Charcoal. 기존 미정 inline muted/400 유지.
Divider: 1px Neutral Hairline, Box/Radio/Checkbox 형태 추가 없음.
Body Padding: 14px.
0개: Compact에서 작은 Muted 안내문 '아직 선택한 항목이 없습니다.'만 표시.
기존 Summary 데이터/미정 계산은 유지하며 Desktop은 기존 내용 표시.
새 Data/State 없음. 기존 selectionCount를 표현에만 사용.

[기존 기능]
Toggle: 정상, Enter/Space 포함
Count: 정상, 기존 계산 유지
Selection: 정상, 즉시 반영
Sub Step: 정상
Auto advance: 없음
Preview: 정상
Bottom Navigation: 정상
Single/Multi/History/기타/localStorage/STEP Navigation/상담서 수정 및 복귀: 기존 회귀 테스트 통과

[Layout]
겹침: 없음.
Selection internal scroll: 정상, 마지막 Option 접근 검증.
기존 normal flow/Grid/Flex/최대 높이/Overflow/Position/z-index 규칙 변경 없음.
Preview size/Option Layout/Question/Progress/Bottom Navigation/이미지 변경 없음.

[Responsive]
1100×800: 통과
1024×768: 통과
900×700: 통과
768×1024: 통과
430×932: 통과
390×844: 통과
375×812: 통과
접힘/펼침 Screenshot 검토, Header/Body 계층 및 겹침 없음 확인.
3개/5개 현재 STEP 선택, 8개 프로젝트 선택 fixture 검증.
0개 Compact 안내문과 Desktop 기존 미정 내용 표시 검증.
Screenshot: C:/Users/User/AppData/Local/Temp/bath-summary-editorial-review/
검증 환경: Chrome/Playwright. 실제 iOS Safari 기기 검증은 수행하지 않음.

[Wide Desktop]
변경: 없음.
1280×720 / 1440×900 / 1920×1080 통과.
1440px에서 작업 전 CSS와 주요 패널 geometry/background/border/radius/shadow 비교 일치.
Homepage/상담서/Guide 변경 없음.

[Build]
npm run build: 성공, exit 0.
TypeScript/Next.js compile: 성공.
builder-summary-layout.cjs: 성공, exit 0.
builder-compact-browser.cjs: 성공, exit 0.
Git diff --check: 통과.

[변경 파일]
- app/builder-responsive.css
- components/Configurator.tsx (0개 상태의 표현만 추가)
- docs/BUILDER_SUMMARY_EDITORIAL_REPORT.md
기존 다른 변경사항 보존. 새 Package 설치 없음.
