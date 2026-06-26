import { useState } from 'react'
import { supabase } from '../supabase'

export default function PasswordModal({ open, prompt = false, onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  if (!open) return null

  const reset = () => {
    setPassword('')
    setConfirm('')
    setStatus('idle')
    setError('')
  }

  const close = () => {
    reset()
    onClose && onClose()
  }

  const submit = async () => {
    if (status === 'saving') return
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      setError('새 비밀번호가 서로 다릅니다.')
      return
    }
    setStatus('saving')
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setStatus('idle')
      setError(error.message || '비밀번호 변경에 실패했습니다.')
      return
    }
    reset()
    onSuccess && onSuccess()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.34)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '100%',
          background: '#ffffff',
          borderRadius: 20,
          padding: 26,
          boxShadow: 'rgba(0,0,0,0.18) 0px 18px 60px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#222222', marginBottom: 6 }}>
              {prompt ? '새 비밀번호로 바꿔 주세요' : '비밀번호 변경'}
            </div>
            <div style={{ fontSize: 13, color: '#6a6a6a', lineHeight: 1.5 }}>
              로그인된 상태에서 바로 변경되며, 별도 이메일 인증은 필요하지 않습니다.
            </div>
          </div>
          <button
            onClick={close}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              border: 'none',
              background: '#f7f7f7',
              color: '#6a6a6a',
              fontSize: 18,
              cursor: 'pointer',
              flex: 'none',
            }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>새 비밀번호</label>
        <input
          className="q-field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="6자 이상"
          style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 14, padding: '13px 15px', fontSize: 14, color: '#222222', marginBottom: 12 }}
        />

        <label style={{ fontSize: 12, fontWeight: 600, color: '#6a6a6a', display: 'block', marginBottom: 6 }}>새 비밀번호 확인</label>
        <input
          className="q-field"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="한 번 더 입력"
          style={{ width: '100%', border: '1px solid #dddddd', borderRadius: 14, padding: '13px 15px', fontSize: 14, color: '#222222', marginBottom: 12 }}
        />

        {error && <div style={{ fontSize: 12, color: '#d4351c', lineHeight: 1.5, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button
            onClick={close}
            style={{
              background: '#ffffff',
              border: '1px solid #dddddd',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#6a6a6a',
              cursor: 'pointer',
            }}
          >
            나중에
          </button>
          <button
            onClick={submit}
            disabled={status === 'saving'}
            className="q-generate"
            style={{
              background: status === 'saving' ? '#ffb38f' : '#ff4800',
              border: 'none',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: '#ffffff',
              cursor: status === 'saving' ? 'default' : 'pointer',
            }}
          >
            {status === 'saving' ? '변경 중…' : '변경하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
