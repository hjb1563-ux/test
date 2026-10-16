# PHASE 4A.3 — 사용자 입력과 클라이언트 준비

이번에는 계정/세션 생성·갱신, Fixture SQL, RLS 실행, 원격 Migration/Auth/권한 변경을
하지 않았다. 실행 코드는 수정하지 않았다. 준비 범위의 로컬 보관 폴더·빈 입력 템플릿과
이 안내만 작성했다. 설치 프로그램은 다운로드/실행하지 않았다.

## 지금 사용자가 할 일

[로컬 입력 파일](../tests/artifacts/phase4a2/credentials.env.local)을 로컬 편집기로 열어
전용 이메일 4개·전용 비밀번호·프로젝트 키를 직접 입력한다. 실제 값은 채팅으로 보내지 않는다.
템플릿은 프로젝트 URL과 확인 문자열만 채워져 있으며 실제 키/이메일/비밀번호는 비어 있다.
이 파일은 Git에서 제외돼 있고 ACL은 현재 Windows User와 SYSTEM만 허용한다.
다른 실행 계정이 자동으로 읽을 수 있도록 권한을 넓히지 않는다.

현재 확인:
- 원래 RLS 변수 13개: 프로세스/사용자 환경에 모두 없음.
- 새 로컬 입력 파일: 고정값 2개만 준비. --check 필수 입력 14개 중 나머지 12개는 비어 있음.
- 원래 실제 private 경로에는 sessions.json/fixture.json/.env.sessions.local 없음.
  과거 offline mock의 별도 격리 디렉터리는 실제 계정 상태가 아니다.
- Anonymous=true, Email=true, mailer_autoconfirm=false를 이번에도 GET으로 확인.
- psql 없음. 사용자 자격증명이 없어 실제 --check는 실행하지 않음.

## 모드와 쓰기 범위

| 모드 | 수행 동작 | 원격 쓰기 |
|---|---|---|
| --check (기본) | Management 프로젝트 GET, Auth settings GET, 세 테이블 관리자 SELECT(GET), 이메일/비밀번호 입력 형식 확인 | 없음. 사용자/세션/Fixture/상태 파일 생성 없음 |
| --create | 익명 계정 2개, Email 계정 4개 생성·전용 app_metadata 설정·실제 password 로그인, private state/manifest/env 기록 | Auth POST/PUT 있음. 이번 실행 금지 |
| --refresh | 기존 전용 UID/표식 확인 후 익명 refresh·Email password 로그인, private 파일 갱신 | Auth 토큰 POST 있음. 이번 실행 금지 |

소스의 --check return은 lock/state 생성·POST/PUT보다 앞에 있다.
따라서 키가 준비돼도 --check는 계정 가입·로그인·Fixture 쓰기를 하지 않는다.
다만 읽기 전용 관리 요청에도 관리 자격증명은 필요하다.
--check 성공은 실제 비밀번호의 정확성·메일 소유권·사용자 세션·Fixture 준비 완료를 뜻하지 않는다.

## 원래 RLS 환경변수 13개

모든 값은 아래 운영자 입력 파일 또는 이후 생성되는 private 세션 파일로만 공급한다.
NEXT_PUBLIC_*와 브라우저 코드에 관리자/Management 키를 넣지 않는다.

