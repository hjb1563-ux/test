# PHASE 5B-1 고객 인증·저장 로컬 연동

후속 보완: [PHASE5B-2 다중 탭 및 브라우저 체크리스트](./PHASE5B_2_MULTITAB_AND_BROWSER_CHECKLIST.md). 아래의 cross-tab 잠금 미구현 설명은 당시 상태이며, 현재 구현은 후속 문서를 기준으로 한다.

## 활성화 상태

`CUSTOMER_CLOUD_SAVE_ENABLED=false` 유지. Builder의 로컬 저장 성공 후 notify 함수를 호출하지만 OFF에서는 즉시 반환한다. window/storage/환경변수/Auth/Data API에 접근하지 않는다. 기존 UI, Step, 선택, 로컬 저장 키/복원/초기화 규칙은 그대로다. 실제 Supabase 요청은 이번 검증에서 하지 않았다.

## 인증 공급자

`customer-anonymous-auth.ts`는 publishable key만 허용하는 HTTPS Auth REST 공급자다. SDK 추가 설치 없이 /signup, /token?grant_type=refresh_token, /user를 사용한다. 기존 보호된 테스트 자격증명 파일과 연결하지 않는다. 미래 공개 설정은 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 하나이며 URL은 개발 프로젝트로 고정한다. 키 자체를 소스나 로그에 기록하지 않는다.

브라우저의 프로젝트별 전용 Auth 키에서 기존 세션을 우선 복원한다. 만료 60초 전부터 같은 사용자 세션을 refresh하고 /user로 실제 UID와 is_anonymous를 확인한다. 동시 호출은 single flight다. 신규 익명 사용자는 프로젝트 소유자와 기존 Auth 이력이 모두 없는 경우에만 생성할 수 있다. signup 의도를 저장한 후 응답이 불명확하면 재생성을 차단한다. 이미 바인딩된 UID의 세션 유실·타 UID·비익명 사용자·인증/네트워크 실패는 새 사용자 생성으로 대체하지 않는다.

