# PHASE 4C-2 — Direct 네트워크 사전 검증

2026-10-16 / bath-designer-dev / istsrambmbzuemkgutgh.
범위: 로컬 네트워크 조회, 지정 개발 호스트의 비인증 TCP 검사, 코드/계획 분석.
원격 SQL, Auth 사용자 생성, Fixture, 키/비밀번호 조회, 환경/방화벽/SSL 변경 없음.

## 실제 관측

| 항목 | 결과 |
|---|---|
| Direct host | db.istsrambmbzuemkgutgh.supabase.co |
| DNS AAAA | 2406:da12:1f1:f800:1388:d532:aaa5:38fd |
| DNS A | ENODATA — IPv4 레코드 없음 |
| Windows 이더넷 IPv6 binding | Enabled=true |
| IPv6 주소 | link-local fe80::/64 및 loopback ::1만 관측, 전역 주소 없음 |
| IPv6 기본 경로 ::/0 | 0개 |
| Find-NetRoute 대상 IPv6 | 실패, Windows System Error 1231 |
| OS/Node hostname lookup | ENOTFOUND |
| 별도 DNS AAAA 질의 | 성공 |
| hostname:5432 TCP | ENOTFOUND |
| AAAA 주소:5432 TCP | ENETUNREACH |

DNS 레코드 자체는 존재한다. OS lookup 실패를 authoritative DNS 레코드 부재로 해석하지 않는다.
주소를 직접 지정해도 네트워크 도달 불가이며, IPv6 전역 주소/기본 경로가 없는 것이 확인된 차단 원인이다.
라우터/ISP/가상 네트워크 중 어디에서 IPv6를 제공하지 않는지는 이번 관측만으로 특정하지 않는다.
방화벽이 추가로 막는지, 원격 서비스가 도달 가능한지는 경로 확보 전에는 판단 불가다.
이는 인증 실패나 CA 오류가 아니다. PostgreSQL 인증/TLS 핸드셰이크까지 도달하지 않았다.

psql/CA는 기존 준비를 유지하되 이번에는 psql DB 접속과 SQL 조회를 실행하지 않았다.
따라서 Direct verify-full, pg_stat_ssl=true, BEGIN READ ONLY, Migration/RLS 상태는 이번 경로로 미검증이다.
외부 보호 pgpass.conf를 읽거나 복사하지 않았다. Direct 항목 존재 여부도 아직 조사하지 않았다.
네트워크가 준비되면 비밀번호를 제외한 4개 필드의 항목 존재 여부만 별도 검증한다.

필요한 Direct 항목 형식(사용자가 로컬에서만 입력):

```text
db.istsrambmbzuemkgutgh.supabase.co:5432:postgres:postgres:사용자가_직접_입력할_DB비밀번호
```

Session Pooler의 postgres.Ref와 Direct의 postgres를 혼동하지 않는다.
정확한 hostname으로 verify-full을 수행하며 DNS 우회로 인증서 검증을 끄지 않는다.
숫자 IPv6 연결은 이번 TCP 진단에만 사용했다.

## 대체 경로

