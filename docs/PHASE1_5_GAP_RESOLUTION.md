# BATH DESIGNER PHASE 1.6 — 저장·복원·백엔드 연결 설계 확정안

작성일: 2026-10-16 (Asia/Seoul). 상태: 문서 설계 완료, 구현·DB 적용 미실행.
PHASE 2.5.1 정정: 사용자 결정으로 CASCADE 유지, RESTRICT 제안 철회. project_info/selections의 최소 타입·컬럼별 크기 CHECK만 기존 SQL 파일에 반영했다. DB 적용은 미실행이다.
이 문서의 ‘채택’은 구현할 설계의 선택을 뜻하며 현재 서비스가 해당 방식으로 동작한다는 뜻이 아니다.
PHASE 1.6 당시 변경 범위는 이 문서와 PHASE2_DATABASE_DESIGN.md뿐이었다. PHASE 2.5.1에서는 승인된 기존 SQL의 CHECK만 추가하며 테스트·UI·저장 로직은 변경하지 않는다.

## 1. 확인된 현재 동작과 누락

별도 PHASE 1 종합 보고서는 발견하지 못했다. 다음 소스와 PHASE 1.5 검증 결과를 기준으로 보완한다.

| 근거 | 실제 동작 | 보완 설계 |
|---|---|---|
| components/Configurator.tsx:119,143 | 기본 키 복원 후 values·정보·진행 위치 자동 저장 | 프로젝트 ID별 저장소와 복원 완료 장벽 |
| app/result/page.tsx:52–57 | 선택값 JSON으로 기본/상담서별 저장소 결정 | 선택값을 식별자로 사용하지 않음 |
| app/result/page.tsx:107–110 | 상담서 편집 시 기본 프로젝트 덮어쓰기 | 같은 ID 편집·불러오기·교체·복제 분리 |
| components/Configurator.tsx:72,198 | plan·specialNotes가 URL에 포함됨 | 내부 이동은 프로젝트 ID만 전달 |
| data/bathroom-consultation.ts:98–115 | 현재 정규화가 version 3 생성, 알 수 없는 필드 제거 | 버전 판정/원본 보존 후 지원 데이터만 변환 |
| components/Configurator.tsx:205–213 | 초기화는 기본 키만 제거 | 선택 초기화·개별 삭제·전체 삭제 분리 |

현재 payload는 LocalProject version 3이다. projectInfo, values, memo, specialNotes, current, checks,
imageHistoryOrder, lastModifiedAt이 있으며 UUID·owner·revision은 없다. 로컬 정보는 아직 서버에 전송되지 않는다.
Consumer/Professional은 표현 모드이며 로그인·업체 권한이 아니다. 실제 브라우저 자료의 수량·손상 비율,
원격 Anonymous Auth 활성화·세션 정책·호스팅 로그 수집 범위는 이번 작업에서 확인 불가다.

## 2. 프로젝트 식별과 로컬 저장 계약

### 채택: 로컬에서 먼저 만든 UUID를 서버 projects.id로 그대로 사용

- projectId: 프로젝트 UUID. crypto.randomUUID()로 안전한 환경에서 한 번 생성한다. 실패하면 서버 이전을 중단하고 로컬 기능을 유지한다.
- ownerUserId: Supabase Auth UID. projectId와 별개이며 로컬에 적힌 값은 권한 증거가 아니다.
- 같은 선택값·고객명·메모라도 서로 다른 원본 항목은 서로 다른 projectId를 받는다.
- 새 복제는 항상 새 UUID, 현재 프로젝트 편집·재시도·불러오기는 기존 UUID를 사용한다.
- 서버 INSERT에 projectId를 명시하므로 현재 UUID PK가 동일 ID 중복 생성을 막는다. 별도 import_source_id 컬럼은 이번 설계에 필수 아님.
- 타인의 ID를 알더라도 조회·수정·삭제는 RLS로 차단한다. UUID의 비밀성에 권한을 의존하지 않는다.

