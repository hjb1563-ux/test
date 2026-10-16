# PHASE 4C-1 — 업체 RLS 및 Fixture 실행 계획

> 후속 [PHASE4C-2 Direct 검증 및 최소 사용자 재검토](PHASE4C_2_DIRECT_READINESS.md):
> 현 Windows Direct IPv6 불가 확인. 기존 호환안 6사용자는 필수 최소가 아니며,
> 업체 전용 설계는 Email 4명 또는 익명 배제 포함 Email 4+Anonymous 1명으로 축소 가능하다.

2026-10-16. 분석/정적 검증만 수행했다. 대상은 bath-designer-dev /
istsrambmbzuemkgutgh이며 실제 사용자/Fixture 생성, 원격 SQL 실행, 권한/설정 변경은 없다.
고객 PHASE 4B-2 계정은 이미 삭제됐으므로 재사용하지 않는다.

## A. 현재 권한 모델

근거: 20261016000100_phase2_core.sql 및 20261016080040_phase4a1_service_role_test_privileges.sql.

- businesses.status: pending / approved / suspended.
- business_members.status: pending / approved / revoked; role: owner / admin / member.
- FK: membership→business, membership→auth.users 모두 ON DELETE CASCADE.
- authenticated는 업체 두 테이블의 SELECT만 가능하다. INSERT/UPDATE/DELETE 권한과 쓰기 RLS 정책은 없다.
- 비로그인 anon은 두 테이블 접근 권한이 없다.
- 업체 SELECT: 업체 approved + JWT is_anonymous가 정확한 문자열 false + 본인의 approved membership 필요.
- 멤버십 SELECT: 본인 user_id + membership approved + JWT is_anonymous=false.
  이 정책은 업체 상태를 조회하지 않는다. **정지/대기 업체라도 승인된 본인 membership은 보인다.**
- 같은 업체 직원이어도 타인의 membership은 안 보인다. 전체 직원 명단 권한은 없다.
- role 값은 두 SELECT 정책에서 사용하지 않는다. owner/admin이라고 더 넓은 권한이나 승인 권한이 생기지 않는다.
- 익명 인증 사용자는 authenticated지만 is_anonymous 조건으로 업체 데이터에서 배제된다.
  일반 Email 사용자도 approved membership 없이는 업체 데이터를 읽지 못한다.
- projects는 누구나 자신의 프로젝트만 CRUD하는 기존 정책이다. 업체 회원에게 다른 고객 프로젝트를 읽을 권한은 없다.
- service_role: 두 업체 테이블 SELECT/DELETE, membership role/status UPDATE만 있다.
  businesses UPDATE, 두 테이블 INSERT 및 membership business_id/user_id UPDATE는 없다.
  BYPASSRLS는 GRANT를 대신하지 않는다. Fixture 생성을 위해 권한을 추가하지 않는다.

## B. 실제 사용자와 테스트 데이터 계획

기존 Fixture를 최대한 유지하는 호환 기준은 새 Auth 사용자 6명이다:
BUSINESS_A/B, GENERAL, PENDING은 운영자가 소유한 전용 Email 4개와 실제 password login;
CUSTOMER_A/B는 새 익명 세션 2개다. 익명 계정은 업체 배제 검증용이며 고객 CRUD를 재실행하지 않는다.
실제 Email confirmation 상태와 JWT is_anonymous=false, 실제 /user 및 서로 다른 UID를 확인한다.
일반/비소속은 현재 정책상 같은 범주로 GENERAL 한 명이 담당할 수 있다.
기존 세션 도구는 전용 주소를 운영자가 확인한 뒤 관리자 email_confirm:true 생성 및 실제 로그인하는 방식이다.
자기 소유 주소만 사용하고 전역 Email 설정을 변경하지 않는다. 임의 주소를 만들지 않는다.

현재 phase2-fixtures.sql은 업체 3개(A/B approved, SUSPENDED suspended), membership 6개를 만든다:
A, B, PENDING, ANONYMOUS, SUSPENDED, REVOKED.
PENDING은 approved 업체 A의 pending membership이지 pending 업체가 아니다.
전체 업체 상태를 실제로 검증하려면 별도 승인된 fixture 보완에서 pending 업체 1개와
승인 membership 1개를 추가해 4업체/7membership으로 확장해야 한다. 이번에는 수정하지 않았다.

