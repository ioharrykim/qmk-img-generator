// AI 고급 프롬프트 생성 (큐마켓 상세페이지)
// 모드별 경로:
//  - 팀(Supabase): /api/prompt 로 (로그인 토큰 포함) → 함수가 OpenAI 호출
//  - 자체서버(proxy): /api/prompt 로 (Express 서버가 키 보유)
//  - 직접(direct): 브라우저 → OpenAI chat/completions (사용자 키)

import { API_MODE, API_BASE, SUPABASE_ENABLED } from './config'
import { supabase } from './supabase'
import { buildQmarketMessages } from './qmarketPrompts'

const OPENAI_CHAT = 'https://api.openai.com/v1/chat/completions'

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

export async function generateDetailPrompt({ apiKey, model, version, brief, refCount = 0 }) {
  const messages = buildQmarketMessages({ version, brief, refCount })
  const useModel = model || 'gpt-5.5'

  if (API_MODE === 'proxy') {
    const headers = { 'Content-Type': 'application/json' }
    if (SUPABASE_ENABLED) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다.')
      headers.Authorization = 'Bearer ' + session.access_token
    }
    let res
    let json
    try {
      res = await fetch(API_BASE + '/prompt', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: useModel, messages }),
      })
    } catch (e) {
      throw new Error('서버에 연결하지 못했습니다.')
    }
    json = await readJsonResponse(res, '서버')
    if (!res.ok || json.error) throw new Error((json && json.error && json.error.message) || '프롬프트 생성 실패 (' + res.status + ')')
    return { text: (json.text || '').trim(), usage: json.usage, model: useModel }
  }

  // 직접 모드
  if (!apiKey) throw new Error('OpenAI API 키가 필요합니다.')
  let res
  let json
  try {
    res = await fetch(OPENAI_CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({ model: useModel, messages }),
    })
  } catch (e) {
    throw new Error('네트워크 오류 또는 API 키 권한 문제일 수 있습니다.')
  }
  json = await readJsonResponse(res, 'OpenAI')
  if (!res.ok || json.error) throw new Error((json && json.error && json.error.message) || '프롬프트 생성 실패 (' + res.status + ')')
  const text = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || ''
  return { text: text.trim(), usage: json.usage, model: useModel }
}
