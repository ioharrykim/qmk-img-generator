# 큐이미지 스튜디오

`gpt-image-2` 기반 **큐마켓 이미지 생성기**. Claude Design 으로 만든 UI 시안(`design-source/`)을 동작하는 Vite + React 앱으로 옮기고 고도화한 것입니다.

## 주요 기능

- **텍스트 → 이미지 생성** — 프롬프트 + 네거티브 + 스타일/사이즈/품질/배경/포맷/개수 설정
- **참조 이미지(최대 10장)** — 파일 선택 · 드래그앤드롭 · 클립보드 붙여넣기(⌘/Ctrl+V). 첨부 시 OpenAI `images/edits` 로 전환되어 이미지를 참조해 변형/합성
- **고도화된 스타일 프리셋** — 카테고리(커머스·사진·일러스트·3D)·검색·다중 선택, 커머스용 스타일(화이트 배경 제품컷·라이프스타일·플랫레이·썸네일 등), **내 프리셋**(현재 설정 전체를 이름 붙여 저장/적용/삭제)
- **생성 기록 관리** — IndexedDB 영구 저장(새로고침/재접속해도 유지), 하단 스트립 + 전체보기 패널에서 개별 다운로드·설정 재사용·참조로 추가·삭제
- **결과 액션** — 확대(라이트박스)·다운로드·참조로 추가·프롬프트 재사용
- **단축키** — ⌘/Ctrl+Enter 생성, Esc 확대 닫기
- **세 가지 실행 모드** — ① 직접(키 브라우저, 로컬용) ② 자체 서버 프록시(키 서버) ③ **팀 모드(Supabase + Vercel: 로그인 + 서버 저장, 배포 권장)**

## 실행 (직접 모드 · 기본)

```bash
npm install
npm run dev      # http://localhost:5173 자동 오픈
```

1. 우상단 **API 키 설정** → OpenAI API 키(`sk-...`) 입력 후 저장 (없으면 첫 실행 시 모달 자동 표시)
2. 프롬프트 입력 + 참조 이미지/스타일/사이즈 선택
3. **이미지 생성**(또는 ⌘/Ctrl+Enter)

설정·API 키는 브라우저 `localStorage`(`qimg.settings`, `qimg.apiKey`, `qimg.presets`)에, 생성 기록은 `IndexedDB`(`qimg`)에 저장됩니다.

## 팀 배포 (Supabase + Vercel) — 권장

소수 팀원(예: 2~4명)이 함께 쓰는 구성입니다. **로그인(매직링크)으로 접근을 막고**, OpenAI 키는 서버(Vercel 함수)에만 두며, 생성 이미지·기록은 **Supabase**에 개인별로 저장돼 기기 간 동기화됩니다.

> 동작 방식: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 가 빌드에 주입되면 앱이 자동으로 "팀 모드"가 됩니다(로그인 필수 + 서버 프록시). Vercel 서버리스 함수 [`api/images.js`](api/images.js)가 로그인 토큰을 검증한 뒤 OpenAI 를 호출하고, 결과를 Supabase Storage 에 올린 후 URL 만 돌려줍니다(Vercel 4.5MB 본문 제한 회피).

### 1) Supabase 설정

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성.
2. **SQL Editor** 에 [`supabase/schema.sql`](supabase/schema.sql) 내용을 붙여넣고 실행 → `generations` 테이블 + `generations`/`uploads` 버킷 + RLS 정책 생성.
3. **Project Settings → API** 에서 다음 값을 복사:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` 키 → `VITE_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` *(비밀, 서버 전용)*
4. **Authentication → Providers → Email** 켜기. 매직링크만 쓸 거면 "Confirm email" 유지.
5. **가입 차단(팀 전용)**: Authentication → **Sign-ups 비활성화**(Allow new users 끄기). 그런 다음 **Users → Add user / Invite** 로 팀원 이메일을 직접 등록. (이렇게 하면 초대된 이메일만 로그인됨)
6. **URL 설정**: Authentication → URL Configuration → **Site URL** 과 **Redirect URLs** 에 Vercel 도메인(예: `https://your-app.vercel.app`) 추가. (로컬 테스트 시 `http://localhost:5173` 도 추가)

### 2) Vercel 설정

1. 이 저장소를 GitHub 에 올리고 [vercel.com](https://vercel.com) 에서 **New Project → Import**. (프레임워크는 Vite 로 자동 감지)
2. **Environment Variables** 에 등록:

   | 이름 | 값 | 비고 |
   |------|----|----|
   | `VITE_SUPABASE_URL` | Supabase Project URL | 빌드에 포함(공개 OK) |
   | `VITE_SUPABASE_ANON_KEY` | anon public 키 | 빌드에 포함(공개 OK) |
   | `OPENAI_API_KEY` | OpenAI 키 | **비밀** |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | **비밀** |

3. **Deploy**. 완료되면 `https://your-app.vercel.app` 접속 → 로그인 화면이 뜨면 성공.
4. 배포 후 1)–6 의 Redirect URL 에 실제 Vercel 도메인이 들어갔는지 다시 확인.

### 3) 팀원 사용

- 팀원은 배포 URL 접속 → 초대된 이메일 입력 → 메일의 로그인 링크 클릭 → 자동 로그인.
- 각자 자신의 생성 기록만 보입니다(개인별 비공개, RLS 적용).