| 시나리오 | 기대 결과 | 근거 |
|---|---|---|
| A/B 직원이 각각 본인 approved 업체 조회 | 각 1행 | 업체 SELECT 정책의 상태/본인 approved membership |
| A→B, B→A 업체 조회 | 빈 배열 | 타 업체 approved membership 없음 |
| A/B가 본인 approved membership 조회 | 각 1행 | membership SELECT self |
| A→B, B→A membership 조회 | 빈 배열 | user_id 불일치 |
| 같은 업체 다른 직원 membership 조회 | 빈 배열 | user_id 불일치, 같은 업체가 예외 아님 |
| pending 회원의 A 업체 및 본인 pending membership 조회 | 모두 빈 배열 | membership approved 필요 |
| GENERAL 일반/비소속 Email 사용자의 두 테이블 조회 | 빈 배열 | approved membership 없음 / self 일치 행 없음 |
| suspended 업체에 approved인 A 직원이 해당 업체 조회 | 빈 배열 | businesses.status가 approved 아님 |
| 위 직원이 suspended 업체의 본인 approved membership 조회 | **1행** | membership 정책은 업체 상태를 검사하지 않음 |
| revoked membership 조회 | 빈 배열 | membership.status 조건 |
| 익명 고객이 approved membership을 가져도 업체/멤버십 조회 | 모두 빈 배열 | JWT is_anonymous=true |
| 비로그인 anon의 SELECT/INSERT/UPDATE/DELETE | 42501 GRANT 거부 | anon 권한 없음 |
| 직원/GENERAL/PENDING이 membership INSERT로 타 업체 소속 위조 | 42501 GRANT 거부 | INSERT 권한 없음 |
| 직원이 business_id/user_id 변경 | 42501 GRANT 거부 | UPDATE 권한 없음 |
| 직원이 role=owner/admin 또는 status=approved로 PATCH | 42501 GRANT 거부 | UPDATE 권한 없음 |
| 직원이 membership DELETE | 42501 GRANT 거부 | DELETE 권한 없음 |
| 직원이 업체 INSERT/상태 PATCH/DELETE | 42501 GRANT 거부 | 업체 쓰기 권한 없음 |
| pending 업체 + approved 회원 조회 (확장 fixture) | 업체 0행, 본인 membership 1행 | 두 SELECT 정책의 차이 |
| JWT is_anonymous 누락 (오프라인 판정만) | 차단 기대 | fail-closed 조건; 실제 JWT 위조 금지 |

동일 업체 타인 membership 사례는 기존 A 직원과 PENDING/ANONYMOUS membership으로 검증할 수 있다.
각 SELECT는 정확한 fixture UUID 필터를 사용하고 전체 운영 데이터 목록을 가져오지 않는다.
role owner/admin 별도 기본 fixture가 필요하면 추가 계정/행을 임의 생성하지 말고 다음 설계 승인에 포함한다.
role 상승 PATCH 거부는 현재 member fixture로 검사 가능하다.

빈 배열은 관리자 원본의 전체 snapshot과 전후 일치할 때만 통과한다.
GRANT 거부는 42501 + 명확한 권한 거부 메시지를 요구한다.
실제 사용자 /user와 JWT 만료를 전후 확인하고, 고객 401/403 bad_jwt·만료·네트워크 오류는 실패다.
비로그인의 401 + 42501 GRANT 거부는 실제 사용자 인증 실패와 구분한다.
HTTP 2xx여도 예상 밖 행 반환/쓰기, 삭제/변경 흔적이 있으면 즉시 실패 후 정리한다.

## C. 현재 Fixture 차단 원인

