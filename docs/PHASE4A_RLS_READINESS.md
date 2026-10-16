# PHASE 4A — 실제 RLS 테스트 준비 점검

> 최신 상태: PHASE 4A.1 권한 적용 완료. PHASE 4A.2에서 Anonymous=true, Email=true를
> 읽기 전용으로 확인하고 세션 준비 도구를 추가했다. 아래 과거 미설정/미적용 기록 대신
> [계정·세션·Fixture 준비 안내](PHASE4A_2_SESSION_PREPARATION.md)를 우선 참조한다.

> PHASE 4A.1에서 관리자 UPDATE를 복원 컬럼에 한정한 신규 Migration과 전후 권한 검증 SQL을
> 준비했다. [최종 최소 권한안·Dry Run 결과](PHASE4A_1_ADMIN_PRIVILEGES.md)를 우선 참조한다.
> 아래 테이블 단위 UPDATE SQL은 과거 초안이며 실행하지 않는다. 원격 권한은 아직 그대로다.

확인일: 2026-10-16. 대상은 bath-designer-dev / istsrambmbzuemkgutgh뿐이다.
이번에는 읽기 전용 조회와 문서 작성만 했다. 계정/Fixture/프로젝트 생성, 인증 설정 변경,
권한 변경, Migration 변경, 사용자 RLS 공격 테스트는 하지 않았다.

## 현재 판정: 부분 완료 — 다음 실행 전 두 가지 보완 필수

1. Anonymous Auth 비활성. 개발 프로젝트에서 활성화하는 별도 승인이 필요하다.
2. service_role의 세 테이블 SELECT/INSERT/UPDATE/DELETE 유효 권한이 모두 false.
   BYPASSRLS=true도 테이블 GRANT를 대체하지 않는다. 현재 스크립트의 관리자 Data API
   SELECT와 정리/복원이 실패하므로 이 상태에서 Fixture를 만들거나 --run을 실행하지 않는다.

두 번째 문제는 테이블/컬럼 이름 불일치가 아니라 운영자 경로의 실제 권한 부족이다.
기존 PHASE 3B의 anon/authenticated 권한 검증만으로 관리자 정리 경로까지 준비됐다고
판단할 수 없다. Security Advisor의 경고 유무도 해당 실행 권한을 보장하지 않는다.

### 승인 검토용 최소 권한안 (미실행)

현재 Node 테스트 실행기에 필요한 경로만 고려하면 다음 범위다.
기존 적용 Migration은 수정하지 않는다. 승인 시 별도 변경 기록/후속 Migration으로 처리한다.

```sql
-- 제안만 작성. 이번 PHASE 4A에서는 실행하지 않음.
grant select on public.projects, public.businesses, public.business_members to service_role;
grant update on public.projects, public.business_members to service_role;
grant delete on public.projects, public.businesses, public.business_members to service_role;
```

이 제안은 테스트 관찰·복원·삭제용 서버 운영자 권한이다. anon/authenticated의 권한과
RLS 정책은 바꾸지 않는다. Fixture SQL은 별도 postgres 운영자 연결을 사용하므로
위 제안에는 service_role INSERT를 추가하지 않았다. 향후 REST 기반 Fixture 준비를
선택하면 필요한 INSERT 권한과 범위도 별도 승인해야 한다.
권한 부여 후에는 has_table_privilege/has_column_privilege 및 관리자 GET을 재검증한다.

## 실제 인증 설정 확인

CLI 2.121.0의 config diff는 help에서 읽기 전용임을 확인한 후 사용했다.
전체 응답/키는 출력하거나 저장하지 않고 필요한 boolean만 추렸다.
지정 프로젝트의 GET /auth/v1/settings로도 교차 확인했다.

| 항목 | 현재 원격 값 |
|---|---|
| Anonymous Auth (external.anonymous_users) | false |
| Email Auth (external.email) | true |
| 회원가입 차단 (disable_signup) | false |
| 이메일 자동확인 (mailer_autoconfirm) | false |
| Email confirmation (Management config diff) | true |

