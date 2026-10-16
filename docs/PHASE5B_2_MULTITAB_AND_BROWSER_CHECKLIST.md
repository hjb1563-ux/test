# PHASE 5B-2 보완 — 다중 탭 및 수동 브라우저 검사

## 활성화 상태와 구현 경계

실제 CUSTOMER_CLOUD_SAVE_ENABLED는 false를 유지했다. 실제 Auth/Data API 요청, 계정 생성, DB 변경은 하지 않았다. 새 소프트웨어·SDK를 설치하지 않았다. 현재 package.json/lockfile에는 supabase-js/auth-js가 없으며 Supabase CLI만 개발 의존성으로 있다. 고객 인증은 자체 REST 공급자이므로 SDK의 자동 갱신/세션 전파/내부 잠금이 이미 동작하는 것으로 가정하면 안 된다. 세션은 요청 시 갱신하며 타이머 기반 SDK 자동 갱신은 없다. 향후 SDK를 도입하면 같은 인증 경로를 두 공급자로 실행하지 말고 SDK 내부 잠금과 통합 검토해야 한다.

## 잠금과 저장 안전성

- Web Locks의 origin 단위 exclusive 잠금을 사용한다. 인증 잠금과 프로젝트 binding 잠금 이름에는 개발 Project Ref가 들어간다. 프로젝트 UUID 할당·공유 metadata·reset도 보호해야 하므로 프로젝트 잠금은 개별 UUID 대신 공유 binding 키 전체를 보호한다.
- 잠금 순서는 프로젝트 → Auth이다. Auth 공급자는 프로젝트 잠금을 획득하지 않고 metadata를 읽기만 한다. 이미 획득한 같은 잠금을 재진입하거나 steal로 빼앗지 않는다. BroadcastChannel/storage 알림은 상호 배제 대안으로 사용하지 않는다.
- 대기는 5초 후 취소한다. 잠금 작업에는 15초 취소 신호가 있고 Auth/Data API 요청과 응답 body 읽기는 10초 제한 및 상위 취소 신호를 따른다. 타임아웃은 서버 rollback 보장이 아니므로 결과 불명확 시 기존 attempted/revision 복구 규칙을 따른다.
- 진행 중 I/O를 남긴 채 Promise.race만으로 잠금을 강제 해제하지 않는다. 실제 fetch 취소/완료와 callback 종료 후 해제된다. 테스트 대체 transport도 AbortSignal을 준수해야 한다. 탭 종료 시 Web Locks는 브라우저가 해제하며 기존 intent는 영속 저장소에 남는다.
- API 미지원/보안 제한/대기 실패면 클라우드 작업을 거부한다. 임의의 메모리 잠금이나 localStorage spin lock으로 우회하지 않는다. OFF에서는 잠금/환경변수/저장소/Auth 요청에 접근하지 않는다.
- 인증 잠금 획득 후 세션과 expectedOwner를 다시 읽는다. 다른 탭이 만든 세션을 복원하고 refresh token 회전도 직렬화한다. 저장소가 예상 밖으로 바뀌면 이전 세션을 덮어쓰거나 반환하지 않는다. signup 결과 유실은 자동 재가입하지 않는다.
- 저장 잠금 획득 후 metadata 원문을 다시 비교한다. 다른 탭이 UUID/owner/revision/confirmed/pending 등을 바꿨으면 metadata-changed로 중단한다. 새 revision을 자동 채택해 오래된 화면을 저장하지 않는다. DB revision 조건은 기기/프로필 간 경쟁에 대한 최종 방어로 유지한다.
- 타 탭의 최신 binding을 오래된 인스턴스가 다시 쓰지 않도록 metadata 저장 전에도 원문 일치를 확인한다. 명시적 review에서 최신 서버와 다시 비교한 경우에만 기준을 재설정한다. 서버 null/소유권 유실은 자동 복원 또는 INSERT를 유발하지 않는다.

### 보존 위치와 한계

기존 LocalProject 키 `bath-designer-selections-v2`와 정규화 코드는 변경하지 않는다. 기존 공유 localStorage 키는 원래처럼 마지막 로컬 저장값이 남으며 화면 상태를 storage 이벤트로 자동 교체하지 않는다. 이번 변경이 기존 로컬 저장을 완전한 다중 문서 저장소로 만드는 것은 아니다.

