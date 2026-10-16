# PHASE 4C-3 — 업체 전용 실행기 및 Fixture 정리

이번 구현은 로컬·오프라인 범위만 실행했다. 실제 --check/--run/--cleanup,
실제 Auth/DB 요청, 계정 생성, Fixture SQL 실행 없음. 고객 테스트도 실행하지 않았다.
실제 Windows Direct IPv6 연결 문제는 해결되지 않았으며 Session Pooler로 대체 실행하지 않는다.

## 파일과 경계

| 파일 | 역할 |
|---|---|
| phase4c3-model.mjs | 고정 개발 Ref, 정확한 5사용자/3업체/6membership 관계, 16 UUID 전역 중복 및 journal 검증 |
| phase4c3-businesses.mjs | --plan / --check / --run / --cleanup 업체 전용 HTTPS 검사·추적 DB 정리 |
| phase4c3-fixture.mjs | 별도 Direct-only --plan / --check / --run, 관리자 API INSERT 없음 |
| phase4c3-fixture.sql | 기존 backend TLS 검사를 include하고 내부에서도 유지하는 단일 트랜잭션 Fixture |
| phase4c3-businesses.test.mjs | fake HTTPS와 fake psql만 사용하는 자동 검증 |
| phase4c3-businesses.env.example / phase4c3-users.example.json | 비밀값 없는 입력 예제 |

기존 고객 실행기는 실행하지 않고 import-safe인 authErrorCode 함수만 import한다.
기존 phase2의 실제 JWT/Auth 확인·GRANT/RLS 구분·전후 snapshot·사전 journal 원칙과
phase4a4의 정확한 개발 연결/CA/verify-full/기존 스키마 지문 검사를 재사용한다.
기존 Migration, GRANT, RLS, Fixture 및 backend_ssl 코드는 수정하지 않았다.

## Fixture 구성

외부에서 별도 승인으로 준비할 실제 Auth: BUSINESS_A/B, GENERAL, PENDING은 confirmed Email 4명,
ANONYMOUS는 실제 익명 세션 1명. 5개의 UID는 서로 달라야 한다.
본 실행기는 Auth 사용자를 생성·갱신·삭제하지 않는다. 기존 6사용자 --create를 대신 실행하지 않는다.
운영자 소유 주소의 실제 로그인으로 받은 JWT를 사용하며 JWT를 위조하지 않는다.
신뢰 app_metadata.bath_business_rls_fixture가 manifest.fixture_id와 일치해야 한다.
운영 데이터나 기존 고객 계정을 이 표식으로 바꾸어 재사용해서는 안 된다.

| membership 키 | 업체 | 사용자 | 상태 |
|---|---|---|---|
| A | A approved | BUSINESS_A | approved |
| B | B approved | BUSINESS_B | approved |
| PENDING | A | PENDING | pending |
| ANONYMOUS | A | ANONYMOUS | approved |
| SUSPENDED | SUSPENDED suspended | BUSINESS_A | approved |
| REVOKED | A | BUSINESS_B | revoked |

role은 모두 member이며 GENERAL에는 membership이 없다. 현재 스키마의 unique(business_id,user_id)와 일치한다.
업체 3개/멤버십 6개는 그대로 가능하다. pending 업체 자체는 이 범위에 없고 추가하지 않았다.

요구된 '업체 회원의 타인 고객 프로젝트 접근 차단'을 검증하기 위해 **일회용 프로젝트 1개**가 필요하다.
ANONYMOUS가 소유하고 BATH-BUSINESS-RLS:<fixture UUID>:PROJECT 표식을 가진다.
승인된 Direct SQL Fixture에서만 생성한다. 사용자 고객 CRUD suite를 재실행하지 않는다.
Fixture 쓰기 승인은 3업체+6멤버십 외에 이 프로젝트 1개까지 포함해야 한다.
스키마/정책/권한 변경이나 관리자 Data API INSERT 권한 추가는 필요 없다.

## 기대 결과와 구현 시나리오

