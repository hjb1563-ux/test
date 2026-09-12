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

## 공개 배포 전 해결할 항목

이번 준비 과정의 `npm audit` 결과는 취약한 패키지 2개(Next.js: Critical, PostCSS: High)를 보고했습니다.
현재 버전은 Next.js `14.2.5`, 직접 의존성 PostCSS `8.4.39`입니다.
이는 하드코딩된 Secret 발견과는 별개이며, 모든 취약점이 이 앱에서 악용 가능한지는 별도 검토가 필요합니다.

요청 범위에 따라 패키지 버전과 lockfile은 변경하지 않았습니다. **외부 공개 전에 보안 업데이트를 검토하고,
업데이트 후 `npm audit`, `npm run build`, 선택·저장 기능 테스트를 다시 확인하세요.**
`npm audit fix --force`나 검토 없는 major 업그레이드는 실행하지 마세요.

## 검사 범위와 Git 제외 파일

현재 프로젝트 파일과 기존 Git 기록 5개 커밋의 고유 blob 76개에서 알려진 토큰 형태,
개인 키 헤더, 비밀번호가 포함된 연결 문자열, Secret 이름 및 하드코딩 패턴을 검사했습니다.
검사 당시 의심 값, 추적 중인 민감 파일, public 안의 인증 파일은 발견하지 못했습니다.
패턴 검사만으로 모든 형태의 민감정보 부재를 보장하지는 않습니다.

`.gitignore`는 환경변수 파일, 의존성, 빌드 출력, Vercel 로컬 메타데이터, 로그,
OS 파일, 인증서·개인 키와 coverage를 제외합니다. 빈 값만 가진 `.env.example`은 예외로 허용합니다.
실제 환경변수 파일이나 개인 키를 public 폴더에 두지 마세요.

## Vercel 연결 순서

1. 위 보안 업데이트 항목을 해결합니다.
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
