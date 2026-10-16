# PHASE 5B-3A 로컬 통합 테스트 안전 도구

## 현재 결과 (2026-10-17)

실제 Feature Flag는 `CUSTOMER_CLOUD_SAVE_ENABLED=false` 그대로이다. `.env.local`은 현재 존재하며 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 설정되어 있고 sb_publishable 형식이다. 값은 출력하거나 복사하지 않았다. `NEXT_PUBLIC_BATH_STORAGE_TEST_MODE=prepared`는 미설정이다. 공개 환경변수에서 Secret/Admin/Management/service_role 이름 또는 sb_secret 값은 발견하지 않았다. 키의 실제 프로젝트 대상은 향후 GET 사전 검사 전까지 미검증이다.

보호 폴더 `tests/artifacts/phase4a2`는 현재 사용자/SYSTEM 이외 Allow 규칙 0개, 권한 상속 해제로 읽기 전용 확인했다. 실제 `phase5b3-journal.json`은 아직 없다. 이번에는 --plan과 Mock만 실행했다. --init/--check/--serve/--cleanup, 원격 계정·데이터 생성/삭제는 실행하지 않았다.

## 실행 경계

일반 Flag 하나를 ON으로 바꾸어도 자동으로 Auth/DB 요청을 보내지 않는다. 다음 조건을 모두 요구한다.

1. Next 개발 빌드(`NODE_ENV=development`), localhost 또는 127.0.0.1, 개발 Ref 고정.
2. 공개 준비 모드 `NEXT_PUBLIC_BATH_STORAGE_TEST_MODE=prepared`와 기존 Flag ON. 현재는 둘 다 활성화하지 않았다.
3. 전용 프로필의 합성 프로젝트명 표식, 새 프로필 확인 문구, actor별 로컬 capability와 run/예약 UUID.
4. 서버 Node 도구의 별도 `BATH_STORAGE_TEST_CONFIRM=create-only-two-test-users-and-projects` 승인.
5. 서버 GET 사전 검사(Management 프로젝트명/Ref/host/상태, 익명 설정, Publishable key를 사용하는 Auth 설정 조회, 관리자 SELECT와 Admin Auth) 성공.
6. 브라우저 공개 키와 로컬 도구의 공개 키가 일치하고, 로컬 broker가 동일 actor/profile nonce를 허용해야 한다.

브라우저와 Node 모두 production/Vercel·다른 호스트·다른 프로젝트를 거부한다. 프로덕션 빌드에는 개발자 전용 window 진입점을 설치하지 않는다. Node 도구는 VERCEL/VERCEL_ENV 설정도 거부한다. 브라우저 확인 문구만으로 Chrome 프로필 종류를 기술적으로 증명할 수는 없으므로 새 프로필 생성은 사용자 수동 절차이며, 기존 세션/binding이 있는 미등록 프로필은 코드로 거부한다.

## 구성 및 자원 상한

- `data/customer-storage-test.ts`: 개발자 전용 승인·journaled fetch. 관리자 키를 포함하지 않는다.
- `data/customer-builder-cloud.ts`: 기존 인증·저장·Web Locks를 재사용하고, 승인된 경로에서만 test transport와 예약 project UUID를 사용한다. UI/Step은 변경하지 않는다.
- `supabase/tests/phase5b3a-tools.mjs`: Node 전용 broker/journal/정리 도구. 127.0.0.1:43183만 listen하며 Host/Origin/경로/메서드/본문 크기를 제한한다. 임의 원격 URL 프록시가 아니다.
- 기존 보호 credentials.env.local의 BATH_TEST_SUPABASE_URL, BATH_RLS_TEST_CONFIRM, BATH_TEST_PUBLISHABLE_KEY, BATH_TEST_ADMIN_KEY, BATH_TEST_MANAGEMENT_TOKEN을 Node에서만 사용한다. 현재 admin 도구는 sb_secret 형식을 요구하며 legacy service_role 형식은 이 신규 도구에서 지원하지 않는다.

실행 plan은 A/B 각 신규 Anonymous UID 1개, 예약 project UUID 1개만 가진다. actor별 profile nonce가 정해지면 다른 nonce로 재사용할 수 없다. 같은 프로필 두 탭은 동일 nonce를 읽는다. 서버 큐와 브라우저 Web Locks를 함께 사용하되 잠금 순서는 기존 프로젝트→Auth를 유지한다. 기존 프로젝트/계정 가져오기, 세 번째 계정/프로젝트, 사용자 프로젝트 DELETE, 임의 테이블 접근은 허용하지 않는다. 교차 DELETE는 등록된 상대 테스트 프로젝트에 대한 명시적 RLS probe만 예외다.

