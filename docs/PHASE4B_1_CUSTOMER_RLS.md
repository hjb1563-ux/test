# PHASE 4B-1 — 익명 고객 A/B 독립 RLS 테스트 준비

> 후속 승인으로 실제 고객 테스트가 완료됐다. [PHASE 4B-2 실행 결과](PHASE4B_2_CUSTOMER_RLS_RESULTS.md)를 참고한다.

## 후속 Auth 응답 호환성 검증 완료

실제 개발 Auth 응답은 HTTP 404, 본문 숫자 code=404,
`X-SB-Error-Code: user_not_found`였다. 기존 본문 문자열 전용 판정을 보완했다.
본문 문자열 코드와 헤더 코드를 함께 읽고 Fetch Headers의 대소문자 비구분 조회를 사용한다.
숫자 body.code는 실제 HTTP 상태와 일치할 때만 구형 응답의 상태 정보로 취급하며,
그 숫자만으로 user_not_found를 인정하지 않는다. 문자열 충돌/형식 오류/코드 누락은 실패다.
404 예외는 신규 임의 UUID 부정 조회와 journal에 삭제 요청이 기록된 전용 사용자 재조회에만
한정한다. 그 외 Auth 사용자 조회와 모든 401/403/다른 404는 실패를 유지한다.
RLS SQLSTATE/GRANT 판정은 변경하지 않았다.

기존 16개 포함 오프라인 테스트 29개 통과. 보호된 기존 환경변수로 실제 GET 전용
--check도 종료 코드 0으로 통과했다(개발 대상, Anonymous Auth, 관리자 SELECT,
관리자 Auth 정상 부정 조회). credentials.env.local 내용과 ACL은 전후 동일하다.
아래 초기 준비 시점의 '키 미입력/실제 check 미실행'은 당시 기록이며 현재 상태는 이 절을 따른다.
실제 계정 생성/RLS 공격/Fixture/원격 쓰기는 여전히 실행하지 않았다.

이번 작업은 코드·오프라인 검증만 수행했다. 실제 Auth 가입, 프로젝트 생성,
RLS 공격 요청, PostgreSQL 접속, Fixture, Migration, 설정 변경은 하지 않았다.

## 기존 코드 재사용 방식

phase2-rls.mjs의 고객 CRUD, revision 조건, 실제 /auth/v1/user 확인,
거부 전후 관리자 snapshot 비교, 요청 전 journal, 정리 실패 시 전체 실패라는
검증 방식을 별도 실행기에 옮겼다. 기존 파일은 top-level에서 실행되므로 import하지 않는다.
phase4a2-sessions.mjs의 고정 HTTPS 대상·Management GET·키 구분·실제 익명 세션·
신뢰 app_metadata 표식 방식을 사용한다. 두 기존 실행 파일 및 Fixture/backend_ssl 검사는 수정하지 않았다.
기존 6계정/업체 manifest를 읽거나 생성하지 않는다. 새 경로는 업체 시나리오를 검증하지 않는다.

## 새 실행기

`supabase/tests/phase4b1-customers.mjs`, Node >=20, 추가 패키지 없음.

| 모드 | 동작 | 원격 쓰기 |
|---|---|---|
| 기본 / --check | Management 개발 프로젝트 GET, Auth settings GET, 새 임의 UUID로 관리자 projects SELECT(id) 및 Admin Auth GET(미존재 기대) | 없음. 로컬 journal도 생성 안 함 |
| --run | 실제 익명 가입 2회, 관리자 전용 표식, 고객 JWT로 RLS 시나리오, 관리자 관찰·정리 | 있음. 별도 승인 전 실행 금지 |
| --cleanup | 기존 전용 journal의 UUID/표식 검증 후 프로젝트 및 전용 Auth 사용자 정리 | 있음. 수동 승인된 복구 전용 |

고객 로그인은 공식 signInAnonymously가 사용하는 Auth `/signup` HTTPS 경로를 호출한다.
관리자가 세션을 생성하거나 JWT를 서명하지 않는다. 세션/refresh token은 journal이나
환경 파일에 저장하지 않으며 access token만 해당 실행 메모리에서 사용한다.
두 실제 Auth UID의 UUID v4/중복 및 JWT issuer/sub/role/is_anonymous/만료>60초를 확인하고,
각 실제 /auth/v1/user 응답과 일치시킨다. 디코딩만으로 인증 성공을 판단하지 않는다.

