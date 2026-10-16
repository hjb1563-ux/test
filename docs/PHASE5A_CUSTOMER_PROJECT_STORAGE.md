# PHASE 5A 고객 프로젝트 저장 준비

## 범위와 기본 상태

기존 UI/Configurator/result/localStorage 코드는 변경하지 않았다. 신규 모듈은 아직 어디에도 연결하지 않았으며 CUSTOMER_CLOUD_SAVE_ENABLED=false이다. Controller와 Data API 어댑터 각각 enabled가 명시적으로 true여야 호출한다. 기본 상태에서는 원격 읽기/쓰기나 Auth 생성이 없다. 실제 fetch나 인증 공급자도 주입하지 않았다. 기존 보호된 테스트 credentials 파일을 프론트엔드에 연결하지 않는다.

## 기존 상태 분석

Configurator의 React 상태는 projectInfo, values, specialNotes, current, imageHistoryOrder를 보유한다. hydration 후 readProject로 복원하고 기존 useEffect가 localStorage `bath-designer-selections-v2`에 저장한다. memo/checks는 상담 결과 페이지가 관리하며 Configurator는 readProject 결과를 병합하여 보존한다. lastModifiedAt은 내용 변경에만 갱신되고 navigation/check/history 변화에는 자동 변경되지 않는다.

LocalProject.version=3. 고객 13개/전문가 15개 화면은 같은 카탈로그의 stable stepIndex를 사용하고 checklist는 화면에서 제외한다. current는 표시 순번이 아니라 원래 인덱스다. 전문가와 고객의 로컬 저장 키는 공유되고 builderMode로 구분된다. 신규 고객 어댑터는 professional 데이터를 거부하며 암묵적으로 consumer로 바꾸지 않는다.

선택 취소는 기존 toggleSelection 및 이미지 기록 정규화로 반영된다. 뒤로 가기는 기존 stable step 이동이며 새로고침은 localStorage 복원이다. sectionPosition/열린 UI/preview/visitedSections는 화면용 상태로 서버 저장 대상이 아니다. 기존 초기화는 확인 후 기존 저장 키를 삭제하고 화면 상태를 리셋한다. 이번 작업은 초기화를 실행하거나 바꾸지 않았다. 향후 연결 시 초기화가 원격 DELETE를 유발하지 않도록 새 프로젝트 UUID/큐 세대를 발급해야 한다.

## 정확한 스키마 매핑

| LocalProject / 별도 동기화 상태 | public.projects |
|---|---|
| 실제 세션 userId | owner_user_id (INSERT만) |
| 별도 생성·영속 보관할 프로젝트 UUID | id (INSERT만) |
| projectInfo | project_info |
| projectInfo.builderMode | builder_mode |
| values (문자열 또는 문자열 배열) | selections |
| memo | consultation_memo |
| specialNotes | special_notes |
| current (원래 stepIndex) | current_step |
| checks (선택 fingerprint 문자열) | consultation_checks |
| imageHistoryOrder (그룹:선택ID 문자열 배열) | image_history_order |
| lastModifiedAt | content_modified_at |
| version=3 | schema_version=3 |
| 별도 서버 버전 문자열 | revision |

created_at/updated_at/revision은 DB 관리 필드로 전송 본문에서 제외한다. UPDATE는 owner_user_id/id도 제외한다. 현재 Migration의 memo 65536자, 특이사항 500자, info/checks/history 64KiB, selections 512KiB, current 0..15 제한을 반영했다. JSONB 크기는 UTF-8 및 구분자 공백을 보수적으로 계산하여 서버보다 일부 엄격할 수 있다. 제한 초과 시 자르거나 기존 데이터를 수정하지 않고 동기화를 중단한다. 서버 CHECK가 최종 기준이다.

기존 normalizeProject로 legacy를 v3로 복원하되 original 원문을 함께 반환한다. legacy의 누락 모드/오래된 current/선택 정규화는 기존 규칙을 그대로 따른다. 이 정규화는 알 수 없는 선택을 제거할 수 있으므로 모든 legacy의 의미상 무손실 변환을 보장하지 않는다. 원문 백업으로 복구한다. 유효한 v3의 서버 왕복은 모든 매핑 필드와 이미지 순서를 보존한다.

## 인증과 클라이언트

