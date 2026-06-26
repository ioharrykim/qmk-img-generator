// gpt-image-2 비용 추정
// 출처: OpenAI 2026 가격표
//   출력: 정사각(1024²) low 0.006 / medium 0.053 / high 0.211 USD
//   출력: 세로·가로(1536) low 0.005 / medium 0.041 / high 0.165 USD
//   입력: text 5.00 USD / 1M tokens, image 8.00 USD / 1M tokens
// 모두 "추정치"입니다. auto 품질이나 비표준 크기는 근사로 계산합니다.

export const PRICE_TABLE = {
  square: { low: 0.006, medium: 0.053, high: 0.211 },
  portrait: { low: 0.005, medium: 0.041, high: 0.165 },
  landscape: { low: 0.005, medium: 0.041, high: 0.165 },
}

export const GPT_IMAGE_2_TEXT_INPUT_USD_PER_1M = 5.0
export const GPT_IMAGE_2_IMAGE_INPUT_USD_PER_1M = 8.0
export const GPT_IMAGE_2_IMAGE_OUTPUT_USD_PER_1M = 30.0

const CANONICAL_AREA = {
  square: 1024 * 1024,
  portrait: 1024 * 1536,
  landscape: 1536 * 1024,
}

// 참조 이미지 크기를 알 수 없을 때의 high-fidelity 입력 이미지 대략치(USD).
export const REF_INPUT_USD = 0.04

// 텍스트 모델(프롬프트 생성) 단가 — USD per 1M tokens (출처: OpenAI 2026 가격표)
export const TEXT_PRICE = {
  'gpt-5.5': { in: 5.0, out: 30.0 },
  'gpt-5.5-pro': { in: 30.0, out: 180.0 },
  'gpt-5.4-mini': { in: 0.75, out: 4.5 },
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

function parseSize(size) {
  if (!size || size === 'auto') return null
  const m = String(size).match(/^(\d+)x(\d+)$/)
  if (!m) return null
  return { w: Number(m[1]), h: Number(m[2]) }
}

function canonicalOutputUsd(size, quality) {
  return PRICE_TABLE[sizeBucket(size)][qualityKey(quality)]
}

export function outputUsdPerImage(settings = {}) {
  const size = settings.size || '1024x1024'
  const bucket = sizeBucket(size)
  const base = canonicalOutputUsd(size, settings.quality)
  const dims = parseSize(size)
  if (!dims) return base

  const exactTableSize =
    size === '1024x1024' ||
    size === '1024x1536' ||
    size === '1536x1024'
  if (exactTableSize) return base

  const scale = Math.sqrt((dims.w * dims.h) / CANONICAL_AREA[bucket])
  return base * Math.min(3.5, Math.max(0.75, scale))
}

export function estimateTextTokens(text = '') {
  const cjk = (text.match(/[\u3131-\u318e\uac00-\ud7a3\u3040-\u30ff\u3400-\u9fff]/g) || []).length
  const rest = text.replace(/[\u3131-\u318e\uac00-\ud7a3\u3040-\u30ff\u3400-\u9fff]/g, '')
  const restChars = rest.replace(/\s+/g, ' ').trim().length
  return Math.max(0, Math.ceil(cjk * 0.8 + restChars / 4))
}

export function textInputUsd(text = '') {
  return (estimateTextTokens(text) * GPT_IMAGE_2_TEXT_INPUT_USD_PER_1M) / 1e6
}

function imageInputTokenEstimate(width, height) {
  const w = Math.max(1, Number(width) || 1536)
  const h = Math.max(1, Number(height) || 1536)
  const shortSide = Math.min(w, h)
  const scale = shortSide > 0 ? 512 / shortSide : 1
  const scaledW = Math.max(1, Math.round(w * scale))
  const scaledH = Math.max(1, Math.round(h * scale))
  const tiles = Math.ceil(scaledW / 512) * Math.ceil(scaledH / 512)
  const shapeExtra = sizeBucket(`${w}x${h}`) === 'square' ? 4160 : 6240
  return 65 + tiles * 129 + shapeExtra
}

export function referenceInputUsd(ref = {}) {
  if (!ref) return REF_INPUT_USD
  const tokens = imageInputTokenEstimate(ref.width, ref.height)
  return (tokens * GPT_IMAGE_2_IMAGE_INPUT_USD_PER_1M) / 1e6
}

export function referencesInputUsd(references = []) {
  return (references || []).reduce((sum, ref) => sum + referenceInputUsd(ref), 0)
}

export function generationCostMood(krw) {
  if (!krw || krw < 80) return '동전도 아직 쿨함'
  if (krw < 250) return '지갑 가벼운 스트레칭'
  if (krw < 800) return '커피 한 모금급'
  if (krw < 2500) return '지갑이 눈치챔'
  return '예산 회의 소집'
}

export function estimateGenerationCost({ settings = {}, prompt, references = [], krwRate } = {}) {
  const promptText = prompt != null ? prompt : settings.prompt || ''
  const n = Math.max(1, Number(settings.n) || 1)
  const perImageUsd = outputUsdPerImage(settings)
  const outputUsd = perImageUsd * n
  const promptUsd = textInputUsd(promptText)
  const refUsd = referencesInputUsd(references)
  const totalUsd = outputUsd + promptUsd + refUsd
  const krw = usdToKrw(totalUsd, krwRate)
  return {
    usd: totalUsd,
    krw,
    perImageUsd,
    outputUsd,
    promptUsd,
    refUsd,
    promptTokens: estimateTextTokens(promptText),
    n,
    mood: generationCostMood(krw),
    hasPrompt: !!String(promptText || '').trim(),
  }
}

// 레코드(이미지 1장)의 추정 단가(USD).
// n(배치 크기)으로 참조 입력비를 분배 → 레코드 합산 시 총비용이 정확히 떨어짐.
export function recordUsd(item) {
  if (!item) return 0
  const per = outputUsdPerImage(item)
  const n = Math.max(1, item.n || 1)
  const refShare = (item.refInputUsd != null ? item.refInputUsd : (item.refCount || 0) * REF_INPUT_USD) / n
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
