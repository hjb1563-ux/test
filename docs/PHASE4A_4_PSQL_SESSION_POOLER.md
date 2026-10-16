# PHASE 4A.4 — psql 및 Session Pooler 준비

## 현재 판정: 일부 준비 완료, 실제 연결/Fixture 실행 보류

2026-10-16 후속 승인으로 EDB PostgreSQL 17.11 Command Line Tools 설치 완료(종료 코드 0).
실제 경로: `C:\Program Files\PostgreSQL\17\bin\psql.exe`, `psql --version` = 17.11.
Server/pgAdmin/Stack Builder, 런타임 설치, 바로가기는 명시적으로 제외했다.
설치 전후 시스템·사용자 환경변수 해시 비교 결과 변경 없음(PATH 포함), 새 서비스 0개,
PostgreSQL 서비스 0개, data 디렉터리 없음. EDB 등록 정보는 CLT_Version만 기록한다.
단 Command Line Tools 패키지에 postgres.exe/pg_ctl.exe/initdb.exe 및 보조 설치 파일도
함께 포함되었다. 이를 서버 역할 설치나 클러스터 생성으로 해석하지 않으며 해당 파일은 실행하지 않았다.
설치 파일 서명은 EnterpriseDB Corporation / Valid, SHA-256:
`612C7F5400A003AAFFA0372CB273EED52278F93C680AB911EB9CB2229E329072`.
현재 브라우저 연결이 없어 개발 Dashboard Connect 화면을 도구로 직접 확인하지 못했다.
사용자가 실제 개발 Dashboard에서 확인한 값을 전달했다:
`aws-0-ap-northeast-2.pooler.supabase.com:5432`, DB `postgres`,
user `postgres.istsrambmbzuemkgutgh`. 코드와 예제의 허용값을 이 값으로 고정했다.
TCP 연결 성공 기록은 있으나 실제 로그인은 미완료다. Direct 연결은 IPv6 ENETUNREACH 기록이 있다.
사용자가 Downloads에 보관한 `prod-ca-2021.crt`를 확인했다(개인키 없음, 만료 2031-04-26).
실제 psql을 PGSSLMODE=verify-full, PGSSLROOTCERT=해당 파일로 실행한 결과,
인증서 오류 없이 인증 단계에서 `fe_sendauth: no password supplied`로 종료(코드 2).
이는 TLS/호스트명 검증을 거쳐 인증 단계에 도달했다는 증거이며 DB 로그인 성공은 아니다.
PGPASSWORD/기본 password file은 사용하지 않았고 연결은 읽기 전용 SELECT로 요청했다.
인증 미완료로 SELECT는 실행되지 않았다. SSL 강제 OFF 설정은 변경하지 않았다.
보호된 db-connection.local.json과 credentials.env.local의 해당 경로를 준비했다.
pgpass.conf와 Management token은 여전히 없으므로 전체 연결 점검은 보류한다.

별도 Supabase MCP 읽기 전용 조회는 개발 프로젝트의 Migration 2개
(`20261016000100`, `20261016080040`), 테이블 3개 RLS 활성, 정책 6개,
세 테이블 각각 0행을 확인했다. 이는 psql/Pooler 연결 검증을 대신하지 않는다.
적용 Migration 두 파일의 SHA-256은 이전 승인값과 동일하다.

## 설치 승인 요청 범위

