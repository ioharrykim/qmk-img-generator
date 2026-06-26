import { useState } from 'react'
import { supabase } from '../supabase'

// 팀 모드 로그인 화면 — 이메일 매직링크
// 가입은 Supabase 대시보드에서 막아두고, 초대된 팀원 이메일만 로그인됩니다.
export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  const sendLink = async () => {
    const addr = email.trim()
    if (!addr) return
    setStatus('sending')
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setStatus('error')
      setError(error.message || '링크 전송에 실패했습니다.')
    } else {
      setStatus('sent')
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

        {status === 'sent' ? (
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>메일함을 확인해 주세요 📧</div>
            <div style={{ fontSize: 13, color: '#6a6a6a', lineHeight: 1.6 }}>
              <b style={{ color: '#222' }}>{email}</b> 으로 로그인 링크를 보냈습니다. 링크를 클릭하면 자동으로 로그인됩니다.
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="q-link"
              style={{ marginTop: 16, background: 'transparent', border: 'none', fontSize: 13, fontWeight: 600, color: '#6a6a6a', cursor: 'pointer', padding: 0 }}
            >
              다른 이메일로 다시 시도
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: '#6a6a6a', lineHeight: 1.6, marginBottom: 20 }}>
              팀 전용 도구입니다. 초대된 이메일로 로그인 링크를 받아 접속하세요.
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>이메일</label>
            <input
              className="q-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendLink()
              }}
              placeholder="you@team.com"
              style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 14, padding: '13px 15px', fontSize: 14, color: '#222222', marginBottom: 14 }}
            />
            {status === 'error' && (
              <div style={{ fontSize: 12, color: '#d4351c', marginBottom: 12 }}>{error}</div>
            )}
            <button
              onClick={sendLink}
              disabled={status === 'sending' || !email.trim()}
              className="q-generate"
              style={{
                width: '100%',
                height: 50,
                border: 'none',
                borderRadius: 14,
                background: status === 'sending' || !email.trim() ? '#ffb38f' : '#ff4800',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: status === 'sending' || !email.trim() ? 'default' : 'pointer',
                boxShadow: status === 'sending' || !email.trim() ? 'none' : 'rgba(255,72,0,0.35) 0px 6px 18px',
              }}
            >
              {status === 'sending' ? '전송 중…' : '로그인 링크 받기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
