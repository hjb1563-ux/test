# PHASE 4A.2 — 계정·세션·Fixture 실행 준비

> PHASE 4A.3에서 개인 ACL 폴더와 빈 자격증명 템플릿을 준비했다. 현재 환경은 direct IPv6
> 연결 불가이며 기존 Fixture SQL은 Session Pooler를 거부한다. 실제 값 입력·도구 설치·
> 연결 방식은 [최신 사용자 준비 안내](PHASE4A_3_CREDENTIALS_AND_PSQL.md)를 먼저 확인한다.

대상은 bath-designer-dev / istsrambmbzuemkgutgh만 허용한다.
이번 작업에서 원격 계정/세션/Fixture 생성, Auth 변경, RLS 실행, 프로그램 설치는 하지 않았다.

## 현재 상태와 파일

읽기 전용 GET /auth/v1/settings 결과 Anonymous=true, Email=true,
mailer_autoconfirm=false(이메일 확인 유지), disable_signup=false다.
이전 PHASE4A 문서의 Anonymous=false 기록은 과거 상태다. 이번에는 설정을 바꾸지 않았다.
향후 비활성으로 바뀌면 스크립트가 멈추며 개발 Dashboard → Authentication →
Sign In / Providers → Anonymous Sign-Ins에서 사용자가 직접 확인한다.

Node v24.20.0, CLI 2.121.0. psql 미발견. 시스템 프로그램은 설치하지 않았다.
새 파일:
- supabase/tests/phase4a2-sessions.mjs: 기본 GET-only 사전 점검, 명시적 계정 생성/갱신 모드
- supabase/tests/phase4a2-sessions.test.mjs: 전체 fetch를 대체하는 오프라인 보안 검증
- supabase/tests/.env.example: 비밀값 없는 설정 이름 예시
기존 RLS 실행기/Fixture/권한 검증 SQL/Migration은 변경하지 않았다.

## 사용자 준비 항목

1. 사용자가 관리하는 전용 이메일/alias 네 개와 전용 비밀번호를 준비한다.
   BUSINESS_A, BUSINESS_B, GENERAL, PENDING 주소는 모두 달라야 한다.
   실제 고객 계정/주소 재사용, 임의 타인의 실주소 생성은 금지한다.
   비밀번호는 최소 12자이며 실제 프로젝트의 비밀번호 정책도 충족해야 한다.
   이메일 소유 여부를 서버가 기술적으로 증명하는 도구는 아니므로 운영자가 먼저 확인한다.
2. 개발 프로젝트의 publishable 키와 서버용 secret/service_role 키를 비밀 저장소에서 공급한다.
   Management token은 가능하면 이 개발 프로젝트 조회만 가능한 짧은 수명·최소 범위의
   scoped access token을 사용한다. 자동 발급/권한 확대는 하지 않는다.
3. Windows의 개인 파일 ACL이 적용된 보관 디렉터리를 준비한다.
   아래 경로는 기존 .gitignore의 tests/artifacts/ 및 .env.* 패턴에 포함됨을 확인했다.
   Git ignore는 암호화/접근 제어를 대신하지 않는다.
4. psql 15+와 direct DB 연결/TLS CA를 준비한다. 아래 Fixture 항목 참조.

토큰·비밀번호·관리자 키를 채팅, 셸 명령 인수, transcript, 로그, NEXT_PUBLIC_*에 넣지 않는다.
개발 PC의 암호화된 디스크/사용자 전용 ACL과 비밀 저장소를 권장한다.
대량 환경 출력(Get-ChildItem Env: 등)이나 CLI debug 출력도 하지 않는다.

개인 보관 경로 예시: tests/artifacts/phase4a2/
운영자가 PowerShell에서 폴더를 만든 뒤 다음과 같이 ACL을 제한하고 직접 확인한다.
이 명령들은 안내만 작성했으며 이번에는 실행하지 않았다.

```powershell
New-Item -ItemType Directory -Force tests/artifacts/phase4a2 | Out-Null
$principal = [Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls tests/artifacts/phase4a2 /inheritance:r /grant:r "${principal}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F'
icacls tests/artifacts/phase4a2
```

실행 계정이 바뀌면 권한도 재검토한다. ACL 확인 후에만 아래 확인값을 설정한다.
POSIX mode 0600도 지정하지만 Windows의 보호는 실제 ACL에 달려 있다.
기존 열린 세션/동기화 폴더 공유/백업 접근권도 사용자가 점검해야 한다.

## 스크립트 모드와 실제 Auth 절차

