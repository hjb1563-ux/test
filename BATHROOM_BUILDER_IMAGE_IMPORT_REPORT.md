# Builder 이미지 재연결 결과

2026-09-21 작업 시작 상태 대비 결과입니다. 자동 실행별 상세 결과는 `data/bathroom-builder-image-sync-report.json`을 참고하세요. 반복 실행 시 교체 수는 0이 되고 UNCHANGED로 표시됩니다.

- 검사: 122개
- 매칭 파일: 104개 (중복 원본과 이전 버전 포함)
- 제외: placeholder 18개
- 활성 옵션: 59개
- 새 이미지 연결: 3개
- 버전 교체: 6개
- UNMATCHED / AMBIGUOUS / INVALID_FORMAT: 0개
- 이전 버전: 12개, 삭제하지 않음

## 교체

| 선택지 | 기존 경로 (Builder 폴더 기준) | 새 경로 |
|---|---|---|
| SMC 평천장 | ceiling/smc-flat.png | inbox/SMC 평천장2.png |
| 일반 사각 배수구 | drainage/square-drain.png | inbox/일반 사각 배수구2.png |
| 타일 삽입형 배수구 | drainage/tile-insert-drain.png | inbox/타일 삽입형 배수구2.png |
| 라인 배수구 | drainage/linear-drain.png | inbox/라인 배수구2.png |
| 트렌치 드레인 | drainage/trench-drain.png | inbox/트렌치 드레인 배수구2.png |
| 천장 간접 조명 | lighting/indirect-ceiling.png | inbox/천장 간접 조명2.png |

## 신규 연결

모두 `showBuilderImage: true`. 기존 데이터에 경로 문자열은 있었으나 해당 실제 파일이 없었습니다.

| 선택지 | 기존 미존재 경로 | 새 경로 |
|---|---|---|
| 일반 수전 (세면 수전) | faucet/basin/standard.jpg | inbox/일반 세면 수전.png |
| 일반 샤워수전 | faucet/shower/standard.jpg | inbox/일반 샤워 수전.png |
| 욕실장 간접 조명 | lighting/indirect-cabinet.jpg | inbox/욕실장 간접 조명.png |

위 경로 앞에는 `/images/bathroom-builder/`가 붙습니다. generated JSON은 공백과 한글을 URL 인코딩하여 저장합니다. 실제 파일명은 그대로 유지합니다.

## 검증

- 버전 선택, 치수 보존, 중복 충돌, 텍스트 전용 보호, 삭제된 경로, 개별 사진 활성화 자동 테스트 통과.
- 활성 옵션 59개의 중앙/히스토리/오른쪽 경로, 해제 및 저장값 복원 컴포넌트 테스트 통과.
- 기타 입력, 아직 모르겠어요, 왼쪽 Text Choice UI, 기존 선택 동작 유지.
- 모든 활성 이미지의 실제 파일 존재 확인.
- 선택한 inbox 9개 파일의 Git 제외 해제 확인. 아직 커밋/푸시하지 않음.
- 이미지 파일 이동/이름 변경/삭제/재인코딩 없음.
- 홈페이지/가이드/결과 페이지/CSS 변경 없음.
- npm run build 성공.
