# Visual design audit & implementation

## 범위와 사전 분석

2026-09-21 기준. 기존 선택 기능, 옵션, 가이드 문장, 이미지 URL, 저장 구조와 STEP 순서를 유지한 시각 디자인 개편.

기존 화면은 #213331과 #d97a53 중심이며, 전역 CSS·가이드 CSS·Builder 인라인 스타일에 색과 간격이 중복되어 있었다. 홈페이지는 CSS 욕실 일러스트와 흰 카드 3개 중심이었다. 제목 크기는 40~70px, 카드 반경은 4~16px로 분산되어 있었고, 가이드 본문 11~14px는 작은 편이었다. 폰트는 DM Serif Display와 Noto Sans KR의 두 계열이었다.

## 리서치

다음 공식 사이트와 편집 페이지를 열어 콘텐츠 구성과 프로젝트 표현을 확인했다. 아래 적용 원칙은 이 프로젝트를 위한 해석이며, 특정 사이트의 레이아웃·서체·브랜딩을 복제하지 않았다.

| 참고 | 적용한 원칙 |
|---|---|
| [ArchDaily Bathroom](https://www.archdaily.com/tag/bathroom) | 프로젝트·재료를 먼저 보여주고 명확한 제목과 정보를 뒤따르게 구성 |
| [Houzz Contemporary Bathrooms](https://www.houzz.com/photos/contemporary-bathroom-ideas-phbr1-bp~t_712~s_2103) | 사진과 짧은 설명으로 선택지를 쉽게 비교. 현재 가이드 검색 기능 유지 |
| [AD100 bathrooms, 2026 collection](https://www.architecturaldigest.com/gallery/ad100-2026-bathrooms) | 재료와 자연광을 중심에 두는 욕실 에디토리얼. 원본 사진은 가져오지 않음 |
| [Norm Architects](https://normcph.com/) | 소재·빛·일상의 감각을 중심에 놓는 차분한 프로젝트 설명 |
| [Studioilse](https://www.studioilse.com/) | 사람과 생활에 초점을 둔 간결한 내러티브 |
| [Vincent Van Duysen](https://vincentvanduysen.com/) | 건축·인테리어·오브젝트를 절제된 프로젝트 목록으로 보여주는 원칙 |
| [Yabu Pushelberg](https://www.yabupushelberg.com/) | Hospitality와 공간 경험을 중심에 놓는 프로젝트 소개 |

## 디자인 토큰

`app/editorial.css`를 root layout에서 기존 CSS 다음에 읽는다. 기존 기능용 레이아웃을 전부 재작성하지 않고 공통 토큰과 범위가 명확한 표현 규칙을 적용했다.

- Background #F5F2EC; surface #FAF8F3; stone #E8E2D8.
- Text #20211F; secondary #6D6962; border #D9D2C7.
- Muted terracotta #A65335; soft accent #F1E5DC; dark olive charcoal #292D27.
- 기존 두 서체 유지. 한글 제목/UI는 Noto Sans KR, 영문 번호·보조 문구는 DM Serif Display.
- Hero clamp 42~88px (좁은 모바일 34~43px), 일반 섹션 제목 30~54px.
- 섹션 여백 64~128px, 폭 1480px, 버튼 반경 8px, 이미지 모서리 4px.
- 그림자와 큰 hover 이동 없음. 버튼 색상만 180ms 전환. reduced-motion 적용.

## 페이지

홈페이지: 신규 사진 Hero → 준비할 네 영역 → 기존 욕실 사진과 Builder 소개 → 기존 3단계 이용 과정 → 가이드 링크 → 상담 준비의 의미 → 마지막 CTA.

Builder: 기존 3열과 선택/이미지 표시 구조 유지. warm canvas, 얇은 구분선, 전체 폭 선택 행, 차분한 현재 선택 목록. image fit/ratio와 히스토리 동작 변경 없음.

Guide/용어 사전: 내용과 이미지 URL 유지. 제목·번호 확대, 사진 표시 영역 확대, 카드 외곽 장식 감소, 본문 크기 개선. 검색 및 내 욕실 적용 링크 유지.

결과: 기존 목록과 인쇄 기능 유지, 공통 표현 및 Header 적용.

Footer: 공통 차콜 배경, 설명과 기존 Route 링크. 인쇄 시 제외.

## Hero

내장 image_gen으로 오리지널 사진 생성. 특정 호텔이나 실제 프로젝트 사진을 입력하지 않았다.

- 원본: public/images/home/luxury-hotel-bathroom-hero-original.png
- WebP: public/images/home/luxury-hotel-bathroom-hero.webp
- 실제 생성 해상도: 1672×941 (약 16:9). 2400px 권장치보다 작으며 인위적으로 확대하지 않았다.
- WebP: 178,460 bytes. 원본 별도 보존.
- Next/Image fill, sizes=100vw, Hero에만 preload. 설치된 Next 16 문서에서 priority가 deprecated되어 preload를 사용했다.
- 사진 위 좌측 중심 overlay. 모바일 object-position 65%로 욕조 중심을 유지.

## 검증과 제한

- 기존 이미지 172개 SHA-256 비교: 수정 0, 삭제 0, 이동/이름 변경 0. 추가는 Hero 원본/웹용 2개뿐. docs/DESIGN_IMAGE_AUDIT.json에 전체 사전 해시와 결과 기록.
- Builder 이미지 연결 JSON 동일.
- 기존 기능 컴포넌트 회귀 테스트 통과: STEP 1~17, 단일/다중 선택, 해제, 기타 입력, 아직 모르겠어요, 이미지 세 영역, localStorage 복원, 결과 요약.
- npm run build 성공, 24개 정적 페이지 생성.
- 1920/1440/1280/1024/768/430/390 폭에 대응하는 CSS 분기 검토. 실제 브라우저가 연결되지 않아 해당 viewport의 화면 캡처·실측·시각 QA는 수행하지 못함. CSS 검토를 브라우저 통과로 간주하지 않음.

추가 검증: 가이드 17개와 검색/필터, 상세 옵션 수·원본 사진 URL, 용어 사전 검색 테스트 통과. 최종 빌드의 정적 HTML 24개에서 내부 Route 링크 184개와 홈페이지 CTA 확인. 개발 서버의 홈페이지 및 신규 Hero 파일 HTTP 200 확인.
