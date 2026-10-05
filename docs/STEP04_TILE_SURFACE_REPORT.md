[STEP 04 기존 구조]

타일 크기 Field: wallTileSize
타일 분위기 Field: tile
표면 Field: tileSurface
기존 2-key Mood resolver: resolveTileMoodImage() 유지. 기존 12개 매핑과 정적 옵션 이미지 설정 변경 없음.

[03 표면 3-key 연동]

구현 방식: sync 스캔 → 3단계 JSON 매핑 → 선택값으로 URL 계산.
사용한 Key: wallTileSize + tile + tileSurface
Surface resolver: resolveTileSurfaceImage()
파일: data/bathroom-builder-image-resolver.ts
Option image / Preview / History: 동일 resolveBuilderImage() 결과 사용. 선택 전 두 표면 옵션도 각각 계산.

[Filename Normalization]

× / X → x, NFKC Unicode normalization, 앞뒤·연속 공백 처리, underscore / hyphen / 공백 구분자 처리.
지원 extension: .png .jpg .jpeg .webp (기존 지원 유지).
Version suffix: 크기 숫자와 분리한 표면 뒤 숫자만 버전으로 판단. 최신 버전 → canonical 파일명 → tile/finish/{size} 폴더 → 동일 바이트 확인. 남은 모호한 후보는 자동 매핑하지 않음.
600각: 기존 square alias에 따라 600x600.

[인식한 타일 크기]

300×600 / 600×600 / 600×1200

[인식한 분위기]

화이트 / 아이보리 / 그레이 / 다크

[인식한 표면]

무광 / 유광

[조합 이미지]

정확히 인식한 3-key 이미지 수: 24

| 타일 크기 | 분위기 | 무광 | 유광 |
|---|---|---|---|
| 300×600 | 화이트 | 정상 | 정상 |
| 300×600 | 아이보리 | 정상 | 정상 |
| 300×600 | 그레이 | 정상 | 정상 |
| 300×600 | 다크 | 정상 | 정상 |
| 600×1200 | 화이트 | 정상 | 정상 |
| 600×1200 | 아이보리 | 정상 | 정상 |
| 600×1200 | 그레이 | 정상 | 정상 |
| 600×1200 | 다크 | 정상 | 정상 |
| 600×600 | 화이트 | 정상 | 정상 |
| 600×600 | 아이보리 | 정상 | 정상 |
| 600×600 | 그레이 | 정상 | 정상 |
| 600×600 | 다크 | 정상 | 정상 |

[Inbox]

확인한 inbox 경로: public/images/bathroom-builder/inbox
발견한 이미지 수: 58 (.gitkeep 제외)
3-key matching 성공: 24개
Surface ambiguous: 0개
Surface unmatched/non-combination: 34개 유지
전체 Builder sync: 167개 스캔, surface 24개 / mood 12개 매핑, ambiguous 0개, 기존 unmatched 11개. 기존 다른 범주 매핑은 변경 없음.

[이동한 이미지]

총 이동 수: 24. 파일명·원본 바이트·SHA-256 유지. source와 target 모두 Builder root 내부 확인.

old: public/images/bathroom-builder/inbox/300x600각 그레이 무광.png
→ new: public/images/bathroom-builder/tile/finish/300x600/300x600각 그레이 무광.png

old: public/images/bathroom-builder/inbox/300x600각 그레이 유광.png
→ new: public/images/bathroom-builder/tile/finish/300x600/300x600각 그레이 유광.png

old: public/images/bathroom-builder/inbox/300x600각 다크 무광.png
→ new: public/images/bathroom-builder/tile/finish/300x600/300x600각 다크 무광.png

old: public/images/bathroom-builder/inbox/300x600각 다크 유광.png
→ new: public/images/bathroom-builder/tile/finish/300x600/300x600각 다크 유광.png

old: public/images/bathroom-builder/inbox/300x600각 아이보리 무광.png
→ new: public/images/bathroom-builder/tile/finish/300x600/300x600각 아이보리 무광.png

old: public/images/bathroom-builder/inbox/300x600각 아이보리 유광.png
→ new: public/images/bathroom-builder/tile/finish/300x600/300x600각 아이보리 유광.png

old: public/images/bathroom-builder/inbox/300x600각 화이트 무광.png
→ new: public/images/bathroom-builder/tile/finish/300x600/300x600각 화이트 무광.png

old: public/images/bathroom-builder/inbox/300x600각 화이트 유광.png
→ new: public/images/bathroom-builder/tile/finish/300x600/300x600각 화이트 유광.png

old: public/images/bathroom-builder/inbox/600각 그레이 무광.png
→ new: public/images/bathroom-builder/tile/finish/600x600/600각 그레이 무광.png

