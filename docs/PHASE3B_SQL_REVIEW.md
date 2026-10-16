# PHASE 3B — 적용 전 SQL 최종 보완 (2026-10-16)

이번 단계는 미적용 Migration 파일의 CHECK와 문서만 보완했다. db push/Dry Run, 테이블 생성,
Fixture/계정 생성, RLS 통합 테스트, 프론트엔드/API 구현은 수행하지 않았다.
PHASE 3A Dry Run은 변경 전 SQL에 대한 결과다. 새 SQL은 후속 승인 범위에서 다시 검토해야 한다.

## 실제 입력·저장 구조와 제한

| 컬럼 / LocalProject 필드 | 실제 입력 | 새 CHECK |
|---|---|---|
| consultation_memo / memo | result textarea, maxLength 없음. normalizeProject가 문자열을 자르지 않음 | char_length <= 65,536 |
| consultation_checks / checks | Record<string,string>. normalizeProject는 알려진 그룹 키·문자열 값만 유지 | JSONB 텍스트의 UTF-8 <= 65,536 bytes |
| image_history_order / imageHistoryOrder | string[]. group:choice ID를 정규화하고 중복 제거·선택 이미지 ID 보충 | JSONB 텍스트의 UTF-8 <= 65,536 bytes 및 모든 원소 string |

근거 소스: data/bathroom-consultation.ts의 LocalProject/normalizeProject,
app/result/page.tsx의 메모 textarea/updateMetadata,
data/bathroom-image-history.ts의 selectedImageItems/normalizeImageHistoryOrder,
data/bathroom-builder-options.ts의 실제 카탈로그다. 소스는 수정하지 않았다.

- 메모 65,536자는 상담 메모에 충분한 여유가 있는 새 서버 저장 상한이다.
  PostgreSQL char_length는 문자 단위이며 JS length의 UTF-16 단위와 다르다.
  한글 65,536자는 196,608 UTF-8 bytes, 이모지 65,536자는 최대 262,144 bytes일 수 있다.
  결합 문자/이모지 조합의 화면상 글자 수와도 다르다. 메모에는 최소 길이를 요구하지 않는다.
- checks는 현재 26개 그룹이다. 각 값에 한글 100자를 넣은 예시는 JSON.stringify 기준
  8,197 bytes다. PostgreSQL JSONB 텍스트에서는 공백이 더해지므로 이 수치는 정확한 DB
  측정값이 아닌 규모 비교다. 64 KiB는 기존 체크 메모와 향후 그룹 추가에 여유를 준다.
  요청 범위대로 크기만 보완하며, 값의 enum/추가 nested 타입 제약은 만들지 않았다.
- 이미지 선택지 중 현재 이미지 ID는 60개이며 전부 나열한 JSON.stringify 결과도
  1,358 bytes다. PostgreSQL JSONB 공백을 더해도 약 1.4 KB다.
  64 KiB는 현재보다 수십 배 여유가 있다. 새 ID·한글·빈 문자열·중복 문자열을 DB에서는
  허용한다. 카탈로그 ID allowlist, 원소 수, ID별 길이, 정규식은 추가하지 않았다.
  UI의 정규화/중복 제거 의미를 DB의 새 거부 조건으로 만들지 않았다.
- JSONB 제한은 octet_length(convert_to(column::text,'UTF8'))로 계산한다.
  키·구두점·JSONB 표준 공백·이스케이프를 포함하며 TOAST 저장 크기나 요청 Body 크기가 아니다.

새 제약 이름:
projects_consultation_memo_length, projects_consultation_checks_size,
projects_image_history_order_size, projects_image_history_order_element_types.

## NULL·자료형·호환성

