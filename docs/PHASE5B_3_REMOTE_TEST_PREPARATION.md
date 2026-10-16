# PHASE 5B-3 실제 저장 테스트 사전 준비

작성일: 2026-10-17. 이번 단계는 문서·읽기 전용 로컬 점검만 수행한다. 실제 Flag 활성화, Auth/Data API 호출, 원격 생성/정리, 로컬 고객 데이터 초기화는 금지한다.

## 실제 설정 확인

- 개발 대상: bath-designer-dev / istsrambmbzuemkgutgh.
- URL: https://istsrambmbzuemkgutgh.supabase.co (DEV_PROJECT_REF로 고정). 현재 클라이언트에는 별도 URL 환경변수가 없다.
- Next.js 루트 .env.local은 없고 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY는 미설정이다. 실제 값은 확인·출력·복사하지 않았다.
- 사용자가 직접 만들 파일: `C:\Users\User\Desktop\Bath Design\.env.local`.

```dotenv
# 실제 값은 사용자가 로컬 편집기에서 직접 입력한다.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<개발 프로젝트의 sb_publishable_ 키>
```

Supabase Dashboard에서 해당 개발 프로젝트의 Settings → API Keys에서 Publishable Key를 확인한다. UI 명칭은 버전에 따라 달라질 수 있다. Secret/service_role/Management Token/DB 비밀번호는 이 파일에 넣지 않는다. NEXT_PUBLIC_ 값은 브라우저에 포함되므로 비밀값용 변수가 아니다. 변경 후 로컬 개발 서버를 재시작해야 한다. 키 원문을 채팅/터미널/스크린샷으로 공유하지 않는다.

`.gitignore`의 .env*.local 및 .env.* 규칙이 이 파일을 제외한다. 로컬 .env.local 생성만으로 Vercel 환경변수가 바뀌지는 않으며 Vercel CLI/배포/환경 설정 변경은 하지 않는다. 기존 서버 측 테스트 credentials.env.local은 프론트엔드에서 읽지 않는다.

실제 Feature Flag: `data/customer-project-sync.ts`의 `CUSTOMER_CLOUD_SAVE_ENABLED=false`. 환경변수가 아니라 빌드에 포함되는 소스 상수이며 Builder 연결·초기화·충돌 조회/검토 진입점을 차단한다. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 설정하는 것만으로 활성화되지 않는다. 반대로 상수를 ON으로 바꾼 코드를 나중에 배포하면 그 빌드에도 반영될 수 있다. 실제 테스트 승인 전 개발 실행에만 한정하는 추가 활성화 경계가 필요하다. 현재 Vercel 배포는 변경하지 않았다.

## 현재 코드로 가능한 것과 부족한 것

기존 코드에는 프로젝트 UUID/owner/revision/confirmed/pending/attempted, Auth 생성 의도, 탭별 복구 초안과 백업이 있다. 다중 탭 Web Locks와 revision 조건도 유지한다.

그러나 이것은 실행별 테스트 journal과 동일하지 않다. 현재 signup 본문은 data:{}이고 신뢰할 수 있는 테스트 app_metadata 표식은 자동 부여하지 않는다. 통합 테스트 시작 전 기록·Auth UID 수집·전용 표식 부여·정리 검증을 한 흐름으로 연결하는 실행기는 아직 없다. 기존 phase4b1-customers.mjs는 표식/journal/정리 안전장치의 참고 자료로 재사용하되, 그대로 --run 하면 브라우저 연동 테스트 대신 별도 계정을 생성하므로 이번 계획에서 실행하지 않는다.

서버 GET은 로컬과 비교하고 불일치 시 정지한다. 새로고침에서 로컬 데이터가 복원되는 것과 서버 전용 데이터가 화면에 복원되는 것은 다른 검사다. 현재 서버 값을 자동으로 UI/localStorage에 적용하지 않으며, 순수한 서버 복원은 명시적 검토·적용 경로를 추가하거나 테스트 하네스에서 별도로 확인해야 한다. 실제 테스트 프로필의 localStorage를 지워 이를 흉내 내지 않는다.

## 생성 전 journal 설계

