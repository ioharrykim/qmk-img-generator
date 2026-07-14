import { useState } from 'react'
import { textCostUsd, usdToKrw, formatKrw, formatUsd } from '../pricing'

// 프롬프트 생성 모델 선택 팝업 — 모델별 1회 예상 비용 표시
export default function PromptModelModal({ models, defaultModel, estInputTokens, estOutputTokens, krwRate, generating, onConfirm, onClose }) {
  const [picked, setPicked] = useState(defaultModel || (models[0] && models[0].value))

  return (
    <div
      onClick={generating ? undefined : onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: '100%',
          background: '#ffffff',
          borderRadius: 20,
          padding: 28,
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.2px', marginBottom: 8 }}>프롬프트 생성 모델 선택</div>
        <div style={{ fontSize: 13, color: '#6a6a6a', lineHeight: 1.5, marginBottom: 18 }}>
          이 프롬프트를 만들 AI 모델을 고르세요. 우측은 <b style={{ color: '#222' }}>1회 생성 예상 비용</b>입니다(대략치).
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {models.map((m) => {
            const usd = textCostUsd(m.value, estInputTokens, estOutputTokens)
            const active = picked === m.value
            return (
              <button
                key={m.value}
                onClick={() => setPicked(m.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  border: '1.5px solid ' + (active ? '#ff4800' : '#e5e5e5'),
                  background: active ? '#fff6f2' : '#ffffff',
                  borderRadius: 14,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all .12s ease',
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '2px solid ' + (active ? '#ff4800' : '#c9c9c9'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4800' }} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#222' }}>{m.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: '#6a6a6a', marginTop: 2 }}>{m.hint}</span>
                </span>
                <span style={{ flex: 'none', textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: active ? '#ff4800' : '#222' }}>≈ {formatKrw(usdToKrw(usd, krwRate))}</span>
                  <span style={{ display: 'block', fontSize: 10, color: '#9a9a9a', marginTop: 2 }}>{formatUsd(usd)}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={generating}
            style={{
              background: 'transparent',
              border: '1px solid #dddddd',
              borderRadius: 8,
              padding: '11px 18px',
              fontSize: 14,
              fontWeight: 600,
              color: '#222222',
              cursor: generating ? 'default' : 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(picked)}
            disabled={generating}
            style={{
              background: generating ? '#ffb38f' : '#ff4800',
              border: 'none',
              borderRadius: 8,
              padding: '11px 20px',
              fontSize: 14,
              fontWeight: 700,
              color: '#ffffff',
              cursor: generating ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {generating && (
              <span style={{ width: 14, height: 14, border: '2.5px solid rgba(255,255,255,.45)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'qspin .7s linear infinite' }} />
            )}
            {generating ? '생성 중…' : '이 모델로 생성'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#9a9a9a', marginTop: 12, lineHeight: 1.5 }}>
          선택한 모델이 다음에도 기본으로 기억됩니다. 실제 비용은 결과 길이에 따라 달라질 수 있어요.
        </div>
      </div>
    </div>
  )
}