| 방식 | 가능성과 비용 | TLS/Fixture 재사용 | 데이터 안전성/주의 |
|---|---|---|---|
| A. 신뢰할 수 있는 IPv6 실행 환경 | 현재 그런 환경은 확인/선정하지 않음. 이미 관리되는 환경이면 추가 인프라 비용 없이 가능할 수 있고 신규 VM 등은 별도 비용 | exact Direct hostname+CA+verify-full, backend SSL true를 확인하면 기존 psql SQL의 보안 조건을 유지 가능 | 환경 소유/접근 제한, private secret 저장, 개발 Ref 강제, journal 전후 flush/복구/동일 연결 transaction 필요. 임의 공개 CI/VM에 키 업로드 금지 |
| B. 공식 Management Query API | 공식 SQL API 존재, 현재 fixture용 구현/권한 검증은 미완료. API 자체 별도 요금은 이번 자료로 확정하지 않음. 기존 플랜/사용량/한도 확인 필요 | 운영자→API HTTPS는 검증 가능하나 API→DB TLS/인증서 검증은 별도 제공자 근거 필요. psql 전용 구문을 그대로 재사용 불가 | database_write와 고권한 Management 자격증명 필요. reviewed parameterized SQL·단일 transaction·대상 식별·충돌/표식/정리 검증을 별도 구현. 기존 backend SSL 검사 우회로 채택하지 않음 |
| C. Supabase IPv4 add-on | Pro 이상 유료 기능. 공식 현재 요율 $0.0055/시간, 월 약 $4/DB, 기본 유료 플랜 비용 별도 | 현 Windows에서 Direct IPv4를 사용할 수 있는 현실적 경로. 여전히 CA/verify-full/backend true를 실제 검사해야 함. Fixture 핵심 재사용 가능 | 활성화는 별도 승인. Direct DNS가 IPv4로 바뀌며 dual-stack 아님. 짧은 DNS 전환 영향/기존 IPv6 클라이언트 확인. 시간 과금은 Spend Cap 대상 아님 |