향후 로컬 저장은 트랜잭션 가능한 IndexedDB 저장소를 채택한다. 패키지 설치는 이번에 하지 않는다.
기존 localStorage 두 계열은 자동 제거하거나 덮어쓰지 않는 legacy 원본으로 취급한다.
제안 store: projects, legacySources, outbox, quarantine. DB 이름/버전은 구현 시 상수로 고정하고 승격 테스트한다.
로컬 envelopeVersion=1과 payload.version=3은 별개다. envelope에 다음 메타데이터를 둔다.

| 메타데이터 | 의미 |
|---|---|
| projectId, payload | UUID와 지원되는 공통 상담서 모델 |
| localGeneration | 로컬 수정 순번. 서버 revision과 구분 |
| ownerBinding | 미연결 또는 확인된 서버 UID; 인증 토큰을 저장하지 않음 |
| baseRevision, basePayload | 마지막 확인된 서버 버전과 충돌 비교 원본 |
| syncState | local-only / pending / uploading / synced / conflict / auth-required / deleted |
| legacySourceId, sourceSnapshotId | 기존 저장 항목과 원본 스냅샷 연결 |

legacySources는 원본 key와 관찰한 원문 문자열을 보관한다. UUID·스냅샷·outbox 연결을 단일 로컬 트랜잭션으로 확정한 뒤만 업로드한다.
원본 key는 직접 입력 내용이 들어갈 수 있으므로 서버·로그·분석 도구에 전송하지 않는다.
원본 문자열 hash는 변경 감지 보조일 뿐 프로젝트 ID가 아니다. hash가 같아도 다른 key는 별도 프로젝트다.
두 탭 동시 스캔은 legacy source key의 unique 제약과 IndexedDB 트랜잭션으로 하나의 매핑만 확정한다.
동일 key의 내용이 나중에 바뀌면 새 스냅샷을 추가한다. 이전 매핑을 지우거나 무조건 새 서버 프로젝트를 만들지 않고 재가져오기/복제 선택을 받는다.
기존 코드가 과거에 같은 key로 덮어쓴 자료는 복구할 근거가 없다. 이 한계를 안내한다.

## 3. 이전 정책과 실패 처리

현재 저장소는 다음 두 종류다.
- bath-designer-selections-v2: 기본 작업 영역 하나. key 이름 v2와 내부 version 3은 다르다.
- bath-designer-report-v1: 계열: 선택값별 상담서 메타데이터. 내부 payload는 같은 LocalProject 형태이며 memo·특이사항·정보가 다를 수 있다.

서버 이전 안내는 ‘이 기기의 자료 N개, 포함 항목: 이름/프로젝트 정보/선택/메모/특이사항’과 대상 계정을 보여준다.
각 항목을 사용자가 선택하며 ‘지금은 이 기기에만 보관’ 경로를 제공한다. 업로드는 선택한 항목만 수행한다.
기본 프로젝트와 상담서가 비슷해도 기본값은 별도 보관이다. 자동 합치기·최근 시각 우선 덮어쓰기는 하지 않는다.
동의/선택 기록은 로컬에 남긴다. 향후 법적 감사 기록이 필요하면 별도 서버 설계를 하며 현재 구현됐다고 주장하지 않는다.

| 상황 | 확정 처리 |
|---|---|
| 기본 프로젝트만 있음 | 원본 보존 → UUID 매핑 확정 → 선택 후 한 항목 업로드 |
| 상담서 키만 있음 | 각 key를 독립 항목으로 복원. 비어 있는 기본 프로젝트를 대신 업로드하지 않음 |
| 둘 다 있음 | 모두 목록화. 같은 선택이어도 자동 통합하지 않음 |
| 선택은 같고 이름/메모/특이사항 다름 | 각각 새 UUID. 비교·미리보기 제공 |
| 일부 손상 | 원문을 quarantine에 보존. 정상 항목만 별도 선택 가능. 손상 항목은 업로드/자동수정 금지 |
| 저장 공간 부족·IndexedDB 차단 | 네트워크 업로드 시작 금지. 원본 유지, 명시적 로컬 내보내기와 공간 확보 안내 |
| 업로드 실패 | 같은 projectId와 고정 snapshot을 outbox에 유지. 새 UUID로 재시도하지 않음 |
| 업로드 중 종료·응답 유실 | 재접속 후 같은 UID·ID로 조회하여 상태 확인. 임의 재생성 금지 |
| 서버 이전 후 재접속 | 매핑과 baseRevision을 복원. 이미 연결된 원본을 신규 목록으로 자동 재등록하지 않음 |
| 매핑 또는 브라우저 데이터 소실 | 신뢰할 재시도 식별 근거가 없으므로 자동 이전 금지. 접근 가능한 서버 목록과 사용자 확인으로 재연결 |

