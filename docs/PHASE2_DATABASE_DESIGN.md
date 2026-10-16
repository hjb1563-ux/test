# Phase 2 — 오프라인 DB / RLS 설계

> PHASE 3B 적용 전 최종 보완: consultation_memo 65,536자, consultation_checks 및
> image_history_order 각 65,536 UTF-8 bytes, 이미지 순서 문자열 원소 CHECK를 추가했다.
> [최종 SQL 검토·서버 저장 계약·39개 읽기 전용 검증](PHASE3B_SQL_REVIEW.md)을 우선 참조한다.
> 아래 과거 단계의 도구 설치/테스트 준비 상태는 당시 기록이며 현재 상태가 아니다.

> PHASE 2.5.1 보완: 사용자 결정으로 모든 기존 ON DELETE CASCADE를 유지한다. PHASE 1.6의 RESTRICT 제안은 철회됐다.
> project_info/selections의 타입·크기 CHECK는 Migration 파일에 반영했으며 실제 DB에는 적용하지 않았다.
> 저장·이전·버전·삭제·수용 기준의 상세 계약은 [PHASE1_5_GAP_RESOLUTION.md](PHASE1_5_GAP_RESOLUTION.md)를 따른다.

원격 DB 변경, Migration 적용, 사용자 생성, 테스트 데이터 입력을 실행하지 않았다.
대상은 bath-designer-dev (`istsrambmbzuemkgutgh`, Seoul)이며 적용 전 프로젝트명/리전/연결 대상을 다시 확인한다.

## 기존 코드 분석

별도 Phase 1 보고서는 발견되지 않아 다음 코드를 직접 확인했다.
- `data/bathroom-consultation.ts`: STORAGE, LocalProject, normalizeProject, updateProjectContent, 상담서 생성.
- `data/bathroom-selection.ts`: Record<string, string | string[]> 선택값과 `${groupKey}Other` 사용자 입력.
- `data/bathroom-builder-options.ts`, `data/bathroom-builder-mode.ts`: 공통 카탈로그 ID와 표시 필터.
- `components/Configurator.tsx`, `components/ProjectInfoForm.tsx`: 프로젝트 정보 생성/수정, 자동 저장, 초기화.
- `tests/builder-mode.cjs`: Consumer 13 / Professional 15, 숨겨진 값/이미지 순서 보존.

현재 기본 작업 프로젝트는 `bath-designer-selections-v2` 키에 version 3으로 저장한다.
이와 별도로 `/result`는 URL 선택값이 기본 프로젝트와 다를 때 `bath-designer-report-v1:${JSON.stringify(values)}` 계열에서 상담서 정보·메모를 읽고 쓴다.
따라서 브라우저 전체를 ‘단일 프로젝트 저장’이라고 설명하면 부정확하다. 현재 두 저장 계열 모두 UUID/사용자 ID는 없다.
`/result`는 선택값이 같으면 기본 프로젝트의 정보와 메모를 결합하고, edit()은 현재 상담서를 기본 작업 키에 복사한다.
동일한 선택값의 다른 프로젝트를 구분하지 못할 수 있으므로 향후 선택값 비교를 프로젝트 식별로 사용하지 않는다.
채택 설계는 로컬에서 UUID를 먼저 발급·트랜잭션 저장하고 서버 projects.id에도 같은 값을 명시하는 방식이다.
서버 저장을 사용자가 선택한 뒤 인증 UID에 연결한다. UUID는 권한 증거가 아니며 owner는 실제 세션으로 검증한다.
로컬 키 이름 v2/상담서 키 v1과 payload version 3을 혼동하지 않는다.
모드 변경은 화면 필터이며 선택 ID를 변환하거나 제거하지 않는다. 체크리스트 legacy 카탈로그는 남아 있지만 화면에서는 제외된다.