기존 NOT NULL/DEFAULT는 그대로다. 빈 메모, 빈 checks 객체, 빈 이미지 배열은 통과한다.
SQL NULL은 NOT NULL이 거부한다. 메모의 개별 길이 CHECK는 NULL일 때 UNKNOWN이므로
NOT NULL과 함께 해석해야 한다. text 값 'null'은 JSON null이 아니라 정상 문자열이다.
checks의 JSON null/배열/스칼라는 기존 object CHECK가 거부한다.
이미지 JSON null/객체/스칼라와 null·숫자·boolean·객체·중첩 배열 원소는 거부한다.
이미지 원소 CHECK는 CASE로 배열만 순회하고 strict JSONPath로 자동 배열 펼침을 막는다.
전체 IS TRUE는 UNKNOWN 통과를 방지한다. JSON 처리는
[PostgreSQL 17 JSON 공식 문서](https://www.postgresql.org/docs/17/functions-json.html)를 따랐다.

기존에 UI에서 만들던 구조와 기본값, Consumer/Professional, version 3는 호환된다.
그러나 기존 memo/checks에는 길이 상한이 없었으므로 **모든 기존 LocalProject가 새 상한
안에 있다는 보장은 없다.** 이 장치에는 고객의 localStorage 데이터 접근권이 없으므로
실제 저장 데이터 전수 검사는 하지 않았다. 초과 데이터는 자동 절단/삭제/덮어쓰지 않는다.
가져오기 전 크기 검사 → 기존 로컬 원본 보존 → 구체적 오류·내보내기/분할 안내가 필요하다.
잘못된 타입의 원본을 무조건 normalize하여 조용히 잃지 않도록 원본도 별도 보존해야 한다.

CASCADE, 테이블/컬럼 이름, 기존 RLS, GRANT/REVOKE, owner 보호, revision 트리거,
schema_version=3, project_info 64 KiB, selections 512 KiB는 변경하지 않았다.
작업 전 Migration과 비교하여 새 CHECK·주석 블록 하나만 추가됐음을 문자열 대조로 확인했다.
기존 package.json/lockfile·untracked 사용자 파일도 유지했다.

## 향후 서버 저장 구현 계약 (이번에 구현하지 않음)

1. 최초 INSERT와 기존 UPDATE를 구별한다. 무조건 upsert로 중복을 해결하지 않는다.
   INSERT 전에 클라이언트 UUID와 로컬-서버 매핑을 안정적으로 보관한다.
2. UUID 중복은 정상 재시도일 수도, 다른 프로젝트와의 충돌일 수도 있다.
   같은 사용자의 실제 인증으로 기존 행의 소유권·내용·revision을 확인한 경우에만
   같은 저장의 재시도로 처리한다. 조회가 안 되면 다른 소유자의 행이 없다고 단정하지 않는다.
   다른 사용자 존재 여부를 응답으로 노출하지 않으며 기존 행을 덮어쓰지 않는다.
3. 가져오기는 원본과 식별 매핑을 보존한다. 새로운 프로젝트는 새 UUID로 생성하고
   기존 프로젝트 교체는 별도 명시적 사용자 선택으로만 처리한다.
4. UPDATE는 id와 기대 revision을 함께 WHERE 조건에 넣고 반환 행 1개를 확인한다.
   0행은 충돌·삭제·권한 상실로 처리하고 로컬 편집본을 유지한다. 최신 revision으로
   무조건 재시도하여 덮어쓰지 않는다. revision 증가와 updated_at는 DB 트리거가 관리한다.
5. owner_user_id는 실제 인증 UID에서 결정한다. 클라이언트가 보낸 owner를 신뢰하지 않는다.
   UPDATE body에서는 owner_user_id/id/created_at/revision/updated_at를 받지 않는다.
   식별자와 소유자는 변경할 수 없다.
6. JSON 파싱 전 스트리밍/디코딩된 Body 크기에도 상한을 둔다. Content-Length만 신뢰하지
   않는다. 초기 서버 정책 제안은 UTF-8 JSON Body 2 MiB이며 향후 API 구현 시 인코딩·
   이스케이프·압축·배치 여부를 검증해 확정한다. 이번 SQL의 행/컬럼 제한과 다른 정책이다.
   메모 문자 수는 JS .length로 PostgreSQL char_length와 동일하다고 가정하지 않는다.
7. 서버에서 DTO allowlist, 루트/원소 타입, JSONB 정규 텍스트 크기, schema_version,
   projectInfo 모드 일치, 키/옵션 ID, 이름·날짜·금액 범위 등을 검증한다.
   로컬 raw 데이터를 보존하고 모르는 버전/키는 조용히 버리지 않는다.
8. 자체 API만 보호해도 Supabase Data API 직접 접근은 남는다.
   공개 키는 비밀이 아니므로 DB CHECK/RLS/컬럼 GRANT를 최종 방어선으로 유지한다.
   저장 요청은 실제 사용자 토큰을 전달하고 service_role로 사용자 권한을 우회하지 않는다.
   Body 제한·속도 제한·추가 의미 검증이 Data API에도 필요하면 지원 Gateway 정책 또는
   별도 승인된 권한/노출 설계를 적용해야 한다. 이번에는 그 권한을 변경하지 않는다.

## 읽기 전용 검증 결과

Migration 파일에서 새 CHECK 식 4개를 직접 추출하여 아래 SELECT에 삽입했다.
기존 NOT NULL/object/array 조건과 합성한 최종 허용 여부를 검사했다.
실제 PostgreSQL에서 **39/39 통과, 실패 0**이다.
65,535/65,536/65,537 문자·바이트, 한글·이모지·따옴표 이스케이프,
SQL NULL/JSON null, 빈 값, 여러 루트/원소 자료형, 중첩 배열 및 미래 ID 1,000개를 포함한다.
이는 식의 실제 파싱·평가 검증이며 CREATE TABLE 전체 실행/트리거/RLS/GRANT 통합 검증은 아니다.
읽기 전용 시스템 카탈로그 확인에서도 public 테이블과 적용 Migration이 없는지 재확인한다.

재실행용 읽기 전용 SQL:

```sql
with cases(name,kind,consultation_memo,payload,expected) as (values ('memo_empty','memo',''::text,NULL::jsonb,true),
('memo_below','memo',repeat('a',65535),NULL::jsonb,true),
('memo_exact','memo',repeat('a',65536),NULL::jsonb,true),
('memo_above','memo',repeat('a',65537),NULL::jsonb,false),
('memo_korean_exact','memo',repeat('가',65536),NULL::jsonb,true),
('memo_korean_above','memo',repeat('가',65537),NULL::jsonb,false),
('memo_emoji_exact','memo',repeat('😀',65536),NULL::jsonb,true),
('memo_sql_null','memo',NULL::text,NULL::jsonb,false),
('checks_empty','checks',NULL::text,'{}'::jsonb,true),
('checks_strings','checks',NULL::text,'{"demolition":"확인","future":""}'::jsonb,true),
('checks_below','checks',NULL::text,jsonb_build_object('x',repeat('a',65526)),true),
('checks_exact','checks',NULL::text,jsonb_build_object('x',repeat('a',65527)),true),
('checks_above','checks',NULL::text,jsonb_build_object('x',repeat('a',65528)),false),
('checks_korean_exact','checks',NULL::text,jsonb_build_object('x',repeat('가',21842)||'a'),true),
('checks_korean_above','checks',NULL::text,jsonb_build_object('x',repeat('가',21842)||'aa'),false),
('checks_json_null','checks',NULL::text,'null'::jsonb,false),
('checks_sql_null','checks',NULL::text,NULL::jsonb,false),
('checks_array','checks',NULL::text,'[]'::jsonb,false),
('checks_string','checks',NULL::text,'"x"'::jsonb,false),
('images_empty','images',NULL::text,'[]'::jsonb,true),
('images_strings','images',NULL::text,'["tile:future","","tile:future","한글:선택"]'::jsonb,true),
('images_below','images',NULL::text,jsonb_build_array(repeat('a',65531)),true),
('images_exact','images',NULL::text,jsonb_build_array(repeat('a',65532)),true),
('images_above','images',NULL::text,jsonb_build_array(repeat('a',65533)),false),
('images_korean_exact','images',NULL::text,jsonb_build_array(repeat('가',21844)),true),
('images_korean_above','images',NULL::text,jsonb_build_array(repeat('가',21844)||'a'),false),
('images_escaped_exact','images',NULL::text,jsonb_build_array(repeat('"',32766)),true),
('images_json_null','images',NULL::text,'null'::jsonb,false),
('images_sql_null','images',NULL::text,NULL::jsonb,false),
('images_object','images',NULL::text,'{}'::jsonb,false),
('images_string','images',NULL::text,'"x"'::jsonb,false),
('images_number','images',NULL::text,'[1]'::jsonb,false),
('images_boolean','images',NULL::text,'[true]'::jsonb,false),
('images_null_element','images',NULL::text,'[null]'::jsonb,false),
('images_object_element','images',NULL::text,'[{}]'::jsonb,false),
('images_nested_strings','images',NULL::text,'[["x"]]'::jsonb,false),
('images_nested_empty','images',NULL::text,'[[]]'::jsonb,false),
('images_mixed','images',NULL::text,'["x",2]'::jsonb,false),
('images_future_1000','images',NULL::text,(select jsonb_agg('future:'||g) from generate_series(1,1000) g),true)),
inputs as (select *,payload as consultation_checks,payload as image_history_order from cases),
evaluated as (select name,kind,expected,
case kind when 'memo' then (consultation_memo is not null and (char_length(consultation_memo) <= 65536) is true)
when 'checks' then (consultation_checks is not null and jsonb_typeof(consultation_checks)='object' and (octet_length(convert_to(consultation_checks::text, 'UTF8')) <= 65536) is true)
else (image_history_order is not null and jsonb_typeof(image_history_order)='array' and (octet_length(convert_to(image_history_order::text, 'UTF8')) <= 65536) is true and ((case
    when jsonb_typeof(image_history_order) = 'array' then
      not jsonb_path_exists(image_history_order, 'strict $[*] ? (@.type() != "string")')
    else false
  end) is true)) end as accepted,
case when kind='memo' then char_length(consultation_memo) else octet_length(convert_to(payload::text,'UTF8')) end as measured
from inputs)
select count(*) as total, count(*) filter(where accepted is not distinct from expected) as passed,
coalesce(jsonb_agg(jsonb_build_object('case',name,'actual',accepted,'expected',expected)) filter(where accepted is distinct from expected),'[]'::jsonb) as failures,
jsonb_agg(jsonb_build_object('case',name,'measured',measured,'accepted',accepted)) filter(where name like '%exact' or name like '%above' or name like '%below') as boundaries from evaluated;
```