| 검사 | 기대값/근거 |
|---|---|
| 승인 A/B의 본인 업체 및 본인 멤버십 | 각각 1행 |
| A→B/B→A 업체, 다른 직원 멤버십 | 빈 배열, RLS |
| A의 동일 업체 다른 approved 멤버십(ANONYMOUS 행) 조회 | 빈 배열; 타인 user_id 차단을 독립 확인 |
| pending/revoked 본인 membership | 빈 배열 |
| suspended 업체 | 빈 배열 |
| suspended 업체의 approved 본인 membership | 1행; membership 정책에 업체 상태 조건 없음 |
| GENERAL/PENDING/ANONYMOUS의 manifest 업체/멤버십 조회 | 각 정확한 UUID에서 빈 배열 |
| 회원/일반/익명의 업체·멤버십 INSERT/UPDATE/DELETE | 42501 GRANT 거부 |
| membership business_id/user_id/role owner/admin/status 위조 | 42501 GRANT 거부 |
| pending 자기 승인 및 suspended 업체 자기 승인 | 42501 GRANT 거부 |
| 비로그인 두 테이블 GET/POST/PATCH/DELETE | GRANT 거부(401+42501 허용), 사용자 인증 실패와 구분 |
| A/B의 타인 고객 프로젝트 GET/PATCH/DELETE | 빈 배열/영향 0행, RLS; 전체 원본 비교 |

역할 자체로 추가 권한을 만들지 않는다. 모든 고객 프로젝트 요청도 직원의 실제 JWT로 실행한다.
이미 접근 권한이 없으므로 revision 조건을 긍정 시험하지 않는다. projects의 revision/updated_at을 포함한
원본 전체의 불변성을 확인한다. 업체/membership 테이블에 없는 revision 컬럼은 가정하지 않는다.

JWT issuer/sub/role/is_anonymous/만료>60초와 실제 GET /user, 관리자 GET /admin/users를 모두 확인한다.
Email은 실제/관리자 응답의 confirmed 상태도 확인한다. 토큰 디코딩만으로 성공 처리하지 않는다.
Auth 오류는 본문/헤더/구형 숫자 HTTP 상태 호환 함수를 재사용하며 충돌은 실패다.
권한 없는 INSERT의 2xx는 빈 배열이어도 실패, GRANT 차단 기대에서 2xx 빈 배열도 실패다.
RLS 0행은 관리자 원본 전체와 전후 일치해야 통과한다. 고객 401/만료/다른 API 오류는 성공 처리하지 않는다.

## 모드와 환경변수

`node supabase/tests/phase4c3-businesses.mjs --plan`은 환경변수·네트워크 없이 구성만 출력한다.
실제 입력 UID가 있을 때만 BATH_BUSINESS_USERS_FILE과
BATH_BUSINESS_PLAN_CONFIRM=write-local-business-plan을 지정하면 private manifest/journal을 생성한다.
BATH_TEST_SECRET_STORAGE_CONFIRM=private-acl-verified 및 실제 Windows 폴더 ACL 검사도 요구한다.
--plan은 원격 Auth/DB를 확인하거나 생성하지 않는다. manifest 생성 후 신뢰 표식 설정은
별도 Auth 준비 절차/승인 책임이다. 이번에 계정 준비기를 새로 구현한 것은 아니다.

모든 실제 private 파일은 기존 `tests/artifacts/phase4a2` 아래에 두며 기존 ACL과 Git 제외를 유지한다.
manifest/journal 파일은 제한된 폴더 ACL을 상속한다. 비-Windows에서는 실제 ACL 검증기를 구현하기 전 실행을 차단한다.
다른 사용자가 읽을 수 있는 파일을 복사해서 이 폴더의 ACL을 바꾸지 않는다.

공통 URL/개발 확인값/Publishable key/Admin key/Management token은 기존 이름을 사용한다.
추가 입력:

