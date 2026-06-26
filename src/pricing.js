// gpt-image-2 비용 추정
// 출처: OpenAI 2026 가격표 (이미지 1장당 USD, 비율 버킷 × 품질)
//   정사각(1024²): low 0.006 / medium 0.053 / high 0.211
//   세로·가로(1536): low 0.005 / medium 0.041 / high 0.165
// 모두 "추정치"입니다. auto 품질이나 비표준 크기는 근사로 계산합니다.

export const PRICE_TABLE = {
  square: { low: 0.006, medium: 0.053, high: 0.211 },
  portrait: { low: 0.005, medium: 0.041, high: 0.165 },
  landscape: { low: 0.005, medium: 0.041, high: 0.165 },
}

// 참조 이미지(편집) 1장당 입력 토큰 추정 비용(USD) — 대략치
export const REF_INPUT_USD = 0.015

// 텍스트 모델(프롬프트 생성) 단가 — USD per 1M tokens (출처: OpenAI 2026 가격표)
export const TEXT_PRICE = {
  'gpt-5.5': { in: 5.0, out: 30.0 },
  'gpt-5.5-pro': { in: 30.0, out: 180.0 },
  'gpt-5.4-mini': { in: 0.6, out: 3.0 },
}

export function textCostUsd(model, inTok, outTok) {
  const p = TEXT_PRICE[model] || TEXT_PRICE['gpt-5.5']
  return ((inTok || 0) * p.in + (outTok || 0) * p.out) / 1e6
}

// 환율 폴백 (실시간 조회 실패 시). 실제 값은 앱 로드 시 갱신.
export const DEFAULT_KRW_RATE = 1380

export function sizeBucket(size) {
  if (!size || size === 'auto') return 'square'
  const m = String(size).match(/^(\d+)x(\d+)$/)
  if (!m) return 'square'
  const w = +m[1]
  const h = +m[2]
  if (Math.max(w, h) === 0) return 'square'
  const ratio = Math.abs(w - h) / Math.max(w, h)
  if (ratio < 0.1) return 'square'
  return w > h ? 'landscape' : 'portrait'
}

export function qualityKey(q) {
  // auto / 미상 → high (보수적 추정)
  return q === 'low' || q === 'medium' || q === 'high' ? q : 'high'
}

// 레코드(이미지 1장)의 추정 단가(USD).
// n(배치 크기)으로 참조 입력비를 분배 → 레코드 합산 시 총비용이 정확히 떨어짐.
export function recordUsd(item) {
  if (!item) return 0
  const per = PRICE_TABLE[sizeBucket(item.size)][qualityKey(item.quality)]
  const n = Math.max(1, item.n || 1)
  const refShare = ((item.refCount || 0) * REF_INPUT_USD) / n
  return per + refShare
}

export function sumUsd(items) {
  return (items || []).reduce((acc, it) => acc + recordUsd(it), 0)
}

export function usdToKrw(usd, rate) {
  return usd * (rate || DEFAULT_KRW_RATE)
}

export function formatKrw(krw) {
  return '₩' + Math.round(krw).toLocaleString('ko-KR')
}

export function formatUsd(usd) {
  const digits = usd < 0.1 ? 4 : usd < 10 ? 3 : 2
  return '$' + usd.toFixed(digits)
}

// 실시간 USD→KRW 환율 (무키·CORS 허용 API). 실패 시 null.
export async function fetchKrwRate() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD')
    const j = await r.json()
    const rate = j && j.rates && j.rates.KRW
    return rate && rate > 0 ? rate : null
  } catch (e) {
    return null
  }
}