| LocalProject | projects | 복원 |
|---|---|---|
| version | schema_version = 3 | version |
| projectInfo | project_info JSONB | projectInfo |
| projectInfo.builderMode | builder_mode | 두 필드를 같은 값으로 함께 저장 |
| values | selections JSONB | values |
| memo | consultation_memo | memo |
| specialNotes | special_notes | specialNotes |
| current | current_step | current |
| checks | consultation_checks | checks |
| imageHistoryOrder | image_history_order | imageHistoryOrder |
| lastModifiedAt | content_modified_at | lastModifiedAt |

projectInfo에는 customerName, projectName, propertyType, occupancyStatus, areaPyeong(문자열), constructionDate(nullable), budget(nullable 숫자), builderMode를 그대로 보존한다.
JSONB는 키 순서 대신 값과 배열 순서를 보존한다. 현재 DB에는 옵션 ID allowlist가 없어 원본 저장 단계에서 특정 ID를 제거하지 않는다.
그러나 현재 normalizeBathroomValues는 알 수 없는/제거된 ID를 걸러내며 normalizeProject는 알 수 없는 필드를 제외하고 version 3 결과를 만든다.
따라서 JSONB 저장 가능성이 프론트 복원 시 무손실을 보장하지 않는다. 기존 정규화 함수를 버전 판정 없이 서버 자료에 적용하지 않는다.
현재 SQL은 루트 형태·모드 일치에 더해 project_info의 알려진 필드 타입/기본 enum과 selections의 string|string[] 구조 및 두 컬럼의 UTF-8 크기를 검사한다.
알 수 없는 필드·미래 버전은 로컬 원본을 보존하고 자동 덮어쓰기/업로드를 차단한다. 미검증 임의 JSON을 서버로 그대로 이전하지 않는다.
상담서는 원본 값으로 다시 생성하며 표시용 문장/이미지 URL을 DB 선택 ID로 사용하지 않는다.
이미지 순서와 current/checks까지 저장해야 기존 상태를 복원할 수 있다.
content_modified_at은 기존 콘텐츠 수정 시각, updated_at은 모든 DB UPDATE 시각이다.
revision은 DB가 증가시키며 향후 `id = ... AND revision = expected` UPDATE의 반환 행 1개를 확인해야 동시 수정 손실을 방지한다.
비교와 수정은 한 UPDATE 안에서 원자적으로 실행한다. 0행·응답 유실·삭제·권한 소실은 로컬 초안을 보존한 채 충돌 처리하고 최신 revision으로 무조건 재시도하지 않는다.
동일 UUID 최초 INSERT 재시도는 PK로 중복을 막는다. 로컬 원본→UUID 매핑과 업로드 큐를 먼저 트랜잭션 저장해야 중단 후에도 같은 ID를 재사용할 수 있다.
브라우저 자료를 삭제해 이 매핑을 잃었을 때의 자동 중복 방지는 보장하지 않는다. 서버 목록과 사용자 확인으로 재연결한다.
현재 프론트엔드 저장/복원 어댑터는 구현하거나 변경하지 않았다.

## PHASE 1.6 확정 설계와 현재 Migration 차이

| 항목 | 판정 | 채택 방침 |
|---|---|---|
| Project UUID | 현재 Migration으로 충분 | 로컬 선발급 UUID를 projects.id에 사용 |
| 로컬 가져오기 식별 | 애플리케이션 코드에서 처리 가능 | IndexedDB 원본 key→UUID 매핑·outbox 원자 저장. 별도 import 컬럼은 필수 아님 |
| schema_version | 현재 Migration으로 충분 | v3만 서버 저장, 미래 버전은 원본 보존·업로드 금지 |
| revision | 현재 Migration으로 충분 | UID별 프로젝트 큐 + 조건부 UPDATE + 충돌 안내 |
| consultation_memo | 현재 Migration으로 충분 | LocalProject.memo를 매핑 |
| special_notes | 현재 Migration으로 충분 | LocalProject.specialNotes, 기존 500자 제한 유지 |
| image_history_order | 현재 Migration으로 충분 | group:option ID 배열, 이미지 URL 저장 금지 |
| builder_mode | 현재 Migration으로 충분 | 두 모드 값과 project_info.builderMode 일치 |
| 프로젝트 소유자 | 애플리케이션 코드에서 처리 가능 | 첫 서버 저장 확인 후 UID 바인딩. 계정 전환 자동 귀속 금지 |
| 삭제 정책 | 현재 Migration으로 충분 | 사용자 결정으로 기존 CASCADE 유지. 계정 삭제 영향 안내·운영 테스트는 후속 |
| nested 입력 검증 | Migration 파일 보완 완료 | project_info 알려진 필드 타입·selections 값 타입·컬럼별 크기. DB 적용은 미실행 |
| 실제 DB 실행·Auth 연결 | 추가 검증 필요 | 아직 적용·세션 테스트하지 않음 |

