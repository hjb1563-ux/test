# PHASE 2.6 — RLS 테스트 및 적용 준비

> 고객 A/B만 분리한 HTTPS 전용 경로는 [PHASE 4B-1](PHASE4B_1_CUSTOMER_RLS.md)을 참고한다.
> 기존 업체 Fixture 및 backend_ssl 검사는 그대로 유지한다. 실제 실행은 별도 승인 대상이다.

> PHASE 4A 최신 점검: Anonymous Auth 비활성 및 service_role의 DB CRUD 권한 부족으로
> 현재 실행 불가. [최신 준비 상태와 승인 필요 보완](PHASE4A_RLS_READINESS.md)을 먼저 확인한다.
> 아래 PHASE 2.6의 CLI/DB 상태는 당시 기록이다. 기존 테스트 코드는 변경하지 않았다.

이 문서는 실행 준비 자료다. 이번 작업에서 Migration, 원격 Fixture, Auth 사용자 생성,
DB 변경, 배포, Commit/Push는 수행하지 않았다. 다음 원격 쓰기 작업은 별도 승인 후 진행한다.

## 현재 확인 결과 (2026-10-16, 한국 시간)

- 읽기 전용 Management 조회: `bath-designer-dev`, `istsrambmbzuemkgutgh`, Seoul,
  `ACTIVE_HEALTHY`, DB host `db.istsrambmbzuemkgutgh.supabase.co`.
- 연결된 MCP의 API URL도 `https://istsrambmbzuemkgutgh.supabase.co`로 확인했다.
- 읽기 전용 `to_regclass` 조회에서 `projects`, `businesses`, `business_members` 모두 NULL.
  실제 RLS 통합 테스트는 실행하지 않았다.
- Node.js `v24.20.0`. PATH에서 Supabase CLI와 psql을 찾지 못했다.
- `supabase/config.toml` 없음. CLI 설치/초기화/링크는 수행하지 않았다.
- Migration 파일명 `20261016000100_phase2_core.sql`은 14자리 timestamp 규칙에 맞는다.
  CLI 자체의 파일 인식 및 원격 Migration 이력 조회는 아직 하지 않았다.
- Migration SHA256: `C99789E769FB09D810D599A074034A6E58925B95DD644D8ACF2AE5C7DE389C7F`.
  기존 CASCADE, JSONB CHECK, schema_version=3, RLS, GRANT/REVOKE, 트리거를 변경하지 않았다.
- 작업 전부터 `docs/PHASE1_5_GAP_RESOLUTION.md`, `docs/PHASE2_DATABASE_DESIGN.md`,
  `supabase/`는 untracked였다. 이 사용자 작업을 그대로 유지했다.

## 실행 경계와 필수 설정

테스트 실행기는 UI에 import하지 않는 Node 전용 도구다. 외부 의존성이 없다.
기본 실행은 읽기 전용 `--preflight`다. `--run`만 테스트 데이터를 변경한다.
`--cleanup`은 관리자 정리 전용이며 사용자 토큰 없이 실행할 수 있다.

환경변수는 비밀 저장소 또는 현재 터미널에서만 설정한다. 브라우저, NEXT_PUBLIC 변수,
Git, 문서, 로그에 토큰/키를 저장하지 않는다. 로컬 manifest/journal은 이미 ignore된
`tests/artifacts/`에 보관하고 Windows 파일 ACL도 해당 운영자에게 제한한다.

| 환경변수 | 값 / 용도 |
|---|---|
| BATH_TEST_SUPABASE_URL | `https://istsrambmbzuemkgutgh.supabase.co` 정확히 일치 |
| BATH_RLS_TEST_CONFIRM | `bath-designer-dev` |
| BATH_TEST_PUBLISHABLE_KEY | 해당 프로젝트 publishable 또는 legacy anon 키 |
| BATH_TEST_MANAGEMENT_TOKEN | 지정 프로젝트 조회 권한이 있는 운영자 Management access token |
| BATH_TEST_ADMIN_KEY | 해당 개발 프로젝트의 서버 전용 secret/service_role 키. 준비·관찰·복원·정리에만 사용 |
| BATH_TEST_FIXTURE_FILE | 로컬 manifest JSON 경로 |
| BATH_TEST_JOURNAL | `tests/artifacts/` 바로 아래의 새 JSON 경로. 기존 파일 덮어쓰기 금지 |
| BATH_TEST_CUSTOMER_A_TOKEN / CUSTOMER_B_TOKEN | 서로 다른 실제 Anonymous Auth access token |
| BATH_TEST_BUSINESS_A_TOKEN / BUSINESS_B_TOKEN | 서로 다른 정식 사용자 access token |
| BATH_TEST_GENERAL_TOKEN | 멤버십 없는 정식 일반 사용자 access token |
| BATH_TEST_PENDING_TOKEN | pending 멤버십을 가진 정식 사용자 access token |

