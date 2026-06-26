// 실행 모드 설정
//
// - 'direct' (기본): 브라우저가 OpenAI 를 직접 호출. API 키는 localStorage 보관(클라이언트 노출).
//   별도 서버 없이 정적 호스팅/로컬에서 바로 동작.
// - 'proxy': 백엔드(server/index.js)가 OpenAI 를 대신 호출. 키는 서버 환경변수에만 존재.
//   배포 시 권장. 빌드할 때 VITE_API_MODE=proxy 로 지정.
//
// 사용법:
//   직접 모드 빌드:  npm run build
//   프록시 모드 빌드: VITE_API_MODE=proxy npm run build

// ── Supabase (팀 모드) ──────────────────────────────
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되면 "팀 모드"로 동작:
//   로그인(매직링크) 필요 + Vercel 서버리스 프록시 + Supabase Storage/DB 저장.
// 미설정이면 기존 동작(직접 모드 또는 VITE_API_MODE=proxy 자체 서버).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const SUPABASE_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

export const STORAGE_BUCKET = 'generations'
export const UPLOADS_BUCKET = 'uploads'

// 팀 모드면 항상 프록시. 아니면 기존 규칙.
export const API_MODE = SUPABASE_ENABLED
  ? 'proxy'
  : import.meta.env.VITE_API_MODE === 'proxy'
    ? 'proxy'
    : 'direct'
export const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// 직접 모드에서만 사용자가 API 키를 입력 (팀/프록시 모드는 서버가 키 보유)
export const KEY_REQUIRED = API_MODE === 'direct'

export const MAX_REFERENCES = 10
