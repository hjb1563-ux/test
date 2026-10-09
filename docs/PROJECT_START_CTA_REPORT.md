[Project Start CTA]
Button Label: 욕실 만들기 시작.
Button Type: button.
Click Handler: saveProjectInfo → 기존 normalizeProjectInfo/hasProjectInfo 검증 → onSave.
기존 Primary button class 재사용, ArrowRight 아이콘 추가.
모바일에서 공통 navButtons 숨김 규칙을 projectInfoForm scope로만 해제하고 CTA full width/48px 적용.
프로젝트 정보 화면은 STEP이 아니며 STEP 01 / 16 그대로 유지.

[Enter]
고객명 Input Enter: STEP 이동 없음.
프로젝트명 Input Enter: STEP 이동 없음.
Form submit: preventDefault만 수행, 저장/검증/이동 실행 없음.
한글 IME: keydown을 가로채지 않음. isComposing Enter 합성 이벤트의 defaultPrevented=false 및 텍스트 유지 검증.
실제 Windows/iOS 한글 IME 기기 입력은 수행하지 않음.
Button Focus + Enter: 정상.
Button Focus + Space: 정상.
Tab: 고객명 → 프로젝트명 → CTA 순서 확인.

[Validation]
둘 다 Empty: 시작 불가, Inline 안내.
표시 문구: 고객명 또는 프로젝트명 중 하나를 입력해주세요.
고객명만: 시작 가능.
프로젝트명만: 시작 가능.
둘 다: 시작 가능.
Space만 입력: trim 후 유효하지 않은 값으로 판단.
입력 변경 후 안내 제거: 기존 동작 유지.
Modal/Alert 없음. 13px / 기존 accent color 적용.
Placeholder 값/문구/길이 제한 유지.

[Anonymous]
자동 익명 생성: 없음.
Fallback projectName 저장: 없음.
Customer-only derived display: 기존 projectLabel의 '홍길동님의 욕실' 유지.
고객명만 입력하면 projectName은 실제 빈 문자열 그대로 저장.
프로젝트명만 입력하면 customerName은 실제 빈 문자열 그대로 저장.

[기존 기능]
localStorage: 정상, 기존 schema/저장 정책 유지.
STEP: 정상, 16개 유지.
Selections: 정상.
상담서: 정상, 기존 단위 테스트에서 정보 표시/복사/Print 정책 검증.
수정 모드 CTA: 기존 '프로젝트 정보 저장' 유지.
STEP08에서 수정 후 STEP08 복귀: 확인.
수정 후 values/imageHistoryOrder/memo 유지: 확인.
Refresh: 시작 완료 후 프로젝트 입력 화면으로 돌아가지 않음.
Legacy projectInfo 없는 기존 STEP08 데이터: 기존 resume 유지, 단위 테스트 통과.
Preview/Current Selection/History/Sub Step/자동 넘김 없음/건너뛰기/STEP 이동/상담서 복귀: 기존 Builder 브라우저 회귀 테스트 통과.

[Responsive]
Desktop: 1920×1080 / 1440×900 / 1280×720 통과.
Tablet: 1024×768 / 768×1024 통과.
Mobile: 430×932 / 390×844 / 375×812 통과.
모든 크기에서 CTA 보임, 최소 44px, 수평 overflow 없음.
모바일 시작 CTA는 48px, Form width 전체 사용.
Screenshot: C:/Users/User/AppData/Local/Temp/bath-project-start-review/

[Build]
npm run build: 성공, exit 0.
TypeScript/Next.js compile: 성공.
node tests/project-info.cjs: 성공.
project-start-browser.cjs: 성공, exit 0.
builder-compact-browser.cjs: 성공, exit 0.
Git diff --check: 통과.

[변경 파일]
- components/ProjectInfoForm.tsx
- app/builder-responsive.css (프로젝트 정보 Form 전용 규칙)
- tests/project-info.cjs
- tests/project-start-browser.cjs
- docs/PROJECT_START_CTA_REPORT.md
Builder/Consultation data 및 STEP 내부 기타 Placeholder 수정 없음.
기존 next-env.d.ts 변경 보존. 새 package/backend 설치 없음.