phase4a4-connection-check.sql과 phase2-fixtures.sql 내부가 모두 현재 backend의
pg_stat_ssl.ssl=true를 요구한다. 실제 Session Pooler backend는 false였다.
클라이언트 verify-full/TLS1.3 성공은 이 DB 방향 TLS 조건을 대신하지 않는다.
Supavisor는 enforce_ssl과 upstream_ssl/upstream_verify/upstream_tls_ca를 별개로 정의한다.
[공식 설정](https://github.com/supabase/supavisor/blob/main/docs/configuration/tenants.md).
기존 두 검사는 유지하며 표식/환경변수를 수동 위조해 우회하지 않는다.

## D. 경로 비교

| 경로 | 현재 가능성·대상 제한 | TLS/인증 범위 | 권한·비용·위험 |
|---|---|---|---|
| A. 제공자 공식 확인 후 Session Fixture | 지원팀 답변 미확보, 현재 ssl=false로 실행 불가. 정확한 Dashboard host/5432/postgres.Ref + Management GET 필요 | verify-full은 client→Pooler만 보증. 실제 upstream TLS/인증서 검증 설정과 지원 범위를 공급자가 확인해야 함 | postgres 자격증명. 문의 자체 추가 DB 권한 불필요. 내부망 보호 설명만 받아도 현재 guard는 통과하지 못함 |
| B. Direct PostgreSQL | 로컬 IPv6 ENETUNREACH로 현재 불가. IPv6 지원 실행 환경 또는 승인된 IPv4 add-on 확보 후 검증 | exact db.Ref.supabase.co:5432, postgres, CA/verify-full 및 동일 연결 pg_stat_ssl=true. psql 세션·트랜잭션 사용 가능 | DB postgres 비밀번호, psql, CA, 최소 네트워크 접근. IPv6 환경은 환경별 비용, add-on은 요금/플랜 검토와 별도 승인 필요 |
| C. Management Query API / SQL Editor | 공식 SQL 실행 기능은 존재하나 현재 검증·생성 도구는 미구현. service_role Data API INSERT는 불가 | 운영자→공식 API/Dashboard HTTPS/TLS. 내부 API→DB TLS는 HTTPS만으로 증명 안 됨 | Management database_write 또는 Dashboard SQL 편집 권한 필요. 광범위 운영자 권한, 잘못된 SQL/프로젝트 선택 위험, API beta/변경 가능성 |

[공식 Direct/Session 연결 및 IPv4 차이](https://supabase.com/docs/guides/database/connecting-to-postgres),
[IPv4 add-on](https://supabase.com/docs/guides/platform/ipv4-address),
[Management SQL API](https://supabase.com/docs/reference/api/v1-run-a-query).

A: 내부망이 안전하다는 설명만으로 backend SSL 검사 삭제를 정당화하지 않는다.
upstream TLS를 지원하여 실제 true가 되거나, 별도 보안 요구 변경이 승인되어야 하며 후자는 이번 범위 밖이다.
SSL 강제 토글 변경은 DB 재시작이 동반될 수 있고 upstream 보증을 대신하지 않으므로 권장하지 않는다.
[공식 SSL 설정](https://supabase.com/docs/guides/platform/ssl-enforcement).

B: 가장 보수적 권장 경로다. 기존 보안 요구와 psql Fixture의 원자적 트랜잭션을 유지한다.
IPv4 add-on은 Direct DNS를 IPv6에서 IPv4로 바꾸며 dual-stack이 아니므로 다른 클라이언트 영향 검토가 필요하다.
정확한 가격은 구매 전 현재 Dashboard 견적을 확인한다. 비용을 임의 확정하지 않는다.
새 외부 VM/CI로 비밀값을 옮기려면 해당 환경의 비밀 저장/접근 제한/정리까지 별도 승인한다.

C: Query API는 POST /v1/projects/{ref}/database/query 및 parameters를 지원한다.
write 승인 전에는 사용하지 않는다. SQL Editor는 올바른 프로젝트 선택을 별도로 확인한다.
기존 psql 전용 \ir/\gset/\if/\getenv/:'변수' 문법은 그대로 실행할 수 없으므로
별도의 reviewed parameterized SQL + 단일 트랜잭션 + 충돌/표식/UUID/스키마 검증이 필요하다.
기존 Fixture에서 backend SSL 줄만 제거해 API로 보내는 것은 허용하지 않는다.
공식 HTTPS 관리 경계를 별도 신뢰 모델로 채택하려면 공급자 근거와 명시적 보안 승인 후 새 경로를 설계한다.
현재 '즉시 실행 가능'으로 판정하지 않는다. MCP 읽기 전용 설정도 변경하지 않는다.

## E. 생성·시험·정리 경계

고객 테스트에서 검증한 고정 개발 Ref/Management GET/실제 Auth/안전한 오류 정규화/
전용 UUID/사전 journal/실패 시 정리 원칙을 재사용한다.
기존 일반 phase2 --run은 고객 CRUD도 실행하므로 이번 업체 범위에 사용하지 않는다.
업체 전용 runner는 아직 없다. 다음 구현 승인에서 다음을 준비해야 한다:

1. Auth 준비(기존 6계정 또는 승인된 축소안), private manifest/journal에 생성 의도와 UID 기록.
   실제 세션 검증, 관리자 app_metadata.bath_rls_fixture 표식, UUID 전역 중복 확인.
2. 개발 Ref/스키마/Migration=2/정책=6/필요 GRANT/기존 데이터 충돌과 TLS를 검증.
3. Fixture 입력과 정리 계획을 원격 쓰기 전에 journal에 flush.
   현재 SQL의 업체 3/member 6개를 생성하는 admin 작업은 고객 JWT 검사와 완전히 분리.
   원격 성공 후 로컬 기록 실패에 대비해 deterministic UUID로 정확한 결과를 재조회하고 재삽입하지 않는다.
4. 새 업체 runner가 manifest의 정확한 UUID만 고객/직원 JWT로 검사.
   user_metadata의 역할/승인 주장은 RLS 근거가 아님. 실제 주장 변경 시험은 별도 승인된 전용 사용자만.
5. membership 변경 공격 전 관리자 snapshot. 복원은 role/status만 현재 service_role 권한으로 가능하다.
   business_id/user_id/업체 status가 예상 밖 변경되면 권한 확대/임의 복원이 아닌 수동 복구 실패 처리.
6. 신규 probe 행 정리 → 검증된 membership 정리 → 검증된 업체 정리 → Auth 사용자 순서.
   삭제 전 UUID/업체 BATH-RLS:fixture_id:name/멤버 business_id+user_id/신뢰 Auth 표식 확인.
   해당 업체에 manifest 밖 membership이 있으면 CASCADE 삭제 금지. 별도 일반 프로젝트가 있으면 Auth 삭제 금지.
   이 스크립트가 만들지 않은 고객 데이터는 손대지 않는다. 실패하면 잔여 ID를 journal에 보고하고 exit 1.

기존 phase2 cleanup은 시험 중 신규 probe 행과 snapshot 복원용이며,
기본 업체/멤버십/Auth baseline 3/6/6 전체를 삭제하지 않는다.
기존 phase4a2에는 전체 Auth cleanup 모드가 없다. baseline 정리 도구를 추가로 검증하기 전 실제 생성하지 않는다.
기존 phase4a2와 phase2 Auth 응답 처리에는 phase4b1의 새 헤더/구형 응답 호환성이 공유되지 않으므로
새 업체 경로에서 재사용·검증해야 한다. 기존 파일을 이번에 임의로 수정하지 않았다.

## F. 필요한 준비

- 운영자 소유 Email 주소/비밀번호 4쌍, 실제 로그인 및 confirmed email 확인.
- 기존 Publishable/Admin/Management 키는 보호된 credentials.env.local에 유지. 신규 service_role GRANT 불필요.
- Management의 프로젝트 조회 권한과, C 경로를 선택할 경우에만 별도 승인된 SQL write 권한 확인.
- B 경로: 실제 Direct 연결값, CA, psql, IPv6/승인된 IPv4, 외부 pgpass의 Direct 항목(postgres 사용자).
  비밀번호 파일을 프로젝트로 복사하지 않는다. 현 wrapper의 private-folder-only password 경로 제한은
  외부 pgpass ACL을 검증하는 승인된 호환 보완이 필요하다. TLS/backend 조건은 변경하지 않는다.
- 현재 세션 도구가 요구하는 전용 이메일/비밀번호/확인 표식의 존재 여부는 별도 로컬 점검이 필요하다.
  이번에는 기존 자격증명 파일을 읽거나 수정하지 않았다.

## G. 명령·예상 변경·실행 승인 조건

이번에 안전하게 수행한 정적 명령:

```powershell
node --check supabase/tests/phase2-rls.mjs
node --check supabase/tests/phase4a2-sessions.mjs
node --check supabase/tests/phase4a4-connection.mjs
```

다음 단계의 순서는 '업체 전용 runner/정리 도구 오프라인 구현 → Direct 읽기 전용 검증 →
사용자 승인 → Auth 준비 → Fixture → 업체 검사 → baseline 포함 정리'다.
아래 기존 명령은 조건 충족 후 사용 가능한 구성요소이며 **현재 실행 지시가 아니다**:

```powershell
# 입력 14개 확인 후 GET 전용 Auth 준비 점검
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a2-sessions.mjs --check
# Direct 설정/외부 pgpass 호환 보완 후 읽기 전용 DB 점검
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a4-connection.mjs --check
# 별도 생성 승인·정리 준비 후에만 Auth 6개 생성/세션 발급
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a2-sessions.mjs --create
# 별도 Fixture 승인·Direct TLS/대상 검증 후에만 기본 3업체/6멤버십 생성
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4a4-connection.mjs --fixture
```

쓰기 명령은 전용 확인값, fixture/session env 및 승인된 Direct config 설정이 추가로 필요하다.
업체 전용 실행/정리 명령은 아직 구현되지 않아 확정할 수 없다. 없는 명령을 실행 가능하다고 안내하지 않는다.
phase2-rls.mjs --run과 phase4b1-customers.mjs --run은 고객 재시험을 포함하므로 사용하지 않는다.
확장 pending 업체 시나리오를 선택하면 별도 fixture 검토 후 4업체/7멤버십으로 예상 변경 수를 다시 승인받는다.

## 현재 판정

오프라인 확인: 기존 실행 파일 3개의 Node 구문 검사와 SQL/Fixture 전제 정적 검사
6개 통과. 네트워크 요청·SQL 실행·고객 테스트 재실행 없음.
적용 Migration 두 파일 SHA-256은 기존 승인값과 일치한다.

권한·시나리오·경로 비교 완료. 실제 실행은 Direct TLS 경로, 업체 전용 runner와
baseline 정리 기능 준비, 전용 이메일 입력 및 사용자 승인까지 보류한다.
이번 변경은 이 계획 문서만이다. 기존 보안 검사와 Migration은 유지했다.