기존 ACL 보호 및 Git 제외가 검증된 tests/artifacts/phase4a2 아래 별도 phase5b3 실행 폴더를 사용한다. 이번에는 실제 journal이나 자원을 생성하지 않는다. 향후 하네스는 다음 구조를 원자적으로 저장하고 읽어 확인한 후 각 요청을 보낸다.

```json
{
  "kind": "customer-browser-storage-test-v1",
  "project_ref": "istsrambmbzuemkgutgh",
  "run_id": "<실행 시 새 UUID>",
  "started_at": "<실행 시 UTC 시각>",
  "resource_limit": {"auth": 2, "projects": 2},
  "actors": {
    "A": {"profile": "전용 A", "nonce": "<새 nonce>", "auth_uid": null, "auth_state": "planned", "project_id": null},
    "B": {"profile": "전용 B", "nonce": "<새 nonce>", "auth_uid": null, "auth_state": "planned", "project_id": null}
  },
  "projects": [],
  "requests": [],
  "cleanup": {"projects_absent": false, "auth_absent": false, "complete": false}
}
```

Auth UID는 서버 할당이므로 생성 전에 알 수 없다. 먼저 actor/run/nonce와 signup 의도를 기록하고 응답 UID를 즉시 등록한다. 응답 유실이면 생성 상태를 unknown으로 남기고 자동 재생성/광범위 검색·삭제하지 않는다. 서버 측 관리자 도구로 정확한 UID에 신뢰할 수 있는 app_metadata 실행 표식을 부여·GET 검증한 후 프로젝트 생성을 허용한다. user_metadata만으로 소유권을 증명하지 않는다.

프로젝트 INSERT 전에 예약 UUID·owner·run 표식·예정 본문을 journal에 저장한다. 기존 project_info.projectName에 합성 표식 `BATH-STORAGE-TEST:<run_id>:A/B`를 사용하되 화면 수정 테스트 중 이 표식을 변경하지 않는다. DB 컬럼을 추가하지 않는다. 테스트 journal과 프로젝트 marker를 연결하는 로컬 계측이 선행되어야 한다. 인증정보 대신 요청 단계/메서드/상태/정해진 오류 코드만 기록한다.

브라우저 Auth/Data API 검사는 해당 사용자 JWT와 Publishable Key로 수행한다. 관리자 자격증명은 별도 서버 측 검증·표식·정리 도구에서만 사용한다. 브라우저 코드/공개 환경변수에는 전달하지 않는다.

## 최소 테스트 순서와 자원 수

| 단계 | 확인 | 추가 원격 자원 |
|---|---|---|
| 사전 | 로컬 전용 활성화 경계, 프로젝트 식별, journal/ACL/정리 도구, A/B 별도 프로필 확인 | 없음 |
| A 시작 | 실제 익명 Auth 및 /user, is_anonymous, UID 기록·표식 확인, 최초 INSERT | Auth 1 + 프로젝트 1 |
| B 시작 | 실제 익명 Auth, A와 UID/UUID 다름, 최초 INSERT | Auth 1 + 프로젝트 1 |
| 수정 | 각 옵션 변경·취소·히스토리 변경과 서버 row 비교, revision+1 | 없음 |
| 새로고침 | 같은 UID/UUID, confirmed/revision 재확인, 로컬 보존 및 서버 내용 일치 | 없음 |
| 단절 | DevTools Offline 중 합성 변경 → pending/백업 보존 → Online → GET/명시적 검토 후 재개 | 없음 |
| 두 탭 | A 프로필 내 탭 2개로 인증/갱신·오래된 저장 충돌 확인 | 없음 |
| 교차 접근 | A 세션으로 B UUID, B 세션으로 A UUID 조회/수정/삭제 차단 및 원본 불변 확인 | 없음 |
| 정리 | 등록된 프로젝트 2개 부재 확인 후 등록된 Auth 2명 정리 | 생성 없음 |

