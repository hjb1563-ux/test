# Builder 대표 이미지 연결

1. `public/images/bathroom-builder/` 또는 하위 폴더에 선택지 이름으로 사진을 넣습니다.
2. `npm run sync:builder-images`를 실행합니다.
3. 리포트를 확인하고 `npm run dev`를 실행합니다. dev/build 전에도 자동 동기화됩니다.

PNG/JPG/JPEG/WebP를 재귀적으로 검사합니다. 파일을 이동·복사·삭제·리사이즈·재인코딩하지 않으며 한글 이름도 그대로 사용합니다. `archive`와 `placeholder`는 목록에는 포함하지만 대표사진 후보에서 제외합니다.

같은 선택지의 `천장 간접 조명.png`, `천장 간접 조명2.png`, `천장 간접 조명3.png`가 있으면 3을 선택합니다. `(1)` 같은 다운로드 접미사는 버전이 아닙니다. 공백·대소문자·확장자 차이를 무시하며 `600x1200`의 치수는 보존합니다.

정확한 선택지 이름, 이름과 버전, 기존 Alias/정규화 구문/동의어로 매칭합니다. 동일 버전 후보의 내용이 같으면 기존 경로를 우선 유지합니다. 내용이 다르면 AMBIGUOUS로 보고하고 유효한 기존 연결만 유지합니다. 새 선택지는 만들지 않습니다.

파일이 있는 일반 옵션은 개별적으로 사진을 켭니다. 없음 옵션도 명확한 사진이 있으면 연결합니다. 기타·아직 모르겠어요·상담 후 결정은 항상 사진 없이 유지합니다. 실제 파일이 없는 옵션은 사진을 끄고 텍스트를 유지합니다.

- `UPDATED`: 대표사진 경로 교체
- `NEW IMAGE`: 기존 사진이 비활성 또는 파일이 없던 옵션의 새 연결
- `UNCHANGED`: 기존 연결 유지
- `DISABLED`: 실제 이미지가 없거나 텍스트 전용인 옵션
- `OLDER_VERSION`: 낮은 버전 파일, 자동 삭제하지 않음
- `UNMATCHED` / `OPTION_NOT_FOUND`: 해당 선택지 없음
- `AMBIGUOUS`: 후보 이름 또는 동일 버전 사진의 내용 충돌
- `INVALID_FORMAT`: 이미지 확장자와 파일 헤더 불일치

연결 정보는 `data/bathroom-builder-image-settings.generated.json`, 실행별 보고서는 `data/bathroom-builder-image-sync-report.json`입니다. `/design`만 새 연결표를 읽으며 홈페이지·가이드·결과 페이지의 기존 연결표는 수정하지 않습니다. 중앙·히스토리·오른쪽은 모두 option.builderImage를 사용합니다. localStorage에는 이미지 경로를 저장하지 않습니다.

선택된 inbox 파일은 `.gitignore`의 자동 관리 구간에서 예외 처리합니다. 실제 배포에는 이 파일들과 생성된 연결표를 함께 커밋해야 합니다. sync는 자동 커밋·푸시를 하지 않습니다. 환경변수 제외 규칙은 그대로 유지합니다.

검증: `node tests/sync-builder-images.mjs`, `node tests/builder-images.cjs`, `npm run build`.