토큰 변수는 모두 `BATH_TEST_` 접두사와 `_TOKEN` 접미사를 사용한다.
로그인하지 않은 `ANON`은 사용자 토큰을 보내지 않는 별도 요청이다.
고객 A/B는 정식 계정이 아니라 Anonymous Auth 사용자이며, 기존 ANONYMOUS 시나리오는
고객 A의 승인 멤버십으로 검증한다. 기존 고객 A/B 영구 계정 Fixture는 재사용하지 않는다.

매 실행마다 HTTPS Management API에서 실제 Ref·이름·DB host·상태를 검증한다.
정확한 Supabase HTTPS origin만 허용하며 redirect는 거부한다.
관리 API 또는 실제 Auth/Data API 확인 실패 시 쓰기 전에 중단한다.
TLS 검증을 무력화하는 Node 옵션/환경, 프록시로 대상 인증을 우회하지 않는다.

## 계정과 manifest 준비 (현재는 실행하지 않음)

별도 승인 후 운영자가 개발 프로젝트에만 테스트 전용 계정 6개를 준비한다.
실제 고객 계정에 테스트 표식을 붙여 사용하지 않는다. Anonymous Auth 활성화 여부와
정식 사용자 로그인 성공을 확인하고 실제 access token과 실제 UID를 확보한다.
사용자 UID를 임의로 생성하거나 auth.users에 직접 INSERT하지 않는다.

운영자는 이 6개 전용 사용자의 **app_metadata**에 `bath_rls_fixture`를 설정한다.
그 값은 아래에서 생성한 fixture_id와 같아야 한다. user_metadata는 전용 계정 확인 근거로
사용하지 않는다. 이 표식은 Fixture 안전성 확인용이며 제품 RLS 권한에는 사용하지 않는다.
계정별 app_metadata와 is_anonymous는 관리자 Auth API에서도 재검증한다.

다음은 기존의 실제 사용자 UID 환경변수 6개를 읽어 manifest를 만드는 로컬 예시다.
아래 USER_ID 변수는 manifest 작성용이며 테스트 실행기의 필수 토큰 변수와 구별한다.

```powershell
$actors = 'CUSTOMER_A','CUSTOMER_B','BUSINESS_A','BUSINESS_B','GENERAL','PENDING'
$users = @{}
foreach ($actor in $actors) {
  $value = [Environment]::GetEnvironmentVariable("BATH_TEST_${actor}_USER_ID")
  if (-not $value) { throw "Missing actual dedicated user UID: $actor" }
  $users[$actor] = ([guid]::Parse($value)).ToString()
}
$fixture = @{
  project_ref = 'istsrambmbzuemkgutgh'
  fixture_id = [guid]::NewGuid().ToString()
  users = $users
  businesses = @{}
  members = @{}
}
foreach ($name in 'A','B','SUSPENDED') { $fixture.businesses[$name] = [guid]::NewGuid().ToString() }
foreach ($name in 'A','B','PENDING','ANONYMOUS','SUSPENDED','REVOKED') { $fixture.members[$name] = [guid]::NewGuid().ToString() }
New-Item -ItemType Directory -Path tests/artifacts -Force | Out-Null
$env:BATH_TEST_FIXTURE_FILE = (Join-Path (Get-Location) 'tests/artifacts/phase2-fixture.json')
if (Test-Path -LiteralPath $env:BATH_TEST_FIXTURE_FILE) { throw 'Keep the previous manifest; do not overwrite' }
$fixture | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8NoBOM -LiteralPath $env:BATH_TEST_FIXTURE_FILE
```

PowerShell 7 예시다. 준비한 Auth UID도 UUID v4여야 한다. 표식 설정 후 토큰을 새로 발급한다.
manifest에는 비밀번호/토큰/키를 넣지 않는다. 동일 Fixture 재준비 시 기존 manifest를 그대로
읽는다. 새 fixture_id로 기존 계정을 덮어 표시하지 않는다. 동일 Fixture의 동시 실행은 금지한다.

Fixture 연결은 다음과 같다.