향후 승인 후 publishable key와 사용자 실제 JWT만 Data API에 보낸다. Secret/Management Token은 금지하며 어댑터 설정은 sb_publishable 형식과 개발 프로젝트 URL만 허용한다. 일반 고객은 로그인 UI 없이 signInAnonymously로 시작할 수 있지만 이번에는 생성 코드를 연결하지 않았다.

주입할 session 공급자는 SDK의 세션 갱신과 실제 getUser 검증을 수행해야 한다. 기존 세션이 만료되면 동일 사용자 세션을 갱신하고, 실패 시 큐를 차단한다. 자동 새 사용자 생성으로 기존 프로젝트 소유자를 대체하지 않는다. 첫 UID에 바인딩된 controller는 다른 UID를 거부한다. 새로고침 후에도 프로젝트 UUID/owner/revision 바인딩을 별도 보관하고 서버 GET 검증 후 재개해야 한다.

익명 사용자가 로그아웃하거나 브라우저 데이터를 지우거나 기기를 바꾸면 같은 계정을 복구하지 못할 수 있다. 로컬 백업은 내용을 복구할 뿐 기존 서버 소유권을 복구하지 않는다. 필요시 다음 단계에서 이메일 연결을 설계한다. 근거: [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous).

## 저장·복원·실패 처리

첫 요청 전 기존 localStorage 원문을 `<기존키>:cloud-backup:<프로젝트UUID>`에 별도 보관하고 다시 읽어 확인한다. backup 실패면 원격 요청도 중단한다. 기존 키에 쓰거나 삭제하지 않는다. localStorage는 암호화된 보관소가 아니므로 개인정보 최소화와 브라우저 접근 보안이 필요하다.

신규 프로젝트는 INSERT만 한다. UUID 중복이면 자동 upsert/덮어쓰기하지 않고 실패 처리한 뒤 소유권 조회 및 사용자 검토가 필요하다. 가져오기는 새 UUID로 시작한다. 기존 프로젝트는 서버 GET 결과를 반환하되 로컬에 자동 적용하지 않는다. 서버 null/빈 상태를 로컬 초안 위에 적용하지 않는다. 명시적으로 비교·검토한 서버 row만 resumeFromReviewedServer로 기준 revision을 설정한다.

저장은 각 시점의 snapshot을 직렬 큐로 처리한다. UPDATE는 id/owner/revision을 모두 조건으로 사용하고 0행이면 충돌로 차단한다. 성공하면 DB revision+1을 확인한다. 네트워크/인증/서버 실패 또는 결과가 불명확하면 blocked이며 이후 대기 요청도 중단한다. 최신 pendingDraft와 기존 로컬/백업은 남는다. 자동 덮어쓰기/무한 재시도는 없다. 다시 GET하여 서버 상태를 비교한 후 명시적 검토·재개가 필요하다. 서버가 커밋한 뒤 응답만 유실될 수도 있으므로 INSERT 재시도나 revision 재사용을 자동 처리하지 않는다.

다중 탭/기기 충돌은 서버 revision 조건으로 감지한다. 실제 연결 단계에서는 debounce, 탭 간 통지, 새로고침 후 revision 바인딩 저장, 저장 중 reset 세대 전환 및 복원 비교 UI가 추가로 필요하다. 이번 모듈은 그 실행 준비용이며 자동저장을 활성화한 제품 기능은 아니다.

## 검증 및 다음 승인

오프라인 실행: `node --test tests/customer-project-sync.cjs`. 기존 회귀: `node tests/project-info.cjs`, `node tests/builder-mode.cjs`. 타입: `npx.cmd --no-install tsc --noEmit --incremental false`.

실제 활성화 전 승인 항목: SDK/세션 공급자 연결, publishable 환경변수 등록(관리자 자격증명 제외), 별도 UUID/owner/revision 메타데이터 저장, 복원 충돌 선택 흐름, 테스트 전용 Anonymous 생성과 프로젝트 CRUD 검증. 인증 과다 생성 방지/CAPTCHA·요청 제한과 Data API 직접 접근에 대한 서버 CHECK/RLS도 유지한다. 클라이언트 입력 검사만 보안 경계로 삼지 않는다. 적용된 DB 스키마는 이 단계에서 다시 변경하거나 조회하지 않았으며 기존 검증된 Migration을 매핑 기준으로 사용했다.
