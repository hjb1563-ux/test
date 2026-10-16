# PHASE 4C-4 실행 환경 및 안전 정리 검증

## 이번 단계 결과

2026-10-16 Windows 재검사: 전역 IPv6 주소 0개, IPv6 기본 경로 0개. IPv6 어댑터 바인딩은 활성화되어 있으나 외부 경로가 없다. Direct AAAA는 `2406:da12:1f1:f800:1388:d532:aaa5:38fd`로 확인되었다. 호스트명 TCP 시도는 ENOTFOUND, 해당 IPv6 주소의 5432 시도는 ENETUNREACH였다. AAAA 조회 성공과 애플리케이션 이름 해석 실패는 구별한다. 주소 직접 시도의 경로 오류로 현재 Direct 접속은 불가능하다.

psql 인증 및 TLS 연결은 시도하지 않았다. 따라서 Direct의 verify-full, pg_stat_ssl.ssl=true, transaction_read_only=on은 미검증이다. 기존 CA, 외부 PGPASSFILE, TLS/backend_ssl 차단 조건을 변경하지 않았고 비밀번호 파일을 읽거나 복사하지 않았다. Direct 경로가 확보되면 보호된 연결 설정의 호스트/사용자를 확인하고 기존 읽기 전용 --check를 먼저 실행한다. Direct pgpass 항목이 없다면 사용자가 외부 pgpass를 로컬 편집기로 열어 `db.istsrambmbzuemkgutgh.supabase.co:5432:postgres:postgres:<사용자가 직접 입력>` 형식으로 입력한다. 비밀번호의 콜론과 역슬래시는 libpq 규칙에 따라 이스케이프한다. 채팅/명령행에 비밀번호를 입력하지 않는다.

별도 읽기 전용 관리 카탈로그 조회에서 Migration 2개, RLS 정책 6개, 현재 컬럼·CHECK·FK와 권한을 확인했다. 이는 Direct TLS 검증을 대신하지 않는다. Fixture의 3개 업체 상태, 6개 멤버십 역할·상태, UUID 관계, 고객 프로젝트의 builderMode/schema_version/JSONB 형태는 현재 스키마에 부합한다. 업체 이름은 200자 이내이고 JSONB 제한 이내이다. postgres는 세 테이블 INSERT와 auth.users SELECT 권한을 보유한다. service_role INSERT 금지는 유지된다. Fixture PL/pgSQL의 실제 실행 성공은 아직 검증하지 않았다.

## 추적 대상

manifest에는 외부 Auth UID 5개(Email 4, Anonymous 1), 업체 UUID 3개, 멤버십 UUID 6개, Anonymous 소유 프로젝트 UUID 1개를 기록한다. DB journal의 기본 대상은 10개이다. 이후 공격 요청용 probe도 요청 전에 journal에 추가한다. 기존 업체 실행기는 Auth 사용자를 생성하거나 삭제하지 않으며 계속 외부 자원으로 보존한다.

## 별도로 승인받을 Auth 생성 절차

1. 기존 사용자를 재사용하지 않는다. 사용자가 관리하는 테스트 이메일 4개를 준비한다. 이미 존재하는 이메일이면 중단하고 새 테스트 주소를 요청한다. 기존 계정에 표식을 붙여 편입하지 않는다.
2. `newAuthLedger()`로 실행/Fixture ID와 역할별 nonce를 먼저 생성한다. ledger와 후속 manifest/journal은 기존 보호 폴더에 저장하고 Git 제외 및 현재 사용자/SYSTEM ACL을 검증한다. 비밀번호·토큰·키는 ledger에 저장하지 않는다.
3. 역할별로 `beginAuthCreate()`의 요청 의도를 원자적으로 저장한 뒤 실제 생성 요청을 보낸다. Email 4명은 서버 관리자 생성 절차를 사용하더라도 실제 비밀번호 로그인으로 각각 별도 세션을 발급받아야 한다. 이메일 확인 정책을 변경하지 않으며, 사용자 소유 주소의 확인 절차 또는 명시적으로 승인된 테스트 계정 확인 방법을 적용한다.
4. Anonymous 1명은 실제 signInAnonymously()로 생성한다. 생성 응답 UID를 즉시 기록한다. 관리자 API로 전용 app_metadata 표식을 붙이고 다시 GET하여 UID·표식·사용자 유형을 검증한다. 사용자 편집 가능한 user_metadata를 소유권 증거로 사용하지 않는다.
5. `recordAuthCreated()`와 `recordAuthVerified()`를 단계마다 저장한다. 5개 UID의 중복, Email 확인 여부, 실제 /user 응답, JWT issuer/sub/role/익명 여부/만료를 기존 세션 검증으로 확인한다. JWT를 위조하지 않는다.
6. 5명 모두 검증된 후 `manifestFromAuthLedger()`로 같은 Fixture ID에 연결한다. Fixture 시도 전 `recordDbFixtureAttempt()`도 저장한다. 기존 Fixture 실행기의 journal은 별도로 유지한다.