## Journal과 실패 처리

--init은 기존 보호 폴더에 journal과 별도 handoff JSON을 만든다. journal에는 run ID·nonce·예약 UUID·UID·표식·요청 의도/결과·정리 상태가 기록된다. 토큰/refresh token/키/Authorization/비밀번호는 기록하지 않는다. refresh token은 원문 대신 변경 확인용 해시만 기록한다. actor capability도 journal에는 해시만 있고 원문은 ACL 보호 handoff 파일에만 있다. handoff는 공개 링크/채팅에 공유하지 않는다.

신규 artifact만 상속을 해제해 현재 보호 폴더의 ACL을 복사하고 다시 검증한다. 기존 자격증명 ACL은 변경하지 않는다. journal은 임시 파일 flush→ACL 검증→rename으로 기록하며, 프로세스 lock 파일로 동시 운영을 차단한다. journal/경로/ACL 검증 실패면 요청하지 않는다. symlink나 workspace 밖 경로를 거부한다. 강제 종료 후 lock 파일은 자동 삭제하지 않는다. 실행 중인 다른 프로세스가 없고 journal 상태를 확인한 뒤 운영자가 복구해야 한다.

signup 전에 requested를 기록한다. 응답 UID를 즉시 기록하고, 새 UID에만 서버 측 app_metadata 실행 표식을 부여·GET 검증한 뒤 프로젝트 생성으로 넘어간다. signup 응답 유실로 UID가 없으면 자동 재가입·추측 삭제하지 않는다. UID를 기록했지만 표식 부여가 실패해도 정리 도구가 표식을 임의 복구하지 않는다. 별도 수동 확인이 필요하다.

INSERT도 요청 전에 기록한다. 응답 유실 시 재INSERT를 차단하고 등록된 UUID/소유자/표식으로 확인·정리한다. refresh 결과 유실도 재발급을 무작정 반복하지 않는다. 실제 요청을 보낸 뒤 저장소/네트워크 오류가 생기면 서버 rollback을 가정하지 않는다.

## 준비된 검사

기존 Builder 저장 흐름으로 실제 익명 세션, 최초 INSERT, revision 조건 UPDATE, 선택 취소·이미지 순서, 새로고침 후 동일 UUID와 서버 비교, 네트워크 단절 후 pending 보존을 검사할 수 있다. 현재 새로고침은 **로컬 복원 + 서버 상태 비교**이며 서버 데이터만으로 UI를 복원하는 기능이 아니다.

`window.BathStorageTest.probe()`는 cross-read / cross-update / cross-delete / stale-revision을 제공한다. 실제 actor 토큰을 서버 /user로 확인한 뒤 사용자 권한으로 요청한다. 관리자 키는 전용 테스트 원본 비교용으로만 사용한다. HTTP 200 빈 배열 또는 명확한 권한 거부와 원본 데이터 불변을 함께 검사한다. 401·네트워크 오류·예상 밖 허용은 PASS가 아니며, 원본 변경/예상 밖 허용 시 run을 중단한다. 오래된 revision probe는 성공 UPDATE 후 실행한다.

두 프로필에서 각각 사용자 1명·프로젝트 1개가 만들어지면 더 이상의 신규 생성은 거부된다. 테스트 중 초기화/새 프로젝트 생성은 실행하지 않는다. 같은 프로필 새로고침/두 번째 탭은 handoff로 다시 arm해야 하며, arm만으로 원격 생성은 하지 않는다. start 또는 다음 로컬 변경이 저장 흐름을 시작한다.

## 다음 승인 후 수동 실행 순서 — 이번에는 실행 금지

