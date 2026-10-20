# 방문자 실제 통합 테스트 CLI Runbook

## 이번 구현의 범위
2026-10-20: 코드 구현·오프라인 검증만 승인된 단계다. 실제 --check/--run은 이번에 실행하지 않았다. Supabase는 MCP 읽기 SELECT로 작업 전후 0행만 확인했다. 새 SQL·권한·환경변수·배포 변경은 없다.

- 공개 Route → server/visitors.ts: 기존 visitorCounterEnabled 검사 후에만 내부 처리기 호출.
- server/visitor-core.ts: 동일 Origin/헤더/본문/쿠키/날짜/응답 처리. Production 우회 인자 없음.
- server/visitor-rpc.ts: 동일 URL·apikey·HTTPS 기본 검증·redirect:error·no-store·5초 타임아웃·응답 검증.
- tests/visitor-live/: 로컬 전용 Node 실행기. HTTP listener/공개 엔드포인트 없음. NODE_ENV=production, VERCEL/VERCEL_ENV, CI에서는 거부.
- NODE_ENV/VERCEL_ENV는 실행기가 설정하지 않는다. --conditions=react-server는 Node에서 server-only 패키지의 실제 서버 export를 로딩하는 조건이며 Production 환경변수 위장이 아니다. 제품 파일의 server-only 표식은 제거하지 않는다.
- .vercelignore에서 실행기, 안전장치 테스트, private artifacts, .env 파일을 제외한다. app/server/components는 테스트 실행기를 import하지 않는다.

## 모드
|명령|로컬 변경|네트워크/DB|
|---|---|---|
|기본 또는 --plan|없음|0건, 승인되지 않은 템플릿을 화면에 출력|
|--prepare|현재 사용자+SYSTEM 보호 폴더와 approved:false 승인 템플릿 생성|0건|
|--inspect --journal 경로|기존 journal의 상태만 읽기|0건, 재시도/복구 쓰기 없음|
|--check --credentials 경로|없음|프로젝트 GET, 전용 read-only SQL API로 집계/권한 조회, 권한 없는 조회 거부 확인, 서버 키 조회. 등록 RPC 호출 없음|
|--run --approval 경로 --credentials 경로|잠금, DPAPI 복구 자료, journal|별도 승인 후 실제 등록 최대 5요청, 두 해시·한 날짜·집계 2건만 허용|

이하 실제 실행 순서는 구현 검토 및 실제 쓰기 승인을 받은 후에만 사용한다. 이번에는 자동 실행하지 않았다.

## 1. 작업 위치와 오프라인 검사
```powershell
Set-Location 'C:\Users\User\Desktop\Bath-Design-visitor-verification'
node tests/visitor-live/runner.mjs --plan
node --test tests/visitors.cjs tests/visitors-verification.cjs
node --conditions=react-server --test tests/visitor-live-safety.test.mjs
npm.cmd run build
node tests/visitor-live/verify-build.mjs
```
전체 검증은 오프라인이다. Node 실제 네트워크는 --check 또는 승인된 --run에서만 시작된다. 일반 테스트/빌드는 CLI main을 호출하지 않는다.

## 2. 실제 실행 전 읽기 확인
기존 보호 파일을 복사하거나 ACL을 바꾸지 않는다. 세 이름만 읽는다: BATH_TEST_ADMIN_KEY(sb_secret), BATH_TEST_PUBLISHABLE_KEY, BATH_TEST_MANAGEMENT_TOKEN. 실제 값을 대화/명령행 인수/보고서에 넣지 않는다.
```powershell
node --conditions=react-server tests/visitor-live/runner.mjs --check --project-ref istsrambmbzuemkgutgh --credentials 'C:\Users\User\Desktop\Bath Design\tests\artifacts\phase4a2\credentials.env.local'
```
- Management 프로젝트명 bath-designer-dev, Ref, DB host, ACTIVE_HEALTHY를 모두 확인한다.
- https://api.supabase.com/v1/projects/{ref}/database/query/read-only 에 고정 SELECT만 전송한다. 메서드는 POST이지만 SELECT를 read-only DB 역할로 실행하는 조회이며 방문 등록 POST가 아니다.
- 참조: https://supabase.com/docs/reference/api/v1-read-only-query
- 해당 토큰 또는 read-only DB 역할이 metrics 테이블/메타데이터를 읽을 수 없으면 401/403 등으로 중단한다. writable query endpoint, 권한 확대, 제공된 수동 결과 파일로 우회하지 않는다.
- 따라서 실제 자격증명으로 --check가 성공하는지는 다음 단계에서 확인해야 한다. 이번 오프라인 성공으로 이를 성공이라고 보고하지 않는다.