현재 SQL은 Auth 사용자 삭제 시 해당 projects와 business_members를 함께 삭제한다.
업체 삭제는 business_members만 함께 삭제한다. 기존 FK·CASCADE 동작을 변경하지 않았다.
계정 삭제/개인정보 삭제 기능은 프로젝트와 멤버십이 함께 삭제됨을 사전에 안내하고 확인·내보내기 선택·전용 계정 테스트를 제공해야 한다.
현재 DB는 계정 삭제를 RESTRICT로 막지 않는다. 자동 익명 계정 정리도 관련 프로젝트 삭제 영향을 검토한 뒤 운영한다.
고객명/프로젝트명 최소 하나 요구, 직접 입력 길이, 날짜/금액 범위, 키/Option ID allowlist는 후속 Next.js 서버 입력 검증 책임이다.
빈 이름·미선택·기존 최소 DEFAULT를 DB에서 새로 차단하지 않는다. 기존 RLS 테스트의 최소 INSERT도 이 변경만으로 막히지 않는다.
PHASE 2.5.1 당시 consultation_checks는 NOT NULL object, image_history_order는 NOT NULL array만 검사했다.
PHASE 3B에서 두 컬럼의 크기 제한과 이미지 배열 문자열 원소 검사를 추가했다. checks 값의 추가 타입/enum 검사는 이번 범위에 포함하지 않았다.

## PHASE 2.5.1 JSONB CHECK 계약 (SQL 파일 반영, DB 미적용)

| 컬럼 | 기존 상태 | 이번 추가 |
|---|---|---|
| project_info | NOT NULL, DEFAULT {builderMode:consumer}, object·모드 일치 | 아래 알려진 필드 타입·기본 enum, 65,536 bytes |
| selections | NOT NULL, DEFAULT {}, object | 모든 값이 string 또는 string[]인지, 524,288 bytes |
| consultation_checks | NOT NULL, DEFAULT {}, object | 변경 없음 |
| image_history_order | NOT NULL, DEFAULT [], array | 변경 없음 |

project_info: builderMode 문자열 필수, consumer/professional 및 별도 builder_mode와 일치.
customerName/projectName/areaPyeong은 존재하면 string이며 빈 문자열 허용. propertyType은 아파트/빌라/상가 또는 JSON null,
occupancyStatus는 살고 있다/이사갈 곳이다 또는 JSON null. constructionDate는 string 또는 JSON null, budget은 number 또는 JSON null.
builderMode 이외 키는 DEFAULT/부분 legacy 호환을 위해 누락 허용한다. 알려진 비-nullable 문자열 필드의 JSON null은 거부한다.
알 수 없는 project_info 키를 서버 검증 완료로 간주하지 않는다. 이번 DB CHECK는 키 allowlist를 강제하지 않는다.
selections는 빈 객체·빈 문자열·빈 배열·기타 직접 입력·양방향 모드의 숨겨진 값·향후 ID를 허용한다.
number/boolean/JSON null/object 값, 문자열 외 배열 원소 및 중첩 배열은 거부한다. Option ID는 하드코딩하지 않는다.