Auth 토큰은 별도 브라우저 저장 키에만 있고 URL/프로젝트 metadata/로그에는 없다. 브라우저 저장소는 XSS에 노출될 수 있으며 암호화 보관소가 아니다. 익명 세션과 브라우저 데이터를 잃으면 서버 소유권 복구를 보장하지 않는다. refresh token 회전 및 공급자 오류 실제 응답 호환성은 승인된 개발 테스트로 추가 검증해야 한다. 공식 근거: [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous), [Auth API](https://supabase.com/docs/reference/api/auth).

## 프로젝트 식별 및 저장

별도 `bath-designer-customer-cloud-v1` 키에 version/schema_version/projectRef/id/owner/revision/confirmed/pending/attempted/blocked를 하나의 JSON으로 기록하고 재조회한다. 사용자 LocalProject는 기존 키에 그대로 남는다. UUID는 crypto.randomUUID이며 기존 서버 ID를 추측하거나 가져오지 않는다. 손상된 metadata는 자동 초기화하지 않고 저장을 차단한다.

서버 마지막 확인본은 confirmed, 아직 보내지 못한 최신 snapshot은 pending이다. 새로고침 후에는 실제 소유자 세션과 서버 row를 다시 조회한다. confirmed와 다르거나 서버가 비어 있으면 자동 UPDATE/INSERT를 하지 않는다. 기존 owner와 세션 UID가 다르면 owner-mismatch로 구분한다. RLS 때문에 null 조회만으로 삭제와 접근 권한 소실을 구분할 수 없으므로 missing-or-inaccessible로 표시한다. 다른 고객의 row를 관리자 키로 조회해 구분하지 않는다.

신규 INSERT 전에 attempted를 영속 기록한다. 응답 유실 또는 중복 UUID 오류 후 자동 INSERT 재시도는 없다. reload GET에서 row가 발견되어도 uncertain-insert로 검토를 요구한다. UPDATE는 기존 어댑터의 id/owner/revision 필터를 사용하며 0행은 실패다. 성공 revision은 이전+1, INSERT는 1임을 확인한다. 소유자/id/revision/생성시각은 UPDATE 본문에 넣지 않는다.

기존 CustomerProjectSync가 백업·snapshot·직렬 큐를 담당하고 binding이 영속 이력/재개 검토를 담당한다. 원격 저장 전 기존 localStorage 원문은 별도 backup 키에 유지한다. 네트워크·세션·서버 오류 시 blocked로 멈추고 최신 pending을 보존한다. 동시 탭의 충돌은 DB revision 또는 INSERT 중복으로 차단되며, 자동 병합하지 않는다.

## 충돌 검토와 초기화

`inspectCustomerCloudConflict()` → 마지막 확인본/현재 local/pending/현재 server/blocked 사유를 구분한다. `reviewCustomerCloudServer(row)`는 실제 최신 GET과 다시 비교하고 명시적으로 검토한 revision만 재개 기준으로 설정한다. localStorage를 서버 데이터로 덮어쓰지 않는다. 이후 사용자가 선택한 로컬 snapshot을 별도 저장해야 한다. 현재는 상태 API와 Mock 흐름만 있고 충돌 UI는 추가하지 않았다. 서버 빈 응답은 로컬을 지우지 않는다.

기존 초기화 확인 이후 연결 모듈은 이전 큐 세대를 중단하고 metadata를 archive:<UUID>로 남긴 뒤 새 프로젝트 UUID로 분리한다. 원격 DELETE나 Auth 삭제는 없다. 이미 서버에 전달된 요청은 취소 보장이 없지만 이전 UUID에 대한 기록을 남기고 새 프로젝트와 섞지 않는다. archive 저장 실패 시 클라우드 저장을 중단한다. 모드가 professional로 바뀌면 업체/전문가 저장을 하지 않는다.

## 범위와 검증

Configurator의 선택/선택취소/현재 Step/이미지 순서/특이사항/프로젝트 정보 저장에 연결했다. 상담서 페이지는 변경하지 않았으며 memo/checks는 기존 로컬 값에서 병합된다. 상담서 페이지에서 즉시 원격 저장하는 연결은 후속 범위다.

```powershell
node --test tests/customer-project-sync.cjs tests/customer-project-binding.cjs
node tests/project-info.cjs
node tests/builder-mode.cjs
npx.cmd --no-install tsc --noEmit --incremental false
```

Mock은 가짜 키·토큰·메모리 저장소와 가짜 fetch만 사용한다. 기존 PHASE5A 15개와 신규 Auth/metadata/충돌/Builder OFF 검사를 유지한다. 실제 테스트 사용자는 생성하지 않는다.

최종 결과: 기존 15개 + 신규 22개 = 37개 PASS. Mock ON은 테스트 VM 내부에만 주입하고 실제 Feature Flag는 변경하지 않았다. 프로젝트 정보·Builder 모드 회귀와 TypeScript 검사 통과. 별도 모바일 브라우저 회귀 스크립트는 playwright 미설치로 실행하지 못했다(설치/의존성 변경 없음).

## 승인 후 실제 테스트 순서

1. 별도 승인: 개발 프로젝트만 대상으로 공개 키 등록, 테스트 전용 브라우저 프로필 사용, Feature Flag ON 변경 범위와 Auth/프로젝트 생성·정리 범위를 승인한다.
2. 기존 실제 로컬 고객 데이터는 건드리지 않고 테스트 프로필의 백업·UUID·schema/owner/서버 이력 저장을 확인한다.
3. 세션 신규 생성/복원/갱신, 실제 /user, owner 일치, INSERT 1회와 revision UPDATE를 확인한다.
4. 새로고침·네트워크 응답 유실·다중 탭 revision 충돌·선택취소·이미지 순서·세션 유실을 확인한다. 충돌은 상태 검토 후에만 재개한다.
5. 승인된 테스트 UUID/UID만 확인해 별도 안전 절차로 정리하고 OFF로 복귀한다. 제품 초기화 기능이 원격 삭제를 대신하지 않는다.

실제 활성화 전 위험: 자체 REST Auth의 공급자 응답/회전 검증, cross-tab Auth 생성 경쟁 방지(브라우저 잠금), 원격 요청 시간 제한/취소 정책, 충돌 안내 UI와 복구 UX, 상담서 변경 연동, 장기 archive 용량 관리가 남아 있다. OFF 유지 중 원격 영향은 없다.
