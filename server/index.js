// 큐이미지 스튜디오 — 프록시/정적 서버
//
// 역할:
//  1) 빌드된 프론트엔드(dist/)를 정적 서빙
//  2) POST /api/images 로 받은 요청을 서버 키로 OpenAI 에 프록시
//     (키가 클라이언트에 노출되지 않음 → 배포 권장 구성)
//
// 필요 환경변수:
//  OPENAI_API_KEY  (필수) — OpenAI 키
//  PORT            (선택) — 기본 3000
//
// 실행:
//  VITE_API_MODE=proxy npm run build   # 프록시 모드로 프론트 빌드
//  OPENAI_API_KEY=sk-... node server/index.js

import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json({ limit: '40mb' })) // 참조 이미지(base64)가 클 수 있음

const KEY = process.env.OPENAI_API_KEY
const OPENAI_GEN = 'https://api.openai.com/v1/images/generations'
const OPENAI_EDIT = 'https://api.openai.com/v1/images/edits'

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = String(dataUrl).split(',')
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'image/png'
  return new Blob([Buffer.from(b64, 'base64')], { type: mime })
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasKey: !!KEY })
})

app.post('/api/images', async (req, res) => {
  if (!KEY) {
    return res.status(500).json({ error: { message: '서버에 OPENAI_API_KEY 가 설정되지 않았습니다.' } })
  }
  try {
    const { settings = {}, prompt = '', images = [] } = req.body || {}
    let format = settings.format || 'png'
    let background = settings.background || 'opaque'
    if (background === 'transparent' && format === 'jpeg') format = 'png'
    const model = settings.model || 'gpt-image-2'
    const n = settings.n || 1

    let oaRes
    if (images.length > 0) {
      // 참조 이미지가 있으면 edits 엔드포인트 (multipart)
      const fd = new FormData()
      fd.append('model', model)
      fd.append('prompt', prompt)
      fd.append('n', String(n))
      if (settings.size) fd.append('size', settings.size)
      if (settings.quality) fd.append('quality', settings.quality)
      if (background) fd.append('background', background)
      fd.append('output_format', format)
      if (format === 'jpeg' || format === 'webp') fd.append('output_compression', String(settings.compression ?? 85))
      // 단일은 image, 복수는 image[] (OpenAI edits 호환성)
      const field = images.length > 1 ? 'image[]' : 'image'
      images.forEach((dataUrl, i) => {
        const blob = dataUrlToBlob(dataUrl)
        const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
        fd.append(field, blob, 'ref' + i + '.' + ext)
      })
      oaRes = await fetch(OPENAI_EDIT, { method: 'POST', headers: { Authorization: 'Bearer ' + KEY }, body: fd })
    } else {
      // 텍스트→이미지 generations 엔드포인트 (JSON)
      const body = { model, prompt, n, size: settings.size, quality: settings.quality, background, output_format: format }
      if (format === 'jpeg' || format === 'webp') body.output_compression = settings.compression ?? 85
      if (settings.moderation) body.moderation = settings.moderation
      oaRes = await fetch(OPENAI_GEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
        body: JSON.stringify(body),
      })
    }

    const json = await oaRes.json()
    res.status(oaRes.status).json(json)
  } catch (e) {
    res.status(500).json({ error: { message: e.message || '프록시 처리 중 오류가 발생했습니다.' } })
  }
})

// AI 고급 프롬프트 생성 (chat/completions 프록시)
app.post('/api/prompt', async (req, res) => {
  if (!KEY) {
    return res.status(500).json({ error: { message: '서버에 OPENAI_API_KEY 가 설정되지 않았습니다.' } })
  }
  try {
    const { model = 'gpt-5.5', messages = [] } = req.body || {}
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: { message: 'messages 가 필요합니다.' } })
    }
    const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      body: JSON.stringify({ model, messages }),
    })
    const json = await oaRes.json()
    if (!oaRes.ok) return res.status(oaRes.status).json(json)
    const text = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || ''
    res.status(200).json({ text, usage: json.usage || null })
  } catch (e) {
    res.status(500).json({ error: { message: e.message || '프롬프트 생성 중 오류가 발생했습니다.' } })
  }
})

// 정적 빌드 서빙 + SPA 폴백
const dist = path.join(__dirname, '..', 'dist')
app.use(express.static(dist))
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log('큐이미지 스튜디오 서버: http://localhost:' + port)
  if (!KEY) console.warn('⚠ OPENAI_API_KEY 가 설정되지 않았습니다. 생성 요청이 실패합니다.')
})
