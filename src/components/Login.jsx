import { useState } from 'react'
import { supabase } from '../supabase'

// 팀 모드 로그인 화면 — 관리자 생성 계정 + 비밀번호
// 가입은 Supabase 대시보드에서 막아두고, 관리자가 추가한 이메일만 로그인됩니다.
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle') // idle | signing | error
  const [error, setError] = useState('')

  const signIn = async () => {
    const addr = email.trim()
    if (!addr || !password) return
    setStatus('signing')
    setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: addr,
      password,
    })
    if (error) {
      setStatus('error')
      setError(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호를 확인해 주세요.' : error.message || '로그인에 실패했습니다.')
    } else {
      setStatus('idle')
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f7f7',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 400,
          maxWidth: '100%',
          background: '#ffffff',
          borderRadius: 20,
          padding: 32,
          boxShadow: 'rgba(0,0,0,0.02) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 6px 0px, rgba(0,0,0,0.1) 0px 4px 8px 0px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 22 }}>
          <img
            src="/qmarket-app-symbol.svg"
            alt=""
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: 'block',
              boxShadow: 'rgba(255,72,0,0.18) 0px 4px 12px',
              flex: 'none',
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div className="brand-name-full" style={{ fontSize: 19, fontWeight: 700 }}>마케팅챕터 이미지 스튜디오</div>
            <div className="brand-name-short" style={{ fontSize: 19, fontWeight: 700 }}>AWM-Studio</div>
          </div>
        </div>

        <div style={{ fontSize: 14, color: '#6a6a6a', lineHeight: 1.6, marginBottom: 20 }}>
          팀 전용 도구입니다. 관리자가 추가한 이메일과 임시 비밀번호로 로그인하세요.
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>이메일</label>
        <input
          className="q-field"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') signIn()
          }}
          placeholder="you@team.com"
          style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 14, padding: '13px 15px', fontSize: 14, color: '#222222', marginBottom: 12 }}
        />
        <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>비밀번호</label>
        <input
          className="q-field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') signIn()
          }}
          placeholder="임시 비밀번호"
          style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 14, padding: '13px 15px', fontSize: 14, color: '#222222', marginBottom: 14 }}
        />
        {status === 'error' && (
          <div style={{ fontSize: 12, color: '#d4351c', marginBottom: 12 }}>{error}</div>
        )}
        <button
          onClick={signIn}
          disabled={status === 'signing' || !email.trim() || !password}
          className="q-generate"
          style={{
            width: '100%',
            height: 50,
            border: 'none',
            borderRadius: 14,
            background: status === 'signing' || !email.trim() || !password ? '#ffb38f' : '#ff4800',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: status === 'signing' || !email.trim() || !password ? 'default' : 'pointer',
            boxShadow: status === 'signing' || !email.trim() || !password ? 'none' : 'rgba(255,72,0,0.35) 0px 6px 18px',
          }}
        >
          {status === 'signing' ? '로그인 중…' : '로그인'}
        </button>
        <div style={{ marginTop: 12, fontSize: 11, color: '#8a8a8a', lineHeight: 1.5 }}>
          최초 로그인 후 우측 상단의 비밀번호 변경에서 새 비밀번호로 바꿔 주세요.
        </div>
      </div>
    </div>
  )
}
