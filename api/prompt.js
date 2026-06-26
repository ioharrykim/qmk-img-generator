// Vercel 서버리스 함수 — 큐마켓 상세페이지 "AI 고급 프롬프트 생성"
//
// 흐름:
//  1) Supabase 액세스 토큰 검증 (로그인한 팀원만)
//  2) 서버 키로 OpenAI chat/completions 호출 (gpt-5.5 등)
//  3) 생성 텍스트 + 토큰 사용량 반환 (비용 추산용)
//
// 필요한 Vercel 환경변수: OPENAI_API_KEY, (인증용) VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions'

function startJsonHeartbeat(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })

  const timer = setInterval(() => {
    if (!res.writableEnded) res.write(' \n')
  }, 10000)

  return (payload) => {
    clearInterval(timer)
    if (!res.writableEnded) res.end(JSON.stringify(payload))
  }
}

async function readJson(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch (e) {
    return { error: { message: `OpenAI 응답을 해석하지 못했습니다. (${response.status})` } }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'POST 만 허용됩니다.' } })
  }
  if (!OPENAI_KEY || !SUPABASE_URL || !SUPABASE_ANON) {
    return res.status(500).json({ error: { message: '서버 환경변수가 설정되지 않았습니다.' } })
  }

  // 인증
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: { message: '로그인이 필요합니다.' } })
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON)
  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser(token)
  if (userErr || !user) return res.status(401).json({ error: { message: '인증에 실패했습니다.' } })

  let send = null
  try {
    const { model = 'gpt-5.5', messages = [] } = req.body || {}
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: { message: 'messages 가 필요합니다.' } })
    }

    send = startJsonHeartbeat(res)
    const oaRes = await fetch(OPENAI_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + OPENAI_KEY },
      body: JSON.stringify({ model, messages }),
    })
    const json = await readJson(oaRes)
    if (!oaRes.ok) return send(json)

    const text = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || ''
    return send({ text, usage: json.usage || null })
  } catch (e) {
    if (send) {
      return send({ error: { message: e.message || '프롬프트 생성 중 오류가 발생했습니다.' } })
    }
    if (!res.headersSent) {
      return res.status(500).json({ error: { message: e.message || '프롬프트 생성 중 오류가 발생했습니다.' } })
    }
    return res.end(JSON.stringify({ error: { message: e.message || '프롬프트 생성 중 오류가 발생했습니다.' } }))
  }
}