| 이름 | 용도 |
|---|---|
| BATH_BUSINESS_USERS_FILE | --plan의 선택적 실제 UID JSON, 기존 private 폴더 안 |
| BATH_BUSINESS_MANIFEST / BATH_BUSINESS_JOURNAL | --plan으로 생성한 두 파일 전체 경로 |
| BATH_TEST_BUSINESS_A_TOKEN / BUSINESS_B_TOKEN / GENERAL_TOKEN / PENDING_TOKEN / ANONYMOUS_TOKEN | 5개 실제 사용자 세션, --check/--run만 필요 |
| BATH_BUSINESS_EXECUTION_CONFIRM | --run: run-business-tests / --cleanup: cleanup-business-fixture |
| BATH_TEST_SECRET_STORAGE_CONFIRM | 로컬 ACL 확인 후 private-acl-verified |
| BATH_TEST_DB_CONFIG | 별도 Direct 연결 JSON, 기존 private 폴더 안 |
| BATH_BUSINESS_FIXTURE_CONFIRM | Fixture --run만: create-business-fixture |

표의 토큰 이름은 각각 BATH_TEST_ 접두사를 포함한다. 예를 들어 BATH_TEST_GENERAL_TOKEN이다.
토큰/비밀번호/관리자 키는 콘솔·journal·문서·NEXT_PUBLIC에 쓰지 않는다.
예제 파일에는 실제 값이 없다. 이번에는 기존 credentials.env.local을 읽거나 수정하지 않았다.

## Fixture 생성 경로

새 fixture 도구는 정확한 Direct hostname/postgres/5432만 허용한다. Session Pooler면 네트워크 전 차단한다.
Management GET으로 실제 프로젝트 Ref/이름/정상 상태/DB host를 재확인한다.
psql 15+와 CA, 외부 pgpass의 ACL을 확인하고 PGPASSFILE은 자식 프로세스에만 지정한다.
비밀번호 내용은 읽거나 프로젝트에 복사하지 않는다. 다른 PG* override 및 키를 psql에 상속하지 않는다.

Direct --check는 BEGIN READ ONLY → 기존 phase4a4-connection-check.sql → read_only=on 확인 → COMMIT이다.
Direct --run은 journal.fixture_attempted=true를 먼저 flush한 뒤 새 SQL을 실행한다.
동일 psql 연결에서 기존 스키마 지문/TLS guard와 exact Direct guard, 내부 pg_stat_ssl=true를 모두 요구한다.
SQL은 단일 BEGIN/COMMIT, transaction advisory lock, 실제 Auth marker/type/confirmed 상태,
UUID 전역 중복/기존 데이터 충돌을 검사한다. 새 데이터만 INSERT하며 overwrite/upsert는 하지 않는다.
원격 COMMIT 후 응답 유실도 있을 수 있으므로 실패 시 UNKNOWN_OR_FAILED로 남기고 자동 재실행하지 않는다.
업체 --check/--run은 COMMITTED 기록과 실제 전체 Fixture를 확인해야 진행한다.
전체/부분 생성 상태는 --cleanup에서 식별자와 graph를 확인하고 정리할 수 있다.

## 정리 안전성 및 중단 복구

--run은 started 상태를 요청 전에 기록하고 같은 journal을 재실행하지 못하게 한다.
요청 전 probe UUID와 intended row를 추가하고 실패/중단 시 pending 요청·정리 상태를 기록한다.
manifest와 journal 내용이 다르거나 추가 baseline 행을 주입하면 네트워크 전에 거부한다.
같은 fixture의 독점 lock은 생성/테스트/정리가 공유한다.

정리 전 모든 대상 row의 UUID/업체 이름/멤버 business_id+user_id+role+status/프로젝트 owner와 표식을 확인한다.
업체·사용자의 membership graph와 전용 사용자의 프로젝트를 조회해 manifest 밖 자원이 있으면 중단한다.
다른 고객/업체 전체 목록은 조회하지 않는다. 실제 계정이 전용이라는 신뢰 app_metadata도 재확인한다.
삭제 순서는 프로젝트/신규 probe → 멤버십 → 업체다. 업체 삭제 직전 inbound membership 0행을 요구한다.
CASCADE로 누락된 membership을 지우지 않는다. 각 UUID의 실제 삭제 후 부재도 확인한다.
부분 Fixture는 존재하는 subset만 검증·정리하며 반복 cleanup도 안전하다.
삭제 응답 유실은 같은 ID의 다음 조회로 복구하고, 실패하면 cleanup_complete=false/전체 실패다.