근거:
- [Direct 및 IP 지원](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [IPv4 add-on, 플랜, DNS 전환 영향](https://supabase.com/docs/guides/platform/ipv4-address)
- [현재 IPv4 시간 요금](https://supabase.com/docs/guides/platform/manage-your-usage/ipv4)
- [Management Query API, parameters와 권한](https://supabase.com/docs/reference/api/v1-run-a-query)

우선 이미 신뢰할 수 있는 IPv6 환경이 있는지 확인한다. 없다면 동일 Windows에서
기존 TLS 요구를 유지하는 C의 비용/운영 영향 승인을 검토하는 것이 현실적이다.
B는 별도 신뢰 경계이므로 upstream 검증 문제를 단순히 숨기는 대안으로 사용하지 않는다.
어느 경로도 이번에 활성화/생성/쓰기 검증하지 않았다.

## 업체 전용 실행기와 최소 Fixture 재검토

기존 phase2-rls --run은 고객 프로젝트 CRUD를 포함하며 phase4a2 --create는 무조건 6계정을 만든다.
이 두 실행 경로를 그대로 쓰지 않고 업체 전용 runner/Auth 준비/Fixture/cleanup을 분리하는 것이 권장된다.
이 문서는 그 설계이며 아직 새로운 실제 실행기는 구현하지 않았다.

### 기본 범위: Email 4명, 업체 3개, membership 5개

Email 사용자: 직원 A, 직원 B, 비소속 GENERAL, 업체 A의 PENDING 사용자.
업체: A approved, B approved, S suspended.

| membership | 업체 | 사용자 | 상태 | 검증 |
|---|---|---|---|---|
| A | A | 직원 A | approved | 본인 업체/멤버십 허용 |
| B | B | 직원 B | approved | 다른 업체 격리 |
| PENDING | A | 대기 사용자 | pending | 미승인 멤버십 차단 |
| SUSPENDED | S | 직원 A | approved | 업체 0행, 본인 membership 1행 |
| REVOKED | A | 직원 B | revoked | 취소된 멤버십 및 타 업체 차단 |

GENERAL에는 membership을 주지 않는다. 역할은 기존 member 기본값으로 충분하며,
role/status/business_id/user_id 위조 PATCH·자기 승인·INSERT·DELETE는 GRANT 거부를 검사한다.
Email 4명으로 이 핵심 범위는 충족한다. 익명 사용자 2명은 필요하지 않다.
다만 이 4명만으로 is_anonymous=true 분기의 실제 동작을 검증했다고 보고하면 안 된다.
비로그인 anon은 별도 Auth 계정 없이 publishable/legacy anon key로 검사 가능하다.

### 익명 배제까지 포함: Email 4명 + Anonymous 1명, 업체 3개, membership 6개

위 5개에 A 업체/새 익명 사용자/approved membership 하나를 더한다.
이 익명 사용자의 업체 및 본인 membership 조회가 모두 0행인지 검증한다.
고객 프로젝트를 만들거나 PHASE4B-2를 재실행하지 않는다.
이는 기존 3업체/6멤버십 구성을 의미 있게 유지하면서 익명 사용자 한 명을 줄이는 권장 전체 범위다.
기존 fixture의 두 anonymous UID 요구를 그대로 두고 Email UID로 치환하는 것은 금지한다.
필요하면 새 업체 전용 manifest/fixture를 별도 구현하되 같은 backend SSL/충돌/표식 검증을 유지한다.

같은 업체의 '다른 approved 회원' 조회 차단을 독립적으로 증명하려면 추가 fixture 관계가 필요하다.
기본 5개 중 다른 사용자의 pending/revoked 행이 안 보이는 결과만으로 self 조건 단독 검증을 주장하지 않는다.
익명 없이 6번째 행을 숫자에 맞춰 만들 필요는 없다. 추가 승인 회원 또는 멀티업체 회원 관계를
선택하면 actor별 기대 조회 범위를 다시 설계해야 한다.
pending 업체 상태 자체도 기본 3업체에는 없으므로 실제 검증하려면 별도 업체/멤버십 추가 승인 대상이다.

### suspended 정책

businesses 조회는 업체 approved가 필요하다. business_members SELECT는
본인+membership approved+JWT is_anonymous=false만 검사하며 businesses를 조회하지 않는다.
따라서 suspended 업체는 0행, 그 업체의 승인된 본인 membership은 1행이 정확한 기대값이다.
owner/admin/member 역할로 추가 조회/수정 권한을 가정하지 않는다.

### 안전 정리

- 고정 Ref와 Management GET, 실제 Auth UID/JWT/confirmed email, 전용 관리자 app_metadata 검증.
- 모든 생성 전에 manifest/journal에 전용 UUID와 expected row, 정리 순서를 기록하고 flush.
- 고객 요청과 업체 테스트를 완전히 분리. 관리자 세션으로 직원 RLS 검사를 대체하지 않음.
- 모든 거부는 정확한 UUID 대상, 전후 전체 snapshot 비교, auth 오류와 RLS/GRANT 차단 구분.
- 정리 시 신규 probe → membership → 업체 → Auth 순서. UUID·business_id·user_id·이름/신뢰 표식 확인.
- 업체에 manifest 밖 membership이 있거나 사용자에게 예상 밖 프로젝트가 있으면 CASCADE 삭제 금지.
- 불변 필드/업체 상태가 예상 밖 변경되면 권한 추가 없이 수동 복구 대상으로 전체 실패.
- 사용자/기본 fixture 삭제 재조회까지 검증. 잔여 ID·오류를 private journal에 기록하고 실패 종료.
- 비밀값 출력/프로젝트 내부 비밀번호 복사 없음. 사용자 Auth·업체 baseline 정리 도구를 먼저 offline 검증.

## 다음 승인 단계

1. A(기존 신뢰 IPv6 환경) 또는 C(유료 add-on) 선택 및 접근/비용 승인. B는 별도 보안 설계 승인 필요.
2. 업체 전용 실행기와 완전한 정리 경로를 offline으로 구현·검증할 범위 승인.
3. 사용자 수 선택: core Email 4명 또는 익명 배제 포함 Email 4+Anonymous 1명 권장.
4. 실제 네트워크 확보 후 Direct pgpass 항목 존재 여부만 확인하고 필요 시 사용자가 로컬 입력.
5. psql verify-full, pg_stat_ssl=true, BEGIN READ ONLY 및 Migration/RLS 검증 후 별도 데이터 생성 승인.

이번 수정은 이 보고 문서 추가와 PHASE4C-1 링크 추가뿐이다.
기존 코드/Fixture/backend_ssl/Migration/GRANT/정책/SSL/프론트엔드는 변경하지 않았다.