생성 프로토콜: 로컬 매핑 commit → 현재 UID 재확인 → 해당 UUID INSERT → 반환 행과 UID·payload 확인 → 로컬 synced commit.
업로드 snapshot은 고정한다. 업로드 중 추가 편집은 다음 localGeneration으로 저장한다.
중복 PK/응답 유실 시 동일 UID의 SELECT로 기존 행을 확인한다. 같으면 최초 업로드 확인, 다르면 conflict.
조회가 0행이면 삭제·다른 소유자·인증 실패를 구분할 수 없으므로 conflict/auth-required로 멈춘다. blind upsert/새 UUID 재시도 금지.
명확히 서버 미생성인 동일 계정 재시도도 기존 UUID를 쓴다. 확인 불가 상태에서는 중복보다 중단을 택한다.
synced 이후 서버 행이 없어졌다면 삭제 가능 상태로 표시하고 자동 부활시키지 않는다.
성공 이후에도 legacy 원본은 기본 보존한다. 별도의 로컬 삭제 선택이 있을 때만 제거한다.

## 4. 버전·검증·원본 보존

버전 확인은 normalizeProject 호출보다 먼저 한다. 기존 함수를 미래 payload의 무조건 변환기로 재사용하지 않는다.
- version 3: 명시된 타입·범위를 검사하고 편집 가능한 v3 모델로 변환한다.
- 버전 없음 및 알려진 이전 형식: 현재 코드의 partition/showerBooth 합치기, ventilationCustom,
  cracked/loose, 샤워 라벨, 과거 current 이동을 각각 이름 있는 변환 단계와 fixture로 검증한다.
- 이전 버전별 정확한 원형은 모든 사례가 확인된 것이 아니다. 확인된 fixture만 지원하고 모르는 형태는 격리한다.
- 미래 버전 또는 잘못된 버전 타입: 자동 편집·저장·업로드 금지. ‘더 최신 버전 자료입니다’와 원본 내보내기 제공.
- 알 수 없는 top-level/선택/정보 필드는 로컬 원본에 남기고 차이 목록을 보여준다. 임의 의미를 부여하거나 서버로 보내지 않는다.
- 부분 변환은 원본을 덮어쓰지 않는다. 지원 부분만 별도 복제하는 경우 제외 항목을 알리고 명시적 선택을 받는다.
- 지워진 옵션 ID나 잘못된 숫자·날짜를 조용히 빈 값으로 바꿔 서버 저장하지 않는다. 수정/제외 확인을 요구한다.

서버 저장 모델은 현재 LocalProject v3의 명시적 필드만 허용한다. 서버 row → v3 DTO → 화면 렌더링 계약을 공통으로 사용한다.
토큰·owner·revision·동기화 상태는 DTO의 사용자 선택값에 섞지 않는다.
입력 검증을 클라이언트에만 두면 직접 REST 호출로 우회된다. DB는 기본 구조·자료형·버전·총량을 강제하고
Next.js 서버는 후속으로 Option/키 의미·단일/복수 규칙·직접 입력 길이·날짜·금액·Body 크기·동시 저장을 검증한다.
DB의 타입 검사 통과가 모든 업무 규칙 검증 완료를 의미하지 않는다. 메타데이터를 권한 조건으로 사용하지 않는다.

