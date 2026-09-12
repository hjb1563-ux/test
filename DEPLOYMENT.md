# Bath Design · GitHub / Vercel 배포 준비

## 현재 설정

- GitHub 저장소: https://github.com/hjb1563-ux/test
- 기존 기본 브랜치: `master` (Vercel Production Branch도 `master`로 설정)
- Framework Preset: **Next.js**
- Root Directory: 프로젝트 루트 (`./`)
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: Next.js 기본값 유지
- 로컬 실행: `npm run dev`, production 실행: `npm run build` 후 `npm start`
- 현재 앱에서 설정해야 할 환경변수: **없음**

기본 Next.js 배포를 사용하므로 `vercel.json`이나 `output: export` 설정은 필요하지 않습니다.
환경변수를 사용하지 않아 `.env.example`도 생성하지 않았습니다. 추후 필요하면 변수 이름과 빈 값만 넣으세요.

## 보안 업데이트 확인 결과

Next.js `16.3.5`, 직접 의존성 PostCSS `8.5.28`, Next.js 내부 PostCSS `8.5.23`으로 업데이트했습니다.
Next.js 14.x 및 확인한 15.5.25는 취약한 내부 PostCSS를 사용하므로 패치된 16.x로 변경했습니다.
React / React DOM은 지원 peer 범위인 `18.3.1`을 유지했습니다.
Node는 `20.9.0` 이상이 필요하며, 로컬 검증 버전은 `24.20.0`입니다.

업데이트 직후 `npm audit`와 `npm audit --omit=dev`는 모두 취약점 0건을 보고했고,
production build와 Builder 선택·입력·저장 복원 회귀 테스트가 통과했습니다.
기존 번들러 동작을 유지하기 위해 dev/build는 `--webpack`을 명시합니다.
Next.js 16에서 제거된 `next lint` 스크립트는 삭제했습니다. `npm run typecheck`는 타입 검사이며 ESLint 대체가 아닙니다.

배포할 때는 갱신된 `package.json`과 `package-lock.json`, 호환 수정 파일을 함께 업로드하고 `npm ci`로 설치하세요.
의존성 경고를 숨기는 옵션, 강제 수정, overrides는 사용하지 않았습니다.

## 검사 범위와 Git 제외 파일

현재 프로젝트 파일과 기존 Git 기록 5개 커밋의 고유 blob 76개에서 알려진 토큰 형태,
개인 키 헤더, 비밀번호가 포함된 연결 문자열, Secret 이름 및 하드코딩 패턴을 검사했습니다.
검사 당시 의심 값, 추적 중인 민감 파일, public 안의 인증 파일은 발견하지 못했습니다.
패턴 검사만으로 모든 형태의 민감정보 부재를 보장하지는 않습니다.

`.gitignore`는 환경변수 파일, 의존성, 빌드 출력, Vercel 로컬 메타데이터, 로그,
OS 파일, 인증서·개인 키와 coverage를 제외합니다. 빈 값만 가진 `.env.example`은 예외로 허용합니다.
실제 환경변수 파일이나 개인 키를 public 폴더에 두지 마세요.

## Vercel 연결 순서

1. 보안 업데이트 변경을 GitHub에 commit/push합니다.
2. Vercel에 로그인하고 **Add New → Project**에서 GitHub 저장소 `hjb1563-ux/test`를 Import합니다.
3. GitHub 연결 권한이 필요하면 해당 저장소 접근을 직접 승인합니다.
4. Framework를 Next.js, Root Directory를 `./`, Production Branch를 `master`로 확인합니다.
5. 환경변수는 현재 추가하지 않습니다. Build/Output 설정은 위 설정과 Next.js 기본값을 사용합니다.
6. Deploy 후 생성된 주소에서 홈, `/design`, `/guide`, `/result`, 이미지와 선택 저장을 확인합니다.
7. 외부 공개가 목적이면 Deployment Protection 설정을 확인하고 로그아웃한 브라우저에서도 접속을 확인합니다.

GitHub 저장소를 Private으로 유지하면서 Vercel 사이트를 공개할 수 있습니다.
이 작업에서는 기존 저장소의 공개 범위를 변경하거나 Vercel 계정 연결을 대신 승인하지 않았습니다.

## 이후 업데이트

변경 내용을 확인하고 테스트한 뒤 필요한 파일만 stage → commit → push합니다.
Vercel Git 연결이 완료되면 연결된 브랜치의 push가 배포를 시작합니다.

```sh
npm run build
git status
git diff
git add <검사한-파일>
git diff --cached
git commit -m "수정 내용"
git push
```

사진을 교체한 경우 `public/images/bathroom-builder/`의 해당 파일도 commit/push해야 공개 사이트에 반영됩니다.
추후 비밀 환경변수가 필요하면 Vercel Project Settings → Environment Variables에 직접 등록하고 재배포하세요.
`NEXT_PUBLIC_` 변수는 브라우저에 노출될 수 있으므로 비밀값에 사용하지 마세요.

공식 안내: [Git 저장소 연결](https://vercel.com/docs/git),
[환경변수 설정](https://vercel.com/docs/environment-variables).