NULL: 네 JSONB 컬럼의 SQL NULL은 기존 NOT NULL이 거부한다. JSON null 루트는 기존 타입 검사로 거부한다.
추가 타입 CHECK는 IS TRUE로 UNKNOWN 통과를 막으며 selections는 CASE로 object일 때만 strict JSONPath를 평가한다.
strict 모드가 배열 자동 펼침을 막아 [["id"]]를 ["id"]처럼 인정하지 않는다. 신규 함수·View·권한은 없다.

크기는 octet_length(convert_to(column::text,'UTF8'))로 측정한다. PostgreSQL JSONB 텍스트의 키·공백·구두점·이스케이프를 포함하며
TOAST 압축/저장 공간 크기나 HTTP Body·전체 DTO 크기가 아니다. 경계값은 이하(<=) 허용이다.
project_info의 정규 필드는 이름 40/80자·평수 4자리 등 작은 구조이므로 64 KiB에 넉넉한 여유가 있다.
selections는 현재 26개 그룹·89개 옵션과 string/string[]/직접 입력 구조이며 512 KiB를 총량 상한으로 잡아 추가 옵션·한글을 수용한다.
직접 입력에는 기존 프론트 최대 길이가 없어 모든 유효한 과거 데이터가 이 상한 이내라고 증명할 수는 없다.
이 수치는 실제 사용자 분포를 측정한 값이 아닌 방어적 제안/적용값이다. 초과 자료는 자동 절삭/원본 삭제 없이 이전 중단·안내한다.
한글 1글자가 대체로 UTF-8 3 bytes인 점을 반영한다. 컬럼별 크기 상한이므로 memo·전체 row 무제한 문제까지 해결하지 않는다.
크기 측정/값 순회는 입력 크기에 비례한다. CHECK는 JSON 파싱 후 실행되며 평가 순서는 보장하지 않으므로 후속 서버 Body 제한이 필요하다.
schema_version NOT NULL DEFAULT 3 CHECK (=3)은 그대로 유지한다. 이전 버전 변환·미래 payload 판별은 서버/클라이언트의 명시적 버전 게이트가 담당한다.

검증: 실제 Migration에서 추가 CHECK 식을 추출해 PostgreSQL 17.11의 읽기 전용 SELECT로 34개 타입/NULL/호환 사례와
6개 byte 경계/한글 사례를 평가했고 모두 예상과 일치했다. DDL·INSERT·UPDATE·Migration 적용·RLS 테스트는 실행하지 않았다.
첫 SELECT 검증 harness에서 builder_mode 컬럼을 빠뜨려 42703 오류가 있었으며 harness 수정 후 재검증했다. Migration SQL 오류로 확인된 것은 아니다.
이 검사는 CHECK 식의 구문·계산 검증이며 CREATE TABLE 전체와 트리거·GRANT의 실제 실행 성공을 의미하지 않는다.
참고: https://www.postgresql.org/docs/17/functions-json.html

## 내부 이동·공유·삭제 범위

현재 consultationHref는 values 전체와 specialNotes를 query로 보내며, 숨겨진 선택값도 URL에 들어갈 수 있다.
향후 내부 이동은 projectId만 사용하고 공통 v3 DTO로 동일 상담서를 렌더링한다. 기존 무인자 /result는 기본 로컬 자료 읽기 호환 경로를 유지한다.
legacy plan URL은 독립 로컬 자료 가져오기로 전환하고 민감 query를 지운다. 이미 기록된 URL을 소급 삭제한다고 보장하지 않는다.
외부 공유는 후속 만료·취소 가능한 읽기 전용 snapshot 토큰으로 분리한다. UUID만으로 공개 조회 권한을 부여하지 않는다.
현재 reset은 기본 localStorage 키만 지우고 동적 상담서 키를 남긴다. 선택 초기화/로컬 개별 삭제/로컬 전체 삭제/서버 삭제/계정 삭제를 별도 동작으로 구현할 예정이다.
공유·업체 접수 snapshot의 보존/삭제는 후속 테이블 정책으로 구분하며 기존 원본 삭제와 무조건 연쇄 삭제하지 않는다.