ON 준비 경로에서는 탭별 `<binding키>:pending:<tabId>`에 화면 snapshot·원문·기준 revision을 별도로 남겨 공유 키의 마지막 저장값과 별개로 복구할 수 있다. 클라우드 차단 시에도 해당 탭의 초안을 보존한다. 실패 초안을 사용자가 검토하기 전 삭제하지 않는다. 성공 후에도 복구 항목은 보수적으로 보관하므로 복구 항목 존재만으로 서버 미저장을 단정하지 않는다. 새로고침 후 기존 recovery 키는 남지만 자동 병합하지 않는다. 실제 복구 UI와 장기 보관 용량 관리는 별도 작업이다.

첫 클라우드 저장 전 기존 `<로컬키>:cloud-backup:<UUID>` 백업을 유지한다. reset/retire는 metadata archive를 만들며 원격 삭제를 하지 않는다. reset 대기 중 다른 탭이 metadata를 바꾸면 새 UUID로 덮어쓰지 않고 클라우드 저장을 중단한다. 다른 브라우저 프로필/기기는 localStorage와 Web Locks를 공유하지 않으므로 각자 세션과 프로젝트를 가지며 서버 충돌은 RLS/revision으로 차단한다.

참고: [Web Locks request: 취소·exclusive·callback 수명](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request), [Supabase Auth SDK 구현](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts). SDK를 쓰지 않는 현재 코드에 SDK 내부 잠금이 자동 적용되지는 않는다.

## 자동 검사

```powershell
node --test tests/customer-project-sync.cjs tests/customer-project-binding.cjs tests/customer-multitab.cjs
node tests/project-info.cjs
node tests/builder-mode.cjs
npx.cmd --no-install tsc --noEmit --incremental false
npm.cmd run build
```

기존 37개 유지 + 다중 탭 17개 = 총 54개 PASS. 타입/기존 프로젝트 정보·Builder 모드 회귀 검사 통과. 운영 코드의 Feature Flag는 바꾸지 않고 테스트만 가짜 transport/저장소/잠금을 주입한다. Auth 동시 생성·복원·대기 후 재조회·갱신 경쟁, 잠금 미지원/거부/대기 및 작업 취소, metadata 변경, 동시 저장, 오래된 탭 차단, 종료 후 불명확 INSERT 복구, backup 보존, 프로필 격리, OFF 외부 요청 0건을 검사한다. 실제 브라우저 상호작용과 Network 기록은 이번 단계에서 실행하지 않았으며 PASS로 표시하지 않는다.

## 수동 브라우저 체크리스트 — 모두 아직 미실행

### 1. 완전히 분리된 테스트 프로필

- [ ] Chrome 프로필 아이콘 → 프로필 추가 → 계정 로그인 없이 계속하여 `Bath Local Test` 같은 새 프로필을 만든다. Edge는 프로필 아이콘 → 프로필 추가/새 개인 프로필 → 브라우저 데이터 없이 시작을 선택한다. 버전별 명칭은 다를 수 있다.
- [ ] 기존 프로필·동기화·데이터 가져오기를 사용하지 않는다. 다른 시크릿 창들이 저장소를 공유할 수 있으므로 독립 고객 A/B는 별도 프로필 2개를 사용한다.
- [ ] 새 프로필에서만 localhost를 연다. DevTools → Application → Local Storage에서 기존 프로젝트 데이터가 없는지 확인한다. 기존 데이터가 보이면 삭제하지 말고 올바른 새 프로필로 바꾼다.

### 2. 서버 및 OFF 상태

```powershell
cd 'C:\Users\User\Desktop\Bath Design'
npm.cmd run dev
```