## 3. 승인 템플릿과 조건
```powershell
node tests/visitor-live/runner.mjs --prepare
```
생성 위치: 이 worktree의 tests/artifacts/visitor-live/approval.json. approved:false, exclusiveWindowConfirmed:false가 기본이다. 기존 파일이 있으면 덮어쓰지 않는다.

실제 쓰기를 승인받은 후 사용자가 다음 사항을 확인·입력한다.
- approved:true / exclusiveWindowConfirmed:true
- projectRef 정확히 istsrambmbzuemkgutgh
- 기록할 한국 날짜 day 및 1시간 이내 expiresAt
- 최신 sourcesSha256: --plan 결과와 일치해야 한다. 제품 내부 모듈, Route, CLI, .vercelignore 내용에 묶인다.
- 한 날짜·두 방문자·두 해시·집계 2건·등록 요청 최대 5회 제한은 수정하지 않는다.
- runId는 템플릿의 UUID를 유지한다. 새 runId로 실패한 실행을 우회하지 않는다.
- 다른 프로세스의 등록 작업이 없고 테스트 시간대를 독점 사용할 수 있는지 확인한다. 확인할 수 없으면 실행하지 않는다.

편집기가 파일을 새로 저장하면 ACL 상속이 다시 켜질 수 있다. CLI가 현재 사용자와 SYSTEM만의 명시적 ACL 및 상속 해제를 확인하며, 맞지 않으면 실행하지 않는다. ACL 재설정이 필요하면 이 새 승인 파일 하나에만 적용한다. 기존 credentials ACL은 변경하지 않는다.

## 4. 승인된 실제 실행
다음 환경변수는 해당 PowerShell 프로세스에만 설정한다. Vercel/루트 .env/브라우저 환경에 등록하지 않는다.
```powershell
$env:BATH_VISITOR_LIVE_TEST_APPROVED = 'istsrambmbzuemkgutgh'
try {
  node --conditions=react-server tests/visitor-live/runner.mjs --run --project-ref istsrambmbzuemkgutgh --approval 'C:\Users\User\Desktop\Bath-Design-visitor-verification\tests\artifacts\visitor-live\approval.json' --credentials 'C:\Users\User\Desktop\Bath Design\tests\artifacts\phase4a2\credentials.env.local'
} finally {
  Remove-Item Env:BATH_VISITOR_LIVE_TEST_APPROVED -ErrorAction SilentlyContinue
}
```
이 단계는 아직 승인 전이다. 실제 등록을 이 Runbook 작성이나 빌드와 함께 실행하지 않는다.

실행 순서:
1. 승인/최신 소스/한국 날짜 확인, read-only 사전 검사, 공개 키 조회 거부 확인.
2. 전역 로컬 잠금 획득. 이전 journal/복구 자료가 있으면 새 실행 거부.
3. A/B 2개 ID와 서명키를 메모리 생성. Windows 사용자에 묶인 DPAPI 암호문으로 복구 자료를 보존.
4. DB 전체 days/visits 0행 재확인, journal 선기록.
5. A 직접 RPC 최초=1, A 직접 RPC 반복=1.
6. 공유 처리기로 동일 A 쿠키 반복=1.
7. 공유 처리기로 B 쿠키를 발급한 뒤 B 최초=2.
8. B 직접 RPC 반복=2, 조회=2, DB 날짜 1행·해시 2행·합계 2 비교.
9. 잘못된 Origin/쿠키를 같은 공유 처리기에 넣어 RPC 미도달 거부 확인. 최종 읽기 검사 후 완료 journal 기록.

각 등록 직전/직후 DB 상태가 예약 해시의 예상 집합과 정확히 같은지 확인한다. 원시 해시·Secret·쿠키값은 로그나 journal에 기록하지 않는다. journal에는 A/B 슬롯명, 요청 순서, 상태, HTTP 코드, 집계만 남긴다. 로그는 승인/코드 오류명과 집계만 표시하며 upstream 본문/헤더/stack을 출력하지 않는다.