로컬 config.toml은 원격 인증 설정의 증거가 아니다. config pull/push는 실행하지 않았다.
익명 로그인은 실제 사용자를 생성하므로 설정 확인을 위해 호출하지 않았다.
Anonymous 설정 변경은 해당 개발 프로젝트 Dashboard의 Authentication → Sign In / Providers
→ Anonymous Sign-Ins에서 별도 승인 후 수행하고 다시 읽기 전용 확인한다.
Email 확인을 전역으로 끄는 변경은 필요하지 않다.

## 계정·세션 준비 순서 (다음 단계 승인 후)

실제 이메일/비밀번호/UID/access token/refresh token을 문서·로그·채팅에 기록하지 않는다.
고객 계정 재사용 금지. 일반 사용자 로그인 화면은 필요 없다.

1. 먼저 fixture_id UUID v4를 로컬에서 하나 생성하고 안전하게 보관한다.
2. 독립적인 두 Anonymous Auth 로그인으로 CUSTOMER_A/B를 생성한다.
   signInAnonymously 또는 동일 Auth REST 요청을 Node에서 각각 수행한다.
   두 번째 요청에 첫 번째 사용자의 세션을 재사용하지 않는다.
3. BUSINESS_A/B, GENERAL, PENDING은 서로 다른 전용 Email/password 계정 네 개다.
   관리자 Auth createUser로 전용 계정만 email_confirm:true로 만들 수 있다.
   이는 테스트 계정 한정의 운영자 준비이며 전역 Email 확인 설정은 유지한다.
   또는 일반 signup 후 실제 이메일 확인을 완료한다. 가짜 고객 이메일/개인정보를 쓰지 않는다.
4. 관리자 Auth updateUserById로 여섯 사용자 모두의 신뢰된 app_metadata에
   bath_rls_fixture = fixture_id를 설정한다. 익명 사용자의 표식도 관리자 경로로만 설정한다.
   user_metadata로 이 전용 계정 증명을 대신하지 않는다. auth.users SQL INSERT 금지.
5. 정식 네 계정은 각자 signInWithPassword로 실제 사용자 세션을 발급받는다.
   관리자 createUser 성공 자체는 사용자 로그인 성공이 아니다.
   익명 두 계정의 세션도 별도로 보관하며 필요한 경우 refresh token으로 갱신한다.
6. UID 6개가 모두 다르고 UUID v4인지, 고객 둘만 is_anonymous=true인지,
   access token issuer/sub/role/exp 및 /auth/v1/user가 일치하는지 확인한다.
   테스트는 만료까지 60초 이하인 토큰을 거부하므로 실행 직전 갱신한다.
7. 기존 runbook의 manifest 생성 예시를 사용한다. 프로젝트/계정 UID는 실제 발급값,
   업체 3개·멤버십 6개 ID만 새 UUID v4다. manifest에 키·토큰·비밀번호를 넣지 않는다.

현재 계정/세션 발급용 별도 실행 스크립트는 없다. phase2-rls.mjs는 기존 세션을 검증하는
실행기이며 계정을 생성하거나 로그인/토큰 갱신을 대신하지 않는다. 후속 승인 범위에서
Node fetch 또는 승인된 고정 SDK 버전으로 운영자 준비 스크립트를 마련해야 한다.
각 응답은 메모리에만 처리하고 토큰을 콘솔에 출력하지 않아야 한다.
이 단계에서는 의존성도 추가하지 않았다.