1. 별도 Chrome 프로필 A/B를 새로 만들고 동기화·데이터 가져오기를 하지 않는다. 기존 사용자 프로필에서는 실행하지 않는다.
2. 사용자 승인을 받은 후 `BATH_STORAGE_PLAN_CONFIRM=write-local-test-plan`을 현재 PowerShell에만 설정하고 `node supabase/tests/phase5b3a-tools.mjs --init`으로 로컬 plan을 만든다. journal을 재생성하거나 덮어쓰지 않는다.
3. Node용 보호 환경파일을 `--env-file=tests/artifacts/phase4a2/credentials.env.local`로 로드한다. Node의 NODE_ENV=development, 정확한 개발 확인 설정이 필요하다. `--check`는 GET만 하며 계정/데이터를 생성하지 않는다.
4. 별도로 승인된 경우에만 Node `BATH_STORAGE_TEST_CONFIRM`을 설정해 `--serve`한다. 브라우저 Origin 기본은 http://localhost:3000이며 다른 loopback 주소/포트라면 BATH_STORAGE_BROWSER_ORIGIN을 정확히 맞춘다. 관리 키는 handoff로 복사하지 않는다.
5. 승인된 로컬 코드에서만 기존 Flag와 공개 준비 모드를 활성화하고 Next dev 서버를 재시작한다. Vercel 배포·빌드 환경을 수정하지 않는다.
6. 각 프로필에서 해당 actor handoff의 marker를 합성 프로젝트명으로 입력한다. handoff 객체를 로컬 편집기에서 확인하여 DevTools의 `window.BathStorageTest.arm(handoff, 'dedicated-profile-create-only-two-test-users-and-projects')`에 전달한다. capability/토큰을 채팅에 보내거나 스크린샷에 남기지 않는다.
7. arm 결과의 actor/UUID를 확인하고 `.start()`를 호출한다. 이후 `.inspect()`로 상태를 검토하며, 충돌 해소는 명시적 `.review(row)` 후 선택한 로컬본 재저장으로만 진행한다. 전체 localStorage를 콘솔에 출력하지 않는다. HTTPS Supabase 요청은 서버 broker가 사용자 토큰으로 수행하므로 브라우저 Network에는 주로 localhost broker 요청이 보인다. 원격 결과는 비밀정보 없는 journal과 서버 row 검증으로 확인한다.
8. A/B UID 분리·프로젝트 2개 상한·revision 증가·단절/복구·두 탭·probe를 확인한다. Chrome의 localhost 접근 권한 경고가 있으면 우회하지 말고 사용자가 정상 권한 절차를 처리한다. 자동화 브라우저 검사로 보고하지 않는다.

## 안전 정리

두 브라우저 프로필의 자동 저장을 멈추고 broker를 종료한다. --cleanup은 별도 `BATH_STORAGE_CLEANUP_CONFIRM=delete-only-journal-resources`와 GET 사전 검사를 요구하며, 이미 종료된 run은 다시 쓸 수 없다.

정리 전 모든 등록 UID의 익명 여부/신뢰 표식과 모든 project UUID/소유자/표식을 검증한다. 예상 밖 프로젝트·멤버십이 있으면 첫 삭제 전에 중단한다. 프로젝트를 UUID+owner+projectName 조건으로 삭제하고 부재를 확인한다. 양쪽 프로젝트 정리가 끝난 후 각 UID의 프로젝트·business_members가 모두 0개인지 확인하고, Auth 표식을 다시 검사한 뒤 해당 UID만 삭제한다. Auth CASCADE로 프로젝트 정리를 대신하지 않는다.

Auth 삭제 뒤 등록 UID의 GET 404 user_not_found와 참조 데이터 부재를 확인한다. 401/403/다른 404/통신 오류는 정리 성공이 아니다. 프로젝트 정리 실패 시 Auth 삭제는 실행하지 않는다. Auth 삭제 실패는 UID/의도를 남겨 같은 journal로 재시도한다. signup UID가 불명확하거나 표식이 없으면 자동 정리를 거부하고 수동 복구가 필요하다.

결과는 `phase5b3-journal.json.cleanup-report.json`에 별도로 기록한다. cleanup_complete는 잔여 자원 정리 결과이며 RLS 테스트 전체 PASS를 의미하지 않는다. journal의 FAIL/unknown 요청을 별도로 보고해야 한다. 기존 고객·업체 데이터는 삭제 대상이 아니다.

## 오프라인 검증 결과

기존 54개 + 신규 28개 = 82 PASS. 기존 프로젝트 정보·Builder 모드 회귀, TypeScript, 프로덕션 빌드 통과. 새 경계·승인 누락·중복 생성·journal 실패·응답 유실·부분 생성·소유자/표식 불일치·프로젝트/Auth 정리 실패·재시작 복구·실제 토큰과 RLS 거부 구분을 Mock으로 검사했다. 기존 다중 탭/로컬 보존 검사도 유지했다. 실제 원격·브라우저 테스트는 아직 미실행이다.

```powershell
node --test tests/customer-project-sync.cjs tests/customer-project-binding.cjs tests/customer-multitab.cjs supabase/tests/phase5b3a-tools.test.mjs
node tests/project-info.cjs
node tests/builder-mode.cjs
npx.cmd --no-install tsc --noEmit --incremental false
npm.cmd run build
```