공식 [PostgreSQL Windows 다운로드](https://www.postgresql.org/download/windows/)에서
연결하는 EDB x64 설치 프로그램을 사용한다. DB와 같은 PostgreSQL 17 계열의
지원되는 최신 패치 버전 Command Line Tools만 선택한다(최소 15).
[EDB 설치 안내](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/windows/)의
Select Components에서 **Command Line Tools만 선택**, PostgreSQL Server,
pgAdmin 4, Stack Builder는 해제한다. 컴포넌트 선택이 불가능하면 설치를 중단한다.
설치 파일 게시자/서명을 확인한다. 설치 위치에는 클라이언트 실행 파일과 의존 DLL,
제거 정보가 추가될 수 있고 Windows 런타임 설치나 관리자 승인이 요구될 수 있다.
서버 서비스, initdb, 로컬 DB/클러스터, 방화벽 규칙을 만들지 않는다.
시스템 PATH는 변경하지 않고 psql.exe 절대 경로를 로컬 설정에 기록한다.
추가 구성요소가 필수라면 실행 전에 변경 범위를 다시 설명한다.
사용자의 명시적 설치 승인을 받아 위 범위로 설치했다. 추가 설치는 하지 않는다.

설치 후 사용자 로컬 PowerShell에서 경로를 지정해 `psql.exe --version`을 확인한다.

## Dashboard에서 사용자가 확인할 값

`bath-designer-dev / istsrambmbzuemkgutgh`의 Connect → Session Pooler를 연다.
host, port=5432, database=postgres, user=postgres.프로젝트Ref를 **그 화면에서** 확인한다.
6543 Transaction Pooler는 허용하지 않는다. 비밀번호/전체 URI는 채팅에 보내지 않는다.
개발 프로젝트 Database Settings → SSL Configuration에서 CA 인증서 다운로드를 확인한다
([공식 경로](https://supabase.com/docs/guides/platform/ssl-enforcement)).
해당 **Pooler endpoint에 유효한 신뢰 CA**인지 확인한다.
Direct DB 전용 인증서가 Pooler 인증서에도 유효하다고 가정하지 않는다.
제공되는 신뢰 루트/체인이 불명확하면 연결을 보류하고 공식 안내로 확인한다.

[libpq verify-full](https://www.postgresql.org/docs/17/libpq-ssl.html)은 신뢰 CA 체인과
호스트명을 모두 검사한다. `require`, `verify-ca`, 검증 비활성화로 우회하지 않는다.
psql이 verify-full로 실제 로그인에 성공해야 클라이언트→Pooler TLS 검증 완료로 판정한다.
서버 `pg_stat_ssl`도 검사하지만 이는 클라이언트의 호스트명 검증을 대신하지 않는다.

## 로컬 파일 및 자격증명

`supabase/tests/phase4a4-connection.example.json`을 보호된
`tests/artifacts/phase4a2/db-connection.local.json`으로 복사하여 사용자가 직접 입력한다.
host/user는 사용자가 Dashboard에서 확인한 공개 연결값이다.
예제의 `dashboard_confirmed=false`는 복사 후 대상과 CA/비밀파일을 재검토할 때까지 유지한다.
`psql_path`, `ca_file`, `pgpass_file`은 실제 파일 경로다. JSON에는 비밀번호가 들어가지 않는다.

비밀번호는 같은 보호 폴더의 `pgpass.conf`에 사용자가 로컬 편집기로 입력한다.
형식은 `정확한host:5432:postgres:정확한user:DB비밀번호`이다. wildcard를 쓰지 않는다.
비밀번호의 `:`와 `\`는 libpq password-file 규칙대로 이스케이프한다.
명령행 URI, `-v`, PGPASSWORD, 셸 기록에 비밀번호를 넣지 않는다.
이 파일은 Windows에서도 현재 사용자와 SYSTEM만 읽도록 ACL을 확인한다.
기존 폴더는 상속 차단/current User+SYSTEM으로 보호되어 있으나 새로 복사한 파일도
`Get-Acl`/`icacls`로 재확인한다. 권한을 넓혀 도구가 읽게 하지 않는다.
`tests/artifacts/`는 Git 제외 대상이다. 실제 키/CA/세션 파일을 커밋하지 않는다.

기존 `credentials.env.local`은 고정 URL/개발 확인값만 준비되어 있고 실제 키,
Management token, 4개 이메일/비밀번호 및 이메일 확인 표식은 아직 비어 있다.
값을 출력하지 않고 존재 여부만 확인했다. 관리자 키는 NEXT_PUBLIC_*에 넣지 않는다.
추가 환경변수:

| 이름 | 용도 |
|---|---|
| BATH_TEST_DB_CONFIG | 위 private JSON의 경로 |
| BATH_TEST_SECRET_STORAGE_CONFIRM | ACL 확인 후 private-acl-verified |
| BATH_TEST_MANAGEMENT_TOKEN | 개발 프로젝트 GET 및 Pooler config GET용 고권한 자격증명 |
| BATH_TEST_FIXTURE_FILE | 이후 계정 준비 도구가 만든 manifest 경로, check에서는 불필요 |
| BATH_TEST_FIXTURE_CONFIRM | 별도 실행 승인 후에만 create-dedicated-development-fixture, 현재 설정/실행 금지 |

Management token은 CLI 캐시에서 추출하지 않는다. 최소 범위·짧은 만료로 사용한다.
[Pooler config GET API](https://supabase.com/docs/reference/api/v1-get-pooler-config)는
database:read / database_pooling_config_read 권한이 필요하다. 401/403이면 중단한다.
API가 transaction 설정만 반환하거나 db_user가 Dashboard 표기와 다르면 **자동 변환 없이 중단**한다.
실제 응답을 확인하지 않았으므로 현재 코드가 해당 프로젝트 응답과 호환된다고 확정하지 않는다.

## 연결 및 Fixture 안전장치

새 `phase4a4-connection.mjs`는 기본 `--check`에서 Management GET 두 종류와
psql 읽기 전용 SELECT만 수행한다. 별도 `--fixture`는 향후 승인된 데이터 쓰기 경로다.
이번에는 어느 경로도 실제 자격증명으로 실행하지 않았다.

- 실제 Dashboard 확인값 + 정확한 Ref/이름/Direct DB host/ACTIVE_HEALTHY를 Management API와 대조한다.
- Session은 PRIMARY, session, 정확한 host/5432/database/user 전부 API와 일치해야 한다.
- psql 15+, CA 파일, private pgpass 파일, ACL 확인 표식을 요구한다.
- 자식 프로세스에 기존 PG* 및 Auth/관리자 키를 상속하지 않는다. PGHOSTADDR/PGSERVICE 우회도 제거한다.
- shell 없이 절대 psql 경로, `-X -w`, verify-full, 지정 CA/password file로 연결한다.
- 읽기 전용 모드는 default_transaction_read_only=on이다. 원문 libpq 오류/응답은 로그에 전달하지 않는다.
- Fixture는 같은 psql 연결에서 `phase4a4-connection-check.sql`을 먼저 실행한다.
  원래 정확한 Direct host 제한을 유지하고, Session은 별도 검증 wrapper를 의무화한다.
- psql HOST/PORT/USER/DBNAME, DB/session 사용자, TLS, Migration 및 스키마 지문을 확인한다.
  지문은 개발 프로젝트에서 독립 조회한 컬럼·제약조건·정책·트리거·함수·RLS·Migration 상태다.
  지문 불일치는 수동 검토 대상이며 자동 갱신하지 않는다. 이는 자격증명이 아닌 drift 검사다.
- wrapper 검증 표식은 해당 자식 프로세스에만 전달된다. 직접 위조하거나 SQL만 실행하지 않는다.
- 기존 BEGIN, advisory lock, UUID v4 중복 검사, 전용 Auth app_metadata 검사,
  기존 고객/업체/멤버십 충돌 검사, rollback 및 정리 절차는 유지했다.

[Session pooling](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits)은
클라이언트 세션 동안 backend를 유지하므로 기존 단일 연결 트랜잭션/임시 테이블에 적합하다.
psql의 `\ir`, `\gset`, `\if`는 클라이언트에서 처리된다. 실제 psql 실행은 설치 후 검증해야 한다.
현재 Fixture 실행은 허용하지 않는다.

## 이후 읽기 전용 확인 명령 (남은 입력 완료 후)

credentials.env.local에 BATH_TEST_DB_CONFIG를 추가하고 ACL을 재확인한 뒤:

```powershell
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a4-connection.mjs --check
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a2-sessions.mjs --check
```

후자는 소스상 모든 HTTP가 GET인 구간에서 return하며 계정/세션/Fixture/lock을 만들지 않는다.
필수 14개(기본 5 + 이메일 전용 확인 1 + 이메일/비밀번호 8) 미입력으로 이번 실행은 보류했다.
--create/--refresh/--fixture/RLS --run은 이번 승인 범위가 아니다.

## 검증 및 이후 정리

Node 구문 검사 및 새 offline 테스트 4개 통과。psql 실행과 verify-full 연결은 위 증거대로 확인했다.
SQL/메타 명령의 전체 실행 및 DB 비밀번호 인증은 아직 미검증이다.
적용 Migration/프론트엔드/RLS/GRANT는 수정하지 않았다. 원격 쓰기·Fixture·계정 생성 없음.
Fixture 본문은 BEGIN 이후 변경하지 않았다. 기존 runbook의 journal 복원/삭제 실패 처리는 유지한다.
향후 생성 대상은 기존 계정 6개에 대한 업체 3개·멤버십 6개이며 Fixture 자체는 프로젝트를 만들지 않는다.
정리 시 RLS journal 복원/생성 프로젝트 삭제 → manifest의 업체/멤버십 정리 검증 →
전용 사용자 세션 폐기/계정 삭제 → 잔여 ID 보고 → 자격증명 폐기 순으로 별도 승인 후 진행한다.
고객/운영 데이터를 재사용하거나 전체 테이블 DELETE로 정리하지 않는다.