Flag ON 후 첫 hydration의 로컬 저장 effect가 인증·INSERT를 시작할 수 있다. 사용자가 저장 버튼을 누를 때까지 기다리는 구조가 아니다. 따라서 journal/표식/계측/대상 확인을 나중에 붙이면 안 된다. 두 전용 프로필 외의 localhost 탭은 닫은 뒤 시작해야 한다. 테스트 중 초기화/새 프로젝트/세션 지우기는 추가 자원을 만들 수 있어 범위에서 제외한다. Auth/프로젝트 생성이 각각 2개를 초과하면 즉시 중단한다.

정상 새로고침에서도 현재 구현은 같은 내용의 자동 UPDATE를 보낼 수 있으므로 최종 revision을 미리 특정 숫자로 고정하지 않는다. 요청별 기대 증분을 기록하고 신규 INSERT 수가 늘지 않는지 검사한다.

## 다중 탭 검증 절차

같은 프로필 A에서 첫 세션 생성과 동시에 두 탭을 열 경우 signup은 1회여야 한다. 프로젝트 공유 binding이 바뀌면 뒤처진 탭은 metadata-changed로 정지하고 탭별 pending을 보존해야 한다. A1을 저장한 뒤 A2를 최신 상태로 확인하고, 이후 A1에서 다시 오래된 저장을 시도해 서버 row/revision 불변을 확인한다. 충돌을 자동 해소하지 않고 현재 server/confirmed/local/pending을 나누어 검토한다.

원격 revision 충돌은 같은 브라우저 잠금으로 직렬화된 테스트와 구분한다. 하네스에서 실제 사용자 세션으로 동일 기준 revision의 두 조건부 UPDATE를 준비해 1개만 반영되는지 확인한다. 관리자 키로 사용자 접근 검사를 대체하지 않는다. 두 번째 고객 B 프로필은 A의 세션·잠금을 공유하지 않아야 한다. 세션 삭제/유실의 실제 원격 검사는 별도 범위 승인 없이는 하지 않고 기존 Mock 결과를 사용한다.

## 안전 정리

1. 두 테스트 프로필의 자동 저장/열린 탭을 중지하고 추가 요청이 없음을 확인한다. Flag OFF 복귀만으로 이미 전달된 요청이 취소된다고 가정하지 않는다.
2. journal의 정확한 UUID·owner와 DB project_info 표식, 실제 Auth UID·익명 여부·신뢰할 수 있는 실행 표식을 읽기 전용으로 대조한다. 하나라도 다르면 삭제하지 않는다.
3. journal에 등록된 테스트 프로젝트만 삭제한다. 삭제 뒤 정확한 UUID 조회와 해당 테스트 UID 소유 프로젝트 조회로 잔여 데이터를 확인한다. 예상 밖 소유 프로젝트나 멤버십이 있으면 Auth 삭제 금지다.
4. 프로젝트 정리 성공/부재가 확인된 경우에만 정확한 테스트 Auth UID와 app_metadata 표식을 다시 확인해 세션 종료·Auth 삭제를 수행한다. Auth 삭제의 CASCADE로 프로젝트를 정리하지 않는다.
5. 등록된 UID의 GET user_not_found로 부재를 확인한다. 401/403/다른 404/네트워크 오류는 성공이 아니다. 삭제 응답 유실은 GET으로 재조정하고 무작정 반복 삭제하지 않는다.
6. 실패 시 전체 테스트 FAIL/cleanup incomplete와 잔여 UUID를 기록한다. 원인 해결 후 같은 journal로 대상별 재시도하며 전체 테이블 삭제·기존 고객 데이터 삭제는 금지한다. 비밀값/세션은 결과 보고에 포함하지 않는다.

## 다음 승인에서의 정확한 범위

먼저 로컬에서 개발 전용 활성화 경계와 journal/표식·정리 하네스를 연결하고 Mock으로 검증한다. 공개 키를 사용자가 입력한 뒤 형식·대상을 값 출력 없이 확인한다. 이 준비가 통과한 경우에만 별도로 승인된 실제 실행 범위(전용 프로필 A/B, Auth 2명·프로젝트 2개와 검증 및 안전 정리)에 진입한다. 아직 이 문서만으로 원격 쓰기가 승인된 것은 아니다. 관리자 표식·정리 도구 사용도 승인 범위에 명시해야 한다.
