// OpenAI 이미지 생성 호출 로직
//
// 두 가지 호출 모드:
//  - direct: 브라우저 → OpenAI 직접 호출 (키는 사용자 localStorage). 정적 배포/로컬용.
//  - proxy : 브라우저 → 자체 백엔드(/api/images) → OpenAI. 키는 서버에만. 배포 권장.
//
// 두 가지 엔드포인트:
//  - 참조 이미지가 없으면 /v1/images/generations (텍스트→이미지)
//  - 참조 이미지가 있으면 /v1/images/edits (이미지+프롬프트→이미지, 최대 여러 장)

import { STYLES } from './constants'
import { API_MODE, API_BASE, SUPABASE_ENABLED, STORAGE_BUCKET, UPLOADS_BUCKET } from './config'
import { supabase } from './supabase'
import { decorateNew } from './history'
import { uid } from './utils'

const OPENAI_GEN = 'https://api.openai.com/v1/images/generations'
const OPENAI_EDIT = 'https://api.openai.com/v1/images/edits'

// 프롬프트 + 선택한 스타일 suffix + 네거티브를 하나의 문장으로 합친다
export function buildPrompt(settings) {
  const parts = [settings.prompt.trim()]
  const suffixes = STYLES.filter((s) => settings.styles.includes(s.key)).map((s) => s.suffix)
  if (suffixes.length) parts.push(suffixes.join(', '))
  if (settings.negative.trim()) parts.push('Avoid: ' + settings.negative.trim())
  return parts.filter(Boolean).join('. ')
}

export function dataUrl(item) {
  return 'data:image/' + item.format + ';base64,' + item.b64
}

// 결과/기록 아이템의 표시용 src — 팀 모드(url) / 로컬 모드(b64) 모두 처리
export function imgSrc(item) {
  return item.url || (item.b64 ? dataUrl(item) : '')
}

export function aspectFor(size) {
  if (!size || size === 'auto') return '1 / 1'
  const m = String(size).match(/^(\d+)x(\d+)$/)
  if (m) return m[1] + ' / ' + m[2]
  return '1 / 1'
}

// 포맷/배경 보정: 투명 배경은 JPEG 로 표현 불가 → PNG
function normalizeFormat(settings) {
  let format = settings.format
  let background = settings.background
  if (background === 'transparent' && format === 'jpeg') format = 'png'
  return { format, background }
}

function parseError(res, json) {
  return new Error((json && json.error && json.error.message) || '요청 실패 (' + res.status + ')')
}

async function readJsonResponse(res, label) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch (e) {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 180)
    throw new Error(`${label} 응답을 해석하지 못했습니다. (${res.status}${res.statusText ? ' ' + res.statusText : ''})${snippet ? ': ' + snippet : ''}`)
  }
}

// 직접 모드 호출 → OpenAI 응답의 data 배열 반환
async function callDirect({ apiKey, settings, prompt, references, format, background }) {
  const useEdit = references && references.length > 0
  let res
  let json
  try {
    if (useEdit) {
      const fd = new FormData()
      fd.append('model', settings.model || 'gpt-image-2')
      fd.append('prompt', prompt)
      fd.append('n', String(settings.n))
      if (settings.size) fd.append('size', settings.size)
      if (settings.quality) fd.append('quality', settings.quality)
      if (background) fd.append('background', background)
      fd.append('output_format', format)
      if (format === 'jpeg' || format === 'webp') fd.append('output_compression', String(settings.compression))
      // 단일은 image, 복수는 image[] (OpenAI edits 호환성)
      const field = references.length > 1 ? 'image[]' : 'image'
      references.forEach((r, i) => fd.append(field, r.blob, r.name || 'ref' + i + '.png'))
      res = await fetch(OPENAI_EDIT, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey },
        body: fd,
      })
    } else {
      const body = {
        model: settings.model || 'gpt-image-2',
        prompt,
        n: settings.n,
        size: settings.size,
        quality: settings.quality,
        background,
        output_format: format,
      }
      if (format === 'jpeg' || format === 'webp') body.output_compression = settings.compression
      if (settings.moderation) body.moderation = settings.moderation
      res = await fetch(OPENAI_GEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify(body),
      })
    }
  } catch (e) {
    throw new Error('네트워크 오류 또는 API 키 권한 문제일 수 있습니다. 키와 결제 설정을 확인해 주세요.')
  }
  json = await readJsonResponse(res, 'OpenAI')
  if (!res.ok || json.error) throw parseError(res, json)
  return json.data || []
}