## 권한 모델

- projects: authenticated의 본인 UID만 CRUD. Anonymous Auth도 본인 프로젝트 허용. signed-out anon은 불허.
- INSERT owner 위조는 WITH CHECK, UPDATE owner 변경은 컬럼 GRANT와 불변 트리거로 차단한다.
- id/created_at/revision/updated_at은 클라이언트 UPDATE 불가. revision/시각은 invoker 트리거가 관리한다.
- businesses: approved 업체 + approved 본인 멤버십 + 비익명 JWT만 SELECT.
- business_members: 비익명 사용자의 본인 approved 멤버십만 SELECT. 업체 동료 목록은 현재 미제공.
- suspended 업체의 상세는 차단된다. 본인의 approved 멤버십 행은 여전히 보일 수 있다. 이 행 자체를 업체 활성 권한으로 해석하면 안 된다.
- 업체/멤버십 INSERT/UPDATE/DELETE는 모든 클라이언트에서 차단한다. owner/admin 역할도 현재 읽기만 가능하다.
- 승인 운영은 추후 별도 신뢰된 관리자 절차로 구현한다. 로그인/사용자 metadata로 자동 승인하지 않는다.
- membership 정책이 businesses를 참조하지 않으므로 businesses → memberships 단방향이며 RLS 재귀가 없다.
- 추가 SECURITY DEFINER는 없다. 트리거 함수는 search_path='', SECURITY INVOKER, PUBLIC/anon/authenticated 직접 EXECUTE 회수.
- 테이블 PUBLIC/anon/authenticated 기존 권한을 회수하고 필요한 컬럼 권한만 다시 부여한다. authenticated schema USAGE 명시.
- public 전체의 기존 USAGE/CREATE나 default privileges는 다른 객체에 영향을 주므로 변경하지 않는다. 이 Migration이 만든 테이블의 anon 권한은 없다.
- UUID 기본값이므로 sequence 없음/GRANT 없음. service_role 신규 권한 부여 없음. DB 소유자/기존 bypassrls 운영자는 RLS 경계 밖이다.
- 세 테이블 RLS 활성화. 기존 자동 RLS 함수/이벤트 트리거는 교체하지 않는다.

## Migration 순서 및 반복 실행

`supabase/migrations/20261016000100_phase2_core.sql` 하나가 트랜잭션 안에서 테이블 → 인덱스 → 트리거 → RLS → GRANT 순으로 실행된다.
Supabase CLI가 설치되어 있지 않아 `supabase migration new`를 사용할 수 없었다. 패키지는 설치하지 않고 timestamp 파일을 오프라인 작성했다.
Migration history로 한 번만 적용한다. 직접 재실행하면 CREATE 충돌로 전체 롤백하도록 의도했다. IF NOT EXISTS로 불일치 스키마를 숨기지 않는다.
적용 도구의 트랜잭션 동작, 기존 이름 충돌, FK auth.users, 자동 RLS 이벤트 트리거와 default grants를 적용 전에 확인한다.
재수정은 적용 전 파일 검토 또는 적용 후 새 Migration으로 관리한다. 데이터 삭제 rollback SQL은 제공하지 않는다.

## 후속 초안 (현재 생성하지 않음)

- project_shares: id, project_id FK, created_by FK, token_hash UNIQUE, expires_at, revoked_at, created_at, revision/snapshot 기준. 원문 토큰 저장 금지. 사용자 직접 공개 SELECT 대신 제한된 서버 검증 경로로 만료/취소/노출 범위를 검증한다.
- business_submissions: id, project_id FK, business_id FK, submitted_by FK, submitted_revision, consultation_snapshot JSONB, status, created_at. 고객 본인 제출 + approved 업체 확인, 고객 본인/해당 업체 승인 회원 조회. 업체에 projects 전체 접근을 주지 않는다.
- 공유/접수의 동의, 제출 후 수정 가시성, 보존/삭제 정책, 토큰 검증 방식을 확정한 뒤 별도 Migration/RLS 테스트로 구현한다.
- PHASE 1.6에서 공유는 특정 revision의 읽기 전용 snapshot으로 선택했다. 원본 프로젝트 삭제 시 공유는 무효화하며, 업체 접수 snapshot 보존은 별도 정책 확정 전 출시하지 않는다.

