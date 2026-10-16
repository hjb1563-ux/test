# PHASE 4A.1 — 관리자 테스트 최소 권한 Migration 검토

대상: bath-designer-dev / istsrambmbzuemkgutgh. 2026-10-16 점검.
판정: 준비 완료, 원격 적용 승인 대기. 원격 GRANT·설정·데이터는 변경하지 않았다.

## 관리자 DB 호출과 역할 구분

phase2-rls.mjs의 api('ADMIN'), rows('ADMIN'), one(), snapshot(), cleanup()와
phase2-fixtures.sql을 다시 읽고 실제 작업 경로를 대조했다.

| 실행 주체 / 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Node ADMIN / projects | 필요: 충돌·상태·정리 검증 | 불필요 | 필요: snapshot 업무 필드 10개 복원 | 필요: 실행 전용 프로젝트 삭제 |
| Node ADMIN / businesses | 필요: Fixture·상태 확인 | 불필요 | 불필요 | 필요: 차단됐어야 할 업체 INSERT가 성공한 경우 삭제 |
| Node ADMIN / business_members | 필요: Fixture graph·상태 확인 | 불필요 | 필요: role/status 복원 | 필요: 위조 INSERT가 성공한 경우 삭제 |
| Fixture psql / businesses | 운영자 검사 | 필요 | 사용 안 함 | 현재 준비 SQL은 사용 안 함 |
| Fixture psql / business_members | 운영자 검사 | 필요 | 사용 안 함 | 현재 준비 SQL은 사용 안 함 |

Fixture psql은 postgres 운영자 연결을 사용하며 service_role 클라이언트가 아니다.
projects INSERT는 CUSTOMER_A(정상) 또는 CUSTOMER_B(타인 owner 위조 차단 테스트)의
실제 사용자 토큰을 사용한다. 관리자 projects INSERT는 없으며 어떤 테이블에도
service_role INSERT를 추가하지 않는다. 관리자 Auth /admin/users GET도 DB INSERT가 아니다.

## 신규 파일과 전체 SQL

공식 CLI migration new로 생성:
supabase/migrations/20261016080040_phase4a1_service_role_test_privileges.sql

실행 SQL은 아래 세 GRANT뿐이다.

```sql
grant select, delete on public.projects, public.businesses, public.business_members to service_role;
grant update (project_info, builder_mode, selections,
  consultation_memo, special_notes, current_step, consultation_checks,
  image_history_order, content_modified_at, schema_version)
  on public.projects to service_role;
grant update (role, status)
  on public.business_members to service_role;
```

UPDATE는 테이블 전체가 아닌 cleanup()의 복원 컬럼 10개/2개에 한정한다.
projects의 id/created_at/revision/updated_at, business_members의 id/created_at,
businesses의 모든 UPDATE, 모든 INSERT는 추가하지 않는다.
owner_user_id UPDATE는 불변 트리거 때문에 제거했다. business_id/user_id를 수정하는
UPDATE 테스트는 없으며 과거의 포괄적 복원 목록에만 포함돼 있어 해당 권한도 제거했다.
cleanup()도 불변 식별 필드를 PATCH하지 않도록 최소 보완했다. projects의 id/owner_user_id/
created_at, business_members의 id/business_id/user_id/created_at는 복원 전후 불변 여부를
검사한다. 불일치하면 원본 snapshot을 유지하고 수동 복구 필요 및 정리 실패로 기록한다.
revision/updated_at의 트리거 내부 갱신은 그대로 유지한다.

이전 PHASE4A 문서의 테이블 단위 UPDATE 초안보다 좁은 최종안이다.
전역 schema GRANT ALL, default privileges, 역할 변경, RLS/DDL/함수 변경이 없다.
기존 service_role에 남아 있던 TRUNCATE/REFERENCES/TRIGGER/MAINTAIN 등도 이번 범위에서
추가·회수하지 않는다. 요청된 기존 권한을 임의로 정리하지 않았다.

## 일반 사용자에게 추가 접근을 주지 않는 이유