PHASE 2.5.1 적용값: project_info 65,536 bytes, selections 524,288 bytes. 각 JSONB의 PostgreSQL ::text를 UTF-8로 바꾼
크기이며 키/공백/구두점/이스케이프를 포함한다. 전체 DTO 512 KiB 제한이 아니며 기존 문서의 전체 DTO 상한 설명을 정정한다.
memo 20,000자·직접 입력 4,000자·키/배열/이력 개수 등 이전 제안값은 근거와 호환성을 PHASE 2.6에서 재검토할 후속 서버 계약 후보이며 이번 DB에 강제하지 않는다.
고객명 40자·프로젝트명 80자·평수 숫자 4자리·예산 범위는 기존 정규화 규칙이고 날짜/금액 상세 검증은 후속 서버 책임이다.
DB는 빈 이름·선택 필드 누락·빈 선택을 새로 금지하지 않는다. 전체 과거 직접 입력의 크기 분포는 확인 불가다.
초과 원본은 보존하고 업로드를 막아 안내하며 자르지 않는다. 알려지지 않은 project_info 키는 이번 DB CHECK가 금지하지 않으며 후속 서버에서 다룬다.
schema_version은 payload 버전이다. envelopeVersion·DB Migration timestamp·revision과 혼동하지 않는다.

## 5. URL과 상담서 편집 계약

내부 이동: /design?projectId=<uuid>, /result?projectId=<uuid> 형태를 채택한다.
활성 프로젝트 ID만 없는 legacy /result 진입은 기존 기본 키를 읽는 호환 경로를 유지한다. 새 링크에는 plan·specialNotes·이름·메모를 넣지 않는다.
로컬 ID가 있으면 로컬에서 먼저 표시하고 서버 여부 확인은 비동기로 한다. 다른 사용자의 ID를 받으면 RLS 실패 후 접근 불가로 처리한다.
프로젝트 UUID 링크는 외부 공유 권한을 제공하지 않는다.

기존 plan 링크 전환: 자동 prefetch를 중지할 대상 링크를 구현 시 확인 → 최초 클라이언트 진입에서 원문을 메모리에 캡처하고
민감 query를 replaceState로 제거 → 크기/형식/버전 검증 → 독립 로컬 자료로 가져오기 선택 → 새 UUID 연결.
기본 프로젝트와 선택이 같다고 고객명·예산·메모를 붙이지 않는다. URL에 없는 프로젝트 정보는 없다고 표시한다.
plan 링크에 내포된 전용 버전이 없어 명확한 미래 버전 판별은 불가능하다. 지원되는 legacy 선택 맵으로만 제한한다.
query 삭제 전에 전체 URL이 호스팅·브라우저 기록에 전달됐을 수 있다. 이미 남은 기록을 소급 제거한다고 약속하지 않는다.
전환 배포 시 referrer 정책·URL 로그/분석 마스킹·중복 인코딩·긴 URL·Next Link prefetch를 함께 검증한다.

외부 공유: /share#<무작위 토큰> 형태를 제안한다. 토큰은 브라우저가 검증 API에 전달하며 서버에는 hash만 저장한다.
토큰은 개인정보 원문이 아니지만 접근 비밀이므로 로그·분석·referrer에 남기지 않는다. 만료·취소·조회 횟수 제한을 검증한다.
project_shares는 별도 후속 Migration. 공유는 특정 revision의 검증된 읽기 전용 snapshot으로 고정한다.
이름·예산·메모 포함 범위를 발급자가 선택하고 preview한다. 원본 프로젝트 UPDATE 권한은 전혀 부여하지 않는다.
기존 rows/summary/format 함수는 DTO를 받아 재사용하며 공유 화면에서 localStorage 메타데이터를 섞지 않는다.
‘내 프로젝트로 복제’는 별도 동의와 새 UUID로만 허용한다. 공유 토큰으로 소유자 UID를 변경하지 않는다.

| 사용자 동작 | 동작 계약 |
|---|---|
| 현재 프로젝트 선택 수정 | 같은 projectId로 Builder 이동. 메모/정보/숨겨진 선택 유지 |
| 다른 프로젝트 불러오기 | 현재 dirty 데이터를 보존한 뒤 activeProjectId 변경. 다른 프로젝트 payload를 덮어쓰지 않음 |
| 기존 작업 교체 | 대상 이름·범위를 보여주고 확인. 교체 전 로컬 snapshot 보존, 서버 소유권/ID는 바꾸지 않음 |
| 새 프로젝트로 복제 | 새 UUID, 서버 revision 초기화, 출처는 로컬 메타데이터. 공유 자료는 허용된 공개 snapshot만 복제 |