## 향후 세션 테스트 실행 절차

현재 실행 금지. 개발 DB 적용 승인 후 별도로 진행한다.
1. 전용 고객 A/B, 업체 A/B, 미승인 사용자, Anonymous Auth 사용자 총 6명을 준비하고 각각 정상 로그인한다. 고객에게는 멤버십이 없어야 한다.
2. 승인된 운영자가 `supabase/tests/phase2-fixtures.sql`의 psql 변수를 채워 개발 DB에만 업체 A/B 및 멤버십 fixture를 준비한다. 해당 파일은 Migration 폴더 밖에 있다.
3. 환경변수 BATH_TEST_SUPABASE_URL, BATH_TEST_PUBLISHABLE_KEY, BATH_RLS_TEST_CONFIRM=bath-designer-dev 설정.
4. BATH_TEST_CUSTOMER_A_TOKEN, CUSTOMER_B_TOKEN, BUSINESS_A_TOKEN, BUSINESS_B_TOKEN, PENDING_TOKEN, ANONYMOUS_TOKEN (각각 BATH_TEST_ 접두사)에는 실제 access token을 환경으로 전달한다. 파일/커밋/로그에 저장하지 않는다.
5. BATH_TEST_BUSINESS_A_ID, BATH_TEST_BUSINESS_B_ID, BATH_TEST_MEMBER_A_ID는 fixture ID. `node supabase/tests/phase2-rls.mjs` 실행.
6. 스크립트는 auth/v1/user로 6명의 UID와 익명 여부를 확인하고 공개 키 + 각 사용자 Bearer 토큰으로 PostgREST를 호출한다. 관리자 Secret Key로 보안 테스트하지 않는다.
7. 필수 9개 시나리오 외 owner 본인 이전 차단, INSERT owner 위조, 업체 역할/승인 자가 변경, signed-out anon, Anonymous Auth 업체 접근 차단, 모드 변경 선택 보존, revision 증가도 확인한다.
8. 임시 프로젝트는 finally에서 고객 A 세션으로 삭제한다. fixture 업체/멤버십 및 Auth 테스트 계정은 운영자가 정확한 ID를 확인해 별도 정리한다. 중도 실패 시 임시 데이터가 남을 수 있다.

PHASE 2.5/1.6 보완 필요: 예상 밖 INSERT 성공 시 생성 행 전체 추적/정리, 테스트 전용 fixture·개발 대상 확인,
정리 이후 PASS 표시, 401 세션 만료와 정책 거부 구분. 이번 변경은 빈 이름·최소 project_info DEFAULT를 허용하므로 필수 이름 때문에 fixture를 변경할 필요는 없다.
이 보완이 끝나기 전 현재 테스트 스크립트를 준비 완료로 간주하지 않는다.

아직 미검증: PostgreSQL 실제 파싱/트리거 실행/권한 적용, PostgREST 컬럼 GRANT 동작, 프로젝트의 JWT is_anonymous claim, 자동 RLS 이벤트 트리거 상호작용, 실제 Security Advisor 재검사, RLS 세션 테스트.
CREATE TABLE 전체는 정적 검토만 수행했다. CHECK 식은 PHASE 2.5.1에서 위 읽기 전용 SELECT로 평가했다. psql/docker/Supabase CLI가 없어 로컬 DB 적용 검증은 실행하지 않았다.
Supabase changelog.md는 웹 도구 content-type 오류와 네트워크 제한으로 읽지 못했다. RLS 공식 문서는 조회했다: https://supabase.com/docs/guides/database/postgres/row-level-security