현재 pg_has_role(...,'service_role','USAGE')는 anon/authenticated 모두 false다.
새 GRANT의 대상은 service_role 하나이며 역할 상속, BYPASSRLS, RLS, anon/authenticated
권한은 변경하지 않는다. 따라서 기존 사용자 세션의 DB 권한은 확대되지 않는다.
Anonymous Auth 로그인 사용자도 authenticated 역할이므로 관리자 GRANT를 받지 않는다.
이는 PostgreSQL의 역할/컬럼 권한 모델에 따른다:
[GRANT](https://www.postgresql.org/docs/17/sql-grant.html).

단, service_role 자체는 BYPASSRLS=true다. 승인 후 관리자 키는 해당 테이블의 다른 행도
조회/삭제할 수 있으므로 DB 차원에서 테스트 행만 허용하는 권한으로 오해하면 안 된다.
전용 계정·Fixture·journal의 정확한 UUID 검사로 테스트 대상을 제한한다.
관리자 키는 서버/운영자 환경에만 보관하며 프론트엔드나 NEXT_PUBLIC_*에 넣지 않는다.
RLS 차단 성공 판정에는 실제 사용자 토큰만 사용한다.

## 변경 전 실제 권한 / 검증 SQL

has_table_privilege와 has_column_privilege를 읽기 전용으로 실행했다.

- service_role: 세 테이블 CRUD 모두 false, 전 컬럼 INSERT/UPDATE도 false.
- anon: 세 테이블 CRUD 모두 false.
- authenticated: projects SELECT/DELETE, 지정 컬럼 INSERT/UPDATE; 업체 두 테이블 SELECT.
- service_role BYPASSRLS=true. 위 두 일반 역할의 service_role 권한 상속은 false.

검증 파일: supabase/tests/phase4a1-privileges.sql.
두 기대 상태(before/after)를 같은 실제 DB 권한과 비교한다.
최종 최소 권한안의 결과는 before 270/270 일치, after 226/270 일치다. after 불일치 44개는
아직 적용하지 않은 service_role의 SELECT/DELETE/컬럼 UPDATE 차이이며 예상 결과다.
after 검증을 통과했다고 보고하지 않는다.

후속 승인 후 적용하면 같은 SELECT를 재실행하여 after 270/270 일치, mismatches=[]를
확인해야 한다. 일반 역할의 권한도 각 단계의 기대값에 포함돼 있어 불필요한 권한 확대를
검출한다. 컬럼 UPDATE만 부여하므로 has_table_privilege(...,'UPDATE')는 적용 후에도 false가
정상이며, has_column_privilege로 허용 컬럼/비허용 컬럼을 각각 확인해야 한다.
[권한 조회 함수](https://www.postgresql.org/docs/17/functions-info.html).

추가 적용 후 확인 항목:
- role 상속 두 값이 여전히 false, BYPASSRLS 속성 변화 없음
- pg_policies 6개 정의, 트리거 2개 정의, CASCADE/모든 기존 CHECK 변화 없음
- 실제 관리자 Data API GET 가능 여부 및 Security Advisor 재확인
- 계정/Fixture 없이 확인 가능한 단계까지만 수행하고 실제 RLS 테스트는 별도 승인

## Dry Run 결과

연결 Ref와 프로젝트명/상태를 재확인했다. CLI 2.121.0을 사용했다.

- 로컬 Migration 2개, 원격 적용 이력 1개(20261016000100 / phase2_core)
- 신규 20261016080040 하나만 로컬 미적용 상태
- 명령: npx.cmd --no-install supabase db push --linked --dry-run --skip-vault
- 종료 코드 0, dryRun=true
- 예정 파일: 20261016080040_phase4a1_service_role_test_privileges.sql 하나
- seeds=[], roles=[]; 후자는 roles.sql 적용 대상이 없다는 뜻이며 이 Migration의 GRANT와는 별개
- 적용된 core SQL SHA256는 C28D0C317BD5A0BC56BC9B5C932EE1130EBACB48D05A69DF91FEB402AE6BDE1E 그대로

정적 검사로 GRANT 3개만 존재하고 대상 role이 service_role뿐인지 확인했다.
UPDATE 컬럼을 테스트 cleanup() 배열에서 추출하여 신규 GRANT 목록과 정확히 대조했다.
권한 검증 SQL의 기대 컬럼도 동일한 목록과 대조했다. Node 구문 검사 및 11개 오프라인
모의 경로(정상, 예상 밖 INSERT/UPDATE/DELETE/role/status, 정리 실패, 인증/대상 오류,
프로젝트/멤버십 식별 필드 변조)가 통과했다. 관리자 PATCH에 제거한 식별 컬럼이나
revision/updated_at가 포함되면 모의 검증도 실패하도록 확인했다.
복원 비교는 업무 필드와 불변 필드를 구분한다. revision/updated_at는 되감거나 원본과
동일하다고 요구하지 않으며, 모의 서버에서 이 값이 바뀌어도 업무 값 복원이 성공했다.
식별 변조는 조용히 무시하지 않고 CLEANUP_FAILED 및 exit code 1로 보고한다.
실제 고객 데이터는 사용하지 않았다. journal의 실행 전용 UUID/표식 검사와 baseline
전용 계정·Fixture 검사를 유지했고, 실제 사용자 세션 테스트는 실행하지 않았다.
Dry Run은 실제 GRANT 실행/권한 변화 검증을 대신하지 않는다. 이번에는 원격 실행이 없다.
Fixture·프론트엔드와 적용된 core Migration은 수정하지 않았다. 테스트 실행기는 위에서
설명한 복원 컬럼 축소·불변 필드 검증만 최소 보완했다.

## Auth 읽기 전용 재확인

공개 Auth settings GET 결과: Anonymous=false, Email=true, disable_signup=false,
mailer_autoconfirm=false(이메일 확인 유지). 조회에 사용한 키/토큰은 출력·저장하지 않았다.

사용자가 후속 승인 범위에서 개발 프로젝트 Dashboard의 Authentication →
Sign In / Providers → Anonymous Sign-Ins를 켜야 익명 세션 준비가 가능하다.
[공식 Anonymous Auth 안내](https://supabase.com/docs/guides/auth/auth-anonymous).
이번에는 Anonymous/Email을 포함한 Auth 설정을 변경하지 않았다.

## 승인 대기

신규 권한 Migration만 적용할지 승인 대기한다. Anonymous 활성화는 별도의 Dashboard 작업이다.
이번 작업에서는 원격 적용, 계정 생성, Fixture 생성, 실제 RLS 테스트, Commit/Push/배포를
하지 않았다. 권한 Migration 준비 완료는 전체 실제 RLS 테스트 환경 준비 완료를 뜻하지 않는다.