**Auth 5명은 외부 준비 도구가 생성한 자원으로 유지한다. 이 실행기에는 Auth DELETE 경로가 없다.**
정리 실패를 Auth CASCADE로 덮지 않는다. 성공 로그와 journal도 external Auth retained를 명시한다.
계정 생성 주체의 provisioning journal과 별도 승인으로, DB 정리 완료 및 잔여 project/membership 0행을
확인한 뒤 계정 주체가 정리해야 한다. 이를 완료하지 않고 전체 Auth 정리 완료라고 보고하면 안 된다.

프로세스 강제 종료 시 finally가 실행되지 않을 수 있다. 남은 lock은 활성 프로세스가 없는지
운영자가 확인한 후에만 수동으로 해제하고 기존 journal로 --cleanup한다. 새 --run으로 복구하지 않는다.
스냅샷의 identity/value drift는 자동 권한 확대/수정 없이 수동 검토 대상으로 남긴다.

## 검증과 실제 실행의 차이

새 테스트는 네트워크 fetch와 psql spawn을 전부 mock으로 대체하고 격리된 ignored 폴더만 사용한다.
최종 오프라인 테스트 **29개 통과**, 새 실행 모듈 3개의 Node 구문 검사 통과.
정상/대기/취소/정지/익명/비로그인, 위조·누출·숨은 변경, 잘못된 Ref, 네트워크 오류,
중단/부분 Fixture/정리 실패/재시도/외부 inbound membership/위조 journal/Direct 제한을 확인한다.
실제 RLS나 SQL runtime 성공을 증명하지는 않는다. SQL은 정적 검토만 수행했고,
BEGIN/DO/psql 메타 명령의 실제 PostgreSQL 실행은 승인된 Direct 환경에서 검증해야 한다.

이번에 실행한 명령:

```powershell
node --check supabase/tests/phase4c3-model.mjs
node --check supabase/tests/phase4c3-businesses.mjs
node --check supabase/tests/phase4c3-fixture.mjs
node --test supabase/tests/phase4c3-businesses.test.mjs
node supabase/tests/phase4c3-businesses.mjs --plan
node supabase/tests/phase4c3-fixture.mjs --plan
```

## Direct 확보 후 순서 (이번에는 실행 금지)

1. 별도 승인으로 5개 실제 전용 Auth와 로그인 세션 준비; 생성자 journal 확보.
2. private users JSON → 업체 --plan으로 manifest/journal 생성 → 생성자가 app_metadata 표식 결합.
3. 승인된 Direct 설정/CA/외부 pgpass 준비 후 fixture --check.
4. 3업체/6membership/일회용 프로젝트 1개 생성을 별도 승인한 뒤 fixture --run.
5. 업체 --check(GET-only) → 업체 테스트 승인 후 업체 --run(끝에서 DB Fixture 정리).
6. 실패/부분 상태는 업체 --cleanup. DB 정리 완료 후 생성자 책임으로 Auth 정리.

실제 명령 형식은 아래와 같다. 환경 파일에 필요한 경로/키/실제 JWT와 각각의 승인 확인값이 있어야 한다.

```powershell
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4c3-fixture.mjs --check
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4c3-fixture.mjs --run
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4c3-businesses.mjs --check
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4c3-businesses.mjs --run
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4c3-businesses.mjs --cleanup
```

현재 Direct 네트워크·실제 사용자5명·세션·manifest는 미준비이므로 원격 실행 불가다.
원격 DB 실행 경로 승인이나 유료 IPv4 기능 활성화를 이번 코드가 자동으로 수행하지 않는다.