| 이름 | 값/확인 위치 | 비밀성 | 보관/필요 단계 |
|---|---|---|---|
| BATH_TEST_SUPABASE_URL | 개발 Dashboard Connect/API의 URL. https://istsrambmbzuemkgutgh.supabase.co | 공개 설정 | credentials.env.local, --check부터 |
| BATH_RLS_TEST_CONFIRM | 고정 bath-designer-dev | 공개 설정 | credentials.env.local, --check부터 |
| BATH_TEST_PUBLISHABLE_KEY | 개발 Project Settings → API Keys의 활성 publishable 키. legacy anon도 지원 | 공개 키, 사용자 세션 아님 | credentials.env.local, --check부터. 도구는 출력하지 않음 |
| BATH_TEST_ADMIN_KEY | 동일 개발 API Keys의 secret 키 또는 legacy service_role 키 | 고권한 비밀 | credentials.env.local/운영자 비밀 저장소, --check부터. 사용자 토큰과 구별 |
| BATH_TEST_MANAGEMENT_TOKEN | 계정 메뉴 Account → Access Tokens. 프로젝트 API Keys가 아님 | 고권한 비밀 | credentials.env.local/일시 프로세스 환경, --check부터 |
| BATH_TEST_CUSTOMER_A_TOKEN | 이후 익명 로그인으로 실제 발급 | 비밀 | .env.sessions.local, 원래 RLS preflight/run |
| BATH_TEST_CUSTOMER_B_TOKEN | 이후 독립된 익명 로그인으로 실제 발급 | 비밀 | .env.sessions.local, 원래 RLS preflight/run |
| BATH_TEST_BUSINESS_A_TOKEN | 이후 업체 A의 실제 password 로그인으로 발급 | 비밀 | .env.sessions.local, 원래 RLS preflight/run |
| BATH_TEST_BUSINESS_B_TOKEN | 이후 업체 B의 실제 password 로그인으로 발급 | 비밀 | .env.sessions.local, 원래 RLS preflight/run |
| BATH_TEST_GENERAL_TOKEN | 이후 일반 사용자의 실제 password 로그인으로 발급 | 비밀 | .env.sessions.local, 원래 RLS preflight/run |
| BATH_TEST_PENDING_TOKEN | 이후 미승인 사용자의 실제 password 로그인으로 발급 | 비밀 | .env.sessions.local, 원래 RLS preflight/run |
| BATH_TEST_FIXTURE_FILE | 이후 도구가 생성하는 tests/artifacts/phase4a2/fixture.json 경로 | 값 자체는 비밀 아님, 내용은 내부 테스트 식별자 | 출력 세션 env. --check에는 불필요 |
| BATH_TEST_JOURNAL | 이후 새 tests/artifacts/phase2-run-UUID.json 경로 | 값 자체는 비밀 아님, 내용은 내부 기록 | 출력 세션 env. --check에는 불필요 |