old: public/images/bathroom-builder/inbox/600각 그레이 유광.png
→ new: public/images/bathroom-builder/tile/finish/600x600/600각 그레이 유광.png

old: public/images/bathroom-builder/inbox/600각 다크 무광.png
→ new: public/images/bathroom-builder/tile/finish/600x600/600각 다크 무광.png

old: public/images/bathroom-builder/inbox/600각 다크 유광.png
→ new: public/images/bathroom-builder/tile/finish/600x600/600각 다크 유광.png

old: public/images/bathroom-builder/inbox/600각 아이보리 무광.png
→ new: public/images/bathroom-builder/tile/finish/600x600/600각 아이보리 무광.png

old: public/images/bathroom-builder/inbox/600각 아이보리 유광.png
→ new: public/images/bathroom-builder/tile/finish/600x600/600각 아이보리 유광.png

old: public/images/bathroom-builder/inbox/600각 화이트 무광.png
→ new: public/images/bathroom-builder/tile/finish/600x600/600각 화이트 무광.png

old: public/images/bathroom-builder/inbox/600각 화이트 유광.png
→ new: public/images/bathroom-builder/tile/finish/600x600/600각 화이트 유광.png

old: public/images/bathroom-builder/inbox/600x1200각 그레이 무광.png
→ new: public/images/bathroom-builder/tile/finish/600x1200/600x1200각 그레이 무광.png

old: public/images/bathroom-builder/inbox/600x1200각 그레이 유광.png
→ new: public/images/bathroom-builder/tile/finish/600x1200/600x1200각 그레이 유광.png

old: public/images/bathroom-builder/inbox/600x1200각 다크 무광.png
→ new: public/images/bathroom-builder/tile/finish/600x1200/600x1200각 다크 무광.png

old: public/images/bathroom-builder/inbox/600x1200각 다크 유광.png
→ new: public/images/bathroom-builder/tile/finish/600x1200/600x1200각 다크 유광.png

old: public/images/bathroom-builder/inbox/600x1200각 아이보리 무광.png
→ new: public/images/bathroom-builder/tile/finish/600x1200/600x1200각 아이보리 무광.png

old: public/images/bathroom-builder/inbox/600x1200각 아이보리 유광.png
→ new: public/images/bathroom-builder/tile/finish/600x1200/600x1200각 아이보리 유광.png

old: public/images/bathroom-builder/inbox/600x1200각 화이트 무광.png
→ new: public/images/bathroom-builder/tile/finish/600x1200/600x1200각 화이트 무광.png

old: public/images/bathroom-builder/inbox/600x1200각 화이트 유광.png
→ new: public/images/bathroom-builder/tile/finish/600x1200/600x1200각 화이트 유광.png

[최종 이미지 폴더]

```text
public/images/bathroom-builder/tile/
├─ finish/
│  ├─ .gitkeep
│  ├─ matte.png
│  ├─ glossy.png
│  ├─ 300x600/    (8개)
│  ├─ 600x600/    (8개)
│  └─ 600x1200/   (8개)
├─ mood/
│  ├─ 300x600/
│  ├─ 600x600/
│  └─ 600x1200/
├─ size/
├─ floor/
├─ tone/
├─ wall/
├─ window/
└─ placeholder.jpg
```

[이동하지 않은 Inbox 이미지]

- inbox/그레이 타일.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/니켈 액세서리.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/다크 타일.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/도막 방수.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/도어형 샤워부스.png: 3-key 표면 조합이 아닌 기존 이미지 (OLDER_VERSION); 원위치 유지.
- inbox/라인 배수구.png: 3-key 표면 조합이 아닌 기존 이미지 (OLDER_VERSION); 원위치 유지.
- inbox/무광 타일.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/문턱 인조대리석 마감.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/문턱 타일 마감.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/반신욕 욕조.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/벽걸이형 변기.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/슬라이딩 거울장.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/아이보리 타일.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/액체 방수.png: 3-key 표면 조합이 아닌 기존 이미지 (UNMATCHED); 원위치 유지.
- inbox/액체+도막 방수.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/언더볼 세면대.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/원피스 변기.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/유광 타일.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/일반 거울.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/일반 거울장.png: 3-key 표면 조합이 아닌 기존 이미지 (OLDER_VERSION); 원위치 유지.
- inbox/일반 사각 배수구.png: 3-key 표면 조합이 아닌 기존 이미지 (OLDER_VERSION); 원위치 유지.
- inbox/일반 세면대.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/일반 욕조.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/조적 욕조.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/크롬 액세서리.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/타일 삽입형 배수구.png: 3-key 표면 조합이 아닌 기존 이미지 (OLDER_VERSION); 원위치 유지.
- inbox/탑볼 세면대.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/투피스 변기.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/트렌치 드레인 배수구.png: 3-key 표면 조합이 아닌 기존 이미지 (OLDER_VERSION); 원위치 유지.
- inbox/화이트 타일.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/LED 거울.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/LED 거울장.png: 3-key 표면 조합이 아닌 기존 이미지 (UNMATCHED); 원위치 유지.
- inbox/smc 돔천장.png: 3-key 표면 조합이 아닌 기존 이미지 (MATCHED); 원위치 유지.
- inbox/smc 평천장.png: 3-key 표면 조합이 아닌 기존 이미지 (OLDER_VERSION); 원위치 유지.