`phase4c4-auth-ledger.mjs`는 순수 오프라인 상태 전이·삭제 허용 조건 함수다. 실제 API 실행기나 파일 저장기를 구현한 것이 아니다. 향후 별도 승인된 실행기가 원자적 저장과 실제 GET 증거 수집을 연결해야 한다. evidence의 배열/시각/확인 플래그를 사람이 임의로 채우는 방식은 실행 근거로 허용하지 않는다.

## 정리 순서 및 복구

1. 업체 실행을 중지하고 journal/manifest 바인딩과 신뢰할 수 있는 Auth 표식을 재검증한다. 기록된 테스트 자원만 대상으로 한다.
2. 프로젝트 → 멤버십 → 업체 순으로 기존 안전 정리를 수행한다. 익명 프로젝트 삭제가 실패하면 후속 삭제를 중단한다. 업체 삭제 직전 멤버십이 0개인지 재검사한다. CASCADE에 의존하지 않는다. 모든 대상의 부재와 cleanup_complete를 확인한다.
3. Auth 삭제 직전에 관리자 GET으로 대상 UID와 전용 표식을 재확인하고, 해당 UID의 프로젝트/멤버십 및 Fixture 업체가 없음을 새로 조회한다. Fixture 시도 이력이 있으면 검증된 DB journal의 모든 항목이 cleaned이고 cleanup_complete여야 한다. 조회 오류나 잔여 데이터는 삭제 금지다.
4. `planOwnedAuthDelete()`로 삭제 의도를 저장한 후에만 별도 승인된 Auth 삭제 요청을 허용한다. 세션 종료/폐기도 계획에 포함한다. Auth 삭제만으로 기존 JWT가 즉시 무효화된다고 가정하지 않는다.
5. 등록된 UID에 대한 GET 404 user_not_found만 삭제 완료 증거로 인정한다. 401/403, 다른 404, 네트워크 오류는 성공이 아니다. 삭제 응답이 불명확하면 delete_unknown을 저장하고 재실행 시 GET으로 먼저 확인한다. 이미 부재가 확인된 UID는 중복 삭제하지 않는다.

생성 요청이 타임아웃되어 UID가 없는 create_unknown 상태면 자동 재생성/삭제하지 않는다. Dashboard·공급자 로그와 실행 표식으로 사용자가 원인을 확인해야 한다. 알려진 UID라도 표식 설정 결과가 불명확하면 marker_unknown으로 두고 GET 확인 후에만 복구한다. 미등록 UID를 추측해 삭제하거나 전체 사용자 목록을 일괄 정리하지 않는다. 일부 Fixture 생성 실패는 기존 DB journal에 기록된 실제 잔여 대상만 정리한다. 정리 중 프로세스가 중단되면 실행 중인 다른 프로세스가 없는지 확인한 뒤 기존 journal로 재시도한다. 원인을 확인하지 않은 stale lock 삭제나 --run 재실행은 금지한다.

## 오프라인 검증

```powershell
node --check supabase/tests/phase4c4-auth-ledger.mjs
node --test supabase/tests/phase4c3-businesses.test.mjs supabase/tests/phase4c4-auth-ledger.test.mjs
```

결과: 기존 29개 유지, DB 정리 장벽/재시도 2개와 Auth ledger 11개 추가, 총 42 PASS / 0 FAIL. 네트워크/psql은 mock만 사용한다. 부분 Auth 생성, 부분 Fixture, 익명 프로젝트 정리 실패, 남은 멤버십, 미등록 UID, 중단 후 재시도, 인증 오류의 잘못된 성공 처리를 검사했다.

## 실제 실행까지 남은 조건

Direct IPv6 경로(또는 별도로 검토·승인된 실행 경로), verify-full 및 backend SSL/read-only 확인, Direct용 자격증명 존재 확인, 사용자 관리 테스트 이메일 4개, Auth 생성·저장·정리 전송 계층의 별도 구현/승인, 원격 생성 및 테스트 실행에 대한 명시적 승인이 필요하다. 이번 단계에서는 원격 쓰기, Auth 생성/삭제, Fixture, 고객 테스트를 실행하지 않았다.