## 6. 자동저장·낙관적 동시성 제어

화면 입력은 즉시 React에 반영한다. 현재 UI에 네트워크 대기·로그인 장벽을 추가하지 않는다.
로컬 저장 성공과 서버 저장 성공을 구분한다. 로컬 실패 시 ‘저장됨’으로 표시하지 않는다.
사용자 UID + projectId마다 단일 업로드 큐를 두고, 빠른 변경은 미전송 최신 snapshot으로 합친다.
진행 중인 요청은 고정 generation을 유지한다. 전송 완료 응답은 해당 generation만 확인하며 더 최신 draft를 지우지 않는다.
로컬 트랜잭션에서 generation compare-and-swap으로 여러 탭의 오래된 snapshot 저장도 거부한다.
BroadcastChannel은 알림용이며 정확성은 IndexedDB 트랜잭션과 서버 CAS로 보장한다. Web Locks는 선택적 최적화다.

서버 수정은 한 SQL UPDATE에서 id=projectId AND revision=expectedRevision 조건을 걸고 사용자 JWT로 실행한다.
owner RLS와 WITH CHECK는 유지한다. 트리거가 revision을 old+1로 증가시키며 RETURNING 행으로 새 revision을 확인한다.
클라이언트 SELECT 후 조건 없는 UPDATE는 금지한다. 서로 다른 탭의 같은 revision 수정 중 하나만 성공해야 한다.
반환 0행이면 충돌·삭제·접근 권한 소실 가능성으로 멈추고 로컬 draft를 보존한다. 일반 고객에게 타인 존재 여부는 노출하지 않는다.
응답 유실 시 서버를 다시 읽는다. 전송 당시 base revision, payload와 현재 서버를 비교해 확실한 경우만 확인 처리한다.
판단 불가면 conflict로 멈춘다. 새 expectedRevision으로 자동 재전송하지 않는다. 별도 mutation ID 컬럼은 현재 필수 아님.

충돌 UI는 로컬 draft·마지막 서버 확인본·최신 서버본을 구분하여 보여주고, 기본 선택은 로컬 보존이다.
사용자는 서버본 불러오기 / 내 초안을 새 프로젝트로 복제 / 비교 후 명시적 재저장을 고를 수 있다.
재저장은 최신 revision을 새 기준으로 다시 CAS한다. 무조건 자동 병합이나 last-write-wins는 사용하지 않는다.
오프라인은 로컬 outbox에 유지한다. 삭제는 tombstone을 먼저 기록하고 pending upload를 취소해 서버 삭제 후 재생성을 막는다.

## 7. Anonymous Auth·소유권

Builder 사용 시작에는 계정을 만들지 않는다. 사용자가 첫 서버 저장을 선택할 때 기존 세션을 확인하고,
세션이 없으면 Anonymous Auth를 생성한다. 동시에 여러 익명 UID를 만들지 않도록 인증 초기화도 단일 처리한다.
공개 키 + 실제 사용자 JWT로 저장하며 Secret Key/service_role을 브라우저·테스트에 사용하지 않는다.
RLS의 owner=auth.uid()가 최종 검증이다. ownerBinding은 UX와 잘못된 재시도를 막는 표식일 뿐이다.
일시적 access token 만료는 기존 세션 갱신을 먼저 시도한다. 갱신 불가 시 큐를 멈추고 로컬을 보존한다.
새 익명 UID를 발급해 기존 프로젝트 소유자로 자동 간주하지 않는다.
다른 계정으로 바뀌면 이전 owner 큐·서버 응답 적용을 중단한다. 이전 계정 자료는 잠근 상태로 구분하며 다른 계정으로 자동 업로드하지 않는다.
동의 없는 귀속을 막기 위해 인증 변경 이벤트와 요청 전/응답 후 UID를 확인한다.
다른 계정으로 복사하려면 접근 가능한 로컬 자료에 대해 사용자가 명시적으로 새 프로젝트 복제를 선택해야 한다.
이는 서버 소유권 이전이 아니다. 로컬 복사본 소지자의 실제 법적 소유권은 코드로 확인할 수 없으며 공용 기기 안내가 필요하다.
익명 계정을 일반 계정으로 전환할 경우 UID가 유지되는 지원 흐름을 별도로 검증한다. 기존 다른 UID 계정과의 병합은 자동 처리하지 않는다.
브라우저 데이터/세션을 지우거나 다른 기기로 이동하면 익명 계정 복구가 불가능할 수 있음을 첫 서버 저장 전에 알린다.
복구를 원하면 지원되는 계정 연결 또는 로컬 내보내기를 제공한다. 가입은 Builder 사용 필수가 아니다.
업체 권한은 별도 approved business_members + approved businesses + 비익명 여부로 판단한다.
공식 근거: https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins

## 8. 초기화·삭제 확정 정책

| 동작 | 범위·확인 |
|---|---|
| 현재 선택 초기화 | 선택/이미지 순서/선택 fingerprint checks/진행 위치만 초기화. 이름·메모·특이사항은 유지한다고 안내. 변경 전 snapshot 보존 |
| 특정 로컬 프로젝트 삭제 | 해당 UUID의 draft·원본 매핑·outbox 제거 여부 확인. 동기화 중단 후 실행. 서버는 유지 |
| 모든 로컬 프로젝트 삭제 | legacy 두 키 계열·IndexedDB 자료·복구 snapshot 전체 범위 표시 후 확인. 다른 앱 key는 삭제하지 않음 |
| 서버 프로젝트 삭제 | 본인 세션으로 ID+기대 revision 조건 DELETE. 0행/오프라인이면 미완료로 표시. 로컬은 기본 보존 |
| 업체 접수 후 삭제 | 원본 프로젝트 삭제가 업체 접수 snapshot을 무조건 지우지 않음. 후속 접수 보존·동의·삭제 요청 정책 확정 전 기능 미출시 |
| 익명 계정 삭제 | 프로젝트 목록/영향 확인 → 명시적 프로젝트 삭제 또는 내보내기 → 별도 신뢰된 서버 절차로 Auth 계정 삭제 |

현재 SQL의 cascade 범위: auth.users 삭제 → projects와 business_members 삭제;
businesses 삭제 → business_members 삭제. projects 삭제는 현재 다른 public 테이블로 cascade되지 않는다.
PHASE 2.5.1 사용자 결정: projects.owner_user_id FK의 ON DELETE CASCADE를 유지한다. RESTRICT/SET NULL로 바꾸지 않는다.
business_members의 두 FK cascade도 유지하며 계정 삭제가 업체 자체를 삭제하지 않는다.
계정 삭제/개인정보 삭제 기능은 프로젝트와 멤버십의 연쇄 삭제 범위를 안내하고 명시적 확인·내보내기 선택·테스트를 제공한다.
자동 익명 계정 정리도 프로젝트 삭제 영향을 확인한 뒤 운영한다. 이 결정이 실제 계정 삭제를 승인하는 것은 아니다.
향후 project_shares는 원본 삭제 시 즉시 무효화한다. business_submissions의 snapshot 보존/FK는 후속 설계에서 분리한다.

## 9. PHASE 2 교차 검증과 Migration 변경 제안