공식 근거:
[Anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous),
[관리자 createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[사용자 password 로그인](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).

## 실제 소스 기준 환경변수

아래 13개 모두 현재 이 실행 환경에서 값이 없음을 이름/존재 여부만 검사했다.
CLI 로그인은 BATH_TEST_MANAGEMENT_TOKEN이나 사용자 access token을 자동 설정하지 않는다.

| 변수 | 분류/값 |
|---|---|
| BATH_TEST_SUPABASE_URL | https://istsrambmbzuemkgutgh.supabase.co |
| BATH_TEST_PUBLISHABLE_KEY | 해당 개발 프로젝트의 활성 publishable/legacy anon 키 |
| BATH_RLS_TEST_CONFIRM | bath-designer-dev |
| BATH_TEST_MANAGEMENT_TOKEN | Management API의 지정 프로젝트 조회가 가능한 운영자 access token |
| BATH_TEST_ADMIN_KEY | 해당 개발 프로젝트 서버용 secret/service_role 키. Auth 조회·DB 관찰·정리 전용 |
| BATH_TEST_FIXTURE_FILE | 실제 UID·전용 Fixture ID가 있는 JSON manifest 경로 |
| BATH_TEST_JOURNAL | tests/artifacts/ 바로 아래 새 실행 JSON 경로 (--run/--cleanup에 필요) |
| BATH_TEST_CUSTOMER_A_TOKEN | 익명 고객 A의 실제 access token |
| BATH_TEST_CUSTOMER_B_TOKEN | 익명 고객 B의 실제 access token |
| BATH_TEST_BUSINESS_A_TOKEN | 정식 업체 A 담당자 access token |
| BATH_TEST_BUSINESS_B_TOKEN | 정식 업체 B 담당자 access token |
| BATH_TEST_GENERAL_TOKEN | 멤버십 없는 정식 사용자 access token |
| BATH_TEST_PENDING_TOKEN | pending 멤버십 정식 사용자 access token |

위 표는 고정 설정 7개 + 세션 6개로 총 13개다.
CUSTOMER_A_USER_ID 등의 USER_ID 변수는 runbook의 manifest 작성 예시에만 쓰이며
Node 실행기의 필수 환경변수가 아니다. BATH_TEST_ANONYMOUS_TOKEN, BUSINESS_A_ID 등은
현재 실행기가 읽지 않는다. ANON은 토큰 없는 별도 요청이다.
값은 환경/비밀 저장소에만 공급하고 NEXT_PUBLIC 변수/브라우저에 관리자 키를 넣지 않는다.
.env.example은 이번에 작성/수정하지 않았다.

## Fixture 구조·실행 도구

| 구조 | 연결/상태 |
|---|---|
| 업체 A | approved / BUSINESS_A approved member |
| 업체 B | approved / BUSINESS_B approved member |
| 업체 A / PENDING | pending member |
| 업체 A / CUSTOMER_A | approved member지만 Anonymous Auth이므로 업체 접근 불가 |
| 정지 업체 | suspended / BUSINESS_A approved member |
| 업체 A / BUSINESS_B | revoked member |
| GENERAL, CUSTOMER_B | 멤버십 없음 |

업체 총 3개, 멤버십 총 6개. 전용 프로젝트는 Fixture SQL이 만들지 않고 --run에서
새 UUID로 만들고 삭제한다. 고객 A의 정상 DELETE 대상과 고객 B의 공격 대상도 분리한다.
정지 업체의 approved 자기 멤버십 행이 보일 수 있는 것은 기존 정책이다.
정지 업체 자체 조회와 revoked 멤버십 행 접근 차단을 검사한다.

기존 Fixture SQL은 psql 전용 메타 명령(\\getenv, \\gset, \\if 등)을 포함한다.
Node 테스트는 Node >=20만 필요하며 현재 v24.20.0이다. CLI는 2.121.0이다.
psql/Docker는 PATH에서 없고 알려진 Docker Desktop 실행 파일도 이전 점검에서 없었다.
실제 psql 구문 실행은 하지 않았다.

| 방법 | 기존 Fixture SQL 사용 | 필요한 준비 |
|---|---|---|
| Windows psql 15+ | 그대로 가능, 우선 권장 | [공식 Windows 배포](https://www.postgresql.org/download/windows/)의 클라이언트 도구, direct host 연결, TLS CA |
| WSL/컨테이너의 psql 15+ | 그대로 가능 | 런타임 설치, 파일 경로·비밀 입력·direct 연결 재확인 |
| CLI db query / SQL Editor | 그대로 불가 | psql 메타 명령을 지원하지 않으므로 단순 복사 실행 금지 |
| 별도 Node/Postgres 또는 REST 준비 도구 | 새 구현 필요 | 동일 대상·계정·충돌 검사·트랜잭션/복구 보장 및 승인 |

Fixture에는 실제 Auth UID·manifest UUID를 psql 변수로 전달한다. 전체 변수 매핑과 명령은
PHASE2_6_RLS_RUNBOOK.md를 따른다. PostgreSQL 운영자 비밀번호는 안전한 pgpass/비밀 입력,
PGHOST=db.istsrambmbzuemkgutgh.supabase.co, PGSSLMODE=verify-full,
PGSSLROOTCERT=신뢰할 CA 경로를 사용한다. SQL은 host·Ref·TLS·전용 표식·기존 데이터
충돌을 검증하고 한 트랜잭션으로 삽입한다. 기존 Fixture와 정확히 일치하면 중복 생성하지
않고 불일치하면 중단한다. pooler나 SQL Editor로 guard를 우회하지 않는다.
direct host 통신 가능 여부와 인증/CA는 아직 미검증이다.

## 시나리오·안전장치 검토

기존 실행기는 고객 A CRUD, 고객 B SELECT/UPDATE/DELETE 차단, owner 변경·위조,
비로그인 anon 접근, 승인 업체 자기 조회, 타 업체·정지 업체·취소 멤버십·미승인·일반
사용자 조회 차단, 업체/멤버십 위조 INSERT, role/승인 자가 변경을 포함한다.
테스트 필드/타입은 실제 세 테이블과 일치하며 새 JSONB 제한보다 작은 값을 사용한다.
node --check는 통과했다. 실제 세션이 없어 --preflight도 실행하지 않았다.

관리자 요청은 관찰·정리·복원에만 사용하며 RLS 판정 요청에는 실제 사용자 토큰을 쓴다.
인증 오류·만료·네트워크 오류를 차단 성공으로 계산하지 않는다.
Ref/URL/실시간 Management identity/전용 app_metadata/Fixture graph를 검증한다.
UUID와 run_id, 원본 snapshot을 요청 전에 journal에 기록한다.
예상 밖 성공은 실패 처리하고 정확한 ID로 복원·삭제 후 확인한다.
정리 실패는 table/ID/run_id/reason을 기록하고 exit code 1로 종료한다.
강제 종료 뒤에는 같은 manifest/journal로 --cleanup을 재실행한다.
baseline Fixture 자체나 Auth 사용자 철거는 별도 운영자 작업이다.
자동 복원은 원본 업무 필드를 복원하며 revision/updated_at를 되감지 않는다.
소유권 불변 트리거가 복원을 막거나 Fixture가 손상되면 수동 복구가 필요하다.

## 후속 승인 후 실행 순서

Anonymous Auth 및 관리자 DB 권한 보완 → 준비 스크립트 검토 → 계정·세션 6개 →
manifest/관리자 표식 → psql 도구·TLS → Fixture 3업체/6멤버십 → 아래 preflight →
실제 --run → 정리 결과와 잔여 데이터 확인 순서다.
운영자 자격증명/도구가 준비됐다면 준비·세션·Fixture·검증에 대략 30~60분을 예상하며,
메일 확인·네트워크/권한 문제는 추가 시간이 필요할 수 있다.

```powershell
# 후속 승인 및 실제 계정/Fixture/환경 준비 완료 후에만 실행.
node --check supabase/tests/phase2-rls.mjs
node supabase/tests/phase2-rls.mjs --preflight
# preflight 성공 후 새 journal 경로를 지정하고 실행
node supabase/tests/phase2-rls.mjs --run
# 실패/강제 종료 후 동일 journal을 사용한 관리자 정리
node supabase/tests/phase2-rls.mjs --cleanup
```

이번 점검의 읽기 전용 DB 확인 결과: 세 테이블 0행, RLS 모두 활성, 정책 6개, 트리거 2개,
최신 CHECK 존재. 기존 테스트·Fixture·Migration 파일은 수정하지 않았다.