### 로컬에서 팀 모드 테스트

`.env.example` 을 `.env.local` 로 복사해 네 값을 채운 뒤 `npm run dev`. (Supabase URL 설정의 Redirect URLs 에 `http://localhost:5173` 필요)

---

## 대안: 자체 서버(Express) 프록시

Supabase 없이 키만 숨기고 싶을 때. 백엔드([`server/index.js`](server/index.js))가 빌드된 프론트를 서빙하고 OpenAI 호출을 대신 처리합니다(키는 서버 환경변수에만 존재). 단, 로그인/저장 기능은 없고 기록은 브라우저(IndexedDB)에만 남습니다.

### 로컬에서 프록시 모드로 실행

```bash
npm install
npm run build:proxy                      # 프록시 모드로 프론트 빌드 (VITE_API_MODE=proxy)
OPENAI_API_KEY=sk-... npm run server     # http://localhost:3000
```

또는 한 번에: `OPENAI_API_KEY=sk-... npm run serve` (빌드+서버)

### Docker

```bash
docker build -t q-image-studio .
docker run -p 3000:3000 -e OPENAI_API_KEY=sk-... q-image-studio
# → http://localhost:3000
```

이미지는 프록시 모드로 빌드되어 키 입력 UI 없이 "서버 모드"로 동작합니다.

### 그 외 호스팅

`server/index.js` 는 Node 18+ 어디서나 동작하므로 Render·Railway·Fly.io·VPS 등에 그대로 올릴 수 있습니다.
- 빌드 명령: `npm install && npm run build:proxy`
- 시작 명령: `node server/index.js`
- 환경변수: `OPENAI_API_KEY` (필수), `PORT` (선택, 기본 3000)

> 정적 호스팅(GitHub Pages·Netlify static 등)만 쓴다면 직접 모드(`npm run build`)로 빌드하세요. 단, 이 경우 사용자가 각자 자신의 키를 입력해야 합니다.

`.env.example` 을 `.env` 로 복사해 값을 채워두면 편합니다.

## 모델 · 파라미터

- 기본 모델 `gpt-image-2`. **고급 설정 → 모델명** 에서 변경 가능(예: `gpt-image-1`).
- 참조 없음 → `/v1/images/generations`, 참조 있음 → `/v1/images/edits` 자동 전환.
- 파라미터: `model`, `prompt`, `n`, `size`, `quality`, `background`, `output_format`, (jpeg/webp) `output_compression`, `moderation`.
- `gpt-image` 계열은 항상 base64 로 응답합니다. 사이즈는 프리셋 + **직접 입력(px)** 지원. 모델이 지원하지 않는 크기는 API 가 거부할 수 있습니다(토스트로 표시).
- gpt-image 사용에는 OpenAI 조직 인증이 필요할 수 있습니다. `gpt-image-2` 가 없다는 오류가 나면 `gpt-image-1` 로 바꿔보세요.

## 구조

```
index.html                 Vite 진입점 (폰트 link)
vite.config.js             빌드/개발(+ /api 프록시) 설정
vercel.json                Vercel 함수 설정 (maxDuration)
api/images.js              Vercel 서버리스 함수 (팀 모드: 인증→OpenAI→Storage)
server/index.js            Express 프록시 + 정적 서빙 (자체 서버 모드)
supabase/schema.sql        Supabase 테이블·버킷·RLS 정의
Dockerfile / .dockerignore 컨테이너 배포
.env.example               환경변수 예시 (팀/서버/직접 모드)
src/
  main.jsx                 React 부트스트랩
  App.jsx                  상태 관리 + 전체 조립 (인증·참조·프리셋·히스토리·생성)
  api.js                   OpenAI 호출 (direct/proxy/team · generations/edits)
  config.js                실행 모드 (SUPABASE_ENABLED, API_MODE, MAX_REFERENCES)
  supabase.js              Supabase 클라이언트 (팀 모드)
  history.js               기록 백엔드 추상화 (Supabase / IndexedDB)
  db.js                    IndexedDB 생성 기록 저장소 (로컬 모드)
  constants.js             스타일(카테고리)·프리셋·옵션
  utils.js                 blob/dataURL 변환, 다운로드, timeAgo 등
  styles.css               전역 스타일 + 키프레임
  components/
    Header.jsx             로고 + 키 상태 / 팀 모드 사용자·로그아웃
    Login.jsx              팀 모드 로그인(매직링크) 화면
    ControlPanel.jsx       좌측 컨트롤 패널 (조립)
    ReferenceImages.jsx    참조 이미지 첨부(업로드/드롭/붙여넣기)
    StylePresets.jsx       스타일 카테고리·검색·내 프리셋
    SegmentedControl.jsx   품질/배경/포맷/개수 공통 토글
    Viewport.jsx           빈상태/로딩/결과 그리드 + 카드 액션
    HistoryStrip.jsx       하단 기록 스트립
    HistoryPanel.jsx       기록 관리 슬라이드오버
    Lightbox.jsx           확대 보기
    ApiKeyModal.jsx        API 키 입력 (직접 모드)
    Toast.jsx              성공/에러 토스트
design-source/             Claude Design 원본 시안 (참고용)
```