// 프록시 모드 호출 → 자체 서버에 JSON 전달(참조 이미지는 data URL 로)
async function callProxy({ settings, prompt, references, format, background }) {
  let res
  let json
  try {
    res = await fetch(API_BASE + '/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: { ...settings, format, background },
        prompt,
        images: (references || []).map((r) => r.dataUrl),
      }),
    })
  } catch (e) {
    throw new Error('서버에 연결하지 못했습니다. 백엔드가 실행 중인지 확인해 주세요.')
  }
  json = await readJsonResponse(res, '서버')
  if (!res.ok || json.error) throw parseError(res, json)
  return json.data || []
}

// 팀 모드: 참조 이미지를 Storage 에 올려 서명 URL 로 전달 → 함수가 OpenAI 호출 후
// 결과를 Storage 에 저장하고 row 를 반환 → 클라이언트는 서명 URL 을 붙여 표시.
async function callTeam({ settings, prompt, references, format, background }) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('로그인이 필요합니다.')
  const userId = session.user.id

  const tempPaths = []
  try {
    // 1) 참조 이미지 업로드 → 서명 URL
    const uploadedRefs = await Promise.all((references || []).map(async (r) => {
      const ext = ((r.type && r.type.split('/')[1]) || 'png').replace('jpeg', 'jpg')
      const path = `${userId}/tmp-${uid()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(UPLOADS_BUCKET)
        .upload(path, r.blob, { contentType: r.type || 'image/png', upsert: false })
      if (upErr) throw new Error('참조 이미지 업로드 실패: ' + upErr.message)
      tempPaths.push(path)
      const { data: signed, error: signErr } = await supabase.storage.from(UPLOADS_BUCKET).createSignedUrl(path, 600)
      if (signErr || !signed) throw new Error('참조 이미지 URL 생성 실패')
      return { url: signed.signedUrl, path }
    }))
    const imageUrls = uploadedRefs.map((ref) => ref.url)

    // 2) 서버리스 함수 호출
    let res
    let json
    try {
      res = await fetch(API_BASE + '/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ settings: { ...settings, format, background }, prompt, imageUrls }),
      })
    } catch (e) {
      throw new Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    json = await readJsonResponse(res, '서버')
    if (!res.ok || json.error) throw parseError(res, json)

    const items = await decorateNew(json.items || [])
    if (!items.length) throw new Error('이미지를 받지 못했습니다.')
    return items
  } finally {
    // 임시 참조 파일 정리(베스트 에포트)
    if (tempPaths.length) supabase.storage.from(UPLOADS_BUCKET).remove(tempPaths).catch(() => {})
  }
}

// 실제 생성 요청. 성공 시 결과 이미지 배열, 실패 시 throw.
export async function generateImages({ apiKey, settings, references }) {
  const prompt = buildPrompt(settings)
  const { format, background } = normalizeFormat(settings)

  // 팀 모드(Supabase) → URL 기반 아이템 반환
  if (SUPABASE_ENABLED) {
    return callTeam({ settings, prompt, references, format, background })
  }

  // 로컬/자체 서버 모드 → base64 기반 아이템 반환
  const data =
    API_MODE === 'proxy'
      ? await callProxy({ settings, prompt, references, format, background })
      : await callDirect({ apiKey, settings, prompt, references, format, background })

  const imgs = data.map((d, i) => ({
    id: Date.now() + '-' + i,
    b64: d.b64_json,
    format,
    prompt,
    size: settings.size,
    quality: settings.quality,
    model: settings.model,
    n: settings.n,
    refCount: (references || []).length,
  }))
  if (!imgs.length) throw new Error('이미지를 받지 못했습니다.')

  return imgs
}