## 5. 중단과 복구
- 예기치 못한 오류/응답 유실/DB 상태 변화/한도 초과/승인 철회/날짜 변경/journal 실패 시 추가 등록 중단.
- 재시도 옵션이나 resume 쓰기 기능은 없다. 이전 journal 또는 DPAPI 파일이 있으면 --run은 거부한다.
- intent 기록 직후 프로세스가 죽으면 완료 여부가 불명확하다. --inspect는 intent도 unknown으로 센다.
- 잠금이 남아 있으면 자동 제거하지 않는다. 이전 프로세스 종료, in-flight 요청 종료, 읽기 전용 DB 결과와 journal 대조 후 별도 복구 판단이 필요하다.
- 일부 등록만 성공해도 그대로 보존한다. Auth 삭제·CASCADE·집계 초기화·DELETE 정리는 하지 않는다.
- 성공 시에도 테스트 날짜 행과 두 해시는 개발 검증 기록으로 남는다. 날짜가 지난 뒤 새 등록 함수가 해시를 정리할 수 있으나 이번 CLI는 새 날짜 기록을 허용하지 않는다.
```powershell
node tests/visitor-live/runner.mjs --inspect --journal '보호 폴더 내 해당 실행의 .journal.json 전체 경로'
```
inspect는 상태만 출력한다. 복구 자료를 평문으로 출력하는 명령은 제공하지 않는다.

## 6. 한계
- 로컬 잠금은 같은 폴더를 사용하는 CLI끼리만 보호한다. 다른 서버·사용자의 DB 쓰기를 완전히 막지 못한다. 전후 조회 사이의 경쟁 구간도 남는다. 독점 실행 확인을 요구하지만 DB 전체의 외부 쓰기까지 원자적으로 제한한다는 보장은 하지 않는다.
- 현재 DB 등록 함수에는 오래된 방문 해시 정리가 있다. 그래서 전체 테이블 0행을 처음에 요구하고, 실행 중 예약된 당일 기록 외의 데이터가 보이면 중단한다. 기존 데이터가 있는 환경에 이 CLI를 사용하지 않는다.
- 자정 직전 5분을 금지하고 승인한 한국 날짜가 바뀌면 중단한다. 실제 다음 날짜 등록은 별도 승인 범위다.
- A: 실제 HTTPS RPC/권한/집계. B: 운영과 같은 공유 내부 처리 + 실제 RPC. B의 Request/Response는 메모리이며 HTTPS 네트워크/Next Route 활성화 성공이 아니다.
- C: 실제 배포된 HTTPS Next API E2E는 이번 CLI에서 실행하지 않는다.
- 익명 사용자/고객 프로젝트는 생성하지 않는다. 기존 쿠키 서버 TTL 한계·남용 방어 정책도 변경하지 않는다.

## 배포 제외 검증
`.vercelignore`에 로컬 실행기/자격증명 경로를 명시했다. `verify-build.mjs`는 브라우저 JS/map, 로컬 Next 서버 번들, .nft.json 함수 추적에서 실행기·자격증명·승인/journal 경로가 포함되지 않는지 검사한다. 이것은 Vercel이 참조할 로컬 빌드 추적 확인이며 실제 Vercel 빌드/배포 산출물 검사라고 과장하지 않는다. 실행기는 Production 번들에서 import하지 않는다.

## 이번 오프라인 검증 결과
- 기존 방문자 20개를 포함한 저장·Builder 안전장치 Node 테스트 106 PASS.
- 신규 CLI 안전장치 42 PASS: 승인/파일 누락/잘못된 Ref/예산/변경된 함수·권한/소스 버전/날짜/단독 실행 확인/journal 실패/응답 유실/부분 성공/외부 쓰기/승인 철회/이전 기록/잠금/ACL/DPAPI.
- 기존 Chrome 쿠키 Mock 통합 시나리오 통과. 실제 원격 등록 성공으로 분류하지 않는다.
- 기존 모드·천장·프로젝트 정보·상담서 회귀 검사 통과, npm run typecheck 및 npm run build 성공.
- 로컬 빌드 브라우저 JS/map 32개, Next .nft 추적 12개, 서버 app 번들 20개에서 로컬 실행기/테스트 자격증명 경로·값 패턴 노출 0건. 자동 스캔은 모든 유출 가능성을 보장하지 않는다.
- Production 활성화 함수 본문과 공개 Route 두 파일이 원본 커밋과 같은지 자동 검증 통과.
- 실제 --check, --prepare, --run 미실행. 정상 계획(--plan)과 미승인 실행 차단만 실행했고, 승인된 실행 전체는 가짜 자격증명과 Mock RPC/DB로만 검증했다. 파일 I/O·ACL·DPAPI는 새 임시 폴더에서 확인 후 정리했다.
- Supabase MCP SELECT 기준 작업 전후 days=0, visits=0, sum(total)=0. 실제 등록 POST·DB 쓰기·삭제는 없었다.
- 실제 승인 파일/journal/복구 자료는 생성하지 않았다. 기존 미커밋 UI worktree 및 기존 검증 기록을 보존했다. Commit/Push/병합/배포/환경변수 변경 없음.