[API Keys 공식 안내](https://supabase.com/docs/guides/getting-started/api-keys),
[Account Access Tokens](https://supabase.com/dashboard/account/tokens).

Management token은 개발 프로젝트 조회에 필요한 최소 scope·짧은 만료를 선택한다.
CLI 로그인 토큰을 추출하거나 넓은 권한의 token을 자동 복사하지 않는다.
개발 프로젝트만 scope로 제한 가능한 옵션이 없다면 운영자가 권한 범위를 검토한 뒤 준비한다.
관리 키/Management token은 출력 세션 파일에 복사되지 않으며 실제 사용자 JWT 대신 쓰지 않는다.
작업 후 일시 환경/비밀 파일에서 제거하고 계정 토큰을 폐기·회전하는 계획을 세운다.
터미널 transcript/화면공유/환경 전체 출력으로 노출하지 않는다.

## --check에 추가로 필요한 Email 입력

원래 13개 중 처음 5개만 --check에 필요하다. 다음 9개가 더 필요해 실제 필수 입력은 14개다.

| 역할 | 이메일 변수 | 비밀번호 변수 | 나중에 필요한 Fixture 상태 |
|---|---|---|---|
| 업체 A | BATH_TEST_BUSINESS_A_EMAIL | BATH_TEST_BUSINESS_A_PASSWORD | A 업체 approved 멤버 |
| 업체 B | BATH_TEST_BUSINESS_B_EMAIL | BATH_TEST_BUSINESS_B_PASSWORD | B 업체 approved 멤버 |
| 일반 사용자 | BATH_TEST_GENERAL_EMAIL | BATH_TEST_GENERAL_PASSWORD | 멤버십 없음 |
| 미승인 사용자 | BATH_TEST_PENDING_EMAIL | BATH_TEST_PENDING_PASSWORD | A 업체 pending 멤버 |

이메일·비밀번호는 credentials.env.local에 직접 입력한다.
사용자 소유 전용 inbox/alias 네 개를 쓰고 비밀번호는 최소 12자 및 실제 Auth 정책을 충족한다.
모든 이메일은 달라야 한다. 계정 UID는 서버가 별도로 생성하며 임의로 입력/조작하지 않는다.
주소를 같은 이메일로 적거나 기존 운영/고객 계정을 재사용하지 않는다.
비밀번호는 Supabase Dashboard에서 조회하는 값이 아니라 사용자가 새로 정하는 테스트 값이다.
DB postgres 비밀번호와도 별개다.

추가 확인값:
BATH_TEST_EMAILS_CONFIRM=owned-dedicated-test-addresses
이 확인값은 주소를 직접 관리하는 전용 테스트 주소로 준비한 뒤 사용자가 입력한다.
--check에서 소유권을 실제 메일로 검증하지는 않는다.

BATH_TEST_SECRET_STORAGE_CONFIRM과 BATH_TEST_ACCOUNT_CONFIRM은 --check에는 불필요하다.
현재 둘 다 빈 상태로 유지했다. 이전 문서에 나온 값은 실제 생성 승인 후에만 설정한다.
세션 토큰 6개와 Fixture/journal 경로도 지금 임의로 채우지 않는다.

Email Confirm은 활성 상태다. --create는 승인 후 전용 계정을 관리자 email_confirm:true로
생성하고, 각 사용자 비밀번호로 실제 로그인한 다음 email_confirmed_at를 확인한다.
전역 Email 확인 설정을 끄지 않으며 관리자 생성 응답을 사용자 세션으로 대신하지 않는다.
실제 이메일 확인 자체를 테스트하려면 일반 signup+메일 확인의 별도 흐름이 필요하다.

## 개인 파일 보호와 실행

새 개인 폴더는 상속을 차단하고 현재 User/SYSTEM FullControl만 명시했다.
입력 파일은 이 제한된 ACL을 상속한다. 실제 입력 전 아래 명령으로 다시 확인할 수 있다.
내용을 출력하는 Get-Content/cat나 셸 변수에 비밀번호를 직접 쓰는 명령은 사용하지 않는다.

```powershell
Get-Acl -LiteralPath tests/artifacts/phase4a2 | Select-Object AreAccessRulesProtected
(Get-Acl -LiteralPath tests/artifacts/phase4a2/credentials.env.local).Access |
  Select-Object IdentityReference, FileSystemRights, IsInherited
git -c safe.directory='C:/Users/User/Desktop/Bath Design' check-ignore tests/artifacts/phase4a2/credentials.env.local
```

프로젝트 루트의 새 PowerShell에서, 필요한 값을 로컬 편집기로 입력한 후:

```powershell
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a2-sessions.mjs --check
```

현재 입력이 없으므로 위 실제 점검은 실행하지 않았다.
이미 환경변수를 안전하게 공급한 경우에는 node supabase/tests/phase4a2-sessions.mjs --check도
가능하다. Node --env-file은 기존 프로세스 환경값보다 우선하지 않으므로 새 터미널을 사용한다.
오류 메시지는 부족한 변수 이름/HTTP 상태만 표시하며 응답 본문·키·토큰은 출력하지 않는다.
확인할 때 성공/실패 메시지만 전달하고 입력 파일/토큰을 채팅에 붙여넣지 않는다.

## psql 클라이언트 준비안 — 설치 승인 대기

현재 psql이 없어 버전/TLS/DB 로그인은 실제 검증하지 못했다.
[PostgreSQL Windows 공식 다운로드](https://www.postgresql.org/download/windows/)가 연결하는
EDB Windows x64 최신 안정 17.x 설치 프로그램을 사용할 수 있다.
[공식 구성요소 선택 안내](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/windows/)에 따라:

1. Select Components에서 **Command Line Tools만 선택**.
2. PostgreSQL Server, pgAdmin 4, Stack Builder는 해제.
3. 데이터 디렉터리/로컬 서버 비밀번호/서비스 포트를 설정하라고 나오면 진행하지 말고
   Server 구성요소가 선택됐는지 재확인.
4. 설치 요약에 클라이언트 도구만 있는지 확인한 뒤 사용자 승인 범위에서 설치.
5. 서버 서비스·로컬 DB 인스턴스·initdb·로컬 포트 개방은 만들지 않음.
6. 시스템 PATH는 변경하지 않고 설치된 psql.exe의 전체 경로로 호출.

예상 로컬 변경: 선택한 설치 폴더의 클라이언트 실행 파일·의존 라이브러리,
Windows 설치/제거 항목 및 필요 시 런타임 구성요소. DB 서버 데이터/서비스 설치는 범위 밖.
이 방법도 프로그램 설치이므로 이번에는 다운로드/설치를 실행하지 않고 승인을 기다린다.
ZIP 바이너리는 무설치 대안이지만 서버용 바이너리도 포함되므로 psql 의존 라이브러리 선별을
따로 검증해야 한다. 이번에는 ZIP 추출/복사도 하지 않았다.
설치 승인 후 확인 예시(실제 설치 경로 기준):

```powershell
& 'C:/Program Files/PostgreSQL/17/bin/psql.exe' --version
```

15+인지 확인하고 psql만 --version으로 검사한다. postgres 서버를 실행하지 않는다.

## 네트워크와 연결 방식의 실제 제약

이번 실행 환경에서:
- direct host db.istsrambmbzuemkgutgh.supabase.co는 AAAA가 조회됐고 A 레코드는 조회되지 않음.
- Node hostname TCP 확인은 ENOTFOUND.
- DNS의 실제 IPv6 주소에 TCP 5432를 시도해 ENETUNREACH. 현재 direct IPv6 연결 불가.
- CLI 캐시에서 자격증명을 출력하지 않고 확인한 Session Pooler:
  aws-0-ap-northeast-2.pooler.supabase.com:5432 — TCP 연결 성공.
  이는 네트워크 확인만이며 psql 인증/TLS/프로젝트 결합 검증은 아직 아님.

[Supabase 공식 연결 안내](https://supabase.com/docs/guides/database/connecting-to-postgres)는
IPv4-only 환경에서 Session Pooler 사용을 안내한다. 다만 **현재 Fixture SQL은 direct host만
허용**하므로 cached Pooler 주소로 실행하면 guard가 거부한다. 승인 없이 host 검사를 제거하거나
POOLER URL/호스트를 추측해서 실행하지 않는다. Transaction Pooler(통상 6543)는 선택하지 않는다.

실제 사용 경로는 아직 확정할 수 없다:
- IPv6 지원 환경/VPN 등 사용자가 준비한 네트워크에서 direct TCP가 성공하면 기존 SQL 그대로.
- 현재 환경에서는 Session Pooler가 네트워크상 가능한 후보지만 별도 승인으로
  프로젝트 결합·TLS 검증·Fixture guard 지원을 설계한 뒤에만 실행 가능.
- IPv4 add-on은 유료 리소스 변경이므로 구입/활성화하지 않았다.

## 설치 후 읽기 전용 연결 검증 절차

1. Dashboard의 개발 프로젝트 Connect에서 선택한 연결 방식의 host/port/database/user를
   직접 확인한다. CLI 캐시를 최종 진실로 간주하지 않는다.
2. Management 프로젝트 이름/Ref/host 확인, 선택 endpoint DNS, TCP port 확인.
3. 선택 endpoint에 맞는 신뢰 CA를 확보하고 PGSSLMODE=verify-full, PGSSLROOTCERT 경로 지정.
   direct용 DB 인증서를 Pooler에 무조건 재사용하지 않는다.
   hostname 검증을 유지하고 sslmode=require/disable, rejectUnauthorized=false 등으로 우회하지 않는다.
4. DB 비밀번호는 아래 전용 pgpass 파일을 ACL 보호된 로컬 편집기로 작성하거나
   psql의 숨김 비밀번호 프롬프트(-W)로 직접 입력한다. 명령 인수/URI/채팅에 넣지 않는다.
   PGPASSFILE을 사용하는 경우 파일 형식의 colon/backslash escaping도 지킨다.
5. psql -X로 접속해 SELECT-only query로 ssl=true 및 현재 DB/user를 확인한다.
   이 검사는 Fixture SQL이 아니며 어떤 INSERT/UPDATE/DDL도 포함하지 않는다.
6. SQL의 pg_stat_ssl은 TLS 여부만 보여준다. CA/hostname 검증은 클라이언트 verify-full이
   담당하므로 ssl=true만으로 인증서 검증 완료라고 보고하지 않는다.

```powershell
# 실제 값은 Dashboard에서 확인. DB 비밀번호는 이 명령에 넣지 않는다.
$env:PGSSLMODE = 'verify-full'
# PGHOST / PGPORT / PGDATABASE / PGUSER / PGSSLROOTCERT를 선택 endpoint대로 설정
# 파일을 사용하는 경우: PGPASSFILE=보호된 tests/artifacts/phase4a2/pgpass.conf 절대 경로
& 'C:/Program Files/PostgreSQL/17/bin/psql.exe' -X -W -v ON_ERROR_STOP=1 -c 'select current_database(), current_user, ssl, version from pg_stat_ssl where pid=pg_backend_pid();'
```

이 명령은 안내만 작성했으며 이번에는 실행하지 않았다.
[TLS verify-full 공식 설명](https://www.postgresql.org/docs/17/libpq-ssl.html).

## 생성 승인 전 체크리스트와 철거 순서

- 실제 개발 identity와 Auth=true 재확인, 네 소유 테스트 주소·비밀번호 준비.
- 관리자 키와 실제 사용자 세션 분리. 서버 발급 UID 6개 중복 검사.
- private 폴더 ACL/Git ignore, manifest/journal 경로·이전 실행 잔존 여부 확인.
- Fixture는 기존 계정/업체/프로젝트 충돌 시 rollback. 변경된 endpoint는 승인 검토 선행.
- 미완료 pending state나 네트워크 응답 유실은 자동 재생성하지 않고 수동 조사.
- 실제 생성/갱신/Fixture/RLS 실행은 다음 승인 후에만 수행.

나중에 정리할 대상과 순서:
1. 실행 journal의 프로젝트·예상 밖 생성 행 삭제 및 role/status 복원 후 재조회.
2. baseline 멤버십 6개·업체 3개를 manifest의 정확한 ID/표식으로 확인하고 외부 연결 조사.
3. 승인된 운영자 트랜잭션에서 멤버십 → 업체 순서로 개별 삭제, 잔여 0행 검증.
4. Auth 사용자 6개의 전용 표식·연결된 projects/memberships와 CASCADE 영향 확인 후,
   세션 폐기/계정 삭제는 별도 승인된 Auth 운영 절차로 수행. 토큰 즉시 무효화를 가정하지 않음.
5. 증거 보존 필요성을 검토하고 private access/refresh 토큰·입력 비밀 파일 폐기,
   일시 Management token 폐기/회전. 복구 완료 전 journal/state를 먼저 지우지 않음.

판정: 사용자 입력 + psql 설치 승인 + direct/Pooler 경로 준비가 필요하다.
원격 변경·계정 생성은 수행하지 않았다.