새 스크립트는 SDK 추가 설치 없이 Node fetch로 Auth API를 호출한다.
signInAnonymously() 함수는 SDK와 같은 /auth/v1/signup 요청으로 실제 익명 세션을 받는다.
JWT를 만들거나 관리자 토큰을 사용자 토큰으로 대체하지 않는다.
기본 --check는 GET만 수행하고 사용자/세션/파일을 생성하지 않는다.
--create와 --refresh는 후속 승인을 받은 뒤에만 실행한다.

- --check: 정확한 URL/확인 문자열, live Management 프로젝트 이름·Ref·host·상태,
  Auth 설정, 관리자 Data API SELECT, 네 전용 이메일 중복/비밀번호 입력을 확인한다.
  이메일 존재 여부나 소유권을 확인하기 위해 로그인/가입을 시도하지 않는다.
  실제 전용 계정이 없으므로 전체 RLS preflight와는 다른 단계다.
- --create: 명시적 확인값을 요구하고 기존 state/manifest가 있으면 재생성을 거부한다.
  먼저 fixture_id를 디스크에 기록한다. CUSTOMER_A/B는 각각 독립된 익명 가입으로 만든다.
  관리자는 그 UID의 app_metadata.bath_rls_fixture를 설정한다.
  나머지 네 전용 Email 사용자는 관리자 createUser(email_confirm:true)로 준비하고,
  각각 별도의 password login을 반드시 수행한다. 전역 Email 확인 설정은 유지한다.
  이것은 전용 테스트 주소에 대한 운영자 확인 방식이며 일반 사용자의 이메일 확인을
  건너뛰는 제품 기능이 아니다. 기존 주소가 이미 있으면 생성 오류로 중단하고 채택하지 않는다.
- --refresh: 기존의 complete=true 상태에서 전용 표식/UID/익명 여부를 먼저 확인한다.
  고객 둘은 보관한 refresh token으로 갱신, 정식 넷은 각자 password login으로 재발급한다.
  아무 사용자를 새로 만들지 않는다. 미완료/불명확한 state에서는 자동 재시도하지 않는다.

모든 계정에 대해 actual /user와 관리자 Auth 조회, issuer/sub/role/exp/is_anonymous,
정식 사용자의 이메일·email_confirmed_at를 확인한다. UID 6개가 달라야 하며 UUID v4여야 한다.
만료/60초 이내 만료 예정 토큰은 거부한다. 관리자 app_metadata가 전용 표식의 근거이고,
익명 가입 때의 user_metadata 표식은 응답 유실 시 수동 검색 힌트일 뿐이다.
작업 폴더의 exclusive preparation.lock이 동시 실행을 막는다.
CAPTCHA/MFA/비밀번호 정책 등으로 실제 Auth가 거부하면 실패로 중단한다.
현재 도구에는 CAPTCHA/MFA 자동 해결 기능이 없으며 설정을 완화하지 않는다.

## 비밀 파일과 13개 환경변수 연결

입력 비밀 파일 예시: tests/artifacts/phase4a2/credentials.env.local
supabase/tests/.env.example을 비밀 폴더로 복사해 사용자 편집기로 값을 채운다.
예시 파일 자체에는 실제 값을 넣지 않는다.

계정 준비용 추가 변수:
- BATH_TEST_BUSINESS_A_EMAIL / BATH_TEST_BUSINESS_A_PASSWORD
- BATH_TEST_BUSINESS_B_EMAIL / BATH_TEST_BUSINESS_B_PASSWORD
- BATH_TEST_GENERAL_EMAIL / BATH_TEST_GENERAL_PASSWORD
- BATH_TEST_PENDING_EMAIL / BATH_TEST_PENDING_PASSWORD
- BATH_TEST_EMAILS_CONFIRM=owned-dedicated-test-addresses
- BATH_TEST_SECRET_STORAGE_CONFIRM=private-acl-verified
- BATH_TEST_ACCOUNT_CONFIRM=create-six-dedicated-users (--create만)

원래 RLS 실행기 13개와의 매핑:

| 변수 | 공급 위치 |
|---|---|
| BATH_TEST_SUPABASE_URL | 출력 세션 env: 정확한 개발 URL |
| BATH_RLS_TEST_CONFIRM | 출력 세션 env: bath-designer-dev |
| BATH_TEST_PUBLISHABLE_KEY | 출력 세션 env: 입력한 개발 public 키 |
| BATH_TEST_ADMIN_KEY | 운영자 입력 파일/프로세스 환경만, 출력 파일에 복사하지 않음 |
| BATH_TEST_MANAGEMENT_TOKEN | 운영자 입력 파일/프로세스 환경만, 출력 파일에 복사하지 않음 |
| BATH_TEST_FIXTURE_FILE | 출력 세션 env: tests/artifacts/phase4a2/fixture.json |
| BATH_TEST_JOURNAL | 출력 세션 env: 새 tests/artifacts/phase2-run-UUID.json |
| BATH_TEST_CUSTOMER_A_TOKEN | 실제 익명 세션 A access token |
| BATH_TEST_CUSTOMER_B_TOKEN | 실제 익명 세션 B access token |
| BATH_TEST_BUSINESS_A_TOKEN | 실제 password 로그인 A access token |
| BATH_TEST_BUSINESS_B_TOKEN | 실제 password 로그인 B access token |
| BATH_TEST_GENERAL_TOKEN | 실제 password 로그인 일반 사용자 access token |
| BATH_TEST_PENDING_TOKEN | 실제 password 로그인 미승인 사용자 access token |

출력 파일(모두 private/ignored):
- sessions.json: fixture_id, 실제 UID, access/refresh token, complete, pending.
  관리자 키/Management token/비밀번호는 저장하지 않는다. 토큰은 평문이므로 ACL/디스크 보호 필수.
- fixture.json: project_ref, fixture_id, users(6 actor→실제 UID),
  businesses(A/B/SUSPENDED→새 UUID), members(A/B/PENDING/ANONYMOUS/SUSPENDED/REVOKED→새 UUID).
  원래 phase2-rls.mjs의 manifest와 동일하다. 모든 UUID의 전역 중복도 검사한다.
- .env.sessions.local: 세션 등 11개 변수. 위 관리자/Management 두 변수를 합쳐 정확히 13개다.

Management token은 프로젝트 조회 HTTPS 요청 하나에만 전달하고 세션/manifest/journal에
복사하지 않는다. 단, 원래 RLS 실행기도 live 대상 확인을 위해 같은 환경변수를 요구하므로
테스트 때까지는 운영자 경로에서 안전하게 공급해야 한다. 사용 후 프로세스 환경과
일시 비밀 파일에서 제거하고 노출 의심 시 폐기한다. CLI 로그인과 별개의 자격증명이다.

Node --env-file은 이미 존재하는 프로세스 환경변수를 덮어쓰지 않는다.
기존 토큰이 남아 있지 않은 새 PowerShell에서 실행하고, 실제 입력/세션 파일을 콘솔로
출력하지 않는다. 파일을 여러 개 지정하면 뒤의 세션 파일이 앞 파일의 빈 세션 항목을 대체한다.

## 실패·중단 후 복구

각 원격 Auth 요청 직전에 pending actor/operation을 기록하고, 응답 UID/회전 토큰을 받은
즉시 상태를 fsync 후 atomic replace한다. 오류 메시지는 응답 본문·자격증명을 출력하지 않는다.
네트워크 타임아웃으로 서버에서 생성됐지만 응답을 못 받은 계정은 남을 수 있다.
아직 알려지지 않은 UID를 자동으로 지우거나 새 계정을 반복 생성하지 않는다.
관리자가 private pending, fixture_id, 생성 시각, 자신이 제공한 전용 주소,
익명 user_metadata의 bath_rls_attempt/bath_rls_actor를 이용해 읽기 전용으로 조사한다.
전용 계정임을 실제로 확인한 뒤 세션 회복 또는 개별 삭제를 별도 승인된 절차로 수행한다.

state가 미완료이면 --create/--refresh는 재개하지 않고 멈춘다. 부분 실패 자동 재개는 제공하지
않는다. 스크립트가 만든 계정을 기록 없이 삭제하거나 state를 지워 재생성하지 않는다.
강제 종료로 남은 preparation.lock은 다른 실행이 없는지와 state를 확인한 운영자만 제거한다.
기존 세션 env는 갱신 실패 시 남아 있을 수 있으므로 실패 후 테스트를 진행하지 않는다.
초기 파일 쓰기/교체 중 디스크 오류에는 완전한 자동 복구를 보장할 수 없다.
정상 완료 전 Fixture와 RLS 테스트로 넘어가지 않는다.

## Fixture 실행 준비