[Fallback]

Size 없음 / Mood 없음 / 3-key 이미지 없음 / 기타 타일: 기존 무광·유광 대표 이미지 사용. 대표 이미지도 없으면 기존 showBuilderImage/Empty 정책 유지. 추측 URL 생성 없음.

[Dynamic Update]

Size 변경 시 Surface image: 현재 크기로 재계산
Mood 변경 시 Surface image: 현재 분위기로 재계산
Surface 변경 시: 선택한 표면으로 갱신
History image update: 매번 현재 선택값으로 계산
History 중복: 없음. resolver는 order를 변경하지 않음. 실제 선택 interaction만 기존 최신순 처리. 기존 Size 선택 시 Mood Preview 연동 정책 유지.

[localStorage]

선택값: wallTileSize / tile / tileSurface 기존 필드와 ID 유지
Image URL 저장 여부: 저장하지 않음
Refresh 후 Resolver: 현재 선택값으로 이미지 복원. active Preview는 기존 규칙대로 초기화.

[기능 회귀 확인]

02 타일 분위기 연동 / 03 Surface 연동 / Preview / History / History 최신순 / Thumbnail click / 기타 Empty Preview / STEP16 / 상담서 / 상담서 수정 및 돌아가기: 정상.
16 STEP, single/multi select, 미선택=미정, 자동 저장 및 기존 선택 필드 유지.
브라우저: 1920×1080, 1440×900, 1280×720, 430×932, 390×844, 375×812 각각 전체 24개 조합 검증.
선택 전 두 옵션 썸네일, 선택 후 Preview/History 동일 URL 및 실제 이미지 로딩 확인.
Size/Mood 변경, 역순 선택, 새로고침, fallback, STEP16, 상담서 수정/복귀, overflow 검사 통과.

[Broken Image]

404: 0개
존재하지 않는 등록 path: 0개
전체 이미지 참조: 137개 / unique 110개 검사 통과
원본 이미지 181개 및 새 이동 이미지 24개의 SHA-256 검사 통과
runtime / hydration / duplicate key 오류: 0개

[Guide]

리모델링 가이드 수정 여부: 없음

[Build]

Image sync: 성공
npm run build: 성공
node tests/builder-structure.cjs: 성공
node tests/sync-builder-images.mjs: 성공
node tests/builder-image-paths.mjs: 성공
node tests/builder-tile-surface-browser.cjs: 성공
git diff --check: 성공

[Git]

이동: ignored inbox 원본 24개 → finish 하위 새 파일 24개 (Git에서는 신규 파일로 표시)
수정: 표면 resolver / 옵션 썸네일 / sync 스크립트 / sync 보고서 / 관련 테스트
삭제: 파일 삭제 없음 (원본은 이동)
의도하지 않은 변경: 없음. 기존 mood mapping과 option settings 변경 없음.
이 작업에서는 커밋·푸시·배포를 실행하지 않음.

[변경 파일]

Code:
- components/BuilderChoiceCard.tsx
- components/BuilderChoiceGroup.tsx
- data/bathroom-builder-image-resolver.ts
- data/bathroom-builder-tile-surface-images.generated.json
- data/bathroom-builder-image-sync-report.json

Script:
- scripts/sync-builder-images.mjs
- scripts/import-builder-tile-surfaces.mjs (명시적 import 작업; 일반 dev/build sync는 이동하지 않음)

Test:
- tests/builder-structure.cjs
- tests/builder-image-paths.mjs
- tests/sync-builder-images.mjs
- tests/builder-tile-surface-browser.cjs

Report:
- docs/BUILDER_TILE_SURFACE_IMPORT.json
- docs/STEP04_TILE_SURFACE_REPORT.md

Moved images:
- public/images/bathroom-builder/tile/finish/{300x600,600x600,600x1200}/ 각 8개 (전체 목록 위 참조)