[공식 익명 로그인 문서](https://supabase.com/docs/reference/javascript/auth-signinanonymously),
[공식 Auth 클라이언트 구현](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts).

시나리오:
- A/B 각각 프로젝트 INSERT, 본인 SELECT, revision 조건 UPDATE와 revision +1, DELETE.
- A→B 및 B→A SELECT 차단, B→A UPDATE/DELETE 차단.
- A/B 각각 타인 owner로 INSERT 거부, 본인 프로젝트 owner_user_id 변경 거부.
- 비로그인 anon의 SELECT/INSERT/UPDATE/DELETE 권한 거부.

빈 SELECT/0행 UPDATE/DELETE는 관리자 원본 전체와 전후 동일해야 통과한다.
거부 INSERT의 2xx는 빈 배열이어도 실패한다. 고객 세션은 거부 요청 전후 재검증하고
고객 HTTP 401/만료·다른 API 오류·예상과 다른 SQLSTATE는 RLS 성공으로 취급하지 않는다.
42501도 메시지에 따른 RLS/GRANT 구분이 기대값과 같아야 한다.
anon의 42501 권한 거부는 인증된 고객 세션 만료와 구분한다.

## 최소 환경변수 및 현재 상태

기존 private 파일: `tests/artifacts/phase4a2/credentials.env.local`.
내용과 ACL을 유지했다. 현재 User/SYSTEM 외 Allow 항목 없음.
관리자 키와 Management token은 브라우저/NEXT_PUBLIC_*에 절대 넣지 않는다.

| 이름 | 용도 | 현재 |
|---|---|---|
| BATH_TEST_SUPABASE_URL | 고정 https://istsrambmbzuemkgutgh.supabase.co | 있음 |
| BATH_RLS_TEST_CONFIRM | bath-designer-dev | 있음 |
| BATH_TEST_PUBLISHABLE_KEY | 실제 익명 가입, 사용자·비로그인 Data API | 비어 있음 |
| BATH_TEST_ADMIN_KEY | 관리자 관찰/전용 표식/정리 | 비어 있음 |
| BATH_TEST_MANAGEMENT_TOKEN | 고정 프로젝트 GET으로 개발 대상 독립 확인 | 비어 있음 |
| BATH_TEST_SECRET_STORAGE_CONFIRM | ACL 확인 후 private-acl-verified, run/cleanup만 필요 | 비어 있음 |
| BATH_CUSTOMER_RLS_CONFIRM | 별도 승인 후 create-two-anonymous-users-and-test, run만 필요 | 없음 |
| BATH_CUSTOMER_RLS_JOURNAL | 복구할 기존 customer journal 전체 경로, cleanup만 필요 | 아직 생성 안 함 |

--check에는 처음 5개가 필요하다. --run에는 추가 확인값 2개가 필요하다.
이메일·비밀번호·사전 사용자 JWT 6개·업체 manifest·psql·DB 비밀번호·CA·PGPASSFILE은 불필요하다.
Publishable Key만으로 사용자 요청은 가능하지만, 이 도구는 관리자 독립 관찰/잔여 행 확인/
예상 밖 성공의 정리와 Management 프로젝트 확인을 필수 안전장치로 사용하므로 세 키 모두 필수다.
기존 service_role projects SELECT/DELETE와 Auth 관리자 기능을 사용하며 projects INSERT/UPDATE 권한은 필요 없다.
별도 example `supabase/tests/phase4b1-customers.env.example`에는 실제 자격증명이 없다.
인증/키/네트워크 원문 오류와 응답 본문은 로그에 전달하지 않는다.

## Journal·정리·복구

실행 전 기존 private 폴더가 current User/SYSTEM 전용인지 확인한다.
파일은 이 폴더의 제한된 ACL을 상속한다(Windows에서 mode=0600만으로 보호되지 않는다).
폴더의 `customer-rls.lock`을 독점 생성하며, 미완료 customer journal이 있으면 새 run을 막는다.
`customer-rls-<run UUID>.json`에 다음을 기록한다:
- 실제 요청 전 계획/정리 순서, 고정 Project Ref, run UUID, 익명 signup 의도.
- 응답 직후 실제 UID; 관리자 app_metadata.bath_customer_rls_run 표식과 재확인.
- 프로젝트 요청 전 새 UUID, owner와 run 표식이 포함된 intended body.
- 거부 요청 상태/오류 코드, 정리 결과 및 남은 UUID. 토큰·키·비밀번호 없음.

기본 프로젝트 2개 + 거부 INSERT 후보 3개 = journal 대상 UUID 총 5개다.
정상 시 생성되는 public 행은 프로젝트 2개뿐이며 테스트 안에서 각각 삭제한다.
finally 관리자 정리는 기록된 각 UUID만 대상으로 현재 owner/run 표식/신뢰 Auth 표식을
확인한 후 삭제·재조회한다. 소유권 또는 표식이 바뀌면 자동 삭제하지 않고 전체 실패한다.
업체/멤버십은 조회·변경하지 않는다. 기존 고객 프로젝트 목록은 조회하지 않는다.
프로젝트 정리 오류가 하나라도 있으면 Auth 사용자 삭제를 하지 않는다.
전용 UID에 대한 잔여 프로젝트가 0인지 확인한 후 해당 Auth 사용자 2명만 삭제한다.
원본 고객 데이터를 복원하는 경로가 아니라 이번 실행의 새 데이터만 삭제하는 경로다.
trigger 관리 revision/updated_at을 되돌리는 UPDATE는 하지 않는다.

정리 실패 시 journal.cleanup_complete=false 및 오류 대상 ID를 남기고 exit 1이다.
수동 복구는 같은 journal을 --cleanup으로 재사용하며 사용자 토큰은 필요 없다.
정리만 성공해도 과거 실패 시나리오가 성공으로 바뀌지는 않는다.
signup 응답 유실/중복 UID는 결과 불명으로 실패하고 pending_signup을 유지한다.
전체 Auth 사용자를 탐색하거나 자동 재가입하지 않는다. 운영자가 Dashboard에서 run 표식을
확인해 해당 가입 결과를 해결해야 한다. journal/lock을 무조건 삭제해 재실행하지 않는다.
Auth 삭제만으로 이미 발급된 JWT가 즉시 무효화되는 것은 아니다. 실행이 끝나면 토큰을
보관하지 않으며 전용 사용자 및 소유 프로젝트의 삭제 여부를 확인한다.

## 다음 승인 후 실행 순서

사용자가 private 파일에 세 키를 로컬 편집기로 입력한다. 채팅에 보내지 않는다.
ACL/Git 제외를 재확인하고 다음 GET 전용 사전 점검을 실행한다:

```powershell
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4b1-customers.mjs --check
```

별도 실제 테스트 승인 후에만 두 확인값을 설정하고:

```powershell
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4b1-customers.mjs --run
```

실패 시 임의 재실행하지 않는다. journal을 지정하고 복구 승인 후에만:

```powershell
node --env-file=tests/artifacts/phase4a2/credentials.env.local supabase/tests/phase4b1-customers.mjs --cleanup
```

이번에는 필수 키 미입력으로 실제 --check도 실행하지 않았다.
CAPTCHA/가입 rate limit/운영자 키 scope/API 노출 문제는 실제 check/run 전후 확인이 필요하며,
실패 시 설정을 자동 변경하거나 보안을 낮추지 않는다.

## 오프라인 검증

`node --check supabase/tests/phase4b1-customers.mjs`

`node --test supabase/tests/phase4b1-customers.test.mjs`

테스트 fetch는 전부 메모리 mock이며 실제 환경변수/키를 사용하지 않는다.
check GET-only, 정상 A/B 전체 실행·정리, 잘못된 대상, Anonymous 비활성,
만료/비익명 JWT, UID 중복, 타인 조회 노출, 빈 응답 뒤 숨은 변경,
INSERT 예상 밖 2xx, 인증 오류와 API 오류, signup 응답 불명, 정리 실패 및
토큰 없는 cleanup 재시도를 검증한다. 요청 시 journal이 먼저 존재하는지도 확인한다.
이는 실제 Supabase RLS 통합 검증을 대체하지 않는다.