| 업체/사용자 | 업체 상태 | 멤버십 상태/역할 | 예상 |
|---|---|---|---|
| A / BUSINESS_A | approved | approved/member | 자기 업체·멤버십 조회 허용 |
| B / BUSINESS_B | approved | approved/member | 자기 업체·멤버십 조회 허용 |
| A / PENDING | approved | pending/member | 업체·멤버십 조회 차단 |
| A / CUSTOMER_A | approved | approved/member | Anonymous Auth이므로 업체 접근 차단 |
| SUSPENDED / BUSINESS_A | suspended | approved/member | 업체 조회 차단 |
| A / BUSINESS_B | approved | revoked/member | A 업체·취소 멤버십 조회 차단 |
| CUSTOMER_B / GENERAL | 없음 | 없음 | 업체 권한 없음 |

정지 업체의 approved 자기 멤버십 행은 현재 정책상 보일 수 있다. 정지 업체 자체 조회가
차단되는지를 검사한다. 해당 정책을 이번 단계에서 바꾸지 않는다.

## Fixture SQL 준비와 실행 (별도 승인 후)

Migration 적용과 테이블 생성이 완료되어야 실행할 수 있다. psql 15+의 `\getenv`를 사용한다.
SQL Editor 실행은 지원하지 않는다. 직접 DB host에 TLS verify-full로 접속한다.
pooler/custom host/localhost 연결은 거부한다. direct IPv6 연결이 불가능하면 실행을 중단하고
연결 환경부터 준비한다. guard를 완화하지 않는다.

먼저 운영자가 Management API의 실제 응답을 확인한다. 아래 조회는 읽기 전용이다.

```powershell
$p = Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/istsrambmbzuemkgutgh' -Headers @{ Authorization = "Bearer $env:BATH_TEST_MANAGEMENT_TOKEN" }
if ($p.id -ne 'istsrambmbzuemkgutgh' -or $p.name -ne 'bath-designer-dev' -or $p.database.host -ne 'db.istsrambmbzuemkgutgh.supabase.co' -or $p.status -ne 'ACTIVE_HEALTHY') { throw 'Unverified target' }
```

그런 다음 PGHOST를 위 direct host로, PGDATABASE/PGUSER를 Dashboard 연결 정보대로 설정한다.
PGSSLMODE=`verify-full`, PGSSLROOTCERT를 Dashboard에서 제공하는 신뢰할 CA 파일 경로로
설정한다. 비밀번호는 비밀 저장소/안전한 pgpass에서 공급한다. 명령줄/문서에 넣지 않는다.
SQL은 실제 psql HOST 변수, PGSSLMODE, 서버 TLS 상태를 다시 검사한다. SQL의 project_name은
운영자 확인값이며, 실제 이름 조회는 위 Management API 단계에서 수행한다.

```powershell
$f = Get-Content -Raw -LiteralPath $env:BATH_TEST_FIXTURE_FILE | ConvertFrom-Json
$vars = @{
  project_ref=$f.project_ref; project_name=$p.name; fixture_id=$f.fixture_id
  customer_a=$f.users.CUSTOMER_A; customer_b=$f.users.CUSTOMER_B
  business_a_user=$f.users.BUSINESS_A; business_b_user=$f.users.BUSINESS_B
  general_user=$f.users.GENERAL; pending_user=$f.users.PENDING
  business_a_id=$f.businesses.A; business_b_id=$f.businesses.B
  suspended_business_id=$f.businesses.SUSPENDED
  member_a_id=$f.members.A; member_b_id=$f.members.B
  pending_member_id=$f.members.PENDING; anonymous_member_id=$f.members.ANONYMOUS
  suspended_member_id=$f.members.SUSPENDED; revoked_member_id=$f.members.REVOKED
}
$psqlArgs = @('-X','--set=ON_ERROR_STOP=1')
foreach ($name in $vars.Keys) { $psqlArgs += @('-v', "$name=$($vars[$name])") }
$psqlArgs += @('-f','supabase/tests/phase2-fixtures.sql')
# WRITE: run this only after separate approval, never as part of Phase 2.6.
& psql @psqlArgs
if ($LASTEXITCODE -ne 0) { throw 'Fixture failed; transaction rolled back' }
```

SQL은 한 트랜잭션으로 실행된다. 사용자별 기존 프로젝트, 외부 멤버십,
업체명/상태/UID 충돌이 있으면 rollback한다. 정확히 같은 Fixture만 재실행 시 유지한다.
TRUNCATE/전체 DELETE/기존 Fixture 상태 덮어쓰기는 없다. 업체명은 UUID 표식만 사용한다.

## 테스트와 정리