| 항목 | 판정 | 이유·조치 |
|---|---|---|
| Project UUID | 1. 현재 Migration으로 충분 | id UUID PK, 명시적 UUID INSERT 허용. 로컬 선발급 ID 사용 |
| 가져오기 식별자 | 2. 애플리케이션 코드에서 처리 가능 | 트랜잭션 원본→UUID 매핑 + 같은 PK 재시도. 선택 hash로 중복 판단 금지 |
| schema_version | 1. 현재 Migration으로 충분 | 현재 v3만 서버 저장. 미래 버전은 업로드 금지, 차기 지원 시 새 Migration |
| revision | 1. 현재 Migration으로 충분 | 기존 increment 트리거 + 조건부 원자 UPDATE. 어댑터·실제 경합 테스트 필요 |
| consultation_memo | 1. 현재 Migration으로 충분 | memo 매핑 유지. 공통 타입/크기 검증은 아래 추가 |
| special_notes | 1. 현재 Migration으로 충분 | specialNotes 매핑, 기존 500자 유지 |
| image_history_order | 1. 현재 Migration으로 충분 | URL 아닌 group:option 문자열 배열. 복원 어댑터 필요 |
| builder_mode | 1. 현재 Migration으로 충분 | consumer/professional, project_info.builderMode와 함께 저장 |
| 프로젝트 소유자 | 2. 애플리케이션 코드에서 처리 가능 | 세션 UID 바인딩·이전 확인. RLS는 현재 구조 유지 |
| 삭제 정책 | 1. 현재 Migration으로 충분 | 기존 CASCADE 유지로 확정. 영향 안내·운영 테스트는 후속 |
| 서버 입력 검증 | 3. Migration 파일 보완 완료, DB 미적용 | 알려진 project_info 타입/기본 enum, selections string|string[], 컬럼별 byte 상한 |
| 자동 RLS/권한/트리거 실제 실행 | 4. 추가 검증 필요 | PHASE 2.5 정의 검토 완료, 실제 적용 테스트 미실행 |

PHASE 2.5.1 반영 범위:
1. FK·ON DELETE CASCADE·RLS·GRANT·트리거는 변경하지 않았다.
2. projects의 알려진 project_info 타입/기본 enum 및 컬럼별 UTF-8 크기 CHECK 추가.
   builderMode는 필수, 그 외 기존 필드는 누락 허용. nullable 정보만 JSON null 허용. 최소 DEFAULT·빈 이름 허용.
3. selections는 모든 값 string|string[]를 강제하며 빈 문자열/배열·숨겨진 값·미래 Option ID를 허용.
   SQL NULL은 NOT NULL, JSON null과 잘못된 값은 타입 CHECK로 거부. IS TRUE·strict JSONPath로 UNKNOWN/중첩 배열 우회 방지.
4. consultation_checks와 image_history_order는 용도를 확인했지만 이번 범위에서는 기존 NOT NULL·루트 CHECK만 유지.
5. 신규 함수/컬럼/View·Option ID allowlist·필드별 업무 길이·날짜/금액 범위 검증은 추가하지 않았다.
   상세 서버 계약은 후속 Next.js 구현에서 명시한다. 서버가 직접 REST 접근을 제거했다고 가정하지 않는다.

원격 적용 이력이 없으므로 향후 승인 후 기존 미적용 Migration 수정은 가능하나 이번에는 금지다.
첫 적용 이후에는 이미 적용한 파일을 고치지 않고 새 Migration을 작성한다.
기존 테스트의 최소 project_info DEFAULT와 빈 정보는 이번 CHECK에서도 유효하다. RLS 테스트/fixture는 수정하지 않았다.

## 10. 구현 순서와 수용 테스트

예정 모듈명은 제안이며 아직 존재하지 않는다: project-contract, project-repository, legacy-import,
project-sync, project-auth. 공통 DTO·검증·버전 변환을 먼저 만들고 Configurator와 /result에서 동일 repository를 사용한다.

순서: (1) 계약/원본 보존/테스트 fixture → (2) JSONB CHECK 통합 검증과 RLS 테스트 안전장치 수정 →
(3) 격리 개발 DB Migration/권한 검증 → (4) UUID 로컬 repository와 기존 자료 가져오기 →
(5) URL/상담서 편집 전환 → (6) 익명 인증·CAS outbox → (7) 공유·접수 별도 단계.
문서 승인과 DB 적용 승인은 별개다. 로컬-only Builder를 유지하면서 단계별 feature switch로 연결한다.