기존 phase2-fixtures.sql은 psql 15+의 메타 명령을 사용한다.
[PostgreSQL 공식 Windows 배포](https://www.postgresql.org/download/windows/)에서
사용자가 승인해 클라이언트 도구를 설치하거나 이미 준비된 psql을 사용할 수 있다.
이번에는 설치하지 않았다. psql --version으로 15+인지 확인한다.
SQL Editor/CLI db query에 psql 파일을 그대로 실행하지 않는다.

기존 PHASE2_6_RLS_RUNBOOK.md의 변수 매핑/psql 명령을 그대로 재사용한다.
실제 manifest로 customer_a/b, business_a_user/b_user, general_user, pending_user,
업체/멤버십 UUID를 전달한다. Management API 대상 확인 후 direct host
db.istsrambmbzuemkgutgh.supabase.co, PGSSLMODE=verify-full, 신뢰할 PGSSLROOTCERT를 사용한다.
DB 비밀번호는 안전한 pgpass/비밀 저장소로 공급한다.
direct host 통신·CA·비밀번호는 아직 실제 검증하지 않았다. pooler로 guard를 우회하지 않는다.

생성 예정: 업체 3개(A/B approved, SUSPENDED suspended), 멤버십 6개.
멤버십은 A 담당자 approved, B 담당자 approved, PENDING pending,
익명 A approved(익명 권한 상승 차단용), 정지 업체의 A approved, A 업체의 B revoked다.
GENERAL과 익명 B는 멤버십 없음. 계정 생성/로그인만으로 업체 역할이 부여되지는 않는다.
전용 프로젝트는 Fixture가 아니라 기존 RLS --run에서 생성하고 정리한다.
service_role INSERT 없이 postgres로 Fixture를 준비하며, 사용자의 RLS 판정에는 public 키와
실제 각 사용자 세션만 쓴다.

테스트 종료 후: 기존 --cleanup으로 실행 프로젝트·예상 밖 INSERT 행 정리 및 role/status
복원을 확인한다. baseline 업체 3개/멤버십 6개와 Auth 사용자 6개는 자동 삭제하지 않는다.
원래 runbook의 정확한 ID/표식·CASCADE 영향 확인 후 별도 승인된 철거 절차가 필요하다.
원본 업무 필드와 불변 필드를 구분하고 revision/updated_at를 되감지 않는 기존 안전장치를 유지한다.

## 명령 순서 (후속 승인 후에만 쓰기 모드 실행)

프로젝트 루트, 비밀 파일/ACL 준비 후:

```powershell
node --check supabase/tests/phase4a2-sessions.mjs
node supabase/tests/phase4a2-sessions.test.mjs
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a2-sessions.mjs --check
# 후속 승인된 실제 계정 생성:
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a2-sessions.mjs --create
# 생성 완료 후, 필요 시 세션 갱신:
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a2-sessions.mjs --refresh
# 기존 runbook의 psql Fixture 절차 완료 후:
node --env-file=tests/artifacts/phase4a2/credentials.env.local --env-file=tests/artifacts/phase4a2/.env.sessions.local supabase/tests/phase2-rls.mjs --preflight
# 별도 승인된 실제 RLS 테스트:
node --env-file=tests/artifacts/phase4a2/credentials.env.local --env-file=tests/artifacts/phase4a2/.env.sessions.local supabase/tests/phase2-rls.mjs --run
```

--refresh는 새 RLS journal 경로를 내보낸다. 이전 실행이 실패했다면 먼저 이전 journal
경로를 별도로 보존하여 --cleanup하고, 실패 기록을 새 journal로 덮지 않는다.
계정 준비 스크립트는 Fixture/RLS 실행기를 자동 호출하지 않는다.

## 이번 검증 범위

- 두 새 JS 파일과 기존 RLS 실행기의 node --check.
- 8개 오프라인 mock 시나리오: 정상 생성/갱신/재생성 거부, 잘못된 대상, Anonymous 비활성,
  중복 이메일, 중복 UID, 만료 토큰, 미확인 Email, 네트워크 응답 유실.
- 모의 --check GET-only 및 잘못된 대상/설정에서 쓰기 0회 확인.
- 모의 토큰·관리자 키·비밀번호가 로그에 노출되지 않음, 출력 env에 고권한 비밀값 미포함 확인.
- 출력 env 11개 + 운영자 변수 2개가 원래 실행기의 13개와 정확히 일치.
- 실제 Auth GET/DB 카탈로그 조회만 수행. --create/--refresh, Fixture, 실제 RLS는 실행하지 않음.
- 실제 사용자 비밀값, 소유한 주소, private ACL, psql/TLS 준비가 없어 실제 세션 --check도
  아직 실행하지 않았다. 오프라인 검증은 실제 Auth 통합 검증을 대신하지 않는다.

공식 Auth 참고:
[Anonymous](https://supabase.com/docs/reference/javascript/auth-signinanonymously),
[password 로그인](https://supabase.com/docs/reference/javascript/auth-signinwithpassword),
[admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[refreshSession](https://supabase.com/docs/reference/javascript/auth-refreshsession).