```powershell
node --check supabase/tests/phase2-rls.mjs
node supabase/tests/phase2-rls.mjs --preflight
# WRITE: only after separate approval and successful preflight.
$env:BATH_TEST_JOURNAL = "tests/artifacts/phase2-run-$([guid]::NewGuid()).json"
node supabase/tests/phase2-rls.mjs --run
# Recovery: keep the SAME manifest, journal, management/admin credentials.
node supabase/tests/phase2-rls.mjs --cleanup
```

- INSERT UUID를 요청 전에 생성하고 충돌 부재 확인 후 journal을 디스크에 기록한다.
  예상 밖 INSERT 성공/네트워크 응답 유실에도 정확한 ID로 조회·삭제한다.
  응답 상태·SQLSTATE·반환 ID도 journal에 기록한다.
- 정상 INSERT/SELECT/UPDATE 및 revision 증가, 모드 변경 후 selections 보존을 확인한다.
  UPDATE 차단 전 원본 전체 snapshot을 저장하고 요청 후 실제 상태와 비교한다.
- 고객 B의 SELECT/UPDATE/DELETE, 소유권 변경, 타인 소유 INSERT 및 비로그인 접근을 검사한다.
  DELETE 공격 대상은 해당 실행에서 직접 생성한 프로젝트 하나로 제한한다.
  정상 DELETE는 별도의 실행 전용 프로젝트에서 검사한다.
- 업체 자기 조회를 먼저 확인하고 타 업체/미승인/정지/취소/익명/일반 사용자,
  위조 업체·멤버십 INSERT, role·승인 상태 변경을 검사한다. 기존 9개 시나리오를 유지한다.
- 사용자 요청은 publishable 키 + 해당 실제 사용자 access token만 사용한다.
  관리자 키는 Fixture 검증·원본 상태 관찰·정리에만 사용한다.
- 매 사용자 세션의 issuer/sub/role/exp/is_anonymous 및 Auth `/user` 응답을 검사한다.
  차단 요청 전후에도 세션을 재확인한다. 관리자 확인으로 사용자 RLS SELECT를 대체하지 않는다.
- SQLSTATE 42501과 오류 메시지로 GRANT/RLS를 구분한다. 모든 401/403을 통과시키지 않는다.
  인증 오류(PGRST 등), 만료 토큰, 네트워크·프로토콜·Fixture 오류는 실패/실행 불가다.
  빈 SELECT, 0행 UPDATE/DELETE는 원본 불변 여부와 함께 판정한다.
- 예상 밖 UPDATE는 관리자 경로로 변경된 업무 필드만 복원한 다음 재조회해 검증한다.
  revision/updated_at는 트리거가 관리하므로 되감지 않는다. 실행 전용 프로젝트는 이후 삭제한다.
  immutable owner 복원이 트리거에 막히면 오류를 보고하고, 삭제 가능한 실행 행은 별도로 정리한다.
- 정리는 역순으로 모든 항목을 시도한다. 하나의 실패가 뒤의 정리를 건너뛰게 하지 않는다.
  정리 실패는 table/ID/run_id/이유를 출력·기록하고 exit code 1로 종료한다.
  전체 PASS는 테스트와 정리가 모두 성공한 후에만 출력한다.

강제 종료/네트워크 단절/관리자 권한 만료/디스크 오류에는 자동 정리를 보장할 수 없다.
journal은 임시 파일 fsync 후 교체하며 이전 완전한 파일을 보존한다. 강제 종료 후에는
새 run 대신 같은 journal의 `--cleanup`을 실행한다. 파일이 없거나 손상되었다면 쓰기를 중단한다.
남은 `.tmp`와 원본 journal을 운영자가 검토하고 완전한 기록을 복구한다.
복구가 불가능하면 manifest의 전용 계정과 `BATH-RLS:<run_id>` 표식을 읽기 전용 조회하여
소유권·표식·정확한 UUID를 확인한 뒤 개별 정리한다. 광범위 DELETE로 대체하지 않는다.

보안 결함으로 프로젝트가 이미 삭제되었다면 그 행을 고객 데이터처럼 재생성하지 않는다.
예상 밖 DELETE는 테스트 실패이며, 이미 사라진 실행 전용 행은 정리된 것으로 확인한다.
삭제된 baseline 멤버십 등은 자동 재생성하지 않고 수동 복원 필요로 보고한다.
정리 모드는 사용자 토큰이 만료되어도 재실행할 수 있지만 전용 계정 표식·업체 확인은 유지한다.
Fixture 자체가 손상되어 사전 점검에 실패하면 guard를 해제하지 말고 운영자 복원을 사용한다.

