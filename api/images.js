// Vercel 서버리스 함수 — 큐이미지 스튜디오 팀 모드 백엔드
//
// 흐름:
//  1) 요청의 Supabase 액세스 토큰 검증 (로그인한 팀원만 허용)
//  2) 서버 키로 OpenAI 이미지 생성/편집 호출 (키는 Vercel 환경변수에만 존재)
//  3) 결과를 Supabase Storage 에 저장 + generations 테이블에 기록 (service role)
//  4) row 들을 반환 (base64 가 아니라 메타데이터만 → Vercel 4.5MB 본문 제한 회피)
//
// 필요한 Vercel 환경변수:
//  OPENAI_API_KEY              (필수, 비밀)
//  SUPABASE_SERVICE_ROLE_KEY   (필수, 비밀)
//  VITE_SUPABASE_URL           (클라이언트와 공용)
//  VITE_SUPABASE_ANON_KEY      (클라이언트와 공용)

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const BUCKET = process.env.STORAGE_BUCKET || 'generations'

const OPENAI_GEN = 'https://api.openai.com/v1/images/generations'
const OPENAI_EDIT = 'https://api.openai.com/v1/images/edits'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'POST 만 허용됩니다.' } })
  }
  if (!OPENAI_KEY || !SUPABASE_URL || !SERVICE_ROLE || !SUPABASE_ANON) {
    return res.status(500).json({ error: { message: '서버 환경변수가 설정되지 않았습니다. (OPENAI_API_KEY / SUPABASE_*)' } })
  }

  // 1) 인증 검증
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: { message: '로그인이 필요합니다.' } })

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON)
  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser(token)
  if (userErr || !user) return res.status(401).json({ error: { message: '인증에 실패했습니다. 다시 로그인해 주세요.' } })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  try {
    const { settings = {}, prompt = '', imageUrls = [] } = req.body || {}
    let format = settings.format || 'png'
    let background = settings.background || 'opaque'
    if (background === 'transparent' && format === 'jpeg') format = 'png'
    const model = settings.model || 'gpt-image-2'
    const n = settings.n || 1

    // 2) OpenAI 호출
    let oaRes
    if (imageUrls.length > 0) {
      const fd = new FormData()
      fd.append('model', model)
      fd.append('prompt', prompt)
      fd.append('n', String(n))
      if (settings.size) fd.append('size', settings.size)
      if (settings.quality) fd.append('quality', settings.quality)
      if (background) fd.append('background', background)
      fd.append('output_format', format)
      if (format === 'jpeg' || format === 'webp') fd.append('output_compression', String(settings.compression ?? 85))
      const field = imageUrls.length > 1 ? 'image[]' : 'image'
      for (let i = 0; i < imageUrls.length; i++) {
        const r = await fetch(imageUrls[i])
        if (!r.ok) throw new Error('참조 이미지를 불러오지 못했습니다.')
        const ab = await r.arrayBuffer()
        const type = r.headers.get('content-type') || 'image/png'
        const ext = (type.split('/')[1] || 'png').replace('jpeg', 'jpg')
        fd.append(field, new Blob([Buffer.from(ab)], { type }), 'ref' + i + '.' + ext)
      }
      oaRes = await fetch(OPENAI_EDIT, { method: 'POST', headers: { Authorization: 'Bearer ' + OPENAI_KEY }, body: fd })
    } else {
      const body = { model, prompt, n, size: settings.size, quality: settings.quality, background, output_format: format }
      if (format === 'jpeg' || format === 'webp') body.output_compression = settings.compression ?? 85
      if (settings.moderation) body.moderation = settings.moderation
      oaRes = await fetch(OPENAI_GEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + OPENAI_KEY },
        body: JSON.stringify(body),
      })
    }

    const json = await oaRes.json()
    if (!oaRes.ok) return res.status(oaRes.status).json(json)

    // 3) Storage 업로드 + generations insert
    const items = []
    const list = json.data || []
    for (let i = 0; i < list.length; i++) {
      const buf = Buffer.from(list[i].b64_json, 'base64')
      const id = crypto.randomUUID()
      const storage_path = `${user.id}/${id}.${format}`
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(storage_path, buf, { contentType: 'image/' + format, upsert: false })
      if (upErr) throw new Error('이미지 저장 실패: ' + upErr.message)

      const row = {
        id,
        user_id: user.id,
        prompt,
        size: settings.size || null,
        format,
        model,
        n,
        ref_count: imageUrls.length,
        storage_path,
      }
      const { error: insErr } = await admin.from('generations').insert(row)
      if (insErr) throw new Error('기록 저장 실패: ' + insErr.message)

      items.push({ ...row, created_at: new Date().toISOString() })
    }

    return res.status(200).json({ items })
  } catch (e) {
    return res.status(500).json({ error: { message: e.message || '처리 중 오류가 발생했습니다.' } })
  }
}