| 테스트 | 대상·수용 기준 |
|---|---|
| 동일 선택의 다른 프로젝트 | legacy-import: 기본/상담서 각각 다른 UUID, 메모·정보 교차 혼합 0건 |
| 기존 기본 프로젝트 복원 | repository: v3 모든 필드·null·배열 순서 일치 |
| 상담서만 존재/둘 다 존재 | legacy-import: 모든 key 목록화, 선택한 자료만 업로드 |
| 손상/저장 공간 실패 | repository: 원본 불변, 유효 항목 별도 복원, 네트워크 요청 0건 |
| 이전 응답 유실/종료/재접속 | sync: 같은 UUID 조회·재시도, 원본 보존, 프로젝트 중복 0건 |
| 두 탭 동시 최초 이전 | IndexedDB 실제 브라우저 테스트: source unique로 한 UUID만 확정 |
| 미래 버전/알 수 없는 필드 | contract: 쓰기·업로드 중단, 원본 보존, 명시적 안내 |
| URL 민감 데이터 제거 | browser: 새 Link href와 네트워크/prefetch에 plan·메모·특이사항 없음; legacy 링크 호환과 query 정리 |
| 상담서 수정/불러오기/복제 | browser: 비대상 프로젝트 불변, 복제만 새 UUID |
| 요청 순서·다중 탭 충돌 | sync + 실제 사용자 JWT: 동일 revision 2개 UPDATE 중 1개 성공, 다른 초안 보존 |
| 만료·다른 UID·익명 변경 | auth + RLS: 이전 큐 중단, 자동 소유권 이전/다른 계정 업로드 0건 |
| Consumer/Professional 양방향 | builder-mode: ceilingPreference와 Professional 필드 모두 보존 |
| 이미지/상담서 동일성 | history/consultation: ID·이력 순서·메모·날짜·예산·출력 비교, 의도된 빈 Preview 유지 |
| 입력 검증 우회 | REST JWT: 잘못된 project_info/selections 타입·총량 초과 서버 거부. DEFAULT/빈 정보는 DB 허용; 업무 검증은 후속 서버 |
| 삭제/재시도/계정 삭제 | RLS: owner만 삭제, tombstone 자동 재생성 방지, Auth 삭제 시 해당 projects/members cascade 범위·사전 안내 확인 |

실행 방식: 순수 변환·큐는 node:test로 네트워크 없이, 화면/IndexedDB는 기존 브라우저 테스트 방식에 맞춰 별도 작성,
RLS/CAS는 전용 개발 프로젝트의 실제 사용자 세션으로 실행한다. 새 테스트 파일/패키지는 이번에 만들지 않는다.
기존 tests/builder-mode.cjs, project-info.cjs, consultation-enhancements.cjs는 회귀 기준으로 유지한다.
PHASE 2.5의 fixture 대상 확인·예상 밖 INSERT 성공 후 잔존 데이터 정리·PASS 출력 시점·401 만료 오판 방지도 먼저 보완한다.
확인하지 않은 실제 브라우저·IndexedDB 용량·Auth 설정·DB CHECK 실행 결과를 통과로 보고하지 않는다.

## 11. 적용 전 관문과 최종 판정

PHASE 1.6 당시 판정은 Migration 일부 변경 필요였으며 PHASE 2.5.1에서 FK 제안은 철회하고 JSONB 최소 검증을 SQL 파일에 반영했다.
PHASE 3 DB 적용 전 필수: JSONB CHECK 통합 검토, RLS 테스트 정리/대상 확인 안전장치 보완,
실행 CLI/이력/트랜잭션 확인, 개발 프로젝트 대상 재확인, 격리 환경 정적/실행 검증 계획 확정.
실제 사용자 연동 배포 전 필수: UUID repository·원본 보존·지원 버전 게이트·동의 선택·UID 바인딩·CAS·URL 전환 구현과 수용 테스트.
공유·업체 접수·계정 병합은 후속 기능이며 이번 단계가 완료됐다는 이유로 활성화하지 않는다.
PHASE 1.6은 문서 작업만 수행했고 PHASE 2.5.1은 허용된 SQL CHECK와 문서만 수정했다. Supabase DB 적용·앱 구현은 별도 승인까지 진행하지 않는다.