baseline Fixture 철거는 별도 운영자 작업이다. manifest UUID에 해당하는 업체 3개와 멤버십
6개를 SELECT하여 이름·상태·연결을 확인하고, 외부 연결/프로젝트가 없는지 검사한 뒤
트랜잭션 안에서 멤버십 6개 → 업체 3개를 각각 정확한 ID 조건으로 삭제하고 0행을 검증한다.
CASCADE로 지워질 행까지 먼저 확인한다. Auth 계정 삭제는 별도 승인된 계정 수명주기 작업이며
프로젝트 CASCADE 영향을 검토해야 한다. 테스트 실행기는 baseline 업체/계정을 삭제하지 않는다.

## CLI와 Migration 적용 전 순서

현재 CLI가 없으므로 CLI 인식/SQL dry-run 통과를 주장하지 않는다.
공식 Windows Scoop 설치 방법을 사용할 수 있다. 설치는 이번 작업에서 하지 않았다.

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
supabase --help
supabase init --help
supabase link --help
supabase migration --help
supabase migration list --help
supabase db push --help
supabase db advisors --help
```

실제 설치 버전의 help를 확인하고 승인된 CLI 버전을 고정한다. `init --force`는 사용하지 않는다.
config.toml이 여전히 없을 때만 `supabase init`으로 생성하고 diff를 검토한다.
기존 migrations/tests나 MCP 읽기 전용 설정을 덮어쓰지 않는다.

후속 승인 전 읽기 전용 확인 순서:

1. Management API에서 이름/Ref/host/상태 재확인. 연결 자격 증명은 개발 프로젝트에서만 확보.
2. `supabase link --project-ref istsrambmbzuemkgutgh` 사용 전 help·대상 확인.
   링크는 로컬 준비이며 그 자체로 테이블을 생성하지 않는다.
3. `supabase migration list --linked`로 실제 적용 이력과 파일 1개를 대조.
   연결이 불가능하면 중단한다. CLI가 없으면 읽기 전용 MCP list_migrations 사용 가능.
4. 원본 SQL과 SHA256, CASCADE/JSONB/schema_version/RLS/GRANT/트리거를 재검토.
5. `supabase db push --linked --dry-run`은 help에서 dry-run이 지원됨을 확인한 뒤
   **후속 단계에서만** 실행하여 적용 예정 파일을 확인한다. 이번 단계에서는 dry-run 포함
   `supabase db push`를 전혀 실행하지 않았다. dry-run은 PostgreSQL 실행 검증을 대신하지 않는다.
6. 승인 후 개발 DB에 Migration 적용. 적용 후 Security Advisor를 Dashboard에서 확인하거나
   지원 CLI의 `supabase db advisors --linked --type security`/읽기 전용 MCP get_advisors 사용.
   실제 명령 플래그는 해당 버전 help로 재확인한다.
7. 전용 계정/Fixture를 승인된 절차로 준비하고 preflight → 실제 사용자 RLS suite → 정리 확인.
   테이블이 없거나 계정/키가 없으면 테스트 통과로 보고하지 않는다.

Migration의 실제 결함이 발견되면 파일 위치·원인·수정안을 먼저 보고하고 승인을 기다린다.
이 단계에서 제품 UI/Builder/state/localStorage/이미지/Vercel/PHASE 1.6 설계를 변경하지 않는다.

## 정적·오프라인 검증과 한계

`node --check`와 독립된 모의 fetch를 사용한 8개 로컬 실행 경로를 검증했다:
정상 흐름, 예상 밖 INSERT, 예상 밖 UPDATE, 예상 밖 DELETE, role 변경 성공,
정리 오류, 인증 오류, 잘못된 프로젝트. 인증/대상 오류에서는 쓰기 0회를 확인했다.
INSERT/UPDATE/role 공격 실패 후 실행 데이터 제거 및 baseline role 복원을 확인했다.
정상 실행 후 cleanup 재실행의 멱등성도 확인했다.
모의 검증은 실제 PostgreSQL 정책·SQL 파싱·네트워크·Auth 서버의 통합 검증을 대체하지 않는다.
psql/로컬 PostgreSQL이 없어 Fixture SQL의 실제 구문 실행 및 CLI 인식 검증은 미실시다.

공식 참고: [Anonymous Auth와 anon 역할](https://supabase.com/docs/guides/auth/auth-anonymous),
[CLI 설치·명령](https://supabase.com/docs/reference/cli/introduction),
[DB 연결과 SSL](https://supabase.com/docs/guides/database/connecting-to-postgres),
[변경 이력](https://supabase.com/changelog).