- [ ] 출력된 Local 주소로 접속한다(기본 http://localhost:3000/design). 이미 서버가 실행 중이면 같은 프로젝트의 주소인지 확인하고 중복 실행하지 않는다.
- [ ] `data/customer-project-sync.ts`의 CUSTOMER_CLOUD_SAVE_ENABLED=false를 확인한다. 테스트를 위해 true로 바꾸지 않는다.
- [ ] NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 없어도 기존 로컬 Builder가 작동하는지 확인한다. 실제 키·토큰을 콘솔에 입력하거나 출력하지 않는다.
- [ ] DevTools → Network에서 Preserve log를 켜고 목록을 비운 뒤 새로고침한다. 필터 `supabase`로 Auth/Data API 요청이 0건인지 확인한다. localhost HMR/WebSocket/이미지 요청은 구분한다.
- [ ] 아래 모든 화면 조작 후에도 `/auth/v1/signup`, `/auth/v1/token`, `/auth/v1/user`, `/rest/v1/projects` 요청이 0건인지 확인한다. 요청이 있으면 진행을 중단한다. 민감 헤더를 포함한 HAR는 공유하지 않는다.

### 3. 고객·전문가 및 저장·복원

- [ ] 합성 프로젝트명 `LOCAL-ONLY-5B2`를 사용해 고객 모드를 시작하고 화면 총 13 Step 및 앞/뒤 이동을 확인한다.
- [ ] 선택 → 선택 취소 → 다시 선택을 수행하고 상담 결과와 선택 수가 일치하는지 확인한다.
- [ ] 서로 다른 이미지 선택 2개 이상의 기록 순서를 기억하고 새로고침 후 순서·선택·프로젝트 정보·현재 Step이 복원되는지 확인한다.
- [ ] 상담서에서 합성 메모·체크를 입력하고 새로고침/Builder 왕복 후 보존되는지 확인한다. 개인 고객 정보를 입력하지 않는다.
- [ ] 전문가 모드 총 15 Step과 고객 모드의 차이를 확인한다. 숨겨진 전문 항목 값이 임의 삭제되거나 서버로 전송되지 않는지 확인한다.
- [ ] 초기화는 이 새 테스트 프로필의 합성 데이터에만 수행한다. 기존 고객 프로필에서는 누르지 않는다. 기존 확인 대화상자와 새 시작 흐름을 확인한다.

### 4. 데스크톱·모바일 및 두 탭

- [ ] 데스크톱 1440×900 및 DevTools device toolbar의 390×844, 360×800에서 가로 넘침·선택·이동·히스토리·상담서 접근을 확인한다.
- [ ] 같은 테스트 프로필에서 두 번째 localhost 탭을 열고 첫 탭 저장 후 둘째 탭 새로고침 시 마지막 로컬 데이터가 보이는지 확인한다.
- [ ] 두 탭 각각 합성 데이터를 수정해 기존 공유 로컬 키의 마지막 저장 동작을 확인한다. 이미 열려 있는 다른 탭의 화면이 서버 데이터로 자동 교체되지 않는지 확인한다. OFF에서는 cloud metadata/pending 키가 새로 생기면 안 된다.
- [ ] Network를 두 탭 모두 확인하고 Supabase 요청 0건을 기록한다. Web Locks와 실제 클라우드 충돌 검사는 OFF 수동 검사로 검증할 수 없으며 이번 Mock 결과와 구분한다.

결과 기록: 프로필/브라우저 버전, viewport, 항목별 PASS/FAIL/미실행, 비밀값 없는 화면/요청 건수만 기록한다. 이 문서의 체크박스는 실제 수행자가 확인하기 전까지 체크하지 않는다.

## PHASE 5B-3 전 준비 조건

수동 브라우저 체크리스트 수행, 개발 공개 키의 로컬 설정, 테스트 사용자·프로젝트 journal과 정리 범위, 실제 쓰기와 Feature Flag 활성화의 별도 승인이 필요하다. 최소 원격 계획은 독립 프로필 A/B의 Auth 2개·프로젝트 2개다. 같은 프로필 두 탭은 동일 세션/프로젝트로 잠금·충돌을 확인하고 추가 계정 생성을 기대하지 않는다. 실제 생성 수가 계획을 초과하면 중단한다. 프로젝트 소유자/UUID/전용 테스트 근거를 확인하여 프로젝트 → 잔여 데이터 확인 → Auth 순으로 정리하며, 이번에는 어떤 원격 정리도 실행하지 않았다.
